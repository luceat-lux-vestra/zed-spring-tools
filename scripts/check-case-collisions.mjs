#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export function caseCollisions(paths) {
  const groups = new Map();
  for (const path of paths) {
    const key = path.normalize("NFC").toLocaleLowerCase("en-US");
    const values = groups.get(key) ?? [];
    values.push(path);
    groups.set(key, values);
  }
  return [...groups.values()].filter((values) => new Set(values).size > 1);
}

if (process.argv[2] === "--self-test") {
  assert.deepEqual(caseCollisions(["a/B.md", "a/b.md"]), [["a/B.md", "a/b.md"]]);
  assert.deepEqual(caseCollisions(["a/b.md", "a/c.md"]), []);
  process.stdout.write("case-collision self-test: ok\n");
} else {
  const result = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  const paths = result.stdout.split("\0").filter(Boolean);
  const collisions = caseCollisions(paths);
  if (collisions.length > 0) {
    for (const group of collisions) {
      process.stderr.write(`case-insensitive path collision: ${group.join(" <-> ")}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`case-insensitive path check: ok (${paths.length} tracked paths)\n`);
}
