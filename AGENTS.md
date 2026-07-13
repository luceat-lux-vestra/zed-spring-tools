# Repository Instructions

## Current phase

This repository is in technical feasibility research. Do not treat it as a
product implementation repository yet.

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
  systems as the required desktop boundary.
- Do not infer multiplatform support from one operating system, architecture,
  container, or compatibility layer.
- Before a direction decision, obtain representative evidence on macOS arm64,
  Linux x86_64, and Windows x86_64.
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

## Decision gate

Product scaffolding can begin only after the evidence supports and a decision
document records one of these outcomes:

- Go: a Zed-extension-centered MVP is feasible;
- Pivot: a bridge, coordinator, installer, or another structure is required;
- Limited: only a clearly bounded subset is feasible; or
- Stop: the desired core capability is not realistically achievable.
