# Hardening Reassessment — 2026-09-20

- Status: **Completed point-in-time reassessment**
- Owning issue: #128 — completed 2026-09-21
- Implementation: PR #129, squash merge `dd707488abc565aa4575dc91b480fa3c33deefd5`

This document records the September hardening reassessment and later bounded
CI-policy updates. It is historical evidence, not a live backlog. Current merge
authority is `.github/merge-gate-policy.json` plus the live `main` ruleset.

> **2026-09-28 CI scope update.** `rust` and `coordinator` remain authoritative component jobs but skip product/toolchain work only for a mechanically bounded documentation-only path set. `review` (Dependency Review) and `workflow-security` remain active; mixed/unreadable/unlisted scope falls back to full validation. `CONTRIBUTORS.md` and `THIRD_PARTY_NOTICES.md` remain full-validation inputs.
>
> **2026-09-28 required-gate aggregation.** The live merge contract is collapsed to one fail-closed `Merge Gate` context. It depends directly on `rust`, `coordinator`, `review`, and `workflow-security` and fails unless every component concludes successfully. Platform Validation and CodeQL keep their existing staged/advisory roles.

> **Post-rollout proof protocol.** A documentation-only proof PR must keep the `rust` and `coordinator` required jobs present and successful while their product/toolchain steps are skipped, and must still pass `workflow-security` and Dependency Review on the same exact PR HEAD.

## Confirmed findings

### GAP — API/direct issue metadata

Issue Forms and PR path label automation do not cover API/agent-created issues. The repository already uses structured issue-title prefixes extensively, including `task(...)`, `track(...)`, and `epic(...)`.

The reassessment adds deterministic issue reconciliation. Existing labels remain canonical, and three labels are added because the repository's title protocol already distinguishes those ownership levels:

- `task` — concrete implementation/validation/release/maintenance work;
- `track` — multi-task work track;
- `epic` — cross-track project/release objective.

Existing `bug`, `documentation`, `research`, `decision`, and `spike` labels are reused.

No issue body, area, state, or arbitrary natural language is inferred. Manual backlog reconciliation is now independently opt-in (`backfill=false`) and review-first (`dry_run=true`). A mutating backfill is rejected from a non-default-branch dispatch, and an unselected manual dispatch cannot mutate even the managed label catalog.

### GAP — contributor merge documentation drift

The checked-in/live merge policy is squash-only with merge commits and rebase-merge disabled, but `CONTRIBUTING.md` still permitted rebase merge. The contributor contract is corrected to match the authoritative policy.

### PASS — dependency admission and workflow security

At reassessment close, Dependency Review and `workflow-security` were required
merge authorities. After the 2026-09-28 aggregation, they are authoritative
components of the single required `Merge Gate`: `review` owns Dependency
Review, while `workflow-security` owns actionlint, zizmor, SHA pinning, job
timeouts, and policy reconciliation. No second hardening framework is added.

### PASS — CodeQL authority

The repository already runs custom CodeQL across Actions, JavaScript/TypeScript, Java/Kotlin, and Rust. The bridge currently contains Java rather than Kotlin, so the existing `java-kotlin` `build-mode:none` analyzes the Java source without a Kotlin build requirement.

CodeQL remains advisory because its PR trigger intentionally ignores documentation-only changes. A disappearing context must not be made required.

### STAGED — platform-gate

The existing `platform-gate` classification remains staged. This reassessment does not promote it merely because other hardening work is occurring; its own ordinary-PR/merged-main reliability proof and live ruleset promotion contract remain separate.

## Closure evidence

Issue #128 closed only after PR #129 was squash-merged and the exact merged-main
revision was read back. The recorded closure evidence includes:

- squash merge `dd707488abc565aa4575dc91b480fa3c33deefd5`;
- successful final-PR Dependency Review, Labeler, CI, Platform Validation, and
  CodeQL;
- successful merged-main CI run `35502404556`, Platform Validation run
  `35502404583`, and CodeQL run `35502404552`;
- live issue-metadata reconciliation proof; and
- fresh merge-setting readback showing squash enabled with merge/rebase disabled.

The 2026-09-28 documentation-only fast path and required-gate aggregation are
later policy updates layered onto that completed reassessment. Their current
authority is the merge-gate policy and live ruleset, not this dated document.

`UNKNOWN`, `UNVERIFIED`, and `INSUFFICIENT EVIDENCE` remain FAIL for claimed controls.
