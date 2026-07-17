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
feasibility work. S006 now has a reviewed local end-to-end PoC plan, completed
Gate A disposable implementation and Gate B non-UI preparation. Gate C used its
single setup-only correction: the corrected Spring LS and JDT import succeeded,
but the actual JDT process selected a fresh host cache rather than the reviewed
prepared data path. It stopped before completion/add/callback input and is
Inconclusive, not Refuted. Subsequent exact source review established that the
fixed packaged JDT launcher ignores XDG on Darwin; S007 then tested the
official Java extension's explicit managed-local path. Gate C Run 1 used the
precomputed data path and reached `ServiceReady`, but a fresh XDG root also
gained Gradle version metadata and a proxy record remained after shutdown. Run
2 was deliberately not started, so S007 is Inconclusive. R006 attributed the
catalog to Buildship's cache-miss request and found a separate Java task-helper
latest-release lookup. S008 built and preseeded both fixed inputs, then executed
two corrected isolated runs. Each selected the fixed proxy/JDK/JDT, used exactly
one distinct precomputed `-data`, and reached `ServiceReady`; helper/catalog
bytes stayed fixed and Run 1 data was unchanged during Run 2. The initially
fresh profile nevertheless auto-installed HTML, created unrelated editor state,
and emitted Copilot/ChatGPT authentication warnings. S008 is therefore
Inconclusive under its strict attribution criteria, not Refuted. A new reviewed
profile-attribution spike is required before a Spring end-to-end plan. R007
subsequently established that trust and HTML were fixed defaults, Copilot read
outside `--user-data-dir` through the XDG config fallback, and native-agent
provider enumeration caused the ChatGPT warning. S009 Gate A now has a reviewed
transactional preparation tool and synthetic tests for one controlled run; no
real S009 preparation or runtime exists yet.
Platform validation follows incrementally after a later local PoC and initial
public source release; multiplatform claims still require the declared matrix.

Tentative sequence:

| ID | Experiment | Status |
| --- | --- | --- |
| [S001](001-zed-dev-extension-lifecycle.md) | Load a minimal local Zed extension and observe process lifecycle | Refuted on macOS arm64: probe did not observe `exit` before termination |
| [S002](002-spring-ls-standard-lsp-baseline.md) | Run the Spring LS standard-LSP baseline with JDT classpath disabled | Refuted on macOS arm64: transport worked, but metadata-aware results were empty |
| [S003](003-jdtls-synthetic-bundle-injection.md) | Inject one synthetic JDT LS bundle through a second adapter | Supported on macOS arm64/JDK 25; other targets untested |
| [S004](004-spring-jdt-bundle-command.md) | Load pinned Spring JDT bundles and execute one command | Supported on macOS arm64/JDK 25; other targets untested |
| [S005](005-classpath-callback-routing.md) | Intercept and route one classpath callback in disposable proxy code | Supported on macOS arm64/JDK 25 after fresh Gate D controls and a direct Spring `SUCCESS [done]`; other targets untested |
| [S006](006-spring-boot-end-to-end.md) | Populate the real Spring project cache and prove `server.port` completion through Zed | Inconclusive on macOS arm64/JDK 25 before hypothesis input; actual JDT data path missed the reviewed prepared runtime |
| [S007](007-managed-jdt-data-isolation.md) | Prove official Java managed-local JDT startup uses two explicit isolated data paths | Inconclusive on macOS arm64/JDK 25 after Run 1: expected direct data path worked, but update/network attribution and cleanup were insufficient; Run 2 not started |
| [S008](008-preseeded-managed-jdt-isolation.md) | Repeat managed-local JDT isolation twice with fixed helper/catalog inputs | Inconclusive on macOS arm64/JDK 25 after two direct-path successes: fresh-profile extension/provider state violated attribution; other targets untested |
| [S009](009-attributed-isolated-profile.md) | Compose source-controlled profile/XDG settings with one fixed managed-JDT start | Gate A complete and reviewed; Gate B not started |

Use [template.md](template.md) before adding any spike code.

The sequence comes from [R004](../research/004-integration-structure-candidates.md).
Artifact inputs must follow [R005](../research/005-distribution-and-licensing.md):
use the pinned official VSIX or a user-supplied extraction, verify its digest,
and do not commit or republish binary artifacts.
