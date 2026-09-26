# Automated platform validation

[![Platform Validation](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml/badge.svg?branch=main)](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml)

`Platform Validation` is the repository's continuously refreshed native,
headless CI evidence. The badge reflects the latest `main` result; pull-request
runs retain evidence for their own exact source HEAD and synthetic merge commit.

D007 changed the runtime boundary on 2026-09-25. This workflow now validates the
official **standalone Spring Tools language server** from `5.3.0.RELEASE`. The former JDT/Spring/bridge
layer is retired and is not part of current platform evidence.

## Native matrix

| Host | Architecture | GitHub runner |
| --- | --- | --- |
| Linux | x86_64 | `ubuntu-24.04` |
| Linux | arm64 | `ubuntu-24.04-arm` |
| macOS | x86_64 | `macos-15-intel` |
| macOS | arm64 | `macos-15` |
| Windows | x86_64 | `windows-2025` |
| Windows | arm64 | `windows-11-arm` |

Each tuple executes the same product-contract and real-runtime evidence.

### Layer 1 — native substrate and product contracts

The workflow records and asserts the real runner OS/architecture, checks the
repository's native path/filesystem assumptions, validates wrapper selection,
runs the coordinator contract suite, executes the native platform capability
probes, and runs the Rust test suite.

The coordinator suite is enumerated by
`scripts/run-coordinator-tests.mjs` so Windows and Unix hosts discover the same
test files. Platform-specific probes use native file URIs, paths, and wall-clock
deadlines rather than inheriting POSIX-only fixtures.

### Layer 2 — real pinned standalone Spring runtime

Every native tuple reads `protocol/spring-artifacts.json` and requires
`mode: "standalone"`. It downloads the exact canonical
`spring-boot-language-server-standalone-exec.jar`, then verifies both the
declared byte size and SHA-256 before launch.

The smoke creates a real Maven Spring Boot fixture, starts the pinned server with
the production standalone JVM vector (including the worktree project root), and
drives an LSP session. It requires the server to:

1. initialize successfully;
2. open both a Java document and a `spring-boot-properties` document;
3. discover the Boot application through
   `sts/spring-boot/executableBootProjects` **without JDT LS**;
4. exercise the local `sts/project/gav` fallback;
5. answer a real properties completion request;
6. avoid every retired private-Java callback
   (`sts/addClasspathListener`, `sts/removeClasspathListener`,
   `sts/javaType`, Javadoc/location/search/hierarchy callbacks); and
7. complete bounded LSP shutdown/process cleanup.

The smoke also treats `sts/javaCodeComplete` as the known standalone callback
whose product behavior is an explicit empty result; it is not tunneled to the
official Java extension.

### JDK 21 runtime floor

A separate Linux x86_64 job runs the same real standalone runtime smoke on the
declared minimum JDK 21. The six-way matrix owns native host portability; the
floor job owns the minimum JVM claim.

## What this evidence does not prove

These checks are stronger than compile-only or mock-only portability tests, but
they remain **headless CI evidence**. They do not prove the exact submitted
commit works as a Zed desktop development extension, nor do they exercise the
real Registry install/update/uninstall lifecycle.

For #159 and Registry preparation, the exact final source HEAD must still be
loaded and manually exercised in Zed. A later HEAD cannot inherit that manual
evidence from an earlier revision.

Historical JDT/bridge gates remain in research/spike records and
`COMPATIBILITY.md` for regression history; they are not current standalone
runtime evidence.

## Evidence artifacts

Each native platform job uploads `platform-evidence.json` and
`spring-runtime-evidence.json`. The standalone runtime artifact records the
source HEAD, tested commit, host OS/architecture, exact Spring Tools
tag/source-commit/artifact checksum, observed server callbacks, executable
project discovery, and completion result.

The JDK-floor job independently uploads its standalone runtime evidence.

A deterministic failure is a failed gate. The acceptance path is to classify the
failure, fix its responsibility layer at a new HEAD, and run the complete gate
again. Rerun-until-green is not evidence.
