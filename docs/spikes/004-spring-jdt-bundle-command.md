# S004: Pinned Spring JDT bundle command probe

- Status: Planned; implementation not started
- Date: 2026-07-14
- Related research: R002, R003, R004, R005
- Depends on: S003 Supported on the local macOS arm64/JDK 25 tuple
- Implementation gate: Awaiting user review and explicit continuation

## Hypothesis

On Zed 1.10.3 for macOS arm64, the official Java extension 6.8.21 can launch
the pinned Eclipse JDT LS 1.60.0 through its unmodified Java proxy while a
separate disposable adapter appends exactly the five JARs declared by Spring
Tools `5.2.0.RELEASE` in `contributes.javaExtensions`. JDT LS will resolve and
activate those bundles, import one dependency-free Maven fixture, advertise
`sts.java.search.types`, and execute that command against the imported project.

For the fixed request below, the response must contain a type descriptor whose
`fqName` is `dev.zed.spring.s004.S004OnlyProbe9F2C` and whose `clazz` field is
`true`:

```json
{
  "projectUri": "<file URI of the fixed fixture project>",
  "term": "S004OnlyProbe9F2C",
  "searchType": "fuzzy",
  "includeBinaries": false,
  "includeSystemLibs": false,
  "timeLimit": -1
}
```

This hypothesis covers Spring JDT bundle compatibility and one read-only,
non-listener Java-model command only. It does not claim that Spring Boot LS can
start, receive project data, or route callbacks through Zed.

## Decision this spike informs

S004 tests the second premise shared by coordinated Candidates B and C from
R004: the exact Spring release bundles can run usefully inside the same fixed
JDT LS tuple whose generic injection path S003 supported.

- A Supported result permits S005 to plan one classpath-listener callback and
  routing probe.
- A Refuted result blocks this exact Spring Tools `5.2.0.RELEASE` and JDT LS
  1.60.0 pairing. It does not authorize silently changing either side; a new
  compatibility investigation must first pin a different tuple.
- An Inconclusive result permits only an attribution or environment correction.
  It does not justify callback proxy work.

## Why runtime verification is required

The release manifests have no upper version ranges on their JDT, LSP4J, Gson,
M2E, or Buildship dependencies, and every required bundle is statically present
in JDT LS 1.60.0 or in the five-JAR Spring contribution set. That is necessary
but not sufficient evidence of binary compatibility.

The Spring release source at commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9` builds its JDT extension against a
mutable JDT LS snapshot p2 repository rather than an immutable JDT LS version.
The official VSIX therefore does not identify the precise JDT LS build against
which its classes were compiled. Runtime verification is required to detect
resolution, activation, linkage, extension-point, and Java-model behavior
against the independently pinned JDT LS 1.60.0 artifact.

## Scope boundaries

Included:

- the reusable isolated Zed research profile retained after S003;
- the official Java extension exactly at 6.8.21;
- the same fixed JDT LS 1.60.0, Java proxy v6.8.21, and Java debug 0.53.2 tuple;
- the official Spring Tools `5.2.0.RELEASE` VSIX and exactly its five declared
  Java-extension JARs;
- one disposable adapter that contributes those five absolute bundle paths;
- one dependency-free Maven fixture containing one uniquely named Java class;
- one `sts.java.search.types` request before and after JDT LS restart;
- initialize, bundle, command, project-import, process, memory, restart,
  shutdown, and cleanup observations; and
- the unchanged Java proxy's local HTTP channel as a spike-only test oracle.

Excluded:

- Spring Boot LS launch, standard Spring LSP features, or classpath enablement;
- `sts.java.addClasspathListener`, `sts.java.removeClasspathListener`,
  `workspace/executeClientCommand`, or any Spring-LS-to-JDT relay;
- modification, replacement, or forking of Zed, the Java extension, Java proxy,
  JDT LS, or Spring Tools JARs;
- a Spring Framework or Spring Boot dependency in the fixture;
- Gradle, multiple projects, multiple worktrees, remote development, or WSL;
- managed `latest` downloads, artifact repackaging, or redistribution;
- production manifests, modules, installers, coordinators, architecture,
  packaging, CI, roadmaps, or support claims; and
- any conclusion for Linux, Windows, x86_64, or untested JDK versions.

## Confirmed facts and primary sources

All web sources in this section were accessed on 2026-07-14. Local binary
observations came from the already verified official VSIX and pinned JDT LS
artifact retained under ignored `tmp/` storage.

### Fixed Spring release input

| Field | Fixed value |
| --- | --- |
| Release tag | `5.2.0.RELEASE` |
| Source commit | `18d1a975dbea4f9314fd736d0237bd9e23f243f9` |
| Release asset | `vscode-spring-boot-2.2.0-RC1.vsix` |
| Package version | `2.2.0` |
| Size | 82,759,143 bytes |
| SHA-256 | `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` |

- The official [release](https://github.com/spring-projects/spring-tools/releases/tag/5.2.0.RELEASE)
  supplies the fixed VSIX used by this plan.
- The release [`package.json`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/package.json)
  declares the five `javaExtensions` paths in the order recorded below.
- The release [`plugin.xml`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.extension/plugin.xml)
  registers `sts.java.search.types` as a static JDT LS delegate command.
- [`SearchHandler.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.extension/src/org/springframework/tooling/jdt/ls/extension/SearchHandler.java)
  deserializes the first command argument as `JavaSearchParams` and calls
  `JavaFluxSearch.fuzzySearchTypes` for this command.
- [`JavaSearchParams.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/commons/commons-lsp-extensions/src/main/java/org/springframework/ide/vscode/commons/protocol/java/JavaSearchParams.java)
  defines the request fields and the `fuzzy` search type.
- [`ResourceUtils.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.commons/src/org/springframework/tooling/jdt/ls/commons/resources/ResourceUtils.java)
  requires the supplied URI to resolve to an accessible Eclipse project with a
  Java nature.

### Exact Spring Java-extension JAR set

The VSIX declares these five files, in this order:

| Order | File | Bundle symbolic name and version | Size | SHA-256 |
| ---: | --- | --- | ---: | --- |
| 1 | `io.projectreactor.reactor-core.jar` | `io.projectreactor.reactor-core` 3.3.1.202211021051-RELEASE | 1,627,393 | `76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590` |
| 2 | `org.reactivestreams.reactive-streams.jar` | `org.reactivestreams.reactive-streams` 1.0.3 | 21,386 | `71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038` |
| 3 | `jdt-ls-commons.jar` | `org.springframework.tooling.jdt.ls.commons` 5.2.0.202606051943 | 140,287 | `0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69` |
| 4 | `jdt-ls-extension.jar` | `org.springframework.tooling.jdt.ls.extension` 1.0.0.202606051943 | 23,886 | `692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce` |
| 5 | `sts-gradle-tooling.jar` | `org.springframework.tooling.gradle` 5.2.0.202606051943 | 8,293 | `9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4` |

`jdt-ls-commons.jar` embeds `lib/commons-lsp-extensions.jar`, size 68,569
bytes and SHA-256
`11f2244eab790f0f201310d34447c127558b41cfee1ed3030ef7b808d860e15c`.
The same file also exists at the VSIX JAR root, but it is not a separate
`javaExtensions` contribution and must not be injected a sixth time.

### Static compatibility audit

The two Spring JDT bundles require Java 21. Their required JDT LS, Eclipse,
Guava, LSP4J, M2E, Buildship, Maven runtime, JDT launching, and manipulation
bundles are present in the pinned JDT LS 1.60.0 archive. Notable observed bundle
versions include:

| Required bundle | Pinned JDT LS provider |
| --- | --- |
| `org.eclipse.jdt.ls.core` | 1.60.0.202606262232 |
| `org.eclipse.jdt.core` | 3.46.100.v20260621-2217 |
| `org.eclipse.jdt.core.manipulation` | 1.24.200.v20260624-1812 |
| `org.eclipse.core.resources` | 3.24.100.v20260611-1641 |
| `org.eclipse.buildship.core` | 3.1.10.v20250827-0209-s |
| `org.eclipse.m2e.core` | 2.7.700.20260205-1611 |
| `org.eclipse.m2e.maven.runtime` | 3.9.1200.20260112-2306 |
| `org.eclipse.lsp4j` / `jsonrpc` | 1.0.0.v20260209-1721 |
| `com.google.guava` | 33.5.0.jre |

JDT LS's `com.google.gson` bundle exports the four packages imported by Spring
at version 2.14.0, satisfying Spring's lower-bound 2.7.0 imports. The three
remaining required bundle symbolic names are supplied by the contribution set:
Reactor Core, Reactive Streams, and Spring Gradle tooling. Buildship 3.1.10 also
satisfies the Gradle bundle's `bundle-version="3.0.0"` requirement.

No JAR in the fixed JDT LS plugin directory already declares any of the five
Spring contribution symbolic names, so the pre-run static audit found no
same-name bundle collision. This audit does not establish class-level binary
compatibility or successful activation.

### Reused S003 tuple

S003 already verified and locally prepared:

- Zed 1.10.3, build `20260713.002323`, client commit
  `0c54c414d522234de7298039708ffe85a116892a`;
- official Java extension 6.8.21, commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`;
- JDT LS 1.60.0, source commit
  `57ed41bdddc93df13ace6a266d8e3c1d35c95618`;
- Java proxy v6.8.21 for macOS arm64; and
- Java debug bundle 0.53.2.

S003 records exact artifact sizes, digests, sources, preparation behavior, and
the unchanged proxy test-oracle constraint. S004 must reverify those retained
inputs before runtime but must not reacquire them merely to repeat installation.

| Reused input | Local verification identity |
| --- | --- |
| `jdt-language-server-1.60.0-202606262232.tar.gz` | 50,925,681 bytes; SHA-256 `e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d` |
| Prepared macOS arm64 `java-lsp-proxy` executable | 834,304 bytes; SHA-256 `53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076` |
| `com.microsoft.java.debug.plugin-0.53.2.jar` | 3,107,682 bytes; SHA-256 `5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c` |

The pinned JDT LS [`bin/jdtls.py`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/bin/jdtls.py)
derives its default data directory from SHA-1 of the current working directory's
basename. For the observed Java-extension launch, the S003 repository basename
`zed-spring-tools` maps to
`0d0e44bd29f56de0a0966e6efedfae57a9a7e896`; the planned S004 basename maps to
`472711226db249e771a9ffe516171e0911f02075`. These are cache keys, not evidence
paths, and they must remain distinct.

## Inferences

1. Advertising the command proves registration, while returning the unique
   fixture type proves that the Spring handler instantiated and traversed the
   imported JDT Java model. Either observation alone is insufficient.
2. A dependency-free Maven project makes project import observable without
   introducing Spring dependency resolution or wrapper downloads.
3. Excluding binaries and system libraries confines the search scope to the
   fixture and avoids treating a JRE type lookup as project-import evidence.
4. Reusing the isolated profile's exact Java extension installation reduces UI
   setup without changing the tested Java/JDT tuple. Attribution still requires
   a fresh extraction of the verified JDT archive and a uniquely named S004
   runtime worktree because S003 showed that OSGi configuration persists across
   restarts and the pinned JDT launcher keys its default data directory from the
   worktree basename.
5. The unchanged private proxy endpoint can observe one already-running JDT LS
   command, but it remains unsuitable as a product integration contract.

## Unverified hypotheses

1. All five verified JARs resolve and activate together against JDT LS 1.60.0.
2. Their classes have no runtime linkage incompatibility with the newer JDT,
   LSP4J, Gson, M2E, or Buildship classes in the fixed runtime.
3. Zed and the Java extension preserve all five paths once, in declared order,
   alongside the debug bundle.
4. The Maven fixture imports as an accessible Eclipse Java project without an
   external dependency or build-tool download.
5. `sts.java.search.types` appears in the initialize response and accepts the
   release contract through the unchanged proxy.
6. The unique source type appears in the returned descriptor list with the
   expected fully qualified name and class flag.
7. A fresh JDT runtime plus a unique runtime-worktree basename prevents the
   S003 OSGi configuration and JDT data cache from supplying command or project
   state to S004.
8. Restart repeats bundle activation, import, and command behavior without
   stale S003 state or duplicated paths.

## Environment

Planned first execution environment:

| Component | Fixed value | S004 use |
| --- | --- | --- |
| OS | macOS 26.5.1, arm64 | First host only |
| Zed | 1.10.3, build `20260713.002323` | Client under test |
| Isolated profile | Retained ignored S003 research profile | Reuse Java 6.8.21; remove S003 dev link before S004 |
| Official Java extension | 6.8.21 | Unmodified |
| JDT LS | 1.60.0 fixed S003 archive | Reverify, then extract a fresh S004 runtime; no managed download |
| Java proxy | v6.8.21 macOS arm64 | Unmodified; private oracle only |
| Java debug | 0.53.2 | Preserve normal Java extension injection |
| Spring JDT set | Five fixed JARs above | Extract from verified VSIX into ignored S004 storage |
| Java runtime | SDKMAN Temurin JDK 25.0.3 | Runtime and preparation tool |
| Fixture | Dependency-free Maven Java 21 project | Copy into uniquely named ignored S004 runtime worktree |
| Rust | rustup stable 1.97.0, `wasm32-wasip2` | Disposable adapter build |

The local run supplies only macOS arm64/JDK 25 evidence. Representative evidence
still requires the same fixed plan on macOS arm64, Linux x86_64, and Windows
x86_64 with JDK 21; the available macOS host retains the additional JDK 25 run.

## Planned disposable artifacts

No file in this section may be added until this plan is reviewed and the user
directs implementation to begin.

```text
spikes/s004-spring-jdt-command/
├── extension/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── extension.toml
│   ├── probe/lifecycle_probe.js
│   └── src/lib.rs
├── fixture/
│   ├── pom.xml
│   └── src/main/java/dev/zed/spring/s004/S004OnlyProbe9F2C.java
└── tools/PrepareS004.java
```

Generated and runtime data must remain ignored:

```text
tmp/s004-artifacts/
tmp/s004-evidence/
tmp/s004-runtime-worktree-9f2c/
spikes/s004-spring-jdt-command/extension/target/
spikes/s004-spring-jdt-command/extension/extension.wasm
```

The preparation tool will accept caller-supplied local paths, verify the fixed
VSIX and JDT archive sizes and digests, parse their ZIP and tar/gzip structures
safely, and create a fresh ignored S004 JDT runtime. It will verify
`package.json` and extract only the five declared Spring JARs into the uniquely
named ignored runtime worktree. It will verify each JAR's size, digest, symbolic
name, version, and required Java level before transactional activation. It will
reject traversal, links, duplicates, unexpected layouts, undeclared JARs, and
existing nonempty output.

The tool will also audit the fresh JDT plugin manifests for the required bundle
providers and collision conditions listed above, then copy the committed fixture
into `tmp/s004-runtime-worktree-9f2c/`. The archive contains no mutable
`configuration/` directory; that directory must also be absent immediately
after extraction. The tool will not download, launch, modify, sign, or repackage
any third-party component.

The disposable adapter will contribute only the five absolute paths below the
active worktree's `.s004-artifacts/bundles/` directory for target language
server `jdtls`. Its separate lifecycle probe exists only to make adapter startup
and shutdown attributable. It will not start JDT LS, Spring LS, Maven, Gradle,
or a coordinator.

## Plan review gate before implementation

Implementation may begin only after review confirms all of the following:

1. the hypothesis names one fixed Spring/JDT/Zed/JDK tuple and one command;
2. the bundle list comes from the verified release manifest and has exactly five
   entries, not the extra root copy of `commons-lsp-extensions.jar`;
3. the static compatibility audit has no unresolved required bundle or symbolic
   name collision;
4. the fixture has no external dependency and the command cannot pass solely by
   searching JRE or application-library types;
5. the implementation diff adds only disposable S004 files and index/status
   updates allowed by `AGENTS.md`;
6. no binary, archive, raw log, port, home path, or credential can be committed;
7. normal Zed settings and extensions remain untouched; and
8. the S004 runtime uses both a fresh JDT extraction and a unique JDT data-cache
   key rather than trusting removal of the S003 initialization path; and
9. no runtime/UI execution begins until the complete Gate A diff is reviewed.

## Procedure

### Gate 0: completed static review

1. Verify the release tag, source commit, VSIX identity, package
   `javaExtensions`, JAR manifests, command registration, handler input, and
   result fields against primary source and the fixed binary.
2. Compare every Spring `Require-Bundle` and imported Gson package with the
   pinned JDT LS plugin manifests.
3. Check for symbolic-name collisions between the five Spring JARs and the JDT
   LS plugin set.
4. Record unresolved compatibility questions rather than treating manifest
   resolution as runtime support.

Gate 0 is complete for planning: the dependencies are statically satisfiable,
no collision was found, and binary compatibility remains the S004 hypothesis.

### Gate A: implementation and non-UI validation

1. Add only the planned disposable S004 tree and required documentation/index
   updates.
2. Make the adapter return the exact five bundle paths only for target `jdtls`;
   reject missing or non-regular prepared files with a clear message.
3. Implement the fixed Maven fixture with Java release 21 and no dependency,
   plugin, repository, wrapper, or network requirement.
4. Implement preparation self-tests for correct input plus wrong digest,
   traversal, link, duplicate, undeclared entry, malformed manifest, missing
   provider, provider-version failure, collision, pre-existing JDT
   `configuration/`, and nonempty destination conditions.
5. Run formatting, Rust compilation/tests, Java source-mode self-tests, fixture
   compilation with `javac --release 21`, manifest/XML/JSON validation, ignored
   path checks, and a repository diff audit.
6. Review the complete Gate A diff. Confirm it cannot download or launch a
   server and that no production structure or unsupported claim was added.
7. Commit Gate A separately only after the review passes.

### Gate B: isolated runtime execution

1. Stop normal Zed before opening the isolated profile. Inventory the normal and
   isolated extension sets without modifying the normal profile.
2. In the retained isolated profile, remove the S003 development-extension link
   and its adapter configuration. Retain the official Java 6.8.21 installation.
   Verify no synthetic bundle path or S003 process is active.
3. Reverify the retained JDT archive, proxy executable, debug JAR, and VSIX
   against their fixed identities. Prepare a fresh S004 JDT extraction and the
   uniquely named ignored runtime worktree; require both to be absent before
   transactional preparation and require the new JDT runtime to have no local
   `configuration/` area. Do not download a managed replacement.
4. Install the S004 development extension in the isolated profile and point the
   unmodified Java extension settings at the prepared JDT launcher, proxy, and
   debug bundle. Keep Lombok, JDK auto-download, and update checks disabled.
5. Open only `tmp/s004-runtime-worktree-9f2c/` and trust that worktree. Confirm
   from the pinned launcher algorithm that its basename maps to a different JDT
   data-cache directory than S003's `zed-spring-tools` root. Wait for JDT LS
   project import to complete without invoking a wrapper or fetching a project
   dependency.
6. Capture the final JDT LS initialize request and response. Require the
   `bundles` array to contain the debug bundle plus each of the five Spring paths
   exactly once, in declared Spring order, with no S003 synthetic path. Require
   the initialize response not to advertise `s003.synthetic.ping`.
7. Inspect JDT LS and Zed logs for install, resolution, activation, linkage,
   extension-point, project-import, and command-registration evidence. Require
   the initialize response to advertise `sts.java.search.types`.
8. Discover the unchanged proxy endpoint using the exact pinned Java-extension
   algorithm and keep its port-file details private in ignored evidence. Send
   exactly one `workspace/executeCommand` request with command
   `sts.java.search.types` and a single argument equal to the fixed request.
9. Require the result list to contain a descriptor with the exact fixture
   `fqName` and `clazz: true`. Preserve the full response only in ignored
   evidence and commit a structural summary.
10. Record initialization/import duration and point-in-time RSS for the adapter,
    proxy, and JDT LS without treating them as steady-state benchmarks.
11. Restart the active language servers once. Confirm replacement processes,
    reinitialization, exactly-once bundle paths, fixture import, command
    advertisement, and the same structural command result with one additional
    oracle request.
12. Record shutdown and `exit` behavior under the S001 lifecycle constraint;
    graceful final `exit` observation is not a success condition.
13. Stop the isolated instance, verify no S004 probe, proxy, or JDT LS process
    remains, restore any input-source change made for automation, and reopen
    normal Zed. Retain the isolated profile and Java installation unless the
    user asks to remove them.
14. Summarize successful, failed, interrupted, and corrected observations and
    classify the result. Do not promote spike code or private proxy use.

UI automation is permitted only for Gate B. Immediately before it starts, tell
the user not to use the keyboard or mouse until control is restored; immediately
after it ends or is interrupted, restore the prior input state and tell the user
that normal interaction is safe again.

No retry may change the Spring release, any JAR, JDT LS, Java extension, proxy,
debugger, command, request payload, fixture class, or injection mechanism. One
documented correction is allowed only for a clear operator setup mistake such as
an incorrect prepared absolute path.

## Success criteria

The hypothesis is Supported on the tested host only if all of these hold:

1. Every executed component and injected JAR matches the fixed identities, and
   no managed JDT LS, proxy, debugger, Lombok, task helper, Spring artifact,
   Maven wrapper, or project dependency is downloaded during the run.
2. The unmodified Java extension and proxy initialize JDT LS 1.60.0 on JDK 25.
3. The final bundle array retains debug 0.53.2 and contains each of the five
   Spring paths exactly once, in declared order, with no synthetic S003 path;
   `s003.synthetic.ping` is also absent from advertised commands.
4. JDT LS reports no install, resolution, activation, linkage, classloading, or
   extension-point error attributable to the Spring bundle set.
5. The Maven fixture is an accessible imported Java project, and the initialize
   response advertises `sts.java.search.types`.
6. The unchanged proxy returns a list containing the exact unique fixture type
   descriptor with `clazz: true` for the fixed source-only request.
7. Restart repeats criteria 2-6 without duplication, stale S003 state, or any
   modification of Zed, Java extension, proxy, JDT LS, or Spring JARs.
8. No unrelated UI, trust, Java runtime, framing, permission, import, or logging
   failure prevents attribution.

## Failure criteria

The hypothesis is Refuted for the tested host if any of these persists after
the single permitted setup correction:

- any verified Spring bundle cannot install, resolve, activate, or link against
  JDT LS 1.60.0;
- final initialization omits or duplicates a Spring path, replaces debug,
  retains the S003 synthetic path, or advertises the S003 synthetic command;
- `sts.java.search.types` is absent, its handler cannot instantiate, or its
  fixed request fails after the Maven fixture is confirmed imported;
- the response lacks the exact fixture type or reports it as a non-class;
- success requires adding another JAR, changing an artifact/version/payload,
  enabling binaries/system libraries, or modifying a tested component; or
- restart loses or duplicates an otherwise successful configuration.

The result is Inconclusive when a fixed input cannot be reverified, the retained
official Java extension no longer identifies as 6.8.21, an unrelated Zed/JDK/UI
or Maven-import failure prevents the command path from being reached, the
private test oracle is unavailable before behavior can be distinguished, or
required evidence is insufficient for attribution.

## Evidence and privacy rules

- Commit only fixed fixture/source text and summarized observations.
- Keep the VSIX, extracted JARs, JDT runtime, executable, generated WASM, raw
  protocol logs, proxy envelopes, port files, screenshots, process listings,
  and host paths under ignored `tmp/` storage.
- Do not record credentials, environment values, localhost ports, unrelated
  documents, or absolute home-directory paths in committed evidence.
- Preserve negative, interrupted, and corrected observations; never delete them
  to make the result appear successful.
- Update this document, the spike index, and prerequisite status after Gate B.

## Remaining blockers and constraints

- Static manifests cannot establish binary compatibility because the Spring
  build used a mutable JDT LS snapshot repository.
- The proxy endpoint remains private and is authorized only as an observation
  mechanism for this spike.
- Linux x86_64 and Windows x86_64 Zed hosts are not yet available.
- Third-party licensing/provenance gaps still prohibit a project-operated
  Spring artifact mirror or repackaged distribution.

## Remaining uncertainty after a Supported result

Even Supported would not establish:

- classpath-listener registration, callback delivery, or removal;
- any route from Spring Boot LS through Zed to JDT LS;
- useful Spring completion, diagnostics, navigation, or Java analysis;
- Gradle import, Spring dependencies, multi-project or multi-worktree behavior;
- a supported public coordination API with the Java extension;
- installation, upgrading, offline acquisition, or redistribution strategy; or
- multiplatform or product feasibility.

## Candidate next experiment

If Supported, write and review S005 around exactly one classpath-listener
registration and callback. S005 must define the minimal disposable proxy
boundary and must not assume that the Java proxy's private endpoint is a product
API.

If Refuted, record which compatibility layer failed and stop S005. Investigate
only whether an official, immutable Spring/JDT version pairing can be identified
without relaxing the repository's pinned-artifact and direction-decision gates.

## Plan review record

The initial plan review checked hypothesis narrowness, artifact pinning, command
determinism, source-only project attribution, static bundle closure, profile
isolation, evidence privacy, retry limits, multiplatform wording, and the
research-only repository boundary. It found and corrected one attribution flaw:
reusing the mutated S003 JDT directory or its basename-derived data cache could
retain OSGi or project state even after removing the synthetic initialization
path. The corrected plan reuses the installed Java extension but requires a
fresh JDT extraction and a uniquely named ignored S004 runtime worktree.

Review outcome: **Ready for user review; implementation has not started.** The
main residual risk is deliberate and belongs to the hypothesis: release-source
metadata cannot identify the precise JDT LS snapshot used to compile the Spring
JARs. No plan correction can turn that into a confirmed fact; Gate B must test
the fixed pairing.
