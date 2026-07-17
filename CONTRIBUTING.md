# Contributing

Thanks for helping build Spring tooling for Zed. This repository is currently
between a completed feasibility PoC and its first production scaffold.

## Before proposing a change

Read `AGENTS.md`, the accepted decisions in `docs/decisions/`, and the reviewed
`docs/implementation-plan.md`. D004 must select the production language, build,
packaging, and compatibility-table structure before production extension files
are added.

Keep a contribution to one investigation, experiment, decision, or reviewed
implementation slice. Open an issue before broad architecture, packaging,
runtime-download, or capability-scope work so its evidence and exit criteria can
be agreed first.

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
