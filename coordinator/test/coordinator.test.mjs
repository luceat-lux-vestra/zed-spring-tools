import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  Coordinator,
  javaMajor,
  monitorZedInput,
  parseOptions,
  run,
  sanitizedEnvironment,
  validateCompatibility,
} from "../src/main.mjs";
import { LspDecoder } from "../src/lsp.mjs";
import compatibility from "../../protocol/java-providers.json" with { type: "json" };

function decodeSingle(bytes) {
  const messages = new LspDecoder().push(bytes);
  assert.equal(messages.length, 1);
  return messages[0];
}

test("product arguments are positional, absolute, and shell independent", () => {
  const options = parseOptions([
    "--worktree", "/tmp/work tree",
    "--java", "/tmp/jdk/bin/java",
    "--spring-server", "/tmp/spring/server.jar",
    "--spring-home", "/tmp/spring",
    "--java-work-dir", "/tmp/extensions/work/java",
    "--compatibility", "/tmp/runtime/providers.json",
    "--host-os", "macos",
  ]);
  assert.equal(options.worktree, "/tmp/work tree");
  assert.equal(options.hostOs, "macos");
  assert.throws(() => parseOptions(["--worktree", "/tmp"]));
});

test("environment allowlist excludes unrelated secrets", () => {
  assert.deepEqual(sanitizedEnvironment({ PATH: "/bin", SECRET_TOKEN: "no" }), { PATH: "/bin" });
});

test("Java requirement accepts 21 and the configured Java 25 default", () => {
  assert.equal(javaMajor('openjdk version "21.0.8" 2025-07-15'), 21);
  assert.equal(javaMajor('java version "25.0.3" 2026-04-21'), 25);
  assert.equal(javaMajor('java version "1.8.0_402"'), 8);
});

test("versioned official Java provider contract is exact", () => {
  assert.equal(validateCompatibility(compatibility).extensionVersion, "6.8.21");
  assert.throws(() =>
    validateCompatibility({
      ...compatibility,
      providers: [{ ...compatibility.providers[0], extensionVersion: "next" }],
    }),
  );
});

test("Java data requests are answered through the official Java transport", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: (method) => method === "sts/javaType",
      executeSpringClientMethod: async (method, params) => ({ method, params }),
    },
    worktree: "/tmp/project",
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "sts/javaType",
    params: { typeName: "example.Demo" },
  });
  assert.deepEqual(springWrites, [
    {
      jsonrpc: "2.0",
      id: 7,
      result: { method: "sts/javaType", params: { typeName: "example.Demo" } },
    },
  ]);
  assert.deepEqual(zedWrites, []);
});

test("an answered Java data request is logged once per method, with no parameters", async () => {
  const logs = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed() {},
    javaTransport: {
      supportsSpringClientMethod: (method) => method === "sts/javaType",
      executeSpringClientMethod: async () => ({ name: "example.Demo" }),
    },
    worktree: "/tmp/project",
    logger: (message) => logs.push(message),
  });
  const request = (id) => ({
    jsonrpc: "2.0",
    id,
    method: "sts/javaType",
    params: { bindingKey: "Ljava/lang/Integer;", projectUri: "file:///tmp/project" },
  });
  await coordinator.handleSpringMessage(request(1));
  await coordinator.handleSpringMessage(request(2));
  assert.deepEqual(logs, ["official Java data request sts/javaType answered"]);
  assert.ok(!logs[0].includes("Integer"), "route log must not carry request parameters");
});

test("a failed Java data request is not logged and reports the requirement immediately", async () => {
  const logs = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: () => true,
      executeSpringClientMethod: async () => {
        throw new Error("official Java route was not found");
      },
    },
    worktree: "/tmp/project",
    logger: (message) => logs.push(message),
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: 9,
    method: "sts/javaType",
    params: {},
  });
  assert.deepEqual(logs, []);
  assert.equal(zedWrites.length, 1);
  assert.equal(zedWrites[0].method, "window/showMessage");
  assert.match(zedWrites[0].params.message, /requires the official Java extension/);
});

test("ordinary LSP traffic remains visible to Zed", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const request = { jsonrpc: "2.0", id: "configuration", method: "workspace/configuration" };
  await coordinator.handleSpringMessage(request);
  assert.deepEqual(zedWrites, [request]);
});

test("a completed Spring index update refreshes Zed inlay hints", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const update = {
    jsonrpc: "2.0",
    method: "spring/index/updated",
    params: { affectedProjects: ["example"] },
  };

  await coordinator.handleSpringMessage(update);

  assert.equal(zedWrites[0].method, "workspace/inlayHint/refresh");
  assert.deepEqual(zedWrites[1], update);
  assert.equal(
    coordinator.observeZedMessage({ jsonrpc: "2.0", id: zedWrites[0].id, result: null }),
    false,
  );
});

test("classpath enable waits for initialized and the official Java route", async () => {
  const springWrites = [];
  const zedWrites = [];
  let routeReady;
  const ready = new Promise((resolve) => {
    routeReady = resolve;
  });
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: () => false,
      waitUntilReady: async () => await ready,
    },
    worktree: "/tmp/project",
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(springWrites, []);
  coordinator.observeZedMessage({ jsonrpc: "2.0", method: "initialized", params: {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(springWrites, []);
  routeReady();
  while (springWrites.length === 0) await new Promise((resolve) => setImmediate(resolve));

  const enable = springWrites.shift();
  assert.equal(enable.method, "workspace/executeCommand");
  assert.deepEqual(enable.params, {
    command: "sts.vscode-spring-boot.enableClasspathListening",
    arguments: [true],
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: enable.id, result: "OK" });
  while (zedWrites.length === 0) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(zedWrites[0].method, "workspace/inlayHint/refresh");
  assert.equal(
    coordinator.observeZedMessage({ jsonrpc: "2.0", id: zedWrites[0].id, result: null }),
    false,
  );
  await coordinator.close();
});

test("an absent Java route is logged without showing a false failure popup", async () => {
  const logs = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: () => false,
      waitUntilReady: async () => {
        throw new Error("official Java route is not ready");
      },
    },
    worktree: "/tmp/project",
    logger: (message) => logs.push(message),
  });

  coordinator.observeZedMessage({ jsonrpc: "2.0", method: "initialized", params: {} });
  while (!logs.includes("official Java route is not ready; continuing to wait")) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.deepEqual(zedWrites, []);
  await coordinator.close();
});

test("a classpath registration that times out is re-driven until the Java server is ready", async () => {
  const springWrites = [];
  const zedWrites = [];
  let addAttempts = 0;
  const transport = {
    supportsSpringClientMethod: () => false,
    async execute(command) {
      if (command === "zed.spring.bridge.v1.addClasspathListener") {
        addAttempts += 1;
        if (addAttempts === 1) {
          throw new Error("official Java rejected command: timed out after 5000ms");
        }
      }
      return "ok";
    },
  };
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: transport,
    worktree: "/tmp/project",
    javaHandshakeGraceMs: 10_000,
    classpathRetryMs: 1,
  });

  const callbackId = "sts4.classpath.AbCdEfGh";
  const isEnable = (message) =>
    message.method === "workspace/executeCommand" &&
    message.params?.command === "sts.vscode-spring-boot.enableClasspathListening";

  // The Java server is still importing, so the first registration times out.
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "add-1",
    method: "sts/addClasspathListener",
    params: { callbackCommandId: callbackId, batched: true },
  });
  const firstResponse = springWrites.shift();
  assert.ok(firstResponse.error, "the failed registration is reported to Spring as an error");

  // Spring gives up, so the coordinator re-drives the enable handshake itself.
  // Answer each re-drive; once one has been driven, the Java server becomes
  // ready and the next registration attempt succeeds.
  let reDrove = false;
  let registered = false;
  for (let step = 0; step < 2000 && !registered; step += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    while (springWrites.length > 0) {
      const message = springWrites.shift();
      if (isEnable(message)) {
        reDrove = true;
        await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: message.id, result: "OK" });
      } else if (message.id === "add-2" && message.result === "ok") {
        registered = true;
      }
    }
    if (reDrove && addAttempts < 2) {
      await coordinator.handleSpringMessage({
        jsonrpc: "2.0",
        id: "add-2",
        method: "sts/addClasspathListener",
        params: { callbackCommandId: callbackId, batched: true },
      });
    }
  }

  assert.ok(reDrove, "the coordinator re-drove the enable handshake after the timeout");
  assert.ok(registered, "the retried registration eventually succeeded");
  assert.equal(addAttempts, 2);
  // The transient failure raised no requirement popup.
  assert.equal(
    zedWrites.some((message) => message.method === "window/showMessage"),
    false,
  );
  await coordinator.close();
});

test("a classpath registration that keeps failing past the grace window surfaces the Java requirement", async () => {
  const springWrites = [];
  const zedWrites = [];
  const transport = {
    supportsSpringClientMethod: () => false,
    async execute() {
      throw new Error("official Java rejected command: timed out after 5000ms");
    },
  };
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: transport,
    worktree: "/tmp/project",
    javaHandshakeGraceMs: 0,
    classpathRetryMs: 1,
  });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "add",
    method: "sts/addClasspathListener",
    params: { callbackCommandId: "sts4.classpath.AbCdEfGh", batched: true },
  });

  const popup = zedWrites.find((message) => message.method === "window/showMessage");
  assert.ok(popup);
  assert.equal(popup.params.type, 1);
  assert.match(popup.params.message, /requires the official Java extension/);
  await coordinator.close();
});

test("Spring shutdown result is normalized to the LSP null contract", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: 9, method: "shutdown" });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: 9, result: "OK" });
  assert.deepEqual(zedWrites, [{ jsonrpc: "2.0", id: 9, result: null }]);
});

test("Zed input EOF requests coordinator shutdown", async () => {
  const input = new PassThrough();
  const observed = [];
  const forwarded = [];
  let stopped = 0;
  monitorZedInput(
    input,
    {
      observeZedMessage: (message) => {
        observed.push(message);
        return true;
      },
    },
    (bytes) => forwarded.push(decodeSingle(bytes)),
    () => {
      stopped += 1;
    },
  );
  input.end(encodeForTest({ jsonrpc: "2.0", method: "initialized", params: {} }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(observed[0].method, "initialized");
  assert.equal(forwarded[0].method, "initialized");
  assert.equal(stopped, 1);
});

test("coordinator run kills the Spring child when Zed stdin reaches EOF", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-lifecycle-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = path.join(root, "worktree");
  const springHome = path.join(root, "spring");
  const javaWork = path.join(root, "java-work");
  fs.mkdirSync(worktree);
  fs.mkdirSync(springHome);
  fs.mkdirSync(javaWork);
  const java = path.join(root, "java");
  const springServer = path.join(springHome, "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar");
  const compatibilityFile = path.join(root, "java-providers.json");
  fs.writeFileSync(java, "fake");
  fs.writeFileSync(springServer, "fake");
  fs.writeFileSync(compatibilityFile, JSON.stringify(compatibility));

  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.killCount = 0;
  child.kill = () => {
    child.killCount += 1;
    child.exitCode = 0;
    child.emit("exit", 0);
  };
  const input = new PassThrough();
  await run([
    "--worktree", worktree,
    "--java", java,
    "--spring-server", springServer,
    "--spring-home", springHome,
    "--java-work-dir", javaWork,
    "--compatibility", compatibilityFile,
    "--host-os", "macos",
  ], {
    input,
    output: new PassThrough(),
    errorOutput: new PassThrough(),
    spawnSync: () => ({ status: 0, stdout: "", stderr: 'openjdk version "25.0.3"' }),
    spawn: () => child,
  });

  input.end();
  while (child.killCount === 0) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(child.killCount, 1);
});

test("classpath bridge registers, relays one real callback, and removes", async () => {
  const springWrites = [];
  const javaCalls = [];
  const transport = {
    supportsSpringClientMethod: () => false,
    async execute(command, arguments_) {
      javaCalls.push({ command, arguments: arguments_ });
      return "ok";
    },
  };
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed() {},
    javaTransport: transport,
    worktree: "/tmp/product fixture",
  });
  const callbackId = "sts4.classpath.AbCdEfGh";
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "add",
    method: "sts/addClasspathListener",
    params: { callbackCommandId: callbackId, batched: true },
  });
  assert.equal(springWrites.shift().result, "ok");
  assert.equal(javaCalls[0].command, "zed.spring.bridge.v1.addClasspathListener");
  const registration = javaCalls[0].arguments[0];

  const callback = fetch(registration.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${registration.credential}`,
      "Content-Type": "application/json",
      "X-Zed-Spring-Worktree": registration.worktreeId,
    },
    body: JSON.stringify({
      schemaVersion: 1,
      requestId: 1,
      callbackId,
      worktreeId: registration.worktreeId,
      arguments: ["project", "name", [], [], [], "java-21"],
    }),
  });
  while (springWrites.length === 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  const internal = springWrites.shift();
  assert.equal(internal.method, "workspace/executeCommand");
  assert.equal(internal.params.command, callbackId);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: internal.id, result: "accepted" });
  const callbackResponse = await callback;
  assert.equal(callbackResponse.status, 200);
  assert.deepEqual(await callbackResponse.json(), { result: "ok" });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "remove",
    method: "sts/removeClasspathListener",
    params: { callbackCommandId: callbackId, batched: false },
  });
  assert.equal(springWrites.shift().result, "ok");
  assert.equal(javaCalls[1].command, "zed.spring.bridge.v1.removeClasspathListener");
  assert.deepEqual(javaCalls[1].arguments[0], registration);
});

test("owned classpath capability registration stays internal to preserve Spring commands", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: () => false,
      async execute() {
        return "ok";
      },
    },
    worktree: "/tmp/project",
  });
  const callbackId = "sts4.classpath.AbCdEfGh";
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "register",
    method: "client/registerCapability",
    params: {
      registrations: [
        {
          id: "classpath-registration",
          method: "workspace/executeCommand",
          registerOptions: { commands: [callbackId] },
        },
      ],
    },
  });
  assert.deepEqual(zedWrites, []);
  assert.deepEqual(springWrites.shift(), {
    jsonrpc: "2.0",
    id: "register",
    result: null,
  });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "unregister",
    method: "client/unregisterCapability",
    params: {
      unregisterations: [
        { id: "classpath-registration", method: "workspace/executeCommand" },
      ],
    },
  });
  assert.deepEqual(zedWrites, []);
  assert.deepEqual(springWrites.shift(), {
    jsonrpc: "2.0",
    id: "unregister",
    result: null,
  });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "other-registration",
    method: "client/registerCapability",
    params: {
      registrations: [
        {
          id: "watched-files",
          method: "workspace/didChangeWatchedFiles",
          registerOptions: { watchers: [] },
        },
      ],
    },
  });
  assert.equal(zedWrites.length, 1);
  assert.equal(zedWrites[0].id, "other-registration");

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "lookalike-registration",
    method: "client/registerCapability",
    params: {
      registrations: [
        {
          id: "numeric-classpath-callback",
          method: "workspace/executeCommand",
          registerOptions: { commands: ["sts4.classpath.12345678"] },
        },
      ],
    },
  });
  assert.equal(zedWrites.length, 2);
  assert.equal(zedWrites[1].id, "lookalike-registration");
});

function encodeForTest(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}
