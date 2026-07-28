# M4 capability delivery plan

- Status: Route selection complete; every route below has been taken or settled,
  and M4 closed on 2026-07-26. All three rows that awaited a direction decision
  were decided on 2026-07-29 — the embedded MCP server was built and verified
  the same day — leaving only the four that name a missing Zed client surface.
  Every route is now evidenced on Gradle as well as Maven except the Boot
  upgrade, which upstream gates on Maven. This document stays the route
  record — read it to learn why a capability is delivered the way it is, and
  update it if a new Zed release reopens one
- Last updated: 2026-07-29
- Decision: [D005](decisions/005-lsp-first-capability-delivery.md)
- Evidence: [R013](research/013-zed-native-capability-delivery-surfaces.md),
  [R014](research/014-final-upstream-capability-surface-audit.md), and
  [R019](research/019-zed-codelens-agent-navigation-and-build-output.md)
- Inventory authority: [capability-inventory.md](capability-inventory.md)

## How to read this plan

This document keeps four route classes visible:

1. the **primary route**, which is implemented first and is the normal user path;
2. a **companion route**, implemented with the primary only when it serves a
   different context instead of duplicating the same interaction;
3. the **current baseline or conditional fallback**, preserved with a named
   activation gate when the preferred route has meaningful feasibility,
   platform, safety, or usability risk; and
4. an **excluded contingency**, recorded for later reference but not implemented
   without a new direction decision.

The preferred route is additive. A failed experiment does not remove a verified
fallback, and no score below is a support claim. Scores are planning confidence
for the route on stock Zed; only the capability inventory can mark a capability
`implemented` or `verified`. A fallback entry is not a commitment to build both
paths. It must state when it activates and what capability is lost. Conversely,
Run/Task/Debug and Hover/prompt/document links may be companions because they
cover genuinely different workflows.

## Multi-surface product policy

| User outcome | Primary route | Companion delivered when justified | Conditional fallback | Excluded contingency |
| --- | --- | --- | --- | --- |
| Discover and invoke Spring operations | Contextual standard Code Actions, reachable through Zed's Code Actions command/picker | CodeLens for a small high-frequency source-local subset; Task Picker for execution; Debug UI for debugging | Generated candidate/Live document when a bounded selection cannot fit the standard prompt; documented manual operation when no safe interaction exists | Extension slash command or arbitrary top-level Command Palette contribution |
| Run, build, and debug | Compatibility-tested official Java runnable for a matching Java main/test action | Reviewable `.zed/tasks.json` for Spring-specific or parameterized execution and `.zed/debug.json` for debugging | Existing manually authored task/debug configuration and the last supported official-Java tuple | Private `ScheduleTask`, invisible Spring LS `Runtime.exec`, or programmatic debug start |
| Reach an application or endpoint URL | Standard Document Link or Markdown link in hover/generated content | Clickable Markdown in a bounded `window/showMessageRequest` result when an action produces the URL | Always-visible copyable URL text | General `window/showDocument`; an OS-specific `open`/`xdg-open`/`start` task is only a future contingency after a cross-platform security/quoting spike |
| Inspect the current file and worktree structure | Project Symbols for worktree search; S015 Refuted LSP Document Symbols as the supported current-file route because restart can omit Java symbols | Opt-in Structure document for project-wide hierarchy/grouping | Retain Project Symbols and use the Structure document for Spring-only grouping; a future stock-Zed refresh fix may reopen the Outline gate | Extension-owned tree/panel, Project Symbols name encoding, or Java language replacement without a new decision |

The Code Actions menu is the closest public integrated Spring menu: Zed composes
runnable tasks, LSP Code Actions, and available debug scenarios in that source
context. This is an implementation opportunity, not yet a runtime support claim
for a combined Spring row. Direct top-level extension actions remain unavailable.

### When to implement a fallback

| Condition | Required treatment |
| --- | --- |
| A verified or already-usable baseline exists | Preserve and regression-test it while developing the primary; do not remove it merely to simplify the new route. |
| The secondary route has an independent user purpose and shares the same operation/state model | Implement it as a companion in the same or an adjacent slice. |
| The primary has a substantial runtime/platform uncertainty, roughly reflected by confidence at 4/5 or below | Record the fallback, trigger, degraded result, and experiment now. Implement the duplicate route only after the gate fails, unless it is very small or independently useful. |
| Failure would strand the user after mutation, connection, launch, or credential handling | Implement and verify the recovery/manual path before promoting the primary, regardless of confidence score. |
| The alternative crosses a private API, ownership, security, or new-runtime boundary | Keep it as an excluded contingency; a failed primary does not authorize it automatically. |

The confidence threshold is triage guidance, not an automatic formula. Evidence,
blast radius, implementation cost, and whether the fallback really preserves the
user outcome take precedence.

## Product layers and fallback order

1. Keep D003's official-Java ownership and D004's product processes unchanged.
2. Prefer an existing standard LSP surface: completion, hover, diagnostics,
   navigation, document/workspace symbols, Code Actions, CodeLens, or inlay hints.
3. Adapt allowlisted Spring client protocols inside the existing coordinator when
   Spring's VS Code client used a custom command or notification.
4. For workspace-wide structure, live metrics, and logger tables, offer a
   regenerable Structure/Live Markdown or JSON document only after an explicit
   user Code Action. Never silently add it to source control or edit `.gitignore`.
5. If an enhanced route fails its runtime gate, retain the baseline in the table
   below and keep the capability `planned` rather than claiming a degraded result.
6. Do not replace the official Java language registration. A Java query pack is
   outside the baseline and may be reconsidered only as a separately selected,
   opt-in experiment.
7. Reuse a compatibility-tested official Java task when it exactly matches a
   main/test action. Generate a Zed task only for a Spring-specific or otherwise
   unmatched command, and keep every generated task reviewable.
8. Share one coordinator operation and state model across every companion UI.
   Do not implement separate Spring business logic for Code Action, CodeLens,
   task, hover, or generated-document entry points.

## Capability routes

| Capability and outcome | Current baseline / fallback | Preferred route | Fallback trigger and result | Confidence |
| --- | --- | --- | --- | ---: |
| Properties/YAML completion, hover, and validation — recommend keys and values, show documentation, and diagnose invalid configuration | Preserve the verified Spring LS standard-LSP path. | No replacement; continue standard completion, hover, diagnostics, and definition. | Any regression stays on the last compatibility-tested Spring/Java tuple. | 5/5 |
| Property conversion and metadata reload — convert properties and YAML and reload shared metadata | Delivered: all three commands are `verified`. Manual editing and a server restart remain the fallback. | Route taken: `source` Code Actions execute the Spring command and let the server drive the workspace edit. Reload additionally required passing the user's `boot-java.common.properties-metadata` through, since the server no-ops without it. | Both gates passed on 2026-07-20 (Zed applied the create edit; the reload cleared one key and left a control diagnostic). No fallback was activated. | 5/5; gates closed |
| Per-file Spring Outline — show the current file's beans, endpoints, and components hierarchically | Preserve verified Project Symbols as the navigable fallback. | S015 Refuted enabling Zed's LSP Document Symbols setting as a supported route: the normal merge is usable, but restart can cache Spring-only results and lose Java symbols. Reopen only after a stock-Zed refresh fix passes the same gate. | The fallback trigger fired. Keep Project Symbols and use the planned Structure document for Spring-only grouping. | 5/5; fallback selected by runtime gate |
| Project-wide Spring structure — browse beans, endpoints, configurations, and grouping across the worktree | Preserve verified Project Symbols and direct source navigation. | Keep Project Symbols for search and add an opt-in generated Spring Structure document for stable grouping and refresh. | If safe generation, refresh, or navigation cannot be proven, Project Symbols remains the supported equivalent. | 4/5 |
| Bean and endpoint navigation — jump from Spring elements and request mappings to source | Preserve verified Workspace Symbols plus official Java definition, references, and implementations. | Combine the same surfaces with links from Outline or generated documents. | Links may be omitted without losing the verified symbol-search path. | 5/5 |
| CodeLens — show endpoint/configuration/query summaries plus live bean, injection, and startup status | Both the live slice and all five static provider families are `verified` on the first macOS tuple. Project Symbols and hover retain navigation and detail. | Preserve Spring commands, translate source locations, merge version-matched `sts/highlight`, and keep unavailable client-only facts visible with precise explanations. `CL-4d` asynchronously pre-resolves Spring's authentic AOT target, caches it by source version/arguments, refreshes CodeLens, and rewrites the action to `editor.action.goToLocations`. AI-only titles state that this extension cannot detect or invoke Agent and sends nothing to AI. | The 2026-07-19 gates passed, including one-click generated-method navigation with ignored `/target/`. Failed target resolution falls back to an exact URI/line notice. Hover and URL client commands retain their documented native/manual fallbacks because Zed exposes no project-side action bridge. | 5/5 |
| Inlay hints — render human-readable cron information and other compact inline facts | Preserve the verified standard-LSP inlay-hint path. | Extend only when another Spring result maps naturally to an inlay hint. | Disable individual hint classes that become noisy or stale. | 5/5 |
| Quick fixes and Code Actions — repair Spring code and create metadata | Preserve the verified Spring Code Action and ApplyEdit path. | Add synthetic project, run/debug, live-data, conversion, and refresh actions around allowlisted Spring commands. | An action without a safe standard-LSP interaction remains `planned`; existing quick fixes are unaffected. | 5/5 |
| Boot project discovery — find executable main classes and modules | The coordinator's GAV callback and generated-configuration workflow are verified on the macOS arm64/Maven tuple. | Route taken: invoke executable projects from a Code Action, let the user select one discovered project or `All projects`, then generate reviewable configuration. `bootProjectInfo` has its own per-file Code Action, verified 2026-07-26 across a four-generation Maven fixture; it is a companion, not a duplicate, because it answers for the current file and carries the build tool, Boot version, and JRE that the workspace-wide list does not. | The bounded Zed prompt passed its multi-project gate; a generated candidate document was not needed. Other build tools and desktop tuples remain untested. | 5/5; interaction gate closed |
| Run and debug — launch, stop, or debug a Spring Boot application | The generated task and official-Java DAP routes are verified on macOS arm64/Maven, including a two-module `All projects` selection. Users may still author `.zed/tasks.json` and `.zed/debug.json` manually. | Route taken: generate or merge explicit Run tasks and Debug configurations when project choice, profiles, arguments, or debugging requires them; the user starts the selected Zed task or Debug entry. Reuse the installed official Java extension's matching main runnable when that route has the required evidence. | Never overwrite unknown configuration or assume a runnable becomes a debug scenario. On capability or merge failure, retain manual configuration and offer a bounded user-reviewed compatibility report where applicable. | 5/5 on tested tuple; platform/build-tool matrix remains |
| Maven and Gradle execution — run a goal, task, or build | Official Java and manually authored Zed tasks remain the ownership boundary. S016 verified Maven main execution and Gradle coordination, not Gradle/vanilla task execution or test tasks. | Route settled by the pinned source: Spring exposes no arbitrary-goal surface and no reachable Gradle build at all, so only its one AOT Maven goal needs a route. The coordinator answers `sts.maven.goal` and `sts.gradle.build` itself and writes one reviewable wrapper-aware `.zed/tasks.json` entry the user starts, rather than letting Spring's `Runtime.exec` handler build invisibly — a 2026-07-24 direct drive showed that handler reporting nothing on success, discarding Maven's diagnostic on failure, and hanging past 300 s on a 5-second build whose output filled the undrained pipe. | Declined arguments write nothing and say so; an unparseable `tasks.json` still gets a sidecar. Everything outside that one goal stays official-Java/manual task ownership, not a product route. On the 2026-07-24 macOS arm64 tuple, `CL-4a` wrote the reviewable task, Zed's `task: spawn` picker ran it with visible `BUILD SUCCESS`, and the authentic repository JSON appeared under `target/spring-aot`; `CL-4e` then rewrote the same task without starting Maven. | 5/5; driven Zed gate closed |
| Local process connection — connect, show, refresh, or hide live data for a running Boot process | `verified` on the 2026-07-23 macOS arm64 tuple. The pinned VS Code show/hide/refresh commands are client wrappers around the same Spring connect/disconnect/refresh operations, so the explicit Zed workflow is the recorded native equivalent. No reduced connection mode is claimed. | A Code Action runs `sts/livedata/listProcesses`, presents a bounded Zed message choice, executes the descriptor's own connect/disconnect/refresh action, and keys connect success off the `sts/liveprocess/connected` notification with coordinator-owned connection state and cleanup. The extension enables Spring's false-when-absent explicit local-process discovery; automatic connection remains a separate opt-in route. | The driven Boot 3.5.5/JMX gate connected, exposed refresh/disconnect, refreshed CodeLens, disconnected and closed JMX. If the process list exceeds a usable prompt or identity is ambiguous, use the opt-in Live document; a failed connect is reported as a bounded request, never a false success. | 5/5 on tested tuple; platform matrix remains |
| Automatic local connection — connect live data after a matching Java debug launch | `verified` on the 2026-07-23 macOS arm64 tuple. The default remains off, and the verified explicit process Code Action remains the fallback. | When `boot-java.live-information.automatic-connection.on` is explicitly true, generated Java debug entries add reviewable local-management/project identity properties. The coordinator serially polls Spring's local Attach descriptors, reconciles their project name against authentic executable Boot projects, and reuses the verified notification-confirmed connect path only for exactly one distinct match. | Missing/unsafe identity, unrelated JVMs, or multiple matching runs connect nothing; the user retains the explicit bounded selection. The driven Zed Java-debug gate automatically connected the matching Boot 3.5.5 process, delivered live data, honored manual disconnect without reconnection across later polls, and cleaned up on debug stop and Zed exit. | 5/5 on tested tuple; platform matrix remains |
| Remote connection — connect to a remote Actuator/JMX target | `verified` on the 2026-07-24 macOS arm64 tuple against a Boot 3.5.5 HTTP-Actuator target, driven both directly against the pinned server and end to end through real Zed on an isolated profile; the target was localhost and only the `http` branch was exercised. The application's own Actuator UI remains the fallback. | Route corrected: the preferred `sts/livedata/remoteConnect` Code Action is **not** taken, because no VS Code code path calls that command (it is Eclipse Boot Dash's, and it replaces an owner's whole app set rather than connecting one). VS Code's only remote route is the `boot-java.remote-apps` settings array, which the extension's existing passthrough already delivers unchanged; declared targets then appear in the verified explicit process action and the Live data document. | `RemoteBootAppData` has no credential field, so the extension never prompts for or stores one. Because Spring derives the process key and fallback label from the user's `jmxurl`, URL userinfo is stripped from every rendered label while the raw key round-trips to Spring; host and port survive so the target stays identifiable. Absent settings mean no remote targets — the extension never ships its own array. | 4/5; driven gate open |
| Live hover and inline data — show runtime bean or endpoint information at source | Source-local bean, injection and endpoint facts are verified as live CodeLens plus native Hover; aggregate metrics and logger aggregation/level changes are separately verified. | Keep versioned live results in standard CodeLens and use Zed's composed Hover for detail until a one-click client-command bridge exists. | Reject old document versions, explain unavailable VS Code-only commands, and retain static Spring hover/Project Symbols when disconnected. | 4.5/5 |
| Metrics — inspect memory and request/runtime measurements | The bounded Live-document route is `verified` on the 2026-07-23 macOS arm64 tuple; users may still use the application's own Actuator UI. | A Java source Code Action selects an already-connected process, explicitly refreshes memory/GC families, and writes finite, timestamped heap/non-heap/GC measurements to the owned `.zed/spring-live.md` without process keys or metric tags. | Contract tests closed the interaction, freshness, ownership, output-bound and persisted-identifier gates. The driven Boot 3.5.5/JMX run proved authentic values, rendered preview, refresh and deletion/recreation. Actuator remains the fallback and other desktop tuples remain untested. | 5/5 on tested tuple; platform matrix remains |
| Loggers and log levels — list loggers and change a running level | `verified` on the 2026-07-23 macOS arm64 tuple; users may still use Actuator directly. | Route taken: append a bounded read-only logger snapshot to the opt-in Live document, and expose a separate Java source Code Action with paged logger selection, a server-advertised level, final confirmation, and success keyed to the matching `sts/liveprocess/loglevel/updated` notification. | The driven Boot 3.5.5/JMX gate rendered 861 authentic entries with an exact 512-entry bound, changed `ROOT` only after confirmation and matching update, verified the refreshed `DEBUG` state, and restored `INFO`. Omitted entries and an unavailable endpoint still fall back to Actuator; dismissal, disconnect, timeout, and mismatched updates fail closed. | 5/5 on tested tuple; platform matrix remains |
| Boot Dashboard outcomes — discover applications, see state, and reach run/debug/connect/stop actions | Preserve Project Symbols, manually configured Debug UI, and existing terminal/process workflows as separate fallbacks. | Compose Structure/Live documents, Code Actions, Zed Debug UI, and status-bearing inline surfaces; do not claim a custom panel. | Each sub-capability falls back independently; absence of a panel does not erase verified navigation or manual run/debug. | 3.5/5 |
| Open application URL — reach a running app or endpoint in a browser | Capability is now `verified` through the request mapping's Hover: for a non-VS Code client Spring already renders a plain clickable Markdown URL there, and Zed opens it via `open_url_or_file`. | Route taken: no product code for the primary Hover link. A `showMessageRequest` companion for the CodeLens click path was prototyped, driven, and reverted (Zed exposes no toast-persistence control); the existing CodeLens notice instead guides the user to the Hover link. Driven 2026-07-25 on macOS arm64/Zed 1.12.0: the Hover over `@GetMapping` showed the clickable `http://…:8080/greeting` link and a Zed-rendered link to it opened the browser to the running app. | Copyable text remains the fallback where a link cannot render. An OS-specific opener task is recorded only as a future contingency and requires a separate cross-platform security/quoting gate. | 4/5; verified via Hover |
| Spring Boot upgrade — update the Boot version and apply migration edits | Capability is now `verified` for the patch upgrade the pinned release actually implements; manual editing of the build file remains the fallback. | Route taken: no product code for the upgrade itself. Spring's own version-validation quick fix executes `sts/upgrade/spring-boot` and the server drives a `workspace/applyEdit` on the build file, so the existing forward-and-apply path delivers it. The pinned release is patch-only (its own asserts reject other jumps), never offers the major/minor OpenRewrite conversion (`getNearestAvailableMinorVersion` returns empty), and is Maven-gated: `UpdateBootVersion.canProvideQuickfix` tests the build type before attaching the action, so a Gradle project keeps the diagnostic and the release-notes action and never sees the upgrade one. This is the Gradle axis's one declared Maven-only limitation. The pom inlay hint carrying the same command renders but is inert, because stock Zed does not execute `InlayHintLabelPart.command`; the quick fix at the top of the build file is the supported route. | The one product change is failure visibility: Spring throws before mutating anything when OpenRewrite finds no Maven settings file, and Zed shows nothing for a failed command, so the coordinator reports a bounded error naming the target version, the untouched build file, and the `~/.m2/settings.xml` remedy — without the Java stack trace. Driven 2026-07-25 both ways: the notice with no settings file, the completed `3.5.0`→`3.5.16` edit with one. | 5/5 on tested tuple; patch-only by upstream design |
| Version and support validation — diagnose Boot support ranges and available updates on the build file | Capability is now `verified` on the 2026-07-25 macOS arm64 tuple; the build file itself remains readable without it. | Route taken: no product code and no settings for the diagnostics. Spring publishes them as ordinary build-file diagnostics anchored at the file's first character, and every default severity in the pinned release already equals the VS Code schema default, so nothing has to be supplied. A four-module fixture (Boot 4.0.6, 3.5.5, 3.3.5, 2.7.18) drew patch and minor updates, both OSS branches, the expired-commercial diagnostic, and — correctly — nothing for the three `IGNORE` defaults. | The one product change: the two link quick fixes (release notes, Tanzu commercial support) execute `sts/show/document` for an external page, which stock Zed cannot open. The coordinator now renders the address as a bounded Markdown link in a dismissible notice and reports the request handled, so Spring no longer adds a `Failed to open:` error and the file-oriented CodeLens advice no longer appears on a web page. | 5/5 on tested tuple; Spring Cloud compatibility closed 2026-07-26 on a spring-cloud-commons 4.1.6 / Boot 3.5.5 pairing |
| Modulith — inspect application modules and refresh their metadata | Route taken and `verified` 2026-07-26. Inspection needed no new surface: the opt-in Structure document already renders Spring's `ModulithStructureView` for any spring-modulith project, with `(API)`/`(internal)` named-interface marks, and the application-module violation diagnostic is standard LSP. Refresh is a `source` Code Action chaining `sts/modulith/projects` → bounded `showMessageRequest` → `sts/modulith/metadata/refresh`, reporting nothing of its own because `ModulithService` emits its own outcome message. | Workspace Symbols remains available for search; ordinary Java navigation remains the fallback when metadata is incomplete. | Metadata generation runs Spring Modulith's exporter against compiled classes, so an uncompiled project is refused by the server with its own error — a precondition, not a Maven one: a 2026-07-29 Gradle gate refreshed metadata on a Spring Modulith Gradle project after `./gradlew classes`. | 3/5 |
| Spring XML and Java reconcilers — analyze XML configuration and additional Java sources | Both halves are now `verified`; the Spring AI annotation row closed in the same run. | Route taken for XML: XML already reaches the server through the `xml` language id, the opt-in master switch stays user-controlled, and the extension supplies the `content-assist`, `hyperlinks`, and `scan-folders` sub-defaults that read off/empty when absent — closing the same silent-gap trap as `jpql`/`inject-bean`. Driven 2026-07-22: with only `on: true` user-set, reconcile diagnostic, XML symbol scan, class/property completion, and property→source definition all fired on the named macOS tuple. **Java reconcilers took no route at all**, because reading the pinned server first showed there was nothing to supply: `problem-types.json` carries every category toggle and all 71 problem-type severities, and each one already equals the VS Code schema default, while `boot-java.java.reconcilers` is the rare boolean whose absent-key default is already `true`. Driven 2026-07-26: 28 problem types across boot2 (all 17), boot3, boot4, spring-aot and spring-ai, plus both quick-fix engines (`…jdt.refactoring` and `org.openrewrite.rewrite`) applied through Zed's own code-action menu. | Disable only the failing reconciler and preserve the rest of Spring LS — proven at both granularities on 2026-07-26 through the settings passthrough alone: a category toggle set to `OFF` removed every boot2 diagnostic while boot3/boot4/spring-ai kept firing, and one `spring-boot.ls.problem.boot2.<CODE>` set to `IGNORE` removed that diagnostic while its file's other two stayed. | 5/5; driven gates closed |
| `spring.factories` and JPA query files — classify special Spring files for completion and validation | Delivered: both are `verified`. Ordinary Properties behaviour is untouched for every other `.properties` file. | Route taken: distinct Zed languages on a pinned `tree-sitter-properties` grammar, mapped to the Spring language IDs `spring-factories` and `jpa-query-properties`. The open question — filename or language ID — resolved to **language ID**, so the grammar cost was unavoidable. | The 2026-07-20 gates passed: both IDs reached the server and Spring returned `JPQL_SYNTAX` on the broken named query. Java ownership is unchanged. | 5/5; gates closed |
| Embedded syntax highlighting — highlight SpEL, JPQL, and query fragments inside Java strings | Preserve official Java highlighting without Spring-specific embedded grammar. | S017 closed the stock-Zed route negatively on 2026-07-21: Zed issues no semantic-token request after either dynamic or static registration, including jdtls's own static provider. A future opt-in Java query pack is an independent tree-sitter alternative and requires a new direction decision. | The fallback is the supported state: official Java tree-sitter highlighting renders these strings correctly; only token-level colouring inside them is lost. Never risk the whole Java language registration for this enhancement. | 2/5; blocked on Zed's Java semantic-token request/render path |
| Spring Initializr — create a new Spring project | It is outside the pinned VSIX capability surface and current runtime boundary. | **Decided 2026-07-29: `not-pursued`.** A separate VS Code extension owns project generation upstream, so there is no Spring Tools behaviour here to adapt and it was never inside the parity target. Building it would add outbound `start.spring.io` calls, archive extraction into the user's filesystem, and a scaffolding UX that nothing else here has. | Out of scope as a documented exception; `start.spring.io` or the `spring` CLI produces the same project without the editor. A reversal needs its own network, artifact, scope, and privacy decision. | n/a — decided out |
| AI explanations — explain SpEL, queries, and AOP behavior | The pinned command is VS Code Copilot-specific. The provider is enabled by this product regardless of Zed AI state, while the command is intercepted locally. | **Decided 2026-07-29: `blocked-zed-api`**, not `planned`. The route is unchanged — keep the requested lens visible with wording that says the extension cannot detect or invoke Zed Agent and sends no source/prompt to AI — but what is pending is a Zed API, not a slice: no Agent-state detection and no Agent dispatch or prefill exist to build against. | Manual analysis or a separate user-initiated Agent request. Do not imply conditional integration, auto-submit a prompt, or include the result in the current extension parity claim. Revisit only if Zed exports a user-consented Agent action/state API, and treat transmitting the user's source as its own privacy decision. | 2/5; blocked on Zed's Agent action/state surface |
| Offline, compatibility, and diagnostics — reuse artifacts, explain Java/Spring incompatibility, and report contract breaks | Preserve the current coordinator, adapter contract, checked artifact cache, and verified failure diagnostics. The offline half is now `verified` 2026-07-26 and needed no product code: the existing checksum-first install path already delivers it. | Attempt known capabilities independent of the installed official-Java release string. On a required-capability failure, show a bounded prefilled public GitHub issue for user review and submission; keep security reports private. | Never start a misleading reduced mode, submit telemetry or an issue automatically, handle a GitHub token, or include paths, classpaths, source, environment, credentials, or raw logs in the report. With outbound network denied, a first install fails closed with the pinned release and artifact URL named and leaves no partial state, a warm install runs the whole product, a corrupt installed jar is repaired from the checked archive without a download, and only version/support validation degrades — to an empty diagnostic publish, never to stale advice. | 5/5 offline on the tested tuple; the reporting half keeps its own gates |

## Cross-cutting gates

- **Evidence:** the inventory state changes only after implementation and, for
  `verified`, a driven run on a named tuple.
- **Configuration ownership:** generated `debug.json`, `tasks.json`, Structure,
  or Live content must be opt-in, merge-safe, regenerable, and secret-free.
- **Freshness:** live data and generated documents carry source identity and a
  timestamp; stale data is hidden or marked, never silently presented as current.
- **Security:** remote credentials require a separate reviewed storage/input
  design. Project files, generated documents, normal logs, and Code Action
  arguments must not contain them.
- **Fallback preservation:** a preferred route cannot remove a verified fallback
  until the replacement has stronger evidence on the same compatibility tuple.
- **Fallback activation:** do not pre-implement a conditional fallback solely
  because the primary is unverified. Implement it when its named gate fails, or
  earlier only when it is independently useful and therefore reclassified as a
  companion.
- **Upstream compatibility:** attempt a newer official Java extension with the
  known adapter and accept it when required runtime capabilities work. Exact
  release strings are diagnostic evidence rather than gates. New upstream tasks
  remain candidates until their user-visible behavior has runtime evidence.
- **Platform scope:** all new routes stay `untested` outside the declared matrix
  until driven there.

## Immediate order

Items 1-3 of the previous order are complete and their rows are `verified` in the
inventory: CodeLens/compatibility, Boot run/debug configuration generation, and
the properties line (conversion, shared-metadata reload, and the two Spring file
languages). The 2026-07-21 run then closed the verification-shaped part of WS2 —
cron completion/validation, Spring-aware Java completion across six families, and
all four request-mapping snippets are `verified` — and settled the semantic-token
question below. What remains:

1. Run/debug's remaining macOS arm64/Maven interaction gate is closed. On
   2026-07-22 Zed displayed two discovered modules plus `All projects`, generated
   two task/debug pairs, and ran nothing automatically. The same session forced
   official Java's five-second bridge timeout, kept the compatibility notice
   suppressed during bounded retries, and registered the bridge after the same
   jdtls process resumed. Gradle is no longer untested here: a 2026-07-29 gate
   generated and then **executed** the `./gradlew bootRun` entries, base and
   `dev`, with the profile moving the served port. The Windows wrapper forms and
   other desktop tuples remain untested rather than blocking this named-tuple
   result.
2. The opt-in Structure-document prototype passed its macOS arm64 driven gate.
   Its Java-file source action renders Spring's authentic default hierarchy to
   the owned, regenerable `.zed/spring-structure.md`; real Zed opened its
   worktree-only source links, refreshed byte-identically, and recreated the
   document after deletion without creating `.gitignore`. Zed 1.11.3 discards a
   linked file's `#L…` fragment, so Project Symbols remains the exact-location
   fallback. Custom `structure/groups` visibility selection remains a later
   enhancement rather than part of this verified default-group prototype.
3. Take WS2's remaining language-intelligence rows. Spring XML config is now
   `verified`: its master switch `boot-java.support-spring-xml-config.on`
   defaults false in VS Code too, so it stays genuinely opt-in and is not
   forced on, but the three sub-settings (`content-assist`, `hyperlinks`,
   `scan-folders`) read off/empty when absent while VS Code's schema defaults
   them on, so the extension supplies them — otherwise `on: true` yields an
   inert feature. This is the same silent-gap trap as `jpql`/`inject-bean`.
   The 2026-07-22 driven run closed the gate on macOS arm64/Zed 1.11.3 with
   sweetppro/zed-xml: with only `on: true` user-set, the four keys reached the
   server, `beans.xml` opened as `languageId: xml`, and all four gates fired
   (SpEL reconcile diagnostic → `on`; 1 XML scanned/1 bean symbol →
   `scan-folders`; class + property completion → `content-assist`;
   property→source definition → `hyperlinks`). Spring-specific references and document highlights **split** on the
   composition question, settled by [S018](spikes/018-references-highlights-multiserver-composition.md)
   and its U4 follow-up (driven 2026-07-21/22): `textDocument/references`
   fans to both servers and Zed **unions** the results. The qualifier→bean,
   property→properties-file, and distinct `@Named` injection→bean targets are
   now verified, so the references route needs no coordinator merge code.
   Profile- and application-event-specific result content remains undriven.
   `textDocument/documentHighlight`, by
   contrast, goes to the single primary server (jdtls); Spring is never queried,
   so the Spring-specific highlight slice is `blocked-zed-api`, the same class
   as the S017 semantic-token result. Do not build coordinator highlight code.
   **SpEL is now `verified` too, and closed with no product code.** A source
   read narrowed the row to diagnostics and `@Value` navigation — semantic
   tokens stay refuted below, and the pinned release has no SpEL hover provider
   — and the settings audit found nothing to send, because
   `boot-java.validation.spel.on` falls back to its own `ON` default when the
   key is absent, matching VS Code's schema. The 2026-07-24 driven run published
   SpEL syntax, property-placeholder syntax, and one
   `@EventListener(condition = …)` diagnostic, the last proving the reconciler
   covers the whole `SPEL_EXTRACTORS` set rather than `@Value` alone; Go to
   Definition then returned both navigation shapes, bean reference and method
   reference on a bean. That gesture extends the composition answer to a third
   request type: `textDocument/definition` fans out to both servers and unions,
   like `references` and unlike `documentHighlight`, so no coordinator merge
   code is needed there either. **Spring Data query intelligence, the last WS2
   row, is now `verified` — and it too closed with no product code.** `jpql` was
   already sent and the audit found nothing else to supply:
   `boot-java.validation.data-query` falls back to its own `ON` default and
   `codelens-over-query-methods` is already in the default configuration. The
   2026-07-24 driven run published `HQL_SYNTAX` on a broken `@Query`,
   `SQL_SYNTAX` on the `nativeQuery = true` form — the grammar is chosen from
   project dependencies, Hibernate for HQL and H2 for the PostgreSQL parser, not
   from the annotation — and a third diagnostic on a bare
   `entityManager.createQuery(…)`, which shows the reconciler visiting
   `MethodInvocation` as well as annotations. Go to Definition then resolved both
   query-parameter shapes, `?1` and `:message`, to the method's own parameter,
   and a caret inside a derived query method name returned Spring's property and
   predicate-keyword proposals alongside jdtls's. Three residual limits are
   recorded in the inventory rather than smoothed over: a transient upstream NPE
   truncated the *first* cold-start reconcile to two of the three diagnostics
   (any edit re-publishes all three), the `Add @Query` code action needs Spring
   Data JPA ≥ 4 so it cannot appear on the Boot 3.5.5 fixture and is covered as
   the `CL-4` refactoring, and the MySQL/MariaDB SQL branch is untested.
4. The semantic-token spike is **closed, refuted** ([S017](spikes/017-static-semantic-token-declaration.md),
   driven 2026-07-21). Both halves failed: Zed requests nothing after Spring's
   *dynamic* registration, and — the decisive part — nothing after a *static*
   `semanticTokensProvider` declaration in the `initialize` result either,
   including jdtls's own static declaration. Zed 1.11.3 has no semantic-token
   request/render path for Java, so the *Embedded language syntax highlighting*
   row is now `blocked-zed-api`. SpEL and embedded-query diagnostics, hover and
   navigation stay in scope as ordinary LSP; only token-level colouring was
   gated on this answer, and it is now settled negative.
5. The first live-data connection, show/hide/refresh equivalent, aggregate
   metrics, and logger slices are closed on the connected-Boot macOS tuple.
   The pinned VS Code show/hide/refresh commands only wrap Spring's same
   connect/disconnect/refresh operations for its active debug app; Zed's
   explicit process/action choice covers that result without duplicating the
   client wrapper.
   The metrics gate proved authentic finite values, rendered preview, explicit
   refresh, deletion/recreation, and persisted-identifier exclusions against the
   connected Boot/JMX fixture. The logger gate then proved authentic
   `getLoggers`, bounded Zed rendering, confirmed `configure/logLevel`, matching
   update notification, refreshed state, and restoration of the original level.
   Automatic local connection is now verified as an explicit opt-in: generated
   Java debug entries carry reviewable local-management/project identity
   properties, and only one worktree-matching Attach descriptor can enter the
   verified confirmation path. Its real Zed debug lifecycle gate proved
   automatic connection and live data, manual disconnect without reconnection,
   debug stop, and owned-process cleanup. Remote connection is now
   `implemented` through the settings route VS Code itself uses, after a source
   read refuted this plan's own preferred `sts/livedata/remoteConnect` Code
   Action: no VS Code code path calls that command. Its credential gate closed
   on the finding that `RemoteBootAppData` has no credential field, leaving only
   userinfo inside a user-authored `jmxurl` to redact from rendered labels. Its
   2026-07-24 gate connected a Boot 3.5.5 HTTP-Actuator target from one settings
   notification, read 860 authentic loggers, disconnected by clearing the array,
   and showed a credential-bearing URL rendering redacted while staying
   identifiable. A second gate repeated the route in real Zed, where the setting
   reached Spring through the extension's own merge and the editor rendered
   hover naming the connected remote process; the localhost and `http`-only
   limits remain recorded. The remaining commands retain their separate interaction/security
   gates.
6. Version and support validation is closed, and it closed the way the upgrade row
   next to it did: read the pinned server first, and what remains is smaller than
   the plan assumed. The diagnostics are ordinary build-file diagnostics needing
   neither product code nor a settings supplement — the first row where the
   VS Code-schema audit came back empty on both sides, because every
   version-validation default already matches. The 2026-07-25 run drew every
   problem type that is not `IGNORE` by default across four pinned Boot
   generations, both OSS branches, and nothing at all for the three `IGNORE`
   types. What the row really contained was a dead end: its release-notes and
   commercial-support quick fixes ask the client to open a web page, stock Zed
   answers no `window/showDocument`, and the coordinator was replying with advice
   written for generated *files* and reporting failure, so Spring stacked its own
   `Failed to open:` error on top. External pages now render as a bounded
   Markdown link in a dismissible notice — a `showMessageRequest`, since a toast
   auto-dismisses before a link can be clicked — with the address as its own
   label, and userinfo or Markdown-breaking characters downgraded to redacted
   plain text. Spring Cloud compatibility is the one unobserved diagnostic in
   this family; it needs a Spring Cloud fixture and is recorded rather than
   claimed.
7. Modulith closed the last pair of rows named in the M4 slice order, and the
   Java reconcilers closed the largest remaining one. Both halves of *Java Spring
   diagnostics and quick fixes* and the sibling *Spring AI annotation diagnostics
   and indexing* row are now `verified`, and — for the second time after version
   and support validation — the route was to read the pinned server first and
   find that nothing had to be built. The server's own `problem-types.json`
   declares all 11 categories and all 71 problem types, every default matches the
   VS Code schema, and `boot-java.java.reconcilers` is the one boolean on this
   surface whose absent-key default is already `true`, so no settings supplement
   was needed either. The 2026-07-26 run drew 28 problem types across every Java
   family — all 17 boot2 types, boot3, six of seven boot4 types, the default-off
   spring-aot pair once enabled, and both Spring AI ones with a compliant control
   — and applied a fix from **both** Spring quick-fix engines through Zed's own
   code-action menu, the JDT refactoring and the OpenRewrite recipe, each ending
   in `workspace/applyEdit` with `applied: true`. The row's real requirement,
   disabling a failing reconciler without weakening unrelated diagnostics, holds
   at both granularities through the existing settings passthrough: a category
   `OFF` and a single problem type `IGNORE`. Three problem types were recorded
   unobserved rather than claimed, and one of them exposed a separate finding
   worth its own work: on Zed 1.12.0 neither extension-contributed language
   matched, so `spring.factories` reached no server and a JPA named-queries file
   was validated as ordinary Boot properties. Those two rows keep their
   2026-07-20 evidence for Zed 1.11.3 and now carry that regression signal.
8. That signal is now **withdrawn, and nothing in the product or in Zed had to
   change.** The two languages were never registered in that run because the
   profile carried a stale extension index: Zed rebuilds
   `extensions/index.json` at startup only when it is not newer than
   `extensions/installed/`, and copying a warm profile always leaves the index
   newer, so a copied profile keeps the source profile's language set. The
   profile descended from a 2026-07-19 ancestor that predates both language
   directories. Two controls close it — the ordinary profile on the same Zed
   1.12.0 has both languages indexed, and deleting `index.json` alone in a fresh
   copy brought both back, with `spring.factories` opening as
   `spring-factories` and the named-queries file as `jpa-query-properties` with
   its `JPQL_SYNTAX` diagnostic. Both rows are now verified on 1.11.3 and
   1.12.0. What this leaves behind is a verification rule rather than a backlog
   item: a copied profile can silently invalidate any driven negative result, so
   confirm the rebuilt index lists every contributed language before trusting
   one.
9. That last open thread is now closed, and it needed no product change either.
   `FACTORIES_KEY_NOT_SUPPORTED` was blamed first on language matching and then,
   after item 8 corrected that, on project resolution for a non-Java
   `.factories` URI. The file type was never the issue. `JdtLsProjectCache.find`
   resolves any `file:` URI contained in a registered project URI, and those runs
   had **no registered project at all**: no Java buffer was open, so Zed never
   started the official Java extension, no classpath reached Spring, and the
   reconciler's `projectFinder.find` was empty for every URI in the worktree.
   The extension's own notice saying so is in the same log. Opening one Java file
   first published the diagnostic on both scanned paths as `ERROR` over the whole
   continued key/value pair, with a still-supported key in the same file drawing
   nothing, and — from four stray characters typed into the key and reverted — an
   empty publish followed by the diagnostic again, which is the direct evidence
   that the `ifPresent(…)` is now entered. Two of the three unobserved problem
   types remain, and the standing lesson is a verification one: this project's own
   constraint that Zed starts jdtls only for Java buffers is a confound for any
   negative result about a non-Java file, and it is cheaper to rule out first
   than to reason around.
10. The three problem types those rows had recorded as unobserved are now all
   drawn, and — for the fourth time in this slice order — the route was to read
   the pinned server first and find nothing to build. Every one of them had been
   explained from the outside, and every one of those explanations was wrong in
   the same way: the fixture, not the source under the cursor, was failing a
   precondition. `JAVA_BEAN_NOT_REGISTERED_IN_AOT` does not inspect classpath
   AOT state; it fires on any concrete implementation of Spring's two
   AOT-processor interfaces that its own index holds no bean for, so the previous
   fixture's `@Component` was the only thing suppressing it, and removing it drew
   `Not registered as a Bean` over exactly the type name while an otherwise
   identical registered sibling stayed silent. `SPRING_DATA_STRING_PROPERTY_REFERENCE`
   needs **spring-data-commons ≥ 4.1.0**, because it only flags a String argument
   where a `TypedPropertyPath` overload sits beside it and that API ships in
   4.1.0 — so the Boot 4.0.6 module could never have produced it, whatever `Sort`
   shape was written; a Boot 4.1.0 module drew five diagnostics across four
   shapes and a byte-identical 4.0.6 control drew none. And
   `SPRING_CLOUD_INCOMPATIBLE_BOOT_VERSION` compares no versions at all: it walks
   spring.io generation metadata twice, so what the fixture has to express is a
   *pairing* — spring-cloud-commons 4.1.6 beside Boot 3.5.5 fires, 4.3.3 beside
   the same Boot does not. That completes `spring-aot` at 3/3, `boot4` at 7/7 and
   every non-`IGNORE` version-validation type, and the new
   `TypeSafePropertyReferenceRefactoring` quick fix drove through Zed's own
   code-action menu to `applied: true`, leaving `Sort.by(Person::getFirstName)`
   and one fewer diagnostic. The standing lesson is the fixture-side companion to
   item 9's: when a reconciler is silent, check its `isApplicable` gate and the
   index it consults before theorising about the syntax in front of it.
11. Offline behaviour is now `verified`, which empties the last row that was
   `planned` for want of evidence rather than for want of a decision — what
   remains `planned` is Spring Initializr, the embedded MCP server, and the AI
   explanation commands, each needing a scope/network/privacy decision before any
   slice. This one needed no product code either, and for a fifth time the reason
   was that the existing path already answered the question: the install is
   checksum-first, so being offline only changes *when* it says no. The runs
   denied outbound network to the whole process tree with `sandbox-exec`, which
   is what makes the result cover the Spring and JDT JVMs rather than only Zed's
   HTTP client. A first install fails closed with the pinned release and the
   exact artifact URL in Zed's own error buffer, and leaves no install directory,
   no partial archive, no staging directory and no coordinator process behind —
   there is no reduced mode to mistake for a working one, and jdtls in the same
   session was unaffected. A warm install then runs the entire product with no
   network: classpath bridge, Java reconciler diagnostics, the classpath-backed
   unknown-property diagnostic, and `server.*` completion with documentation.
   Exactly one capability degrades, version and support validation, and it
   degrades to an **empty** diagnostic publish with both fetch failures confined
   to the server log — no stale advice, no error notice, no hang. The two
   artifact gates are the part worth remembering: a flipped byte in an installed
   jar is repaired *offline* from the checked VSIX, and corrupting the archive as
   well deletes it rather than using it while leaving the existing installation
   untouched, because activation is a validated staging directory renamed into
   place. That is the rollback claim this project can actually make, and one
   online start afterwards restored the pinned checksums.
