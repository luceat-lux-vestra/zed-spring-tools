// Fail-closed release-CodeQL policy regressions. Temporary workflow copies only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = join(ROOT, "scripts/check-workflow-policy.mjs");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "zed-codeql-policy-"));
  cpSync(join(ROOT, ".github"), join(root, ".github"), { recursive: true });
  return root;
}
function run(root) {
  const result = spawnSync(process.execPath, [CHECK, "--root", root], { encoding: "utf8" });
  return { status: result.status, output: result.stdout + result.stderr };
}
const publisher = String.raw`name: Registry publisher
on:
  workflow_dispatch:
permissions: {}
jobs:
  codeql-preflight:
    runs-on: ubuntu-24.04-arm
    timeout-minutes: 75
    permissions:
      contents: read
      actions: write
    steps:
      - run: python3 tools/ci/release_codeql_preflight.py --sha "$GITHUB_SHA"
  publish:
    needs: [codeql-preflight]
    runs-on: ubuntu-24.04-arm
    timeout-minutes: 15
    steps:
      - run: gh release create v999 # synthetic dry fixture, never executed
`;
test("nonpublishing checked-in preflight policy holds", () => {
  const check = run(ROOT);
  assert.equal(check.status, 0, check.output);
});
test("missing nonpublishing preflight workflow is rejected", () => {
  const root = fixture();
  try {
    rmSync(join(root, ".github/workflows/release-codeql-preflight.yml"));
    const check = run(root);
    assert.equal(check.status, 1);
    assert.match(check.output, /preflight workflow is missing/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("future managed publisher without preflight is rejected", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, ".github/workflows/release.yml"), publisher.replace(/  codeql-preflight:[\s\S]*?(?=  publish:)/, "").replace("needs: [codeql-preflight]", "needs: []"));
    const check = run(root);
    assert.equal(check.status, 1);
    assert.match(check.output, /requires codeql-preflight job/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("future managed publisher cannot omit dependency", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, ".github/workflows/release.yml"), publisher.replace("needs: [codeql-preflight]", "needs: []"));
    const check = run(root);
    assert.equal(check.status, 1);
    assert.match(check.output, /must depend directly on codeql-preflight/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("future managed publisher with preflight dependency is accepted", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, ".github/workflows/release.yml"), publisher);
    const check = run(root);
    assert.equal(check.status, 0, check.output);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("preflight itself must remain nonpublishing", () => {
  const root = fixture();
  try {
    const path = join(root, ".github/workflows/release-codeql-preflight.yml");
    const before = readFileSync(path, "utf8");
    writeFileSync(path, before.replace("python3 tools/ci/release_codeql_preflight.py", "gh release create v999\n          python3 tools/ci/release_codeql_preflight.py"));
    const check = run(root);
    assert.equal(check.status, 1);
    assert.match(check.output, /gained a publication side effect/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Java fixture extraction scope cannot silently shrink", () => {
  const root = fixture();
  try {
    const path = join(root, ".github/codeql-java-config.yml");
    const original = readFileSync(path, "utf8");
    const excluded = "  - tests/fixtures/spring-boot-basic/src/main/java/**";
    assert.ok(original.includes(excluded));
    writeFileSync(path, original.replace(excluded + "\n", ""));
    const check = run(root);
    assert.equal(check.status, 1);
    assert.match(check.output, /Java release CodeQL source scope drifted/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("publisher cannot always-run around failed preflight", () => {
  const root = fixture();
  try {
    writeFileSync(join(root, ".github/workflows/release.yml"),
      publisher.replace("    needs: [codeql-preflight]", "    needs: [codeql-preflight]\n    if: always()"));
    const check = run(root);
    assert.equal(check.status, 1);
    assert.match(check.output, /must depend directly on codeql-preflight/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
