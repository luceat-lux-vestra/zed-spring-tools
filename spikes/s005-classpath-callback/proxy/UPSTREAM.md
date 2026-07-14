# S005 instrumented Java proxy provenance

This directory contains disposable experiment material, not a maintained proxy
fork or a product dependency.

- Upstream repository: `https://github.com/zed-extensions/java`
- Extension release: `6.8.21`
- Source commit: `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`
- Upstream proxy package version: `6.8.12`
- Upstream license: Apache License 2.0 (`LICENSE` at the fixed commit)
- Patch target: `proxy/src/main.rs` plus new `proxy/src/s005_callback.rs`
- Accessed: 2026-07-14

The patch marks its new module as modified research instrumentation. It handles
only `workspace/executeClientCommand` requests whose command is
`s005.classpath.callback.9f2c`. It must be applied only to an ignored, clean,
commit-verified copy during S005 Gate B. It must not be applied to the installed
Java extension or treated as a reusable bridge/coordinator implementation.

Gate A validates the patch against a generated preimage and compiles the added
module in a locked synthetic harness. It does not acquire or build the real
upstream checkout.
