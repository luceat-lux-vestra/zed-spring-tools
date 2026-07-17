import { timingSafeEqual } from "node:crypto";
import http from "node:http";

const MAX_BODY = 1024 * 1024;
const EVENT_KEYS = [
  "arguments",
  "callbackId",
  "requestId",
  "schemaVersion",
  "worktreeId",
];

export class BridgeEventRoute {
  constructor({ credential, worktreeId, callbackId, onEvent }) {
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(credential ?? "")) {
      throw new Error("credential is invalid");
    }
    if (!/^[0-9a-f]{64}$/.test(worktreeId ?? "")) {
      throw new Error("worktreeId is invalid");
    }
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(callbackId ?? "")) {
      throw new Error("callbackId is invalid");
    }
    if (typeof onEvent !== "function") {
      throw new Error("onEvent is required");
    }
    this.credential = credential;
    this.worktreeId = worktreeId;
    this.callbackId = callbackId;
    this.onEvent = onEvent;
    this.server = undefined;
  }

  async start() {
    if (this.server !== undefined) {
      throw new Error("bridge event route is already started");
    }
    this.server = http.createServer((request, response) => {
      this.#handle(request, response).catch(() => {
        if (!response.headersSent) {
          sendJson(response, 500, { error: "bridge-event-failed" });
        } else {
          response.destroy();
        }
      });
    });
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", resolve);
    });
    const address = this.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("bridge event route has no TCP address");
    }
    return "http://127.0.0.1:" + address.port + "/v1/classpath";
  }

  async close() {
    const server = this.server;
    this.server = undefined;
    if (server === undefined) {
      return;
    }
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  async #handle(request, response) {
    request.setTimeout(3000, () => response.destroy());
    if (request.method !== "POST" || request.url !== "/v1/classpath") {
      sendJson(response, 404, { error: "not-found" });
      return;
    }
    const authorization = request.headers.authorization ?? "";
    const expected = "Bearer " + this.credential;
    if (!safeEqual(authorization, expected)) {
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }
    if (request.headers["x-zed-spring-worktree"] !== this.worktreeId) {
      sendJson(response, 409, { error: "worktree-mismatch" });
      return;
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY) {
        sendJson(response, 413, { error: "body-too-large" });
        request.destroy();
        return;
      }
      chunks.push(chunk);
    }

    let event;
    try {
      event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      sendJson(response, 400, { error: "invalid-json" });
      return;
    }
    const keys =
      event !== null && typeof event === "object" && !Array.isArray(event)
        ? Object.keys(event).sort()
        : [];
    if (JSON.stringify(keys) !== JSON.stringify(EVENT_KEYS)) {
      sendJson(response, 400, { error: "invalid-schema" });
      return;
    }
    if (
      event.schemaVersion !== 1 ||
      !Number.isSafeInteger(event.requestId) ||
      event.requestId <= 0 ||
      event.callbackId !== this.callbackId ||
      event.worktreeId !== this.worktreeId ||
      !Array.isArray(event.arguments) ||
      event.arguments.length !== 6
    ) {
      sendJson(response, 409, { error: "event-mismatch" });
      return;
    }

    const result = await this.onEvent(event.arguments);
    sendJson(response, 200, { result });
  }
}

function safeEqual(actual, expected) {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

function sendJson(response, status, body) {
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": encoded.length,
  });
  response.end(encoded);
}
