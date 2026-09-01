// Negative fixtures for `scripts/check-pin-inventory.mjs`.
//
// A reconciliation check that has only ever been run against a tree that
// already reconciles proves nothing: it would pass just as happily if it
// silently matched nothing. Each test below takes a copy of the real declared
// surfaces, breaks exactly one of them the way a half-applied release pin
// breaks it, and asserts the check fails and says which surface.
//
// Run with: node --test scripts/test/*.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = join(REPOSITORY, "scripts/check-pin-inventory.mjs");
const PIN = JSON.parse(readFileSync(join(REPOSITORY, "protocol/spring-artifacts.json"), "utf8")).springTools;
const CURRENT_TAG = PIN.tag;
const CURRENT_ASSET = PIN.asset;
const REACTOR_DIGEST = PIN.requiredFiles.find((entry) => entry.path.endsWith("reactor-core.jar")).sha256;

// Every surface the check reconciles. Historical trees are omitted on purpose:
// their absence must not turn the check red.
const SURFACES = [
  "protocol/spring-artifacts.json",
  "src/artifacts.rs",
  "extension.toml",
  "coordinator/src/main.mjs",
  "THIRD_PARTY_NOTICES.md",
  "COMPATIBILITY.md",
  "docs/pinned-release-refresh-gate.md",
  "README.md",
  "LIMITATIONS.md",
  "docs/capability-inventory.md",
  "docs/implementation-plan.md",
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pin-inventory-"));
  for (const file of SURFACES) {
    mkdirSync(join(root, dirname(file)), { recursive: true });
    cpSync(join(REPOSITORY, file), join(root, file));
  }
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const before = readFileSync(path, "utf8");
  assert.ok(before.includes(from), `fixture is stale: ${file} no longer contains ${from}`);
  writeFileSync(path, before.replace(from, to));
}

function run(root) {
  const result = spawnSync(process.execPath, [CHECK, "--root", root], { encoding: "utf8" });
  return { code: result.status, out: result.stdout + result.stderr };
}

test("the untouched surfaces reconcile, so a later failure is the edit and not the fixture", () => {
  const result = run(fixture());
  assert.equal(result.code, 0, result.out);
});

test("a stale pinned version in the coordinator fails the check", () => {
  const root = fixture();
  edit(root, "coordinator/src/main.mjs", `const SPRING_TOOLS_VERSION = "${CURRENT_TAG}"`, 'const SPRING_TOOLS_VERSION = "5.2.0.RELEASE"');
  const result = run(root);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /coordinator\/src\/main\.mjs: `SPRING_TOOLS_VERSION`/);
});

test("a stale pinned version left in the extension adapter fails the check", () => {
  const root = fixture();
  edit(root, "src/artifacts.rs", `const VERSION: &str = "${CURRENT_TAG}"`, 'const VERSION: &str = "5.2.0.RELEASE"');
  const result = run(root);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /src\/artifacts\.rs: `VERSION`/);
});

test("a stale artifact digest in the extension adapter fails the check", () => {
  const root = fixture();
  // One hex character of the reactor-core bundle digest: the difference between
  // an install that verifies and one that refuses, and invisible to review.
  edit(
    root,
    "src/artifacts.rs",
    REACTOR_DIGEST,
    `${REACTOR_DIGEST.slice(0, -1)}1`,
  );
  const result = run(root);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /REQUIRED` digest for `extension\/jars\/io\.projectreactor\.reactor-core\.jar`/);
});

test("a download capability that lags the pinned URL fails the check", () => {
  const root = fixture();
  edit(root, "extension.toml", `"${CURRENT_TAG}",`, '"5.2.0.RELEASE",');
  const result = run(root);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /extension\.toml: the `download_file` capability authorises/);
});

test("a document stating the pin that stops stating it fails the check", () => {
  const root = fixture();
  edit(root, "THIRD_PARTY_NOTICES.md", CURRENT_ASSET, "vscode-spring-boot-2.4.0.vsix");
  const result = run(root);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /THIRD_PARTY_NOTICES\.md does not state/);
});

test("an undeclared file carrying pin identity fails the check", () => {
  const root = fixture();
  mkdirSync(join(root, "packaging"), { recursive: true });
  writeFileSync(
    join(root, "packaging/install.sh"),
    `#!/bin/sh\n# a seventh pin surface nobody declared\nVERSION=${CURRENT_TAG}\n`,
  );
  const result = run(root);
  assert.equal(result.code, 1, result.out);
  assert.match(result.out, /packaging\/install\.sh states the pinned Spring Tools identity/);
});
