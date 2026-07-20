# S017: Static semantic-token declaration through the coordinator

- Status: Proposed
- Date: 2026-07-21
- Related research: [R013](../research/013-zed-native-capability-delivery-surfaces.md),
  [capability inventory](../capability-inventory.md) rows *Embedded language
  syntax highlighting*, *SpEL language intelligence*, *Spring Data query
  intelligence*, and *Code actions / quick fixes*

## Hypothesis

Zed 1.11.3 will issue `textDocument/semanticTokens/full` when the server declares
`semanticTokensProvider` in its `initialize` **result**, even though it issues
nothing when the same provider arrives later through `client/registerCapability`.

If supported, the coordinator can deliver Spring's embedded SpEL/JPQL/HQL and
cron token highlighting by declaring the provider up front with Spring's legend
and relaying the requests, without replacing Zed's Java language registration.

## Why runtime verification is required

The 2026-07-21 WS2 run established only half the picture. Zed advertises
`semanticTokens` in `initialize` with `requests.full.delta`, the full
25-type/11-modifier legend, `dynamicRegistration: true`, and
`augmentsSyntaxTokens: true` — a complete client capability — yet requested
nothing after Spring registered the provider dynamically and even after Spring
sent `workspace/semanticTokens/refresh`. Source inspection cannot settle whether
that is a dynamic-registration handling gap (recoverable) or an unimplemented
renderer (not recoverable), and the two have opposite consequences for the row.

The precedent that motivates this spike is in this repository. For Code Actions,
Zed 1.11.3 *replaced* rather than extended the statically declared
`executeCommandProvider` list when Spring dynamically registered its internal
`sts4.classpath.<letters>` command, so Spring's quick fixes were filtered out of
the menu as unavailable commands. The coordinator fixed it by consuming the
dynamic registration and preserving the static declaration. That is the same
shape of bug and the same shape of fix.

## Environment

- macOS 26.5.x arm64, Zed 1.11.3 (unmodified)
- Official Java extension 6.8.23, Temurin JDK 25.0.3
- Spring Tools 5.2.0 / `vscode-spring-boot` 2.2.0
- Fixture: `tests/fixtures/spring-boot-basic`, which already carries the needed
  embedded-language targets — `GreetingRepository`'s JPQL text block with `?1`,
  `GreetingSchedule`'s valid cron, `CronSyntaxSample`'s invalid cron
- Run mechanics per the `zed-driven-run-mechanics` notes: **short run path**
  (a long one panics `java-lsp-proxy` at `proxy/src/main.rs:93` with
  `File name too long` and jdtls never starts), and a warm profile that actually
  contains jdtls — `tmp/s016-run-20260719/profile` does, `tmp/ws1-close-20260720`
  does not

## Procedure

1. Branch from an updated `main` (after PR #36 merges).
2. Capture Spring's semantic-token legend from the existing evidence at
   `tmp/ws2-language-intelligence-20260721/evidence/trace-baseline.log`
   (`client/registerCapability` → `registrations[].registerOptions.legend`).
   Prefer learning it at runtime over hardcoding if that is cheap; if hardcoded,
   pin it beside the artifact version so a Spring upgrade cannot silently skew
   the token mapping.
3. In the coordinator's `initialize` result rewriting — the same place as
   `addCoordinatorCommands`, `coordinator/src/main.mjs` — add
   `semanticTokensProvider` with that legend and `full: true`. Send
   `boot-java.embedded-syntax-highlighting: true`; it reads false when absent
   (`isJavaEmbeddedLanguagesSyntaxHighlighting()` is `isEnabled != null &&
   isEnabled.booleanValue()`) while VS Code's schema defaults it true, so it is
   the same trap documented in the `spring-settings-parity-audit` notes.
4. Consume Spring's later `client/registerCapability` for
   `textDocument/semanticTokens` so Zed never sees the dynamic registration,
   mirroring the Code Action fix.
5. Relay `textDocument/semanticTokens/full` (and `/delta` if Zed sends it) to
   Spring, and forward `workspace/semanticTokens/refresh` unchanged.
6. Add contract tests for the declaration, the consumed registration, and the
   relay before running Zed.
7. Drive: open `GreetingRepository.java`, and capture the LSP trace.

## Success criteria

- Zed issues at least one `textDocument/semanticTokens/full` for a Java buffer,
  and the coordinator relays a non-empty token response from Spring; **and**
- a screenshot shows the JPQL inside the `@Query` text block coloured
  differently from surrounding string content, with ordinary Java highlighting
  intact elsewhere in the file.

Both are required. The request alone proves only the protocol path.

## Failure criteria

- No `textDocument/semanticTokens/*` request after static declaration →
  hypothesis **Refuted**; promote the inventory row to `blocked-zed-api` naming
  the renderer, not the registration, as the missing surface.
- Requests arrive but nothing renders → **Refuted** for the user outcome; record
  it distinctly from the above, because the missing surface differs.
- Requests arrive and render, but ordinary Java highlighting regresses anywhere
  → **Inconclusive**, and stop: D005 forbids risking the Java registration for
  this enhancement, and `augmentsSyntaxTokens: true` is supposed to prevent it.

## Observations

Not yet executed.

## Result

Not yet executed.

## Remaining uncertainty

- Whether jdtls also registers semantic tokens and how Zed composes or arbitrates
  two providers for one buffer. Spring's tokens cover only embedded regions, so a
  client that treats one provider's response as the authoritative whole-file token
  set could *lose* highlighting rather than add it. Check the trace for a jdtls
  registration before drawing conclusions from any regression.
- Whether `delta` requests follow, and whether the coordinator must track result
  ids to answer them.
- Whether the same route helps any other dynamically registered capability that
  currently looks dead in Zed.

## Next experiment

If Refuted, the remaining candidate is the opt-in tree-sitter Java query pack
with an injection grammar, which bypasses LSP entirely. That is not a follow-on
to this spike: D005 excludes it from the baseline and it needs its own direction
decision, because it means owning a Java language registration.
