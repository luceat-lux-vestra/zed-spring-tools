# Capability inventory

- Inventory version: 1
- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Last updated: 2026-07-17
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
| `verified` | 2 |
| `implemented` | 2 |
| `planned` | 42 |
| `blocked-zed-api` | 0 (1 candidate under check) |
| `blocked-upstream` | 0 |
| `zed-native-equivalent` | 0 |

Nothing is `blocked-*` yet, because no capability has been investigated deeply
enough to name its exact blocker. Candidates are marked in the notes rather than
promoted to a blocked state on suspicion.

## Workstream 1 — properties and YAML

| Capability | State | Notes |
| --- | --- | --- |
| Property key/value completion in `.properties` | `verified` | Real metadata completion observed on the tested tuple during the M2 gate run. |
| Property completion in `.yaml` | `implemented` | `spring-boot-properties-yaml` is mapped in `extension.toml` but never observed. |
| Hover documentation on properties | `planned` | Server advertises `hoverProvider`. |
| Property validation / diagnostics | `planned` | Diagnostics observed reaching Zed during M2, but not assessed as a capability. |
| Navigation from a property to its definition | `planned` | Server advertises `definitionProvider`. |
| Shared properties metadata reload | `planned` | `sts/common-properties/reload`; setting `boot-java.common.properties-metadata`. |
| Convert `.properties` to `.yaml` | `planned` | `sts/boot/props-to-yaml`. Needs a Zed command surface. |
| Convert `.yaml` to `.properties` | `planned` | `sts/boot/yaml-to-props`. Needs a Zed command surface. |
| `spring-factories` language support | `planned` | Declared by the VSIX; this project has no mapping for it. |
| `jpa-query-properties` language support | `planned` | Declared by the VSIX; this project has no mapping for it. |
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
| Logical Structure tree view | `planned` | VS Code contributes the `explorer.spring` view. **Candidate `blocked-zed-api`**: the 0.7.0 extension world exports no tree/panel surface. Needs a dedicated check before being recorded as blocked. |
| Structure refresh / grouping / open reference | `planned` | `structure.refresh`, `structure.grouping`, `structure.openReference`; `sts/spring-boot/structure`, `structure/groups`. |
| Run / debug a Boot application | `planned` | Not assumed blocked: Zed's extension API exposes DAP (`get-dap-binary`, `dap-request-kind`, `dap-config-to-scenario`, locators). |
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
| Start Spring Boot Language Server on demand | `planned` | `vscode-spring-boot.ls.start`. **Known debt**: the coordinator does not handle this client request. |
| Java type resolution for the server | `planned` | `sts/javaType`. **Known debt**: unhandled by the coordinator. |
| Classpath listening | `verified` | `sts.vscode-spring-boot.enableClasspathListening` driven by the coordinator; observed registering and removing during the M2 gate run. |
| Missing / incompatible Java diagnostic | `implemented` | Contract-tested; the runtime observation is still outstanding from M2 step 7. |
| Embedded language syntax highlighting | `planned` | Setting `boot-java.embedded-syntax-highlighting`; VSIX contributes four grammars. |
| Java reconcilers | `planned` | Setting `boot-java.java.reconcilers`; `boot-java.scan-java-test-sources.on`. |
| Offline behaviour | `planned` | Artifact acquisition currently requires network on first use; see `LIMITATIONS.md`. |

## Maintenance

- Bump the inventory version and re-derive when the pinned Spring Tools release
  moves. State recorded against one release does not carry to another.
- A state changes only with evidence. `verified` requires a named tuple.
- A `blocked-*` state requires the exact missing surface, not a general claim.
- Update this file in the same change as the slice that moves a state.
