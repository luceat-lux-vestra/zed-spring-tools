# Capability inventory

- Inventory version: 5
- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Last updated: 2026-07-18
- Evidence: [R011](research/011-vscode-spring-tools-capability-surface.md),
  [R013](research/013-zed-native-capability-delivery-surfaces.md), and
  [R014](research/014-final-upstream-capability-surface-audit.md)
- Delivery routes: [M4 capability delivery plan](capability-delivery-plan.md),
  selected by [D005](decisions/005-lsp-first-capability-delivery.md)
- Runtime-tested tuples in this inventory: macOS 26.5.1 arm64, Zed 1.10.3 and
  1.11.3, official Java extension 6.8.21, Temurin JDK 25.0.3

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
| `verified` | Observed working on a named tuple. |

`implemented` and `verified` differ deliberately: this project does not treat
"the code exists" as evidence that it works.

The inventory records evidence state. The delivery plan separately records the
preferred route and the preserved baseline/fallback for every capability. A
selected route or planning-confidence score does not change a state here.

## Summary

46 capabilities tracked.

| State | Count |
| --- | --- |
| `verified` | 14 |
| `implemented` | 0 |
| `planned` | 29 |
| `blocked-zed-api` | 0 |
| `blocked-upstream` | 0 |
| `zed-native-equivalent` | 3 |

A capability is promoted to `blocked-*` only when the exact missing surface is
named **and** no Zed-native workflow can deliver the outcome. A capability is
named for the user outcome it delivers, never for the VS Code widget that
delivers it there — otherwise "we cannot build that exact widget" gets mistaken
for "the outcome is impossible", which is a different and usually false claim.

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

Debuggers are supported, so run/debug is not assumed blocked.

Zed 1.11.3 also has a default-off `document_symbols` language setting that
switches Outline and Breadcrumbs from tree-sitter to LSP
`textDocument/documentSymbol`. The extension can read settings but cannot force
this user setting. Zed merges results from every capable server on the Java
buffer, so the authentic JDT/Spring hierarchy and duplicate behavior require
[S015](spikes/015-stock-zed-java-spring-document-symbols.md). Project Symbols
remains the verified structure-navigation fallback.

## Workstream 1 — properties and YAML

| Capability | State | Notes |
| --- | --- | --- |
| Property key/value completion in `.properties` | `verified` | Real metadata completion observed on the tested tuple during the M2 gate run. |
| Property completion in `.yaml` | `verified` | Real metadata completion observed in `application.yaml` on the tested tuple, including type detail and a deprecation note in the documentation panel. |
| Hover documentation on properties | `verified` | Observed 2026-07-18. Zed issued `textDocument/hover` on `application.properties` (Properties routes only to `zed-spring-tools`, so Spring-attributed) and Spring returned non-empty markdown for both a framework-provided key (`server.port` → type `java.lang.Integer`, `Default: 8080`, `Server HTTP port.`) and a project-provided key (`fixture.greeting.salutation` → the fixture's own javadoc, via generated `spring-configuration-metadata.json`). Evidence: `tmp/lsp-verify-20260718/`. |
| Property validation / diagnostics | `verified` | Spring-attributed diagnostics observed for both files on the tested tuple: `'ser' is an unknown property. Did you mean 'server.address'?` in `.properties`, which requires classpath metadata, and `Expecting a 'Mapping' node but got 'ser'` in `.yaml`. Both carry `source: vscode-spring-boot`. |
| Navigation from a property to its definition | `verified` | Observed 2026-07-18. `textDocument/definition` on `fixture.greeting.salutation` in `application.properties` returned a LocationLink to `GreetingProperties.java` at the `salutation` field (line 26). Spring-attributed (Properties routes only to `zed-spring-tools`); Zed jumps. Evidence: `tmp/lsp-verify-20260718/`. |
| Shared properties metadata reload | `planned` | Preferred route: a standard Code Action executes `sts/common-properties/reload` and observes diagnostics/completion refresh. Manual server restart remains fallback. Setting: `boot-java.common.properties-metadata`. |
| Convert `.properties` to `.yaml` | `planned` | Preferred route: a Code Action executes `sts/boot/props-to-yaml` and applies a reviewable create/replace workspace edit. Manual conversion remains fallback if safe file creation/merge is not verified. |
| Convert `.yaml` to `.properties` | `planned` | Preferred route: a Code Action executes `sts/boot/yaml-to-props` and applies a reviewable create/replace workspace edit. Manual conversion remains fallback if safe file creation/merge is not verified. |
| `spring-factories` language support | `planned` | VSIX associates `*.factories` and `META-INF/spring.factories` with a distinct language. Zed reaches a server only for files it classifies as a mapped language, and file classification needs a `languages/<name>/config.toml` with `path_suffixes` and a **required grammar** — the API has no grammar-less file-association surface. So this needs a language-plus-grammar contribution, which an extension *can* add; it is additional work, not a Zed API block. Until then, `.factories` files reach no server. |
| `jpa-query-properties` language support | `planned` | VSIX pattern is `jpa-named-queries.properties`. Because that is a `.properties` file, Zed already routes it to this server as the `Properties` language, so it is **not** unhandled — but the language id sent is `spring-boot-properties`, not `jpa-query-properties`. Whether Spring keys JPA-query support off the filename (works today) or the language id (degraded) is unverified. Sending a distinct id for one filename requires defining a separate Zed language, same grammar constraint as above. |
| Completion prefix elision | `planned` | Setting `boot-java.properties.completions.elide-prefix`. |

## Workstream 2 — symbols, navigation, and Boot project discovery

| Capability | State | Notes |
| --- | --- | --- |
| Document symbols | `zed-native-equivalent` | Corrected 2026-07-18: Zed 1.11.3 **does** consume LSP Document Symbols when `languages.Java.document_symbols` is `on`; the setting defaults to `off`, so the earlier driven run's zero requests prove only the tree-sitter control. Spring 5.2.0 source recursively returns nested Document Symbols, while Zed merges every capable Java server's result. S015 must verify authentic JDT/Spring hierarchy, duplicates, navigation, refresh, and restart before Outline is promoted. Until then, the same Spring elements remain reachable through the verified Project Symbols fallback. Earlier evidence retained: `tmp/ws2-symbols-run2-20260718/`. |
| Workspace symbols (Spring symbols) | `verified` | Observed 2026-07-18. Zed's "Go to Symbol in Project" issued `workspace/symbol`; the Spring server (through the coordinator) returned the logical structure — `@+ 'greetingController' (@RestController <: @Controller, @Component)`, `@+ 'greetingPrefix' (@Bean) String`, `@+ 'greetingConfiguration' (@Configuration)`, `@+ 'fixtureApplication' (@SpringBootApplication)`, and `@/greeting -- GET` — each with a resolved location in the fixture. jdtls returned 0 for the `@`-prefixed queries, so the symbols are attributable to Spring. Evidence: `tmp/ws2-symbols-run2-20260718/`. |
| Request mapping navigation | `verified` | Observed 2026-07-18. `@/greeting -- GET` (kind 6) is returned by `workspace/symbol` as a navigable workspace symbol resolved to `GreetingController.java`, so Zed's symbol picker jumps to the mapping. |
| Bean navigation | `verified` | Observed 2026-07-18. `@+ 'greetingPrefix' (@Bean)` and the `@Component`/`@Configuration` symbols are returned by `workspace/symbol` with resolved locations, navigable from Zed's symbol picker. |
| Code lenses | `planned` | Server advertises `codeLensProvider`; setting `boot-java.highlight-codelens.on`. Driven run 2026-07-18 proved Zed consumes standard CodeLens with its default-off setting enabled, but Spring delivered element annotation through custom `sts/highlight`, not a standard lens. Preferred route: the coordinator translates authentic highlight payloads into standard CodeLens and issues refresh on index/live changes. CodeLens is a companion only for a small high-frequency source-local subset; general Spring operations remain Code Actions so the two surfaces do not duplicate every command. Project Symbols and hover remain fallbacks; stale or semantically lossy lenses must not ship. Evidence: `tmp/lsp-verify-20260718/`. |
| Inlay hints (including cron) | `verified` | Confirmed 2026-07-18 on macOS arm64/JDK 25 with the development extension and unmodified Zed 1.11.3. The coordinator now sends the standard server-to-client `workspace/inlayHint/refresh` request after official-Java classpath coordination is enabled and again when Spring reports a completed, non-empty `spring/index/updated`; Zed then requested `textDocument/inlayHint` from Spring, received `label: "every hour"` for `@Scheduled(cron = "0 0 * * * *")`, and rendered it inline. This project-side fix does not require an upstream Zed change. The earlier zero-request verdict was invalid: its fixture lived under this repository's ignored `tmp/` tree, and Zed deliberately removes ignored worktree entries in `Editor::is_lsp_relevant` before collecting visible inlay-hint ranges. A single **Toggle Inlay Hints** invocation was also not a force-enable diagnostic: Zed computes `Toggle(!self.inlay_hints_enabled())`, so it disables an already-enabled buffer. A separate generic Zed issue remains for servers such as jdtls that dynamically register `textDocument/inlayHint` without requesting a refresh; it is not a blocker for Spring cron hints because the coordinator owns the Spring LSP connection and can request the refresh itself. Runtime traces: `tmp/inlay-fix-runtime-20260718/stock-zed-index-refresh.log` and `tmp/inlay-fix-runtime-20260718/patched-clean-zed.log`; non-ignored fixture: `/tmp/zed-spring-inlay-fixture.aTcams`. |
| Code actions / quick fixes | `verified` | Observed end to end on 2026-07-18 with macOS 26.5.1 arm64, Temurin JDK 25.0.3, official Java 6.8.21, the development extension, and unmodified Zed 1.11.3. Spring initially advertises `sts.vscode-spring-boot.codeAction`, but enabling its classpath listener dynamically registers one internal `sts4.classpath.<letters>` command. Zed 1.11.3 replaces rather than extends the static `executeCommandProvider` command list for that registration, so it received Spring quickfix responses but filtered them out of the menu as unavailable commands. The coordinator already owns and relays that exact callback without Zed, so it now consumes the callback's registration and unregistration, preserving Spring's static command list. After rebuilding, Zed's standard code-action menu displayed `Remove 'public' from @Bean method`; selecting it emitted `workspace/executeCommand`, Spring returned `workspace/applyEdit`, the saved disposable fixture lost `public`, and `mvn test` passed. The property diagnostic also returned `Create metadata for 'ser'`, but that separate action was not executed. Evidence: `tmp/cav-verify-20260718/evidence/stock-fixed2-foreground.log` and `quick-fix-picker-fixed2.png`. |
| References and implementations | `verified` | The official Java JDT server advertises `referencesProvider` and `implementationProvider`; the coordinator does not interpose on either. Driven run 2026-07-18: on `GreetingService`, "Go to Implementation" issued `textDocument/implementation` and returned `DefaultGreetingService`; "Find All References" issued `textDocument/references` and returned 4 cross-file locations (the declaration, the `implements` clause, and two javadoc `{@link}` references). Both are gesture-triggered standard LSP served directly by the official Java extension. Evidence: `tmp/refs-impl-capture-20260718/evidence/`. |
| Boot project info | `planned` | `sts/spring-boot/bootProjectInfo` is advertised and forwarded unchanged. Preferred route: a Code Action reads project info after explicit selection and feeds reviewable debug/task generation. Manual `.zed/debug.json`/`.zed/tasks.json` remains fallback; server availability alone does not implement the outcome. |
| Executable Boot projects discovery | `planned` | Its required `sts/project/gav` callback is contract-tested through the coordinator and official Java transport. Preferred route: a Code Action invokes `sts/spring-boot/executableBootProjects`, presents a bounded selection, and offers configuration generation. If the prompt is inadequate, a generated candidate document is fallback; a driven user-facing result remains required. |
| Spring XML config support | `planned` | Preferred route: pass reviewed `boot-java.support-spring-xml-config.*` settings and use standard completion, diagnostics, navigation, and Code Actions. A failing reconciler is disabled independently rather than weakening other Spring features. |

## Workstream 3 — live application data

| Capability | State | Notes |
| --- | --- | --- |
| Connect / disconnect to a local Boot process | `planned` | Preferred route: a Code Action calls `listProcesses`, uses a bounded Zed message choice, then executes `sts/livedata/connect`/`disconnect` with coordinator-owned identity and cleanup. If the list is not usable in that prompt, an opt-in Live document is the fallback presentation; no reduced connection mode is claimed. |
| Remote connect | `planned` | Preferred route: an explicit Code Action reads endpoint and non-secret options from Zed settings before `sts/livedata/remoteConnect`. Credential input/storage needs a separate security decision; credentials may not enter project files, generated documents, action arguments, or logs. |
| Live hover data | `planned` | Preferred route: cache authenticated live results in the coordinator and adapt them to standard hover, CodeLens, or inlay hints with source identity and freshness. Static Spring hover remains fallback and expired live facts are hidden. |
| Show / hide / refresh live data | `planned` | Preferred route: contextual Code Actions drive `live.show.active`, `live.hide.active`, and `live.refresh.active`, with explicit refresh state shared by inline surfaces and an optional Live document. |
| Metrics | `planned` | Preferred route: `sts/livedata/get/metrics` and `refresh/metrics` feed an opt-in, timestamped Spring Live document. A link to the application's own endpoint is fallback if editor refresh/redaction cannot be bounded. |
| Loggers and log levels | `planned` | Preferred route: an opt-in Live document lists `getLoggers` results and exposes confirmed item-level `configure/logLevel` Code Actions. Read-only data or the external Actuator endpoint is fallback if selection/confirmation is unsafe. |
| Automatic connection | `planned` | Settings `boot-java.live-information.automatic-connection.on` and `all-local-java-processes`. Automatic behavior must reuse the verified explicit connection lifecycle and fail closed on ambiguous process identity. |

## Workstream 4 — structure view, run/debug, tasks

| Capability | State | Notes |
| --- | --- | --- |
| Browse / navigate the Spring logical structure | `zed-native-equivalent` | Resolved baseline 2026-07-18: Zed's Project Symbols returns and navigates beans, the request-mapping endpoint, and component/configuration/application stereotypes, so it remains the documented fallback. Preferred additions are S015's official per-file LSP Outline and an explicitly requested, regenerable Spring Structure document for worktree grouping. Neither addition changes this state until driven. Evidence: `tmp/ws2-symbols-run2-20260718/`. |
| Structure refresh / grouping | `planned` | Preferred route: `sts/spring-boot/structure` and `structure/groups` generate or refresh an opt-in, deterministic Structure document with source links. Project Symbols remains fallback. The document must be safe to delete, must not silently edit `.gitignore`, and needs stale/refresh verification. |
| Run / debug a Boot application | `planned` | Preferred route after S016: reuse official Java 6.8.23's main runnable for a matching Run action. Reviewable Spring-specific `.zed/tasks.json` and explicit official-Java Run (`noDebug`) or Debug entries are companions only where profiles, arguments, project choice, or debugging require them. The later execution slice must also test, but not assume, a Spring-specific workspace task bound to the existing `java-main` runnable tag. Version 6.8.21 and manually authored configuration remain the conditional fallback until the compatibility and safe-generation gates pass; no route may overwrite unknown configuration or imply programmatic debug start. |
| Maven goal / Gradle build | `planned` | Build execution remains official Java/Zed task ownership under D003. After S016, prefer official Java 6.8.23's wrapper-aware main/test tasks where they match; generate or merge reviewable `.zed/tasks.json` only for arbitrary goals/builds or Spring-specific commands. Manual tasks remain fallback. Spring LS's direct `Runtime.exec` commands are not selected because they do not provide Zed task/terminal ownership. |
| Open Boot app page URL | `planned` | Preferred route: expose a standard Document Link or clickable Markdown URL in hover or the opt-in Live document. A Code Action that discovers a URL may present it through Zed's general `window/showMessageRequest` Markdown prompt, whose source routes link clicks through `open_url_or_file`; this companion still needs a driven desktop test. Zed's general LSP client does not advertise or handle `window/showDocument`, so copyable text is the required fallback. OS-specific opener tasks remain an excluded contingency unless public links fail and a separate cross-platform security/quoting gate supports them. |

## Workstream 5 — commands, upgrade, Modulith

| Capability | State | Notes |
| --- | --- | --- |
| Spring Boot upgrade | `planned` | Preferred route: a Code Action executes `sts/upgrade/spring-boot` and applies only reviewable workspace edits. If authentic upgrade needs unsupported multi-step UI or external content, stop before mutation and retain the manual upgrade workflow. |
| Modulith metadata refresh | `planned` | Preferred route: a Code Action selects a project, executes `sts/modulith/metadata/refresh`, and refreshes standard symbols or the opt-in Structure document. |
| Modulith projects | `planned` | Preferred route: Workspace Symbols provides search and an opt-in Structure document provides module/dependency grouping. Ordinary Java navigation remains fallback if metadata or links are incomplete. |
| Spring Initializr | `planned` | Not in this pinned VSIX; a separate VS Code extension provides it. It remains outside the selected runtime boundary until a distinct network, artifact, scope, and UX decision is accepted. External Initializr use is the fallback. |
| Explain SpEL / queries / AOP (AI assistant) | `planned` | `query.explain` and `sts/enable/copilot/features` are VS Code Copilot-bound. A Zed Agent, skill, or MCP equivalent requires a separate product decision and is not included in the extension parity claim by D005. |

## Workstream 6 — settings, diagnostics, and lifecycle

| Capability | State | Notes |
| --- | --- | --- |
| Start Spring Boot Language Server on demand | `zed-native-equivalent` | `vscode-spring-boot.ls.start` is a VS Code client command, not a server request the coordinator receives. In Spring Tools' `Main.ts` it calls `client.start()` and then registers the classpath service, registers the Java-data service, and forces `sts.vscode-spring-boot.enableClasspathListening(true)`. Zed owns language-server start/restart (auto-start on opening a Boot file, restart via Zed's action — both exercised in M2), and the coordinator already performs the callback's work: it serves the classpath bridge (`sts/addClasspathListener`) and the Java-data methods (`sts/java*`), and sends `enableClasspathListening(true)` once the official Java route is ready. So the outcome is delivered without an on-demand command. Earlier "coordinator does not handle this client request" was a miscategorization: it is not a coordinator request. |
| Java type resolution for the server | `verified` | Observed 2026-07-18 on macOS arm64/JDK 25 with the development extension and Zed 1.11.3. `sts/javaType` is a server→client request (`@JsonRequest("sts/javaType")` on Spring Tools' `STS4LanguageClient`; the server calls `client.javaType(...)` from `JdtLsIndex`). During project indexing the Spring server issued a real `sts/javaType`, and the coordinator routed it to the official Java extension's `sts.java.type` command over the loopback route and answered it — observed as the coordinator's once-per-method success log `official Java data request sts/javaType answered` (emitted only after the loopback returns a result). Zed's own trace shows **no** `sts/javaType`, confirming the coordinator intercepts it before the editor; the pre-coordinator spike `s011`, where the request reached Zed and was rejected `-32601`, was the failure mode. `JavaTransport` maps this and eight sibling `sts/java*` methods to `sts.java.*`; the siblings share the path and contract test but were not each observed at runtime. Contract-tested (`Java data requests are answered through the official Java transport`). Evidence: `tmp/cav-verify-20260718/`. |
| Classpath listening | `verified` | `sts.vscode-spring-boot.enableClasspathListening` driven by the coordinator; observed registering and removing during the M2 gate run. **Install-ordering caveat**: if the extension is installed while a Java project is already open, `jdtls` does not pick up the bridge until Zed restarts; when the extension is present before the Java server starts it registers fine, cold cache included. See [S014](spikes/014-jdtls-bundle-startup-ordering.md). |
| Missing / incompatible Java diagnostic | `verified` | Observed on 2026-07-18 by driving the real coordinator process on incompatible inputs. A real Temurin 17.0.18 was refused with `JDK 21 or newer is required by Spring Tools`; an unverified official-Java-extension contract was refused with `official Java compatibility contract is invalid` before the JDK check. Both exited nonzero with no reduced mode; a compatible Temurin 21.0.11 control passed both guards and launched the real Spring server. Absent-Java path observed earlier in M2. Evidence: `tmp/m2-step7-incompatible-java-20260718/`. |
| Embedded language syntax highlighting | `planned` | Setting `boot-java.embedded-syntax-highlighting`; the VSIX contributes four grammars. D005 preserves official Java highlighting and excludes Java query replacement from the baseline. A future opt-in query pack needs a new direction decision after stock-Zed routes are exhausted. |
| Java reconcilers | `planned` | Preferred route: pass reviewed `boot-java.java.reconcilers` and `boot-java.scan-java-test-sources.on` settings and surface standard diagnostics/Code Actions. A failing reconciler is disabled independently. |
| Offline behaviour | `planned` | Preserve the checked artifact cache, compatibility diagnostics, and fail-closed provider behavior. Official Java 6.8.23 remains an unknown provider until S016 repeats the versioned bridge/lifecycle and warm-cache controls. Rollback, full offline installation, and platform evidence remain planned; see `LIMITATIONS.md`. |

## Maintenance

- Bump the inventory version and re-derive when the pinned Spring Tools release
  moves. State recorded against one release does not carry to another.
- A state changes only with evidence. `verified` requires a named tuple.
- A `blocked-*` state requires the exact missing surface, not a general claim,
  and requires that no Zed-native surface delivers the outcome. "We cannot build
  that exact VS Code widget" is not a blocker; name the capability by outcome.
- Update this file in the same change as the slice that moves a state.
