# D003: Java-companion product architecture

- Status: Proposed; implementation blocked on S012
- Date: 2026-07-17
- Decision owner: Project owner
- Depends on: D002, R009, and S012

## Context

D002 now fixes the product boundary: `zed-spring-tools` is a separately
installed Spring companion that requires the official Zed Java extension. It
does not provide a reduced managed-JDT fallback. S011 proves the desired
end-to-end Spring behavior with a disposable Java-proxy patch, while R009 shows
that the current unmodified Java extension already supports injected bundles
and outbound JDT requests but lacks the reverse Spring callback route.

The detailed product architecture must preserve the official Java extension's
ownership of Java support, isolate release-specific transport, and prevent the
spike proxy from becoming production code. One final transport experiment is
required before this proposal can be accepted and product scaffolding begins.

## Evidence

- [D002](002-pivot-to-versioned-coordination.md) selects the required companion
  boundary and rejects a degraded standalone fallback.
- [R009](../research/009-unmodified-java-companion-boundary.md) attributes the
  exact unmodified Java proxy request path, missing reverse callback, and
  capability/version risks.
- [S003](../spikes/003-jdtls-synthetic-bundle-injection.md) and
  [S004](../spikes/004-spring-jdt-bundle-command.md) support cross-extension
  bundle contribution and command execution.
- [S011](../spikes/011-integrated-spring-boot-local-poc.md) supports the desired
  Spring classpath-to-completion behavior but used an instrumented proxy.

## Proposed architecture

```text
Zed
├── official Java extension (required, unmodified)
│   └── official Java proxy ──> JDT LS
│                              ├── Java debug bundle
│                              ├── Spring JDT bundles
│                              └── zed-spring bridge bundle
└── zed-spring-tools
    └── Spring coordinator ──> Spring Boot LS
          ▲         │
          └─────────┘ authenticated bridge events and Java queries
```

### Ownership

The official Java extension owns Java language registration, JDT LS
installation and launch, JDK selection, workspace/project import, Java debug,
tests, tasks, and its normal update lifecycle. `zed-spring-tools` must not
replace its proxy binary, patch its WASM component, mutate its installation, or
start a second JDT LS.

The Spring package owns its Zed adapter, Spring Boot LS process, Spring
coordinator, pinned Spring artifacts, Spring-specific configuration, bridge
bundle, compatibility adapter, logs, and cleanup. The bridge bundle is loaded
into the Java-owned JDT LS through Zed's initialization-options composition;
this dependency is public product behavior and must be disclosed.

### Coordination boundary

The coordinator exposes a private, worktree-scoped loopback endpoint with an
ephemeral credential. A `JavaTransport` adapter discovers and probes the active
official Java proxy for the same worktree, then invokes only an allowlisted
bridge or Spring JDT command. The proposed bridge command registers the endpoint
and credential. Classpath events travel directly from the injected bridge
bundle to the coordinator rather than through
`workspace/executeClientCommand` and Zed.

The coordinator maps allowlisted Spring LS client requests to JDT delegate
commands and maps results back without rewriting successful payloads. Protocol
messages carry a schema version, worktree identity, server-instance identity,
request/callback correlation, deadline, and capability set. Unknown methods,
versions, identities, or duplicate registrations fail closed.

### Compatibility

Compatibility is capability-based, not “any installed Java version works” and
not a permanent pin to 6.8.21. Each observed Java transport adapter declares the
port/route discovery shape and required capabilities it knows how to probe. A
Java extension update may continue working unchanged, select another adapter,
or be rejected with a precise compatibility message. It does not cause an
automatic fork, source merge, proxy replacement, or fallback JDT LS.

The initial compatibility table contains only the exact tested tuple. New Java
extension/JDT LS combinations enter the table only after the bridge contract
and Spring completion regression suite passes.

### Missing and incompatible Java support

When the Java provider is absent or incompatible, the Spring language server
must not start in a misleading reduced mode. The extension reports that the
official Zed Java extension is required, identifies the failed capability when
known, and points to installation or compatibility documentation. Whether Zed
can offer a direct installation action remains unverified; documentation must
not promise it until proven.

### Lifecycle and security

- One coordinator route, bridge registration, Spring child, and Java provider
  identity exist per worktree instance.
- Credentials are random, process-scoped, excluded from logs, and removed only
  after both sides are absent or acknowledge unregistration.
- Add/remove is idempotent. Restart invalidates prior instance identities and
  never reuses stale routes.
- The bridge uses bounded threads, request sizes, deadlines, and an allowlist;
  it does not expose a general JDT command service.
- The official proxy's current private unauthenticated endpoint is not widened.
  The adapter sends only fixed probe/bridge commands and treats unexpected
  behavior as incompatible.
- Logs record versions, capabilities, event classes, counts, and structural
  digests, but never credentials or full classpaths by default.

### Packaging and description

The initial product package contains no JDT LS, Java debugger, test runner, or
Java task implementation. Its description must state substantially:

> Zed Spring Tools extends the official Zed Java extension with Spring Boot
> language intelligence and workflows. The Zed Java extension is required.
> Spring integration loads reviewed Spring bridge bundles into the JDT Language
> Server managed by the Java extension.

Exact third-party acquisition, redistribution, notices, integrity checks, and
offline behavior remain subject to R005 and a later packaging decision. Other
desktop tuples remain `untested` until validated.

## Alternatives considered

### Reduced managed-JDT fallback

Rejected by the product owner. It would provide an incomplete Java development
experience and duplicate only part of the official extension's responsibilities.

### Maintain a Java extension fork

Not selected. It converts ordinary compatibility work into continuous source
merges and changes the product from a Spring companion into a Java distribution.

### Request an upstream coordinator before development

Not required. Upstream support could later replace the observed transport and
reduce risk, but S012 can test the companion boundary with an unmodified current
release now.

### Start and own both JDT LS and Spring LS

Not selected. It conflicts with the required official Java environment and
would require a separate decision for full Java ownership.

## Implementation sequence after acceptance

1. Create product-neutral protocol schemas and contract tests from the accepted
   S012 evidence; do not copy the instrumented S006 proxy.
2. Scaffold the procedural Spring extension, bridge bundle, and coordinator as
   separate owned components with platform-neutral paths and no unsupported
   manifest restriction.
3. Implement Java-provider discovery/probe and missing/incompatible diagnostics
   before Spring feature startup.
4. Reproduce the macOS arm64/JDK 25 `server.port` flow in a clean product build.
5. Add `sts/javaType`, lifecycle/removal, restart, and compatibility tests.
6. Complete the D001 public-source audit, then publish as experimental with the
   exact tested tuple and all other targets labeled `untested`.
7. Expand the VS Code Spring Tools capability inventory and platform matrix
   incrementally.

Every implementation slice requires its own reviewed plan and must keep the
capability inventory current. Product code may not claim support from spike
evidence alone.

## Acceptance gate

D003 becomes Accepted only if S012 demonstrates the real S011 completion
transition with the official Java extension and proxy byte-for-byte unmodified,
one injected bridge bundle, authenticated direct callback, correct removal and
shutdown, no second JDT LS, and no stale route. A failure to discover the
private request endpoint is Inconclusive for transport attribution; an
attributable inability to complete the bridge is Refuted for this proposal and
requires revisiting D002 before product scaffolding.

## Revisit conditions

Revisit after S012, when Zed or the Java extension exposes a supported generic
coordination API, when a Java update changes the observed transport, when the
bridge cannot meet the security/lifecycle constraints, or when the product
owner explicitly chooses full Java ownership.
