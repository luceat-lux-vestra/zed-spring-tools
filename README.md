# Zed Spring Tools

This repository is currently a technical feasibility workspace. Source-based
research is complete, and reproducible runtime spikes are the next gate.

The immediate goal is to determine how a Zed extension can run and coordinate
JDT LS and the Spring Tools Language Server. Product architecture,
implementation language, packaging, and the MVP are intentionally not yet fixed.

The required desktop boundary is multiplatform: macOS, Linux, and Windows on
Zed-supported x86_64 and arm64/Arm64 systems. Support claims still require
runtime evidence from the full matrix defined in
[the prerequisite document](docs/spikes/prerequisites.md).

## Current phase

Research complete; feasibility spikes next.

The work in this phase must:

- distinguish confirmed facts from inferences and hypotheses;
- cite primary sources and relevant source-code locations;
- record reproducible runtime observations;
- identify client, server, distribution, and licensing constraints; and
- produce enough evidence for a Go, Pivot, Limited, or Stop decision.

## Repository layout

```text
docs/
├── decisions/  # Decisions made from research and spike evidence
├── research/   # Source-based technical investigations
└── spikes/     # Reproducible feasibility experiments
spikes/          # Disposable experiment code; never production code
```

No product code, build system, extension manifest, or product CI should be added
until the technical direction has been selected.

## Primary research question

> What process and protocol structure is required for a Zed extension to run and
> coordinate JDT LS and the Spring Tools Language Server?

See [the research index](docs/research/README.md) for completed findings and
[the spike index](docs/spikes/README.md) for the next verification sequence.
