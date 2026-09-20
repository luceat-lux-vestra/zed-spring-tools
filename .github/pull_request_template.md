<!-- failure-triage:v1:start -->
## Failure remediation

Select exactly one. Required for human-authored PRs.

- [ ] Not remediation for an observed failure
- [ ] Remediation for an observed failure

If this PR is remediation, replace every placeholder. If root cause is still UNKNOWN / UNVERIFIED / INSUFFICIENT EVIDENCE, stop remediation and investigate first.

Observed:
<!-- What failed, where, and on which exact revision/run? -->

Classification:
<!-- Exactly one: implementation defect | test defect | evidence defect | workflow-policy drift | environment failure -->

Basis:
<!-- Why is this responsibility layer proven? Which plausible alternatives were rejected or remain unresolved? -->

Root cause:
<!-- Established cause; UNKNOWN / UNVERIFIED / INSUFFICIENT EVIDENCE / TBD are not remediation states. -->

Remediation:
<!-- Which owning layer changes, and why is this the minimum justified change? -->

Proof:
<!-- What will prove the cause is resolved without weakening tests/evidence/policy? -->
<!-- failure-triage:v1:end -->

## Summary

<!-- What changes and why? -->

## Related issue / decision

<!-- Link the owning issue and governing decision if any. -->

## Validation

<!-- Commands, checks, evidence, exact revisions, and skipped checks with reasons. -->
