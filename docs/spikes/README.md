# Spike Index

Source-based research is complete. S001 through S004 have been executed on the
local macOS arm64 host. S002 proved direct Spring LS startup and standard
transport, but its limited-mode value hypothesis was refuted because all
metadata-aware properties probes returned empty results. S003 supported the
cross-extension synthetic JDT bundle-injection mechanism, and S004 supported
the fixed Spring JDT bundle set plus one imported-project command on the tested
tuple.

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
| [S003](003-jdtls-synthetic-bundle-injection.md) | Inject one synthetic JDT LS bundle through a second adapter | Supported on macOS arm64/JDK 25; representative platforms pending |
| [S004](004-spring-jdt-bundle-command.md) | Load pinned Spring JDT bundles and execute one command | Supported on macOS arm64/JDK 25; representative platforms pending |
| [S005](005-classpath-callback-routing.md) | Intercept and route one classpath callback in disposable proxy code | Plan reviewed; awaiting user continuation before Gate A |

Use [template.md](template.md) before adding any spike code.

The sequence comes from [R004](../research/004-integration-structure-candidates.md).
Artifact inputs must follow [R005](../research/005-distribution-and-licensing.md):
use the pinned official VSIX or a user-supplied extraction, verify its digest,
and do not commit or republish binary artifacts.
