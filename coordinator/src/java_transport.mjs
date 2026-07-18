import { constants } from "node:fs";
import { open } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

export const BRIDGE_ADD = "zed.spring.bridge.v1.addClasspathListener";
export const BRIDGE_REMOVE = "zed.spring.bridge.v1.removeClasspathListener";

const SPRING_CLIENT_METHODS = new Map([
  ["sts/javaType", "sts.java.type"],
  ["sts/javadoc", "sts.java.javadoc"],
  ["sts/javadocHoverLink", "sts.java.javadocHoverLink"],
  ["sts/javaLocation", "sts.java.location"],
  ["sts/javaSearchTypes", "sts.java.search.types"],
  ["sts/javaSearchPackages", "sts.java.search.packages"],
  ["sts/javaSubTypes", "sts.java.hierarchy.subtypes"],
  ["sts/javaSuperTypes", "sts.java.hierarchy.supertypes"],
  ["sts/javaCodeComplete", "sts.java.code.completions"],
  ["sts/project/gav", "sts.project.gav"],
]);

const ALLOWED_COMMANDS = new Set([
  BRIDGE_ADD,
  BRIDGE_REMOVE,
  ...SPRING_CLIENT_METHODS.values(),
]);

export class JavaTransport {
  constructor({ javaWorkDirectory, worktree, timeoutMs = 5000 }) {
    this.timeoutMs = timeoutMs;
    this.portFile = path.join(javaWorkDirectory, "proxy", routeId(worktree));
  }

  async execute(command, arguments_, { signal, timeoutMs = this.timeoutMs } = {}) {
    if (!ALLOWED_COMMANDS.has(command) || !Array.isArray(arguments_)) {
      throw new Error("official Java transport rejected a non-allowlisted command");
    }
    const port = await waitForPort(this.portFile, timeoutMs, signal);
    return await postJson(port, timeoutMs, {
      method: "workspace/executeCommand",
      params: { command, arguments: structuredClone(arguments_) },
    }, signal);
  }

  async executeSpringClientMethod(method, params, options) {
    const command = SPRING_CLIENT_METHODS.get(method);
    if (command === undefined) throw new Error("unsupported Spring Java client method");
    return await this.execute(command, [structuredClone(params)], options);
  }

  supportsSpringClientMethod(method) {
    return SPRING_CLIENT_METHODS.has(method);
  }

  async waitUntilReady({ signal } = {}) {
    await waitForPort(this.portFile, this.timeoutMs, signal);
  }
}

export function routeId(worktree) {
  const normalized = path.resolve(worktree).replace(/[\\/]$/, "");
  return Buffer.from(normalized, "utf8").toString("hex");
}

async function waitForPort(file, timeoutMs, signal) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    try {
      return await readPort(file);
    } catch (error) {
      lastError = error;
      await delay(100, signal);
    }
  }
  throw new Error(
    "The official Zed Java extension is required and its compatible route was not found",
    { cause: lastError },
  );
}

async function readPort(file) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size < 1 || metadata.size > 5) {
      throw new Error("official Java route is not a bounded regular file");
    }
    const value = (await handle.readFile("utf8")).trim();
    if (!/^[1-9][0-9]{0,4}$/.test(value)) throw new Error("official Java route port is invalid");
    const port = Number.parseInt(value, 10);
    if (port > 65535) throw new Error("official Java route port is invalid");
    return port;
  } finally {
    await handle?.close();
  }
}

function postJson(port, timeoutMs, body, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const encoded = Buffer.from(JSON.stringify(body), "utf8");
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": encoded.length,
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            request.destroy(new Error("official Java response exceeds the limit"));
          } else {
            chunks.push(chunk);
          }
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`official Java returned HTTP ${response.statusCode}`));
            return;
          }
          try {
            const envelope = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (envelope?.error !== undefined && envelope.error !== null) {
              const command = body?.params?.command ?? "unknown";
              const detail =
                typeof envelope.error === "string"
                  ? envelope.error
                  : JSON.stringify(envelope.error);
              reject(new Error(`official Java rejected command ${command}: ${detail}`));
            } else if (!Object.hasOwn(envelope ?? {}, "result")) {
              reject(new Error("official Java response has no result"));
            } else {
              resolve(envelope.result);
            }
          } catch (error) {
            reject(new Error("official Java returned invalid JSON", { cause: error }));
          }
        });
      },
    );
    const abort = () => request.destroy(abortError());
    signal?.addEventListener("abort", abort, { once: true });
    request.once("close", () => signal?.removeEventListener("abort", abort));
    request.setTimeout(timeoutMs, () => request.destroy(new Error("official Java request timed out")));
    request.on("error", reject);
    request.end(encoded);
  });
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function abortError() {
  const error = new Error("official Java coordination stopped");
  error.name = "AbortError";
  return error;
}
