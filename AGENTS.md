# AGENTS.md

Read the repository-local authorities before working:

- [Portable execution and engineering integrity](docs/engineering/agent-execution-policy.md)
- [Recovery and exact evidence](docs/engineering/agent-recovery.md)
- [Contribution and engineering contract](CONTRIBUTING.md)
- [D007 runtime boundary](docs/decisions/007-standalone-spring-publishing-boundary.md) and [D005 delivery policy](docs/decisions/005-lsp-first-capability-delivery.md)
- [Release gate](docs/preview-release-gate.md), [pinned refresh gate](docs/pinned-release-refresh-gate.md) and [platform evidence](docs/platform-validation.md)
- [Merge policy](.github/merge-gate-policy.json) and [dependency lifecycle](.github/dependency-update-policy.json)

These are complementary authorities, not competing execution paths.
Existing implementation, policy and configuration are audit inputs. Replace
obsolete structures directly; satisfy actual correctness, security and external
obligations with independent evidence. Do not resurrect private Java transport,
invent capability support or infer release authorization from a green CI.
Local policies are self-contained; central provenance is not a runtime dependency.
