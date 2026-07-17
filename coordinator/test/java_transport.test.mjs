import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { JavaTransport, routeId } from "../src/java_transport.mjs";

test("official Java route ID is the normalized UTF-8 worktree hex", () => {
  assert.equal(routeId("/tmp/프로젝트/"), Buffer.from("/tmp/프로젝트").toString("hex"));
});

test("allowlisted Spring Java request uses the official loopback route", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-java-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = path.join(root, "work tree");
  const javaWork = path.join(root, "java");
  fs.mkdirSync(path.join(javaWork, "proxy"), { recursive: true });
  const received = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      received.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ result: { name: "Demo" } }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  fs.writeFileSync(
    path.join(javaWork, "proxy", routeId(worktree)),
    String(server.address().port),
  );

  const transport = new JavaTransport({ javaWorkDirectory: javaWork, worktree, timeoutMs: 1000 });
  assert.deepEqual(
    await transport.executeSpringClientMethod("sts/javaType", { typeName: "example.Demo" }),
    { name: "Demo" },
  );
  assert.deepEqual(received, [
    {
      method: "workspace/executeCommand",
      params: {
        command: "sts.java.type",
        arguments: [{ typeName: "example.Demo" }],
      },
    },
  ]);
  await assert.rejects(() => transport.execute("not.allowed", []));
});

test("an official Java error envelope surfaces the command and the real reason", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-java-err-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = path.join(root, "worktree");
  const javaWork = path.join(root, "java");
  fs.mkdirSync(path.join(javaWork, "proxy"), { recursive: true });
  const server = http.createServer((request, response) => {
    request.on("data", () => {});
    request.on("end", () => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "No delegateCommandHandler for zed.spring.bridge.v1.addClasspathListener" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  fs.writeFileSync(path.join(javaWork, "proxy", routeId(worktree)), String(server.address().port));

  const transport = new JavaTransport({ javaWorkDirectory: javaWork, worktree, timeoutMs: 1000 });
  await assert.rejects(
    () => transport.execute("zed.spring.bridge.v1.addClasspathListener", [{}]),
    (error) => {
      assert.match(error.message, /zed\.spring\.bridge\.v1\.addClasspathListener/);
      assert.match(error.message, /No delegateCommandHandler/);
      return true;
    },
  );
});

test("waiting for the official Java route is abortable during shutdown", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-java-abort-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const controller = new AbortController();
  const transport = new JavaTransport({
    javaWorkDirectory: path.join(root, "java"),
    worktree: path.join(root, "worktree"),
    timeoutMs: 10_000,
  });
  const waiting = transport.waitUntilReady({ signal: controller.signal });
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
});
