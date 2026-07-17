# Product implementation and public-development plan

- Status: In progress; M1 complete, M2 substantially complete
- Last updated: 2026-07-17
- Architecture: D002, D003, and D004 Accepted
- Local evidence: S013 Supported on macOS arm64/JDK 25; the M2 product slice
  reproduced real Spring Boot completions from a clean install on that tuple

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

Status: substantially complete; steps 1-6 reproduced on macOS 26.5.1 arm64 with
Zed 1.10.3, Java extension 6.8.21, and Temurin JDK 25.0.3.

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

Gate evidence recorded on 2026-07-17:

- A clean development install reproduces the flow. The extension materializes
  its own coordinator, bridge, and pinned Spring artifact into its private work
  directory; `scripts/prepare-local-poc.mjs` only isolates the host Zed profile
  and the fixture project, and does not hand-prepare the product's runtime.
- Credentials and classpaths are absent from the audited logs, at the stricter
  `log.lsp: "trace"` level. The bridge credential exists only in coordinator
  memory and its route binds an ephemeral loopback port, so neither reaches
  disk; classpath payloads never cross the Zed-facing channel.
- No owned process or owned route survived the run. The one leftover route file
  belongs to the unmodified official Java proxy, not to this project.

Remaining before the gate closes: a freshly driven restart and uninstall
observation. Current cleanup evidence is post-run end state plus the coordinator
lifecycle tests, which is weaker than a live cycle. Step 7's actionable
missing/incompatible-Java error path also still needs a runtime observation
rather than only its contract test.

### M3: Initial experimental public source release

The first public push follows M2 and presents the repository as an actual
extension project with historical research, not as a spike collection.

Progress retained from the earlier publication audit: public compatibility,
limitation, contribution, conduct, security, and third-party-boundary documents
are drafted. Re-run the reachable-history and product-artifact audit after M2,
then select the repository license and final GitHub namespace, enable private
reporting, create the remote, and push the reviewed product commit.

Exit gate: the public URL works, the default branch matches the reviewed local
product commit, the license is explicit, and the source release makes no stable
Marketplace or multiplatform claim.

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
