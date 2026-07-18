# Zed Spring Tools

This is an experimental repository. It has completed its source-based
feasibility phase, its basic local end-to-end PoC, and the source-separated
product scaffold that D004 requires. On macOS arm64/JDK 25 a clean development
install now returns real Spring Boot property completions through the product
extension. It is **not** a stable release and claims no tested platform other
than that tuple.

S010 proved a managed JDT launch that keeps writable Equinox private state
outside the fixed distribution. S011 then proved the real Spring classpath
callback, project-cache transition, and a visible attributable `server.port`
completion through Zed. S012 reproduced that functional path with the official
Java extension and proxy unmodified, and S013 corrected and verified the exact
listener-removal contract. D002 and D003 therefore select a separately
installed Spring companion that explicitly requires the official Zed Java
extension and uses its JDT LS. A reduced self-managed JDT fallback is not part
of the initial product. D004 then fixed the product stack, and the product
scaffold and its macOS arm64 vertical slice now exist in this tree.

The long-term product goal is capability parity with VS Code Spring Tools. A
capability may use a Zed-native workflow instead of copying VS Code's UI, but it
must not silently disappear from the target because the current Zed API lacks a
surface. Such gaps remain tracked for an alternative design or upstream work.
The auditable list is the [capability inventory](docs/capability-inventory.md).
At inventory version 4, it tracks 46 capabilities, of which 13 are `verified`.

Development is local-first: complete a useful macOS arm64 PoC, publish the source
repository on GitHub with an experimental status, and then develop capabilities
and platform validation in public. The extension is intended to be installable
on every Zed-supported macOS, Linux, and Windows desktop, but untested platforms
will remain explicitly unverified until the matrix in
[the prerequisite document](docs/spikes/prerequisites.md) runs.

## Current phase

Research, prerequisite isolation, the fixed local Spring Boot end-to-end PoC,
and the product scaffold are complete. On macOS 26.5.1 arm64 with Temurin JDK
25.0.3, the same real Spring Boot LS child produced an empty completion
baseline, received the authentic JDT classpath callback, populated its project
cache, and later returned one visible `server.port` completion to Zed. S013 also
completed the authentic listener-removal and owned-route cleanup path.

The product extension now reproduces that flow from a clean development install
rather than from a hand-prepared spike worktree: it materializes its own
coordinator and bridge, acquires the pinned unchanged Spring artifact, discovers
the official Java provider, and returns real Spring Boot property completions.
An audit of the run's logs found no credential and no classpath payload, and no
owned process or owned route survived it.

Zed-native startup replaces `vscode-spring-boot.ls.start`, and the coordinator's
official-Java route now handles and has runtime-verified `sts/javaType`. The
extension is not yet a general Spring feature implementation. See
[known limitations](LIMITATIONS.md).

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
then passed on the fixed tuple, so
[D003](docs/decisions/003-java-companion-product-architecture.md) is accepted.
[D004](docs/decisions/004-product-stack-build-and-packaging.md) then selected the
product stack that the current scaffold implements.

The work in this phase must:

- distinguish confirmed facts from inferences and hypotheses;
- cite primary sources and relevant source-code locations;
- record reproducible runtime observations;
- identify client, server, distribution, and licensing constraints;
- keep production code separated from `spikes/` and free of copied spike
  infrastructure, committed third-party binaries, and official-Java mutation;
  and
- label every capability and platform by its evidence, so an untested target
  stays `untested` rather than becoming an implied support claim.

## Repository layout

```text
src/            # Rust/WASM Zed extension adapter
coordinator/    # Dependency-free Node Spring coordinator and its tests
bridge/         # Java bridge contributed to the Java-owned JDT LS
protocol/       # Versioned schemas and fixtures for the Java boundary
scripts/        # Local PoC preparation and bridge verification
tests/          # Product fixtures
docs/
├── decisions/  # Decisions made from research and spike evidence
├── research/   # Source-based technical investigations
└── spikes/     # Reproducible feasibility experiments
spikes/         # Disposable experiment code; never production code
```

Production code under the first six directories is source-separated from
`spikes/`, which stays disposable evidence and is never promoted. D002 selects
the technical direction, accepted D003 plus S013 close the architecture evidence
gate, and D004 fixes the stack that the current scaffold implements. Product CI
does not exist yet.

An initial public GitHub source release is not a multiplatform support claim or
a stable Zed Marketplace release. It must not include the Spring VSIX or
extracted third-party binaries.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

That license covers this repository's own source. It does not relicense any
third-party material: the Spring Tools VSIX remains Eclipse Public License 1.0
and the official Zed Java extension remains under its own upstream license.
Neither is committed here. See [third-party material](THIRD_PARTY_NOTICES.md)
for the exact boundaries.

## Primary research question

> What process and protocol structure is required for a Zed extension to run and
> coordinate JDT LS and the Spring Tools Language Server?

See [the research index](docs/research/README.md),
[the spike index](docs/spikes/README.md), and
[the decision index](docs/decisions/README.md) for the evidence and selected
direction. The reviewed next milestones are in the
[product implementation and public-development plan](docs/implementation-plan.md).

For the concise public boundary, see [compatibility](COMPATIBILITY.md),
[known limitations](LIMITATIONS.md), and [third-party material](THIRD_PARTY_NOTICES.md).
