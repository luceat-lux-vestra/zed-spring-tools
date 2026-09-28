#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MATRIX = path.join(ROOT, "protocol", "d007-capability-acceptance.json");

const evidenceDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
const output = process.argv[3]
  ? path.resolve(process.argv[3])
  : evidenceDir
    ? path.join(evidenceDir, "d007-capability-acceptance-summary.json")
    : null;

if (!evidenceDir || !output) {
  process.stderr.write(
    "usage: node scripts/d007-capability-acceptance-summary.mjs <evidence-dir> [output-json]\n",
  );
  process.exit(2);
}

const matrix = JSON.parse(fs.readFileSync(MATRIX, "utf8"));
assert.equal(matrix.schemaVersion, 1);
assert.equal(matrix.decision, "D007");

const staged = readJsonIfPresent(path.join(evidenceDir, "staged.json"));
const sourceHead = staged?.sourceHead ?? discoverSourceHead(evidenceDir);

const entries = matrix.entries.map((entry) => evaluateEntry(entry, evidenceDir));
const unresolved = entries.filter((entry) => entry.acceptance === "PENDING");
const failed = entries.filter((entry) => entry.acceptance === "FAIL");
const accepted = entries.filter((entry) => entry.acceptance === "ACCEPTED");
const terminal = entries.filter((entry) => entry.acceptance === "TERMINAL");

const summary = {
  schemaVersion: 1,
  decision: "D007",
  sourceHead,
  sourceInventoryVersion: matrix.sourceInventoryVersion,
  totalCapabilities: entries.length,
  acceptedCount: accepted.length,
  terminalCount: terminal.length,
  pendingCount: unresolved.length,
  failedCount: failed.length,
  releaseAcceptance:
    unresolved.length === 0 && failed.length === 0 ? "PASS" : "PENDING_OR_FAIL",
  entries,
  unresolvedCapabilities: unresolved.map((entry) => entry.capability),
  failedCapabilities: failed.map((entry) => entry.capability),
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + "\n");
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

function evaluateEntry(entry, evidenceDir) {
  if (
    entry.classification === "unaffected" ||
    entry.classification === "existing-blocker" ||
    entry.classification === "not-pursued"
  ) {
    return {
      capability: entry.capability,
      historicalState: entry.historicalState,
      classification: entry.classification,
      effectiveClaim: entry.currentClaim,
      acceptance: "TERMINAL",
      requirements: [],
    };
  }

  const requirements = (entry.requiredEvidence ?? []).map((requirement) =>
    evaluateRequirement(requirement, evidenceDir)
  );
  if (requirements.length === 0) {
    return {
      capability: entry.capability,
      historicalState: entry.historicalState,
      classification: entry.classification,
      effectiveClaim: "pending-d007",
      acceptance: "FAIL",
      requirements,
      failure: "pending row has no requiredEvidence",
    };
  }

  const explicitFailure = requirements.some((requirement) => requirement.status === "FAIL");
  const allPass = requirements.every((requirement) => requirement.status === "PASS");
  return {
    capability: entry.capability,
    historicalState: entry.historicalState,
    classification: entry.classification,
    effectiveClaim: allPass ? entry.historicalState : "pending-d007",
    acceptance: explicitFailure ? "FAIL" : allPass ? "ACCEPTED" : "PENDING",
    requirements,
  };
}

function evaluateRequirement(requirement, evidenceDir) {
  const source = requirement?.source;
  const check = requirement?.check;
  assert.equal(typeof source, "string");
  assert.equal(typeof check, "string");

  if (source === "standalone-capability-regression") {
    return evaluateCheckFile(
      source,
      check,
      path.join(evidenceDir, "standalone-capability-regression.json"),
      (json) => json?.checks?.[check],
    );
  }

  if (source === "desktop-gate") {
    const desktopFiles = {
      languageServerPreflight: "language-server-preflight-ready.json",
      mavenRunTaskExecution: "maven-generated-run-task-execution.json",
      gradleRunTaskExecution: "gradle-generated-run-task-execution.json",
    };
    const file = desktopFiles[check];
    if (!file) {
      return {
        source,
        check,
        status: "FAIL",
        reason: "unknown desktop-gate evidence key",
      };
    }
    return evaluateCheckFile(
      source,
      check,
      path.join(evidenceDir, file),
      (json) => json,
    );
  }

  return evaluateCheckFile(
    source,
    check,
    path.join(evidenceDir, `${source}.json`),
    (json) => json?.checks?.[check] ?? json?.[check],
  );
}

function evaluateCheckFile(source, check, file, select) {
  if (!fs.existsSync(file)) {
    return {
      source,
      check,
      status: "MISSING",
      file: path.basename(file),
    };
  }
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return {
      source,
      check,
      status: "FAIL",
      file: path.basename(file),
      reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const selected = select(json);
  const status = normalizedPass(selected);
  return {
    source,
    check,
    status: status === true ? "PASS" : status === false ? "FAIL" : "MISSING",
    file: path.basename(file),
  };
}

function normalizedPass(value) {
  if (value === true || value === "PASS" || value === "pass") return true;
  if (value === false || value === "FAIL" || value === "fail") return false;
  if (value && typeof value === "object") {
    if (value.status === "PASS" || value.status === "pass") return true;
    if (value.status === "FAIL" || value.status === "fail") return false;
  }
  return undefined;
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function discoverSourceHead(evidenceDir) {
  for (const name of [
    "standalone-capability-regression.json",
    "language-server-preflight-ready.json",
    "desktop-gate.json",
  ]) {
    const value = readJsonIfPresent(path.join(evidenceDir, name));
    if (typeof value?.sourceHead === "string") return value.sourceHead;
  }
  return null;
}
