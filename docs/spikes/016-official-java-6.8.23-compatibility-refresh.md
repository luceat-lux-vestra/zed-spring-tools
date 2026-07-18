# S016: Official Java 6.8.23 compatibility refresh

- Status: Supported on macOS arm64/JDK 25; D006 later superseded the per-release promotion gate
- Date: 2026-07-18 (completed 2026-07-19)
- Related research:
  [R014](../research/014-final-upstream-capability-surface-audit.md)
- Decisions:
  [D003](../decisions/003-java-companion-product-architecture.md) and
  [D005](../decisions/005-lsp-first-capability-delivery.md); D006 later
  supersedes the per-release promotion gate

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
3. Start the fixture with the unchanged 6.8.21 compatibility declaration and
   test the real structural boundary: proxy route discovery, bridge commands,
   callbacks, and absence of a reduced mode. Source review established before
   the run that the product cannot reject the installed extension by version;
   admitting 6.8.23 to the declared table is therefore a separate product
   change after this spike.
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

- The unchanged product either fails closed at a changed structural boundary or
  supports the same bridge, callback, visible Spring completion, and cleanup
  outcomes accepted for 6.8.21; it never starts a reduced managed-JDT mode.
- Any declared 6.8.23 compatibility record remains a separately reviewed source
  change, because the current coordinator does not observe the installed Java
  extension version.
- The official Java main runnable uses its task helper and the Maven wrapper,
  starts the representative Spring Boot application, exposes useful terminal
  output, and stops cleanly through Zed.
- Product uninstall removes every product-owned process and route while leaving
  official Java unchanged.
- Retained normal logs contain no credentials or complete classpaths.

## Failure criteria

- Java 6.8.23 requires an unreviewed official-Java modification, crosses a
  changed proxy/bridge boundary, or falls back to a self-managed JDT mode.
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

### Driven run 4 — lifecycle, warm cache, and normal-profile runnable (2026-07-19)

The final driven arm closed the product-owned cleanup, bounded-evidence,
warm-cache, and ordinary-user-path gates.

- Closing both worktrees drove Spring's authentic classpath-listener removal;
  the coordinator reported `Unregistering classpath callback ... OK`. Both
  product coordinators and Spring Boot language servers exited, and their proxy
  routes disappeared.
- Removing `zed-spring-tools` through Zed's Extensions UI removed only the
  product dev-extension link. Official Java 6.8.23 remained installed and
  unmodified. A restart with an empty worktree did not recreate a product
  process or route.
- A warm restart ran Zed under an outbound-denied sandbox that still allowed
  loopback. External telemetry and Copilot DNS requests failed as expected,
  while the cached Java 6.8.23 proxy/JDT, coordinator, and Spring LS all started
  and visible `server.port` completion returned. The sandbox also blocked
  `/usr/bin/login`, so terminal creation in this run is a sandbox artifact and
  is not part of the task result.
- Java 6.8.23 was then dev-installed into Zed's ordinary data directory to test
  the real user path that the generated task hard-codes. Zed's gutter action
  launched `Run FixtureApplication` through the default-data-dir
  `java-task-helper`, which selected Maven and ran `compile exec:java` with the
  fixture's main class. Tomcat listened on 8080, `GET /greeting` returned
  `hello`, and `Ctrl-C` in Zed's task terminal stopped the process with exit
  code 130. The helper, Maven, Boot process, and port 8080 were all absent
  afterward.
- The official Java helper's SHA-256 was
  `b7173b7bfadd79855bd09d0d2dab9348fa09102db3cc1f93ea7e7a7def93dc3f`.
  The 6.8.23 proxy's SHA-256 was
  `c4ad9a806d8c07166e793a85f5ab09026034c2bcc5aa167b6d6d38b04ddee27b`.
  Retained bounded text and screenshots were scanned for credentials,
  authorization data, API tokens, complete classpaths, and unrelated absolute
  user paths; none remained. Broad desktop captures and an over-broad Zed log
  were moved to Trash rather than retained as evidence.
- The same non-fatal `workspace/executeClientCommand` rejection exists in the
  S015 Java 6.8.21 baseline, so it is not attributed to 6.8.23.

One lifecycle caveat reproduced twice after the worktrees closed: the official
Java proxy exited but its JDT child remained reparented to PID 1, with the
official non-secret proxy port file still present. The product coordinator,
Spring LS, product route, and product extension state were already gone. The
orphan JDT was terminated and the stale official-Java port file removed after
attribution. Source comparison found the Unix parent monitor moved from proxy
to `proxy-common` without a semantic change between 6.8.21 and 6.8.23. This is
an upstream official-Java/Zed lifecycle uncertainty, not a product-owned cleanup
failure, and remains a follow-up rather than being hidden by the successful
product uninstall result.

After the normal-profile task run, the user's default Zed state was restored:
the 6.8.23 dev extension was removed, registry Java 6.8.21 was reinstalled, and
Zed was quit with no Zed or Java process left running.

### Artifact and bounded-evidence digests

All values are SHA-256. Generated runtime artifacts and evidence remain ignored;
the table makes the exact driven inputs and retained files auditable without
committing third-party binaries, profiles, logs, or screenshots.

| Artifact or evidence | SHA-256 |
| --- | --- |
| Java 6.8.23 dev-build `extension.wasm` | `f47835a672c18ddd84cb90731a137d31ec53285c7f4e700a4786a7239528c22b` |
| Java 6.8.23 `java-lsp-proxy` | `c4ad9a806d8c07166e793a85f5ab09026034c2bcc5aa167b6d6d38b04ddee27b` |
| Java 6.8.23 `java-task-helper` | `b7173b7bfadd79855bd09d0d2dab9348fa09102db3cc1f93ea7e7a7def93dc3f` |
| Product WASM used for the isolated run | `aba46c2318514410ea8a43ae18b04dc85e573ff515e0a8f5f8231094c3a13740` |
| Product `zed-spring-bridge.jar` | `8335a47e5f7beb62d1164d17738918c5e316043830eb5cd7ad2a621aa80b315f` |
| Spring Tools 5.2.0 release VSIX | `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` |
| Spring Boot LS executable JAR | `ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1` |
| `arm1-process-snapshot.txt` | `cf894c2c3f36bcad8b8a4663d60bb9870b4862bc27ca9788ce8cabc101754d44` |
| `isolated-jdtls-metadata.log` | `9897e0f7743826aa9a2bc9acc31f5db6578bfa16fcac5f19bf721777d61daf22` |
| `run-helper.log` | `9bfe74ac1d2f98057663f77d6e9ed4e657766d8caa554f744d91fe4c433a6f1f` |
| `server-port-completion.png` | `4988acb943053b723005e3ad6a76108a9f205bdacbf97026e5e148a27cb4ece5` |
| `gradle-server-completion.png` | `45da8fa58b23e94aa2437401948b5ebd8982cdb0909ac334c2f43b5c8915b3b7` |
| `warm-offline-server-port.png` | `9970028fef03163b93eff087b6e30d3cd80dca789ad808c604270f4b2af12537` |
| `nonisolated-runnable-running.png` | `d52d26af4c74df4364a7be77b134e51b96db98b91d18771b2ea4273f467fc1ae` |
| `nonisolated-runnable-stopped.png` | `3d94e8887cd450bbe5d312742a2356cede4c1fc23530a25505c0bdae0ad00925` |
| `nonisolated-greeting.txt` (`hello`) | `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` |

## Result

**Supported on the tested tuple**: macOS 26.5.2 arm64, Zed 1.11.3, and Temurin
JDK 25.0.3.

- The unchanged product's bridge, official-proxy discovery, callbacks, Maven
  and Gradle imports, visible Spring completion, and product-owned removal
  contract all work with official Java 6.8.23 without a reduced mode.
- The official Java main runnable works through stock Zed's ordinary data
  directory: it launches the representative Maven Boot application, exposes
  useful terminal output, serves the verified endpoint, and stops through Zed.
- Warm cached startup works with outbound network denied on this tuple. This is
  not a claim for first-install offline behavior or other platforms.
- Zed's generated task still fails under `--user-data-dir` because it resolves
  the helper in the default data directory. That isolation-only limitation does
  not refute the normal user path.
- Product-owned cleanup passed. The separate official-Java JDT/port-file
  lifecycle caveat remains unresolved and explicitly attributed above.

At completion, this spike did **not** change the shipped compatibility claim:
the repository still declared and enforced only 6.8.21 in its embedded provider
record even though the coordinator did not inspect the installed extension
version. D006 subsequently used this observation to remove exact release
admission in favor of functional adapter probes. That later policy does not
broaden this spike's bounded runtime evidence.

## Remaining uncertainty

- Gradle and vanilla Java task behavior.
- Java test runnables and debug behavior.
- Every untested platform/JDK tuple.
- Future official Java and Zed releases.
- Whether Java 6.8.23's Gradle LS affects larger mixed Maven/Gradle worktrees.
- Whether the official Java proxy can reliably reap its JDT child and stale port
  file when a worktree closes; this is not product-owned cleanup.

## Next experiment

Proceed to the planned authentic `sts/highlight` to CodeLens slice. Under D006,
remove the self-declared exact-release gate on the same branch while preserving
structural and functional probes, and define the bounded user-reviewed failure-
report contract. Reuse the verified official Java main runnable for matching
generic Run actions; generic test, Gradle/vanilla task, and Boot Debug behavior
retain their own runtime gates.

## Reusable findings

Preserve the exact release digests, structural compatibility control,
task-helper command attribution, visible terminal behavior, stop path, removal
payload, official-Java lifecycle caveat, and redacted cleanup evidence so later
official-Java versions can repeat this gate.
