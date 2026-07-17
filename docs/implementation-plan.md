# Product implementation and public-development plan

- Status: Reviewed; implementation not started
- Last updated: 2026-07-17
- Architecture: D002 and D003 Accepted
- Local evidence: S013 Supported on macOS arm64/JDK 25

## Outcome

Publish the current research and reproducible local PoC as an experimental
public source repository, then build `zed-spring-tools` in public toward
capability parity with VS Code Spring Tools. The product is a separately
installed Spring companion that requires the official Zed Java extension. It
does not ship a reduced standalone Java environment or claim untested platform
support.

## Delivery order and gates

### M0: Close the local direction gate

Status: complete.

- Preserve S012's Refuted cleanup observation and S013's supported correction.
- Accept D003 only with official Java and its proxy byte-for-byte unmodified.
- Keep all runtime binaries, profiles, routes, credentials, logs, and
  screenshots under ignored `tmp/` paths.

### M1: Experimental public source release

No product scaffold is required for this milestone.

Progress on 2026-07-17: the reachable Git history, tracked files, generated
artifact extensions, object sizes, identity/path patterns, and credential
patterns were audited. No reachable third-party binary, oversized blob, local
absolute path, or credential-shaped value was found. Research code contains
expected synthetic `token` fields only. Public compatibility, limitation,
contribution, conduct, security, and third-party-boundary documents are drafted.
Repository license selection, final GitHub namespace, private reporting setup,
remote creation, and push remain open.

1. Select and add the repository license; record third-party notice and
   redistribution boundaries from R005.
2. Audit tracked objects and full Git history for credentials, local paths,
   generated binaries, VSIX/JAR/WASM artifacts, oversized files, and private
   data.
3. Make every reproduction instruction distinguish committed source from
   ignored local evidence and user-supplied or downloaded pinned artifacts.
4. Add contribution, conduct, vulnerability-reporting, and experimental-status
   documents appropriate for public development.
5. State the exact tested tuple and label every other platform/JDK tuple
   `untested`.
6. Create the public GitHub repository only after the audit is clean, push the
   reviewed default branch, and create an initial experimental source tag only
   if the tag contents are reproducible and contain no third-party binaries.

Exit gate: public repository URL works, the default branch matches the reviewed
local commit, the license is explicit, and the source release makes no stable
Marketplace or multiplatform claim.

### M2: Production technology decision and scaffold

Before adding production files, record D004. It must decide:

- the Zed adapter language and component build;
- the coordinator runtime and how it is acquired on every desktop tuple;
- the Java bridge build, Java baseline, and deterministic packaging;
- artifact acquisition versus redistribution for Spring Tools components;
- the versioned `JavaTransport` compatibility-table format; and
- workspace layout, test layers, formatting, dependency locking, and CI scope.

The first scaffold contains only protocol schemas, pure contract tests, the
required-Java compatibility diagnostic, and empty lifecycle boundaries. It may
not copy a spike proxy, include downloaded binaries, or claim a working Spring
feature.

Exit gate: clean builds and contract tests on the available macOS host, no
unreviewed network-at-runtime behavior, no official-Java mutation, and a manual
diff confirming that disposable spike code was redesigned rather than promoted.

### M3: Product-grade macOS arm64 vertical slice

Implement the smallest supported product flow in this order:

1. discover and capability-probe the installed official Java provider;
2. acquire and verify pinned Spring artifacts under the accepted license plan;
3. contribute the exact bridge/Spring bundle set only to `jdtls`;
4. start one Spring LS and one worktree-scoped coordinator;
5. reproduce S013's empty baseline, authentic classpath event, visible
   `server.port`, exact removal, restart, and crash cleanup; and
6. show actionable missing/incompatible-Java errors instead of starting a
   misleading reduced mode.

Exit gate: a clean install reproduces the flow without any manual `tmp/`
preparation, credentials or classpaths are absent from normal logs, restart and
uninstall leave no owned process or secret route, and the tested tuple remains
explicit.

### M4: VS Code Spring Tools capability-parity program

Create a versioned inventory from the current VS Code Spring Tools release.
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

Reviewed on 2026-07-17 before production implementation. The review keeps the
public source release ahead of product scaffolding, adds D004 as the explicit
language/build/packaging gate, preserves official Java ownership, prohibits
copying spike infrastructure into production, and makes capability parity an
auditable inventory rather than a broad marketing claim.

The highest known risks are the official proxy's private compatibility surface,
third-party artifact distribution, currently unhandled Spring client methods,
shutdown-response mismatches, Java-provider updates, and the untested platform
matrix. Each has an explicit decision or validation gate above; none is treated
as already solved by the local PoC.
