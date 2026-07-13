import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const probe = join(dirname(fileURLToPath(import.meta.url)), "probe_server.mjs");

test("records a complete graceful LSP lifecycle without document payloads", {
  timeout: 5_000,
}, async () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "s001-probe-"));
  const log = join(temporaryDirectory, "events.jsonl");

  try {
    const child = spawn(process.execPath, [probe, "--log", log], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { capabilities: {} },
      },
      { jsonrpc: "2.0", method: "initialized", params: {} },
      {
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri: "file:///not-recorded",
            languageId: "plaintext",
            version: 1,
            text: "must not appear in the event log",
          },
        },
      },
      { jsonrpc: "2.0", id: 2, method: "shutdown", params: null },
      { jsonrpc: "2.0", method: "exit" },
    ];
    child.stdin.end(Buffer.concat(messages.map(frame)));

    const [code] = await once(child, "close");
    assert.equal(code, 0, stderr);

    const responses = parseFrames(stdout);
    assert.deepEqual(responses.map((response) => response.id), [1, 2]);
    assert.equal(responses[0].result.serverInfo.name, "S001 Lifecycle Probe");
    assert.equal(responses[1].result, null);

    const events = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    const methods = events
      .filter((event) => event.direction === "in")
      .map((event) => event.method);
    assert.deepEqual(methods, [
      "initialize",
      "initialized",
      "textDocument/didOpen",
      "shutdown",
      "exit",
    ]);

    const stop = events.find((event) => event.event === "stop");
    assert.equal(stop?.graceful, true);
    assert.equal(events.some((event) => "params" in event), false);
    assert.equal(events.some((event) => "text" in event), false);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

function frame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"),
    body,
  ]);
}

function parseFrames(bytes) {
  const messages = [];
  while (bytes.length > 0) {
    const headerEnd = bytes.indexOf("\r\n\r\n");
    assert.notEqual(headerEnd, -1, "response has an incomplete LSP header");
    const header = bytes.subarray(0, headerEnd).toString("ascii");
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    assert.ok(match, "response is missing Content-Length");
    const bodyLength = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + bodyLength;
    assert.ok(bytes.length >= bodyEnd, "response has an incomplete LSP body");
    messages.push(JSON.parse(bytes.subarray(bodyStart, bodyEnd).toString("utf8")));
    bytes = bytes.subarray(bodyEnd);
  }
  return messages;
}
