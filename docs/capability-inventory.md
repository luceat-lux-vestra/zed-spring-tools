# Capability inventory

- Inventory version: 11
- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Last updated: 2026-07-19
- Evidence: [R011](research/011-vscode-spring-tools-capability-surface.md),
  [R013](research/013-zed-native-capability-delivery-surfaces.md),
  [R014](research/014-final-upstream-capability-surface-audit.md),
  [R016](research/016-zed-github-compatibility-reporting.md),
  [R017](research/017-zed-codelens-hover-command-compatibility.md),
  [R018](research/018-spring-tools-zed-outcome-parity-audit.md), and
  [R019](research/019-zed-codelens-agent-navigation-and-build-output.md)
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
| `verified` | Observed working on a named tuple. |

`implemented` and `verified` differ deliberately: this project does not treat
"the code exists" as evidence that it works.

The inventory records evidence state. The delivery plan separately records the
preferred route and the preserved baseline/fallback for every capability. A
selected route or planning-confidence score does not change a state here.

## Summary

57 capabilities tracked.

| State | Count |
| --- | --- |
| `verified` | 17 |
| `implemented` | 2 |
| `planned` | 33 |
| `blocked-zed-api` | 0 |
| `blocked-upstream` | 0 |
| `zed-native-equivalent` | 5 |

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
| Shared properties metadata reload | `planned` | Preferred route: a standard Code Action executes `sts/common-properties/reload` and observes diagnostics/completion refresh. Manual server restart remains fallback. Setting: `boot-java.common.properties-metadata`. |
| Convert `.properties` to `.yaml` | `planned` | Preferred route: a Code Action executes `sts/boot/props-to-yaml` and applies a reviewable create/replace workspace edit. Manual conversion remains fallback if safe file creation/merge is not verified. |
| Convert `.yaml` to `.properties` | `planned` | Preferred route: a Code Action executes `sts/boot/yaml-to-props` and applies a reviewable create/replace workspace edit. Manual conversion remains fallback if safe file creation/merge is not verified. |
| `spring-factories` language support | `planned` | VSIX associates `*.factories` and `META-INF/spring.factories` with a distinct language. Zed reaches a server only for files it classifies as a mapped language, and file classification needs a `languages/<name>/config.toml` with `path_suffixes` and a **required grammar** — the API has no grammar-less file-association surface. So this needs a language-plus-grammar contribution, which an extension *can* add; it is additional work, not a Zed API block. Until then, `.factories` files reach no server. |
| `jpa-query-properties` language support | `planned` | VSIX pattern is `jpa-named-queries.properties`. Because that is a `.properties` file, Zed already routes it to this server as the `Properties` language, so it is **not** unhandled — but the language id sent is `spring-boot-properties`, not `jpa-query-properties`. Whether Spring keys JPA-query support off the filename (works today) or the language id (degraded) is unverified. Sending a distinct id for one filename requires defining a separate Zed language, same grammar constraint as above. |
| Completion prefix elision | `planned` | Setting `boot-java.properties.completions.elide-prefix`. |

## Workstream 2 — symbols, navigation, and Boot project discovery

| Capability | State | Notes |
| --- | --- | --- |
| Document symbols | `zed-native-equivalent` | S015 Refuted the preferred LSP Outline route on the tested tuple. With `languages.Java.document_symbols: on` after both servers were ready, Zed merged package/type/method plus nested Spring component/bean/endpoint results with no exact duplicate labels; navigation and saved-edit refresh worked. After restart, however, Spring answered before JDT dynamically registered Document Symbols, and Zed cached a Spring-only Outline that omitted ordinary Java symbols until another source edit forced recollection. The setting was restored to `off`; verified Project Symbols remains the supported fallback and an opt-in Structure document remains planned. Evidence: `tmp/s015-document-symbols-20260718/evidence/`; earlier tree-sitter control: `tmp/ws2-symbols-run2-20260718/`. |
| Workspace symbols (Spring symbols) | `verified` | Observed 2026-07-18. Zed's "Go to Symbol in Project" issued `workspace/symbol`; the Spring server (through the coordinator) returned the logical structure — `@+ 'greetingController' (@RestController <: @Controller, @Component)`, `@+ 'greetingPrefix' (@Bean) String`, `@+ 'greetingConfiguration' (@Configuration)`, `@+ 'fixtureApplication' (@SpringBootApplication)`, and `@/greeting -- GET` — each with a resolved location in the fixture. jdtls returned 0 for the `@`-prefixed queries, so the symbols are attributable to Spring. Evidence: `tmp/ws2-symbols-run2-20260718/`. |
| Request mapping navigation | `verified` | Observed 2026-07-18. `@/greeting -- GET` (kind 6) is returned by `workspace/symbol` as a navigable workspace symbol resolved to `GreetingController.java`, so Zed's symbol picker jumps to the mapping. |
| Bean navigation | `verified` | Observed 2026-07-18. `@+ 'greetingPrefix' (@Bean)` and the `@Component`/`@Configuration` symbols are returned by `workspace/symbol` with resolved locations, navigable from Zed's symbol picker. |
| Static Spring CodeLens | `verified` | Verified 2026-07-19 on macOS arm64/JDK 25 with Zed 1.11.3, official Java 6.8.21, and Spring Tools 5.2.0. Spring's five standard providers cover functional-handler summaries, web-configuration links, Data AOT query/implementation/refactor/refresh, AI-only explanation prompts, and AI-only functional-router conversion prompts. The coordinator preserves advertised server commands, translates valid source targets to Zed's location command, and retains informational/AI-only titles behind an explanatory command. `CL-4d` asynchronously executes Spring's authentic resolver outside the serialized Spring handler, captures its `window/showDocument` URI/range, caches it by source version/arguments, refreshes CodeLens, and rewrites the next lens to `editor.action.goToLocations`; a driven click opened the exact generated method while `/target/` remained ignored. AI notices explicitly say the extension cannot detect or invoke Agent and sends no source/prompt to AI. See the [CodeLens showcase](code-lens-showcase.md), [R018](research/018-spring-tools-zed-outcome-parity-audit.md), and [R019](research/019-zed-codelens-agent-navigation-and-build-output.md). |
| Live-data highlight CodeLens | `verified` | Verified 2026-07-19 on macOS arm64/JDK 25 with Zed 1.11.3, official Java 6.8.21, Spring Tools 5.2.0, and a connected Boot 3.5.5/JMX process. Unlike static providers, these arrive through custom versioned `sts/highlight`. Zed received coordinator-owned `workspace/codeLens/refresh`, requested standard CodeLens, and rendered authentic endpoint, bean and injection lenses alongside JDT reference lenses. Injection titles such as `← DefaultGreetingService` use the explanatory `sts.showHoverAtPosition` fallback: click selected the source range, the notice named native `editor::Hover`, and `cmd-k cmd-i` rendered Spring bean/type/resource/process data together with JDT hover. The dedicated `CL-7c` gate also passed: a commandless `@Value("${CODELENS_SAMPLE_LIMIT}")` range became `Spring live data — use Hover`, and native Hover returned `37` with source `systemEnvironment`; the value was not persistently exposed above source. The run also exposed `vscode-spring-boot.open.url`; it is retained as a visible URL and explanatory command instead of a silent no-op. Contract tests cover merge, refresh, commandless-range adaptation, stale-version rejection, command preservation and explanation. Remaining gates are a forced stale-response race and other desktop tuples. Evidence: `tmp/codelens-runtime-20260719.udLvyE/evidence/`, [R017](research/017-zed-codelens-hover-command-compatibility.md), and [R018](research/018-spring-tools-zed-outcome-parity-audit.md). |
| Inlay hints (including cron) | `verified` | Confirmed 2026-07-18 and re-verified 2026-07-19 on macOS arm64/JDK 25 with the development extension and unmodified Zed 1.11.3. A follow-up restart exposed a race hidden by the first gate: Spring could return an early empty result, later return `label: "every hour"`, and then transiently return empty again for the unchanged document, making the hint appear and disappear. The coordinator now remembers a bounded set of recent visible requests, pre-warms them after a completed non-empty `spring/index/updated`, refreshes Zed only after that pre-warm, and preserves the last non-empty range result until the document version changes or closes. The driven retry rendered `every hour` for `@Scheduled(cron = "0 0 * * * *")` after cold startup and retained it after switching between Java files. The earlier zero-request verdict was invalid: its fixture lived under this repository's ignored `tmp/` tree, and Zed deliberately removes ignored worktree entries in `Editor::is_lsp_relevant` before collecting visible inlay-hint ranges. A single **Toggle Inlay Hints** invocation was also not a force-enable diagnostic: Zed computes `Toggle(!self.inlay_hints_enabled())`, so it disables an already-enabled buffer. A separate generic Zed issue remains for servers such as jdtls that dynamically register `textDocument/inlayHint` without requesting a refresh; it is not a blocker for Spring cron hints because the coordinator owns the Spring LSP connection and refresh lifecycle. Runtime traces: `tmp/inlay-fix-runtime-20260718/stock-zed-index-refresh.log` and `tmp/inlay-fix-runtime-20260718/patched-clean-zed.log`; non-ignored fixture: `/tmp/zed-spring-inlay-fixture.aTcams`. |
| Code actions / quick fixes | `verified` | Observed end to end on 2026-07-18 with macOS 26.5.1 arm64, Temurin JDK 25.0.3, official Java 6.8.21, the development extension, and unmodified Zed 1.11.3. Spring initially advertises `sts.vscode-spring-boot.codeAction`, but enabling its classpath listener dynamically registers one internal `sts4.classpath.<letters>` command. Zed 1.11.3 replaces rather than extends the static `executeCommandProvider` command list for that registration, so it received Spring quickfix responses but filtered them out of the menu as unavailable commands. The coordinator already owns and relays that exact callback without Zed, so it now consumes the callback's registration and unregistration, preserving Spring's static command list. After rebuilding, Zed's standard code-action menu displayed `Remove 'public' from @Bean method`; selecting it emitted `workspace/executeCommand`, Spring returned `workspace/applyEdit`, the saved disposable fixture lost `public`, and `mvn test` passed. The property diagnostic also returned `Create metadata for 'ser'`, but that separate action was not executed. Evidence: `tmp/cav-verify-20260718/evidence/stock-fixed2-foreground.log` and `quick-fix-picker-fixed2.png`. |
| References and implementations | `verified` | The official Java JDT server advertises `referencesProvider` and `implementationProvider`; the coordinator does not interpose on either. Driven run 2026-07-18: on `GreetingService`, "Go to Implementation" issued `textDocument/implementation` and returned `DefaultGreetingService`; "Find All References" issued `textDocument/references` and returned 4 cross-file locations (the declaration, the `implements` clause, and two javadoc `{@link}` references). Both are gesture-triggered standard LSP served directly by the official Java extension. Evidence: `tmp/refs-impl-capture-20260718/evidence/`. |
| Source authorship and change history | `zed-native-equivalent` | This is not a Spring Boot Tools capability. Zed provides current-line inline blame, Git gutter/change indicators, a Git panel, clickable commit references and hosted permalinks. No Spring/JDT duplication is planned. |
| Spring-specific references and document highlights | `planned` | Spring separately implements references for property values, profiles, qualifiers, named beans and application events, plus WebFlux-route and embedded-query document highlights. Preferred route is Zed's standard References and Document Highlights UI; test multi-server composition and source attribution. |
| Spring-aware Java completion | `planned` | The server dynamically registers standard Java completion for `@Value`, repository methods, `@Scope`, profiles, bean names/types, qualifiers, resources, conditional annotations, cron, and optional bean injection. Preferred route is native completion; representative families and configuration switches need runtime evidence. |
| Spring Java request-mapping templates | `planned` | Spring returns request-mapping method templates as standard snippet completion items. Preferred route is Zed's native completion/snippet insertion; verify placeholders, imports/additional edits, and controller context. |
| SpEL language intelligence | `planned` | Spring supplies embedded semantic tokens and diagnostics, plus contextual hover/navigation paths; AI explanation is a separate client-only lens. Preferred route is standard Zed semantic tokens, diagnostics, hover and navigation. Do not conflate working language intelligence with the VS Code Copilot command. |
| Spring Data query intelligence | `planned` | Includes repository-method completion and embedded JPQL/HQL/SQL semantic tokens, diagnostics, highlights, inlay hints, multiline conversion, AOT query display, implementation navigation and refactoring. These are standard LSP surfaces or advertised Spring commands; verify Java text blocks and the distinct `jpa-named-queries.properties` language identity. |
| Cron completion, validation, and semantic highlighting | `planned` | Cron inlay hints are already verified separately. Completion, diagnostics and embedded semantic tokens use standard LSP and should be exercised independently. |
| Boot project info | `implemented` | The synthetic `zed-spring-tools.configure-boot-run` Code Action consumes `sts/spring-boot/executableBootProjects` project records (`name`/`projectName`, `mainClass`, `uri`) to generate reviewable run/debug configuration; the 2026-07-19 driven run confirmed the real `mainClass` reached the generated `.zed/debug.json`. `sts/spring-boot/bootProjectInfo` remains advertised and forwarded unchanged for additional detail, which is not separately exercised. |
| Executable Boot projects discovery | `verified` | A synthetic `source` Code Action on Java files invokes `sts/spring-boot/executableBootProjects` (its `sts/project/gav` callback routes through the official Java transport), presents a bounded `window/showMessageRequest` selection (single project skips the prompt; `All projects` covers overflow beyond eight), and generates merge-safe `.zed/tasks.json`/`.zed/debug.json`. Driven on 2026-07-19 (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25, fixture `spring-boot-basic`): the LSP trace showed the injected action, the user-selected command produced correct `.zed/tasks.json`/`.zed/debug.json` for the discovered project, and the confirmation notice reported one entry each. |
| Spring XML config support | `planned` | Preferred route: pass reviewed `boot-java.support-spring-xml-config.*` settings and use standard completion, diagnostics, navigation, and Code Actions. A failing reconciler is disabled independently rather than weakening other Spring features. |

## Workstream 3 — live application data

| Capability | State | Notes |
| --- | --- | --- |
| Connect / disconnect to a local Boot process | `planned` | Preferred route: a Code Action calls `listProcesses`, uses a bounded Zed message choice, then executes `sts/livedata/connect`/`disconnect` with coordinator-owned identity and cleanup. If the list is not usable in that prompt, an opt-in Live document is the fallback presentation; no reduced connection mode is claimed. |
| Remote connect | `planned` | Preferred route: an explicit Code Action reads endpoint and non-secret options from Zed settings before `sts/livedata/remoteConnect`. Credential input/storage needs a separate security decision; credentials may not enter project files, generated documents, action arguments, or logs. |
| Live hover data | `zed-native-equivalent` | Source-local live bean and injection facts are verified through live CodeLens followed by Zed's native Hover gesture. The connected run rendered Spring bean name, type, resource, bean id and process together with JDT hover. One-click dispatch remains blocked by Zed's client-command bridge; aggregate live data and explicit connection UX remain separate planned capabilities. |
| Show / hide / refresh live data | `planned` | Preferred route: contextual Code Actions drive `live.show.active`, `live.hide.active`, and `live.refresh.active`, with explicit refresh state shared by inline surfaces and an optional Live document. |
| Metrics | `planned` | Preferred route: `sts/livedata/get/metrics` and `refresh/metrics` feed an opt-in, timestamped Spring Live document. A link to the application's own endpoint is fallback if editor refresh/redaction cannot be bounded. |
| Loggers and log levels | `planned` | Preferred route: an opt-in Live document lists `getLoggers` results and exposes confirmed item-level `configure/logLevel` Code Actions. Read-only data or the external Actuator endpoint is fallback if selection/confirmation is unsafe. |
| Automatic connection | `planned` | Settings `boot-java.live-information.automatic-connection.on` and `all-local-java-processes`. Automatic behavior must reuse the verified explicit connection lifecycle and fail closed on ambiguous process identity. |

## Workstream 4 — structure view, run/debug, tasks

| Capability | State | Notes |
| --- | --- | --- |
| Browse / navigate the Spring logical structure | `zed-native-equivalent` | Zed's Project Symbols returns and navigates beans, the request-mapping endpoint, and component/configuration/application stereotypes, so it remains the supported equivalent. S015 Refuted the preferred per-file LSP Outline because restart can omit Java symbols; an explicitly requested, regenerable Spring Structure document remains the planned grouping companion. Evidence: `tmp/ws2-symbols-run2-20260718/` and `tmp/s015-document-symbols-20260718/evidence/`. |
| Structure refresh / grouping | `planned` | Preferred route: `sts/spring-boot/structure` and `structure/groups` generate or refresh an opt-in, deterministic Structure document with source links. Project Symbols remains fallback. The document must be safe to delete, must not silently edit `.gitignore`, and needs stale/refresh verification. |
| Run / debug a Boot application | `implemented` | The configure Code Action generates merge-safe `.zed/tasks.json` (wrapper-aware `spring-boot:run`/`bootRun`, portable `$ZED_WORKTREE_ROOT`-relative `cwd`, editable `env`) and `.zed/debug.json` (`"adapter": "Java"` launch with `mainClass`, `cwd`, and editable `vmArgs`/`args`/`env`). One base entry plus one per discovered Spring profile (from `application-<profile>.*` filenames and multi-document `application.{yml,yaml}` activation), capped at eight with the overflow named. Merge safety: create when absent, replace only its own labelled entries in plain JSON, and sidecar (never clobber) a commented or non-array file. **Driven checks verified on 2026-07-19** (macOS arm64, Zed 1.11.3, official Java 6.8.21, JDK 25): the generated run task's exact `mvn spring-boot:run` launched the Boot app and served `GET /greeting` (HTTP 200); a second check generated `dev`/`prod`/`staging` entries and launched the `dev` Java debug configuration after editing `vmArgs`, `args`, and `env`. Official Java's loopback main-class resolver requires system HTTP proxies to bypass `localhost`/`127.0.0.1`; its isolated-profile DAP helper path remains an S016 caveat. Still not driven: the multi-project prompt and other platform/build-tool runtime tuples. No route overwrites unknown configuration or starts a debug session programmatically. |
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
| Classpath listening | `verified` | `sts.vscode-spring-boot.enableClasspathListening` driven by the coordinator; observed registering and removing during the M2 gate run. **Install-ordering caveat**: if the extension is installed while a Java project is already open, `jdtls` does not pick up the bridge until Zed restarts; when the extension is present before the Java server starts it registers fine, cold cache included. See [S014](spikes/014-jdtls-bundle-startup-ordering.md). |
| Missing / incompatible Java diagnostic | `verified` | Observed on 2026-07-18 by driving the real coordinator process on incompatible inputs. A real Temurin 17.0.18 was refused with `JDK 21 or newer is required by Spring Tools`; a structurally invalid self-declared provider contract was refused with `official Java compatibility contract is invalid` before the JDK check. Both exited nonzero with no reduced mode; a compatible Temurin 21.0.11 control passed both guards and launched the real Spring server. Absent-Java path observed earlier in M2. D006 now makes the installed extension release non-gating; contract coverage and the 2026-07-19 CodeLens run both exercised the release-unpinned structural route successfully. Actual required-capability failures now produce a persistent clickable Markdown notification with an allowlisted title/body-prefilled GitHub report. The diagnostic Zed-to-browser gate opened a populated composer without submission; contract tests tie that UX to real failure paths. Evidence: `tmp/m2-step7-incompatible-java-20260718/`, `tmp/codelens-runtime-20260719.udLvyE/evidence/`, and R016. |
| Embedded language syntax highlighting | `planned` | Setting `boot-java.embedded-syntax-highlighting`; the VSIX contributes four grammars. D005 preserves official Java highlighting and excludes Java query replacement from the baseline. A future opt-in query pack needs a new direction decision after stock-Zed routes are exhausted. |
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
