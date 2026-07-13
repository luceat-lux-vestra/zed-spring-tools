"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
const HEADER_SEPARATOR = Buffer.from("\r\n\r\n", "ascii");

function runServer(args) {
  const logPath = parseLogPath(args);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  let sequence = 0;
  let shutdownRequested = false;
  let exitNotificationReceived = false;

  const record = (direction, fields) => {
    const entry = {
      time: new Date().toISOString(),
      sequence: ++sequence,
      direction,
      ...fields,
    };
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  };

  const send = (message) => {
    const body = JSON.stringify(message);
    record("out", {
      kind: Object.hasOwn(message, "error") ? "error" : "response",
      id: Object.hasOwn(message, "id") ? message.id : null,
    });
    process.stdout.write(frame(body));
  };

  const parser = new FrameParser((message) => {
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
          serverInfo: { name: "S004 Spring JDT Injector Probe", version: "0.0.1" },
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
      process.stdout.write("", () => process.exit(shutdownRequested ? 0 : 1));
      return;
    }
    if (method !== null && hasId) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: "Method not found" },
      });
    }
  });

  record("process", {
    event: "start",
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  });

  process.stdin.on("data", (chunk) => parser.push(chunk));
  process.stdin.on("end", () => {
    if (!exitNotificationReceived) {
      record("process", { event: "unexpected_eof", pid: process.pid });
      process.exitCode = 1;
    }
  });
  process.stdin.on("error", (error) => fail(record, "stdin_error", error));
  process.on("uncaughtException", (error) => fail(record, "uncaught_exception", error));
  process.on("exit", (code) => {
    record("process", {
      event: "stop",
      pid: process.pid,
      code,
      graceful: shutdownRequested && exitNotificationReceived,
    });
  });
}

class FrameParser {
  constructor(onMessage) {
    this.input = Buffer.alloc(0);
    this.onMessage = onMessage;
  }

  push(chunk) {
    this.input = Buffer.concat([this.input, chunk]);
    while (true) {
      const headerEnd = this.input.indexOf(HEADER_SEPARATOR);
      if (headerEnd === -1) {
        if (this.input.length > MAX_MESSAGE_BYTES) {
          throw new Error("LSP header exceeds maximum size");
        }
        return;
      }

      const header = this.input.subarray(0, headerEnd).toString("ascii");
      const contentLength = parseContentLength(header);
      const bodyStart = headerEnd + HEADER_SEPARATOR.length;
      const bodyEnd = bodyStart + contentLength;
      if (this.input.length < bodyEnd) {
        return;
      }

      const body = this.input.subarray(bodyStart, bodyEnd).toString("utf8");
      this.input = this.input.subarray(bodyEnd);
      this.onMessage(JSON.parse(body));
    }
  }
}

function parseLogPath(args) {
  if (args.length !== 2 || args[0] !== "--log" || args[1].length === 0) {
    process.stderr.write("usage: lifecycle_probe.js --log <jsonl-path>\n");
    process.exit(2);
  }
  return args[1];
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

function frame(body) {
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function selfTest() {
  const messages = [];
  const parser = new FrameParser((message) => messages.push(message));
  const first = frame(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }));
  const second = frame(JSON.stringify({ jsonrpc: "2.0", method: "exit" }));
  const combined = Buffer.from(first + second, "utf8");
  parser.push(combined.subarray(0, 9));
  parser.push(combined.subarray(9, first.length + 3));
  parser.push(combined.subarray(first.length + 3));

  requireCondition(messages.length === 2, "split and adjacent frames were not parsed");
  requireCondition(messages[0].method === "initialize", "initialize frame changed");
  requireCondition(messages[1].method === "exit", "exit frame changed");
  requireCondition(
    parseContentLength("Content-Length: 12\r\n") === 12,
    "content length parser changed",
  );
  let rejected = false;
  try {
    parseContentLength("Other: 12\r\n");
  } catch {
    rejected = true;
  }
  requireCondition(rejected, "missing Content-Length was accepted");
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fail(record, event, error) {
  record("process", {
    event,
    pid: process.pid,
    errorType: error?.name ?? "Error",
  });
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
}

if (process.argv.length === 3 && process.argv[2] === "--self-test") {
  selfTest();
  process.stdout.write("S004 lifecycle probe self-test passed\n");
} else {
  runServer(process.argv.slice(2));
}
