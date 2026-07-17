import assert from "node:assert/strict";
import test from "node:test";

import {
  Coordinator,
  javaMajor,
  parseOptions,
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
  assert.equal(internal.method, "workspace/executeClientCommand");
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
