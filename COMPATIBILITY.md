# Compatibility

This repository records PoC and local product evidence, not product support. The
words `verified` and `untested` below describe exact observed coverage on one
host. An installable extension now exists, but nothing here promises that it
works on any tuple other than the one verified below.

Official-Java releases are not admitted through an exact runtime allowlist.
Under D006, the product attempts its known route and bridge capability contract
with the installed official Java extension and fails visibly when a required
capability is absent or incompatible. Exact versions below remain evidence and
regression anchors, not a claim that unlisted point releases are rejected or
supported.

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

## S016 later-release evidence

S016 passed its official Java 6.8.23 coordination, product-owned cleanup, warm-
cache, and normal-profile Maven main-runnable criteria on this later exact
tuple:

| Component | Observed value |
| --- | --- |
| Host | macOS 26.5.2 (build 25F84), arm64 |
| Zed | 1.11.3, stable source commit `952d712dac48a4af2c54fb22c82d82a9d69b72d4` |
| Official Zed Java extension | 6.8.23, source commit `ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11` |
| JDT LS | `1.60.0-202606262232`, source commit `57ed41bdddc93df13ace6a266d8e3c1d35c95618` |
| Spring Tools | `5.2.0.RELEASE`, source commit `18d1a975dbea4f9314fd736d0237bd9e23f243f9` |
| Server runtime | Eclipse Temurin JDK 25.0.3 |
| Fixtures | Maven Spring Boot 3.5.5; disposable Gradle 9.5.1 coordination mirror |

This is bounded compatibility evidence, not a general support claim. S016 also
showed that the product's former embedded `extensionVersion: 6.8.21` record was
self-declared rather than an observation of the installed 6.8.23 extension.
D006 therefore removes that release gate and makes the functional adapter
contract authoritative. The structural change has contract coverage, and the
CodeLens branch's driven run subsequently exercised the same optimistic route
with official Java 6.8.21 while connecting a real Boot process.

The supported observation is also bounded. Maven and Gradle coordination,
visible Spring completion, product uninstall, warm cached startup with outbound
network denied, and the ordinary-profile Maven main runnable passed. Gradle and
vanilla task execution, test runnables, first-install offline behavior, and all
other desktop/JDK tuples were outside S016. First-install offline behaviour has
since been observed separately, on 2026-07-26 under Zed 1.12.0 and official Java
6.8.23: with outbound network denied to Zed, the coordinator, and the JVMs, a
cold profile fails closed naming the pinned release and its artifact URL, a warm
one runs the product with only Boot version/support validation degraded, and a
corrupted installed jar is repaired from the cached checksum-verified archive
without a download. See the `Offline behaviour` row in the capability inventory.
Zed's generated
runnable resolves its helper in the default data directory and therefore failed
under `--user-data-dir`. Twice, after worktree closure, the official Java proxy
exited while its JDT child and port file remained; product-owned processes and
routes were already gone. See S016 for attribution and bounded evidence.

## M4 automatic-connection evidence

The default-off automatic local live-data route passed its Zed debug lifecycle
gate on this exact later tuple:

| Component | Observed value |
| --- | --- |
| Host | macOS 26.5.2 (build 25F84), arm64 |
| Zed | 1.11.3 |
| Official Zed Java extension | 6.8.21 |
| JDT LS | `1.60.0-202606262232` |
| Spring Tools | `5.2.0.RELEASE` |
| Server runtime | Eclipse Temurin JDK 25.0.3 |
| Fixture | Maven, Spring Boot 3.5.5 |

On 2026-07-23, the generated Java debug entry exposed reviewable local JMX,
Actuator, application-admin, and project-identity properties. Spring discovered
the one matching fixture, emitted `sts/liveprocess/connected`, and delivered
authentic live data. Manual disconnect emitted `sts/liveprocess/disconnected`
and did not reconnect across more than two later polling periods while the JVM
remained alive. Zed debug stop terminated the fixture, and isolated-Zed exit
left no coordinator, Spring server, official-Java process, or debuggee from the
run. This does not extend the observation to another desktop, JDK, build tool,
or official-Java release.

## Zed 1.12.0 evidence

The Java-reconciler and language-matching runs observed this later exact tuple:

| Component | Observed value |
| --- | --- |
| Host | macOS 26.5.2 (build 25F84), arm64 |
| Zed | 1.12.0, `1.12.0+stable.328.f96212f2c50f54d93712fa130d6226b1ce7d76b5` |
| Official Zed Java extension | 6.8.23 |
| JDT LS | `1.60.0-202606262232` |
| Spring Tools | `5.2.0.RELEASE` |
| Server runtime | Eclipse Temurin JDK 25.0.3 |
| Fixtures | Maven, Spring Boot 3.5.5 / 2.7.18 / 4.0.6 / 4.1.0, Spring AI 1.0.0, Spring Cloud Commons 4.1.6 / 4.3.3 |

On 2026-07-26 this tuple drew 28 distinct Java problem types and applied a fix
from both Spring quick-fix engines. A follow-up run on the same tuple then
extended the two extension-contributed language rows to 1.12.0 and withdrew a
regression signal that had been raised against this Zed release: the languages
failed to register in the earlier run because the copied run profile carried a
stale `extensions/index.json`, which Zed does not rebuild while that file is
newer than `extensions/installed/`. Deleting the index alone restored both
languages on the same Zed build, and the developer's ordinary profile on this
build had never lost them. No behaviour of Zed 1.12.0 is implicated, and nothing
here extends the observation to another desktop, JDK, build tool, or
official-Java release.

A third run on this tuple, on the same date, added Spring Boot 4.1.0 and Spring
Cloud Commons to the fixture set and drew the last three problem types those runs
had left unobserved: `JAVA_BEAN_NOT_REGISTERED_IN_AOT`,
`SPRING_DATA_STRING_PROPERTY_REFERENCE` and
`SPRING_CLOUD_INCOMPATIBLE_BOOT_VERSION`. Two of the three turned on a dependency
version rather than on anything about Zed or this extension — the Spring Data
check needs spring-data-commons 4.1.0 or newer, and the Spring Cloud check needs
a spring-cloud-commons release whose spring.io generation does not link the
project's Boot generation — so both are recorded here as fixture pins, not as
platform evidence.

## M5 JDK 21 floor evidence

The first M5 tuple gate ran the plan's bounded portability core on 2026-07-26
with the JVM that hosts both the Spring server and JDT LS pinned to the declared
floor:

| Component | Observed value |
| --- | --- |
| Host | macOS 26.5.2, arm64 |
| Zed | 1.12.0, `1.12.0+stable.328.f96212f2c50f54d93712fa130d6226b1ce7d76b5` |
| Official Zed Java extension | 6.8.23 |
| JDT LS | `1.60.0-202606262232` |
| Spring Tools | `5.2.0.RELEASE` |
| Server runtime | Eclipse Temurin JDK **21.0.11+10 LTS** |
| Control runtime | Eclipse Temurin JDK 25.0.3 |
| Fixture | Maven, Spring Boot 3.5.5, single module |

All five core steps passed on 21.0.11. A cold profile installed the pinned VSIX
and started `BootLanguageServerBootApp … using Java 21.0.11`; the classpath
bridge registered against official Java; one capability from each dependency
class worked (1842 `server.*` completions with resolved metadata documentation,
a classpath-backed `PROP_UNKNOWN_PROPERTY` on `server.porrt`, and the
`JAVA_AUTOWIRED_CONSTRUCTOR` quick fix applied from a menu composed with JDT's
own actions); the generated `tasks.json`, `debug.json` and `spring-structure.md`
carried `$ZED_WORKTREE_ROOT` and worktree-relative links with no absolute host
path; and a warm restart followed by an uninstall produced
`official Java classpath bridge removed`, zero owned processes, and an empty
install directory.

Two things this gate settled beyond the pass. The JDK a user gets is decided by
two independent resolvers — `lsp.jdtls.settings.java_home` for JDT LS, and this
extension's PATH-first `resolve_java` for the Spring server — and on a stock
macOS host the PATH answer is Apple's `/usr/bin/java` stub, which defers to
`JAVA_HOME` and is not a JDK at all when that is unset. Separately, the official
Java extension adds two `-Djdk.xml.*` flags only at Java 24 or newer, so a 21
launch of JDT LS is not the same command line as a 25 launch.

The run also exposed one product defect, **since fixed and driven on
2026-07-29**: on the very first import of a never-before-opened project,
Spring's first `sts.java.type` lookup exceeded official Java's five-second
command timeout, and the coordinator reported that transient failure as an
incompatibility. The route answered normally three seconds later. Four further
runs alternating JDK 21.0.11 and 25.0.3 against warm and rebuilt fixtures never
reproduced it, so it was a reporting-policy defect and not evidence about either
JDK. A separate gate then reproduced it deterministically by freezing the
isolated JDT LS child with `SIGSTOP`, confirmed the pre-fix build raises the
notice fifteen seconds into the import, and confirmed the fixed build suppresses
six such failures inside the handshake window while still raising the same
notice two seconds after the window closes. Evidence:
`tmp/m5-jdk21-floor-20260726/evidence/` and
`tmp/data-route-transient-20260729/evidence/`.

## Desktop matrix

| Desktop tuple | Current state |
| --- | --- |
| macOS arm64 | Verified on the exact M2 tuple above; S016 adds separately bounded 6.8.23 candidate evidence on macOS 26.5.2, and the M5 portability core has now been driven here on JDK 21.0.11, with 25.0.3 as its start-and-route control |
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

Spring Tools and the inspected JDT LS require Java 21 or newer to launch.

| Runtime JDK | Current state |
| --- | --- |
| Temurin 21.0.11 (the declared floor) | Portability core driven on macOS arm64, 2026-07-26 — see the M5 section above |
| Temurin 25.0.3 | Verified across the integrated PoC, the M2 product slice, and every M4 capability run |
| 22, 23, 24 | Untested. 24 and newer are not merely "between" the two tested versions: official Java adds two `-Djdk.xml.*` flags to the JDT LS launch at 24 or newer |
| 17.0.18 and older | Refused at startup with `JDK 21 or newer is required by Spring Tools`, observed 2026-07-18 |

The Java bridge targets Java 21 bytecode through `--release 21` regardless of
the JDK that runs it, so that remains a compatibility property of the artifact
rather than a tested claim; the floor gate covers the runtime half only. Both
tested JDKs were exercised on one host, one fixture, and one build tool.

The extension requires the official Zed Java extension. It optimistically probes
the known versioned capability boundary rather than admitting exact point
releases. Missing or incompatible capabilities must produce an explicit
diagnostic and must not start a reduced second JDT LS. The diagnostic is now
implemented: it offers a bounded title/body-prefilled GitHub issue for
user review and manual submission, without handling a GitHub token. Its first
stock-Zed notification-to-browser gate passed on the macOS tuple; no issue was
submitted.

## Embedded MCP server evidence

The opt-in embedded MCP server was driven on 2026-07-29 on the tuple below, with
`boot-java.ai.mcp-server-enabled` and `boot-java.ai.mcp-server-port` written into
the profile as a user would write them.

| Component | Observed value |
| --- | --- |
| Host | macOS 26.5.2, arm64 |
| Zed | 1.12.1 |
| Official Zed Java extension | 6.8.21 |
| JDT LS | `1.60.0-202606262232` |
| Spring Tools | `5.2.0.RELEASE` |
| Server runtime | Eclipse Temurin JDK 25.0.3 |
| Fixture project JRE, as the server reported it | 21.0.11 |
| Fixture | Maven, Spring Boot 3.5.5, single module |

All 18 tools were called against the resolved project and 17 returned real
payloads; an unknown-project negative control was refused. Enabling the server
did not delay teardown — Spring exited 3.70 s after quit with the setting off
and 3.66 s with it on, leaving no process and no held port.

Two upstream defects were observed and do not affect the other sixteen tools:
`getResolvedProjectClasspath` fails on a classpath entry whose version is null,
and `getLatestReleaseInformation` returns `null` where
`getLatestBootVersionsFromMavenRepo` answers correctly for the same project.
Neither is confirmed against VS Code, so both are recorded as very likely
upstream rather than proven so.

This covers one tuple, one Maven fixture, and one project per worktree. Gradle,
multi-project worktrees, and any actual MCP client connection are untested; the
endpoint was driven over HTTP directly.

## Out of scope

Zed SSH remote development and WSL-hosted remote projects are outside the
initial scope. They may be reconsidered only after the six local desktop tuples
are stable and a later decision adds them.
