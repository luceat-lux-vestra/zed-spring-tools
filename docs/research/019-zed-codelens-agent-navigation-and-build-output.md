# R019: Zed CodeLens Agent, generated-target navigation, and build-output boundaries

- Status: Complete; CL-4d implementation and first runtime gate passed
- Last updated: 2026-07-19
- Investigator: OpenAI Codex (GPT-5.6 Sol)

## Question

Which of the remaining CodeLens UX gaps can this project solve itself: direct
Zed Agent use for Spring's AI-only lenses, one-click generated implementation
navigation for `CL-4d`, and deprioritizing Maven `target/` files in Zed's file
finder?

## Scope

This audit covers the pinned Spring Tools 5.2.0 CodeLens providers, this
project's coordinator, stock Zed 1.11.3 runtime observations, Zed `main` commit
`edeaf598c7495bd7b9e9a05d68e61f08ad275d16`, and current official Zed settings
documentation and the resulting `CL-4d` implementation/runtime gate. It does
not modify Zed, invoke an AI provider, or change a user's project settings.

## Confirmed facts

### AI-only lenses

1. Spring's `CopilotCodeLensProvider` hides its lenses until the client executes
   `sts/enable/copilot/features(true)`. Once enabled, the provider creates the
   lens title and prompt locally and assigns the VS Code client command
   `vscode-spring-boot.query.explain`. The server exposes no deterministic,
   non-AI explanation command. `RouterFunctionCodeLensProvider` reuses the same
   client command and delegates the source conversion entirely to its prompt.
2. The current coordinator enables that Spring provider unconditionally after
   LSP initialization. It does not detect Zed's `disable_ai` value or whether a
   model/provider is configured. The AI-only lenses therefore remain visible
   when Zed AI is disabled.
3. The isolated acceptance profile deliberately sets `disable_ai: true` to
   prevent provider authentication and other external-agent effects. The
   resulting "Zed AI fallback is disabled" observation describes that test
   profile, not conditional CodeLens visibility in the product.
4. Stock Zed's CodeLens click bridge recognizes only the location commands
   `editor.action.showReferences`, `editor.action.goToLocations`, and
   `editor.action.peekLocations`, plus adapter-owned scheduled tasks. The public
   extension API exposes no Zed Agent enabled-state query, Agent-panel action,
   prompt-prefill operation, or arbitrary editor-action dispatcher.
5. This project therefore cannot make the current AI-only CodeLens invoke Zed
   Agent directly or hide it based on the authoritative Zed AI state. Its
   in-scope behavior is to retain the requested visible blocked lens, explain
   the boundary accurately, and avoid forwarding the prompt or source to an AI
   service.

### `CL-4d` generated implementation navigation

6. Spring's Data AOT CodeLens uses
   `sts/boot/open-data-query-method-aot-definition`. The command arguments carry
   the source document, repository type, query method, and parameter types. The
   server resolves the generated Java method and asks the client to open its
   exact URI/range with `window/showDocument`.
7. The same Spring component implements a standard definition-location
   provider for supported Spring Data versions. In both paths the authentic
   Spring resolver returns the generated target; this project does not need to
   reconstruct AOT filenames or Java bindings.
8. Zed's normal project LSP client still does not handle
   `window/showDocument`. The current upstream feature discussion explicitly
   identifies CodeLens navigation as a motivating case. Zed does handle
   `editor.action.goToLocations` directly from CodeLens.
9. The coordinator now recognizes only Spring's exact generated-implementation
   command, executes it asynchronously outside the serialized Spring handler,
   captures its authentic `window/showDocument` URI/range, caches the target by
   source version and command arguments, requests CodeLens refresh, and rewrites
   the next lens to `editor.action.goToLocations`. Missing files, source changes,
   index updates, AOT refresh, and document close invalidate the cache.

### Maven `target/` visibility

10. Zed has no extension API or setting that means "keep this directory in the
    file finder but sort it last." File-finder inclusion and fuzzy ranking are
    editor-owned.
11. Git-ignored paths are omitted from the normal file-finder result unless the
    user enables ignored files. Zed's worktree tests also confirm that an exact
    path inside a Git-ignored directory can still be loaded, which is compatible
    with direct LSP navigation to generated source.
12. `file_scan_exclusions` is materially stronger than `.gitignore`: excluded
    paths are skipped by scans and searches and removed from the project tree.
    It overrides `file_scan_inclusions`, and a user-supplied list replaces the
    documented defaults. It is not an equivalent default recommendation for a
    generated source that CodeLens may need to open.
13. The showcase fixture now owns `/target/` in its local `.gitignore`, so its
    acceptance workflow needs no user setting. For arbitrary projects that do
    not already ignore Maven output, only the project/user can choose
    `.gitignore`, local `.git/info/exclude`, or the stronger Zed exclusion. This
    extension must not silently edit any of them.

## Primary sources

- Spring Tools 5.2.0 commit
  `18d1a975dbea4f9314fd736d0237bd9e23f243f9`, inspected 2026-07-19:
  - [`CopilotCodeLensProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/handlers/CopilotCodeLensProvider.java)
  - [`RouterFunctionCodeLensProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/handlers/RouterFunctionCodeLensProvider.java)
  - [`DataRepositoryAotMetadataCodeLensProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/data/DataRepositoryAotMetadataCodeLensProvider.java)
  - [`GenAotQueryMethodImplProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/java/data/GenAotQueryMethodImplProvider.java)
- Zed `main` commit
  `edeaf598c7495bd7b9e9a05d68e61f08ad275d16`, inspected 2026-07-19:
  - [`code_lens.rs`](https://github.com/zed-industries/zed/blob/edeaf598c7495bd7b9e9a05d68e61f08ad275d16/crates/editor/src/code_lens.rs)
    contains the complete built-in CodeLens client-command handling.
  - [`extension_api.rs`](https://github.com/zed-industries/zed/blob/edeaf598c7495bd7b9e9a05d68e61f08ad275d16/crates/extension_api/src/extension_api.rs)
    exposes no Agent state or action operation.
  - [`file_finder.rs`](https://github.com/zed-industries/zed/blob/edeaf598c7495bd7b9e9a05d68e61f08ad275d16/crates/file_finder/src/file_finder.rs)
    owns ignored-file filtering and ranking.
  - [`worktree_tests.rs`](https://github.com/zed-industries/zed/blob/edeaf598c7495bd7b9e9a05d68e61f08ad275d16/crates/worktree/tests/integration/worktree_tests.rs)
    includes `test_open_gitignored_files`.
- Current upstream Zed
  [`window/showDocument` feature discussion](https://github.com/zed-industries/zed/discussions/58099),
  opened 2026-05-29 and accessed 2026-07-19.
- Official Zed documentation, accessed 2026-07-19:
  - [`file_scan_exclusions`, `file_scan_inclusions`, and File Finder settings](https://zed.dev/docs/reference/all-settings)
  - [File Finder `include_ignored`](https://zed.dev/docs/visual-customization#file-finder)
  - [actions including `git: add to git info exclude`](https://zed.dev/docs/all-actions)
- Product implementation and evidence:
  [`coordinator/src/main.mjs`](../../coordinator/src/main.mjs),
  [`docs/code-lens-showcase.md`](../code-lens-showcase.md), and
  `tmp/codelens-runtime-20260719.udLvyE/evidence/`.

## Options evaluated

| Gap | Route | Result |
| --- | --- | --- |
| AI lens | Detect Zed AI state and conditionally expose the Spring provider | Not available through the public extension/LSP boundary |
| AI lens | Dispatch or prefill Zed Agent from CodeLens | Desired future UX, but not available through the current CodeLens or extension API |
| AI lens | Keep the lens visible with an accurate local-only/blocker notice | Available and consistent with the owner's request to expose unavailable items |
| `CL-4d` | Tell the user to invoke Go to Definition manually | Available but makes the CodeLens itself largely redundant |
| `CL-4d` | Pre-resolve with Spring, cache the URI/range, and rewrite to `editor.action.goToLocations` | Implemented, contract-tested, and runtime verified on the first tuple |
| `CL-4d` | Reimplement Spring's generated-source lookup | Rejected; duplicates authentic upstream logic and creates drift risk |
| `target/` | Sort build output last | Not available in stock Zed or the extension API |
| `target/` | Add fixture-local `.gitignore` | Implemented for the acceptance fixture |
| `target/` | Automatically edit user ignore/settings files | Rejected as invasive and unable to preserve user policy |
| `target/` | Document `.gitignore`/`.git/info/exclude`; reserve `file_scan_exclusions` for deliberate full removal | Available and preferred |

## Inferences

1. `CL-4d` was the only one of these three gaps that this project could close as
   a transparent one-click compatibility adaptation today, and that adaptation
   is now complete on the first tuple.
2. The safest implementation is asynchronous pre-resolution: identify the
   authentic Spring command in a CodeLens response, obtain and cache its target
   by source URI/document version/command arguments, request CodeLens refresh,
   and return a Zed location command only after the target is known. This avoids
   waiting for a Spring response inside the coordinator's serialized Spring
   message handler.
3. Capturing the authentic command's `window/showDocument` callback was selected
   over a generic definition request because it exercises the exact upstream
   CodeLens resolver without reconstructing generated paths.
4. If Zed later exposes a user-consented Agent-prefill action, the extension
   should open and prefill rather than auto-submit. At that point the privacy
   text must say that Zed, not this extension, sends the user-approved prompt and
   context to the configured provider.
5. Ignoring `target/` is compatible with the implemented `CL-4d` navigation because
   an exact generated-file location can be loaded without making all generated
   files compete in the normal finder. Full `file_scan_exclusions` needs its own
   navigation test before being recommended for that workflow.

## Unverified hypotheses

1. The standard definition request and the command callback return the same
   target URI and selection for all supported Spring Data modules.
2. Future Zed extension APIs may expose Agent actions or state; no roadmap or
   release is assumed.

## Runtime verification result

- Contract tests resolve the authentic `CL-4d` command, capture its target,
  reject deleted or source-version-stale entries, refresh CodeLens, and assert
  the exact `editor.action.goToLocations` argument shape.
- In stock Zed 1.11.3, the driven CodeLens response contained the exact generated
  URI/range. One click opened and selected
  `CodeLensShowcaseRepositoryImpl__AotRepository.findByMessageContainingIgnoreCase`
  while the fixture's `/target/` remained Git-ignored, with no popup or manual
  Go to Definition gesture.
- AI-disabled observations validate only the corrected notice wording; they are
  not reported as conditional lens visibility.

## Blockers and constraints

- Direct Zed Agent invocation and authoritative AI-state detection require a Zed
  core/public extension-API change.
- File-finder ranking and user ignore policy are Zed/user-owned. This project
  cannot silently mutate them or claim a sort-last behavior.
- The implemented resolver must retain its asynchronous serialization and avoid
  waiting inside the Spring message handler.
- A custom Zed build, OS-level UI automation, AI auto-submission, and generated-
  path reconstruction are outside the accepted product boundary.

## Candidate next experiments

1. Repeat `CL-4d` on additional desktop tuples and Spring Data modules before
   broadening support claims.
2. Exercise a real target-disappearance/AOT-refresh race in stock Zed in
   addition to the contract coverage.
3. Revisit the AI action only when Zed adds a public Agent-prefill/action API;
   until then, retain the corrected local-only wording.

## Conclusion

The project implemented and verified one-click `CL-4d` by translating an
authentic Spring-resolved target into Zed's supported location command. It
cannot currently invoke Zed Agent, detect its authoritative enabled state, or
deprioritize arbitrary `target/` directories in the file finder. For those two
boundaries the product work is accurate wording, a fixture-local ignore rule,
and non-invasive user guidance.
