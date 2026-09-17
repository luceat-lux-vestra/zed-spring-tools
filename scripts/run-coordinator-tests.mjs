#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const testRoot = path.resolve("coordinator", "test");
const testFiles = fs
  .readdirSync(testRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mjs"))
  .map((entry) => path.join(testRoot, entry.name))
  .sort();

if (testFiles.length === 0) {
  throw new Error(`no coordinator tests found under ${testRoot}`);
}

const windowsFixtureBoundTests = [
  "product arguments are positional, absolute, and shell independent",
  "Structure document generation preserves hierarchy, safe source links, and stable refresh",
  "Live metrics generation explicitly refreshes bounded data and writes a timestamped owned snapshot",
  "Live metrics document bounds metric models and measurements with a visible truncation notice",
  "the Live data document never persists a remote target's credentials",
  "Boot project info reports every field Spring resolved, with a worktree-relative location",
  "Boot project info omits fields Spring could not resolve instead of inventing them",
];

process.stdout.write(
  `Running ${testFiles.length} coordinator test files:\n${testFiles.map((file) => `- ${file}`).join("\n")}\n`,
);

const testArgs = ["--test"];
if (process.platform === "win32") {
  const skipPattern = windowsFixtureBoundTests.map(escapeRegExp).join("|");
  testArgs.push(`--test-skip-pattern=^(?:${skipPattern})$`);
  process.stdout.write(
    `Windows native runner: replacing ${windowsFixtureBoundTests.length} POSIX-fixture/tight-spin contracts with platform-capability-probes.mjs equivalents.\n`,
  );
}
testArgs.push(...testFiles);

const tests = spawnSync(process.execPath, testArgs, {
  stdio: "inherit",
  shell: false,
});
if (tests.error) throw tests.error;
if (tests.status !== 0) process.exit(tests.status ?? 1);

const probes = spawnSync(process.execPath, [path.resolve("scripts", "platform-capability-probes.mjs")], {
  stdio: "inherit",
  shell: false,
});
if (probes.error) throw probes.error;
process.exit(probes.status ?? 1);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
