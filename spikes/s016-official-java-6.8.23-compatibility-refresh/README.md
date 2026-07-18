# S016 disposable preparation

Preparation and runbook scaffolding for the reviewed
[S016 spike](../../docs/spikes/016-official-java-6.8.23-compatibility-refresh.md):
does official Java **6.8.23** preserve the accepted coordination and cleanup
contract, and can its official main runnable launch the fixture without a
product-generated duplicate task?

This directory is disposable spike code. It is not a product extension,
installer, launcher, server manager, or release package, and nothing here is
promoted into production. Production preparation stays in
`scripts/prepare-local-poc.mjs`, which remains pinned to the supported 6.8.21
baseline.

## `tools/prepare_s016.mjs`

The 6.8.23 analog of `scripts/prepare-local-poc.mjs`. Given a source Zed profile
that already has the official Java extension 6.8.23 installed, it stages one
isolated Zed profile plus a Spring Boot fixture worktree, four XDG roots, and an
evidence directory into a single fresh ignored root. It asserts the source Java
extension and extension index both report `6.8.23`, enables `log.lsp: "trace"`,
disables auto-update, and writes a `prepared.json` manifest with the fixture
digest.

It deliberately does **not** launch Zed, install the `zed-spring-tools` dev
extension, modify the official Java extension, or choose a compatibility
contract. Those stay explicit driven-run steps below.

### Self-test (no live 6.8.23 required)

```sh
node spikes/s016-official-java-6.8.23-compatibility-refresh/tools/prepare_s016.mjs --self-test
```

Builds a synthetic 6.8.23-shaped source profile and JDK home, runs `--prepare`
into a temporary `tmp/` root, and asserts the staged profile, index, settings,
and manifest. It also asserts the destination convention and that a 6.8.21
source is rejected. It cleans up every root it creates. Verified: passes on
2026-07-19 (Node 26.5.0, macOS 26.5.2 arm64).

### Prepare a real profile

```sh
node spikes/s016-official-java-6.8.23-compatibility-refresh/tools/prepare_s016.mjs \
  --prepare <official-java-6.8.23-profile> <repo>/tmp/s016-<label> <java-home>
```

`<fresh-root>` must be an absent, direct child of the repository `tmp/` whose
basename starts with `s016`. `<java-home>` is Temurin 25.0.3
(`~/.sdkman/candidates/java/25.0.3-tem`).

## Driven run (needs real Zed; see the zed-driven-run-mechanics memory)

### 1. Obtain official Java 6.8.23 (network step, pin the digest)

6.8.23 is absent from every local profile. In a scratch real Zed, update the
`java` extension to 6.8.23, confirm `extensions/installed/java/extension.toml`
reports `version = "6.8.23"` and source commit
`ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`, and record the installed digest.
Do not use an unpinned `latest` as an asserted supported configuration.

### 2. Stage the isolated profile

Run `--prepare` (above), then install the `zed-spring-tools` dev extension into
the staged profile **before** opening the Java worktree, so the classpath bridge
wins the S014 ordering race. Launch the isolated instance per the
zed-driven-run-mechanics memory (`XDG_*` overrides + `--user-data-dir <profile>`).

### 3. Two compatibility arms

- **Rejection control (unchanged product):** build from this branch's source
  unchanged (`protocol/java-providers.json` still `6.8.21`) and run against the
  6.8.23 install. Because the product performs no runtime detection of the
  installed extension version, this arm tests the *structural* gate: does the
  coordinator still resolve the pinned proxy route and bridge command/schema
  against 6.8.23, or does a changed proxy path / port scheme / bridge shape break
  it? Record the observed behavior; it must not enter a reduced managed-JDT mode.
- **Supported arm (explicit 6.8.23 record):** on this spike branch only, edit
  `protocol/java-providers.json` (`extensionVersion` → `6.8.23`, refresh
  `verifiedTuple`) and the hard-coded `6.8.21` check in
  `coordinator/src/main.mjs`, rebuild the WASM
  (`cargo build --locked --release --target wasm32-wasip2`), copy it over the
  repo-root `extension.wasm`, and confirm the running dev extension recompiles.
  Then repeat the exercise. Per the spike's Next experiment, this source edit is
  only promoted to a reviewed compatibility-table change *after* the run supports
  the contract — do not merge it as support before the evidence exists.

### 4. Exercise, then tear down

Follow Procedure steps 4–9 in the spike doc: bridge contribution, proxy
discovery, Spring startup, authentic classpath/project callbacks, visible
`server.port` completion, one navigation/Code Action, the official
`Run <main class>` runnable (attributed to 6.8.23's task helper and the Maven
wrapper), stop through Zed, uninstall, cleanup verification, and a log-redaction
scan. Capture bounded, redacted evidence into
`tmp/s016-java-6.8.23-20260719/evidence/`.

A task-helper-only failure with the coordination contract otherwise intact is a
split result — record 6.8.23 coordination Supported and runnable reuse Refuted
separately, per the spike's success/failure criteria.
