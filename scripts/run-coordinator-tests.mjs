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

process.stdout.write(
  `Running ${testFiles.length} coordinator test files:\n${testFiles.map((file) => `- ${file}`).join("\n")}\n`,
);

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
