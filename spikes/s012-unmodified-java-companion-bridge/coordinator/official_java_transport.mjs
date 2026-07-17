import { constants } from "node:fs";
import { open } from "node:fs/promises";
import http from "node:http";

export const ADD_COMMAND = "zed.spring.bridge.addClasspathListener";
export const REMOVE_COMMAND = "zed.spring.bridge.removeClasspathListener";

const ALLOWED_COMMANDS = new Set([ADD_COMMAND, REMOVE_COMMAND]);

export class OfficialJavaTransport {
  constructor({ portFile, timeoutMs = 1500 }) {
    if (typeof portFile !== "string" || portFile.length === 0) {
      throw new Error("portFile is required");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 5000) {
      throw new Error("timeoutMs is outside the allowed range");
    }
    this.portFile = portFile;
    this.timeoutMs = timeoutMs;
  }

  async executeBridgeCommand(command, registration) {
    if (!ALLOWED_COMMANDS.has(command)) {
      throw new Error("Java transport rejected a non-allowlisted command");
    }
    validateRegistrationShape(registration);
    const port = await readPort(this.portFile);
    return postJson({
      port,
      timeoutMs: this.timeoutMs,
      body: {
        method: "workspace/executeCommand",
        params: {
          command,
          arguments: [registration],
        },
      },
    });
  }
}

async function readPort(portFile) {
  let handle;
  try {
    handle = await open(portFile, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw new Error("Java proxy port record could not be opened safely");
  }
  let raw;
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new Error("Java proxy port record is not a regular file");
    }
    raw = (await handle.readFile("utf8")).trim();
  } finally {
    await handle.close();
  }
  if (!/^[1-9][0-9]{0,4}$/.test(raw)) {
    throw new Error("Java proxy port record is invalid");
  }
  const port = Number.parseInt(raw, 10);
  if (port > 65535) {
    throw new Error("Java proxy port record is invalid");
  }
  return port;
}

function validateRegistrationShape(registration) {
  if (
    registration === null ||
    typeof registration !== "object" ||
    Array.isArray(registration)
  ) {
    throw new Error("bridge registration must be an object");
  }
  const expected = [
    "batched",
    "callbackId",
    "credential",
    "endpoint",
    "schemaVersion",
    "worktreeId",
  ];
  const actual = Object.keys(registration).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("bridge registration keys do not match schema");
  }
  if (
    registration.schemaVersion !== 1 ||
    registration.batched !== false ||
    !/^[A-Za-z0-9._-]{1,128}$/.test(registration.callbackId ?? "") ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(registration.credential ?? "") ||
    !/^[0-9a-f]{64}$/.test(registration.worktreeId ?? "") ||
    !isLoopbackClasspathEndpoint(registration.endpoint)
  ) {
    throw new Error("bridge registration values do not match schema");
  }
}

function isLoopbackClasspathEndpoint(endpoint) {
  if (typeof endpoint !== "string") {
    return false;
  }
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) &&
    parsed.port !== "" &&
    parsed.pathname === "/v1/classpath" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.search === "" &&
    parsed.hash === ""
  );
}

function postJson({ port, timeoutMs, body }) {
  return new Promise((resolve, reject) => {
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
            request.destroy(new Error("Java proxy response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error("Java proxy returned HTTP " + response.statusCode));
            return;
          }
          let envelope;
          try {
            envelope = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            reject(new Error("Java proxy returned invalid JSON"));
            return;
          }
          if (envelope?.error !== undefined && envelope.error !== null) {
            reject(new Error("Java proxy returned a JSON-RPC error"));
            return;
          }
          if (!Object.hasOwn(envelope ?? {}, "result")) {
            reject(new Error("Java proxy response has no result"));
            return;
          }
          resolve(envelope.result);
        });
      },
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Java proxy request timed out"));
    });
    request.on("error", reject);
    request.end(encoded);
  });
}
