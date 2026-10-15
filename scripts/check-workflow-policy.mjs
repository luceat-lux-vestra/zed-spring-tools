#!/usr/bin/env node
// Reconcile `.github/merge-gate-policy.json` — the accepted merge-gate and
// workflow-supply-chain policy — against what the repository actually does.
//
// Two independent things drift here, and only one of them lives in the tree:
//
//   1. the workflows, which decide *which* contexts are emitted and under what
//      conditions. A job renamed, given a `name:`, given an `if:`, or hidden
//      behind a top-level path filter still leaves a green pull request — the
//      required check simply stops existing, and GitHub reports no error.
//   2. the live `main` ruleset and merge settings, which decide which contexts
//      are *believed*. Those are edited in a web form, by a different person, on
//      a different day, and nothing in git records the change.
//
// Offline (the default, and what CI runs) this checks the workflow side plus the
// supply-chain invariants that are visible in the files. With `--live` it also
// reads the repository settings and ruleset back through `gh` and compares them
// to the policy; that is what the scheduled drift audit runs.
//
// Dependency-free by design, matching the coordinator and the other repository
// checks. The workflow files are small, hand-maintained and fully under this
// repository's control, so the scanner below reads them by indentation rather
// than pulling in a YAML parser. Run from the repository root:
//   node scripts/check-workflow-policy.mjs [--live] [--root <dir>]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const live = argv.includes("--live");
const rootFlag = argv.indexOf("--root");
const ROOT =
  rootFlag === -1
    ? join(dirname(fileURLToPath(import.meta.url)), "..")
    : argv[rootFlag + 1];

const WORKFLOW_DIR = join(ROOT, ".github/workflows");
const POLICY_FILE = ".github/merge-gate-policy.json";

const problems = [];
const fail = (message) => problems.push(message);


const EPHEMERAL_WORKFLOW = /^(?:research|temporary|tmp|experiment)(?:[-_].*)?\.ya?ml$/i;

function checkEphemeralWorkflowLifecycle(workflow) {
  if (!EPHEMERAL_WORKFLOW.test(workflow.file)) return;
  const header = workflow.text.split(/\r?\n/).slice(0, 20);
  const owner = header.some((line) => /^#\s*lifecycle-owner:[ \t]*\S[^\r\n]*$/i.test(line));
  const retire = header.some((line) => /^#\s*lifecycle-retire:[ \t]*\S[^\r\n]*$/i.test(line));
  if (!owner) {
    fail(`${workflow.file} is ephemeral and lacks non-empty # lifecycle-owner: header metadata.`);
  }
  if (!retire) {
    fail(`${workflow.file} is ephemeral and lacks non-empty # lifecycle-retire: header metadata.`);
  }
}

// --- workflow scanning ---------------------------------------------------

// Drop a trailing `#` comment without touching a `#` inside a quoted scalar.
function stripComment(line) {
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (character === "'" && !double) single = !single;
    else if (character === '"' && !single) double = !double;
    else if (character === "#" && !single && !double && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

const indentOf = (line) => line.length - line.trimStart().length;

function scanWorkflow(file, text) {
  const lines = text.split("\n").map((raw, index) => ({
    number: index + 1,
    raw,
    code: stripComment(raw).replace(/\s+$/, ""),
  }));
  const code = lines.filter((line) => line.code.trim() !== "");

  // Lines belonging to the top-level `key:` block, excluding the key itself.
  const blockOf = (key) => {
    const start = code.findIndex((line) => line.code.startsWith(`${key}:`));
    if (start === -1) return null;
    const body = [];
    for (const line of code.slice(start + 1)) {
      if (indentOf(line.code) === 0) break;
      body.push(line);
    }
    return { header: code[start], body };
  };

  const on = blockOf("on");
  const triggers = new Set();
  const pathFiltered = new Set();
  if (on) {
    const triggerIndent = Math.min(...on.body.map((line) => indentOf(line.code)));
    let current = null;
    for (const line of on.body) {
      const header = line.code.match(/^\s*([a-z_]+):/);
      if (header && indentOf(line.code) === triggerIndent) {
        current = header[1];
        triggers.add(current);
        continue;
      }
      if (current && /^\s*paths(-ignore)?:/.test(line.code)) pathFiltered.add(current);
    }
    // `on: [push, pull_request]` inline form.
    const inline = on.header.code.match(/^on:\s*\[(.+)\]/);
    if (inline) for (const name of inline[1].split(",")) triggers.add(name.trim());
  }

  const jobsBlock = blockOf("jobs");
  const jobs = new Map();
  if (jobsBlock && jobsBlock.body.length > 0) {
    const jobIndent = Math.min(...jobsBlock.body.map((line) => indentOf(line.code)));
    const headers = [];
    jobsBlock.body.forEach((line, index) => {
      if (indentOf(line.code) === jobIndent && /^\s*[A-Za-z0-9_-]+:\s*$/.test(line.code)) {
        headers.push({ id: line.code.trim().slice(0, -1), index, line });
      }
    });
    headers.forEach((header, position) => {
      const end = position + 1 < headers.length ? headers[position + 1].index : jobsBlock.body.length;
      const body = jobsBlock.body.slice(header.index + 1, end);
      const keyAt = (key) =>
        body.find(
          (line) => indentOf(line.code) === jobIndent + 2 && line.code.trim().startsWith(`${key}:`),
        );
      jobs.set(header.id, {
        id: header.id,
        line: header.line.number,
        body,
        name: keyAt("name"),
        timeout: keyAt("timeout-minutes"),
        condition: keyAt("if"),
        needs: keyAt("needs"),
        continueOnError: keyAt("continue-on-error"),
        matrix: body.some((line) => /^\s*matrix:/.test(line.code)),
      });
    });
  }

  const uses = code
    .filter((line) => /^\s*(-\s+)?uses:\s*\S/.test(line.code))
    .map((line) => ({
      number: line.number,
      ref: line.code.replace(/^\s*(-\s+)?uses:\s*/, "").trim().replace(/^["']|["']$/g, ""),
    }));

  const topLevelPermissions = blockOf("permissions");
  return { file, text, triggers, pathFiltered, jobs, uses, code, hasTopLevelPermissions: Boolean(topLevelPermissions), topLevelPermissions };
}

const workflowFiles = readdirSync(WORKFLOW_DIR)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();
const workflows = new Map(
  workflowFiles.map((name) => [name, scanWorkflow(name, readFileSync(join(WORKFLOW_DIR, name), "utf8"))]),
);

// --- supply-chain invariants --------------------------------------------

const IMMUTABLE_REF = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}$/;

for (const workflow of workflows.values()) {
  checkEphemeralWorkflowLifecycle(workflow);
  if (!workflow.hasTopLevelPermissions) {
    fail(`${workflow.file} declares no top-level \`permissions:\`; it inherits whatever the repository default becomes.`);
  } else {
    const header = workflow.topLevelPermissions.header.code.trim();
    if (header !== "permissions:" && header !== "permissions: {}" && header !== "permissions: read-all") {
      fail(`${workflow.file} uses unsupported workflow-level permissions syntax \`${header}\`; use an explicit read-only block, \`permissions: {}\`, or \`permissions: read-all\`.`);
    } else if (header === "permissions:") {
      let entries = 0;
      for (const line of workflow.topLevelPermissions.body) {
        if (indentOf(line.code) !== 2) continue;
        const entry = line.code.trim().match(/^([A-Za-z0-9_-]+):\s*(\S+)\s*$/);
        if (!entry) {
          fail(`${workflow.file} has unsupported workflow-level permission entry at line ${line.number}: ${line.code.trim()}`);
          continue;
        }
        entries += 1;
        const [, scope, value] = entry;
        if (value === "write") {
          fail(`${workflow.file} grants workflow-level ${scope}:write at line ${line.number}; keep workflow defaults read-only/empty and elevate only the exact mutation job.`);
        } else if (value !== "read" && value !== "none") {
          fail(`${workflow.file} has unsupported workflow-level permission value \`${scope}: ${value}\` at line ${line.number}.`);
        }
      }
      if (entries === 0) {
        fail(`${workflow.file} has an empty \`permissions:\` block; use \`permissions: {}\` explicitly.`);
      }
    }
  }

  for (const use of workflow.uses) {
    // A local action (`./...`) is this repository's own code and a container
    // action (`docker://`) is pinned by its own digest syntax.
    if (use.ref.startsWith("./") || use.ref.startsWith("docker://")) continue;
    if (!IMMUTABLE_REF.test(use.ref)) {
      fail(
        `${workflow.file}:${use.number} uses \`${use.ref}\`, a mutable ref. Pin the action to a full-length commit SHA with the version in a trailing comment.`,
      );
    }
  }

  for (const job of workflow.jobs.values()) {
    if (!job.timeout) {
      fail(`${workflow.file}: job \`${job.id}\` sets no \`timeout-minutes\`; a hung step holds the runner and the context for the six-hour default.`);
    }
  }

  // `pull_request_target` runs with a write-capable token against the base
  // repository. Checking out anything at all in such a workflow is the pattern
  // that turns a fork's pull request into code execution with that token, so
  // this forbids the checkout rather than trying to judge which `ref:` is safe.
  if (workflow.triggers.has("pull_request_target")) {
    const checkout = workflow.uses.find((use) => use.ref.startsWith("actions/checkout@"));
    if (checkout) {
      fail(
        `${workflow.file}:${checkout.number} checks out code in a \`pull_request_target\` workflow. That trigger carries a write-capable token against the base repository; do not run pull-request-controlled code under it.`,
      );
    }
  }
}

// --- policy reconciliation ----------------------------------------------

const policyPath = join(ROOT, POLICY_FILE);
if (!existsSync(policyPath)) {
  process.stderr.write(`${POLICY_FILE} is missing; there is no accepted merge-gate policy to check against.\n`);
  process.exit(1);
}
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const contexts = policy.contexts ?? [];

const EXPECTED_DOCS_ONLY_EXACT_PATHS = new Set([
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "COMPATIBILITY.md",
  "LIMITATIONS.md",
]);
const EXPECTED_DOCS_ONLY_PATTERN = "^docs/.*[.]md$";

function emittedContext(job) {
  return job.name
    ? job.name.code.replace(/^\s*name:\s*/, "").trim().replace(/^["']|["']$/g, "")
    : job.id;
}

function needsOf(job) {
  if (!job.needs) return new Set();
  const value = job.needs.code.replace(/^\s*needs:\s*/, "").trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    return new Set(
      value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean),
    );
  }
  return new Set([value.replace(/^["']|["']$/g, "")]);
}

function stepBlocks(job) {
  const candidates = job.body
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s+-\s+(name|uses):\s*\S/.test(line.code));
  if (candidates.length === 0) return [];
  const stepIndent = Math.min(...candidates.map(({ line }) => indentOf(line.code)));
  const headers = candidates.filter(({ line }) => indentOf(line.code) === stepIndent);
  return headers.map((header, position) => {
    const end = position + 1 < headers.length ? headers[position + 1].index : job.body.length;
    const lines = job.body.slice(header.index, end);
    const headerText = header.line.code.trim();
    const nameMatch = headerText.match(/^- name:\s*(.+)$/);
    const usesMatch = headerText.match(/^- uses:\s*(.+)$/);
    const condition = lines.find(
      (line) => indentOf(line.code) === stepIndent + 2 && line.code.trim().startsWith("if:"),
    );
    return {
      label: (nameMatch?.[1] ?? usesMatch?.[1] ?? headerText).replace(/^["']|["']$/g, ""),
      lines,
      condition,
    };
  });
}

function checkDocsOnlyFastPath() {
  const config = policy.docs_only_fast_path;
  if (!config) {
    fail(`${POLICY_FILE} declares no docs_only_fast_path policy.`);
    return;
  }
  if (config.workflow !== "ci.yml") {
    fail(`${POLICY_FILE} docs_only_fast_path must be owned by ci.yml.`);
    return;
  }

  const configuredPaths = new Set(config.exact_paths ?? []);
  if (
    configuredPaths.size !== EXPECTED_DOCS_ONLY_EXACT_PATHS.size ||
    [...EXPECTED_DOCS_ONLY_EXACT_PATHS].some((value) => !configuredPaths.has(value))
  ) {
    fail(`${POLICY_FILE} docs-only exact allowlist drifted: ${JSON.stringify([...configuredPaths].sort())}.`);
  }
  if (config.docs_pattern !== EXPECTED_DOCS_ONLY_PATTERN) {
    fail(`${POLICY_FILE} docs-only pattern drifted to ${JSON.stringify(config.docs_pattern)}.`);
  }
  for (const generated of ["CONTRIBUTORS.md", "THIRD_PARTY_NOTICES.md"]) {
    if (configuredPaths.has(generated)) {
      fail(`${POLICY_FILE} docs-only allowlist includes generated document ${generated}; coordinator validation must remain mandatory.`);
    }
  }

  const workflow = workflows.get(config.workflow);
  if (!workflow) {
    fail(`${POLICY_FILE} docs-only workflow ${config.workflow} is missing.`);
    return;
  }

  for (const jobId of config.jobs ?? []) {
    const job = workflow.jobs.get(jobId);
    if (!job) {
      fail(`${POLICY_FILE} docs-only job ${jobId} is missing from ${config.workflow}.`);
      continue;
    }
    const steps = stepBlocks(job);
    const detector = steps.find((step) => step.label === "Detect documentation-only scope");
    const fastPath = steps.find((step) => step.label === "Documentation-only fast path");
    if (!detector || !fastPath) {
      fail(`${config.workflow}: job ${jobId} must contain the docs-only detector and fast-path step.`);
      continue;
    }

    const detectorText = detector.lines.map((line) => line.code).join("\n");
    const observedPaths = new Set(
      [...detectorText.matchAll(/(?:^|\n)\s*(?:or\s+)?\.\s*==\s*"([^"]+)"/g)].map((match) => match[1]),
    );
    if (
      observedPaths.size !== EXPECTED_DOCS_ONLY_EXACT_PATHS.size ||
      [...EXPECTED_DOCS_ONLY_EXACT_PATHS].some((value) => !observedPaths.has(value))
    ) {
      fail(`${config.workflow}: job ${jobId} docs-only exact allowlist drifted: ${JSON.stringify([...observedPaths].sort())}.`);
    }
    if (!detectorText.includes(`test("${EXPECTED_DOCS_ONLY_PATTERN}")`)) {
      fail(`${config.workflow}: job ${jobId} docs-only docs/** matcher drifted.`);
    }
    for (const fragment of [
      "gh api --paginate --slurp",
      "Could not establish the changed-file set; using full validation.",
      "Changed-file set is empty; using full validation.",
      'echo "docs_only=false" >> "$GITHUB_OUTPUT"',
    ]) {
      if (!detectorText.includes(fragment)) {
        fail(`${config.workflow}: job ${jobId} docs-only detector lost fail-closed fragment ${JSON.stringify(fragment)}.`);
      }
    }

    const fastCondition = fastPath.condition?.code ?? "";
    if (!fastCondition.includes("steps.scope.outputs.docs_only == 'true'")) {
      fail(`${config.workflow}: job ${jobId} documentation-only success step lost its exact scope guard.`);
    }

    for (const step of steps) {
      if (step === detector || step === fastPath) continue;
      const condition = step.condition?.code ?? "";
      if (!condition.includes("steps.scope.outputs.docs_only != 'true'")) {
        fail(`${config.workflow}: job ${jobId} step ${JSON.stringify(step.label)} lost the docs-only full-validation guard.`);
      }
    }
  }
}

checkDocsOnlyFastPath();

// A second API-based evidence authority must not reappear alongside the local PR DAG.
function checkCiAndCodeqlCadence() {
  const ci = workflows.get("ci.yml");
  if (!ci || ["fast-evidence", "actions/workflows/ci.yml/runs", "actions/runs/$run_id/jobs"].some((fragment) => ci.text.includes(fragment))) {
    fail("ci.yml contains obsolete workflow-run/Jobs evidence reuse.");
  }
  if (ci && !ci.text.includes("toJSON(needs)")) {
    fail("Merge Gate lost local needs-result aggregation.");
  }
  const codeql = workflows.get("codeql.yml");
  const cadence = policy.codeql_cadence ?? {};
  if (!codeql || cadence.workflow !== "codeql.yml") {
    fail("CodeQL cadence workflow or recorded policy is missing.");
    return;
  }
  for (const event of ["pull_request", "pull_request_target", "push"]) {
    if (codeql.triggers.has(event)) fail("CodeQL must not trigger on " + event + ".");
  }
  if (!codeql.triggers.has("schedule") || !codeql.triggers.has("workflow_dispatch")) {
    fail("CodeQL must support both scheduled and manual analysis.");
  }
  if ((cadence.required_languages ?? []).length !== 4 ||
      (cadence.required_languages ?? []).some((language) => !codeql.text.includes("language: " + language)) ||
      !codeql.text.includes("candidate_sha") ||
      !codeql.text.includes("remote_main") ||
      !codeql.text.includes("release-codeql-verdict.py") ||
      !codeql.text.includes("actions/upload-artifact@") ||
      !codeql.text.includes("Reject unscanned Kotlin sources") ||
      !codeql.text.includes("build-mode: none")) {
    fail("CodeQL language, Kotlin, exact-SHA or raw SARIF assurance drifted.");
  }
}
checkCiAndCodeqlCadence();


// --- exact-SHA release preflight and future publisher boundary (#192) ---
// Registry submission is upstream/operator-controlled. Guard repo-managed changes.
function checkReleaseCodeqlPreflight() {
  const scanner = workflows.get("codeql.yml");
  const gate = workflows.get("release-codeql-preflight.yml");
  if (!scanner || !gate) {
    fail("exact-SHA CodeQL release preflight workflow is missing.");
    return;
  }
  for (const required of [
    "run-name: CodeQL source ${{ inputs.candidate_sha || github.sha }}",
    "compare/${EXPECTED_SHA}...${remote_main}",
    "merge_base_commit.sha",
    "candidate_tree",
    "codeql-source-${{ env.EXPECTED_SHA }}-${{ matrix.language }}",
    "release-codeql-verdict.py",
  ]) {
    if (!scanner.text.includes(required)) fail("CodeQL source provenance / historical-main assurance missing: " + required);
  }
  // The Java-only configuration is a reviewed source boundary. Do not let a
  // one-line scope shrink turn a previously full extraction into green evidence.
  const configPath = join(ROOT, ".github/codeql-java-config.yml");
  const approvedJavaLines = [
    "name: Zed active Java fixture security corpus",
    "paths:",
    "- tests/fixtures/spring-boot-basic/src/main/java/**",
    "- tests/fixtures/spring-codelens-showcase/src/main/java/**",
    "- tests/fixtures/spring-modulith-gradle/src/main/java/**",
  ];
  const configLines = existsSync(configPath)
    ? readFileSync(configPath, "utf8").split("\n").map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"))
    : [];
  if (JSON.stringify(configLines) !== JSON.stringify(approvedJavaLines) ||
      !scanner.text.includes("codeql-java-config.yml") ||
      !scanner.text.includes("runner.temp")) {
    fail("Java release CodeQL source scope drifted from the reviewed fixture corpus.");
  }
  if (!gate.triggers.has("workflow_dispatch") || gate.triggers.size !== 1) {
    fail("release CodeQL preflight must be manual-only.");
  }
  if (!gate.text.includes("candidate_sha:") ||
      !gate.text.includes("actions: write") ||
      !gate.text.includes("contents: read") ||
      !gate.text.includes("tools/ci/release_codeql_preflight.py") ||
      !gate.text.includes("ref: ${{ github.sha }}") ||
      !gate.jobs.has("preflight")) {
    fail("release CodeQL preflight lost trusted scanner dispatch/checkout authority.");
  }
  const mutation = /(?:\bgh\s+release\s+(?:create|upload|edit|delete)\b|\bgh\s+api\b[^\n]*(?:\/releases|\/git\/refs)|\b(?:cargo|npm|pnpm)\s+publish\b|softprops\/action-gh-release@|(?:\b|\W)(?:publish|submit)[-_](?:registry|extension)\b|(?:\b|\W)(?:publish|release)[-_](?:registry|extension)\.(?:sh|py|mjs)\b)/i;
  const commands = (w) => w.code.map((line) => line.code).join("\n");
  if (mutation.test(commands(gate))) {
    fail("nonpublishing release CodeQL preflight gained a publication side effect.");
  }
  for (const wf of workflows.values()) {
    if (["codeql.yml", "release-codeql-preflight.yml"].includes(wf.file)) continue;
    const namedPublisher = /(?:^|[-_])(?:release|publish|registry)(?:[-_.]|$)/i.test(wf.file);
    const mutators = [...wf.jobs.entries()].filter(([, job]) =>
      mutation.test(job.body.map((line) => line.code).join("\n")));
    if (!namedPublisher && mutators.length === 0) continue;
    const preflight = wf.jobs.get("codeql-preflight");
    if (!preflight) {
      fail(wf.file + ": repository-managed publication requires codeql-preflight job.");
      continue;
    }
    const code = preflight.body.map((line) => line.code).join("\n");
    if (!code.includes("tools/ci/release_codeql_preflight.py") ||
        !code.includes("actions: write") ||
        mutation.test(code)) {
      fail(wf.file + ": codeql-preflight must invoke nonpublishing reuse-or-auto-scan with scanner dispatch authority.");
    }
    if (preflight.continueOnError || /continue-on-error:\s*true/.test(code) ||
        /(?:^|\n)\s*if:\s*.*(?:always\(|failure\(|cancelled\()/.test(code)) {
      fail(wf.file + ": publication preflight cannot mask failures or run unconditionally.");
    }
    for (const [id, job] of mutators) {
      if (id === "codeql-preflight" ||
          !job.needs ||
          !/\bcodeql-preflight\b/.test(job.needs.code) ||
          job.continueOnError ||
          /(?:^|\n)\s*if:\s*.*(?:always\(|failure\(|cancelled\()/.test(job.body.map((line) => line.code).join("\n"))) {
        fail(wf.file + ": publication job " + id + " must depend directly on codeql-preflight.");
      }
    }
  }
}
checkReleaseCodeqlPreflight();



const claimed = new Set();
for (const entry of contexts) {
  const workflow = workflows.get(entry.workflow);
  if (!workflow) {
    fail(`${POLICY_FILE} claims context \`${entry.context}\` from \`${entry.workflow}\`, which does not exist.`);
    continue;
  }
  const job = workflow.jobs.get(entry.job);
  if (!job) {
    fail(`${POLICY_FILE} claims context \`${entry.context}\` from job \`${entry.job}\` in ${entry.workflow}, which has no such job.`);
    continue;
  }
  claimed.add(`${entry.workflow}#${entry.job}`);

  if (entry.class === "required" || entry.class === "staged") {
    const explicitName = emittedContext(job);
    if (explicitName !== entry.context) {
      fail(`${entry.workflow}: job \`${job.id}\` emits \`${explicitName}\`, expected required context \`${entry.context}\`.`);
    }
    if (job.matrix) {
      fail(`${entry.workflow}: job \`${job.id}\` is a matrix job, so it emits one context per leg rather than \`${entry.context}\`. It cannot be ${entry.class}.`);
    }
    if (job.continueOnError) {
      fail(`${entry.workflow}: job \`${job.id}\` sets continue-on-error; a ${entry.class} context must fail closed.`);
    }

    const components = entry.components ?? [];
    if (components.length > 0) {
      const expectedNeeds = new Set(components.map((component) => component.job));
      const actualNeeds = needsOf(job);
      if (
        expectedNeeds.size !== actualNeeds.size ||
        [...expectedNeeds].some((value) => !actualNeeds.has(value))
      ) {
        fail(
          `${entry.workflow}: aggregate \`${entry.context}\` needs ${JSON.stringify([...actualNeeds].sort())}, expected ${JSON.stringify([...expectedNeeds].sort())}.`,
        );
      }

      const conditionValue = job.condition
        ? job.condition.code.replace(/^\s*if:\s*/, "").trim()
        : "";
      if (!["${{ always() }}", "always()"].includes(conditionValue)) {
        fail(`${entry.workflow}: aggregate \`${entry.context}\` must use exact \`if: always()\`; got ${JSON.stringify(conditionValue)}.`);
      }

      for (const component of components) {
        const componentJob = workflow.jobs.get(component.job);
        const where = `${entry.workflow}: component \`${component.job}\``;
        if (!componentJob) {
          fail(`${where} required by \`${entry.context}\` is missing.`);
          continue;
        }
        claimed.add(`${entry.workflow}#${component.job}`);
        const componentName = emittedContext(componentJob);
        if (componentName !== component.name) {
          fail(`${where} emits \`${componentName}\`, expected \`${component.name}\`.`);
        }
        if (componentJob.matrix) {
          fail(`${where} is a matrix job; aggregate components must produce one stable result.`);
        }
        if (componentJob.condition) {
          fail(`${where} carries a job-level \`if:\` and can disappear before \`${entry.context}\` evaluates it.`);
        }
        if (componentJob.continueOnError) {
          fail(`${where} sets continue-on-error and can hide a failing component.`);
        }
      }
    } else if (job.condition) {
      fail(`${entry.workflow}: job \`${job.id}\` carries a job-level \`if:\`, so it can be skipped while reporting success. A ${entry.class} context must run unconditionally.`);
    }

    const trigger = entry.trigger ?? "pull_request";
    if (!["pull_request", "pull_request_target"].includes(trigger)) {
      fail(`${POLICY_FILE} gives \`${entry.context}\` unsupported PR trigger \`${trigger}\`.`);
    } else if (trigger === "pull_request_target") {
      fail(`${POLICY_FILE} requires unprivileged \`pull_request\` for every required or advisory PR context.`);
    } else {
      if (!workflow.triggers.has(trigger)) {
        fail(`${entry.workflow} does not trigger on \`${trigger}\`, so \`${entry.context}\` is never emitted on a pull request.`);
      }
      if (workflow.pathFiltered.has(trigger)) {
        fail(`${entry.workflow} filters its \`${trigger}\` trigger by path, so \`${entry.context}\` disappears on some pull requests instead of failing.`);
      }
    }
  }

  if (entry.class === "automation" && entry.required) {
    fail(`${POLICY_FILE} marks the automation context \`${entry.context}\` as required. Repository automation must not gate a merge.`);
  }
}

// The other direction: a pull-request job that the policy says nothing about.
// Without this, adding a job is invisible to the policy and its authority is
// never classified.
for (const workflow of workflows.values()) {
  if (!workflow.triggers.has("pull_request") && !workflow.triggers.has("pull_request_target")) continue;
  for (const job of workflow.jobs.values()) {
    if (!claimed.has(`${workflow.file}#${job.id}`)) {
      fail(
        `${workflow.file}: job \`${job.id}\` runs on pull requests but ${POLICY_FILE} does not classify it. Add an entry recording what it proves and whether it gates a merge.`,
      );
    }
  }
}

// --- live repository state ----------------------------------------------

const retiredActionsEventPolicyIds = policy.retired_actions_event_policy_ids ?? [];
if (!Array.isArray(retiredActionsEventPolicyIds)) {
  fail(`${POLICY_FILE} retired_actions_event_policy_ids must be an array.`);
} else {
  const seen = new Set();
  for (const id of retiredActionsEventPolicyIds) {
    if (!Number.isInteger(id) || id <= 0) {
      fail(`${POLICY_FILE} retired Actions event policy id ${JSON.stringify(id)} is not a positive integer.`);
      continue;
    }
    if (seen.has(id)) {
      fail(`${POLICY_FILE} lists retired Actions event policy id ${id} more than once.`);
    }
    seen.add(id);
  }
}

function gh(path) {
  return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}

if (live) {
  const repository = policy.repository;
  let settings;
  let rulesets;
  try {
    settings = gh(`repos/${repository}`);
    rulesets = gh(`repos/${repository}/rulesets`);
  } catch (error) {
    process.stderr.write(`Cannot read live repository state for ${repository} through \`gh\`: ${error.message}\n`);
    process.exit(1);
  }

  for (const [key, expected] of Object.entries(policy.settings ?? {})) {
    if (settings[key] !== expected) {
      fail(`Live repository setting \`${key}\` is ${JSON.stringify(settings[key])}; ${POLICY_FILE} accepts ${JSON.stringify(expected)}.`);
    }
  }

  const actions = gh(`repos/${repository}/actions/permissions`);
  const workflowPermissions = gh(`repos/${repository}/actions/permissions/workflow`);
  const actionsEventPolicies = gh(`repos/${repository}/actions/policies`);
  if (!Array.isArray(actionsEventPolicies.policies)) {
    fail("Live Actions event-policy readback returned no policies array.");
  } else {
    const liveEventPolicyIds = new Set(actionsEventPolicies.policies.map((entry) => entry.id));
    for (const id of retiredActionsEventPolicyIds) {
      if (liveEventPolicyIds.has(id)) {
        fail(`Retired Actions event policy ${id} still exists; remove the obsolete repository-level exception.`);
      }
    }
  }
  for (const [key, expected] of Object.entries(policy.actions_policy ?? {})) {
    const observed = key in actions ? actions[key] : workflowPermissions[key];
    if (observed !== expected) {
      fail(`Live Actions policy \`${key}\` is ${JSON.stringify(observed)}; ${POLICY_FILE} accepts ${JSON.stringify(expected)}.`);
    }
  }

  if (policy.codeql_authority === "custom-workflow") {
    const defaultSetup = gh(`repos/${repository}/code-scanning/default-setup`);
    if (defaultSetup.state !== "not-configured") {
      fail(`CodeQL authority drift: custom codeql.yml is the declared authority, but default setup is ${JSON.stringify(defaultSetup.state)}.`);
    }
  }

  const wanted = policy.ruleset ?? {};
  const summary = rulesets.find((entry) => entry.name === wanted.name && entry.target === "branch");
  if (!summary) {
    fail(`No branch ruleset named \`${wanted.name}\` exists on ${repository}.`);
  } else {
    const ruleset = gh(`repos/${repository}/rulesets/${summary.id}`);
    if (ruleset.enforcement !== wanted.enforcement) {
      fail(`Ruleset \`${wanted.name}\` enforcement is \`${ruleset.enforcement}\`; ${POLICY_FILE} accepts \`${wanted.enforcement}\`.`);
    }
    if ((ruleset.bypass_actors ?? []).length !== (wanted.bypass_actors ?? []).length) {
      fail(`Ruleset \`${wanted.name}\` has ${(ruleset.bypass_actors ?? []).length} bypass actor(s); ${POLICY_FILE} accepts none.`);
    }

    const byType = new Map(ruleset.rules.map((rule) => [rule.type, rule.parameters ?? {}]));
    for (const type of wanted.required_rule_types ?? []) {
      if (!byType.has(type)) fail(`Ruleset \`${wanted.name}\` is missing the \`${type}\` rule.`);
    }

    const pullRequest = byType.get("pull_request");
    if (pullRequest) {
      const sorted = (list) => [...(list ?? [])].sort().join(",");
      if (sorted(pullRequest.allowed_merge_methods) !== sorted(wanted.allowed_merge_methods)) {
        fail(`Ruleset \`${wanted.name}\` allows merge methods [${sorted(pullRequest.allowed_merge_methods)}]; ${POLICY_FILE} accepts [${sorted(wanted.allowed_merge_methods)}].`);
      }
      for (const key of [
        "required_approving_review_count",
        "required_review_thread_resolution",
        "require_extra_approval_for_unattributed_changes",
      ]) {
        if (key in wanted && pullRequest[key] !== wanted[key]) {
          fail(`Ruleset \`${wanted.name}\` pull-request rule has \`${key}\` = ${JSON.stringify(pullRequest[key])}; ${POLICY_FILE} accepts ${JSON.stringify(wanted[key])}.`);
        }
      }
    }

    const checks = byType.get("required_status_checks");
    if (checks) {
      if (checks.strict_required_status_checks_policy !== wanted.strict_required_status_checks_policy) {
        fail(`Ruleset \`${wanted.name}\` has \`strict_required_status_checks_policy\` = ${checks.strict_required_status_checks_policy}; ${POLICY_FILE} accepts ${wanted.strict_required_status_checks_policy}.`);
      }
      const liveContexts = new Set((checks.required_status_checks ?? []).map((check) => check.context));
      const policyRequired = new Set(contexts.filter((entry) => entry.class === "required").map((entry) => entry.context));
      for (const context of liveContexts) {
        if (!policyRequired.has(context)) {
          fail(`Ruleset \`${wanted.name}\` requires context \`${context}\`, which ${POLICY_FILE} does not list as required.`);
        }
      }
      for (const context of policyRequired) {
        if (!liveContexts.has(context)) {
          fail(`${POLICY_FILE} lists \`${context}\` as required but the live ruleset does not require it.`);
        }
      }
    }
  }
}

if (problems.length > 0) {
  process.stderr.write(
    `Workflow and merge-gate policy check failed:\n` +
      problems.map((problem) => `  - ${problem}\n`).join("") +
      `Fix the workflow, or record the new intent in ${POLICY_FILE}.\n`,
  );
  process.exit(1);
}

const requiredCount = contexts.filter((entry) => entry.class === "required").length;
process.stdout.write(
  `Workflow and merge-gate policy holds: ${workflows.size} workflows, ${contexts.length} classified contexts (${requiredCount} required)` +
    `${live ? ", live settings and ruleset match" : ", workflow side only (pass --live to read the repository back)"}.\n`,
);
