# Repository Instructions

## Current phase

Local technical feasibility, the basic end-to-end PoC, and the D004 product
scaffold are complete. Amended D002 records a Pivot to a required official-Java
companion with a versioned Java/Spring coordination boundary and no reduced
managed-JDT fallback. S012 proved the unmodified bridge and visible completion
but was Refuted on cleanup; S013 then supported the exact removal contract. D003
and D004 are Accepted.

The M2 exit gate closed on macOS arm64/JDK 25: a driven clean install, restart,
and uninstall cycle reproduced real Spring Boot property completions, executed
the authentic bridge removal, left no owned process or route, and kept
credentials and classpaths out of the logs. M3 published the repository at
<https://github.com/luceat-lux-vestra/zed-spring-tools> under Apache-2.0, so
development is now public and the current work is M4's capability-parity
program. Spike code remains excluded from production.

## Product goal and delivery strategy

- The long-term product goal is capability parity with VS Code Spring Tools.
  Track every user-visible capability and either reproduce it in Zed, provide an
  equivalent Zed-native workflow, or retain a documented blocker and upstream
  dependency. The goal does not require pixel-identical VS Code UI.
- Complete a source-separated, installable basic product PoC on the available
  macOS arm64 host before the initial public GitHub source release. The existing
  disposable spike PoC does not satisfy this product gate by itself.
- Develop in public after that local PoC and expand capability coverage
  incrementally. An experimental public repository or preview must state the
  exact tested host and must not imply unverified support.
- Keep the extension package installable by design on every Zed-supported
  desktop platform. Runtime validation and supported-platform claims may follow
  after the initial local PoC and public source release.

## Allowed work

- Read official documentation and upstream source code.
- Add or update files under `docs/research/`, `docs/spikes/`, and
  `docs/decisions/`.
- Add minimal disposable code under `spikes/` only when a written spike plan
  identifies the hypothesis and success criteria.
- Implement product code under `src/`, `coordinator/`, `bridge/`, `protocol/`,
  `scripts/`, and `tests/` within the boundary that D002, D003, and D004 fix,
  following the reviewed implementation plan's current milestone.
- Update this file or the root README when the workflow itself changes.

## Work that requires an explicit direction decision

D002, D003, and D004 have settled the architecture, implementation language,
build system, and the bridge/coordinator module boundary. Do not add any of the
following until a recorded decision supports it:

- product packaging, release automation, or product CI;
- a new runtime dependency, downloaded artifact, or network call at runtime;
- any change to the official Java extension, its proxy, or its work directory
  beyond the allowlisted bridge commands;
- a reduced or self-managed JDT fallback, which D002 and D003 exclude;
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
- Open a pull request and merge with rebase, or squash when the branch's
  intermediate commits are not worth keeping. Merge commits are disabled.
  Approvals are not required, because a solo owner cannot approve their own pull
  request; the pull request exists as the review and future CI surface.
- Release branches are out of scope until M6 defines preview releases.

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
- Put delivery work in the active implementation milestone. Pure repository
  hygiene may have no milestone. Create future milestones only when that phase
  becomes active, and do not invent due dates without an actual commitment.
- The implementation plan and capability inventory remain the roadmap during
  solo M4 work, so do not duplicate them in a GitHub Project. Revisit Projects
  when multiple contributors or a durable concurrent backlog needs a status
  board.
- The maintainer checks metadata before merge. Historical pull requests do not
  need a complete retroactive relabeling.
- Keep the responsible human as the Git author. For material Codex assistance,
  add `Co-authored-by: OpenAI Codex (GPT-5.6 Sol) <noreply@openai.com>` and note
  that this descriptive trailer is not guaranteed to map to a GitHub account.

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

This gate is closed. D002 recorded **Pivot**: a bridge and coordinator around the
required official Java extension, rather than a Zed-extension-centered MVP. D003
accepted the resulting architecture and D004 its stack, so product scaffolding
was allowed to begin and has.

Reopen the gate only if new evidence contradicts the Pivot, and record the
outcome in a decision document before changing production code.
