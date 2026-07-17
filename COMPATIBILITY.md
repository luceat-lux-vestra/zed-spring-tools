# Compatibility

This repository records PoC and local product evidence, not product support. The
words `verified` and `untested` below describe exact observed coverage on one
host. An installable extension now exists, but nothing here promises that it
works on any tuple other than the one verified below.

## Verified PoC tuple

S013 passed its stated functional and cleanup criteria on exactly this tuple:

| Component | Verified value |
| --- | --- |
| Host | macOS 26.5.1, arm64 |
| Zed used for the isolated run | 1.10.3, signed Apple Silicon application |
| Official Zed Java extension | 6.8.21, source commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d` |
| JDT LS | `1.60.0-202606262232`, source commit `57ed41bdddc93df13ace6a266d8e3c1d35c95618` |
| Spring Tools | `5.2.0.RELEASE`, source commit `18d1a975dbea4f9314fd736d0237bd9e23f243f9` |
| Server runtime | Eclipse Temurin JDK 25.0.3 |
| Fixture | Maven, Spring Boot 3.5.5 |

The supported observation is narrow: one real Spring Boot LS moved from an
empty completion baseline to one visible `server.port` completion after an
authentic JDT classpath event, then removed the listener and owned route without
leaving an isolated process behind. See S013 for checksums and full evidence.

The product extension reproduced that flow on the same tuple from a clean
development install on 2026-07-17, returning real Spring Boot property
completions. That observation covers the M2 vertical slice only, not general
Spring feature coverage.

## Desktop matrix

| Desktop tuple | Current state |
| --- | --- |
| macOS arm64 | Verified on the exact tuple above, for the M2 slice only |
| macOS x86_64 | Untested |
| Linux x86_64 | Untested |
| Linux arm64 | Untested |
| Windows x86_64 | Untested |
| Windows Arm64 | Untested |

The product code is platform-neutral by construction: it uses Zed's platform,
worktree, and executable-discovery APIs, joins host paths without a shell, and
carries no unnecessary manifest restriction. That is a code-shape property, not
runtime evidence. No multiplatform support claim will be made until the declared
matrix has been run.

## Java matrix

Spring Tools and the inspected JDT LS require Java 21 or newer to launch. The
local integrated PoC and the M2 product slice were verified with JDK 25 only.
JDK 21 and all other runtime JDK versions remain untested for the integrated
product path. The Java bridge targets Java 21 bytecode through `--release 21`,
which is a compatibility property of the artifact, not a tested claim.

The extension requires the official Zed Java extension. It probes a versioned
capability boundary rather than assuming every past or future Java extension
release is compatible. Missing or incompatible Java support must produce an
explicit diagnostic and must not start a reduced second JDT LS.

## Out of scope

Zed SSH remote development and WSL-hosted remote projects are outside the
initial scope. They may be reconsidered only after the six local desktop tuples
are stable and a later decision adds them.
