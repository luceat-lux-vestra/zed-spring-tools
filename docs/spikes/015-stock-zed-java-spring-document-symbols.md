# S015: Stock-Zed Java and Spring Document Symbols

- Status: Refuted on macOS arm64/JDK 25
- Date: 2026-07-18
- Related research:
  [R013](../research/013-zed-native-capability-delivery-surfaces.md)
- Decision:
  [D005](../decisions/005-lsp-first-capability-delivery.md)

## Hypothesis

On unmodified Zed 1.11.3 with Java `document_symbols` set to `on`, a Java buffer
served by both official JDT LS and this product's Spring Boot LS produces a usable
Outline and Breadcrumbs result: baseline Java symbols remain, Spring symbols are
navigable, nested depth is visible where Spring returns children, and refresh
does not require a Java language/outline override.

## Why runtime verification is required

Source proves that Zed requests, flattens, merges, deduplicates, and sorts
Document Symbols from multiple servers, and that Spring creates nested symbols.
Source cannot establish whether the two authentic servers return overlapping
ranges/names that become duplicate or interleaved UI entries, whether the
resulting hierarchy is understandable, or whether Spring indexing refreshes it
at the right time.

## Environment

- macOS 26.5.2 arm64
- stock Zed 1.11.3, commit
  `952d712dac48a4af2c54fb22c82d82a9d69b72d4`
- official Java extension 6.8.21
- Spring Tools `5.2.0.RELEASE`
- Temurin JDK 25.0.3
- the current development extension built from product source
- a non-ignored Maven fixture containing at least:
  - one `@SpringBootApplication`;
  - one controller and request mapping;
  - one `@Configuration` and `@Bean` method;
  - one ordinary Java class, field, constructor, and method; and
  - one cross-file service implementation.

Other desktop, architecture, Java, Zed, and extension tuples remain untested.

## Procedure

1. Prepare a clean, non-ignored fixture and a clean Zed profile with official
   Java and the development extension installed before opening Java.
2. Set LSP tracing high enough to attribute `textDocument/documentSymbol`
   requests and responses without logging credentials or classpaths.
3. Run the control with Java `document_symbols` omitted or `off`. Open the target
   Java file, invoke Outline and Breadcrumbs, and record that no LSP Document
   Symbols request is expected on the tree-sitter path.
4. Set:

   ```json
   {
     "languages": {
       "Java": {
         "document_symbols": "on"
       }
     }
   }
   ```

5. Reopen the same file, invoke Outline and Breadcrumbs, and capture every JDT
   and Spring Document Symbols response with attributable payload fields.
6. Record the rendered item name, depth, ordering, duplicate count, server of
   origin where attributable, and source range. Expand every nested branch.
7. Navigate from representative Java, bean, component, and request-mapping
   entries and verify the selected source range.
8. Edit and save a Spring annotation and a Java method name. Wait for Spring
   indexing/refresh, then verify removal of old items and appearance of new items.
9. Restart Zed without changing settings and repeat the rendered-result and
   navigation checks.
10. Restore `document_symbols` to `off` and prove the official Java tree-sitter
    Outline fallback still works.

Retain logs and screenshots only under an ignored evidence directory. Summarize
the exact paths and redaction check in this document after execution.

## Success criteria

- The `off` control follows tree-sitter and the `on` run issues attributable LSP
  Document Symbols requests.
- The `on` run retains ordinary Java type/method/field navigation.
- At least the fixture's Spring controller/component/bean/request-mapping
  symbols appear and navigate to the correct source ranges.
- A nested Spring response renders at a deeper Outline level rather than losing
  all hierarchy.
- Duplicate or interleaved entries, if any, are recorded and do not make the
  representative file materially less usable than the Project Symbols fallback.
- Edits and restart produce current rather than stale symbols.
- No Java language registration, grammar, or query is replaced.

## Failure criteria

- `on` does not issue the request, Spring returns no attributable symbols, or Zed
  drops all Spring results.
- JDT/Spring merging removes baseline Java symbols, creates misleading source
  navigation, or produces duplication/interleaving severe enough that the
  representative file is less usable than the fallback.
- Symbols remain stale after bounded index/refresh and restart checks.
- The result depends on a patched Zed build or Java language/query override.

An isolated UI oddity that does not decide usability is `Inconclusive`, not
silently treated as success.

## Observations

### Confirmed controls and identities

The run used repository commit `f24b5f3`, stock Zed
`1.11.3+stable.326.952d712dac48a4af2c54fb22c82d82a9d69b72d4`,
official Java 6.8.21, Spring Tools `5.2.0.RELEASE`, and Temurin
`25.0.3+9-LTS`. The official Java WASM SHA-256 was
`62dbf7edbe1ef4066f74e588dcec68d223ab7984f1861b59e44db0b10f52e3fd`;
the pinned Spring VSIX SHA-256 was
`70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3`.
The development extension was installed before opening Java. The fixture lived
outside this repository at `/tmp/zed-spring-s015-document-symbols-20260718`, so
Zed did not classify it through this repository's ignored `tmp/` rule.

With `document_symbols` omitted, opening Outline rendered the tree-sitter Java
class and method and issued zero outgoing `textDocument/documentSymbol`
requests. Restoring the setting explicitly to `off` after the experiment again
rendered those two tree-sitter entries; the outgoing request count remained
nine before and after that final Outline invocation.

### Working on-state before restart

Changing the setting to `on` after JDT and Spring were both ready caused Zed to
issue one request to each server. The attributable responses for
`GreetingController.java` contained:

- JDT: package `dev.zed.spring.fixture`, type `GreetingController`, and child
  method `greeting()`;
- Spring: component
  `@+ 'greetingController' (@RestController <: @Controller, @Component)` and
  child endpoint `@/greeting -- GET`.

The rendered order was package, Java type, Spring component, Java method, and
Spring endpoint. `GreetingConfiguration.java` likewise rendered package, Java
type, Spring configuration, Java method, and Spring bean. The method and bean
were visibly nested. There were no exact duplicate labels. Long Spring labels
were truncated to the available picker width, but remained searchable.

Selecting the Spring component, endpoint, and bean landed at the response
ranges shown by Zed as 13:14, 15:5, and 15:5 respectively. The protocol also
returned the expected JDT method selection range. The breadcrumb retained the
ordinary Java source scope at overlapping Spring/Java ranges; no distinct
Spring breadcrumb label was observed.

An external saved edit changed `@Bean` to `@Bean("renamedGreeting")` and
`greetingPrefix()` to `welcomePrefix()`. Zed sent the edit to both servers,
Spring emitted `spring/index/updated`, and Zed re-requested both results. The
rendered Outline replaced both old labels with the new labels. The source was
then restored byte-for-byte outside `target/`.

### Decisive restart failure

After restarting Zed with `document_symbols` still `on`, the open buffer raced
JDT's dynamic Document Symbols registration:

1. Spring advertised `documentSymbolProvider` in its initialize result.
2. Zed requested Spring Document Symbols and cached the two Spring entries.
3. JDT registered `textDocument/documentSymbol` later.
4. Waiting for Java import, Spring indexing, and bridge registration and then
   reopening Outline issued no JDT request. Closing and reopening the buffer tab
   also retained the Spring-only result.

The post-restart Outline therefore omitted the Java package, type, and method.
A later source edit caused Zed to request both servers and receive both current
responses, but the already-open Outline did not refresh its visible list until
it was closed and reopened. This workaround does not satisfy the restart
criterion: baseline Java symbols are absent until another document change
forces a new collection.

### Evidence and redaction

Ignored evidence is retained under
`tmp/s015-document-symbols-20260718/evidence/`. The relevant files are:

- `control-off-outline.png` and `restored-off-outline.png` for the two
  tree-sitter controls;
- `on-merged-outline.png`, `on-bean-merged-outline.png`, and the three
  `on-*-navigation.png` files for the working merged state;
- `on-refreshed-outline.png` for edit refresh;
- `on-restart-outline.png` and
  `on-restart-buffer-reopen-outline.png` for the Spring-only restart result;
- `on-restart-after-edit-reopen-outline.png` for the conditional recovery; and
- `s015-document-symbols-redacted.log`, SHA-256
  `f53e93f8c295af8db630392fea82acf05e26eb4dacb967f9d8d19dcf251f1bb1`.

The retained log has 65 allowlisted lifecycle, registration, edit, request, and
response lines. It contains nine outgoing Document Symbols requests and zero
credential-shaped values, JAR paths, or classpath payloads. The raw 1,432-line
trace copy was removed after this audit. All isolated Zed, coordinator, proxy,
JDT, and Spring processes were absent before the normal application state was
restored.

## Result

**Refuted on macOS arm64/JDK 25.** Authentic JDT/Spring results merge into a
clear, nested, navigable Outline once both servers are already registered, and
saved edits refresh both results. The required restart condition fails: Spring
answers before JDT's later dynamic registration, Zed does not recollect after
that registration, and baseline Java symbols disappear from the cached Outline.

The preferred per-file LSP Outline route is not promoted. The capability remains
`zed-native-equivalent` through the already verified Project Symbols fallback.
No Java language, grammar, query, official extension, or Zed binary was changed.

## Remaining uncertainty

- Behavior on files with much larger Spring and Java symbol sets.
- Multi-root worktrees and files served by additional Java language servers.
- Every untested platform and JDK tuple.
- Whether a future Zed API can select only Spring or only JDT Document Symbols.
- Whether a stock-Zed change that recollects Document Symbols after a server
  dynamically registers the capability can make the combined route restart-safe.
- Ordinary Java method selection was present in the JDT response, but the
  separate UI navigation capture selected an overlapping Spring/type result;
  this is not needed to reverse the decisive restart failure.

## Next experiment

Keep Project Symbols as the per-capability fallback and proceed with S016, the
next ordered runtime gate. The later structure slice should prototype the
opt-in Spring Structure document selected by D005. A separately scoped upstream
Zed experiment may test refresh after dynamic Document Symbols registration;
do not jump directly to Java outline replacement.

## Reusable findings

Future repetitions must preserve the off/on comparison, authentic per-server
payload shape, rendered hierarchy assessment, and the restart ordering between
Spring's initialize-time provider and JDT's later dynamic registration. Testing
only after both servers are ready misses the failure.
