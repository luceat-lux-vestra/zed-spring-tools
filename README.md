# Zed Spring Tools

This repository is currently a technical feasibility and local PoC workspace.
Source-based research and the S001-S005 macOS arm64 feasibility sequence are
complete. S006-S008 are Inconclusive. S008 nevertheless demonstrated the fixed
managed-JDT direct path twice with distinct isolated data; its strict result was
limited by unexpected fresh-profile extension/provider initialization. R007 has
now attributed those startup paths. S009 then proved the isolated trust,
extension, AI, and XDG controls plus the exact direct managed-JDT startup, but
closed Inconclusive because Equinox created mutable `configuration/` state
inside the fixed JDT distribution tree. R008 has now attributed that state to
Equinox's writable private-configuration default. S010 now has a reviewed
narrow relocation patch, distinct fixed builds, and a fresh non-UI Gate B
profile ready for runtime review.

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

Research and the local callback-routing feasibility sequence are complete. The
current local evidence supports Spring bundle injection, a Spring JDT command,
one result-correlated classpath callback through disposable proxy
instrumentation, and two fixed-input managed-JDT starts with distinct explicit
data paths. It does not yet prove the real Spring Boot LS end-to-end flow. S008
closed Inconclusive because a fresh Zed profile did not retain its reviewed
minimal extension/provider identity even though both JDT runs reached
`ServiceReady`. R007 identified source-supported isolated-profile controls;
S009 Gate C is closed Inconclusive despite direct `ServiceReady` and clean
provider/HTML attribution. R008 completed the targeted source review: shared
configuration is only the private configuration's parent, and the omitted
private path defaults to the writable JDT install. S010 Gate A's five-line
disposable Java-extension launch patch and static verifier pass against the
exact clean source. Gate B produced distinct locked control/patched WASM files
and a fresh canonical Java-only profile with pristine JDT and derived private
configuration paths. Gate C requires a new explicit continuation; no S010
runtime has started.

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

No product code, build system, extension manifest, or product CI should be added
until the technical direction has been selected.

An initial public GitHub source release is not a multiplatform support claim or
a stable Zed Marketplace release. It requires a repository license, an evidence
and secret audit, reproducible local instructions, and clear tested/untested
labels; it must not include the Spring VSIX or extracted third-party binaries.

## Primary research question

> What process and protocol structure is required for a Zed extension to run and
> coordinate JDT LS and the Spring Tools Language Server?

See [the research index](docs/research/README.md) for completed findings and
[the spike index](docs/spikes/README.md) for the next verification sequence.
