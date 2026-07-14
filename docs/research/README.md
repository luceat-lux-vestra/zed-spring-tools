# Research Index

- Phase status: Complete
- Completed on: 2026-07-14
- Local spike status: S001-S005 executed on macOS arm64; S003-S005 support the
  required JDT/Spring coordination seams on that tested tuple
- Next gate: plan and run one basic local end-to-end PoC before the product
  direction decision and initial public GitHub source release
- Goal update: long-term capability parity with VS Code Spring Tools, using
  equivalent Zed-native workflows where editor surfaces differ
- Delivery update: platform-neutral installation remains a design target, while
  Linux and Windows runtime validation moves after the local PoC and initial
  public source release
- Scope update: Zed SSH remote development and WSL-hosted remote projects are
  deferred. Existing research observations about remote behavior are retained
  for possible future work but are not initial spike or release requirements.

## Primary question

What process and protocol structure is required for a Zed extension to run and
coordinate JDT LS and the Spring Tools Language Server?

## Investigation order

| ID | Investigation | Status | Key output |
| --- | --- | --- | --- |
| [R001](001-zed-extension-language-server-lifecycle.md) | Zed extension language-server lifecycle | Complete | Client lifecycle and capability constraints |
| [R002](002-spring-tools-language-server-execution-model.md) | Spring Tools Language Server execution model | Complete | Dependencies, protocol, and launch requirements |
| [R003](003-jdtls-execution-and-zed-integration.md) | JDT LS execution and workspace model | Complete | Runtime, initialization, and workspace constraints |
| [R004](004-integration-structure-candidates.md) | Integration structure candidates | Complete | Comparison of direct, dual-server, and coordinator models |
| [R005](005-distribution-and-licensing.md) | Distribution and licensing | Complete | Pinned-download strategy and publication constraints |

Use [template.md](template.md) for each investigation. A status may be `Not
started`, `In progress`, `Blocked`, or `Complete`.

## Completion gate

Research is sufficient for feasibility spikes when it identifies:

- two to four credible integration structures;
- the main client and server constraints for each structure;
- unresolved claims that require runtime verification; and
- the smallest experiment that can distinguish the leading candidates.

R001-R005 satisfy this documentation gate. They do not establish production
feasibility; that decision depends on runtime evidence from S001-S005.
