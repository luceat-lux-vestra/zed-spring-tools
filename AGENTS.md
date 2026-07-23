# Repository Instructions

## Current phase

Local technical feasibility, the basic end-to-end PoC, and the D004 product
scaffold are complete. Amended D002 records a Pivot to a required official-Java
companion with a versioned Java/Spring coordination boundary and no reduced
managed-JDT fallback. S012 proved the unmodified bridge and visible completion
but was Refuted on cleanup; S013 then supported the exact removal contract.
D003-D006 are Accepted. D005 selects stock-Zed LSP-first capability delivery
with opt-in generated Structure/Live documents while preserving the existing
per-capability routes as fallbacks; Java language/query replacement is excluded
from the baseline. R014's final latest-upstream audit found no better stock-Zed
architecture. S015 found a usable live JDT/Spring Document Symbols merge but was
Refuted because restart cached Spring-only results before JDT's later dynamic
registration. Project Symbols remains the fallback. S016 then Supported official
Java 6.8.23 coordination, product cleanup, warm-cache startup, and the normal-
profile Maven main runnable on macOS arm64/JDK 25. R016 found that Zed's
`read:user` GitHub sign-in cannot authorize extension-created issues. D006
therefore selects capability-first optimistic official-Java compatibility and a
user-reviewed prefilled issue report on actual contract failure. R018 then
re-audited Spring Boot Tools and the wider VS Code extension pack by developer
outcome, correcting the pinned package's configuration count from 18 to 118 and
separating standard Spring CodeLens from custom live `sts/highlight`. Adapters
for both paths exist and are contract-tested. A driven Boot/JMX run then
verified authentic endpoint, bean and injection live lenses, click-selected
ranges, the explanatory fallback, and composed Spring/JDT native Hover. The
five standard-provider families were then observed in the showcase after its
`CL-2` target and `CL-3` marker were corrected. R019 records the resulting
boundary: AI Agent state/dispatch and file-finder sort-last are unavailable to
the product. The AI notices now state that boundary and send no prompt or source
to AI. Data AOT `CL-4d` now pre-resolves Spring's authentic target, rewrites it
to a Zed location command, and passed its one-click ignored-`target/` runtime
gate. The `CL-4a`/`CL-4e` AOT build route is also verified: real Zed created the
reviewable task, `task: spawn` exposed Maven's successful terminal output and
generated the authentic repository JSON, and refresh rewrote the task without
starting a build. The compatibility-failure notification now keeps a bounded
Markdown link visible and a driven click opened a title/body-prefilled GitHub
composer without submitting it. `CL-7c` also passed against a connected Boot
3.5.5/JMX process:
the commandless `@Value` range became a visible Hover lens and native Hover
returned the environment value `37` plus its `systemEnvironment` source. The
explicit local-process, metrics, logger, and show/hide/refresh-equivalent slices
are verified on that Boot/JMX tuple. Default-off automatic local connection is
also verified there: a real Zed Java-debug run connected the one matching
project, delivered live data, honored manual disconnect without reconnecting,
and cleaned up on debug stop and Zed exit. Contract coverage retains
single-project identity admission and fail-closed ambiguity. The release-pin
cleanup remains ancillary to this branch.

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
  `scripts/`, and `tests/` within the boundary that D002-D006 fix,
  following the reviewed implementation plan's current milestone.
- Update this file or the root README when the workflow itself changes.

## Work that requires an explicit direction decision

D002-D006 have settled the architecture, implementation language, build system,
bridge/coordinator module boundary, and stock-Zed capability-delivery strategy.
Do not add any of the following until a recorded decision supports it:

- product packaging, release automation, or product CI;
- a new runtime dependency, downloaded artifact, or network call at runtime;
- any change to the official Java extension, its proxy, or its work directory
  beyond the allowlisted bridge commands;
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
  add `Co-authored-by: OpenAI Codex (GPT-5.6 Sol) <noreply@openai.com>`. GitHub
  currently resolves that trailer to the `codex` account; update the model label
  when the active Codex model changes.

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
accepted the resulting architecture, D004 its stack, and D005 the LSP-first
stock-Zed capability surfaces with preserved fallbacks. D006 makes official-
Java admission capability-first and compatibility reporting user-reviewed, so
product scaffolding and reviewed M4 slices are allowed to proceed.

Reopen the gate only if new evidence contradicts the Pivot, and record the
outcome in a decision document before changing production code.
