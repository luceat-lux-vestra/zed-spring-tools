import {
  appendFileSync,
  mkdirSync,
} from "node:fs";
import { dirname } from "node:path";

const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
const HEADER_SEPARATOR = Buffer.from("\r\n\r\n", "ascii");

const logPath = parseLogPath(process.argv.slice(2));
mkdirSync(dirname(logPath), { recursive: true });

let input = Buffer.alloc(0);
let sequence = 0;
let shutdownRequested = false;
let exitNotificationReceived = false;

record("process", {
  event: "start",
  pid: process.pid,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
});

process.stdin.on("data", (chunk) => {
  input = Buffer.concat([input, chunk]);
  consumeMessages();
});

process.stdin.on("end", () => {
  if (!exitNotificationReceived) {
    record("process", { event: "unexpected_eof", pid: process.pid });
    process.exitCode = 1;
  }
});

process.stdin.on("error", (error) => fail("stdin_error", error));

process.on("uncaughtException", (error) => fail("uncaught_exception", error));

process.on("exit", (code) => {
  record("process", {
    event: "stop",
    pid: process.pid,
    code,
    graceful: shutdownRequested && exitNotificationReceived,
  });
});

function parseLogPath(args) {
  if (args.length !== 2 || args[0] !== "--log" || args[1].length === 0) {
    process.stderr.write("usage: probe_server.mjs --log <jsonl-path>\n");
    process.exit(2);
  }
  return args[1];
}

function consumeMessages() {
  while (true) {
    const headerEnd = input.indexOf(HEADER_SEPARATOR);
    if (headerEnd === -1) {
      if (input.length > MAX_MESSAGE_BYTES) {
        throw new Error("LSP header exceeds maximum size");
      }
      return;
    }

    const header = input.subarray(0, headerEnd).toString("ascii");
    const contentLength = parseContentLength(header);
    const bodyStart = headerEnd + HEADER_SEPARATOR.length;
    const bodyEnd = bodyStart + contentLength;

    if (input.length < bodyEnd) {
      return;
    }

    const body = input.subarray(bodyStart, bodyEnd).toString("utf8");
    input = input.subarray(bodyEnd);
    handleMessage(JSON.parse(body));
  }
}

function parseContentLength(header) {
  const match = /^Content-Length:\s*(\d+)\s*$/im.exec(header);
  if (!match) {
    throw new Error("missing Content-Length header");
  }

  const length = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MESSAGE_BYTES) {
    throw new Error("invalid Content-Length header");
  }
  return length;
}

function handleMessage(message) {
  const method = typeof message.method === "string" ? message.method : null;
  const hasId = Object.hasOwn(message, "id");

  record("in", {
    kind: method === null ? "response" : hasId ? "request" : "notification",
    method,
    id: hasId ? message.id : null,
  });

  if (method === "initialize" && hasId) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        capabilities: { textDocumentSync: 1 },
        serverInfo: { name: "S001 Lifecycle Probe", version: "0.0.1" },
      },
    });
    return;
  }

  if (method === "shutdown" && hasId) {
    shutdownRequested = true;
    send({ jsonrpc: "2.0", id: message.id, result: null });
    return;
  }

  if (method === "exit" && !hasId) {
    exitNotificationReceived = true;
    const exitCode = shutdownRequested ? 0 : 1;
    process.stdout.write("", () => process.exit(exitCode));
    return;
  }

  if (method !== null && hasId) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: "Method not found" },
    });
  }
}

function send(message) {
  const body = JSON.stringify(message);
  const bodyLength = Buffer.byteLength(body, "utf8");
  record("out", {
    kind: Object.hasOwn(message, "error") ? "error" : "response",
    id: Object.hasOwn(message, "id") ? message.id : null,
  });
  process.stdout.write(`Content-Length: ${bodyLength}\r\n\r\n${body}`);
}

function record(direction, fields) {
  const entry = {
    time: new Date().toISOString(),
    sequence: ++sequence,
    direction,
    ...fields,
  };
  appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function fail(event, error) {
  record("process", {
    event,
    pid: process.pid,
    errorType: error?.name ?? "Error",
  });
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
}
