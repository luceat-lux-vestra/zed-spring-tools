# Spike Index

Source-based research is complete. S001 through S005 have been executed on the
local macOS arm64 host. S002 proved direct Spring LS startup and standard
transport, but its limited-mode value hypothesis was refuted because all
metadata-aware properties probes returned empty results. S003 supported the
cross-extension synthetic JDT bundle-injection mechanism, and S004 supported
the fixed Spring JDT bundle set plus one imported-project command. S005 then
supported one authentic, result-correlated classpath callback through disposable
proxy instrumentation on the tested tuple.

Each spike still requires its own written plan and success/failure criteria
before disposable code is added.

The [prerequisite and platform matrix](prerequisites.md) is approved for
feasibility work. S006 now has a reviewed local end-to-end PoC plan plus a
completed Gate A disposable implementation and synthetic validation using the
real Spring Boot LS and Spring Java project-data contracts. Its next step is
Gate B fixed-source build and artifact preparation; real Zed execution remains
separately closed in Gate C. Platform validation follows incrementally after
the local PoC and initial public source release; multiplatform claims still
require the declared matrix.

Tentative sequence:

| ID | Experiment | Status |
| --- | --- | --- |
| [S001](001-zed-dev-extension-lifecycle.md) | Load a minimal local Zed extension and observe process lifecycle | Refuted on macOS arm64: probe did not observe `exit` before termination |
| [S002](002-spring-ls-standard-lsp-baseline.md) | Run the Spring LS standard-LSP baseline with JDT classpath disabled | Refuted on macOS arm64: transport worked, but metadata-aware results were empty |
| [S003](003-jdtls-synthetic-bundle-injection.md) | Inject one synthetic JDT LS bundle through a second adapter | Supported on macOS arm64/JDK 25; other targets untested |
| [S004](004-spring-jdt-bundle-command.md) | Load pinned Spring JDT bundles and execute one command | Supported on macOS arm64/JDK 25; other targets untested |
| [S005](005-classpath-callback-routing.md) | Intercept and route one classpath callback in disposable proxy code | Supported on macOS arm64/JDK 25 after fresh Gate D controls and a direct Spring `SUCCESS [done]`; other targets untested |
| [S006](006-spring-boot-end-to-end.md) | Populate the real Spring project cache and prove `server.port` completion through Zed | Gate A disposable implementation and synthetic validation complete; Gate B not started |

Use [template.md](template.md) before adding any spike code.

The sequence comes from [R004](../research/004-integration-structure-candidates.md).
Artifact inputs must follow [R005](../research/005-distribution-and-licensing.md):
use the pinned official VSIX or a user-supplied extraction, verify its digest,
and do not commit or republish binary artifacts.
