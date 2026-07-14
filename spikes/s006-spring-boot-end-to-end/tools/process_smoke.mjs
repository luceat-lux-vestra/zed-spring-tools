#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const TIMEOUT_MS = 10_000;
const SOURCE_COMMIT = "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";

function encode(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

class Decoder {
  buffer = Buffer.alloc(0);

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages = [];
    while (true) {
      const separator = this.buffer.indexOf("\r\n\r\n");
      if (separator < 0) break;
      const header = this.buffer.subarray(0, separator).toString("ascii");
      const match = /^Content-Length: ([0-9]+)$/im.exec(header);
      if (!match) throw new Error("fake-child smoke received an invalid LSP header");
      const length = Number.parseInt(match[1], 10);
      const end = separator + 4 + length;
      if (this.buffer.length < end) break;
      messages.push(JSON.parse(this.buffer.subarray(separator + 4, end).toString("utf8")));
      this.buffer = this.buffer.subarray(end);
    }
    return messages;
  }
}

function waitFor(predicate, label, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        const value = predicate();
        if (value) {
          resolve(value);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`timed out waiting for ${label}`));
      } else {
        setTimeout(poll, 20);
      }
    };
    poll();
  });
}

function observe(child) {
  const messages = [];
  const decoder = new Decoder();
  let stderr = "";
  child.stdout.on("data", (chunk) => messages.push(...decoder.push(chunk)));
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  return { messages, exited, stderr: () => stderr };
}

function writeFakeChild(destination) {
  const source = `#!/usr/bin/env node
let buffer = Buffer.alloc(0);
function encode(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from("Content-Length: " + body.length + "\\r\\n\\r\\n"), body]);
}
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const separator = buffer.indexOf("\\r\\n\\r\\n");
    if (separator < 0) break;
    const header = buffer.subarray(0, separator).toString("ascii");
    const match = /^Content-Length: ([0-9]+)$/im.exec(header);
    if (!match) process.exit(3);
    const length = Number.parseInt(match[1], 10);
    const end = separator + 4 + length;
    if (buffer.length < end) break;
    const message = JSON.parse(buffer.subarray(separator + 4, end).toString("utf8"));
    buffer = buffer.subarray(end);
    if (message.method === "exit") {
      process.exit(0);
    } else if (Object.hasOwn(message, "id")) {
      const result = message.method === "workspace/executeCommand"
        ? { fake: true, command: message.params?.command ?? null }
        : message.method === "shutdown" ? null : { capabilities: {} };
      process.stdout.write(encode({ jsonrpc: "2.0", id: message.id, result }));
    }
  }
});
process.stdin.on("end", () => process.exit(0));
`;
  fs.writeFileSync(destination, source, { encoding: "utf8", mode: 0o700, flag: "wx" });
}

async function lifecycle(child, observation, prefix) {
  const initializeId = `${prefix}-initialize`;
  child.stdin.write(encode({ jsonrpc: "2.0", id: initializeId, method: "initialize", params: {} }));
  const initialized = await waitFor(
    () => observation.messages.find((message) => message.id === initializeId),
    `${prefix} initialize response`,
  );
  assert.deepEqual(initialized.result, { capabilities: {} });
}

async function shutdown(child, observation, prefix) {
  const shutdownId = `${prefix}-shutdown`;
  child.stdin.write(encode({ jsonrpc: "2.0", id: shutdownId, method: "shutdown", params: null }));
  const response = await waitFor(
    () => observation.messages.find((message) => message.id === shutdownId),
    `${prefix} shutdown response`,
  );
  assert.equal(response.result, null);
  child.stdin.write(encode({ jsonrpc: "2.0", method: "exit", params: null }));
  child.stdin.end();
  const result = await observation.exited;
  assert.equal(result.signal, null, `${prefix} was terminated by a signal`);
  assert.equal(result.code, 0, `${prefix} failed: ${observation.stderr()}`);
}

function postJson(port, pathname, body) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: pathname,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": bytes.length,
        connection: "close",
      },
    });
    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error("HTTP smoke timed out")));
    request.once("error", reject);
    request.once("response", (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.once("error", reject);
      response.once("end", () => {
        try {
          assert.equal(response.statusCode, 200);
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.end(bytes);
  });
}

async function smokeJava(proxy, fakeChild, root, instrumented) {
  const processRoot = path.join(root, instrumented ? "instrumented-root" : "source-root");
  const workdir = path.join(root, instrumented ? "instrumented-workdir" : "source-workdir");
  fs.mkdirSync(processRoot);
  fs.mkdirSync(workdir);
  const child = spawn(proxy, [workdir, fakeChild], {
    cwd: processRoot,
    env: process.env,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const observation = observe(child);
  const prefix = instrumented ? "instrumented-java" : "source-java";
  await lifecycle(child, observation, prefix);

  if (instrumented) {
    const routePath = path.join(processRoot, ".s006-state", "java-route.json");
    const route = await waitFor(() => {
      if (!fs.existsSync(routePath)) return undefined;
      return JSON.parse(fs.readFileSync(routePath, "utf8"));
    }, "instrumented Java route");
    assert.deepEqual(Object.keys(route).sort(), [
      "owner", "port", "proxy", "schema", "sourceCommit", "token",
    ]);
    assert.equal(route.schema, 1);
    assert.equal(route.proxy, "java-lsp-proxy-s006");
    assert.equal(route.sourceCommit, SOURCE_COMMIT);
    assert.match(route.token, /^[0-9a-f]{64}$/);
    const callbackCommandId = "sts4.classpath.AbCdEfGh";
    const springRoutePath = path.join(processRoot, ".s006-state", "spring-route.json");
    fs.writeFileSync(springRoutePath, `${JSON.stringify({
      schema: 1,
      callbackCommandId,
      port: 1,
      token: "1".repeat(64),
      owner: "2".repeat(64),
    })}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    const routed = await postJson(route.port, "/s006-jdt-command", {
      token: route.token,
      command: "sts.java.addClasspathListener",
      arguments: [callbackCommandId],
    });
    assert.deepEqual(routed, {
      result: { fake: true, command: "sts.java.addClasspathListener" },
    });
    fs.unlinkSync(springRoutePath);
    await shutdown(child, observation, prefix);
    await waitFor(() => !fs.existsSync(routePath), "instrumented Java route cleanup");
    return;
  }
  await shutdown(child, observation, prefix);
}

async function smokeSpring(proxy, fakeChild, springJar, root) {
  const springRoot = path.join(root, "spring-root");
  const state = path.join(springRoot, ".s006-state");
  fs.mkdirSync(springRoot);
  const child = spawn(process.execPath, [
    proxy,
    "--root", springRoot,
    "--java", fakeChild,
    "--jar", springJar,
    "--java-route", path.join(state, "java-route.json"),
    "--spring-route", path.join(state, "spring-route.json"),
    "--evidence", path.join(state, "evidence.jsonl"),
    "--stderr", path.join(state, "spring-stderr.log"),
  ], {
    cwd: springRoot,
    env: process.env,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const observation = observe(child);
  await lifecycle(child, observation, "spring-proxy");
  await shutdown(child, observation, "spring-proxy");
  const events = fs.readFileSync(path.join(state, "evidence.jsonl"), "utf8")
    .trim().split("\n").map((line) => JSON.parse(line).event);
  assert.ok(events.includes("spring-child-exit"));
  assert.equal(fs.existsSync(path.join(state, "spring-route.json")), false);
}

async function main(args) {
  if (args.length !== 4) {
    throw new Error("usage: process_smoke.mjs <source-proxy> <instrumented-proxy> <spring-proxy.mjs> <spring-server.jar>");
  }
  const inputs = args.map((value) => path.resolve(value));
  for (const input of inputs) assert.ok(fs.statSync(input).isFile(), `missing input: ${input}`);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s006-process-smoke-"));
  try {
    const fakeChild = path.join(root, "fake-lsp-child");
    writeFakeChild(fakeChild);
    await smokeJava(inputs[0], fakeChild, root, false);
    await smokeJava(inputs[1], fakeChild, root, true);
    await smokeSpring(inputs[2], fakeChild, inputs[3], root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write("S006 fake-child process smokes passed\n");
}

await main(process.argv.slice(2));
