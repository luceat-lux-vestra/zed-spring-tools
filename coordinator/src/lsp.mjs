const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

export class LspDecoder {
  #buffer = Buffer.alloc(0);

  push(chunk) {
    this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);
    const messages = [];
    while (true) {
      const separator = this.#buffer.indexOf("\r\n\r\n");
      if (separator < 0) break;
      const header = this.#buffer.subarray(0, separator).toString("ascii");
      const lengths = header
        .split("\r\n")
        .filter((line) => /^content-length:/i.test(line));
      if (lengths.length !== 1) throw new Error("LSP frame has invalid Content-Length headers");
      const rawLength = lengths[0].split(":", 2)[1]?.trim();
      if (!/^[0-9]+$/.test(rawLength ?? "")) throw new Error("LSP frame length is invalid");
      const length = Number.parseInt(rawLength, 10);
      if (!Number.isSafeInteger(length) || length > MAX_MESSAGE_BYTES) {
        throw new Error("LSP frame exceeds the message limit");
      }
      const frameLength = separator + 4 + length;
      if (this.#buffer.length < frameLength) break;
      const body = this.#buffer.subarray(separator + 4, frameLength).toString("utf8");
      this.#buffer = this.#buffer.subarray(frameLength);
      messages.push(JSON.parse(body));
    }
    if (this.#buffer.length > MAX_MESSAGE_BYTES + 8192) {
      throw new Error("LSP decoder buffer exceeds the limit");
    }
    return messages;
  }
}

export function encodeLsp(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_MESSAGE_BYTES) throw new Error("LSP message exceeds the limit");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"),
    body,
  ]);
}

export function isRequest(message) {
  return (
    message !== null &&
    typeof message === "object" &&
    Object.hasOwn(message, "id") &&
    typeof message.method === "string"
  );
}

export function responseFor(request, result) {
  return { jsonrpc: "2.0", id: request.id, result };
}

export function errorFor(request, message, code = -32001) {
  return { jsonrpc: "2.0", id: request.id, error: { code, message } };
}
