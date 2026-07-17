# R011: VS Code Spring Tools capability surface

- Status: Complete for the pinned release; LSP surface partially runtime-verified
- Last updated: 2026-07-17
- Investigator: Claude Opus 4.8
- Evidence baseline:
  - Spring Tools `5.2.0.RELEASE`, asset `vscode-spring-boot-2.2.0-RC1.vsix`,
    SHA-256 `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3`
  - Extension identity inside that VSIX: `vmware.vscode-spring-boot`, displayName
    `Spring Boot Tools`, version `2.2.0`
  - Runtime observation on macOS 26.5.1 arm64, Zed 1.10.3, official Java
    extension 6.8.21, Temurin JDK 25.0.3

## Question

Which user-visible capabilities does the pinned VS Code Spring Tools release
offer, and which surfaces must this project reproduce, replace, or record as
blocked, so that M4's inventory is derived from evidence rather than from a
reading of marketing pages?

## Scope

Included: the pinned VSIX's declared contribution surface, and the Spring Boot
language server's advertised LSP capabilities as observed at runtime.

Excluded: VS Code extensions outside the pinned `vscode-spring-boot` asset
(`vscode-concourse`, `vscode-manifest-yaml`); Spring Tools 4 for Eclipse and
Theia; any capability's internal implementation; and the priority or feasibility
of building each capability, which belongs to a reviewed slice plan.

## Confirmed facts

### Declared contribution surface of the pinned VSIX

Extracted mechanically from `extension/package.json` inside the pinned VSIX
(53,677 bytes).

1. **15 commands**: `structure.refresh`, `structure.openReference`,
   `structure.grouping`, `live-hover.connect`, `live.show.active`,
   `live.hide.active`, `live.refresh.active`, `set.log-levels`, `open.url`,
   `props-to-yaml`, `yaml-to-props`, `spring.modulith.metadata.refresh`,
   `query.explain`, `ls.start`, and `sts/common-properties/reload`.
2. **One view**: `explorer.spring`, "Logical Structure", contributed to VS Code's
   explorer container, gated on `vscode-spring-boot.ls.started`.
3. **18 settings** under the `boot-java.` prefix, covering live-information
   connection and retry behaviour, Java reconcilers, XML config support,
   code-lens highlighting, properties metadata, completion prefix elision, JPQL,
   cron inlay hints, bean injection completion, and the beans structure tree.
4. **Four languages**: `spring-boot-properties`, `spring-boot-properties-yaml`,
   `spring-factories`, and `jpa-query-properties`.
5. **Five `javaExtensions` bundles** contributed into JDT LS:
   `jdt-ls-extension.jar`, `jdt-ls-commons.jar`, `sts-gradle-tooling.jar`,
   `io.projectreactor.reactor-core.jar`, and
   `org.reactivestreams.reactive-streams.jar`.
6. Six menu contributions and four grammars exist; they are presentation
   surfaces for the commands and languages above.

### Spring Boot language server's advertised LSP capabilities

Observed in the `initialize` result during the M2 closure run. The capture is
retained locally under the ignored path
`tmp/m2-close-20260717/evidence/zed-log-capture.txt` and is deliberately absent
from the published tree, because `tmp/` holds runtime profiles, logs, routes, and
screenshots that must never enter Git. A reader without that file regenerates the
observation with the reproduction steps at the end of this document rather than
taking this list on trust.

The Spring server is identified by its `sts.vscode-spring-boot.*` commands; the
JDT LS `initialize` result in the same capture is a different server and is not
this list.

`hoverProvider`, `codeLensProvider` (resolve), `codeActionProvider` (resolve,
kinds), `definitionProvider`, `implementationProvider`, `referencesProvider`,
`documentSymbolProvider`, `workspaceSymbolProvider`, `documentHighlightProvider`,
`inlayHintProvider`, `textDocumentSync: 2` (incremental), and
`workspace.workspaceFolders`.

### The server's 33 executable commands

Grouped by the workstream they serve:

- **Live data (13)**: `sts/livedata/connect`, `disconnect`, `remoteConnect`,
  `get`, `refresh`, `get/metrics`, `refresh/metrics`, `getLoggers`,
  `configure/logLevel`, `listConnected`, `listProcesses`, `localAdd`,
  `localRemove`.
- **Boot project structure (4)**: `sts/spring-boot/bootProjectInfo`,
  `executableBootProjects`, `structure`, `structure/groups`.
- **Properties/YAML (3)**: `sts/boot/props-to-yaml`, `sts/boot/yaml-to-props`,
  `sts/common-properties/reload`.
- **Build (2)**: `sts.maven.goal`, `sts.gradle.build`.
- **Modulith (2)**: `sts/modulith/metadata/refresh`, `sts/modulith/projects`.
- **Core (4)**: `sts.vscode-spring-boot.codeAction`, `commandList`,
  `enableClasspathListening`, and a session-scoped
  `resolve.completion.edit.<uuid>`.
- **Other (5)**: `sts/upgrade/spring-boot`, `sts/show/document`,
  `sts/jar/fetch-content`, `sts/enable/copilot/features`,
  `sts/boot/open-data-query-method-aot-definition`.

### This project's current coverage

1. `extension.toml` maps only `Properties` to `spring-boot-properties` and
   `YAML` to `spring-boot-properties-yaml`. `spring-factories` and
   `jpa-query-properties` have no mapping.
2. The bridge and Spring bundle set this project contributes to `jdtls` matches
   the VSIX's five `javaExtensions` plus this project's own bridge bundle.
3. `sts.vscode-spring-boot.enableClasspathListening` is driven by the
   coordinator, verified at runtime during M2.
4. Property completion returns real metadata, verified on the tuple above.

## Inferences

1. The 13 live-data commands, the four Boot-structure commands, and the
   `explorer.spring` view together form the "Boot dashboard / live data" product
   surface. Reproducing them needs both the server calls and a Zed surface able
   to present a tree and per-process actions.
2. `sts.maven.goal` and `sts.gradle.build` imply the server expects its client to
   be able to run builds, which in this architecture is official Java's
   ownership, not this project's.
3. `sts/enable/copilot/features` and the `query.explain` command are AI-assistant
   surfaces bound to VS Code's Copilot integration; a Zed equivalent would be a
   distinct design question, not a port.

## Unverified hypotheses

1. `completionProvider` does **not** appear in the observed `initialize` result,
   yet property completion demonstrably works. The most likely explanation is
   dynamic registration via `client/registerCapability` after initialization.
   This is an inference from absence and has not been confirmed against a trace.
2. The advertised capability set may vary with client capabilities, so a
   different client could see a different list.
3. The `resolve.completion.edit.<uuid>` command is session-scoped; whether any
   other command carries per-session identity is not established.

## Items requiring runtime verification

1. Whether completion is dynamically registered, and what else registers with it.
2. Which advertised capabilities actually return results without live data or a
   Boot project — several may advertise unconditionally and return empty.
3. Whether `vscode-spring-boot.ls.start` and `sts/javaType`, both currently
   unhandled by the coordinator, gate any of the capabilities above.

## Blockers and constraints

1. `vscode-spring-boot.ls.start` and `sts/javaType` are unhandled client
   requests. Until handled, any capability depending on them cannot be assessed.
2. The `explorer.spring` tree view has no obvious Zed extension-API equivalent.
   The published `zed_extension_api` 0.7.0 world exports no tree-view or custom
   panel surface, so this is a candidate `blocked-zed-api` item pending a
   dedicated check.
3. Zed's extension API does expose DAP (`get-dap-binary`, `dap-request-kind`,
   `dap-config-to-scenario`, `dap-locator-create-scenario`, `run-dap-locator`),
   so run/debug is not assumed blocked without evidence.
4. The pinned release is not the newest Spring Tools. This inventory is versioned
   against `5.2.0.RELEASE` and must be re-derived when the pin moves.

## Candidate next experiments

1. A narrow spike capturing the full `client/registerCapability` traffic to
   settle the completion question and enumerate dynamic registrations.
2. A read of Zed's extension API surface for any tree/panel contribution point,
   to settle `explorer.spring` as `blocked-zed-api` or `zed-native-equivalent`.
3. A slice plan for workstream 1, whose server-side surface is now known:
   hover, code actions, inlay hints, and the two conversion commands.

## Reproduction

```sh
P=<extracted VSIX>/extension
node -e "const c=require('$P/package.json').contributes;
  console.log(c.commands.length, Object.keys(c).join(','))"
# Server capabilities: capture Zed's log with `tail -F` during a run at
# log.lsp: "trace", then select the initialize result whose
# executeCommandProvider.commands include an `sts.vscode-spring-boot.*` entry.
```
