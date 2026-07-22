# Product implementation and public-development plan

- Status: In progress; M1-M3 complete, M4 in progress
- Last updated: 2026-07-23
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

Status: in progress. Inventory version 25 exists at
[capability-inventory.md](capability-inventory.md), derived by
[R011](research/011-vscode-spring-tools-capability-surface.md) from the pinned
Spring Tools `5.2.0.RELEASE` and amended by
[R013](research/013-zed-native-capability-delivery-surfaces.md) for stock-Zed
delivery routes and re-audited by
[R018](research/018-spring-tools-zed-outcome-parity-audit.md). It records 58
capabilities: 32 `verified`, 1 `implemented`, 5 `zed-native-equivalent`, 17
`planned`, 2 `blocked-zed-api`, and 1 `not-pursued`.
A capability is promoted to a blocked state
only when its exact missing surface is named and no Zed-native workflow can
deliver the outcome; a capability is named for its user outcome, not for the VS
Code widget that delivers it there.

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
   the same path. Build/task, upgrade, Modulith, and remaining commands stay
   separate.

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
Boot project discovery is therefore `verified`. Boot project info stays
`implemented` because `sts/spring-boot/bootProjectInfo` detail is not separately
exercised. Boot run/debug is now `verified` on the named macOS arm64/Maven tuple:
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

The highest known risks are the official proxy's private compatibility surface
and observed JDT/port-file lifecycle caveat, third-party artifact distribution,
unadapted Spring client methods, capability-drift attribution and reporting,
multi-server Document Symbols restart refresh, generated-file merge/freshness,
remote credential handling, shutdown-response mismatches, Java-provider updates,
and the untested platform matrix. Each has an explicit decision or validation
gate above; none is treated as already solved by the local PoC.
