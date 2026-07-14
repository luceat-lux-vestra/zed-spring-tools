"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pathToFileURL } = require("node:url");

const CALLBACK_ID = "s005.classpath.callback.9f2c";
const CALLBACK_METHOD = "workspace/executeClientCommand";
const PROJECT_NAME = "s004-command-fixture";
const ROUTE_SCHEMA = 1;
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
const MAX_HTTP_BODY_BYTES = 1024 * 1024;
const HEADER_SEPARATOR = Buffer.from("\r\n\r\n", "ascii");
const JAVA_OPTIONS = Object.freeze({
  "org.eclipse.jdt.core.compiler.compliance": "21",
  "org.eclipse.jdt.core.compiler.source": "21",
  "org.eclipse.jdt.core.compiler.codegen.targetPlatform": "21",
  "org.eclipse.jdt.core.compiler.release": "enabled",
});

async function runServer(args) {
  const options = parseArgs(args);
  const root = path.resolve(options.root);
  const routePath = path.resolve(options.route);
  const logPath = path.resolve(options.log);
  requireInside(root, routePath, "route record");
  requireInside(root, logPath, "evidence log");
  fs.mkdirSync(path.dirname(routePath), { recursive: true });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  const token = crypto.randomBytes(32).toString("hex");
  let sequence = 0;
  let shutdownRequested = false;
  let exitNotificationReceived = false;
  let callbackCount = 0;

  const record = (event, fields = {}) => {
    const entry = {
      time: new Date().toISOString(),
      sequence: ++sequence,
      event,
      ...fields,
    };
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  };

  const callbackServer = http.createServer((request, response) => {
    handleCallbackRequest(request, response, {
      root,
      token,
      record,
      claimCallback() {
        if (callbackCount !== 0) {
          return false;
        }
        callbackCount += 1;
        return true;
      },
    }).catch((error) => {
      record("http_internal_error", { errorType: error?.name ?? "Error" });
      if (!response.headersSent) {
        sendJson(response, 500, { error: "S005 sink internal error" });
      } else {
        response.destroy();
      }
    });
  });
  callbackServer.requestTimeout = 5_000;
  callbackServer.headersTimeout = 5_000;
  callbackServer.keepAliveTimeout = 1;

  await listenLoopback(callbackServer);
  const address = callbackServer.address();
  if (address === null || typeof address === "string" || address.address !== "127.0.0.1") {
    callbackServer.close();
    throw new Error("callback sink did not bind IPv4 loopback");
  }

  publishRoute(routePath, {
    schema: ROUTE_SCHEMA,
    callbackCommandId: CALLBACK_ID,
    port: address.port,
    token,
  });
  record("start", {
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    routeSchema: ROUTE_SCHEMA,
  });

  const cleanup = () => {
    removeOwnRoute(routePath, token);
    callbackServer.close();
  };
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  const send = (message) => {
    const body = JSON.stringify(message);
    process.stdout.write(frame(body));
  };
  const parser = new FrameParser((message) => {
    const method = typeof message.method === "string" ? message.method : null;
    const hasId = Object.hasOwn(message, "id");
    record("lsp_message", {
      direction: "in",
      kind: method === null ? "response" : hasId ? "request" : "notification",
      method,
      hasId,
    });

    if (method === "initialize" && hasId) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          capabilities: { textDocumentSync: 1 },
          serverInfo: { name: "S005 Classpath Callback Sink", version: "0.0.1" },
        },
      });
    } else if (method === "shutdown" && hasId) {
      shutdownRequested = true;
      send({ jsonrpc: "2.0", id: message.id, result: null });
    } else if (method === "exit" && !hasId) {
      exitNotificationReceived = true;
      cleanup();
      record("stop", {
        pid: process.pid,
        graceful: shutdownRequested,
        callbackCount,
      });
      process.stdout.write("", () => process.exit(shutdownRequested ? 0 : 1));
    } else if (method !== null && hasId) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: "Method not found" },
      });
    }
  });

  process.stdin.on("data", (chunk) => parser.push(chunk));
  process.stdin.on("end", () => {
    if (!exitNotificationReceived) {
      record("unexpected_eof", { pid: process.pid, callbackCount });
      cleanup();
      process.exitCode = 1;
    }
  });
  process.stdin.on("error", (error) => fail(record, cleanup, "stdin_error", error));
  process.on("uncaughtException", (error) =>
    fail(record, cleanup, "uncaught_exception", error),
  );
}

async function handleCallbackRequest(request, response, runtime) {
  if (request.method !== "POST" || request.url !== "/s005-callback") {
    sendJson(response, 404, { error: "not found" });
    return;
  }

  let body;
  try {
    body = JSON.parse((await readRequestBody(request)).toString("utf8"));
  } catch (error) {
    runtime.record("callback_rejected", { reason: "malformed_body" });
    sendJson(response, 400, { error: "malformed request" });
    return;
  }

  if (!isExactObject(body, ["token", "method", "params"])) {
    runtime.record("callback_rejected", { reason: "unexpected_envelope" });
    sendJson(response, 400, { error: "malformed request" });
    return;
  }
  if (!equalSecret(body.token, runtime.token)) {
    runtime.record("callback_rejected", { reason: "authentication" });
    sendJson(response, 403, { error: "authentication failed" });
    return;
  }

  const validation = validateCallback(body.method, body.params, runtime.root);
  if (!validation.ok) {
    runtime.record("callback_rejected", { reason: validation.reason });
    sendJson(response, 422, { error: "callback contract mismatch" });
    return;
  }
  if (!runtime.claimCallback()) {
    runtime.record("callback_rejected", { reason: "duplicate" });
    sendJson(response, 409, { error: "duplicate callback" });
    return;
  }

  runtime.record("callback_accepted", {
    method: body.method,
    command: body.params.command,
    projectName: body.params.arguments[1],
    deleted: body.params.arguments[2],
    argumentCount: body.params.arguments.length,
    params: body.params,
  });
  sendJson(response, 200, { result: "done" });
}

function validateCallback(method, params, root) {
  if (method !== CALLBACK_METHOD) {
    return rejected("method");
  }
  if (!isPlainObject(params) || params.command !== CALLBACK_ID) {
    return rejected("command");
  }
  const args = params.arguments;
  if (!Array.isArray(args) || args.length !== 6) {
    return rejected("argument_count");
  }
  if (!sameFileUri(args[0], pathToFileURL(path.resolve(root)).href)) {
    return rejected("project_uri");
  }
  if (args[1] !== PROJECT_NAME || args[2] !== false) {
    return rejected("project_identity");
  }
  if (!hasExpectedSourceEntry(args[3])) {
    return rejected("classpath");
  }
  const build = args[4];
  if (
    !isPlainObject(build) ||
    build.type !== "maven" ||
    !sameFileUri(build.buildFile, pathToFileURL(path.join(path.resolve(root), "pom.xml")).href)
  ) {
    return rejected("project_build");
  }
  if (!isPlainObject(args[5])) {
    return rejected("java_options");
  }
  for (const [key, value] of Object.entries(JAVA_OPTIONS)) {
    if (args[5][key] !== value) {
      return rejected("java_options");
    }
  }
  return { ok: true };
}

function hasExpectedSourceEntry(classpath) {
  if (!isPlainObject(classpath) || !Array.isArray(classpath.entries)) {
    return false;
  }
  return classpath.entries.some(
    (entry) =>
      isPlainObject(entry) &&
      entry.kind === "source" &&
      typeof entry.path === "string" &&
      entry.path.replaceAll("\\", "/").endsWith("/src/main/java") &&
      entry.isOwn === true &&
      entry.isJavaContent === true &&
      entry.isTest === false,
  );
}

function publishRoute(routePath, route) {
  if (!isExactObject(route, ["schema", "callbackCommandId", "port", "token"])) {
    throw new Error("route schema changed");
  }
  const temporary = `${routePath}.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  let linked = false;
  try {
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(route)}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.linkSync(temporary, routePath);
    linked = true;
  } finally {
    fs.rmSync(temporary, { force: true });
    if (!linked && fs.existsSync(routePath)) {
      throw new Error("route record already exists");
    }
  }
}

function removeOwnRoute(routePath, token) {
  try {
    const route = JSON.parse(fs.readFileSync(routePath, "utf8"));
    if (route.token === token && route.callbackCommandId === CALLBACK_ID) {
      fs.rmSync(routePath);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      process.stderr.write("S005 route cleanup could not verify the route owner\n");
    }
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const header = request.headers["content-length"];
    const length = typeof header === "string" ? Number.parseInt(header, 10) : NaN;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_HTTP_BODY_BYTES) {
      reject(new Error("invalid content length"));
      request.resume();
      return;
    }
    const chunks = [];
    let received = 0;
    request.on("data", (chunk) => {
      received += chunk.length;
      if (received > length || received > MAX_HTTP_BODY_BYTES) {
        reject(new Error("request body exceeded declared length"));
        request.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    request.on("end", () => {
      if (received !== length) {
        reject(new Error("truncated request body"));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": body.length,
    Connection: "close",
  });
  response.end(body);
}

function listenLoopback(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

class FrameParser {
  constructor(onMessage) {
    this.input = Buffer.alloc(0);
    this.onMessage = onMessage;
  }

  push(chunk) {
    this.input = Buffer.concat([this.input, chunk]);
    while (true) {
      const headerEnd = this.input.indexOf(HEADER_SEPARATOR);
      if (headerEnd === -1) {
        if (this.input.length > MAX_MESSAGE_BYTES) {
          throw new Error("LSP header exceeds maximum size");
        }
        return;
      }
      const header = this.input.subarray(0, headerEnd).toString("ascii");
      const contentLength = parseContentLength(header);
      const bodyStart = headerEnd + HEADER_SEPARATOR.length;
      const bodyEnd = bodyStart + contentLength;
      if (this.input.length < bodyEnd) {
        return;
      }
      const body = this.input.subarray(bodyStart, bodyEnd).toString("utf8");
      this.input = this.input.subarray(bodyEnd);
      this.onMessage(JSON.parse(body));
    }
  }
}

function parseArgs(args) {
  const expected = ["--root", "--route", "--log"];
  if (args.length !== 6) {
    throw new Error("usage: callback_sink.js --root <path> --route <path> --log <path>");
  }
  const values = {};
  for (let index = 0; index < expected.length; index += 1) {
    const flag = expected[index];
    if (args[index * 2] !== flag || args[index * 2 + 1].length === 0) {
      throw new Error("usage: callback_sink.js --root <path> --route <path> --log <path>");
    }
    values[flag.slice(2)] = args[index * 2 + 1];
  }
  return values;
}

function parseContentLength(header) {
  const match = /^Content-Length:\s*(\d+)\s*$/im.exec(header);
  if (!match) {
    throw new Error("missing Content-Length header");
  }
  const length = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MESSAGE_BYTES) {
    throw new Error("invalid Content-Length header");
  }
  return length;
}

function frame(body) {
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function requireInside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child of the active worktree`);
  }
}

function sameFileUri(actual, expected) {
  if (typeof actual !== "string") {
    return false;
  }
  try {
    const normalize = (value) => {
      const url = new URL(value);
      if (url.protocol !== "file:") {
        return null;
      }
      return url.href.replace(/\/$/, "");
    };
    return normalize(actual) === normalize(expected);
  } catch {
    return false;
  }
}

function equalSecret(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") {
    return false;
  }
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isExactObject(value, keys) {
  if (!isPlainObject(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function rejected(reason) {
  return { ok: false, reason };
}

function fail(record, cleanup, event, error) {
  record(event, { pid: process.pid, errorType: error?.name ?? "Error" });
  cleanup();
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
}

function validCallback(root) {
  return {
    method: CALLBACK_METHOD,
    params: {
      command: CALLBACK_ID,
      arguments: [
        pathToFileURL(root).href,
        PROJECT_NAME,
        false,
        {
          entries: [
            {
              kind: "source",
              path: path.join(root, "src", "main", "java"),
              isOwn: true,
              isJavaContent: true,
              isTest: false,
            },
          ],
        },
        { type: "maven", buildFile: pathToFileURL(path.join(root, "pom.xml")).href },
        { ...JAVA_OPTIONS },
      ],
    },
  };
}

async function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s005-sink-test-"));
  try {
    fs.mkdirSync(path.join(root, "src", "main", "java"), { recursive: true });
    fs.writeFileSync(path.join(root, "pom.xml"), "<project/>\n");
    const callback = validCallback(root);
    requireCondition(validateCallback(callback.method, callback.params, root).ok, "valid callback rejected");

    const altered = structuredClone(callback.params);
    altered.arguments[5]["org.eclipse.jdt.core.compiler.release"] = "disabled";
    requireCondition(
      validateCallback(callback.method, altered, root).reason === "java_options",
      "altered Java options accepted",
    );
    requireCondition(
      validateCallback("other", callback.params, root).reason === "method",
      "unrelated method accepted",
    );

    const routePath = path.join(root, ".s005-artifacts", "callback-route.json");
    fs.mkdirSync(path.dirname(routePath), { recursive: true });
    const route = { schema: 1, callbackCommandId: CALLBACK_ID, port: 1234, token: "a".repeat(64) };
    publishRoute(routePath, route);
    requireCondition(JSON.parse(fs.readFileSync(routePath, "utf8")).port === 1234, "route changed");
    let existingRejected = false;
    try {
      publishRoute(routePath, route);
    } catch {
      existingRejected = true;
    }
    requireCondition(existingRejected, "existing route was overwritten");
    removeOwnRoute(routePath, "b".repeat(64));
    requireCondition(fs.existsSync(routePath), "foreign route was removed");
    removeOwnRoute(routePath, route.token);
    requireCondition(!fs.existsSync(routePath), "owned route was retained");

    const messages = [];
    const parser = new FrameParser((message) => messages.push(message));
    const first = frame(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }));
    const second = frame(JSON.stringify({ jsonrpc: "2.0", method: "exit" }));
    const bytes = Buffer.from(first + second, "utf8");
    parser.push(bytes.subarray(0, 11));
    parser.push(bytes.subarray(11, first.length + 5));
    parser.push(bytes.subarray(first.length + 5));
    requireCondition(messages.length === 2, "split or adjacent LSP frames changed");
    requireCondition(!equalSecret("a".repeat(64), "b".repeat(64)), "token mismatch accepted");
    requireCondition(equalSecret("a".repeat(64), "a".repeat(64)), "equal token rejected");

    const token = "c".repeat(64);
    let claimed = false;
    const runtime = {
      root,
      token,
      record() {},
      claimCallback() {
        if (claimed) {
          return false;
        }
        claimed = true;
        return true;
      },
    };
    const accepted = await invokeHandlerForTest({ token, ...callback }, runtime);
    requireCondition(accepted.status === 200, "valid HTTP callback was rejected");
    requireCondition(accepted.body.result === "done", "sink result changed");
    const duplicate = await invokeHandlerForTest({ token, ...callback }, runtime);
    requireCondition(duplicate.status === 409, "duplicate HTTP callback was accepted");
    const unauthorized = await invokeHandlerForTest(
      { token: "d".repeat(64), ...callback },
      { ...runtime, claimCallback: () => true },
    );
    requireCondition(unauthorized.status === 403, "wrong callback token was accepted");
    const malformed = await invokeHandlerForTest("not-json", runtime, false);
    requireCondition(malformed.status === 400, "malformed HTTP callback was accepted");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function invokeHandlerForTest(value, runtime, encodeJson = true) {
  const body = Buffer.from(encodeJson ? JSON.stringify(value) : value, "utf8");
  const request = Readable.from([body]);
  request.method = "POST";
  request.url = "/s005-callback";
  request.headers = { "content-length": String(body.length) };
  const captured = { status: null, body: null };
  const response = {
    headersSent: false,
    writeHead(status) {
      captured.status = status;
      this.headersSent = true;
    },
    end(responseBody) {
      captured.body = JSON.parse(Buffer.from(responseBody).toString("utf8"));
    },
    destroy() {
      throw new Error("test response was destroyed");
    },
  };
  await handleCallbackRequest(request, response, runtime);
  return captured;
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

if (process.argv.length === 3 && process.argv[2] === "--self-test") {
  selfTest()
    .then(() => process.stdout.write("S005 callback sink self-test passed\n"))
    .catch((error) => {
      process.stderr.write(`${error?.stack ?? error}\n`);
      process.exit(1);
    });
} else {
  runServer(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  });
}
