# Crash-Recoverable Agent Work

Repository-local recovery authority for zed-spring-tools. The
[portable execution policy](agent-execution-policy.md) owns authorization,
replacement-first design, local-only checkpoints, CI observation and integrity.
The [contribution contract](../../CONTRIBUTING.md) and [release contract](../preview-release-gate.md)
own domain and deployment semantics. No document grants extra authorization.

## Authority and resume

Use current GitHub state and applicable repository-local policy first, then the
owning Issue/checkpoint, then prior conversation or memory. GitHub is authoritative
for refs, Issues, PRs, checks, reviews, rulesets and merge state; actual Registry lifecycle and exact-revision runtime evidence are authoritative for release claims.

Before mutation, read local policies, discover open PRs and the owning Issue,
read its checkpoint and current refs/base/HEAD, check relevant enforcement,
review and deployment state, compare with the checkpoint, and derive one next
safe work unit. Classify MATCH, CHECKPOINT_STALE_BUT_RECONCILABLE,
EXTERNAL_STATE_MISSING_RETRYABLE, CONFLICT or UNKNOWN. Material unknown or
insufficient evidence fails closed.

## Durable checkpoint

Use exactly one mutable owning-Issue comment identified by
`<!-- agent-resume-checkpoint:v1 -->` when durable recovery is necessary.
For purely local work follow the portable policy's local access-controlled record.
Keep a latest-state snapshot, not a history log. Record owning item, stable
work-unit identifier and phase, current branch/base/HEAD and PR, concise
completed outcomes, last verified authority, verification/acceptance state,
blockers, next safe work unit (scope, evidence and stop condition), and last
mutation outcome. Do not commit mutable state to the production branch.

Fresh-read comments before writing. Update the unique marker in place; create
one only when absent and needed. Reconcile duplicates rather than creating
another. Do not rewrite human decisions, review discussion or immutable evidence.
One designated writer; use a lock/lease or version-checked atomic update where
supported, confirm prior revision, otherwise single writer only. On conflict
or uncertain write, reread authority, reconcile and STOP.

## Mutation and recovery

A coherent work unit may contain multiple material mutations. Each requires
fresh preconditions, bounded mutation, authoritative read-back and verified
postcondition before checkpoint advancement. Continue inside the unit until its
declared stop condition, or stop early on pending, conflict, failure or material
unknown. Never replay a lost response blindly. Audit comprehensively before
editing; consolidate replacements and affected consumers/tests/docs.

## Same-HEAD evidence after base advancement

Any changed PR HEAD invalidates prior HEAD-specific CI/review proof. Do not
relabel a synthetic merge run as HEAD-only proof. Before merge, fresh-read the
owning item, current HEAD/base, required checks and provenance, live enforcement,
review state and resolved mergeability; inspect the complete final candidate.
Require the current repository Merge Gate, its actual producer identity and
applicable component proof under .github/merge-gate-policy.json. Read live rules
rather than assuming strict latest-base policy. Release and Registry claims
require their own exact-revision D007 desktop/runtime evidence.

If HEAD is unchanged but base advanced, record old/new base, exact HEAD,
required-check SHA/event/provenance and result, current mergeability, both
deltas, semantic-interaction judgment and live rules. Reuse evidence only
when all required checks/reviews remain satisfied, proof applies to the actual
unchanged input, no material interaction exists, and no gate requires current
composition or updated base. Distinct filenames alone are insufficient:
workflow, dependencies, pinned runtime/toolchain, platform matrix, capability
and release evidence, generated artifacts and security changes can interact.
A prior synthetic merge run proves only its old composition; obtain current
composition proof where needed. Unknown mergeability or material interaction
fails closed. No automatic rebase, reuse or rerun; record REUSE, REVALIDATE or
BLOCKED_UNKNOWN and reason. Normal guarded merge must satisfy all live rules.

## Completion and public privacy

Merged is not automatically done. Verify default-branch tree, branch/PR
housekeeping and applicable push/build/release evidence; reconcile owning
Issue acceptance and central coordination. Stop at the selected work-unit
boundary. A source-only change need not manufacture a deployment claim.

This repository is public. Use only public-safe metadata and evidence in
commits, Issues, PRs, logs and checkpoints. No credentials, hidden reasoning,
private prompts/transcripts, personal secrets, confidential employer/customer
data or sensitive private-repository provenance.
