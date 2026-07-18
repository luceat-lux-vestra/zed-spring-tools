# R017: Zed CodeLens-to-Hover command compatibility

- Status: Complete for source feasibility and the first driven runtime gate
- Last updated: 2026-07-19
- Investigator: OpenAI Codex (GPT-5.6 Sol)

## Question

Can Spring Tools' `sts.showHoverAtPosition` CodeLens command use an equivalent
stock-Zed path, as Zed already does for ordinary reference CodeLens commands?

## Scope

This investigation covers the pinned Spring Tools 5.2.0 release, Zed's current
CodeLens click path and native Hover action, the extension API boundary, the
standard LSP request surface, and user-visible fallbacks. It does not modify
Zed or submit an upstream issue.

## Confirmed facts

1. Spring Tools' `sts/highlight` payload contains versioned-document CodeLens
   values. Its VS Code provider retains only command-bearing lenses and exposes
   each range and command unchanged.
2. The live-data lenses created by `LiveHoverUtils` use
   `sts.showHoverAtPosition`. Their visible title contains the compact live
   fact, while their sole argument is the lens range's start position.
3. `sts.showHoverAtPosition` is a VS Code **client** command, not a Spring
   language-server command. The VS Code extension moves the active selection to
   the supplied position and executes `editor.action.showHover`.
4. Zed has the equivalent native `editor::Hover` action. It requests and shows
   hover information at the newest selection head. Default bindings include
   `cmd-k cmd-i` on macOS and `ctrl-k ctrl-i` on Linux and Windows; users may
   remap the action.
5. Before dispatching a CodeLens command, Zed moves the editor selection to the
   CodeLens action range's start. For current Spring live lenses this is the
   same position carried by `sts.showHoverAtPosition`.
6. Zed does not currently connect an LSP CodeLens command to the native Hover
   action. Its complete `ClientCommand` enum has only `ShowLocations` and
   `ScheduleTask`. The generic CodeLens path recognizes
   `editor.action.showReferences`, `editor.action.goToLocations`, and
   `editor.action.peekLocations` as `ShowLocations`; it has no
   `editor.action.showHover` or `sts.showHoverAtPosition` case.
7. Community extension LSP adapters cannot add that missing mapping. The
   extension adapter uses the default `client_command` implementation, and the
   extension API 0.8.0 has no action-dispatch or client-command export.
8. If a CodeLens command is not handled as a client command, Zed sends
   `workspace/executeCommand` only when the language server advertised that
   exact command. Spring Tools 5.2.0 does not advertise
   `sts.showHoverAtPosition`, so passing the authentic command through unchanged
   results in no execution.
9. Standard LSP has no server-to-client request that means "invoke the editor's
   Hover UI at this position." A coordinator can request `textDocument/hover`
   from Spring itself and put converted text in a notification, but that is not
   Zed's native hover popover and loses its normal composition and interaction.
10. Spring's standard Hover handler and live-hint generator share the same
    `SpringProcessLiveDataProvider` and hover-provider set. Once a CodeLens click
    has selected the lens position, invoking Zed's native Hover action therefore
    reaches the intended Spring live-hover path rather than a separate product
    reimplementation.
11. Existing driven evidence already shows Zed issuing standard
    `textDocument/hover` requests to both the Spring and official-Java servers
    and rendering their results. It did not have a connected live process, so
    its captured `sts/highlight` arrays were empty and it does not yet prove the
    final live-lens gesture.
12. No narrowly matching Zed issue was found on 2026-07-19. The open upstream
    issue [zed#20042](https://github.com/zed-industries/zed/issues/20042) covers
    the broader missing extension/LSP custom-message and client-command bridge.
13. A driven macOS arm64 run connected Spring Tools 5.2.0 to a real Spring Boot
    3.5.5 process through local JMX. Spring emitted non-empty versioned live
    lenses for an injected service and a request mapping. Zed requested
    `textDocument/codeLens` after the coordinator sent
    `workspace/codeLens/refresh`, and rendered the merged lenses beside JDT's
    ordinary reference lenses.
14. The authentic injection lenses used `sts.showHoverAtPosition` and titles
    such as `← DefaultGreetingService` and `→ GreetingController`. The
    coordinator retained those titles and replaced only the unavailable client
    command with `zed-spring-tools.explain-code-lens`.
15. Clicking an injection lens selected its authentic source range and showed
    the limitation notice. Invoking `editor::Hover` with `cmd-k cmd-i` then made
    Zed issue `textDocument/hover` at that selected position. Zed rendered the
    Spring live bean name, type, resource, bean id, and connected process
    together with the ordinary JDT hover result.
16. The same run found a second VS Code-only live command not covered by the
    initial source slice: `vscode-spring-boot.open.url`. Its lens exposed
    `http://127.0.0.1:8080/greeting`, then request count/timing after a request.
    Stock Zed cannot dispatch this URL command from CodeLens, so the coordinator
    now retains the URL title and explains how to open it instead of allowing a
    silent no-op.
17. A dedicated `CL-7c` run connected the same Boot 3.5.5/JMX fixture with
    `CODELENS_SAMPLE_LIMIT=37`. Spring emitted a commandless highlight over the
    exact `@Value` property key. The coordinator exposed it as
    `Spring live data — use Hover`, and a standard Hover request returned
    `CODELENS_SAMPLE_LIMIT : 37 (from: systemEnvironment)` plus the process
    identity.
18. Spring Tools 5.2.0's `ValueHoverProvider` parses everything between `{` and
    `}` as the lookup key. `${CODELENS_SAMPLE_LIMIT:5}` therefore searches for
    the literal key `CODELENS_SAMPLE_LIMIT:5` and does not match the live
    property. The showcase keeps its fallback in `application.properties` and
    uses `${CODELENS_SAMPLE_LIMIT}` in Java.

## Primary sources

- Spring Tools 5.2.0 release commit
  `18d1a975dbea4f9314fd736d0237bd9e23f243f9`, inspected 2026-07-19:
  - [`code-lens-service.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/commons-vscode/src/code-lens-service.ts)
  - [`commands.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/commons-vscode/src/commands.ts)
  - [`LiveHoverUtils.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/livehover/LiveHoverUtils.java)
  - [`BootJavaHoverProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/handlers/BootJavaHoverProvider.java)
  - [`ValueHoverProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/value/ValueHoverProvider.java)
- Zed `main` commit `54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698`,
  inspected 2026-07-19:
  - [`code_lens.rs`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/editor/src/code_lens.rs)
    contains selection-before-dispatch, built-in client-command matching, and
    the fallback server-command path.
  - [`hover_popover.rs`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/editor/src/hover_popover.rs)
    contains the native Hover action.
  - [`language.rs`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/language/src/language.rs)
    contains the complete `ClientCommand` enum and adapter hook.
  - [`extension_lsp_adapter.rs`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/language_extension/src/extension_lsp_adapter.rs)
    does not override that hook.
  - [`extension.wit`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/extension_api/wit/since_v0.8.0/extension.wit)
    contains no editor-action dispatch export.
- Repository runtime evidence:
  `tmp/lsp-verify-20260718/evidence/`.

## Options evaluated

| Route | Result | Consequence |
| --- | --- | --- |
| Pass `sts.showHoverAtPosition` through unchanged | Not usable | Zed neither handles it locally nor sends an unadvertised command to Spring. |
| Rename it to `editor.action.showHover` | Not usable today | Zed has no matching CodeLens client-command case. |
| Dispatch `editor::Hover` from the extension | Not available | The extension API exposes no editor-action or client-command hook. |
| Ask Spring to open Zed's Hover UI | Not available | Standard LSP has no such server-to-client request. |
| Re-request hover and show it in a message | Technically possible, not preferred | Duplicates Zed's hover composition in a lower-fidelity notification. |
| Keep the lens, let the click position the cursor, then use native Hover | Available with one extra gesture | Uses the authentic Spring hover result and no duplicated business logic. |
| Add a Zed core `ShowHover` client-command mapping | Best one-click upstream fix | A small Zed-side mapping can dispatch the existing native Hover action. |

## Inferences

1. The developer outcome is **partially Zed-native**, not wholly unsupported.
   The compact live fact is visible in CodeLens, the click selects the correct
   source position, and Zed's native Hover can show the full Spring result. Only
   automatic one-click dispatch of Hover is missing.
2. The product should not synthesize a second hover renderer in an LSP message.
   That would be semantically weaker than telling the user how to invoke the
   editor's already-correct Hover action.
3. For `sts.showHoverAtPosition`, the coordinator should preserve the original
   title but replace the unavailable command with one coordinator-owned command.
   On click it should explain the one-gesture limitation, name `editor::Hover`
   and the platform default shortcut, and link the relevant Zed upstream issue.
4. Server-advertised commands in future `sts/highlight` payloads should remain
   executable. Only client-only or unknown commands should use the explanatory
   route. A commandless live range can still become a meaningful, deliberately
   generic Hover affordance without copying a potentially sensitive runtime
   value into the persistent CodeLens title.
5. If Zed adds a `ShowHover` client command, the coordinator can rewrite
   `sts.showHoverAtPosition` to that supported command and remove the prompt
   without changing Spring Tools.

## Remaining unverified items

1. Linux and Windows rendering, shortcuts, and process attachment remain
   untested.
2. The zed#20042 URL in the notification was rendered as visible text, but its
   clickability was not exercised.
3. A controlled driven race that requests CodeLens between a document-version
   change and Spring's replacement `sts/highlight` was not forced. Contract
   tests verify rejection of the old version, while the driven run verified
   authentic versioned caching, refresh, source edits, process replacement, and
   new live ranges.
4. The displayed default shortcut must remain secondary to the authoritative
   `editor: hover` action name for non-default keymaps and user remapping.

## Driven runtime verification

- Date/environment: 2026-07-19, macOS arm64, Zed 1.11.3, official Java 6.8.21,
  Temurin JDK 25.0.3, Spring Tools 5.2.0, Spring Boot 3.5.5.
- The fixture enabled Spring JMX and Actuator, exposed `/greeting`, and used
  constructor injection from `GreetingController` to
  `DefaultGreetingService`.
- Process discovery returned the Boot process separately from Maven and JDT;
  connecting it produced authentic refresh requests and non-empty live lenses.
- The URL lens, unavailable-command notice, injection lenses, click-selected
  range, native Hover request, and combined Spring/JDT hover were all observed
  in unmodified Zed.
- The `CL-7c` property run rendered the generic commandless-range lens and
  returned value `37`, source `systemEnvironment`, and process identity through
  native Hover. The final ignored trace is
  `lsp-cl7c-final-pass-20260719.jsonl`.
- Ignored evidence is retained under
  `tmp/codelens-runtime-20260719.udLvyE/evidence/`, especially
  `lsp-codelens-final-fixed.jsonl`, `lsp-hover-gesture.jsonl`,
  `zed-click2-full.png`, `zed-hover-click2-full.png`, and
  `zed-native-hover-full.png`.

## Blockers and constraints

- One-click native Hover requires a Zed core or public extension-API change.
- A custom Zed build is excluded by D005 and cannot be a product dependency.
- OS-level keyboard injection, shell-driven UI automation, fake reference
  locations, diagnostics used as popovers, and copied hover business logic are
  not acceptable substitutes.
- CodeLens remains default-off in Zed and needs an explicit user setting until
  Zed changes that default.

## Candidate next experiments

1. Completed 2026-07-19 with contract tests: the coordinator now caches
   versioned `sts/highlight`, merges it into standard CodeLens, requests
   `workspace/codeLens/refresh`, preserves Spring commands, and translates
   `sts.showHoverAtPosition` to its explanatory command.
2. Completed 2026-07-19: the live-process gesture gate passed in stock Zed; the
   extra native Hover gesture is an honest usable fallback for the first
   release.
3. Completed 2026-07-19: `CL-7c` proved the commandless property-range
   adaptation with a real environment value and source.
4. Revisit the command translation when Zed adds `ShowHover` or exposes client-
   command/action dispatch to extension adapters.

## Conclusion

Zed has a compatible native Hover feature and already moves the cursor to the
right place when a CodeLens is clicked. The driven run confirms that the
two-gesture fallback reaches authentic Spring live hover data. What Zed lacks is
only the programmatic CodeLens-command-to-Hover bridge that it already provides
for reference commands. The first stock-Zed implementation can therefore show
authentic Spring live lenses, preserve real server-executable commands, and make
client-only hover or URL lenses explain the native fallback and upstream
limitation when clicked. It should not describe Spring live hover itself as
unavailable.
