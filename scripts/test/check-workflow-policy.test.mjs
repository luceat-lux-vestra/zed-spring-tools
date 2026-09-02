// Negative fixtures for scripts/check-workflow-policy.mjs.
// These mutate disposable copies of the workflow tree and require the checker
// to reject exactly the drift that could otherwise make a gate disappear.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = join(REPOSITORY, "scripts/check-workflow-policy.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "workflow-policy-"));
  cpSync(join(REPOSITORY, ".github"), join(root, ".github"), { recursive: true });
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const before = readFileSync(path, "utf8");
  assert.ok(before.includes(from), `fixture anchor is stale: ${file}: ${from}`);
  writeFileSync(path, before.replace(from, to));
}

function run(root) {
  const result = spawnSync(process.execPath, [CHECK, "--root", root], { encoding: "utf8" });
  return { code: result.status, output: result.stdout + result.stderr };
}

test("the real workflow tree satisfies the offline policy", () => {
  const result = run(REPOSITORY);
  assert.equal(result.code, 0, result.output);
});

test("a renamed required producer is rejected", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "  rust:\n", "  rust:\n    name: Rust renamed\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /sets `name:`/);
});

test("a path filter on a required workflow is rejected", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "  pull_request:\n", "  pull_request:\n    paths:\n      - src/**\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /filters its `pull_request` trigger/);
});

test("a mutable action ref is rejected", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", "actions/checkout@v7");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /uses `actions\/checkout@v7`, a mutable ref/);
});

test("a privileged workflow checkout is rejected", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/labeler.yml",
    "  pull_request:\n",
    "  pull_request_target:\n",
  );
  edit(
    root,
    ".github/workflows/labeler.yml",
    "    steps:\n",
    "    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /checks out code in a `pull_request_target` workflow/);
});
