# S016 disposable preparation

Preparation and runbook scaffolding for the reviewed
[S016 spike](../../docs/spikes/016-official-java-6.8.23-compatibility-refresh.md):
does official Java **6.8.23** preserve the accepted coordination and cleanup
contract, and can its official main runnable launch the fixture without a
product-generated duplicate task?

This directory is disposable spike code. It is not a product extension,
installer, launcher, server manager, or release package, and nothing here is
promoted into production. Production preparation stays in
`scripts/prepare-local-poc.mjs`, pinned to the supported 6.8.21 baseline.

## Why this differs from the 6.8.21 flow

Official Java 6.8.23 is **not in the Zed extension registry**
(`zed-industries/extensions` still pins `java = 6.8.21`), even though
`zed-extensions/java` has tagged `v6.8.23` (commit
`ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`). The Extensions UI cannot install it.
So 6.8.23 is obtained by **dev-installing it from source**, and there is no
registry install to copy. This tool therefore only stages a clean sandbox; both
extensions are dev-installed by hand.

## `tools/stage_s016.mjs`

```sh
node spikes/s016-official-java-6.8.23-compatibility-refresh/tools/stage_s016.mjs \
  --stage <repo>/tmp/s016-<label> <java-home>
```

Creates one fresh isolated Zed profile (LSP trace on, pinned JDK home,
`jdk_auto_download` off, auto-update/AI off, Java/Properties/YAML language-server
mapping), copies the Spring Boot fixture into a worktree, and makes the XDG and
evidence roots. `<fresh-root>` must be an absent, direct child of the repository
`tmp/` whose basename starts with `s016`; `<java-home>` is Temurin 25.0.3
(`~/.sdkman/candidates/java/25.0.3-tem`). It does not copy `java`, launch Zed,
install extensions, or download servers.

Self-test (no live Zed needed), passes on 2026-07-19 (Node 26.5.0, macOS 26.5.2
arm64):

```sh
node spikes/s016-official-java-6.8.23-compatibility-refresh/tools/stage_s016.mjs --self-test
```

## Driven run (needs real Zed; see the zed-driven-run-mechanics memory)

### 1. Source clone (done once, pin the commit)

`zed-extensions/java` is cloned at v6.8.23 to
`tmp/s016-java-6.8.23-20260719/zed-java-src` (checked out at commit `ddc13da`;
`git tag --points-at HEAD` → `v6.8.23`). Do not use an unpinned `latest`.

### 2. Stage the sandbox

Run `--stage` (above). A prepared profile already exists at
`tmp/s016-run-20260719/`.

### 3. Launch isolated Zed and dev-install both extensions before opening Java

```sh
R=<repo>/tmp/s016-run-20260719
XDG_CACHE_HOME=$R/xdg-cache XDG_DATA_HOME=$R/xdg-data XDG_STATE_HOME=$R/xdg-state \
  /Applications/Zed.app/Contents/MacOS/cli --foreground --new \
  --user-data-dir $R/profile $R/worktree
```

In that instance, before opening any `.java` file, install **both** dev
extensions so `zed-spring-tools` wins the S014 classpath-bridge ordering race:

1. `zed: install dev extension` → select the repository root
   (`zed-spring-tools`).
2. `zed: install dev extension` → select
   `tmp/s016-java-6.8.23-20260719/zed-java-src` (`java` 6.8.23). Zed builds the
   WASM; on first Java open it downloads jdtls and the v6.8.23 proxy from the
   tag's GitHub release. Record the installed digest.

Confirm the running `java` extension reports 6.8.23 before proceeding.

### 4. Two compatibility arms

- **Rejection control (unchanged product):** the branch's product source stays at
  `6.8.21` in `protocol/java-providers.json`. Because the product does no runtime
  detection of the installed extension version, this arm tests the *structural*
  gate — does the coordinator still resolve the pinned proxy route and bridge
  command/schema against 6.8.23's proxy, or does a changed proxy path / port
  scheme / bridge shape break it? It must not enter a reduced managed-JDT mode.
- **Supported arm (explicit 6.8.23 record):** on this spike branch only, edit
  `protocol/java-providers.json` (`extensionVersion` → `6.8.23`, refresh
  `verifiedTuple`) and the hard-coded `6.8.21` check in
  `coordinator/src/main.mjs`, rebuild the WASM
  (`cargo build --locked --release --target wasm32-wasip2`, copy over the
  repo-root `extension.wasm`), and repeat. Per the spike's Next experiment this
  source edit is promoted to a reviewed compatibility-table change only *after*
  the run supports the contract.

### 5. Exercise, then tear down

Follow Procedure steps 4–9 in the spike doc: bridge contribution, proxy
discovery, Spring startup, authentic classpath/project callbacks, visible
`server.port` completion, one navigation/Code Action, the official
`Run <main class>` runnable (attributed to 6.8.23's `task_helper` and the Maven
wrapper), stop through Zed, uninstall, cleanup verification, and a log-redaction
scan. Capture bounded, redacted evidence into
`tmp/s016-java-6.8.23-20260719/evidence/`.

A task-helper-only failure with the coordination contract otherwise intact is a
split result — record 6.8.23 coordination Supported and runnable reuse Refuted
separately, per the spike's success/failure criteria.
