# Feasibility prerequisites and platform matrix

- Status: Approved for feasibility work
- Last checked: 2026-07-14
- Applies to: S001-S005 and the later product direction gate

## Purpose

This document separates prerequisites for starting a local spike from the
evidence required to claim multiplatform support. Passing on one macOS machine
does not establish support for Linux, Windows, or another architecture.

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

### Level 2: representative OS validation

Before a Go or Limited direction decision, the relevant spike must run on at
least:

- macOS aarch64;
- Linux x86_64; and
- Windows x86_64.

S001 uses Zed's managed Node probe and does not require a JDK. For S002 and later
server spikes, use JDK 21 on all three representative hosts and repeat on the
available macOS host with JDK 25. This covers both the minimum server runtime and
the current LTS used by the project owner without multiplying every early spike
combination.

This catches the main process, path, environment, permissions, and line-ending
differences early. It is not the final support matrix.

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
| S003 plan | Gate B complete locally | Supported on macOS arm64/JDK 25; synthetic injection and command repeated after restart |
| S004 plan | Gate A reviewed | Disposable adapter, fixture, preparation self-tests, fixed-input dry preparation, and complete diff validated; Gate B not started |
| Zed | Ready locally | 1.10.3, build `20260713.002323` |
| rustup | Ready | Stable rustc/cargo 1.97.0 installed |
| Rust command selection | Ready | Login shell selects `~/.cargo/bin` shims before Homebrew |
| `wasm32-wasip2` | Ready | Installed in the active rustup toolchain |
| Zed API-resolved Node | Ready locally | `/opt/homebrew/bin/node`, v26.5.0, darwin arm64 observed through S001 |
| JDK 21+ | Ready locally | SDKMAN Temurin JDK 25.0.3; `java` and `javac` verified for S002+ |
| Java discovery | Conditional | `$JAVA_HOME` works; `/usr/libexec/java_home` does not see the SDKMAN JDK |
| Disk | Ready locally | Approximately 577 GiB available during audit |
| Memory | Measured locally | 64 GiB installed; S002 Spring LS used approximately 265-290 MiB RSS, while S003 JDT LS point-in-time snapshots were approximately 587-1,264 MiB |
| Spring VSIX | Verified locally | Pinned 82,759,143-byte artifact and SHA-256 verified; retained only in ignored local storage and not redistributable from this repository |
| Native libraries in VSIX | None observed | 204-entry archive inspected for common native suffixes |
| Official Zed Java extension | Ready in isolated S003 data | Exact 6.8.21 installation retained for repeatable research; normal Zed remains unchanged |
| Zed CLI | Not installed | Optional for S001 because the app binary and UI are available |
| Local Node syntax checker | Ready | Node 26.5.0 available; not an end-user prerequisite |
| GitHub access | Ready locally | Pinned Spring Tools tag resolved during audit |
| Linux execution host | Missing | Docker client exists but no active engine was observed; GUI Zed host still required for S001 parity |
| Windows execution host | Missing | Obtain physical, VM, or CI-hosted Windows Zed environment |
| Additional architecture hosts | Missing | Needed before full support claim |
| Repository license | Missing | Required before publishing a Zed extension; choose a Zed-accepted license later |
| Third-party license inventory | Blocked | Incomplete in inspected Spring release; blocks project-operated mirroring/repackaging |

## Gate status

### Ready now

- Source-based platform boundary is identifiable.
- Local macOS arm64 Zed, rustup, JDK, and disk are available. The pinned Spring
  artifact is verified locally; S003's full fixed JDT LS, proxy, debug, and
  synthetic bundle inputs are prepared under ignored local storage.
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

### S004 planning gate

- The fixed Spring Tools `5.2.0.RELEASE` VSIX contributes exactly five JDT LS
  bundles. Their identities, order, manifests, and `sts.java.search.types`
  contract are recorded in S004.
- Every declared required bundle and Gson package has a provider in the pinned
  JDT LS 1.60.0 plus the five-JAR set, and no contribution symbolic name collides
  with the base JDT LS plugins.
- The Spring release build used a mutable JDT LS snapshot repository, so static
  closure is not a binary-compatibility claim. S004 is planned to verify that
  exact risk with one source-only command against an imported Maven fixture.
- The reusable isolated profile may retain Java 6.8.21, but S003's development
  link and synthetic path must be removed and shown absent before S004 runtime.
  S004 must use a fresh extraction of the verified JDT archive and a uniquely
  named runtime worktree so persisted OSGi configuration and the launcher's
  basename-derived JDT data cache cannot contaminate the result.
- Gate A disposable implementation and non-UI validation are complete. The
  first fixed-input dry preparation safely exposed and corrected a mistaken
  nested-JAR digest; the repeat passed with no retained runtime output. Gate B
  Zed/UI execution has not started and requires a reviewed diff plus explicit
  continuation.

### Required before representative multiplatform evidence

- Provision Linux x86_64 and Windows x86_64 test hosts with supported Zed and a
  JDK 21+.
- Define how JSONL traces and Zed logs will be collected without committing host
  secrets or absolute user paths.
- Repeat the same spike revision and success criteria on all three OS families.
- Install JDK 21 on each representative host and retain the local JDK 25 run.

### Required before publication

- Record a Go/Pivot/Limited decision from spike evidence.
- Select a Zed-accepted license for extension code.
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

## Review decisions requested

1. Accept the six desktop tuples as the required release matrix.
2. Accept representative validation on macOS arm64, Linux x86_64, and Windows
   x86_64 before the project direction decision.
3. Require a JDK 21+ from the user instead of bundling a JVM during feasibility
   work.
4. Replace the S001 Python probe with a dependency-free JavaScript probe launched
   by Zed's managed Node binary.
5. Treat JDK 21 and JDK 25 as the initial tested server-runtime versions; add
   other Java versions only through the compatibility matrix.

Remote development is not a pending review decision; it is recorded as deferred
from the initial scope.
