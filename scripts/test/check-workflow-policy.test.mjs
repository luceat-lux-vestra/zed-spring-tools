// Negative fixtures for scripts/check-workflow-policy.mjs.
// These mutate disposable copies of the workflow tree and require the checker
// to reject exactly the drift that could otherwise make a gate disappear.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = join(REPOSITORY, "scripts/check-workflow-policy.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "workflow-policy-"));
  cpSync(join(REPOSITORY, ".github"), join(root, ".github"), { recursive: true });
  return root;
}

function edit(root, file, from, to) {
  const path = join(root, file);
  const before = readFileSync(path, "utf8");
  assert.ok(before.includes(from), `fixture anchor is stale: ${file}: ${from}`);
  writeFileSync(path, before.replace(from, to));
}

function run(root) {
  const result = spawnSync(process.execPath, [CHECK, "--root", root], { encoding: "utf8" });
  return { code: result.status, output: result.stdout + result.stderr };
}

function writeEphemeralWorkflow(root, { owner = "issue #189", retire = "remove after bounded research concludes" } = {}) {
  writeFileSync(
    join(root, ".github/workflows/research-lifecycle-fixture.yml"),
    [
      `# lifecycle-owner: ${owner}`,
      `# lifecycle-retire: ${retire}`,
      "name: Research lifecycle fixture",
      "",
      "on:",
      "  workflow_dispatch:",
      "",
      "permissions: {}",
      "",
      "jobs:",
      "  probe:",
      "    runs-on: ubuntu-latest",
      "    timeout-minutes: 5",
      "    steps:",
      "      - run: echo fixture",
      "",
    ].join("\n"),
  );
}

test("the real workflow tree satisfies the offline policy", () => {
  const result = run(REPOSITORY);
  assert.equal(result.code, 0, result.output);
});

test("ephemeral workflow with lifecycle metadata is accepted", () => {
  const root = fixture();
  writeEphemeralWorkflow(root);
  const result = run(root);
  assert.equal(result.code, 0, result.output);
});

test("ephemeral workflow without lifecycle owner is rejected", () => {
  const root = fixture();
  writeEphemeralWorkflow(root, { owner: "" });
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /lacks non-empty # lifecycle-owner:/);
});

test("ephemeral workflow without retirement condition is rejected", () => {
  const root = fixture();
  writeEphemeralWorkflow(root, { retire: "" });
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /lacks non-empty # lifecycle-retire:/);
});

test("retired Actions event policy 5154 remains tracked", () => {
  const policy = JSON.parse(
    readFileSync(join(REPOSITORY, ".github/merge-gate-policy.json"), "utf8"),
  );
  assert.deepEqual(policy.retired_actions_event_policy_ids, [5154]);
});

test("retired Actions event policy ids must be positive and unique", () => {
  const root = fixture();
  const path = join(root, ".github/merge-gate-policy.json");
  const policy = JSON.parse(readFileSync(path, "utf8"));
  policy.retired_actions_event_policy_ids = [5154, 5154, 0];
  writeFileSync(path, JSON.stringify(policy, null, 2) + "\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /lists retired Actions event policy id 5154 more than once/);
  assert.match(result.output, /not a positive integer/);
});

test("a renamed required producer is rejected", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "  rust:\n", "  rust:\n    name: Rust renamed\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /component `rust` emits `Rust renamed`, expected `rust`/);
});

test("pull_request_target is rejected for merge-gate contexts", () => {
  const root = fixture();
  const path = join(root, ".github/merge-gate-policy.json");
  const policy = JSON.parse(readFileSync(path, "utf8"));
  policy.contexts.find((entry) => entry.context === "Merge Gate").trigger = "pull_request_target";
  writeFileSync(path, JSON.stringify(policy, null, 2) + "\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /requires unprivileged `pull_request`/);
});

test("Merge Gate cannot omit a required component", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "needs: [rust, coordinator, review, workflow-security, platform-validation, codeql-runtime]",
    "needs: [rust, coordinator, workflow-security, platform-validation]",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /aggregate `Merge Gate` needs/);
});

test("Merge Gate must use exact always condition", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "if: ${{ always() }}",
    "if: ${{ success() }}",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /must use exact `if: always\(\)`/);
});

test("a reusable workflow caller does not require a caller-side timeout", () => {
  const result = run(REPOSITORY);
  assert.equal(result.code, 0, result.output);
  const ci = readFileSync(join(REPOSITORY, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /platform-validation:\n\s+name: Platform Validation\n\s+uses: \.\/\.github\/workflows\/platform-validation\.yml # zizmor: ignore\[self-repository\] actionlint 1\.7\.12 rejects GitHub's newer \$\/ self-repository syntax\./);
});

test("a path filter on a required workflow is rejected", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "  pull_request:\n", "  pull_request:\n    paths:\n      - src/**\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /filters its `pull_request` trigger/);
});

test("docs-only allowlist cannot include generated repository documents", () => {
  const root = fixture();
  const path = join(root, ".github/merge-gate-policy.json");
  const policy = JSON.parse(readFileSync(path, "utf8"));
  policy.docs_only_fast_path.exact_paths.push("CONTRIBUTORS.md");
  writeFileSync(path, JSON.stringify(policy, null, 2) + "\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /docs-only exact allowlist drifted/);
});

test("docs-only workflow scope cannot broaden beyond the accepted paths", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    '                or . == "LIMITATIONS.md"\n                or test("^docs/.*[.]md$")',
    '                or . == "LIMITATIONS.md"\n                or . == ".github/workflows/ci.yml"\n                or test("^docs/.*[.]md$")',
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /docs-only exact allowlist drifted/);
});

test("docs-only full-validation guard cannot disappear", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "if: ${{ steps.scope.outputs.docs_only != 'true' }}",
    "if: ${{ github.event_name == 'pull_request' }}",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /lost the docs-only full-validation guard/);
});

test("a mutable action ref is rejected", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", "actions/checkout@v7");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /uses `actions\/checkout@v7`, a mutable ref/);
});

test("a privileged workflow checkout is rejected", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/labeler.yml",
    "  pull_request:\n",
    "  pull_request_target:\n",
  );
  edit(
    root,
    ".github/workflows/labeler.yml",
    "    steps:\n",
    "    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /checks out code in a `pull_request_target` workflow/);
});


test("workflow-level write permission is rejected", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/labeler.yml",
    "permissions:\n  contents: read\n",
    "permissions:\n  contents: read\n  pull-requests: write\n",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /grants workflow-level pull-requests:write/);
});

test("inline workflow-level write mapping is rejected", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/labeler.yml",
    "permissions:\n  contents: read\n",
    "permissions: { contents: read, pull-requests: write }\n",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /unsupported workflow-level permissions syntax/);
});

test("workflow-level write-all is rejected", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/labeler.yml",
    "permissions:\n  contents: read\n",
    "permissions: write-all\n",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /unsupported workflow-level permissions syntax/);
});

test("CodeQL cannot be silently restored on pull requests", () => {
  const root = fixture();
  edit(root, ".github/workflows/codeql.yml", "on:\n  workflow_dispatch:", "on:\n  pull_request:\n  workflow_dispatch:");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /CodeQL must not trigger on pull_request/);
});

test("CodeQL manual exact-SHA dispatch cannot disappear", () => {
  const root = fixture();
  edit(root, ".github/workflows/codeql.yml", "  workflow_dispatch:", "  dispatch_retired:");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /CodeQL must support both scheduled and manual analysis/);
});

test("the Merge Gate cannot lose local needs JSON evaluation", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "toJSON(needs)", "needs.rust.result");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /Merge Gate lost local needs-result aggregation/);
});

test("a remote workflow-run polling step cannot return", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "  merge-gate:\n", "  merge-gate:\n    # Reintroduced: actions/workflows/ci.yml/runs\n");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /obsolete workflow-run\/Jobs evidence reuse/);
});

test("CodeQL Kotlin coverage refusal cannot disappear", () => {
  const root = fixture();
  edit(root, ".github/workflows/codeql.yml", "Reject unscanned Kotlin sources", "Skip unscanned Kotlin sources");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /CodeQL language, Kotlin, exact-SHA or raw SARIF assurance drifted/);
});

test("a third CodeQL workflow consumer is rejected", () => {
  const root = fixture();
  writeFileSync(
    join(root, ".github/workflows/shadow-codeql.yml"),
    [
      "name: Shadow CodeQL",
      "on:",
      "  workflow_dispatch:",
      "permissions: {}",
      "jobs:",
      "  analyze:",
      "    runs-on: ubuntu-24.04-arm",
      "    timeout-minutes: 5",
      "    steps:",
      "      - uses: github/codeql-action/analyze@33d7b85da1a04171e211befe2c739303b9a4c066",
      "",
    ].join("\n"),
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /CodeQL action consumers must be exactly canonical ci\.yml plus production codeql\.yml/);
});

test("PR CodeQL runtime upload cannot become trusted upload", () => {
  const root = fixture();
  edit(root, ".github/workflows/ci.yml", "          upload: never", "          upload: always");
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /PR CodeQL runtime adapter/);
});

test("PR CodeQL runtime cannot gain security-events write", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "      pull-requests: read\n    steps:",
    "      pull-requests: read\n      security-events: write\n    steps:",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /forbidden authority "security-events: write"/);
});

test("PR CodeQL runtime pin must match production", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "uses: github/codeql-action/init@33d7b85da1a04171e211befe2c739303b9a4c066 # v4.39.3",
    "uses: github/codeql-action/init@ffffffffffffffffffffffffffffffffffffffff # drift",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /PR CodeQL runtime immutable pin does not match production/);
});

test("PR CodeQL runtime exact-head checkout cannot drift to synthetic event SHA", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "          ref: ${{ github.event.pull_request.head.sha }}",
    "          ref: ${{ github.sha }}",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /lost required contract fragment "github.event.pull_request.head.sha"/);
});

test("PR CodeQL runtime cannot disappear behind a job-level condition", () => {
  const root = fixture();
  edit(
    root,
    ".github/workflows/ci.yml",
    "  codeql-runtime:\n    name: codeql-runtime\n",
    "  codeql-runtime:\n    name: codeql-runtime\n    if: ${{ github.event.pull_request.draft == false }}\n",
  );
  const result = run(root);
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /job-level .*if:/);
});
