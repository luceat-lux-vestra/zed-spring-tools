#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { springArguments } from "../coordinator/src/main.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = path.join(REPOSITORY_ROOT, "protocol", "spring-artifacts.json");
const REQUEST_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_STDERR_BYTES = 256 * 1024;
const MAX_STDOUT_CONTAMINATION = 8 * 1024;

class LspClient {
  constructor(process, workspaceFolders) {
    this.process = process;
    this.workspaceFolders = workspaceFolders;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.serverRequests = [];
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
      this.fail(new Error(`Spring LS exited before response: code=${code} signal=${signal}`));
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
      if (!lengthMatch) throw new Error(`invalid LSP header: ${header.slice(0, 200)}`);
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
      if (message.error) pending.reject(new Error(`Spring LS ${pending.method}: ${JSON.stringify(message.error)}`));
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
    }
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
  const evidencePath = requiredEnv("SPRING_RUNTIME_EVIDENCE");
  const sourceHead = requiredEnv("SOURCE_HEAD_SHA");
  const testedCommit = requiredEnv("GITHUB_SHA");
  assertSha(sourceHead, "source HEAD");
  assertSha(testedCommit, "tested commit");

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  assert.equal(manifest.schemaVersion, 1, "Spring artifact manifest schema");
  const pin = manifest.springTools;
  assert.ok(pin && typeof pin === "object", "Spring Tools pin is required");
  assert.match(pin.url, /^https:\/\/github\.com\/spring-projects\/spring-tools\/releases\/download\//);
  assert.match(pin.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(pin.size) && pin.size > 0);
  assert.ok(Array.isArray(pin.requiredFiles) && pin.requiredFiles.length > 0);

  const serverEntry = pin.requiredFiles.find((entry) =>
    entry.path.startsWith("extension/language-server/") && entry.path.endsWith("-exec.jar"),
  );
  assert.ok(serverEntry, "canonical pin must contain the Spring Boot language-server jar");

  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-runtime-"));
  const archivePath = path.join(runRoot, pin.asset);
  const extractionRoot = path.join(runRoot, "extracted");
  const worktree = path.join(runRoot, "worktree space 한글");
  const documentPath = path.join(worktree, "src", "main", "resources", "application.properties");

  const evidence = {
    schemaVersion: 1,
    sourceHead,
    testedCommit,
    platform: {
      os: process.platform,
      arch: process.arch,
      release: os.release(),
    },
    runtime: {
      node: process.versions.node,
      java: firstLine(commandOutput(javaTool("java"), ["-version"])),
    },
    springTools: {
      tag: pin.tag,
      sourceCommit: pin.sourceCommit,
      asset: pin.asset,
      archiveSha256: pin.sha256,
      extraction: "full-canonical-vsix",
      requiredFiles: [],
    },
    lsp: {
      initializeCapabilityKeys: [],
      serverRequests: [],
      completion: null,
      hover: null,
      stdoutContamination: [],
      exitMode: null,
    },
    status: "running",
  };

  let child;
  let stderr = "";
  try {
    await downloadPinnedArtifact(pin.url, archivePath);
    assert.equal(fs.statSync(archivePath).size, pin.size, "Spring Tools archive size");
    assert.equal(sha256File(archivePath), pin.sha256, "Spring Tools archive SHA-256");

    // Production extracts the complete checksum-verified VSIX and then validates
    // the identity-critical files. Mirror that installation shape here: the
    // executable Spring Boot LS JAR loads runtime dependencies from sibling
    // language-server/lib entries that are intentionally not part of the small
    // required-file identity set.
    fs.mkdirSync(extractionRoot, { recursive: true });
    for (const entry of pin.requiredFiles) assertSafeRelativePath(entry.path);
    execFileSync(jarTool(), ["xf", archivePath], {
      cwd: extractionRoot,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    for (const entry of pin.requiredFiles) {
      const extracted = path.join(extractionRoot, ...entry.path.split("/"));
      const stat = fs.statSync(extracted);
      assert.ok(stat.isFile(), `required Spring Tools file is regular: ${entry.path}`);
      assert.equal(sha256File(extracted), entry.sha256, `required Spring Tools SHA-256: ${entry.path}`);
      evidence.springTools.requiredFiles.push({ path: entry.path, sha256: entry.sha256 });
    }

    fs.mkdirSync(path.dirname(documentPath), { recursive: true });
    fs.writeFileSync(documentPath, "ser\n", "utf8");

    const serverPath = path.join(extractionRoot, ...serverEntry.path.split("/"));
    child = spawn(javaTool("java"), springArguments(serverPath, null), {
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
    const client = new LspClient(child, [{ uri: workspaceUri, name: "runtime-smoke" }]);
    const initialize = await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "zed-spring-tools-ci", version: "1" },
      rootUri: workspaceUri,
      workspaceFolders: [{ uri: workspaceUri, name: "runtime-smoke" }],
      capabilities: {
        workspace: {
          configuration: true,
          applyEdit: true,
          workspaceFolders: true,
          executeCommand: { dynamicRegistration: true },
          symbol: { dynamicRegistration: true },
          didChangeConfiguration: { dynamicRegistration: true },
        },
        textDocument: {
          synchronization: { dynamicRegistration: false },
          publishDiagnostics: {},
          completion: { dynamicRegistration: true, completionItem: { snippetSupport: false } },
          hover: { dynamicRegistration: true, contentFormat: ["markdown", "plaintext"] },
        },
        window: { showMessage: {}, workDoneProgress: true },
      },
      initializationOptions: { enableJdtClasspath: false },
    });

    assert.ok(initialize && typeof initialize === "object", "Spring LS initialize result");
    assert.ok(initialize.capabilities && typeof initialize.capabilities === "object", "Spring LS capabilities");
    evidence.lsp.initializeCapabilityKeys = Object.keys(initialize.capabilities).sort();

    client.notify("initialized", {});
    const documentUri = pathToFileURL(documentPath).href;
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: documentUri,
        languageId: "spring-boot-properties",
        version: 1,
        text: fs.readFileSync(documentPath, "utf8"),
      },
    });

    // These calls deliberately do not claim metadata-aware completion without a
    // JDT classpath. Their purpose is to prove that the real pinned Spring server
    // starts with the production JVM vector and serves the real Properties LSP
    // handlers on every native CI tuple.
    const completion = await client.request("textDocument/completion", {
      textDocument: { uri: documentUri },
      position: { line: 0, character: 3 },
    });
    evidence.lsp.completion = summarizeCollectionResult(completion);

    const hover = await client.request("textDocument/hover", {
      textDocument: { uri: documentUri },
      position: { line: 0, character: 1 },
    });
    evidence.lsp.hover = summarizeValue(hover);
    evidence.lsp.serverRequests = client.serverRequests;
    evidence.lsp.stdoutContamination = client.stdoutContamination;
    assert.equal(client.stdoutContamination.length, 0, "Spring LS must not contaminate LSP stdout");

    await client.request("shutdown", null, 30_000);
    client.notify("exit", null);
    if (await waitForExit(child, 1_500)) {
      evidence.lsp.exitMode = "lsp-exit";
    } else {
      child.kill();
      assert.equal(await waitForExit(child, 5_000), true, "Spring LS terminates when its owner kills it");
      evidence.lsp.exitMode = "owner-kill";
    }

    evidence.status = "pass";
    evidence.finishedAt = new Date().toISOString();
    evidence.stderrTail = tailLines(stderr, 40);
    writeEvidence(evidencePath, evidence);
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } catch (error) {
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    evidence.status = "fail";
    evidence.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    evidence.finishedAt = new Date().toISOString();
    evidence.stderrTail = tailLines(stderr, 80);
    writeEvidence(evidencePath, evidence);
    throw error;
  } finally {
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
}

function serverRequestResult(method, params, workspaceFolders) {
  if (method === "workspace/configuration") return (params?.items ?? []).map(() => ({}));
  if (method === "workspace/workspaceFolders") return workspaceFolders;
  if (method === "workspace/applyEdit") return { applied: false };
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

function summarizeCollectionResult(value) {
  if (value === null || value === undefined) return { kind: "null", count: 0 };
  if (Array.isArray(value)) return { kind: "array", count: value.length };
  if (Array.isArray(value.items)) return { kind: "completion-list", count: value.items.length };
  return { kind: typeof value, count: null };
}

function summarizeValue(value) {
  if (value === null || value === undefined) return { kind: "null" };
  if (Array.isArray(value)) return { kind: "array", count: value.length };
  return { kind: typeof value };
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

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}: ${combined}`);
  }
  return combined;
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