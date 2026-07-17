# Contributing

Thanks for helping build Spring tooling for Zed. This repository has an
installable extension with one working vertical slice, verified on a single
tuple, and is expanding capability coverage in public.

## Before proposing a change

Read `AGENTS.md`, the accepted decisions in `docs/decisions/`, and the reviewed
`docs/implementation-plan.md`. D002, D003, and D004 fix the architecture, the
official-Java boundary, and the production stack; a change that departs from
them needs a decision document first.

Keep a contribution to one investigation, experiment, decision, or reviewed
implementation slice. Open an issue before broad architecture, packaging,
runtime-download, or capability-scope work so its evidence and exit criteria can
be agreed first.

## Branching

The project follows GitHub Flow, and `main` is protected: it accepts no direct
pushes, no force pushes, and no non-linear history.

- Branch from `main`, one branch per change, kept short-lived.
- Name the branch for the Conventional Commit type it carries, followed by a
  short slug: `feat/`, `fix/`, `docs/`, `spike/`, `refactor/`, `test/`, or
  `chore/`. Use the evidence identifier where one exists, as in
  `spike/s013-authentic-spring-removal-contract`.
- Every commit needs a body explaining why the change is needed, what materially
  changed, and which validation was run or remains pending.
- Pull requests merge by rebase, or by squash when the intermediate commits are
  not worth keeping.

## Research and spikes

- Separate confirmed facts, primary sources, inferences, hypotheses, runtime
  verification needs, blockers, and candidate experiments.
- Record exact versions, commits, URLs, file paths, access dates, and checksums
  where applicable.
- Write a spike plan with one narrow hypothesis and success/failure criteria
  before writing disposable code.
- Preserve failed and successful observations. Do not rewrite a failed gate as
  success or promote spike code directly into production.
- Update the relevant index whenever a research, spike, or decision document is
  added.

## Repository hygiene

- Do not commit credentials, private evidence, logs, profiles, screenshots,
  downloaded VSIX/JAR/JDT/Zed artifacts, generated WASM, or build output.
- Pin external inputs by version and checksum; never treat an unpinned `latest`
  download as supported evidence.
- Keep paths and process launching platform-neutral from the first product
  scaffold. Untested platforms must remain labeled `untested`.
- Preserve upstream attribution for research patches and do not imply that this
  project redistributes third-party runtime binaries.

## Validation and pull requests

Run the smallest relevant source, contract, build, and runtime checks for the
change. A pull request should list changed files, validation performed,
unverified items, platform/JDK coverage, and the next follow-up. Runtime evidence
must state its exact host tuple.

By participating, you agree to follow `CODE_OF_CONDUCT.md`.
