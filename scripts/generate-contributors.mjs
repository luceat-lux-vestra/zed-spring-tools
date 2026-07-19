#!/usr/bin/env node
// Regenerate CONTRIBUTORS.md from git history.
//
// Human contributors only: AI assistants and bots are credited in commit
// `Co-authored-by:` trailers, never as project contributors. This reads both
// commit authors (mailmap-normalized) and co-author trailers, then drops any
// identity that matches the excluded set below.
//
// Dependency-free by design, matching the coordinator. Run from the repo root:
//   node scripts/generate-contributors.mjs         # write CONTRIBUTORS.md
//   node scripts/generate-contributors.mjs --check  # exit 1 if out of date

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "CONTRIBUTORS.md");

// Identities that are AI assistants or automation, not project contributors.
const EXCLUDED_EMAILS = new Set([
  "noreply@anthropic.com",
  "noreply@openai.com",
]);
const EXCLUDED_NAME_PATTERNS = [/\[bot\]/i, /\bcopilot\b/i, /\bcodex\b/i, /\bclaude\b/i];
const EXCLUDED_EMAIL_PATTERNS = [/\bcopilot@users\.noreply\.github\.com$/i, /\[bot\]/i];

function isExcluded(name, email) {
  const address = email.toLowerCase();
  if (EXCLUDED_EMAILS.has(address)) return true;
  if (EXCLUDED_EMAIL_PATTERNS.some((pattern) => pattern.test(address))) return true;
  if (EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(name))) return true;
  return false;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

// commit authors, mailmap-applied via %aN/%aE
const authorLines = git(["log", "--no-merges", "--pretty=format:%aN\t%aE"])
  .split("\n")
  .filter(Boolean);

// co-author trailers (mailmap is not applied to trailers, so match on email)
const trailerLines = git([
  "log",
  "--no-merges",
  "--pretty=format:%(trailers:key=Co-authored-by,valueonly,unfold)",
])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const contributors = new Map(); // email -> { name, count }

function record(name, email) {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName || !trimmedEmail) return;
  if (isExcluded(trimmedName, trimmedEmail)) return;
  const existing = contributors.get(trimmedEmail);
  if (existing) {
    existing.count += 1;
  } else {
    contributors.set(trimmedEmail, { name: trimmedName, count: 1 });
  }
}

for (const line of authorLines) {
  const [name, email] = line.split("\t");
  record(name ?? "", email ?? "");
}

for (const line of trailerLines) {
  const match = line.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) record(match[1], match[2]);
}

const ordered = [...contributors.values()].sort(
  (a, b) => b.count - a.count || a.name.localeCompare(b.name),
);

const body = [
  "# Contributors",
  "",
  "This list is generated from git history by",
  "[`scripts/generate-contributors.mjs`](scripts/generate-contributors.mjs) and",
  "kept current by CI. AI assistants and automation are credited in commit",
  "`Co-authored-by:` trailers and are intentionally excluded here.",
  "",
  ...ordered.map((person) => `- ${person.name}`),
  "",
].join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUTPUT, "utf8");
  } catch {
    current = "";
  }
  if (current !== body) {
    process.stderr.write(
      "CONTRIBUTORS.md is out of date. Run: node scripts/generate-contributors.mjs\n",
    );
    process.exit(1);
  }
  process.exit(0);
}

writeFileSync(OUTPUT, body);
process.stdout.write(`Wrote ${ordered.length} contributor(s) to CONTRIBUTORS.md\n`);
