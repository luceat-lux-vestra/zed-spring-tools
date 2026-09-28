# D007: Standalone Spring language server and publishing boundary

- Status: Accepted for implementation under #159; release acceptance still requires exact-final-HEAD Zed validation
- Date: 2026-09-25
- Decision owner: Project owner
- Supersedes: D002/D003/D004/D006 only where they require or describe private cross-extension Java coordination
- Preserves: D001 product goal and staged publication; D005 LSP-first capability-delivery policy

## Context

The original product architecture paired Spring Tools with the official Zed Java
extension by discovering the Java extension's private work directory, reading its
worktree-scoped proxy route file, calling the private loopback `java-lsp-proxy`,
and injecting a bridge bundle into the Java-owned JDT LS. That design was built
because Zed exposes no public cross-extension API for one extension to send
arbitrary requests or commands to another extension's language server.

The 2026-09-25 publishing-policy audit changes the admissible boundary. Zed's
current publishing prerequisites require an extension not to read or modify
outside the environment Zed designates for it and say that extension-API
limitations must not be bypassed by misusing the API. The official Java
extension's own source describes `java-lsp-proxy` as a temporary internal
workaround until the extension API can send LSP requests directly; it is not a
declared companion-extension integration surface.

Keeping the private `../java/proxy/<worktree>` protocol would therefore leave
Registry publication dependent on an undocumented sibling-extension
implementation detail and on maintainer discretion. Package CI success is not
evidence that this boundary is publishing-compliant.

Spring Tools 5.3.0.RELEASE also publishes an official standalone Boot language
server. Its `StandaloneProjectServiceConfig` supplies Maven/Gradle project
models and Jandex-backed Java indexing without JDT LS. This gives the product a
route that stays inside its own extension work directory while leaving the
official Java extension responsible for ordinary Java editing.

## Decision

Run the official Spring Tools standalone language server as this extension's
Spring runtime.

The runtime boundary is:

```text
Zed
├── official Java extension / JDT LS
│   └── owns Java editing, navigation, diagnostics, debugger integration, etc.
│
└── Zed Spring Tools
    ├── Rust/WASM extension adapter
    ├── product-owned Node coordinator
    └── official Spring Tools standalone Boot language server
        ├── Maven / Gradle project model
        └── Jandex-backed Spring Java indexing
```

The two language servers may both serve Java documents through Zed's normal
multi-server routing. They do not communicate through either extension's private
work directory.

The product MUST NOT:

- derive or read the official Java extension's work directory;
- read `java/proxy/<worktree>` route files;
- call `java-lsp-proxy` or another private official-Java localhost endpoint;
- inject the product's bridge bundle into the Java-owned JDT LS;
- depend on `zed.spring.bridge.v1.*` commands or `sts.java.*` private command
  mappings; or
- reintroduce those mechanisms as a fallback when standalone behavior is
  incomplete.

The product continues to require the official Java extension for the Java
language/editor experience; that is a user-visible composition requirement, not
a private runtime dependency.

## Spring client callbacks

The standalone server still contains a small number of VS Code-oriented client
callbacks. They are handled explicitly rather than tunneled through JDT LS.

### `sts/project/gav`

The standalone executable-project query uses this callback only to enrich each
project record with optional GAV data. A `null` entry leaves that project
unchanged. The coordinator therefore returns one `null` per requested project,
preserving cardinality without inventing Maven coordinates.

### `sts/javaCodeComplete`

Spring XML Java type/package completion delegates to this callback. Zed exposes
no public cross-extension request surface that can reproduce it. The coordinator
returns an empty result and the capability is treated as unavailable until a
public route exists. It must not be silently claimed as verified.

### Other former Java callbacks

For this Zed client, the standalone server uses the non-JDT project service and
the default element-location provider. JDT classpath listening remains disabled
with `enableJdtClasspath: false`. The former classpath listener, Java type,
Javadoc, search, hierarchy, and bridge routes are therefore not part of the
product runtime contract.

## Artifact boundary

The extension downloads only the official standalone artifact declared in
`protocol/spring-artifacts.json`:

- Spring Tools tag: `5.3.0.RELEASE`
- source commit: `573f714dc76f178bfb2af392d03864f2a0a540ac`
- artifact version: `2.3.0`
- asset: `spring-boot-language-server-standalone-exec.jar`

Size and SHA-256 are pinned and validated before activation. Installation remains
inside this extension's own work directory.

## Evidence and release gate

#159 / PR #160 must prove, on its exact final HEAD:

1. no production source or packaged protocol depends on a sibling extension work
   directory, Java proxy route, bridge bundle, or private `sts.java.*` command;
2. the pinned standalone artifact identity is exact and fail-closed;
3. coordinator, Rust, repository-policy, dependency, and platform validation all
   pass without weakening their gates;
4. capability inventory and limitations distinguish current standalone evidence
   from historical JDT/bridge evidence; and
5. the exact source commit intended for Registry submission is loaded and
   exercised as a Zed dev extension through the isolated D007 desktop gate in
   [`docs/d007-zed-desktop-validation.md`](../d007-zed-desktop-validation.md).

The six-platform CI matrix is headless portability/runtime evidence. It is not a
substitute for item 5 and must not be described as full Zed desktop evidence.

Only after this decision's release gate passes may the Registry fork branch be
refreshed and upstream PR #6875 be prepared for renewed human review.

## Consequences

- Registry publication no longer relies on another extension's private files or
  localhost protocol.
- The bridge module, Java transport, provider schema, JDT/Spring bridge smoke,
  and their packaging machinery are removed.
- Historical bridge/JDT evidence remains valid as history but does not establish
  behavior of the standalone architecture.
- Capabilities that rely on the standalone Spring server must be revalidated
  before a release-facing `verified` claim is carried forward.
- Spring XML Java type/package completion is a known reduction unless a public
  Zed integration surface becomes available.
- A future public Zed cross-language-server API may justify a new decision, but
  it must not resurrect the old private protocol implicitly.
