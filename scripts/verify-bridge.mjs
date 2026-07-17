#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bridge = path.join(root, "bridge");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-bridge-test-"));

try {
  const sources = [
    ...javaFiles(path.join(bridge, "src", "main", "java")),
    ...javaFiles(path.join(bridge, "src", "compile-stubs", "java")),
    ...javaFiles(path.join(bridge, "src", "test", "java")),
  ].sort();
  const javac = javaTool("javac");
  const java = javaTool("java");
  requireSuccess(
    javac,
    [
      "--release", "21",
      "-Xlint:all,-options", "-Werror",
      "-encoding", "UTF-8",
      "-d", temporary,
      ...sources,
    ],
    "compile bridge self-test",
  );
  requireSuccess(
    java,
    ["-cp", temporary, "dev.zed.spring.bridge.BridgeProtocolSelfTest"],
    "run bridge self-test",
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

function javaFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) return javaFiles(child);
    return entry.isFile() && entry.name.endsWith(".java") ? [child] : [];
  });
}

function javaTool(name) {
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  const candidate = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, "bin", executable)
    : executable;
  return process.env.JAVA_HOME && !fs.existsSync(candidate) ? executable : candidate;
}

function requireSuccess(command, arguments_, action) {
  const result = spawnSync(command, arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${action} failed`);
  }
  process.stdout.write(result.stdout ?? "");
}
