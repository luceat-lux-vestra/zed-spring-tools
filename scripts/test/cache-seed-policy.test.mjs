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
  assert.match(mainProducer, /RUST_TOOLCHAIN: "1\.98\.0"/);
  assert.match(mainProducer, /toolchain: \$\{\{ env\.RUST_TOOLCHAIN \}\}/);
  assert.match(prConsumer, /RUST_TOOLCHAIN: "1\.98\.0"/);
  assert.match(prConsumer, /toolchain: \$\{\{ env\.RUST_TOOLCHAIN \}\}/);
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


const platformProducer = read(".github/workflows/rust-platform-main-cache-seed.yml");
const platformConsumer = read(".github/workflows/platform-validation.yml");

function validatePlatformCacheContract(mainProducer, prConsumer) {
  const trigger = mainProducer.split("\npermissions:", 1)[0];
  const expectedPaths = [
    "Cargo.toml", "Cargo.lock", ".cargo/**", "rust-toolchain",
    "rust-toolchain.toml", ".github/workflows/platform-validation.yml",
    ".github/workflows/rust-platform-main-cache-seed.yml",
  ];
  const foundPaths = [...trigger.matchAll(/^      - '([^']+)'$/gm)].map((match) => match[1]);
  assert.deepEqual(foundPaths, expectedPaths);
  assert.match(trigger, /^  push:\n    branches: \[main\]\n    paths:/m);
  assert.match(trigger, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(trigger, /src\/\*\*|docs\/\*\*|schedule:/);
  assert.match(mainProducer, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(mainProducer, /run: test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/);
  assert.match(mainProducer, /run: cargo test --locked/);
  assert.doesNotMatch(mainProducer, /id: linux-arm64/);

  for (const key of [
    "platform-linux-x86_64",
    "platform-macos-x86_64",
    "platform-macos-arm64",
    "platform-windows-x86_64",
    "platform-windows-arm64",
  ]) {
    assert.ok(mainProducer.includes("rust_cache_key: " + key), "producer missing " + key);
    assert.ok(prConsumer.includes("rust_cache_key: " + key), "consumer missing " + key);
  }
  assert.ok(prConsumer.includes("rust_cache_key: main-ci-rust-arm64"));
  assert.match(prConsumer, /shared-key: \$\{\{ matrix\.rust_cache_key \}\}\n\s+save-if: false/);
  assert.match(prConsumer, /RUST_TOOLCHAIN: "1\.98\.0"/);
  assert.match(consumer, /RUST_TOOLCHAIN: "1\.98\.0"/);
}

test("platform Rust cache ownership is protected-main and PR read-only", () => {
  validatePlatformCacheContract(platformProducer, platformConsumer);
});

test("platform cache contract rejects duplicate ARM64 producers and PR writes", () => {
  const producerMutants = [
    ["source-wide trigger", platformProducer.replace("      - 'Cargo.lock'\n", "      - 'Cargo.lock'\n      - 'src/**'\n")],
    ["manual recovery removed", platformProducer.replace("  workflow_dispatch:", "  # workflow_dispatch:")],
    ["wrong main branch", platformProducer.replace("branches: [main]", "branches: [develop]")],
    ["duplicate linux arm64 producer", platformProducer.replace("          - id: linux-x86_64", "          - id: linux-arm64\n            runner: ubuntu-24.04-arm\n            rust_cache_key: main-ci-rust-arm64\n          - id: linux-x86_64")],
    ["native tests removed", platformProducer.replace("run: cargo test --locked", "run: cargo metadata --locked --no-deps")],
  ];
  for (const [name, mutated] of producerMutants) {
    assert.notEqual(mutated, platformProducer, "platform producer fixture not applied: " + name);
    assert.throws(() => validatePlatformCacheContract(mutated, platformConsumer), undefined, name);
  }

  const consumerMutants = [
    ["PR writes enabled", platformConsumer.replace("          save-if: false\n", "")],
    ["linux ARM64 duplicates platform key", platformConsumer.replace("rust_cache_key: main-ci-rust-arm64", "rust_cache_key: platform-linux-arm64")],
    ["x64 cache key drift", platformConsumer.replace("rust_cache_key: platform-linux-x86_64", "rust_cache_key: wrong-linux-x86_64")],
  ];
  for (const [name, mutated] of consumerMutants) {
    assert.notEqual(mutated, platformConsumer, "platform consumer fixture not applied: " + name);
    assert.throws(() => validatePlatformCacheContract(platformProducer, mutated), undefined, name);
  }
});
