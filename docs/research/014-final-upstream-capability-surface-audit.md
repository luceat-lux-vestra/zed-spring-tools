# R014: Final upstream capability-surface audit

- Status: Complete for source feasibility; named runtime gates remain
- Last updated: 2026-07-18
- Investigator: OpenAI Codex (GPT-5.6 Sol)
- Baselines:
  - Zed `origin/main`, commit
    `c9e8e611dbc279afa0914d28c4d37ad07f38c03b`; stable comparison
    `v1.11.3`, commit `952d712dac48a4af2c54fb22c82d82a9d69b72d4`
  - Zed extension API 0.8.0 source boundary
  - Official Java extension `v6.8.23`, commit
    `ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`; product-supported comparison
    `6.8.21`, commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`
  - Spring Tools `5.2.0.RELEASE`, commit
    `18d1a975dbea4f9314fd736d0237bd9e23f243f9`; current-main comparison
    `0e39c1c8d78c5adc7bdbbc42b58b83a22bcef0e0`

## Question

After selecting D005, does the latest available Zed, official Java, or Spring
Tools source expose a better stock-Zed delivery architecture, and what concrete
refinements should be made before implementation?

## Scope

Included: latest upstream source as of 2026-07-18, extension UI and action
surfaces, Document/Workspace Symbols, LSP client commands and URI handling,
official Java task/DAP changes, and Spring build commands.

Excluded: runtime support claims for Java 6.8.23 or Zed main, an upstream patch,
production implementation, a custom Zed build, and changes to the official Java
extension.

## Confirmed facts

### Latest Zed still has no extension-owned tree or panel

1. Zed `origin/main` still carries extension API worlds only through 0.8.0. The
   extension boundary has no panel, tree view, sidebar, webview, virtual
   document, arbitrary editor item, arbitrary command-palette action, or general
   settings-write export.
2. The extension API change between Zed `v1.11.3` and the inspected main commit
   adds `hard_tabs` to read language settings. It does not add a UI or action
   surface.
3. Zed's official extension-development documentation lists languages,
   debuggers, themes, icon themes, snippets, and MCP servers as extension
   features. The official webview-extension request remains open as issue
   `zed-industries/zed#21208`.
4. Extension-provided slash commands are not a hidden general action route.
   Zed's current documentation says they were removed, and the extension CLI
   rejects manifests that provide them as deprecated. Historical WIT methods
   remain for compatibility but are not a product surface to adopt.
5. MCP and Agent surfaces belong to the Agent interaction model. They do not
   create an editor-side Spring tree, dashboard, command-palette action, or
   direct replacement for standard LSP interactions.

### Internal task scheduling is not available to an extension LSP adapter

6. Zed has an internal `ClientCommand::ScheduleTask`, and CodeLens dispatch can
   ask an `LspAdapter` to map an LSP command to that client command.
7. `LspAdapter::client_command` defaults to no mapping. The extension-backed
   `ExtensionLspAdapter` does not override it, and extension API 0.8.0 has no
   corresponding export. Therefore this product cannot turn a Spring CodeLens
   command directly into Zed task scheduling without an upstream API change.
8. CodeLens remains useful for navigation and allowlisted commands that Zed can
   send through `workspace/executeCommand`; it must not be documented as an
   automatic task-launch surface.

### URL opening and Project Symbols remain intentionally limited

9. The general Zed LSP client advertises `textDocument/documentLink` and handles
   links. Its general `WindowClientCapabilities` does not advertise
   `showDocument`, and the project LSP store has no general
   `window/showDocument` request handler. The only inspected handler is scoped
   to Zed's Copilot client.
10. A Spring application URL can therefore use a standard Document Link,
    clickable Markdown link where rendered, or copyable text. Automatic browser
    opening through `window/showDocument` is not an available baseline.
11. Zed's Project Symbols picker renders a symbol label followed by file path
    and line. It does not render `containerName` as grouping or hierarchy.
    Spring's current Workspace Symbol converter does not set `containerName`
    anyway. Adding that field alone cannot turn Project Symbols into a tree.

### Official Java 6.8.23 improves execution ownership but needs a gate

12. Official Java 6.8.23 was published on 2026-07-17 and still uses
    `zed_extension_api` 0.7.0. Compared with 6.8.21 it adds a downloaded Java
    task helper, Maven/Gradle/vanilla Java task resolution, a Gradle language
    server and Gradle/Groovy/Kotlin language resources.
13. Its Java tasks expose run-main, run-test-method, run-test-class, and run-all-
    tests runnables. The task helper selects Maven or Gradle wrappers when
    present, resolves the closest module, and otherwise falls back to the build
    tool executable.
14. Maven main-class execution uses `compile` or `test-compile` plus
    `exec:java`; Gradle main-class execution uses a module `run` task plus
    `-PmainClass`. These are general Java run paths, not a Spring Boot-specific
    dashboard or arbitrary goal/task selector.
15. Official Java's debug adapter configuration accepts launch fields including
    `mainClass`, `projectName`, and `noDebug` through its explicit DAP
    configuration path. Its generic `dap_config_to_scenario` conversion still
    rejects Launch, and its manifest declares no DAP locator. Java runnables do
    not automatically become Spring Boot debug scenarios.
16. This product's compatibility table currently supports 6.8.21, not 6.8.23.
    D003 requires unknown official-Java providers to be rejected until their
    transport and lifecycle contract is tested. Source inspection cannot promote
    6.8.23.

### Spring build commands are not a better terminal/task architecture

17. Spring Tools 5.2.0 registers `sts.maven.goal` and `sts.gradle.build`.
    `DefaultBuildCommandProvider` starts Maven or Gradle directly with
    `Runtime.exec`, preferring project wrappers, waits for exit, and reports a
    non-zero exit as an error.
18. That server-side path does not provide Zed's task/terminal presentation,
    cancellation, rerun history, or reviewable task definition. It also gives
    process ownership to Spring LS, contrary to D003's official-Java/Zed task
    boundary. It is not a better user-facing baseline than Zed tasks.

### Previously selected symbol and document routes are unchanged

19. The change from Zed `v1.11.3` to the inspected main commit does not alter
    Document Symbols collection or rendering behavior; the only diff in the
    collector is a test import/type conversion adjustment.
20. Same-name language registration still replaces rather than overlays the
    official Java language pack. No deterministic query-overlay API appeared.
21. Zed still supports `workspace/applyEdit` resource creation, rename, and
    deletion but exposes no virtual document. An explicitly requested generated
    Structure/Live file remains the smallest stock-Zed grouping/table surface.

### Public Zed surfaces replace most unavailable API outcomes

22. Zed's source-context Code Actions menu is not limited to LSP actions.
    `CodeActionContents` combines resolved runnable tasks, available LSP Code
    Actions, and debug scenarios, and dispatches each through its native owner.
    This is a public user workflow even though an extension cannot contribute an
    arbitrary top-level Command Palette action.
23. Zed's task documentation allows a workspace task to bind a runnable tag with
    precedence over a global or language-provided task. Official Java marks main
    runnables with `java-main`. This makes a Spring-specific task bound to the
    existing Java gutter runnable a source-supported experiment; it does not yet
    prove correct filtering for Boot versus non-Boot main classes.
24. The general LSP store handles `window/showMessageRequest`. Its notification
    renders the message as Markdown and opens clicked links with
    `open_url_or_file`. A request result can therefore present a clickable
    application URL without general `window/showDocument`, subject to a driven
    UX test.
25. Hover Markdown links also call `open_url_or_file`. Document Links, hover
    links, prompt links, and generated-document links are different public entry
    contexts over the same reachable-URL outcome; they need not duplicate URL
    discovery logic.

## Primary sources

All paths and URLs below were accessed on 2026-07-18.

- Zed main commit `c9e8e611` and stable `v1.11.3`:
  - `crates/extension_api/wit/since_v0.8.0/extension.wit`
  - `crates/extension_api/wit/since_v0.8.0/settings.rs`
  - `docs/src/extensions/slash-commands.md`
  - `crates/extension_cli/src/main.rs`
  - `crates/language/src/language.rs`, `LspAdapter::client_command`
  - `crates/editor/src/code_lens.rs`, `try_handle_client_command`
  - `crates/language_extension/src/extension_lsp_adapter.rs`
  - `crates/editor/src/code_context_menus.rs`, `CodeActionContents::iter`
  - `crates/editor/src/code_actions.rs`, task/action/debug dispatch
  - `docs/src/tasks.md`, runnable-tag binding and Code Actions access
  - `crates/lsp/src/lsp.rs`, general client capabilities
  - `crates/project/src/lsp_store.rs`, `ShowMessageRequest` handling
  - `crates/workspace/src/notifications.rs`, Markdown URL dispatch
  - `crates/editor/src/hover_popover.rs`, hover URL dispatch
  - `crates/copilot/src/copilot.rs`, Copilot-scoped ShowDocument handler
  - `crates/project_symbols/src/project_symbols.rs`, picker rendering
  - upstream: <https://github.com/zed-industries/zed/commit/c9e8e611dbc279afa0914d28c4d37ad07f38c03b>
  - official extension features:
    <https://zed.dev/docs/extensions/developing-extensions>
  - open webview issue:
    <https://github.com/zed-industries/zed/issues/21208>
- Official Java extension 6.8.23 at commit `ddc13daf`:
  - `extension.toml`, `Cargo.toml`
  - `languages/java/runnables.scm` and `languages/java/tasks.json`
  - `src/task.rs`, `task_helper/src/build_tool/{maven,gradle,vanilla}.rs`
  - `src/java.rs` and `src/debugger.rs`
  - release: <https://github.com/zed-extensions/java/releases/tag/v6.8.23>
- Spring Tools `5.2.0.RELEASE` at commit `18d1a975`:
  - `SpringIndexToSymbolsConverter.java`
  - `DefaultBuildCommandProvider.java`
  - upstream:
    <https://github.com/spring-projects/spring-tools/tree/5.2.0.RELEASE>
- Repository evidence:
  - [R013](013-zed-native-capability-delivery-surfaces.md)
  - [D003](../decisions/003-java-companion-product-architecture.md)
  - [D005](../decisions/005-lsp-first-capability-delivery.md)

## Inferences

1. No newly found official surface exceeds D005's coverage while retaining stock
   Zed and unmodified official-Java ownership. The LSP-first coordinator plus
   opt-in generated documents remains the best known product architecture.
2. Official Java 6.8.23 is a useful simplification candidate, not an architecture
   replacement. After compatibility verification, its main/test runnables should
   be preferred when they match the requested action instead of generating
   duplicate generic Java tasks.
3. Spring Boot Debug still needs an explicit, merge-safe `.zed/debug.json`
   configuration because the new Java task helper does not discover Boot debug
   scenarios and the extension exposes no locator for them.
4. Arbitrary Maven goals, Gradle tasks, and Spring-specific build actions should
   remain reviewable Zed tasks or documented manual commands. Starting them
   invisibly inside Spring LS would reduce UX and process control.
5. Project Symbols should remain a flat search/navigation fallback. Encoding a
   hierarchy into symbol names could improve search labels but would not create
   a tree and would pollute canonical symbol names.
6. URL outcomes should be specified as "reachable link" rather than "open
   browser" until a driven Document Link/Markdown test proves the exact Zed UX.
7. Extension slash commands must be removed from candidate product routes.
   Agent skills or MCP remain a separately scoped AI-explanation option only.
8. Code Actions should be the general Spring operation entry point. CodeLens
   should duplicate only a small high-frequency source-local subset, while tasks
   and debug scenarios remain companions for execution-specific ownership.
9. The combined source-context menu is the closest stock-Zed equivalent to an
   integrated Spring menu. A `java-main` workspace task binding may improve Boot
   execution ergonomics, but shipping it by default would be premature until a
   runtime slice rules out duplicate rows and incorrect appearance on ordinary
   Java main classes.
10. A clickable `showMessageRequest` Markdown result is a stronger companion for
    an action-produced URL than copy-only text. Copyable text remains the actual
    fallback; an OS-specific opener task should remain an excluded contingency
    unless the public link routes fail and a cross-platform security/quoting
    experiment supports it.

## Unverified hypotheses

1. Official Java 6.8.23 preserves this product's bridge contribution, proxy
   discovery, Java callback, cleanup, and log-redaction contracts.
2. Its Maven or Gradle main runnable launches a representative Spring Boot main
   class correctly on the fixed macOS arm64/JDK 25 tuple.
3. The Gradle language-server additions do not introduce conflicting language
   ownership or startup traffic for this product's Java/Properties/YAML routes.
4. Zed Document Links and generated Markdown links produce an acceptable
   application-URL workflow on all supported desktop platforms.
5. A user-authored Java launch configuration with `noDebug` has equivalent stop
   and terminal behavior to a generated Run configuration.
6. A Spring-specific workspace task bound to `java-main` appears once and only
   on the intended Boot main runnable across single- and multi-module projects.
7. LSP Code Actions, a bound task, and an available debug scenario form a clear,
   non-duplicated source-context menu on the fixed runtime tuple.
8. A `showMessageRequest` Markdown application URL is clickable and preserves a
   usable copy path on every supported desktop platform.

## Runtime verification needed

1. S015 remains the gate for combined JDT/Spring Document Symbols.
2. S016 must test official Java 6.8.23 as an unknown-provider compatibility
   refresh before the compatibility table or README changes.
3. The Boot execution slice must separately test official-Java main runnables,
   explicit Run/Debug configuration, stop behavior, and safe file merge.
4. A URL slice must test Document Link and Markdown behavior and retain a copyable
   URL fallback. It should separately exercise hover/generated content and a
   `showMessageRequest` result.
5. Generated Structure/Live documents retain their creation, merge, refresh,
   stale-data, deletion, and secret-redaction gates.
6. The Boot execution slice must compare the unmodified official Java runnable
   with a workspace `java-main` binding and record duplicate, non-Boot,
   multi-module, task-picker, and Code Actions-menu behavior.

## Blockers and constraints

1. A native Spring tree/dashboard still requires an upstream extension API or a
   custom Zed build.
2. Internal `ScheduleTask` and Copilot's ShowDocument handler are not public
   extension contracts and cannot be reached through this product's adapter.
3. Official Java 6.8.23 is unverified for this product and may not be accepted
   merely because its source looks compatible.
4. General Java tasks do not choose among multiple Boot applications, provide
   live status, connect processes, change logger levels, or display metrics.
5. Generated documents continue to mutate the worktree and must be opt-in.

## Candidate next experiments

1. Execute [S015](../spikes/015-stock-zed-java-spring-document-symbols.md).
2. Execute [S016](../spikes/016-official-java-6.8.23-compatibility-refresh.md)
   before adopting the new official-Java task path.
3. In the later Boot execution slice, compare the verified official Java main
   runnable with generated Run/Debug configurations rather than generating a
   duplicate task by default.
4. Include a Document Link and copyable-link comparison in the first live URL
   slice, and add a clickable `showMessageRequest` Markdown result.
5. In the Boot execution slice, test whether a Spring-specific `java-main` tag
   binding improves the gutter/Code Actions workflow without leaking to ordinary
   Java main classes. Retain it only if it is independently useful; do not build
   it merely as insurance against the official Java runnable.

## Interim conclusion

The final upstream audit found no better stock-Zed architecture than D005. It
did find one worthwhile refinement: compatibility-test official Java 6.8.23 and
reuse its general main/test tasks where they fit. It also closes three tempting
but unavailable routes—extension slash commands, internal CodeLens task
scheduling, and general `window/showDocument`—so implementation does not depend
on private or removed surfaces. Public Code Actions/task/debug composition and
clickable prompt/hover links replace most of their user outcomes. The plan now
distinguishes primary routes, independently useful companions, conditional
fallbacks, and excluded contingencies; no capability state changes from this
source audit alone.
