"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function main(args) {
  if (args.length !== 1) {
    throw new Error("usage: patch_contract.js <instrumented-proxy.patch>");
  }
  const patchPath = path.resolve(args[0]);
  const patchText = fs.readFileSync(patchPath, "utf8");
  requireCondition(
    patchText.includes("Upstream-Commit: 9148b8972c1b93fbe5512a9ecf0ba33c3182970d"),
    "patch does not identify the fixed upstream commit",
  );
  requireCondition(
    patchText.includes("proxy/src/s005_callback.rs"),
    "patch does not add the fixed callback module",
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "s005-patch-test-"));
  let completed = false;
  try {
    const proxy = path.join(root, "proxy");
    const source = path.join(proxy, "src");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, "main.rs"),
      reconstructPreimage(patchText, "proxy/src/main.rs"),
      "utf8",
    );
    run("git", ["init", "--quiet"], root);
    run("git", ["apply", "--check", "--verbose", "--whitespace=error-all", patchPath], root);
    run("git", ["apply", "--verbose", "--whitespace=error-all", patchPath], root);

    const harness = __dirname;
    fs.copyFileSync(path.join(harness, "Cargo.toml"), path.join(proxy, "Cargo.toml"));
    fs.copyFileSync(path.join(harness, "Cargo.lock"), path.join(proxy, "Cargo.lock"));
    run("rustfmt", ["--edition", "2021", "--check", "src/s005_callback.rs"], proxy);
    run("cargo", ["clippy", "--locked", "--all-targets", "--", "-D", "warnings"], proxy);
    run("cargo", ["test", "--locked"], proxy);
    completed = true;
    process.stdout.write("S005 proxy patch contract test passed\n");
  } finally {
    if (completed || process.env.S005_KEEP_FAILED !== "1") {
      fs.rmSync(root, { recursive: true, force: true });
    } else {
      process.stderr.write(`preserved failed synthetic tree: ${root}\n`);
    }
  }
}

function reconstructPreimage(patchText, target) {
  const lines = patchText.split("\n");
  const marker = `+++ b/${target}`;
  const markerIndex = lines.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`patch target is missing: ${target}`);
  }

  const output = [];
  let index = markerIndex + 1;
  let oldLine = 1;
  let foundHunk = false;
  while (index < lines.length && !lines[index].startsWith("diff --git ")) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[index]);
    if (!header) {
      index += 1;
      continue;
    }
    foundHunk = true;
    const start = Number.parseInt(header[1], 10);
    const count = Number.parseInt(header[2] ?? "1", 10);
    while (oldLine < start) {
      output.push("");
      oldLine += 1;
    }
    index += 1;
    let consumed = 0;
    while (index < lines.length && !lines[index].startsWith("@@ ") && !lines[index].startsWith("diff --git ")) {
      const line = lines[index];
      if (line.startsWith(" ") || line.startsWith("-")) {
        output.push(line.slice(1));
        oldLine += 1;
        consumed += 1;
      } else if (!line.startsWith("+") && line !== "\\ No newline at end of file") {
        break;
      }
      index += 1;
    }
    requireCondition(consumed === count, `hunk old-line count changed at ${start}`);
  }
  requireCondition(foundHunk, `patch contains no hunks for ${target}`);
  return `${output.join("\n")}\n`;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main(process.argv.slice(2));
