"use strict";

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const UPSTREAM_COMMIT = "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
const UPSTREAM_MAIN_SHA256 = "ccf1d7c18b527f6809b09919f9eec6333c2f88cc5d9ff9a1dcf5f263b1aa1243";

function main(args) {
  if (args.length !== 2) {
    throw new Error("usage: patch_contract.mjs <instrumented_proxy.patch> <upstream-main.rs>");
  }
  const patchPath = path.resolve(args[0]);
  const upstreamMain = path.resolve(args[1]);
  const patchText = fs.readFileSync(patchPath, "utf8");
  assert.match(patchText, new RegExp(`Upstream-Commit: ${UPSTREAM_COMMIT}`));
  assert.match(patchText, /proxy\/src\/s006_coordination\.rs/);
  assert.equal(sha256(upstreamMain), UPSTREAM_MAIN_SHA256, "upstream main.rs identity changed");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s006-patch-test-"));
  let completed = false;
  try {
    const source = path.join(root, "proxy", "src");
    fs.mkdirSync(source, { recursive: true });
    fs.copyFileSync(upstreamMain, path.join(source, "main.rs"));
    run("git", ["init", "--quiet"], root);
    run("git", ["apply", "--check", "--verbose", "--whitespace=error-all", patchPath], root);
    run("git", ["apply", "--verbose", "--whitespace=error-all", patchPath], root);

    const harness = path.dirname(fileURLToPath(import.meta.url));
    fs.copyFileSync(path.join(harness, "Cargo.toml"), path.join(root, "proxy", "Cargo.toml"));
    fs.copyFileSync(path.join(harness, "Cargo.lock"), path.join(root, "proxy", "Cargo.lock"));
    run("rustfmt", ["--edition", "2021", "--check", "src/s006_coordination.rs"], path.join(root, "proxy"));
    run("cargo", ["clippy", "--locked", "--all-targets", "--", "-D", "warnings"], path.join(root, "proxy"));
    run("cargo", ["test", "--locked"], path.join(root, "proxy"));
    completed = true;
    process.stdout.write("S006 proxy patch contract test passed\n");
  } finally {
    if (completed || process.env.S006_KEEP_FAILED !== "1") {
      fs.rmSync(root, { recursive: true, force: true });
    } else {
      process.stderr.write(`preserved failed synthetic tree: ${root}\n`);
    }
  }
}

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
}

main(process.argv.slice(2));
