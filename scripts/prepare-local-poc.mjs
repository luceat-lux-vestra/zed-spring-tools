#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(repository, "tests", "fixtures", "spring-boot-basic");

if (process.argv.length !== 6 || process.argv[2] !== "--prepare") {
  throw new Error(
    "usage: node scripts/prepare-local-poc.mjs --prepare <official-java-profile> <fresh-root> <java-home>",
  );
}

const source = path.resolve(process.argv[3]);
const root = path.resolve(process.argv[4]);
const javaHome = path.resolve(process.argv[5]);
const profile = path.join(root, "profile");
const worktree = path.join(root, "worktree");
const evidence = path.join(root, "evidence");
const xdgCache = path.join(root, "xdg-cache");
const xdgData = path.join(root, "xdg-data");
const xdgState = path.join(root, "xdg-state");

requireDirectory(source, "official Java source profile");
requireDirectory(javaHome, "JAVA_HOME");
assert.equal(fs.existsSync(root), false, "local PoC root must be fresh");
const javaExtension = path.join(source, "extensions", "installed", "java");
const javaWork = path.join(source, "extensions", "work", "java");
const fixed = path.join(source, "fixed");
for (const [directory, label] of [
  [javaExtension, "official Java extension"],
  [path.join(javaWork, "jdtls"), "official JDT LS"],
  [path.join(javaWork, "bin"), "official Java helpers"],
  [fixed, "official Java fixed assets"],
]) {
  requireDirectory(directory, label);
}
const javaManifest = fs.readFileSync(path.join(javaExtension, "extension.toml"), "utf8");
assert.match(javaManifest, /^id = "java"$/m);
assert.match(javaManifest, /^version = "6\.8\.21"$/m);

fs.mkdirSync(path.join(profile, "extensions", "installed"), { recursive: true });
fs.mkdirSync(path.join(profile, "extensions", "work", "java", "proxy"), { recursive: true });
fs.mkdirSync(path.join(profile, "config"), { recursive: true });
for (const directory of [evidence, xdgCache, xdgData, xdgState]) {
  fs.mkdirSync(directory, { recursive: true });
}
fs.cpSync(javaExtension, path.join(profile, "extensions", "installed", "java"), {
  recursive: true,
  dereference: false,
});
fs.cpSync(path.join(javaWork, "jdtls"), path.join(profile, "extensions", "work", "java", "jdtls"), {
  recursive: true,
  dereference: false,
});
fs.cpSync(path.join(javaWork, "bin"), path.join(profile, "extensions", "work", "java", "bin"), {
  recursive: true,
  dereference: false,
});
fs.cpSync(fixed, path.join(profile, "fixed"), { recursive: true, dereference: false });
fs.cpSync(fixture, worktree, { recursive: true, dereference: false });

const index = JSON.parse(fs.readFileSync(path.join(source, "extensions", "index.json"), "utf8"));
assert.equal(index.extensions?.java?.manifest?.version, "6.8.21");
index.extensions = { java: index.extensions.java };
fs.writeFileSync(
  path.join(profile, "extensions", "index.json"),
  `${JSON.stringify(index, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
fs.writeFileSync(
  path.join(profile, "config", "settings.json"),
  `${JSON.stringify(settings(javaHome, profile), null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);

const manifest = {
  status: "prepared",
  target: "macOS-arm64",
  zed: "1.10.3",
  javaExtension: "6.8.21",
  runtimeJdk: javaVersion(javaHome),
  repository,
  profile,
  worktree,
  evidence,
  xdgCache,
  xdgData,
  xdgState,
  fixtureSha256: treeDigest(worktree),
};
fs.writeFileSync(path.join(evidence, "prepared.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function settings(jdk, data) {
  return {
    disable_ai: true,
    session: { restore_unsaved_buffers: false, trust_all_worktrees: true },
    auto_install_extensions: { html: false },
    auto_update_extensions: { java: false, "zed-spring-tools": false },
    log: { lsp: "trace", project: "warn" },
    languages: {
      Java: { language_servers: ["jdtls", "zed-spring-tools"] },
      Properties: { language_servers: ["zed-spring-tools"] },
      YAML: { language_servers: ["zed-spring-tools"] },
    },
    lsp: {
      jdtls: {
        settings: {
          java_home: jdk,
          lsp_proxy_path: path.join(data, "fixed", "java-lsp-proxy"),
          java_debug_jar: path.join(data, "fixed", "com.microsoft.java.debug.plugin-0.53.2.jar"),
          lombok_support: false,
          jdk_auto_download: false,
          check_updates: "never",
        },
      },
    },
  };
}

function requireDirectory(directory, label) {
  assert.equal(fs.statSync(directory).isDirectory(), true, `${label} must be a directory`);
}

function javaVersion(home) {
  const release = fs.readFileSync(path.join(home, "release"), "utf8");
  return /^JAVA_VERSION="([^"]+)"$/m.exec(release)?.[1] ?? "unknown";
}

function treeDigest(directory) {
  const digest = createHash("sha256");
  for (const relative of walk(directory)) {
    const file = path.join(directory, relative);
    digest.update(relative).update("\0").update(fs.readFileSync(file)).update("\n");
  }
  return digest.digest("hex");
}

function walk(directory, prefix = "", current = directory) {
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? walk(directory, relative, path.join(current, entry.name)) : [relative];
  }).sort();
}
