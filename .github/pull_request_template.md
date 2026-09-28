<!--
Small contributions do not need every section. Delete what does not apply.
Anything carrying runtime evidence or a support claim needs the tuple filled in.

Maintainer before merge: apply the current owning milestone when applicable and
the relevant area/state/evidence labels. Add an assignee only when someone other
than the author owns the next action. Do not duplicate the active
Epic/Track/Task hierarchy in a separate status board without a concrete need.
-->

## Why

<!-- What problem this solves. Link the owning issue or decision if one exists. -->

## What changed

<!-- The material change, not a file listing. Reviewers can read the diff. -->

## Validation

<!--
What you actually ran, and its result. "Should work" is not validation.
If a check failed or was skipped, say so. Documentation-only changes may use
the bounded fast path only when their paths satisfy the checked-in policy.
-->

- [ ] `cargo fmt --check`, `cargo clippy`, `cargo test` when source/runtime work requires it
- [ ] `node --test "coordinator/test/*.test.mjs"` when coordinator/contracts are affected
- [ ] Locked `wasm32-wasip2` release build when the extension artifact is affected
- [ ] Driven in a real Zed install when this change carries a runtime/support claim
- [ ] Exact-final-HEAD repository-required checks pass

## Runtime evidence

<!--
Only if you observed behaviour. State the exact tuple; an observation without one
cannot be reused. Delete this section if the change has no runtime surface.
-->

- Exact source revision:
- OS + architecture:
- Zed version:
- Official Java extension version:
- JDK:
- Project under test:

## Unverified

<!--
What this change does NOT establish. Untested platforms stay unverified; an
inference must not be presented as a confirmed fact.
-->

## Follow-up

<!-- What is deliberately left for later, so it is not mistaken for an oversight. -->
