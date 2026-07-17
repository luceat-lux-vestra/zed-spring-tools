#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BridgeSession } from "./bridge_session.mjs";
import { JavaTransport } from "./java_transport.mjs";
import { LspDecoder, encodeLsp, errorFor, isRequest, responseFor } from "./lsp.mjs";

const ADD_CLASSPATH = "sts/addClasspathListener";
const REMOVE_CLASSPATH = "sts/removeClasspathListener";
const EXECUTE_CLIENT_COMMAND = "workspace/executeClientCommand";
const CALLBACK_ID = /^[A-Za-z0-9._-]{1,128}$/;
const REQUEST_TIMEOUT_MS = 10_000;
const JAVA_ROUTE_TIMEOUT_MS = 30_000;
const SERVER_JAR = "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";

export class Coordinator {
  constructor({ sendSpring, sendZed, javaTransport, worktree, requestTimeoutMs = REQUEST_TIMEOUT_MS }) {
    this.sendSpring = sendSpring;
    this.sendZed = sendZed;
    this.javaTransport = javaTransport;
    this.worktree = worktree;
    this.requestTimeoutMs = requestTimeoutMs;
    this.pending = new Map();
    this.session = undefined;
    this.sequence = 0;
    this.sessionId = randomUUID();
    this.javaFailureShown = false;
  }

  async handleSpringMessage(message) {
    const pendingKey = responseKey(message);
    if (pendingKey !== null && this.pending.has(pendingKey)) {
      this.#settlePending(pendingKey, message);
      return;
    }

    if (!isRequest(message)) {
      this.sendZed(encodeLsp(message));
      return;
    }

    if (message.method === ADD_CLASSPATH) {
      await this.#answer(message, () => this.#addClasspath(message.params));
      return;
    }
    if (message.method === REMOVE_CLASSPATH) {
      await this.#answer(message, () => this.#removeClasspath(message.params));
      return;
    }
    if (this.javaTransport.supportsSpringClientMethod(message.method)) {
      await this.#answer(message, async () => {
        try {
          return await this.javaTransport.executeSpringClientMethod(message.method, message.params);
        } catch (error) {
          this.#showJavaFailure();
          throw error;
        }
      });
      return;
    }

    this.sendZed(encodeLsp(message));
  }

  requestSpring(method, params) {
    const id = `zed-spring-tools:${this.sessionId}:${++this.sequence}`;
    const key = idKey(id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        this.sendSpring(
          encodeLsp({ jsonrpc: "2.0", method: "$/cancelRequest", params: { id } }),
        );
        reject(new Error("Spring Tools request timed out"));
      }, this.requestTimeoutMs);
      timer.unref?.();
      this.pending.set(key, { resolve, reject, timer });
      this.sendSpring(encodeLsp({ jsonrpc: "2.0", id, method, params }));
    });
  }

  async close() {
    const session = this.session;
    this.session = undefined;
    if (session !== undefined) await session.close();
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Spring Tools coordinator stopped"));
    }
    this.pending.clear();
  }

  async #addClasspath(params) {
    if (
      !hasExactKeys(params, ["batched", "callbackCommandId"]) ||
      params.batched !== true ||
      !CALLBACK_ID.test(params.callbackCommandId ?? "") ||
      this.session !== undefined
    ) {
      throw new Error("Spring classpath listener registration is invalid");
    }
    const session = new BridgeSession({
      transport: this.javaTransport,
      worktree: this.worktree,
      callbackId: params.callbackCommandId,
      sendClasspathToSpring: async (arguments_) =>
        await this.requestSpring(EXECUTE_CLIENT_COMMAND, {
          command: params.callbackCommandId,
          arguments: structuredClone(arguments_),
        }),
    });
    try {
      await session.open();
      this.session = session;
      return "ok";
    } catch (error) {
      this.#showJavaFailure();
      await session.close().catch(() => {});
      throw error;
    }
  }

  async #removeClasspath(params) {
    const callbackId = removalCallbackId(params);
    if (callbackId === undefined || this.session?.callbackId !== callbackId) {
      throw new Error("Spring classpath listener removal is invalid");
    }
    const session = this.session;
    await session.close();
    this.session = undefined;
    return "ok";
  }

  async #answer(request, operation) {
    try {
      this.sendSpring(encodeLsp(responseFor(request, await operation())));
    } catch (error) {
      const message = error instanceof Error ? error.message : "coordination failed";
      this.sendSpring(encodeLsp(errorFor(request, message)));
    }
  }

  #settlePending(key, message) {
    const pending = this.pending.get(key);
    this.pending.delete(key);
    clearTimeout(pending.timer);
    if (Object.hasOwn(message, "result")) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error("Spring Tools rejected an internal callback"));
    }
  }

  #showJavaFailure() {
    if (this.javaFailureShown) return;
    this.javaFailureShown = true;
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        method: "window/showMessage",
        params: {
          type: 1,
          message:
            "Zed Spring Tools requires the official Java extension 6.8.21 and a JDK 21 or newer.",
        },
      }),
    );
  }
}

export function parseOptions(arguments_) {
  const fields = [
    ["--worktree", "worktree"],
    ["--java", "java"],
    ["--spring-server", "springServer"],
    ["--spring-home", "springHome"],
    ["--java-work-dir", "javaWorkDirectory"],
    ["--compatibility", "compatibility"],
    ["--host-os", "hostOs"],
  ];
  if (arguments_.length !== fields.length * 2) {
    throw new Error("coordinator arguments do not match the product contract");
  }
  const values = {};
  for (let index = 0; index < fields.length; index += 1) {
    const [flag, name] = fields[index];
    const value = arguments_[index * 2 + 1];
    if (arguments_[index * 2] !== flag || typeof value !== "string" || value.length === 0) {
      throw new Error(`missing required coordinator argument ${flag}`);
    }
    values[name] = name === "hostOs" ? value : path.resolve(value);
  }
  if (!new Set(["macos", "linux", "windows"]).has(values.hostOs)) {
    throw new Error("coordinator host OS is invalid");
  }
  return values;
}

export function sanitizedEnvironment(environment) {
  const allowed = [
    "PATH",
    "JAVA_HOME",
    "HOME",
    "USER",
    "USERNAME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "NO_PROXY",
    "no_proxy",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "SYSTEMROOT",
    "WINDIR",
  ];
  return Object.fromEntries(
    allowed.filter((name) => environment[name] !== undefined).map((name) => [name, environment[name]]),
  );
}

export function javaMajor(versionOutput) {
  const match = versionOutput.match(/(?:java|openjdk) version "([0-9]+)(?:\.([0-9]+))?/i);
  if (match === null) throw new Error("Java version output is not recognized");
  const first = Number.parseInt(match[1], 10);
  return first === 1 ? Number.parseInt(match[2] ?? "0", 10) : first;
}

export function validateCompatibility(value) {
  const provider = value?.schemaVersion === 1 && value.providers?.length === 1
    ? value.providers[0]
    : undefined;
  if (
    provider?.id !== "zed-java" ||
    provider.extensionVersion !== "6.8.21" ||
    provider.targetLanguageServerId !== "jdtls" ||
    provider.workDirectoryId !== "java" ||
    provider.route?.kind !== "utf8-worktree-hex-v1" ||
    provider.route?.directory !== "proxy" ||
    provider.route?.transport !== "loopback-http-json" ||
    provider.bridge?.schemaVersion !== 1 ||
    provider.bridge?.addCommand !== "zed.spring.bridge.v1.addClasspathListener" ||
    provider.bridge?.removeCommand !== "zed.spring.bridge.v1.removeClasspathListener"
  ) {
    throw new Error("official Java compatibility contract is invalid");
  }
  return provider;
}

export async function run(arguments_, dependencies = {}) {
  const options = parseOptions(arguments_);
  requireDirectory(options.worktree, "worktree");
  requireFile(options.java, "Java executable");
  requireFile(options.springServer, "Spring Tools server");
  requireDirectory(options.springHome, "Spring Tools home");
  requireFile(options.compatibility, "Java compatibility contract");
  if (path.basename(options.springServer) !== SERVER_JAR) {
    throw new Error("Spring Tools server artifact does not match the pinned release");
  }
  validateCompatibility(JSON.parse(fs.readFileSync(options.compatibility, "utf8")));

  const environment = sanitizedEnvironment(process.env);
  const version = (dependencies.spawnSync ?? spawnSync)(options.java, ["-version"], {
    encoding: "utf8",
    env: environment,
    shell: false,
    timeout: 5000,
  });
  if (version.error !== undefined || version.status !== 0) {
    throw new Error("JDK version check failed; configure a working JDK 21 or newer");
  }
  if (javaMajor(`${version.stdout ?? ""}\n${version.stderr ?? ""}`) < 21) {
    throw new Error("JDK 21 or newer is required by Spring Tools");
  }

  const child = (dependencies.spawn ?? spawn)(options.java, springArguments(options.springServer), {
    cwd: options.worktree,
    env: environment,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.pipe(process.stderr);
  process.stdin.pipe(child.stdin);

  const coordinator = new Coordinator({
    sendSpring: (bytes) => child.stdin.write(bytes),
    sendZed: (bytes) => process.stdout.write(bytes),
    javaTransport: new JavaTransport({
      javaWorkDirectory: options.javaWorkDirectory,
      worktree: options.worktree,
      timeoutMs: JAVA_ROUTE_TIMEOUT_MS,
    }),
    worktree: options.worktree,
  });
  const decoder = new LspDecoder();
  let handling = Promise.resolve();
  let stopping = false;

  const stop = async (killChild) => {
    if (stopping) return;
    stopping = true;
    await handling.catch(() => {});
    await coordinator.close().catch(() => {
      process.exitCode = 1;
    });
    if (killChild && child.exitCode === null) child.kill();
  };

  child.stdout.on("data", (chunk) => {
    try {
      for (const message of decoder.push(chunk)) {
        handling = handling.then(() => coordinator.handleSpringMessage(message));
      }
      handling.catch(() => child.kill());
    } catch {
      process.exitCode = 1;
      child.kill();
    }
  });
  child.once("error", () => {
    process.exitCode = 1;
    void stop(false);
  });
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) process.exitCode = code;
    void stop(false).finally(() => process.stdin.destroy());
  });
  process.once("SIGTERM", () => void stop(true));
  process.once("SIGINT", () => void stop(true));
  return { child, coordinator, stop };
}

function springArguments(server) {
  return [
    "-Xmx1024m",
    "-Dspring.config.location=classpath:/application.properties",
    "-Djdk.util.zip.disableZip64ExtraFieldValidation=true",
    "-Dspring.main.web-application-type=NONE",
    "-Xlog:jni+resolve=off",
    "-jar",
    server,
  ];
}

function requireFile(file, label) {
  if (!path.isAbsolute(file) || !fs.statSync(file).isFile()) {
    throw new Error(`${label} is not an absolute regular file`);
  }
}

function requireDirectory(directory, label) {
  if (!path.isAbsolute(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`${label} is not an absolute directory`);
  }
}

function removalCallbackId(params) {
  if (hasExactKeys(params, ["callbackCommandId"])) return params.callbackCommandId;
  if (hasExactKeys(params, ["batched", "callbackCommandId"]) && params.batched === false) {
    return params.callbackCommandId;
  }
  return undefined;
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function responseKey(message) {
  if (
    message === null ||
    typeof message !== "object" ||
    message.method !== undefined ||
    !Object.hasOwn(message, "id")
  ) {
    return null;
  }
  return idKey(message.id);
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`zed-spring-tools coordinator failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
