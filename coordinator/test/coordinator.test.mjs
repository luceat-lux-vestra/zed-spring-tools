import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { pathToFileURL } from "node:url";

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

test("Spring initialize advertises the coordinator CodeLens and run/debug commands", async () => {
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
    ["sts/server-command", "zed-spring-tools.explain-code-lens", "zed-spring-tools.configure-boot-run"],
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

test("Boot run/debug code action is injected for Java files and respects the only filter", async () => {
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
  const injected = zedWrites.at(-1).result.at(-1);
  assert.equal(injected.command.command, "zed-spring-tools.configure-boot-run");
  assert.equal(injected.kind, "source");
  assert.deepEqual(injected.command.arguments, [{ uri: "file:///tmp/project/App.java" }]);

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
    ["Valid existing action", "Spring Boot: Configure run/debug for a project…"],
  );

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-yaml",
    method: "textDocument/codeAction",
    params: { textDocument: { uri: "file:///tmp/project/application.yml" }, context: {} },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "ca-yaml", result: [] });
  assert.deepEqual(zedWrites.at(-1).result, []);

  coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "ca-quickfix",
    method: "textDocument/codeAction",
    params: { textDocument: { uri: "file:///tmp/project/App.java" }, context: { only: ["quickfix"] } },
  });
  await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: "ca-quickfix", result: [{}] });
  assert.deepEqual(zedWrites.at(-1).result, []);
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

async function driveConfigureSingleProject(worktree, project) {
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
