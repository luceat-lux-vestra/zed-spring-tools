# M4 capability delivery plan

- Status: Selected direction; implementation and runtime verification remain
  incremental
- Last updated: 2026-07-18
- Decision: [D005](decisions/005-lsp-first-capability-delivery.md)
- Evidence: [R013](research/013-zed-native-capability-delivery-surfaces.md) and
  [R014](research/014-final-upstream-capability-surface-audit.md)
- Inventory authority: [capability-inventory.md](capability-inventory.md)

## How to read this plan

This document keeps two paths visible for every capability:

1. the **current baseline/fallback**, which preserves existing verified behavior
   and the previously planned Zed-native workflow; and
2. the **preferred route**, which adds standard-LSP adaptation and, only where a
   list or dashboard is essential, an explicitly requested generated document.

The preferred route is additive. A failed experiment does not remove a verified
fallback, and no score below is a support claim. Scores are planning confidence
for the route on stock Zed; only the capability inventory can mark a capability
`implemented` or `verified`.

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

## Capability routes

| Capability and outcome | Current baseline / fallback | Preferred route | Fallback trigger and result | Confidence |
| --- | --- | --- | --- | ---: |
| Properties/YAML completion, hover, and validation — recommend keys and values, show documentation, and diagnose invalid configuration | Preserve the verified Spring LS standard-LSP path. | No replacement; continue standard completion, hover, diagnostics, and definition. | Any regression stays on the last compatibility-tested Spring/Java tuple. | 5/5 |
| Property conversion and metadata reload — convert properties and YAML and reload shared metadata | Commands remain `planned`; users can edit files or restart the server manually. | Expose a Code Action, execute the Spring command, and apply the returned workspace edit. | If create/replace edits are not safe, retain the command as `planned` and document the manual workflow. | 4/5 |
| Per-file Spring Outline — show the current file's beans, endpoints, and components hierarchically | Preserve verified Project Symbols as the navigable fallback. | Enable Zed's official LSP Document Symbols setting for Java and use Outline/Breadcrumbs; S015 tests the combined JDT/Spring result. | If symbols duplicate, interleave, lose Java symbols, or fail to refresh, keep Project Symbols and use the Structure document for Spring-only grouping. | 4/5; runtime gate |
| Project-wide Spring structure — browse beans, endpoints, configurations, and grouping across the worktree | Preserve verified Project Symbols and direct source navigation. | Keep Project Symbols for search and add an opt-in generated Spring Structure document for stable grouping and refresh. | If safe generation, refresh, or navigation cannot be proven, Project Symbols remains the supported equivalent. | 4/5 |
| Bean and endpoint navigation — jump from Spring elements and request mappings to source | Preserve verified Workspace Symbols plus official Java definition, references, and implementations. | Combine the same surfaces with links from Outline or generated documents. | Links may be omitted without losing the verified symbol-search path. | 5/5 |
| CodeLens — show bean, endpoint, reference, or live status above classes and methods | Keep this capability `planned`; Project Symbols and hover retain navigation and detail. | Translate Spring's `sts/highlight` data into standard CodeLens items and refresh them when the index or live state changes. | If refresh, ranges, or command execution are unreliable, retain hover/inlay/symbol surfaces and do not ship stale lenses. | 4/5 |
| Inlay hints — render human-readable cron information and other compact inline facts | Preserve the verified standard-LSP inlay-hint path. | Extend only when another Spring result maps naturally to an inlay hint. | Disable individual hint classes that become noisy or stale. | 5/5 |
| Quick fixes and Code Actions — repair Spring code and create metadata | Preserve the verified Spring Code Action and ApplyEdit path. | Add synthetic project, run/debug, live-data, conversion, and refresh actions around allowlisted Spring commands. | An action without a safe standard-LSP interaction remains `planned`; existing quick fixes are unaffected. | 5/5 |
| Boot project discovery — find executable main classes and modules | The coordinator's GAV callback is implemented; no user-facing workflow is claimed. | Invoke executable-project and project-info commands from a Code Action, then let the user select a project and request configuration generation. | If Zed's action prompt is inadequate, generate a reviewable candidate document and require manual selection. | 4/5 |
| Run and debug — launch, stop, or debug a Spring Boot application | Users may author `.zed/debug.json` manually and use the official Java DAP; official Java 6.8.21 remains the supported companion. | After S016, prefer official Java 6.8.23's main runnable for a matching Run action. Generate or merge explicit Run (`noDebug`) or Debug configurations when project choice, arguments, or debugging requires them; the user starts the selected Zed task or Debug entry. | Never overwrite unknown configuration or assume a runnable becomes a debug scenario. On compatibility or merge failure, retain 6.8.21 plus manual configuration. | 4/5; runtime gates |
| Maven and Gradle execution — run a goal, task, or build | Official Java and manually authored Zed tasks remain the ownership boundary. | After S016, reuse official Java 6.8.23's wrapper-aware main/test tasks where they match. Generate or merge reviewable `.zed/tasks.json` only for arbitrary goals, builds, or Spring-specific commands; do not launch them invisibly inside Spring LS. | On unknown-provider, unsafe merge, or platform ambiguity, retain 6.8.21/manual tasks and keep unmatched commands `planned`. | 4/5; runtime gate |
| Local process connection — connect live data to a running Boot process | Capability remains `planned`; no reduced connection mode is claimed. | Use a Code Action, Spring's process list, a bounded Zed message choice, and coordinator-owned connection state. | If the process list exceeds a usable prompt or identity is ambiguous, use the opt-in Live document; otherwise retain `planned`. | 3.5/5 |
| Remote connection — connect to a remote Actuator/JMX target | Capability remains `planned`. | Read an explicit endpoint and non-secret options from Zed settings, then connect through a Code Action. Credentials must use a separately reviewed secure path. | No credentials in generated documents, settings examples, logs, or project files; without a secure input path, remote auth stays `planned`. | 3/5 |
| Live hover and inline data — show runtime bean or endpoint information at source | Capability remains `planned`; static hover and Project Symbols remain available. | Cache live results in the coordinator and adapt them to hover, CodeLens, or inlay hints with explicit freshness. | Hide expired data and fall back to static Spring hover rather than showing stale runtime facts. | 4/5 |
| Metrics — inspect memory and request/runtime measurements | Capability remains `planned`; users may use the application's own Actuator UI. | Generate an opt-in Spring Live document with timestamps and an explicit refresh Code Action. | If refresh or data redaction cannot be bounded, provide links to the application endpoint and keep the editor view `planned`. | 3/5 |
| Loggers and log levels — list loggers and change a running level | Capability remains `planned`; users may use Actuator directly. | Render loggers in the opt-in Live document and attach item-level Code Actions to supported levels. | If selection or confirmation is ambiguous, keep the document read-only and link to the external endpoint. | 3/5 |
| Boot Dashboard outcomes — discover applications, see state, and reach run/debug/connect/stop actions | Preserve Project Symbols, manually configured Debug UI, and existing terminal/process workflows as separate fallbacks. | Compose Structure/Live documents, Code Actions, Zed Debug UI, and status-bearing inline surfaces; do not claim a custom panel. | Each sub-capability falls back independently; absence of a panel does not erase verified navigation or manual run/debug. | 3.5/5 |
| Open application URL — reach a running app or endpoint in a browser | Capability remains `planned`; users can copy a known URL. | Expose a standard Document Link or clickable Markdown URL in hover/generated content and verify its desktop behavior. Do not assume general `window/showDocument` support. | Always show copyable text if clicking or automatic external opening is unavailable. | 4/5 |
| Spring Boot upgrade — update the Boot version and apply migration edits | Capability remains `planned`; manual upgrade remains possible. | Expose the Spring upgrade command as a Code Action and apply only reviewable workspace edits. | If the command needs unsupported multi-step UI or external content, stop before mutation and retain the manual workflow. | 3.5/5 |
| Modulith — inspect application modules and refresh their metadata | Capability remains `planned`; source navigation remains available through Java. | Use Workspace Symbols for search and an opt-in Structure document for module/dependency grouping. | If metadata generation or links are incomplete, keep the view `planned` and retain ordinary Java navigation. | 3/5 |
| Spring XML and Java reconcilers — analyze XML configuration and additional Java sources | Capability remains `planned`. | Pass reviewed settings to Spring LS and surface standard completion, diagnostics, navigation, and Code Actions. | Disable only the failing reconciler and preserve the rest of Spring LS. | 4/5 |
| `spring.factories` and JPA query files — classify special Spring files for completion and validation | `jpa-named-queries.properties` still reaches the Properties route with an unverified language ID; `*.factories` has no route. | Add distinct, non-Java language contributions and grammars, then map their exact Spring language IDs. | Keep ordinary Properties behavior where classification is uncertain; do not take ownership of Java. | 4/5 |
| Embedded syntax highlighting — highlight SpEL, JPQL, and query fragments inside Java strings | Preserve official Java highlighting without Spring-specific embedded grammar. | No baseline implementation. A future opt-in Java query pack may be investigated behind a new direction decision. | Default to correct official Java highlighting; never risk the whole Java language registration for this enhancement. | 2/5 |
| Spring Initializr — create a new Spring project | It is outside the pinned VSIX capability surface and current runtime boundary. | Make a separate scope, network, artifact, and UX decision before adding it. | Remain out of scope; document external Initializr use. | 2/5 |
| AI explanations — explain SpEL, queries, and AOP behavior | The pinned command is VS Code Copilot-specific and has no direct port. | Treat a Zed Agent, skill, or MCP workflow as a separate product capability only after a scope decision. | Keep it outside the extension parity claim. | 2/5 |
| Offline, compatibility, and diagnostics — reuse artifacts and explain Java/Spring incompatibility | Preserve the current coordinator, compatibility table, checked artifact cache, and verified failure diagnostics. | Harden rollback, offline reuse, and per-capability diagnostics without changing the ownership boundary. | Reject unknown providers and retain the last verified artifact; never start a misleading reduced mode. | 4/5 |

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
- **Upstream compatibility:** a newer official Java extension remains rejected
  until its versioned bridge/proxy/lifecycle contract passes a named gate. New
  upstream tasks are candidates, not inherited support.
- **Platform scope:** all new routes stay `untested` outside the declared matrix
  until driven there.

## Immediate order

1. Run S015 against stock Zed to settle the per-file Outline route.
2. Run S016 to decide official Java 6.8.23 compatibility and main-task reuse.
3. Implement and verify the `sts/highlight` to CodeLens adaptation.
4. Deliver Boot-project selection and merge-safe Run/Debug configuration,
   reusing the verified official Java main task when it matches.
5. Deliver properties/YAML conversion and metadata reload as Code Actions.
6. Prototype the opt-in Structure document before using the same pattern for
   live metrics or loggers.
7. Expand live-data and remaining command slices only after their interaction,
   freshness, and security gates are written.
