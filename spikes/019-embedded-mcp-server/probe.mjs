#!/usr/bin/env node
// S019 probe. Disposable spike code — not production, not promoted.
//
// Spawns the pinned Spring language server jar directly, with the product's own
// argument vector, and varies exactly one element: whether
// `-Dspring.main.web-application-type=NONE` is present. Speaks LSP over stdio
// itself so the run needs neither Zed nor jdtls, then — in the same live
// process — drives the embedded MCP server over streamable HTTP.
//
// Usage: node probe.mjs <a|b> <outDir>
//   a  control: flag present (the product's current behaviour)
//   b  flag lifted; if a port binds, phase C drives MCP on the same process
//
// Every conclusion is written to <outDir>/arm-<x>.json. Nothing is asserted
// here; the spike document reads the transcripts.

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const JAVA = "/Users/algorist/.sdkman/candidates/java/25.0.3-tem/bin/java";
const JAR =
  "/private/tmp/zst-dataroute/profile/extensions/work/spring-tools/spring-tools/" +
  "5.2.0.RELEASE/extension/language-server/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";
const WORKTREE = "/private/tmp/zst-dataroute/worktree";
const DOC = path.join(WORKTREE, "src/main/resources/application.properties");

const arm = process.argv[2];
const outDir = process.argv[3];
if (!["a", "b"].includes(arm) || !outDir) {
  console.error("usage: probe.mjs <a|b> <outDir>");
  process.exit(2);
}

// The product's vector, verbatim from coordinator/src/main.mjs `springArguments`.
const PRODUCT_ARGS = [
  "-Xmx1024m",
  "-Dspring.config.location=classpath:/application.properties",
  "-Djdk.util.zip.disableZip64ExtraFieldValidation=true",
  "-Dspring.main.web-application-type=NONE",
  "-Xlog:jni+resolve=off",
  "-jar",
  JAR,
];
const args =
  arm === "a"
    ? PRODUCT_ARGS
    : PRODUCT_ARGS.filter((a) => a !== "-Dspring.main.web-application-type=NONE");

const record = {
  arm,
  startedAt: new Date().toISOString(),
  javaArgs: args,
  showMessages: [],
  logMessages: [],
  serverRequests: [],
  diagnostics: [],
  stdoutContamination: [],
  listeningSockets: [],
  mcp: null,
  lspAfterMcp: null,
  stderrTail: [],
};

const child = spawn(JAVA, args, { cwd: WORKTREE, stdio: ["pipe", "pipe", "pipe"] });

let stderr = "";
child.stderr.on("data", (b) => {
  stderr += b.toString();
  if (stderr.length > 400_000) stderr = stderr.slice(-400_000);
});

// ---------------------------------------------------------------- LSP framing
let buffer = Buffer.alloc(0);
const pending = new Map();
let nextId = 1;
const waiters = [];

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const sep = buffer.indexOf("\r\n\r\n");
    if (sep < 0) break;
    const header = buffer.subarray(0, sep).toString("ascii");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      // Anything at a message boundary that is not a header is non-LSP output
      // on stdout — the exact corruption this spike is looking for.
      record.stdoutContamination.push(header.slice(0, 400));
      buffer = buffer.subarray(sep + 4);
      continue;
    }
    if (!/^Content-Length:/i.test(header.trimStart())) {
      record.stdoutContamination.push(header.slice(0, 400));
    }
    const length = Number(match[1]);
    if (buffer.length < sep + 4 + length) break;
    const body = buffer.subarray(sep + 4, sep + 4 + length).toString("utf8");
    buffer = buffer.subarray(sep + 4 + length);
    try {
      handle(JSON.parse(body));
    } catch (error) {
      record.stdoutContamination.push(`unparseable body: ${String(error)}`);
    }
  }
});

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);
}

function request(method, params) {
  const id = nextId++;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`));
    }, 60_000);
  });
  send({ jsonrpc: "2.0", id, method, params });
  return promise;
}

function handle(message) {
  if (message.id !== undefined && message.method === undefined) {
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    }
    return;
  }
  if (message.method === "window/showMessage") {
    record.showMessages.push({ at: new Date().toISOString(), ...message.params });
  } else if (message.method === "window/logMessage") {
    if (record.logMessages.length < 500) record.logMessages.push(message.params);
  } else if (message.method === "textDocument/publishDiagnostics") {
    record.diagnostics.push({
      uri: message.params.uri,
      items: (message.params.diagnostics ?? []).map((d) => ({
        message: d.message,
        code: d.code,
        line: d.range?.start?.line,
      })),
    });
  }
  if (message.id !== undefined && message.method !== undefined) {
    // Server-to-client request. Answer everything benignly: this harness is not
    // the official Java extension and must not pretend to resolve a project.
    record.serverRequests.push(message.method);
    let result = null;
    if (message.method === "workspace/configuration") {
      result = (message.params?.items ?? []).map(() => ({}));
    } else if (message.method === "client/registerCapability") {
      result = null;
    } else if (message.method === "window/showMessageRequest") {
      result = null;
    } else if (message.method === "workspace/applyEdit") {
      result = { applied: false };
    }
    send({ jsonrpc: "2.0", id: message.id, result });
  }
  for (const waiter of waiters.slice()) {
    if (waiter.test(message)) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  }
}

function waitFor(test, ms, label) {
  return new Promise((resolve) => {
    const waiter = { test, resolve };
    waiters.push(waiter);
    setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) {
        waiters.splice(index, 1);
        resolve({ timedOut: label });
      }
    }, ms);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------------------------------------------------------------- socket probe
function listeningSockets() {
  try {
    const out = execFileSync("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", String(child.pid)], {
      encoding: "utf8",
    });
    return out
      .split("\n")
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const name = line.trim().split(/\s+/).slice(-2)[0];
        return { raw: line.trim(), address: name };
      });
  } catch (error) {
    return [{ raw: `lsof failed: ${String(error).slice(0, 200)}`, address: null }];
  }
}

// ------------------------------------------------------------- MCP over HTTP
async function mcpCall(base, endpoint, body, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const response = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    sessionId: response.headers.get("mcp-session-id"),
    contentType: response.headers.get("content-type"),
    body: text.slice(0, 20_000),
  };
}

function parseJsonRpc(payload) {
  // Streamable HTTP may answer as SSE; take the first data: line if so.
  const trimmed = payload.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  for (const line of trimmed.split("\n")) {
    if (line.startsWith("data:")) return JSON.parse(line.slice(5).trim());
  }
  throw new Error("no JSON-RPC payload");
}

// --------------------------------------------------------------------- drive
async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const initialize = await request("initialize", {
    processId: process.pid,
    rootUri: `file://${WORKTREE}`,
    workspaceFolders: [{ uri: `file://${WORKTREE}`, name: "worktree" }],
    capabilities: {
      workspace: {
        configuration: true,
        applyEdit: true,
        workspaceFolders: true,
        // Required, not optional: without it Spring never builds an
        // ExecuteCommandOptions, and JdtLsProjectCache.initialize then NPEs on
        // `getExecuteCommandProvider().getCommands()` before the handshake ends.
        executeCommand: { dynamicRegistration: true },
        symbol: { dynamicRegistration: true },
        didChangeConfiguration: { dynamicRegistration: true },
      },
      textDocument: {
        synchronization: { dynamicRegistration: false },
        publishDiagnostics: {},
        completion: { completionItem: { snippetSupport: false } },
      },
      window: { showMessage: {}, workDoneProgress: true },
    },
    initializationOptions: {},
  });
  record.initializeResult = {
    serverInfo: initialize?.serverInfo,
    capabilityKeys: Object.keys(initialize?.capabilities ?? {}),
  };
  send({ jsonrpc: "2.0", method: "initialized", params: {} });

  send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri: `file://${DOC}`,
        languageId: "spring-boot-properties",
        version: 1,
        text: fs.readFileSync(DOC, "utf8"),
      },
    },
  });

  await waitFor(
    (m) => m.method === "textDocument/publishDiagnostics" && m.params.uri.endsWith("application.properties"),
    30_000,
    "diagnostics",
  );

  // Give the embedded context time to finish starting before sampling sockets.
  await sleep(8_000);
  record.listeningSockets = listeningSockets();

  const announced = record.showMessages
    .map((m) => /port:?\s*(\d+)/i.exec(m.message ?? ""))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  record.announcedPorts = announced;

  const observed = record.listeningSockets
    .map((s) => /:(\d+)$/.exec(s.address ?? ""))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  record.observedPorts = observed;

  // Independent discovery: does the port appear anywhere in stderr?
  record.stderrPortLines = stderr
    .split("\n")
    .filter((line) => observed.some((p) => line.includes(String(p))))
    .slice(0, 20);

  if (arm === "b" && observed.length > 0) {
    const port = observed[0];
    const base = `http://localhost:${port}`;
    const mcp = { port, endpoint: null, attempts: [], tools: null, toolCall: null };

    for (const endpoint of ["/mcp", "/mcp/message", "/api/mcp", "/"]) {
      try {
        const response = await mcpCall(base, endpoint, {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "s019-probe", version: "0" },
          },
        });
        mcp.attempts.push({ endpoint, status: response.status, body: response.body.slice(0, 600) });
        if (response.status === 200) {
          mcp.endpoint = endpoint;
          mcp.sessionId = response.sessionId;
          mcp.initialize = parseJsonRpc(response.body);
          break;
        }
      } catch (error) {
        mcp.attempts.push({ endpoint, error: String(error).slice(0, 300) });
      }
    }

    if (mcp.endpoint) {
      await mcpCall(base, mcp.endpoint, { jsonrpc: "2.0", method: "notifications/initialized" }, mcp.sessionId);
      const list = await mcpCall(base, mcp.endpoint, { jsonrpc: "2.0", id: 2, method: "tools/list" }, mcp.sessionId);
      try {
        const parsed = parseJsonRpc(list.body);
        mcp.tools = (parsed.result?.tools ?? []).map((t) => t.name);
        mcp.toolCount = mcp.tools.length;
        mcp.schemas = Object.fromEntries(
          (parsed.result?.tools ?? []).map((t) => [t.name, t.inputSchema?.required ?? []]),
        );
      } catch (error) {
        mcp.tools = `unparseable: ${String(error)}; raw=${list.body.slice(0, 600)}`;
      }
      // Sample three tools that need no arguments, chosen to separate the two
      // data sources the decision cares about: the local index (needs a
      // resolved project this harness deliberately does not have) and the live
      // spring.io network calls (which reopen the closed offline row).
      mcp.calls = {};
      let callId = 3;
      for (const name of ["getProjectList", "getLatestReleaseInformation", "getGenerations"]) {
        const started = Date.now();
        const call = await mcpCall(
          base,
          mcp.endpoint,
          { jsonrpc: "2.0", id: callId++, method: "tools/call", params: { name, arguments: {} } },
          mcp.sessionId,
        );
        mcp.calls[name] = {
          status: call.status,
          ms: Date.now() - started,
          body: call.body.slice(0, 3_000),
        };
      }
      mcp.toolCall = mcp.calls.getProjectList;
    }
    record.mcp = mcp;

    // Phase C's real question: is the LSP session still alive afterwards?
    try {
      const completion = await request("textDocument/completion", {
        textDocument: { uri: `file://${DOC}` },
        position: { line: 0, character: 6 },
      });
      const items = completion?.items ?? completion ?? [];
      record.lspAfterMcp = { ok: true, itemCount: Array.isArray(items) ? items.length : null };
    } catch (error) {
      record.lspAfterMcp = { ok: false, error: String(error).slice(0, 300) };
    }
  }

  record.stderrTail = stderr.split("\n").slice(-80);
  record.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, `arm-${arm}.json`), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, `arm-${arm}-stderr.log`), stderr);
  console.log(`arm ${arm}: sockets=${JSON.stringify(record.observedPorts)} announced=${JSON.stringify(record.announcedPorts)}`);
  child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 1_500);
}

main().catch((error) => {
  record.fatal = String(error);
  record.stderrTail = stderr.split("\n").slice(-80);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `arm-${arm}.json`), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(outDir, `arm-${arm}-stderr.log`), stderr);
  console.error(`arm ${arm} failed: ${error}`);
  child.kill("SIGKILL");
  process.exit(1);
});
