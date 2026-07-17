# Zed Spring Tools

This repository has completed its source-based feasibility phase and basic
local end-to-end PoC on macOS arm64/JDK 25. S010 proved a managed JDT launch
that keeps writable Equinox private state outside the fixed distribution. S011
then proved the real Spring classpath callback, project-cache transition, and a
visible attributable `server.port` completion through Zed. Amended D002 selects
a separately installed Spring companion that explicitly requires the official
Zed Java extension and uses its JDT LS. A reduced self-managed JDT fallback is
not part of the initial product. Product scaffolding has not begun.

The long-term product goal is capability parity with VS Code Spring Tools. A
capability may use a Zed-native workflow instead of copying VS Code's UI, but it
must not silently disappear from the target because the current Zed API lacks a
surface. Such gaps remain tracked for an alternative design or upstream work.

Development is local-first: complete a useful macOS arm64 PoC, publish the source
repository on GitHub with an experimental status, and then develop capabilities
and platform validation in public. The extension is intended to be installable
on every Zed-supported macOS, Linux, and Windows desktop, but untested platforms
will remain explicitly unverified until the matrix in
[the prerequisite document](docs/spikes/prerequisites.md) runs.

## Current phase

Research, prerequisite isolation, and the fixed local Spring Boot end-to-end
PoC are complete. On macOS 26.5.1 arm64 with Temurin JDK 25.0.3, the same real
Spring Boot LS child produced an empty completion baseline, received the
authentic JDT classpath callback, populated its project cache, and later
returned one visible `server.port` completion to Zed. The run retained an
automatic listener-removal defect and unhandled `vscode-spring-boot.ls.start`
and `sts/javaType` client requests. These are product blockers, not reasons to
discard the successful core result.

[D002](docs/decisions/002-pivot-to-versioned-coordination.md) passes the
direction gate with **Pivot**: `zed-spring-tools` is an official-Java companion,
loads reviewed Spring bridge bundles into the Java-owned JDT LS, and owns the
Spring coordinator and Spring Boot LS. The Java extension remains unmodified in
the target architecture. [R009](docs/research/009-unmodified-java-companion-boundary.md)
defines the remaining reverse-callback boundary.
[S012](docs/spikes/012-unmodified-java-companion-bridge.md) proved that boundary
and the visible completion with official Java unmodified, but failed its strict
removal criterion because the coordinator rejected the authentic Spring removal
shape before bridge transport. The narrow
[S013](docs/spikes/013-authentic-spring-removal-contract.md) cleanup contract
must pass before proposed
[D003](docs/decisions/003-java-companion-product-architecture.md) is accepted and
product scaffolding begins.

The work in this phase must:

- distinguish confirmed facts from inferences and hypotheses;
- cite primary sources and relevant source-code locations;
- record reproducible runtime observations;
- identify client, server, distribution, and licensing constraints; and
- produce a local end-to-end PoC and enough evidence for a Go, Pivot, Limited,
  or Stop decision.

## Repository layout

```text
docs/
├── decisions/  # Decisions made from research and spike evidence
├── research/   # Source-based technical investigations
└── spikes/     # Reproducible feasibility experiments
spikes/          # Disposable experiment code; never production code
```

No product code, build system, extension manifest, or product CI exists yet.
D002 selects the technical direction. D003 and S013 now provide the reviewed
architecture proposal and its remaining cleanup evidence gate; product
scaffolding waits for that gate.

An initial public GitHub source release is not a multiplatform support claim or
a stable Zed Marketplace release. It requires a repository license, an evidence
and secret audit, reproducible local instructions, and clear tested/untested
labels; it must not include the Spring VSIX or extracted third-party binaries.

## Primary research question

> What process and protocol structure is required for a Zed extension to run and
> coordinate JDT LS and the Spring Tools Language Server?

See [the research index](docs/research/README.md),
[the spike index](docs/spikes/README.md), and
[the decision index](docs/decisions/README.md) for the evidence and selected
direction.
