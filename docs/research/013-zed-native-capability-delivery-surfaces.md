# R013: Stock-Zed capability delivery surfaces

- Status: Complete for source feasibility; refined by R014
- Last updated: 2026-07-18
- Investigator: OpenAI Codex (GPT-5.6 Sol)
- Baselines:
  - Zed `v1.11.3`, commit
    `952d712dac48a4af2c54fb22c82d82a9d69b72d4`
  - Zed extension API 0.7.0 used by this product; 0.8.0 boundary also inspected
  - Official Java extension 6.8.21 source commit
    `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`
  - Spring Tools `5.2.0.RELEASE`, commit
    `18d1a975dbea4f9314fd736d0237bd9e23f243f9`

## Question

Without an upstream Zed change or a custom Zed distribution, which Zed-native
surfaces can deliver the pinned Spring Tools capability set, what should the
coordinator adapt, and which existing workflows must remain as fallbacks?

## Scope

Included: stock Zed extension and LSP/DAP/task surfaces, the required unmodified
official Java extension, the existing Spring coordinator and bridge, all
capabilities in inventory version 5, Java language/outline ownership, and
opt-in generated documents.

Excluded: implementation of a capability, a support claim on an untested tuple,
modification of Zed or the official Java extension, an external dashboard
process, and promotion of disposable spike code.

## Confirmed facts

### Extension and native UI boundary

1. The complete Zed extension API 0.8.0 world contains language-server, DAP,
   context-server, historical slash-command, label, download, process, and
   settings-read hooks. It has no export for a panel, tree view, sidebar,
   webview, arbitrary editor item, or arbitrary command-palette contribution.
   R014 confirms that current Zed has removed extension-provided slash commands,
   so the historical WIT hook is not a candidate action surface.
2. `get-settings` is an import, but the world has no general settings-write
   export. A Spring extension can document or read Java's `document_symbols`
   setting but cannot silently force it into user settings.
3. Zed's native Rust source has `workspace::Panel` and `Workspace::add_panel`.
   Those are application-internal GPUI APIs, not extension exports. A true Spring
   panel therefore requires a custom Zed build or a future extension API.
4. Zed handles LSP `window/showMessageRequest`, presents its action items, and
   returns the selected item. This is a bounded button/action interaction, not a
   general searchable quick-pick or arbitrary text input API.
5. Zed handles `workspace/applyEdit`, including create, rename, and delete
   resource operations. Whether a particular generated-file merge is safe and
   usable remains a product-level runtime question.
6. Zed loads worktree-local debug configurations from `.zed/debug.json` and
   worktree-local tasks from `.zed/tasks.json`. A configuration appearing there
   is user-started through Zed's Debug or Task UI; LSP does not itself start a
   debug session.

### Document Symbols and Java language ownership

7. Zed 1.11.3 has a `document_symbols` language setting. Its default is `off`,
   which uses tree-sitter; `on` uses the language server's
   `textDocument/documentSymbol` response for Outline and Breadcrumbs.
8. Zed has a test for nested LSP document symbols. Its project layer asks every
   capable language server attached to the buffer, flattens each server's nested
   response while preserving depth, merges the server maps, removes equal items,
   and sorts the result by source-range start.
9. The earlier driven Java run kept `document_symbols` at its default and issued
   zero document-symbol requests. That observation proves the default-off path;
   it does not prove that Zed cannot consume LSP document symbols.
10. Spring Tools 5.2.0 recursively converts Spring index elements to LSP
    `DocumentSymbol` objects and assigns child symbols with
    `DocumentSymbol.setChildren`. Its Java symbol index returns current-document
    computed symbols or indexed symbols for `textDocument/documentSymbol`.
11. Zed's language registry does not merge two definitions with the same name.
    Registering another `Java` definition replaces the existing available
    language's grammar, matcher, loader, and manifest owner.
12. Official Java 6.8.21 ships a complete Java language pack: configuration,
    highlights, outline, injections, brackets, folds, indents, locals,
    runnables, tasks, text objects, and overrides. D003 assigns Java language
    registration to that extension.
13. A tree-sitter outline query can classify syntax that is present in one Java
    file. It has no classpath, resolved Spring metamodel, conditional bean, or
    live-process input. Replacing the Java outline cannot reproduce the semantic
    or runtime Spring structure by itself.

### Existing and adaptable capability surfaces

14. The tested product already verifies standard completion, hover,
    diagnostics, definition, Workspace Symbols, references, implementations,
    inlay hints, Code Actions, command execution, and ApplyEdit routes for named
    capabilities in the inventory.
15. The Spring server advertises standard hover, CodeLens, Code Action,
    definition, implementation, references, Document Symbol, Workspace Symbol,
    document highlight, and inlay-hint capabilities. It also advertises the 33
    Spring commands enumerated by R011.
16. Spring's VS Code client uses custom commands and notifications for logical
    structure, live data, metrics, loggers, conversions, upgrade, Modulith, and
    highlight decoration. This project's coordinator already owns the Spring
    server stdio boundary and already consumes or translates selected custom
    registrations and Java-data callbacks.
17. The Boot-project GAV callback is implemented and contract-tested, but no
    user-facing Boot project selector or debug/task generator is currently
    implemented.
18. The extension manifest maps Java, Properties, and YAML to the Spring server.
    It does not yet contribute the separate `spring-factories` and
    `jpa-query-properties` languages.

## Primary sources

All source paths below were accessed on 2026-07-18.

- Zed `v1.11.3` at commit `952d712d`:
  - `docs/src/reference/all-settings.md`, "Document Symbols"
  - `crates/editor/src/document_symbols.rs`, nested-symbol tests and setting use
  - `crates/project/src/lsp_store/document_symbols.rs`, multi-server collection,
    flattening, equality deduplication, and range sorting
  - `crates/project/src/lsp_store.rs`, `ShowMessageRequest`, ApplyEdit, and
    resource operations
  - `docs/src/debugger.md` and `docs/src/tasks.md`, worktree configuration files
  - upstream: <https://github.com/zed-industries/zed/tree/v1.11.3>
- Zed current extension API 0.8.0 boundary:
  - `crates/extension_api/wit/since_v0.8.0/extension.wit`
  - `crates/workspace/src/dock.rs` and `crates/workspace/src/workspace.rs`
- Official Java extension 6.8.21 at commit `9148b897`:
  - `extension.toml`
  - `languages/java/config.toml` and every query under `languages/java/`
  - upstream: <https://github.com/zed-extensions/java/tree/9148b8972c1b93fbe5512a9ecf0ba33c3182970d>
- Spring Tools `5.2.0.RELEASE` at commit `18d1a975`:
  - `SpringIndexToSymbolsConverter.java`, recursive child construction
  - `SpringSymbolIndex.java`, current-document and indexed Document Symbols
  - `vscode-extensions/vscode-spring-boot/lib/`, custom client surfaces
  - upstream: <https://github.com/spring-projects/spring-tools/tree/5.2.0.RELEASE>
- Repository evidence:
  - [R011](011-vscode-spring-tools-capability-surface.md), pinned capability and
    command inventory
  - [capability inventory](../capability-inventory.md), named runtime results
  - [D003](../decisions/003-java-companion-product-architecture.md), official
    Java ownership
  - [D004](../decisions/004-product-stack-build-and-packaging.md), coordinator
    and product stack

## Inferences

1. The highest-coverage stock-Zed product is an additive, LSP-first companion:
   keep the official Java owner, use standard Zed surfaces first, and adapt
   Spring custom protocols inside the coordinator that already owns Spring
   stdio. This adds no process or UI loopback boundary.
2. Project Symbols remains a sound fallback for Spring-wide search and direct
   navigation because that outcome is already verified. Official LSP Document
   Symbols is the preferred per-file enhancement, not a reason to delete the
   existing route.
3. A generated Structure or Live document is the smallest stock-Zed fallback for
   data that fundamentally needs grouping or a table. It should be opt-in,
   regenerable, timestamped, secret-free, and merge-safe because Zed exposes no
   virtual editor or extension panel.
4. Re-registering `Java` to replace one outline or injection query creates
   language-pack co-ownership and update/load-order risk disproportionate to the
   static-only result. It should not be in the baseline product.
5. Embedded Java-string syntax is the strongest remaining reason to investigate
   an optional Java query pack, but that investigation needs a separate direction
   decision and cannot weaken official Java behavior by default.
6. Run/debug and build outcomes can be made Zed-native by producing reviewable
   official-Java debug configurations and Zed tasks. Automatic launch is not part
   of that outcome because the user still starts a configuration through Zed.
7. A single fallback cannot cover every capability. The baseline must remain
   per-capability: Project Symbols for structure navigation, manual
   `debug.json`/`tasks.json` for execution, static hover for absent live data, and
   external Actuator endpoints where a rich live table is not safe.
8. R014's latest-upstream audit does not change this architecture. It adds a
   compatibility-gated preference for official Java 6.8.23's matching main/test
   tasks and rules out private task scheduling and general ShowDocument as
   extension routes.

## Unverified hypotheses

1. JDT and Spring Document Symbols merge into a usable Java Outline without
   duplicate, interleaved, or misleading depths.
2. Spring `sts/highlight` payloads have stable ranges and commands that the
   coordinator can faithfully expose as standard CodeLens.
3. `window/showMessageRequest` is usable for typical Boot-project and local
   process counts; large logger/process sets may require a generated document.
4. Zed applies a create/merge workspace edit for `.zed/debug.json`,
   `.zed/tasks.json`, and generated documents without losing comments, unknown
   fields, or concurrent user edits. JSON-with-comments and existing file shapes
   require explicit design.
5. Spring live-data values can be refreshed and invalidated with enough identity
   and timestamp information to avoid stale hover, CodeLens, or generated data.
6. Standard URI handling can provide a satisfactory open-application-URL action.
7. Separate `spring-factories` and JPA language contributions can preserve
   ordinary Properties behavior while sending the required Spring language IDs.

## Runtime verification needed

1. S015 must compare `document_symbols` off/on on stock Zed 1.11.3, attribute
   both servers' responses, inspect hierarchy and duplicates, exercise source
   navigation, save/refresh, and restart.
2. A CodeLens slice must capture authentic `sts/highlight` data, translate it,
   test resolve/command execution, and prove refresh and cleanup.
3. A Boot execution slice must discover more than one executable project, test
   selection, generate both Run and Debug configurations, preserve an existing
   file, and use the official Java DAP.
4. Conversion and metadata-reload actions must execute their authentic commands
   and verify resulting files and diagnostics.
5. A Structure-document slice must prove explicit generation, deterministic
   refresh, source navigation, stale marking, deletion, and no unrequested Git
   or `.gitignore` mutation.
6. Live-data slices need separate local connection, remote security, freshness,
   metrics, and logger experiments. One successful live hover cannot establish
   all live capabilities.
7. Each special-language contribution needs routing, completion/diagnostic, and
   ordinary-Properties regression tests.
8. S016 must verify official Java 6.8.23 before the compatibility table or task
   plan adopts its new helper.

## Blockers and constraints

1. Stock Zed extensions cannot add the exact VS Code tree/dashboard widget or an
   arbitrary command-palette entry.
2. The extension cannot force the Java Document Symbols setting. Installation
   guidance and a diagnostic may be possible, but the exact UX is unverified.
3. Multi-server Document Symbols selection is not exposed as an extension
   policy; Zed merges capable servers.
4. Generated documents mutate the worktree unless Zed gains a virtual document
   surface. They must be explicitly requested and safe to ignore or delete.
5. Remote live credentials have no selected secure input/storage design and must
   not be put in project settings, generated content, command arguments, or logs.
6. The official Java proxy route remains a private, compatibility-tested
   transport. D005 does not make it public or stable.
7. Spring Initializr adds a separate network/artifact workflow, and AI explanation
   adds a separate Zed Agent/skill/MCP product surface. Neither can be inferred
   into the extension from the pinned VSIX.

## Candidate next experiments

1. Execute [S015](../spikes/015-stock-zed-java-spring-document-symbols.md).
2. Plan one narrow authentic `sts/highlight` to CodeLens experiment.
3. Plan one Boot-project-to-`debug.json` merge and official-Java DAP experiment.
4. Plan one opt-in, read-mostly Structure-document experiment before reusing the
   pattern for metrics or loggers.
5. Revisit a Java query pack only after the four stock-Zed experiments and only
   for a capability with no safe standard-LSP or generated-document route.
6. Execute [S016](../spikes/016-official-java-6.8.23-compatibility-refresh.md)
   before reusing official Java 6.8.23's task helper.

## Interim conclusion

Source evidence supports D005's stock-Zed LSP-first direction while preserving
the current D003/D004 and Project Symbols/manual-configuration baselines as
fallbacks. It does not establish that the JDT/Spring Outline merge, CodeLens
translation, generated documents, live UX, or Run/Debug generation works. Those
remain named runtime gates, and the capability inventory must not promote them
from this research alone. [R014](014-final-upstream-capability-surface-audit.md)
confirms the direction against the latest upstream source and records its task,
URL, and removed/private-surface refinements.
