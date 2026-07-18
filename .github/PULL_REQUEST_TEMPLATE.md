<!--
Small contributions do not need every section. Delete what does not apply.
Anything carrying runtime evidence or a support claim needs the tuple filled in.

Maintainer before merge: apply the active milestone and relevant `area:*`,
`state:*`, or evidence-type labels. Add an assignee only when someone other than
the author owns the next action. GitHub Projects are not used during solo M4.
-->

## Why

<!-- What problem this solves. Link the issue or decision if one exists. -->

## What changed

<!-- The material change, not a file listing. Reviewers can read the diff. -->

## Validation

<!--
What you actually ran, and its result. "Should work" is not validation.
If a check failed or was skipped, say so — that is more useful than silence.
-->

- [ ] `cargo fmt --check`, `cargo clippy`, `cargo test`
- [ ] `node --test "coordinator/test/*.test.mjs"`
- [ ] Locked `wasm32-wasip2` release build
- [ ] Driven in a real Zed install

## Runtime evidence

<!--
Only if you observed behaviour. State the exact tuple; an observation without one
cannot be reused. Delete this section if the change has no runtime surface.
-->

- OS + architecture:
- Zed version:
- Official Java extension version:
- JDK:
- Project under test:

## Unverified

<!--
What this change does NOT establish. Untested platforms stay `untested`, never
`supported`. An inference must not be presented as a confirmed fact.
-->

## Follow-up

<!-- What is deliberately left for later, so it is not mistaken for an oversight. -->
