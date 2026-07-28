# Pinned upstream release refresh gate

- Status: Defined, **never executed**
- Date: 2026-07-29
- Currently pinned: Spring Tools `5.2.0.RELEASE` /
  `vscode-spring-boot-2.2.0-RC1.vsix`
- Related: [implementation-plan](implementation-plan.md) M6 gap 2;
  [capability-inventory](capability-inventory.md);
  [COMPATIBILITY](../COMPATIBILITY.md)

Every parity claim in this repository is anchored to one upstream release. This
document is the procedure for moving to another one. It exists because M6 named
its absence as a gap between "the platform matrix passes" and "this is
releasable": a project that can only pin has not shown it can follow upstream.

## Why a refresh is not a version bump

Changing `VERSION` in `src/artifacts.rs` is the smallest part of the work. The
pin reaches much further than the download:

| Anchored to the pinned release | Where |
| --- | --- |
| Artifact identity — URL, size, SHA-256, and a per-entry digest for each required jar | `src/artifacts.rs` (`VERSION`, `ASSET`, `URL`, `SIZE`, `SHA256`, `REQUIRED`) and `extension.toml` |
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

1. Update `VERSION`, `ASSET`, `URL`, `SIZE`, `SHA256` in `src/artifacts.rs` and
   the matching values in `extension.toml`.
2. Recompute every `REQUIRED` entry digest from the new VSIX. **A missing entry
   is a finding, not a chore**: an upstream release that drops or renames a
   required jar has changed the composition contract, and the refresh stops here
   until that is understood.
3. Install into a cold profile and confirm the artifact route reports the new
   release. The offline gate (`tmp/offline-behaviour-20260726/evidence/`) is the
   direct regression test for this stage, because it exercises checksum
   verification and repair of a corrupt install — both of which read these exact
   constants.

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

## Rollback

Rollback has never been exercised, because only one release has ever been
pinned. Two things make it tractable, and both should be confirmed during the
first real refresh rather than assumed:

- The extension keys its work directories by release
  (`work/spring-tools/spring-tools/<VERSION>/` and `downloads/<VERSION>/`), so
  two releases coexist on disk and reverting the constants does not require the
  old artifact to be re-fetched.
- Every constant that identifies the release lives in two files, so `git revert`
  of the Stage 1 commit is a complete rollback of identity.

What is *not* automatic: any product change made to accommodate the new release
in Stages 2-3. Keep those in separate commits from Stage 1 so a rollback can
take the pin without taking the adaptation, or state plainly that they are
coupled.

## Execution status

**This gate has not been executed, and cannot be today.** Spring Tools
`5.2.0.RELEASE` (2026-06-10) is still the newest upstream release, so there is
nothing to refresh to. Stage 0's first precondition fails.

That leaves the M6 stable-release criterion — that the gate exists *and has been
executed at least once* — half satisfied, and it should be read that way rather
than as done.

One option would satisfy it without waiting for upstream: **rehearse the gate
backwards** against an earlier release such as `5.1.1.RELEASE`. A downgrade
exercises every stage, including the rollback path that is otherwise untestable,
and Stage 2's diff would be real rather than synthetic. It is a genuine driven
cost and is not scheduled here; it is recorded so the criterion has a route that
does not depend on upstream's schedule.
