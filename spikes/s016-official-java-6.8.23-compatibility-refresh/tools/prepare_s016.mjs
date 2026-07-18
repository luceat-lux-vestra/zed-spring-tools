#!/usr/bin/env node

// S016 disposable preparation. Builds one isolated Zed profile from a source
// profile that already has the official Java extension 6.8.23 installed, so the
// S016 driven run can start without hand-copying the Java extension, its JDT LS
// and helper work dirs, the fixed proxy assets, and the Spring Boot fixture.
//
// This is a spike tool, not product code. It is the 6.8.23 analog of
// scripts/prepare-local-poc.mjs, which stays pinned to the supported 6.8.21
// baseline. The only behavioral difference is the pinned Java extension version
// and the enforced destination convention. It does not launch Zed, install the
// dev extension, modify the official Java extension, or choose a compatibility
// contract; those remain explicit driven-run steps (see ../README.md).

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JAVA_EXTENSION_VERSION = "6.8.23";
const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "..", "..", "..");
const fixture = path.join(repository, "tests", "fixtures", "spring-boot-basic");

if (process.argv[2] === "--self-test") {
  selfTest();
} else if (process.argv.length === 6 && process.argv[2] === "--prepare") {
  prepare(path.resolve(process.argv[3]), path.resolve(process.argv[4]), path.resolve(process.argv[5]));
} else {
  process.stderr.write(
    "usage:\n" +
      "  node prepare_s016.mjs --prepare <official-java-6.8.23-profile> <fresh-root> <java-home>\n" +
      "  node prepare_s016.mjs --self-test\n\n" +
      "<fresh-root> must be an absent, direct child of the repository tmp/ whose\n" +
      "basename starts with \"s016\". The Java extension in the source profile must\n" +
      `report version ${JAVA_EXTENSION_VERSION}.\n`,
  );
  process.exit(2);
}

function prepare(source, root, javaHome) {
  requireDirectory(source, "official Java source profile");
  requireDirectory(javaHome, "JAVA_HOME");
  requireFreshS016Root(root);

  const profile = path.join(root, "profile");
  const worktree = path.join(root, "worktree");
  const evidence = path.join(root, "evidence");
  const xdgCache = path.join(root, "xdg-cache");
  const xdgData = path.join(root, "xdg-data");
  const xdgState = path.join(root, "xdg-state");

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
  assert.match(javaManifest, /^id = "java"$/m, "source Java extension id must be java");
  assert.match(
    javaManifest,
    new RegExp(`^version = "${escapeRegExp(JAVA_EXTENSION_VERSION)}"$`, "m"),
    `source Java extension must report version ${JAVA_EXTENSION_VERSION}`,
  );

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
  assert.equal(
    index.extensions?.java?.manifest?.version,
    JAVA_EXTENSION_VERSION,
    `source extension index must report Java ${JAVA_EXTENSION_VERSION}`,
  );
  index.extensions = { java: index.extensions.java };
  fs.writeFileSync(path.join(profile, "extensions", "index.json"), `${JSON.stringify(index, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.writeFileSync(path.join(profile, "config", "settings.json"), `${JSON.stringify(settings(javaHome, profile), null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  const manifest = {
    status: "prepared",
    spike: "s016",
    target: "macOS-arm64",
    javaExtension: JAVA_EXTENSION_VERSION,
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
  return manifest;
}

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
  assert.equal(fs.existsSync(directory) && fs.statSync(directory).isDirectory(), true, `${label} must be a directory`);
}

function requireFreshS016Root(root) {
  assert.equal(fs.existsSync(root), false, "local spike root must be fresh (absent)");
  assert.equal(path.dirname(root), path.join(repository, "tmp"), "root must be a direct child of repository tmp/");
  assert.equal(
    path.basename(root).startsWith("s016"),
    true,
    'root basename must start with "s016"',
  );
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
  return fs
    .readdirSync(current, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.join(prefix, entry.name);
      return entry.isDirectory() ? walk(directory, relative, path.join(current, entry.name)) : [relative];
    })
    .sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Prove the tool's logic without a live 6.8.23 install by building a synthetic
// source profile shaped exactly like a real one, running --prepare against a
// temp destination, and asserting the staged profile, index, settings, and
// manifest. The destination convention is exercised separately because it is
// pinned to repository tmp/.
function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "s016-selftest-"));
  const roots = [];
  const freshRoot = () => {
    const root = path.join(repository, "tmp", `s016-selftest-scratch-${process.pid}-${Math.random().toString(36).slice(2)}`);
    roots.push(root);
    return root;
  };
  try {
    const source = path.join(scratch, "source");
    const home = path.join(scratch, "jdk");
    buildSyntheticSource(source);
    buildSyntheticJavaHome(home);

    // Destination-convention guards.
    assert.throws(() => requireFreshS016Root(path.join(repository, "tmp", "wrong-prefix")), /basename must start/);
    assert.throws(() => requireFreshS016Root(path.join(scratch, "s016-not-in-tmp")), /direct child of repository tmp/);

    // Version guard: a 6.8.21 source must be rejected by the 6.8.23 tool.
    const source2021 = path.join(scratch, "source-6821");
    buildSyntheticSource(source2021, "6.8.21");
    assert.throws(
      () => prepare(source2021, freshRoot(), home),
      /must report version 6\.8\.23/,
      "the 6.8.23 tool must reject a 6.8.21 source",
    );

    const manifest = prepare(source, freshRoot(), home);
    assert.equal(manifest.javaExtension, JAVA_EXTENSION_VERSION);
    assert.equal(manifest.status, "prepared");
    assert.equal(manifest.runtimeJdk, "25.0.3");
    const staged = fs.readFileSync(path.join(manifest.profile, "extensions", "installed", "java", "extension.toml"), "utf8");
    assert.match(staged, /^version = "6\.8\.23"$/m);
    const index = JSON.parse(fs.readFileSync(path.join(manifest.profile, "extensions", "index.json"), "utf8"));
    assert.deepEqual(Object.keys(index.extensions), ["java"]);
    assert.equal(index.extensions.java.manifest.version, "6.8.23");
    const settingsOut = JSON.parse(fs.readFileSync(path.join(manifest.profile, "config", "settings.json"), "utf8"));
    assert.deepEqual(settingsOut.languages.Java.language_servers, ["jdtls", "zed-spring-tools"]);
    assert.equal(settingsOut.log.lsp, "trace");
    assert.equal(fs.existsSync(path.join(manifest.worktree, "pom.xml")), true);
    process.stdout.write("s016 prepare self-test: ok\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

function buildSyntheticSource(source, version = JAVA_EXTENSION_VERSION) {
  const javaExtension = path.join(source, "extensions", "installed", "java");
  const javaWork = path.join(source, "extensions", "work", "java");
  fs.mkdirSync(javaExtension, { recursive: true });
  fs.mkdirSync(path.join(javaWork, "jdtls"), { recursive: true });
  fs.mkdirSync(path.join(javaWork, "bin"), { recursive: true });
  fs.mkdirSync(path.join(source, "fixed"), { recursive: true });
  fs.writeFileSync(path.join(javaExtension, "extension.toml"), `id = "java"\nname = "Java"\nversion = "${version}"\n`);
  fs.writeFileSync(path.join(javaWork, "jdtls", "plugin.jar"), "stub");
  fs.writeFileSync(path.join(javaWork, "bin", "helper"), "stub");
  fs.writeFileSync(path.join(source, "fixed", "java-lsp-proxy"), "stub");
  fs.writeFileSync(
    path.join(source, "extensions", "index.json"),
    `${JSON.stringify({ extensions: { java: { manifest: { version } }, html: { manifest: { version: "0.0.0" } } } }, null, 2)}\n`,
  );
}

function buildSyntheticJavaHome(home) {
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, "release"), 'JAVA_VERSION="25.0.3"\n');
}
