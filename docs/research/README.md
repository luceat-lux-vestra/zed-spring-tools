# Research Index

- Phase status: Core research complete; targeted R006-R007 follow-up complete
- Last completed on: 2026-07-17
- Local spike status: S001-S005 executed on macOS arm64; S003-S005 support the
  required coordination seams, while S006-S008 are Inconclusive. S008's two
  fixed-input direct managed-JDT runs both reached `ServiceReady`, but fresh-
  profile extension/provider initialization prevented strict attribution. R007
  attributed those paths; S009 Gate A preparation code and synthetic review are
  complete, with no real preparation or runtime yet
- Next gate: execute and independently review S009 Gate B real preparation only
  after explicit continuation, before any runtime
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
| [R006](006-s007-startup-lookup-attribution.md) | Attribute S007 startup lookups and cleanup behavior | Complete | Buildship owns the Gradle request; task-helper latest lookup and proxy cleanup conditions identified |
| [R007](007-s008-profile-startup-attribution.md) | Attribute S008 isolated-profile startup state | Complete | Trust/HTML are defaults; Copilot crosses the custom profile via XDG; AI disable guards provider enumeration |

Use [template.md](template.md) for each investigation. A status may be `Not
started`, `In progress`, `Blocked`, or `Complete`.

## Completion gate

Research is sufficient for feasibility spikes when it identifies:

- two to four credible integration structures;
- the main client and server constraints for each structure;
- unresolved claims that require runtime verification; and
- the smallest experiment that can distinguish the leading candidates.

R001-R005 satisfy the original documentation gate. R006 is a targeted source
follow-up to S007 and defined S008's fixed preseed conditions. S008 proved those
inputs can reach the two direct managed data paths, but its profile-attribution
conditions did not hold. R007 attributed that gap and defines S009's controls.
None establishes production feasibility; the direction decision still requires
an attributable local end-to-end result.
