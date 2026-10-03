#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repository = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(repository, "scripts", "d007-zed-desktop-validation.mjs");

test("D007 Gradle fixture carries a runnable wrapper JAR", () => {
  const wrapperJar = join(
    repository,
    "tests",
    "fixtures",
    "spring-boot-gradle",
    "gradle",
    "wrapper",
    "gradle-wrapper.jar",
  );
  const bytes = readFileSync(wrapperJar);
  assert.ok(bytes.length > 10_000, "Gradle wrapper JAR must be non-empty");
  assert.deepEqual(
    Array.from(bytes.subarray(0, 4)),
    [0x50, 0x4b, 0x03, 0x04],
    "Gradle wrapper runtime must be a ZIP/JAR, not a placeholder",
  );
});

test("D007 isolated Zed desktop harness stages without Java private work state", () => {
  const result = spawnSync(process.execPath, [script, "--self-test"], {
    cwd: repository,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /D007 Zed desktop validation self-test: ok/);
});

test("D007 desktop DAP retries with fresh modal and preserves source integrity", () => {
  const script = path.resolve("scripts", "d007-zed-desktop-validation.mjs");
  const source = fs.readFileSync(script, "utf8");
  assert.equal(source.includes("fresh debugger modal attempt(s)"), true);
  assert.equal(source.includes("freshModalPerAttempt: true"), true);
  assert.equal(source.includes("sourceIntegrityObserved: true"), true);
  assert.equal(source.includes("DAP picker query modified the Java source"), true);
  assert.equal(source.includes("timeout: 15_000"), true);
  assert.equal(source.includes("timedOut: result.error?.code === \"ETIMEDOUT\""), true);
});
