import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { BridgeEventRoute } from "../coordinator/bridge_event_route.mjs";
import { CompanionBridgeSession } from "../coordinator/companion_bridge_session.mjs";
import {
  ADD_COMMAND,
  OfficialJavaTransport,
  REMOVE_COMMAND,
} from "../coordinator/official_java_transport.mjs";
import {
  SPRING_ADD_METHOD,
  SPRING_REMOVE_METHOD,
  SpringClasspathMapper,
} from "../coordinator/spring_classpath_mapper.mjs";

const CREDENTIAL = "A".repeat(43);
const WORKTREE_ID = "b".repeat(64);
const CALLBACK_ID = "spring-classpath-main";

function registration(endpoint = "http://127.0.0.1:54321/v1/classpath") {
  return {
    schemaVersion: 1,
    callbackId: CALLBACK_ID,
    endpoint,
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    batched: false,
  };
}

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  return { server, port: address.port };
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function requestJson(url, { token = CREDENTIAL, worktree = WORKTREE_ID, body }) {
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  const parsed = new URL(url);
  return await new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "X-Zed-Spring-Worktree": worktree,
          "Content-Type": "application/json",
          "Content-Length": encoded.length,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          });
        });
      },
    );
    request.on("error", reject);
    request.end(encoded);
  });
}

function event(overrides = {}) {
  return {
    schemaVersion: 1,
    requestId: 1,
    callbackId: CALLBACK_ID,
    worktreeId: WORKTREE_ID,
    arguments: ["uri", "name", ["bin"], ["src"], ["dep"], "java-21"],
    ...overrides,
  };
}

test("official Java transport sends only an allowlisted executeCommand envelope", async () => {
  let received;
  const { server, port } = await listen((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      received = {
        method: request.method,
        url: request.url,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ result: "registered" }));
    });
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), "s012-port-"));
  try {
    const portFile = path.join(directory, "official-proxy-port");
    await writeFile(portFile, String(port), "utf8");
    const transport = new OfficialJavaTransport({ portFile });
    assert.equal(
      await transport.executeBridgeCommand(ADD_COMMAND, registration()),
      "registered",
    );
    assert.deepEqual(received, {
      method: "POST",
      url: "/",
      body: {
        method: "workspace/executeCommand",
        params: {
          command: ADD_COMMAND,
          arguments: [registration()],
        },
      },
    });
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("official Java transport rejects commands, unsafe registration, and symlinked ports", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "s012-port-"));
  try {
    const realPortFile = path.join(directory, "real-port");
    const linkedPortFile = path.join(directory, "linked-port");
    await writeFile(realPortFile, "12345", "utf8");
    await symlink(realPortFile, linkedPortFile);
    const transport = new OfficialJavaTransport({ portFile: realPortFile });
    await assert.rejects(
      transport.executeBridgeCommand("workspace/executeCommand", registration()),
      /non-allowlisted/,
    );
    await assert.rejects(
      transport.executeBridgeCommand(
        REMOVE_COMMAND,
        registration("http://example.com:54321/v1/classpath"),
      ),
      /values do not match schema/,
    );
    const linked = new OfficialJavaTransport({ portFile: linkedPortFile });
    await assert.rejects(
      linked.executeBridgeCommand(ADD_COMMAND, registration()),
      /could not be opened safely/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("official Java transport redacts proxy errors and enforces timeout", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "s012-port-"));
  const { server, port } = await listen((_request, response) => {
    setTimeout(() => {
      if (!response.destroyed) {
        response.end(JSON.stringify({ error: { message: CREDENTIAL } }));
      }
    }, 250);
  });
  try {
    const portFile = path.join(directory, "official-proxy-port");
    await writeFile(portFile, String(port), "utf8");
    const transport = new OfficialJavaTransport({ portFile, timeoutMs: 100 });
    await assert.rejects(
      transport.executeBridgeCommand(ADD_COMMAND, registration()),
      (error) => {
        assert.match(error.message, /timed out/);
        assert.equal(error.message.includes(CREDENTIAL), false);
        return true;
      },
    );
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("official Java transport rejects malformed and JSON-RPC error responses", async () => {
  let requestCount = 0;
  const { server, port } = await listen((_request, response) => {
    requestCount += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    if (requestCount === 1) {
      response.end("not-json");
    } else {
      response.end(JSON.stringify({ error: { message: CREDENTIAL } }));
    }
  });
  const directory = await mkdtemp(path.join(os.tmpdir(), "s012-port-"));
  try {
    const portFile = path.join(directory, "official-proxy-port");
    await writeFile(portFile, String(port), "utf8");
    const transport = new OfficialJavaTransport({ portFile });
    await assert.rejects(
      transport.executeBridgeCommand(ADD_COMMAND, registration()),
      /invalid JSON/,
    );
    await assert.rejects(
      transport.executeBridgeCommand(ADD_COMMAND, registration()),
      (error) => {
        assert.match(error.message, /JSON-RPC error/);
        assert.equal(error.message.includes(CREDENTIAL), false);
        return true;
      },
    );
  } finally {
    await close(server);
    await rm(directory, { recursive: true, force: true });
  }
});

test("bridge event route authenticates and returns the coordinator result", async () => {
  let observed;
  const route = new BridgeEventRoute({
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    callbackId: CALLBACK_ID,
    onEvent: async (arguments_) => {
      observed = arguments_;
      return "forwarded";
    },
  });
  const endpoint = await route.start();
  try {
    const response = await requestJson(endpoint, { body: event() });
    assert.deepEqual(response, { status: 200, body: { result: "forwarded" } });
    assert.deepEqual(observed, event().arguments);
  } finally {
    await route.close();
    await route.close();
  }
});

test("bridge event route rejects wrong identity and malformed events without leaking secrets", async () => {
  let calls = 0;
  const route = new BridgeEventRoute({
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    callbackId: CALLBACK_ID,
    onEvent: async () => {
      calls += 1;
      return "unexpected";
    },
  });
  const endpoint = await route.start();
  try {
    const unauthorized = await requestJson(endpoint, {
      token: "Z".repeat(43),
      body: event(),
    });
    assert.deepEqual(unauthorized, {
      status: 401,
      body: { error: "unauthorized" },
    });
    const wrongWorktree = await requestJson(endpoint, {
      worktree: "c".repeat(64),
      body: event(),
    });
    assert.equal(wrongWorktree.status, 409);
    const malformed = await requestJson(endpoint, {
      body: event({ arguments: ["too", "short"] }),
    });
    assert.equal(malformed.status, 409);
    assert.equal(calls, 0);
    assert.equal(JSON.stringify([unauthorized, wrongWorktree, malformed]).includes(CREDENTIAL), false);
  } finally {
    await route.close();
  }
});

test("companion session registers, preserves the six arguments, and removes exactly", async () => {
  const commands = [];
  let observed;
  const transport = {
    async executeBridgeCommand(command, value) {
      commands.push({ command, value });
      return "ok";
    },
  };
  const session = new CompanionBridgeSession({
    transport,
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    callbackId: CALLBACK_ID,
    onClasspathEvent: async (arguments_) => {
      observed = arguments_;
      return "spring-result";
    },
  });
  await session.start();
  await assert.rejects(session.start(), /not idle/);
  const add = commands[0];
  assert.equal(add.command, ADD_COMMAND);
  const callback = await requestJson(add.value.endpoint, { body: event() });
  assert.deepEqual(callback, {
    status: 200,
    body: { result: "spring-result" },
  });
  assert.deepEqual(observed, event().arguments);
  await session.close();
  await session.close();
  assert.equal(commands.length, 2);
  assert.equal(commands[1].command, REMOVE_COMMAND);
  assert.deepEqual(commands[1].value, add.value);
  await assert.rejects(requestJson(add.value.endpoint, { body: event() }));
});

test("companion session closes its route when registration fails", async () => {
  let registration;
  let attempts = 0;
  const transport = {
    async executeBridgeCommand(_command, value) {
      registration = value;
      attempts += 1;
      if (attempts === 1) {
        throw new Error("synthetic registration failure");
      }
      return "ok";
    },
  };
  const session = new CompanionBridgeSession({
    transport,
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    callbackId: CALLBACK_ID,
    onClasspathEvent: async () => "unexpected",
  });
  await assert.rejects(session.start(), /synthetic registration failure/);
  await assert.rejects(requestJson(registration.endpoint, { body: event() }));
  await session.start();
  await session.close();
});

test("companion session retains exact identity until failed removal is retried", async () => {
  const commands = [];
  let removalAttempts = 0;
  const transport = {
    async executeBridgeCommand(command, value) {
      commands.push({ command, value });
      if (command === REMOVE_COMMAND) {
        removalAttempts += 1;
        if (removalAttempts === 1) {
          throw new Error("synthetic removal failure");
        }
      }
      return "ok";
    },
  };
  const session = new CompanionBridgeSession({
    transport,
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    callbackId: CALLBACK_ID,
    onClasspathEvent: async () => "ok",
  });
  await session.start();
  const endpoint = commands[0].value.endpoint;
  await assert.rejects(session.close(), /synthetic removal failure/);
  await assert.rejects(requestJson(endpoint, { body: event() }));
  await session.close();
  assert.equal(removalAttempts, 2);
  assert.deepEqual(commands[1].value, commands[2].value);
});

test("Spring mapper translates add, authentic event, child command, and remove", async () => {
  const javaCommands = [];
  const springCommands = [];
  const transport = {
    async executeBridgeCommand(command, value) {
      javaCommands.push({ command, value });
      return "ok";
    },
  };
  const mapper = new SpringClasspathMapper({
    transport,
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    executeSpringCommand: async (command) => {
      springCommands.push(command);
      return "child-result";
    },
  });
  assert.equal(
    await mapper.handleRequest(SPRING_ADD_METHOD, {
      batched: true,
      callbackCommandId: CALLBACK_ID,
    }),
    "ok",
  );
  const add = javaCommands[0];
  assert.equal(add.command, ADD_COMMAND);
  assert.equal(add.value.batched, false);
  const response = await requestJson(add.value.endpoint, { body: event() });
  assert.deepEqual(response, {
    status: 200,
    body: { result: "child-result" },
  });
  assert.deepEqual(springCommands, [
    { command: CALLBACK_ID, arguments: event().arguments },
  ]);
  assert.equal(
    await mapper.handleRequest(SPRING_REMOVE_METHOD, {
      callbackCommandId: CALLBACK_ID,
    }),
    "ok",
  );
  assert.equal(javaCommands[1].command, REMOVE_COMMAND);
  assert.deepEqual(javaCommands[1].value, add.value);
  await mapper.close();
});

test("Spring mapper rejects malformed, duplicate, and mismatched requests", async () => {
  const transport = {
    async executeBridgeCommand() {
      return "ok";
    },
  };
  const mapper = new SpringClasspathMapper({
    transport,
    credential: CREDENTIAL,
    worktreeId: WORKTREE_ID,
    executeSpringCommand: async () => "ok",
  });
  await assert.rejects(
    mapper.handleRequest(SPRING_ADD_METHOD, {
      batched: false,
      callbackCommandId: CALLBACK_ID,
    }),
    /add request is invalid/,
  );
  await mapper.handleRequest(SPRING_ADD_METHOD, {
    batched: true,
    callbackCommandId: CALLBACK_ID,
  });
  await assert.rejects(
    mapper.handleRequest(SPRING_ADD_METHOD, {
      batched: true,
      callbackCommandId: CALLBACK_ID,
    }),
    /add request is invalid/,
  );
  await assert.rejects(
    mapper.handleRequest(SPRING_REMOVE_METHOD, {
      callbackCommandId: "another-callback",
    }),
    /remove request is invalid/,
  );
  await mapper.close();
});
