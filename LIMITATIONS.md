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
  generated documents and Run/Debug generation remain plans. CodeLens
  adaptation is implemented; its connected-process endpoint, bean, injection,
  click and native-Hover path is verified on the first macOS tuple. All five
  static Spring providers now have product activation, contract tests, and a
  dedicated maintainer acceptance fixture, and each family has been observed.
  Data AOT `CL-4d` now pre-resolves and caches Spring's authentic target, then
  rewrites the lens to Zed's supported location command. A driven click opened
  the exact generated method while `/target/` remained ignored. Aggregate live-
  data UX remains a separate concern. The full preferred and fallback mapping is in
  `docs/capability-delivery-plan.md`.
- The final upstream audit found no hidden extension shortcut for those missing
  surfaces. Extension slash commands are removed, internal CodeLens task
  scheduling is not exported to extension LSP adapters, general
  `window/showDocument` is not supported by Zed's project LSP client, and
  Project Symbols does not render `containerName` as a hierarchy. URLs therefore
  require a verified Document Link/Markdown link plus copyable text fallback.
- Spring's AI-only CodeLens provider is enabled by this product independent of
  Zed's AI setting. Stock Zed exposes no public extension/CodeLens API to read
  authoritative Agent state or open/prefill Agent, so this project can only keep
  the requested blocked lens visible and avoid sending its prompt or source to
  AI. The shipped notice explicitly states those boundaries. Direct integration
  still requires an upstream Zed API.
- Zed exposes no extension-controlled way to keep arbitrary Maven `target/`
  files but sort them last in the file finder. The showcase owns `/target/` in
  its local `.gitignore`; other projects retain their own `.gitignore` or local
  `.git/info/exclude` policy. `file_scan_exclusions` is stronger—it removes paths
  from scans, searches, and the tree—and is not an automatic product fallback.
- The Boot run/debug configuration Code Action generates `.zed/tasks.json`
  (wrapper-aware `spring-boot:run`/`bootRun`) and `.zed/debug.json`
  (`"adapter": "Java"` launch). A 2026-07-19 driven run (macOS arm64, Zed 1.11.3,
  official Java 6.8.21, JDK 25) verified discovery, generation, and that the
  generated run task's `mvn spring-boot:run` launched the Boot app and served
  `GET /greeting`. A second driven check generated `dev`/`prod`/`staging` picker
  entries and launched the `dev` Java debug configuration after editing its
  `vmArgs`, `args`, and `env` slots. The official Java 6.8.21 debug helper uses an
  HTTP `localhost` callback, so a system HTTP proxy must bypass `localhost` and
  `127.0.0.1`; otherwise main-class resolution times out before launch. The
  isolated-profile DAP helper path remains an S016 caveat. Still unobserved:
  multi-project selection. Windows wrapper forms (`mvnw.cmd`/`gradlew.bat`) are
  untested. The synthetic action offers on any Java file, not only Boot mains.
- Profile discovery and the editable slots are best-effort, not exhaustive.
  Profiles come from `application-<profile>.{properties,yml,yaml}` filenames and
  multi-document `application.{yml,yaml}` activation (`spring.config.activate.on-profile`
  and legacy `spring.profiles`); profiles defined only inside a single
  `application.properties`, or expressed as negations/booleans (`!test`,
  `prod & cloud`) where each identifier still becomes its own entry, are not
  modelled precisely — edit the generated slots for those. The installed official
  Java 6.8.21 debug schema and its upstream documentation define the generated
  `vmArgs`/`args`/`env` fields; a driven launch accepted an edited value in each
  slot. Per-project profile entries are capped at eight; the overflow is named in
  the confirmation notice.
- Config-file merge is deliberately conservative and can lose formatting. The
  writer creates the file when absent and, for a plain JSON array, replaces only
  its own `Spring Boot (zed-spring-tools):` labelled entries while keeping foreign
  ones — but it reserializes the array, so a hand-formatted plain-JSON file is
  reformatted. A file containing comments or a non-array shape is never rewritten;
  its generated entries go to a `.zed/<name>.zed-spring-tools.json` sidecar for
  the user to merge by hand. Comments in an existing `.zed` config are therefore
  not merged in place.
- There is no packaged extension, installer, release artifact, or published
  registry entry; product CI runs format, lint, tests, and the WASM release
  build. Installation today means a local development extension.
- The disposable code under `spikes/` is evidence harness code. It is not a
  product implementation and will not be promoted directly into one.
- Only one macOS arm64/JDK 25 tuple has completed the integrated PoC. The
  adapter and coordinator are written for Linux, macOS, and Windows, but every
  other desktop and runtime tuple is untested at runtime.
- The product requires the official Zed Java extension. It does not replace Java
  debugging, tests, tasks, project import, or other Java ownership, and it will
  not offer a reduced standalone JDT fallback.
- Official Java 6.8.23 passed S016's versioned bridge, callbacks, product-owned
  cleanup, warm-cache, and ordinary-profile Maven Boot main-runnable gates on
  macOS arm64/JDK 25. D006 no longer treats an exact release string as the
  compatibility gate; the known route and bridge capabilities are attempted
  optimistically. Gradle/vanilla task execution, test runnables, and debugging
  remain untested.
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
  but cannot remove it. Exact release pre-admission is not required; an actual
  capability failure must be visible and easy to report.
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
  structurally invalid adapter contract, naming the reason, instead of entering
  a reduced mode. D006 removes the embedded self-declared `extensionVersion`
  comparison while retaining structural validation; that policy change has
  contract coverage but has not yet had its own driven Zed run. Only the single
  macOS arm64 tuple has been exercised.
- GitHub Issues cannot be submitted anonymously, and Zed's GitHub sign-in grants
  only `read:user` and exposes no issue-write token to extensions. The product
  now shows a clickable Markdown notification containing a bounded title/body-
  prefilled public issue URL. A non-destructive `Not now` action is required
  because stock Zed immediately drops an actionless `showMessageRequest`. A
  driven Zed click opened the populated GitHub composer in the existing browser
  session; no issue was submitted. It is not automatic telemetry and must never include
  raw logs, paths, classpaths, source, environment variables, or credentials,
  and must direct suspected vulnerabilities to private reporting.
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
