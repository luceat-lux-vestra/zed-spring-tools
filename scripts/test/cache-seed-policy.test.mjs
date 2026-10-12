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

function validateContract(mainProducer, prConsumer) {
  const trigger = mainProducer.split("\npermissions:", 1)[0];
  const found = [...trigger.matchAll(/^      - '([^']+)'$/gm)].map((match) => match[1]);
  const expected = [
    "Cargo.toml", "Cargo.lock", ".cargo/**", "rust-toolchain",
    "rust-toolchain.toml", ".github/workflows/ci.yml",
    ".github/workflows/rust-main-cache-seed.yml",
  ];
  assert.deepEqual(found, expected, "producer must trigger only on exact Cargo/cache inputs");
  assert.match(trigger, /^  push:\n    branches: \[main\]\n    paths:/m);
  assert.match(trigger, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(trigger, /src\/\*\*|docs\/\*\*|\*\*\/\*|schedule:/);
  assert.match(mainProducer, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(mainProducer, /run: test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/);
  assert.match(mainProducer, /shared-key: main-ci-rust-arm64/);
  assert.match(prConsumer, /shared-key: main-ci-rust-arm64\n\s+save-if: false/);
  assert.equal((mainProducer.match(/Swatinem\/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6/g) ?? []).length, 1);
  assert.match(mainProducer, /toolchain: "1\.98\.0"/);
  assert.match(mainProducer, /targets: wasm32-wasip2/);
  assert.match(mainProducer, /cargo clippy --all-targets --all-features -- -D warnings/);
  assert.match(mainProducer, /cargo test --locked/);
  assert.match(mainProducer, /cargo build --locked --release --target wasm32-wasip2/);
}

test("cache topology regression gate rejects stale, unsafe or overbroad policies", () => {
  validateContract(producer, consumer);
  const producerMutants = [
    ["missing Cargo lockfile trigger", producer.replace("      - 'Cargo.lock'\n", "")],
    ["unrelated source broadening", producer.replace("      - 'Cargo.lock'\n", "      - 'Cargo.lock'\n      - 'src/**'\n")],
    ["writes outside protected main", producer.replace("branches: [main]", "branches: [develop]")],
    ["manual eviction recovery removed", producer.replace("  workflow_dispatch:", "  # workflow_dispatch:")],
    ["main authority removed", producer.replace("if: ${{ github.ref == 'refs/heads/main' }}", "if: ${{ always() }}")],
    ["wrong cache producer key", producer.replace("shared-key: main-ci-rust-arm64", "shared-key: incompatible-cache")],
    ["checkout authority removed", producer.replace('test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"', "echo unchecked")],
    ["target release build removed", producer.replace("cargo build --locked --release --target wasm32-wasip2", "cargo build --release")],
  ];
  for (const [name, mutated] of producerMutants) {
    assert.notEqual(mutated, producer, `test fixture not applied: ${name}`);
    assert.throws(() => validateContract(mutated, consumer), undefined, name);
  }
  const consumerMutants = [
    ["PR cache write silently enabled", consumer.replace("          save-if: false\n", "")],
    ["consumer key diverged from main", consumer.replace("shared-key: main-ci-rust-arm64", "shared-key: pr-only-cache")],
  ];
  for (const [name, mutated] of consumerMutants) {
    assert.notEqual(mutated, consumer, `test fixture not applied: ${name}`);
    assert.throws(() => validateContract(producer, mutated), undefined, name);
  }
});
