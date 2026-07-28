# Product implementation and public-development plan

- Status: In progress; M1-M4 complete, M5 slice 1 (the JDK 21 floor on macOS
  arm64) is driven and its remaining slices are blocked on hardware, so M6 is
  the active milestone. The one product defect M5 slice 1 found is fixed and
  driven, all three of M6's `planned` scope decisions are closed, and the Gradle
  axis is resolved on macOS arm64 — leaving the preview release itself, plus the
  Windows wrapper forms and the pinned-release refresh, both of which wait on
  something outside this host
- Last updated: 2026-07-29
- Architecture: D002-D006 Accepted
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
1.10.3, Java extension 6.8.21, and Temurin JDK 25.0.3. Step 7's
missing/incompatible-Java diagnostic has since been observed at runtime by
driving the real coordinator process on incompatible inputs; see the close note
below.

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

**Startup-ordering note ([S014](spikes/014-jdtls-bundle-startup-ordering.md)):**
the bridge is contributed to `jdtls` at its startup. If the extension becomes
available only after `jdtls` has already started — as when a dev extension is
installed with a Java project already open — `jdtls` is not re-queried and starts
without the bridge until Zed is restarted. When the extension is present before
`jdtls` starts, which is the case after a restart and for any registry install,
S014 confirmed on a cold cache that Zed waits for the contribution and the bridge
registers. The flow below is therefore sound for an extension installed before
the Java server starts; the install-ordering case and the separate download hang
are tracked in `LIMITATIONS.md`.

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

One item is carried forward rather than waived:

- `zed::download_file` hung once for 24 minutes with no bytes, no connection, and
  no timeout while the network was healthy, and completed in seconds after a Zed
  restart. Acquisition can wedge with no actionable message. Zed's API takes no
  timeout, so the product cannot bound it directly; the cause is unestablished
  and one occurrence is not a reproduction. Tracked in `LIMITATIONS.md`.

Step 7's missing/incompatible-Java diagnostic, previously carried forward, is now
closed. It was observed on 2026-07-18 by driving the real coordinator process
(`coordinator/src/main.mjs`, the source `runtime.rs` embeds) with the product's
exact launch argument contract on incompatible inputs — not by unit-testing
`validateCompatibility`/`javaMajor` in isolation. An incompatible JDK (real
Temurin 17.0.18) was refused with `JDK 21 or newer is required by Spring Tools`;
an unverified official-Java-extension contract (`extensionVersion` other than
`6.8.21`) was refused with `official Java compatibility contract is invalid`
before the JDK check. Both exited nonzero within ~100ms with empty stdout and no
reduced mode. A compatible control (real Temurin 21.0.11 with the valid contract)
passed both guards and launched the real Spring Tools language server, confirming
the guard is discriminating rather than always-on. The absent-Java path was
already observed during M2. Evidence:
`tmp/m2-step7-incompatible-java-20260718/evidence/STEP7-GATE-RESULT.md`. The
observation drove the coordinator process directly rather than through the Zed
GUI, which is the appropriate surface for a startup-time guard that runs before
any editor interaction; Zed launches this same process with these same arguments.

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

Status: complete, 2026-07-26. Inventory version 42 exists at
[capability-inventory.md](capability-inventory.md), derived by
[R011](research/011-vscode-spring-tools-capability-surface.md) from the pinned
Spring Tools `5.2.0.RELEASE` and amended by
[R013](research/013-zed-native-capability-delivery-surfaces.md) for stock-Zed
delivery routes and re-audited by
[R018](research/018-spring-tools-zed-outcome-parity-audit.md). It records 59
capabilities: 46 `verified`, 6 `zed-native-equivalent`, 3 `planned`,
3 `blocked-zed-api`, and 1 `not-pursued`. The inventory itself is the authority
for these counts; this summary had drifted several slices behind it before the
closing pass below.
A capability is promoted to a blocked state
only when its exact missing surface is named and no Zed-native workflow can
deliver the outcome; a capability is named for its user outcome, not for the VS
Code widget that delivers it there.

Exit gate, met on 2026-07-26: **no capability is left in a state that only more
evidence would change.** The `implemented` column — built but never observed
working — is empty, and it is empty because every row that once sat there was
driven on a named tuple, not because rows were reclassified. Nothing is
`planned` for want of a runtime gate either. The three rows that remain
`planned` are each waiting on a direction decision rather than on a slice:
Spring Initializr (a separate VS Code extension, and a new network/artifact/UX
boundary), the embedded Spring Tools MCP server (a new listening port and
outbound Spring.io calls), and the AI explanation commands (which need a Zed
Agent API that does not exist, plus a privacy decision if it ever does). The
three `blocked-zed-api` rows each name the exact missing client surface —
cross-server document highlights, the semantic-token request path for Java, and
`InlayHintLabelPart.command` activation — and each was established by a driven
control, so reopening them is a Zed-release question, not an open work item
here.

What closing M4 does **not** claim: every state above rests on the macOS arm64
tuples named in the inventory header. Parity evidence and platform evidence are
different things, and the second is exactly what M5 is for. The last six slices
(build/task, upgrade, Modulith, Java reconcilers, the residual diagnostics, and
offline behaviour) also make a pattern worth carrying into M5 — three of them
needed no product code at all, and the other three needed only failure
visibility or one Code Action, while each thing that first looked like a
missing feature
turned out to be a settings default, a fixture precondition, or a client
limitation. The cheap first move on a new tuple is therefore an audit of what
the pinned server already does, not a patch.

Every user-visible capability has one state: `planned`, `implemented`,
`zed-native-equivalent`, `blocked-zed-api`, `blocked-upstream`, `not-pursued`,
or `verified`.
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

#### Selected capability-delivery strategy

[D005](decisions/005-lsp-first-capability-delivery.md) selects an additive,
stock-Zed, LSP-first strategy for the complete inventory. The canonical mapping
is [the M4 capability delivery plan](capability-delivery-plan.md); it records the
current baseline/fallback, preferred route, failure trigger, and planning
confidence for properties/YAML, symbols, CodeLens, Boot discovery, Run/Debug,
tasks, live connections, metrics, loggers, dashboard outcomes, upgrade,
Modulith, special languages, embedded highlighting, Initializr, AI explanations,
and offline/compatibility behavior.

The delivery order is:

1. retain every verified standard-LSP and Project Symbols result as a fallback;
2. use native standard LSP surfaces before adapting a custom Spring protocol;
3. adapt allowlisted Spring protocols inside the existing coordinator rather
   than adding another process or UI route;
4. use explicitly requested, regenerable Structure/Live documents only where a
   workspace-wide hierarchy or table is essential; and
5. leave a capability `planned` when neither its preferred route nor its named
   fallback has runtime evidence.

Routes are not simply “preferred versus second choice.” D005 classifies them as
primary, independently useful companion, conditional fallback, or excluded
contingency. A conditional fallback is retained with a trigger and degraded
outcome, but is not pre-implemented solely because its primary lacks runtime
evidence. Companions share one coordinator operation/state model and are added
only for distinct contexts such as quick Run versus configurable Debug, or hover
discovery versus a link returned by an explicit action.

Zed 1.11.3 supports LSP Document Symbols behind the default-off
`languages.Java.document_symbols` setting. The earlier zero-request run is a
valid control for the default tree-sitter path, not evidence that Zed lacks the
feature. [S015](spikes/015-stock-zed-java-spring-document-symbols.md) found a
clear nested JDT/Spring merge with correct navigation and edit refresh after
both servers were ready, but Refuted the preferred route on restart. Spring
answered before JDT's later dynamic registration, and Zed cached a Spring-only
Outline that omitted ordinary Java symbols until a source edit forced
recollection. Verified Project Symbols therefore remains the fallback; a future
stock-Zed refresh fix must repeat S015 before the route is reconsidered.

[R014](research/014-final-upstream-capability-surface-audit.md) rechecked D005
against Zed main, official Java 6.8.23, and current Spring source. It found no
better stock-Zed architecture. It also established that extension slash
commands are removed, built-in CodeLens task scheduling is not exported to an
extension LSP adapter, general `window/showDocument` is not advertised or
handled, and Project Symbols cannot become a tree through `containerName`.
Those routes are excluded rather than treated as implementation shortcuts.
Their user outcomes are not all blocked: Zed's source-context Code Actions menu
combines runnable tasks, LSP actions, and available debug scenarios, while hover
and `showMessageRequest` notifications render clickable Markdown links. These
public substitutes require driven slices but make private task scheduling and
general ShowDocument unnecessary product assumptions.

Official Java 6.8.23 adds wrapper-aware Maven/Gradle/vanilla main and test tasks.
[S016](spikes/016-official-java-6.8.23-compatibility-refresh.md) Supported the
bridge, callback, product cleanup, warm-cache, and ordinary-profile Maven main-
runnable gates on macOS arm64/JDK 25; Gradle coordination also passed, while
Gradle/vanilla task execution remains unrun. [D006](decisions/006-capability-first-java-compatibility-and-reporting.md)
now treats the installed extension release as diagnostic metadata rather than
an admission gate: the product attempts the known runtime capability contract
and fails visibly on an actual break. Matching official Java tasks take
precedence over product-generated duplicate Java tasks when their behavior has
the required evidence; Spring-specific goals and Boot Debug still use
reviewable Zed task/debug configuration.

[R016](research/016-zed-github-compatibility-reporting.md) found that Zed's
GitHub sign-in grants only `read:user` and exposes neither its token nor an issue
API to extensions. GitHub Issues also has no anonymous-author mode. The selected
compatibility-failure route is therefore a bounded prefilled public issue to be
opened through clickable LSP Markdown for explicit user review and submission.
The strict title/body URL builder and persistent `Not now` notification are
implemented; a driven Zed click opened the populated browser composer without
submitting it. No
telemetry, token, raw log, source, path, classpath, environment, or credential
enters that route; security reports remain private.

[R019](research/019-zed-codelens-agent-navigation-and-build-output.md) resolves
the three follow-up CodeLens UX questions. The AI provider is enabled regardless
of Zed AI state, while Zed's public APIs expose neither authoritative Agent-state
detection nor Agent dispatch/prefill; product work is limited to accurate local-
only wording. Zed also cannot sort arbitrary Maven `target/` paths last, so the
showcase owns a local `.gitignore` and the product does not mutate user policy.
`CL-4d` is different: Spring already resolves the exact generated URI/range, so
the coordinator pre-resolves and caches that result, refreshes CodeLens, and
rewrites the action to Zed's supported location command. The product slice and
its ignored-target one-click runtime gate passed on 2026-07-19.

The baseline product continues to exclude Java language/query replacement, a
custom Zed build, and an external dashboard. An opt-in Java query experiment may
be proposed later only through a new direction decision, after stock-Zed routes
are tested, and only for a capability such as embedded syntax highlighting that
has no safe equivalent.

Immediate M4 slice order after D006 is now:

1. CodeLens/compatibility, properties/YAML conversion and metadata reload, and
   Spring-specific file-language routing are verified on the first macOS tuple;
2. Spring-aware Java completion, request-mapping snippets, and cron completion /
   validation are verified on that tuple;
3. the references half of S018 is verified by U4, while Spring-specific document
   highlights are recorded as `blocked-zed-api` because Zed queries only the
   primary Java server;
4. the remaining Run/Debug runtime gates are verified on the macOS arm64/Maven
   tuple: multi-project selection and the real-Zed forced-timeout recovery run;
   and
5. the opt-in Structure-document prototype is verified on macOS arm64: authentic
   generation, rendered default grouping, source-file opening, stale guidance,
   byte-stable refresh, deletion/recreation, and `.gitignore` non-mutation passed.
   Zed 1.11.3 drops Markdown `#L…` fragments, so Project Symbols remains the
   exact-location fallback. The next live-data slices are also verified: bounded
   local-process connection plus the timestamped metrics document passed their
   connected-Boot/JMX gates, including metrics refresh and deletion/recreation.
   The logger slice is now verified on the same tuple: the Live document rendered
   861 authentic logger records with an exact 512-entry bound, while the separate
   paged and confirmed action changed `ROOT` only after Spring's matching update,
   refreshed to prove effective/configured `DEBUG`, and restored `INFO` through
   the same path. A pinned-source audit then closed show/hide/refresh as a
   Zed-native equivalent: VS Code's three active-app commands only wrap the same
   connect/disconnect/refresh operations already exposed through the verified
   explicit process/action choice, whose contract tests now cover all three.
   Automatic local connection is now verified as a default-off opt-in.
   Generated Java debug entries carry reviewable local-management/project
   identity properties, and the coordinator admits exactly one executable-
   project-matching local Attach descriptor into the verified confirmation
   path; ambiguous or unnamed candidates fail closed. Its 2026-07-23 real Zed
   debug lifecycle gate proved automatic live-data connection, manual
   disconnect without reconnection, debug stop, and owned-process cleanup.
   Remote connection, build/task, upgrade, Modulith, and remaining commands stay
   separate. Those four are now closed in that order: remote connection, the
   build/task route, the patch-level Boot upgrade with the version/support
   diagnostics that reach it, and — 2026-07-26 — both Modulith rows. The Modulith
   slice needed only a settings default and one Code Action, because Spring's own
   Structure command already switches to `ModulithStructureView` for a
   spring-modulith project. The Java reconciler families and the Spring AI
   annotation row then closed together on the same day, and they too needed no
   product code: the pinned server's `problem-types.json` already matches the
   VS Code schema on all 11 categories and all 71 problem types, and
   `boot-java.java.reconcilers` defaults to true when the key is absent. The
   driven run drew 28 problem types across every Java family, applied a fix from
   both Spring quick-fix engines through Zed's code-action menu, and proved
   selective disabling at category and problem-type granularity. Offline
   behaviour then closed on 2026-07-26 as well, again with no product code: with
   outbound network denied to the whole process tree, a first install fails
   closed naming the pinned release and its artifact URL and leaves nothing
   partial behind, a warm installation runs the entire product, a corrupted
   installed jar is repaired offline from the checksum-verified archive, and only
   Spring's version/support validation degrades — to an empty diagnostic publish
   rather than to stale advice. What remains `planned` after that is the group
   that each need a decision rather than a slice: Spring Initializr, the embedded
   MCP server, and the AI explanation commands.

The earlier Boot-project-discovery slice completed one missing dependency in
the accepted Java-companion boundary. Spring's
`sts/spring-boot/executableBootProjects` command calls the server-to-client
`sts/project/gav` request before returning its project records; the coordinator
maps that request to the official Java bundle's `sts.project.gav` delegate
command, without rewriting the request or result.

The `feat/boot-project-run-config` slice builds the user-facing workflow on top
of that dependency. A synthetic `source` Code Action on Java files invokes
`executableBootProjects`, presents a bounded `window/showMessageRequest`
selection, and generates merge-safe `.zed/tasks.json` run tasks and
`.zed/debug.json` (`"adapter": "Java"`) launches — portable, secret-free, and
never overwriting a config it cannot parse without loss. It emits one base entry
plus one per discovered Spring profile (from profile-specific filenames and
multi-document `application.yml` activation, capped at eight) so the task/debug
picker becomes the profile selector, with editable `vmArgs`/`args`/`env` slots.
Driven checks on 2026-07-19 (macOS arm64, Zed 1.11.3, official Java 6.8.21,
JDK 25) verified discovery, generation, the generated run task serving
`GET /greeting`, generated `dev`/`prod`/`staging` picker entries, and a Java debug
launch from the `dev` entry after editing `vmArgs`, `args`, and `env`. Executable
Boot project discovery is therefore `verified`. Boot project info is now
`verified` too, on 2026-07-26: `sts/spring-boot/bootProjectInfo` has its own
`source` Code Action, and driving it against a four-module Maven fixture pinning
Boot 4.0.6 / 3.5.5 / 3.3.5 / 2.7.18 resolved each file to its own module's
record. That closes the last `implemented` row. See the inventory's version 39
note for what the run corrected — the command's absent-project path throws rather
than returning `null`, and the coordinator now preserves Spring's own error text
instead of replacing every server error with one fixed string.
Boot run/debug is now `verified` on the named macOS arm64/Maven tuple:
the 2026-07-22 follow-up presented `service-a`, `service-b`, and `All projects`,
and selecting all generated one task/debug pair per module with the correct
worktree-relative `cwd` and no automatic launch. Gradle interaction and the
other desktop tuples remain untested. The earlier debug run also exposed an
environment prerequisite in official Java 6.8.21: a system HTTP proxy must
bypass its loopback `localhost` main-class resolver.

The references-and-implementations verification also exposed a startup-order
race after the official Java route appeared but while Java project import was
still completing: the first bridge registration timed out, Spring disabled
classpath listening, and no automatic retry followed. The coordinator now
re-drives that handshake within a bounded grace window and defers only the
classpath-specific missing-extension diagnostic during that interval.
Coordinator regression tests cover transient recovery, grace-window exhaustion,
and immediate reporting for unrelated Java data-route failures. The real-Zed
gate passed on 2026-07-22: pausing the isolated jdtls process forced the
unmodified official-Java route to return its five-second command timeout; the
coordinator re-enabled classpath listening without a compatibility notice, and
registered the bridge after the same jdtls PID resumed. S018/U4 then verified
Spring qualifier, property, and distinct `@Named` references through Zed's
composed References result without coordinator merge code.

### M5: Installability and platform validation

Status: in progress, 2026-07-26. Slice 1 (the JDK 21 floor on macOS arm64) is
driven; slice 2 (Linux x86_64) is blocked on its hardware prerequisite.

Platform-neutral paths, executable discovery, worktree identity, and no
unnecessary manifest restriction are required from M2. Runtime support claims
follow later.

Validate the six desktop tuples separately: macOS/Linux/Windows on x86_64 and
arm64/Arm64, followed by the declared JDK matrix. Untested tuples remain
`untested`. SSH remote development and WSL-hosted remote projects remain out of
scope until the local desktop matrix is stable and a later decision adds them.

#### What a tuple gate covers

Re-running all 46 `verified` rows on six tuples is not the goal and would not
buy proportional information. Nearly every one of those rows exercises the same
pinned Spring server over LSP; what varies by platform is the layer this project
actually owns — path construction, artifact acquisition and checksum
verification, executable discovery, process spawn and cleanup, and the bridge
handshake with the official Java extension. A tuple gate is therefore a bounded
**portability core**, run in one sitting on a clean profile:

1. **Acquire and install.** A first-run install on a cold cache fetches the
   pinned VSIX, verifies the checksums, and activates by renaming a validated
   staging directory into place. A deliberate failure (network denied, per the
   offline recipe) fails closed and names the release and its artifact URL.
2. **Start and coordinate.** Zed starts one Spring LS and one worktree-scoped
   coordinator, which discovers the official Java provider and registers the
   classpath bridge on that platform's process and path shapes.
3. **One capability from each dependency class.** A properties completion with
   metadata documentation (server metadata only), a classpath-backed
   `PROP_UNKNOWN_PROPERTY` (needs the bridge), and one Java reconciler
   diagnostic with a quick fix (needs jdtls plus code actions). If these three
   pass, the LSP surface above them is not platform-sensitive; if the bridge
   fails, they fail together and the cause is visible in one place.
4. **Generated files and worktree identity.** A generated `.zed/tasks.json` and
   Structure document carry worktree-relative paths with that platform's
   separator, and no absolute host path leaks into either.
5. **Restart, uninstall, and cleanup.** Owned processes reach zero, the bridge
   removal contract executes, and nothing is left in the install directory.

Anything beyond that core is re-run on a new tuple only when it has a
platform-specific mechanism of its own — the run/debug tasks (a shell-free
argument vector per OS), and the JMX/Actuator live-data connection (loopback and
port handling).

#### Slice order, cheapest evidence first

1. **JDK matrix floor on the already-verified tuple.** The declared floor is
   Java 21 and only Temurin 25.0.3 has ever been run end to end, so
   `JDK 21 or newer` is currently half a claim. Temurin 21.0.11 is installed on
   the tested host beside 17.0.18 and 25.0.3, which makes this the one M5 gate
   needing no new hardware: run the portability core on macOS arm64 with the
   JDK pinned to 21.0.11, keeping 25.0.3 as the control and 17.0.18 as the
   already-observed negative. It also separates two things the current evidence
   conflates — the JVM that runs Spring and JDT, and the `--release 21` bytecode
   target of the Java bridge.

   **Driven on 2026-07-26; all five core steps passed on Temurin 21.0.11.**
   Pinning the floor took two levers, not one, because JDT LS reads
   `lsp.jdtls.settings.java_home` while the Spring server follows this
   extension's PATH-first `resolve_java`; and the official Java extension only
   adds its `-Djdk.xml.*` flags at Java 24 or newer, so 21 and 25 are different
   JDT LS launches rather than the same one twice. The gate also produced its
   first defect: on the very first import of a never-before-opened project, one
   `sts.java.type` lookup exceeded official Java's five-second command timeout
   and the coordinator reported that transient failure as an incompatibility,
   three seconds before the same route answered normally. Four
   further runs alternating 21.0.11 and 25.0.3 never reproduced it, so it was a
   reporting-policy defect rather than platform evidence — the classpath path
   already treated the same timeout as transient and the data route did not.
   **That asymmetry was closed on 2026-07-29**, with the defect reproduced
   deterministically by freezing the isolated JDT LS child and an A/B against the
   pre-fix build. Evidence: `tmp/m5-jdk21-floor-20260726/evidence/` and
   `tmp/data-route-transient-20260729/evidence/`.
2. **A second OS.** Linux x86_64 is the next most valuable tuple: it is the
   platform whose path, process, and executable-discovery behaviour differs from
   macOS while remaining Unix-shaped, so it separates "POSIX assumptions" from
   "macOS assumptions" before Windows tests both at once. This needs hardware or
   a VM that can run Zed's own Linux build with GPU support; that prerequisite
   is unresolved and is the gate's first task, not an afterthought.
3. **Windows x86_64.** The tuple most likely to find real defects, because it is
   the only one where path separators, executable extensions, and process
   termination all differ. Expect the bridge handshake and generated
   task/debug files to be where problems surface.
4. **The remaining tuples** (macOS x86_64, Linux arm64, Windows Arm64) as
   hardware allows; each stays `untested` until its own run.

#### Standing rules

- A tuple is `untested` until its portability core has been driven on it. Code
  being platform-neutral by construction is a code-shape property and is never
  written up as coverage — `COMPATIBILITY.md` already says so, and M5 must not
  quietly soften it.
- Each gate keeps its evidence under an ignored `tmp/<gate>-<date>/evidence/`
  path and updates `COMPATIBILITY.md`'s desktop and Java matrices in the same
  change. The capability inventory records capability state, not platform state,
  so a passing tuple gate does not edit inventory rows; a *failing* one does,
  because a capability that breaks on a supported platform is a capability
  problem.
- A defect found on a new tuple is fixed in the platform-neutral layer, never by
  branching product behaviour per OS unless the platform genuinely differs.

### M6: Preview and incremental public releases

Status: in progress. The three gaps below are closed as far as this host allows,
and the preview release gate is [defined and has been run
once](preview-release-gate.md). What remains is the publish itself, which is the
maintainer's to fire, and the two sub-axes that need a Windows host.

Publish experimental previews only when their capability inventory,
compatibility table, tested matrix, known blockers, third-party notices,
checksums, and rollback instructions are current. Stable release criteria are
defined later from observed preview reliability; feature count alone is not a
stability signal.

#### What M5 completion does not deliver

M5 answers one question: does what already works keep working on another
platform. Finishing it is therefore not the same as being releasable, and three
gaps sit between the two. Each was visible in scattered limitation text before
this amendment but none was tracked as work, which is how "only the platform
matrix is left" became an easy and wrong reading of the plan.

1. **Gradle coverage.** The whole build-system axis is thinner than the Maven
   evidence suggests, and it is thin in different ways per capability rather
   than uniformly: the Boot upgrade rejects Gradle outright (upstream assert),
   Modulith metadata generation is Maven-only in practice, run/debug generation
   emits wrapper-aware Gradle entries whose execution is unrun, the Windows
   wrapper forms (`mvnw.cmd`/`gradlew.bat`) are untested, and Spring's own
   `sts.gradle.build` has no caller in the pinned release at all. Before a
   stable release this must be resolved into exactly one of two states per
   capability — driven on a Gradle fixture, or declared a first-class Maven-only
   limitation in release-facing text. It is currently neither. Note what this
   axis is *not*: it is not a platform tuple, so M5 will never touch it.

   **Resolved on 2026-07-29** in the [Gradle axis
   resolution](gradle-axis-resolution.md), and the answer is that the build
   system is not a dividing line anywhere except one capability. The work began
   with a survey rather than a sweep, because a capability is build-system-
   sensitive only if some code branches on the build tool, reads the build file,
   or writes a build command — everything else reaches Spring through the jdtls
   classpath, where Maven and Gradle are already one `IJavaProject`. That
   reduced 59 rows to nine needing their own evidence plus one Maven-only in
   upstream's code, and the class claim was then driven rather than asserted.

   Two Gradle fixtures were added under `tests/fixtures/` as durable re-test
   surfaces, both copies of their Maven counterparts so that any difference
   found is a build-system difference. Against them: property completion and
   validation, the Java reconcilers, Spring Data query and SpEL diagnostics,
   cron, CodeLens and all seven product code actions, Boot project info
   (reporting `gradle build`), version and support validation (anchored on
   `build.gradle`), Modulith metadata refresh and the module-violation
   diagnostic, and the embedded MCP server's index-backed tools all worked. Run
   and debug generation produced `./gradlew bootRun` with the profile forwarded
   in Gradle's own form, and **both generated commands were then executed**: the
   base entry served the application on 8080 and the `dev` entry on 8081, the
   port its profile file sets — which is what turns "generated" into "verified",
   because the moved port proves the argument took effect.

   Two of this section's own characterisations were wrong and are corrected
   there. Modulith metadata generation is **not** Maven-only; it spawns its
   exporter against a classpath string and never reads a build file, so the
   precondition is compiled classes. And the Boot upgrade does not fail at the
   user on Gradle: `UpdateBootVersion.canProvideQuickfix` gates on the build
   type *before* attaching the action while the release-notes action is added
   outside that branch, so a Gradle user gets the diagnostic and one action and
   simply never sees the one-click upgrade. That is the single first-class
   Maven-only limitation, now stated in `LIMITATIONS.md`. `sts.gradle.build`
   remains unreachable upstream, which is an absent parity target rather than a
   gap here.

   **What did not close: the Windows wrapper forms.** `mvnw.cmd` and
   `gradlew.bat` are selected only on a Windows host, and there is none here, so
   that sub-axis is blocked for exactly the reason M5 slices 2-4 are. Contract
   tests cover the branch; a contract test is not a driven gate. Multi-project
   Gradle selection is likewise contract-tested only. **M6 therefore does not
   fully close on this host**, and that is stated rather than smoothed over.
2. **Refreshing the pinned upstream release.** Every parity claim in this
   repository is anchored to Spring Tools `5.2.0.RELEASE`
   (`vscode-spring-boot-2.2.0-RC1.vsix`), and there is no recorded procedure for
   moving to a newer one. A refresh is not a version-string bump: R011/R018
   derived the inventory from that package's 118 settings, several `verified`
   rows rest on that release's own defaults and preconditions
   (`problem-types.json`, absent-key behaviour, the patch-only upgrade asserts),
   and rollback between two pinned releases has never been exercised because
   only one has ever been pinned. What is needed is a written refresh gate: what
   is re-audited, which driven gates are re-run, and how a regression is
   reported.

   **Defined on 2026-07-29** in the [pinned release refresh
   gate](pinned-release-refresh-gate.md): a mechanical re-pin whose artifact
   digests fail closed, a source re-audit that diffs the 118 keys,
   `problem-types.json`, the absent-key defaults, the commands and — added
   because the MCP work found settings that exist nowhere else — the VSIX's own
   client launcher, then driven gates tiered so that a refresh is finishable.
   Tier A always runs, Tier B is selected by what the audit found, and Tier C is
   recorded as not re-run rather than implied to pass. A regression moves the
   inventory row out of `verified` and is reported, not reverted.

   **It has not been executed, and cannot be today**: `5.2.0.RELEASE`
   (2026-06-10) is still the newest upstream release, so there is nothing to
   refresh to. The stable-release criterion asks for a gate that exists *and*
   has run once, so that criterion is half met. The document records one route
   that does not wait on upstream — rehearsing the gate backwards against an
   earlier release, which would also exercise the never-tested rollback path —
   and does not schedule it.
3. **Closing the three `planned` scope decisions.** Spring Initializr, the AI
   explanation commands, and the embedded MCP server each waited on a direction
   decision, not a slice. Shipping a stable release with rows open in that state
   is defensible only if each has been explicitly decided — built, or moved to
   `not-pursued` with its reason — rather than left pending.

   **Two are decided as of 2026-07-29** (inventory version 45). Spring
   Initializr is `not-pursued`: it is not in the pinned VSIX at all, so it was
   never inside the parity target, and building it would be a new product
   surface rather than an adaptation. The AI explanation commands are
   `blocked-zed-api`: nothing about them changed, but `planned` implied a
   pending slice when what is pending is a Zed API — no Agent-state detection,
   no Agent dispatch or prefill — plus a privacy decision about transmitting the
   user's source.

   **The embedded MCP server stays `planned`, pending one observation.** Its
   blocker turned out to be a fact nobody had checked: the pinned jar ships the
   server enabled, but this project launches Spring with
   `-Dspring.main.web-application-type=NONE`, so the embedded Tomcat cannot
   start and the row's premise is untested in both directions. A spike
   establishes whether the server starts when that flag is lifted, whether one
   JVM serves streamable-HTTP MCP and LSP at once (R018 hypothesis 6), and how
   the random port is announced; the listening-port, `api.spring.io` and
   offline consequences are then decided on evidence.

   [S019](spikes/019-embedded-mcp-server.md) ran that spike on 2026-07-29 and
   answered all three. Lifting the one flag is sufficient: the unmodified pinned
   jar bound `127.0.0.1:<random>`, served all 18 tools over `POST /mcp`, and
   left the stdio LSP stream byte-clean with diagnostics identical to the
   control — so R018 hypothesis 6 is closed. The port reaches stderr as well as
   `window/showMessage`, and the spring.io tools were observed making live
   outbound calls.

   **Decided the same day, as `build`** (inventory version 46), on a fact found
   after S019 merged: the pinned VSIX's own launcher already branches on
   `boot-java.ai.mcp-server-enabled` (default `false`) and
   `boot-java.ai.mcp-server-port` (default `50627`), emitting
   `-Dserver.port=<port>` when enabled and this project's exact flag when not.
   Two things follow. This project implements one of upstream's two branches
   rather than deviating from it, so the capability sits inside the parity
   target through two documented settings — which is what makes `not-pursued`
   wrong here and right for Spring Initializr. And the random port is an
   artefact of how the spike was run, not a property of the capability, so the
   port-discovery problem S019 reported does not need solving.

   **Built the same day** (inventory version 47), so the row is now
   `implemented`: both settings are read from `LspSettings` at launch, resolved
   into one `--mcp-server-port` coordinator argument, and applied in
   `springArguments`. Defaulting off keeps the launch vector byte-identical to
   every release before it, so the unauthenticated loopback endpoint and the
   `api.spring.io` calls exist only for a user who opts in.

   That slice also refuted this section's own prediction that it would need a
   settings path the extension lacks.
   `boot-java.live-information.automatic-connection.on` was already read at
   launch and passed as `--automatic-live-connection`, so the MCP settings
   reused an established route and the slice came in smaller than described.
   **Driven-verified the same day** (inventory version 48), which closes the
   row. All 18 tools were exercised against a resolved `practices-app` through
   the shipped opt-in setting, and 17 returned real payloads — beans with source
   ranges and injection points, request mappings, project diagnostics, and live
   `api.spring.io` data — with an unknown-project negative control refused. A
   suspected cleanup regression was measured rather than argued and did not
   exist: Spring exits in 3.70 s with the setting off and 3.66 s with it on. The
   run also found two upstream defects, `getResolvedProjectClasspath` throwing
   on a null classpath-entry version and `getLatestReleaseInformation`
   returning `null`; both are named in the row and neither blocks it. Evidence:
   `tmp/mcp-verify-20260729/evidence/`.

   With that, **the `planned` and `implemented` columns are both empty**, which
   is the state M4 closed on and M6 has now restored after adding a capability.

The transient official-Java route timeout misreported as an incompatibility
(`coordinator/src/main.mjs`, the data route) was the next product slice and was
closed on 2026-07-29; it was separate from all three.

#### The preview release itself, and what "current" means

The three gaps above are about being *ready* to release. They say nothing about
what a release of this project actually is, and the milestone's own opening
sentence — publish previews only when seven named surfaces are "current" — names
seven things and defines none of them, so it could be neither passed nor failed.

**Defined on 2026-07-29** in the [preview release
gate](preview-release-gate.md), which turns that sentence into a runnable gate:
one rule per surface, each with a check and a blocking verdict, plus a manual
publish procedure and the rollback instructions that were missing entirely. It
adds no release automation, because AGENTS.md puts packaging, release automation
and product CI behind their own direction decision and none exists.

Two findings from writing it are worth stating here rather than only there.
First, **this project does not control its own distribution channel**: a Zed
extension reaches users through the registry, and
[zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875)
is still open, so a preview cannot mean "installable from Zed". It means a
tagged commit, a GitHub pre-release, and the commit the registry pointer
targets. Second, preview identity is carried by **GitHub's pre-release flag, not
by the version string** — `extension.toml`'s version is what the registry would
publish and must stay plain SemVer — which keeps this milestone's standing rule
that a version number is not a stability signal from being smuggled back in.

**The gate was then run once, against `main` at the slice-5 merge.** Four rules
passed and three found currency drift, none of it a product fault: `LIMITATIONS.md`
still said 46 capabilities were proven against an actual 47, because the prose
count went stale when the MCP row was promoted in #78 and only the README and the
inventory summary were updated; `THIRD_PARTY_NOTICES.md` covered the VSIX, the
grammar and the proxy patches but not the 106 locked Rust crates that are
compiled into the WASM the registry builds and serves; and no rollback
instruction existed in either direction. All three are fixed. The gate now
passes, and no preview has been published.

That last point is the honest state of this milestone: the readiness work is
done on this host, and the release is a decision rather than a task.

#### Candidate stable-release criteria — proposed, not accepted

Recorded so the question is answerable rather than open-ended. These are a
proposal awaiting the project owner's decision; nothing below is a commitment,
and the standing rule that feature count is not a stability signal outranks any
of it.

- The six-tuple desktop matrix and the declared JDK matrix pass their
  portability cores, per M5 and the AGENTS platform requirements.
- The Gradle axis is resolved per capability into driven evidence or a
  release-facing Maven-only limitation. **Met on 2026-07-29 for every capability
  except one sub-axis**: nine capabilities were driven on two Gradle fixtures,
  the Boot upgrade is declared Maven-only with the reason read from upstream's
  own bytecode, and `sts.gradle.build` is recorded as an absent upstream
  surface. The Windows wrapper forms `mvnw.cmd`/`gradlew.bat` remain untested
  because they need a Windows host, so this criterion is met on macOS arm64 and
  finishes with the platform matrix rather than before it.
- A pinned-release refresh gate exists and has been executed at least once, so
  the project has demonstrated it can follow upstream rather than only pin. The
  gate [now exists](pinned-release-refresh-gate.md); the execution half is
  blocked on upstream publishing anything newer than `5.2.0.RELEASE`, or on
  choosing to rehearse it backwards against an earlier release.
- The `planned` rows are decided, in either direction. All three were on
  2026-07-29, and the `planned` column is now empty: two moved state, and the
  embedded MCP server was decided as `build`, built, and driven-verified the
  same day, so `implemented` is empty again too. This criterion is met. It is
  worth noting what it does *not* assert: the MCP row carries two named upstream
  defects and a single-tuple, Maven-only, one-project-per-worktree limit, so
  "decided" and "verified" are not "unconditional".
- At least one preview release has been published under the M6 currency rules
  and observed in use; the observation, not the inventory count, is what the
  criteria are then written from. The rules [now exist and have been run
  once](preview-release-gate.md), which is what makes "published under them" a
  checkable statement rather than a gesture. Both halves of this criterion are
  still open, and they are open for different reasons: publishing is a
  maintainer decision that could be taken today, while being *observed in use*
  depends on users this project does not yet have and cannot be shortcut.

The private official-Java provider transport remains a structural risk that no
criterion removes. The versioned adapter narrows it; a stable release should
state it rather than imply it has been engineered away.

### An undecided axis: coverage beyond VS Code Spring Tools

Not a milestone, and deliberately not placed in the delivery order. AGENTS.md
fixes the product goal as capability parity with VS Code Spring Tools, and M4
closed that program. The question of whether the goal should extend past it is
therefore live, unanswered, and recorded here only so that it is not mistaken
for either an accepted plan or a settled no.

IntelliJ IDEA Ultimate's Spring support is the obvious larger comparator and
appears nowhere in this repository — not in the inventory, not in R011/R018, not
in any research document. Two things should be established before it ever does:

- **Most of that surface is tool-window, dashboard, and diagram shaped** — bean
  dependency graphs, an endpoints panel with request execution, a run dashboard,
  security matrices. D005 and R014 already settled that stock Zed extensions
  cannot contribute a custom panel, webview, tree, or arbitrary command-palette
  action, so a naive comparison would mostly generate `blocked-zed-api` rows and
  teach nothing. The only demonstrated route to that class of outcome in this
  project is the **generated document** pattern already used by
  `.zed/spring-structure.md` and the generated task/debug entries. Whether that
  pattern extends usefully — a generated endpoint index, for instance — is
  unevaluated, and would need its own research document before any claim.
- **One already-inventoried row would go beyond both editors rather than catch
  up to either.** The embedded Spring Tools MCP server is present in the pinned
  package, and Zed supports remote MCP tools and prompts, so connecting them
  would put a project's live Spring index in front of Zed's Agent. That is not
  parity work and must not be smuggled in as parity work: it is a new listening
  port and new outbound calls, which AGENTS.md lists as requiring an explicit
  direction decision before implementation.

Any movement on this axis starts with a research document and a decision
document, in that order, and does not begin by writing product code.

## Review record

Reviewed on 2026-07-17 before production implementation and amended after the
project owner rejected a research-only initial publication. D004 is the explicit
language/build/packaging gate. The amended order completes a source-separated
basic product PoC before creating the public repository, preserves official Java
ownership, prohibits copying spike infrastructure into production, and makes
capability parity an auditable inventory rather than a broad marketing claim.
Amended on 2026-07-18 after R013 and the project owner's D005 choice. The M4
strategy now keeps the current verified/manual routes as explicit fallbacks,
prefers standard-LSP adaptation in the existing coordinator, permits only
opt-in generated Structure/Live documents, and excludes Java language/query
replacement from the baseline.

Amended again on 2026-07-18 after R014's final latest-upstream audit. D005
remains the selected architecture; the order now gates official Java 6.8.23
before reusing its task helper and explicitly excludes removed/private action,
task, browser, and Project-Symbol grouping shortcuts.

Amended on 2026-07-18 after S015. The on-state merge itself was usable, but the
restart ordering dropped baseline Java symbols until a later edit. The per-file
LSP Outline route is therefore not promoted, Project Symbols remains the
fallback, and S016 becomes the next runtime gate.

Amended on 2026-07-19 after S016. Official Java 6.8.23 preserved the structural
coordination boundary, product-owned cleanup, warm cached startup, and the
ordinary-profile Maven main runnable on the tested tuple.

Amended again on 2026-07-19 after the project owner's D006 direction and R016.
Exact official-Java point releases no longer require separate admission;
functional adapter probes and visible failure remain. Automatic or anonymous
GitHub issue submission is unavailable in stock Zed, so the selected
compatibility-failure route is a bounded, user-reviewed prefilled issue form.
CodeLens compatibility is now
implemented and contract-tested on that branch. The connected-live gate passed
with endpoint, bean and injection lenses plus authentic native Hover. At that
amendment, the five standard-provider families still remained to be driven; the
following addendum records their later result and supersedes that pending state.

Amended again on 2026-07-19 after the maintainer's standard-provider pass and
R019. Every provider family was observed after correcting the `CL-2` fixture
target and `CL-3` marker, but the pass exposed one product-solvable gap:
`CL-4d` must translate Spring's pre-resolved generated target into a Zed location
command instead of treating a popup plus manual Go to Definition as completion.
Direct Agent action/state integration and file-finder sort-last are Zed API/UI
boundaries; this branch owns only accurate AI wording and a fixture-local
`/target/` ignore rule for those two items.

Completed addendum, 2026-07-19: the branch delivered that final static slice.
`CL-4d` now captures Spring's authentic generated URI/range, caches it by source
version and command arguments, refreshes CodeLens, and rewrites the click to
Zed's native location command. The driven click opened the exact generated
method with `/target/` ignored. The AI notice correction is live. The bounded
compatibility notification also passed a diagnostic Zed-to-browser gate using a
title/body-prefilled GitHub composer; no issue was submitted.

Amended on 2026-07-26 to close M4 and open M5. The parity program ends with an
empty `implemented` column and no row left `planned` for want of evidence; the
three remaining `planned` rows need a direction decision, and the three
`blocked-zed-api` rows each name a client surface established by a driven
control. The closing slices also settled the working method this project uses:
audit the pinned server's own defaults and preconditions before writing product
code — build/task, Modulith, the Java reconcilers, and offline behaviour each
closed with none — and treat a silent feature as a fixture or settings question
first. M5 now converts that single-tuple parity evidence into platform evidence
through a bounded portability core rather than a full re-verification, starting
with the one gate the tested host can already run: the declared Java 21 floor.

Amended on 2026-07-26 after that first gate. The core is now confirmed workable
as a unit of platform evidence: five steps, one sitting, and it found something
on its first outing that no capability run had — a transient official-Java route
timeout reported to the user as an incompatibility. The gate also fixes the
method for the tuples that follow: pin the JDK at both resolvers, capture the
JDT LS command line rather than assuming it, and treat a single unreproducible
anomaly as a defect to characterise rather than as a platform finding.

Amended on 2026-07-28 to answer a question the plan could not previously
answer: what remains after M5, and what a stable release would require. Nothing
about a milestone's status changed. The amendment is a documentation-gap fix,
prompted by noticing that "M5 is the last milestone with open work" reads as
true from the delivery order alone while three non-platform gaps — Gradle
coverage, refreshing the pinned upstream release, and closing the three
`planned` scope decisions — existed only as scattered limitation prose. M6 now
states them, and proposes stable-release criteria explicitly marked as awaiting
the project owner's decision rather than accepted. A separate section records
the coverage-beyond-VS-Code question, including the IntelliJ comparison that
appears nowhere else in this repository, as undecided and gated behind a
research and decision document — not as a goal. AGENTS.md's product goal is
unchanged by this amendment.

The highest known risks are the official proxy's private compatibility surface
and observed JDT/port-file lifecycle caveat, third-party artifact distribution,
unadapted Spring client methods, capability-drift attribution and reporting,
multi-server Document Symbols restart refresh, generated-file merge/freshness,
remote credential handling, shutdown-response mismatches, Java-provider updates,
and the untested platform matrix. Each has an explicit decision or validation
gate above; none is treated as already solved by the local PoC.
