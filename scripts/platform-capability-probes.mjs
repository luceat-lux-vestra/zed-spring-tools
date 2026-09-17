#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Coordinator, parseOptions } from "../coordinator/src/main.mjs";
import { LspDecoder } from "../coordinator/src/lsp.mjs";

const WAIT_TIMEOUT_MS = 5_000;
const POLL_MS = 5;
const REMOTE_JMX_URL =
  "service:jmx:rmi://admin:s3cr3t@staging:9111/jndi/rmi://staging:9111/jmxrmi";

function decodeSingle(bytes) {
  const messages = new LspDecoder().push(bytes);
  assert.equal(messages.length, 1);
  return messages[0];
}

async function waitFor(list, predicate, label, timeoutMs = WAIT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const found = list.find(predicate);
    if (found !== undefined) return found;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`timed out waiting for ${label} after ${timeoutMs} ms`);
}

function makeWorktree(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function closeCoordinator(coordinator) {
  coordinator.beginClose();
  await coordinator.close();
}

function hostOs() {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  return "linux";
}

function nativeArgumentProbe() {
  const root = makeWorktree("zst-native-args-");
  try {
    const worktree = path.join(root, "work tree");
    const options = parseOptions([
      "--worktree", worktree,
      "--java", path.join(root, "jdk", "bin", process.platform === "win32" ? "java.exe" : "java"),
      "--spring-server", path.join(root, "spring", "server.jar"),
      "--spring-home", path.join(root, "spring"),
      "--java-work-dir", path.join(root, "extensions", "work", "java"),
      "--compatibility", path.join(root, "runtime", "providers.json"),
      "--host-os", hostOs(),
      "--extension-version", "0.1.0-platform-probe",
      "--automatic-live-connection", "false",
      "--mcp-server-port", "off",
    ]);
    assert.equal(options.worktree, path.resolve(worktree));
    assert.equal(path.isAbsolute(options.worktree), true);
    assert.equal(options.hostOs, hostOs());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function structureProbe() {
  const worktree = makeWorktree("zst-native-structure-");
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

  try {
    coordinator.observeZedMessage({
      jsonrpc: "2.0",
      id: "platform-structure",
      method: "workspace/executeCommand",
      params: { command: "zed-spring-tools.generate-structure-document", arguments: [] },
    });
    const request = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/spring-boot/structure",
      "native structure request",
    );
    await coordinator.handleSpringMessage({
      jsonrpc: "2.0",
      id: request.id,
      result: [{
        attributes: { text: "demo-app", projectId: "demo-app" },
        children: [{
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
            { attributes: { text: "Dependency source" }, children: [] },
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
        }],
      }],
    });

    const notice = await waitFor(
      zedWrites,
      (message) => message.method === "window/showMessage" && /5 logical nodes/.test(message.params?.message ?? ""),
      "native structure confirmation",
    );
    assert.match(notice.params.message, /spring-structure\.md/);
    const target = path.join(worktree, ".zed", "spring-structure.md");
    const contents = fs.readFileSync(target, "utf8");
    assert.match(contents, /^<!-- zed-spring-tools:generated-structure:v1 -->\n/);
    assert.match(contents, /Greeting%20Controller\.java#L3/);
    assert.doesNotMatch(contents, /file:\/\//);
  } finally {
    await closeCoordinator(coordinator);
    fs.rmSync(worktree, { recursive: true, force: true });
  }
}

async function driveLiveSnapshot({ processRecord, metricResults, loggerResult, prefix }) {
  const worktree = makeWorktree(prefix);
  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    now: () => new Date("2026-07-23T12:34:56.000Z"),
  });

  try {
    coordinator.observeZedMessage({
      jsonrpc: "2.0",
      id: `live-${prefix}`,
      method: "workspace/executeCommand",
      params: { command: "zed-spring-tools.generate-live-metrics-document", arguments: [] },
    });
    const connected = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/livedata/listConnected",
      `${prefix} connected process request`,
    );
    await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: connected.id, result: [processRecord] });

    for (const metricName of ["memory", "gcPauses"]) {
      const refresh = await waitFor(
        springWrites,
        (message) => message.params?.command === "sts/livedata/refresh/metrics"
          && message.params.arguments?.[0]?.metricName === metricName,
        `${prefix} ${metricName} refresh`,
      );
      await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: refresh.id, result: null });
    }

    for (const metricName of ["heapMemory", "nonHeapMemory", "gcPauses"]) {
      const request = await waitFor(
        springWrites,
        (message) => message.params?.command === "sts/livedata/get/metrics"
          && message.params.arguments?.[0]?.metricName === metricName,
        `${prefix} ${metricName} read`,
      );
      await coordinator.handleSpringMessage({
        jsonrpc: "2.0",
        id: request.id,
        result: metricResults[metricName] ?? [],
      });
    }

    const loggers = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/livedata/getLoggers",
      `${prefix} loggers request`,
    );
    await coordinator.handleSpringMessage({ jsonrpc: "2.0", id: loggers.id, result: loggerResult });

    const notice = await waitFor(
      zedWrites,
      (message) => message.method === "window/showMessage" && /spring-live\.md/.test(message.params?.message ?? ""),
      `${prefix} generated live document`,
    );
    const contents = fs.readFileSync(path.join(worktree, ".zed", "spring-live.md"), "utf8");
    return { contents, notice, loggers };
  } finally {
    await closeCoordinator(coordinator);
    fs.rmSync(worktree, { recursive: true, force: true });
  }
}

async function liveMetricsProbe() {
  const { contents, notice } = await driveLiveSnapshot({
    prefix: "zst-native-live-basic-",
    processRecord: { type: "local", processKey: "opaque-process", processName: "demo [prod]", pid: "4242" },
    metricResults: {
      heapMemory: [{
        name: "jvm.memory.used",
        description: "Memory used by the JVM",
        baseUnit: "bytes",
        measurements: [{ statistic: "VALUE", value: 1024 }],
      }],
      nonHeapMemory: [],
      gcPauses: [{
        name: "jvm.gc.pause",
        baseUnit: "seconds",
        measurements: [{ statistic: "COUNT", value: 2 }, { statistic: "TOTAL_TIME", value: 0.5 }],
      }],
    },
    loggerResult: {
      loggers: {
        levels: ["INFO", "DEBUG"],
        loggers: { ROOT: { configuredLevel: "INFO", effectiveLevel: "INFO" } },
      },
    },
  });
  assert.match(notice.params.message, /live metric measurements/);
  assert.match(contents, /Captured at: 2026-07-23T12:34:56\.000Z/);
  assert.match(contents, /VALUE: 1024 bytes/);
  assert.match(contents, /`ROOT`/);
  assert.doesNotMatch(contents, /opaque-process/);
}

async function boundedLiveMetricsProbe() {
  const oversized = Array.from({ length: 65 }, (_, model) => ({
    name: `metric-${model}`,
    baseUnit: "bytes",
    measurements: Array.from({ length: 17 }, (_, measurement) => ({
      statistic: `VALUE_${measurement}`,
      value: measurement,
    })),
  }));
  const loggerEntries = Object.fromEntries(
    Array.from({ length: 513 }, (_, index) => [
      `com.example.logger${String(index).padStart(3, "0")}`,
      { effectiveLevel: "INFO", configuredLevel: null },
    ]),
  );
  const { contents } = await driveLiveSnapshot({
    prefix: "zst-native-live-bounded-",
    processRecord: { type: "local", processKey: "bounded", processName: "bounded-app", pid: "9" },
    metricResults: { heapMemory: oversized, nonHeapMemory: [], gcPauses: [] },
    loggerResult: { loggers: { levels: ["INFO", "DEBUG"], loggers: loggerEntries } },
  });
  assert.equal(contents.split("\n").filter((line) => /^#### metric-\d+$/.test(line)).length, 64);
  assert.equal(contents.split("\n").filter((line) => /^- VALUE\\?_\d+:/.test(line)).length, 64 * 16);
  assert.match(contents, /limited to 64 metric models and 16 measurements per model/);
  assert.match(contents, /Logger output was limited to 512 of 513 entries/);
  assert.doesNotMatch(contents, /#### metric-64|logger512/);
}

async function remoteCredentialProbe() {
  const { contents, loggers } = await driveLiveSnapshot({
    prefix: "zst-native-live-redaction-",
    processRecord: {
      type: "remote",
      processKey: REMOTE_JMX_URL,
      processName: `remote process - ${REMOTE_JMX_URL}`,
    },
    metricResults: { heapMemory: [], nonHeapMemory: [], gcPauses: [] },
    loggerResult: {},
  });
  assert.equal(loggers.params.arguments[0].processKey, REMOTE_JMX_URL);
  assert.equal(loggers.params.arguments[0].processName, `remote process - ${REMOTE_JMX_URL}`);
  assert.doesNotMatch(contents, /s3cr3t|admin:/);
  assert.match(contents, /credentials redacted/);
  assert.match(contents, /staging:9111/);
}

async function bootProjectInfoProbe() {
  const worktree = makeWorktree("zst-native-boot-info-");
  const projectRoot = path.join(worktree, "service-a");
  const document = path.join(projectRoot, "src", "main", "java", "dev", "example", "App.java");
  fs.mkdirSync(path.dirname(document), { recursive: true });
  fs.writeFileSync(document, "package dev.example; class App {}\n");

  const springWrites = [];
  const zedWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(decodeSingle(bytes)),
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
  });

  try {
    const documentUri = pathToFileURL(document).href;
    coordinator.observeZedMessage({
      jsonrpc: "2.0",
      id: "native-boot-info",
      method: "workspace/executeCommand",
      params: { command: "zed-spring-tools.show-boot-project-info", arguments: [{ uri: documentUri }] },
    });
    const request = await waitFor(
      springWrites,
      (message) => message.params?.command === "sts/spring-boot/bootProjectInfo",
      "native boot project info request",
    );
    assert.deepEqual(request.params.arguments, [documentUri]);
    await coordinator.handleSpringMessage({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        name: "service-a",
        uri: pathToFileURL(projectRoot).href,
        mainClass: "dev.example.ServiceAApplication",
        buildTool: "maven",
        springBootVersion: "3.5.5",
        javaVersion: "25",
      },
    });
    const notice = await waitFor(
      zedWrites,
      (message) => message.method === "window/showMessageRequest" && /service-a/.test(message.params?.message ?? ""),
      "native boot project info notice",
    );
    assert.match(notice.params.message, /at service-a\./);
    assert.doesNotMatch(notice.params.message, /file:\/\//);
  } finally {
    await closeCoordinator(coordinator);
    fs.rmSync(worktree, { recursive: true, force: true });
  }
}

const probes = [
  ["native positional arguments", async () => nativeArgumentProbe()],
  ["native Structure document generation", structureProbe],
  ["wall-clock Live metrics generation", liveMetricsProbe],
  ["wall-clock bounded Live metrics generation", boundedLiveMetricsProbe],
  ["remote Live data credential redaction", remoteCredentialProbe],
  ["native Boot project info URI/path rendering", bootProjectInfoProbe],
];

for (const [name, probe] of probes) {
  const started = Date.now();
  await probe();
  process.stdout.write(`PASS ${name} (${Date.now() - started} ms)\n`);
}
