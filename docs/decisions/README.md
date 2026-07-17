# Decision Index

No product direction or architecture decision has been made. D001 records the
project goal and delivery sequence without selecting an implementation
architecture.

| ID | Decision | Status |
| --- | --- | --- |
| [D001](001-local-first-parity-and-publication.md) | Local-first capability parity and staged public development | Accepted |

Decision records in this directory must cite supporting research and spike
results. The next expected decision remains the project direction gate: Go,
Pivot, Limited, or Stop, but it is not ready. S006 closed Inconclusive before
its end-to-end hypothesis input. S007 now records the reviewed managed-local
JDT data-isolation prerequisite and one real Run 1. The exact direct data path
worked and reached `ServiceReady`, but a Buildship cache-miss request and
incomplete proxy-record cleanup made S007 Inconclusive; Run 2 was not started.
R006 completed source attribution. S008 then completed two fixed-helper/catalog
runs: both exact direct data paths reached `ServiceReady`, but the fresh profile
auto-installed an extension, created unrelated editor state, and emitted
provider-auth warnings. S008 is therefore Inconclusive rather than Refuted. A
controlled profile-attribution run and a later attributable local PoC are still
required. R007 has now attributed the profile paths, and S009 is planned and
reviewed as that single controlled prerequisite run. Gate B's one real
preparation set is complete and independently reviewed, but it has no runtime
evidence yet.

Use [template.md](template.md) after sufficient evidence exists.
