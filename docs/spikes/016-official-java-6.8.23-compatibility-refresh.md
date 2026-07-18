# S016: Official Java 6.8.23 compatibility refresh

- Status: Prepared; runtime driven run pending (see Preparation below)
- Date: 2026-07-18 (prepared 2026-07-19)
- Related research:
  [R014](../research/014-final-upstream-capability-surface-audit.md)
- Decisions:
  [D003](../decisions/003-java-companion-product-architecture.md) and
  [D005](../decisions/005-lsp-first-capability-delivery.md)

## Hypothesis

On the fixed macOS arm64/JDK 25 tuple, unmodified official Java extension 6.8.23
preserves the accepted Java/Spring coordination and cleanup contract and its
official main-class runnable can launch the representative Maven Spring Boot
application without a product-generated duplicate Java task.

## Why runtime verification is required

D003 rejects unknown Java providers until their exact transport and lifecycle
contract is verified. Java 6.8.23 changes the extension substantially: it adds a
downloaded task helper, Maven/Gradle/vanilla task resolution, Gradle LS, new
language resources, and proxy code changes. Source inspection shows useful
execution functionality but cannot prove compatibility with the product's
bridge, cold installation, callbacks, cleanup, logging, or the fixture's Boot
main class.

## Environment

- macOS 26.5.1 arm64
- stock compatibility-tested Zed version selected when the spike starts; record
  the exact version and commit
- official Java extension exactly 6.8.23, commit
  `ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`
- Spring Tools `5.2.0.RELEASE`
- Temurin JDK 25.0.3
- the current product built from reviewed source
- the existing non-secret Maven Spring Boot fixture used for capability runs
- an isolated Zed profile and ignored evidence directory

Other desktop, architecture, JDK, Zed, Java-extension, and build-tool tuples
remain untested.

## Preparation (2026-07-19, source-backed; no runtime claim)

Groundwork completed before the driven run. Nothing here asserts a runtime
result; the compatibility state is unchanged.

### Environment pinned and captured

Host, Zed, JDK, and product source are recorded in
`tmp/s016-java-6.8.23-20260719/evidence/` (`env.txt`, `README.md`). The host is
now macOS **26.5.2** (build 25F84), a point release above the 26.5.1 recorded on
the earlier tested tuple; each run must record the exact observed value rather
than assume the earlier release. Zed is `1.11.3`, runtime JDK Temurin `25.0.3`.

### 6.8.23 is not installable from the Zed registry; it needs a source dev build

Every `extensions/installed/java/extension.toml` on the host reported
`version = "6.8.21"`. Confirmed on 2026-07-19 why: `zed-extensions/java` has
tagged **v6.8.23** (2026-07-17, commit `ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`),
but the Zed extension registry (`zed-industries/extensions/extensions.toml`) still
pins `java = 6.8.21`. Zed's Extensions UI therefore offers only 6.8.21, and a
normal "update" cannot reach 6.8.23. (A `proxy-bin/v6.8.23/` binary was observed
in the live work dir before the user uninstalled `java`, consistent with a prior
source dev build having fetched the versioned proxy.)

Obtaining 6.8.23 therefore means cloning `zed-extensions/java` at v6.8.23 and
installing it as a **dev extension**, so Zed builds the WASM and, on first Java
open, downloads jdtls plus the v6.8.23 proxy from the tag's GitHub release
(`src/proxy.rs` → `github_release_by_tag_name`). Source review of the tag
confirms the S016 hypothesis's additions are present: a `task_helper` crate, a
`gradle-bridge`, and a new `gradle-language-server` language server in
`extension.toml`. Do not use an unpinned `latest`; the pinned tag/commit above is
the spike input. The clone lives at
`tmp/s016-java-6.8.23-20260719/zed-java-src` (checked out at the commit,
gitignored).

Consequence: a copy-from-installed profile prep (the shape of
`scripts/prepare-local-poc.mjs`) does not fit, because there is no registry
install to copy. The spike stages only a fresh isolated profile plus the fixture
and settings; `java` (6.8.23) and `zed-spring-tools` are both dev-installed into
that profile, preserving the S014 ordering by installing both before the fixture
opens.

### The compatibility contract is self-asserted, not runtime-detected

Source review of the product (not a runtime observation):

- The extension writes its own embedded `protocol/java-providers.json` into the
  runtime work dir (`src/runtime.rs`), and the coordinator validates *that* file.
  `validateCompatibility` (`coordinator/src/main.mjs:454`) requires exactly one
  provider and hard-codes `provider.extensionVersion !== "6.8.21"` alongside the
  route/bridge shape.
- `platform::resolve_java` (`src/platform.rs`) discovers only the `java`
  *executable* via `worktree.which("java")`. Nothing reads the installed Java
  *extension's* `extension.toml` version.
- The coordinator reaches the official proxy purely through a port file at
  `<javaWork>/proxy/<routeId>` (`coordinator/src/java_transport.mjs:31`); the
  bridge handshake exchanges a schema version, not an extension version.

Consequence for Procedure step 3: the "rejection control" cannot be a
version-string refusal of the installed extension, because the product performs
no such detection. With the unchanged contract the coordinator will still attempt
to connect to whatever proxy exists at the pinned path. A mismatch can therefore
surface only *structurally* — a changed proxy route/directory, port-file scheme,
or bridge command/schema in 6.8.23. Adding a "6.8.23 compatibility record" is, in
the current design, a source edit to `java-providers.json` plus the hard-coded
`6.8.21` check (and the `providers.length === 1` shape); it changes the product's
self-declared support, not any runtime gate. The driven run must therefore:

1. observe whether unchanged 6.8.21-contracted product still resolves the pinned
   route and bridge against a real 6.8.23 install (the true structural gate), and
2. treat "accepts only the explicitly added record" as a statement about the
   self-asserted contract, noting that a genuine installed-version guard does not
   yet exist and recording whether the spike result argues for adding one.

This is the reusable design finding to carry into the follow-up decision on how
6.8.23 should be admitted.

### Profile-staging scaffolding

`spikes/s016-official-java-6.8.23-compatibility-refresh/` holds a disposable
`stage_s016.mjs` plus a driven-run runbook. `--stage` builds a fresh isolated
Zed profile (trace on, pinned JDK home, auto-update off) and the fixture
worktree; it does not copy `java`, because 6.8.23 is dev-installed, not a
registry install. `--self-test` passes without a live install. The interactive
Zed steps — dev-installing both extensions and driving the pickers — remain
manual.

## Procedure

1. Record the clean source commit, product artifacts, exact official Java 6.8.23
   release artifact and digest, Spring artifact digest, JDK, Zed, OS, and
   architecture. Do not use an unpinned `latest` URL.
2. Prepare a clean isolated Zed profile. Install official Java 6.8.23 unchanged
   before installing the development product, preserving the S014 ordering
   contract.
3. Start the fixture and verify the coordinator accepts only the explicitly
   added 6.8.23 compatibility record. A run without that record is the rejection
   control and must not enter a reduced mode.
4. Exercise the accepted D003 boundary: bridge bundle contribution, official
   proxy discovery, Spring startup, authentic Java classpath/project callbacks,
   visible `server.port` completion, and one verified navigation or Code Action
   route.
5. Trigger the official Java `Run <main class>` runnable on the fixture's
   `@SpringBootApplication` class. Attribute the command to Java 6.8.23's task
   helper and the project Maven wrapper, then verify the application becomes
   reachable and its output is visible in Zed's terminal/task UI.
6. Stop the task through Zed and verify the Boot process exits. Then close the
   worktree and uninstall the product through the accepted lifecycle.
7. Prove the authentic Spring removal reaches the bridge, every owned route and
   process is removed, official Java remains installed and unmodified, and a
   restart does not resurrect product-owned state.
8. Scan retained logs for credentials, complete classpaths, authorization data,
   and unexpected absolute user paths. Record bounded, redacted evidence only.
9. Repeat a warm offline start using only already verified local artifacts. Do
   not claim general offline support from this one tuple.

## Success criteria

- The unknown-provider control rejects Java 6.8.23 without starting a reduced
  managed-JDT mode.
- The explicit 6.8.23 compatibility record supports the same bridge, callback,
  visible Spring completion, and cleanup outcomes accepted for 6.8.21.
- The official Java main runnable uses its task helper and the Maven wrapper,
  starts the representative Spring Boot application, exposes useful terminal
  output, and stops cleanly through Zed.
- Product uninstall removes every product-owned process and route while leaving
  official Java unchanged.
- Retained normal logs contain no credentials or complete classpaths.

## Failure criteria

- Java 6.8.23 is accepted without an explicit compatibility record or falls back
  to a self-managed JDT mode.
- Bridge contribution, proxy discovery, callbacks, visible Spring behavior, or
  authentic cleanup regresses.
- The official runnable cannot launch the Maven Boot main class, bypasses the
  wrapper unexpectedly, hides actionable output, or leaves an owned process.
- The test requires modifying official Java, its proxy, or its work directory
  beyond the already allowlisted product commands.
- Normal logs expose credentials or complete classpaths.

A task-helper-only failure with the coordination contract otherwise intact is a
split result: Java 6.8.23 compatibility may be Supported while reuse of its main
runnable is Refuted. Record both outcomes instead of collapsing them.

## Observations

### Driven run 1 — coordination arm (2026-07-19)

Ran on macOS 26.5.2 arm64, Zed 1.11.3, Temurin JDK 25.0.3, product source at this
branch (unchanged 6.8.21 compatibility record). Official Java **6.8.23** was
dev-installed from the source clone (registry has no 6.8.23); `zed-spring-tools`
was dev-installed alongside it into the isolated profile
`tmp/s016-run-20260719/` before the fixture opened. Evidence:
`tmp/s016-java-6.8.23-20260719/evidence/`.

The **unchanged 6.8.21-contracted product connected end to end against 6.8.23**,
confirming the Preparation finding that the gate is structural, not a version
string:

- Bridge bundle contributed and started in 6.8.23's jdtls: `zed-spring-bridge.jar`
  Installed + Started, alongside all five Spring Tools JDT bundles
  (`isolated-jdtls-metadata.log` lines 51/63 and 33–69).
- Bridge commands registered in jdtls: `zed.spring.bridge.v1.addClasspathListener`
  / `removeClasspathListener` plus the `sts.java.*` pair (same log, lines 84/90).
- Official proxy discovered and the loopback handshake completed: the 6.8.23
  proxy is at `work/java/bin/v6.8.23/java-lsp-proxy` (a version-tagged path — the
  one observed 6.8.23 structural change), and the coordinator wrote the pinned
  `utf8-worktree-hex-v1` route port file under `work/java/proxy/<hex>`, whose hex
  decodes exactly to the worktree path (`arm1-process-snapshot.txt`).
- Maven project import ran (`Importing Maven project(s)`); jdtls reconciled,
  validated `FixtureApplication.java` with 0 problems, and served hover.
- Spring Boot LS started and stayed up (coordinator PID drove
  `spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar`).
- **Visible `server.port` completion with its `Server HTTP port. Default: 8080`
  metadata** appeared in `application.properties`, plus the fixture's
  property-validation diagnostic (`server-port-completion.png`).
- No reduced managed-JDT mode was entered; the coordinator ran with the default
  `java-providers.json` (6.8.21) `--compatibility`.

One non-fatal server error was logged: Spring's `org.springframework.tooling.jdt.ls.extension`
sent `workspace/executeClientCommand`, which the coordinator answered
`Unrecognized method` (jdtls log line 167). It is a server→client request the
coordinator does not implement and did not block import, validation, hover, or
completion. Whether it is also present on the 6.8.21 baseline (i.e. pre-existing,
per [[coordinator-message-routing]]) rather than a 6.8.23 regression is an open
comparison.

Aside: an earlier non-isolated attempt in the user's main Zed (repo root, main
data dir) failed jdtls init at 00:29 with a broken pipe; it is unrelated to the
isolated run and not part of this result. Cause not investigated.

### Driven run 2 — official Run-runnable arm (2026-07-19)

6.8.23 **does expose** an official main-class runnable in stock Zed: triggering
it generated and ran a `Run FixtureApplication` task. This is a genuine split
result:

- **As driven by Zed it failed (exit 127).** Zed's generated task command
  resolves the helper as
  `$HOME/Library/Application Support/Zed/extensions/work/java/task-bin/java-task-helper`
  — the default macOS data dir, hard-coded and **ignoring `--user-data-dir`**. The
  isolated profile's helper lives under its own `--user-data-dir`, and the main
  data dir's `work/java` had been removed, so the path did not exist. This is a
  Zed task-generation/isolation limitation, not a 6.8.23 helper defect; on a
  normal (non-`--user-data-dir`) install the helper is at exactly that path.
- **The helper binary itself launches the app.** Invoked directly with Zed's exact
  arguments (`run-class <file> dev.zed.spring.fixture FixtureApplication ""`), the
  isolated `java-task-helper` detected the Maven project, reported
  `No wrapper found, using mvn` (the fixture ships no `mvnw`), and ran
  `mvn compile exec:java -Dexec.mainClass=dev.zed.spring.fixture.FixtureApplication -Dexec.classpathScope=runtime`.
  Tomcat started on port 8080, `Started FixtureApplication in 0.939 seconds`, and
  `GET /greeting` returned `hello` — the app was reachable. Killing the process
  freed 8080 cleanly. Evidence: `run-helper.log`.
- **Attribution correction:** 6.8.23 runs a main class through `exec:java` on the
  Maven wrapper *if present, else system `mvn`* — not `spring-boot:run`, and not a
  plain `java` invocation. The plan's "project Maven wrapper" wording holds only
  for wrapper-bearing projects; this wrapper-less fixture used system `mvn`.
- The Zed-driven stop criterion (step 6) could not be exercised because the app
  never started inside Zed; the direct process was stopped outside Zed and exited
  cleanly.

### Driven run 3 — Gradle coordination (2026-07-19)

To cover 6.8.23's new Gradle support, a disposable Gradle mirror of the Maven
fixture (`spikes/s016-.../fixture-gradle/`, same Java sources, Spring Boot 3.5.5,
`application` plugin, Gradle 9.5.1 wrapper) was opened as a second worktree in the
same isolated Zed. Coordination is **Supported on Gradle too**:

- jdtls spawned a second workspace and imported the project via its
  **GradleProjectImporter** (Buildship, the wrapper's Gradle 9.5.1). Once
  synchronized, `GreetingController.java` (`@RestController`/`@GetMapping`)
  validated with 0 problems and hover worked — so jdtls resolved the Gradle
  Spring classpath on 6.8.23.
- The Gradle worktree got its own coordinator, Spring Boot LS, and pinned
  `utf8-worktree-hex-v1` proxy route port file; its bridge jdtls also registered
  `zed.spring.bridge.v1.addClasspathListener`/`removeClasspathListener`.
- During the slower Gradle synchronize, jdtls cancelled the in-flight
  `addClasspathListener` once (`IProgressMonitor` cancel →
  `BridgeCommandHandler.requireActive` threw `bridge command was cancelled`).
  This matches the coordinator's documented retry-on-slow-import behavior; it
  recovered after synchronization.
- **Visible `server.port` completion works in the Gradle worktree's
  `application.properties`** (`gradle-server-completion.png`) — the Gradle
  classpath reached the Spring LS. The same non-fatal
  `workspace/executeClientCommand` error appeared, confirming it is
  build-tool-independent.
- Not exercised: the Gradle official runnable (`task_helper` runs
  `gradle run -PmainClass=...`); it is expected to mirror run 2's split result.
- Out of scope: completion ordering (`server.port` not visibly ranked first for
  `server.p`) is Zed's client-side fuzzy ranking, reproduces on Maven too, and is
  independent of 6.8.23. [R015](../research/015-spring-completion-ranking.md)
  confirms that Spring sends `server.port` first and attributes the visible
  reorder to Zed's single-word fuzzy pass preceding LSP `sortText`.

### Pending

- Steps 6–7: product uninstall and authentic-cleanup verification (the bridge
  removal contract itself is S013-verified on 6.8.21 and unchanged here).
- Steps 8–9: log-redaction scan and a warm offline restart.
- Re-run the official runnable in a **non-isolated** Zed (or with the helper path
  reconciled) to confirm the Zed-driven path works for a real user install.
- The explicit-6.8.23-record admission arm and the 6.8.21 baseline comparison for
  the `workspace/executeClientCommand` error.

## Result

In progress; a split result on the tested tuple (macOS 26.5.2 arm64, Zed 1.11.3,
JDK 25.0.3), no capability-inventory state changed:

- **Coordination and visible Spring behavior: Supported, on both Maven and
  Gradle.** The unchanged 6.8.21-contracted product's bridge, bundle
  contribution, callbacks, proxy route, and `server.port` completion all work
  against official Java 6.8.23 without a reduced mode; jdtls imports both a Maven
  and a Gradle project and the classpath reaches the Spring LS in each.
- **Official main runnable: Supported at the helper, blocked through Zed under
  isolation.** 6.8.23's `task_helper` launches the reachable Maven Boot app via
  `mvn exec:java`, but Zed's generated runnable hard-codes the default data-dir
  helper path and fails (exit 127) under `--user-data-dir`. A non-isolated
  re-run is needed to confirm the normal user path.

Per the plan, a 6.8.23 compatibility record is only added after the remaining
cleanup, redaction, and non-isolated runnable gates pass; those are unrun.

## Remaining uncertainty

- Gradle and vanilla Java task behavior.
- Java test runnables and debug behavior.
- Every untested platform/JDK tuple.
- Future official Java and Zed releases.
- Whether Java 6.8.23's Gradle LS affects larger mixed Maven/Gradle worktrees.

## Next experiment

If the coordination contract is Supported, add 6.8.23 through a separately
reviewed compatibility-table change. If the runnable is also Supported, prefer
it for matching generic main/test actions and keep generated Zed tasks only for
Spring-specific or unmatched commands. Boot Debug remains a separate explicit
`.zed/debug.json` experiment.

## Reusable findings

Preserve the exact release digests, rejection control, task-helper command
attribution, visible terminal behavior, stop path, removal payload, and redacted
cleanup evidence so later official-Java versions can repeat this gate.
