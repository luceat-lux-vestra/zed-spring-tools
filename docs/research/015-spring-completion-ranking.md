# R015: Spring property completion ranking in stock Zed

- Status: Complete for attribution; candidate upstream fixes remain untested
- Last updated: 2026-07-19
- Investigator: OpenAI Codex (GPT-5.6 Sol)
- Runtime baseline:
  - macOS 26.5.2 arm64
  - Zed 1.11.3, commit
    `952d712dac48a4af2c54fb22c82d82a9d69b72d4`
  - official Java extension 6.8.23, commit
    `ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`
  - Spring Tools 5.2.0.RELEASE, commit
    `18d1a975dbea4f9314fd736d0237bd9e23f243f9`
  - Temurin JDK 25.0.3

## Question

Why does stock Zed show `server.port` below less relevant Spring property
completions for the typed prefix `server.p`, and which component owns the
observed ordering and deprecated-item rendering?

## Scope

Included: one live Maven fixture completion response, its visible stock-Zed
menu, the product coordinator's forwarding behavior, Spring Tools' proposal
sorting and LSP conversion, Zed's completion query and post-response sorting,
and official Java's Properties language configuration.

Excluded: a production fix, a change to the official Java extension, a custom
Zed build, YAML ordering, other completion prefixes, other Zed versions, and a
general completion-quality claim.

## Confirmed facts

### The coordinator does not modify ordinary completion traffic

1. The product coordinator handles only its internal pending responses,
   classpath requests, allowlisted Java client requests, and a small set of
   lifecycle/capability messages. Other Spring messages, including
   `textDocument/completion` responses, are encoded and forwarded to Zed
   unchanged.
2. Zed 1.11.3 advertises completion `deprecatedSupport: true` and tag support
   for `CompletionItemTag.Deprecated` (`1`). The live initialization trace
   contained the same capability.

### The live Spring response ranked `server.port` first

3. On 2026-07-19, the warm isolated S016 Maven fixture's
   `application-probe.properties` buffer contained a new `server.p` line. The
   unchanged coordinator and Spring server remained alive throughout the
   observation.
4. A one-use observation hook on the coordinator's outgoing stdout retained
   only completion `label`, `sortText`, `tags`, `deprecated`, `filterText`,
   `kind`, `detail`, and `insertText` fields. It did not alter a message, the
   product source, or the official Java work directory. The Node inspector was
   closed immediately after installing the hook.
5. The final captured response, id `1287`, contained 124 items. Its first item
   was:

   ```json
   {"label":"server.port","sortText":"00000","filterText":"server.port","kind":5}
   ```

   `server.port` had neither `tags` nor the legacy `deprecated` field.
6. The same response placed `server.ssl.key-password` at response index 6 with
   `sortText: "00006"`. It placed deprecated
   `server.max-http-post-size` at response index 119 with
   `sortText: "00119"` and `tags: [1]`.
7. All six tagged items were the last six response entries, with sequential
   `sortText` values `00118` through `00123`. No captured item used the legacy
   `deprecated` field.

### Stock Zed re-sorted the response and rendered the tag

8. The visible menu for the same `server.p` input did not preserve that response
   order. Its visible beginning was `server.ssl.key-password`, deprecated
   `server.max-http-post-size`, `server.tomcat.max-part-count`,
   `server.tomcat.max-parameter-count`, and
   `server.tomcat.max-part-header-size`. `server.port` was not in the visible
   beginning.
9. Zed rendered `server.max-http-post-size` muted and struck through. This
   matches its source path that treats either legacy `deprecated: true` or a
   `CompletionItemTag.Deprecated` tag as a rendering condition.
10. Zed's LSP completion provider enables client sorting by default. The menu
    fuzzy-matches each completion's `filterText` and then sorts word-start
    matches by, in order: exact query equality, snippet preference, fuzzy score,
    match positions, exact-case count, LSP `sortText`, item kind, and label.
    Thus `sortText` is a late tie-breaker, not the primary server-order key.
11. Zed derives the default completion query from the surrounding word under
    the language's `completion_query_characters`. Official Java 6.8.23's
    Properties `config.toml` declares no such characters. At `server.p`, `.` is
    therefore punctuation and the local query is `p`, even though Spring LS
    computed its response using the complete document position and prefix.
12. Zed's completion settings expose LSP enablement, timeout, word completion,
    and insert mode. They expose no user or extension setting to preserve an LSP
    server's `sortText` ordering or disable client sorting for this server.

### Spring Tools deliberately encodes its proposal order

13. Spring Tools sorts raw proposals by descending score and then label.
    Properties and YAML engines return `keepCompletionsOrder: true`, so the LSP
    adapter assigns ascending five-digit `sortText` values after that sort.
14. Deprecating a Spring property subtracts a fixed deemphasis from its proposal
    score. The adapter also emits `CompletionItemTag.Deprecated`. The live
    response confirms both effects: tagged items were placed at the end and
    carried `tags: [1]`.

## Primary sources

All sources were accessed on 2026-07-19.

- Runtime evidence under ignored `tmp/`:
  - `tmp/spring-completion-response.jsonl`, reduced completion fields for six
    successive requests; final response id `1287`
  - `tmp/spring-completion-ui.png`, original screen capture retained but not
    used for direct visual inspection
  - `tmp/spring-completion-ui-overview.png`, reduced overview used to inspect
    the visible menu
  - `tmp/spring-completion-zed-crop.png`, reduced Zed-window detail produced
    before the subsequent preference to inspect only whole-screen low-resolution
    copies
  - the evidence was scanned for absolute user paths, authorization/Bearer
    values, credentials, and classpath fields; none are part of the retained
    completion records
- Product source at commit `9d3ea04`:
  - `coordinator/src/main.mjs`, `observeZedMessage`, `handleSpringMessage`, and
    `monitorZedInput`
  - `coordinator/src/lsp.mjs`, lossless JSON/LSP encoding and decoding
- Local Zed source at
  `/Users/algorist/Repositories/zed`, exact installed commit
  `952d712dac48a4af2c54fb22c82d82a9d69b72d4`:
  - `crates/lsp/src/lsp.rs:867-883`, deprecated and tag capabilities
  - `crates/editor/src/completions.rs:316-365`, completion query and filtering
  - `crates/editor/src/completions.rs:758-770`, surrounding-word query
  - `crates/editor/src/completions.rs:1111-1117`, default client sorting and
    filtering
  - `crates/editor/src/code_context_menus.rs:1270-1356`, fuzzy filtering and
    post-filter sort
  - `crates/editor/src/code_context_menus.rs:1404-1497`, exact sort tuple
  - `crates/editor/src/code_context_menus.rs:982-999`, deprecated rendering
  - `crates/language/src/buffer.rs:593-599` and `6141-6167`, completion character
    classification
  - `crates/language/src/language_settings.rs:177-201`, available completion
    settings
  - upstream commit:
    <https://github.com/zed-industries/zed/commit/952d712dac48a4af2c54fb22c82d82a9d69b72d4>
- Official Java extension 6.8.23 at commit `ddc13daf`:
  - `languages/properties/config.toml`, no `completion_query_characters`
  - upstream tag:
    <https://github.com/zed-extensions/java/tree/v6.8.23/languages/properties>
- Spring Tools 5.2.0.RELEASE at commit `18d1a975`:
  - `VscodeCompletionEngineAdapter.java:220-286`, proposal sort, sequential
    `sortText`, and deprecated tag conversion
  - `AbstractScoreableProposal.java:20-67`, score comparison and deemphasis
  - `SpringPropertiesCompletionEngine.java:63-86`, Properties proposals and
    order preservation
  - `YamlCompletionEngine.java:484-487`, YAML order preservation
  - `SortKeys.java:17-37`, ascending five-digit keys
  - `PropertyCompletionFactory.java:93-111` and `123-140`, property score and
    deprecation
  - upstream tag:
    <https://github.com/spring-projects/spring-tools/tree/5.2.0.RELEASE>

## Inferences

1. The ranking defect is client-side on the tested tuple. Spring LS ranks
   `server.port` first for `server.p`, and the coordinator preserves that
   response, but Zed replaces the server's ordering with a single-character
   fuzzy ranking before consulting `sortText`.
2. Deprecated Spring proposals are correctly transported and rendered, but
   their server-side deemphasis is not reliably preserved. Zed uses the tag for
   styling only; the fuzzy tuple can move a tagged item from the response tail
   to the visible beginning.
3. Adding `.` (and plausibly `-`) to the official Properties language's
   `completion_query_characters` is the narrowest source-level candidate. It
   would make the local query include `server.p` instead of only `p`, without
   changing Spring metadata or the product coordinator. This is not yet a
   verified fix.
4. Globally promoting `sortText` ahead of fuzzy score in Zed is broader and may
   regress language servers that rely on useful client fuzzy ranking. Any such
   change needs upstream tests across representative languages.

## Unverified hypotheses

1. A Properties configuration with `completion_query_characters = [".", "-"]`
   will keep `server.port` first for `server.p` without degrading relaxed Spring
   property matching.
2. YAML keys may show an analogous mismatch at nested separators, despite the
   different language configuration and syntax.
3. Zed main after 1.11.3 may retain the same behavior; this investigation fixes
   the claim only to the installed stable commit.

## Runtime verification needed

- Repeat the exact response/UI comparison with an upstream Properties language
  configuration that includes `.` and `-`.
- Cover relaxed kebab-case, camelCase, and uppercase property aliases before
  proposing that configuration upstream.
- Run an equivalent YAML case before generalizing the result beyond
  `.properties` files.

## Blockers and constraints

- D003 and repository policy prohibit modifying official Java or its work
  directory as a product workaround. A language-configuration change belongs
  upstream and needs its own reviewed experiment.
- D005 excludes product replacement or co-ownership of the official Java
  language/query pack. The product coordinator should not rewrite completion
  labels, `sortText`, or tags to compensate.
- Stock Zed exposes no completion-order setting that the product can recommend
  for this case.

## Candidate next experiments

1. Add an upstream-style Zed/official-Java test fixture whose Properties
   language includes `.` and `-`, then assert the local query and menu order for
   `server.p`, `server.tomcat.m`, and one deprecated property. This distinguishes
   the narrow language-config fix from a Zed sorter change.
2. If that fails, add a focused Zed editor test with the captured
   `label`/`filterText`/`sortText`/`tags` subset and compare candidate sort tuples.
   Use the result to propose the smallest sorter rule that preserves server
   relevance without disabling fuzzy filtering globally.
3. Repeat the capture on YAML only after the Properties experiment, using the
   same bounded fields and redaction scan.

## Interim conclusion

On stock Zed 1.11.3, Spring Tools 5.2.0 correctly returns `server.port` first
for `server.p` and marks deprecated properties with standard LSP tags. The
product coordinator is not the source of the mismatch. Zed reduces the local
query to `p`, fuzzy-ranks candidates ahead of their server-provided `sortText`,
and uses the deprecated tag only for presentation. The user-visible ordering is
therefore a confirmed Zed/Properties-language integration issue, not a Spring
metadata or official-Java 6.8.23 coordination regression. No product code change
is justified by this result.
