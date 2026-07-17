# S011: Integrated Spring Boot local PoC

- Status: Supported on macOS arm64/JDK 25; cleanup defect retained
- Last updated: 2026-07-17
- Target tuple: macOS 26.5.1 arm64, Zed 1.10.3, Temurin JDK 25.0.3
- Depends on: S003-S005 and S010 Supported; S006-S009 retained as
  Inconclusive prerequisite work

## Objective and hypothesis

This is the final local basic PoC required before the product direction
decision. If S010's fixed managed-JDT component and private configuration are
combined with the unchanged S006 adapter, authenticated Java proxy patch,
Spring stdio proxy, pinned Spring JDT bundles, real Spring Boot LS, and imported
Boot 3.5.5 Maven fixture, then one isolated Zed session can complete the real
classpath handshake and offer `server.port` completion in
`application.properties`.

The same Spring LS process must first return zero `server.port` items while
`enableJdtClasspath` is false. Only after that attributable baseline may the
proxy enable listening, relay the real dynamically generated callback through
JDT LS, receive the real Spring handler result, and allow a later Zed-originated
completion containing exactly one `server.port` item.

## Fixed composition

- Zed 1.10.3 signed arm64 DMG and isolated-profile controls proven by S009-S010.
- Java extension 6.8.21 at commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, built as a
  `wasm32-wasip2` component with only S010's reviewed five-line private-area
  addition.
- JDT LS `1.60.0-202606262232`, pristine tree SHA-256
  `b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583`.
- S006 instrumented native Java proxy, S006 Spring stdio proxy and adapter,
  their already-passed synthetic contracts, and exactly five Spring JDT
  bundles. S011 may not weaken or rewrite their callback/completion logic.
- Spring Tools VSIX SHA-256
  `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3`,
  executable server SHA-256
  `ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1`,
  and its closed set of 168 adjacent libraries.
- The fixed Boot 3.5.5 fixture and resolved metadata JAR already verified to
  contain `server.port`.

All binaries, VSIX/JARs, profiles, worktrees, logs, screenshots, routes, tokens,
and completion payloads remain under ignored `tmp/` roots.

## Allowed disposable implementation

S011 may add only a preparation/verification tool and short reproduction
metadata under `spikes/s011-integrated-spring-boot-local-poc/`. It may reuse the
tracked S006 adapter/proxies/fixture without copying or modifying them and reuse
the tracked S010 Java-extension patch without expanding it.

The preparation tool must transactionally create fresh profile, worktree, four
XDG roots, evidence, pristine JDT, patched Java component, Java-only plus S006
dev-extension index/link, fixed instrumented proxy/debug/helper/catalog, and
the exact Spring artifacts. It must independently derive `D` and
`C = D/configuration`, require both absent, and reject core-module WASM, stale
routes, mutable JDT state, unexpected extensions, dirty fixed source, or an
existing destination.

This remains spike infrastructure. It is not a production extension manifest,
coordinator, installer, cache manager, release workflow, or support claim.

## Pre-runtime verification

Before launching Zed:

1. rerun S006 adapter, Node proxy, Java-proxy patch, and preparation synthetic
   tests plus Rust/Java format, lint, component, and fixed-hash checks;
2. prove the S006 adapter component and S010 Java component are loadable
   component-model binaries and only Java plus the S006 dev extension are
   registered;
3. require a fresh Maven fixture without generated Eclipse/build state, fresh
   `D`/`C`, pristine JDT, empty routes/evidence, fixed catalog, and absent
   proxy/JDT/Spring processes; and
4. review the generated settings and manifests before any normal-Zed stop.

## One bounded runtime

After warning the user not to interact:

1. stop normal Zed, mount/reverify the fixed app, refresh the fixed catalog once,
   and launch the isolated profile in the foreground with all four XDG roots
   and both Copilot token variables absent;
2. require one patched Java component, instrumented proxy/JDT LS with the exact
   S010 `C`, shared configuration and `D` vector, one S006 adapter/proxy, and one
   real Spring child using the closed 168-library set;
3. require JDT `ServiceReady`, Maven fixture import, six debug-plus-Spring
   bundles, and Spring initialization with `classpathEnabled=false`;
4. open only the fixed `application.properties` at `(0,3)`. Require the first
   Zed-originated completion to contain zero `server.port` items;
5. require one real Spring dynamic callback ID, add-listener relay, authentic
   JDT classpath event, real Spring handler result `"done"`, and project-cache
   readiness. Neither proxy may synthesize or rewrite success/completion data;
6. require a later exact Zed-originated completion to contain one structurally
   preserved `server.port` item and visibly offer it in Zed;
7. remove the listener, stop all isolated processes, explicitly clean only
   retained owned routes after process absence, verify the pristine JDT tree,
   detach the app, and restore normal Zed.

No retry is allowed after a real baseline completion, add-listener request, or
classpath callback. A pre-child or pre-baseline setup error may be corrected
only with wholly fresh final roots while preserving the rejected evidence.

## Success, refuted, and inconclusive criteria

S011 is **Supported on macOS arm64/JDK 25** only when all fixed identities and
isolation controls pass, the real baseline is empty, the authentic callback and
Spring cache transition complete, the later Zed completion contains exactly one
`server.port`, no proxy manufactures the item, the JDT distribution remains
pristine, and shutdown/restoration pass.

S011 is **Refuted on this tuple** if the fixed hypothesis input is reached but
the real callback cannot populate the Spring project cache, the later real
Spring completion lacks `server.port`, or the unchanged S006 coordination seam
cannot preserve the required result.

S011 is **Inconclusive** for wrong/mutable inputs, server or UI attribution
failure, stale state, unexpected extension/provider/process/path, premature
termination, missing evidence, or any condition that prevents the fixed
hypothesis input from being tested cleanly.

## Plan review record

Reviewed before implementation on 2026-07-17. The review chose a new spike
instead of reopening S006, reused rather than duplicated its already-tested
protocol code, replaced S006's invalid Darwin launcher/data assumption with the
Supported S010 managed-JDT path, retained the before/after completion control,
required real Zed-originated evidence, preserved strict fresh-state and
no-synthesis rules, and excluded every production or multiplatform claim.

## Preparation and pre-runtime verification record

The reviewed disposable preparation implementation was completed on
2026-07-17 without adding product scaffolding or changing the S006 protocol
code. `PrepareS011` accepts only fixed local inputs and transactionally creates
the isolated profile, Spring fixture worktree, four XDG roots, and evidence
root. It verifies component-model WASM headers, exact Java/JDT/proxy/adapter/
Spring/JDK identities, the closed 168-library server class path, five bundle
hashes, the Java-plus-S006 extension index, the one allowed development link,
fresh runtime paths, empty state/evidence/routes, token absence, and process
absence.

The final ignored preparation roots use profile
`tmp/s011-profile-final-20260717`, Unicode/space worktree
`tmp/s011 Spring Boot PoC 한글 20260717`, the four corresponding
`tmp/s011-xdg-*-final-20260717` roots, and
`tmp/s011-evidence-final-20260717`. The derived JDT data suffix is
`ce1ccd15725f4635025436e2e97c010844f0f048`; both its data directory and
`configuration` child were absent after preparation. The combined extension
index SHA-256 is `89cc4dadeaaf9a2e582bb0927b1abbc7c0dbf11b7c2d47919f528746c29bc9`.

Pre-runtime checks passed with Temurin 25.0.3 and Rust 1.97.0: Java
warning-as-error compilation and the S011/S006 preparation self-tests; Node
syntax and complete Spring-proxy self-test; S006 adapter formatting, five
locked tests, warnings-denied Clippy and `wasm32-wasip2` check; instrumented
Java-proxy formatting, six locked tests and warnings-denied Clippy; JSON
parsing, fixed hashes, allowlists, symlink target, and absence of runtime
processes. At this checkpoint no Zed, JDT, Spring child, completion request,
callback, or UI automation had run for S011.

One pre-runtime correction is retained: the first S011 preparation rejected an
incorrect manually expanded Spring library-set digest copied from an earlier
abbreviated prose reference. The tool constant was corrected to the exact
fresh S006 manifest value
`f1fe021fac5e94bd394ee2be1792dd385b5ce30bd527c67e7c7e77d87aeea56c`;
the wholly fresh final roots were created only after that verification passed.
No hypothesis input or server process had started.

## Bounded runtime result

The single final runtime ran on 2026-07-17 with the fixed composition and fresh
roots above. It is classified **Supported on macOS arm64/JDK 25** for the stated
functional hypothesis. The same real Spring Boot LS child returned zero
`server.port` items at baseline, received the authentic JDT classpath callback,
populated its project cache, and returned exactly one structurally preserved
`server.port` item to a later Zed-originated completion request. The item was
also visible in Zed. This is a local PoC result, not a product-readiness or
multiplatform support claim.

### Confirmed facts

1. The mounted signed application reported Zed 1.10.3. The session selected the
   patched Java component, pristine JDT LS `1.60.0-202606262232`, explicit
   worktree data directory `D`, private configuration directory
   `C = D/configuration`, one unchanged S006 adapter/proxy pair, one real Spring
   child, the fixed five Spring JDT bundles, and the closed set of 168 Spring
   libraries.
2. JDT LS imported the fixed Maven fixture and emitted `ServiceReady`. Spring LS
   initialized with classpath integration disabled before the controlled
   transition.
3. The evidence sequence recorded the exact fixture text, a Zed-originated
   baseline request, and a matching child/write response with
   `serverPortCount: 0` and digest
   `e6126aba3e32885f7a50ff693eeb6530d762d534c7e894da95d6c10985a43b8f`.
4. The same sequence then recorded the Java route, successful enable command,
   real dynamically generated Spring callback route, JDT add result, callback
   with six arguments, and the real Spring handler string result. A readiness
   probe subsequently found one `server.port` item.
5. A later Zed-originated request, child response, and Zed write each recorded
   exactly one `server.port` item with the same digest
   `fa60a2c41bf0531b828c36f3de56fa0d191b2cf96f84bf33826dcf4818ef95aa`.
   The proxy did not synthesize or rewrite that completion.
6. The completion menu visibly offered `server.port` with type `int`. Filtering
   to `server.po` was performed only after the protocol success record so that
   the item could be captured unambiguously; the editor was then restored to
   the original `ser` text before shutdown, and the fixture on disk remained
   `ser\n`.
7. Spring's disable path logged removal and successful unregistration of the
   generated callback. The proxy nevertheless recorded `jdt-remove-failed` for
   its automatic relay. After Spring had disabled its listener, a direct request
   through the same authenticated Java-proxy route returned a string result for
   `sts.java.removeClasspathListener`. This retained cleanup defect did not
   alter the earlier functional result.
8. The isolated Zed process exited with status 0. The Spring child remained for
   less than its existing five-second shutdown timer and then exited without a
   kill. All isolated Zed, Java proxy, JDT, Spring proxy, and Spring child
   processes were absent before cleanup. Owned route files were removed only
   after process absence, the mounted app was detached, and the normal
   `/Applications/Zed.app` session was restored.
9. JDT's post-run full tree SHA-256 remained
   `b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583`.
   Runtime-private Equinox state existed only under `D/configuration`.

### Evidence and primary references

The ignored runtime evidence remains under
`tmp/s011-evidence-final-20260717` and
`tmp/s011 Spring Boot PoC 한글 20260717/.s006-evidence`. These files are local
machine evidence and are intentionally excluded from source publication.

- `spring-proxy.jsonl`: SHA-256
  `526431c6a89c270d873051f9773af8481cd71656cf3da8dcbb4e3317f964fea1`;
  sequences 2-4 are the empty baseline, 5-12 are route/callback/cache readiness,
  13-16 are the attributable one-item completion, and 17-18 retain the cleanup
  defect and Spring disable result.
- `server-po-filter-visible.png`: SHA-256
  `d13ad22e96af346890483b1d058a5b49a27b8f8535478b8e90e9fe4529d04a2c`;
  visible `server.port` evidence.
- `spring-ls-stderr.log`: SHA-256
  `cf04a774c663aafdf0603a0804957b203eb5e2ab39127071e4abd8c11c414338`;
  initialization, cache, enable/disable, and callback-unregistration evidence.
- `Zed-post-shutdown.log`: SHA-256
  `eff072d0cf1336c700b8066e7216db42cf1fa10d107009178c582190d759331b`;
  final editor/LSP trace.
- The relevant upstream sources reviewed locally on 2026-07-17 are
  `headless-services/spring-boot-language-server/.../JdtLsProjectCache.java`,
  `headless-services/commons/commons-language-server/.../ClasspathListenerManager.java`,
  `headless-services/commons/commons-lsp-extensions/.../STS4LanguageClient.java`,
  and `vscode-extensions/commons-vscode/src/java-data.ts` in the fixed Spring
  Tools source checkout under ignored `tmp/s006-spring-tools-source`.

### Failed observations and constraints

- The fixed DMG first displayed Zed's move-to-Applications dialog. It was
  dismissed before the baseline and did not create hypothesis evidence; no
  rerun occurred after the real baseline began.
- The JDT extension's `workspace/executeClientCommand` request for
  `vscode-spring-boot.ls.start` received `-32601` from Zed. Spring LS was already
  started through the controlled adapter, so this did not block the PoC, but a
  product coordinator or upstream client surface must own that lifecycle seam.
- Completion-item resolution sent `sts/javaType` requests that Zed answered
  with `-32601`. The `server.port` label and type still rendered, but richer
  type-aware resolution cannot be claimed. This is a confirmed parity blocker.
- The automatic Java-side remove relay failed even though Spring's listener
  manager unregistered its callback and an authenticated direct Java request
  then succeeded. Product code must make removal idempotent, correlated, and
  testable across restart/shutdown paths.
- Only macOS 26.5.1 arm64 with Temurin JDK 25.0.3 was run. Linux, Windows,
  x86_64, other Arm64 hosts, JDK 21, remote development, installation,
  packaging, upgrades, and the broader Spring Tools capability inventory remain
  unverified.

### Inference

The tested Spring/JDT feature is feasible, but not as a procedural
Zed-extension-WASM-only product. The successful path required protocol-aware
coordination across the Java proxy, JDT LS callbacks, and Spring proxy, while
the failed client requests demonstrate more coordination surfaces beyond the
single classpath callback. A versioned coordinator integrated with, or accepted
upstream by, the existing Zed Java extension is the smallest leading product
direction. This inference is selected formally in D002; it is not evidence that
the current disposable proxies are production-ready.

### Candidate next work

1. Use D002 as the direction gate without promoting spike code.
2. Define the supported coordination protocol and ownership boundary, including
   lifecycle, `sts/javaType`, callback removal, restart, and version mismatch.
3. Complete the initial-public-source license, secret/history, binary, evidence,
   reproduction, and tested/untested audit from D001.
4. Only after a reviewed product architecture plan, create production
   scaffolding with platform-neutral extension code and platform-aware native
   artifact discovery. Validate macOS arm64 first; retain all other desktop
   tuples as `untested` until their matrix runs.
