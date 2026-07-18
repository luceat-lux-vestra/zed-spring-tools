# Known limitations

This repository is ready to be reviewed as experimental source with one working
vertical slice. It is not ready to be relied on as a Spring development
extension.

- A small set of capabilities is proven on the one tested tuple: Spring Boot
  property/YAML completion and validation, and Spring workspace symbols (beans,
  the request-mapping endpoint, and stereotypes reachable through Zed's project
  symbol search). Most VS Code Spring Tools capabilities are still unimplemented
  or unverified. Corrected 2026-07-18: Zed 1.11.3 can use the server's LSP
  Document Symbols for Outline and Breadcrumbs when the default-off Java
  `document_symbols` setting is enabled. The earlier zero-request run was the
  default tree-sitter control. S015 found a clear nested JDT/Spring merge and
  correct Spring navigation after both servers were ready, but Refuted the route
  on restart: Spring answered before JDT's later dynamic registration, and Zed
  cached a Spring-only Outline that omitted ordinary Java symbols until a source
  edit forced recollection. The verified Project Symbols workflow remains the
  fallback; the opt-in Structure document remains planned.
- Stock Zed extensions cannot contribute a custom Spring tree/dashboard panel,
  webview, arbitrary editor item, or arbitrary command-palette action. D005
  therefore selects standard LSP/DAP/task surfaces first and explicitly requested
  Structure/Live documents only where grouping or a table is essential. Those
  generated documents, CodeLens adaptation, Run/Debug generation, and live-data
  UX are plans, not implemented capabilities. The full preferred and fallback
  mapping is in `docs/capability-delivery-plan.md`.
- The final upstream audit found no hidden extension shortcut for those missing
  surfaces. Extension slash commands are removed, internal CodeLens task
  scheduling is not exported to extension LSP adapters, general
  `window/showDocument` is not supported by Zed's project LSP client, and
  Project Symbols does not render `containerName` as a hierarchy. URLs therefore
  require a verified Document Link/Markdown link plus copyable text fallback.
- There is no packaged extension, installer, release artifact, product CI, or
  Marketplace entry. Installation means a local development extension.
- The disposable code under `spikes/` is evidence harness code. It is not a
  product implementation and will not be promoted directly into one.
- Only one macOS arm64/JDK 25 tuple has completed the integrated PoC. Every
  other desktop and runtime tuple is untested.
- The product requires the official Zed Java extension. It does not replace Java
  debugging, tests, tasks, project import, or other Java ownership, and it will
  not offer a reduced standalone JDT fallback.
- Official Java 6.8.23 passed S016's versioned bridge, callbacks, product-owned
  cleanup, warm-cache, and ordinary-profile Maven Boot main-runnable gates on
  macOS arm64/JDK 25. It is still not a shipped companion: the product remains
  pinned to 6.8.21 until a separate compatibility-table change is reviewed.
  Gradle/vanilla task execution, test runnables, and debugging remain untested.
- Zed's Java 6.8.23 generated runnable resolves `java-task-helper` below the
  default Zed data directory. It works in the ordinary profile but fails under
  a custom `--user-data-dir`; this affects isolated evidence profiles.
- In S016, worktree closure twice left the official Java JDT child reparented to
  PID 1 and its official port file stale after the proxy exited. Product-owned
  coordinators, Spring servers, routes, and extension state were already gone.
  This official-Java/Zed lifecycle uncertainty remains open and must not be
  mistaken for a product uninstall failure.
- The coordinator depends on a private Java-provider transport that the official
  Java extension does not document as public API. A future Java extension release
  may change it and break this project. The versioned adapter narrows that risk
  but cannot remove it.
- The PoC and the M2 slice prove attributable Spring Boot property completion and
  the cleanup path. They do not prove the rest of VS Code Spring Tools capability
  parity.
- **Installing the extension with a Java project already open needs a Zed
  restart.** The bridge that carries Spring's classpath information into the Java
  language server is contributed when that server starts. If the Java server is
  already running when the extension is installed, it is not re-queried and runs
  without the bridge, so Spring features that need the classpath (completion,
  validation) stay dead until Zed is restarted. Installing the extension before
  opening a Java project avoids this, and it works on a cold cache. Confirmed in
  `docs/spikes/014-jdtls-bundle-startup-ordering.md`.
- **First-use Spring artifact acquisition hangs, and it reproduces.** After a
  fresh `install dev extension`, the first download stalls with no bytes
  transferred, no open connection to the release host, no timeout, and Zed idle
  at roughly zero CPU, showing only an indefinite `Downloading
  zed-spring-tools...`. Quitting and relaunching Zed makes the same download
  complete in seconds. Observed twice on 2026-07-17: once stalling 24 minutes,
  then finishing in under 12 seconds after a restart; and once stalling over 3
  minutes, then delivering 79 MB within 10 seconds of a restart. The network was
  healthy both times, verified independently at about 4.9 MB/s.
  **Workaround: if acquisition appears stuck, quit and reopen Zed.** Zed's
  `download_file` API accepts no timeout, so the extension cannot currently bound
  or retry it. The cause is not established.
- The missing/incompatible-Java diagnostic is implemented and, as of 2026-07-18,
  observed at runtime: the coordinator refuses to start on an incompatible JDK or
  an unverified official-Java-extension contract, naming the reason, instead of
  entering a reduced mode. Only the single macOS arm64 tuple has been exercised.
- `sts/javaType`, its eight sibling `sts/java*` server→client requests, and the
  Boot-project `sts/project/gav` request are handled by the coordinator, which
  routes them to the official Java extension.
  As of 2026-07-18 `sts/javaType` is observed at runtime — the Spring server
  issued a real request during indexing and the coordinator routed it to the
  official Java `sts.java.type` command and answered it — so it is `verified`;
  the eight siblings and `sts/project/gav` share that path and its contract test
  but were not each exercised individually. The GAV route removes a transport
  prerequisite for executable Boot-project discovery; it does not yet provide a
  user-facing Zed discovery workflow. `vscode-spring-boot.ls.start` is a VS Code
  client command, not a coordinator request: Zed owns language-server
  start/restart and the coordinator already wires the classpath bridge, the
  Java-data route, and classpath listening that command's callback performs.
- No Spring VSIX, JAR, JDT LS distribution, Zed application, or other third-party
  binary is stored in Git. Reproduction requires separately acquired, pinned,
  checksum-verified inputs.
- The extension downloads the pinned, checksum-verified Spring Tools
  `5.2.0.RELEASE` VSIX from its official GitHub release on first use. It requires
  network access for that download and does not mirror or repackage the artifact.
- S016 verified one warm cached start with outbound network denied on macOS
  arm64/JDK 25. Offline installation, rollback, and project-operated
  redistribution remain undecided. Repackaging or mirroring stays blocked on a
  complete third-party license inventory and an appropriate review.
- SSH remote development and WSL-hosted remote projects are not in the initial
  product scope.

The reviewed delivery gates and remaining work are tracked in
[`docs/implementation-plan.md`](docs/implementation-plan.md).
