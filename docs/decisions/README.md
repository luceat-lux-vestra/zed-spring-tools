# Decision Index

The local direction gate is complete. D001 records the product goal and staged
delivery sequence; D002 selects a coordinated Java/Spring product direction
from the supported S011 local PoC. A detailed production architecture and
implementation plan have not yet been approved.

| ID | Decision | Status |
| --- | --- | --- |
| [D001](001-local-first-parity-and-publication.md) | Local-first capability parity and staged public development | Accepted |
| [D002](002-pivot-to-versioned-coordination.md) | Pivot to a versioned Java/Spring coordination boundary | Accepted |

Decision records in this directory must cite supporting research and spike
results. S010 supported an isolated managed JDT runtime with private Equinox
state outside the fixed distribution. S011 then supported the real
classpath-callback-to-`server.port` flow on macOS arm64/JDK 25 and retained the
unhandled Spring client requests and cleanup defect. D002 therefore selects
Pivot rather than Go, Limited, or Stop. The next decision work is a reviewed
coordinator ownership/protocol and product architecture plan, followed by the
initial-public-source audit required by D001.

Use [template.md](template.md) after sufficient evidence exists.
