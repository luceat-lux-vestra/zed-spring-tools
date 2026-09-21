import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const policy = JSON.parse(readFileSync(new URL("../.github/issue-metadata-policy.json", import.meta.url)));
const workflow = readFileSync(new URL("../.github/workflows/issue-metadata.yml", import.meta.url), "utf8");
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


test("manual issue backlog reconciliation is review-first and opt-in", () => {
  assert.match(workflow, /dry_run:[\s\S]*?default:\s*true/);
  assert.match(workflow, /backfill:[\s\S]*?default:\s*false/);
  assert.match(
    workflow,
    /context\.eventName === "workflow_dispatch" && backfill && !dryRun && context\.ref !== defaultBranchRef/
  );
  assert.ok(workflow.includes("Mutating backfill must run from"));
  assert.ok(workflow.includes("github.event.repository.default_branch"));
});

test("manual dispatch cannot mutate the label catalog unless backfill is selected", () => {
  assert.match(
    workflow,
    /if \(context\.eventName === "issues"\) \{\s+await ensureLabels\(\);\s+await reconcile/
  );
  assert.match(
    workflow,
    /else if \(context\.eventName === "workflow_dispatch" && backfill\) \{\s+if \(!dryRun\) await ensureLabels\(\);/
  );
  assert.equal((workflow.match(/await ensureLabels\(\);/g) || []).length, 2);
  assert.ok(workflow.includes("No backlog reconciliation selected; no label or issue mutation performed."));
});
