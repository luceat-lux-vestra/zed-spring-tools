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

  return { file, text, triggers, pathFiltered, jobs, uses, code, hasTopLevelPermissions: Boolean(blockOf("permissions")) };
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
  if (!workflow.hasTopLevelPermissions) {
    fail(`${workflow.file} declares no top-level \`permissions:\`; it inherits whatever the repository default becomes.`);
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
    // A required context is the job id, so a `name:` renames it out of the
    // ruleset without any error anywhere.
    if (job.name) {
      fail(`${entry.workflow}: job \`${job.id}\` sets \`name:\`, which renames its check to something other than \`${entry.context}\`. A ${entry.class} context must keep the job id as its name.`);
    }
    if (job.matrix) {
      fail(`${entry.workflow}: job \`${job.id}\` is a matrix job, so it emits one context per leg rather than \`${entry.context}\`. It cannot be ${entry.class}.`);
    }
    if (job.condition) {
      fail(`${entry.workflow}: job \`${job.id}\` carries a job-level \`if:\`, so it can be skipped while reporting success. A ${entry.class} context must run unconditionally.`);
    }
    if (!workflow.triggers.has("pull_request")) {
      fail(`${entry.workflow} does not trigger on \`pull_request\`, so \`${entry.context}\` is never emitted on a pull request.`);
    }
    if (workflow.pathFiltered.has("pull_request")) {
      fail(`${entry.workflow} filters its \`pull_request\` trigger by path, so \`${entry.context}\` disappears on some pull requests instead of failing. A ${entry.class} context must be emitted on every ordinary pull request.`);
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
