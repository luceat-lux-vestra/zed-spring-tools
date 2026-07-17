import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { BRIDGE_ADD, BRIDGE_REMOVE } from "./java_transport.mjs";

const MAX_BODY_BYTES = 1024 * 1024;

export class BridgeSession {
  constructor({ transport, worktree, callbackId, sendClasspathToSpring }) {
    if (typeof sendClasspathToSpring !== "function") throw new Error("Spring callback is required");
    this.transport = transport;
    this.worktreeId = createHash("sha256").update(worktree).digest("hex");
    this.callbackId = callbackId;
    this.credential = randomBytes(32).toString("base64url");
    this.sendClasspathToSpring = sendClasspathToSpring;
    this.server = undefined;
    this.registration = undefined;
  }

  async open() {
    if (this.server !== undefined) throw new Error("bridge session is already open");
    this.server = http.createServer((request, response) => {
      this.#handle(request, response).catch(() => sendJson(response, 500, { error: "callback-failed" }));
    });
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", resolve);
    });
    const address = this.server.address();
    if (address === null || typeof address === "string") throw new Error("bridge route has no address");
    this.registration = Object.freeze({
      schemaVersion: 1,
      callbackId: this.callbackId,
      endpoint: `http://127.0.0.1:${address.port}/v1/classpath`,
      credential: this.credential,
      worktreeId: this.worktreeId,
      batched: false,
    });
    try {
      const result = await this.transport.execute(BRIDGE_ADD, [this.registration]);
      if (result !== "ok") throw new Error("bridge registration returned an unexpected result");
    } catch (error) {
      await this.#closeServer();
      this.registration = undefined;
      throw error;
    }
  }

  async close() {
    const registration = this.registration;
    this.registration = undefined;
    let removalError;
    if (registration !== undefined) {
      try {
        const result = await this.transport.execute(BRIDGE_REMOVE, [registration]);
        if (result !== "ok") throw new Error("bridge removal returned an unexpected result");
      } catch (error) {
        removalError = error;
      }
    }
    await this.#closeServer();
    if (removalError !== undefined) throw removalError;
  }

  async #closeServer() {
    const server = this.server;
    this.server = undefined;
    if (server === undefined) return;
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  async #handle(request, response) {
    request.setTimeout(3000, () => response.destroy());
    if (request.method !== "POST" || request.url !== "/v1/classpath") {
      sendJson(response, 404, { error: "not-found" });
      return;
    }
    if (!constantEqual(request.headers.authorization ?? "", `Bearer ${this.credential}`)) {
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
      if (size > MAX_BODY_BYTES) {
        sendJson(response, 413, { error: "body-too-large" });
        request.destroy();
        return;
      }
      chunks.push(chunk);
    }
    const event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const keys = Object.keys(event ?? {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["arguments", "callbackId", "requestId", "schemaVersion", "worktreeId"])) {
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
    await this.sendClasspathToSpring(event.arguments);
    sendJson(response, 200, { result: "ok" });
  }
}

function constantEqual(actual, expected) {
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendJson(response, status, body) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  response.writeHead(status, { "Content-Type": "application/json", "Content-Length": encoded.length });
  response.end(encoded);
}
