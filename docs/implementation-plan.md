# Product implementation and public-development plan

- Status: **Historical milestone plan; M1–M6 delivery program complete**
- Current capability authority: [capability inventory](capability-inventory.md)
- Current compatibility authority: [COMPATIBILITY.md](../COMPATIBILITY.md)
- Current release/distribution authority: [release Epic #108](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/108) and the [release gate](preview-release-gate.md)
- Historical architecture decisions: [decisions](decisions/README.md)

This document now records the implementation program that produced the current
Zed Spring Tools product. It is **not** the source of truth for present-tense
capability counts, tested runtime tuples, or release readiness. Those values
change independently and are intentionally owned by the documents linked above.

The previous version of this plan accumulated detailed slice-by-slice evidence
while M1–M6 were active. That history remains available in Git history and in the
linked decision, research, spike, and gate records. Keeping old numeric snapshots
here as if they were current created avoidable documentation drift.

## Outcome

The program produced a source-separated Zed extension that provides Spring Boot
language intelligence as a companion to the official Java extension. The
product does not ship a private JDT replacement, does not redistribute the
Spring Tools runtime, and does not claim support for untested desktop/runtime
tuples.

The implementation boundary consists of:

- the Rust/WASM Zed extension adapter;
- a dependency-free Node coordinator;
- the reviewed Java bridge contributed to the Java-owned JDT LS;
- versioned coordination protocol schemas and fixtures; and
- the pinned Spring Tools acquisition/verification boundary.

## Milestone record

### M0 — direction gate

Completed. The project established the official-Java companion architecture,
kept runtime binaries/evidence outside the product tree, and rejected reduced or
modified Java-server substitutes.

### M1 — production scaffold

Completed. The production workspace, coordinator, bridge, protocol contracts,
locked build/test path, and artifact-acquisition boundary were established.

### M2 — product-grade macOS arm64 vertical slice

Completed. A clean development-extension lifecycle exercised acquisition,
official-Java discovery, bridge contribution, Spring startup, authentic
classpath coordination, restart/uninstall cleanup, and actionable incompatible
Java/JDK behavior on the named macOS arm64 evidence tuple.

The install-ordering and first-download limitations discovered during this work
remain documented in [LIMITATIONS.md](../LIMITATIONS.md); historical evidence is
retained in the M2 research/spike records.

### M3 — public source release

Completed. The repository became public under Apache-2.0 with source, notices,
security reporting, ignored local evidence, and no committed third-party runtime
binary.

### M4 — VS Code Spring Tools outcome-parity program

Completed. The project audited the pinned VS Code Spring Tools capability
surface, selected stock-Zed/LSP-first delivery routes, implemented or classified
each tracked user outcome, and required named evidence before promotion.

The **current** inventory is the authority. As of inventory version 55 it records:

- 59 tracked capabilities;
- 48 `verified`;
- 0 `implemented`;
- 0 `planned`;
- 3 `blocked-zed-api`;
- 0 `blocked-upstream`;
- 6 `zed-native-equivalent`; and
- 2 `not-pursued`.

Do not copy these counts into additional planning documents. If they change,
update the inventory and release-facing summaries that deliberately expose the
current snapshot.

### M5 — portability floor and compatibility policy

Completed for the declared release policy. The JDK 21 floor was driven on the
available macOS arm64 environment, while additional desktop tuples remained
explicitly untested rather than inferred from platform-aware code. Official Java
compatibility became capability-first instead of being pinned to one extension
point release.

Additional desktop validation is now independently tracked as community
compatibility work and is not, by itself, a v1.0 blocker while support claims
remain evidence-scoped.

### M6 — release readiness and residual scope decisions

Completed as an implementation/readiness milestone. The remaining product-scope
decisions were resolved, the embedded MCP server was implemented and driven as
an opt-in capability, the Gradle axis was exercised, and the pinned Spring Tools
refresh gate was executed against `5.3.0.RELEASE`.

The historical M6 preview policy originally coupled stability to successive
preview releases and an observation period. That promotion rule has since been
**superseded**. See [release gate](preview-release-gate.md) and release Epic #108
for the current Registry-first policy.

## Current phase: official distribution and v1.0

Implementation-plan milestones no longer define the release sequence. The
current release program is:

1. keep the already-submitted Registry version at `0.1.0` until the initial Zed
   Registry publication is real;
2. exercise a fresh install through the actual Registry path, including
   first-run acquisition, Java/Spring coordination, representative language
   intelligence, restart/offline startup, uninstall, and cleanup;
3. fix and re-run the bounded release gate for any release-blocking defect; and
4. if the gate is clean and release-facing claims remain evidence-correct, the
   next intentional release may be `1.0.0`.

No arbitrary sequence of `0.x` releases, arbitrary calendar soak, every desktop
architecture, or JDK 22/23/24 matrix is required solely to manufacture a
stability signal.

## Current ownership of project truth

| Question | Authority |
| --- | --- |
| What user-visible outcomes exist and what state is each in? | [`capability-inventory.md`](capability-inventory.md) |
| Which runtime/platform tuples were actually tested? | [`COMPATIBILITY.md`](../COMPATIBILITY.md) |
| What is currently known to be limited or unsupported? | [`LIMITATIONS.md`](../LIMITATIONS.md) |
| What Spring Tools release is pinned and how is it refreshed? | [`pinned-release-refresh-gate.md`](pinned-release-refresh-gate.md) plus `src/artifacts.rs` |
| What blocks or permits a release/v1.0 promotion? | [`preview-release-gate.md`](preview-release-gate.md) and release Epic #108 |
| Why were architecture/product decisions made? | [`decisions/`](decisions/), [`research/`](research/), and [`spikes/`](spikes/) |

## Standing engineering rules

- Evidence beats implementation inference: code written for a platform or
  capability is not a support claim until the named gate is driven.
- The official Java extension owns JDT LS. Do not introduce a private reduced
  Java environment or modify the official Java distribution to make Spring work.
- Prefer standard Zed/LSP surfaces; adapt allowlisted Spring-specific operations
  only where they preserve the product boundary and have evidence.
- Keep capabilities blocked when the exact required Zed surface is absent; do
  not fabricate parity through misleading UX.
- Keep network/runtime, credentials, classpaths, and generated evidence bounded
  and out of normal logs/source control according to the existing security and
  evidence contracts.
- Any release-facing claim must reconcile with the capability inventory,
  compatibility matrix, limitations, pinned artifact identity, and current
  release gate on the exact candidate.

## Historical evidence

Detailed implementation and validation evidence is intentionally retained in:

- [`docs/research/`](research/)
- [`docs/spikes/`](spikes/)
- [`docs/decisions/`](decisions/)
- [`capability-delivery-plan.md`](capability-delivery-plan.md)
- [`gradle-axis-resolution.md`](gradle-axis-resolution.md)
- [`pinned-release-refresh-gate.md`](pinned-release-refresh-gate.md)
- repository Git history

Those records should remain historically accurate. When a current policy changes,
add a supersession/current-status marker rather than rewriting old observations
as though the later decision existed at the time.
