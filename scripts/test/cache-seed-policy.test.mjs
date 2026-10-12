import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (pathPart) => fs.readFileSync(path.join(root, pathPart), "utf8");
const producer = read(".github/workflows/rust-main-cache-seed.yml");
const consumer = read(".github/workflows/ci.yml");

test("trusted-main Rust seeding is dependency-only and manually recoverable", () => {
  const trigger = producer.split("\npermissions:", 1)[0];
  const found = [...trigger.matchAll(/^      - '([^']+)'$/gm)].map((match) => match[1]);
  const expected = [
    "Cargo.toml", "Cargo.lock", ".cargo/**", "rust-toolchain",
    "rust-toolchain.toml", ".github/workflows/ci.yml",
    ".github/workflows/rust-main-cache-seed.yml",
  ];
  assert.deepEqual(found, expected);
  assert.match(trigger, /^  push:\n    branches: \[main\]\n    paths:/m);
  assert.match(trigger, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(trigger, /src\/\*\*|docs\/\*\*|\*\*\/\*|schedule:/);
});

test("only exact trusted-main producer writes and PR Rust remains read-only", () => {
  assert.match(producer, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(producer, /run: test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/);
  assert.match(producer, /shared-key: main-ci-rust-arm64/);
  assert.match(consumer, /shared-key: main-ci-rust-arm64\n\s+save-if: false/);
  assert.equal((producer.match(/Swatinem\/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6/g) ?? []).length, 1);
  assert.match(producer, /cargo clippy --all-targets --all-features -- -D warnings/);
  assert.match(producer, /cargo test --locked/);
  assert.match(producer, /cargo build --locked --release --target wasm32-wasip2/);
});
