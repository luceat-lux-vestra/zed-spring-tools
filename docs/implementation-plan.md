# Product implementation and public-development plan

- Status: In progress; M1-M3 complete, M4 next
- Last updated: 2026-07-17
- Architecture: D002, D003, and D004 Accepted
- Local evidence: S013 Supported on macOS arm64/JDK 25; the M2 exit gate closed
  on that tuple from a driven clean install, restart, and uninstall cycle

## Outcome

Build a real, source-separated `zed-spring-tools` package and complete its basic
local product PoC before the first public GitHub push. The product is a
separately installed Spring companion that requires the official Zed Java
extension. It does not ship a reduced standalone Java environment or claim
untested platform support. Research and spikes remain evidence, not the public
release's substitute for product code.

## Delivery order and gates

### M0: Close the local direction gate

Status: complete.

- Preserve S012's Refuted cleanup observation and S013's supported correction.
- Accept D003 only with official Java and its proxy byte-for-byte unmodified.
- Keep all runtime binaries, profiles, routes, credentials, logs, and
  screenshots under ignored `tmp/` paths.

### M1: Production technology decision and scaffold

Status: complete.

D004 is accepted and the root product workspace it specifies exists: the
Rust/WASM adapter, the dependency-free Node coordinator, the Java bridge, and
the versioned protocol schemas and fixtures. No spike proxy was copied and no
third-party runtime binary is committed.

Exit gate met: clean locked builds and contract tests pass on the available
macOS host, no unreviewed network-at-runtime behavior exists, official Java is
unmodified, and the product/spike import check passed.

### M2: Product-grade macOS arm64 vertical slice

Status: complete. Steps 1-6 were driven live on macOS 26.5.1 arm64 with Zed
1.10.3, Java extension 6.8.21, and Temurin JDK 25.0.3. Step 7's diagnostic is
implemented and contract-tested but not yet observed at runtime.

Implement the smallest product flow in this order:

1. materialize the owned coordinator and bridge from the extension component;
2. acquire and verify the pinned unchanged Spring artifact;
3. discover and capability-probe the installed official Java provider;
4. contribute the exact bridge/Spring bundle set only to `jdtls`;
5. start one Spring LS and one worktree-scoped coordinator;
6. reproduce S013's authentic classpath event, visible `server.port`, exact
   removal, restart, and crash cleanup; and
7. show actionable missing/incompatible-Java errors instead of starting a
   misleading reduced mode.

Exit gate: a clean development-extension install reproduces the flow without
copying `spikes/` or manually preparing a worktree under `tmp/`; credentials and
classpaths are absent from normal logs; restart and uninstall leave no owned
process or secret route; and the tested tuple remains explicit.

Gate met on 2026-07-17 by a driven cycle, not by inference from end state.
Evidence: `tmp/m2-close-20260717/evidence/M2-GATE-RESULT.md`.

- A clean `install dev extension` reproduces the flow with no `spikes/` copy and
  no hand-prepared runtime: Zed compiled and loaded the extension, which
  materialized its own coordinator and bridge, acquired and validated the pinned
  Spring VSIX, discovered the official Java provider, and returned real Spring
  Boot metadata completions.
- The tab-order race fix holds at runtime. With the properties buffer opened
  before any Java file, the coordinator logged and waited for the official Java
  route, then enabled coordination and registered the bridge, showing no
  misleading failure while Java was absent.
- Restart leaves no owned process or route: owned processes reach zero within
  three seconds. Official Java's JDT LS outlives Zed briefly and exits on its
  own, so the injected bridge does not hold it open.
- Uninstall leaves no owned process or route, and the authentic removal contract
  that S012 was Refuted on executed: `official Java classpath bridge removed`.
- Credentials and classpaths are absent from a rotation-following log capture
  that provably spans a classpath registration, at the stricter `log.lsp:
  "trace"`. The only jar paths present are Zed's own language-server launch
  records of product installation paths, not the project classpath.

Two items are carried forward rather than waived:

- `zed::download_file` hung once for 24 minutes with no bytes, no connection, and
  no timeout while the network was healthy, and completed in seconds after a Zed
  restart. Acquisition can wedge with no actionable message. Zed's API takes no
  timeout, so the product cannot bound it directly; the cause is unestablished
  and one occurrence is not a reproduction. Tracked in `LIMITATIONS.md`.
- Step 7's missing/incompatible-Java diagnostic still needs a runtime
  observation. The adjacent absent-Java path was observed; `validateCompatibility`
  and `javaMajor` remain covered only by contract tests.

### M3: Initial experimental public source release

Status: complete, 2026-07-17.

The repository is public at
<https://github.com/luceat-lux-vestra/zed-spring-tools> under Apache-2.0, and
presents an actual extension project with its historical research rather than a
spike collection.

Exit gate met: the public URL serves unauthenticated, the default branch `main`
matches the reviewed local product commit `66f7024`, GitHub detects the license
as Apache-2.0, and the documents keep every untested tuple labeled `untested`
with no Marketplace or multiplatform claim.

Publication record:

- R010's audit was re-run at `1222f1e`: no binary or credential-container
  suffix, no credential shape, no absolute home path, 393 blobs over 4.87 MB,
  and all relative links resolving.
- The owner selected Apache-2.0 and the `luceat-lux-vestra` namespace, accepted
  publication of the existing author metadata without a history rewrite, and
  retained the `Co-Authored-By` trailers.
- The repository was created private, verified, and then flipped public, because
  GitHub secret scanning and private vulnerability reporting are unavailable on
  a private repository of this plan and could only run after the flip.
- After the flip, secret scanning was enabled and reports **0 alerts**, and
  private vulnerability reporting is enabled so `SECURITY.md` has a working
  route. The remote tree matched the local commit exactly at 172 files, with no
  ignored evidence, build output, or `extension.wasm` transmitted.

### M4: VS Code Spring Tools capability-parity program

Status: in progress. Inventory version 2 exists at
[capability-inventory.md](capability-inventory.md), derived by
[R011](research/011-vscode-spring-tools-capability-surface.md) from the pinned
Spring Tools `5.2.0.RELEASE`. It records 46 capabilities: 4 `verified`, 1
`implemented`, and 41 `planned`, with no `blocked-*` state asserted yet because
no capability has been investigated deeply enough to name its exact blocker.

Every user-visible capability has one state: `planned`, `implemented`,
`zed-native-equivalent`, `blocked-zed-api`, `blocked-upstream`, or `verified`.
Initial workstreams are:

- Spring Boot properties/YAML completion, hover, validation, navigation, and
  metadata refresh;
- Java/Spring symbols, request mappings, bean navigation, code lenses, and
  Boot project discovery;
- live application data, process connection, loggers, metrics, and actuator
  workflows;
- Boot dashboard, run/debug integration, tasks, and project actions using
  official Java ownership;
- Spring Initializr, guides, upgrade/refactoring, Modulith, and related
  commands; and
- settings, diagnostics, logs, compatibility UX, documentation, and offline
  behavior.

Each slice starts with a reviewed plan, adds contract and integration tests,
updates the inventory, and publishes its exact blocker when Zed lacks a UI or
protocol surface. Pixel-identical VS Code UI is not required; functional loss
must never be hidden.

### M5: Installability and platform validation

Platform-neutral paths, executable discovery, worktree identity, and no
unnecessary manifest restriction are required from M2. Runtime support claims
follow later.

Validate the six desktop tuples separately: macOS/Linux/Windows on x86_64 and
arm64/Arm64, followed by the declared JDK matrix. Untested tuples remain
`untested`. SSH remote development and WSL-hosted remote projects remain out of
scope until the local desktop matrix is stable and a later decision adds them.

### M6: Preview and incremental public releases

Publish experimental previews only when their capability inventory,
compatibility table, tested matrix, known blockers, third-party notices,
checksums, and rollback instructions are current. Stable release criteria are
defined later from observed preview reliability; feature count alone is not a
stability signal.

## Review record

Reviewed on 2026-07-17 before production implementation and amended after the
project owner rejected a research-only initial publication. D004 is the explicit
language/build/packaging gate. The amended order completes a source-separated
basic product PoC before creating the public repository, preserves official Java
ownership, prohibits copying spike infrastructure into production, and makes
capability parity an auditable inventory rather than a broad marketing claim.

The highest known risks are the official proxy's private compatibility surface,
third-party artifact distribution, currently unhandled Spring client methods,
shutdown-response mismatches, Java-provider updates, and the untested platform
matrix. Each has an explicit decision or validation gate above; none is treated
as already solved by the local PoC.
