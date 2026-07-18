# D005: LSP-first capability delivery with preserved fallbacks

- Status: Accepted
- Date: 2026-07-18
- Decision owner: Project owner
- Depends on: D002, D003, D004, R011, R013, and R014

## Context

M4 needs a durable way to deliver the full Spring Tools capability inventory on
stock Zed. The extension API has no custom panel, tree view, webview, arbitrary
editor item, or arbitrary command-palette contribution, but Zed and the Spring
server expose standard LSP, DAP, task, and file-based configuration surfaces.

The earlier inventory correctly verified Project Symbols as a Spring structure
navigation fallback, but incorrectly concluded that Zed cannot consume LSP
Document Symbols. Zed 1.11.3 supports them behind a default-off language setting.
The product owner selected the highest-coverage stock-Zed direction and also
required that the existing plan remain explicit and usable as a fallback.

## Evidence

- [R013](../research/013-zed-native-capability-delivery-surfaces.md) attributes
  the extension UI boundary, Document Symbols path, multi-server merge, Java
  registration replacement behavior, and standard delivery surfaces.
- [R014](../research/014-final-upstream-capability-surface-audit.md) confirms the
  choice against latest Zed/Java/Spring source, identifies official Java
  6.8.23's compatibility-gated task improvement, and rules out removed slash
  commands, private task scheduling, and general ShowDocument as product routes.
- [R011](../research/011-vscode-spring-tools-capability-surface.md) enumerates the
  pinned Spring commands, settings, languages, LSP capabilities, and VS Code
  view.
- [D003](003-java-companion-product-architecture.md) assigns Java language,
  JDT, DAP, tasks, tests, and project ownership to the unmodified official Java
  extension.
- [D004](004-product-stack-build-and-packaging.md) gives the existing coordinator
  ownership of Spring stdio, request correlation, Java transport, lifecycle, and
  compatibility.
- The [capability inventory](../capability-inventory.md) preserves the named
  verified standard-LSP and Project Symbols results.

## Options considered

| Option | Capability coverage | Product stability | Recommendation |
| --- | ---: | ---: | ---: |
| LSP-first coordinator plus opt-in Structure/Live documents, with the existing routes preserved | 4.5/5 | 5/5 | 5/5 |
| LSP-first coordinator without generated documents | 4/5 | 5/5 | 4.5/5 |
| Re-register Java and maintain an official-Java-derived query pack in the baseline | 3.5/5 | 1.5/5 | 1.5/5 |
| Ship a custom Zed build with a native Spring panel | 5/5 | 1/5 | 1/5 |
| Add an external TUI or web dashboard | 4/5 | 2.5/5 | 2.5/5 |

### LSP-first with generated documents

This uses native completion, hover, diagnostics, navigation, symbols, Code
Actions, CodeLens, inlay hints, DAP, and tasks. The existing coordinator adapts
allowlisted Spring-specific protocols. Data that needs workspace-wide grouping
or a table may use an explicitly requested, regenerable Structure or Live
document.

### LSP-first without generated documents

This is the simpler stock-Zed option, but metrics, loggers, workspace grouping,
and dashboard-like outcomes are materially weaker.

### Java language/query co-ownership

This can add syntax-only Spring captures and embedded-string injections, but Zed
replaces rather than merges the same-name Java language definition. It requires
continuous synchronization of the official Java language pack and still cannot
produce classpath-resolved or live Spring semantics.

### Custom Zed or external UI

A Zed fork can provide the exact panel but changes the product into a maintained
editor distribution. An external dashboard avoids the extension UI limit but
adds another runtime, interaction model, packaging surface, and security
boundary. Neither is proportionate while stock-Zed outcomes remain available.

## Decision

**Go with the LSP-first coordinator plus opt-in generated Structure/Live
documents, while preserving the current per-capability plan as the documented
fallback.**

“Preserve” does not mean implementing every lower-ranked route in parallel.
Every capability route is classified as one of four kinds:

- **primary** — the first implementation and normal user path;
- **companion** — implemented with the primary because it serves a different
  user context, such as quick Run versus configurable Debug;
- **conditional fallback** — kept in the plan with an explicit activation gate,
  but implemented or promoted only when the primary fails its named runtime,
  platform, safety, or usability criterion; or
- **excluded contingency** — recorded for future reconsideration but not part of
  the product until a new decision changes an ownership or private-API boundary.

Fallbacks must name their trigger, expected degraded outcome, and constraints.
Low confidence alone is not enough to build a duplicate path, and a companion is
not mislabeled as a fallback merely because it is second in a table.

The decision has these rules:

1. D003 and D004 remain authoritative. Official Java keeps Java language
   registration, JDT LS, DAP, tests, tasks, project import, and updates.
2. The coordinator becomes the Spring-to-Zed protocol adaptation layer in
   addition to its existing transport and lifecycle responsibilities. It may
   translate allowlisted Spring data into standard LSP results; it does not add a
   new process or UI loopback endpoint.
3. Prefer native surfaces in this order: existing verified standard LSP, LSP
   Document Symbols for per-file Outline, Project Symbols for worktree search,
   Code Actions/CodeLens/inlay hints for contextual interaction, compatibility-
   tested official Java tasks for matching main/test actions, and official Java
   DAP/reviewable Zed tasks for remaining execution.
   Code Actions are the general Spring command entry point. CodeLens is a
   companion only for a small, high-frequency, source-local subset. Runnable
   tasks and debug scenarios remain execution-specific companions rather than
   duplicate command implementations.
4. Project Symbols remains the supported structure-navigation fallback until an
   enhanced route has stronger evidence on the same tuple. Manual
   `.zed/debug.json`, `.zed/tasks.json`, static hover, and external Actuator
   workflows remain the corresponding execution and live-data fallbacks.
5. Generated Structure/Live documents are opt-in. A user action must request
   creation or refresh. They must be regenerable, timestamped where live, free of
   credentials, safe to delete, and must not silently edit `.gitignore` or
   overwrite unknown user configuration.
6. `document_symbols: "on"` is the preferred Java Outline route, but only after
   S015 verifies the combined JDT/Spring response. The extension may guide the
   setting; it cannot force it.
7. A failed preferred route returns to its named fallback and stays `planned` if
   no verified outcome exists. Failed observations are retained.
8. The baseline product does not re-register `Java`, replace its grammar or
   queries, patch the official Java extension, ship a Zed fork, or add an external
   dashboard.
9. A future opt-in Java query pack may be proposed only through a new direction
   decision after stock-Zed routes are tested. Embedded syntax highlighting is
   not enough reason to weaken Java ownership by default.
10. Initializr, remote credential handling, and AI explanations require their own
    scope/security decisions; they are not silently absorbed into this decision.
11. Private or removed Zed surfaces are not product contracts. In particular,
    extension slash commands, built-in-only CodeLens task scheduling, Copilot's
    ShowDocument handler, and Project Symbols `containerName` do not provide a
    general Spring action, browser, or tree route. Their user outcomes may still
    be delivered through public Zed surfaces; “API unavailable” does not mean
    “no equivalent workflow.”

The complete preferred and fallback mapping is maintained in the
[M4 capability delivery plan](../capability-delivery-plan.md).

## Rationale

This option reaches the largest part of the pinned capability inventory without
creating a custom editor distribution or contesting Java ownership. It reuses the
coordinator boundary already required for Spring and official-Java coordination,
so protocol adaptation does not add another runtime. It also keeps every proven
route available: new experiments can improve the UX without turning a failed
experiment into a regression.

Java query replacement is not selected because implementation quality cannot
control Zed's same-name language replacement semantics or official Java's future
query changes. Static queries also cover less Spring meaning than the semantic
server data already available.

## Consequences

- M4 work is ordered by standard-surface leverage rather than VS Code widget
  similarity.
- The inventory's zero-request Document Symbols observation is retained but
  reclassified as a default-off control, not a missing Zed capability.
- S015 is required before per-file Spring Outline is claimed.
- S016 is required before official Java 6.8.23 is accepted or its new task
  helper becomes a preferred product route. Until then 6.8.21 remains the exact
  supported companion.
- Project Symbols and manual configuration remain easy-to-find fallbacks in the
  plan and inventory.
- Generated documents add worktree-mutation, merge, freshness, and ignore-policy
  obligations. Each document type needs a reviewed slice and runtime evidence.
- Some VS Code interactions remain less convenient: a generated document is not
  a custom panel, a message request is not a searchable quick pick, and generated
  debug configuration does not auto-start a session.
- Live remote authentication remains unimplemented until a secure credential
  design is selected.
- Application URLs use a verified Document Link/Markdown link with copyable text
  fallback; the plan does not assume general `window/showDocument` support.
- No capability state changes from this decision alone.

## Revisit conditions

Revisit this decision if Zed exposes an official extension panel/tree or virtual
document API; provides deterministic query overlays or language-owner priority;
lets an extension select Document Symbols by language server; exposes a safe
debug-start or rich selection API; the coordinator cannot translate authentic
Spring protocols without semantic loss; or the project owner explicitly chooses
a custom Zed distribution, external dashboard, or Java language co-ownership.
