# Feasibility prerequisites and platform matrix

- Status: Approved for feasibility work
- Last checked: 2026-07-16
- Applies to: local PoC work, staged public development, and later platform validation

## Purpose

This document separates prerequisites for starting a local spike, publishing
experimental source, making an extension installable by design, and claiming
multiplatform runtime support. Passing on one macOS machine does not establish
support for Linux, Windows, or another architecture.

## Proposed support boundary

The project should target every OS and 64-bit architecture for which Zed
currently publishes official desktop support:

| OS | x86_64 | aarch64/Arm64 | Product target |
| --- | --- | --- | --- |
| macOS | Yes | Yes | Required |
| Linux | Yes | Yes | Required |
| Windows | Yes | Yes | Required |

FreeBSD and web are outside the initial boundary because Zed does not currently
publish them as supported desktop targets. Thirty-two-bit x86 is also outside
the boundary. Supported OS versions inherit Zed's current support boundary; this
project will not promise older operating systems that Zed itself does not
support.

Zed SSH remote development and WSL-hosted remote projects are outside the
initial product boundary. They may be reconsidered after the six local desktop
tuples are stable, but no current spike, direction decision, or release gate
depends on them.

## Validation levels

### Level 1: local spike readiness

Enough to implement and execute a spike on one declared host. This proves only
that host tuple.

### Level 2: deferred representative OS validation

After the local end-to-end PoC and initial public GitHub source release, run the
relevant product revision on at least:

- macOS aarch64;
- Linux x86_64; and
- Windows x86_64.

Use JDK 21 on all three representative hosts and retain or repeat the available
macOS host with JDK 25. This covers both the minimum server runtime and the
current runtime used by the project owner without multiplying every early
combination.

This catches the main process, path, environment, permissions, and line-ending
differences. It is not the final support matrix and is not a prerequisite for
the local direction decision, initial GitHub source publication, or an explicitly
experimental installable preview.

### Level 3: full release matrix

Before publicly claiming multiplatform support, the product candidate must also
pass on:

- macOS x86_64;
- Linux aarch64; and
- Windows Arm64.

Run the release matrix with both JDK 21 and JDK 25. Other Java versions may work,
but they are not part of the initial support claim until added to the matrix.

Native proxy/coordinator candidates must use a native binary for the exact
OS/architecture tuple. Running an x86_64 binary through an emulation layer does
not count as native Arm64 evidence.

## Cross-platform design constraints

### Extension code

- Zed compiles procedural extension code to WebAssembly, which avoids a separate
  extension binary per desktop architecture.
- The published `zed_extension_api` 0.7.0 exposes macOS, Linux, and Windows plus
  x86, x86_64, and aarch64 platform values. This project targets only Zed's
  officially supported 64-bit combinations.
- Extension code must use `current_platform`, `Worktree::which`,
  `Worktree::shell_env`, and argument arrays. It must not invoke `sh`, `bash`,
  PowerShell, `cmd.exe`, or depend on shell quoting for normal startup.
- Host paths can contain spaces, non-ASCII characters, and platform separators.
  Tests must include at least one workspace path with spaces and Unicode.
- The published extension API exposes the path to Zed's managed Node binary.
  S001 can use that binary for a dependency-free JavaScript protocol probe
  without requiring user-installed Python or Node. This is spike infrastructure,
  not a proposed product runtime.

### Java runtime

- Spring Tools and current JDT LS require Java 21 or newer to launch.
- Spring Tools prefers a JDK; a JRE disables at least Boot Hints. Treat a JDK as
  the project prerequisite rather than promising a useful JRE-only mode.
- Runtime discovery order should be explicit and identical in intent on every
  platform:
  1. a future user-configured executable or Java home;
  2. `Worktree::which("java")`;
  3. `JAVA_HOME/bin/java` on macOS/Linux or
     `JAVA_HOME\\bin\\java.exe` on Windows; and
  4. a clear installation error.
- JVM discovery must execute `java -version` and verify a parseable major version
  of at least 21. JDK verification must also locate `javac` or another reliable
  JDK marker.
- The language-server runtime JDK and the project source/target JDK are different
  concerns. Supporting a Java 17 project does not mean the server itself may run
  on Java 17.
- Initial server-runtime support should be stated as tested JDK 21 and JDK 25,
  not an unbounded promise for every future JDK greater than 21.

### Project build environment

- Do not require globally installed Maven or Gradle as a product prerequisite.
  Test fixtures should pin Maven Wrapper or Gradle Wrapper versions and include
  their Windows and POSIX launchers.
- Wrapper-driven import may download build tools and dependencies. Online,
  proxy-restricted, and warm-cache/offline behavior are separate test cases.
- Maven and Gradle project import must be tested separately; success with one is
  not evidence for the other.
- S002 keeps JDT classpath integration disabled and therefore does not use build
  import as a success condition. S004 is the first gate that requires a real
  imported project model.

### Spring Tools artifact

- The pinned VSIX is a ZIP-compatible Java artifact set. Inspection found no
  `.dll`, `.exe`, `.so`, `.dylib`, `.jnilib`, or `.node` entries.
- The same VSIX is therefore a credible input for all target tuples, but actual
  startup must still be tested per OS and architecture.
- Do not rely on executable permission bits or a packaged platform shell script;
  launch the Java main class/JAR directly with an argument vector.
- Preserve case and directory layout during extraction. Linux case sensitivity
  can expose mistakes hidden on default macOS and Windows filesystems.

### Downloads and caches

- Use the exact release tag, asset name, and SHA-256 recorded in R005. Never use
  an unpinned `latest` selector.
- Product code must verify integrity without depending on external commands such
  as `shasum`, `sha256sum`, or PowerShell `Get-FileHash`.
- Installation must be transactional: extract to a temporary versioned
  directory, verify, then activate. A partial download must not replace a
  working version.
- Cache and workspace keys must not depend on path separators or case folding.
- An explicit local-artifact path is required for offline and restricted-network
  environments.

### Worktree and filesystem behavior

- Zed will not start the language server until a worktree requiring trust is
  trusted. Every manual procedure must record that state.
- Cover spaces and Unicode in paths, a case-sensitive Linux filesystem, a
  default case-insensitive macOS filesystem, and a Windows drive-letter path.
- Do not assume POSIX signals, executable bits, symlinks, `/tmp`, or a home
  directory spelling. Use Zed-provided work/cache paths and direct child-process
  handles.
- Treat simultaneous worktrees as isolated server/cache instances unless a
  later experiment proves safe sharing.

### Native coordination code

Candidate A and the product-facing S002 baseline can remain Java plus extension
WASM; S001 uses managed Node only as disposable test infrastructure. If a native
proxy/coordinator is selected later:

- publish or build for all six target tuples;
- record a checksum for every asset;
- avoid libc assumptions that exclude supported Linux distributions;
- test Windows process creation and termination without POSIX signals;
- test macOS quarantine/signing behavior and Windows security scanning; and
- keep native-version compatibility paired with the extension, Spring Tools,
  and JDT LS versions.

## Local prerequisite audit

Host audited: macOS 26.5.1 arm64.

| Prerequisite | Status | Evidence or action |
| --- | --- | --- |
| Git research baseline | Ready | Commit `4ffce84` on `main` |
| S001 plan | Gate B complete | Refuted on macOS arm64 because the probe observed `shutdown` but not `exit` before termination |
| S002 plan | Gate B complete | Refuted on macOS arm64: direct startup and transport worked, but all metadata-aware properties probes were empty |
| S003 plan | Gate B complete locally | Supported on macOS arm64/JDK 25; synthetic injection and command repeated after restart; other targets untested |
| S004 plan | Gate B complete locally | Supported on macOS arm64/JDK 25; five pinned Spring JDT bundles and the imported-project command repeated after restart; other targets untested |
| S005 plan | Gate D complete locally | Supported on macOS arm64/JDK 25; fresh controls, one routed callback, and direct Spring `SUCCESS [done]` passed; other targets untested |
| S006 plan | Gate C closed Inconclusive | Corrected Spring LS startup and JDT import succeeded, but actual JDT data used a fresh host cache instead of the reviewed prepared path; no completion/add/callback input ran |
| S007 plan | Gate C closed Inconclusive | Run 1 used the exact managed-local data path and reached `ServiceReady`; unexpected Gradle metadata and a leftover proxy record prevented attribution/cleanup, so Run 2 was not started |
| Zed | Ready locally | 1.10.3, build `20260713.002323` |
| rustup | Ready | Stable rustc/cargo 1.97.0 installed |
| Rust command selection | Ready | Login shell selects `~/.cargo/bin` shims before Homebrew |
| Rust WASI target | Ready | Official rustup `wasm32-wasip1` target installed; locked S005 release build passed |
| `wasm32-wasip2` | Ready | Installed in the active rustup toolchain |
| Zed API-resolved Node | Ready locally | `/opt/homebrew/bin/node`, v26.5.0, darwin arm64 observed through S001 |
| JDK 21+ | Ready locally | SDKMAN Temurin JDK 25.0.3; `java` and `javac` verified for S002+ |
| Java discovery | Conditional | `$JAVA_HOME` works; `/usr/libexec/java_home` does not see the SDKMAN JDK |
| Disk | Ready locally | Approximately 577 GiB available during audit |
| Memory | Measured locally | 64 GiB installed; S002 Spring LS used approximately 265-290 MiB RSS, S003 JDT LS snapshots were approximately 587-1,264 MiB, S004 JDT LS snapshots were approximately 506-1,271 MiB, and S005 JDT LS snapshots were approximately 1,269-1,541 MiB |
| Spring VSIX | Verified locally | Pinned 82,759,143-byte artifact and SHA-256 verified; retained only in ignored local storage and not redistributable from this repository |
| Native libraries in VSIX | None observed | 204-entry archive inspected for common native suffixes |
| Official Zed Java extension | Ready in isolated S003 data | Exact 6.8.21 installation retained for repeatable research; normal Zed remains unchanged |
| Zed CLI | Embedded CLI verified | No global command is installed; S007 fixes the signed app-embedded CLI by absolute path and hash |
| Local Node syntax checker | Ready | Node 26.5.0 available; not an end-user prerequisite |
| GitHub access | Ready locally | Pinned Spring Tools tag resolved during audit |
| Linux execution host | Deferred | No runtime host is currently available; this does not block the local PoC or initial public source release |
| Windows execution host | Deferred | No runtime host is currently available; this does not block the local PoC or initial public source release |
| Additional architecture hosts | Deferred | Needed before the corresponding support claim, not before an experimental installable preview |
| Repository license | Missing | Required before publishing a Zed extension; choose a Zed-accepted license later |
| Third-party license inventory | Blocked | Incomplete in inspected Spring release; blocks project-operated mirroring/repackaging |

## Gate status

### Ready now

- Source-based platform boundary is identifiable.
- Local macOS arm64 Zed, rustup, JDK, and disk are available. The pinned Spring
  artifact is verified locally; S004's fixed JDT LS, official proxy, debug,
  Spring bundle, and dependency-free fixture inputs remain under ignored local
  storage for identity reverification.
- A shell-independent probe can use Zed's Node executable API instead of
  hard-coding a Node, Python, Java, or platform-shell path.

### Satisfied before S001 implementation

- Accept this proposed platform boundary and validation levels.
- Accept the dependency-free JavaScript probe using Zed's Node executable API.
- Accept rustup-first PATH use and possible `wasm32-wasip2` installation.

### S001 execution result

- The implemented diff was reviewed before execution.
- Foreground Zed compiled and installed the extension and resolved Node through
  the extension API. Java environment verification remains a separate S002
  gate.
- Zed 1.10.3 on macOS 26.5.1 arm64 sent `shutdown`, accepted its response, and
  started a replacement server, but the probe did not observe `exit` before
  termination. Pinned and current upstream source enqueue `exit` and then call
  `child.kill()` after the writer finishes; carry this constraint into S002.

### S002 execution result

- The reviewed properties-only, classpath-disabled implementation initialized
  the verified Spring LS directly on Temurin JDK 25 without a Zed Java extension
  or the VS Code-only JVM client flag.
- Zed sent the mapped language ID and handled dynamic registrations, and no
  classpath-listener request occurred. Completion and hover returned empty
  results; duplicate-key and invalid-value diagnostics were also empty.
- Spring LS returned the string `"OK"` instead of `null` for shutdown. Zed
  logged a deserialization failure but still sent `exit` and initialized a
  replacement process.
- This is local macOS arm64 evidence only. Do not repeat S002 merely to imply
  multiplatform support; representative runs require JDK 21 and the same fixed
  revision and criteria if the result is needed for a later direction decision.

### S003 Gate A and Gate B result

- The S003 synthetic-bundle-only plan and complete Gate A diff were reviewed
  before runtime execution.
- The official Java extension remained out of the user's normal Zed environment;
  exact version 6.8.21 is retained only in reusable isolated Gate B data.
- The run used only fixed JDT LS 1.60.0, Java proxy v6.8.21, and Java debug 0.53.2
  artifacts. Lombok, JDK auto-download, and managed update checks were disabled.
- The full JDT LS archive was reacquired and verified after implementation
  review. Its local PAX metadata required the narrow, reviewed preparation-tool
  correction recorded in S003 before extraction succeeded.
- The Java proxy HTTP endpoint was used as an ignored-evidence test oracle only,
  not as a supported inter-extension integration contract.

### S004 Gate A and Gate B result

- The fixed Spring Tools `5.2.0.RELEASE` VSIX contributes exactly five JDT LS
  bundles. Their identities, order, manifests, and `sts.java.search.types`
  contract are recorded in S004.
- Every declared required bundle and Gson package has a provider in the pinned
  JDT LS 1.60.0 plus the five-JAR set, and no contribution symbolic name collides
  with the base JDT LS plugins.
- The Spring release build used a mutable JDT LS snapshot repository, so the
  static audit alone was not a compatibility claim. Gate B tested that exact
  risk with the fixed source-only command against an imported Maven fixture.
- S003's development link and synthetic path were removed. A fresh verified JDT
  extraction and uniquely named worktree selected a distinct JDT data cache;
  initialization retained debug 0.53.2 and added the five Spring paths exactly
  once in release order.
- All five Spring bundles installed and started without an attributable runtime
  compatibility error. JDT LS advertised `sts.java.search.types`; before and
  after one restart the fixed request returned the exact unique fixture type
  with `clazz: true`.
- M2E fetched its own Maven model/tooling artifacts during the first import even
  though the fixture had no wrapper or project dependency. This remains an
  offline/reproducibility constraint, not a failed type-search condition.
- Zed logged the already-known shutdown response/lifecycle limitation, but all
  isolated child processes were removed and normal Zed was restored. S004 is
  Supported only on this macOS arm64/JDK 25 tuple; S005 planning is recorded
  below.

### S005 Gate A through Gate D result

- The fixed Spring source sends classpath events from JDT LS through the
  proposed `workspace/executeClientCommand` request. A non-batched event contains
  project URI, name, deletion state, classpath, build descriptor, and Java core
  options.
- The current Java proxy has no branch for that method and forwards the request
  to Zed. Source inspection alone cannot establish the runtime payload, Zed's
  actual failure behavior, or result correlation through an instrumented proxy.
- The reviewed S005 plan separates three arms: official release proxy, an
  unmodified source build from the pinned Java extension commit, and the same
  source build with one narrow disposable callback-routing patch. This avoids
  attributing a compiler/source-build difference to the patch.
- Spring Boot LS remains excluded. A worktree-local mock sink returns the exact
  `"done"` value used by the fixed Spring consumer so S005 can test one callback
  boundary without claiming an end-to-end integration.
- Gate A added the disposable S005 adapter, sink, preparation tool, and
  fixed-method patch and validated them only with generated fixtures. No real
  native source checkout, fixed proxy build, or fixed-arm preparation occurred
  in that gate.
- Gate B then verified the exact clean Java extension commit, built the
  unmodified and instrumented proxies with the same locked native conditions,
  prepared three fresh arms, and passed process-only proxy and sink smokes. It
  did not open or automate Zed and did not start JDT LS.
- Gate C confirmed equivalent official and source-built control behavior: both
  delivered one authentic callback to Zed, received `-32601`, recorded Spring
  failure, and delivered nothing to the sink. The instrumented arm delivered one
  authenticated six-argument callback to the sink and passed every structural
  assertion. All add/remove commands returned `"ok"`, and no duplicate appeared
  during any fixed post-remove interval.
- Gate C is Inconclusive rather than Supported. A rejected setup launch created
  Arm A's JDT runtime configuration before the accepted control run, so the
  official arm was no longer fresh. Arm C's sink returned the fixed `"done"`
  result and Spring did not log failure, but debug-level `SUCCESS [done]` and an
  equivalent direct proxy-to-JDT response trace were not preserved. The result
  therefore cannot prove original-ID result propagation at the required
  attribution level.
- Gate D preserved the failed Gate C evidence, prepared three new arms only
  after confirming the retained S005 installation, and verified both extracted
  JDT state and the Java extension's actual host caches before each launch.
  Equal debug activation left the two controls equivalent: both recorded
  `FAILED` and delivered nothing to the sink. The routed arm delivered one
  structurally valid callback and directly persisted Spring `SUCCESS [done]`.
  S005 is therefore Supported on this local tuple.
- All isolated processes and private route/port records were removed and normal
  Zed was restored. The retained isolated profile contains Java 6.8.21 and the
  disposable S005 development extension. No product skeleton, reusable bridge/
  coordinator, or multiplatform claim is authorized. D001 moves Linux and
  Windows runtime validation after the local end-to-end PoC, direction decision,
  and initial public GitHub source release.

### S006 Gate A through Gate C result

- S006 narrows the local end-to-end PoC to one Maven Spring Boot `3.5.5`
  fixture and one visible `server.port` completion in Zed.
- It requires a same-process empty baseline before the real Spring LS enables
  JDT classpath listening, then traces the dynamic callback through JDT and back
  into the real `JdtLsProjectCache` handler.
- The disposable coordination routes are loopback-only, authenticated,
  owner-checked, exact-command, bounded, and incapable of synthesizing the JDT
  or Spring success result. Completion structures must also pass unchanged.
- Gate A added only the reviewed disposable adapter, fixture, Spring proxy,
  Java proxy patch/contract harness, and preparation tool. Adapter Rust/WASM,
  Node protocol, patch Rust, and Java preparation synthetic checks passed after
  the intermediate compile/format/contract defects recorded in S006 were fixed.
- Gate B built the fixed source and instrumented proxies, resolved the pinned
  Boot fixture, prepared fresh JDT/Spring inputs, and passed fake-child process
  boundaries. It did not launch Zed or a real language server.
- Gate C's first setup launch exposed that the executable Spring JAR required
  its 168 adjacent VSIX libraries. The single documented setup correction added
  exact manifest-closure extraction and synthetic rejection tests; the corrected
  real Spring LS then initialized with classpath listening disabled, while JDT
  installed six bundles, imported Maven, and reached `ServiceReady`.
- The corrected launch still selected a newly created host JDT data path rather
  than the reviewed prepared `XDG_CACHE_HOME` path. S006 stopped before opening
  the properties fixture, so no completion, listener add, callback, project
  cache, or `server.port` hypothesis input occurred. It is Inconclusive rather
  than Refuted, and its explicit one-correction rule closes an in-place retry.
- Exact post-run source review established that the fixed packaged JDT launcher
  ignores `XDG_CACHE_HOME` on Darwin and the Java extension custom-launcher
  branch does not add `-data`; an unknown application-environment boundary is
  not needed to explain the result.
- S007 staged exactly one pinned JDT installation in the official Java
  extension's managed-local path and opened Gate C with two distinct XDG roots
  and fresh worktrees. Run 1's proxy/JVM arguments used exactly the expected
  direct `-data` path and reached `ServiceReady` in about three seconds without
  a host fallback. The fresh XDG root also gained an unattributed current
  Gradle version catalog, and one private proxy record remained after shutdown.
  Because no-update attribution and cleanup were insufficient, Run 2 was not
  started and S007 is Inconclusive. A new source-attribution investigation and
  reviewed prerequisite plan are required before another runtime attempt. The
  local end-to-end PoC and project direction gate remain incomplete.
- This plan makes no product-architecture choice or platform support claim.
  Non-macOS tuples remain installability targets by design and runtime-untested.

### Required before the initial public GitHub source release

- Complete and document a reviewed local end-to-end PoC using the real Spring
  Boot LS and real Spring Java project-data path.
- Choose a Zed-accepted repository license.
- Scan tracked content and history for secrets, private machine data, generated
  binaries, and third-party artifacts.
- Keep the Spring VSIX and extracted artifacts out of Git and document how users
  supply or retrieve pinned inputs.
- Make the README identify macOS arm64/JDK as tested and every other target as
  untested.
- Preserve reproducible setup, known failures, limitations, and the absence of
  a stable support promise.

### Required before an experimental Zed Marketplace preview

- Record a Go/Pivot/Limited/Stop direction decision from the local evidence.
- Review the production extension manifest and implementation after that
  decision permits scaffolding.
- Verify a clean local install and compliant pinned artifact acquisition.
- Keep the extension package platform-neutral and do not add unnecessary OS or
  architecture restrictions.
- Clearly label the preview experimental and list its exact tested tuple.

### Required before representative multiplatform validation

- Provision Linux x86_64 and Windows x86_64 test hosts with supported Zed and a
  JDK 21+.
- Define how JSONL traces and Zed logs will be collected without committing host
  secrets or absolute user paths.
- Repeat the same spike revision and success criteria on all three OS families.
- Install JDK 21 on each representative host and retain the local JDK 25 run.

### Required before stable multiplatform support claims

- Resolve or legally review the Spring third-party inventory before any
  repackaging or mirroring.
- Pass all six local desktop tuples.
- Pass the six desktop tuples with both JDK 21 and JDK 25 for server runtime.
- Add production packaging and CI only after the direction decision permits it.

## Primary sources

All sources were accessed on 2026-07-14.

- [Zed installation and system requirements](https://zed.dev/docs/installation)
  — official desktop OS and architecture support.
- [Zed developing extensions](https://zed.dev/docs/extensions/developing-extensions)
  — rustup requirement and WebAssembly extension build.
- [Zed installing extensions](https://zed.dev/docs/extensions/installing-extensions)
  — platform-specific extension and work directories.
- [`zed_extension_api` platform interface](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/extension_api/wit/since_v0.6.0/platform.wit)
  — OS and architecture values available to published API 0.7.0 extensions.
- [`Worktree` interface](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/extension_api/wit/since_v0.6.0/extension.wit)
  — worktree root, PATH lookup, and shell environment.
- [`node_binary_path` interface](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/extension_api/wit/since_v0.6.0/nodejs.wit)
  — Zed-managed Node executable path for cross-platform extension use.
- [Spring Tools JVM check](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/vscode-spring-boot/lib/Main.ts)
  — Java 21 minimum and JDK preference.
- [JDT LS requirements](https://github.com/eclipse-jdtls/eclipse.jdt.ls#requirements)
  — Java 21 minimum and OS-specific launch configuration.
- [Spring Tools `5.2.0.RELEASE`](https://github.com/spring-projects/spring-tools/releases/tag/5.2.0.RELEASE)
  — pinned official VSIX input.

## Recorded review decisions

1. Accept the six desktop tuples as the required release matrix.
2. Keep all six tuples as installation targets, but defer Linux and Windows
   runtime validation until after the local PoC and initial public source
   release. Untested targets receive no support claim.
3. Require a JDK 21+ from the user instead of bundling a JVM during feasibility
   work.
4. Replace the S001 Python probe with a dependency-free JavaScript probe launched
   by Zed's managed Node binary.
5. Treat JDK 21 and JDK 25 as the initial tested server-runtime versions; add
   other Java versions only through the compatibility matrix.
6. Target VS Code Spring Tools capability parity over time and publish the
   project source after a basic local end-to-end PoC.

Remote development is not a pending review decision; it is recorded as deferred
from the initial scope.
