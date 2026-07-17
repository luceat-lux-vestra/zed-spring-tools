# D002: Pivot to a versioned Java/Spring coordination boundary

- Status: Accepted
- Date: 2026-07-17
- Decision owner: Project owner

## Context

D001 requires capability parity with VS Code Spring Tools, a useful local
macOS arm64 PoC before public development, and an evidence-based Go, Pivot,
Limited, or Stop direction decision before product scaffolding. S011 has now
completed that local PoC: one isolated Zed session imported a Spring Boot Maven
fixture, relayed the real JDT classpath callback into the real Spring Boot LS,
and visibly offered the attributable `server.port` completion.

The successful flow was not extension-WASM-only. It required protocol-aware
native proxies to correlate the Java and Spring servers. The same run also
confirmed that Zed did not handle Spring Tools' `workspace/executeClientCommand`
request for `vscode-spring-boot.ls.start` or the `sts/javaType` request, and that
the disposable automatic listener-removal relay has a cleanup defect. The
project therefore needs to select the coordination structure before product
implementation begins.

## Evidence

- [R001](../research/001-zed-extension-language-server-lifecycle.md) records
  the procedural extension API and client-handler boundary.
- [R002](../research/002-spring-tools-language-server-execution-model.md)
  records Spring LS's separate process and custom Java-data protocol.
- [R004](../research/004-integration-structure-candidates.md) compares limited
  dual-server, existing-Java-proxy coordination, snapshot, and unified
  coordinator structures.
- [R005](../research/005-distribution-and-licensing.md) constrains artifact
  acquisition, pinning, licensing, and publication.
- [S002](../spikes/002-spring-ls-standard-lsp-baseline.md) refuted the useful
  metadata-aware value of a classpath-disabled direct baseline.
- [S003](../spikes/003-jdtls-synthetic-bundle-injection.md),
  [S004](../spikes/004-spring-jdt-bundle-command.md), and
  [S005](../spikes/005-classpath-callback-routing.md) support bundle injection,
  the Spring JDT command, and an authentic callback relay on the tested tuple.
- [S010](../spikes/010-explicit-equinox-configuration-area.md) supports a
  managed JDT launch that keeps writable Equinox private state out of the fixed
  distribution.
- [S011](../spikes/011-integrated-spring-boot-local-poc.md) supports the full
  fixed classpath-to-`server.port` hypothesis on macOS arm64/JDK 25 and retains
  the unhandled client requests and cleanup defect.

## Options considered

### Go: procedural extension centered, without a coordinator

This would retain the current Java extension and start Spring LS as a second
ordinary server. It is the smallest package, but S002 showed that disabling the
JDT classpath path loses the metadata-aware value, while R001/R004 and S011
show that the necessary callbacks and Java-data requests do not fit the current
procedural extension surface. It cannot meet the parity goal.

### Pivot: procedural extension plus a versioned coordinator

The Zed extension owns editor registration and platform-aware discovery. A
protocol-aware coordinator owns the bounded cross-server seams: Spring/JDT
startup ordering, authenticated instance routing, classpath add/remove and
callbacks, Java-data requests such as `sts/javaType`, lifecycle/restart, and
version mismatch. The leading placement is integration with, or an upstreamed
interface in, the existing Zed Java proxy so that the mature JDT process and
project model remain single-owned. A separately maintained unified coordinator
remains a fallback if that boundary cannot be made supported.

### Limited: publish only standard Spring LS features

This avoids native coordination but intentionally drops the project-aware path
and many parity capabilities. It may remain a degraded fallback mode, but it
does not satisfy the selected product goal and is not the primary direction.

### Stop

S011 demonstrates the real core flow, so stopping for technical infeasibility
is not supported by the evidence.

## Decision

**Pivot.** Build the product around a Zed procedural extension and an explicit,
versioned Java/Spring coordination boundary. Prefer reuse of the existing Zed
Java extension's JDT LS ownership through an upstream-supported coordinator
interface. Do not ship an undocumented dependency on its current route files
or private protocol. If upstream integration proves unavailable, return to a
reviewed decision comparing a maintained Java-proxy fork with a unified
coordinator; do not silently adopt either.

This decision passes the repository direction gate. It authorizes planning and
scaffolding for the selected coordinated product direction, but it does not
promote the S006/S011 spike code, choose a final native implementation language,
approve redistribution of third-party binaries, or claim product readiness.

## Rationale

S011 proves that the core Spring/JDT outcome is achievable and preserves the
existing Java extension's JDT process, making Limited and Stop unnecessarily
restrictive. The same run proves that a WASM-only Go direction is insufficient:
the desired flow crosses server/client boundaries that Zed does not currently
route. A narrow, versioned coordinator preserves the supported core path while
avoiding the larger duplication and lifecycle burden of immediately replacing
the Java extension with a unified server owner.

## Consequences

- The next implementation plan must specify coordinator ownership, protocol
  versioning, authentication, worktree identity, startup/shutdown, crash/restart,
  timeout, idempotent removal, compatibility, and observability before code is
  promoted beyond spikes.
- `vscode-spring-boot.ls.start`, `sts/javaType`, classpath listener removal, and
  any additional VS Code client surfaces discovered in the capability inventory
  become explicit coordinator or upstream-API work, not silent omissions.
- The current disposable proxies are evidence, not production foundations.
  Production code must be designed and reviewed independently.
- Initial implementation remains local-first on the tested macOS arm64/JDK 25
  tuple. Package design must remain platform-neutral and platform-aware from the
  first product scaffold; all unrun desktop/JDK tuples remain `untested`.
- Remote SSH and WSL projects remain outside initial scope under D001 and the
  repository instructions.
- Public GitHub release can now proceed after the separate license,
  secrets/history, binary, evidence, reproducibility, and tested/untested audit.
  Marketplace preview still requires product implementation and clean-install
  validation.
- Capability parity remains incremental. Each VS Code Spring Tools capability
  must map to reproduced behavior, a Zed-native equivalent, or a documented
  blocker/upstream dependency.

## Revisit conditions

Revisit this decision if the Zed Java extension exposes a native generic
cross-language-server routing API that removes the coordinator need; upstream
maintainers reject any supportable coordination boundary; the coordinator
cannot be delivered lawfully or securely across the desktop matrix; clean local
product implementation cannot reproduce S011 without private mutable coupling;
or capability inventory work shows that a unified coordinator is materially
simpler and safer. A revisit must preserve the parity goal unless a new explicit
product-goal decision changes it.
