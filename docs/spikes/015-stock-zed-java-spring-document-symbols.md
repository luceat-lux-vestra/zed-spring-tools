# S015: Stock-Zed Java and Spring Document Symbols

- Status: Proposed
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

- macOS 26.5.1 arm64
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

Not run.

## Result

Pending. This plan changes no capability state.

## Remaining uncertainty

- Behavior on files with much larger Spring and Java symbol sets.
- Multi-root worktrees and files served by additional Java language servers.
- Every untested platform and JDK tuple.
- Whether a future Zed API can select only Spring or only JDT Document Symbols.

## Next experiment

If Supported, use the official setting as the preferred per-file route and keep
Project Symbols as fallback. If Refuted by merge quality, plan the opt-in Spring
Structure document. Do not jump directly to Java outline replacement.

## Reusable findings

The run must preserve the off/on comparison, authentic per-server payload shape,
and rendered hierarchy assessment so future Zed releases can repeat the same
compatibility gate.
