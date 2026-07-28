# Capability inventory

- Inventory version: 46
- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Last updated: 2026-07-29
- Evidence: [R011](research/011-vscode-spring-tools-capability-surface.md),
  [R013](research/013-zed-native-capability-delivery-surfaces.md),
  [R014](research/014-final-upstream-capability-surface-audit.md),
  [R016](research/016-zed-github-compatibility-reporting.md),
  [R017](research/017-zed-codelens-hover-command-compatibility.md),
  [R018](research/018-spring-tools-zed-outcome-parity-audit.md),
  [R019](research/019-zed-codelens-agent-navigation-and-build-output.md),
  [S018](spikes/018-references-highlights-multiserver-composition.md), and
  [S019](spikes/019-embedded-mcp-server.md)
- Delivery routes: [M4 capability delivery plan](capability-delivery-plan.md),
  selected by [D005](decisions/005-lsp-first-capability-delivery.md), with
  compatibility/reporting policy from
  [D006](decisions/006-capability-first-java-compatibility-and-reporting.md)
- Reproducible CodeLens targets: [CodeLens showcase and coverage](code-lens-showcase.md)
- Runtime-tested tuples in this inventory: macOS 26.5.1/26.5.2 arm64, Zed
  1.10.3, 1.11.3, 1.12.0, and 1.12.1, official Java extension 6.8.21 and 6.8.23,
  Temurin JDK 25.0.3

This is the auditable list behind the goal of capability parity with VS Code
Spring Tools. Every user-visible capability carries exactly one state. A
capability this project cannot build still belongs here with its blocker;
functional loss must never disappear quietly.

Pixel-identical VS Code UI is not the goal. A different Zed-native workflow that
delivers the same user outcome is a legitimate result, recorded as
`zed-native-equivalent`.

## States

| State | Meaning |
| --- | --- |
| `planned` | Not built yet. No claim. |
| `implemented` | Built, but not observed working on any named tuple. |
| `zed-native-equivalent` | A different Zed workflow delivers the outcome. |
| `blocked-zed-api` | Zed lacks the required UI or protocol surface. The exact missing surface is named. |
| `blocked-upstream` | Blocked on Spring Tools or the official Java extension. |
| `not-pursued` | Intentionally not built. The user-facing outcome is already at parity (typically an upstream setting whose default we match) or otherwise decided out of scope; recorded as a documented exception, not backlog. Distinct from `planned`, which implies intended future work. |
| `verified` | Observed working on a named tuple. |

`implemented` and `verified` differ deliberately: this project does not treat
"the code exists" as evidence that it works.

The inventory records evidence state. The delivery plan separately records the
preferred route and the preserved baseline/fallback for every capability. A
selected route or planning-confidence score does not change a state here.

## Summary

59 capabilities tracked.

| State | Count |
| --- | --- |
| `verified` | 46 |
| `implemented` | 0 |
| `planned` | 1 |
| `blocked-zed-api` | 4 |
| `blocked-upstream` | 0 |
| `zed-native-equivalent` | 6 |
| `not-pursued` | 2 |

A capability is promoted to `blocked-*` only when the exact missing surface is
named **and** no Zed-native workflow can deliver the outcome. A capability is
named for the user outcome it delivers, never for the VS Code widget that
delivers it there — otherwise "we cannot build that exact widget" gets mistaken
for "the outcome is impossible", which is a different and usually false claim.

R018 corrected an earlier source-extraction gap: the pinned VSIX declares 118
settings, not the 18-feature subset first recorded by R011. Inventory version 7
therefore adds the omitted developer outcomes without turning every severity or
language-server tuning key into a separate capability.

Inventory version 9 promotes static Spring CodeLens after the coordinator
implemented authentic `CL-4d` target pre-resolution and a driven click opened
the generated method while `/target/` remained ignored. The AI notices now state
that the extension cannot detect or invoke Agent and sends no source or prompt
to AI. Direct Agent integration and arbitrary build-output ranking remain Zed/
user-policy boundaries rather than incomplete Spring CodeLens work.

Inventory version 16 promotes Boot run/debug after a real Zed multi-project run
displayed both Maven modules plus `All projects`, generated two reviewable task
and debug entries, and preserved the prior driven run and Java DAP results. The
same run forced the official-Java bridge command to time out while jdtls was
paused and then observed the coordinator re-enable classpath listening and
register the bridge after that exact jdtls process resumed, without a misleading
compatibility notification.

Inventory version 17 records and verifies the first opt-in Structure document.
A Java-file source Code Action explicitly runs Spring's pinned
`sts/spring-boot/structure` contract with metadata refresh and renders the
returned project/group hierarchy into `.zed/spring-structure.md`. Contract tests
cover deterministic refresh, worktree-only relative links (including Spring's
`reference` nodes), visible snapshot/stale guidance, deletion and recreation,
bounded output, unknown-file preservation, and no `.gitignore` mutation. The
2026-07-22 driven macOS arm64 gate then proved the authentic hierarchy, rendered
preview, source-file opening, byte-identical refresh, deletion/recreation, and
`.gitignore` non-mutation. Zed 1.11.3 discards a Markdown file link's `#L…`
fragment after opening the file; Project Symbols retains exact-location
navigation. `structure/groups` visibility selection is not part of this first
all-default-groups prototype.

Inventory version 20 records the first live-application-data slice as
`implemented`: connect/disconnect to a local Boot process. It is built and
contract-tested but not yet driven against a live JMX/Actuator process, which is
the gate to `verified`. A static read of `SpringProcessCommandHandler` first
showed connect/disconnect/refresh all resolve to `null` regardless of outcome —
the same false-success trap the shared-metadata reload had — so the coordinator
keys connect success off the server's `sts/liveprocess/connected` notification
(`SpringProcessLiveDataProvider.add`) instead of the command result, waits for
it per `processKey`, and otherwise reports a bounded "requested" message rather
than claiming a connection. Live hover data stays `zed-native-equivalent`; the
remaining WS3 rows (show/hide/refresh, metrics, loggers, automatic connection)
stay `planned`.

Inventory version 21 promotes that local-process slice to `verified`. The
2026-07-23 driven gate on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21,
Spring Tools 5.2.0 and Temurin JDK 25.0.3 listed a running Boot 3.5.5 process,
connected after the first authentic JMX/Actuator live-data refresh, received
`sts/liveprocess/connected`, and then disconnected through the same bounded
choice with `sts/liveprocess/disconnected` and JMX cleanup. The gate also found
that Spring's explicit local-process provider is false-when-absent unless
`boot-java.live-information.all-local-java-processes` is true. The extension now
supplies that default while preserving an explicit user override to false;
automatic connection remains off and `planned`.

Inventory version 22 records aggregate live metrics as `implemented`. A new
Java-file source Code Action lists Spring's connected processes, bounds an
explicit process choice, refreshes the pinned server's `memory` and `gcPauses`
metric families, and reads `heapMemory`, `nonHeapMemory`, and `gcPauses` into the
owned `.zed/spring-live.md` snapshot. The document carries the selected process
name/type and an ISO timestamp, is safe to delete and regenerate, never mutates
`.gitignore`, and omits the opaque process key plus all metric tag names/values
so arbitrary runtime identifiers are not persisted. Contract tests cover the
exact command sequence (including the pinned JMX extractor's required explicit
empty tag filter), finite-number filtering, 64-model/16-measurement bounds,
dismissal, empty state, and foreign-file preservation. A driven connected-Boot
run is still required before this row can become `verified`.

Inventory version 23 promotes aggregate live metrics to `verified`. The
2026-07-23 driven gate used the already verified Boot 3.5.5/JMX connection on
macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0 and
Temurin JDK 25.0.3. The action generated 12 authentic heap/non-heap
measurements, Zed rendered the owned Markdown preview, and a later explicit
refresh changed the timestamp, hash and values while adding a real GC-pause
model for 15 measurements total. Moving the owned file out of the worktree and
running the action again recreated it with a third timestamp/hash and current
values. The generated snapshots contained neither metric tags nor an opaque
process-key field. Evidence:
`tmp/live-metrics-runtime-20260723/evidence/`.

Inventory version 24 records live logger inspection and level changes as
`implemented`. The existing metrics action now produces one bounded Spring Live
Data document: it retains the verified metric sections and adds up to 512
sorted logger entries from `sts/livedata/getLoggers`, while an unavailable
loggers endpoint leaves metrics intact with a visible logger notice. A separate
Java-file source action selects a connected process, pages logger choices ten at
a time, selects only a server-advertised level, and requires a final explicit
confirmation before calling `sts/livedata/configure/logLevel`. That Spring
command returns `null` before its asynchronous work completes, so the
coordinator reports success only after a matching
`sts/liveprocess/loglevel/updated` notification; timeout, dismissal,
disconnect, and mismatched updates never become false success. Mutation
identifiers are preserved exactly rather than truncated, opaque process keys
never enter the document, legacy version-1 Live documents remain owned for safe
migration, and foreign files remain untouched. Contract tests cover the
document bound, exact command arguments, pagination, confirmation, matching and
mismatched notifications, timeout, and dismissal. A driven Boot/JMX gate is
still required before this row can become `verified`.

Inventory version 25 promotes live logger inspection and level changes to
`verified`. The 2026-07-23 driven gate used the connected Boot 3.5.5/JMX fixture
on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0 and
Temurin JDK 25.0.3. `getLoggers` returned 861 authentic entries; the Live
document rendered the sorted first 512 with an exact bound and no opaque process
key. The separate action paged those choices ten at a time, offered Spring's
advertised levels, and required final confirmation before changing `ROOT` from
`INFO` to `DEBUG`. Spring's matching update notification preceded the success
notice, and a fresh snapshot showed effective/configured `DEBUG`. The recovery
arm received the matching `DEBUG` to `INFO` update and the final snapshot proved
the original state was restored. Evidence:
`tmp/live-loggers-runtime-20260723/evidence/`.

Inventory version 26 closes the separate show/hide/refresh row as
`zed-native-equivalent`. At pinned Spring Tools commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9`,
[`vscode-extensions/vscode-spring-boot/lib/live-hover-connect-ui.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/lib/live-hover-connect-ui.ts#L148-L176)
shows that
the three VS Code commands are client-side active-debug-app wrappers around
`sts/livedata/connect`, `sts/livedata/disconnect`, and
`sts/livedata/refresh`; they add no separate server operation. Zed's existing
Java-file Code Action selects an explicit process from Spring's
`listProcesses` descriptors and executes those same commands. Coordinator
contract tests now cover all three choices, and the version-21 driven gate
already connected, exposed refresh/disconnect, refreshed live CodeLens, and
disconnected with JMX cleanup. This classification does not promote automatic
or remote connection, which retain their independent ambiguity and security
gates.

Inventory version 27 records opt-in automatic local connection as
`implemented`. The pinned VS Code feature is client-owned: its Java debug
provider adds local-management and `spring.boot.project.name` JVM properties,
then a debug-session event supplies the process identity before it calls
Spring's ordinary connect command. Zed exposes neither debug hook to an
extension. The Zed-native route therefore adds equivalent, reviewable
local-management/project properties only to generated Java debug entries when
`boot-java.live-information.automatic-connection.on` is explicitly true, then
polls Spring's local Attach descriptors without overlapping scans. It reconciles
each descriptor's project name against the authentic
`sts/spring-boot/executableBootProjects` result and invokes the already verified
confirmation-based connect path only when exactly one distinct matching process
exists. Missing identity, unrelated JVMs, two matching processes, unsafe
generated project names, setting disablement, and a repeated attempted key all
fail closed. Contract tests cover settings/argument propagation, generated
debug JVM properties, dynamic enablement, single-candidate connection,
unrelated/unnamed exclusion, ambiguity, authoritative connected notification,
and cleanup. A real Zed Java-debug launch must still prove automatic discovery,
connection, live data, manual disconnect without reconnection, and debug-stop
cleanup before this row can become `verified`.

Inventory version 28 promotes automatic local connection to `verified` on the
2026-07-23 macOS arm64 tuple. With the default-off setting explicitly enabled,
the product-generated Java debug entry launched Boot 3.5.5 with its reviewable
local-management and project-identity properties. Spring discovered exactly the
matching fixture, published the authoritative `sts/liveprocess/connected`
notification, and delivered authentic live data. The explicit process action
then published `sts/liveprocess/disconnected`; keeping the same debuggee alive
across more than two automatic polling periods produced no reconnection. Zed's
debug stop terminated the fixture, and closing the isolated profile left no
product coordinator, Spring server, official-Java proxy/JDT LS, or debuggee.
This closes the lifecycle gate only on the named tuple; fail-closed identity
contract tests and the explicit process-selection fallback remain required
elsewhere. Evidence: `tmp/live-auto-connect-runtime-20260723/evidence/`.

Inventory version 29 records remote connection as `implemented` and corrects the
route this inventory previously recorded for it. The planned row assumed a Code
Action calling `sts/livedata/remoteConnect`; a source read of the pinned release
refuted that on parity grounds. No VS Code code path invokes that command — it
belongs to Eclipse Boot Dash — and it is a declarative set replacement keyed by
an owner string, not an imperative connect. VS Code's only remote route is the
`boot-java.remote-apps` settings array, whose entries default `manualConnect`
false, so declaring a target *is* the connect. The extension's existing
user-settings passthrough already delivers that array unchanged, so the outcome
required no new command, and the verified explicit process action already lists
the resulting targets. The assumed credential gate also resolved differently:
`RemoteBootAppData` carries no credential field, so this extension never
prompts for or stores one, and credentials can only appear inside the user's own
`jmxurl`. That URL is not inert, because Spring derives both the process key and
the fallback process label from it — so the coordinator now strips URL userinfo
from every label it renders into a prompt, a notice, or the generated Live data
document, while passing the raw key and process name back to Spring untouched.
This is the second silent-gap correction in this workstream where the recorded
plan named a command the pinned client never calls.

Inventory version 30 promotes remote connection to `verified`. On 2026-07-24 a
Boot 3.5.5 fixture exposing HTTP Actuator was connected purely by declaring one
`boot-java.remote-apps` entry: a single `workspace/didChangeConfiguration` was
the entire connect gesture, and the pinned Spring Tools 5.2.0 server answered
with `sts/liveprocess/connected` carrying `type: "remote"` and a `processKey`
equal to the declared `jmxurl`, followed by 860 authentic loggers read from the
running application. Clearing the array to `[]` produced
`sts/liveprocess/disconnected`, confirming that the settings key is a whole-set
replacement rather than an additive list. A second run against
`http://gateuser:gatesecret@localhost:8080/actuator` demonstrated that the
credential exposure this slice guards against is real rather than theoretical:
the server's own label returned the username and password verbatim, and
replaying that authentic payload through the coordinator rendered
`http://<credentials redacted>@localhost:8080/actuator` with the endpoint still
readable. A second gate repeated the route through real Zed on an isolated
profile, where the setting travelled from the user's `.zed/settings.json` through
the extension's merge into `workspace/didChangeConfiguration`, Spring built the
remote connector and connected, the connected notification reached the client,
and the editor rendered Spring hover naming the remote process — so the
extension-to-server half is observed in the real client rather than inferred.
Two limits are recorded rather than smoothed over: the target was localhost
rather than a physically remote host, and only the `http` branch of
`connectProcess` ran, leaving the `service:jmx:rmi://` branch untested.

Inventory version 31 promotes SpEL language intelligence to `verified` and
needed no product code to do it. A source read first narrowed the row to what
Zed can carry: semantic tokens stay settled negative from S017, the pinned
release has no SpEL-specific hover provider, and what remains — reconciler
diagnostics and `@Value` navigation — is ordinary LSP. The settings audit that
caught `jpql`, `inject-bean` and the XML sub-keys found nothing to send here:
`boot-java.validation.spel.on` is a `ProblemCategory.Toggle`, and
`isProblemCategoryEnabled` falls back to the toggle's own `ON` default when the
key is absent, which is what VS Code's schema also declares. The 2026-07-24
driven run on macOS arm64, Zed 1.11.3, official Java 6.8.21 and Temurin JDK
25.0.3 then observed both surfaces against a new fixture class. Spring published
three authentic diagnostics — SpEL syntax, property-placeholder syntax through a
second grammar, and one on `@EventListener(condition = …)`, which is the
evidence that the reconciler's reach is the whole `SPEL_EXTRACTORS` set and not
just `@Value`. Two Go to Definition gestures then returned Spring's two
navigation shapes, bean reference and method reference on a bean. Those gestures
also answered the composition question S018 left open for a third request type:
Zed fans `textDocument/definition` out to both servers and unions the results,
so Spring's index-derived targets compose with the official Java server's
instead of being replaced by them, and no coordinator merge code is needed —
the same favourable branch as `references`, not the single-primary
`documentHighlight` branch. Like the cron fixture, the unparseable expressions
live on a class with no stereotype annotation, because the reconciler walks the
AST rather than the registered bean set and the fixture has to keep booting.
Evidence: `tmp/spel-runtime-20260724/evidence/`.

Inventory version 32 promotes Spring Data query intelligence to `verified` and
closes Workstream 2. It, too, needed no product code: `boot-java.jpql` was
already sent for the `IH-2` inlay hint, `boot-java.validation.data-query` is a
`ProblemCategory.Toggle` whose absent-key path returns its own `ON` default, and
`codelens-over-query-methods` was already in the default configuration. The
recorded version numbering, summary counts, and this note were missed when that
row landed and are restored here. Evidence:
`tmp/data-query-runtime-20260724/evidence/`.

Inventory version 33 records the Maven build route as `implemented`. Reading the
source first shrank this row more than any other so far. Spring advertises two
build commands, but `sts.gradle.build` has no caller in the whole server, and
`sts.maven.goal` has exactly one: the Data AOT lenses, with a single composed
goal. There is no arbitrary-goal surface to reach parity with, so Gradle builds
and ad-hoc goals were never a Spring Tools capability — they are Zed task and
official-Java ownership, which is where D003 already put them. What the row
really contained was a delivery question about one command, and a direct drive
of the pinned server answered it with numbers rather than principle: Spring's
own handler ran the AOT goal successfully and silently, reported a failure as a
Java stack trace with Maven's diagnostic discarded, and — because `executeMaven`
waits on `Process.onExit()` while never reading the child's output — hung past
300 seconds on a build that takes 5 seconds when something drains its pipes.
That is the concrete form of "no Zed task/terminal ownership": not only invisible
but, past the pipe buffer, unfinishable. The coordinator now answers both
commands itself and writes a reviewable wrapper-aware task the user starts and
watches. The one trap worth carrying forward is internal: `writeMergedConfig`
replaces every entry it recognizes as generated, so a second writer sharing the
old label prefix would have silently deleted the run/debug entries. The two
writers now own disjoint label prefixes and pass their own scope predicate.
Evidence: `tmp/maven-goal-ownership-20260724/evidence/`.

Inventory version 34 promotes that route to `verified`. A 2026-07-24 isolated
run on macOS 26.5.2 arm64, Zed 1.12.0, official Java 6.8.21, Spring Tools 5.2.0,
and Temurin JDK 25.0.3 clicked `CL-4a` in the real editor and observed the
reviewable task appear in `.zed/tasks.json`. Zed's `task: spawn` picker exposed
that exact entry; running it produced visible Maven `BUILD SUCCESS` output and
created the authentic 13,450-byte
`target/spring-aot/main/resources/dev/zed/spring/codelens/CodeLensShowcaseRepository.json`.
After the generated-data lenses loaded, clicking `CL-4e` rewrote the same task
while the JSON timestamp stayed unchanged and no Maven process started. This
closes both halves of the ownership contract: the lens creates or refreshes a
task, and only the user's task-picker action runs the build. Evidence:
`tmp/maven-goal-ownership-20260724/evidence/`.

Inventory version 35 promotes Spring Boot version/support validation to
`verified`. The diagnostics half needed no product code and no settings: a
four-module Maven fixture pinned to Boot 4.0.6, 3.5.5, 3.3.5 and 2.7.18 drew every
problem type whose default severity is not `IGNORE`, both branches of the OSS
message, and — deliberately — nothing at all for the three types that default to
`IGNORE`. This is the first row where the settings audit came back empty on both
sides: every version-validation default in `BootDiagnosticSeverityProvider`'s
absent-key path already equals the VS Code schema default, so the silent gap that
`jpql`, `inject-bean` and the XML sub-settings had does not exist here. What the
row actually contained was a **dead end for the user**. Both of its link quick
fixes, release notes and Tanzu commercial support, execute `sts/show/document` for
an external page, and stock Zed answers no `window/showDocument`; the coordinator
was replying with a notice written for generated *files* — it advised Go to
Definition on a repository method — and reporting failure, which made Spring add
its own `Failed to open:` error. The coordinator now renders an `http`/`https`
target as the address itself in a bounded Markdown link and reports the request
handled. Two details are the interesting part. The surface had to be a
`showMessageRequest` with a dismissal action rather than a `showMessage` toast,
because a toast auto-dismisses before a link can be clicked and Zed drops an
actionless request — the same reason the compatibility report uses that surface.
And because the address is server data rendered into something clickable, the
label is the address itself, so no label can claim a destination the link does not
have, while userinfo or Markdown-breaking characters downgrade it to redacted
plain text. Evidence: `tmp/version-validation-20260725/evidence/`.

Inventory version 36 promotes both Spring Modulith rows to `verified`. Reading the
pinned server first shrank them the same way as the previous two rows, and split
them cleanly: the **refresh** row is a client flow the coordinator reproduces, and
the **projects** row is delivered by a document this project already verified.
`ModulithService` registers `sts/modulith/projects` and
`sts/modulith/metadata/refresh` unconditionally, and VS Code's `Refresh Modulith
Metadata` command is nothing but a three-step chain over them — list, quick-pick
when there is more than one, refresh by location URI. The new Code Action is that
chain with a bounded `showMessageRequest` in the middle, and it reports nothing of
its own on success or on a rejected project, because `ModulithService` already emits
its own `window/showMessage` for every outcome; adding a second notice would
double-report. For the **projects** row no new surface was needed at all:
`SpringIndexCommands` swaps `JMoleculesStructureView` for `ModulithStructureView`
whenever the project depends on `spring-modulith-core`, so the opt-in Structure
document renders application modules with their named-interface exposure the moment
the metadata exists.

The one product change is a settings default, and it is the **third** instance of
the absent-key trap after `jpql` and `java.completions.inject-bean`:
`BootJavaConfig.isModulithAutoProjectTrackingEnabled()` reads false for a missing
key while VS Code's schema defaults it `true`. A clean control proved what that
costs — with the key absent, `ModulithService` never registers its `ProjectObserver`
listener, produced **zero** log lines at import, and the
`MODULITH_TYPE_REF_VIOLATION` diagnostics never appeared; with the default sent,
metadata loaded for both Modulith projects on import and all three violations
published with no user action. Reaching a *valid* control took two attempts and
that is worth recording: Spring persists per-project symbol **and diagnostic**
caches under `~/.sts4/.symbolCache`, which `--user-data-dir` does not isolate, so
the first control replayed the previous run's diagnostics from disk while
`ModulithService` was provably idle. The same control corrected the causal claim in
a useful direction: generating the Structure document with tracking still off loads
the metadata anyway, because `ModulithStructureView` requests it itself, after which
the diagnostics do appear. So the setting is not what makes the diagnostics
possible; it is what makes them automatic, which is the VS Code behavior.
Evidence: `tmp/modulith-20260726/evidence/`.

Inventory version 38 changes no capability state. It withdraws the Zed 1.12.0
regression signal that version 37 attached to the two extension-contributed
language rows, because the investigation found no Zed change to blame: the run
profile carried a **stale extension index**. Zed rebuilds
`<data-dir>/extensions/index.json` at startup only when the index file is not
newer than `extensions/installed/`, and copying a warm profile always leaves the
index newer, so a copied profile keeps the source profile's registered language
set forever. That run's profile descended from a 2026-07-19 ancestor that
predates both language directories, so `Spring Factories` and `JPA Query
Properties` were never registered — even though the manifest recorded in the same
index still listed both, which is why the log reported two extensions loaded with
no error at all. Two controls settle it: the developer's ordinary profile on the
same Zed 1.12.0 has both languages indexed, and deleting `index.json` alone in a
freshly copied profile restored both languages, `spring.factories` opening as
`spring-factories` and `jpa-named-queries.properties` as `jpa-query-properties`
with its `JPQL_SYNTAX` diagnostic back. Both rows' claims now cover Zed 1.11.3
and 1.12.0. The lesson is about evidence, not about the product: a copied profile
can silently invalidate any driven negative result, so the profile's rebuilt
index is now something to confirm before trusting one. This also retires the
`FACTORIES_KEY_NOT_SUPPORTED` explanation in the Java-reconciler row and replaces
it with a narrower, source-backed one — the file now reaches Spring as
`spring-factories` and the reconciler still publishes nothing, which its own
code attributes to an unresolved project rather than to routing.
Evidence: `tmp/lang-matching-20260726/evidence/`.

Inventory version 39 promotes Boot project info to `verified` and empties the
`implemented` column: every capability this project has built is now either
observed working on a named tuple or carries a named blocker. The row had been
`implemented` for a specific reason worth keeping visible — `sts/spring-boot/
bootProjectInfo` was advertised and forwarded but never invoked, and an
advertised command a user cannot reach is not a delivered outcome. It also had no
upstream client to mirror: the pinned VS Code extension never calls it, the same
zero-caller shape as `sts.gradle.build`, so the contract came from Spring's own
`WorkspaceBootExecutableProjects` class. That reading is what made the slice
small — one `source` Code Action carrying the requesting document's URI, and a
bounded notice. Driving it on a four-module fixture then corrected the plan
twice. The `javaVersion` field turned out to be the project classpath's JRE
rather than jdtls's configured `java_home`, and one module resolved none at all,
which settled that an unresolved field should be omitted rather than printed as
"unknown". More usefully, the assumption that Spring answers `null` for a file
outside every project was wrong: it throws there, because the handler passes its
`orElse(null)` project straight into a method that dereferences it. The first
build surfaced that as `Spring Tools rejected an internal callback` — the
coordinator's single fixed string for every Spring error response, which
misdescribed this failure and threw away the server's own message. Preserving
that message alongside the generic one is a small change with reach beyond this
row, since every coordinator caller now *can* distinguish a server error from a
timeout, and it is what let this action explain an absent project honestly.
Evidence: `tmp/boot-project-info-20260726/evidence/`.

Inventory version 40 changes no capability state either. It closes the last
unobserved diagnostic on the `spring-factories` row, and the answer turns out to
be smaller and less interesting than both explanations that preceded it.
`FACTORIES_KEY_NOT_SUPPORTED` was blamed first on language matching, then — after
version 38 corrected that — on project resolution for a non-Java `.factories`
URI. Neither the file type nor its extension had anything to do with it.
`SpringFactoriesReconcileEngine` resolves through the ordinary
`JdtLsProjectCache.find`, which accepts any `file:` URI contained in a registered
project URI, and in those runs **no project was registered at all**: no Java
buffer was open, so Zed never started the official Java extension, no classpath
reached Spring, and `projectFinder.find` was empty for every URI in that
worktree. The extension's own notice saying exactly that is in the earlier run's
log, one screen above the observation it explains. Opening one Java file first
publishes the diagnostic on both scanned paths — `META-INF/spring.factories` and
`META-INF/spring/aot.factories` — as `ERROR` over the whole continued key/value
pair, while a still-supported key in the same file draws nothing. What makes the
result solid rather than merely positive is an accidental control: four stray
characters typed into the key and reverted produced an **empty** publish and then
the diagnostic again, and an empty array is only reachable inside the
`ifPresent(…)` this row spent two rounds suspecting. The general lesson repeats
version 38's: this project's own known constraint — Zed starts jdtls only for
Java buffers — is a standing confound for any negative result about a non-Java
file, and it is cheaper to rule out first than to reason around.
Evidence: `tmp/factories-project-20260726/evidence/`.

Inventory version 41 changes no capability state either. It closes the last three
`unobserved` problem types carried by two already-`verified` rows —
`JAVA_BEAN_NOT_REGISTERED_IN_AOT`, `SPRING_DATA_STRING_PROPERTY_REFERENCE` and
`SPRING_CLOUD_INCOMPATIBLE_BOOT_VERSION` — so the `spring-aot` category now
stands at 3/3, `boot4` at 7/7, and every non-`IGNORE` type in
`version-validation` has been drawn at least once. What makes them worth a
version entry is that all three had been explained from the outside and all three
explanations were wrong. None of the three was about the shape of the code the
reconciler looks at: each was a **dependency-version or registration
precondition** that the fixture, not the source, had failed to meet. The AOT one
fires on any unregistered concrete implementation of Spring's two AOT-processor
interfaces, so the previous fixture's `@Component` on that class was the only
thing suppressing it. The Spring Data one needs spring-data-commons **≥ 4.1.0**,
because it only flags a String argument when a `TypedPropertyPath` overload
exists beside it — an API that ships in 4.1.0 — so the Boot 4.0.6 module could
never have produced it, and the recorded suspicion about its domain-type resolver
was doubly wrong, since the domain type only enriches the message. The Spring
Cloud one is not a version comparison at all but a two-hop walk through spring.io
generation metadata, which means the fixture is a *pairing* — spring-cloud-commons
4.1.6 beside Boot 3.5.5 fires, 4.3.3 beside the same Boot does not. Each closure
carries a control that differs in exactly one thing, and the new
`TypeSafePropertyReferenceRefactoring` quick fix was driven through Zed's own
code-action menu to `applied: true`, after which the reconcile dropped that one
diagnostic and kept the other four. The standing lesson is a fixture one: when a
reconciler is silent, check its `isApplicable` gate and the index it consults
before theorising about the syntax in front of it. Evidence:
`tmp/residual-diagnostics-20260726/evidence/`.

Inventory version 42 promotes offline behaviour to `verified` and empties the
last row that was `planned` for want of evidence rather than for want of a
decision. Five runs on one worktree, each launched under a `sandbox-exec`
profile that denies every outbound connection except host-local transports, so
the denial covers Zed, the coordinator, and the Spring/JDT JVMs alike — the
JVM's own `java.net.SocketException: Operation not permitted` in the server log
is the proof that the child processes were inside it too. **First install with
no network fails closed and says why**: the status bar reads `Failed to run
spring-tools`, and its error buffer carries this extension's message naming the
pinned release above Zed's own cause chain, which names the exact release URL it
could not reach. Nothing is fabricated around that failure — no install
directory, no partial archive, no staging leftover, and no coordinator process,
so there is no reduced mode to mistake for a working one. **A warm cache needs
no network at all**: the same worktree started the Spring server from the
checksum-verified install, registered the official Java classpath bridge,
answered `sts/javaType`, published the Java reconciler diagnostics and the
classpath-backed `PROP_UNKNOWN_PROPERTY`, and offered `server.*` completion with
its metadata documentation. The **one** capability that degrades is version and
support validation, and it degrades cleanly: `MavenMetadataProvider` and
`https://api.spring.io/projects` both fail in the server log while the build
file receives an **empty** diagnostic publish, so the user sees no update advice
rather than stale advice or an error. The checked artifact cache turned out to
be a repair path, not only a guard: a single flipped byte in an installed jar
was detected and **repaired offline** from the cached VSIX, restoring the pinned
checksum with no download. Corrupting the archive as well is what fails closed —
the tampered VSIX is deleted rather than used, the existing installation is left
exactly as it was, and one online start afterwards re-downloads, re-installs to
the pinned checksums and runs. That last pair is the real rollback claim this
row can make: activation is a validated staging directory renamed into place, so
a failed install or repair never destroys the installation it was replacing.
What stays out of the claim is unchanged: other platforms, other JDKs, rollback
between two *different* pinned Spring releases (only one is pinned), and
project-operated redistribution, which remains a decision rather than a test.
Evidence: `tmp/offline-behaviour-20260726/evidence/`.

Inventory version 43 changes no capability state and adds no row. It records
what the first M5 tuple gate — the Java 21 floor on macOS arm64 — found about a
row that was already `verified`. The whole point of that gate was platform
evidence, and platform evidence normally belongs in `COMPATIBILITY.md` alone;
this is the exception the standing rule names, because a capability misbehaved.
Spring's first `sts.java.type` lookup on a never-before-imported project
exceeded official Java's five-second command timeout, and the coordinator turned
that single transient rejection into the D006 compatibility notification —
*requires a working official Java extension and JDK 21 or newer* — three seconds
before the same route answered normally and every capability in the gate worked.
The product already knows how to tell these apart on the neighbouring path: the
2026-07-22 forced-timeout gate observed the classpath route absorb exactly this
timeout and re-enable with no notice. The data route has no such treatment, so
one slow first import is enough to tell a new user their toolchain is
incompatible when it is not. Four later runs alternating Temurin 21.0.11 and
25.0.3 against warm and rebuilt fixtures did not reproduce it, and pausing JDT
LS mid-session did not either — Spring answered from its own index instead —
so this is recorded from its one authentic occurrence, and closing it means
changing when the report fires, not what it says. Evidence:
`tmp/m5-jdk21-floor-20260726/evidence/`.

Inventory version 44 closes that defect and changes no capability state. The
report now fires on the same evidence the classpath route already required: a
data-route failure is startup noise until it outlives the sixty-second handshake
window that opens with the first Java document, and it can never justify the
notice once the route has answered, because the notice's own claim — a working
official Java extension and JDK — is then provably met. Suppression is
presentation-only; Spring receives the error response either way, which is why a
genuinely broken route keeps failing and is still reported.

The 2026-07-29 gate also refutes this section's own note that pausing JDT LS
mid-session cannot reproduce the failure. It can, given three preconditions that
each produce a convincing false negative on their own: `SIGSTOP` is signal 17 on
Darwin, not Linux's 19, so three earlier runs froze nothing while reporting a
clean pass; opening Java documents exercises no data route at all on this
fixture, because the route's real caller is
`SpringPropertiesReconcileEngine.reconcileType` -> `JdtLsIndex.findType`, so the
gesture is opening a `.properties` document; and freezing before Spring logs
`project created event` leaves it project-less, which is the state that made it
answer from its own index in the earlier attempt. With all three satisfied, the
pre-fix build raised the notice fifteen seconds into the import on the first
timed-out lookup, and the fixed build suppressed six failures inside the window
and raised the same notice two seconds after it closed. Evidence:
`tmp/data-route-transient-20260729/evidence/`.

Inventory version 45 decides two of the three `planned` rows and changes no
capability's behaviour. The plan records shipping a stable release with rows
left in that state as defensible only if each has been *decided* rather than
left pending, and `planned` had become the label for three quite different
situations, which is the thing worth fixing: it means "intended future work",
and only one of the three was.

**Spring Initializr moves to `not-pursued`.** It is not in the pinned VSIX — a
separate VS Code extension owns project generation there — so it was never
inside the parity target, and there is no upstream behaviour here to adapt.
Building it would be a new product surface rather than a slice, and the outcome
is already reachable outside the editor.

**Explain SpEL / queries / AOP moves to `blocked-zed-api`.** Nothing about it
changed; the label did. The missing surfaces are named exactly — no Agent-state
detection and no Agent dispatch or prefill in Zed's public extension and
CodeLens APIs — and the standing rule for that label is met, because a user
asking their own Agent is not this extension delivering the outcome. Recording
it as `planned` implied a slice was pending when what is pending is a Zed API
and a privacy decision.

**The embedded MCP server stays `planned` pending one observation**, which is
the honest state for it: unlike the other two, its blocker is a fact nobody has
checked. The pinned jar ships the server enabled, but this extension launches
Spring with `-Dspring.main.web-application-type=NONE`, so the embedded Tomcat
cannot start and the row's premise — that the capability is there for the taking
— is untested. That flag also explains why `EmbeddedMcpServer`'s "started at
port" `window/showMessage` has never appeared in any captured trace. A spike
will establish whether the server starts at all, whether one JVM can serve
streamable-HTTP MCP and LSP at once (R018 hypothesis 6, still unobserved), and
whether the random port is announced only through that message. The decision —
including the listening-port, `api.spring.io` and offline consequences — is then
made on evidence rather than on a reading of the jar.

Inventory version 46 decides that third row. It changes no capability's
behaviour either: the decision is a direction, and the slice that acts on it is
separate.

[S019](spikes/019-embedded-mcp-server.md) ran the spike on 2026-07-29 and
answered all three questions. Lifting the one flag is sufficient — the
unmodified pinned jar bound `127.0.0.1:<random>`, served all 18 tools over
`POST /mcp`, and left the stdio LSP stream byte-clean with diagnostics identical
to the control, which closes R018 hypothesis 6 on its first observation. The
port reached stderr as well as `window/showMessage`, and the spring.io tools
were observed making live outbound calls.

**One fact found after that spike merged reframes the whole row, and it is the
reason the decision is "build" rather than "decline".** The two settings below
were read from the pinned VSIX's own launcher, not from the server jar, which is
why no previous settings audit had surfaced them — every prior audit compared
VS Code's schema against `BootJavaConfig`, and these are consumed by the client
before the server exists.

```js
n === true && i >= 0 && i <= 655536
  ? e.push("-Dserver.port=" + i)
  : e.push("-Dspring.main.web-application-type=NONE")
```

`boot-java.ai.mcp-server-enabled` defaults `false`; `boot-java.ai.mcp-server-port`
defaults `50627`. Two consequences follow, and both cut against the reading this
project had been carrying:

1. **Our flag is not a deviation from the parity target — it is that target's
   own default branch, faithfully reproduced.** VS Code ships the embedded MCP
   server off. So the current state is already correct for a user who has not
   opted in, and the gap is narrower than "the capability is missing": we
   implement one of the two branches.
2. **The random port is an artefact of the spike, not of the capability.** When
   the setting is on, upstream passes an explicit `-Dserver.port=<setting>`,
   which overrides the jar's `server.port=0`. The spike observed a random port
   because it lifted the flag *without* supplying the port setting — a state
   upstream never produces. S019's third clause is therefore sound as an
   observation and misleading as a constraint; the follow-up note in that
   document records the correction rather than restating the result.

**The row is decided as build, and stays `planned` until it is built.** That is
not a hedge: `planned` means "not built yet, no claim", which is exactly true,
and the M6 criterion asks for the *direction* to be settled rather than for the
label to change. `not-pursued` would be wrong here, because that label means a
documented exception outside the parity target — the correct reading for Spring
Initializr, which is absent from the pinned VSIX entirely, and the wrong reading
for a capability that VSIX exposes through two documented settings.

The implementation is a separate `feat/` slice and is deliberately not started
here. Its shape: honour both settings, defaulting off, so that the default
launch is byte-identical to today's. Everything that made this row uncomfortable
— an unauthenticated loopback endpoint, a runtime network dependency that would
reopen the closed offline row, a listening port at all — then exists only for a
user who asked for it, and AGENTS' prohibition on adding a runtime network call
without an explicit decision is satisfied by this entry rather than bypassed.

Two costs are recorded rather than discovered later. First, this is a **new
kind** of setting for this extension: every `boot-java.*` key handled so far is
forwarded *to* the server through `spring_workspace_configuration`, whereas
these two change **how the process is launched**, which is a layer no current
code touches. Second, connecting Zed's MCP client to the resulting endpoint is
user configuration, not something the extension performs; that belongs in
release-facing documentation and is not a blocker.

Two constraints of the Zed extension API shape several rows below. Both are read
from the `zed_extension_api` 0.7.0 world's complete export list and corroborated
by Zed's documentation, which states an extension "can provide languages, themes,
debuggers, snippets, and MCP servers".

1. **No custom view surface.** Nothing in the API contributes a tree view,
   panel, sidebar, or webview, so a VS Code view *as a custom panel* cannot be
   reproduced. This is a confirmed constraint on the widget, not a verdict on any
   capability: a capability whose VS Code form is a view may still be delivered
   through a Zed-native surface — the outline panel (document symbols), symbol
   search (workspace symbols), diagnostics, or completions. Blocking a capability
   requires showing that none of those carry the outcome.
2. **No command-palette contribution.** An extension cannot add an arbitrary
   command to Zed's palette, which is how VS Code exposes most Spring Tools
   commands. This does **not** by itself block those capabilities: the Spring
   server advertises `codeActionProvider`, so a command may be reachable as a
   code action, and `workspace/executeCommand` remains available over LSP.
   Whether each command capability has such a route is undetermined, so those
   rows stay `planned` rather than being called blocked.

3. **No way to start another extension's language server.** Zed starts the
   official Java server only when a Java file is open, and nothing here can
   trigger it: the API world exposes no such call, and `languages.<Language>.
   language_servers` only orders servers already declared for that language. A
   2026-07-20 driven run added `jdtls` to `languages.Properties.language_servers`
   and opened only `application.properties` — Zed started this extension's
   coordinator alone, while opening one `.java` file in the same session started
   the official Java proxy immediately. Spawning it from the coordinator is not a
   workaround: it would cross D003's ownership boundary and still produce no
   route, because the port file this extension reads is written by the official
   extension's proxy. Until that server runs, Spring has no classpath, so
   property support degrades to syntax only; the coordinator states that once and
   names the only action that works.

Debuggers are supported, so run/debug is not assumed blocked.

Zed 1.11.3 also has a default-off `document_symbols` language setting that
switches Outline and Breadcrumbs from tree-sitter to LSP
`textDocument/documentSymbol`. The extension can read settings but cannot force
this user setting. S015 confirmed that Zed merges clear nested JDT/Spring results
after both servers are ready, but Refuted the route on restart: Spring answers
before JDT's later dynamic registration, and the cached Outline omits Java
symbols until a source edit forces recollection. Project Symbols remains the
verified structure-navigation fallback.

## Workstream 1 — properties and YAML

| Capability | State | Notes |
| --- | --- | --- |
| Property key/value completion in `.properties` | `verified` | Real metadata completion observed on the tested tuple during the M2 gate run. |
| Property completion in `.yaml` | `verified` | Real metadata completion observed in `application.yaml` on the tested tuple, including type detail and a deprecation note in the documentation panel. |
| Hover documentation on properties | `verified` | Observed 2026-07-18. Zed issued `textDocument/hover` on `application.properties` (Properties routes only to `zed-spring-tools`, so Spring-attributed) and Spring returned non-empty markdown for both a framework-provided key (`server.port` → type `java.lang.Integer`, `Default: 8080`, `Server HTTP port.`) and a project-provided key (`fixture.greeting.salutation` → the fixture's own javadoc, via generated `spring-configuration-metadata.json`). Evidence: `tmp/lsp-verify-20260718/`. |
| Property validation / diagnostics | `verified` | Spring-attributed diagnostics observed for both files on the tested tuple: `'ser' is an unknown property. Did you mean 'server.address'?` in `.properties`, which requires classpath metadata, and `Expecting a 'Mapping' node but got 'ser'` in `.yaml`. Both carry `source: vscode-spring-boot`. |
| Navigation from a property to its definition | `verified` | Observed 2026-07-18. `textDocument/definition` on `fixture.greeting.salutation` in `application.properties` returned a LocationLink to `GreetingProperties.java` at the `salutation` field (line 26). Spring-attributed (Properties routes only to `zed-spring-tools`); Zed jumps. Evidence: `tmp/lsp-verify-20260718/`. |
| Shared properties metadata reload | `verified` | Verified 2026-07-20 on macOS arm64/JDK 25.0.3, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0. **A static read of the pinned server first showed the command could never work as shipped**: `sts/common-properties/reload` is handled by `DefaultSpringPropertyIndexProvider` → `SpringPropertiesIndexManager.reloadCommonProperties()`, which returns `false` immediately unless `commonPropertiesFile` is set, and that comes only from `BootJavaConfig.getCommonPropertiesFile()` = `Settings.getString("boot-java","common","properties-metadata")`. The extension sent a hardcoded workspace configuration with no user settings, so the file was always null and the action was a guaranteed no-op that still claimed success. Both halves were fixed: `spring_workspace_configuration` now deep-merges the user's `lsp."spring-tools".settings` over the defaults (any `boot-java.*` key VS Code exposes is now settable, and a relative metadata path is anchored to the worktree root because Spring resolves it with `Paths.get`), and the coordinator now reports Spring's boolean instead of assuming success. Driven evidence: Zed's `workspace/configuration` carried `"properties-metadata":"/private/tmp/zed-spring-ws1close/config/shared-metadata.json"` (relative path absolutized); with the JSON holding only `shared.fleet.banner`, that key validated clean while `shared.fleet.footer` drew `'shared.fleet.footer' is an unknown property. Did you mean 'shared.fleet.banner'?` — Spring suggesting a key that exists only in the shared file. Adding `footer` to the JSON and re-reconciling left the diagnostic in place (`Suppliers.memoize` holds the old repository), and only after the Code Action ran did it disappear while the `definitely.not.a.real.key` control diagnostic survived, proving a targeted reload rather than a cleared list. Evidence: `tmp/ws1-close-20260720/evidence/gate-{baseline,negative-control,after-reload}.log`. Manual server restart remains fallback. |
| Convert `.properties` to `.yaml` | `verified` | Verified 2026-07-20 on macOS arm64/JDK 25.0.3 with the development extension, official Java + Spring Tools 5.2.0 (boot-language-server 2.2.0-SNAPSHOT), and unmodified Zed 1.11.3. A `source` Code Action on `.properties` files runs `zed-spring-tools.convert-properties-yaml` (direction `props-to-yaml`), which computes a non-colliding `.yml` target and executes `sts/boot/props-to-yaml` with `[sourceUri, targetUri, false]`; the `false` matches VS Code's `spring.tools.properties.replace-converted-file` default, keeping the original for review. The driven run resolved the promotion gate: Spring drove `workspace/applyEdit` with a `create` documentChange plus the full nested-YAML content edit, **Zed replied `{applied:true}` and materialized the file** (`server:`/`spring:` tree matching the source), then opened it. A UX defect surfaced and was fixed: Spring's post-conversion `window/showDocument` reveal was hitting the generic CodeLens `showDocument` fallback notice (a confusing Spring-Data/CodeLens popup); the coordinator now acknowledges `showDocument` for an in-flight conversion target silently, since Zed opens the created file from the applied edit. Contract-tested (including the suppressed-notice case) and driven-confirmed absent on re-run. Evidence: `tmp/conv-gate-20260720/evidence/`. |
| Convert `.yaml` to `.properties` | `verified` | Verified 2026-07-20 on the same tuple, symmetric to the above with direction `yaml-to-props`, target `.properties`, executing `sts/boot/yaml-to-props`. The driven run observed Code Action → `executeCommand` → Spring `workspace/applyEdit` creating a non-colliding `application1.properties` with the flattened, `:`-escaped content, **Zed `{applied:true}`**, and only the success notice (the CodeLens fallback popup was absent). Evidence: `tmp/conv-gate-20260720/evidence/`. |
| `spring-factories` language support | `verified` | Verified 2026-07-20 on the same tuple. `extension.toml` now contributes a `languages/spring-factories` language (`path_suffixes = ["factories"]`) on a pinned `tree-sitter-properties` grammar, mapped to the Spring language id `spring-factories`. The driven run observed Zed send `textDocument/didOpen` for `META-INF/spring.factories` with `"languageId":"spring-factories"`; before this change the file was classified as no language and reached no server at all. The grammar revision `579b62f` is the same one the official Java extension already pins for its own Properties language, so a user who has that extension builds no additional upstream source. Spring published no diagnostics for the valid fixture, which is the expected quiet result; its factories support is completion and indexing rather than validation. **Also verified on Zed 1.12.0, and the 2026-07-26 regression signal is withdrawn — it was a harness artifact, not a Zed change.** The Java-reconciler run saw this file open with no language and send no `didOpen` on Zed 1.12.0, which looked like a client language-matching regression. The cause was a **stale extension index** in that run's profile. Zed rebuilds `<data-dir>/extensions/index.json` at startup only when the index file's mtime is *not* greater than the `extensions/installed/` directory's, and a `cp -R` of a warm profile always writes `index.json` after `installed/`, so a copied profile is never re-indexed and silently keeps the source profile's registered language set. That profile descended from `tmp/s016-run-20260719` (2026-07-19), which predates both of these language directories, so `index.languages` held only the official Java extension's four languages and neither of ours was ever registered — while the extension manifest recorded *inside the same index* still listed both `languages/…` paths, which is why the log said `extensions updated. loading 2` with no extension or grammar error. Control on the same Zed 1.12.0: the developer's ordinary profile has both languages indexed. A/B in one run dir: with the copied index in place `spring.factories` again opened with no language and sent no `didOpen`; after deleting `index.json` and nothing else, Zed rebuilt the index with `Spring Factories` and `JPA Query Properties` present and the same file opened as `"languageId":"spring-factories"`, with Zed issuing real `documentHighlight`, `codeLens` and `codeAction` requests against it. The claim therefore covers Zed 1.11.3 and 1.12.0. **`FACTORIES_KEY_NOT_SUPPORTED` is now observed too, on 2026-07-26, and this row's validation claim is no longer limited to completion and indexing.** `SpringFactoriesReconcileEngine` registers a reconciler for exactly one key, `org.springframework.boot.autoconfigure.EnableAutoConfiguration`, raises the problem when the category toggle is `ON` or is `AUTO` with `springBootVersionGreaterOrEqual(3,0,0)`, and is returned unconditionally by `SpringFactoriesLanguageServerComponents.getReconcileEngine()` — all three read from the pinned jar with `javap -c`, not only from upstream source. Its `reconcile` calls `beginCollecting` only inside `projectFinder.find(uri).ifPresent(…)`, and **that resolution, not the file type, was the whole blocker**: `JdtLsProjectCache.find` accepts any `file:` URI contained in a registered project URI, so a `.factories` file inside the module resolves like any other — but the earlier runs had registered *no* project, because no Java buffer was open, Zed never started the official Java extension, and no classpath ever reached Spring. The extension's own "this project has no Java file open" notice is in that run's log. With `PracticesApplication.java` opened first on the Boot 3.5.5 module, the diagnostic published on **both** scanned paths: `META-INF/spring.factories` and `META-INF/spring/aot.factories` — the path `SpringFactoriesIndexer.FILE_PATTERN` (`**/META-INF/spring/*.factories`) scans — each as a single `severity: 1` (ERROR) `FACTORIES_KEY_NOT_SUPPORTED` from `source: "vscode-spring-boot"` spanning the whole continued key/value pair (`0:0`–`1:31`), rendered in the editor with the squiggle across both lines. Two controls bound the claim: a still-supported `org.springframework.context.ApplicationContextInitializer` key in the same file drew nothing, confirming the one-entry key map; and when four stray characters were typed into the flagged key and then reverted, the same document published an **empty** array and then the diagnostic again — an empty publish being reachable only *inside* the `ifPresent(…)`, which is the exact step two earlier rounds suspected. `~/.sts4/.symbolCache/practices-app-*` was moved aside for the run, so none of it is a cache replay. Gradle and other Boot generations remain untested for this diagnostic, and the `Option.ON` branch was not exercised separately from the `AUTO` default. Evidence: `tmp/lang-matching-20260726/evidence/` and `tmp/factories-project-20260726/evidence/`. |
| `jpa-query-properties` language support | `verified` | Verified 2026-07-20 on the same tuple, and the open question is now answered: **Spring keys this off the language id, not the filename.** `SimpleTextDocumentService.didOpen` builds the tracked document from `LanguageId.of(textDocument.getLanguageId())`, `CompositeLanguageServerComponents` dispatches through `componentsByLanguageId`, and `JpaQueryPropertiesLanguageServerComponents.getInterestingLanguages()` returns only `JPA_QUERY_PROPERTIES`; `BootLanguageServerBootApp$3.computeLanguage(URI)` — which does key off `/META-INF/jpa-named-queries.properties` — is consulted only for documents the editor never opened (the `codeAction` path for an untracked document). Routing the file as ordinary `Properties` therefore degraded it silently. A `languages/jpa-query-properties` language now claims the full filename (`path_suffixes = ["jpa-named-queries.properties"]`) on the same pinned grammar and maps to the `jpa-query-properties` id. Two Zed behaviours were open risks and both resolved favourably: a dotted full filename does match `path_suffixes`, and the more specific language wins over the Properties language that claims the `properties` extension. Driven proof of the outcome, not just the routing: Spring returned `JPQL_SYNTAX` / `"JPQL: missing FROM at 'Greeting'"` (source `vscode-spring-boot`) on the fixture's deliberately broken named query — a reconciler that only runs for the JPA component set. Evidence: `tmp/ws1-close-20260720/evidence/trace-jpa.log`. **Also verified on Zed 1.12.0, and the 2026-07-26 regression signal is withdrawn.** The Java-reconciler run saw this file open as the official Java extension's `Properties` language on Zed 1.12.0, so Spring validated a named-query key as a Boot configuration property and answered `PROP_UNKNOWN_PROPERTY` — the actively-wrong form of the fault, worse than a missing feature. The cause was a stale extension index carried by a copied warm profile, explained in full in the `spring-factories` row above; no Zed behaviour changed. A/B in one run dir on Zed 1.12.0 reproduced both sides: with the copied index in place this file opened as `spring-boot-properties` and the deliberately broken named query drew nothing; after deleting `extensions/index.json` and nothing else it opened as `"languageId":"jpa-query-properties"` and Spring published `JPQL_SYNTAX` / `"JPQL: missing FROM at 'Greeting'"` at that query, the JPA component set again. The claim therefore covers Zed 1.11.3 and 1.12.0. Evidence: `tmp/lang-matching-20260726/evidence/`. |
| Completion prefix elision | `not-pursued` | Setting `boot-java.properties.completions.elide-prefix` (VS Code default `false`). It does not change *which* keys are proposed, only the completion item's insert text and replace range: with it on, a candidate under an already-typed prefix (e.g. `server.` → `server.port`) is inserted as just the elided tail (`port`) rather than the full key. Because VS Code defaults it off, the extension is already at parity without it, so this is not a one-line flag — turning it on alters the server's text-edit range, whose interaction with Zed's completion application (insert-text vs. replace-range handling, risk of duplicate-prefix insertion like `server.server.port`) is unverified, and the value is not user-toggleable through Zed settings. Not pursued: the default-behavior parity is already met, so there is no gap to close; should elision-when-enabled ever be wanted, it would first need its own driven verification of Zed's text-edit application before shipping. |

## Workstream 2 — symbols, navigation, and Boot project discovery

| Capability | State | Notes |
| --- | --- | --- |
| Document symbols | `zed-native-equivalent` | S015 Refuted the preferred LSP Outline route on the tested tuple. With `languages.Java.document_symbols: on` after both servers were ready, Zed merged package/type/method plus nested Spring component/bean/endpoint results with no exact duplicate labels; navigation and saved-edit refresh worked. After restart, however, Spring answered before JDT dynamically registered Document Symbols, and Zed cached a Spring-only Outline that omitted ordinary Java symbols until another source edit forced recollection. The setting was restored to `off`; verified Project Symbols remains the supported fallback and the verified opt-in Structure-document companion now supplies stable Spring grouping. Evidence: `tmp/s015-document-symbols-20260718/evidence/`; earlier tree-sitter control: `tmp/ws2-symbols-run2-20260718/`. |
| Workspace symbols (Spring symbols) | `verified` | Observed 2026-07-18. Zed's "Go to Symbol in Project" issued `workspace/symbol`; the Spring server (through the coordinator) returned the logical structure — `@+ 'greetingController' (@RestController <: @Controller, @Component)`, `@+ 'greetingPrefix' (@Bean) String`, `@+ 'greetingConfiguration' (@Configuration)`, `@+ 'fixtureApplication' (@SpringBootApplication)`, and `@/greeting -- GET` — each with a resolved location in the fixture. jdtls returned 0 for the `@`-prefixed queries, so the symbols are attributable to Spring. Evidence: `tmp/ws2-symbols-run2-20260718/`. |
| Request mapping navigation | `verified` | Observed 2026-07-18. `@/greeting -- GET` (kind 6) is returned by `workspace/symbol` as a navigable workspace symbol resolved to `GreetingController.java`, so Zed's symbol picker jumps to the mapping. |
| Bean navigation | `verified` | Observed 2026-07-18. `@+ 'greetingPrefix' (@Bean)` and the `@Component`/`@Configuration` symbols are returned by `workspace/symbol` with resolved locations, navigable from Zed's symbol picker. |
| Static Spring CodeLens | `verified` | Verified 2026-07-19 on macOS arm64/JDK 25 with Zed 1.11.3, official Java 6.8.21, and Spring Tools 5.2.0. Spring's five standard providers cover functional-handler summaries, web-configuration links, Data AOT query/implementation/refactor/refresh, AI-only explanation prompts, and AI-only functional-router conversion prompts. The coordinator preserves advertised server commands, translates valid source targets to Zed's location command, and retains informational/AI-only titles behind an explanatory command. `CL-4d` asynchronously executes Spring's authentic resolver outside the serialized Spring handler, captures its `window/showDocument` URI/range, caches it by source version/arguments, refreshes CodeLens, and rewrites the next lens to `editor.action.goToLocations`; a driven click opened the exact generated method while `/target/` remained ignored. AI notices explicitly say the extension cannot detect or invoke Agent and sends no source/prompt to AI. See the [CodeLens showcase](code-lens-showcase.md), [R018](research/018-spring-tools-zed-outcome-parity-audit.md), and [R019](research/019-zed-codelens-agent-navigation-and-build-output.md). |
| Live-data highlight CodeLens | `verified` | Verified 2026-07-19 on macOS arm64/JDK 25 with Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, and a connected Boot 3.5.5/JMX process. Unlike static providers, these arrive through custom versioned `sts/highlight`. Zed received coordinator-owned `workspace/codeLens/refresh`, requested standard CodeLens, and rendered authentic endpoint, bean and injection lenses alongside JDT reference lenses. Injection titles such as `← DefaultGreetingService` use the explanatory `sts.showHoverAtPosition` fallback: click selected the source range, the notice named native `editor::Hover`, and `cmd-k cmd-i` rendered Spring bean/type/resource/process data together with JDT hover. The dedicated `CL-7c` gate also passed: a commandless `@Value("${CODELENS_SAMPLE_LIMIT}")` range became `Spring live data — use Hover`, and native Hover returned `37` with source `systemEnvironment`; the value was not persistently exposed above source. The run also exposed `vscode-spring-boot.open.url`; it is retained as a visible URL and explanatory command instead of a silent no-op. Contract tests cover merge, refresh, commandless-range adaptation, stale-version rejection, command preservation and explanation. Remaining gates are a forced stale-response race and other desktop tuples. Evidence: `tmp/codelens-runtime-20260719.udLvyE/evidence/`, [R017](research/017-zed-codelens-hover-command-compatibility.md), and [R018](research/018-spring-tools-zed-outcome-parity-audit.md). |
| Inlay hints (including cron) | `verified` | Confirmed 2026-07-18 and re-verified 2026-07-19 on macOS arm64/JDK 25 with the development extension and unmodified Zed 1.11.3. A follow-up restart exposed a race hidden by the first gate: Spring could return an early empty result, later return `label: "every hour"`, and then transiently return empty again for the unchanged document, making the hint appear and disappear. The coordinator now remembers a bounded set of recent visible requests, pre-warms them after a completed non-empty `spring/index/updated`, refreshes Zed only after that pre-warm, and preserves the last non-empty range result until the document version changes or closes. The driven retry rendered `every hour` for `@Scheduled(cron = "0 0 * * * *")` after cold startup and retained it after switching between Java files. The earlier zero-request verdict was invalid: its fixture lived under this repository's ignored `tmp/` tree, and Zed deliberately removes ignored worktree entries in `Editor::is_lsp_relevant` before collecting visible inlay-hint ranges. A single **Toggle Inlay Hints** invocation was also not a force-enable diagnostic: Zed computes `Toggle(!self.inlay_hints_enabled())`, so it disables an already-enabled buffer. A separate generic Zed issue remains for servers such as jdtls that dynamically register `textDocument/inlayHint` without requesting a refresh; it is not a blocker for Spring cron hints because the coordinator owns the Spring LSP connection and refresh lifecycle. Runtime traces: `tmp/inlay-fix-runtime-20260718/stock-zed-index-refresh.log` and `tmp/inlay-fix-runtime-20260718/patched-clean-zed.log`; non-ignored fixture: `/tmp/zed-spring-inlay-fixture.aTcams`. |
| Code actions / quick fixes | `verified` | Observed end to end on 2026-07-18 with macOS 26.5.1 arm64, Temurin JDK 25.0.3, official Java 6.8.21, the development extension, and unmodified Zed 1.11.3. Spring initially advertises `sts.vscode-spring-boot.codeAction`, but enabling its classpath listener dynamically registers one internal `sts4.classpath.<letters>` command. Zed 1.11.3 replaces rather than extends the static `executeCommandProvider` command list for that registration, so it received Spring quickfix responses but filtered them out of the menu as unavailable commands. The coordinator already owns and relays that exact callback without Zed, so it now consumes the callback's registration and unregistration, preserving Spring's static command list. After rebuilding, Zed's standard code-action menu displayed `Remove 'public' from @Bean method`; selecting it emitted `workspace/executeCommand`, Spring returned `workspace/applyEdit`, the saved disposable fixture lost `public`, and `mvn test` passed. The property diagnostic also returned `Create metadata for 'ser'`, but that separate action was not executed. Evidence: `tmp/cav-verify-20260718/evidence/stock-fixed2-foreground.log` and `quick-fix-picker-fixed2.png`. |
| References and implementations | `verified` | The official Java JDT server advertises `referencesProvider` and `implementationProvider`; the coordinator does not interpose on either. Driven run 2026-07-18: on `GreetingService`, "Go to Implementation" issued `textDocument/implementation` and returned `DefaultGreetingService`; "Find All References" issued `textDocument/references` and returned 4 cross-file locations (the declaration, the `implements` clause, and two javadoc `{@link}` references). Both are gesture-triggered standard LSP served directly by the official Java extension. Evidence: `tmp/refs-impl-capture-20260718/evidence/`. |
| Source authorship and change history | `zed-native-equivalent` | This is not a Spring Boot Tools capability. Zed provides current-line inline blame, Git gutter/change indicators, a Git panel, clickable commit references and hosted permalinks. No Spring/JDT duplication is planned. |
| Spring-specific references | `verified` | Verified 2026-07-22 on macOS arm64/JDK 25.0.3, Zed 1.11.3, official Java 6.8.21, and Spring Tools 5.2.0. S018 established that Zed fans out `textDocument/references` to both the Spring coordinator and jdtls and unions their results. U4 drove three distinct Spring providers: `@Qualifier("greetingPrefix")`→`@Bean`, `@Value("${fixture.greeting.salutation}")`→`application.properties`, and a disposable `@Named("namedGreeting")` injection→`@Named` bean declaration. Each Spring-only target appeared in Zed's composed References result alongside jdtls output. No coordinator merge code is needed. Profile- and application-event-specific result content remains undriven and is recorded as residual uncertainty rather than evidence for this route. Evidence: `tmp/u4-refs-20260722/evidence/` and [S018](spikes/018-references-highlights-multiserver-composition.md). |
| Spring-specific document highlights | `blocked-zed-api` | Spring's WebFlux-route and embedded-query document highlights cannot reach stock Zed's Java buffer: S018 observed steady-state `textDocument/documentHighlight` requests going only to the primary jdtls server, never to the Spring coordinator. Do not add coordinator merge code. Reopen if Zed aggregates document highlights across language servers in a future release; ordinary jdtls highlights remain available. |
| Spring-aware Java completion | `verified` | Verified 2026-07-21 on macOS 26.5.x arm64, Zed 1.11.3, official Java 6.8.23, Temurin JDK 25.0.3, Spring Tools 5.2.0. Spring dynamically registers Java completion with every letter plus `.`/`(`/`@` as trigger characters (`documentSelector: [{language: java}]`), so ordinary typing reaches it; the driven run used explicit `editor::ShowCompletions` so no gesture mutated the buffer. Six representative families were observed returning real, index- or classpath-backed results, each alongside an independent jdtls response for the same position — the two servers compose in Zed's menu rather than one replacing the other: `@Value` → 1836 property keys including the fixture's own `fixture.greeting.salutation` from generated metadata; `@Qualifier` → 10 indexed bean names; `@Scope` → the 7 scope names; `@Profile` → `dev`, the only profile the index knows; repository body → `findBy`/`countBy`/… prefixes plus entity-derived `findById(Long id)` and `findByMessage(String message)`; and bean injection → 7 injectable beans, correctly excluding the two `String` beans whose type is already a field and the declaring bean itself. **`boot-java.java.completions.inject-bean` was a live parity gap**: `BootJavaConfig.isBeanInjectionCompletionEnabled()` is `Boolean.TRUE.equals(b)`, so an absent key reads false while VS Code's schema defaults it true, and `BeanCompletionProvider` returned nothing. The extension now sends it (`spring_default_configuration`), and an A/B on the identical caret position closed the gate: default → 7 Spring items, user override `inject-bean: false` → 0 Spring items with jdtls's 17 unchanged. An audit of every VS Code boolean defaulting true against its `BootJavaConfig` getter found no other gap in this path. Bean injection also requires the caret to resolve to a `SimpleName`/`Block`/`FieldAccess`/`ThisExpression` inside a method body of a `@Component` type; a caret on the `return` keyword yields a `ReturnStatement` and the provider bails, which is upstream behaviour and not a Zed limitation. Evidence: `tmp/ws2-language-intelligence-20260721/evidence/`. |
| Spring Java request-mapping templates | `verified` | Verified 2026-07-21 on the same tuple. All four templates `JavaSnippetManager` contributes — `@RequestMapping(..) {..}`, `@GetMapping(..) {..}`, `@PostMapping(..) {..}`, `@PutMapping(..) {..}` — were returned at class-body root level in the `@RestController` fixture as `insertTextFormat: 2` items, composed with jdtls's 30 ordinary Java proposals. The row's three open questions are all answered. *Placeholders*: the resolved `newText` carries Spring's tab stops intact, e.g. `@GetMapping("${1:path}")\npublic ${2:String} ${3:getMethodName}(@RequestParam ${4:String} ${5:param})`. *Imports*: they arrive through `completionItem/resolve`, which Zed does issue, as `additionalTextEdits` inserting after the last existing import — and they are deduplicated against the file, so `@GetMapping` added only `RequestParam` while `@PutMapping` added all three of its imports. *Controller context*: the negative control passed — the identical class-body-root gesture in `@Configuration` `GreetingConfiguration` returned zero Spring items, so `AnnotatedTypeDeclarationContext(Annotations.CONTROLLER)` is enforced through Zed and `@RestController` satisfies it by annotation hierarchy. Evidence: `tmp/ws2-language-intelligence-20260721/evidence/trace-snippets.log` and `slice-snippet-control.log`. |
| SpEL language intelligence | `verified` | Verified 2026-07-24 on macOS 26.5.x arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, Temurin JDK 25.0.3. The semantic-token half of this row stays settled and negative (see Embedded language syntax highlighting), so the delivered surfaces are diagnostics and navigation, both ordinary LSP needing no product code. *Diagnostics*: opening the fixture published all three, `severity: 1`, source `vscode-spring-boot` — `JAVA_SPEL_EXPRESSION_SYNTAX` / `"SPEL: mismatched input '<EOF>'…"` on `@Value("#{@greetingPrefix + }")`, `PROPERTY_PLACE_HOLDER_SYNTAX` / `"Place-Holder: extraneous input 'greeting'…"` on the nested `${…}` (a second grammar reached only through a **bare** placeholder, since a quoted one lexes as a SpEL string literal), and a third on `@EventListener(condition = "#event.")`, which proves the reconciler's reach beyond `@Value` — `AnnotationParamSpelExtractor.SPEL_EXTRACTORS` also covers `@Cacheable`/`@CacheEvict`, the four Security `@Pre*`/`@Post*` annotations, `@ConditionalOnExpression` and `@Scheduled` cron. No settings gap: `boot-java.validation.spel.on` is a `ProblemCategory.Toggle` whose absent-key path returns its own `ON` default, matching VS Code's schema, so the extension sends nothing. *Navigation*: `SpelDefinitionProvider` resolves only `@Value`, and Go to Definition returned both of its shapes — a bean reference `#{@greetingPrefix}` to the `@Bean` declaration and a method reference `#{@defaultGreetingService.greeting()}` to the method declaration in that bean's own source. **This also settles `textDocument/definition` on the S018 composition question, favourably**: each gesture produced two outgoing requests for one position, the other server answered `[]`, and Zed opened Spring's target — matching `LspStore::definitions`, which fans out through `request_multiple_lsp_locally` and flattens, as `references` does and unlike single-primary `documentHighlight`. Contextual SpEL hover is not a separate provider in the pinned release. Evidence: `tmp/spel-runtime-20260724/evidence/`. Do not conflate working language intelligence with the VS Code Copilot command. |
| Spring Data query intelligence | `verified` | Verified 2026-07-24 on macOS 26.5.x arm64, Zed 1.11.3, official Java 6.8.21 (jdtls 1.60.0), Spring Tools 5.2.0, Temurin JDK 25.0.3, against the Boot 3.5.5 fixture. The row needed no product code: `boot-java.jpql` was already sent (`spring_workspace_configuration`), and the audit found no second gap — `boot-java.validation.data-query` is a `ProblemCategory.Toggle` whose absent-key path returns its own `ON` default, matching VS Code's schema, and `boot-java.java.codelens-over-query-methods` is already supplied. *Diagnostics*: which grammar runs is decided by project dependencies, not by the annotation — `QueryJdtAstReconciler` picks HQL when `hibernate-core` is present (so this fixture reports `HQL_SYNTAX`, not `JPQL_SYNTAX`) and routes a native query to MySQL for a MySQL/MariaDB driver or PostgreSQL for PostgreSQL **or H2**. All three fired, `severity: 1`, source `vscode-spring-boot`: `HQL_SYNTAX` on `@Query("select g from Greeting g where")`, `SQL_SYNTAX`/`"PostgreSQL: mismatched input '<EOF>'…"` on the `nativeQuery = true` form, and a third `HQL_SYNTAX` on a bare `entityManager.createQuery(…)` — the reconciler also visits `MethodInvocation`, so its reach extends past `@Query` the way the SpEL reconciler reaches past `@Value`. *Navigation*: `DataQueryParameterDefinitionProvider` resolved both parameter shapes to the method's own parameter — `?1` → `message` through `findParameter`'s ordinal branch and `:message` → `message` through its identifier branch — each with the two-server fan-out and a jdtls `[]`, the composition pattern already settled for `definition`. *Completion*: a caret inside `findByMessageAndId`, just after `findByMessageAnd`, returned 12 Spring `CompletionItemKind.Property` items — the domain properties plus the predicate keywords legal at that point (`And`, `Or`, `OrderBy`, `Not`, `IsNot`, `IgnoreCase`, …) — against 2 ordinary jdtls identifier completions, because `DataRepositoryCompletionProcessor` takes the line text up to the caret and re-parses it as a partial query method name. The positional-parameter inlay hint (`?1` → `message`, `JdtDataQueriesInlayHintsProvider`) was verified separately on 2026-07-19; see [codelens-inlay-parity](codelens-inlay-parity.md) §5. Named queries in `META-INF/jpa-named-queries.properties` have their own verified row, and AOT query display, implementation navigation and the `Turn into @Query` refactoring are the verified `CL-4` lenses. **Residual limits, recorded rather than smoothed over.** (1) The *first* reconcile after a cold start published only two of the three problems: an upstream `NullPointerException` (a closed `ZipFile` inside `AnnotationHierarchies.getDirectSuperAnnotationBindings`, reached from `JdtQueryVisitorUtils.isQueryJdbcAnnotation`) aborted `cu.accept` partway through the file, and nothing in this extension is on that stack. Any re-reconcile — a byte-identical rewrite sufficed — published all three, so this is a transient truncation, not a missing capability; the recovery gesture is any edit. (2) `QueryMethodCodeActionProvider`'s `Add @Query` code action is a second entry point to the `CL-4` refactoring and needs Spring Data JPA ≥ 4 / MongoDB ≥ 5 / JDBC ≥ 4, so it cannot appear on this Boot 3.5.5 fixture; `boot-java.code-action.data-query-multiline`, which formats that generated annotation as a text block, is VS Code default `false` and stays user-settable through the settings passthrough. (3) Only the PostgreSQL/H2 SQL branch ran; the MySQL/MariaDB branch is untested. Embedded query semantic tokens and query-parameter document highlights remain `blocked-zed-api` in their own rows. Evidence: `tmp/data-query-runtime-20260724/evidence/`. |
| Cron completion and validation | `verified` | Verified 2026-07-21 on the same tuple; cron inlay hints were already verified separately. *Completion*: a caret inside the existing `@Scheduled(cron = "0 0 * * * *")` returned 24 proposals from `CronExpressionCompletionProvider` (`0 0 * * * *`, `0 */5 * * * *`, `0 0 0 * * SAT,SUN`, `0 0 0 ? * MON#1`, …) while jdtls returned zero for the same position, so the result is Spring-attributed. *Validation*: `JdtCronReconciler` published `severity: 1`, `code: SYNTAX`, `source: vscode-spring-boot`, message `CRON: mismatched input '<EOF>' expecting WS` on the fixture's deliberate five-field expression, with the valid six-field expression in `GreetingSchedule` publishing an empty diagnostic list as the control. The reconciler visits any `NormalAnnotation` carrying a cron attribute rather than the registered bean set, which is why the broken expression can live on an unregistered class and leave the fixture bootable. Embedded cron semantic highlighting is **not** part of this row — see the **Embedded language syntax highlighting** row, which records why no semantic-token route exists on this tuple. Evidence: `tmp/ws2-language-intelligence-20260721/evidence/trace-cron-completion.log`. |
| Boot project info | `verified` | Verified 2026-07-26 on macOS 26.5.x arm64, Zed 1.12.0, official Java 6.8.23, Spring Tools 5.2.0, against a four-module Maven fixture pinning Boot 4.0.6 / 3.5.5 / 3.3.5 / 2.7.18 in one worktree. The workspace-wide half was already `verified` separately: the synthetic `zed-spring-tools.configure-boot-run` Code Action consumes `sts/spring-boot/executableBootProjects` records to generate reviewable run/debug configuration, and the 2026-07-19 driven run confirmed the real `mainClass` reached the generated `.zed/debug.json`. This row is the **per-file** half, which had only ever been advertised and forwarded. `sts/spring-boot/bootProjectInfo` has **no caller in the pinned VS Code client** — `grep -ra` over the whole extension matches only Spring's own `WorkspaceBootExecutableProjects` — so the contract was read from that class rather than mirrored from upstream UI: it takes `arguments[0]` as a **bare string** document URI (`getAsString()` into a `TextDocumentIdentifier`, not the object wrapper `executableBootProjects` callers use) and answers `BootProjectInfo {name, uri, mainClass, buildTool, springBootVersion, javaVersion}`, where `mainClass` is the type of the project's `@SpringBootApplication` bean. Three of those fields — `buildTool`, `springBootVersion`, `javaVersion` — appear in no other Spring result this extension consumes, which is why this earns its own `source` Code Action instead of folding into the run/debug flow. *Observed*: on `boot-3-5-5`, `This file belongs to project boot-3-5-5 — main class dev.zed.spring.OssEndedApplication · maven build · Spring Boot 3.5.5 · Java 21.0.11 · at boot-3-5-5`; the same action on `boot-2-7-18` and `boot-4-0-6` resolved each module's own record and Boot version, so per-file resolution is real and not a workspace-wide answer. `javaVersion` reports the project classpath's JRE (21.0.11), not the profile's jdtls `java_home` (25.0.3-tem). The notice is a `window/showMessageRequest` with one dismissal action rather than a toast, because a `window/showMessage` auto-dismisses in Zed and several fields are meant to be read off the screen. **Two findings the driven run corrected.** (1) A field Spring cannot resolve is omitted, not rendered as "unknown": `boot-2-7-18` returned no `javaVersion` and its notice carries no `Java` clause. (2) An *unresolved* project does **not** produce the `null` this row first assumed — `getBootProjectInfo` hands the `orElse(null)` project straight to `mapToBootProjectInfo`, which dereferences it, so Spring throws. The first build reported that as `Spring Tools rejected an internal callback`, the coordinator's fixed string for every Spring error, which both misdescribed the failure and discarded the server's own message. `#settlePending` now carries Spring's bounded error text alongside the unchanged generic message, and the action treats a Spring error as the same user situation as `null`, appending what the server actually said. `null` therefore remains reachable only for a resolved project with no `@SpringBootApplication` bean or a record the server could not build. **Not covered**: Gradle (`buildTool` was `maven` throughout), the `null` return itself (every absence observed came through the error path; contract tests cover its rendering), and desktop tuples other than macOS arm64. Evidence: `tmp/boot-project-info-20260726/evidence/`. |
| Executable Boot projects discovery | `verified` | A synthetic `source` Code Action on Java files invokes `sts/spring-boot/executableBootProjects` (its `sts/project/gav` callback routes through the official Java transport), presents a bounded `window/showMessageRequest` selection (single project skips the prompt; `All projects` covers overflow beyond eight), and generates merge-safe `.zed/tasks.json`/`.zed/debug.json`. Driven first on 2026-07-19 (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25, fixture `spring-boot-basic`): the LSP trace showed the injected action, the user-selected command produced correct `.zed/tasks.json`/`.zed/debug.json` for the discovered project, and the confirmation notice reported one entry each. The 2026-07-22 Maven multi-project gate on macOS 26.5.2 then returned `service-a` and `service-b`, displayed both plus `All projects`, and generated one task/debug pair for each selected module with the correct worktree-relative `cwd`. Evidence: `tmp/run-debug-gates-20260722/evidence/`. |
| Spring XML config support | `verified` | XML already reaches the server via the `xml` language id (the pom inlay route). The master switch `boot-java.support-spring-xml-config.on` is genuinely opt-in — false-when-absent on the server (`isSpringXMLSupportEnabled`) and in VS Code's schema — so it is not defaulted on. The extension supplies the three sub-settings that read off/empty when absent while VS Code defaults them on: `content-assist` and `hyperlinks` (`enabled != null && …`, schema `true`) and `scan-folders` (empty folder list when absent, schema `"src/main"`), so a user who sets `on: true` gets a functional feature instead of an inert one. Contract-tested in `src/lib.rs`. Driven on 2026-07-22 (macOS arm64, Zed 1.11.3, jdtls 1.60.0, JDK 25, sweetppro/zed-xml): with only `on: true` set by the user, the `didChangeConfiguration` trace carried all four keys, `beans.xml` opened with `languageId: xml`, and every gate fired — SpEL reconcile diagnostic (`JAVA_SPEL_EXPRESSION_SYNTAX`, proves `on`), 1 XML file scanned / 1 bean symbol indexed (proves `scan-folders`), `class=`/property-name completion (proves `content-assist`), and property→`Greeting.java` definition (proves `hyperlinks`). A failing reconciler is disabled independently rather than weakening other Spring features. Evidence: `tmp/xml-config-driven-20260722/evidence/`. |

## Workstream 3 — live application data

| Capability | State | Notes |
| --- | --- | --- |
| Connect / disconnect to a local Boot process | `verified` | A synthetic `source` Code Action on Java files (**Spring Boot: Connect or disconnect live process data…**) runs `sts/livedata/listProcesses` and renders the returned descriptors — Spring already labels each and tags it with the exact `action` (`connect` for an available process, `disconnect`/`refresh` for a connected one) — as a bounded `window/showMessageRequest` choice (capped at 12 with an overflow notice; nothing happens until the user chooses). The chosen action executes with `[{processKey}]`. **A static read closed the same silent-gap trap as the shared-metadata reload**: `SpringProcessCommandHandler.connect/disconnect/refresh` each `return CompletableFuture.completedFuture(null)` regardless of outcome, so a null result is not evidence of success. The authoritative connect signal is instead the server→client `sts/liveprocess/connected` notification, which `SpringProcessLiveDataProvider.add` fires exactly once after the process is reached and its first live data is stored; the coordinator registers a per-`processKey` waiter before issuing connect and only reports "Connected …" when that notification arrives, otherwise a bounded "Requested … make sure the process exposes Actuator/JMX" (never a false success). Coordinator-owned identity/cleanup: it tracks connected keys from the connected/disconnected notifications (still forwarding both to Zed) and clears the map plus any pending waiter on shutdown. Contract-tested in `coordinator/test/coordinator.test.mjs` (confirmed connect, unconfirmed-connect bounded report, disconnect, empty list, dismissed prompt). **Driven 2026-07-23** on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, JDK 25.0.3 and Boot 3.5.5: the bounded choice listed the fixture after the extension supplied Spring's false-when-absent `boot-java.live-information.all-local-java-processes: true`; selecting it opened JMX, stored the first Actuator live-data result, emitted `sts/liveprocess/connected`, showed the confirmed success notice and refreshed CodeLens. Running the action again exposed `Refresh` and `Disconnect`; selecting `Disconnect` emitted `sts/liveprocess/disconnected`, closed JMX, refreshed CodeLens and showed the disconnect notice. The fixture enabled JMX and exposed its Actuator JMX endpoints; without that exposure the coordinator correctly avoided false success. The opt-in Live document remains the fallback presentation only if the bounded prompt cannot hold the list; no reduced connection mode is claimed. Evidence: `tmp/live-process-connect-runtime-20260723/evidence/`. |
| Remote connect | `verified` | **The recorded "Code Action calls `sts/livedata/remoteConnect`" route was wrong on parity grounds and is not taken.** A source read of the pinned release shows no VS Code code path calls that command at all — it is Eclipse Boot Dash's route, and it is a declarative set replacement (`[owner, RemoteBootAppData[]]`, empty array removes that owner's apps), not an imperative connect. VS Code delivers remote connect entirely through the `boot-java.remote-apps` settings array, which `remoteAppsFromSettingsConnector` hands to `SpringProcessConnectorRemote.updateApps`; entries default `manualConnect` false, so declaring one is itself the connect. The extension's existing user-settings passthrough already carries that array to the server unchanged, so the outcome needs no new command — a Rust test pins the array, its element fields, and its absent-by-default state (shipping an empty array of our own would be indistinguishable from a user clearing theirs). Declared targets then surface as ordinary `connect` entries in the already-`verified` **Spring Boot: Connect or disconnect live process data…** action, and connected ones in the Live data document. **The credential gate resolved differently than assumed**: `RemoteBootAppData` has no credential field at all (`jmxurl`, `host`, `urlScheme`, `port`, `manualConnect`, `keepChecking`, `processId`, `processName`, `projectName`), so there is nothing for this extension to prompt for or store; credentials can only ride inside the user's own `jmxurl`. Because Spring derives both the process key (`getProcessKey` returns the raw `jmxurl`) and the fallback label (`getProcessName` → `"remote process - " + jmxurl` when neither `processName` nor `host` is set) from that URL, the coordinator strips URL userinfo from every rendered label before it reaches a prompt, a notice, or `.zed/spring-live.md`; host and port survive so the target stays identifiable. Redaction is presentation-only — the unredacted key and `processName` still round-trip to Spring verbatim inside command arguments, so an altered value can never break the server's own lookup. Contract tests cover the redacted prompt/notice with a raw key on the wire and a credential-free generated document. **Driven 2026-07-24** on macOS 26.5.2 arm64 with Spring Tools 5.2.0 (`spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar`), Temurin JDK 25.0.3 and a Boot 3.5.5 fixture exposing `env`/`beans`/`mappings`/`loggers`/`conditions` over HTTP Actuator: a single `workspace/didChangeConfiguration` carrying one `remote-apps` entry was the whole connect gesture. The server published `sts/liveprocess/connected` with `type: "remote"` and `processKey` equal to the declared `jmxurl`, `listConnected` returned that target, `listProcesses` offered refresh/disconnect for it, and `getLoggers` returned 860 authentic loggers from the running fixture. Clearing the array to `[]` published `sts/liveprocess/disconnected`, confirming the documented set-replacement semantics. A second run with `http://gateuser:gatesecret@localhost:8080/actuator` connected identically and proved the exposure is real: the server's own label came back as `remote process - http://gateuser:gatesecret@localhost:8080/actuator (pid: ******)`. Replaying that authentic payload through the real coordinator rendered `Refresh — remote process - http://<credentials redacted>@localhost:8080/actuator (pid: ******)`, with neither username nor password present and `localhost:8080` retained. **A second gate then drove the full path through real Zed** on the same date and tuple (Zed 1.11.3, official Java 6.8.21, isolated `--user-data-dir` profile): opening a Java file sent `workspace/didChangeConfiguration` carrying the user's `remote-apps` entry merged with the product defaults, Spring logged `Creating RemoteStringBootApp: RemoteBootAppData [jmxurl=http://localhost:8080/actuator, host=null, …]` followed by `connect to process: http://localhost:8080/actuator`, published `sts/liveprocess/connected` with `type: "remote"` and the URL as `processKey`, and the editor then rendered Spring hover reading ``Process [PID=******, name=`remote process - http://localhost:8080/actuator`]``. This closes the extension-to-server delivery half in the real client rather than by inference. **Remaining scope limits, stated exactly:** the target was a real Boot application reached through Spring's remote connector but hosted on localhost, not a physically remote host; and only the `http` branch was exercised — the `service:jmx:rmi://` branch of `connectProcess` remains untested. Evidence: `tmp/live-remote-apps-runtime-20260724/evidence/` (`isolated-zed-run.log` for the real-Zed chain). |
| Live hover data | `zed-native-equivalent` | Source-local live bean and injection facts are verified through live CodeLens followed by Zed's native Hover gesture. The connected run rendered Spring bean name, type, resource, bean id and process together with JDT hover. One-click dispatch remains blocked by Zed's client-command bridge. Explicit process show/hide/refresh is a separate `zed-native-equivalent`; aggregate metrics and logger aggregation/level changes are separate `verified` capabilities. |
| Show / hide / refresh live data | `zed-native-equivalent` | The pinned VS Code commands are thin active-debug-app wrappers around Spring's `sts/livedata/connect`, `disconnect`, and `refresh`; they add no separate server capability. Zed's **Spring Boot: Connect or disconnect live process data…** Code Action delivers the outcome through an explicit bounded process/action choice using Spring's own `listProcesses` descriptors. Contract tests cover connect, refresh, and disconnect; the 2026-07-23 Boot 3.5.5/JMX gate connected, exposed refresh/disconnect, refreshed live CodeLens, and disconnected with JMX cleanup. Zed does not infer an “active” debug app; automatic local connection is a separately verified default-off opt-in, and remote connection remains planned. |
| Metrics | `verified` | A synthetic Java-file source Code Action (**Spring Boot: Generate or refresh Live data document…**) first runs `sts/livedata/listConnected`; one connected process skips the prompt, while multiple processes use a bounded 12-item `window/showMessageRequest` and dismissal writes nothing. For the chosen opaque `processKey`, the coordinator explicitly refreshes `memory` and `gcPauses` with `tags: ""` (the pinned JMX extractor otherwise concatenates a literal `null,id:…` filter), then reads the server's `heapMemory`, `nonHeapMemory`, and `gcPauses` models into the owned, timestamped `.zed/spring-live.md`. The file shows finite measurements only, caps output at 64 models and 16 measurements per model, omits `availableTags` and the opaque key, preserves foreign/in-flight targets, and is regenerable/deletable without `.gitignore` mutation. The contract is sourced from `SpringProcessCommandHandler`, `SpringProcessConnectorService`, `SpringProcessLiveDataExtractorOverJMX`, `LiveMemoryMetricsModel`, and `Measurements` at pinned Spring Tools commit `18d1a975dbea4f9314fd736d0237bd9e23f243f9`; coordinator tests cover command order, redaction, bounds, empty/dismissed selection, and ownership. **Driven 2026-07-23** on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, Temurin JDK 25.0.3 and a connected Boot 3.5.5/JMX fixture: the first snapshot contained 12 authentic heap/non-heap measurements and an explicit empty GC family; Zed rendered its Markdown preview; explicit refresh changed the timestamp, file hash and values and added a real GC pause for 15 measurements; moving the owned file away and rerunning the action recreated it with a third timestamp/hash. The snapshots persisted no metric tags or opaque process-key field. Evidence: `tmp/live-metrics-runtime-20260723/evidence/`. |
| Loggers and log levels | `verified` | The opt-in `.zed/spring-live.md` appends a bounded, sorted read-only logger snapshot from `sts/livedata/getLoggers` without persisting the opaque process key; missing logger exposure does not discard verified metrics. A separate Java-file source action changes a level through bounded prompts: connected process, ten-at-a-time logger pages (up to 512), a level from Spring's advertised list, then a final confirmation. It calls the pinned `sts/livedata/configure/logLevel` argument contract and treats its immediate `null` only as acceptance; success requires a matching `sts/liveprocess/loglevel/updated` process/logger/level tuple. Mismatched notification, timeout, disconnect, or dismissal produces no false success. Logger names and levels used for mutation are never trimmed/truncated; invalid identifiers are omitted. The external Actuator endpoint remains the fallback for omitted entries. **Driven 2026-07-23** on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, Temurin JDK 25.0.3 and Boot 3.5.5/JMX: 861 authentic loggers produced an exact 512-entry bounded document and rendered in Zed; the confirmed `ROOT` `INFO -> DEBUG` action received the matching update before success, a refresh showed effective/configured `DEBUG`, and the same verified path restored `INFO`. Evidence: `tmp/live-loggers-runtime-20260723/evidence/`. |
| Automatic connection | `verified` | Opt-in only through `boot-java.live-information.automatic-connection.on: true`; absent/false stays off. Generated Java debug entries receive reviewable local JMX/Actuator exposure and `spring.boot.project.name` properties for safe project identity. The coordinator serially polls Spring's local Attach descriptors, reconciles `projectName` against authentic executable Boot projects, and reuses the verified `sts/liveprocess/connected` confirmation path only for exactly one matching process. Unnamed/unrelated JVMs, unsafe generated names, duplicate matching runs, and repeated attempts do not connect. Contract-tested and driven on 2026-07-23 with macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, Temurin 25.0.3, and Boot 3.5.5: the generated debug entry automatically connected authentic live data, manual disconnect prevented reconnection across later polls, debug stop terminated the fixture, and isolated-Zed exit left no owned process. Evidence: `tmp/live-auto-connect-runtime-20260723/evidence/`. |

## Workstream 4 — structure view, run/debug, tasks

| Capability | State | Notes |
| --- | --- | --- |
| Browse / navigate the Spring logical structure | `zed-native-equivalent` | Zed's Project Symbols returns and navigates beans, the request-mapping endpoint, and component/configuration/application stereotypes, so it remains the supported equivalent. S015 Refuted the preferred per-file LSP Outline because restart can omit Java symbols. The explicitly requested, regenerable Spring Structure document is now a verified grouping companion. Its Markdown links open the right source files, while Project Symbols remains the exact-location path because Zed 1.11.3 discards their `#L…` fragments. Evidence: `tmp/ws2-symbols-run2-20260718/`, `tmp/s015-document-symbols-20260718/evidence/`, and `tmp/structure-document-20260722-runtime/evidence/`. |
| Structure refresh / grouping | `verified` | A Java-file `source` Code Action runs `sts/spring-boot/structure` with `{updateMetadata:true}` and renders Spring's default project/group hierarchy to the opt-in `.zed/spring-structure.md`. It includes a visible snapshot/stale warning, only links `location`/`reference` file URIs inside the worktree, caps output at 2,000 nodes/16 levels, deterministically replaces only a file with its versioned ownership marker, recreates after deletion, and never edits `.gitignore`; an unknown target is preserved with a notice before Spring is called. Contract tests cover those rules. **Driven on 2026-07-22** (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25.0.3): Spring returned the authentic project and default groups, Markdown preview rendered them, a request-mapping link opened `GreetingController.java`, explicit refresh retained SHA-256 `006ad20227f9e4a09a6c230382bc9411d2e15b81ab02b721cea666c1cf8d97d1`, and moving the file away then rerunning recreated the same bytes while `.gitignore` remained absent. Zed discarded the `#L16` fragment when opening that link, matching its Markdown Preview implementation, so Project Symbols remains the exact-location fallback. Custom visibility selection via `structure/groups` remains a later enhancement. Evidence: `tmp/structure-document-20260722-runtime/evidence/`. |
| Run / debug a Boot application | `verified` | The configure Code Action generates merge-safe `.zed/tasks.json` (wrapper-aware `spring-boot:run`/`bootRun`, portable `$ZED_WORKTREE_ROOT`-relative `cwd`, editable `env`) and `.zed/debug.json` (`"adapter": "Java"` launch with `mainClass`, `cwd`, and editable `vmArgs`/`args`/`env`). One base entry plus one per discovered Spring profile (from `application-<profile>.*` filenames and multi-document `application.{yml,yaml}` activation), capped at eight with the overflow named. Merge safety: create when absent, replace only its own labelled entries in plain JSON, and sidecar (never clobber) a commented or non-array file. **Driven checks verified on 2026-07-19** (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25): the generated run task's exact `mvn spring-boot:run` launched the Boot app and served `GET /greeting` (HTTP 200); a second check generated `dev`/`prod`/`staging` entries and launched the `dev` Java debug configuration after editing `vmArgs`, `args`, and `env`. The 2026-07-22 macOS 26.5.2 Maven multi-project gate then displayed `service-a`, `service-b`, and `All projects`; selecting all generated two task and two debug entries with the correct module `cwd` values and ran nothing automatically. Official Java's loopback main-class resolver requires system HTTP proxies to bypass `localhost`/`127.0.0.1`; its isolated-profile DAP helper path remains an S016 caveat. Gradle interaction and every non-macOS-arm64 desktop tuple remain untested. No route overwrites unknown configuration or starts a debug session programmatically. Evidence: `tmp/run-debug-gates-20260722/evidence/`. |
| Maven goal / Gradle build | `verified` | Pinned source narrows this row to one reachable operation: `sts.maven.goal` is called only by the `CL-4a`/`CL-4e` Data AOT lenses with `[compile ]org.springframework.boot:spring-boot-maven-plugin:process-aot`; `sts.gradle.build` has no caller, and Spring exposes no arbitrary-goal route. An unmodified non-VS-Code client selects Spring's `DefaultBuildCommandProvider`, whose direct drive completed the AOT goal in 5,532 ms but emitted no log/message/progress, discarded Maven's own diagnostic on failure, and hung past 300 s on 120 KB of output because it waits without draining the child streams; the same terminal build finished in 5 s. The coordinator therefore intercepts both advertised commands, validates the build file/tool/goal tokens, and writes one wrapper-aware, worktree-relative `.zed/tasks.json` entry under a build-only label scope. It never starts the build, preserves foreign/run-debug entries, and retains the sidecar fallback for unparseable configuration. Contract tests cover interception, wrapper selection, replacement, scope isolation, declined unsafe inputs, and unreachable Gradle. **Driven 2026-07-24** on macOS 26.5.2 arm64, Zed 1.12.0, official Java 6.8.21, Spring Tools 5.2.0, and Temurin JDK 25.0.3: clicking `CL-4a` created the exact reviewable task; selecting it from `task: spawn` exposed Maven output and `BUILD SUCCESS`, then created the authentic 13,450-byte `target/spring-aot/main/resources/dev/zed/spring/codelens/CodeLensShowcaseRepository.json`. After reload, `CL-4e` rewrote the same task while the JSON timestamp stayed unchanged and no Maven process started. Evidence: `tmp/maven-goal-ownership-20260724/evidence/`. |
| Open Boot app page URL | `verified` | Verified 2026-07-25 on macOS 26.5.2 arm64, Zed 1.12.0, official Java 6.8.21, Spring Tools 5.2.0, Temurin JDK 25.0.3 against a connected Boot 3.5.5 fixture. **The row needed no product code.** A source read narrowed it to the request-mapping hover/CodeLens, whose URL Spring builds from the connected process's live data (`UrlUtil.createUrl(urlScheme, host, port, path, contextPath)` in `RequestMappingHoverProvider`). The hover link is branched on `LspClient.currentClient()`: VS Code/Theia get a `command:vscode-spring-boot.open.url?<url>` URI, but the **default client — ours — gets a plain `[http://host:port/path](…)` Markdown link** (`RequestMappingHoverProvider.java:302`), and Zed's hover renders Markdown and opens a clicked link through `open_url_or_file` (final-audit §25). The driven hover over `@GetMapping("/greeting")` returned exactly that plain link plus live metrics and the process descriptor, with no `command:` URI, rendered as a clickable link in the popover (composed above jdtls's own annotation doc); clicking a Zed-rendered link to the same address opened the system browser to the running app (`hello`), confirming the URL is valid and Zed opens `http` links. The live URL CodeLens over the mapping renders the same address once Zed's `"code_lens": "on"` setting and a live connection are present, and the coordinator's existing CodeLens handling already surfaces it (Zed autolinks the URL in the notice). A persistent-toast CodeLens companion (`window/showMessageRequest` with a clickable Markdown link and a dismissal action) was prototyped and driven end to end, then reverted: Zed's LSP notifications expose no control over dismissal timing or hover-to-persist — only an action button forces persistence — and the hover route already provides the hover-persistent clickable link, so the extra surface was not worth the added code. The one product change kept is a text edit: a language server cannot open a browser itself and Zed will not run the VS Code open-URL command from a lens, so the coordinator's existing CodeLens notice for that command now guides the user to hover the request mapping and click the link in the popover rather than dead-ending (contract-tested; the notice mechanism was already driven). One fixture-launch nuance is recorded rather than smoothed over: the port resolves only when the app runs with `spring.application.admin.enabled=true` (exactly what VS Code's own debug launcher adds and our generated auto-connect entries mirror); without it `getPort` falls back to the Boot 3.x actuator `env` endpoint, whose default value sanitization renders the port as `******`. Zed's general LSP client still does not advertise or handle `window/showDocument`, so copyable text remains the fallback, and OS-specific opener tasks remain an excluded contingency. Evidence: `tmp/open-app-url-runtime-20260725/evidence/`. |

## Workstream 5 — commands, upgrade, Modulith

| Capability | State | Notes |
| --- | --- | --- |
| Spring Boot upgrade | `verified` | Route taken with no product code for the upgrade itself: Spring's own version-validation quick fix executes `sts/upgrade/spring-boot`, and the server answers with a `workspace/applyEdit` for the build file. Driven 2026-07-25 on the macOS arm64 tuple: on a Maven project pinned to Boot 3.5.0 the quick fix `Upgrade to Spring Boot 3.5.16 (Maven dependency version changes only)` produced `applied:true`, a minimal `3.5.0`→`3.5.16` parent-version edit in the buffer, and `"success"`. Three constraints are upstream, not Zed: the command is **patch-only** (it asserts the same major/minor and rejects anything else), the major/minor "full OpenRewrite conversion" quick fixes are **never offered** because `getNearestAvailableMinorVersion` returns empty in the pinned release, and Gradle is rejected outright. The pom **inlay hint** carrying the same command renders but is inert — see the `blocked-zed-api` row below. The version-validation diagnostic anchors at the **first character of the build file**, so the quick fix is reached with the caret there. **The one product change is failure visibility.** Spring throws before editing anything when OpenRewrite finds no Maven settings file (`MavenSettings.readMavenSettingsFromDisk` returns null and the server dereferences it) — the default state for a machine without `~/.m2/settings.xml` — and Zed reports nothing for a failed `workspace/executeCommand`, so the upgrade silently did nothing. The coordinator now watches its own forwarded upgrade requests and turns a failure into a bounded `window/showMessage` error naming the target version, the fact that nothing was changed, and the settings-file remedy, never the Java stack trace, which stays in the log. Both halves were driven on 2026-07-25: with `~/.m2/settings.xml` absent the notice appeared and the build file was untouched; with a minimal `<settings/>` file present the same quick fix completed the edit above. Evidence: `tmp/upgrade-runtime-20260725/evidence/`. |
| Inlay-hint label commands (pom "Upgrade to the Latest Patch") | `blocked-zed-api` | Spring's `PomInlayHintHandler` attaches a `Command` to the inlay hint's label part, so in VS Code the hint text itself is the upgrade button. Driven 2026-07-25: the hint renders with the correct command and arguments (`sts/upgrade/spring-boot`, `["file:…", "3.5.16", false]`), but clicking it produces **no `workspace/executeCommand` at all** — stock Zed renders `InlayHintLabelPart.label` without executing its `command`. The hint therefore stays an accurate indicator that a newer patch exists, and the verified route to act on it is the version-validation quick fix at the top of the build file. No product workaround exists: label-part activation is client behaviour the extension cannot supply. |
| Modulith metadata refresh | `verified` | Verified 2026-07-26 on macOS 26.5 arm64, Zed 1.12.0, official Java 6.8.23 (jdtls), Spring Tools 5.2.0, Temurin JDK 25.0.3, Maven 3.9.15, against a three-module Maven fixture (two Spring Modulith 1.4.12 / Boot 3.5.5 apps plus one Boot app with no modulith dependency). `ModulithService` registers `sts/modulith/projects` and `sts/modulith/metadata/refresh` unconditionally, so the route does not depend on the tracking setting below. The **Spring Boot: Refresh Modulith metadata…** Code Action reproduces VS Code's `Refresh Modulith Metadata` command exactly: `sts/modulith/projects` (no arguments, answering `{projectName: locationUri}` already filtered by `isModulithDependentProject`), a bounded `window/showMessageRequest` when more than one project qualifies — skipped for a single project, as in VS Code — then `sts/modulith/metadata/refresh` with the chosen project's location URI. Driven: the action offered `inventory-app` and `orders-app` and correctly omitted the non-Modulith `plain-boot`; choosing `inventory-app` produced Spring's own `Project 'inventory-app' Modulith metadata has been changed.` The coordinator adds **no** notice of its own on success, because `ModulithService` reports every outcome through `window/showMessage` itself — an `Error` for a project without spring-modulith or without compiled classes, an `Info` stating whether the regenerated metadata differed — and only a transport-level failure produces a coordinator message. Metadata generation spawns `org.springframework.modulith.core.util.ApplicationModulesExporter` against the project's own classpath, so an uncompiled project is refused by the server with that first `Error`; `mvn compile` is a real prerequisite, not an artifact of the fixture. Gradle Modulith projects and the `orders-app` branch of the selection are untested. Evidence: `tmp/modulith-20260726/evidence/`. |
| Modulith projects | `verified` | Verified 2026-07-26 on the same tuple. No new surface was needed: `SpringIndexCommands` chooses `ModulithStructureView` over `JMoleculesStructureView` for any project that depends on `spring-modulith-core` (gated only by the JVM property `disable-modulith-structure-view`, which this product does not set), so the already-verified opt-in Structure document *is* the module/dependency grouping. Driven, it rendered each Modulith project's application modules with their named-interface exposure — `Catalog (c.e.i.catalog)` carrying `c.e.i.c.CatalogService (API)` and `c.e.i.c.internal.CatalogRepository (internal)` — while the non-Modulith `plain-boot` in the same worktree kept the ordinary package grouping, which is the control proving the switch is Modulith-specific. That `(API)`/`(internal)` split is the same exposure fact the `MODULITH_TYPE_REF_VIOLATION` reconciler enforces: with `boot-java.modulith-project-tracking` supplied, three Error-severity `Invalid reference to non-exposed type of module 'catalog'!` diagnostics published with no user action, on the import, the field and the constructor parameter that reach into `catalog.internal`, while the legal import of the exposed `CatalogService` was correctly not flagged. As with the Spring Data row, the first reconcile after a cold start published only one of the three and the settled reconcile published all three. **Residual limit:** the grouping comes from the Modulith metadata but the members come from the Spring index, so a project whose files have not been opened in the session renders as `<name> ()` with its modules listed and empty; opening one of its files and regenerating fills it in. Workspace Symbols were not separately re-exercised here — Spring symbol search has its own verified row. Evidence: `tmp/modulith-20260726/evidence/`. |
| Spring Initializr | `not-pursued` | **Decided 2026-07-29, out of scope rather than pending.** It is not in the pinned VSIX at all: a separate VS Code extension (`vscjava.vscode-spring-initializr`) owns project generation there, so it was never inside the parity target this project fixed as its goal, and there is no upstream Spring Tools behaviour here to mirror. Building it anyway would not be adaptation but a new product surface — outbound calls to `start.spring.io`, archive download and extraction into the user's filesystem, and a multi-step scaffolding UX — none of which the rest of this extension has, and each of which would have to be defended on its own. The user-facing outcome is already available and is not degraded by this decision: `start.spring.io` in a browser, or the `spring` CLI, produces the same project, and neither depends on the editor. This is recorded as a documented exception, not backlog; a future reversal would need its own network, artifact, scope, and privacy decision rather than a slice. |
| Explain SpEL / queries / AOP (AI assistant) | `blocked-zed-api` | **Decided 2026-07-29.** The row was `planned`, which implied intended future work; the blocker is a missing Zed surface, so it is now labelled as one. `query.explain` and `sts/enable/copilot/features` are VS Code Copilot-bound, and the pinned Spring server has no non-AI explanation command to fall back to — the lens text is generated locally and its action *is* the prompt. The exact missing surfaces: Zed's public extension and CodeLens APIs expose no authoritative Agent-state detection, and no way to dispatch to or prefill the Agent. Neither is a widget complaint that some other Zed workflow routes around, which is what would make this `zed-native-equivalent` instead: a user opening the Agent panel and asking their own question is the user delivering the outcome, not this extension, and the product already says exactly that. What is built is the honest half — the lens is offered, and acting on it explains that the action exists only as a VS Code Copilot prompt, that this extension cannot detect or drive Zed Agent, and that **nothing is sent to any AI service**. That last property is not a limitation to be lifted quietly: a future direct Agent workflow needs a new Zed API *and* an explicit privacy and consent decision, because it would mean transmitting the user's source. |
| Embedded Spring Tools MCP server | `planned` | Spring Tools 5.2.0 contains an experimental streamable-HTTP MCP server exposing 18 tools and one prompt — project list, Boot/Java version, resolved classpath, bean details and usage, beans by type, request mappings, stereotypes and components, Spring Tools diagnostics, plus five `api.spring.io` release/generation tools — and Zed supports remote MCP tools and prompts. **Decided 2026-07-29 (inventory version 46): build it, honouring upstream's two settings, defaulting off. The row stays `planned` because it is not built yet; the direction is no longer open.** [S019](spikes/019-embedded-mcp-server.md) observed the capability working: dropping `-Dspring.main.web-application-type=NONE` from `springArguments` (`coordinator/src/main.mjs`) is by itself sufficient, the unmodified jar then bound `127.0.0.1:<port>` and returned all 18 tools over `POST /mcp`, and the same JVM served stdio LSP concurrently with **zero** contaminating bytes on stdout and diagnostics byte-identical to the control arm — the first observation of R018 hypothesis 6. The decisive fact came after that spike: the pinned VSIX's own launcher already branches on `boot-java.ai.mcp-server-enabled` (default `false`) and `boot-java.ai.mcp-server-port` (default `50627`), pushing `-Dserver.port=<port>` when enabled and our exact flag when not. So this extension currently implements one of upstream's two branches rather than deviating from it, and the "random port announced only through `window/showMessage`" concern is an artefact of how the spike was run: upstream supplies a fixed port, and the port also reaches stderr. `not-pursued` is therefore the wrong label — it means a documented exception outside the parity target, which is true of Spring Initializr and false here. The residual costs are real and opt-in only: the endpoint is unauthenticated (loopback-bound, but any local process could enumerate beans, mappings and classpath through it), and the five spring.io tools make live outbound calls that would reopen the closed offline row for a user who enables them. Defaulting off keeps the default launch byte-identical to today's. Implementation is a separate `feat/` slice and needs a path this extension does not yet have: every `boot-java.*` key handled so far is forwarded *to* the server via `spring_workspace_configuration`, while these two change how the process is launched. Tool **payloads** against a resolved project remain unobserved — S019 ran without the official-Java bridge, so index-backed tools were reachable but empty — and that is what a later `verified` promotion must show. |

## Workstream 6 — settings, diagnostics, and lifecycle

| Capability | State | Notes |
| --- | --- | --- |
| Start Spring Boot Language Server on demand | `zed-native-equivalent` | `vscode-spring-boot.ls.start` is a VS Code client command, not a server request the coordinator receives. In Spring Tools' `Main.ts` it calls `client.start()` and then registers the classpath service, registers the Java-data service, and forces `sts.vscode-spring-boot.enableClasspathListening(true)`. Zed owns language-server start/restart (auto-start on opening a Boot file, restart via Zed's action — both exercised in M2), and the coordinator already performs the callback's work: it serves the classpath bridge (`sts/addClasspathListener`) and the Java-data methods (`sts/java*`), and sends `enableClasspathListening(true)` once the official Java route is ready. So the outcome is delivered without an on-demand command. Earlier "coordinator does not handle this client request" was a miscategorization: it is not a coordinator request. |
| Java type resolution for the server | `verified` | Observed 2026-07-18 on macOS arm64/JDK 25 with the development extension and Zed 1.11.3. `sts/javaType` is a server→client request (`@JsonRequest("sts/javaType")` on Spring Tools' `STS4LanguageClient`; the server calls `client.javaType(...)` from `JdtLsIndex`). During project indexing the Spring server issued a real `sts/javaType`, and the coordinator routed it to the official Java extension's `sts.java.type` command over the loopback route and answered it — observed as the coordinator's once-per-method success log `official Java data request sts/javaType answered` (emitted only after the loopback returns a result). Zed's own trace shows **no** `sts/javaType`, confirming the coordinator intercepts it before the editor; the pre-coordinator spike `s011`, where the request reached Zed and was rejected `-32601`, was the failure mode. `JavaTransport` maps this and eight sibling `sts/java*` methods to `sts.java.*`; the siblings share the path and contract test but were not each observed at runtime. Contract-tested (`Java data requests are answered through the official Java transport`). Evidence: `tmp/cav-verify-20260718/`. |
| Classpath listening | `verified` | `sts.vscode-spring-boot.enableClasspathListening` driven by the coordinator; observed registering and removing during the M2 gate run. The 2026-07-22 real-Zed recovery gate paused the isolated jdtls process, observed the unmodified official-Java proxy reject `addClasspathListener` after its five-second timeout, and observed bounded coordinator re-enablement with no compatibility notification; resuming the same jdtls PID produced `official Java classpath bridge registered` in the same session. **Install-ordering caveat**: if the extension is installed while a Java project is already open, `jdtls` does not pick up the bridge until Zed restarts; when the extension is present before the Java server starts it registers fine, cold cache included. See [S014](spikes/014-jdtls-bundle-startup-ordering.md). Evidence: `tmp/run-debug-gates-20260722/evidence/forced-timeout-arm4-*`. |
| Missing / incompatible Java diagnostic | `verified` | Observed on 2026-07-18 by driving the real coordinator process on incompatible inputs. A real Temurin 17.0.18 was refused with `JDK 21 or newer is required by Spring Tools`; a structurally invalid self-declared provider contract was refused with `official Java compatibility contract is invalid` before the JDK check. Both exited nonzero with no reduced mode; a compatible Temurin 21.0.11 control passed both guards and launched the real Spring server. Absent-Java path observed earlier in M2. D006 now makes the installed extension release non-gating; contract coverage and the 2026-07-19 CodeLens run both exercised the release-unpinned structural route successfully. Actual required-capability failures now produce a persistent clickable Markdown notification with an allowlisted title/body-prefilled GitHub report. The diagnostic Zed-to-browser gate opened a populated composer without submission; contract tests tie that UX to real failure paths. **A defect in *when* the notification fires was observed 2026-07-26 in the M5 JDK 21 floor gate and closed on 2026-07-29.** On the first import of a never-before-opened project, one `sts.java.type` lookup exceeded official Java's five-second command timeout, the data route reported it as an incompatibility, and the same route answered normally three seconds later — while the classpath path already absorbed exactly that timeout and re-enabled with no notice. The data route now applies the same rule: a failure is reported only once it outlives the sixty-second handshake window that opens with the first Java document, and never after the route has answered, because the notice's own claim is then provably met. Spring receives the error response either way, so suppression cannot hide a route that stays broken. **Driven 2026-07-29** on macOS 26.5.2 arm64, Zed 1.12.1, official Java 6.8.21 (jdtls 1.60.0), Temurin 25.0.3, against the Boot 3.5.5 fixture, by `SIGSTOP`ping the isolated jdtls child — never the proxy that wraps it — after Spring resolved the project, then reconciling a `.properties` document, which is the route's real caller (`SpringPropertiesReconcileEngine.reconcileType` → `JdtLsIndex.findType` → `sts.java.type`). A/B on one script: the pre-fix build raised the notice at +15s, inside the window, on the first of its timeouts; the fixed build logged six suppressed failures between +31s and +57s, raised the same `java-data-route-failed-v1` notice at +62s — two seconds after the window closed — and answered normally in the same session after `SIGCONT`. The row stayed `verified` throughout, because the diagnostic itself always worked. Evidence: `tmp/m2-step7-incompatible-java-20260718/`, `tmp/codelens-runtime-20260719.udLvyE/evidence/`, `tmp/m5-jdk21-floor-20260726/evidence/`, `tmp/data-route-transient-20260729/evidence/`, and R016. |
| Embedded language syntax highlighting | `blocked-zed-api` | Setting `boot-java.embedded-syntax-highlighting`; the VSIX contributes four grammars. D005 preserves official Java highlighting and excludes Java query replacement from the baseline. **Settled negative on both paths ([S017](spikes/017-static-semantic-token-declaration.md), driven 2026-07-21).** Dynamic first: after Spring registers `textDocument/semanticTokens` through `client/registerCapability` — even after `workspace/semanticTokens/refresh` — Zed 1.11.3 issues no semantic-token request. That is not a client-capability gap; Zed's `initialize` advertises `semanticTokens` with `requests.full.delta`, the full legend, `dynamicRegistration: true`, and `augmentsSyntaxTokens: true`. Static next: the coordinator declared `semanticTokensProvider` with Spring's captured legend in the `initialize` result and consumed Spring's dynamic registration (the adaptation that fixed Code Actions), the declaration reached Zed, `GreetingRepository.java` was the focused Java buffer, and Zed still issued **zero** `textDocument/semanticTokens/*` requests. Decisive control: **jdtls, the primary Java server, declares its own `semanticTokensProvider` statically and Zed ignored that too** — so the missing surface is Zed's semantic-token request/render path for Java, not registration timing. Tree-sitter Java highlighting stays intact as the supported fallback (the `@Query` JPQL block renders as a plain string). The opt-in Java query pack remains an independent tree-sitter route needing its own direction decision. Evidence: `tmp/s017-static-semantic-tokens-20260721/evidence/` (baseline in `tmp/ws2-language-intelligence-20260721/evidence/trace-baseline.log`). |
| Java Spring diagnostics and quick fixes | `verified` | Verified 2026-07-26 on macOS 26.5 arm64, Zed 1.12.0, official Java 6.8.23 (jdtls 1.60.0), Spring Tools 5.2.0, Temurin JDK 25.0.3, Maven 3.9.15, against a four-module fixture (Boot 3.5.5 practices, Boot 2.7.18 security, Boot 4.0.6 web/data, Spring AI 1.0.0). **The row needed no product code and no settings supplement** — the second row after version/support validation where the VS Code-schema audit came back empty on both sides. The pinned server ships `problem-types.json`, the authoritative source for every category toggle and problem-type severity, and comparing all 11 categories and all 71 problem types against the pinned VSIX schema found zero differences: `boot2`/`boot3`/`boot4` default `AUTO`, `spring-aot` `OFF`, `spel`/`version-validation`/`data-query`/`cron`/`spring-ai` `ON`, and every `spring-boot.ls.problem.<category>.<CODE>` severity identical. The two booleans on this row also match, so neither hits the absent-key trap: `BootJavaConfig.isJavaSourceReconcileEnabled()` returns **true** for an absent `boot-java.java.reconcilers` (unlike `jpql`, `inject-bean`, the XML sub-settings and `modulith-project-tracking`, which all return false), and `isScanJavaTestSourcesEnabled()` returns false for an absent `boot-java.scan-java-test-sources.on`, matching VS Code's `false` default. **Diagnostics.** 28 distinct problem types were observed as ordinary `textDocument/publishDiagnostics` with `source: "vscode-spring-boot"`, on unopened files as well as open ones, covering every Java family: all **17** boot2 types (from `PATH_IN_CONTROLLER_ANNOTATION`, `JAVA_AUTOWIRED_CONSTRUCTOR`, `JAVA_PUBLIC_BEAN_METHOD` and `MISSING_CONFIGURATION_ANNOTATION` through the three Spring Security ones that only exist on the Boot 2.7 module, plus `JAVA_TEST_SPRING_EXTENSION` under the `scan-java-test-sources` opt-in), boot3 `JAVA_TYPE_NOT_SUPPORTED`, 6 of 7 boot4 types (`API_VERSION_SYNTAX_ERROR`, both API-versioning strategy problems, both bean-registrar problems, and `API_VERSIONING_NOT_CONFIGURED` observed from both sides — absent while the fixture configured versioning, present on both mappings once the configurer was removed), and 2 of 3 spring-aot types under the default-`OFF` category turned on. Severities arrive exactly as declared, including `ERROR` for `DOMAIN_ID_FOR_REPOSITORY` and `HINT` for `JAVA_PRECISE_REQUEST_MAPPING`. `AUTO` is not "on": `JdtReconciler` resolves it to each reconciler's own `isApplicable(project)` dependency/version gate, which is why an unconfigured project sees exactly the families its dependencies justify. **Quick fixes.** Spring attaches its fixes as `quickfix` Code Actions whose command is always `sts.vscode-spring-boot.codeAction`, with the first argument selecting the engine, and **both engines were driven through Zed's own code-action menu to an applied edit**: `org.springframework.ide.vscode.jdt.refactoring` ("Remove 'public' from @Bean method", `ChangeMethodVisibilityRefactoring`) and `org.openrewrite.rewrite` ("Convert @Autowired field into Constructor Parameter"), each answering `workspace/applyEdit` with `applied: true` and leaving the expected source in the saved buffer — the second rewrote the field to `private final` and generated the constructor. The same menu showed Spring's fix, this extension's `source` actions and jdtls's own actions together, the S018 composition result again. **Selective disabling, the row's explicit requirement, works at both granularities** and needs only the settings passthrough: `boot-java.validation.java.boot2: "OFF"` removed every boot2 diagnostic across all modules while boot3, boot4 and spring-ai kept firing, and `spring-boot.ls.problem.boot2.PATH_IN_CONTROLLER_ANNOTATION: "IGNORE"` removed that one diagnostic while the two other diagnostics *in the same file* stayed. Both controls ran with `~/.sts4/.symbolCache` moved aside, because Spring replays cached diagnostics on startup. **The three problem types this run left unobserved are all closed, and none of them needed product code.** (1) `JAVA_BEAN_NOT_REGISTERED_IN_AOT` is now `verified` on the 2026-07-26 follow-up run, which completes the `spring-aot` category at 3/3. The earlier reading — that `NotRegisteredBeansReconciler` inspects classpath AOT-registration state — was wrong; it fires on any concrete (non-interface, non-abstract) type in the hierarchy of `BeanFactoryInitializationAotProcessor` or `BeanRegistrationAotProcessor` for which `springIndex.getBeansWithType` is empty, so **registration is the whole gate** and `isApplicable` is only Boot ≥ 3.0.0. A plain class implementing `BeanRegistrationAotProcessor` drew `Not registered as a Bean` at `severity: 2` over exactly the type name (`[10:13-10:37]`), while a `@Component`-annotated sibling in the same package published `[]`. The previous fixture's processor was registered, which is why it drew `JAVA_BEAN_POST_PROCESSOR_IGNORED_IN_AOT` instead. Its quick fixes are OpenRewrite `DefineMethod` actions, one per configuration bean — *Define bean in config 'aotConfig'…* and *…'aotApplication'…*, because `@SpringBootApplication` is itself a configuration bean. (2) `SPRING_DATA_STRING_PROPERTY_REFERENCE` is now `verified` too, completing `boot4` at 7/7, and the reason the four `Sort` shapes drew nothing was neither the shapes nor the domain-type resolver: `SpringDataCommonsContributor.isApplicable` requires **spring-data-commons ≥ 4.1.0** (confirmed in the pinned jar's bytecode), because `hasTypedPropertyPathOverload` only reports a String argument when the same method has an `org.springframework.data.core.TypedPropertyPath` overload — a type that does not exist before 4.1.0. The Boot 4.0.6 module could never have fired. On a Boot 4.1.0 module (spring-data-commons 4.1.0) the same source drew 5 diagnostics at `severity: 3` across 4 shapes, and a byte-identical Boot 4.0.6 control published `[]`. The domain type is an enrichment, not a precondition: `repository.findAll(Sort.by("firstName"))` reads *for domain type 'Person'* because `determineDomainTypeExact` walks up to the enclosing repository call, a bare `Sort.by("lastName")` reads without it, two literals in one call are **one** diagnostic with the message switching to the plural, and `Sort.Order.asc`/`desc` are matched separately from `Sort.by`. Its quick fixes ride the JDT refactoring engine, and the new `TypeSafePropertyReferenceRefactoring` was **driven to an applied edit** through Zed's code-action menu — `workspace/applyEdit` answered `applied: true`, the call became `Sort.by(Person::getFirstName)`, and the following reconcile published 4 diagnostics instead of 5, the fixed one gone and the rest kept. The *Replace all exact matches… in file* action appears only when at least two problems in the file resolve to an exact single domain type. Evidence: `tmp/residual-diagnostics-20260726/evidence/`. (3) `FACTORIES_KEY_NOT_SUPPORTED` could not be reached on this run, because its `spring.factories` buffer got no language at all and produced no `didOpen`. **It is no longer unobserved: two follow-ups on 2026-07-26 closed it.** The first traced the missing language to a stale extension index in the run profile — not to Zed or the product — and got the file to Spring as `spring-factories` on Zed 1.12.0, where the diagnostic still did not appear. The second found why: no Java buffer had been open in those runs, so no classpath reached Spring and the reconciler's `projectFinder.find` was empty for every URI, not just this one. With a Java file opened first the diagnostic publishes as `ERROR` on both scanned `.factories` paths. The full account, its controls and its residual limits are in the `spring-factories` language row. Evidence: `tmp/java-reconcilers-20260726/evidence/`. |
| Spring Boot version/support validation | `verified` | Verified 2026-07-25 on macOS 26.5 arm64, Zed 1.12.0, official Java 6.8.23, Spring Tools 5.2.0, Temurin JDK 25.0.3, against a four-module Maven fixture pinned to Boot 4.0.6, 3.5.5, 3.3.5 and 2.7.18. The diagnostics need no product code: they arrive as ordinary `textDocument/publishDiagnostics` on each module's own build file, all anchored at the **first character of the file** (line 0, characters 0–1), and every problem type whose default severity is not `IGNORE` fired — `UPDATE_LATEST_PATCH` (`severity: 2`, e.g. "Newer patch version of Spring Boot available: 4.0.7"), `UPDATE_LATEST_MINOR` (`severity: 3`, 4.1.0 on the 4.0.x module and 3.5.16 on the 3.3.x one), `UNSUPPORTED_OSS_VERSION` and `UNSUPPORTED_COMMERCIAL_VERSION` (both `severity: 2`). Both OSS branches were observed: with commercial support still valid the message names the commercial end date and carries the Tanzu action (3.5.x "ended on 2026-06-30, get commercial support until 2032-06-30", 2.7.x likewise), and with commercial support also expired (3.3.x) it does neither and the separate commercial diagnostic appears instead. `SUPPORTED_OSS_VERSION`, `SUPPORTED_COMMERCIAL_VERSION` and `UPDATE_LATEST_MAJOR_VERSION` were correctly absent, because all three default to `IGNORE` in the pinned release *and* in the VS Code schema — the in-support 4.0.x module reports no support diagnostic at all, and no module is nagged about Boot 4 across a major boundary. **The settings audit found nothing to send**: `BootDiagnosticSeverityProvider` falls back to each problem type's own default when `spring-boot.ls.problem.version-validation.<CODE>` is absent, and every one of those defaults matches the schema, as do `boot-java.validation.java.version-validation` (`ON`) and `spring-boot.ls.problem-parameters.version-validation.use-project-build-file` (`true`) — so this row escapes the silent-gap trap that `jpql`, `inject-bean` and the XML sub-settings hit, and all severities stay user-settable through the settings passthrough. Both version sources ran and both reported themselves through `$/progress`: "Spring Tools: Fetching Maven release metadata" served the release list from the project's own repositories (the default route), and one "Fetching Generations from Spring IO" call served the support dates, which only the spring.io API carries. Update diagnostics carry Spring's upgrade quick fix (the separately `verified` *Spring Boot upgrade* row) plus release notes; a minor-update diagnostic carries **only** release notes, confirming from the diagnostic side that the "full project conversion recipe" action is never built in 5.2.0. **The one product change is that external pages now reach the user.** Both link quick fixes — "Open Release Notes for Spring Boot x.y.z" and "Get commercial Spring Boot support via Tanzu Spring Runtime" — execute `sts/show/document`, which the server turns into a `window/showDocument` request for an external URL, and stock Zed answers no such request. That previously landed in the coordinator's file-oriented CodeLens notice, which advised running Go to Definition on a Spring Data repository method, and returned `success: false`, so Spring added its own `Failed to open:` error on top. The coordinator now answers an `http`/`https` target with the address itself as a bounded Markdown link and reports the request handled, so the `executeCommand` result is a clean `null` and no failure notice appears. The notice is a `showMessageRequest` with one dismissal action, because a plain toast auto-dismisses before a link can be clicked and Zed drops an actionless request; the action performs nothing, and the extension never opens a page itself. Three rendering rules keep server data safe in a clickable surface: only `http`/`https` reach it, the visible label is the address itself so no label can claim a destination the link lacks, and an address carrying userinfo or characters that would break out of the Markdown link is rendered as redacted plain text instead. Both actions were driven; Zed rendered the address as a real link, and the maintainer's click opened the page. **`SPRING_CLOUD_INCOMPATIBLE_BOOT_VERSION`, the one diagnostic this run left unobserved, is now `verified` as well** (2026-07-26 follow-up, same tuple), so every non-`IGNORE` problem type in the `version-validation` category has now been drawn. It is not a version comparison: `SpringCloudCompatibilityValidator` makes a two-hop walk through spring.io generation metadata — the `spring-cloud-commons` jar's major.minor selects a generation of that project, that generation's `linkedGenerations["spring-cloud"]` must name **exactly one** Spring Cloud generation, and it is *that* generation's `linkedGenerations["spring-boot"]` the project's `<major>.<minor>.x` is checked against. So the fixture is a pairing, not a version: spring-cloud-commons **4.1.6** on a **Boot 3.5.5** module (generation `4.1.x` → Spring Cloud `2023.0.x` → Boot 3.2.x/3.3.x) drew `severity: 2` at `[0:0-0:1]` like every other version diagnostic — *"Spring Cloud 2023.0.x is not compatible with Spring Boot 3.5.5. Supported Spring Boot versions: 3.2.x, 3.3.x"* — while a sibling module identical except for spring-cloud-commons **4.3.3** (→ `2025.0.x` → Boot 3.5.x) drew only its two ordinary version diagnostics and no cloud one. `spring-cloud-function-core` and `spring-cloud-task-core` are alternate identification artifacts that were not exercised, and the generation tables are live spring.io data, so the pairing rather than the exact strings is the durable claim. Evidence: `tmp/residual-diagnostics-20260726/evidence/`. *Residual limits.* (1) No automated click could activate the rendered link — macOS System Events `click at` is window-relative and produces no hover, which GPUI's link hit-testing appears to need — so the click itself rests on the maintainer's observation, while the request, the notice and the clean result are in the trace. (2) The support dates are as fresh as Spring's own 30-second-cached spring.io fetch; offline behaviour for this row is covered by the separate *Offline behaviour* row. Evidence: `tmp/version-validation-20260725/evidence/`. |
| Spring AI annotation diagnostics and indexing | `verified` | Verified 2026-07-26 on the same tuple and in the same run as the Java reconciler row, against a Boot 3.5.5 module depending on `org.springframework.ai:spring-ai-model` 1.0.0. Both halves of the outcome were observed and neither needed product code. *Diagnostics*: `SPRING_AI_TOOL_MISSING_DESCRIPTION` on a bare `@Tool`, `SPRING_AI_TOOL_DESCRIPTION_TOO_SHORT` on a 13-character description (the `spring-boot.ls.problem-parameters.spring-ai.…minimum-length` default is 30), both `severity: 2` and both rendered in the editor, and **no** diagnostic on a compliant third `@Tool` method — the control that shows this is a real check rather than a blanket flag. The `spring-ai` category toggle defaults `ON` in the pinned server exactly as in the VS Code schema, so the diagnostics need no settings. *Indexing*: the annotations reach the Spring index itself, not only the reconciler — the verified Structure document rendered all three tool methods under their component as `@Tool currentWeather`, `@Tool forecast` and `@Tool detailedWeather`, each linked to its own line. Enabling the embedded MCP server was not required, as predicted. *Limits.* The pinned reconcilers attach no fix descriptor to either problem, and the driven code-action menu at the flagged annotation correctly offered no Spring quick fix, so there is no fix path to lose. The MCP annotation family (`org.springframework.ai.mcp.annotation.McpTool`/`McpPrompt`/`McpResource`) is handled by the same `AbstractSpringAiAnnotationReconciler` but was not exercised: the pinned Spring AI 1.0.0 release does not ship those types. Evidence: `tmp/java-reconcilers-20260726/evidence/`. |
| Offline behaviour | `verified` | Verified 2026-07-26 on macOS 26.5 arm64, Zed 1.12.0, official Java 6.8.23 (jdtls 1.60.0), Spring Tools 5.2.0, Temurin JDK 25.0.3, Maven 3.9.15, against the single-module Boot 3.5.5 fixture. Network denial is a `sandbox-exec` profile (`(deny network-outbound)` plus host-local re-allows) wrapping the Zed launch, so it covers the editor, the coordinator, and the JVMs it starts; the Spring server's own `java.net.SocketException: Operation not permitted` proves the children inherited it. Five runs, each with the extension index rebuilt from a fresh profile copy. **(1) First install, no network — fails closed.** `zed::download_file` cannot reach the pinned release, `ensure_installed` returns the error, and Zed both marks the server failed in the status bar (`Failed to run spring-tools. Click to show error.`) and renders the whole chain in its error buffer: `from extension "Spring Tools" version 0.1.0: download pinned Spring Tools 5.2.0.RELEASE: downloading release`, caused by `error sending request for url (https://github.com/spring-projects/spring-tools/releases/download/5.2.0.RELEASE/vscode-spring-boot-2.2.0-RC1.vsix)` → `client error (Connect)` → `tcp connect error` → `Operation not permitted (os error 1)`. So the message names the pinned version and the exact artifact it needs. Disk afterwards: `downloads/5.2.0.RELEASE/` is created but **empty** (no partial file to poison a later attempt), no `spring-tools/5.2.0.RELEASE` install directory, no `.staging` leftover, and `ps` shows **no** coordinator — no reduced mode is started. Opening a Java file in that session started jdtls normally and imported the Maven project offline, so the failure stays contained to this extension; Zed does not retry the failed server in the same session, making a restart the retry gesture. **(2) Warm cache, no network — the product works.** From the checksum-verified install the coordinator started, the official Java classpath bridge registered, `sts/javaType` was answered, and Spring published `JAVA_PUBLIC_BEAN_METHOD` (×2), `JAVA_REPOSITORY`, the cron `SYNTAX` diagnostic, and — once the classpath arrived — `PROP_UNKNOWN_PROPERTY` (`'ser' is an unknown property. Did you mean 'server.address'?`) beside the syntax-only one it publishes before that. A ctrl-space in `application.properties` returned the `server.*` proposals with `server.address java.net.InetAddress` and its documentation, so completion and metadata detail are local too. **(3) The one degradation is version/support validation.** `MavenMetadataProvider` logs `MavenDownloadingException: … Unable to download metadata` and `UpdateBootVersion` logs `ResourceAccessException: I/O error on GET request for "https://api.spring.io/projects"`, while `pom.xml` receives an **empty** `publishDiagnostics`. The user therefore loses the update/support advice and gains no error notice, no stale advice, and no hang — the reconcile completed in 1362 ms. **(4) The checked cache repairs as well as guards.** One flipped byte in the installed `jdt-ls-extension.jar` was caught by `validate_install`, and because the cached VSIX still matched its pinned size and SHA-256 the extension re-extracted it **with no network**, restoring the pinned checksum and starting the server. **(5) Corrupt both and it fails closed without collateral damage.** With the installed server jar altered *and* the archive truncated by one byte, the archive is deleted rather than used, the same bounded download error appears, the existing (bad) installation is left byte-for-byte as it was, and no staging directory survives — activation only ever replaces an installation with a validated staging directory renamed into place, so a failed install or repair cannot destroy a good one. One online start from that same profile then re-downloaded the 82,759,143-byte archive, rebuilt the installation to the pinned checksums and ran, so an offline failure is recoverable state, not a poisoned one. **Scope limits.** One tuple, one JDK, one build tool; rollback *between two pinned Spring Tools releases* is untested because only one release is pinned; first-install offline for the official Java extension is that extension's own behaviour, not this one's; and repackaging or mirroring the VSIX stays blocked on a third-party license inventory (`LIMITATIONS.md`). Evidence: `tmp/offline-behaviour-20260726/evidence/`. |

## Maintenance

- Bump the inventory version and re-derive when the pinned Spring Tools release
  moves. State recorded against one release does not carry to another.
- A state changes only with evidence. `verified` requires a named tuple.
- A `blocked-*` state requires the exact missing surface, not a general claim,
  and requires that no Zed-native surface delivers the outcome. "We cannot build
  that exact VS Code widget" is not a blocker; name the capability by outcome.
- Update this file in the same change as the slice that moves a state.
