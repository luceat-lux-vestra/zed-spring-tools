import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("D007 standalone capability regression runner parses", () => {
  const script = path.resolve("scripts", "d007-standalone-capability-regression.mjs");
  const result = spawnSync(process.execPath, ["--check", script], {
    encoding: "utf8",
    shell: false,
  });
  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || "node --check failed",
  );
});

test("D007 live-process prompt selection is bound to the exact spawned JVM", () => {
  const script = path.resolve("scripts", "d007-standalone-capability-regression.mjs");
  const source = fs.readFileSync(script, "utf8");
  assert.equal(
    source.includes("exactLocalProcessLabel = localDescriptor.label;"),
    true,
    "the exact descriptor matched by processKey must own subsequent prompt selection",
  );
  assert.equal(
    source.includes('title === `Connect — ${exactLocalProcessLabel}`'),
    true,
    "connect must not pick an arbitrary first live process",
  );
  assert.equal(
    source.includes('title === `Refresh — ${exactLocalProcessLabel}`'),
    true,
    "refresh must stay on the same exact live process",
  );
  assert.equal(
    source.includes('title === `Disconnect — ${exactLocalProcessLabel}`'),
    true,
    "disconnect must stay on the same exact live process",
  );
  assert.equal(
    source.includes("local live-process prompt label must identify the exact spawned Boot JVM"),
    true,
    "the harness must prove the descriptor label identifies the spawned JVM",
  );
});
