#!/usr/bin/env node
// Check that THIRD_PARTY_NOTICES.md still describes the dependency set that is
// actually redistributed.
//
// The extension registry builds `extension.wasm` from this source and serves it
// to every user, so the locked Cargo tree is redistributed even though this
// repository commits no binary. The notice records two derivable facts about
// that tree — the locked package count and the direct dependency table — beside
// a license audit that only a human can perform. A dependency bump changes the
// derivable facts and leaves the audit text looking current, which is how the
// notice fell out of date once before (see docs/preview-release-gate.md).
//
// This script only verifies the derivable facts. It never rewrites the notice:
// a version move can invalidate the license reading, and that reading is not
// something a script may invent.
//
// Dependency-free by design, matching the coordinator. Run from the repo root:
//   node scripts/check-third-party-notices.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOTICES = "THIRD_PARTY_NOTICES.md";

const manifest = readFileSync(join(ROOT, "Cargo.toml"), "utf8");
const lockfile = readFileSync(join(ROOT, "Cargo.lock"), "utf8");
const notices = readFileSync(join(ROOT, NOTICES), "utf8");

const problems = [];

// Direct runtime dependencies. Dev-dependencies are not compiled into the
// distributed artifact, so the notice does not list them.
function directDependencies(toml) {
  const section = toml.match(/^\[dependencies\]\n([\s\S]*?)(?=^\[|\Z)/m);
  if (!section) return new Map();
  const found = new Map();
  for (const line of section[1].split("\n")) {
    const entry = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!entry) continue;
    const version = entry[2].match(/^"=?([^"]+)"|version\s*=\s*"=?([^"]+)"/);
    found.set(entry[1], version ? (version[1] ?? version[2]) : null);
  }
  return found;
}

// Every locked package as a {name, version} entry. `Cargo.lock` is the
// authoritative pinned set the notice cites. Entries, not unique names: one
// crate may be locked at two versions (`hashbrown` is, today) and the notice
// counts packages.
function lockedPackages(lock) {
  const found = [];
  for (const block of lock.split("[[package]]").slice(1)) {
    const name = block.match(/^\s*name\s*=\s*"([^"]+)"/m);
    const version = block.match(/^\s*version\s*=\s*"([^"]+)"/m);
    if (name && version) found.push({ name: name[1], version: version[1] });
  }
  return found;
}

const direct = directDependencies(manifest);
const locked = lockedPackages(lockfile);
const rootCrate = manifest.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
const versionsOf = (name) =>
  locked.filter((entry) => entry.name === name).map((entry) => entry.version);
// "besides this crate": the lockfile counts the root crate too.
const lockedBesidesRoot = locked.length - versionsOf(rootCrate).length;

// "`Cargo.lock` is the authoritative pinned set: 106 packages besides this crate"
const claimedTotal = notices.match(/(\d+)\s+packages besides this crate/);
if (!claimedTotal) {
  problems.push(`${NOTICES} no longer states a locked package count ("N packages besides this crate").`);
} else if (Number(claimedTotal[1]) !== lockedBesidesRoot) {
  problems.push(
    `${NOTICES} claims ${claimedTotal[1]} locked packages besides this crate; Cargo.lock has ${lockedBesidesRoot}.`,
  );
}

// "Across the whole locked tree, 104 of the 106 packages were read ..." — the
// audited count is a human reading, but the total it cites must be the same one.
const auditedOf = notices.match(/(\d+) of the (\d+) packages/);
if (auditedOf && claimedTotal && auditedOf[2] !== claimedTotal[1]) {
  problems.push(
    `${NOTICES} audits "${auditedOf[1]} of the ${auditedOf[2]} packages" but states a locked total of ${claimedTotal[1]} elsewhere.`,
  );
}

// The direct dependency table: | `crate` | version | license |
const tabled = new Map();
for (const row of notices.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/gm)) {
  tabled.set(row[1], row[2]);
}

for (const [name, required] of direct) {
  if (!tabled.has(name)) {
    problems.push(`${NOTICES} does not list the direct dependency \`${name}\`.`);
    continue;
  }
  // The notice states the version that ships, which is the resolved one; the
  // exact `=` pin in Cargo.toml should agree with it.
  const shipped = versionsOf(name);
  if (shipped.length > 0 && !shipped.includes(tabled.get(name))) {
    problems.push(
      `${NOTICES} lists \`${name}\` ${tabled.get(name)}; Cargo.lock resolves ${shipped.join(", ")}.`,
    );
  }
  if (required && shipped.length > 0 && !shipped.includes(required)) {
    problems.push(
      `Cargo.toml pins \`${name}\` ${required} but Cargo.lock resolves ${shipped.join(", ")}.`,
    );
  }
}

for (const name of tabled.keys()) {
  if (versionsOf(name).length > 0 && !direct.has(name)) {
    problems.push(`${NOTICES} lists \`${name}\` as a direct dependency; Cargo.toml no longer declares it.`);
  }
}

if (problems.length > 0) {
  process.stderr.write(
    `${NOTICES} is out of date with the dependency set it describes:\n` +
      problems.map((problem) => `  - ${problem}\n`).join("") +
      "Update the notice, including the license reading for any changed version.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `${NOTICES} matches Cargo.lock: ${lockedBesidesRoot} locked packages, ${direct.size} direct dependencies.\n`,
);
