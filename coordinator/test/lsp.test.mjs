import assert from "node:assert/strict";
import test from "node:test";

import { LspDecoder, encodeLsp, errorFor, isRequest, responseFor } from "../src/lsp.mjs";

test("LSP frames survive arbitrary chunk boundaries", () => {
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", method: "initialized", params: {} },
  ];
  const bytes = Buffer.concat(messages.map(encodeLsp));
  const decoder = new LspDecoder();
  assert.deepEqual(decoder.push(bytes.subarray(0, 13)), []);
  assert.deepEqual(decoder.push(bytes.subarray(13)), messages);
});

test("request response helpers preserve IDs", () => {
  const request = { jsonrpc: "2.0", id: "spring-1", method: "sts/javaType" };
  assert.equal(isRequest(request), true);
  assert.deepEqual(responseFor(request, { name: "Demo" }), {
    jsonrpc: "2.0",
    id: "spring-1",
    result: { name: "Demo" },
  });
  assert.deepEqual(errorFor(request, "failed"), {
    jsonrpc: "2.0",
    id: "spring-1",
    error: { code: -32001, message: "failed" },
  });
});
