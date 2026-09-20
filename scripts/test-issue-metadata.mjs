import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const policy = JSON.parse(readFileSync(new URL("../.github/issue-metadata-policy.json", import.meta.url)));
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
    ["track(release): v1.0 readiness", "track"],
    ["epic(repo): repository hardening", "epic"],
    ["Close live-data show, hide, and refresh parity", null],
  ]);
  for (const [title, expected] of cases) assert.equal(classify(title), expected, title);
});

test("policy never declares heuristic area/state inference", () => {
  assert.equal(policy.body_inference, false);
  assert.equal(policy.area_inference, false);
  assert.equal(policy.state_inference, false);
});

test("managed labels are unique and every rule targets one", () => {
  const names = policy.managed_labels.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
  for (const { label } of policy.rules) assert.ok(names.includes(label), label);
});
