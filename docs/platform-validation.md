# Automated platform validation

[![Platform Validation](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml/badge.svg?branch=main)](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml)

`Platform Validation` is the repository's continuously refreshed native CI evidence. The badge above reflects the latest `main` workflow result; the workflow artifacts retain the exact source HEAD, synthetic tested commit, runner identity, toolchain versions, and pinned Spring plus JDT/Spring/bridge runtime observations for each run.

## Native matrix

| Host | Architecture | GitHub runner |
| --- | --- | --- |
| Linux | x86_64 | `ubuntu-24.04` |
| Linux | arm64 | `ubuntu-24.04-arm` |
| macOS | x86_64 | `macos-15-intel` |
| macOS | arm64 | `macos-15` |
| Windows | x86_64 | `windows-2025` |
| Windows | arm64 | `windows-11-arm` |

Each tuple runs the same four evidence layers plus the native Rust/bridge checks.

### Layer 1 — native substrate

The workflow records and asserts the real runner OS/architecture and exercises native filesystem/path behavior, including spaces and Unicode, official-Java route path normalization, Maven/Gradle wrapper selection, Java bridge self-test, and native Rust tests.

### Layer 2 — coordinator capability contracts

The coordinator contract suite is enumerated by `scripts/run-coordinator-tests.mjs` rather than by a shell wildcard, so Windows and Unix hosts discover the same test files. Linux and macOS run the complete existing suite directly. Seven legacy tests embed POSIX paths or use a tight `setImmediate` spin as their test fixture; on Windows those fixture-bound forms are replaced by `scripts/platform-capability-probes.mjs`, which drives the same affected behaviors with native file URIs/paths and wall-clock deadlines. The replacement probes cover native positional arguments, Structure document generation, Live metrics generation and bounds, remote credential redaction, and Boot project-info URI/path rendering.

### Layer 3 — real pinned Spring runtime

Every native tuple reads the canonical `protocol/spring-artifacts.json` pin, downloads the exact official Spring Tools VSIX, checks the archive identity and required runtime-file hashes, extracts the real runtime, and starts the pinned Spring Boot language server with the production JVM launch vector. The smoke drives real LSP initialize, a `spring-boot-properties` document, completion, hover, shutdown, and process termination.

### Layer 4 — real pinned JDT/Spring/bridge integration

Every native tuple independently downloads and checksum-verifies the pinned Eclipse JDT LS 1.60.0 milestone archive. It extracts and verifies the canonical five Spring 5.3 Java-extension JARs from the same pinned Spring Tools VSIX, builds the current bridge from repository source with Java 21 bytecode, and injects the five Spring bundles plus that bridge into the real JDT LS runtime. The smoke requires JDT LS to advertise `sts.java.search.types` and both `zed.spring.bridge.v1.*ClasspathListener` delegate commands, then executes the bridge remove command and performs bounded LSP shutdown/process cleanup.

That executed remove command proves that the current bridge bundle resolved and activated inside the real JDT runtime, its delegate handler was registered and invoked, and the bridge linked against the Spring JDT commons dependency. It deliberately does **not** claim that the add/listener/callback route was driven end to end, nor that the official Java extension/proxy participated in this headless smoke.

A separate JDK 21 floor job runs both Layer 3 and Layer 4 on Linux x86_64. The six-way matrix owns host portability; the floor job owns the declared minimum Java runtime.

These checks are stronger than compile-only or mock-only portability tests, but they remain **headless CI evidence**. They do not run Zed desktop together with the official Java extension/proxy, JDT LS, Spring Tools, and this extension end to end on every tuple. Therefore they do not by themselves promote a tuple to a fully verified Zed runtime/support claim. `COMPATIBILITY.md` remains authoritative for driven integrated runtime observations.

## Evidence artifacts

Each platform job uploads `platform-evidence.json`, `spring-runtime-evidence.json`, and `jdt-spring-runtime-evidence.json`. The evidence identifies both the source branch HEAD and the pull-request synthetic merge commit, so a later HEAD cannot inherit evidence from an earlier revision. The JDK-floor job independently retains both its Spring runtime evidence and its JDT/Spring/bridge runtime evidence.

A deterministic failure is a failed gate. The acceptance path is to fix the failing contract at a new HEAD and rerun the complete gate; rerun-until-green is not evidence.
