# S018: References and document highlights under two-server composition

- Status: Mixed — `textDocument/references` Supported (U3 + U4; Zed composes
  both servers); `textDocument/documentHighlight` Refuted (Zed queries one
  server)
- Date: 2026-07-22 (U4 follow-up; U3 ran 2026-07-21)
- Related: [capability-delivery-plan](../capability-delivery-plan.md) row
  *Bean and endpoint navigation* / references; [S017](017-static-semantic-token-declaration.md)
  (the neighbouring composition question for semantic tokens);
  `ws2-language-intelligence` memory

## Hypothesis

For a Java buffer, both the Spring-fronting coordinator and jdtls statically
advertise `referencesProvider` and `documentHighlightProvider`. If Zed fans these
requests to **both** servers and unions the results — the behaviour already
observed for completion in the WS2 run — then Spring's Spring-semantic references
(a `@Qualifier` string resolving to its `@Bean`, which jdtls cannot link) surface
alongside jdtls's Java references with **no coordinator merge code**, and the
implementation row is the small "add fixture targets and verify" branch. If Zed
instead uses a single primary server, Spring's contribution is invisible and the
row stays `planned`, because the coordinator fronts only Spring and cannot reach
jdtls to merge.

## Why runtime verification is required

Encouraging prior evidence (completion composes cleanly across both servers) is a
**different protocol**. Source inspection cannot tell whether Zed treats
references/highlights as aggregate-across-servers or single-primary requests, and
the two have opposite consequences for the row. This is a synthetic spike: no
product code changes — drive the existing fixture and read the trace.

## Environment

- macOS 26.5.x arm64, Zed 1.11.3 (unmodified); U3 used official Java
  extension 6.8.23 and U4 used 6.8.21, both with Temurin JDK 25.x and Spring
  Tools 5.2.0 / `vscode-spring-boot` 2.2.0
- Reused the live warm run dir from S017, `/private/tmp/zst-s017/` (short path;
  jdtls full stack present), fixture `dev/zed/spring/fixture` — `GreetingService`
  interface + `DefaultGreetingService` impl, `GreetingConfiguration.greetingPrefix()`
  `@Bean`, `GreetingInjection`'s `@Qualifier("greetingPrefix")` and
  `@Value("${fixture.greeting.salutation}")`
- **Launch trap hit and recorded:** opening the *file* alone made the coordinator
  die at startup with `zed-spring-tools coordinator failed: worktree is not an
  absolute directory`. The coordinator needs a project root; relaunching with the
  **worktree directory** as the argument (`cli … $R/worktree <file>`) fixed it.
  With only the file open, jdtls also reported the buffer as a "non-project file"
  (syntax-only); opening the worktree root cleared that too.
- Keymap already binds `cmd-shift-alt-r` → `editor::FindAllReferences`
  (inherited from the 2026-07-18 refs-impl work); document highlights fire
  automatically on caret rest.

## Attribution method

Zed's `TRACE [lsp]` lines do **not** name the target server, and the two
connections reuse the same request ids (each starts its own counter at 0), so id
numbers alone are ambiguous. Two reliable signals were used instead:

1. **Fan-out count per gesture** — slice the log by byte offset around one
   gesture and count outgoing `textDocument/<method>` lines. One line = single
   server; two = both.
2. **Response content** — a reference only Spring can produce (a `@Qualifier`
   string → its `@Bean`) attributes that response to the coordinator; a Java
   symbol occurrence or an empty result inside a string literal attributes it to
   jdtls. (JSON key order — `{"jsonrpc",…,"id"}` vs `{"id",…}` — correlated with
   the split on responses but was **not** reliable on the `initialize` messages,
   so it is a hint, not the basis.)

## Observations

Static declaration confirmed: both servers' `initialize` results carry
`referencesProvider: true` and `documentHighlightProvider: true`; there is no
`client/registerCapability` for either. This is **not** the S017 dynamic-
registration situation.

**References — composed across both servers.** Find-all-references inside
`@Qualifier("greetingPrefix")` produced **two** outgoing `textDocument/references`
(ids 16 and 31) at the same position, both answered:
- coordinator/Spring (id 16): two items — `GreetingConfiguration`'s `@Bean` and
  the `@Qualifier` usage. jdtls cannot link a string literal to a `@Bean` method,
  so this is Spring-semantic.
- jdtls (id 31): one item — the enclosing Java symbol.

The resulting Zed multibuffer, titled "References to @Bean, Gre…", listed
**both** files together, including the `@Bean` line that only Spring returned
(screenshot `refs-qualifier-crop.png`). A control gesture on the plain
`greetingPrefix()` declaration returned the same single declaration item from
each server. → Zed **unions** both servers' reference results.

**Document highlights — single server only.** Resting the caret on the `prefix`
field produced **one** outgoing `documentHighlight` per gesture (three nudges →
ids 37/39/41, three responses), each three Java field occurrences — jdtls. The
decisive control: caret inside `@Value("${fixture.greeting.salutation}")` again
produced **one** outgoing per gesture (ids 43/45/47), every response
`"result":[]` (jdtls returns nothing inside a string). Had Zed fanned to both,
each gesture would have shown two outgoing requests and Spring could have
highlighted the placeholder. It did not: Spring is **never queried** for
`documentHighlight`. (An `id=2`-to-both request appears only at buffer open,
before Zed settles on the buffer's primary server; steady-state interactive
highlighting is single-server.)

## Result

**Split, and the split decides the row.**

- **References (and by the same aggregation, implementation): Supported.** Zed
  fans the request to both servers and unions the results in one multibuffer.
  Spring's semantic references appear with no coordinator merge code. This is the
  favourable branch: the references/implementation capability can be delivered by
  **adding Spring-attributable targets to the fixture and verifying**, not by
  building multi-server composition in the coordinator. U4 then confirmed the
  qualifier, property, and distinct Jakarta `@Named` targets.
- **Document highlights: Refuted for Spring-specific highlights.** Zed routes
  `documentHighlight` to the buffer's single primary server (jdtls) despite the
  coordinator advertising the provider. Spring's highlights cannot surface — the
  same *class* of missing surface as S017's semantic tokens (Zed never asks the
  secondary server), reached by a different route. The row stays `planned` /
  effectively `blocked-zed-api` for the Spring-specific slice; ordinary jdtls
  highlighting is unaffected. Do **not** build coordinator highlight code.

No product code was written or changed. Evidence:
`tmp/u3-refs-highlights-20260721/evidence/` (per-gesture marks, `trace-u3-run.log`,
`refs-qualifier.png` / `-crop.png`).

## U4 follow-up — Spring-attributable references

The existing fixture contained the qualifier and property targets, but those do
not exercise Spring Tools' distinct `NamedReferencesProvider`. For U4 only, the
disposable worktree added the managed `jakarta.inject-api` 2.0.1 dependency,
an `@Named("namedGreeting")` bean, and a constructor injection point carrying
the same `@Named` value. The repository fixture and product dependencies were
not changed. `mvn test -f /private/tmp/zst-s017/worktree/pom.xml` passed before
the driven run.

A driven run on macOS arm64/JDK 25 with Zed 1.11.3, official Java 6.8.21, and
Spring Tools 5.2.0 exercised three source positions.

Each gesture sent two `textDocument/references` requests. The Spring response
for the qualifier contained `GreetingConfiguration.greetingPrefix()` and the
qualifier use; the Spring response for the property value contained
`application.properties` and the annotation use. The jdtls responses contained
only Java-local occurrences. At the `@Named` injection value, the two outgoing
requests returned different attributable sets: Spring returned the
`NamedGreeting` declaration value and `NamedGreetingInjection` injection value,
while jdtls returned only the Java type occurrence. Zed then opened
`NamedGreeting.java` from the composed result. The three distinct Spring
providers therefore reached Zed's References UI without coordinator merge code.

Evidence: `tmp/u4-refs-20260722/evidence/U4-RESULT.md` and
`trace-named-reference.log` in the same local evidence directory.

U4 closes the references half of the spike. The inventory can promote Spring-
specific references independently of document highlights.

## Remaining uncertainty

- Whether Zed **dedupes** overlapping ranges when the two servers return the same
  location (here their reference sets were disjoint, so it was not exercised).
- Whether `textDocument/implementation` composes identically to `references`;
  the trace shows it is advertised by both, and it aggregated in the 2026-07-18
  refs-impl run, but it was not re-driven here.
- Whether a future Zed extends the aggregate path to `documentHighlight`. If it
  does, the Spring slice reopens with no new coordinator work.
- Spring's profile and application-event reference providers use the same
  verified aggregate route, but their provider-specific result content was not
  driven in U4.

No further U4 experiment is required. A future run may re-drive
`textDocument/implementation` on the same tuple to strengthen the existing
implementation-composition observation, but it is not needed for the
references result above.
