# Hardening Reassessment — 2026-09-20

Owning issue: #128

This pass re-evaluates the repository's existing hardening against current external GitHub/OpenSSF guidance and actual repository operation. Existing required CI, Dependency Review, CodeQL, actionlint/zizmor, live drift, and staged platform-gate controls remain authoritative unless this document identifies a concrete gap.

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

Dependency Review is already a required context. actionlint, zizmor, SHA pinning, job timeouts, and context reconciliation are already required through `workflow-security`. No second hardening framework is added.

### PASS — CodeQL authority

The repository already runs custom CodeQL across Actions, JavaScript/TypeScript, Java/Kotlin, and Rust. The bridge currently contains Java rather than Kotlin, so the existing `java-kotlin` `build-mode:none` analyzes the Java source without a Kotlin build requirement.

CodeQL remains advisory because its PR trigger intentionally ignores documentation-only changes. A disappearing context must not be made required.

### STAGED — platform-gate

The existing `platform-gate` classification remains staged. This reassessment does not promote it merely because other hardening work is occurring; its own ordinary-PR/merged-main reliability proof and live ruleset promotion contract remain separate.

## Exit criteria

- exact final PR HEAD passes current required contexts;
- `workflow-security` accepts the new issue automation and its tests;
- a dry-run backfill is reviewed before live issue mutation;
- live repository/ruleset/actions policy remains consistent with `.github/merge-gate-policy.json`;
- merged-main checks are read back before closing the reassessment.

`UNKNOWN`, `UNVERIFIED`, and `INSUFFICIENT EVIDENCE` remain FAIL for claimed controls.
