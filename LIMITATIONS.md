# Known limitations

This repository is ready to be reviewed as experimental source with one working
vertical slice. It is not ready to be relied on as a Spring development
extension.

- The Spring Boot upgrade is delivered only in the shape the pinned Spring Tools
  release actually implements, and that shape is narrow. It upgrades the **patch
  version of a Maven project** and nothing else: the server asserts the same
  major and minor version and rejects anything else, its major/minor "full
  OpenRewrite conversion" quick fixes are never offered because the release
  returns no target version for them, and Gradle projects are rejected outright.
  The upgrade is reached from the version-validation quick fix, whose diagnostic
  anchors at the **first character of the build file**; the pom inlay hint that
  carries the same command in VS Code renders in Zed but does nothing when
  clicked, because stock Zed does not execute an inlay hint's label command.
  The pinned release also throws before changing anything when Maven has no user
  settings file, so on a machine without `~/.m2/settings.xml` the upgrade cannot
  run at all; the extension reports that as a visible error naming the remedy
  rather than failing silently, but it does not create or modify Maven
  configuration on the user's behalf.
- 48 of 59 tracked capabilities are proven on the tested tuple, and part of the
  VS Code Spring Tools surface is still unimplemented or unverified. The proven
  set is the properties/YAML line (completion, hover, validation, definition,
  `.properties`↔`.yaml` conversion, shared-metadata reload, and the
  `spring-factories` / `jpa-query-properties` languages), Spring workspace
  symbols with bean and request-mapping navigation, static and live CodeLens,
  inlay hints, quick fixes, Boot run/debug configuration generation, the
  Structure document, and explicit plus automatic
  live-process/metrics/logger workflows, remote live-data targets, the
  patch-level Boot upgrade described above, Boot version/support validation,
  embedded query syntax highlighting under the setting described below, and
  Spring Modulith metadata refresh with application-module structure. Modulith
  metadata generation runs Spring Modulith's own exporter against the compiled
  classes, so an uncompiled project is refused whatever the build system; a
  2026-07-29 Gradle gate confirmed the precondition is the compiled classes and
  not Maven. See the
  [capability inventory](docs/capability-inventory.md) for the per-row evidence.
  Corrected 2026-07-18: Zed 1.11.3 can use the server's LSP
  Document Symbols for Outline and Breadcrumbs when the default-off Java
  `document_symbols` setting is enabled. The earlier zero-request run was the
  default tree-sitter control. S015 found a clear nested JDT/Spring merge and
  correct Spring navigation after both servers were ready, but Refuted the route
  on restart: Spring answered before JDT's later dynamic registration, and Zed
  cached a Spring-only Outline that omitted ordinary Java symbols until a source
  edit forced recollection. The verified Project Symbols workflow remains the
  fallback; the opt-in Structure document is the verified grouping companion.
- **Embedded query highlighting needs one Zed setting that no extension can set
  for you.** The JPQL, HQL, SQL and SpEL text inside a `@Query` or `@Value` is
  highlighted by Spring's LSP semantic tokens, and Zed's `semantic_tokens`
  language setting defaults to `"off"` — meaning it asks no language server for
  tokens at all. Set it to `"combined"` (tree-sitter as the base) or `"full"`;
  the extension supplies the Spring-side half itself. Corrected 2026-07-29: this
  capability was recorded as blocked on a missing Zed API for eight days, and it
  was not. S017 read the zero requests as Zed having no semantic-token path for
  Java, on a control — the official Java server's own static declaration drawing
  no request either — that is exactly what a default-off global switch produces.
  It is the same trap as the `document_symbols` correction above, and both
  settings live in the same block of Zed's defaults. Two caveats remain, both
  measured: Spring answers with tokens for the **whole** Java file rather than
  only the embedded region, so `boot-java.embedded-syntax-highlighting: false` is
  the way to drop back to tree-sitter without giving up the official Java
  server's tokens; and on a cold start the first request can return nothing,
  because a transient upstream `NullPointerException` in Spring's token handler
  answers null and **Zed caches that per buffer and does not ask again on
  refocus**. Any edit, or opening a different Java file, restores it in well
  under a second.
- **Gradle is driven, with exactly one exception: the Boot upgrade.** Until
  2026-07-29 every capability gate had used a Maven fixture and the whole build
  system axis was unobserved. It was then driven end to end against two Gradle
  fixtures — a Boot 3.5.0 web app and a Spring Modulith 1.4.12 app — and the
  outcome is that the build system is not a dividing line anywhere except that
  one row. Property completion and validation, the Java reconcilers, Spring Data
  query and SpEL diagnostics, cron, CodeLens and every product code action, Boot
  project info (reporting `gradle build`), Boot version and support validation
  (anchored on `build.gradle`), run/debug generation *and execution*, Modulith
  metadata refresh, the module-violation diagnostic, and the embedded MCP
  server's index-backed tools were all observed working on Gradle. The generated
  `./gradlew bootRun` entries were run verbatim and served the application, with
  the profile entry moving the port exactly as its profile file specifies, so
  the Gradle profile form is verified rather than merely written.
  **The Boot upgrade is genuinely Maven-only**, in upstream's code rather than
  in this extension: the pinned release attaches its upgrade quick fix only when
  the project's build type is Maven, and the command behind it asserts the same
  thing. A Gradle user still gets the version diagnostic and the "read the
  release notes" action; what is missing is the one-click upgrade, and there is
  no fallback for it other than editing the build file.
  **Two Gradle-shaped things remain untested**: the Windows wrapper forms
  `mvnw.cmd` and `gradlew.bat`, which need a Windows host and are blocked for
  the same reason the rest of the platform matrix is, and multi-project Gradle
  builds, where a subproject without its own wrapper deliberately resolves to
  the bare `gradle` from `PATH`. Both are covered by contract tests, which is
  not the same as a driven gate. Spring's own `sts.gradle.build` command has no
  caller in the pinned release, so no Gradle build reaches this extension
  through Spring at all — that is an absent upstream surface, not a gap here.
  Evidence and the per-row detail are in the
  [Gradle axis resolution](docs/gradle-axis-resolution.md).
- The official Java language server starts only when a Java file is open, and
  this extension cannot start it. Zed's extension API exposes no call for
  starting another extension's language server, and `languages.<Language>.
  language_servers` only orders the servers already declared for that language:
  a 2026-07-20 driven run added `jdtls` to `languages.Properties.language_servers`
  and opened only `application.properties`, and Zed started this extension's
  coordinator alone; opening one `.java` file in the same session immediately
  started the official Java proxy. Until that server runs, Spring has no project
  classpath, so property support is limited to syntax — unknown-property
  validation, metadata completion and hover all need the classpath. The
  coordinator now says so once, naming the action that works (open a Java file),
  instead of reporting a compatibility failure; a genuine handshake failure
  after a Java file is open still raises the bounded compatibility report.
  **The reach is wider than properties**, and a 2026-07-26 run measured one case
  precisely: Spring resolves a document to a project by containment against the
  projects the classpath listener has delivered, so with none delivered
  *everything* project-scoped is silent for every file in the worktree.
  `spring.factories` validation is the sharpest example — its reconciler collects
  problems only inside `projectFinder.find(uri).ifPresent(…)`, so before a Java
  file is open it publishes no diagnostic array at all, which is
  indistinguishable from a clean file. Opening one Java file first restores it.
- Stock Zed extensions cannot contribute a custom Spring tree/dashboard panel,
  webview, arbitrary editor item, or arbitrary command-palette action. D005
  therefore selects standard LSP/DAP/task surfaces first and explicitly requested
  Structure/Live documents only where grouping or a table is essential. Those
  generated documents and Run/Debug generation are implemented. CodeLens
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
- Following from the same gap: a Spring action that asks the client to *open a web
  page* — the release-notes and Tanzu commercial-support quick fixes on a
  build-file version diagnostic — cannot open your browser by itself. The
  coordinator answers that request with a dismissible notice carrying the page
  address as a Markdown link, so reaching the page is one click of yours rather
  than none. The address is always shown as its own link label, and an address
  with embedded credentials is shown redacted and unlinked.
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
  isolated-profile DAP helper path remains an S016 caveat. Maven multi-project
  selection is verified. **Gradle is verified too, as of 2026-07-29**: the action
  generated `./gradlew bootRun` with the profile forwarded as
  `--args=--spring.profiles.active=<p>`, and both the base and `dev` commands
  were run verbatim and served `GET /greeting`, the `dev` one on the port its
  profile file sets. The Windows wrapper forms (`mvnw.cmd`/`gradlew.bat`) and
  multi-project *Gradle* selection remain untested. The synthetic action offers
  on any Java file, not only Boot mains.
- The Data AOT CodeLenses (`CL-4a`, `CL-4e`) no longer start a build when
  clicked. Spring's own handler for those commands runs Maven inside the
  language-server process and never reads its output: it reports nothing on
  success, replaces Maven's diagnostic with a Java stack trace on failure, and
  hangs indefinitely once the output fills the pipe — a 2026-07-24 direct drive
  measured no response in 300 s for a build that takes 5 s with its output
  drained. The extension answers the command by writing one reviewable
  `.zed/tasks.json` entry instead, and the user starts it from the `task: spawn`
  picker. That is one extra step, and it is deliberate. The generated task is
  contract-tested; clicking the lens and running the task in real Zed is not yet
  driven-verified. Spring's `sts.gradle.build` command has no caller in the
  pinned release, so no Gradle build reaches this route at all; Gradle and
  arbitrary Maven goals stay official-Java and manual Zed task ownership.
- Automatic local live-data connection is verified on the 2026-07-23 macOS
  arm64 tuple. It remains off unless
  `boot-java.live-information.automatic-connection.on` is explicitly true.
  Generated Java debug entries then include reviewable local JMX/Actuator and
  project-identity properties. The coordinator connects only one process whose
  identity matches an executable Boot project in the worktree; missing identity
  or multiple matches do nothing and leave the explicit process action as the
  fallback. The driven Zed run proved automatic discovery and confirmed live
  data, manual disconnect without reconnection across subsequent polls, debug
  stop, and owned-process cleanup. Other desktop/JDK tuples remain untested.
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
  other desktop and runtime tuple is untested at runtime. The declared Java
  floor is the one exception: Temurin 21.0.11 ran the M5 portability core on
  macOS arm64 on 2026-07-26. JDK 22, 23 and 24 remain untested, and 24 is not
  interpolation — official Java changes the JDT LS command line at 24 or newer.
- The compatibility notification is still a one-shot claim about the whole
  official Java route, so it names the requirement rather than the request that
  failed. It now waits for evidence that the requirement is genuinely unmet — a
  data-route failure is only reported once it outlives the sixty-second
  handshake window, and never after the route has already answered — which is
  what the notice was already doing for the classpath route. A route that stays
  broken is still reported; a bounded import-time timeout no longer is.
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
  `5.3.0.RELEASE` VSIX from its official GitHub release on first use. It requires
  network access for that download and does not mirror or repackage the artifact.
  The pin moved from `5.2.0.RELEASE` on 2026-08-01 through the refresh gate; most
  capability evidence below and in the inventory was recorded against
  `5.2.0.RELEASE` and each row names the release its evidence belongs to.
- Offline behaviour is verified on macOS arm64/Zed 1.12.0/JDK 25 (2026-07-26),
  with outbound network denied to Zed, the coordinator, and the JVMs alike. A
  first install without network **fails closed**: the error names the pinned
  release and the exact artifact URL, no partial archive or installation is left
  behind, and no reduced mode starts. A warm installation needs no network for
  anything except Spring's version and support validation, which degrades to an
  empty diagnostic set — you lose the update/support advice, you are never shown
  stale advice. A corrupted installed jar is repaired offline from the cached,
  checksum-verified VSIX; if that archive is also damaged it is deleted rather
  than used and the existing installation is left untouched, because a new
  installation is only ever activated by renaming a validated staging directory
  into place. Offline *installation* therefore remains impossible by design (the
  VSIX must be fetched once), and rollback between two different pinned Spring
  Tools releases is untested because only one release is pinned. Project-operated
  redistribution remains undecided; repackaging or mirroring stays blocked on a
  complete third-party license inventory and an appropriate review.
- SSH remote development and WSL-hosted remote projects are not in the initial
  product scope.

The reviewed delivery gates and remaining work are tracked in
[`docs/implementation-plan.md`](docs/implementation-plan.md).
