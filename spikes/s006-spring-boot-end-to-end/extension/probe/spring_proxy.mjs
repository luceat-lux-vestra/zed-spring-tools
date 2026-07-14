#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_HEADER_BYTES = 64 * 1024;
const MAX_LSP_BODY_BYTES = 16 * 1024 * 1024;
const MAX_ROUTE_BYTES = 4096;
const MAX_HTTP_BODY_BYTES = 1024 * 1024;
const ROUTE_MAX_AGE_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const ROUTE_WAIT_MS = 10_000;
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_INTERVAL_MS = 1000;
const POST_COMPLETION_DISABLE_DELAY_MS = 10_000;
const CALLBACK_PREFIX = "sts4.classpath.";
const ADD_METHOD = "sts/addClasspathListener";
const REMOVE_METHOD = "sts/removeClasspathListener";
const ENABLE_COMMAND = "sts.vscode-spring-boot.enableClasspathListening";
const CALLBACK_METHOD = "workspace/executeClientCommand";
const EXECUTE_COMMAND = "workspace/executeCommand";
const ADD_COMMAND = "sts.java.addClasspathListener";
const REMOVE_COMMAND = "sts.java.removeClasspathListener";
const SERVER_PORT = "server.port";
const FIXTURE_SUFFIX = "/src/main/resources/application.properties";
const JAVA_ROUTE_FIELDS = ["owner", "port", "proxy", "schema", "sourceCommit", "token"];
const SPRING_ROUTE_FIELDS = ["callbackCommandId", "owner", "port", "schema", "token"];
const SOURCE_COMMIT = "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
const FIXED_ERROR = Object.freeze({ code: -32006, message: "S006 coordination failed" });

class LspDecoder {
  #buffer = Buffer.alloc(0);

  push(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);
    const frames = [];
    while (this.#buffer.length > 0) {
      const separator = this.#buffer.indexOf("\r\n\r\n");
      if (separator === -1) {
        if (this.#buffer.length > MAX_HEADER_BYTES) {
          throw new Error("LSP header exceeds limit");
        }
        break;
      }
      if (separator > MAX_HEADER_BYTES) {
        throw new Error("LSP header exceeds limit");
      }
      const header = this.#buffer.subarray(0, separator).toString("ascii");
      const lengths = header
        .split("\r\n")
        .map((line) => line.split(":"))
        .filter(([name]) => name?.toLowerCase() === "content-length");
      if (lengths.length !== 1) {
        throw new Error("LSP frame requires one Content-Length header");
      }
      const lengthText = lengths[0].slice(1).join(":").trim();
      if (!/^(0|[1-9][0-9]*)$/.test(lengthText)) {
        throw new Error("invalid LSP Content-Length");
      }
      const bodyLength = Number.parseInt(lengthText, 10);
      if (bodyLength > MAX_LSP_BODY_BYTES) {
        throw new Error("LSP body exceeds limit");
      }
      const frameLength = separator + 4 + bodyLength;
      if (this.#buffer.length < frameLength) {
        break;
      }
      const raw = this.#buffer.subarray(0, frameLength);
      const body = raw.subarray(separator + 4);
      let message;
      try {
        message = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("invalid JSON-RPC body");
      }
      frames.push({ raw: Buffer.from(raw), message });
      this.#buffer = this.#buffer.subarray(frameLength);
    }
    return frames;
  }
}

function encodeLsp(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

function idKey(id) {
  if (typeof id === "string") return `s:${id}`;
  if (typeof id === "number" && Number.isFinite(id)) return `n:${id}`;
  return null;
}

function exactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isHexSecret(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isCallbackId(value) {
  return typeof value === "string" && /^sts4\.classpath\.[A-Za-z]{8}$/.test(value);
}

function isFixtureCompletion(message) {
  const params = message?.params;
  const uri = params?.textDocument?.uri;
  return message?.method === "textDocument/completion"
    && idKey(message.id) !== null
    && typeof uri === "string"
    && uri.replaceAll("\\", "/").endsWith(FIXTURE_SUFFIX)
    && params?.position?.line === 0
    && params?.position?.character === 3;
}

function completionItems(result) {
  if (Array.isArray(result)) return result;
  return Array.isArray(result?.items) ? result.items : [];
}

function serverPortCount(result) {
  return completionItems(result).filter((item) => item?.label === SERVER_PORT).length;
}

function structuralDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function readRoute(routePath, kind, now = Date.now()) {
  const stat = fs.lstatSync(routePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > MAX_ROUTE_BYTES) {
    throw new Error("invalid route file");
  }
  const age = now - stat.mtimeMs;
  if (age < 0 || age > ROUTE_MAX_AGE_MS) {
    throw new Error("stale route file");
  }
  const route = JSON.parse(fs.readFileSync(routePath, "utf8"));
  const fields = kind === "java" ? JAVA_ROUTE_FIELDS : SPRING_ROUTE_FIELDS;
  if (!exactKeys(route, fields) || route.schema !== 1 || !Number.isInteger(route.port)
      || route.port < 1 || route.port > 65535 || !isHexSecret(route.token)
      || !isHexSecret(route.owner)) {
    throw new Error("invalid route record");
  }
  if (kind === "java") {
    if (route.proxy !== "java-lsp-proxy-s006" || route.sourceCommit !== SOURCE_COMMIT) {
      throw new Error("unexpected Java route identity");
    }
  } else if (!isCallbackId(route.callbackCommandId)) {
    throw new Error("invalid Spring callback ID");
  }
  return route;
}

function writeExclusiveRoute(routePath, route) {
  fs.mkdirSync(path.dirname(routePath), { recursive: true });
  const descriptor = fs.openSync(routePath, "wx", 0o600);
  let committed = false;
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(route)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    committed = true;
  } finally {
    fs.closeSync(descriptor);
    if (!committed) fs.rmSync(routePath, { force: true });
  }
}

function cleanupOwnedRoute(routePath, token, owner) {
  try {
    const route = readRoute(routePath, "spring");
    if (route.token === token && route.owner === owner) {
      fs.unlinkSync(routePath);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForJavaRoute(routePath, timeoutMs = ROUTE_WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = new Error("Java route unavailable");
  while (Date.now() <= deadline) {
    try {
      return readRoute(routePath, "java");
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw lastError;
}

function postJson({ port, pathname, body, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  if (bytes.length > MAX_HTTP_BODY_BYTES) {
    return Promise.reject(new Error("HTTP request body exceeds limit"));
  }
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
    request.setTimeout(timeoutMs, () => request.destroy(new Error("HTTP request timed out")));
    request.on("error", reject);
    request.on("response", (response) => {
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_HTTP_BODY_BYTES) {
          response.destroy(new Error("HTTP response body exceeds limit"));
        } else {
          chunks.push(chunk);
        }
      });
      response.on("error", reject);
      response.on("end", () => {
        if (response.statusCode !== 200 || response.headers["content-type"] !== "application/json") {
          reject(new Error("unexpected HTTP response"));
          return;
        }
        const declared = Number.parseInt(response.headers["content-length"] ?? "", 10);
        const result = Buffer.concat(chunks);
        if (!Number.isInteger(declared) || declared !== result.length) {
          reject(new Error("invalid HTTP Content-Length"));
          return;
        }
        try {
          resolve(JSON.parse(result.toString("utf8")));
        } catch {
          reject(new Error("invalid HTTP JSON"));
        }
      });
    });
    request.end(bytes);
  });
}

class Evidence {
  constructor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.descriptor = fs.openSync(filePath, "wx", 0o600);
    this.sequence = 0;
    this.started = process.hrtime.bigint();
  }

  write(event, details = {}) {
    if (this.descriptor === undefined) return;
    const forbidden = ["token", "port", "path", "uri", "classpath", "environment"];
    if (Object.keys(details).some((key) => forbidden.includes(key.toLowerCase()))) {
      throw new Error("evidence contains a forbidden field");
    }
    const elapsedMs = Number(process.hrtime.bigint() - this.started) / 1_000_000;
    const record = { sequence: ++this.sequence, elapsedMs, event, ...details };
    fs.writeSync(this.descriptor, `${JSON.stringify(record)}\n`);
  }

  close() {
    if (this.descriptor !== undefined) {
      fs.fsyncSync(this.descriptor);
      fs.closeSync(this.descriptor);
      this.descriptor = undefined;
    }
  }
}

class MemoryEvidence {
  records = [];
  write(event, details = {}) { this.records.push({ event, ...details }); }
  close() {}
}

class Coordinator {
  constructor(options) {
    this.sendChild = options.sendChild;
    this.sendZed = options.sendZed;
    this.evidence = options.evidence;
    this.javaRoutePath = options.javaRoutePath;
    this.springRoutePath = options.springRoutePath;
    this.callbackPort = options.callbackPort;
    this.waitJavaRoute = options.waitJavaRoute ?? (() => waitForJavaRoute(this.javaRoutePath));
    this.postJava = options.postJava ?? ((route, body) => postJson({
      port: route.port,
      pathname: "/s006-jdt-command",
      body,
    }));
    this.readinessEnabled = options.readinessEnabled ?? true;
    this.disableDelayMs = options.disableDelayMs ?? POST_COMPLETION_DISABLE_DELAY_MS;
    this.pendingChild = new Map();
    this.externalCompletions = new Map();
    this.nextId = 1;
    this.phase = "baseline";
    this.baselineParams = undefined;
    this.activeRoute = undefined;
    this.callbackInflight = false;
    this.background = new Set();
    this.fixtureUri = undefined;
    this.fixtureTextValid = false;
  }

  handleZedFrame(frame) {
    const message = frame.message;
    this.#observeFixtureDocument(message);
    if (isFixtureCompletion(message)
        && message.params.textDocument.uri === this.fixtureUri
        && this.fixtureTextValid) {
      const key = idKey(message.id);
      this.externalCompletions.set(key, {
        params: structuredClone(message.params),
        expectedPhase: this.phase,
      });
      if (this.phase === "baseline") this.baselineParams = structuredClone(message.params);
      this.evidence.write("zed-completion-request", { phase: this.phase, idType: typeof message.id });
    }
    this.sendChild(frame.raw);
  }

  handleChildFrame(frame) {
    const message = frame.message;
    const key = idKey(message.id);
    if (key !== null && this.pendingChild.has(key) && message.method === undefined) {
      const pending = this.pendingChild.get(key);
      this.pendingChild.delete(key);
      clearTimeout(pending.timer);
      if (Object.hasOwn(message, "result")) pending.resolve(message.result);
      else pending.reject(new Error("Spring child returned an error"));
      return;
    }

    if (message.method === ADD_METHOD && key !== null) {
      this.#track(this.#handleAdd(message));
      return;
    }
    if (message.method === REMOVE_METHOD && key !== null) {
      this.#track(this.#handleRemove(message));
      return;
    }

    if (key !== null && this.externalCompletions.has(key) && message.method === undefined) {
      const tracked = this.externalCompletions.get(key);
      this.externalCompletions.delete(key);
      const count = Object.hasOwn(message, "result") ? serverPortCount(message.result) : -1;
      const digest = Object.hasOwn(message, "result") ? structuralDigest(message.result) : null;
      this.evidence.write("child-completion-response", {
        phase: tracked.expectedPhase,
        serverPortCount: count,
        digest,
      });
      this.sendZed(frame.raw);
      this.evidence.write("zed-completion-write", {
        phase: tracked.expectedPhase,
        serverPortCount: count,
        digest,
      });
      if (tracked.expectedPhase === "baseline") {
        if (count === 0 && this.phase === "baseline") {
          this.phase = "baseline-valid";
          this.#track(this.#enableClasspath());
        } else {
          this.phase = "inconclusive";
          this.evidence.write("baseline-invalid", { serverPortCount: count });
        }
      } else if (this.phase === "ready" && count === 1) {
        this.phase = "post-completion-proven";
        this.evidence.write("post-completion-proven", { serverPortCount: count, digest });
        this.#track(this.#disableAfterDelay());
      }
      return;
    }

    this.sendZed(frame.raw);
  }

  requestChild(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    const id = `s006-internal-${this.nextId++}`;
    const key = idKey(id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingChild.delete(key);
        this.sendChild(encodeLsp({
          jsonrpc: "2.0",
          method: "$/cancelRequest",
          params: { id },
        }));
        reject(new Error("Spring child request timed out"));
      }, timeoutMs);
      this.pendingChild.set(key, { resolve, reject, timer });
      this.sendChild(encodeLsp({ jsonrpc: "2.0", id, method, params }));
    });
  }

  async handleCallbackHttp(body) {
    const route = this.activeRoute;
    if (!route || !exactKeys(body, ["method", "params", "token"])
        || body.token !== route.token || body.method !== CALLBACK_METHOD
        || !exactKeys(body.params, ["arguments", "command"])
        || body.params.command !== route.callbackCommandId
        || !Array.isArray(body.params.arguments) || body.params.arguments.length !== 6) {
      throw new Error(FIXED_ERROR.message);
    }
    if (this.callbackInflight) throw new Error(FIXED_ERROR.message);
    this.callbackInflight = true;
    try {
      this.evidence.write("callback-received", { argumentCount: body.params.arguments.length });
      const result = await this.requestChild(EXECUTE_COMMAND, structuredClone(body.params));
      this.evidence.write("callback-child-result", {
        resultType: typeof result,
        resultDigest: structuralDigest(result),
      });
      if (this.readinessEnabled) this.#track(this.#probeReadiness());
      return { result };
    } finally {
      this.callbackInflight = false;
    }
  }

  async settle() {
    while (this.background.size > 0) {
      await Promise.allSettled([...this.background]);
    }
  }

  async #enableClasspath() {
    try {
      const route = await this.waitJavaRoute();
      if (this.phase !== "baseline-valid") return;
      this.phase = "enabling";
      this.evidence.write("java-route-ready");
      const result = await this.requestChild(EXECUTE_COMMAND, {
        command: ENABLE_COMMAND,
        arguments: [true],
      });
      this.evidence.write("classpath-enable-result", {
        resultType: typeof result,
        resultDigest: structuralDigest(result),
      });
      if (this.phase === "enabling") this.phase = "enabled";
    } catch {
      this.phase = "failed";
      this.evidence.write("classpath-enable-failed");
    }
  }

  async #handleAdd(message) {
    try {
      const params = message.params;
      if (!exactKeys(params, ["batched", "callbackCommandId"])
          || params.batched !== true || !isCallbackId(params.callbackCommandId)
          || this.activeRoute !== undefined) {
        throw new Error(FIXED_ERROR.message);
      }
      const javaRoute = await this.waitJavaRoute();
      const route = {
        schema: 1,
        callbackCommandId: params.callbackCommandId,
        port: this.callbackPort,
        token: randomBytes(32).toString("hex"),
        owner: randomBytes(32).toString("hex"),
      };
      writeExclusiveRoute(this.springRoutePath, route);
      this.activeRoute = route;
      this.evidence.write("spring-route-published", { callbackShape: "dynamic-eight-alpha" });
      const response = await this.postJava(javaRoute, {
        token: javaRoute.token,
        command: ADD_COMMAND,
        arguments: [route.callbackCommandId],
      });
      if (!exactKeys(response, ["result"])) throw new Error(FIXED_ERROR.message);
      this.sendChild(encodeLsp({ jsonrpc: "2.0", id: message.id, result: response.result }));
      this.evidence.write("jdt-add-result", {
        resultType: typeof response.result,
        resultDigest: structuralDigest(response.result),
      });
      this.phase = "callback-wait";
    } catch {
      this.#sendChildError(message.id);
      this.phase = "failed";
      this.evidence.write("jdt-add-failed");
    }
  }

  async #handleRemove(message) {
    const route = this.activeRoute;
    try {
      if (!route || !exactKeys(message.params, ["callbackCommandId"])
          || message.params.callbackCommandId !== route.callbackCommandId) {
        throw new Error(FIXED_ERROR.message);
      }
      const javaRoute = await this.waitJavaRoute();
      const response = await this.postJava(javaRoute, {
        token: javaRoute.token,
        command: REMOVE_COMMAND,
        arguments: [route.callbackCommandId],
      });
      if (!exactKeys(response, ["result"])) throw new Error(FIXED_ERROR.message);
      this.sendChild(encodeLsp({ jsonrpc: "2.0", id: message.id, result: response.result }));
      cleanupOwnedRoute(this.springRoutePath, route.token, route.owner);
      this.activeRoute = undefined;
      this.phase = "removed";
      this.evidence.write("jdt-remove-result", {
        resultType: typeof response.result,
        resultDigest: structuralDigest(response.result),
      });
    } catch {
      this.#sendChildError(message.id);
      this.evidence.write("jdt-remove-failed");
    }
  }

  async #probeReadiness() {
    if (!this.baselineParams || this.phase === "failed" || this.phase === "inconclusive") return;
    const deadline = Date.now() + READINESS_TIMEOUT_MS;
    while (Date.now() <= deadline) {
      try {
        const result = await this.requestChild(
          "textDocument/completion",
          structuredClone(this.baselineParams),
          REQUEST_TIMEOUT_MS,
        );
        const count = serverPortCount(result);
        this.evidence.write("readiness-probe", { serverPortCount: count });
        if (count === 1) {
          this.phase = "ready";
          this.evidence.write("property-index-ready", { serverPortCount: count });
          return;
        }
        if (count > 1) throw new Error("duplicate server.port completion");
      } catch {
        this.phase = "failed";
        this.evidence.write("readiness-probe-failed");
        return;
      }
      await sleep(READINESS_INTERVAL_MS);
    }
    this.phase = "failed";
    this.evidence.write("readiness-timeout");
  }

  async #disableAfterDelay() {
    await sleep(this.disableDelayMs);
    if (this.phase !== "post-completion-proven") return;
    try {
      this.phase = "disabling";
      const result = await this.requestChild(EXECUTE_COMMAND, {
        command: ENABLE_COMMAND,
        arguments: [false],
      });
      this.evidence.write("classpath-disable-result", {
        resultType: typeof result,
        resultDigest: structuralDigest(result),
      });
    } catch {
      this.phase = "failed";
      this.evidence.write("classpath-disable-failed");
    }
  }

  #sendChildError(id) {
    this.sendChild(encodeLsp({ jsonrpc: "2.0", id, error: FIXED_ERROR }));
  }

  #track(promise) {
    this.background.add(promise);
    promise.finally(() => this.background.delete(promise));
  }

  #observeFixtureDocument(message) {
    if (message?.method === "textDocument/didOpen") {
      const document = message.params?.textDocument;
      const normalized = typeof document?.uri === "string"
        ? document.uri.replaceAll("\\", "/")
        : "";
      if (normalized.endsWith(FIXTURE_SUFFIX)
          && document.languageId === "spring-boot-properties") {
        this.fixtureUri = document.uri;
        this.fixtureTextValid = document.text === "ser" || document.text === "ser\n";
        this.evidence.write("fixture-open", { exactText: this.fixtureTextValid });
      }
      return;
    }
    if (message?.method === "textDocument/didChange"
        && message.params?.textDocument?.uri === this.fixtureUri) {
      const changes = message.params?.contentChanges;
      const last = Array.isArray(changes) ? changes.at(-1) : undefined;
      if (last && typeof last.text === "string" && !Object.hasOwn(last, "range")) {
        this.fixtureTextValid = last.text === "ser" || last.text === "ser\n";
      } else {
        this.fixtureTextValid = false;
      }
      this.evidence.write("fixture-change", { exactText: this.fixtureTextValid });
    }
  }
}

function parseArgs(args) {
  if (args.length !== 14) throw new Error("expected seven named S006 arguments");
  const expected = [
    ["--root", "root"],
    ["--java", "java"],
    ["--jar", "jar"],
    ["--java-route", "javaRoute"],
    ["--spring-route", "springRoute"],
    ["--evidence", "evidence"],
    ["--stderr", "stderr"],
  ];
  const values = {};
  for (let index = 0; index < expected.length; index += 1) {
    const [flag, key] = expected[index];
    if (args[index * 2] !== flag || !args[index * 2 + 1]) {
      throw new Error(`missing ${flag}`);
    }
    values[key] = path.resolve(args[index * 2 + 1]);
  }
  return values;
}

function sanitizedEnvironment(environment) {
  const allowed = [
    "PATH", "JAVA_HOME", "HOME", "USER", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL",
    "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR",
  ];
  return Object.fromEntries(allowed.filter((name) => environment[name] !== undefined)
    .map((name) => [name, environment[name]]));
}

function validateRuntimeInput(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} is not a regular file`);
}

async function readHttpJson(request) {
  if (request.method !== "POST" || request.url !== "/s006-callback"
      || request.headers["content-type"] !== "application/json") {
    throw new Error(FIXED_ERROR.message);
  }
  const declared = Number.parseInt(request.headers["content-length"] ?? "", 10);
  if (!Number.isInteger(declared) || declared < 1 || declared > MAX_HTTP_BODY_BYTES) {
    throw new Error(FIXED_ERROR.message);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_HTTP_BODY_BYTES) throw new Error(FIXED_ERROR.message);
    chunks.push(chunk);
  }
  if (size !== declared) throw new Error(FIXED_ERROR.message);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendHttp(response, statusCode, body) {
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": bytes.length,
    connection: "close",
  });
  response.end(bytes);
}

async function runProxy(args) {
  const options = parseArgs(args);
  validateRuntimeInput(options.java, "Java executable");
  validateRuntimeInput(options.jar, "Spring Boot LS JAR");
  if (fs.existsSync(options.springRoute)) throw new Error("Spring route already exists");
  const evidence = new Evidence(options.evidence);
  fs.mkdirSync(path.dirname(options.stderr), { recursive: true });
  const stderrDescriptor = fs.openSync(options.stderr, "wx", 0o600);
  const stderrStream = fs.createWriteStream(options.stderr, {
    fd: stderrDescriptor,
    autoClose: true,
  });

  let coordinator;
  const callbackServer = http.createServer(async (request, response) => {
    try {
      const body = await readHttpJson(request);
      const result = await coordinator.handleCallbackHttp(body);
      sendHttp(response, 200, result);
    } catch {
      sendHttp(response, 400, { error: FIXED_ERROR.message });
    }
  });
  await new Promise((resolve, reject) => {
    callbackServer.once("error", reject);
    callbackServer.listen(0, "127.0.0.1", resolve);
  });
  const address = callbackServer.address();
  if (address === null || typeof address === "string") throw new Error("invalid callback listener");

  const jvmArgs = [
    "-Xmx1024m",
    "-Dspring.config.location=classpath:/application.properties",
    "-Djdk.util.zip.disableZip64ExtraFieldValidation=true",
    "-Dspring.main.web-application-type=NONE",
    "-Xlog:jni+resolve=off",
    "-Dlogging.level.org.springframework.ide.vscode.boot.jdt.ls.JdtLsProjectCache=DEBUG",
    "-jar",
    options.jar,
  ];
  const child = spawn(options.java, jvmArgs, {
    cwd: options.root,
    env: sanitizedEnvironment(process.env),
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.pipe(stderrStream);
  let shutdownComplete = false;
  coordinator = new Coordinator({
    sendChild: (raw) => child.stdin.write(raw),
    sendZed: (raw) => process.stdout.write(raw),
    evidence,
    javaRoutePath: options.javaRoute,
    springRoutePath: options.springRoute,
    callbackPort: address.port,
  });

  const zedDecoder = new LspDecoder();
  const childDecoder = new LspDecoder();
  process.stdin.on("data", (chunk) => {
    try {
      for (const frame of zedDecoder.push(chunk)) coordinator.handleZedFrame(frame);
    } catch {
      if (!shutdownComplete) evidence.write("zed-protocol-failure");
      child.kill();
    }
  });
  child.stdout.on("data", (chunk) => {
    try {
      for (const frame of childDecoder.push(chunk)) coordinator.handleChildFrame(frame);
    } catch {
      if (!shutdownComplete) evidence.write("spring-protocol-failure");
      child.kill();
    }
  });
  const shutdown = (event, details) => {
    if (shutdownComplete) return false;
    shutdownComplete = true;
    evidence.write(event, details);
    if (coordinator.activeRoute) {
      cleanupOwnedRoute(
        options.springRoute,
        coordinator.activeRoute.token,
        coordinator.activeRoute.owner,
      );
    }
    callbackServer.close();
    evidence.close();
    stderrStream.end();
    return true;
  };
  child.once("exit", (code) => {
    if (shutdown("spring-child-exit", { exitCode: code ?? -1 })) {
      process.exitCode = code ?? 1;
      process.stdin.destroy();
    }
  });
  child.once("error", (error) => {
    if (shutdown("spring-child-error", { errorKind: error.name })) {
      process.exitCode = 1;
      process.stdin.destroy();
    }
  });
  process.stdin.once("end", () => {
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), 5000);
    timer.unref();
  });
}

async function selfTest() {
  const parsed = parseArgs([
    "--root", "/tmp/s006 root",
    "--java", "/tmp/jdk/bin/java",
    "--jar", "/tmp/spring.jar",
    "--java-route", "/tmp/java-route.json",
    "--spring-route", "/tmp/spring-route.json",
    "--evidence", "/tmp/evidence.jsonl",
    "--stderr", "/tmp/stderr.log",
  ]);
  assert.equal(parsed.javaRoute, path.resolve("/tmp/java-route.json"));
  assert.equal(parsed.springRoute, path.resolve("/tmp/spring-route.json"));
  assert.throws(() => parseArgs(["--root", "/tmp"]));

  const messageA = { jsonrpc: "2.0", id: 1, method: "initialize", params: {} };
  const messageB = { jsonrpc: "2.0", method: "initialized", params: {} };
  const bytes = Buffer.concat([encodeLsp(messageA), encodeLsp(messageB)]);
  const decoder = new LspDecoder();
  assert.deepEqual(decoder.push(bytes.subarray(0, 7)), []);
  assert.deepEqual(decoder.push(bytes.subarray(7, 31)), []);
  assert.deepEqual(decoder.push(bytes.subarray(31)).map((frame) => frame.message), [messageA, messageB]);
  assert.throws(() => new LspDecoder().push(Buffer.from("X".repeat(MAX_HEADER_BYTES + 1))));

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s006-spring-proxy-test-"));
  try {
    const javaRoutePath = path.join(root, "java-route.json");
    const springRoutePath = path.join(root, "spring-route.json");
    const javaRoute = {
      schema: 1,
      owner: "1".repeat(64),
      port: 32001,
      proxy: "java-lsp-proxy-s006",
      sourceCommit: SOURCE_COMMIT,
      token: "2".repeat(64),
    };
    writeExclusiveRoute(javaRoutePath, javaRoute);
    assert.deepEqual(readRoute(javaRoutePath, "java"), javaRoute);
    assert.throws(() => writeExclusiveRoute(javaRoutePath, javaRoute));
    fs.writeFileSync(path.join(root, "bad-fields.json"), JSON.stringify({ ...javaRoute, extra: true }));
    assert.throws(() => readRoute(path.join(root, "bad-fields.json"), "java"));
    fs.symlinkSync(javaRoutePath, path.join(root, "route-link.json"));
    assert.throws(() => readRoute(path.join(root, "route-link.json"), "java"));
    const old = new Date(Date.now() - ROUTE_MAX_AGE_MS - 1000);
    fs.utimesSync(javaRoutePath, old, old);
    assert.throws(() => readRoute(javaRoutePath, "java"));
    fs.utimesSync(javaRoutePath, new Date(), new Date());
    const delayedJavaRoutePath = path.join(root, "delayed-java-route.json");
    const delayedRoute = waitForJavaRoute(delayedJavaRoutePath, 300);
    setTimeout(() => writeExclusiveRoute(delayedJavaRoutePath, javaRoute), 20);
    assert.deepEqual(await delayedRoute, javaRoute);

    const childFrames = [];
    const zedFrames = [];
    const evidence = new MemoryEvidence();
    const javaCalls = [];
    const coordinator = new Coordinator({
      sendChild: (raw) => childFrames.push(new LspDecoder().push(raw)[0].message),
      sendZed: (raw) => zedFrames.push(new LspDecoder().push(raw)[0].message),
      evidence,
      javaRoutePath,
      springRoutePath,
      callbackPort: 32002,
      waitJavaRoute: async () => javaRoute,
      postJava: async (_route, body) => {
        javaCalls.push(body);
        return { result: body.command === ADD_COMMAND ? "ok-add-authentic" : "ok-remove-authentic" };
      },
      readinessEnabled: false,
      disableDelayMs: 1,
    });

    const cancellation = {
      jsonrpc: "2.0",
      method: "$/cancelRequest",
      params: { id: "unrelated" },
    };
    coordinator.handleZedFrame({ raw: encodeLsp(cancellation), message: cancellation });
    assert.deepEqual(childFrames.at(-1), cancellation);
    const diagnostics = {
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri: "file:///redacted", diagnostics: [] },
    };
    coordinator.handleChildFrame({ raw: encodeLsp(diagnostics), message: diagnostics });
    assert.deepEqual(zedFrames.at(-1), diagnostics);

    const completionParams = {
      textDocument: { uri: "file:///fixture/src/main/resources/application.properties" },
      position: { line: 0, character: 3 },
    };
    const didOpen = {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: completionParams.textDocument.uri,
          languageId: "spring-boot-properties",
          version: 1,
          text: "ser\n",
        },
      },
    };
    coordinator.handleZedFrame({ raw: encodeLsp(didOpen), message: didOpen });
    coordinator.handleZedFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: 7, method: "textDocument/completion", params: completionParams }),
      message: { jsonrpc: "2.0", id: 7, method: "textDocument/completion", params: completionParams },
    });
    coordinator.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: 7, result: { isIncomplete: true, items: [] } }),
      message: { jsonrpc: "2.0", id: 7, result: { isIncomplete: true, items: [] } },
    });
    await sleep(0);
    const enable = childFrames.find((message) => message.params?.command === ENABLE_COMMAND);
    assert.deepEqual(enable.params.arguments, [true]);
    coordinator.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: enable.id, result: true }),
      message: { jsonrpc: "2.0", id: enable.id, result: true },
    });

    const callbackId = "sts4.classpath.AbCdEfGh";
    const add = {
      jsonrpc: "2.0",
      id: "spring-add",
      method: ADD_METHOD,
      params: { callbackCommandId: callbackId, batched: true },
    };
    coordinator.handleChildFrame({ raw: encodeLsp(add), message: add });
    await sleep(0);
    assert.deepEqual(javaCalls[0], {
      token: javaRoute.token,
      command: ADD_COMMAND,
      arguments: [callbackId],
    });
    assert.equal(childFrames.find((message) => message.id === "spring-add").result, "ok-add-authentic");
    const springRoute = readRoute(springRoutePath, "spring");

    const callbackBody = {
      token: springRoute.token,
      method: CALLBACK_METHOD,
      params: {
        command: callbackId,
        arguments: ["file:///fixture", "fixture", false, { entries: [], jre: {} }, null, {}],
      },
    };
    const callbackPromise = coordinator.handleCallbackHttp(callbackBody);
    await sleep(0);
    await assert.rejects(() => coordinator.handleCallbackHttp(callbackBody));
    const callbackRequest = childFrames.find((message) => message.params?.command === callbackId);
    assert.deepEqual(callbackRequest.params, callbackBody.params);
    const authenticResult = { source: "real-child", value: "done" };
    coordinator.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: callbackRequest.id, result: authenticResult }),
      message: { jsonrpc: "2.0", id: callbackRequest.id, result: authenticResult },
    });
    assert.deepEqual(await callbackPromise, { result: authenticResult });
    await assert.rejects(() => coordinator.handleCallbackHttp({ ...callbackBody, token: "0".repeat(64) }));

    const outOfOrderFrames = [];
    const ordering = new Coordinator({
      sendChild: (raw) => outOfOrderFrames.push(new LspDecoder().push(raw)[0].message),
      sendZed: () => {},
      evidence: new MemoryEvidence(),
      javaRoutePath,
      springRoutePath: path.join(root, "ordering-route.json"),
      callbackPort: 1,
      waitJavaRoute: async () => javaRoute,
      readinessEnabled: false,
    });
    const firstPending = ordering.requestChild("s006/test-first", { order: 1 });
    const secondPending = ordering.requestChild("s006/test-second", { order: 2 });
    const firstRequest = outOfOrderFrames[0];
    const secondRequest = outOfOrderFrames[1];
    ordering.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: secondRequest.id, result: "second" }),
      message: { jsonrpc: "2.0", id: secondRequest.id, result: "second" },
    });
    ordering.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: firstRequest.id, result: "first" }),
      message: { jsonrpc: "2.0", id: firstRequest.id, result: "first" },
    });
    assert.deepEqual(await Promise.all([firstPending, secondPending]), ["first", "second"]);
    const timedOut = ordering.requestChild("s006/test-timeout", {}, 5);
    await assert.rejects(timedOut);
    assert.equal(outOfOrderFrames.at(-1).method, "$/cancelRequest");
    await assert.rejects(() => waitForJavaRoute(path.join(root, "absent-route.json"), 20));

    coordinator.phase = "ready";
    const postResult = { isIncomplete: false, items: [{ label: SERVER_PORT, kind: 10, data: { fixed: true } }] };
    coordinator.handleZedFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: "post", method: "textDocument/completion", params: completionParams }),
      message: { jsonrpc: "2.0", id: "post", method: "textDocument/completion", params: completionParams },
    });
    coordinator.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: "post", result: postResult }),
      message: { jsonrpc: "2.0", id: "post", result: postResult },
    });
    const childDigest = evidence.records.findLast((record) => record.event === "child-completion-response").digest;
    const writeDigest = evidence.records.findLast((record) => record.event === "zed-completion-write").digest;
    assert.equal(childDigest, writeDigest);
    assert.deepEqual(zedFrames.at(-1).result, postResult);
    await sleep(2);
    const disable = childFrames.find((message) => message.params?.arguments?.[0] === false);
    coordinator.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: disable.id, result: true }),
      message: { jsonrpc: "2.0", id: disable.id, result: true },
    });

    const remove = {
      jsonrpc: "2.0",
      id: "spring-remove",
      method: REMOVE_METHOD,
      params: { callbackCommandId: callbackId },
    };
    coordinator.handleChildFrame({ raw: encodeLsp(remove), message: remove });
    await sleep(0);
    assert.equal(javaCalls.at(-1).command, REMOVE_COMMAND);
    assert.equal(childFrames.find((message) => message.id === "spring-remove").result, "ok-remove-authentic");
    assert.equal(fs.existsSync(springRoutePath), false);

    const foreignRoute = { ...springRoute, owner: "f".repeat(64) };
    writeExclusiveRoute(springRoutePath, foreignRoute);
    assert.equal(cleanupOwnedRoute(springRoutePath, springRoute.token, springRoute.owner), false);
    assert.equal(fs.existsSync(springRoutePath), true);

    const badBaseline = new Coordinator({
      sendChild: (raw) => childFrames.push(new LspDecoder().push(raw)[0].message),
      sendZed: () => {},
      evidence: new MemoryEvidence(),
      javaRoutePath,
      springRoutePath: path.join(root, "unused.json"),
      callbackPort: 1,
      waitJavaRoute: async () => javaRoute,
      readinessEnabled: false,
    });
    badBaseline.handleZedFrame({ raw: encodeLsp(didOpen), message: didOpen });
    badBaseline.handleZedFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: 99, method: "textDocument/completion", params: completionParams }),
      message: { jsonrpc: "2.0", id: 99, method: "textDocument/completion", params: completionParams },
    });
    badBaseline.handleChildFrame({
      raw: encodeLsp({ jsonrpc: "2.0", id: 99, result: { items: [{ label: SERVER_PORT }] } }),
      message: { jsonrpc: "2.0", id: 99, result: { items: [{ label: SERVER_PORT }] } },
    });
    assert.equal(badBaseline.phase, "inconclusive");
    assert.equal(childFrames.filter((message) => message.params?.command === ENABLE_COMMAND).length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write("S006 Spring proxy synthetic tests passed\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === "--self-test") {
    await selfTest();
  } else {
    await runProxy(process.argv.slice(2));
  }
}

export {
  Coordinator,
  LspDecoder,
  cleanupOwnedRoute,
  encodeLsp,
  exactKeys,
  isCallbackId,
  parseArgs,
  readRoute,
  sanitizedEnvironment,
  serverPortCount,
  structuralDigest,
  writeExclusiveRoute,
};
