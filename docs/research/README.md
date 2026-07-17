# Research Index

- Phase status: Core research, S013 local PoC, and D003 architecture gate
  complete; experimental public-source preparation is in progress
- Last completed on: 2026-07-17
- Local spike status: S001-S005 executed on macOS arm64; S003-S005 support the
  required coordination seams, while S006-S008 are Inconclusive. S008's two
  fixed-input direct managed-JDT runs both reached `ServiceReady`, but fresh-
  profile extension/provider initialization prevented strict attribution. R007
  attributed those paths. S009 then passed the profile controls and direct JDT
  startup but closed Inconclusive because the runtime created an unplanned
  Equinox `configuration/` tree inside the fixed JDT distribution. R008
  attributed that tree to Equinox's writable private-configuration default.
  S010 then supported relocation of that state, and S011 supported the real
  Spring classpath-to-`server.port` flow on macOS arm64/JDK 25
- Next gate: expand M4's capability inventory from R011, starting with the
  properties/YAML workstream, now that the audited source is published
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
| [R008](008-equinox-private-configuration-area.md) | Attribute S009 Equinox private configuration state | Complete | Shared config is only a parent; writable install defaults private state to `<install>/configuration` |
| [R009](009-unmodified-java-companion-boundary.md) | Attribute the unmodified official-Java companion boundary | Complete | Bundle contribution and JDT requests work; reverse callback requires an owned bridge and runtime verification |
| [R010](010-experimental-public-source-audit.md) | Audit the experimental public-source boundary | Complete | Reachable history is source-only and pattern-clean; license, author identity, and namespace require owner decisions |
| [R011](011-vscode-spring-tools-capability-surface.md) | Enumerate the VS Code Spring Tools capability surface | Complete | 15 commands, 18 settings, 4 languages, and 13 advertised LSP capabilities derived from the pinned release; seeds the capability inventory |

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
S009 passed those controls but exposed Equinox private state inside the fixed
JDT tree. R008 attributed that state and defined S010's one-property relocation
test. S010's corrected component build and bounded runtime reached
`ServiceReady`, placed private Equinox state below the expected data path, and
left the fixed JDT tree unchanged. S011 then supported the attributable
integrated Spring end-to-end result while retaining unhandled client requests
and an automatic cleanup defect. D002 selects a versioned coordination Pivot;
its amendment requires the official Java extension and excludes a reduced
managed-JDT fallback. R009 defined the remaining unmodified-companion boundary.
S012 proved the functional transport with official Java unchanged, and S013
supported the authentic removal and cleanup correction. D003 is accepted. R010
closes the mechanical publication audit while retaining owner-controlled
license, author-identity, and GitHub namespace decisions. Product packaging and
multiplatform runtime validation remain open.
