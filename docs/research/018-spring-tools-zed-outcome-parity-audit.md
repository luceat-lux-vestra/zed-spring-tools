# R018: Spring Tools to Zed outcome-parity audit

- Status: Complete for source feasibility and first-tuple CodeLens verification
- Last updated: 2026-07-19
- Investigator: OpenAI Codex (GPT-5.6 Sol)

## Question

Beyond reference-count CodeLens, Git authorship/history, and links to related
information, which developer-facing capabilities exist in Spring Tools for VS
Code, and which stock-Zed surfaces can deliver the same outcome?

## Scope and product boundary

This audit separates two products that are commonly called "Spring Tools for
VS Code":

1. **Spring Boot Tools** (`vmware.vscode-spring-boot`), whose 2.2.0 extension
   and Spring Tools 5.2.0 language server are this project's current artifact
   boundary.
2. **Spring Boot Extension Pack**, which additionally installs Microsoft's
   Spring Boot Dashboard and Spring Initializr Java Support. Their user
   outcomes are included for roadmap completeness, but their runtimes and
   dependencies are not silently added to this product.

The source baseline is Spring Tools commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9` and the extracted
`vscode-spring-boot` 2.2.0 package. Zed source was checked at commit
`54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698`. Official Java core behaviour is
owned by the installed Zed Java extension and JDT LS, not reimplemented here.

As a drift control, upstream Spring Tools `main` commit
`0e39c1c8d78c5adc7bdbbc42b58b83a22bcef0e0` was also checked on 2026-07-19.
Its `vscode-spring-boot` package is version 2.3.0 and retains the same 15
commands, 118 settings, four languages, and one view; no configuration key or
command exists there that is absent from the pinned package. This does not make
unpinned runtime behaviour verified, but it shows that the declared capability
families in this audit are current at that commit.

## Corrections to the earlier inventory

1. The pinned package declares **118 configuration keys**, not 18: 35 under
   `boot-java.`, one `boot-java-vscode-only.*`, 80 `spring-boot.ls.*`, and two
   `spring.tools.*`. R011 counted only a subset of feature switches and omitted
   diagnostics, server tuning, AI, and conversion/browser settings.
2. Spring's standard `textDocument/codeLens` and the custom `sts/highlight`
   notification are different surfaces. Only the latter needs conversion into
   standard CodeLens.
3. `n references` is JDT's standard Java CodeLens, not a Spring Tools feature.
   Zed already supports it when CodeLens and the JDT setting are enabled.
4. Authorship and change history are editor/version-control outcomes. Zed's
   inline blame, Git panel, gutter, commit links, and permalinks provide them;
   Spring Tools does not need to own them.
5. Links in hover Markdown and LSP `textDocument/documentLink`, plus definition,
   references, implementations, and Project Symbols, already cover many
   "related information" outcomes. A VS Code-only command must be adapted only
   when the server chose that command instead of a standard location or link.

## Confirmed capability map

| Developer outcome | Spring Tools surface | Best stock-Zed route | Product work |
| --- | --- | --- | --- |
| Java definitions, implementations, references and reference counts | Official Java/JDT LSP | Native navigation, multibuffer references, JDT CodeLens | None beyond preserving official Java ownership |
| Author/change attribution | VS Code Git/GitLens ecosystem, not Spring Boot Tools | Zed inline blame, Git panel, gutter, commit/permalink links | Document as native equivalent |
| Spring beans, annotations, functions and request mappings | Spring workspace/document symbols (`@`, `@+`, `@>`, `@/`) | Project Symbols; opt-in LSP Outline only where its merged cache is sound | Project Symbols is verified; Structure document remains fallback |
| Running-app endpoint quick access (`//`) | Live workspace symbols and URL-opening client command | Project Symbols plus visible URL CodeLens and a clickable hover/document/Markdown link | URL CodeLens is verified; direct browser opening still needs a stock-Zed route |
| Property/YAML completion, validation, hover and definition | Standard completion, diagnostics, hover and definition | Native Zed LSP UI | Core paths are verified |
| Properties/YAML conversion and metadata reload | Code actions / executable server commands | Native Code Actions and reviewable workspace edits | Runtime-test file creation/replacement and refresh |
| Spring-aware Java completion | `@Value`, repository methods, scopes, profiles, bean names/types, qualifiers, resources, conditions, cron | Standard dynamically registered completion | No UI emulation; test representative families and settings |
| Spring Java templates | Standard snippet completion for request-mapping methods | Native completion/snippet insertion | Test snippet placeholders and additional edits |
| Spring diagnostics and quick fixes | Boot 2/3/4, AOT, Spring AI, SpEL, data-query and cron reconcilers | Native diagnostics and Code Actions | Pass settings; test each family independently |
| Spring-specific references/highlights | Property, profile, qualifier, named-bean and event references; WebFlux/query document highlights | Native References and Document Highlights | Test attribution and multi-server merge |
| SpEL intelligence | Semantic tokens, diagnostics, hover/navigation context, AI-explain lens | Native semantic tokens/diagnostics/hover; manual Zed Agent workflow for explanation | Language intelligence is direct; the public Zed API cannot detect Agent state or invoke/prefill Agent from CodeLens |
| Spring Data query intelligence | Repository method completion; JPQL/HQL/SQL semantic tokens, diagnostics, inlay hints, highlights, multiline action | Native LSP surfaces | Test Java text blocks and `jpa-named-queries.properties` language identity |
| Cron intelligence | Completion, semantic tokens, validation, inlay hint | Native LSP surfaces | Inlay hint is verified; remaining paths need tests |
| Static endpoint/configuration CodeLens | WebFlux summary, web-configuration source link, Data AOT query/implementation/refactor/refresh | Native CodeLens; translate `vscode.open` and pre-resolved generated targets to Zed's supported location command | All five providers are verified on the first tuple, including `CL-4d` one-click generated-method navigation |
| Live bean/injection/startup CodeLens | Custom versioned `sts/highlight`; `sts.showHoverAtPosition` | Merge into standard CodeLens; click selects source, then native Hover | Verified on the first macOS tuple; one-click Hover still needs Zed upstream support |
| AI Explain CodeLens | VS Code Copilot client command | Keep the lens visible with an accurate manual-Agent notice | The lens is not conditional on Zed AI state; this extension neither invokes Agent nor sends source/prompt to an AI service |
| Spring logical structure | VS Code custom tree view | Project Symbols plus optional generated Structure document | Custom panel is unavailable, but the outcome is not blocked |
| Live beans, injections, conditions, metrics and loggers | Live hover, custom view commands, JMX/Actuator data | Native hover/CodeLens for source-local facts; opt-in Live document for aggregate data | Source-local bean/injection detail is verified; aggregate lifecycle, freshness and redaction gates remain |
| Boot app discovery and lifecycle | Spring commands plus separate Dashboard explorer | Official-Java runnables, Zed tasks/debugger, generated reviewable configs | Run is partly verified; debug/stop/multi-app lifecycle remain |
| Beans/endpoints/dependencies for running apps | Separate Dashboard explorer | Project Symbols and opt-in Live/Structure document with source links | No custom tree; same data outcome remains feasible |
| Build/test | VS Code Java/Maven/Gradle/Test extensions | Official Zed Java runnables, tasks, terminal and debugger | Spring project must not replace official Java ownership |
| Boot version/support validation and upgrade | Build-file diagnostics, quick fixes and OpenRewrite commands | Native diagnostics, Code Actions and reviewable workspace edits | Network/update and edit-preview behaviour need explicit tests |
| Spring XML | Completion, diagnostics, hyperlinks and symbols | Standard LSP plus the Zed XML language | Resolve multi-server routing and test all four outcomes |
| Spring factories and named-query property files | Dedicated VS Code languages/grammars | Zed file-type/language mapping plus standard LSP | `*.factories` and exact named-query identity remain work |
| Modulith structure and refresh | Symbols, metadata commands and structure view | Project Symbols, Code Actions, Structure document | Planned |
| Project generation | Separate Spring Initializr extension | External `start.spring.io` today; a future explicit network/artifact workflow | Outside current runtime boundary |
| Spring-aware agent tools | Experimental embedded HTTP MCP server in Spring Tools 5.2.0 | Zed supports remote MCP tools and prompts | Technically compatible, but enabling a port and Spring.io calls requires a new runtime/network/security decision |

## Standard CodeLens command audit

The developer-facing [CodeLens showcase and coverage matrix](../code-lens-showcase.md)
turns this provider audit into numbered fixture targets and separates adapter
implementation from authentic runtime evidence.

Spring Tools 5.2.0 registers five standard Java CodeLens providers:

| Provider | Lens action | Zed compatibility |
| --- | --- | --- |
| `WebfluxHandlerCodeLensProvider` | Endpoint summary, no executable command | Preserve as visible informational lens; click explains that it is informational if Zed requires a command |
| `WebConfigCodeLensProvider` | VS Code `vscode.open` to a source `Location` | Lossless translation to Zed's built-in `editor.action.goToLocations` argument shape |
| `DataRepositoryAotMetadataCodeLensProvider` | Server commands for refactor, generated implementation and metadata refresh; query text is informational | Advertised server commands execute normally and query text remains visible. The generated implementation command's authentic target is pre-resolved, cached, refreshed, and rewritten to `editor.action.goToLocations` |
| `CopilotCodeLensProvider` | `vscode-spring-boot.query.explain` | VS Code-client-only; retain the title and explain the manual Zed Agent workflow without claiming state detection or invocation |
| `RouterFunctionCodeLensProvider` | Same Copilot client command | Same boundary; Spring supplies a prompt, not a deterministic non-AI conversion command |

The live CodeLens provider is not in this list. It receives versioned lenses by
`sts/highlight`, drops stale document versions, and maps only command-bearing
lenses. The coordinator can reproduce that cache/merge contract without
changing Spring Tools or Zed.

## Primary sources

- Spring Tools 5.2.0 commit
  `18d1a975dbea4f9314fd736d0237bd9e23f243f9`, inspected 2026-07-19:
  - `vscode-extensions/vscode-spring-boot/package.json`
  - `vscode-extensions/commons-vscode/src/code-lens-service.ts`
  - `vscode-extensions/commons-vscode/src/launch-util.ts`
  - `headless-services/spring-boot-language-server/.../BootJavaLanguageServerComponents.java`
  - the five CodeLens providers named above
  - `.../app/BootJavaCompletionEngineConfigurer.java`, `JdtConfig.java`,
    `BootVersionValidationConfig.java`, and `McpConfig.java`
- Spring Tools upstream `main` commit
  `0e39c1c8d78c5adc7bdbbc42b58b83a22bcef0e0`, whose 2.3.0 package contribution
  keys and commands were mechanically compared with the pinned package on
  2026-07-19.
- Official [Spring Boot Tools Marketplace page](https://marketplace.visualstudio.com/items?itemName=vmware.vscode-spring-boot),
  [Spring Boot Extension Pack page](https://marketplace.visualstudio.com/items?itemName=vmware.vscode-boot-dev-pack),
  and [Spring Boot Dashboard page](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-spring-boot-dashboard),
  accessed 2026-07-19.
- Spring Tools [changelog](https://github.com/spring-projects/spring-tools/wiki/Changelog),
  accessed 2026-07-19.
- Zed source commit `54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698`,
  especially `crates/editor/src/code_lens.rs` and
  `crates/project/src/lsp_store/code_lens.rs`.
- Follow-up current-upstream audit [R019](019-zed-codelens-agent-navigation-and-build-output.md),
  including Zed commit `edeaf598c7495bd7b9e9a05d68e61f08ad275d16`,
  Spring's generated-target resolver, the public Agent/extension API boundary,
  and file-finder settings.
- Official Zed documentation, accessed 2026-07-19:
  [language configuration](https://zed.dev/docs/configuring-languages),
  [Git](https://zed.dev/docs/git),
  [Java](https://zed.dev/docs/languages/java),
  [debugger](https://zed.dev/docs/debugger), and
  [MCP](https://zed.dev/docs/ai/mcp).

## Inferences

1. The highest-value parity work is not new UI. Most omitted Spring features
   already speak standard LSP and need representative runtime tests, correct
   settings, and careful multi-server routing.
2. CodeLens should be a small compatibility layer: merge live highlights,
   normalize client-only commands, and pre-resolve only the authentic Spring
   target needed to translate `CL-4d` into Zed's location command. Rebuilding
   JDT reference lenses, Git blame, Spring's resolvers, or Spring's standard
   lens providers would duplicate working functionality.
3. A generated document is appropriate only for aggregate/dashboard outcomes
   that cannot fit hover, symbols, diagnostics, CodeLens, tasks, or debugger UI.
4. The embedded Spring MCP server is a unusually close Zed-native match for
   Spring-aware agent features, but its HTTP listener and external Spring.io
   tools materially expand runtime and security scope. Compatibility alone does
   not authorize enabling it.

## Unverified hypotheses

1. All dynamically registered Java completion, semantic-token, highlight, and
   inlay providers compose correctly with JDT in stock Zed.
2. Asynchronously pre-resolving `CL-4d` and refreshing CodeLens can preserve
   Spring's exact generated target without noticeable flicker or stale cache.
3. `editor.action.goToLocations` opens that target even when its parent
   `target/` directory is Git-ignored.
4. Zed renders Spring command objects whose command id is absent/null; the
   compatibility layer will normalize them so the title remains visible even
   if it does not.
5. `jpa-named-queries.properties` can obtain full query intelligence without a
   distinct Zed language id. Existing source evidence does not prove this.
6. A Spring embedded streamable-HTTP MCP endpoint works with Zed's remote MCP
   client while the same JVM is also serving LSP.

## Runtime verification needed

- Exercise representative Java completions: request-mapping snippet, `@Value`,
  bean/profile/qualifier/resource, repository method and cron.
- Exercise one diagnostic/quick fix from Boot 2, Boot 3, Boot 4, AOT, SpEL,
  data query, cron, Spring AI and version validation.
- Capture Spring-specific references, document highlights, semantic tokens and
  data-query inlay hints with multi-server attribution.
- Completed 2026-07-19: all five standard CodeLens provider families rendered
  after fixture corrections; query display, `Turn into @Query`, metadata
  refresh, `vscode.open` navigation, and AI-boundary notices were observed.
- Completed in R017: a connected process produced non-empty `sts/highlight`
  lenses, refreshes, source selection, and authentic Spring live Hover data.
- Completed 2026-07-19: `CL-4d` target pre-resolution, stale-target invalidation,
  refresh, and one-click opening from a Git-ignored `target/` directory. AI-
  enabled/disabled runs verify notice wording only; they cannot establish
  conditional lens visibility.
- Test Dashboard-equivalent run/debug/stop, browser links, and aggregate live
  data independently; a custom panel is not a prerequisite for the outcomes.

## Blockers and constraints

- Zed extensions still cannot contribute a VS Code-like custom tree/sidebar or
  arbitrary command-palette commands.
- A CodeLens cannot programmatically invoke Zed's native Hover action through
  the current LSP/extension API; R017 records the extra-gesture fallback.
- Live endpoint lenses also use the VS Code-client-only
  `vscode-spring-boot.open.url`. The coordinator preserves the visible URL and
  explains the manual browser fallback; stock Zed has no CodeLens client
  command that opens it.
- VS Code Copilot client commands cannot be forwarded to Spring as server
  commands. The current public Zed API exposes neither authoritative Agent
  state nor an Agent invoke/prefill action. The extension keeps the lenses
  visible, provides accurate manual guidance, and sends no source or prompt to
  an AI service.
- Zed has no extension-controlled file-finder "sort build output last" route.
  The fixture can ignore its own `/target/`; arbitrary project policy remains
  with `.gitignore` or `.git/info/exclude`. `file_scan_exclusions` is a stronger
  removal mechanism and is not an equivalent default.
- Enabling embedded MCP, Initializr, or any new runtime network flow requires an
  explicit decision under this repository's current gate.

## Candidate next experiments

1. Completed 2026-07-19 with contract tests: CodeLens response merging,
   version invalidation, `vscode.open` translation, and explanatory client-only
   commands.
2. Completed 2026-07-19 for live CodeLens: a real Boot/JMX process produced
   endpoint, bean and injection lenses; Zed refreshed and rendered them, click
   selected the source range, and native Hover returned authentic Spring live
   detail. The run also added coverage for the previously missed
   `vscode-spring-boot.open.url` client command. A dedicated `CL-7c` follow-up
   then verified a commandless `@Value` lens and native Hover value `37` from
   `systemEnvironment`.
3. Completed 2026-07-19: the non-live showcase exposed all five standard
   provider families. R019 records the resulting AI, `CL-4d`, and build-output
   boundary corrections.
4. Completed 2026-07-19: asynchronous `CL-4d` target pre-resolution and location
   rewriting opened the exact generated method with `/target/` Git-ignored.
5. Drive the high-value standard-LSP matrix before building new presentation:
   Spring completions, diagnostics/quick fixes, SpEL, data queries, cron and
   Spring-specific references.
6. Revisit a Live/Structure document only for remaining aggregate outcomes.
7. Record a separate decision before exposing the embedded MCP server or adding
   Initializr networking.

## Conclusion

The parity gap is smaller than a VS Code UI inventory suggests. References,
authorship/history, related links, ordinary Java CodeLens, navigation, hover,
completion, diagnostics, Code Actions, semantic tokens, inlay hints, tasks and
debugger already have Zed-native or standard-LSP homes. Product code should
   concentrate on the genuinely non-standard seams: live `sts/highlight`, a few
   VS Code client commands, the completed `CL-4d` authentic-target translation, aggregate
dashboard data, and explicit configuration or language-routing gaps. R019
   further narrows the immediate result: this project closed `CL-4d`, while
direct Agent control and file-finder sort order remain upstream/user-owned.
