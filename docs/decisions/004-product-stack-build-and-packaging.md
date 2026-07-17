# D004: Product stack, build, and packaging

- Status: Accepted
- Date: 2026-07-17
- Decision owner: Project owner
- Depends on: D002, D003, R005, R009, S012, and S013

## Context

The research and disposable spikes have proved the official-Java companion
architecture on one macOS arm64/JDK 25 tuple. They have not produced product
code. Before creating a production manifest or source tree, the project must
select a buildable, source-first structure that can reproduce the local PoC
without copying the spike proxy, mutating official Java, committing third-party
runtime binaries, or making an untested platform claim.

The initial public repository must contain an actual product scaffold and a
locally verified basic product PoC. Publishing the current research tree alone
is no longer a milestone.

## Evidence

- D002 and D003 require a separately installed companion, the official Zed Java
  extension, one Java-owned JDT LS, an injected owned bridge, and a separately
  owned Spring coordinator and Spring Boot LS.
- S012/S013 prove that Zed extension API 0.7.0 can contribute six bundle paths
  to `jdtls`, Zed-managed Node can run the Spring stdio coordinator, the
  unchanged Java proxy can execute allowlisted bridge commands, and the bridge
  can deliver an authenticated classpath event directly to the coordinator.
- The inspected Zed extension builder compiles procedural Rust to
  `wasm32-wasip2` and packages the manifest and `extension.wasm`; arbitrary
  coordinator assets are not copied automatically. The extension WASI process
  has a private writable extension work directory.
- The inspected API exposes `node_binary_path`, platform/worktree discovery,
  settings, installation status, and bounded download primitives.
- The official Java proxy 6.8.21 writes its loopback port below its own extension
  work directory using the UTF-8 hexadecimal form of the normalized language-
  server working directory. R009 and S012 validate the request shape used by
  the first compatibility adapter.
- R005 fixes the unchanged Spring Tools `5.2.0.RELEASE` VSIX and checksum, and
  blocks project-operated repackaging or mirroring while its third-party notice
  inventory is incomplete.
- The S012 bridge compiles and runs on Java 21 bytecode under JDK 25. Its runtime
  dependencies are supplied by the fixed JDT LS and Spring JDT bundles.

## Options considered

### Coordinator as a native Rust executable

This would provide one implementation language for persistent coordination but
would require six signed native artifacts and a separate updater before the
first local product PoC. It adds distribution work without changing the proven
protocol boundary.

### Coordinator inside the Java/Spring process

This would reduce process count but couple Spring stdio ownership, official Java
transport discovery, and bridge HTTP handling to the JVM launch. It would also
make Zed-facing LSP lifecycle failures harder to isolate and departs from the
supported S013 boundary.

### Dependency-free coordinator on Zed-managed Node

The coordinator remains platform-neutral JavaScript, uses only Node built-ins,
and runs on the Node executable already exposed by Zed. Its source can be
embedded in the extension component and materialized into the private extension
work directory, avoiding npm installation and arbitrary packaged assets.

### Build the Java bridge against downloaded runtime JARs

This gives the compiler the exact runtime APIs but makes every source build
depend on an 82 MB VSIX and JDT distribution before Cargo can compile. It also
mixes third-party acquisition with production source compilation.

### Build against narrow source-controlled compile stubs

The bridge can compile against minimal signatures for the exact JDT and Spring
interfaces it references. Stub classes are never packaged. Runtime regression
tests still load the result with the real fixed bundles, so a stub cannot by
itself establish compatibility.

### Repackage Spring runtime components

This could produce a smaller download but would make the project the distributor
of a modified artifact before the third-party notice inventory is complete.

### Acquire the unchanged official VSIX

The extension downloads or accepts a user-supplied copy of the exact official
asset, verifies its SHA-256 before activation, extracts only after validation,
and preserves the upstream package/license context.

## Decision

### Product workspace

The repository root becomes the production Zed extension package. The product
layout is:

```text
Cargo.toml                 # locked Rust/WASM extension package
Cargo.lock
build.rs                   # deterministic owned-bridge build
extension.toml             # production extension manifest
src/                       # Zed adapter and product installer
coordinator/               # dependency-free Node ESM source and tests
bridge/                    # owned Java 21 OSGi bridge source and compile stubs
protocol/                  # versioned schemas, fixtures, and compatibility data
tests/                     # product integration fixtures and verifiers
scripts/                   # shell-independent local build/verification entrypoints
docs/                      # decisions, research, spikes, product documentation
spikes/                    # disposable historical evidence, excluded from all builds
```

No production module imports from `spikes/`, and no spike manifest, package ID,
state path, event name, or test-only proxy becomes a product dependency.

### Zed adapter

- Use Rust edition 2024 compiled to `wasm32-wasip2` as a `cdylib`.
- Pin `zed_extension_api` exactly and commit `Cargo.lock`; the initial adapter
  stays on the runtime-proven 0.7.0 boundary until an explicit upgrade test.
- Use Zed worktree/platform/environment APIs and argument arrays. Do not use a
  platform shell for normal installation or launch.
- Materialize embedded, versioned coordinator source and the owned bridge JAR
  into the extension's private work directory with atomic replacement and
  digest verification.
- Register one Spring language server and contribute the exact approved bundle
  set only to target server ID `jdtls`.

### Coordinator

- Use dependency-free ECMAScript modules on Zed-managed Node. There is no npm
  runtime dependency, global Node prerequisite, or native coordinator binary.
- Embed coordinator source in the Rust component at build time and write it to
  a content-addressed runtime directory before launch.
- Own Spring Boot LS stdio, child lifecycle, Java-provider discovery/probing,
  bridge registration/removal, authenticated callback routing, request
  correlation, deadlines, redacted diagnostics, and exact cleanup.
- Derive only the versioned official-Java route selected by the compatibility
  table. Reject missing, stale, malformed, or incompatible routes explicitly;
  never start a second JDT LS.

### Java bridge

- Use owned Java source compiled with `javac --release 21`.
- Compile against minimal source-controlled signatures for the exact JDT/Spring
  interfaces. Compile stubs are excluded from the JAR and carry provenance
  comments; real-bundle integration tests are the compatibility authority.
- Build from Cargo `build.rs` with a discovered JDK 21+ and create the JAR in
  deterministic entry order with fixed timestamps and file modes. The build
  fails if any compile-stub class enters the JAR or repeated builds differ.
- Embed only this project's bridge JAR in `extension.wasm`. It is not a language
  server and contains no third-party class or resource.
- Use a stable product symbolic name and schema-versioned add/remove commands;
  do not retain S012 names.

### Spring artifact acquisition

- Pin Spring Tools tag, asset name, source commit, size, and SHA-256 in a
  versioned product manifest.
- Download the unchanged official VSIX as an uncompressed file through the
  narrow declared GitHub capability, verify its SHA-256, then extract it with
  bounded Rust ZIP handling into a fresh staging directory.
- Validate exact required relative paths, file types, bundle names, and selected
  digests before atomic activation. Reject symlinks, traversal, unexpected
  required-entry types, checksum mismatch, partial state, and stale schema.
- Permit a user-configured local VSIX path with the same validation. Do not
  mirror, repackage, commit, or embed Spring/JDT/Zed runtime binaries.
- Keep one previous valid version for rollback; offline startup may reuse an
  already verified installation.

### Java provider compatibility

Store compatibility data in `protocol/java-providers.json`. Each entry contains
the schema version, provider ID, observed extension version/source identity,
route discovery algorithm, required proxy behavior, target JDT server ID,
injected bundle contract, bridge command version, and verified JDT/Spring tuple.

Runtime selection is capability-based. A matching entry must find the owned
route, validate a safe regular port record, reach the loopback proxy, and obtain
the expected bridge command result. A version string alone is insufficient.
Unknown behavior produces an actionable incompatible-Java diagnostic.

### Build, formatting, tests, and CI

- `cargo build --locked` is the authoritative product build. `build.rs` builds
  the bridge; no Gradle, Maven, npm, Python, or platform shell is required.
- Rust uses `cargo fmt --check`, Clippy with warnings denied, unit tests, and
  WASM release builds. Node uses `node --check` and `node --test`. Java uses
  `javac --release 21 -Xlint:all -Werror`, protocol self-tests, JAR content
  verification, and repeated-build digest comparison.
- A dependency-free Node repository checker enforces UTF-8, final newlines,
  trailing-whitespace absence, and product/spike import separation across Java,
  JavaScript, JSON, TOML, Rust, and Markdown.
- Contract fixtures are shared as JSON rather than by cross-language source
  imports. Each runtime validates the same positive and negative frames.
- The initial local verification entrypoint runs every source/contract/build
  check and the fixed macOS integration flow. Product CI is added with the
  public repository: source/contract builds on available desktop runners,
  while only tested tuples may change support labels.

## Basic product PoC exit gate

Before the first public push, the root product package must:

1. build from source with locked Rust inputs and JDK 21+;
2. install as a Zed development extension without copying a spike directory;
3. acquire or validate the pinned unchanged Spring VSIX transactionally;
4. require and capability-probe official Java without modifying its component,
   proxy, or installation;
5. launch one coordinator and one Spring Boot LS, inject only the five Spring
   bundles and owned bridge into the Java-owned JDT LS, and start no second JDT;
6. return a visible attributable `server.port` completion from a clean fixture;
7. remove the listener and owned route and leave no owned child after shutdown;
8. pass product contract/build tests and preserve exact tested/untested labels;
   and
9. make README and installation documentation product-first while retaining
   spikes only as historical evidence.

## Consequences

- Product source is visibly separate from feasibility evidence and can become a
  normal Zed extension repository.
- The initial build requires a JDK 21+ because it builds an owned Java bridge;
  Java 25 remains valid through `--release 21`.
- Embedding source and the owned bridge makes the extension component
  self-contained without bundling Spring or JDT binaries.
- Managed Node avoids six coordinator builds, but coordinator correctness still
  depends on the Node version supplied by each Zed host and requires contract
  testing on each platform.
- Compile stubs reduce build acquisition but increase the obligation to run
  real-bundle compatibility tests for every supported Java/Spring tuple.
- The first artifact download is large and requires explicit permission; cached
  offline reuse and local-path configuration are required product behavior.

## Revisit conditions

Revisit when Zed can package arbitrary owned extension resources, exposes a
supported cross-language-server coordination API, removes managed Node, changes
download sandbox semantics, or when real platform tests show Node or Rust ZIP
handling is not viable. Revisit the artifact strategy when Spring publishes a
standalone language-server distribution with a complete notice inventory.
