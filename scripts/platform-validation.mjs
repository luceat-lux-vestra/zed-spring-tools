#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXPECTED_NODE_MAJOR = 24;
const EXPECTED_JAVA_MAJOR = 25;
const EXPECTED_RUST = "1.98.0";

const expectedOs = requiredEnv("EXPECTED_OS");
const expectedArch = requiredEnv("EXPECTED_ARCH");
const evidencePath = requiredEnv("PLATFORM_EVIDENCE");

const actualOs = normalizeOs(process.platform);
const actualArch = normalizeArch(process.arch);
const nodeVersion = process.versions.node;
const javaVersion = commandOutput(javaTool("java"), ["-version"]);
const javacVersion = commandOutput(javaTool("javac"), ["-version"]);
const rustcVersion = commandOutput("rustc", ["--version"]);
const cargoVersion = commandOutput("cargo", ["--version"]);

assertEqual(actualOs, expectedOs, "host OS");
assertEqual(actualArch, expectedArch, "host architecture");
assertEqual(Number(nodeVersion.split(".")[0]), EXPECTED_NODE_MAJOR, "Node major version");
assertEqual(javaMajor(javaVersion), EXPECTED_JAVA_MAJOR, "Java major version");
assertEqual(javaMajor(javacVersion), EXPECTED_JAVA_MAJOR, "javac major version");
assertEqual(rustVersion(rustcVersion), EXPECTED_RUST, "Rust toolchain version");

const roundTripRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zed-spring-platform-"));
try {
  const nested = path.join(roundTripRoot, "space path", "unicode-한글.txt");
  fs.mkdirSync(path.dirname(nested), { recursive: true });
  fs.writeFileSync(nested, "platform-validation\n", "utf8");
  assertEqual(fs.readFileSync(nested, "utf8"), "platform-validation\n", "filesystem round trip");
} finally {
  fs.rmSync(roundTripRoot, { recursive: true, force: true });
}

const evidence = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY ?? null,
  commit: process.env.GITHUB_SHA ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  runner: {
    name: process.env.RUNNER_NAME ?? null,
    os: process.env.RUNNER_OS ?? null,
    arch: process.env.RUNNER_ARCH ?? null,
    expectedOs,
    expectedArch,
    actualOs,
    actualArch,
  },
  runtime: {
    node: nodeVersion,
    java: firstLine(javaVersion),
    javac: firstLine(javacVersion),
    rustc: firstLine(rustcVersion),
    cargo: firstLine(cargoVersion),
  },
  host: {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    pathSeparator: path.sep,
  },
};

fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizeOs(platform) {
  if (platform === "linux") return "linux";
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return platform;
}

function normalizeArch(arch) {
  if (arch === "x64") return "x86_64";
  if (arch === "arm64") return "arm64";
  return arch;
}

function javaTool(name) {
  const executable = process.platform === "win32" ? `${name}.exe` : name;
  if (!process.env.JAVA_HOME) return executable;
  const candidate = path.join(process.env.JAVA_HOME, "bin", executable);
  return fs.existsSync(candidate) ? candidate : executable;
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    const combined = `${stdout}\n${stderr}`.trim();
    if (combined) return combined;
    throw error;
  }
}

function javaMajor(output) {
  const match = output.match(/(?:java|javac|openjdk)(?: version)?[ =\"]+(\d+)/i)
    ?? output.match(/\b(\d+)(?:\.\d+)+(?:[+._-]|\b)/);
  if (!match) throw new Error(`cannot parse Java version from: ${output}`);
  return Number(match[1]);
}

function rustVersion(output) {
  const match = output.match(/^rustc\s+(\d+\.\d+\.\d+)/m);
  if (!match) throw new Error(`cannot parse rustc version from: ${output}`);
  return match[1];
}

function firstLine(value) {
  return value.split(/\r?\n/, 1)[0];
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
