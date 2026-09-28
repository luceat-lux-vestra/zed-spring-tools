import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
