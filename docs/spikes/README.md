# Spike Index

Source-based research is complete. S001 and S002 have been executed on the local
macOS arm64 host. S002 proved direct Spring LS startup and standard transport,
but its limited-mode value hypothesis was refuted because all metadata-aware
properties probes returned empty results. Spring LS also returned a nonstandard
string result to the LSP shutdown request.

Each spike still requires its own written plan and success/failure criteria
before disposable code is added.

The [prerequisite and platform matrix](prerequisites.md) is approved for
feasibility work. Multiplatform claims require evidence from the declared
OS/architecture matrix, not only the local macOS host.

Tentative sequence:

| ID | Experiment | Status |
| --- | --- | --- |
| [S001](001-zed-dev-extension-lifecycle.md) | Load a minimal local Zed extension and observe process lifecycle | Refuted on macOS arm64: probe did not observe `exit` before termination |
| [S002](002-spring-ls-standard-lsp-baseline.md) | Run the Spring LS standard-LSP baseline with JDT classpath disabled | Refuted on macOS arm64: transport worked, but metadata-aware results were empty |
| [S003](003-jdtls-synthetic-bundle-injection.md) | Inject one synthetic JDT LS bundle through a second adapter | Gate B fixed artifacts prepared; isolated Zed runtime pending |
| S004 | Load pinned Spring JDT bundles and execute one command | Proposed |
| S005 | Intercept and route one classpath callback in disposable proxy code | Proposed |

Use [template.md](template.md) before adding any spike code.

The sequence comes from [R004](../research/004-integration-structure-candidates.md).
Artifact inputs must follow [R005](../research/005-distribution-and-licensing.md):
use the pinned official VSIX or a user-supplied extraction, verify its digest,
and do not commit or republish binary artifacts.
