# Repository Instructions

## Current phase

The historical M1-M6 implementation program is complete. `docs/implementation-plan.md`
is a milestone record, not the current roadmap. Current work is the Registry-first
distribution and v1.0 program owned by release Epic #108 and
`docs/preview-release-gate.md`.

Current `main` still contains the D002-D006 private Java/Spring coordination
architecture. The 2026-09-25 publishing-policy audit opened #159 as a release
blocker because that production path reads another extension's private work
directory/proxy boundary. That finding blocks Registry refresh/release claims;
it does not retroactively erase historical capability evidence. Draft PR #160 is
a candidate remediation and is not current authority until it merges with its
required evidence.

The external Registry contribution zed-industries/extensions#6875 remains open,
`extension.toml` remains at `0.1.0`, and #112/#113 remain the release-lifecycle
and v1.0 promotion tasks. Do not claim Registry publication or v1.0 before those
gates actually pass. Spike code remains excluded from production.

## Product goal and delivery strategy

- The product goal remains Spring-development outcome parity with VS Code Spring
  Tools where Zed exposes a sound delivery surface. Pixel-identical VS Code UI is
  not required.
- Capability state and support claims are evidence-scoped. The capability
  inventory, compatibility matrix, limitations, pinned-runtime evidence, and
  current release gate are the maintained authorities.
- The repository is already public and the M1-M6 implementation program is
  historical. New work should advance an explicit current issue/track, not
  recreate completed milestone work.
- Current release work is intentionally narrow: resolve #159, obtain accepted
  Registry publication, drive #112 through the real Registry lifecycle, and
  promote release claims through #113 only when exact evidence supports them.
- Platform-aware code or CI does not by itself broaden support. Untested runtime
  tuples remain unverified until driven evidence exists.

## Allowed work

- Read official documentation and upstream source code.
- Add or update files under `docs/research/`, `docs/spikes/`, and
  `docs/decisions/`.
- Add minimal disposable code under `spikes/` only when a written spike plan
  identifies the hypothesis and success criteria.
- Implement product code under `src/`, `coordinator/`, `bridge/`, `protocol/`,
  `scripts/`, and `tests/` only within the current reviewed architecture and
  the scope of an owning issue/decision. `docs/implementation-plan.md` is
  historical; do not use it as an active milestone authority.
- Update this file or the root README when the workflow itself changes.

## Work that requires an explicit direction decision

D002-D006 remain the checked-in architecture on current `main`, but #159 has
reopened the release/publishing boundary for the private Java transport. Do not
treat draft remediation as merged authority, and do not expand a release-blocked
private surface while that decision is unresolved.

Do not add any of the following until a recorded current issue/decision supports it:

- a new packaging/distribution/release-automation path outside release Epic #108,
  the current release gate, and existing reviewed workflows;
- a new runtime dependency, downloaded artifact, or network call beyond the
  existing pinned Spring Tools acquisition boundary;
- new dependence on the official Java extension's private proxy/work directory,
  or expansion of the current allowlisted bridge route while #159 is open;
- a reduced or self-managed JDT fallback, which D002 and D003 exclude;
- replacement or co-ownership of the official Java language, grammar, or query
  pack, which D003 and D005 exclude from the baseline;
- a custom Zed distribution or external dashboard runtime, which D005 does not
  select;
- promotion of `spikes/` code into production; or
- claims that an untested capability or environment is supported.

## Research requirements

Every research document must clearly separate:

1. confirmed facts;
2. primary sources and source-code references;
3. inferences;
4. unverified hypotheses;
5. items requiring runtime verification;
6. blockers and constraints; and
7. candidate next experiments.

Prefer official documentation, upstream repositories, release artifacts, and
license texts. Record exact versions, commit hashes, URLs, file paths, and access
dates where applicable. Do not present an inference as a confirmed fact.

## Spike requirements

Before writing spike code, create a spike document that defines one narrow
hypothesis, the environment, procedure, success criteria, and failure criteria.

For every completed spike:

- preserve exact reproduction steps;
- record relevant versions and environment details;
- retain useful logs or summarize where they are stored;
- report both successful and failed conditions;
- list remaining uncertainty; and
- do not promote spike code directly into production code.

## Platform requirements

- Treat macOS, Linux, and Windows on Zed-supported x86_64 and arm64/Arm64
  systems as the long-term desktop boundary and installation target.
- Do not infer multiplatform support from one operating system, architecture,
  container, or compatibility layer.
- A local macOS arm64 PoC may support the direction decision and initial public
  GitHub source release. Lack of Linux or Windows test hosts is not a blocker for
  those two milestones.
- Platform-neutral extension code, platform-aware paths and executable
  discovery, and the absence of unnecessary manifest restrictions are required
  from the first product implementation. Untested targets must be labeled
  `untested`, not `unsupported` or `supported`.
- Before a public support claim, pass the full six-tuple desktop matrix and the
  declared JDK compatibility matrix.
- Zed SSH remote development and WSL-hosted remote projects are outside the
  initial scope. Revisit them only after the local desktop matrix is stable and a
  later decision explicitly adds them.
- Keep commands shell-independent and use Zed platform, worktree, environment,
  and executable-discovery APIs for host differences.
- A driven run's evidence is only as trustworthy as its profile. Zed rebuilds
  `<profile>/extensions/index.json` at startup only when that file is not newer
  than `<profile>/extensions/installed/`, and copying a warm profile always
  leaves the index newer — so a copied profile silently keeps the source
  profile's registered language set and never re-indexes. Delete
  `extensions/index.json` after copying a profile, and confirm the rebuilt index
  lists every language the extension contributes before trusting a negative
  result. A missing language looks exactly like a missing capability in the LSP
  trace: the buffer gets no language and no `didOpen` is sent at all.

## Branching and pull requests

The repository follows GitHub Flow. `main` is the published PR-gated state and
is protected: direct pushes are rejected, force pushes and deletion are blocked,
and history must stay linear. Those rules are enforced by a GitHub ruleset, not
by convention alone, so the prohibition on rewriting published history is
mechanical.

- Branch from `main` for every change. Never commit directly to `main`.
- Name the branch for the Conventional Commit type it carries: `feat/`, `fix/`,
  `docs/`, `spike/`, `refactor/`, `test/`, or `chore/`, followed by a short
  slug. Use the evidence identifier where one exists, as in
  `spike/s013-authentic-spring-removal-contract` or
  `docs/d004-product-stack-build-and-packaging`.
- Keep a branch scoped to one investigation, experiment, decision, or reviewed
  implementation slice, and keep it short-lived.
- Open a pull request for every change and merge by squash only. Rebase-merge
  and merge commits are disabled by repository policy. Intermediate branch
  commits may still be rewritten during development.
- Approvals are not required, because a solo owner cannot approve their own pull
  request; the pull request remains the review and CI surface.
- Release work follows Epic #108 and the current release gate. Do not invent a
  release-branch policy merely because the historical M6 milestone is complete.

## Issue and pull-request metadata

- Apply at least one `area:*` label to capability and product work after its
  scope is known. Multiple area labels are appropriate only when the change
  genuinely crosses those boundaries.
- Apply `state:*` labels only to issues or pull requests that propose or record
  the corresponding capability-inventory state. More than one state label is
  allowed when one reviewed slice moves different capabilities to different
  states.
- Use `research`, `decision`, and `spike` for those evidence types; use `bug`,
  `documentation`, and the remaining general labels for ordinary triage.
- Assign an issue only when someone owns its next action. A pull-request author
  already owns that pull request, so do not add a redundant assignee by default.
- Put work in the milestone that actually owns its current delivery horizon.
  Release work uses the native `Registry publication & v1.0 readiness`
  milestone where applicable; pure repository hygiene may have no milestone.
  Do not invent due dates without an actual commitment.
- `docs/implementation-plan.md` is historical. Current ownership comes from the
  capability/compatibility authorities plus the active GitHub Epic/Track/Task
  hierarchy. Do not create a duplicate status board merely to mirror those
  sources; revisit GitHub Projects only when a durable concurrent backlog needs
  one.
- The maintainer checks metadata before merge. Historical pull requests do not
  need a complete retroactive relabeling.
- Keep the responsible human as the Git author. For material Codex assistance,
  add `Co-authored-by: OpenAI Codex (GPT-5.6 Sol) <noreply@openai.com>`. GitHub
  currently resolves that trailer to the `codex` account; update the model label
  when the active Codex model changes.

## Failure handling before remediation

A failing capability observation, integration test, evidence gate, workflow
check, or other red signal is an observation, not a patch target. Establish the
root cause far enough to justify the owning layer before changing local
implementation, tests, capability evidence, workflow policy, upstream-version
assumptions, or the execution environment.

UNKNOWN, UNVERIFIED, and INSUFFICIENT EVIDENCE remain fail-closed where the
unresolved point is material to the proposed remediation or merge judgment.
Do not rewrite a failed capability observation as local success, invent
unsupported local behavior to mask an upstream limitation, weaken a valid
test/evidence requirement, or relax repository policy merely to obtain green.

A deterministic/reproducible failure should be fixed rather than hidden by
reruns. A suspected transient, runner, network, toolchain, or upstream
environment failure may be rerun only when available evidence makes that
hypothesis credible.

If remediation changes local implementation, test/harness/oracle,
capability-evidence method, upstream-version/toolchain premise, workflow/policy,
or another premise of the reviewed revision, invalidate the affected evidence.
Re-run the relevant targeted validation and repository-required checks on the
new exact final PR HEAD before merge.

## Documentation-only CI fast path

A pull request may use the documentation-only fast path only when every changed
file is one of `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `SECURITY.md`,
`CODE_OF_CONDUCT.md`, `COMPATIBILITY.md`, `LIMITATIONS.md`, or Markdown
under `docs/**`. The rule is syntactic: mixed, empty, unreadable, or unlisted
change sets fall back to full validation.

The `rust` and `coordinator` component jobs must still exist and report
success; only their product/toolchain work may be skipped. `review`
(Dependency Review) and `workflow-security` still run. The live ruleset
requires one `Merge Gate`, which fails unless all four components succeed on
the exact pull-request revision. `CONTRIBUTORS.md` and
`THIRD_PARTY_NOTICES.md` are deliberately excluded because coordinator checks
derive and validate them.

## Change discipline

- Keep each task scoped to one investigation or experiment.
- Do not perform unrelated refactors or dependency upgrades.
- Never download an unpinned `latest` language-server version as an asserted
  supported configuration.
- Do not remove failed observations or tests to make a result appear successful.
- Update the relevant index when adding a research, spike, or decision document.
- Report changed files, validation performed, unverified items, and follow-up
  work at task completion.

## Commit messages

- Follow Conventional Commits with a scoped subject where it improves clarity:
  `type(scope): imperative summary`.
- Every commit must include a body after a blank line. The body must explain why
  the change is needed, what materially changed, and which validation was run or
  remains pending. Do not create title-only commits.
- Use a `BREAKING CHANGE:` footer when applicable and preserve relevant issue,
  decision, research, or spike identifiers in the body.
- Do not rewrite already published history solely to restyle commit messages.

## Decision gate

The original D002-D006 architecture remains the checked-in production boundary
on current `main`, but the release/publishing decision is no longer closed:
#159 records evidence that the private cross-extension Java transport is not an
acceptable Registry-release boundary under this project's fail-closed policy.

Until a replacement decision/remediation is merged and revalidated, preserve the
current runtime for reproducibility but do not broaden the private transport,
present it as Registry-compliant, refresh the upstream Registry pointer, or
promote release claims. Draft PR #160 is remediation work, not current
architecture authority.

Any replacement architecture must be recorded in a decision document and must
reconcile capability evidence, compatibility/limitations, release gating, and
the exact Registry candidate before the decision gate can close again.
