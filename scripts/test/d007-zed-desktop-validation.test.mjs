#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repository = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(repository, "scripts", "d007-zed-desktop-validation.mjs");

test("D007 isolated Zed desktop harness stages without Java private work state", () => {
  const result = spawnSync(process.execPath, [script, "--self-test"], {
    cwd: repository,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /D007 Zed desktop validation self-test: ok/);
});
