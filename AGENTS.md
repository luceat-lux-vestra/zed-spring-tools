# Repository Instructions

## Current phase

Local technical feasibility and the basic end-to-end PoC are complete. Amended
D002 records a Pivot to a required official-Java companion with a versioned
Java/Spring coordination boundary and no reduced managed-JDT fallback. S012
proved the unmodified bridge and visible completion but was Refuted on cleanup;
S013 then supported the exact removal contract. D003 and D004 are Accepted. The
reviewed implementation plan now requires a source-separated basic product PoC
before the first public push. Product scaffolding may begin under D004; spike
code remains excluded from production.

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
- Add minimal disposable code under a future `spikes/` directory only when a
  written spike plan identifies the hypothesis and success criteria.
- Update this file or the root README when the research workflow itself changes.

## Work that requires an explicit direction decision

Do not add any of the following until research and spikes support a recorded
direction decision:

- a production extension manifest or extension skeleton;
- a production implementation language or build system;
- bridge, coordinator, launcher, installer, or server-manager modules;
- a product architecture, roadmap, or implementation plan;
- product packaging, release automation, or product CI;
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

Product scaffolding can begin only after local evidence supports and a decision
document records one of these outcomes. Multiplatform runtime evidence is not a
prerequisite for this direction decision:

- Go: a Zed-extension-centered MVP is feasible;
- Pivot: a bridge, coordinator, installer, or another structure is required;
- Limited: only a clearly bounded subset is feasible; or
- Stop: the desired core capability is not realistically achievable.
