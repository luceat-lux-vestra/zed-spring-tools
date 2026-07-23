# Capability inventory

- Inventory version: 27
- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Last updated: 2026-07-23
- Evidence: [R011](research/011-vscode-spring-tools-capability-surface.md),
  [R013](research/013-zed-native-capability-delivery-surfaces.md),
  [R014](research/014-final-upstream-capability-surface-audit.md),
  [R016](research/016-zed-github-compatibility-reporting.md),
  [R017](research/017-zed-codelens-hover-command-compatibility.md),
  [R018](research/018-spring-tools-zed-outcome-parity-audit.md),
  [R019](research/019-zed-codelens-agent-navigation-and-build-output.md), and
  [S018](spikes/018-references-highlights-multiserver-composition.md)
- Delivery routes: [M4 capability delivery plan](capability-delivery-plan.md),
  selected by [D005](decisions/005-lsp-first-capability-delivery.md), with
  compatibility/reporting policy from
  [D006](decisions/006-capability-first-java-compatibility-and-reporting.md)
- Reproducible CodeLens targets: [CodeLens showcase and coverage](code-lens-showcase.md)
- Runtime-tested tuples in this inventory: macOS 26.5.1/26.5.2 arm64, Zed 1.10.3
  and 1.11.3, official Java extension 6.8.21 and 6.8.23, Temurin JDK 25.0.3

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

58 capabilities tracked.

| State | Count |
| --- | --- |
| `verified` | 32 |
| `implemented` | 2 |
| `planned` | 15 |
| `blocked-zed-api` | 2 |
| `blocked-upstream` | 0 |
| `zed-native-equivalent` | 6 |
| `not-pursued` | 1 |

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

## Known surface constraints

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
| `spring-factories` language support | `verified` | Verified 2026-07-20 on the same tuple. `extension.toml` now contributes a `languages/spring-factories` language (`path_suffixes = ["factories"]`) on a pinned `tree-sitter-properties` grammar, mapped to the Spring language id `spring-factories`. The driven run observed Zed send `textDocument/didOpen` for `META-INF/spring.factories` with `"languageId":"spring-factories"`; before this change the file was classified as no language and reached no server at all. The grammar revision `579b62f` is the same one the official Java extension already pins for its own Properties language, so a user who has that extension builds no additional upstream source. Spring published no diagnostics for the valid fixture, which is the expected quiet result; its factories support is completion and indexing rather than validation. |
| `jpa-query-properties` language support | `verified` | Verified 2026-07-20 on the same tuple, and the open question is now answered: **Spring keys this off the language id, not the filename.** `SimpleTextDocumentService.didOpen` builds the tracked document from `LanguageId.of(textDocument.getLanguageId())`, `CompositeLanguageServerComponents` dispatches through `componentsByLanguageId`, and `JpaQueryPropertiesLanguageServerComponents.getInterestingLanguages()` returns only `JPA_QUERY_PROPERTIES`; `BootLanguageServerBootApp$3.computeLanguage(URI)` — which does key off `/META-INF/jpa-named-queries.properties` — is consulted only for documents the editor never opened (the `codeAction` path for an untracked document). Routing the file as ordinary `Properties` therefore degraded it silently. A `languages/jpa-query-properties` language now claims the full filename (`path_suffixes = ["jpa-named-queries.properties"]`) on the same pinned grammar and maps to the `jpa-query-properties` id. Two Zed behaviours were open risks and both resolved favourably: a dotted full filename does match `path_suffixes`, and the more specific language wins over the Properties language that claims the `properties` extension. Driven proof of the outcome, not just the routing: Spring returned `JPQL_SYNTAX` / `"JPQL: missing FROM at 'Greeting'"` (source `vscode-spring-boot`) on the fixture's deliberately broken named query — a reconciler that only runs for the JPA component set. Evidence: `tmp/ws1-close-20260720/evidence/trace-jpa.log`. |
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
| SpEL language intelligence | `planned` | Spring supplies embedded semantic tokens and diagnostics, plus contextual hover/navigation paths; AI explanation is a separate client-only lens. The semantic-token half of this row is settled and negative: Zed issues no semantic-token request even after Spring registers the provider dynamically (see Embedded language syntax highlighting), so the preferred route narrows to diagnostics, hover and navigation, which are ordinary LSP and remain untested here rather than blocked. Do not conflate working language intelligence with the VS Code Copilot command. |
| Spring Data query intelligence | `planned` | Includes repository-method completion and embedded JPQL/HQL/SQL semantic tokens, diagnostics (`JPQL_SYNTAX`/`HQL_SYNTAX`), highlights, multiline conversion, AOT query display, implementation navigation and refactoring, plus an inlay hint on **positional** query parameters (`?1` → mapped method-parameter name, via `JdtDataQueriesInlayHintsProvider`). All gated by `boot-java.jpql`, which the server defaults **off**; the Zed extension now sends `jpql: true` (`spring_workspace_configuration`), and a 2026-07-19 driven run verified the positional-parameter inlay renders (`?1` → `message`). See [codelens-inlay-parity](codelens-inlay-parity.md) §5. The other surfaces are standard LSP or advertised Spring commands; verify Java text blocks and the distinct `jpa-named-queries.properties` language identity. |
| Cron completion and validation | `verified` | Verified 2026-07-21 on the same tuple; cron inlay hints were already verified separately. *Completion*: a caret inside the existing `@Scheduled(cron = "0 0 * * * *")` returned 24 proposals from `CronExpressionCompletionProvider` (`0 0 * * * *`, `0 */5 * * * *`, `0 0 0 * * SAT,SUN`, `0 0 0 ? * MON#1`, …) while jdtls returned zero for the same position, so the result is Spring-attributed. *Validation*: `JdtCronReconciler` published `severity: 1`, `code: SYNTAX`, `source: vscode-spring-boot`, message `CRON: mismatched input '<EOF>' expecting WS` on the fixture's deliberate five-field expression, with the valid six-field expression in `GreetingSchedule` publishing an empty diagnostic list as the control. The reconciler visits any `NormalAnnotation` carrying a cron attribute rather than the registered bean set, which is why the broken expression can live on an unregistered class and leave the fixture bootable. Embedded cron semantic highlighting is **not** part of this row — see the **Embedded language syntax highlighting** row, which records why no semantic-token route exists on this tuple. Evidence: `tmp/ws2-language-intelligence-20260721/evidence/trace-cron-completion.log`. |
| Boot project info | `implemented` | The synthetic `zed-spring-tools.configure-boot-run` Code Action consumes `sts/spring-boot/executableBootProjects` project records (`name`/`projectName`, `mainClass`, `uri`) to generate reviewable run/debug configuration; the 2026-07-19 driven run confirmed the real `mainClass` reached the generated `.zed/debug.json`. `sts/spring-boot/bootProjectInfo` remains advertised and forwarded unchanged for additional detail, which is not separately exercised. |
| Executable Boot projects discovery | `verified` | A synthetic `source` Code Action on Java files invokes `sts/spring-boot/executableBootProjects` (its `sts/project/gav` callback routes through the official Java transport), presents a bounded `window/showMessageRequest` selection (single project skips the prompt; `All projects` covers overflow beyond eight), and generates merge-safe `.zed/tasks.json`/`.zed/debug.json`. Driven first on 2026-07-19 (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25, fixture `spring-boot-basic`): the LSP trace showed the injected action, the user-selected command produced correct `.zed/tasks.json`/`.zed/debug.json` for the discovered project, and the confirmation notice reported one entry each. The 2026-07-22 Maven multi-project gate on macOS 26.5.2 then returned `service-a` and `service-b`, displayed both plus `All projects`, and generated one task/debug pair for each selected module with the correct worktree-relative `cwd`. Evidence: `tmp/run-debug-gates-20260722/evidence/`. |
| Spring XML config support | `verified` | XML already reaches the server via the `xml` language id (the pom inlay route). The master switch `boot-java.support-spring-xml-config.on` is genuinely opt-in — false-when-absent on the server (`isSpringXMLSupportEnabled`) and in VS Code's schema — so it is not defaulted on. The extension supplies the three sub-settings that read off/empty when absent while VS Code defaults them on: `content-assist` and `hyperlinks` (`enabled != null && …`, schema `true`) and `scan-folders` (empty folder list when absent, schema `"src/main"`), so a user who sets `on: true` gets a functional feature instead of an inert one. Contract-tested in `src/lib.rs`. Driven on 2026-07-22 (macOS arm64, Zed 1.11.3, jdtls 1.60.0, JDK 25, sweetppro/zed-xml): with only `on: true` set by the user, the `didChangeConfiguration` trace carried all four keys, `beans.xml` opened with `languageId: xml`, and every gate fired — SpEL reconcile diagnostic (`JAVA_SPEL_EXPRESSION_SYNTAX`, proves `on`), 1 XML file scanned / 1 bean symbol indexed (proves `scan-folders`), `class=`/property-name completion (proves `content-assist`), and property→`Greeting.java` definition (proves `hyperlinks`). A failing reconciler is disabled independently rather than weakening other Spring features. Evidence: `tmp/xml-config-driven-20260722/evidence/`. |

## Workstream 3 — live application data

| Capability | State | Notes |
| --- | --- | --- |
| Connect / disconnect to a local Boot process | `verified` | A synthetic `source` Code Action on Java files (**Spring Boot: Connect or disconnect live process data…**) runs `sts/livedata/listProcesses` and renders the returned descriptors — Spring already labels each and tags it with the exact `action` (`connect` for an available process, `disconnect`/`refresh` for a connected one) — as a bounded `window/showMessageRequest` choice (capped at 12 with an overflow notice; nothing happens until the user chooses). The chosen action executes with `[{processKey}]`. **A static read closed the same silent-gap trap as the shared-metadata reload**: `SpringProcessCommandHandler.connect/disconnect/refresh` each `return CompletableFuture.completedFuture(null)` regardless of outcome, so a null result is not evidence of success. The authoritative connect signal is instead the server→client `sts/liveprocess/connected` notification, which `SpringProcessLiveDataProvider.add` fires exactly once after the process is reached and its first live data is stored; the coordinator registers a per-`processKey` waiter before issuing connect and only reports "Connected …" when that notification arrives, otherwise a bounded "Requested … make sure the process exposes Actuator/JMX" (never a false success). Coordinator-owned identity/cleanup: it tracks connected keys from the connected/disconnected notifications (still forwarding both to Zed) and clears the map plus any pending waiter on shutdown. Contract-tested in `coordinator/test/coordinator.test.mjs` (confirmed connect, unconfirmed-connect bounded report, disconnect, empty list, dismissed prompt). **Driven 2026-07-23** on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, JDK 25.0.3 and Boot 3.5.5: the bounded choice listed the fixture after the extension supplied Spring's false-when-absent `boot-java.live-information.all-local-java-processes: true`; selecting it opened JMX, stored the first Actuator live-data result, emitted `sts/liveprocess/connected`, showed the confirmed success notice and refreshed CodeLens. Running the action again exposed `Refresh` and `Disconnect`; selecting `Disconnect` emitted `sts/liveprocess/disconnected`, closed JMX, refreshed CodeLens and showed the disconnect notice. The fixture enabled JMX and exposed its Actuator JMX endpoints; without that exposure the coordinator correctly avoided false success. The opt-in Live document remains the fallback presentation only if the bounded prompt cannot hold the list; no reduced connection mode is claimed. Evidence: `tmp/live-process-connect-runtime-20260723/evidence/`. |
| Remote connect | `planned` | Preferred route: an explicit Code Action reads endpoint and non-secret options from Zed settings before `sts/livedata/remoteConnect`. Credential input/storage needs a separate security decision; credentials may not enter project files, generated documents, action arguments, or logs. |
| Live hover data | `zed-native-equivalent` | Source-local live bean and injection facts are verified through live CodeLens followed by Zed's native Hover gesture. The connected run rendered Spring bean name, type, resource, bean id and process together with JDT hover. One-click dispatch remains blocked by Zed's client-command bridge. Explicit process show/hide/refresh is a separate `zed-native-equivalent`; aggregate metrics and logger aggregation/level changes are separate `verified` capabilities. |
| Show / hide / refresh live data | `zed-native-equivalent` | The pinned VS Code commands are thin active-debug-app wrappers around Spring's `sts/livedata/connect`, `disconnect`, and `refresh`; they add no separate server capability. Zed's **Spring Boot: Connect or disconnect live process data…** Code Action delivers the outcome through an explicit bounded process/action choice using Spring's own `listProcesses` descriptors. Contract tests cover connect, refresh, and disconnect; the 2026-07-23 Boot 3.5.5/JMX gate connected, exposed refresh/disconnect, refreshed live CodeLens, and disconnected with JMX cleanup. Zed does not infer an “active” debug app; automatic local connection is a separately implemented opt-in awaiting its runtime gate, and remote connection remains planned. |
| Metrics | `verified` | A synthetic Java-file source Code Action (**Spring Boot: Generate or refresh Live data document…**) first runs `sts/livedata/listConnected`; one connected process skips the prompt, while multiple processes use a bounded 12-item `window/showMessageRequest` and dismissal writes nothing. For the chosen opaque `processKey`, the coordinator explicitly refreshes `memory` and `gcPauses` with `tags: ""` (the pinned JMX extractor otherwise concatenates a literal `null,id:…` filter), then reads the server's `heapMemory`, `nonHeapMemory`, and `gcPauses` models into the owned, timestamped `.zed/spring-live.md`. The file shows finite measurements only, caps output at 64 models and 16 measurements per model, omits `availableTags` and the opaque key, preserves foreign/in-flight targets, and is regenerable/deletable without `.gitignore` mutation. The contract is sourced from `SpringProcessCommandHandler`, `SpringProcessConnectorService`, `SpringProcessLiveDataExtractorOverJMX`, `LiveMemoryMetricsModel`, and `Measurements` at pinned Spring Tools commit `18d1a975dbea4f9314fd736d0237bd9e23f243f9`; coordinator tests cover command order, redaction, bounds, empty/dismissed selection, and ownership. **Driven 2026-07-23** on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, Temurin JDK 25.0.3 and a connected Boot 3.5.5/JMX fixture: the first snapshot contained 12 authentic heap/non-heap measurements and an explicit empty GC family; Zed rendered its Markdown preview; explicit refresh changed the timestamp, file hash and values and added a real GC pause for 15 measurements; moving the owned file away and rerunning the action recreated it with a third timestamp/hash. The snapshots persisted no metric tags or opaque process-key field. Evidence: `tmp/live-metrics-runtime-20260723/evidence/`. |
| Loggers and log levels | `verified` | The opt-in `.zed/spring-live.md` appends a bounded, sorted read-only logger snapshot from `sts/livedata/getLoggers` without persisting the opaque process key; missing logger exposure does not discard verified metrics. A separate Java-file source action changes a level through bounded prompts: connected process, ten-at-a-time logger pages (up to 512), a level from Spring's advertised list, then a final confirmation. It calls the pinned `sts/livedata/configure/logLevel` argument contract and treats its immediate `null` only as acceptance; success requires a matching `sts/liveprocess/loglevel/updated` process/logger/level tuple. Mismatched notification, timeout, disconnect, or dismissal produces no false success. Logger names and levels used for mutation are never trimmed/truncated; invalid identifiers are omitted. The external Actuator endpoint remains the fallback for omitted entries. **Driven 2026-07-23** on macOS 26.5.2 arm64, Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, Temurin JDK 25.0.3 and Boot 3.5.5/JMX: 861 authentic loggers produced an exact 512-entry bounded document and rendered in Zed; the confirmed `ROOT` `INFO -> DEBUG` action received the matching update before success, a refresh showed effective/configured `DEBUG`, and the same verified path restored `INFO`. Evidence: `tmp/live-loggers-runtime-20260723/evidence/`. |
| Automatic connection | `implemented` | Opt-in only through `boot-java.live-information.automatic-connection.on: true`; absent/false stays off. Generated Java debug entries receive reviewable local JMX/Actuator exposure and `spring.boot.project.name` properties for safe project identity. The coordinator serially polls Spring's local Attach descriptors, reconciles `projectName` against authentic executable Boot projects, and reuses the verified `sts/liveprocess/connected` confirmation path only for exactly one matching process. Unnamed/unrelated JVMs, unsafe generated names, duplicate matching runs, and repeated attempts do not connect. Contract-tested; a driven Zed Java-debug start/connect/disconnect/stop gate on a named tuple remains required for `verified`. |

## Workstream 4 — structure view, run/debug, tasks

| Capability | State | Notes |
| --- | --- | --- |
| Browse / navigate the Spring logical structure | `zed-native-equivalent` | Zed's Project Symbols returns and navigates beans, the request-mapping endpoint, and component/configuration/application stereotypes, so it remains the supported equivalent. S015 Refuted the preferred per-file LSP Outline because restart can omit Java symbols. The explicitly requested, regenerable Spring Structure document is now a verified grouping companion. Its Markdown links open the right source files, while Project Symbols remains the exact-location path because Zed 1.11.3 discards their `#L…` fragments. Evidence: `tmp/ws2-symbols-run2-20260718/`, `tmp/s015-document-symbols-20260718/evidence/`, and `tmp/structure-document-20260722-runtime/evidence/`. |
| Structure refresh / grouping | `verified` | A Java-file `source` Code Action runs `sts/spring-boot/structure` with `{updateMetadata:true}` and renders Spring's default project/group hierarchy to the opt-in `.zed/spring-structure.md`. It includes a visible snapshot/stale warning, only links `location`/`reference` file URIs inside the worktree, caps output at 2,000 nodes/16 levels, deterministically replaces only a file with its versioned ownership marker, recreates after deletion, and never edits `.gitignore`; an unknown target is preserved with a notice before Spring is called. Contract tests cover those rules. **Driven on 2026-07-22** (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25.0.3): Spring returned the authentic project and default groups, Markdown preview rendered them, a request-mapping link opened `GreetingController.java`, explicit refresh retained SHA-256 `006ad20227f9e4a09a6c230382bc9411d2e15b81ab02b721cea666c1cf8d97d1`, and moving the file away then rerunning recreated the same bytes while `.gitignore` remained absent. Zed discarded the `#L16` fragment when opening that link, matching its Markdown Preview implementation, so Project Symbols remains the exact-location fallback. Custom visibility selection via `structure/groups` remains a later enhancement. Evidence: `tmp/structure-document-20260722-runtime/evidence/`. |
| Run / debug a Boot application | `verified` | The configure Code Action generates merge-safe `.zed/tasks.json` (wrapper-aware `spring-boot:run`/`bootRun`, portable `$ZED_WORKTREE_ROOT`-relative `cwd`, editable `env`) and `.zed/debug.json` (`"adapter": "Java"` launch with `mainClass`, `cwd`, and editable `vmArgs`/`args`/`env`). One base entry plus one per discovered Spring profile (from `application-<profile>.*` filenames and multi-document `application.{yml,yaml}` activation), capped at eight with the overflow named. Merge safety: create when absent, replace only its own labelled entries in plain JSON, and sidecar (never clobber) a commented or non-array file. **Driven checks verified on 2026-07-19** (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25): the generated run task's exact `mvn spring-boot:run` launched the Boot app and served `GET /greeting` (HTTP 200); a second check generated `dev`/`prod`/`staging` entries and launched the `dev` Java debug configuration after editing `vmArgs`, `args`, and `env`. The 2026-07-22 macOS 26.5.2 Maven multi-project gate then displayed `service-a`, `service-b`, and `All projects`; selecting all generated two task and two debug entries with the correct module `cwd` values and ran nothing automatically. Official Java's loopback main-class resolver requires system HTTP proxies to bypass `localhost`/`127.0.0.1`; its isolated-profile DAP helper path remains an S016 caveat. Gradle interaction and every non-macOS-arm64 desktop tuple remain untested. No route overwrites unknown configuration or starts a debug session programmatically. Evidence: `tmp/run-debug-gates-20260722/evidence/`. |
| Maven goal / Gradle build | `planned` | Build execution remains official Java/Zed task ownership under D003. S016 verified Maven main execution through `compile exec:java` and verified Gradle project coordination, but did not run a Gradle/vanilla task or Java test task. Under D006, prefer the installed official Java extension's wrapper-aware tasks only where matching runtime evidence exists; generate or merge reviewable `.zed/tasks.json` for arbitrary goals/builds or Spring-specific commands. Manual tasks remain fallback. Spring LS's direct `Runtime.exec` commands are not selected because they do not provide Zed task/terminal ownership. |
| Open Boot app page URL | `planned` | Preferred route: expose a standard Document Link or clickable Markdown URL in hover or the opt-in Live document. A Code Action that discovers a URL may present it through Zed's general `window/showMessageRequest` Markdown prompt, whose source routes link clicks through `open_url_or_file`; this companion still needs a driven desktop test. Zed's general LSP client does not advertise or handle `window/showDocument`, so copyable text is the required fallback. OS-specific opener tasks remain an excluded contingency unless public links fail and a separate cross-platform security/quoting gate supports them. |

## Workstream 5 — commands, upgrade, Modulith

| Capability | State | Notes |
| --- | --- | --- |
| Spring Boot upgrade | `planned` | Preferred route: a Code Action executes `sts/upgrade/spring-boot` and applies only reviewable workspace edits. If authentic upgrade needs unsupported multi-step UI or external content, stop before mutation and retain the manual upgrade workflow. |
| Modulith metadata refresh | `planned` | Preferred route: a Code Action selects a project, executes `sts/modulith/metadata/refresh`, and refreshes standard symbols or the opt-in Structure document. |
| Modulith projects | `planned` | Preferred route: Workspace Symbols provides search and an opt-in Structure document provides module/dependency grouping. Ordinary Java navigation remains fallback if metadata or links are incomplete. |
| Spring Initializr | `planned` | Not in this pinned VSIX; a separate VS Code extension provides it. It remains outside the selected runtime boundary until a distinct network, artifact, scope, and UX decision is accepted. External Initializr use is the fallback. |
| Explain SpEL / queries / AOP (AI assistant) | `planned` | `query.explain` and `sts/enable/copilot/features` are VS Code Copilot-bound. The current product enables and displays those titles regardless of Zed AI state, but Zed's public CodeLens/extension API exposes neither authoritative Agent-state detection nor direct Agent dispatch/prefill. The extension can provide only accurate blocked-action wording and must not send the prompt or source to AI. A future direct Agent workflow requires a new Zed API and an explicit privacy/consent update; it is not included in the current parity claim. |
| Embedded Spring Tools MCP server | `planned` | Spring Tools 5.2.0 contains an experimental streamable-HTTP MCP server with project, Spring index, component, endpoint, diagnostics, Spring-version and Spring.io tools; Zed supports remote MCP tools and prompts. Enabling a listening port and external Spring.io calls is a new runtime/network/security surface and requires an explicit decision before implementation or support claims. |

## Workstream 6 — settings, diagnostics, and lifecycle

| Capability | State | Notes |
| --- | --- | --- |
| Start Spring Boot Language Server on demand | `zed-native-equivalent` | `vscode-spring-boot.ls.start` is a VS Code client command, not a server request the coordinator receives. In Spring Tools' `Main.ts` it calls `client.start()` and then registers the classpath service, registers the Java-data service, and forces `sts.vscode-spring-boot.enableClasspathListening(true)`. Zed owns language-server start/restart (auto-start on opening a Boot file, restart via Zed's action — both exercised in M2), and the coordinator already performs the callback's work: it serves the classpath bridge (`sts/addClasspathListener`) and the Java-data methods (`sts/java*`), and sends `enableClasspathListening(true)` once the official Java route is ready. So the outcome is delivered without an on-demand command. Earlier "coordinator does not handle this client request" was a miscategorization: it is not a coordinator request. |
| Java type resolution for the server | `verified` | Observed 2026-07-18 on macOS arm64/JDK 25 with the development extension and Zed 1.11.3. `sts/javaType` is a server→client request (`@JsonRequest("sts/javaType")` on Spring Tools' `STS4LanguageClient`; the server calls `client.javaType(...)` from `JdtLsIndex`). During project indexing the Spring server issued a real `sts/javaType`, and the coordinator routed it to the official Java extension's `sts.java.type` command over the loopback route and answered it — observed as the coordinator's once-per-method success log `official Java data request sts/javaType answered` (emitted only after the loopback returns a result). Zed's own trace shows **no** `sts/javaType`, confirming the coordinator intercepts it before the editor; the pre-coordinator spike `s011`, where the request reached Zed and was rejected `-32601`, was the failure mode. `JavaTransport` maps this and eight sibling `sts/java*` methods to `sts.java.*`; the siblings share the path and contract test but were not each observed at runtime. Contract-tested (`Java data requests are answered through the official Java transport`). Evidence: `tmp/cav-verify-20260718/`. |
| Classpath listening | `verified` | `sts.vscode-spring-boot.enableClasspathListening` driven by the coordinator; observed registering and removing during the M2 gate run. The 2026-07-22 real-Zed recovery gate paused the isolated jdtls process, observed the unmodified official-Java proxy reject `addClasspathListener` after its five-second timeout, and observed bounded coordinator re-enablement with no compatibility notification; resuming the same jdtls PID produced `official Java classpath bridge registered` in the same session. **Install-ordering caveat**: if the extension is installed while a Java project is already open, `jdtls` does not pick up the bridge until Zed restarts; when the extension is present before the Java server starts it registers fine, cold cache included. See [S014](spikes/014-jdtls-bundle-startup-ordering.md). Evidence: `tmp/run-debug-gates-20260722/evidence/forced-timeout-arm4-*`. |
| Missing / incompatible Java diagnostic | `verified` | Observed on 2026-07-18 by driving the real coordinator process on incompatible inputs. A real Temurin 17.0.18 was refused with `JDK 21 or newer is required by Spring Tools`; a structurally invalid self-declared provider contract was refused with `official Java compatibility contract is invalid` before the JDK check. Both exited nonzero with no reduced mode; a compatible Temurin 21.0.11 control passed both guards and launched the real Spring server. Absent-Java path observed earlier in M2. D006 now makes the installed extension release non-gating; contract coverage and the 2026-07-19 CodeLens run both exercised the release-unpinned structural route successfully. Actual required-capability failures now produce a persistent clickable Markdown notification with an allowlisted title/body-prefilled GitHub report. The diagnostic Zed-to-browser gate opened a populated composer without submission; contract tests tie that UX to real failure paths. Evidence: `tmp/m2-step7-incompatible-java-20260718/`, `tmp/codelens-runtime-20260719.udLvyE/evidence/`, and R016. |
| Embedded language syntax highlighting | `blocked-zed-api` | Setting `boot-java.embedded-syntax-highlighting`; the VSIX contributes four grammars. D005 preserves official Java highlighting and excludes Java query replacement from the baseline. **Settled negative on both paths ([S017](../spikes/017-static-semantic-token-declaration.md), driven 2026-07-21).** Dynamic first: after Spring registers `textDocument/semanticTokens` through `client/registerCapability` — even after `workspace/semanticTokens/refresh` — Zed 1.11.3 issues no semantic-token request. That is not a client-capability gap; Zed's `initialize` advertises `semanticTokens` with `requests.full.delta`, the full legend, `dynamicRegistration: true`, and `augmentsSyntaxTokens: true`. Static next: the coordinator declared `semanticTokensProvider` with Spring's captured legend in the `initialize` result and consumed Spring's dynamic registration (the adaptation that fixed Code Actions), the declaration reached Zed, `GreetingRepository.java` was the focused Java buffer, and Zed still issued **zero** `textDocument/semanticTokens/*` requests. Decisive control: **jdtls, the primary Java server, declares its own `semanticTokensProvider` statically and Zed ignored that too** — so the missing surface is Zed's semantic-token request/render path for Java, not registration timing. Tree-sitter Java highlighting stays intact as the supported fallback (the `@Query` JPQL block renders as a plain string). The opt-in Java query pack remains an independent tree-sitter route needing its own direction decision. Evidence: `tmp/s017-static-semantic-tokens-20260721/evidence/` (baseline in `tmp/ws2-language-intelligence-20260721/evidence/trace-baseline.log`). |
| Java Spring diagnostics and quick fixes | `planned` | Preferred route: pass reviewed `boot-java.java.reconcilers`, Boot 2/3/4, AOT, and `boot-java.scan-java-test-sources.on` settings and surface standard diagnostics/Code Actions. The pinned release registers more than two dozen Java reconcilers; representative families must be tested independently and a failing reconciler disabled without weakening unrelated diagnostics. |
| Spring Boot version/support validation | `planned` | The server validates Boot/Cloud compatibility, OSS/commercial support ranges and available major/minor/patch updates, with build-file diagnostics and upgrade actions. Preferred route is native diagnostics and reviewable Code Actions. Network/source freshness and workspace-edit behaviour require explicit runtime tests. |
| Spring AI annotation diagnostics and indexing | `planned` | The server indexes `@Tool` and Spring AI MCP annotations and diagnoses missing/short descriptions. Preferred route is standard diagnostics, Code Actions where offered, and Project Symbols; this does not require enabling the embedded MCP server. |
| Offline behaviour | `planned` | Preserve the checked artifact cache, compatibility diagnostics, and fail-closed provider behavior. S016 verified one warm cached startup with outbound network denied for official Java 6.8.23 on macOS arm64/JDK 25. D006 removes exact release admission, while rollback, first-install offline behavior, and other platform evidence remain planned; see `LIMITATIONS.md`. |

## Maintenance

- Bump the inventory version and re-derive when the pinned Spring Tools release
  moves. State recorded against one release does not carry to another.
- A state changes only with evidence. `verified` requires a named tuple.
- A `blocked-*` state requires the exact missing surface, not a general claim,
  and requires that no Zed-native surface delivers the outcome. "We cannot build
  that exact VS Code widget" is not a blocker; name the capability by outcome.
- Update this file in the same change as the slice that moves a state.
