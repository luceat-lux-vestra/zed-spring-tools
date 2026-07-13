# Spike Index

Source-based research is complete. No spike has begun yet.

Each spike still requires its own written plan and success/failure criteria
before disposable code is added.

Tentative sequence:

| ID | Experiment | Status |
| --- | --- | --- |
| S001 | Load a minimal local Zed extension and observe process lifecycle | Proposed |
| S002 | Run the Spring LS standard-LSP baseline with JDT classpath disabled | Proposed |
| S003 | Inject one synthetic JDT LS bundle through a second adapter | Proposed |
| S004 | Load pinned Spring JDT bundles and execute one command | Proposed |
| S005 | Intercept and route one classpath callback in disposable proxy code | Proposed |

Use [template.md](template.md) before adding any spike code.

The sequence comes from [R004](../research/004-integration-structure-candidates.md).
Artifact inputs must follow [R005](../research/005-distribution-and-licensing.md):
use the pinned official VSIX or a user-supplied extraction, verify its digest,
and do not commit or republish binary artifacts.
