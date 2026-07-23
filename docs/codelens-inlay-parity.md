# CodeLens & Inlay Hint parity worksheet

Working document for the CodeLens / Inlay Hint parity pass. It pulls the two
surfaces out of the full [capability inventory](capability-inventory.md) so the
upcoming slice has a single sheet that lists every upstream feature, how we
deliver (or plan to deliver) it in Zed, and the current evidence state.

- Derived from: Spring Tools `5.2.0.RELEASE` / `vscode-spring-boot` `2.2.0`
- Sibling docs: [CodeLens showcase](code-lens-showcase.md) (per-case manual
  verification), [capability inventory](capability-inventory.md) (all surfaces),
  [R011](research/011-vscode-spring-tools-capability-surface.md),
  [R017](research/017-zed-codelens-hover-command-compatibility.md),
  [R018](research/018-spring-tools-zed-outcome-parity-audit.md),
  [R019](research/019-zed-codelens-agent-navigation-and-build-output.md)
- Status vocabulary is the inventory's: `planned`, `implemented`,
  `zed-native-equivalent`, `blocked-zed-api`, `blocked-upstream`, `verified`.

Goal: match VS Code Spring Tools outcome-for-outcome on both surfaces. A
capability is named by the developer outcome, not by the VS Code widget, so a
different Zed-native workflow that delivers the same outcome counts as parity.

---

## 1. CodeLens

Upstream, CodeLens comes from three independent sources: the official Java/JDT
server, five static Spring Tools providers, and Spring's running-application
`sts/highlight` stream (`HighlightCodeLensProvider`). The coordinator preserves
advertised server commands, translates valid navigation targets to Zed's
`editor.action.goToLocations`, and keeps informational / AI-only titles behind
one explanatory command. Full per-case steps live in the
[CodeLens showcase](code-lens-showcase.md); this table is the parity summary.

| # | Feature | Summary | Upstream provider | Delivery approach (Zed) | Status |
| --- | --- | --- | --- | --- | --- |
| CL-1 | References / implementations lens | Reference & implementation counts above types/methods | Official Java / JDT | Native lens + navigation; coordinator does **not** interpose | `verified` |
| CL-2 | WebFlux functional-handler summary | HTTP method/path summary above a functional handler | `WebfluxHandlerCodeLensProvider` | Keep as informational lens; click explains the title *is* the value | `verified` |
| CL-3 | Web-config path-prefix link | `Web Config - Path Prefix: /api` above a class | `WebConfigCodeLensProvider` | Translate `vscode.open` → `editor.action.goToLocations` | `verified` |
| CL-4 | Data AOT metadata lenses (a–e) | Show/generate AOT impl, generated query text, `Turn into @Query`, Go To Implementation, Refresh | `DataRepositoryAotMetadataCodeLensProvider` | Preserve the refactoring command; pre-resolve authentic `CL-4d` target and rewrite to Zed navigation; answer the build command with a reviewable `.zed/tasks.json` entry rather than Spring's in-process build | `verified`; the build-task route is `implemented` |
| CL-5 | AI explanation lenses (SpEL / Query / AOP) | `Explain … with AI` above `@Value` SpEL, `@Query`, `@Pointcut`/`@Before` | `CopilotCodeLensProvider` | Provider enabled regardless of Zed AI state; command intercepted with API-boundary/manual notice; **nothing sent to AI** | `implemented` (lens+notice observed; direct Agent dispatch blocked by Zed API) |
| CL-6 | Router-builder conversion lens | `Convert to Router Builder Pattern with AI` above a functional router | `RouterFunctionCodeLensProvider` | Provider enabled; explain that upstream offers only an AI prompt (no deterministic edit); source unchanged | `verified` |
| CL-7 | Live-data highlight lenses (a–c) | Bean/injection relationships, endpoint URL + request count/timing, live `${...}` values | versioned `sts/highlight` + `ValueHoverProvider` | Merge into standard CodeLens with refresh + stale-version rejection; commandless ranges → `use Hover`; value stays in native Hover | `verified` |

Notes:
- CL-5 direct Agent invocation and arbitrary build-output ranking are Zed API /
  user-policy boundaries, tracked in the inventory as
  `Explain SpEL / queries / AOP (AI assistant)` — not incomplete CodeLens work.
- `HighlightCodeLensProvider` is the only CodeLens provider that lives in the VS
  Code client (`extension.js`); the other four are server-side.

---

## 2. Inlay hints

Upstream declares `inlayHintProvider` on the server, and the language-server jar
ships **exactly three** inlay features (enumerated by their provider classes, not by
settings — see §5): `CronExpressionsInlayHintsProvider` (IH-1),
`JdtDataQueriesInlayHintsProvider` (IH-2, JPA query positional parameters), and
`PomInlayHintHandler` (IH-3, Maven `pom.xml`). The Java pair (IH-1/IH-2) is the two
implementors of `JdtInlayHintsProvider` the server injects; IH-3 is a separate
`pom.xml` handler. Each is gated by a server-side default the Zed extension must
satisfy explicitly.

| # | Feature | Summary | Upstream source | Delivery approach (Zed) | Status |
| --- | --- | --- | --- | --- | --- |
| IH-1 | Cron description hint | Human-readable description next to `@Scheduled(cron = "…")` (e.g. `every hour`) | Server inlay provider, `boot-java.cron.inlay-hints` | Coordinator relays `textDocument/inlayHint`; owns pre-warm + refresh + stale-empty protection (incl. carry-forward across edits) over the Spring LSP connection | `verified` (see §3 — cause 1 fixed + driven-regressed 2026-07-19) |
| IH-2 | Embedded query hints | Inlay hint on a JPQL/HQL **positional** parameter (`?1`) showing the mapped method parameter's name (`InlayHintKind.Parameter`) | `JdtDataQueriesInlayHintsProvider` (server) | Enable `boot-java.jpql` in `spring_workspace_configuration` (server default is off) so query intelligence runs; coordinator then relays `textDocument/inlayHint` as for IH-1 | `verified` (2026-07-19 — `?1` → `message` rendered after the jpql fix; see §5) |
| IH-3 | Maven pom hints | Actionable inlay hints in `pom.xml`: "Add Spring Boot Starters" near `<dependencies>`, "Upgrade to the Latest Patch" near the Boot `<parent>` version | `PomInlayHintHandler` (server, lemminx DOM) | Register the server for the `XML` language in `extension.toml` so Zed routes `pom.xml` to it; needs a user-installed XML extension (Zed has no built-in XML), the same way Java support needs the Java extension | `verified` (2026-07-19 — "Upgrade to the Latest Patch" observed next to the Boot parent `</version>` in a real Zed with an XML extension; see §5) |

---

## 3. Inlay-hint flakiness — investigation (IH-1)

The user reports the cron hint appears and disappears ("됐다가 안됐다가"),
despite the inventory marking IH-1 `verified` on 2026-07-19. The
[capability inventory row](capability-inventory.md) documents an earlier
appear/disappear race and its fix. This section records what the current code
actually does so the recurrence can be reproduced and closed, not re-guessed.

### How the current coordinator handles inlay hints
(`coordinator/src/main.mjs`)

1. Zed's `textDocument/inlayHint` is recorded per-request (`inlayHintRequests`)
   and its params cached in a bounded (`INLAY_PREWARM_LIMIT = 8`) recent-visible
   map (`inlayHintParams`).
2. On the Spring response: a **non-empty** result is cached by `uri`+`version`
   (`#cacheInlayHints`); an **empty** result is replaced with the cached
   non-empty hints for the same range/version (`#cachedInlayHints`). This is the
   "a transient empty response cannot replace a non-empty result" protection.
3. On `spring/index/updated` with a non-empty `affectedProjects`, a 2s-debounced
   (`INLAY_REFRESH_DELAY_MS`) pre-warm re-requests each still-current visible
   document, caches non-empty results, then sends `workspace/inlayHint/refresh`.
4. On `didOpen`/`didChange` with a **new document version**, the cache was dropped
   (`this.inlayHints.delete(uri)` in `#observeDocumentVersion`). **Fixed** — see
   "Cause 1 fix" below; the version bump now carries the last non-empty hints
   forward as a stale fallback instead of deleting them.

### Suspected recurrence causes (ranked, from code — not yet driven)

1. **[CONFIRMED at code level, fixed] Cache was cleared on every version bump, and
   only rebuilt on the next `spring/index/updated` + 2s debounce.** After any edit
   — even on an unrelated line — the stale-empty protection was disabled by design
   (step 4). If Spring returns empty while re-indexing, Zed shows nothing until the
   debounced pre-warm completes, so the cron hint blinks out for ≥2s per edit.
   Strongest match for "됐다가 안됐다가" while typing. The existence of the pre-warm
   path (step 3), which only re-caches non-empty results, is itself evidence that
   Spring returns empty inlay responses transiently during re-indexing — the exact
   precondition for this blink. Driven confirmation is deferred to regression
   validation of the fix (per the session decision to confirm at code level first).

### Cause 1 fix (`coordinator/src/main.mjs`)

- On a version bump, `#observeDocumentVersion` now calls `#carryInlayHintsForward`
  instead of `this.inlayHints.delete(uri)`. The last non-empty hints are retained
  under the **new** version and marked `stale: true`, so a transient empty response
  during re-indexing keeps masking the blank (no blink) rather than clearing it.
- The first authoritative Spring response resolves the stale state: a non-empty
  response replaces it via `#cacheInlayHints` (the stale entry is not accumulated
  across ranges), and an **empty pre-warm** — which fires only after a completed
  index update, so it is authoritative — drops the carry-over via
  `#dropStaleInlayHints`, letting a genuinely removed hint disappear.
- Trade-off (documented, intended): between the edit and the first authoritative
  response, the retained hint positions are those of the prior version, so on an
  edit that shifts lines the cron hint can sit ≤2s at a slightly stale position
  before the refresh corrects it — strictly better than a blank window.
2. **Bursty index updates starve the refresh timer.** Every
   `spring/index/updated` does `clearTimeout` + reschedule
   (`#scheduleZedInlayHintsRefresh`). A run of updates <2s apart keeps pushing
   the timer out, so the refresh (and the hint) is delayed during heavy
   indexing.
3. **No refresh path when `affectedProjects` is empty/absent.** Any Spring event
   that leaves the hint empty but does not carry a non-empty `affectedProjects`
   has no recovery except Zed spontaneously re-requesting.
4. **Environmental: fixture under an ignored path.** Zed's `is_lsp_relevant`
   drops ignored worktree entries before collecting inlay ranges, so a fixture
   under `tmp/` or an ignored `target/` gets no inlay requests at all. This was
   the exact cause of the earlier false "zero requests" verdict. Confirm the
   test fixture is the committed
   `tests/fixtures/spring-boot-basic/.../GreetingSchedule.java`, not a copy under
   an ignored directory.

### Driven re-verification (2026-07-19, fix live)

Isolated Zed (warm profile, `inlay_hints` on) on the committed cron fixture, with
the fix compiled into `extension.wasm` (materialized coordinator confirmed to carry
`#carryInlayHintsForward`). Evidence in `tmp/ih1-driven-20260719/evidence/`.

- **Inlay requests fire, hint is non-empty (closes the old "zero requests" doubt).**
  Zed issued `textDocument/inlayHint` on the Java buffer (ids 5/6/7). The cron hint
  arrived as `{"position":{"line":15,"character":36},"label":"every hour",...}` over
  the coordinator connection. Cold start even reproduced the early-empty→hint order
  (id 5 `[]`, then id 6/7 the hint), exercising the existing pre-warm machinery.
- **Two LSP servers share the buffer.** jdtls and the coordinator both advertise
  `inlayHintProvider`; they are told apart in the trace by JSON key order
  (`{"id":N,"jsonrpc":…}` = jdtls, `{"jsonrpc":"2.0","id":N,…}` = coordinator). The
  cron hint is always the coordinator's; jdtls returns `[]` for this fixture.
- **A comment-only edit does *not* trigger the Spring inlay path.** After a keystroke
  in a comment (version bump), Zed re-requested inlay only from jdtls (→`[]`); no
  `spring/index/updated`, no `workspace/inlayHint/refresh`, and no coordinator
  re-request. The on-screen cron hint stayed put because Zed was never told to drop
  it. So the blink is not driven by an arbitrary keystroke — it needs a Spring
  re-index.
- **The re-index → refresh lifecycle runs correctly on save.** A save produced, in
  order: `didSave` (14:18:08) → `spring/index/updated` (14:18:08) → *2s later*
  `workspace/inlayHint/refresh` (14:18:10, matching `INLAY_REFRESH_DELAY_MS`) →
  Zed's inlay re-request (id 12) → coordinator response `"every hour"`. Throughout
  the edit→refresh gap the hint remained visible (the carried-forward stale value),
  and the authoritative post-index response reconfirmed it. No blank window.

What the driven run did **not** hit: a *transient empty* Spring response inside the
re-index window being masked by the carry-over — this small fixture re-indexes fast
enough that the pre-warm read `every hour` directly. That exact masking, and the
authoritative-empty clear when a hint is genuinely removed, are covered
deterministically by the two regression tests below. Net: runtime confirms the
lifecycle and no regression; the unit tests pin the transient-empty edge.

Still open (not blockers for the cron fix): the IH-2 embedded-query fixture, and a
cross-check of the generic Zed dynamic-registration inlay issue (not a blocker here
because the coordinator owns the Spring refresh lifecycle).

Contract tests already covering this path (`coordinator/test/coordinator.test.mjs`):
`a completed Spring index update refreshes Zed inlay hints`,
`an early empty inlay response is pre-warmed after indexing before Zed refreshes`,
`a transient empty inlay response cannot replace a non-empty result for the same document`.
The Cause 1 fix adds two regression tests on the same path:
`the last non-empty inlay hints survive a document edit while Spring re-indexes`
(no blink across a version bump) and
`an authoritative empty pre-warm clears carried-over inlay hints once the hint is removed`
(a genuinely removed hint is not masked forever). All 44 coordinator tests pass as
of this branch. The remaining gap is runtime behaviour under active editing, which
these unit tests do not exercise — deferred to the driven regression run below.

---

## 4. Next steps

1. ~~Reproduce IH-1 recurrence with a driven run per §3 and confirm the dominant
   cause.~~ Cause 1 confirmed at code level (session decision); driven run is now a
   regression validation of the fix rather than a diagnosis.
2. ~~If cause 1 confirmed, change the version-bump handling to retain the last
   non-empty hints until the first fresh response, and add a regression test.~~
   Done — carry-forward + authoritative-clear, two regression tests (see §3).
   Driven regression run completed 2026-07-19 (see §3 "Driven re-verification"):
   inlay requests fire, cron hint is non-empty, and the save-triggered
   re-index → 2s refresh → re-request → `every hour` lifecycle runs with no blank
   window on the fixed coordinator. Cause 1 is closed; the transient-empty edge is
   pinned by unit tests rather than the (fast-re-indexing) fixture.
3. IH-2 (JPA query inlay) **done + driven-verified**: the server's `boot-java.jpql`
   support defaults **off**, so `spring_workspace_configuration` (`src/lib.rs`) now
   sends `jpql: true`; the positional `?1` then renders its parameter name (see §5).
4. IH-3 (Maven pom inlay) **implemented**: `extension.toml` registers the server for
   the `XML` language; end-to-end verification is pending a real Zed with an XML
   extension (see §5).
5. Fold any state change back into [capability inventory](capability-inventory.md)
   in the same slice, and update the [CodeLens showcase](code-lens-showcase.md)
   if CL-5 gains a real Agent route.

---

## 5. The full inlay surface — enumeration, the IH-2 fix, and IH-3 (2026-07-19)

> Method note: enumerate inlay features by the server's **provider classes**, not by
> `package.json` settings. An earlier pass in this slice wrongly called IH-2
> `blocked-upstream` because only `boot-java.cron.inlay-hints` appears in settings.
> Decompiling `spring-boot-language-server-*-exec.jar` disproved it — a provider can
> ship with no user setting.

### The three inlay features (exhaustive)

`JdtInlayHintsHandler` injects a `Collection<JdtInlayHintsProvider>`; the jar has
**exactly two** implementors, plus one separate `pom.xml` handler:

| Provider | Feature | Server-side gate |
| --- | --- | --- |
| `cron.CronExpressionsInlayHintsProvider` | IH-1 cron description | `BootJavaConfig.isCronInlayHintsEnabled()` — **defaults on** |
| `data.jpa.queries.JdtDataQueriesInlayHintsProvider` | IH-2 query positional param | `JpqlSupportState.isEnabled()` ← `isJpqlEnabled()` — **defaults off** |
| `maven.PomInlayHintHandler` (impl. commons `InlayHintHandler`) | IH-3 pom.xml actions | attached only when the server sees `pom.xml` |

### IH-2 — root cause and fix (driven-verified)

The IH-2 provider's exact trigger (bytecode + upstream source): a query token of type
`parameter` immediately preceded by an `operator` token whose text is `?` — i.e. a
positional `?1`. It reads the ordinal, maps it to the *n*-th method parameter, and emits
an `InlayHintKind.Parameter` hint labelled with that parameter's name. Named parameters
(`:message`) never trigger it, which is why the first fixture showed nothing.

The reason it stayed empty even with `?1` was **not** the tokenizer (both the JPQL and
HQL semantic tokenizers split `?1` into `?`=operator + `1`=parameter) and **not** the
classpath (`spring-data-commons` resolved, `@Query` recognised, the broken-query probe
even produced an `HQL_SYNTAX` diagnostic). It was the **gate**:
`BootJavaConfig.isJpqlEnabled()` returns `false` when `boot-java.jpql` is absent (the
cron equivalent returns `true`), so `JpqlSupportState` stayed disabled and the query
**semantic tokens the inlay depends on were never computed** — while the query
diagnostics, which run on a different reconciler path, still fired and masked the cause.

Fix: `spring_workspace_configuration` (`src/lib.rs`) now sends `"jpql": true`, the same
"supply the VS Code default explicitly" pattern already used for the codelens providers.
Driven-verified on the committed positional-`?1` text-block fixture — the coordinator
returned `{"position":{…},"label":"message","kind":2}` on the `?1`
(`tmp/ih2-driven-20260719/evidence/JPQL-FIX-FINDING.txt`).

The rest of what that one flag unlocks is now verified too, on 2026-07-24: query
diagnostics for `@Query`, native queries and `EntityManager.createQuery`, and Go to
Definition from a query parameter — including the named `:message` shape, which has
navigation even though it never gets an inlay hint. See the *Spring Data query
intelligence* row in the [capability inventory](capability-inventory.md).

### IH-3 — pom.xml (implemented; verify in a real Zed)

`PomInlayHintHandler` parses `pom.xml` with the bundled lemminx DOM and emits "Add
Spring Boot Starters" (near `<dependencies>`) and "Upgrade to the Latest Patch" (near
the Boot `<parent>` version). It runs inside the boot language server — no separate XML
language server is needed. The only missing link was routing: Zed has **no built-in XML
language** (Java comes from the Java extension, YAML is built in, XML is neither), so
`pom.xml` was never sent to the server.

Fix: `extension.toml` registers the server for the `XML` language (`XML = "xml"`). This
takes effect when the user installs an XML extension (e.g. `sweetppro/zed-xml`, language
name `XML`, `path_suffixes = ["xml"]`) — the same dependency shape as Java support
requiring the Java extension. **Verified 2026-07-19 in a real Zed** with an XML
extension: opening `pom.xml` in a Boot project shows "Upgrade to the Latest Patch" next
to the Boot parent `</version>`. (The isolated test harness could not confirm it — no
`tree-sitter` CLI and no CLI dev-extension install, so a tree-sitter-xml grammar won't
compile there — which is why this one was verified by hand rather than by a scripted
driven run. Note the LSP trace only shows the request/response when the profile has
`log.lsp: "trace"` on; the on-screen hint is the primary evidence.)
