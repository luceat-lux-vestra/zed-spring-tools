#!/usr/bin/env node

// S016 disposable staging. Builds one fresh isolated Zed profile plus a Spring
// Boot fixture worktree so the 6.8.23 driven run starts in a clean sandbox that
// does not touch the real Zed configuration.
//
// Unlike scripts/prepare-local-poc.mjs, this does NOT copy an installed `java`
// extension: official Java 6.8.23 is not in the Zed extension registry (which
// still pins 6.8.21), so it must be dev-installed from source. Both the `java`
// (6.8.23) source clone and the `zed-spring-tools` dev extension are installed
// into the staged profile by hand before the fixture opens, preserving the S014
// ordering. This tool only stages the profile, settings, XDG roots, evidence
// dir, and fixture; it does not launch Zed, install extensions, download
// servers, or drive UI. See ../README.md for the full runbook.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "..", "..", "..");
const fixture = path.join(repository, "tests", "fixtures", "spring-boot-basic");

if (process.argv[2] === "--self-test") {
  selfTest();
} else if (process.argv.length === 5 && process.argv[2] === "--stage") {
  stage(path.resolve(process.argv[3]), path.resolve(process.argv[4]));
} else {
  process.stderr.write(
    "usage:\n" +
      "  node stage_s016.mjs --stage <fresh-root> <java-home>\n" +
      "  node stage_s016.mjs --self-test\n\n" +
      "<fresh-root> must be an absent, direct child of the repository tmp/ whose\n" +
      "basename starts with \"s016\". <java-home> is the pinned Temurin 25.0.3.\n" +
      "Dev-install java 6.8.23 and zed-spring-tools into the staged profile before\n" +
      "opening the worktree; this tool does not do that.\n",
  );
  process.exit(2);
}

function stage(root, javaHome) {
  requireDirectory(javaHome, "JAVA_HOME");
  requireDirectory(fixture, "Spring Boot fixture");
  requireFreshS016Root(root);

  const profile = path.join(root, "profile");
  const worktree = path.join(root, "worktree");
  const evidence = path.join(root, "evidence");
  const xdgCache = path.join(root, "xdg-cache");
  const xdgData = path.join(root, "xdg-data");
  const xdgState = path.join(root, "xdg-state");

  fs.mkdirSync(path.join(profile, "config"), { recursive: true });
  fs.mkdirSync(path.join(profile, "extensions", "installed"), { recursive: true });
  for (const directory of [evidence, xdgCache, xdgData, xdgState]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.cpSync(fixture, worktree, { recursive: true, dereference: false });

  fs.writeFileSync(path.join(profile, "config", "settings.json"), `${JSON.stringify(settings(javaHome), null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  const manifest = {
    status: "staged",
    spike: "s016",
    target: "macOS-arm64",
    javaExtension: "6.8.23 (dev-install from source, not staged here)",
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
  fs.writeFileSync(path.join(evidence, "staged.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// Isolated-profile settings: turn on the LSP trace, pin the JDK and disable its
// auto-download, keep auto-update and AI off, and map the Java/Properties/YAML
// language servers. The proxy and debug-jar paths are left to the dev-installed
// java extension, which manages its own downloaded binaries.
function settings(jdk) {
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
  assert.equal(path.basename(root).startsWith("s016"), true, 'root basename must start with "s016"');
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

// Prove the staging logic without touching a real Zed: synthesize a JDK home,
// stage into a temporary tmp/s016 root, assert the settings, fixture copy, and
// manifest, check the destination-convention guards, and clean up.
function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "s016-selftest-"));
  const roots = [];
  const freshRoot = () => {
    const root = path.join(repository, "tmp", `s016-selftest-scratch-${process.pid}-${Math.random().toString(36).slice(2)}`);
    roots.push(root);
    return root;
  };
  try {
    const home = path.join(scratch, "jdk");
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, "release"), 'JAVA_VERSION="25.0.3"\n');

    assert.throws(() => requireFreshS016Root(path.join(repository, "tmp", "wrong-prefix")), /basename must start/);
    assert.throws(() => requireFreshS016Root(path.join(scratch, "s016-not-in-tmp")), /direct child of repository tmp/);

    const manifest = stage(freshRoot(), home);
    assert.equal(manifest.status, "staged");
    assert.equal(manifest.runtimeJdk, "25.0.3");
    const settingsOut = JSON.parse(fs.readFileSync(path.join(manifest.profile, "config", "settings.json"), "utf8"));
    assert.deepEqual(settingsOut.languages.Java.language_servers, ["jdtls", "zed-spring-tools"]);
    assert.equal(settingsOut.log.lsp, "trace");
    assert.equal(settingsOut.lsp.jdtls.settings.java_home, home);
    assert.equal(settingsOut.lsp.jdtls.settings.jdk_auto_download, false);
    assert.equal(fs.existsSync(path.join(manifest.worktree, "pom.xml")), true);
    assert.equal(fs.existsSync(path.join(manifest.profile, "extensions", "installed")), true);
    // Re-staging into the same root must be refused (not fresh).
    assert.throws(() => stage(manifest.profile.replace(/\/profile$/, ""), home), /must be fresh/);
    process.stdout.write("s016 stage self-test: ok\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}
