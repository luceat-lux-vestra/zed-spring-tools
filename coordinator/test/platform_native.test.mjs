import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Coordinator, parseOptions } from "../src/main.mjs";
import { routeId } from "../src/java_transport.mjs";
import { LspDecoder } from "../src/lsp.mjs";

const hostOs = process.env.EXPECTED_OS ?? nativeHostOs();

function nativeHostOs() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return process.platform;
}

function decodeSingle(bytes) {
  const messages = new LspDecoder().push(bytes);
  assert.equal(messages.length, 1);
  return messages[0];
}

function makeWorktree(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildCoordinator(worktree, zedWrites) {
  return new Coordinator({
    sendSpring() {},
    sendZed: (bytes) => zedWrites.push(decodeSingle(bytes)),
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs },
  });
}

function buildCommandMessage(buildFile, goal, command) {
  return {
    jsonrpc: "2.0",
    id: "native-build",
    method: "workspace/executeCommand",
    params: { command, arguments: [buildFile, goal] },
  };
}

test("native product paths stay absolute and shell independent", () => {
  const root = path.resolve(path.join(os.tmpdir(), "zed spring native"));
  const options = parseOptions([
    "--worktree", path.join(root, "work tree"),
    "--java", path.join(root, "jdk", "bin", process.platform === "win32" ? "java.exe" : "java"),
    "--spring-server", path.join(root, "spring", "server.jar"),
    "--spring-home", path.join(root, "spring"),
    "--java-work-dir", path.join(root, "extensions", "work", "java"),
    "--compatibility", path.join(root, "runtime", "providers.json"),
    "--host-os", hostOs,
    "--extension-version", "0.1.0-alpha.1",
    "--automatic-live-connection", "false",
    "--mcp-server-port", "off",
  ]);

  assert.equal(options.worktree, path.join(root, "work tree"));
  assert.equal(options.java, path.join(root, "jdk", "bin", process.platform === "win32" ? "java.exe" : "java"));
  assert.equal(options.hostOs, hostOs);
});

test("official Java route ID follows the native normalized worktree path", () => {
  const worktree = path.join(os.tmpdir(), "zed spring 프로젝트");
  const normalized = path.resolve(worktree).replace(/[\\/]$/, "");
  assert.equal(routeId(`${worktree}${path.sep}`), Buffer.from(normalized, "utf8").toString("hex"));
});

test("Maven build task selects the native wrapper beside the build file", () => {
  const worktree = makeWorktree("zed-spring-native-maven-");
  try {
    const wrapper = hostOs === "windows" ? "mvnw.cmd" : "mvnw";
    fs.writeFileSync(path.join(worktree, "pom.xml"), "<project/>\n");
    fs.writeFileSync(path.join(worktree, wrapper), hostOs === "windows" ? "@echo off\r\n" : "#!/bin/sh\n");

    const zedWrites = [];
    const coordinator = buildCoordinator(worktree, zedWrites);
    assert.equal(
      coordinator.observeZedMessage(
        buildCommandMessage(path.join(worktree, "pom.xml"), "verify", "sts.maven.goal"),
      ),
      false,
    );

    const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].command, hostOs === "windows" ? "mvnw.cmd" : "./mvnw");
    assert.equal(tasks[0].cwd, "$ZED_WORKTREE_ROOT");
    assert.deepEqual(tasks[0].args, ["verify"]);
    assert.equal(zedWrites.at(-1).id, "native-build");
    assert.equal(zedWrites.at(-1).result, null);
  } finally {
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test("Gradle build task selects the native wrapper beside the build file", () => {
  const worktree = makeWorktree("zed-spring-native-gradle-");
  try {
    const wrapper = hostOs === "windows" ? "gradlew.bat" : "gradlew";
    fs.writeFileSync(path.join(worktree, "build.gradle"), "plugins {}\n");
    fs.writeFileSync(path.join(worktree, wrapper), hostOs === "windows" ? "@echo off\r\n" : "#!/bin/sh\n");

    const zedWrites = [];
    const coordinator = buildCoordinator(worktree, zedWrites);
    assert.equal(
      coordinator.observeZedMessage(
        buildCommandMessage(path.join(worktree, "build.gradle"), "bootJar", "sts.gradle.build"),
      ),
      false,
    );

    const tasks = JSON.parse(fs.readFileSync(path.join(worktree, ".zed", "tasks.json"), "utf8"));
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].command, hostOs === "windows" ? "gradlew.bat" : "./gradlew");
    assert.equal(tasks[0].cwd, "$ZED_WORKTREE_ROOT");
    assert.deepEqual(tasks[0].args, ["bootJar"]);
    assert.equal(zedWrites.at(-1).id, "native-build");
    assert.equal(zedWrites.at(-1).result, null);
  } finally {
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});
