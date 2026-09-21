import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const policy = JSON.parse(readFileSync(new URL("../.github/issue-metadata-policy.json", import.meta.url)));
const workflowSource = readFileSync(new URL("../.github/workflows/issue-metadata.yml", import.meta.url), "utf8");
const rules = policy.rules.map(({ pattern, label }) => [new RegExp(pattern, "i"), label]);

function classify(title) {
  const value = String(title || "").trim();
  for (const [pattern, label] of rules) {
    if (pattern.test(value)) return label;
  }
  return null;
}

test("explicit repository title protocol maps deterministically", () => {
  const cases = new Map([
    ["bug(runtime): crash", "bug"],
    ["fix(protocol): stale response", "bug"],
    ["docs: correct README", "documentation"],
    ["research(runtime): inspect upstream", "research"],
    ["decision(packaging): choose boundary", "decision"],
    ["design(runtime): change contract", "decision"],
    ["spike(s017): bounded probe", "spike"],
    ["task(release): verify registry install", "task"],
    ["test(platform): validate host", "task"],
    ["hardening(reassessment): refresh controls", "task"],
    ["track(release): v1.0 readiness", "track"],
    ["epic(repo): repository hardening", "epic"],
    ["Close live-data show, hide, and refresh parity", null],
  ]);
  for (const [title, expected] of cases) assert.equal(classify(title), expected, title);
});

test("policy never declares heuristic area/state inference", () => {
  assert.equal(policy.cardinality, "one-managed-kind-per-issue");
  assert.equal(policy.body_inference, false);
  assert.equal(policy.area_inference, false);
  assert.equal(policy.state_inference, false);
});

test("managed labels are unique and every rule targets one", () => {
  const names = policy.managed_labels.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
  for (const { label } of policy.rules) assert.ok(names.includes(label), label);
});

test("manual issue backfill is dry-run first and explicit opt-in", () => {
  assert.match(workflowSource, /dry_run:\n[\s\S]*?default: true/);
  assert.match(workflowSource, /backfill:\n[\s\S]*?default: false/);
});

test("mutating issue backfill is bound to default branch", () => {
  assert.ok(workflowSource.includes("const defaultBranchRef = `refs/heads/${context.payload.repository.default_branch}`;"));
  assert.ok(workflowSource.includes('context.eventName === "workflow_dispatch" && backfill && !dryRun && context.ref !== defaultBranchRef'));
  assert.ok(workflowSource.includes("Mutating backfill must run from"));
});

test("issue metadata write authority stays narrow", () => {
  assert.ok(workflowSource.includes("issues: write # Required only for canonical issue metadata reconciliation."));
  assert.ok(workflowSource.includes("ref: ${{ github.event.repository.default_branch }}"));
  assert.ok(workflowSource.includes("persist-credentials: false"));
});
