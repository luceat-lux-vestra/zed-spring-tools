#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { CompanionBridgeSession } from "./companion_bridge_session.mjs";
import { OfficialJavaTransport } from "./official_java_transport.mjs";
import {
  Coordinator,
  LspDecoder,
  cleanupOwnedRoute,
  encodeLsp,
} from "./s006_spring_proxy_base.mjs";

const ADD_COMMAND = "sts.java.addClasspathListener";
const REMOVE_COMMAND = "sts.java.removeClasspathListener";
const CALLBACK_METHOD = "workspace/executeClientCommand";
const FIXED_ERROR = "S012 coordination failed";
const LEGACY_ROUTE_TOKEN = "s012-owned-call-site";
const SERVER_JAR = "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";

class Evidence {
  constructor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.descriptor = fs.openSync(filePath, "wx", 0o600);
    this.sequence = 0;
    this.started = process.hrtime.bigint();
  }

  write(event, details = {}) {
    if (this.descriptor === undefined) return;
    const forbidden = [
      "token",
      "credential",
      "port",
      "path",
      "uri",
      "classpath",
      "environment",
    ];
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

class JavaBridgeIntegration {
  constructor({ portFile, root, getCoordinator, evidence, transport, credential }) {
    this.transport = transport ?? new OfficialJavaTransport({ portFile });
    this.credential = credential ?? randomBytes(32).toString("base64url");
    this.worktreeId = createHash("sha256").update(path.resolve(root)).digest("hex");
    this.getCoordinator = getCoordinator;
    this.evidence = evidence;
    this.session = undefined;
    this.callbackId = undefined;
  }

  async handleLegacyJavaCall(_route, body) {
    if (
      hasExactKeys(body, ["arguments", "command", "token"]) &&
      body.token === LEGACY_ROUTE_TOKEN &&
      body?.command === ADD_COMMAND &&
      Array.isArray(body.arguments) &&
      body.arguments.length === 1 &&
      typeof body.arguments[0] === "string" &&
      this.session === undefined
    ) {
      const callbackId = body.arguments[0];
      const session = new CompanionBridgeSession({
        transport: this.transport,
        credential: this.credential,
        worktreeId: this.worktreeId,
        callbackId,
        onClasspathEvent: async (arguments_) => {
          const coordinator = this.getCoordinator();
          const active = coordinator?.activeRoute;
          if (active?.callbackCommandId !== callbackId) {
            throw new Error(FIXED_ERROR);
          }
          const response = await coordinator.handleCallbackHttp({
            token: active.token,
            method: CALLBACK_METHOD,
            params: {
              command: callbackId,
              arguments: structuredClone(arguments_),
            },
          });
          return response.result;
        },
      });
      this.session = session;
      this.callbackId = callbackId;
      try {
        await session.start();
      } catch (error) {
        try {
          await session.close();
          this.session = undefined;
          this.callbackId = undefined;
        } catch {
          // Retain the exact session identity so shutdown can retry removal.
        }
        throw error;
      }
      this.evidence.write("s012-bridge-registered");
      return { result: "ok" };
    }

    if (
      hasExactKeys(body, ["arguments", "command", "token"]) &&
      body.token === LEGACY_ROUTE_TOKEN &&
      body?.command === REMOVE_COMMAND &&
      Array.isArray(body.arguments) &&
      body.arguments.length === 1 &&
      body.arguments[0] === this.callbackId &&
      this.session !== undefined
    ) {
      await this.session.close();
      this.session = undefined;
      this.callbackId = undefined;
      this.evidence.write("s012-bridge-removed");
      return { result: "ok" };
    }

    throw new Error(FIXED_ERROR);
  }

  async close() {
    if (this.session === undefined) return;
    await this.session.close();
    this.session = undefined;
    this.callbackId = undefined;
    this.evidence.write("s012-bridge-removed-on-shutdown");
  }
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function parseArgs(args) {
  if (args.length !== 12) throw new Error("expected six named S012 arguments");
  const expected = [
    ["--root", "root"],
    ["--java", "java"],
    ["--jar", "jar"],
    ["--java-port-path", "javaPortPath"],
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
    "PATH",
    "JAVA_HOME",
    "HOME",
    "USER",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ];
  return Object.fromEntries(
    allowed
      .filter((name) => environment[name] !== undefined)
      .map((name) => [name, environment[name]]),
  );
}

function requireRegularFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
}

function readPortFilePointer(pointerPath) {
  requireRegularFile(pointerPath, "official Java port pointer");
  const stat = fs.lstatSync(pointerPath);
  if (stat.size < 2 || stat.size > 4096) {
    throw new Error("official Java port pointer has invalid size");
  }
  const value = fs.readFileSync(pointerPath, "utf8").trim();
  if (!path.isAbsolute(value) || value.includes("\n") || value.includes("\r")) {
    throw new Error("official Java port pointer is invalid");
  }
  return path.normalize(value);
}

async function runProxy(args) {
  const options = parseArgs(args);
  requireRegularFile(options.java, "Java executable");
  requireRegularFile(options.jar, "Spring Boot LS JAR");
  if (path.basename(options.jar) !== SERVER_JAR) {
    throw new Error("unexpected Spring Boot LS JAR");
  }
  const portFile = readPortFilePointer(options.javaPortPath);
  const stateRoute = path.join(options.root, ".s012-state", "spring-route.json");
  if (fs.existsSync(stateRoute)) throw new Error("Spring route already exists");

  const evidence = new Evidence(options.evidence);
  fs.mkdirSync(path.dirname(options.stderr), { recursive: true });
  const stderrDescriptor = fs.openSync(options.stderr, "wx", 0o600);
  const stderrStream = fs.createWriteStream(options.stderr, {
    fd: stderrDescriptor,
    autoClose: true,
  });

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

  let coordinator;
  const integration = new JavaBridgeIntegration({
    portFile,
    root: options.root,
    getCoordinator: () => coordinator,
    evidence,
  });
  coordinator = new Coordinator({
    sendChild: (raw) => child.stdin.write(raw),
    sendZed: (raw) => process.stdout.write(raw),
    evidence,
    javaRoutePath: options.javaPortPath,
    springRoutePath: stateRoute,
    callbackPort: 1,
    waitJavaRoute: async () => ({ token: LEGACY_ROUTE_TOKEN }),
    postJava: (route, body) => integration.handleLegacyJavaCall(route, body),
  });

  const zedDecoder = new LspDecoder();
  const childDecoder = new LspDecoder();
  let shutdownStarted = false;
  process.stdin.on("data", (chunk) => {
    try {
      for (const frame of zedDecoder.push(chunk)) coordinator.handleZedFrame(frame);
    } catch {
      if (!shutdownStarted) evidence.write("zed-protocol-failure");
      child.kill();
    }
  });
  child.stdout.on("data", (chunk) => {
    try {
      for (const frame of childDecoder.push(chunk)) coordinator.handleChildFrame(frame);
    } catch {
      if (!shutdownStarted) evidence.write("spring-protocol-failure");
      child.kill();
    }
  });

  const shutdown = async (event, details) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    await coordinator.settle();
    try {
      await integration.close();
    } catch {
      evidence.write("s012-bridge-removal-failed");
      process.exitCode = 1;
    }
    if (coordinator.activeRoute) {
      cleanupOwnedRoute(
        stateRoute,
        coordinator.activeRoute.token,
        coordinator.activeRoute.owner,
      );
    }
    evidence.write(event, details);
    evidence.close();
    stderrStream.end();
  };

  child.once("exit", (code) => {
    void shutdown("spring-child-exit", { exitCode: code ?? -1 }).then(() => {
      process.exitCode ??= code ?? 1;
      process.stdin.destroy();
    });
  });
  child.once("error", (error) => {
    void shutdown("spring-child-error", { errorKind: error.name }).then(() => {
      process.exitCode = 1;
      process.stdin.destroy();
    });
  });
  process.stdin.once("end", () => {
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), 5000);
    timer.unref();
  });
  process.once("SIGTERM", () => {
    void shutdown("proxy-sigterm", {}).finally(() => child.kill());
  });
}

async function selfTest() {
  const parsed = parseArgs([
    "--root",
    "/tmp/s012 root",
    "--java",
    "/tmp/jdk/bin/java",
    "--jar",
    "/tmp/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar",
    "--java-port-path",
    "/tmp/official-port-path.txt",
    "--evidence",
    "/tmp/evidence.jsonl",
    "--stderr",
    "/tmp/stderr.log",
  ]);
  assert.equal(parsed.javaPortPath, path.resolve("/tmp/official-port-path.txt"));
  assert.throws(() => parseArgs(["--root", "/tmp"]));
  const first = { jsonrpc: "2.0", id: 1, method: "initialize", params: {} };
  const second = { jsonrpc: "2.0", method: "initialized", params: {} };
  const bytes = Buffer.concat([encodeLsp(first), encodeLsp(second)]);
  const decoder = new LspDecoder();
  assert.deepEqual(decoder.push(bytes.subarray(0, 17)), []);
  assert.deepEqual(
    decoder.push(bytes.subarray(17)).map((frame) => frame.message),
    [first, second],
  );
  assert.deepEqual(sanitizedEnvironment({ PATH: "/bin", SECRET: "no" }), {
    PATH: "/bin",
  });

  const credential = "T".repeat(43);
  const javaCalls = [];
  const callbackBodies = [];
  const callbackId = "sts4.classpath.AbCdEfGh";
  const legacyToken = "legacy-callback-token";
  const transport = {
    async executeBridgeCommand(command, registration) {
      javaCalls.push({ command, registration });
      return "ok";
    },
  };
  const coordinator = {
    activeRoute: { callbackCommandId: callbackId, token: legacyToken },
    async handleCallbackHttp(body) {
      callbackBodies.push(body);
      return { result: "child-result" };
    },
  };
  const integration = new JavaBridgeIntegration({
    portFile: "/unused",
    root: "/tmp/s012 root",
    getCoordinator: () => coordinator,
    evidence: { write() {} },
    transport,
    credential,
  });
  assert.deepEqual(
    await integration.handleLegacyJavaCall(null, {
      token: LEGACY_ROUTE_TOKEN,
      command: ADD_COMMAND,
      arguments: [callbackId],
    }),
    { result: "ok" },
  );
  const registration = javaCalls[0].registration;
  const eventArguments = ["project", "name", [], [], [], "java-21"];
  const callbackResponse = await fetch(registration.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential}`,
      "X-Zed-Spring-Worktree": registration.worktreeId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: 1,
      callbackId,
      worktreeId: registration.worktreeId,
      arguments: eventArguments,
    }),
  });
  assert.equal(callbackResponse.status, 200);
  assert.deepEqual(await callbackResponse.json(), { result: "child-result" });
  assert.deepEqual(callbackBodies, [
    {
      token: legacyToken,
      method: CALLBACK_METHOD,
      params: { command: callbackId, arguments: eventArguments },
    },
  ]);
  assert.deepEqual(
    await integration.handleLegacyJavaCall(null, {
      token: LEGACY_ROUTE_TOKEN,
      command: REMOVE_COMMAND,
      arguments: [callbackId],
    }),
    { result: "ok" },
  );
  assert.equal(javaCalls[1].command, "zed.spring.bridge.removeClasspathListener");
  assert.deepEqual(javaCalls[1].registration, registration);

  let removalUnavailable = true;
  const retained = new JavaBridgeIntegration({
    portFile: "/unused",
    root: "/tmp/s012 retained",
    getCoordinator: () => coordinator,
    evidence: { write() {} },
    credential: "R".repeat(43),
    transport: {
      async executeBridgeCommand() {
        if (removalUnavailable) throw new Error("synthetic transport failure");
        return "ok";
      },
    },
  });
  await assert.rejects(
    retained.handleLegacyJavaCall(null, {
      token: LEGACY_ROUTE_TOKEN,
      command: ADD_COMMAND,
      arguments: [callbackId],
    }),
  );
  assert.notEqual(retained.session, undefined);
  removalUnavailable = false;
  await retained.close();
  assert.equal(retained.session, undefined);
  process.stdout.write("S012 Spring proxy wrapper self-test passed\n");
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === "--self-test") {
    await selfTest();
  } else {
    await runProxy(process.argv.slice(2));
  }
}

export {
  JavaBridgeIntegration,
  parseArgs,
  readPortFilePointer,
  sanitizedEnvironment,
};
