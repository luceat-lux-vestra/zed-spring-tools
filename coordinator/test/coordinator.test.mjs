import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  compatibilityReportUrl,
  Coordinator,
  javaMajor,
  javaVersion,
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
    "--extension-version", "0.1.0-alpha.1",
    "--automatic-live-connection", "true",
  ]);
  assert.equal(options.worktree, "/tmp/work tree");
  assert.equal(options.hostOs, "macos");
  assert.equal(options.automaticLiveConnection, true);
  assert.throws(() => parseOptions(["--worktree", "/tmp"]));
});

test("environment allowlist excludes unrelated secrets", () => {
  assert.deepEqual(sanitizedEnvironment({ PATH: "/bin", SECRET_TOKEN: "no" }), { PATH: "/bin" });
});

test("Java requirement accepts 21 and the configured Java 25 default", () => {
  assert.equal(javaMajor('openjdk version "21.0.8" 2025-07-15'), 21);
  assert.equal(javaMajor('java version "25.0.3" 2026-04-21'), 25);
  assert.equal(javaMajor('java version "1.8.0_402"'), 8);
  assert.equal(javaVersion('openjdk version "25.0.3" 2026-04-21'), "25.0.3");
});

test("compatibility report URL contains only bounded allowlisted fields", () => {
  const report = compatibilityReportUrl({
    failureKind: "classpath-registration-failed-v1",
    hostOs: "macos",
    hostArch: "arm64",
    jdkVersion: "25.0.3",
    extensionVersion: "0.1.0-alpha.1",
  });
  const url = new URL(report);
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/luceat-lux-vestra/zed-spring-tools/issues/new");
  assert.equal(url.searchParams.get("title"), "[Compatibility] classpath-registration-failed-v1");
  const body = url.searchParams.get("body");
  assert.match(body, /Failure: Official Java classpath registration failed/);
  assert.match(body, /Fingerprint: `classpath-registration-failed-v1`/);
  assert.match(body, /Spring Tools: `5\.2\.0\.RELEASE`/);
  assert.match(body, /JDK: `25\.0\.3`/);
  assert.match(body, /Host: `macOS arm64`/);
  assert.match(body, /Zed Spring Tools: `0\.1\.0-alpha\.1`/);
  assert.match(body, /Zed: `not observable by this extension`/);
  assert.match(body, /Official Java extension: `not observable by this extension`/);
  assert.equal(url.searchParams.has("zed-version"), false);
  assert.equal(url.searchParams.has("official-java-version"), false);
  assert.deepEqual([...url.searchParams.keys()], ["title", "body"]);
  assert.ok(report.length < 2_000);
  assert.throws(() => compatibilityReportUrl({
    failureKind: "arbitrary-error",
    hostOs: "macos",
    hostArch: "arm64",
    jdkVersion: "25.0.3",
    extensionVersion: "0.1.0-alpha.1",
  }));
  assert.throws(() => compatibilityReportUrl({
    failureKind: "java-data-route-failed-v1",
    hostOs: "macos",
    hostArch: "arm64",
    jdkVersion: "/Users/private/project",
    extensionVersion: "0.1.0-alpha.1",
  }));
});

test("official Java provider admission is structural, not release-pinned", () => {
  assert.equal(validateCompatibility(compatibility).id, "zed-java");
  assert.equal(validateCompatibility({
    ...compatibility,
    providers: [{ ...compatibility.providers[0], extensionVersion: "future-metadata" }],
  }).id, "zed-java");
  assert.throws(() =>
    validateCompatibility({
      ...compatibility,
      providers: [{ ...compatibility.providers[0], targetLanguageServerId: "other" }],
    }),
  );
});

test("Spring Java client requests are answered through the official Java transport", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: (method) =>
        method === "sts/javaType" || method === "sts/project/gav",
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
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "gav",
    method: "sts/project/gav",
    params: { projectUris: ["file:///tmp/project"] },
  });
  assert.deepEqual(springWrites, [
    {
      jsonrpc: "2.0",
      id: 7,
      result: { method: "sts/javaType", params: { typeName: "example.Demo" } },
    },
    {
      jsonrpc: "2.0",
      id: "gav",
      result: {
        method: "sts/project/gav",
        params: { projectUris: ["file:///tmp/project"] },
      },
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
  assert.equal(zedWrites[0].method, "window/showMessageRequest");
  assert.match(zedWrites[0].params.message, /requires a working official Java extension/);
  assert.match(zedWrites[0].params.message, /java-data-route-failed-v1/);
  assert.match(zedWrites[0].params.message, /Nothing is submitted/);
  assert.deepEqual(zedWrites[0].params.actions, [{ title: "Not now" }]);
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

test("Spring initialize advertises the coordinator-owned commands", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: 1,
    result: {
      capabilities: {
        executeCommandProvider: { commands: ["sts/server-command"] },
      },
    },
  });
  assert.deepEqual(
    zedWrites[0].result.capabilities.executeCommandProvider.commands,
    [
      "sts/server-command",
      "zed-spring-tools.explain-code-lens",
      "zed-spring-tools.configure-boot-run",
      "zed-spring-tools.generate-structure-document",
      "zed-spring-tools.convert-properties-yaml",
      "zed-spring-tools.reload-properties-metadata",
      "zed-spring-tools.manage-live-process",
      "zed-spring-tools.generate-live-metrics-document",
      "zed-spring-tools.configure-live-log-level",
    ],
  );
});

test("standard Spring CodeLens preserves server commands and adapts VS Code client commands", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const uri = "file:///tmp/project/Demo.java";
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, version: 4, text: "class Demo {}" } },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "lens",
    method: "textDocument/codeLens",
    params: { textDocument: { uri } },
  });
  const range = {
    start: { line: 1, character: 2 },
    end: { line: 1, character: 5 },
  };
  const targetRange = {
    start: { line: 8, character: 3 },
    end: { line: 8, character: 12 },
  };
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "lens",
    result: [
      { range, command: { title: "Go To Implementation", command: "sts/server-command" } },
      {
        range,
        command: {
          title: "Web config",
          command: "vscode.open",
          arguments: [uri, { selection: targetRange }],
        },
      },
      { range, command: { title: "GET /demo" } },
      {
        range,
        command: {
          title: "Explain query",
          command: "vscode-spring-boot.query.explain",
          arguments: ["prompt"],
        },
      },
      {
        range,
        command: {
          title: "Convert to Router Builder Pattern with AI",
          command: "vscode-spring-boot.query.explain",
          arguments: ["prompt"],
        },
      },
      {
        range,
        command: {
          title: "http://127.0.0.1:8080/demo",
          command: "vscode-spring-boot.open.url",
          arguments: ["http://127.0.0.1:8080/demo"],
        },
      },
    ],
  });
  const [server, open, info, ai, aiEdit, url] = zedWrites[0].result;
  assert.equal(server.command.command, "sts/server-command");
  assert.equal(open.command.command, "editor.action.goToLocations");
  assert.deepEqual(open.command.arguments, [uri, range.start, [{ uri, range: targetRange }]]);
  assert.deepEqual(info.command.arguments, [{ kind: "info", originalCommand: null }]);
  assert.deepEqual(ai.command.arguments, [
    { kind: "ai", originalCommand: "vscode-spring-boot.query.explain" },
  ]);
  assert.deepEqual(aiEdit.command.arguments, [
    { kind: "ai-edit", originalCommand: "vscode-spring-boot.query.explain" },
  ]);
  assert.deepEqual(url.command.arguments, [
    {
      kind: "url",
      originalCommand: "vscode-spring-boot.open.url",
      url: "http://127.0.0.1:8080/demo",
    },
  ]);
});

test("Spring generated implementation is pre-resolved and rewritten to one-click navigation", async () => {
  const springWrites = [];
  const zedWrites = [];
  let generatedTargetExists = true;
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
    targetExists: () => generatedTargetExists,
  });
  const sourceUri = "file:///tmp/project/src/Repository.java";
  const targetUri =
    "file:///tmp/project/target/spring-aot/main/sources/example/RepositoryImpl__AotRepository.java";
  const lensRange = {
    start: { line: 12, character: 2 },
    end: { line: 12, character: 23 },
  };
  const targetRange = {
    start: { line: 41, character: 9 },
    end: { line: 41, character: 20 },
  };
  const commandArguments = [{
    docId: { uri: sourceUri },
    repoFqName: "example.Repository",
    queryMethodName: "findByMessage",
    paramTypes: ["java.lang.String"],
    originSelection: null,
  }];
  const generatedLens = {
    range: lensRange,
    command: {
      title: "Go To Implementation",
      command: "sts/boot/open-data-query-method-aot-definition",
      arguments: commandArguments,
    },
  };

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri: sourceUri, version: 4, text: "interface Repository {}" } },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "lens-before-resolution",
    method: "textDocument/codeLens",
    params: { textDocument: { uri: sourceUri } },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "lens-before-resolution",
    result: [generatedLens],
  });
  assert.equal(zedWrites[0].result[0].command.command, "zed-spring-tools.explain-code-lens");
  assert.equal(zedWrites[0].result[0].command.arguments[0].kind, "generated-target");

  while (springWrites.length === 0) await new Promise((resolve) => setImmediate(resolve));
  const resolveRequest = springWrites.shift();
  assert.equal(resolveRequest.method, "workspace/executeCommand");
  assert.deepEqual(resolveRequest.params, {
    command: "sts/boot/open-data-query-method-aot-definition",
    arguments: commandArguments,
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "authentic-show-document",
    method: "window/showDocument",
    params: { uri: targetUri, selection: targetRange },
  });
  assert.deepEqual(springWrites.shift(), {
    jsonrpc: "2.0",
    id: "authentic-show-document",
    result: { success: true },
  });
  assert.equal(
    zedWrites.some((message) => message.method?.startsWith("window/showMessage")),
    false,
    "the background resolver must not expose the old popup",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: resolveRequest.id,
    result: { success: true },
  });
  while (!zedWrites.some((message) => message.method === "workspace/codeLens/refresh")) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  const refresh = zedWrites.find((message) => message.method === "workspace/codeLens/refresh");
  assert.equal(coordinator.observeZedMessage({ jsonrpc: "2.0", id: refresh.id, result: null }), false);

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "lens-after-resolution",
    method: "textDocument/codeLens",
    params: { textDocument: { uri: sourceUri } },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "lens-after-resolution",
    result: [generatedLens],
  });
  const rewritten = zedWrites.at(-1).result[0].command;
  assert.equal(rewritten.command, "editor.action.goToLocations");
  assert.deepEqual(rewritten.arguments, [
    sourceUri,
    lensRange.start,
    [{ uri: targetUri, range: targetRange }],
  ]);

  generatedTargetExists = false;
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "lens-after-target-removal",
    method: "textDocument/codeLens",
    params: { textDocument: { uri: sourceUri } },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "lens-after-target-removal",
    result: [generatedLens],
  });
  assert.equal(zedWrites.at(-1).result[0].command.command, "zed-spring-tools.explain-code-lens");

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didChange",
    params: { textDocument: { uri: sourceUri, version: 5 }, contentChanges: [] },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "lens-after-change",
    method: "textDocument/codeLens",
    params: { textDocument: { uri: sourceUri } },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "lens-after-change",
    result: [generatedLens],
  });
  assert.equal(zedWrites.at(-1).result[0].command.command, "zed-spring-tools.explain-code-lens");
  await coordinator.close();
});

test("version-matched sts/highlight lenses merge into standard CodeLens and stale lenses do not", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const uri = "file:///tmp/project/Demo.java";
  const range = {
    start: { line: 2, character: 0 },
    end: { line: 2, character: 4 },
  };
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, version: 7, text: "class Demo {}" } },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "sts/highlight",
    params: {
      doc: { uri, version: 7 },
      codeLenses: [
        {
          range,
          command: {
            title: "Injected into 2 beans",
            command: "sts.showHoverAtPosition",
            arguments: [range.start],
          },
        },
        { range },
      ],
    },
  });
  assert.equal(zedWrites[0].method, "workspace/codeLens/refresh");
  assert.equal(coordinator.observeZedMessage({ jsonrpc: "2.0", id: zedWrites[0].id, result: null }), false);

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "matching",
    method: "textDocument/codeLens",
    params: { textDocument: { uri } },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "matching", result: [] });
  assert.equal(zedWrites[1].result.length, 2, "commandless live ranges gain a visible Hover affordance");
  assert.equal(zedWrites[1].result[0].command.command, "zed-spring-tools.explain-code-lens");
  assert.equal(zedWrites[1].result[0].command.arguments[0].kind, "hover");
  assert.equal(zedWrites[1].result[1].command.title, "Spring live data — use Hover");
  assert.equal(zedWrites[1].result[1].command.arguments[0].kind, "hover");

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didChange",
    params: { textDocument: { uri, version: 8 }, contentChanges: [] },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "stale",
    method: "textDocument/codeLens",
    params: { textDocument: { uri } },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "stale", result: [] });
  assert.deepEqual(zedWrites[2].result, []);
});

test("unavailable CodeLens commands explain the native Zed workflow instead of failing silently", () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const handled = coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: 44,
    method: "workspace/executeCommand",
    params: {
      command: "zed-spring-tools.explain-code-lens",
      arguments: [{ kind: "hover" }],
    },
  });
  assert.equal(handled, false);
  assert.equal(zedWrites[0].method, "window/showMessage");
  assert.match(zedWrites[0].params.message, /editor: hover/);
  assert.match(zedWrites[0].params.message, /zed-industries\/zed\/issues\/20042/);
  assert.deepEqual(zedWrites[1], { jsonrpc: "2.0", id: 44, result: null });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: 45,
    method: "workspace/executeCommand",
    params: {
      command: "zed-spring-tools.explain-code-lens",
      arguments: [{ kind: "url", url: "http://127.0.0.1:8080/demo" }],
    },
  });
  assert.match(zedWrites[2].params.message, /VS Code-only command/);
  assert.match(zedWrites[2].params.message, /http:\/\/127\.0\.0\.1:8080\/demo/);
  assert.deepEqual(zedWrites[3], { jsonrpc: "2.0", id: 45, result: null });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: 46,
    method: "workspace/executeCommand",
    params: {
      command: "zed-spring-tools.explain-code-lens",
      arguments: [{ kind: "ai" }],
    },
  });
  const aiNotice = zedWrites[4].params.message;
  assert.match(aiNotice, /do not let this extension detect/);
  assert.match(aiNotice, /open\/prefill Agent/);
  assert.match(aiNotice, /separate user-initiated Agent request/);
  assert.match(aiNotice, /does not send the prompt or source/);
  assert.doesNotMatch(aiNotice, /If Zed AI is enabled/);
  assert.deepEqual(zedWrites[5], { jsonrpc: "2.0", id: 46, result: null });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: 47,
    method: "workspace/executeCommand",
    params: {
      command: "zed-spring-tools.explain-code-lens",
      arguments: [{ kind: "ai-edit" }],
    },
  });
  const aiEditNotice = zedWrites[6].params.message;
  assert.match(aiEditNotice, /no deterministic refactoring command/);
  assert.match(aiEditNotice, /open\/prefill Agent/);
  assert.match(aiEditNotice, /does not send the prompt or source/);
  assert.doesNotMatch(aiEditNotice, /If Zed AI is enabled/);
  assert.deepEqual(zedWrites[7], { jsonrpc: "2.0", id: 47, result: null });
});

test("an unrelated Spring show-document request still reports the Zed limitation", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "show-generated",
    method: "window/showDocument",
    params: {
      uri: "file:///tmp/project/target/generated/RepositoryImpl.java",
      selection: {
        start: { line: 12, character: 4 },
        end: { line: 12, character: 20 },
      },
    },
  });
  assert.equal(zedWrites[0].method, "window/showMessage");
  assert.match(zedWrites[0].params.message, /RepositoryImpl\.java/);
  assert.match(zedWrites[0].params.message, /line 13/);
  assert.match(zedWrites[0].params.message, /window\/showDocument/);
  assert.match(zedWrites[0].params.message, /Go to Definition/);
  assert.deepEqual(springWrites[0], {
    jsonrpc: "2.0",
    id: "show-generated",
    result: { success: false },
  });
});

test("a completed Spring index update refreshes Zed inlay hints", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
    inlayRefreshDelayMs: 0,
  });
  const update = {
    jsonrpc: "2.0",
    method: "spring/index/updated",
    params: { affectedProjects: ["example"] },
  };

  await coordinator.handleSpringMessage(update);
  const refresh = await waitFor(
    zedWrites,
    (message) => message.method === "workspace/inlayHint/refresh",
    "inlay refresh",
  );

  assert.deepEqual(zedWrites[0], update);
  assert.equal(
    coordinator.observeZedMessage({ jsonrpc: "2.0", id: refresh.id, result: null }),
    false,
  );
});

test("an early empty inlay response is pre-warmed after indexing before Zed refreshes", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
    inlayRefreshDelayMs: 0,
  });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "early-inlay",
    method: "textDocument/inlayHint",
    params: {
      textDocument: { uri: "file:///tmp/project/App.java" },
      range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
    },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "early-inlay", result: [] });
  assert.deepEqual(zedWrites.at(-1), { jsonrpc: "2.0", id: "early-inlay", result: [] });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "spring/index/updated",
    params: { affectedProjects: ["example"] },
  });
  const retry = await waitFor(
    springWrites,
    (message) => message.method === "textDocument/inlayHint",
    "inlay pre-warm",
  );
  const hint = { position: { line: 0, character: 1 }, label: "ready" };
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: retry.id,
    result: [hint],
  });
  await waitFor(
    zedWrites,
    (message) => message.method === "workspace/inlayHint/refresh",
    "inlay refresh after pre-warm",
  );
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "inlay-after-refresh",
    method: "textDocument/inlayHint",
    params: {
      textDocument: { uri: "file:///tmp/project/App.java" },
      range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
    },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "inlay-after-refresh",
    result: [],
  });
  assert.deepEqual(zedWrites.at(-1).result, [hint]);
  await coordinator.close();
});

test("a transient empty inlay response cannot replace a non-empty result for the same document", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const uri = "file:///tmp/project/Schedule.java";
  const range = {
    start: { line: 0, character: 0 },
    end: { line: 20, character: 0 },
  };
  const hint = {
    position: { line: 8, character: 36 },
    label: "every hour",
  };

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, version: 1, text: "class Schedule {}" } },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "non-empty-inlay",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "non-empty-inlay",
    result: [hint],
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "transient-empty-inlay",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "transient-empty-inlay",
    result: [],
  });

  assert.deepEqual(zedWrites.at(-1), {
    jsonrpc: "2.0",
    id: "transient-empty-inlay",
    result: [hint],
  });
  await coordinator.close();
});

test("the last non-empty inlay hints survive a document edit while Spring re-indexes", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });
  const uri = "file:///tmp/project/Schedule.java";
  const range = {
    start: { line: 0, character: 0 },
    end: { line: 20, character: 0 },
  };
  const hint = { position: { line: 8, character: 36 }, label: "every hour" };

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, version: 1, text: "class Schedule {}" } },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "inlay-v1",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "inlay-v1", result: [hint] });

  // An unrelated edit bumps the document version. Before the fix this deleted the
  // cache, disabling the stale-empty protection for the new version.
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didChange",
    params: { textDocument: { uri, version: 2 }, contentChanges: [] },
  });

  // Zed re-requests hints for the new version while Spring is still re-indexing
  // and returns empty. The last non-empty hints must keep masking the blank.
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "inlay-v2",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "inlay-v2", result: [] });

  assert.deepEqual(zedWrites.at(-1), {
    jsonrpc: "2.0",
    id: "inlay-v2",
    result: [hint],
  });
  await coordinator.close();
});

test("an authoritative empty pre-warm clears carried-over inlay hints once the hint is removed", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
    inlayRefreshDelayMs: 0,
  });
  const uri = "file:///tmp/project/Schedule.java";
  const range = {
    start: { line: 0, character: 0 },
    end: { line: 20, character: 0 },
  };
  const hint = { position: { line: 8, character: 36 }, label: "every hour" };

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, version: 1, text: "class Schedule {}" } },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "inlay-v1",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "inlay-v1", result: [hint] });

  // The edit removes the cron; the hint is carried forward under version 2.
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didChange",
    params: { textDocument: { uri, version: 2 }, contentChanges: [] },
  });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "inlay-v2",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "inlay-v2", result: [] });
  // Still masked while re-indexing.
  assert.deepEqual(zedWrites.at(-1).result, [hint]);

  // A completed index update triggers the authoritative pre-warm, which now
  // reports no hint. The carried-over hint must be dropped, not re-cached.
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "spring/index/updated",
    params: { affectedProjects: ["example"] },
  });
  const rewarm = await waitFor(
    springWrites,
    (message) => message.method === "textDocument/inlayHint",
    "inlay pre-warm after removal",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: rewarm.id, result: [] });
  await waitFor(
    zedWrites,
    (message) => message.method === "workspace/inlayHint/refresh",
    "inlay refresh after removal",
  );

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "inlay-after-removal",
    method: "textDocument/inlayHint",
    params: { textDocument: { uri }, range },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "inlay-after-removal", result: [] });
  assert.deepEqual(zedWrites.at(-1), {
    jsonrpc: "2.0",
    id: "inlay-after-removal",
    result: [],
  });
  await coordinator.close();
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
  while (springWrites.length === 0) await new Promise((resolve) => setImmediate(resolve));

  const enableCodeLenses = springWrites.shift();
  assert.equal(enableCodeLenses.method, "workspace/executeCommand");
  assert.deepEqual(enableCodeLenses.params, {
    command: "sts/enable/copilot/features",
    arguments: [true],
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: enableCodeLenses.id,
    result: "OK",
  });
  while (zedWrites.length === 0) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(zedWrites[0].method, "workspace/codeLens/refresh");
  assert.equal(
    coordinator.observeZedMessage({ jsonrpc: "2.0", id: zedWrites.shift().id, result: null }),
    false,
  );
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
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(zedWrites, []);
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

  // The grace window only starts once a Java file is open, so the notice
  // describes a route the session actually needs.
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: { uri: "file:///tmp/project/App.java", languageId: "java", version: 0, text: "" },
    },
  });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "add",
    method: "sts/addClasspathListener",
    params: { callbackCommandId: "sts4.classpath.AbCdEfGh", batched: true },
  });

  const popup = zedWrites.find((message) => message.method === "window/showMessageRequest");
  assert.ok(popup);
  assert.equal(popup.params.type, 1);
  assert.match(popup.params.message, /requires a working official Java extension/);
  assert.match(popup.params.message, /classpath-registration-failed-v1/);
  await coordinator.close();
});

test("a session that never opens a Java file is not told the Java route failed", async () => {
  // Zed starts the official Java server lazily. Opening only properties/YAML
  // leaves its route legitimately absent, and `window/showMessageRequest`
  // cannot be retracted, so a premature notice would be permanent.
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: () => {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: () => false,
      async execute() {
        throw new Error("official Java rejected command: timed out after 5000ms");
      },
    },
    worktree: "/tmp/project",
    javaHandshakeGraceMs: 0,
    classpathRetryMs: 1,
  });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri: "file:///tmp/project/application.properties",
        languageId: "spring-boot-properties",
        version: 0,
        text: "server.port=8080\n",
      },
    },
  });

  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "add",
    method: "sts/addClasspathListener",
    params: { callbackCommandId: "sts4.classpath.AbCdEfGh", batched: true },
  });

  assert.ok(
    !zedWrites.some((message) => message.method === "window/showMessageRequest"),
    "no Java requirement notice without a Java file",
  );
  await coordinator.close();
});

test("an absent Java route without a Java file is explained, not reported as a failure", async () => {
  // Nothing this extension can do starts the official Java server, so the user
  // gets the one instruction that works instead of a compatibility report.
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: () => {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: {
      supportsSpringClientMethod: () => false,
      async waitUntilReady() {
        throw new Error("The official Zed Java extension is required and its route was not found");
      },
      async execute() {
        throw new Error("official Java rejected command");
      },
    },
    worktree: "/tmp/project",
    javaHandshakeGraceMs: 0,
    classpathRetryMs: 1,
  });

  coordinator.observeZedMessage({ jsonrpc: "2.0", method: "initialized", params: {} });

  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "java not started notice",
  );
  assert.match(notice.params.message, /has not started/);
  assert.match(notice.params.message, /Open any \.java file/);
  // It must not borrow the compatibility-failure framing.
  assert.ok(!/compatibility report/.test(notice.params.message));
  assert.ok(
    !zedWrites.some((message) => message.method === "window/showMessageRequest"),
    "no compatibility report popup",
  );
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
    "--extension-version", "0.1.0-alpha.1",
    "--automatic-live-connection", "false",
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

async function waitFor(list, predicate, label) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const found = list.find(predicate);
    if (found !== undefined) return found;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function makeWorktree() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zst-run-"));
}

const CONFIGURE_COMMAND = {
  jsonrpc: "2.0",
  id: "cmd-1",
  method: "workspace/executeCommand",
  params: { command: "zed-spring-tools.configure-boot-run", arguments: [] },
};

const GENERATE_STRUCTURE_COMMAND = {
  jsonrpc: "2.0",
  id: "structure-1",
  method: "workspace/executeCommand",
  params: { command: "zed-spring-tools.generate-structure-document", arguments: [] },
};

const GENERATE_LIVE_METRICS_COMMAND = {
  jsonrpc: "2.0",
  id: "live-metrics-1",
  method: "workspace/executeCommand",
  params: { command: "zed-spring-tools.generate-live-metrics-document", arguments: [] },
};

const CONFIGURE_LIVE_LOG_LEVEL_COMMAND = {
  jsonrpc: "2.0",
  id: "live-log-level-1",
  method: "workspace/executeCommand",
  params: { command: "zed-spring-tools.configure-live-log-level", arguments: [] },
};

test("project Code Actions are injected for Java files and respect the only filter", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-java",
    method: "textDocument/codeAction",
    params: { textDocument: { uri: "file:///tmp/project/App.java" }, context: {} },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "ca-java",
    result: [{ title: "Existing quick fix" }],
  });
  const injected = zedWrites.at(-1).result.slice(1);
  assert.deepEqual(
    injected.map((action) => [action.title, action.kind, action.command.command]),
    [
      [
        "Spring Boot: Configure run/debug for a project…",
        "source",
        "zed-spring-tools.configure-boot-run",
      ],
      [
        "Spring Boot: Generate or refresh Structure document",
        "source",
        "zed-spring-tools.generate-structure-document",
      ],
      [
        "Spring Boot: Connect or disconnect live process data…",
        "source",
        "zed-spring-tools.manage-live-process",
      ],
      [
        "Spring Boot: Generate or refresh Live data document…",
        "source",
        "zed-spring-tools.generate-live-metrics-document",
      ],
      [
        "Spring Boot: Set a live logger level…",
        "source",
        "zed-spring-tools.configure-live-log-level",
      ],
    ],
  );
  assert.deepEqual(injected[0].command.arguments, [{ uri: "file:///tmp/project/App.java" }]);
  assert.deepEqual(injected[1].command.arguments, []);
  assert.deepEqual(injected[2].command.arguments, []);
  assert.deepEqual(injected[3].command.arguments, []);
  assert.deepEqual(injected[4].command.arguments, []);

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-invalid-existing",
    method: "textDocument/codeAction",
    params: { textDocument: { uri: "file:///tmp/project/App.java" }, context: {} },
  });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "ca-invalid-existing",
    result: [{}, null, { title: "Valid existing action" }],
  });
  assert.deepEqual(
    zedWrites.at(-1).result.map((action) => action.title),
    [
      "Valid existing action",
      "Spring Boot: Configure run/debug for a project…",
      "Spring Boot: Generate or refresh Structure document",
      "Spring Boot: Connect or disconnect live process data…",
      "Spring Boot: Generate or refresh Live data document…",
      "Spring Boot: Set a live logger level…",
    ],
  );

  // A YAML file gets the conversion and reload actions instead of the Java
  // run/debug action.
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-yaml",
    method: "textDocument/codeAction",
    params: { textDocument: { uri: "file:///tmp/project/application.yml" }, context: {} },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "ca-yaml", result: [] });
  assert.deepEqual(
    zedWrites.at(-1).result.map((action) => action.title),
    ["Spring Boot: Convert .yaml to .properties", "Spring Boot: Reload shared properties metadata"],
  );

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-quickfix",
    method: "textDocument/codeAction",
    params: { textDocument: { uri: "file:///tmp/project/App.java" }, context: { only: ["quickfix"] } },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "ca-quickfix", result: [{}] });
  assert.deepEqual(zedWrites.at(-1).result, []);
});

test("Structure document generation preserves hierarchy, safe source links, and stable refresh", async () => {
  const worktree = makeWorktree();
  const source = path.join(worktree, "src", "main", "java", "demo", "Greeting Controller.java");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "package demo;\n\nclass GreetingController {}\n");

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  assert.equal(coordinator.observeZedMessage({ ...GENERATE_STRUCTURE_COMMAND }), false);
  assert.deepEqual(zedWrites[0], { jsonrpc: "2.0", id: "structure-1", result: null });
  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/structure",
    "structure request",
  );
  assert.deepEqual(request.params.arguments, [{ updateMetadata: true }]);
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: request.id,
    result: [
      {
        attributes: { text: "demo-app", projectId: "demo-app" },
        children: [
          {
            attributes: { text: "Web [Spring]" },
            children: [
              {
                attributes: {
                  text: "GreetingController",
                  location: {
                    uri: pathToFileURL(source).href,
                    range: { start: { line: 2, character: 6 }, end: { line: 2, character: 24 } },
                  },
                },
                children: [],
              },
              {
                attributes: {
                  text: "Dependency source",
                  reference: {
                    uri: pathToFileURL(path.join(os.tmpdir(), "outside.java")).href,
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                  },
                },
                children: [],
              },
              {
                attributes: {
                  text: "Source stereotype",
                  reference: {
                    uri: pathToFileURL(source).href,
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                  },
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  });

  const target = path.join(worktree, ".zed", "spring-structure.md");
  const first = fs.readFileSync(target, "utf8");
  assert.match(first, /^<!-- zed-spring-tools:generated-structure:v1 -->\n/);
  assert.match(first, /- demo-app\n  - Web \\\[Spring\\\]/);
  assert.match(first, /\[GreetingController\]\(\.\.\/src\/main\/java\/demo\/Greeting%20Controller\.java#L3\)/);
  assert.match(first, /- Dependency source/);
  assert.match(first, /\[Source stereotype\]\(\.\.\/src\/main\/java\/demo\/Greeting%20Controller\.java#L1\)/);
  assert.doesNotMatch(first, /outside\.java|file:\/\/|zst-run-/);
  assert.equal(fs.existsSync(path.join(worktree, ".gitignore")), false);
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "structure confirmation",
  );
  assert.match(notice.params.message, /Generated \.zed\/spring-structure\.md with 5 logical nodes/);

  // The same authentic result is a byte-stable refresh, not an append. Deleting
  // the generated file also makes the next explicit action recreate it.
  coordinator.observeZedMessage({
    ...GENERATE_STRUCTURE_COMMAND,
    id: "structure-2",
  });
  const refresh = await waitFor(
    springWrites,
    (message) => message.id !== request.id && message.params?.command === "sts/spring-boot/structure",
    "structure refresh request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: refresh.id, result: [
    {
      attributes: { text: "demo-app", projectId: "demo-app" },
      children: [
        {
          attributes: { text: "Web [Spring]" },
          children: [
            {
              attributes: {
                text: "GreetingController",
                location: {
                  uri: pathToFileURL(source).href,
                  range: { start: { line: 2, character: 6 }, end: { line: 2, character: 24 } },
                },
              },
              children: [],
            },
            {
              attributes: {
                text: "Dependency source",
                reference: {
                  uri: pathToFileURL(path.join(os.tmpdir(), "outside.java")).href,
                  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                },
              },
              children: [],
            },
            {
              attributes: {
                text: "Source stereotype",
                reference: {
                  uri: pathToFileURL(source).href,
                  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
                },
              },
              children: [],
            },
          ],
        },
      ],
    },
  ] });
  await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /Refreshed/.test(message.params.message),
    "structure refresh confirmation",
  );
  assert.equal(fs.readFileSync(target, "utf8"), first);

  fs.rmSync(target);
  coordinator.observeZedMessage({ ...GENERATE_STRUCTURE_COMMAND, id: "structure-3" });
  const recreate = await waitFor(
    springWrites,
    (message) => ![request.id, refresh.id].includes(message.id) && message.params?.command === "sts/spring-boot/structure",
    "structure recreation request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: recreate.id, result: [] });
  await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /Generated/.test(message.params.message) && /0 logical nodes/.test(message.params.message),
    "structure recreation confirmation",
  );
  assert.match(fs.readFileSync(target, "utf8"), /returned no logical structure/);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Structure generation never overwrites an unowned target", async () => {
  const worktree = makeWorktree();
  const zedDirectory = path.join(worktree, ".zed");
  const target = path.join(zedDirectory, "spring-structure.md");
  fs.mkdirSync(zedDirectory);
  fs.writeFileSync(target, "# My hand-written structure\n");
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({ ...GENERATE_STRUCTURE_COMMAND });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "foreign target notice",
  );
  assert.match(notice.params.message, /is not owned by Zed Spring Tools/);
  assert.equal(fs.readFileSync(target, "utf8"), "# My hand-written structure\n");
  assert.equal(springWrites.length, 0);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Structure generation preserves a target created while Spring is responding", async () => {
  const worktree = makeWorktree();
  const target = path.join(worktree, ".zed", "spring-structure.md");
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({ ...GENERATE_STRUCTURE_COMMAND });
  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/structure",
    "in-flight structure request",
  );
  fs.mkdirSync(path.dirname(target));
  fs.writeFileSync(target, "# Created while Spring was responding\n");
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: request.id, result: [] });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /changed while Spring Tools/.test(message.params.message),
    "in-flight target notice",
  );

  assert.match(notice.params.message, /left unchanged/);
  assert.equal(fs.readFileSync(target, "utf8"), "# Created while Spring was responding\n");

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Structure document output is bounded and visibly marks truncation", async () => {
  const worktree = makeWorktree();
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({ ...GENERATE_STRUCTURE_COMMAND });
  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/structure",
    "bounded structure request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: request.id,
    result: Array.from({ length: 2_005 }, (_, index) => ({
      attributes: { text: `node-${index}` },
      children: [],
    })),
  });
  await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "bounded structure confirmation",
  );

  const contents = fs.readFileSync(
    path.join(worktree, ".zed", "spring-structure.md"),
    "utf8",
  );
  assert.equal(contents.split("\n").filter((line) => line.startsWith("- node-")).length, 2_000);
  assert.match(contents, /Output was limited to 2000 nodes and 16 levels/);
  assert.doesNotMatch(contents, /node-2000/);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Live metrics generation explicitly refreshes bounded data and writes a timestamped owned snapshot", async () => {
  const worktree = makeWorktree();
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    now: () => new Date("2026-07-23T12:34:56.000Z"),
  });

  assert.equal(coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND }), false);
  assert.deepEqual(zedWrites[0], { jsonrpc: "2.0", id: "live-metrics-1", result: null });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "connected-process request",
  );
  assert.deepEqual(connected.params.arguments, []);
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: [{
      type: "local",
      processKey: "opaque-secret-process-key",
      processName: "demo [prod]",
      pid: "4242",
    }],
  });

  const memoryRefresh = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/refresh/metrics"
      && message.params.arguments?.[0]?.metricName === "memory",
    "memory metrics refresh",
  );
  assert.deepEqual(memoryRefresh.params.arguments, [{
    processKey: "opaque-secret-process-key",
    endpoint: "metrics",
    metricName: "memory",
    tags: "",
  }]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: memoryRefresh.id, result: null });
  const gcRefresh = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/refresh/metrics"
      && message.params.arguments?.[0]?.metricName === "gcPauses",
    "GC metrics refresh",
  );
  assert.deepEqual(gcRefresh.params.arguments, [{
    processKey: "opaque-secret-process-key",
    endpoint: "metrics",
    metricName: "gcPauses",
    tags: "",
  }]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: gcRefresh.id, result: null });

  const heap = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/get/metrics"
      && message.params.arguments?.[0]?.metricName === "heapMemory",
    "heap metrics request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: heap.id, result: [{
    name: "jvm.memory.used",
    description: "Memory [used] by the JVM",
    baseUnit: "bytes",
    measurements: [
      { statistic: "VALUE", value: 1024 },
      { statistic: "NOT_FINITE", value: Number.POSITIVE_INFINITY },
    ],
    availableTags: [{ tag: "area", values: ["secret-runtime-identifier"] }],
  }] });
  const nonHeap = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/get/metrics"
      && message.params.arguments?.[0]?.metricName === "nonHeapMemory",
    "non-heap metrics request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: nonHeap.id, result: [] });
  const gc = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/get/metrics"
      && message.params.arguments?.[0]?.metricName === "gcPauses",
    "GC metrics request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: gc.id, result: [{
    name: "jvm.gc.pause",
    baseUnit: "seconds",
    measurements: [
      { statistic: "COUNT", value: 2 },
      { statistic: "TOTAL_TIME", value: 0.5 },
    ],
  }] });

  const loggers = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/getLoggers",
    "live loggers request",
  );
  assert.deepEqual(loggers.params.arguments, [
    {
      processKey: "opaque-secret-process-key",
      processName: "demo [prod]",
      type: "local",
      pid: "4242",
    },
    { endpoint: "loggers" },
  ]);
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: loggers.id,
    result: {
      processType: "local",
      processName: "demo [prod]",
      processID: "4242",
      loggers: {
        levels: ["OFF", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"],
        loggers: {
          ROOT: { configuredLevel: "INFO", effectiveLevel: "INFO" },
          "com.example.Demo": { configuredLevel: null, effectiveLevel: "INFO" },
        },
      },
    },
  });

  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /Generated \.zed\/spring-live\.md/.test(message.params.message),
    "Live metrics confirmation",
  );
  assert.match(notice.params.message, /3 live metric measurements and 2 loggers/);
  const target = path.join(worktree, ".zed", "spring-live.md");
  const contents = fs.readFileSync(target, "utf8");
  assert.match(contents, /^<!-- zed-spring-tools:generated-live-data:v2 -->\n/);
  assert.ok(contents.includes("Process: demo \\[prod\\] (pid: 4242)"));
  assert.match(contents, /Captured at: 2026-07-23T12:34:56\.000Z/);
  assert.match(contents, /VALUE: 1024 bytes/);
  assert.match(contents, /COUNT: 2 seconds/);
  assert.ok(contents.includes("TOTAL\\_TIME: 0.5 seconds"));
  assert.match(contents, /returned no metrics for this family/);
  assert.match(contents, /`ROOT` — effective: `INFO`; configured: `INFO`/);
  assert.match(contents, /`com\.example\.Demo` — effective: `INFO`; configured: `inherited`/);
  assert.doesNotMatch(contents, /opaque-secret-process-key|secret-runtime-identifier|NOT_FINITE|Infinity/);
  assert.equal(fs.existsSync(path.join(worktree, ".gitignore")), false);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Live metrics generation preserves foreign targets and writes nothing without a connected process", async () => {
  const worktree = makeWorktree();
  const zedDirectory = path.join(worktree, ".zed");
  const target = path.join(zedDirectory, "spring-live.md");
  fs.mkdirSync(zedDirectory);
  fs.writeFileSync(target, "# My live notes\n");
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND });
  const foreignNotice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "foreign Live target notice",
  );
  assert.match(foreignNotice.params.message, /is not owned by Zed Spring Tools/);
  assert.equal(fs.readFileSync(target, "utf8"), "# My live notes\n");
  assert.equal(springWrites.length, 0);

  fs.rmSync(target);
  coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND, id: "live-metrics-empty" });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "empty connected-process request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: connected.id, result: [] });
  const emptyNotice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /No connected Spring Boot process/.test(message.params.message),
    "no connected process notice",
  );
  assert.match(emptyNotice.params.message, /Connect or disconnect live process data/);
  assert.equal(fs.existsSync(target), false);
  assert.equal(
    springWrites.some((message) => message.params?.command === "sts/livedata/refresh/metrics"),
    false,
  );

  fs.writeFileSync(
    target,
    "<!-- zed-spring-tools:generated-live-metrics:v1 -->\n# Previous generated snapshot\n",
  );
  coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND, id: "live-metrics-legacy" });
  const legacyConnected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected"
      && message.id !== connected.id,
    "legacy Live document connected-process request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: legacyConnected.id, result: [] });
  assert.match(
    fs.readFileSync(target, "utf8"),
    /^<!-- zed-spring-tools:generated-live-metrics:v1 -->/,
  );

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Live metrics process selection is bounded and dismissal does not refresh or write", async () => {
  const worktree = makeWorktree();
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "multi-process request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: Array.from({ length: 14 }, (_, index) => ({
      type: "local",
      processKey: `process-${index}`,
      processName: "demo",
      pid: String(1000 + index),
    })),
  });
  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "Live metrics process prompt",
  );
  assert.equal(prompt.params.actions.length, 12);
  assert.match(prompt.params.message, /2 more processes are not shown/);
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: prompt.id, result: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    springWrites.some((message) => message.params?.command === "sts/livedata/refresh/metrics"),
    false,
  );
  assert.equal(fs.existsSync(path.join(worktree, ".zed", "spring-live.md")), false);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Live metrics document bounds metric models and measurements with a visible truncation notice", async () => {
  const worktree = makeWorktree();
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "bounded metrics process request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: [{ type: "local", processKey: "bounded", processName: "bounded-app", pid: "9" }],
  });
  for (const metricName of ["memory", "gcPauses"]) {
    const refresh = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/livedata/refresh/metrics"
        && message.params.arguments?.[0]?.metricName === metricName,
      `${metricName} bounded refresh`,
    );
    await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: refresh.id, result: null });
  }
  const oversized = Array.from({ length: 65 }, (_, model) => ({
    name: `metric-${model}`,
    baseUnit: "bytes",
    measurements: Array.from({ length: 17 }, (_, measurement) => ({
      statistic: `VALUE_${measurement}`,
      value: measurement,
    })),
  }));
  for (const [metricName, result] of [
    ["heapMemory", oversized],
    ["nonHeapMemory", []],
    ["gcPauses", []],
  ]) {
    const request = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/livedata/get/metrics"
        && message.params.arguments?.[0]?.metricName === metricName,
      `${metricName} bounded get`,
    );
    await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: request.id, result });
  }
  const loggers = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/getLoggers",
    "bounded loggers request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: loggers.id,
    result: {
      loggers: {
        levels: ["INFO", "DEBUG"],
        loggers: Object.fromEntries(
          Array.from({ length: 513 }, (_, index) => [
            `com.example.logger${String(index).padStart(3, "0")}`,
            { effectiveLevel: "INFO", configuredLevel: null },
          ]),
        ),
      },
    },
  });
  await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /Generated \.zed\/spring-live\.md/.test(message.params.message),
    "bounded Live metrics confirmation",
  );

  const contents = fs.readFileSync(path.join(worktree, ".zed", "spring-live.md"), "utf8");
  assert.equal(contents.split("\n").filter((line) => /^#### metric-\d+$/.test(line)).length, 64);
  assert.equal(contents.split("\n").filter((line) => /^- VALUE\\?_\d+:/.test(line)).length, 64 * 16);
  assert.match(contents, /limited to 64 metric models and 16 measurements per model/);
  assert.doesNotMatch(contents, /#### metric-64|VALUE\\?_16:/);
  assert.equal(contents.split("\n").filter((line) => /^- `com\.example\.logger\d+`/.test(line)).length, 512);
  assert.match(contents, /Logger output was limited to 512 of 513 entries/);
  assert.doesNotMatch(contents, /com\.example\.logger512/);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Live logger configuration pages choices and reports success only after the matching update", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  assert.equal(coordinator.observeZedMessage({ ...CONFIGURE_LIVE_LOG_LEVEL_COMMAND }), false);
  assert.deepEqual(zedWrites[0], { jsonrpc: "2.0", id: "live-log-level-1", result: null });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "logger connected-process request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: [{
      type: "local",
      processKey: "opaque-logger-process",
      processName: "logger-demo",
      pid: "8123",
    }],
  });
  const getLoggers = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/getLoggers",
    "logger data request",
  );
  assert.deepEqual(getLoggers.params.arguments, [
    {
      processKey: "opaque-logger-process",
      processName: "logger-demo",
      type: "local",
      pid: "8123",
    },
    { endpoint: "loggers" },
  ]);
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: getLoggers.id,
    result: {
      loggers: {
        levels: ["INFO", "DEBUG", "TRACE"],
        loggers: Object.fromEntries(
          Array.from({ length: 12 }, (_, index) => [
            `logger-${String(index).padStart(2, "0")}`,
            { effectiveLevel: "INFO", configuredLevel: null },
          ]),
        ),
      },
    },
  });

  const firstPage = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest" && /page 1 of 2/.test(message.params.message),
    "first logger page",
  );
  assert.equal(firstPage.params.actions.length, 11);
  assert.deepEqual(firstPage.params.actions.at(-1), { title: "More loggers →" });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: firstPage.id,
    result: { title: "More loggers →" },
  });
  const secondPage = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest" && /page 2 of 2/.test(message.params.message),
    "second logger page",
  );
  assert.deepEqual(secondPage.params.actions.at(-1), { title: "← Previous loggers" });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: secondPage.id,
    result: { title: "logger-10 — INFO" },
  });
  const levelPrompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest"
      && /Select a configured level for `logger-10`/.test(message.params.message),
    "logger level prompt",
  );
  assert.deepEqual(levelPrompt.params.actions, [
    { title: "INFO" },
    { title: "DEBUG" },
    { title: "TRACE" },
  ]);
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: levelPrompt.id,
    result: { title: "DEBUG" },
  });
  const confirmation = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest"
      && /Set logger `logger-10`/.test(message.params.message),
    "logger confirmation",
  );
  assert.deepEqual(confirmation.params.actions, [{ title: "Apply DEBUG" }]);
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: confirmation.id,
    result: { title: "Apply DEBUG" },
  });

  const configure = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/configure/logLevel",
    "configure logger request",
  );
  assert.deepEqual(configure.params.arguments, [
    { processKey: "opaque-logger-process" },
    { packageName: "logger-10", effectiveLevel: "INFO" },
    { configuredLevel: "DEBUG" },
  ]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: configure.id, result: null });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "sts/liveprocess/loglevel/updated",
    params: {
      processKey: "opaque-logger-process",
      packageName: "logger-10",
      configuredLevel: "TRACE",
    },
  });
  assert.equal(
    zedWrites.some((message) => message.method === "window/showMessage" && /Set `logger-10`/.test(message.params.message)),
    false,
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "sts/liveprocess/loglevel/updated",
    params: {
      processKey: "opaque-logger-process",
      packageName: "logger-10",
      configuredLevel: "DEBUG",
    },
  });
  const success = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /Set `logger-10` to `DEBUG`/.test(message.params.message),
    "confirmed logger update",
  );
  assert.match(success.params.message, /Rerun the Live data document action/);
});

test("Live logger configuration reports an unconfirmed request instead of false success", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
    liveLogLevelConfirmMs: 5,
  });

  coordinator.observeZedMessage({ ...CONFIGURE_LIVE_LOG_LEVEL_COMMAND });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "unconfirmed logger connected request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: [{ type: "local", processKey: "unconfirmed", processName: "demo", pid: "9" }],
  });
  const getLoggers = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/getLoggers",
    "unconfirmed logger data request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: getLoggers.id,
    result: {
      loggers: {
        levels: ["INFO", "DEBUG"],
        loggers: { ROOT: { effectiveLevel: "INFO", configuredLevel: "INFO" } },
      },
    },
  });
  const loggerPrompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest" && /page 1 of 1/.test(message.params.message),
    "unconfirmed logger selection",
  );
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: loggerPrompt.id, result: { title: "ROOT — INFO" } });
  const levelPrompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest" && /Select a configured level/.test(message.params.message),
    "unconfirmed level selection",
  );
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: levelPrompt.id, result: { title: "DEBUG" } });
  const confirmation = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest" && /Set logger `ROOT`/.test(message.params.message),
    "unconfirmed logger confirmation",
  );
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: confirmation.id, result: { title: "Apply DEBUG" } });
  const configure = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/configure/logLevel",
    "unconfirmed configure request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: configure.id, result: null });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /did not confirm the runtime change/.test(message.params.message),
    "unconfirmed logger notice",
  );
  assert.doesNotMatch(notice.params.message, /Set ROOT to DEBUG/);
});

test("dismissing a live logger selection changes nothing", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({ ...CONFIGURE_LIVE_LOG_LEVEL_COMMAND });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "dismissed logger connected request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: [{ type: "local", processKey: "dismissed", processName: "demo", pid: "10" }],
  });
  const getLoggers = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/getLoggers",
    "dismissed logger data request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: getLoggers.id,
    result: {
      loggers: {
        levels: ["INFO", "DEBUG"],
        loggers: { ROOT: { effectiveLevel: "INFO", configuredLevel: "INFO" } },
      },
    },
  });
  const loggerPrompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest" && /page 1 of 1/.test(message.params.message),
    "dismissed logger selection",
  );
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: loggerPrompt.id, result: null });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    springWrites.some((message) => message.params?.command === "sts/livedata/configure/logLevel"),
    false,
  );
});

test("properties files offer conversion and reload actions with the right direction", async () => {
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  const uri = "file:///tmp/project/src/main/resources/application.properties";
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-props",
    method: "textDocument/codeAction",
    params: { textDocument: { uri }, context: {} },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "ca-props", result: [] });
  const actions = zedWrites.at(-1).result;
  assert.deepEqual(
    actions.map((action) => [action.title, action.kind, action.command.command]),
    [
      ["Spring Boot: Convert .properties to .yaml", "source", "zed-spring-tools.convert-properties-yaml"],
      ["Spring Boot: Reload shared properties metadata", "source", "zed-spring-tools.reload-properties-metadata"],
    ],
  );
  assert.deepEqual(actions[0].command.arguments, [{ uri, direction: "props-to-yaml" }]);
  assert.deepEqual(actions[1].command.arguments, []);

  // A restrictive only-filter that excludes source actions suppresses them.
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-props-quickfix",
    method: "textDocument/codeAction",
    params: { textDocument: { uri }, context: { only: ["quickfix"] } },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "ca-props-quickfix", result: [] });
  assert.deepEqual(zedWrites.at(-1).result, []);
});

test("converting properties to YAML executes the Spring command with a non-colliding target", async () => {
  const worktree = makeWorktree();
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  const source = path.join(resources, "application.properties");
  fs.writeFileSync(source, "server.port=8080\n");
  // A pre-existing application.yml forces the collision-avoiding suffix.
  fs.writeFileSync(path.join(resources, "application.yml"), "server: {}\n");
  const sourceUri = pathToFileURL(source).href;

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  assert.equal(
    coordinator.observeZedMessage({
      jsonrpc: "2.0",
      id: "convert-1",
      method: "workspace/executeCommand",
      params: {
        command: "zed-spring-tools.convert-properties-yaml",
        arguments: [{ uri: sourceUri, direction: "props-to-yaml" }],
      },
    }),
    false,
  );
  assert.equal(zedWrites[0].id, "convert-1");
  assert.equal(zedWrites[0].result, null);

  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/boot/props-to-yaml",
    "props-to-yaml request",
  );
  const [requestSourceUri, targetUri, replace] = request.params.arguments;
  assert.equal(requestSourceUri, sourceUri);
  assert.equal(replace, false);
  assert.equal(path.basename(fileURLToPath(targetUri)), "application1.yml");

  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: request.id, result: null });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "conversion notice",
  );
  assert.match(notice.params.message, /Converted application\.properties to application1\.yml/);
  assert.match(notice.params.message, /original file was kept/i);
});

test("a conversion's post-create showDocument is acknowledged silently, not as a CodeLens notice", async () => {
  const worktree = makeWorktree();
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  const source = path.join(resources, "application.properties");
  fs.writeFileSync(source, "server.port=8080\n");
  const sourceUri = pathToFileURL(source).href;

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "convert-show",
    method: "workspace/executeCommand",
    params: {
      command: "zed-spring-tools.convert-properties-yaml",
      arguments: [{ uri: sourceUri, direction: "props-to-yaml" }],
    },
  });

  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/boot/props-to-yaml",
    "props-to-yaml request",
  );
  const targetUri = request.params.arguments[1];

  // While the conversion is in flight, Spring reveals the freshly created file.
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: "reveal-1",
    method: "window/showDocument",
    params: { uri: targetUri, selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } },
  });

  // Acknowledged as success, with no CodeLens/Spring-Data popup toward Zed.
  const reveal = springWrites.find((message) => message.id === "reveal-1");
  assert.deepEqual(reveal.result, { success: true });
  assert.ok(
    !zedWrites.some((message) => message.method?.startsWith("window/showMessage")),
    "no showMessage before the conversion completes",
  );

  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: request.id, result: null });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "conversion notice",
  );
  assert.match(notice.params.message, /Converted application\.properties to application\.yml/);
  // The only Zed-facing message is the success notice — never the CodeLens one.
  assert.ok(
    !zedWrites.some((message) => /does not support the LSP window\/showDocument/.test(message.params?.message ?? "")),
    "no CodeLens showDocument fallback notice",
  );
});

test("reload shared properties metadata executes the Spring command", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  assert.equal(
    coordinator.observeZedMessage({
      jsonrpc: "2.0",
      id: "reload-1",
      method: "workspace/executeCommand",
      params: { command: "zed-spring-tools.reload-properties-metadata", arguments: [] },
    }),
    false,
  );
  assert.equal(zedWrites[0].result, null);

  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/common-properties/reload",
    "reload request",
  );
  assert.deepEqual(request.params.arguments, []);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: request.id, result: true });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "reload notice",
  );
  assert.match(notice.params.message, /Reloaded shared properties metadata/);
});

test("an unconfigured shared metadata file is reported instead of a false refresh", async () => {
  // `SpringPropertiesIndexManager.reloadCommonProperties()` returns false when
  // `boot-java.common.properties-metadata` is unset — nothing was reloaded, so
  // the notice must say so and name the setting.
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "reload-unset",
    method: "workspace/executeCommand",
    params: { command: "zed-spring-tools.reload-properties-metadata", arguments: [] },
  });

  const request = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/common-properties/reload",
    "reload request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: request.id, result: false });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "reload notice",
  );
  assert.match(notice.params.message, /nothing to reload/);
  assert.match(notice.params.message, /boot-java/);
  assert.match(notice.params.message, /properties-metadata/);
  assert.ok(
    !/Reloaded shared properties metadata/.test(notice.params.message),
    "no success claim when nothing was reloaded",
  );
});

const MANAGE_LIVE_PROCESS_COMMAND_MESSAGE = {
  jsonrpc: "2.0",
  id: "live-1",
  method: "workspace/executeCommand",
  params: { command: "zed-spring-tools.manage-live-process", arguments: [] },
};

function waitingJavaTransport() {
  return {
    supportsSpringClientMethod: () => false,
    waitUntilReady: ({ signal }) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
          return;
        }
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      }),
  };
}

test("opt-in automatic live connection attaches only the single matching Boot project", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: waitingJavaTransport(),
    worktree: "/tmp/project",
    automaticLiveInitialDelayMs: 0,
    automaticLivePollMs: 60_000,
  });

  coordinator.observeZedMessage({ jsonrpc: "2.0", method: "initialized", params: {} });
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    method: "workspace/didChangeConfiguration",
    params: {
      settings: {
        "boot-java": {
          "live-information": {
            "automatic-connection": { on: true },
          },
        },
      },
    },
  });
  const projectsRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "automatic executable-project discovery",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: projectsRequest.id,
    result: [{
      name: "demo",
      mainClass: "dev.example.DemoApplication",
      uri: "file:///tmp/project",
    }],
  });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "automatic process discovery",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      {
        processKey: "unrelated:1000",
        label: "other",
        action: "sts/livedata/connect",
        projectName: "other",
      },
      {
        processKey: "unnamed:1001",
        label: "unnamed",
        action: "sts/livedata/connect",
      },
      {
        processKey: "demo:1234",
        label: "demo (pid: 1234)",
        action: "sts/livedata/connect",
        projectName: "demo",
      },
    ],
  });
  const connectRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/connect",
    "automatic connect request",
  );
  assert.deepEqual(connectRequest.params.arguments, [{ processKey: "demo:1234" }]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: connectRequest.id, result: null });
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "sts/liveprocess/connected",
    params: { type: "local", processKey: "demo:1234", processName: "demo", pid: "1234" },
  });
  const notice = await waitFor(
    zedWrites,
    (message) =>
      message.method === "window/showMessage" &&
      /Automatically connected live data from demo/.test(message.params?.message),
    "automatic connect confirmation",
  );
  assert.match(notice.params.message, /connect\/disconnect action to disconnect/);
  assert.equal(
    springWrites.some(
      (message) =>
        message.params?.command === "sts/livedata/connect" &&
        message.params.arguments?.[0]?.processKey !== "demo:1234",
    ),
    false,
  );

  coordinator.beginClose();
  await coordinator.close();
});

test("automatic live connection fails closed when matching process identity is ambiguous", async () => {
  const springWrites = [];
  const zedWrites = [];
  const logs = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: waitingJavaTransport(),
    worktree: "/tmp/project",
    automaticLiveConnection: true,
    automaticLiveInitialDelayMs: 0,
    automaticLivePollMs: 60_000,
    logger: (message) => logs.push(message),
  });

  coordinator.observeZedMessage({ jsonrpc: "2.0", method: "initialized", params: {} });
  const projectsRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "automatic executable-project discovery",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: projectsRequest.id,
    result: [{
      name: "demo",
      mainClass: "dev.example.DemoApplication",
      uri: "file:///tmp/project",
    }],
  });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "automatic process discovery",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      {
        processKey: "demo:1234",
        label: "demo one",
        action: "sts/livedata/connect",
        projectName: "demo",
      },
      {
        processKey: "demo:5678",
        label: "demo two",
        action: "sts/livedata/connect",
        projectName: "demo",
      },
    ],
  });
  await waitFor(
    logs,
    (message) => /2 matching processes are ambiguous/.test(message),
    "ambiguity log",
  );
  assert.equal(
    springWrites.some((message) => message.params?.command === "sts/livedata/connect"),
    false,
  );
  assert.equal(
    zedWrites.some((message) => message.method === "window/showMessageRequest"),
    false,
    "automatic ambiguity must not become an implicit selection prompt",
  );

  coordinator.beginClose();
  await coordinator.close();
});

test("connecting a live process reports success only after the server confirms the connection", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  // The command is answered immediately so Zed's UI never blocks on discovery.
  assert.equal(coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE }), false);
  assert.equal(zedWrites[0].id, "live-1");
  assert.equal(zedWrites[0].result, null);

  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  assert.deepEqual(listRequest.params.arguments, []);
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      {
        processKey: "app:1234",
        label: "demo (pid: 1234)",
        action: "sts/livedata/connect",
        projectName: "demo",
        processId: "1234",
      },
    ],
  });

  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "process selection prompt",
  );
  assert.deepEqual(prompt.params.actions.map((action) => action.title), [
    "Connect — demo (pid: 1234)",
  ]);
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: prompt.id,
    result: { title: "Connect — demo (pid: 1234)" },
  });

  const connectRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/connect",
    "connect request",
  );
  assert.deepEqual(connectRequest.params.arguments, [{ processKey: "app:1234" }]);
  // Connect resolves to null whether or not the process was reached, so a null
  // result must not be treated as success.
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: connectRequest.id, result: null });
  assert.equal(
    zedWrites.some((message) => message.method === "window/showMessage"),
    false,
    "no notice before the server confirms the connection",
  );

  // The authoritative success signal: the server announces the connected process.
  coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "sts/liveprocess/connected",
    params: { type: "local", processKey: "app:1234", processName: "demo", pid: "1234" },
  });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "connect confirmation",
  );
  assert.match(notice.params.message, /Connected live data from demo \(pid: 1234\)/);
  // The connected notification is still forwarded to Zed unchanged.
  assert.ok(
    zedWrites.some(
      (message) => message.method === "sts/liveprocess/connected" && message.params?.processKey === "app:1234",
    ),
    "connected notification forwarded to Zed",
  );
});

test("a connect that never confirms reports a bounded request, not a false success", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
    // Keep the confirm window short so the test does not wait for the real one.
    liveConnectConfirmMs: 20,
  });

  coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      { processKey: "app:1234", label: "demo", action: "sts/livedata/connect" },
    ],
  });
  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "prompt",
  );
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: prompt.id, result: { title: "Connect — demo" } });
  const connectRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/connect",
    "connect request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: connectRequest.id, result: null });

  // Let the confirm timer elapse in real time; waitFor polls with setImmediate,
  // which can drain before a wall-clock timer fires, so give the timer room.
  await new Promise((resolve) => setTimeout(resolve, 40));
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "requested notice",
  );
  assert.match(notice.params.message, /Requested a live-data connection to demo/);
  assert.match(notice.params.message, /Actuator/);
  assert.ok(
    !/Connected live data from/.test(notice.params.message),
    "no success claim without a confirmation",
  );
});

// A target declared in `boot-java.remote-apps` arrives through the same
// `listProcesses` route as a local JVM, but Spring derives its key and its label
// from the user's `jmxurl` (`SpringProcessConnectorRemote.getProcessKey` /
// `getProcessName`). If that URL carries credentials they must not reach a
// prompt or a notice, while the key Spring identifies the target by has to go
// back unchanged.
const REMOTE_JMX_URL =
  "service:jmx:rmi://admin:s3cr3t@staging:9111/jndi/rmi://staging:9111/jmxrmi";
const REDACTED_JMX_URL =
  "service:jmx:rmi://<credentials redacted>@staging:9111/jndi/rmi://staging:9111/jmxrmi";

test("a remote target's credentials are redacted in prompts while Spring still gets the raw key", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  // The label Spring builds when the entry has neither `processName` nor `host`.
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      {
        processKey: REMOTE_JMX_URL,
        label: `remote process - ${REMOTE_JMX_URL}`,
        action: "sts/livedata/connect",
      },
    ],
  });

  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "process selection prompt",
  );
  const [title] = prompt.params.actions.map((action) => action.title);
  assert.equal(title, `Connect — remote process - ${REDACTED_JMX_URL}`);
  assert.ok(!title.includes("s3cr3t"), "no password in the prompt");
  assert.ok(!title.includes("admin"), "no username in the prompt");
  // Host and port survive so the user can still tell which target they picked.
  assert.ok(title.includes("staging:9111"), "the endpoint stays identifiable");
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: prompt.id, result: { title } });

  const connectRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/connect",
    "connect request",
  );
  // Redaction is presentation-only: the server's own identifier round-trips intact.
  assert.deepEqual(connectRequest.params.arguments, [{ processKey: REMOTE_JMX_URL }]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: connectRequest.id, result: null });
  coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    method: "sts/liveprocess/connected",
    params: { type: "remote", processKey: REMOTE_JMX_URL, processName: `remote process - ${REMOTE_JMX_URL}` },
  });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "connect confirmation",
  );
  assert.ok(!notice.params.message.includes("s3cr3t"), "no password in the notice");
  assert.match(notice.params.message, /Connected live data from remote process/);
});

test("the Live data document never persists a remote target's credentials", async () => {
  const worktree = makeWorktree();
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    now: () => new Date("2026-07-23T12:34:56.000Z"),
  });

  coordinator.observeZedMessage({ ...GENERATE_LIVE_METRICS_COMMAND });
  const connected = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listConnected",
    "connected-process request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: connected.id,
    result: [{
      type: "remote",
      processKey: REMOTE_JMX_URL,
      processName: `remote process - ${REMOTE_JMX_URL}`,
    }],
  });

  for (const metricName of ["memory", "gcPauses"]) {
    const refresh = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/livedata/refresh/metrics"
        && message.params.arguments?.[0]?.metricName === metricName,
      `${metricName} refresh`,
    );
    await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: refresh.id, result: null });
  }
  for (const metricName of ["heapMemory", "nonHeapMemory", "gcPauses"]) {
    const read = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/livedata/get/metrics"
        && message.params.arguments?.[0]?.metricName === metricName,
      `${metricName} read`,
    );
    await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: read.id, result: [] });
  }

  const loggers = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/getLoggers",
    "live loggers request",
  );
  // The name Spring indexes the process by travels back verbatim; only rendered
  // text is redacted, so an altered name can never break the server lookup.
  assert.equal(loggers.params.arguments[0].processName, `remote process - ${REMOTE_JMX_URL}`);
  assert.equal(loggers.params.arguments[0].processKey, REMOTE_JMX_URL);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: loggers.id, result: {} });

  await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage"
      && /\.zed\/spring-live\.md/.test(message.params.message),
    "Live document confirmation",
  );
  const contents = fs.readFileSync(path.join(worktree, ".zed", "spring-live.md"), "utf8");
  assert.ok(!contents.includes("s3cr3t"), "no password in the generated document");
  assert.ok(!contents.includes("admin:"), "no username in the generated document");
  // The angle brackets are Markdown-escaped in the file and render as literals,
  // so assert on the wording rather than the escaped punctuation.
  assert.ok(contents.includes("credentials redacted"), "the redaction is visible, not silent");
  assert.ok(contents.includes("staging:9111"), "the endpoint stays identifiable");
  fs.rmSync(worktree, { recursive: true, force: true });
});

test("disconnecting a connected process issues disconnect and reports it", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  // A connected process offers both refresh and disconnect entries.
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      { processKey: "app:1234", label: "demo", action: "sts/livedata/refresh" },
      { processKey: "app:1234", label: "demo", action: "sts/livedata/disconnect" },
    ],
  });
  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "prompt",
  );
  assert.deepEqual(prompt.params.actions.map((action) => action.title), [
    "Refresh — demo",
    "Disconnect — demo",
  ]);
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: prompt.id, result: { title: "Disconnect — demo" } });

  const disconnectRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/disconnect",
    "disconnect request",
  );
  assert.deepEqual(disconnectRequest.params.arguments, [{ processKey: "app:1234" }]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: disconnectRequest.id, result: null });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "disconnect notice",
  );
  assert.match(notice.params.message, /Disconnected live data from demo/);
});

test("refreshing a connected process issues refresh and reports it", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [
      { processKey: "app:1234", label: "demo", action: "sts/livedata/refresh" },
      { processKey: "app:1234", label: "demo", action: "sts/livedata/disconnect" },
    ],
  });
  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "prompt",
  );
  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: prompt.id,
    result: { title: "Refresh — demo" },
  });

  const refreshRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/refresh",
    "refresh request",
  );
  assert.deepEqual(refreshRequest.params.arguments, [{ processKey: "app:1234" }]);
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: refreshRequest.id, result: null });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "refresh notice",
  );
  assert.match(notice.params.message, /Refreshed live data from demo/);
});

test("no running processes reports a notice and issues no connect command", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: listRequest.id, result: [] });

  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "empty notice",
  );
  assert.match(notice.params.message, /No running Spring Boot processes were found/);
  assert.equal(
    zedWrites.some((message) => message.method === "window/showMessageRequest"),
    false,
    "no selection prompt for an empty process list",
  );
  assert.equal(
    springWrites.some((message) => message.params?.command === "sts/livedata/connect"),
    false,
    "no connect command for an empty process list",
  );
});

test("dismissing the process prompt runs no live-data command", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({ ...MANAGE_LIVE_PROCESS_COMMAND_MESSAGE });
  const listRequest = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/livedata/listProcesses",
    "listProcesses request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: listRequest.id,
    result: [{ processKey: "app:1234", label: "demo", action: "sts/livedata/connect" }],
  });
  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "prompt",
  );
  // Zed dropping the prompt returns a response with no chosen action.
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: prompt.id, result: null });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    springWrites.some((message) => message.params?.command === "sts/livedata/connect"),
    false,
    "no connect after a dismissed prompt",
  );
});

test("an invalid conversion request reports no convertible file and calls no Spring command", async () => {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree: "/tmp/project",
  });

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "convert-bad",
    method: "workspace/executeCommand",
    params: {
      command: "zed-spring-tools.convert-properties-yaml",
      arguments: [{ uri: "file:///tmp/project/application.properties", direction: "sideways" }],
    },
  });
  const notice = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "invalid-conversion notice",
  );
  assert.match(notice.params.message, /No convertible properties or YAML file/);
  assert.equal(
    springWrites.some((message) => message.params?.command?.startsWith("sts/boot/")),
    false,
  );
});

test("configure run/debug discovers projects, prompts, and writes portable .zed configs", async () => {
  const worktree = makeWorktree();
  const moduleA = path.join(worktree, "service-a");
  const moduleB = path.join(worktree, "service-b");
  fs.mkdirSync(moduleA);
  fs.mkdirSync(moduleB);
  fs.writeFileSync(path.join(moduleA, "mvnw"), "#!/bin/sh\n");
  fs.writeFileSync(path.join(moduleA, "pom.xml"), "<project/>\n");
  fs.writeFileSync(path.join(moduleB, "build.gradle"), "plugins {}\n");

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs: "macos" },
  });

  assert.equal(coordinator.observeZedMessage({ ...CONFIGURE_COMMAND }), false);
  assert.equal(zedWrites[0].id, "cmd-1");
  assert.equal(zedWrites[0].result, null);

  const discovery = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "executable projects request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: discovery.id,
    result: [
      { name: "service-a", mainClass: "com.example.a.AApp", uri: pathToFileURL(moduleA).href },
      { name: "service-b", mainClass: "com.example.b.BApp", uri: pathToFileURL(moduleB).href },
    ],
  });

  const prompt = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessageRequest",
    "selection prompt",
  );
  assert.deepEqual(prompt.params.actions.map((action) => action.title), [
    "service-a",
    "service-b",
    "All projects",
  ]);
  coordinator.observeZedMessage({ jsonrpc: "2.0", id: prompt.id, result: { title: "All projects" } });

  await waitFor(zedWrites, (message) => message.method === "window/showMessage", "confirmation");
  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  const debug = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "debug.json"), "utf8"));

  assert.deepEqual(
    tasks.map((task) => [task.label, task.command, task.args, task.cwd]),
    [
      ["Spring Boot (zed-spring-tools): service-a (run)", "./mvnw", ["spring-boot:run"], "$ZED_WORKTREE_ROOT/service-a"],
      ["Spring Boot (zed-spring-tools): service-b (run)", "gradle", ["bootRun"], "$ZED_WORKTREE_ROOT/service-b"],
    ],
  );
  assert.deepEqual(debug[0], {
    adapter: "Java",
    request: "launch",
    label: "Spring Boot (zed-spring-tools): service-a (debug)",
    mainClass: "com.example.a.AApp",
    cwd: "$ZED_WORKTREE_ROOT/service-a",
    vmArgs: "",
    args: [],
    env: {},
    stopOnEntry: false,
  });
  assert.equal(debug[1].mainClass, "com.example.b.BApp");

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("a single project skips the prompt and merges without touching foreign entries", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  fs.mkdirSync(path.join(worktree, ".zed"));
  fs.writeFileSync(
    path.join(worktree, ".zed", "tasks.json"),
    `${JSON.stringify(
      [
        { label: "My task", command: "echo" },
        { label: "Spring Boot (zed-spring-tools): stale (run)", command: "gone" },
      ],
      null,
      2,
    )}\n`,
  );

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs: "macos" },
  });

  coordinator.observeZedMessage({ ...CONFIGURE_COMMAND });
  const discovery = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "executable projects request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: discovery.id,
    result: [{ name: "root-app", mainClass: "com.example.App", uri: pathToFileURL(worktree).href }],
  });

  await waitFor(zedWrites, (message) => message.method === "window/showMessage", "confirmation");
  assert.equal(
    zedWrites.some((message) => message.method === "window/showMessageRequest"),
    false,
    "a single project must not prompt",
  );

  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  assert.deepEqual(tasks.map((task) => task.label), [
    "My task",
    "Spring Boot (zed-spring-tools): root-app (run)",
  ]);
  assert.equal(tasks[1].cwd, "$ZED_WORKTREE_ROOT");
  const debug = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "debug.json"), "utf8"));
  assert.equal(debug[0].mainClass, "com.example.App");

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("a commented existing config is preserved and a sidecar is written instead", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  fs.mkdirSync(path.join(worktree, ".zed"));
  const tasksPath = path.join(worktree, ".zed", "tasks.json");
  const original = '[\n  // user note\n  { "label": "keep", "command": "echo" }\n]\n';
  fs.writeFileSync(tasksPath, original);

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs: "macos" },
  });

  coordinator.observeZedMessage({ ...CONFIGURE_COMMAND });
  const discovery = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "executable projects request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: discovery.id,
    result: [{ name: "root-app", mainClass: "com.example.App", uri: pathToFileURL(worktree).href }],
  });
  const confirmation = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "confirmation",
  );

  assert.equal(fs.readFileSync(tasksPath, "utf8"), original, "the commented file must be untouched");
  const sidecar = JSON.parse(
    fs.readFileSync(path.join(worktree, ".zed", "tasks.zed-spring-tools.json"), "utf8"),
  );
  assert.equal(sidecar[0].label, "Spring Boot (zed-spring-tools): root-app (run)");
  assert.match(confirmation.params.message, /tasks\.zed-spring-tools\.json/);

  fs.rmSync(worktree, { recursive: true, force: true });
});

async function driveConfigureSingleProject(worktree, project, options = {}) {
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    automaticLiveConnection: options.automaticLiveConnection,
    reportContext: { hostOs: "macos" },
  });
  coordinator.observeZedMessage({ ...CONFIGURE_COMMAND });
  const discovery = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "executable projects request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: discovery.id,
    result: [{ name: project.name, mainClass: project.mainClass, uri: pathToFileURL(worktree).href }],
  });
  const confirmation = await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage",
    "confirmation",
  );
  const read = (file) => JSON.parse(fs.readFileSync(path.join(worktree, ".zed", file), "utf8"));
  return { confirmation, tasks: read("tasks.json"), debug: read("debug.json") };
}

test("profiles from filenames and multi-doc application.yml become picker entries", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(resources, "application-dev.yml"), "server.port: 8081\n");
  fs.writeFileSync(path.join(resources, "application-prod.properties"), "server.port=9090\n");
  fs.writeFileSync(
    path.join(resources, "application.yml"),
    "spring:\n  application:\n    name: demo\n---\nspring:\n  config:\n    activate:\n      on-profile: staging\n  datasource:\n    url: x\n",
  );

  const { tasks, debug } = await driveConfigureSingleProject(worktree, {
    name: "root-app",
    mainClass: "com.example.App",
  });

  assert.deepEqual(tasks.map((task) => task.label), [
    "Spring Boot (zed-spring-tools): root-app (run)",
    "Spring Boot (zed-spring-tools): root-app (run: dev)",
    "Spring Boot (zed-spring-tools): root-app (run: prod)",
    "Spring Boot (zed-spring-tools): root-app (run: staging)",
  ]);
  assert.deepEqual(tasks[0].args, ["spring-boot:run"]);
  assert.deepEqual(tasks[1].args, ["spring-boot:run", "-Dspring-boot.run.profiles=dev"]);
  assert.deepEqual(tasks[0].env, {});
  assert.deepEqual(debug.map((config) => config.label), [
    "Spring Boot (zed-spring-tools): root-app (debug)",
    "Spring Boot (zed-spring-tools): root-app (debug: dev)",
    "Spring Boot (zed-spring-tools): root-app (debug: prod)",
    "Spring Boot (zed-spring-tools): root-app (debug: staging)",
  ]);
  assert.equal(debug[0].vmArgs, "");
  assert.equal(debug[1].vmArgs, "-Dspring.profiles.active=dev");
  assert.deepEqual(debug[0].args, []);
  assert.deepEqual(debug[0].env, {});

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("opt-in automatic live connection adds local management identity to generated debug entries", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(resources, "application-dev.yml"), "server.port: 8081\n");

  const { debug } = await driveConfigureSingleProject(
    worktree,
    { name: "root-app", mainClass: "com.example.App" },
    { automaticLiveConnection: true },
  );
  const automaticArgs = [
    "-Dspring.jmx.enabled=true",
    "-Dmanagement.endpoints.jmx.exposure.include=*",
    "-Dspring.application.admin.enabled=true",
    "-Dspring.boot.project.name=root-app",
  ].join(" ");
  assert.equal(debug[0].vmArgs, automaticArgs);
  assert.equal(debug[1].vmArgs, `-Dspring.profiles.active=dev ${automaticArgs}`);
  assert.equal(debug[0].request, "launch");
  assert.equal(debug[0].adapter, "Java");

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("automatic live debug properties fail closed for an unsafe project name", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  const { debug } = await driveConfigureSingleProject(
    worktree,
    { name: "project with spaces", mainClass: "com.example.App" },
    { automaticLiveConnection: true },
  );
  assert.equal(debug[0].vmArgs, "");
  assert.doesNotMatch(JSON.stringify(debug), /spring\.boot\.project\.name/);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("profile YAML recognizes exact flat and nested paths, lists, and boolean expressions", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(
    path.join(resources, "application.yaml"),
    [
      "spring.config.activate.on-profile: '[blue, green]'",
      "---",
      "spring:",
      "  profiles:",
      "    - legacy",
      "    - qa",
      "---",
      "spring:",
      "  config:",
      "    activate:",
      "      on-profile: 'prod & !test' # expression tokens are editable entries",
      "---",
      "custom:",
      "  profiles: ignored-legacy",
      "  config:",
      "    activate:",
      "      on-profile: ignored-modern",
      "",
    ].join("\n"),
  );

  const { tasks } = await driveConfigureSingleProject(worktree, {
    name: "yaml-app",
    mainClass: "com.example.App",
  });

  assert.deepEqual(
    tasks.slice(1).map((task) => task.label.match(/run: (.+)\)$/)[1]),
    ["blue", "green", "legacy", "prod", "qa", "test"],
  );

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("Gradle profile entries forward the active profile as a program argument", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "build.gradle"), "plugins {}\n");
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(resources, "application-dev.yaml"), "a: b\n");

  const { tasks } = await driveConfigureSingleProject(worktree, {
    name: "g",
    mainClass: "com.example.G",
  });
  assert.deepEqual(tasks[1].args, ["bootRun", "--args=--spring.profiles.active=dev"]);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("more than eight profiles are capped and the omitted ones are named", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  const resources = path.join(worktree, "src", "main", "resources");
  fs.mkdirSync(resources, { recursive: true });
  for (let n = 1; n <= 10; n += 1) {
    const name = `p${String(n).padStart(2, "0")}`;
    fs.writeFileSync(path.join(resources, `application-${name}.yml`), "x: y\n");
  }

  const { tasks, debug, confirmation } = await driveConfigureSingleProject(worktree, {
    name: "big",
    mainClass: "com.example.Big",
  });
  // base + 8 capped profiles
  assert.equal(tasks.length, 9);
  assert.equal(debug.length, 9);
  assert.deepEqual(
    tasks.slice(1).map((task) => task.label.match(/run: (p\d\d)/)[1]),
    ["p01", "p02", "p03", "p04", "p05", "p06", "p07", "p08"],
  );
  assert.match(confirmation.params.message, /more than 8 profiles/);
  assert.match(confirmation.params.message, /omitting p09, p10/);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("no executable Boot project reports a notice and writes no files", async () => {
  const worktree = makeWorktree();
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs: "macos" },
  });

  coordinator.observeZedMessage({ ...CONFIGURE_COMMAND });
  const discovery = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "executable projects request",
  );
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: discovery.id, result: [] });

  const notice = await waitFor(zedWrites, (message) => message.method === "window/showMessage", "notice");
  assert.match(notice.params.message, /No executable Spring Boot projects/);
  assert.equal(fs.existsSync(path.join(worktree, ".zed")), false);

  fs.rmSync(worktree, { recursive: true, force: true });
});

const AOT_GOAL = "compile org.springframework.boot:spring-boot-maven-plugin:process-aot";

function buildCommandMessage(buildFile, goal = AOT_GOAL, command = "sts.maven.goal") {
  return { jsonrpc: "2.0", id: "build-1", method: "workspace/executeCommand", params: { command, arguments: [buildFile, goal] } };
}

function buildCoordinator(worktree, springWrites, zedWrites) {
  return new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs: "macos" },
  });
}

test("a Spring build command becomes a reviewable task instead of a hidden process", () => {
  const worktree = makeWorktree();
  const module = path.join(worktree, "service-a");
  fs.mkdirSync(module);
  fs.writeFileSync(path.join(module, "pom.xml"), "<project/>\n");

  const springWrites = [];
  const zedWrites = [];
  const coordinator = buildCoordinator(worktree, springWrites, zedWrites);

  assert.equal(
    coordinator.observeZedMessage(buildCommandMessage(path.join(module, "pom.xml"))),
    false,
  );
  assert.deepEqual(springWrites, [], "the build command must never reach Spring");

  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  assert.deepEqual(tasks, [
    {
      label:
        "Spring Boot (zed-spring-tools) build: service-a (compile org.springframework.boot:spring-boot-maven-plugin:process-aot)",
      command: "mvn",
      args: ["compile", "org.springframework.boot:spring-boot-maven-plugin:process-aot"],
      cwd: "$ZED_WORKTREE_ROOT/service-a",
      env: {},
    },
  ]);

  const notice = zedWrites.find((message) => message.method === "window/showMessage");
  assert.match(notice.params.message, /task: spawn/);
  assert.match(notice.params.message, /mvn compile org\.springframework\.boot/);
  assert.equal(zedWrites.at(-1).id, "build-1");
  assert.equal(zedWrites.at(-1).result, null);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("a generated build task uses the wrapper beside its own build file", () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  fs.writeFileSync(path.join(worktree, "mvnw"), "#!/bin/sh\n");

  const zedWrites = [];
  buildCoordinator(worktree, [], zedWrites).observeZedMessage(
    buildCommandMessage(path.join(worktree, "pom.xml")),
  );

  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  assert.equal(tasks[0].command, "./mvnw");
  assert.equal(tasks[0].cwd, "$ZED_WORKTREE_ROOT");

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("regenerating a build task replaces only its own entry", () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  fs.mkdirSync(path.join(worktree, ".zed"));
  fs.writeFileSync(
    path.join(worktree, ".zed", "tasks.json"),
    `${JSON.stringify(
      [
        { label: "My task", command: "echo" },
        { label: "Spring Boot (zed-spring-tools): root-app (run)", command: "./mvnw" },
        {
          label: `Spring Boot (zed-spring-tools) build: ${path.basename(worktree)} (${AOT_GOAL})`,
          command: "stale",
        },
        { label: "Spring Boot (zed-spring-tools) build: other (verify)", command: "./mvnw" },
      ],
      null,
      2,
    )}\n`,
  );

  buildCoordinator(worktree, [], []).observeZedMessage(
    buildCommandMessage(path.join(worktree, "pom.xml")),
  );

  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  assert.deepEqual(tasks.map((task) => task.label), [
    "My task",
    "Spring Boot (zed-spring-tools): root-app (run)",
    "Spring Boot (zed-spring-tools) build: other (verify)",
    `Spring Boot (zed-spring-tools) build: ${path.basename(worktree)} (${AOT_GOAL})`,
  ]);
  assert.equal(tasks[1].command, "./mvnw", "run/debug entries survive a build write");
  assert.equal(tasks[2].command, "./mvnw", "another module's build task survives");

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("generating run configuration does not delete a generated build task", async () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");

  const springWrites = [];
  const zedWrites = [];
  const coordinator = buildCoordinator(worktree, springWrites, zedWrites);
  coordinator.observeZedMessage(buildCommandMessage(path.join(worktree, "pom.xml")));

  coordinator.observeZedMessage({ ...CONFIGURE_COMMAND });
  const discovery = await waitFor(
    springWrites,
    (message) => message.params?.command === "sts/spring-boot/executableBootProjects",
    "executable projects request",
  );
  await coordinator.handleSpringMessage({
    jsonrpc: "2.0",
    id: discovery.id,
    result: [{ name: "root-app", mainClass: "com.example.App", uri: pathToFileURL(worktree).href }],
  });
  await waitFor(
    zedWrites,
    (message) => message.method === "window/showMessage" && /Run tasks/.test(message.params.message),
    "run configuration confirmation",
  );

  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  assert.deepEqual(tasks.map((task) => task.label), [
    `Spring Boot (zed-spring-tools) build: ${path.basename(worktree)} (${AOT_GOAL})`,
    "Spring Boot (zed-spring-tools): root-app (run)",
  ]);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("a build command outside the worktree or with an unsafe goal writes nothing", () => {
  const worktree = makeWorktree();
  const outside = makeWorktree();
  fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
  fs.writeFileSync(path.join(outside, "pom.xml"), "<project/>\n");

  const declined = [
    [path.join(outside, "pom.xml"), AOT_GOAL, /outside this worktree/],
    [path.join(worktree, "absent.xml"), AOT_GOAL, /does not exist/],
    [path.join(worktree, "pom.xml"), "compile; rm -rf ~", /will not write to a task file/],
    [path.join(worktree, "pom.xml"), "compile $(id)", /will not write to a task file/],
    [path.join(worktree, "pom.xml"), "   ", /empty or has too many arguments/],
  ];

  for (const [buildFile, goal, expected] of declined) {
    const springWrites = [];
    const zedWrites = [];
    buildCoordinator(worktree, springWrites, zedWrites).observeZedMessage(
      buildCommandMessage(buildFile, goal),
    );
    const notice = zedWrites.find((message) => message.method === "window/showMessage");
    assert.match(notice.params.message, expected);
    assert.match(notice.params.message, /nothing was started or written/);
    assert.deepEqual(springWrites, [], "a declined build must not reach Spring either");
    assert.equal(fs.existsSync(path.join(worktree, ".zed", "tasks.json")), false);
    assert.equal(zedWrites.at(-1).result, null);
  }

  fs.rmSync(worktree, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test("an unreachable Gradle build command is taken over rather than forwarded", () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "build.gradle"), "plugins {}\n");

  const springWrites = [];
  const zedWrites = [];
  buildCoordinator(worktree, springWrites, zedWrites).observeZedMessage(
    buildCommandMessage(path.join(worktree, "build.gradle"), "bootJar", "sts.gradle.build"),
  );

  assert.deepEqual(springWrites, []);
  const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
  assert.equal(tasks[0].command, "gradle");
  assert.deepEqual(tasks[0].args, ["bootJar"]);

  fs.rmSync(worktree, { recursive: true, force: true });
});

test("a build command whose file does not match its tool is declined", () => {
  const worktree = makeWorktree();
  fs.writeFileSync(path.join(worktree, "build.gradle"), "plugins {}\n");

  const zedWrites = [];
  buildCoordinator(worktree, [], zedWrites).observeZedMessage(
    buildCommandMessage(path.join(worktree, "build.gradle"), AOT_GOAL),
  );

  const notice = zedWrites.find((message) => message.method === "window/showMessage");
  assert.match(notice.params.message, /No Maven build was detected/);
  assert.equal(fs.existsSync(path.join(worktree, ".zed", "tasks.json")), false);

  fs.rmSync(worktree, { recursive: true, force: true });
});
