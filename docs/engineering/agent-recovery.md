# Crash-Recoverable Agent Work

This document defines repository-operation recovery after an agent session, connection, harness, or process interruption in `luceat-lux-vestra/zed-spring-tools`.

Existing repository-specific architecture, validation, CI, merge, release, and security policy remains authoritative.

## Authority

Use this order for execution recovery:

1. current GitHub execution state;
2. current repository policy;
3. the active Issue checkpoint;
4. session/conversation memory.

GitHub is authoritative for Issues, refs, commit SHAs, pull requests, checks/workflows, reviews/threads, merge state, and the default branch. The checkpoint is a resume hint and never overrides current GitHub state.

## Durable checkpoint

For recoverable work, maintain one mutable owning-Issue comment marked:

```text
<!-- agent-resume-checkpoint:v1 -->
```

Use:

```yaml
schema: agent-resume/v1
repository: luceat-lux-vestra/zed-spring-tools
work_item: <issue-number>
work_unit: <stable-logical-id>
phase: selected | implementation-durable | pr-open | validating | merge-ready | merged | housekeeping | done
branch: <branch-or-null>
pr: <pr-number-or-null>
expected:
  branch_head: <sha-or-null>
  pr_head: <sha-or-null>
  base: main
last_verified:
  at: <timestamp>
  authority: github
next_safe_action: <short-semantic-action>
last_mutation:
  kind: <operation-or-none>
  outcome: verified | unknown | none
stop_condition: <repository-policy stop condition>
```

Do not store the mutable checkpoint in a production branch and do not mirror volatile CI state in it.

Normal durable boundaries are: work selected, candidate ref verified, PR verified, final candidate HEAD established, merge verified, post-merge housekeeping verified, done.

Do not intentionally leave checkpoints stale during normal work. Staleness is a recovery condition caused by interruption, lost response, concurrent movement, or failed checkpoint write.

## Resume protocol

Before mutating interrupted work:

```text
read policy
-> discover open production PRs
-> identify owning Issue/checkpoint
-> fresh-read branch/PR/HEAD/base
-> read checks/reviews when decision-relevant
-> compare checkpoint with GitHub
-> classify
-> derive exactly one safe next action
```

Classify as `MATCH`, `CHECKPOINT_STALE_BUT_RECONCILABLE`, `EXTERNAL_STATE_MISSING_RETRYABLE`, `CONFLICT`, or `UNKNOWN`.

`UNKNOWN / UNVERIFIED / INSUFFICIENT EVIDENCE = FAIL` when material to the next mutation or merge decision.

## Mutation protocol

Every material external mutation follows:

```text
fresh precondition read
-> bounded mutation
-> authoritative read-back
-> classify postcondition
-> checkpoint after verified postcondition
```

If a response/session is lost, never replay a mutation only because the checkpoint is behind. Re-read authority first.

For create operations, search/read before retrying. For ref movement, re-read and record the verified SHA. For merge, pin the reviewed HEAD when supported and re-read PR/main before retrying an unknown outcome.

## Exact-HEAD evidence

Current PR HEAD is authoritative. Any HEAD movement invalidates prior HEAD-specific CI/review/runtime evidence unless repository policy explicitly permits same-SHA reuse. Branch-history cleanup or another rewrite therefore requires fresh evidence for the new exact final HEAD.

## Failure handling

- Read-only interruption: fresh-read and continue.
- Local-only/unpushed edits: not recoverable from GitHub.
- Lost response after remote mutation: infer outcome from authority.
- Stale checkpoint/HEAD movement: current GitHub state wins after ownership is proven.
- Concurrent actor: no last-write-wins assumption.
- Partial multi-step work: recover existing objects and complete only missing steps.
- Async CI/review: read current evidence for current HEAD.
- Authority unavailable or ownership ambiguous: fail closed.
- Missing/corrupt checkpoint: reconstruct only when one work unit is unambiguous.

## Post-merge and privacy

Merged is not done. Complete required main/post-main verification and linked Issue/tracker housekeeping, checkpoint `done`, then stop under repository policy.

Checkpoint content must be safe for repository visibility. Never store credentials, tokens, hidden reasoning, raw private prompts/transcripts, personal secrets, confidential data, or unrelated private provenance.
