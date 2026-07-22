# M4 capability delivery plan

- Status: Selected direction; implementation and runtime verification remain
  incremental
- Last updated: 2026-07-22
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
| Boot project discovery — find executable main classes and modules | The coordinator's GAV callback and generated-configuration workflow are verified on the macOS arm64/Maven tuple. | Route taken: invoke executable projects from a Code Action, let the user select one discovered project or `All projects`, then generate reviewable configuration. `bootProjectInfo` detail remains separately implemented but undriven. | The bounded Zed prompt passed its multi-project gate; a generated candidate document was not needed. Other build tools and desktop tuples remain untested. | 5/5; interaction gate closed |
| Run and debug — launch, stop, or debug a Spring Boot application | The generated task and official-Java DAP routes are verified on macOS arm64/Maven, including a two-module `All projects` selection. Users may still author `.zed/tasks.json` and `.zed/debug.json` manually. | Route taken: generate or merge explicit Run tasks and Debug configurations when project choice, profiles, arguments, or debugging requires them; the user starts the selected Zed task or Debug entry. Reuse the installed official Java extension's matching main runnable when that route has the required evidence. | Never overwrite unknown configuration or assume a runnable becomes a debug scenario. On capability or merge failure, retain manual configuration and offer a bounded user-reviewed compatibility report where applicable. | 5/5 on tested tuple; platform/build-tool matrix remains |
| Maven and Gradle execution — run a goal, task, or build | Official Java and manually authored Zed tasks remain the ownership boundary. S016 verified Maven main execution and Gradle coordination, not Gradle/vanilla task execution or test tasks. | Reuse the installed official Java extension's wrapper-aware main/test tasks where they have matching runtime evidence. Generate or merge reviewable `.zed/tasks.json` only for arbitrary goals, builds, or Spring-specific commands; do not launch them invisibly inside Spring LS. | On capability failure, unsafe merge, or platform ambiguity, retain manual tasks and keep unmatched commands `planned`. Exact official-Java release strings do not activate or reject this route. | 4/5; remaining runtime gates |
| Local process connection — connect live data to a running Boot process | `verified` on the 2026-07-23 macOS arm64 tuple. No reduced connection mode is claimed. | A Code Action runs `sts/livedata/listProcesses`, presents a bounded Zed message choice, executes the descriptor's own connect/disconnect/refresh action, and keys connect success off the `sts/liveprocess/connected` notification with coordinator-owned connection state and cleanup. The extension enables Spring's false-when-absent explicit local-process discovery while leaving automatic connection off. | The driven Boot 3.5.5/JMX gate connected, refreshed CodeLens, disconnected and closed JMX. If the process list exceeds a usable prompt or identity is ambiguous, use the opt-in Live document; a failed connect is reported as a bounded request, never a false success. | 5/5 on tested tuple; platform matrix remains |
| Remote connection — connect to a remote Actuator/JMX target | Capability remains `planned`. | Read an explicit endpoint and non-secret options from Zed settings, then connect through a Code Action. Credentials must use a separately reviewed secure path. | No credentials in generated documents, settings examples, logs, or project files; without a secure input path, remote auth stays `planned`. | 3/5 |
| Live hover and inline data — show runtime bean or endpoint information at source | Source-local bean, injection and endpoint facts are verified as live CodeLens plus native Hover; aggregate metrics are separately verified, while lifecycle and logger aggregation remain planned. | Keep versioned live results in standard CodeLens and use Zed's composed Hover for detail until a one-click client-command bridge exists. | Reject old document versions, explain unavailable VS Code-only commands, and retain static Spring hover/Project Symbols when disconnected. | 4.5/5 |
| Metrics — inspect memory and request/runtime measurements | The bounded Live-document route is `verified` on the 2026-07-23 macOS arm64 tuple; users may still use the application's own Actuator UI. | A Java source Code Action selects an already-connected process, explicitly refreshes memory/GC families, and writes finite, timestamped heap/non-heap/GC measurements to the owned `.zed/spring-live.md` without process keys or metric tags. | Contract tests closed the interaction, freshness, ownership, output-bound and persisted-identifier gates. The driven Boot 3.5.5/JMX run proved authentic values, rendered preview, refresh and deletion/recreation. Actuator remains the fallback and other desktop tuples remain untested. | 5/5 on tested tuple; platform matrix remains |
| Loggers and log levels — list loggers and change a running level | Capability remains `planned`; users may use Actuator directly. | Render loggers in the opt-in Live document and attach item-level Code Actions to supported levels. | If selection or confirmation is ambiguous, keep the document read-only and link to the external endpoint. | 3/5 |
| Boot Dashboard outcomes — discover applications, see state, and reach run/debug/connect/stop actions | Preserve Project Symbols, manually configured Debug UI, and existing terminal/process workflows as separate fallbacks. | Compose Structure/Live documents, Code Actions, Zed Debug UI, and status-bearing inline surfaces; do not claim a custom panel. | Each sub-capability falls back independently; absence of a panel does not erase verified navigation or manual run/debug. | 3.5/5 |
| Open application URL — reach a running app or endpoint in a browser | Capability remains `planned`; users can copy a known URL. | Expose a standard Document Link or clickable Markdown URL in hover/generated content. When a Code Action discovers the URL, use a clickable Markdown `showMessageRequest` result as a companion after runtime verification. Do not assume general `window/showDocument` support. | Always show copyable text if clicking or automatic external opening is unavailable. An OS-specific opener task is recorded only as a future contingency and requires a separate cross-platform security/quoting gate. | 4/5 |
| Spring Boot upgrade — update the Boot version and apply migration edits | Capability remains `planned`; manual upgrade remains possible. | Expose the Spring upgrade command as a Code Action and apply only reviewable workspace edits. | If the command needs unsupported multi-step UI or external content, stop before mutation and retain the manual workflow. | 3.5/5 |
| Modulith — inspect application modules and refresh their metadata | Capability remains `planned`; source navigation remains available through Java. | Use Workspace Symbols for search and an opt-in Structure document for module/dependency grouping. | If metadata generation or links are incomplete, keep the view `planned` and retain ordinary Java navigation. | 3/5 |
| Spring XML and Java reconcilers — analyze XML configuration and additional Java sources | XML config is now `verified`; Java reconcilers remain `planned`. | Route taken for XML: XML already reaches the server through the `xml` language id, the opt-in master switch stays user-controlled, and the extension supplies the `content-assist`, `hyperlinks`, and `scan-folders` sub-defaults that read off/empty when absent — closing the same silent-gap trap as `jpql`/`inject-bean`. Driven 2026-07-22: with only `on: true` user-set, reconcile diagnostic, XML symbol scan, class/property completion, and property→source definition all fired on the named macOS tuple. | Disable only the failing reconciler and preserve the rest of Spring LS. | 5/5; driven gate closed |
| `spring.factories` and JPA query files — classify special Spring files for completion and validation | Delivered: both are `verified`. Ordinary Properties behaviour is untouched for every other `.properties` file. | Route taken: distinct Zed languages on a pinned `tree-sitter-properties` grammar, mapped to the Spring language IDs `spring-factories` and `jpa-query-properties`. The open question — filename or language ID — resolved to **language ID**, so the grammar cost was unavoidable. | The 2026-07-20 gates passed: both IDs reached the server and Spring returned `JPQL_SYNTAX` on the broken named query. Java ownership is unchanged. | 5/5; gates closed |
| Embedded syntax highlighting — highlight SpEL, JPQL, and query fragments inside Java strings | Preserve official Java highlighting without Spring-specific embedded grammar. | S017 closed the stock-Zed route negatively on 2026-07-21: Zed issues no semantic-token request after either dynamic or static registration, including jdtls's own static provider. A future opt-in Java query pack is an independent tree-sitter alternative and requires a new direction decision. | The fallback is the supported state: official Java tree-sitter highlighting renders these strings correctly; only token-level colouring inside them is lost. Never risk the whole Java language registration for this enhancement. | 2/5; blocked on Zed's Java semantic-token request/render path |
| Spring Initializr — create a new Spring project | It is outside the pinned VSIX capability surface and current runtime boundary. | Make a separate scope, network, artifact, and UX decision before adding it. | Remain out of scope; document external Initializr use. | 2/5 |
| AI explanations — explain SpEL, queries, and AOP behavior | The pinned command is VS Code Copilot-specific. The provider is enabled by this product regardless of Zed AI state, while the command is intercepted locally. | Keep the requested lens visible with wording that says the extension cannot detect or invoke Zed Agent and sends no source/prompt to AI. Revisit direct open/prefill only if Zed exports a user-consented Agent action/state API. | Manual analysis or a separate user-initiated Agent request. Do not imply conditional integration, auto-submit a prompt, or include the result in the current extension parity claim. | 2/5 |
| Offline, compatibility, and diagnostics — reuse artifacts, explain Java/Spring incompatibility, and report contract breaks | Preserve the current coordinator, adapter contract, checked artifact cache, and verified failure diagnostics. | Attempt known capabilities independent of the installed official-Java release string. On a required-capability failure, show a bounded prefilled public GitHub issue for user review and submission; keep security reports private. | Never start a misleading reduced mode, submit telemetry or an issue automatically, handle a GitHub token, or include paths, classpaths, source, environment, credentials, or raw logs in the report. | 4/5 |

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
   jdtls process resumed. Gradle interaction and other desktop tuples remain
   untested rather than blocking this named-tuple result.
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
4. The semantic-token spike is **closed, refuted** ([S017](spikes/017-static-semantic-token-declaration.md),
   driven 2026-07-21). Both halves failed: Zed requests nothing after Spring's
   *dynamic* registration, and — the decisive part — nothing after a *static*
   `semanticTokensProvider` declaration in the `initialize` result either,
   including jdtls's own static declaration. Zed 1.11.3 has no semantic-token
   request/render path for Java, so the *Embedded language syntax highlighting*
   row is now `blocked-zed-api`. SpEL and embedded-query diagnostics, hover and
   navigation stay in scope as ordinary LSP; only token-level colouring was
   gated on this answer, and it is now settled negative.
5. The first live-data connection and aggregate metrics slices are `verified`.
   The metrics gate proved authentic finite values, rendered preview, explicit
   refresh, deletion/recreation, and persisted-identifier exclusions against the
   connected Boot/JMX fixture. Loggers, automatic/remote connection, and
   remaining commands retain their separate interaction/security gates.
