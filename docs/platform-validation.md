# Automated platform validation

[![Platform Validation](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml/badge.svg?branch=main)](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml)

`Platform Validation` is the repository's continuously refreshed native CI evidence. The badge above reflects the latest `main` workflow result; the workflow artifacts retain the exact source HEAD, synthetic tested commit, runner identity, toolchain versions, and pinned Spring runtime observations for each run.

## Native matrix

| Host | Architecture | GitHub runner |
| --- | --- | --- |
| Linux | x86_64 | `ubuntu-24.04` |
| Linux | arm64 | `ubuntu-24.04-arm` |
| macOS | x86_64 | `macos-15-intel` |
| macOS | arm64 | `macos-15` |
| Windows | x86_64 | `windows-2025` |
| Windows | arm64 | `windows-11-arm` |

Each tuple runs the same three evidence layers plus the native Rust/bridge checks.

### Layer 1 — native substrate

The workflow records and asserts the real runner OS/architecture and exercises native filesystem/path behavior, including spaces and Unicode, official-Java route path normalization, Maven/Gradle wrapper selection, Java bridge self-test, and native Rust tests.

### Layer 2 — coordinator capability contracts

The coordinator contract suite is enumerated by `scripts/run-coordinator-tests.mjs` rather than by a shell wildcard, so Windows and Unix hosts discover the same test files. Linux and macOS run the complete existing suite directly. Seven legacy tests embed POSIX paths or use a tight `setImmediate` spin as their test fixture; on Windows those fixture-bound forms are replaced by `scripts/platform-capability-probes.mjs`, which drives the same affected behaviors with native file URIs/paths and wall-clock deadlines. The replacement probes cover native positional arguments, Structure document generation, Live metrics generation and bounds, remote credential redaction, and Boot project-info URI/path rendering.

### Layer 3 — real pinned Spring runtime

Every native tuple reads the canonical `protocol/spring-artifacts.json` pin, downloads the exact official Spring Tools VSIX, checks the archive identity and required runtime-file hashes, extracts the real runtime, and starts the pinned Spring Boot language server with the production JVM launch vector. The smoke drives real LSP initialize, a `spring-boot-properties` document, completion, hover, shutdown, and process termination. A separate JDK 21 job runs the same real-runtime smoke as the declared Java floor.

This is stronger than a compile-only or mock-only portability check, but it is still **headless CI evidence**. It does not run the Zed desktop application or the official Java extension/JDT LS end to end on every tuple, and therefore it does not by itself promote a tuple to a fully verified Zed runtime/support claim. `COMPATIBILITY.md` remains authoritative for driven integrated runtime observations.

## Evidence artifacts

Each platform job uploads `platform-evidence.json` and `spring-runtime-evidence.json`. The evidence identifies both the source branch HEAD and the pull-request synthetic merge commit, so a later HEAD cannot inherit evidence from an earlier revision. The JDK-floor job retains its own Spring runtime evidence as well.

A deterministic failure is a failed gate. The acceptance path is to fix the failing contract at a new HEAD and rerun the complete gate; rerun-until-green is not evidence.
