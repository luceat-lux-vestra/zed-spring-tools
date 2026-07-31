# Pinned upstream release refresh gate

- Status: **Executed once, in full** against `5.3.0.RELEASE` — Stages 0-5
  complete, Stage 4 reached for one row. Rollback rehearsed. See
  [Execution status](#execution-status)
- Date: 2026-07-29, last updated 2026-08-01
- Currently pinned: Spring Tools `5.3.0.RELEASE` /
  `vscode-spring-boot-2.3.0-RC2.vsix`, pinned 2026-08-01
- Previously pinned: Spring Tools `5.2.0.RELEASE` /
  `vscode-spring-boot-2.2.0-RC1.vsix`
- Related: [implementation-plan](implementation-plan.md) M6 gap 2;
  [capability-inventory](capability-inventory.md);
  [COMPATIBILITY](../COMPATIBILITY.md);
  [R021 Stage 2 audit](research/021-spring-tools-5.3.0-refresh-audit.md)

Every parity claim in this repository is anchored to one upstream release. This
document is the procedure for moving to another one. It exists because M6 named
its absence as a gap between "the platform matrix passes" and "this is
releasable": a project that can only pin has not shown it can follow upstream.

## Why a refresh is not a version bump

Changing `VERSION` in `src/artifacts.rs` is the smallest part of the work. The
pin reaches much further than the download:

| Anchored to the pinned release | Where |
| --- | --- |
| Artifact identity — URL, size, SHA-256, and a per-entry digest for each required jar | **four files**, listed in Stage 1 |
| The capability inventory's derivation — 118 configuration keys, the command set, languages and views | [R011](research/011-vscode-spring-tools-capability-surface.md), [R018](research/018-spring-tools-zed-outcome-parity-audit.md) |
| Reconciler defaults — 11 categories and 71 problem types, each severity | the server jar's own `problem-types.json` |
| The absent-key defaults this extension supplies explicitly | `spring_workspace_configuration` in `src/lib.rs` |
| Launch-argument decisions the VS Code client makes before the server exists | the VSIX's `extension/dist/extension.js` |
| Behavioural asserts a `verified` row rests on, such as the upgrade being patch-only | individual inventory rows |
| 31 driven gates' evidence | `tmp/*/evidence/`, referenced from inventory rows |

A refresh has to re-establish each of those or explicitly accept that it did
not, because a `verified` row whose precondition silently changed is a false
claim, not a stale one.

## Stage 0 — preconditions

1. A newer upstream release exists and is a full VSIX, not a source tag.
2. No other slice is in flight; a refresh must be its own branch, because when a
   capability breaks the question is always "the release, or our change?"
3. The current pin's driven evidence is present under `tmp/` or reproducible.
   The refresh compares against it; without a baseline this is not a gate.

## Stage 1 — mechanical re-pin

This stage is fully verifiable and must fail closed.

1. Update the identity in **all four** files that carry it. This document said
   two until the first real refresh found the other two, and the error is
   load-bearing — a refresh that follows the old list misses half the pin:

   | File | What it holds | Enforced by |
   | --- | --- | --- |
   | `src/artifacts.rs` | `VERSION`, `ASSET`, `URL`, `SIZE`, `SHA256`, the `REQUIRED` digests | download + install |
   | `extension.toml` | the `download_file` capability path | Zed's capability check |
   | `coordinator/src/main.mjs` | `SERVER_JAR`, `SPRING_TOOLS_VERSION` | **fail-closed at startup** |
   | `protocol/spring-artifacts.json` | the entire identity again, all six per-jar digests | **nothing — it can drift silently** |

   Two test-side references carry it too: the coordinator test's fake server jar
   filename and its assertion on the compatibility report body. `node --test`
   catches both, which is the correct behaviour.
2. Recompute every `REQUIRED` entry digest from the new VSIX. **A missing entry
   is a finding, not a chore**: an upstream release that drops or renames a
   required jar has changed the composition contract, and the refresh stops here
   until that is understood.
3. Install into a cold profile and confirm the artifact route reports the new
   release. The offline gate (`tmp/offline-behaviour-20260726/evidence/`) is the
   direct regression test for this stage, because it exercises checksum
   verification and repair of a corrupt install — both of which read these exact
   constants.

   **`cargo build` does not update the dev extension.** Zed loads the repo-root
   `extension.wasm`, which `cargo build --target wasm32-wasip2` never writes — it
   writes `target/wasm32-wasip2/release/zed_spring_tools.wasm`. The first 5.3.0
   cold run installed 5.2.0 from a two-day-old wasm with the constants already
   changed. Note also that the two builds are the **same byte size**, so size
   proves nothing; confirm with
   `strings extension.wasm | grep -o '5\.[0-9]\.0\.RELEASE'` before trusting any
   re-pin run.

## Stage 2 — source re-audit, before anything is driven

Cheap, and it decides how much of Stage 3 is needed.

1. **Configuration keys.** Diff the new `package.json` `contributes.configuration`
   against the pinned 118. Report added, removed, renamed, and — most easily
   missed — *changed defaults*. A default that flips is invisible at runtime
   until a user hits it.
2. **`problem-types.json`.** Diff all categories and problem types with their
   severities. This file is the whole settings audit for the Java reconcilers,
   so a delta here is what makes Stage 3's diagnostics gates mandatory rather
   than optional.
3. **Absent-key defaults.** For every key `spring_workspace_configuration`
   supplies, re-read the server getter. The recurring trap is a getter whose
   absent-key default disagrees with the VS Code schema default; `jpql`,
   `inject-bean`, the XML sub-settings and `modulith-project-tracking` are all
   in the inventory because of it. A refresh can both fix and create instances.
4. **The client launcher.** Diff `extension/dist/extension.js` for the JVM
   arguments and the settings that select them. This entry is here because the
   2026-07-29 MCP work found `boot-java.ai.mcp-server-enabled` and
   `mcp-server-port` there and nowhere else: the launcher makes parity decisions
   the server jar cannot express, and no `BootJavaConfig` audit will ever surface
   them.
5. **Commands.** Diff the command set. Watch specifically for commands that gain
   or lose callers, since several inventory rows rest on a command being
   caller-less upstream.
6. **Behavioural asserts.** Re-read the upstream code behind any row that cites
   one — the patch-only upgrade path and its dead major/minor branches are the
   clearest example.

Write the result as a research document. It is the input to Stage 3, and on its
own it already answers "what changed", which is most of the value.

## Stage 3 — driven gates, tiered by what a release can break

Re-running all 31 driven gates is not a gate, it is a wall; nobody will do it
and the refresh will not happen. Tier instead.

**Tier A — always, regardless of what Stage 2 found.** These prove the product
still coordinates with the release at all, and every other gate is meaningless
if one fails: cold install and artifact verification (Stage 1's offline gate),
the LSP handshake and classpath bridge reaching a resolved project, the
removal/cleanup contract, and the declared JDK floor
(`tmp/m5-jdk21-floor-20260726/evidence/`) — upstream's own launcher asserts a
minimum Java version, so a raised floor is a release-breaking change that no
capability gate would catch.

**Tier B — when Stage 2 found a delta that touches them.** Map each delta to the
rows that cite it. A `problem-types.json` change pulls in the Java reconciler and
residual-diagnostics gates; a `spring.io` or version-metadata change pulls in
version/support validation and the Boot upgrade; a Modulith or index change pulls
in the Modulith and Structure gates. The mapping is mechanical because each
inventory row names the evidence it rests on.

**Tier C — on demand.** Everything else. Record that it was not re-run rather
than implying it passed. An un-rerun gate is untested against the new release,
which is a different statement from failing.

Any row whose Tier A or Tier B gate is not re-run **must not keep saying
`verified` against the new release**. Either the evidence is refreshed or the
row states which release its evidence belongs to.

## Stage 4 — reporting a regression

A refresh that finds a regression has succeeded, not failed. Record it as:

1. The inventory row moves out of `verified` — to `blocked-upstream` when the
   new release removed or broke the capability, or back to `implemented` when
   the code still exists but no longer has evidence.
2. `COMPATIBILITY.md` gains the new tuple beside the old one. Both stay: the
   point of the exercise is showing what changed between two releases.
3. A GitHub issue carries the `state:*` label the row moved to, and names the
   exact upstream delta from Stage 2.
4. If the regression is upstream's rather than ours, it is reported upstream
   with the Stage 2 diff as evidence.

The refresh does not silently revert. A regression is information the project
now owns.

## Stage 5 — currency, when the refresh finds nothing

The first execution exposed a hole: every stage above describes what to do when
something *changed*, and the refresh's most likely outcome is that nothing did.
"No regression" is not "no work". A refresh moves the product's identity, so
every claim anchored to the old identity is now either re-established or stale,
and staleness is invisible precisely because no gate failed.

Run the [preview release gate](preview-release-gate.md)'s seven currency rules
against the new pin. Four of them are refresh-sensitive by construction:

1. **Rule 2 — compatibility table.** Each re-run gate's tuple names the new
   release; every row not re-run still names the old one. Both directions matter.
2. **Rule 4 — known blockers.** An upstream defect this project reported can be
   *fixed* by the refresh. Check each open blocker against the new release rather
   than against its upstream milestone label — the 5.3.0 refresh found
   spring-tools#1949 fixed in a release whose milestone said otherwise, and the
   README would have gone on advertising it for a release that does not have it.
3. **Rule 5 — third-party notices.** The notices describe the artifact the
   product actually downloads. A new VSIX is a new licensing input; its own
   declaration and inventory need reading, not inheriting.
4. **Rule 7 — rollback instructions.** They name a specific commit and a specific
   pair of releases, so they go stale on every refresh.

Rules 1, 3 and 6 (inventory counts, tested matrix, checksums) are unaffected by a
no-regression refresh but are cheap, and rule 6 is the direct check on Stage 1.

## Rollback

**Rehearsed 2026-08-01**, after the 5.3.0 refresh landed, against a profile
holding a real `5.3.0.RELEASE` install. Evidence:
`tmp/rollback-rehearsal-20260801/evidence/ROLLBACK-GATE.md`. The two things this
section previously asked the first refresh to confirm both hold, and the
rehearsal added a third:

- **Two releases coexist on disk.** The extension keys its work directories by
  release (`work/spring-tools/spring-tools/<VERSION>/` and
  `downloads/<VERSION>/`). Installing 5.2.0 into a profile already holding 5.3.0
  left all 204 files of the 5.3.0 tree byte-identical by sha256.
- **`git revert` of the Stage 1 commit is a complete rollback of identity** — of
  the *pin*, see the caveat below. The revert applied with no conflict, left the
  four pin files byte-identical to their pre-refresh state, kept `cargo test`
  29/29 and `node --test` 109/109 green, and started the old server jar, which is
  only reachable through the coordinator's fail-closed `SERVER_JAR` guard.
- **Rolling back needs no network.** With `downloads/` deleted entirely, the
  reverted build started on the existing install and never recreated it:
  `artifacts.rs`'s `if validate_install(&install).is_ok() { return paths(install) }`
  short-circuits before the download path is reached.

Two things are *not* automatic:

1. **A rollback is two steps, not one.** The revert restores the pin; it does not
   restore the documentation. The 5.3.0 refresh landed its docs in four commits
   after Stage 1, so after a revert `README.md`, `COMPATIBILITY.md`,
   `LIMITATIONS.md`, the inventory, the plan and the Stage 2 audit all still
   assert the release that is no longer pinned. That separation is deliberate —
   it is what lets the revert apply cleanly — but the second step is real work and
   must be done in the same change.
2. **Any product change made to accommodate the new release in Stages 2-3.** Keep
   those in separate commits from Stage 1 so a rollback can take the pin without
   taking the adaptation, or state plainly that they are coupled.

One harness precondition, because it produced a convincing false negative: a
rollback checked out into a **clean tree** does not run as a dev extension.
`/grammars/` is gitignored — Zed compiles the pinned tree-sitter properties
grammar there at install time — so a fresh worktree fails to load the Properties
language, no buffer gets a language, no server starts, and the run installs
nothing while looking like a dead extension. Copy `grammars/` in, or install the
dev extension through Zed's own action.

## Execution status

**Executed against `5.3.0.RELEASE` on 2026-08-01**, the first real execution of
this gate. Upstream published the first release since this repository pinned
`5.2.0.RELEASE`, so Stage 0's first precondition passed and the gate became
executable. **The product is now pinned to `5.3.0.RELEASE`. One regression was
found, in one row, and it costs a click rather than a capability.**

| Stage | Status |
| --- | --- |
| Stage 0 — preconditions | **Passed** 2026-08-01. All three: a full VSIX (`vscode-spring-boot-2.3.0-RC2.vsix`, 83,000,863 bytes) on a non-prerelease tag; no other slice in flight; the baseline VSIX under `tmp/s002-artifacts/` hashing to the pinned `SHA256` verbatim. |
| Stage 1 — mechanical re-pin | **Passed** 2026-08-01 as its own commit (`fa11beb`). A cold profile downloads, verifies and installs the release, and the running server is the 2.3.0 jar — reachable only through the fail-closed `SERVER_JAR` guard. Corrected this document's own two-file claim to four. |
| Stage 2 — source re-audit | **Complete** 2026-08-01 — [R021](research/021-spring-tools-5.3.0-refresh-audit.md). |
| Stage 3 — driven gates | **Tier A and Tier B complete.** All five Tier A gates pass (`tmp/refresh-530-gates-20260801/evidence/`). Every mapped Tier B row was then driven (`tmp/residual-tierb-20260801/evidence/`): all pass byte-identically except remote connect. Tier C recorded as not re-run. |
| Stage 4 — regression reporting | **Reached for one row.** Remote connect no longer attaches on declaration; root-caused to an unconditional `setManualConnection(true)` upstream. The row keeps `verified` because no outcome was lost. |
| Stage 5 — currency | **Complete** 2026-08-01. Added by this execution, which is what exposed its absence. |
| Rollback | **Rehearsed** 2026-08-01 — `tmp/rollback-rehearsal-20260801/evidence/ROLLBACK-GATE.md`. |

Stage 2's headline: the *declared* surface is unchanged — 118 configuration keys
with zero changed defaults, a byte-identical `problem-types.json`, a
byte-identical `BootJavaConfig`, and an unchanged command set on both the client
and the server side. The risk is entirely in implementation, and it concentrates
in four places: a rewritten `Version` class whose release predicate and parse
pattern both moved, a local live-process attach mechanism that relocated into a
new `LocalJvmAttach` server class as the client stopped injecting JMX port
arguments, 15 changed index-cache classes, and an MCP SDK major bump from 1.1.0
to 2.0.0.

The backwards-rehearsal option recorded here previously — downgrading to
`5.1.1.RELEASE` to exercise the stages without upstream — is **withdrawn as
unnecessary**. A real release is now available and Stage 2's diff against it is
genuine, so the rehearsal would cost driven time to prove less. The rollback
path it was also meant to exercise got its first real test in this refresh
instead, which is why Stage 1 landed as a separate commit from any adaptation
Stages 2-3 require — and that separation is exactly what made the revert apply
cleanly.

What the first execution changed about the gate itself, recorded because a
procedure that runs once and learns nothing is not being read: the pin lives in
four files rather than two (Stage 1); `cargo build` does not update the dev
extension, and the two builds are the same byte size (Stage 1); a refresh that
finds no regression still has currency work, which no stage described (Stage 5);
and a rollback is two steps, not one (Rollback).
