#!/usr/bin/env node
// Reconcile every surface that states the pinned Spring Tools identity against
// one canonical inventory: `protocol/spring-artifacts.json`.
//
// The pinned upstream distribution is this product's main supply-chain and
// correctness boundary, and its identity — release tag, source commit, VSIX
// name, URL, byte size, archive digest, and the digest of each of the six files
// extracted from it — is necessarily restated in several places. The Rust
// adapter needs it as constants because it verifies the download; `extension.toml`
// needs it as capability path segments because that is what authorises the
// download at all; the coordinator needs the JAR name to launch the server; and
// the notices, compatibility record and refresh gate state it to a reader.
//
// Retyped digests are exactly the kind of thing that is wrong in one place. Left
// to itself a mismatch surfaces at a user's install as a checksum failure, or —
// worse for the capability path — as a download the extension is not permitted
// to make. This check moves that failure into CI.
//
// It is fail-closed in both directions. A declared surface that stops matching
// the canonical manifest fails; and a file that is *not* declared here but
// carries pin identity also fails, so a seventh surface added later cannot be
// silently unchecked. Historical evidence documents are declared as such: they
// record what was true on a date and must not be rewritten by a later refresh.
//
// This check does not, and must not, replace the staged compatibility-refresh
// gate in `docs/pinned-release-refresh-gate.md`. Agreement between files proves
// the pin was applied consistently. It proves nothing about whether the new
// release behaves as the compatibility record claims; only driven external
// evidence does that.
//
// Dependency-free by design. Run from the repository root:
//   node scripts/check-pin-inventory.mjs [--root <dir>]

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, posix, relative, sep } from "node:path";

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf("--root");
const ROOT =
  rootFlag === -1 ? join(dirname(fileURLToPath(import.meta.url)), "..") : argv[rootFlag + 1];

const CANONICAL = "protocol/spring-artifacts.json";

const problems = [];
const fail = (message) => problems.push(message);
const read = (file) => readFileSync(join(ROOT, file), "utf8");

const manifest = JSON.parse(read(CANONICAL));
const pin = manifest.springTools;
const required = pin.requiredFiles;
const serverJar = posix.basename(required[0].path);
const digests = new Set([pin.sha256, ...required.map((entry) => entry.sha256)]);

// Every string that identifies the pin. The sweep at the end treats any of
// these appearing in an undeclared file as an unchecked surface.
const identities = [pin.tag, pin.asset, pin.sourceCommit, ...digests];

// --- declared surfaces ---------------------------------------------------
//
// `check` runs against a reconciled surface. `mentions` is a document that
// states the current pin in prose and must move with it. `historical` is dated
// evidence: it names whichever pin was current when it was written, and a later
// refresh must not rewrite it.

const surfaces = [
  {
    file: CANONICAL,
    role: "canonical",
    check() {
      if (!pin.url.includes(pin.tag) || !pin.url.endsWith(pin.asset)) {
        fail(`${CANONICAL}: \`url\` does not resolve to tag \`${pin.tag}\` and asset \`${pin.asset}\`.`);
      }
      if (pin.url.includes("latest")) {
        fail(`${CANONICAL}: \`url\` points at a moving \`latest\` reference rather than the pinned release.`);
      }
      for (const entry of [{ path: pin.asset, sha256: pin.sha256 }, ...required]) {
        if (!/^[0-9a-f]{64}$/.test(entry.sha256)) {
          fail(`${CANONICAL}: \`${entry.path}\` has no well-formed SHA-256 digest.`);
        }
      }
      if (digests.size !== required.length + 1) {
        fail(`${CANONICAL}: two pinned artifacts share a digest, so a swap between them would not be detected.`);
      }
    },
  },
  {
    file: "src/artifacts.rs",
    role: "reconciled",
    // The extension verifies the download against these constants, so a
    // mismatch here is the difference between a refusal and an install.
    check() {
      const text = read("src/artifacts.rs");
      const constant = (name) => text.match(new RegExp(`const ${name}: &str = "([^"]*)"`))?.[1];
      const expect = (name, actual, wanted) => {
        if (actual !== wanted) {
          fail(`src/artifacts.rs: \`${name}\` is ${JSON.stringify(actual)}; ${CANONICAL} says ${JSON.stringify(wanted)}.`);
        }
      };
      expect("VERSION", constant("VERSION"), pin.tag);
      expect("ASSET", constant("ASSET"), pin.asset);
      expect("URL", constant("URL"), pin.url);
      expect("SHA256", constant("SHA256"), pin.sha256);

      const size = text.match(/const SIZE: u64 = ([0-9_]+);/)?.[1]?.replaceAll("_", "");
      if (Number(size) !== pin.size) {
        fail(`src/artifacts.rs: \`SIZE\` is ${size}; ${CANONICAL} says ${pin.size}.`);
      }

      const block = text.match(/const REQUIRED: &\[\(&str, &str\)\] = &\[([\s\S]*?)\n\];/)?.[1] ?? "";
      const pairs = [...block.matchAll(/"([^"]+)",\s*"([0-9a-f]{64})"/g)].map((match) => ({
        path: match[1],
        sha256: match[2],
      }));
      if (pairs.length !== required.length) {
        fail(`src/artifacts.rs: \`REQUIRED\` lists ${pairs.length} artifacts; ${CANONICAL} lists ${required.length}.`);
      }
      required.forEach((entry, index) => {
        const found = pairs[index];
        if (!found) return;
        if (found.path !== entry.path) {
          fail(`src/artifacts.rs: \`REQUIRED\`[${index}] path is \`${found.path}\`; ${CANONICAL} says \`${entry.path}\`.`);
        } else if (found.sha256 !== entry.sha256) {
          fail(`src/artifacts.rs: \`REQUIRED\` digest for \`${entry.path}\` is \`${found.sha256}\`; ${CANONICAL} says \`${entry.sha256}\`.`);
        }
      });
      // A digest left behind by a partial refresh belongs to no pinned artifact.
      for (const stray of text.match(/[0-9a-f]{64}/g) ?? []) {
        if (!digests.has(stray)) {
          fail(`src/artifacts.rs carries the digest \`${stray}\`, which belongs to no artifact in ${CANONICAL}.`);
        }
      }
    },
  },
  {
    file: "extension.toml",
    role: "reconciled",
    // The `download_file` capability is the allowlist Zed enforces. If the path
    // segments lag the pin, the extension cannot fetch what it verifies.
    check() {
      const text = read("extension.toml");
      const block = text.match(/\[\[capabilities\]\]\s+kind = "download_file"([\s\S]*?)\]/)?.[0];
      if (!block) {
        fail("extension.toml declares no `download_file` capability, so the pinned release cannot be fetched.");
        return;
      }
      const host = block.match(/host = "([^"]+)"/)?.[1];
      const segments = [...block.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((match) => match[1]);
      const url = `https://${host}/${segments.join("/")}`;
      if (url !== pin.url) {
        fail(`extension.toml: the \`download_file\` capability authorises \`${url}\`; ${CANONICAL} pins \`${pin.url}\`.`);
      }
    },
  },
  {
    file: "coordinator/src/main.mjs",
    role: "reconciled",
    check() {
      const text = read("coordinator/src/main.mjs");
      const jar = text.match(/const SERVER_JAR = "([^"]+)"/)?.[1];
      const version = text.match(/const SPRING_TOOLS_VERSION = "([^"]+)"/)?.[1];
      if (jar !== serverJar) {
        fail(`coordinator/src/main.mjs: \`SERVER_JAR\` is ${JSON.stringify(jar)}; the pinned server artifact is \`${serverJar}\`.`);
      }
      if (version !== pin.tag) {
        fail(`coordinator/src/main.mjs: \`SPRING_TOOLS_VERSION\` is ${JSON.stringify(version)}; ${CANONICAL} says \`${pin.tag}\`.`);
      }
    },
  },
  {
    file: "THIRD_PARTY_NOTICES.md",
    role: "reconciled",
    states: [pin.tag, pin.asset],
  },
  {
    file: "COMPATIBILITY.md",
    role: "reconciled",
    states: [pin.tag, pin.asset, pin.sourceCommit],
  },
  {
    file: "docs/pinned-release-refresh-gate.md",
    role: "reconciled",
    states: [pin.tag, pin.asset],
  },

  // Prose that names the current pin. A refresh that leaves one of these behind
  // makes the repository state two different pins to a reader.
  { file: "README.md", role: "mentions", states: [pin.tag] },
  { file: "LIMITATIONS.md", role: "mentions", states: [pin.tag] },
  { file: "docs/capability-inventory.md", role: "mentions", states: [pin.tag] },
  { file: "docs/implementation-plan.md", role: "mentions", states: [pin.tag] },

  // Dated evidence. These record what was observed against a named release and
  // are deliberately not reconciled; a refresh adds a new document.
  { file: "docs/research/", role: "historical" },
  // Spike plans and their disposable harnesses. AGENTS.md excludes spike code
  // from production and a spike is a frozen experiment against the artifacts it
  // named at the time, so a later pin refresh must not rewrite either. Several
  // of these do carry a pinned digest today (the reactor-core bundle), which is
  // why they are declared rather than merely skipped.
  { file: "docs/spikes/", role: "historical" },
  { file: "spikes/", role: "historical" },
];

for (const surface of surfaces) {
  if (surface.role === "historical") continue;
  let text;
  try {
    text = read(surface.file);
  } catch {
    fail(`${surface.file} is a declared pin surface but is missing. Remove it from scripts/check-pin-inventory.mjs if that is intended.`);
    continue;
  }
  if (surface.check) surface.check();
  for (const value of surface.states ?? []) {
    if (!text.includes(value)) {
      fail(`${surface.file} does not state \`${value}\`, so it no longer describes the pin in ${CANONICAL}.`);
    }
  }
}

// --- fail closed on an undeclared surface --------------------------------

const SKIP_DIRECTORIES = new Set([".git", ".worktrees", "target", "node_modules", "tmp"]);

function* walk(directory) {
  for (const name of readdirSync(directory).sort()) {
    if (SKIP_DIRECTORIES.has(name)) continue;
    const full = join(directory, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const declared = surfaces.map((surface) => surface.file);
const isDeclared = (path) =>
  declared.some((entry) => (entry.endsWith("/") ? path.startsWith(entry) : path === entry));

for (const full of walk(ROOT)) {
  const path = relative(ROOT, full).split(sep).join("/");
  if (isDeclared(path)) continue;
  let text;
  try {
    text = readFileSync(full, "utf8");
  } catch {
    continue;
  }
  const found = identities.find((value) => text.includes(value));
  if (found) {
    fail(
      `${path} states the pinned Spring Tools identity \`${found}\` but is not a declared pin surface. ` +
        `Add it to scripts/check-pin-inventory.mjs — as reconciled if it must track the pin, or as historical if it records a dated observation.`,
    );
  }
}

if (problems.length > 0) {
  process.stderr.write(
    `Spring Tools pin inventory does not reconcile with ${CANONICAL}:\n` +
      problems.map((problem) => `  - ${problem}\n`).join("") +
      `${CANONICAL} is canonical. Refreshing the pin means moving every surface, and the refresh gate in docs/pinned-release-refresh-gate.md still owns whether the new release may be claimed.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Spring Tools pin inventory reconciles with ${CANONICAL}: ${pin.tag} (${pin.asset}), ` +
    `${required.length + 1} pinned digests across ${surfaces.filter((surface) => surface.role !== "historical").length} declared surfaces.\n`,
);
