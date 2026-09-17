#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const SPRING_MANIFEST = path.join(REPOSITORY_ROOT, "protocol", "spring-artifacts.json");
const REQUEST_TIMEOUT_MS = 90_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const MAX_STDERR_BYTES = 512 * 1024;
const MAX_STDOUT_CONTAMINATION = 8 * 1024;
const FIXED_ZIP_DATE = "1980-01-01T00:00:02Z";

// CI-only compatibility fixture. Product runtime ownership remains with the
// official Java extension; this exact independently pinned JDT LS artifact is
// the same 1.60.0 milestone previously used by the S003/S004/S012 evidence.
const JDT = Object.freeze({
  version: "1.60.0-202606262232",
  sourceCommit: "57ed41bdddc93df13ace6a266d8e3c1d35c95618",
  asset: "jdt-language-server-1.60.0-202606262232.tar.gz",
  url: "https://download.eclipse.org/jdtls/milestones/1.60.0/jdt-language-server-1.60.0-202606262232.tar.gz",
  size: 50_925_681,
  sha256: "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d",
});

const SPRING_JDT_BUNDLE_NAMES = Object.freeze([
  "io.projectreactor.reactor-core.jar",
  "org.reactivestreams.reactive-streams.jar",
  "jdt-ls-commons.jar",
  "jdt-ls-extension.jar",
  "sts-gradle-tooling.jar",
]);
const BRIDGE_ADD = "zed.spring.bridge.v1.addClasspathListener";
const BRIDGE_REMOVE = "zed.spring.bridge.v1.removeClasspathListener";
const SPRING_SEARCH = "sts.java.search.types";

class LspClient {
  constructor(process, workspaceFolders) {
    this.process = process;
    this.workspaceFolders = workspaceFolders;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.serverRequests = [];
    this.notifications = [];
    this.stdoutContamination = [];
    this.fatalError = null;

    process.stdout.on("data", (chunk) => {
      try {
        this.onData(chunk);
      } catch (error) {
        this.fail(error);
      }
    });
    process.on("exit", (code, signal) => {
      this.fail(new Error(`JDT LS exited before response: code=${code} signal=${signal}`));
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const headerStart = this.buffer.indexOf("Content-Length:");
      if (headerStart < 0) {
        if (this.buffer.length > MAX_STDOUT_CONTAMINATION) {
          this.stdoutContamination.push(this.buffer.subarray(0, MAX_STDOUT_CONTAMINATION).toString("utf8"));
          this.buffer = Buffer.alloc(0);
        }
        return;
      }
      if (headerStart > 0) {
        this.stdoutContamination.push(this.buffer.subarray(0, headerStart).toString("utf8"));
        this.buffer = this.buffer.subarray(headerStart);
      }
      const separator = this.buffer.indexOf("\r\n\r\n");
      if (separator < 0) return;
      const header = this.buffer.subarray(0, separator).toString("ascii");
      const lengthMatch = /^Content-Length:\s*(\d+)$/im.exec(header);
      if (!lengthMatch) throw new Error(`invalid JDT LSP header: ${header.slice(0, 200)}`);
      const bodyLength = Number(lengthMatch[1]);
      const frameLength = separator + 4 + bodyLength;
      if (this.buffer.length < frameLength) return;
      const body = this.buffer.subarray(separator + 4, frameLength).toString("utf8");
      this.buffer = this.buffer.subarray(frameLength);
      this.handle(JSON.parse(body));
    }
  }

  handle(message) {
    if (message.id !== undefined && message.method === undefined) {
      const key = String(message.id);
      const pending = this.pending.get(key);
      if (!pending) return;
      this.pending.delete(key);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`JDT LS ${pending.method}: ${JSON.stringify(message.error)}`));
      else pending.resolve(message.result);
      return;
    }
    if (message.id !== undefined && typeof message.method === "string") {
      this.serverRequests.push(message.method);
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        result: serverRequestResult(message.method, message.params, this.workspaceFolders),
      });
      return;
    }
    if (typeof message.method === "string") this.notifications.push(message.method);
  }

  fail(error) {
    if (this.fatalError) return;
    this.fatalError = error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  request(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (this.fatalError) return Promise.reject(this.fatalError);
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(String(id))) reject(new Error(`${method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(String(id), { method, resolve, reject, timer });
    });
    this.send({ jsonrpc: "2.0", id, method, params });
    return promise;
  }

  notify(method, params) {
    if (this.fatalError) throw this.fatalError;
    this.send({ jsonrpc: "2.0", method, params });
  }

  send(message) {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    this.process.stdin.write(Buffer.concat([
      Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"),
      body,
    ]));
  }
}

async function main() {
  const evidencePath = requiredEnv("JDT_SPRING_RUNTIME_EVIDENCE");
  const sourceHead = requiredEnv("SOURCE_HEAD_SHA");
  const testedCommit = requiredEnv("GITHUB_SHA");
  assertSha(sourceHead, "source HEAD");
  assertSha(testedCommit, "tested commit");

  const springManifest = JSON.parse(fs.readFileSync(SPRING_MANIFEST, "utf8"));
  assert.equal(springManifest.schemaVersion, 1);
  const spring = springManifest.springTools;
  assert.ok(spring && Array.isArray(spring.requiredFiles));
  assert.match(spring.sha256, /^[0-9a-f]{64}$/);

  const springBundles = SPRING_JDT_BUNDLE_NAMES.map((name) => {
    const entry = spring.requiredFiles.find((candidate) => candidate.path.endsWith(`/jars/${name}`));
    assert.ok(entry, `canonical Spring pin contains ${name}`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    return { name, ...entry };
  });
  assert.equal(new Set(springBundles.map((entry) => entry.path)).size, SPRING_JDT_BUNDLE_NAMES.length);

  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zed-jdt-spring-runtime-"));
  const jdtArchive = path.join(runRoot, JDT.asset);
  const springArchive = path.join(runRoot, spring.asset);
  const jdtExtract = path.join(runRoot, "jdt");
  const springExtract = path.join(runRoot, "spring");
  const bridgeClasses = path.join(runRoot, "bridge-classes");
  const bridgeJar = path.join(runRoot, "zed-spring-bridge.jar");
  const worktree = path.join(runRoot, "workspace space 한글");
  const jdtData = path.join(runRoot, "jdt-data");

  const evidence = {
    schemaVersion: 1,
    sourceHead,
    testedCommit,
    platform: { os: process.platform, arch: process.arch, release: os.release() },
    runtime: {
      node: process.versions.node,
      java: firstLine(commandOutput(javaTool("java"), ["-version"])),
    },
    jdt: {
      version: JDT.version,
      sourceCommit: JDT.sourceCommit,
      archiveSha256: JDT.sha256,
      launcher: null,
      configuration: null,
    },
    springTools: {
      tag: spring.tag,
      sourceCommit: spring.sourceCommit,
      archiveSha256: spring.sha256,
      bundles: springBundles.map(({ name, path: bundlePath, sha256 }) => ({ name, path: bundlePath, sha256 })),
    },
    bridge: { advertised: false, removeResult: null },
    springJdt: { searchCommandAdvertised: false },
    lsp: {
      executeCommandCount: 0,
      serverRequests: [],
      notifications: [],
      stdoutContamination: [],
      exitMode: null,
    },
    status: "running",
  };

  let child;
  let stderr = "";
  try {
    await Promise.all([
      downloadPinnedArtifact(JDT.url, jdtArchive),
      downloadPinnedArtifact(spring.url, springArchive),
    ]);
    assert.equal(fs.statSync(jdtArchive).size, JDT.size, "JDT LS archive size");
    assert.equal(sha256File(jdtArchive), JDT.sha256, "JDT LS archive SHA-256");
    assert.equal(fs.statSync(springArchive).size, spring.size, "Spring Tools archive size");
    assert.equal(sha256File(springArchive), spring.sha256, "Spring Tools archive SHA-256");

    fs.mkdirSync(jdtExtract, { recursive: true });
    requireSuccess(tarTool(), ["-xzf", jdtArchive, "-C", jdtExtract], "extract pinned JDT LS");
    const launcher = findSingleFile(
      jdtExtract,
      (name) => /^org\.eclipse\.equinox\.launcher_.+\.jar$/.test(name),
      "JDT LS Equinox launcher",
    );
    const jdtRoot = path.dirname(path.dirname(launcher));
    const configuration = path.join(jdtRoot, jdtConfigurationDirectory());
    assert.equal(fs.statSync(configuration).isDirectory(), true, "native JDT LS configuration directory");
    evidence.jdt.launcher = path.basename(launcher);
    evidence.jdt.configuration = path.basename(configuration);

    fs.mkdirSync(springExtract, { recursive: true });
    for (const entry of springBundles) assertSafeRelativePath(entry.path);
    execFileSync(jarTool(), ["xf", springArchive, ...springBundles.map((entry) => entry.path)], {
      cwd: springExtract,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const bundlePaths = springBundles.map((entry) => {
      const extracted = path.join(springExtract, ...entry.path.split("/"));
      assert.equal(fs.statSync(extracted).isFile(), true, `Spring JDT bundle regular file: ${entry.name}`);
      assert.equal(sha256File(extracted), entry.sha256, `Spring JDT bundle SHA-256: ${entry.name}`);
      return extracted;
    });

    buildBridgeJar(bridgeClasses, bridgeJar);
    assert.equal(fs.statSync(bridgeJar).isFile(), true, "bridge JAR exists");

    fs.mkdirSync(path.join(worktree, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(worktree, "src", "PlatformProbe.java"),
      "public final class PlatformProbe { public static String value() { return \"ok\"; } }\n",
      "utf8",
    );
    fs.mkdirSync(jdtData, { recursive: true });

    const jvmArguments = [
      "-Declipse.application=org.eclipse.jdt.ls.core.id1",
      "-Dosgi.bundles.defaultStartLevel=4",
      "-Declipse.product=org.eclipse.jdt.ls.core.product",
      "-Dlog.level=WARNING",
      "-Xmx1024m",
      "--add-modules=ALL-SYSTEM",
      "--add-opens", "java.base/java.util=ALL-UNNAMED",
      "--add-opens", "java.base/java.lang=ALL-UNNAMED",
      "-jar", launcher,
      "-configuration", configuration,
      "-data", jdtData,
    ];
    child = spawn(javaTool("java"), jvmArguments, {
      cwd: worktree,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > MAX_STDERR_BYTES) stderr = stderr.slice(-MAX_STDERR_BYTES);
    });

    const workspaceUri = directoryUri(worktree);
    const client = new LspClient(child, [{ uri: workspaceUri, name: "jdt-spring-runtime-smoke" }]);
    const initialize = await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "zed-spring-tools-ci", version: "1" },
      rootUri: workspaceUri,
      workspaceFolders: [{ uri: workspaceUri, name: "jdt-spring-runtime-smoke" }],
      capabilities: {
        workspace: {
          configuration: true,
          workspaceFolders: true,
          applyEdit: true,
          executeCommand: { dynamicRegistration: true },
          didChangeConfiguration: { dynamicRegistration: true },
        },
        textDocument: {
          synchronization: { dynamicRegistration: true },
          publishDiagnostics: {},
          completion: { dynamicRegistration: true },
          hover: { dynamicRegistration: true, contentFormat: ["markdown", "plaintext"] },
        },
        window: { workDoneProgress: true, showMessage: {} },
      },
      initializationOptions: {
        bundles: [...bundlePaths, bridgeJar],
        workspaceFolders: [{ uri: workspaceUri, name: "jdt-spring-runtime-smoke" }],
        settings: {
          java: {
            autobuild: { enabled: false },
            import: {
              maven: { enabled: false },
              gradle: { enabled: false },
            },
          },
        },
      },
    });
    assert.ok(initialize?.capabilities, "JDT LS initialize capabilities");
    const commands = initialize.capabilities.executeCommandProvider?.commands;
    assert.ok(Array.isArray(commands), "JDT LS execute-command inventory");
    evidence.lsp.executeCommandCount = commands.length;
    evidence.bridge.advertised = commands.includes(BRIDGE_ADD) && commands.includes(BRIDGE_REMOVE);
    evidence.springJdt.searchCommandAdvertised = commands.includes(SPRING_SEARCH);
    assert.equal(evidence.bridge.advertised, true, "current bridge commands are advertised by real JDT LS");
    assert.equal(
      evidence.springJdt.searchCommandAdvertised,
      true,
      "current Spring 5.3 JDT extension advertises sts.java.search.types",
    );

    client.notify("initialized", {});
    const registration = {
      schemaVersion: 1,
      callbackId: "sts4.classpath.AbCdEfGh",
      endpoint: "http://127.0.0.1:43121/v1/classpath",
      credential: "A".repeat(43),
      worktreeId: "d".repeat(64),
      batched: false,
    };
    const bridgeResult = await client.request("workspace/executeCommand", {
      command: BRIDGE_REMOVE,
      arguments: [registration],
    });
    assert.equal(bridgeResult, "ok", "real JDT LS executed the active current bridge bundle");
    evidence.bridge.removeResult = bridgeResult;
    evidence.lsp.serverRequests = client.serverRequests;
    evidence.lsp.notifications = [...new Set(client.notifications)].sort();
    evidence.lsp.stdoutContamination = client.stdoutContamination;
    assert.equal(client.stdoutContamination.length, 0, "JDT LS must not contaminate LSP stdout");

    await client.request("shutdown", null, 30_000);
    client.notify("exit", null);
    if (await waitForExit(child, 2_000)) {
      evidence.lsp.exitMode = "lsp-exit";
    } else {
      child.kill();
      assert.equal(await waitForExit(child, 5_000), true, "JDT LS terminates when its owner kills it");
      evidence.lsp.exitMode = "owner-kill";
    }

    evidence.status = "pass";
    evidence.finishedAt = new Date().toISOString();
    evidence.stderrTail = tailLines(stderr, 60);
    writeEvidence(evidencePath, evidence);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    evidence.status = "fail";
    evidence.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    evidence.finishedAt = new Date().toISOString();
    evidence.stderrTail = tailLines(stderr, 120);
    writeEvidence(evidencePath, evidence);
    throw error;
  } finally {
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
}

function buildBridgeJar(classes, destination) {
  fs.mkdirSync(classes, { recursive: true });
  const bridgeRoot = path.join(REPOSITORY_ROOT, "bridge");
  const sources = [
    ...javaFiles(path.join(bridgeRoot, "src", "main", "java")),
    ...javaFiles(path.join(bridgeRoot, "src", "compile-stubs", "java")),
  ].sort();
  assert.ok(sources.length > 0, "bridge Java sources exist");
  requireSuccess(
    javaTool("javac"),
    [
      "--release", "21",
      "-Xlint:all,-options", "-Werror",
      "-encoding", "UTF-8",
      "-d", classes,
      ...sources,
    ],
    "compile current bridge",
  );
  requireSuccess(
    jarTool(),
    [
      "--create",
      "--file", destination,
      "--manifest", path.join(bridgeRoot, "META-INF", "MANIFEST.MF"),
      "--date", FIXED_ZIP_DATE,
      "-C", classes, "dev",
      "-C", bridgeRoot, "plugin.xml",
    ],
    "package current bridge",
  );
  const listing = commandOutput(jarTool(), ["--list", "--file", destination]);
  assert.match(listing, /dev\/zed\/spring\/bridge\/BridgeCommandHandler\.class/);
  assert.match(listing, /plugin\.xml/);
  assert.equal(listing.split(/\r?\n/).some((entry) => entry.startsWith("org/")), false, "compile stubs excluded");
}

function javaFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) return javaFiles(child);
    return entry.isFile() && entry.name.endsWith(".java") ? [child] : [];
  });
}

function serverRequestResult(method, params, workspaceFolders) {
  if (method === "workspace/configuration") return (params?.items ?? []).map(() => ({}));
  if (method === "workspace/workspaceFolders") return workspaceFolders;
  if (method === "workspace/applyEdit") return { applied: false };
  if (method === "window/workDoneProgress/create") return null;
  if (method === "client/registerCapability" || method === "client/unregisterCapability") return null;
  return null;
}

async function downloadPinnedArtifact(url, destination) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { "user-agent": "zed-spring-tools-platform-validation" },
  });
  if (!response.ok) throw new Error(`download ${url} failed: HTTP ${response.status}`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

function findSingleFile(root, predicate, label) {
  const matches = [];
  walkFiles(root, (file) => {
    if (predicate(path.basename(file), file)) matches.push(file);
  });
  assert.equal(matches.length, 1, `${label}: expected one match, found ${matches.length}`);
  return matches[0];
}

function walkFiles(directory, visitor) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(child, visitor);
    else if (entry.isFile()) visitor(child);
  }
}

function jdtConfigurationDirectory() {
  if (process.platform === "darwin") return "config_mac";
  if (process.platform === "win32") return "config_win";
  if (process.platform === "linux") return "config_linux";
  throw new Error(`unsupported JDT smoke host: ${process.platform}`);
}

function tarTool() {
  return process.platform === "win32" ? "tar.exe" : "tar";
}

function javaTool(name) {
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  if (!process.env.JAVA_HOME) return executable;
  const candidate = path.join(process.env.JAVA_HOME, "bin", executable);
  return fs.existsSync(candidate) ? candidate : executable;
}

function jarTool() {
  return javaTool("jar");
}

function requireSuccess(command, args, action) {
  const result = spawnSync(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${action} failed with ${command}: ${result.stderr || result.stdout}`);
  }
  return result;
}

function commandOutput(command, args) {
  const result = requireSuccess(command, args, `${command} ${args.join(" ")}`);
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function directoryUri(directory) {
  const withSeparator = directory.endsWith(path.sep) ? directory : `${directory}${path.sep}`;
  return pathToFileURL(withSeparator).href;
}

function assertSafeRelativePath(value) {
  assert.equal(typeof value, "string");
  assert.ok(value.length > 0);
  assert.equal(path.posix.isAbsolute(value), false, `artifact path must be relative: ${value}`);
  assert.equal(value.split("/").includes(".."), false, `artifact path must not traverse: ${value}`);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error(`${label} is not a full Git SHA: ${JSON.stringify(value)}`);
}

function firstLine(value) {
  return String(value).split(/\r?\n/, 1)[0];
}

function tailLines(value, count) {
  return String(value).split(/\r?\n/).slice(-count);
}

function writeEvidence(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function waitForExit(process, timeoutMs) {
  if (process.exitCode !== null || process.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.off("exit", onExit);
      resolve(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    process.once("exit", onExit);
  });
}

await main();
