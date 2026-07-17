# R011: VS Code Spring Tools capability surface

- Status: Complete for the pinned release; LSP surface partially runtime-verified
- Last updated: 2026-07-18
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

### Completion is registered dynamically, not statically

Confirmed on 2026-07-17 from a `tail -F` capture of a driven run on the tuple
above, retained locally under the ignored path
`tmp/ws1-verify-20260717/evidence/lsp.log`.

`completionProvider` is absent from the Spring server's `initialize` result
because the server registers it afterwards. One `client/registerCapability`
message carries four completion registrations in a single batch:

| Registration | Document selector |
| --- | --- |
| `textDocument/completion` | `java` |
| `textDocument/completion` | `xml` |
| `textDocument/completion` | `spring-boot-properties` |
| `textDocument/completion` | `spring-boot-properties-yaml` |

The `spring-boot-properties` selectors attribute the whole batch to the Spring
server, because JDT LS does not know those languages. The server also registers
`textDocument/semanticTokens` for `jpa-query-properties`, a language this
project does not map.

Attribution caveat: Zed's log does not tag messages with a server name, and the
two servers maintain independent JSON-RPC id sequences, so an id alone cannot
identify which server answered. Reliable attribution comes from payload
content — a Spring-only document selector, an `sts.*` command, or a
`source: vscode-spring-boot` field on a diagnostic — not from ids.

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

1. The advertised capability set may vary with client capabilities, so a
   different client could see a different list.
2. The `resolve.completion.edit.<uuid>` command is session-scoped; whether any
   other command carries per-session identity is not established.

Hypothesis 1 of the original list — that completion is registered dynamically —
was confirmed on 2026-07-17 and moved into the confirmed facts below.

## Items requiring runtime verification

1. Whether completion is dynamically registered, and what else registers with it.
2. Which advertised capabilities actually return results without live data or a
   Boot project — several may advertise unconditionally and return empty.
3. Resolved 2026-07-18: `sts/javaType` (and its `sts/java*` siblings) is handled
   by the coordinator, routed to the official Java extension; `vscode-spring-boot.ls.start`
   is a VS Code client command, not a coordinator request, and its callback's work
   is already performed by the coordinator. Neither gates the capabilities above as
   an unhandled request. See the inventory rows for the exact mechanism.

## Blockers and constraints

1. Retracted 2026-07-18: this had listed `vscode-spring-boot.ls.start` and
   `sts/javaType` as unhandled client requests. That was a miscategorization.
   `sts/javaType` is a server→client request the coordinator handles via the
   official Java route (contract-tested); `vscode-spring-boot.ls.start` is a VS
   Code editor command, not a request the coordinator receives, and Zed owns
   language-server start/restart. Neither is a coordinator blocker.
2. **Zed extensions cannot contribute a view of any kind.** The complete export
   list of the `zed_extension_api` 0.7.0 world is 19 functions: `init-extension`;
   six `language-server-*` functions; five DAP functions; `run-slash-command` and
   `complete-slash-command-argument`; `context-server-command` and
   `context-server-configuration`; `index-docs` and `suggest-docs-packages`; and
   `labels-for-completions` and `labels-for-symbols`. None is a tree view, panel,
   sidebar, or webview. Zed's own documentation agrees: an extension "can provide
   languages, themes, debuggers, snippets, and MCP servers". This blocks the VS
   Code `explorer.spring` widget *as a custom panel*. It does **not** by itself
   block the capability of browsing the logical structure: the server data is
   reachable (`sts/spring-boot/structure`) and the server also advertises
   `documentSymbolProvider` and `workspaceSymbolProvider`, which render in Zed's
   native outline panel and symbol search. Whether those symbols carry the beans
   and mappings the tree view shows is unverified, pending a driven run against
   the fixture (which now includes a request mapping and a bean for this
   purpose), so the capability stays `planned`, not blocked. An
   earlier revision of this document and inventory version 3 wrongly recorded it
   as `blocked-zed-api` by judging the VS Code widget instead of the outcome;
   inventory version 4 corrects that.
3. **Zed extensions cannot contribute a command-palette command**, which is how
   VS Code exposes most Spring Tools commands. This is a constraint, not
   automatically a blocker: the Spring server advertises `codeActionProvider` and
   `workspace/executeCommand`, so a given command may still be reachable. Each
   command capability needs its own check before any blocked claim.
4. Debuggers are an explicit Zed extension type and the API exposes DAP
   (`get-dap-binary`, `dap-request-kind`, `dap-config-to-scenario`,
   `dap-locator-create-scenario`, `run-dap-locator`), so run/debug is not
   assumed blocked.
5. **File-to-language association works differently, and needs a grammar.** The
   VSIX declares four languages by VS Code `filenamePatterns` globs
   (`application*.properties`, `*.factories`, `jpa-named-queries.properties`, …).
   Zed instead routes a file to a language server only when it classifies the
   file as one of the server's mapped languages, and that classification comes
   from a `languages/<name>/config.toml` with `path_suffixes` (no globs) and a
   required grammar. The extension world exports no grammar-less file-association
   surface. Consequences: every `.properties` file — not only `application*` —
   reaches this server as `Properties`, which is a harmless superset;
   `jpa-named-queries.properties` reaches it but as language id
   `spring-boot-properties`; and `*.factories` reaches no server until a
   language-plus-grammar is contributed. None of this is a Zed API block, because
   an extension may contribute languages and grammars; it is additional work.
6. The pinned release is not the newest Spring Tools. This inventory is versioned
   against `5.2.0.RELEASE` and must be re-derived when the pin moves.

Sources for 2, 3, and 5: `zed_extension_api` 0.7.0 `wit/since_v0.6.0/extension.wit`,
and `docs/src/extensions/developing-extensions.md` and
`docs/src/extensions/languages.md` in `zed-industries/zed`, accessed
2026-07-17/18.

## Candidate next experiments

1. A narrow spike capturing the full `client/registerCapability` traffic to
   settle the completion question and enumerate dynamic registrations.
2. A driven run against a fixture that has controllers and beans, capturing the
   `documentSymbol` and `workspace/symbol` responses, to settle whether the
   logical structure reaches Zed's outline panel and symbol search. That decides
   the browse-structure capability between `zed-native-equivalent` and
   `blocked-zed-api`.
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
