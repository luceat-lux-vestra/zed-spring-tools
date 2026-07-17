# Compatibility

This repository currently records PoC evidence, not product support. The words
`verified` and `untested` below describe the exact experiment coverage and must
not be read as a promise that an installable extension already exists.

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

## Desktop matrix

| Desktop tuple | Current state |
| --- | --- |
| macOS arm64 | PoC verified on the exact tuple above; product not implemented |
| macOS x86_64 | Untested |
| Linux x86_64 | Untested |
| Linux arm64 | Untested |
| Windows x86_64 | Untested |
| Windows Arm64 | Untested |

Platform-neutral code shape is a requirement for the future product from its
first scaffold. It is not runtime evidence. No multiplatform support claim will
be made until the declared matrix has been run.

## Java matrix

Spring Tools and the inspected JDT LS require Java 21 or newer to launch. The
local integrated PoC was verified with JDK 25 only. JDK 21 and all other runtime
JDK versions remain untested for the integrated product path.

The future extension will require the official Zed Java extension. It will
probe a versioned capability boundary rather than assuming every past or future
Java extension release is compatible. Missing or incompatible Java support must
produce an explicit diagnostic and must not start a reduced second JDT LS.

## Out of scope

Zed SSH remote development and WSL-hosted remote projects are outside the
initial scope. They may be reconsidered only after the six local desktop tuples
are stable and a later decision adds them.
