# Capability inventory

- Inventory version: 4
- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Last updated: 2026-07-18
- Evidence: [R011](research/011-vscode-spring-tools-capability-surface.md)
- Only tested tuple: macOS 26.5.1 arm64, Zed 1.10.3, official Java extension
  6.8.21, Temurin JDK 25.0.3

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

## Summary

46 capabilities tracked.

| State | Count |
| --- | --- |
| `verified` | 5 |
| `implemented` | 1 |
| `planned` | 39 |
| `blocked-zed-api` | 0 |
| `blocked-upstream` | 0 |
| `zed-native-equivalent` | 1 |

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

## Workstream 1 — properties and YAML

| Capability | State | Notes |
| --- | --- | --- |
| Property key/value completion in `.properties` | `verified` | Real metadata completion observed on the tested tuple during the M2 gate run. |
| Property completion in `.yaml` | `verified` | Real metadata completion observed in `application.yaml` on the tested tuple, including type detail and a deprecation note in the documentation panel. |
| Hover documentation on properties | `planned` | Server advertises `hoverProvider`. Zed does not request hover passively, so this needs a driven observation. |
| Property validation / diagnostics | `verified` | Spring-attributed diagnostics observed for both files on the tested tuple: `'ser' is an unknown property. Did you mean 'server.address'?` in `.properties`, which requires classpath metadata, and `Expecting a 'Mapping' node but got 'ser'` in `.yaml`. Both carry `source: vscode-spring-boot`. |
| Navigation from a property to its definition | `planned` | Server advertises `definitionProvider`. |
| Shared properties metadata reload | `planned` | `sts/common-properties/reload`; setting `boot-java.common.properties-metadata`. |
| Convert `.properties` to `.yaml` | `planned` | `sts/boot/props-to-yaml`. Needs a Zed command surface. |
| Convert `.yaml` to `.properties` | `planned` | `sts/boot/yaml-to-props`. Needs a Zed command surface. |
| `spring-factories` language support | `planned` | VSIX associates `*.factories` and `META-INF/spring.factories` with a distinct language. Zed reaches a server only for files it classifies as a mapped language, and file classification needs a `languages/<name>/config.toml` with `path_suffixes` and a **required grammar** — the API has no grammar-less file-association surface. So this needs a language-plus-grammar contribution, which an extension *can* add; it is additional work, not a Zed API block. Until then, `.factories` files reach no server. |
| `jpa-query-properties` language support | `planned` | VSIX pattern is `jpa-named-queries.properties`. Because that is a `.properties` file, Zed already routes it to this server as the `Properties` language, so it is **not** unhandled — but the language id sent is `spring-boot-properties`, not `jpa-query-properties`. Whether Spring keys JPA-query support off the filename (works today) or the language id (degraded) is unverified. Sending a distinct id for one filename requires defining a separate Zed language, same grammar constraint as above. |
| Completion prefix elision | `planned` | Setting `boot-java.properties.completions.elide-prefix`. |

## Workstream 2 — symbols, navigation, and Boot project discovery

| Capability | State | Notes |
| --- | --- | --- |
| Document symbols | `planned` | Server advertises `documentSymbolProvider`. |
| Workspace symbols (Spring symbols) | `planned` | Server advertises `workspaceSymbolProvider`. |
| Request mapping navigation | `planned` | Expected via symbols/definition; exact surface not yet traced. |
| Bean navigation | `planned` | Related settings: `boot-java.java.beans-structure-tree`, `boot-java.java.completions.inject-bean`. |
| Code lenses | `planned` | Server advertises `codeLensProvider`; setting `boot-java.highlight-codelens.on`. |
| Inlay hints (including cron) | `planned` | Server advertises `inlayHintProvider`; setting `boot-java.cron.inlay-hints`. |
| Code actions / quick fixes | `planned` | Server advertises `codeActionProvider` with resolve. |
| References and implementations | `planned` | Server advertises `referencesProvider`, `implementationProvider`. |
| Boot project info | `planned` | `sts/spring-boot/bootProjectInfo`. |
| Executable Boot projects discovery | `planned` | `sts/spring-boot/executableBootProjects`. |
| Spring XML config support | `planned` | Settings `boot-java.support-spring-xml-config.*`. |

## Workstream 3 — live application data

| Capability | State | Notes |
| --- | --- | --- |
| Connect / disconnect to a local Boot process | `planned` | `sts/livedata/connect`, `disconnect`, `listProcesses`. |
| Remote connect | `planned` | `sts/livedata/remoteConnect`. |
| Live hover data | `planned` | `vscode-spring-boot.live-hover.connect`; the VS Code surface is hover decoration. |
| Show / hide / refresh live data | `planned` | `live.show.active`, `live.hide.active`, `live.refresh.active`. |
| Metrics | `planned` | `sts/livedata/get/metrics`, `refresh/metrics`. |
| Loggers and log levels | `planned` | `sts/livedata/getLoggers`, `configure/logLevel`; command `set.log-levels`. |
| Automatic connection | `planned` | Settings `boot-java.live-information.automatic-connection.on`, `all-local-java-processes`. |

## Workstream 4 — structure view, run/debug, tasks

| Capability | State | Notes |
| --- | --- | --- |
| Browse / navigate the Spring logical structure | `planned` | VS Code delivers this as the `explorer.spring` tree view, which cannot be reproduced as a custom panel (see surface constraint 1). But the outcome — browsing beans, endpoints, and mappings — may be reachable through Zed's outline panel and symbol search: the Spring server advertises `documentSymbolProvider` and `workspaceSymbolProvider`, and Spring Tools is known to surface request mappings and beans as workspace symbols. Not yet verified. The fixture now carries a `@RestController` request mapping and a `@Bean`, so a driven run can capture the `documentSymbol`/`workspace/symbol` responses; that run is the pending step. This is the classification error corrected in the tree-view review: it was wrongly `blocked-zed-api`. Becomes `zed-native-equivalent` if symbols carry the structure, or `blocked-zed-api` only if they demonstrably do not. |
| Structure refresh / grouping | `planned` | `structure.refresh`, `structure.grouping`; `sts/spring-boot/structure`, `structure/groups`. Meaningful only once the structure has a Zed surface to refresh. |
| Run / debug a Boot application | `planned` | Not blocked: Zed supports debugger extensions, and the API exposes DAP (`get-dap-binary`, `dap-request-kind`, `dap-config-to-scenario`, locators). |
| Maven goal / Gradle build | `planned` | `sts.maven.goal`, `sts.gradle.build`. Build execution is official Java's ownership under D003. |
| Open Boot app page URL | `planned` | `vscode-spring-boot.open.url`. |

## Workstream 5 — commands, upgrade, Modulith

| Capability | State | Notes |
| --- | --- | --- |
| Spring Boot upgrade | `planned` | `sts/upgrade/spring-boot`. |
| Modulith metadata refresh | `planned` | `spring.modulith.metadata.refresh`, `sts/modulith/metadata/refresh`. |
| Modulith projects | `planned` | `sts/modulith/projects`. |
| Spring Initializr | `planned` | Not in this VSIX's contribution surface; provided by a separate VS Code extension. Scope decision needed before it enters the inventory properly. |
| Explain SpEL / queries / AOP (AI assistant) | `planned` | `query.explain`, `sts/enable/copilot/features`. Bound to VS Code Copilot; a Zed equivalent is a design question, not a port. |

## Workstream 6 — settings, diagnostics, and lifecycle

| Capability | State | Notes |
| --- | --- | --- |
| Start Spring Boot Language Server on demand | `zed-native-equivalent` | `vscode-spring-boot.ls.start` is a VS Code client command, not a server request the coordinator receives. In Spring Tools' `Main.ts` it calls `client.start()` and then registers the classpath service, registers the Java-data service, and forces `sts.vscode-spring-boot.enableClasspathListening(true)`. Zed owns language-server start/restart (auto-start on opening a Boot file, restart via Zed's action — both exercised in M2), and the coordinator already performs the callback's work: it serves the classpath bridge (`sts/addClasspathListener`) and the Java-data methods (`sts/java*`), and sends `enableClasspathListening(true)` once the official Java route is ready. So the outcome is delivered without an on-demand command. Earlier "coordinator does not handle this client request" was a miscategorization: it is not a coordinator request. |
| Java type resolution for the server | `implemented` | `sts/javaType` is a server→client request (`@JsonRequest("sts/javaType")` on Spring Tools' `STS4LanguageClient`; the server calls `client.javaType(...)` from `JdtLsIndex`). The coordinator **does** handle it: `JavaTransport` maps it, and eight sibling `sts/java*` methods, to the official Java extension's `sts.java.*` commands over the loopback route, and `handleSpringMessage` routes any `supportsSpringClientMethod` request there. Contract-tested (`Java data requests are answered through the official Java transport`). Not yet observed with a real server request on a named tuple, so `implemented`, not `verified`. Earlier "unhandled by the coordinator" was incorrect. |
| Classpath listening | `verified` | `sts.vscode-spring-boot.enableClasspathListening` driven by the coordinator; observed registering and removing during the M2 gate run. **Install-ordering caveat**: if the extension is installed while a Java project is already open, `jdtls` does not pick up the bridge until Zed restarts; when the extension is present before the Java server starts it registers fine, cold cache included. See [S014](spikes/014-jdtls-bundle-startup-ordering.md). |
| Missing / incompatible Java diagnostic | `verified` | Observed on 2026-07-18 by driving the real coordinator process on incompatible inputs. A real Temurin 17.0.18 was refused with `JDK 21 or newer is required by Spring Tools`; an unverified official-Java-extension contract was refused with `official Java compatibility contract is invalid` before the JDK check. Both exited nonzero with no reduced mode; a compatible Temurin 21.0.11 control passed both guards and launched the real Spring server. Absent-Java path observed earlier in M2. Evidence: `tmp/m2-step7-incompatible-java-20260718/`. |
| Embedded language syntax highlighting | `planned` | Setting `boot-java.embedded-syntax-highlighting`; VSIX contributes four grammars. |
| Java reconcilers | `planned` | Setting `boot-java.java.reconcilers`; `boot-java.scan-java-test-sources.on`. |
| Offline behaviour | `planned` | Artifact acquisition currently requires network on first use; see `LIMITATIONS.md`. |

## Maintenance

- Bump the inventory version and re-derive when the pinned Spring Tools release
  moves. State recorded against one release does not carry to another.
- A state changes only with evidence. `verified` requires a named tuple.
- A `blocked-*` state requires the exact missing surface, not a general claim,
  and requires that no Zed-native surface delivers the outcome. "We cannot build
  that exact VS Code widget" is not a blocker; name the capability by outcome.
- Update this file in the same change as the slice that moves a state.
