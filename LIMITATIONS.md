# Known limitations

This repository is experimental source and is not yet Registry-published. The
2026-09-25 D007 migration replaces the former private JDT/bridge coordination
with Spring Tools' official standalone language server. Historical observations
from the retired architecture remain useful regression evidence, but they do not
establish release support for the standalone runtime until revalidated on the
exact submitted commit.

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
- The inventory still tracks 59 user outcomes, but the former count of 48
  `verified` rows belongs to the pre-D007 runtime evidence baseline. Any row whose
  proof depended on JDT-delivered classpath state, the private Java data route, or
  the injected bridge must be revalidated before it is release-facing
  `verified` on the standalone architecture. Rows whose outcome is independent
  of that boundary retain their historical evidence with the exact release/tuple
  named. See the [capability inventory](docs/capability-inventory.md) for the
  migration status rather than relying on the old aggregate count.
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
  Windows wrapper selection and native path contracts for `mvnw.cmd` and
  `gradlew.bat` are CI-verified on native Windows x86_64 and arm64 hosts. That is
  not a Zed-integrated task-execution gate: actually launching those generated
  wrapper tasks from Zed on Windows remains runtime-unverified. Multi-project
  Gradle builds also remain untested, where a subproject without its own wrapper
  deliberately resolves to the bare `gradle` from `PATH`. Spring's own
  `sts.gradle.build` command has no caller in the pinned release, so no Gradle
  build reaches this extension through Spring at all — that is an absent upstream
  surface, not a gap here. Evidence and the per-row detail are in the
  [Gradle axis resolution](docs/gradle-axis-resolution.md).
- Spring runtime project discovery no longer waits for the official Java/JDT
  server. The standalone Spring Tools server builds its project model from
  Maven/Gradle and Jandex while `enableJdtClasspath` stays false. The official
  Java extension is still required for Zed's Java language/editing experience,
  but opening a Java file is not the activation mechanism for Spring's project
  classpath. The old "open a Java file first" workaround and Java-route
  compatibility report are retired.
- Spring XML Java type/package completion is reduced in the standalone boundary.
  Spring asks the client for `sts/javaCodeComplete`, but Zed exposes no public
  cross-extension request surface that can delegate that request to JDT LS. The
  coordinator fails closed with an empty completion result instead of using the
  official Java extension's private proxy. Other XML features that do not depend
  on that callback require standalone revalidation before a release claim.
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
  profile file sets. Windows `mvnw.cmd`/`gradlew.bat` selection and native path
  handling are CI-verified on x86_64 and arm64, but actual Zed-integrated task
  execution on Windows remains unverified. Multi-project *Gradle* selection also
  remains untested. The synthetic action offers on any Java file, not only Boot
  mains.
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
- Driven Zed desktop evidence predating D007 is centered on macOS arm64/JDK 25
  and used the retired JDT/bridge architecture. It is retained as historical
  product evidence, not standalone support evidence. Current CI separately runs
  the standalone Spring runtime smoke on Linux, macOS, and Windows across
  x86_64/arm64 and runs the real standalone runtime again on the JDK 21 floor.
  Those jobs prove headless portability/runtime behavior only. Exact-final-HEAD
  Zed development-extension validation is still required before Registry
  refresh and release-facing support claims.
- The product requires the official Zed Java extension for Java language
  registration/editing, debugging, tests, tasks, and the ordinary Java
  experience. Spring analysis no longer depends on the Java extension's private
  work directory, proxy, version string, or bridge commands. There is no reduced
  or private JDT fallback: D007 selects the official standalone Spring server
  beside the official Java server.
- S016's official-Java 6.8.23 bridge/callback gates remain historical evidence
  for the architecture D007 superseded. They must not be used as proof that the
  standalone Spring runtime works, and exact official-Java release admission is
  no longer a Spring runtime concept.
- Zed's Java 6.8.23 generated runnable resolves `java-task-helper` below the
  default Zed data directory. It works in the ordinary profile but fails under
  a custom `--user-data-dir`; this affects isolated evidence profiles.
- In S016, worktree closure twice left the official Java JDT child reparented to
  PID 1 and its official port file stale after the proxy exited. Product-owned
  coordinators, Spring servers, routes, and extension state were already gone.
  This official-Java/Zed lifecycle uncertainty remains open and must not be
  mistaken for a product uninstall failure.
- The former private Java-provider transport is removed by D007. Production code
  must not rediscover another extension's work directory, read
  `java/proxy/<worktree>`, call `java-lsp-proxy`, inject a bridge into JDT LS,
  or map Spring callbacks to private `sts.java.*` commands. Reintroducing any of
  those requires a new recorded architecture decision and cannot be a silent
  fallback.
- The PoC and the M2 slice prove attributable Spring Boot property completion and
  the cleanup path. They do not prove the rest of VS Code Spring Tools capability
  parity.
- The old "install while JDT LS is already running, then restart Zed" requirement
  was caused by bridge-bundle injection and is retired with D007. A restart is
  still a valid generic troubleshooting step during development-extension
  testing, but it is no longer a product initialization requirement.
- A first-use download hang was reproducibly observed in 2026-07 on the old VSIX
  acquisition path. D007 downloads a different artifact from Spring's CDN, so
  that observation is not automatically a current defect. First-install,
  restart, offline, corrupt-cache repair, and cleanup behavior for the standalone
  artifact remain release-gate items until exact-final-HEAD Zed validation is
  recorded.
- The extension checks its configured Java executable before starting Spring
  Tools and requires JDK 21 or newer. The former "missing/incompatible official
  Java route" diagnostic and structural provider-schema check were part of the
  retired private transport and no longer describe the standalone runtime.
- GitHub Issues cannot be submitted anonymously, and Zed's GitHub sign-in grants
  only `read:user` and exposes no issue-write token to extensions. The product
  now shows a clickable Markdown notification containing a bounded title/body-
  prefilled public issue URL. A non-destructive `Not now` action is required
  because stock Zed immediately drops an actionless `showMessageRequest`. A
  driven Zed click opened the populated GitHub composer in the existing browser
  session; no issue was submitted. It is not automatic telemetry and must never include
  raw logs, paths, classpaths, source, environment variables, or credentials,
  and must direct suspected vulnerabilities to private reporting.
- The standalone server's remaining client-side Java callbacks are bounded
  explicitly. `sts/project/gav` receives one `null` enrichment per project,
  which preserves the standalone executable-project result without inventing
  coordinates. `sts/javaCodeComplete` receives an empty result, which is the
  known Spring XML Java type/package-completion reduction described above. The
  former `sts/javaType`, sibling `sts/java*`, classpath-listener, and
  `zed.spring.bridge.v1.*` routes are not product contracts.
- No Spring Tools binary, JDT LS distribution, Zed application, or other
  third-party binary is stored in Git. Reproduction acquires the separately
  published standalone Spring artifact using its pinned identity.
- The extension downloads the official
  `spring-boot-language-server-standalone-exec.jar` for Spring Tools
  `5.3.0.RELEASE` / artifact version `2.3.0` from Spring's CDN. Exact size and
  SHA-256 are pinned in `protocol/spring-artifacts.json`; activation rejects a
  mismatched file. The project does not mirror or repackage the artifact.
- The detailed 2026-07 offline gate was run against the retired VSIX/JDT bridge
  installation path. Its fail-closed principles remain requirements, but its
  result is not standalone evidence. The standalone path must still prove:
  first-install offline failure without a usable partial artifact, warm-cache
  startup without re-download, checksum rejection/repair behavior, and clean
  recovery after network access returns. Network-dependent Spring version/support
  diagnostics are also revalidated separately rather than assumed from the old
  gate.
- SSH remote development and WSL-hosted remote projects are not in the initial
  product scope.

The reviewed delivery gates and remaining work are tracked in
[`docs/implementation-plan.md`](docs/implementation-plan.md).