# R021: Spring Tools 5.3.0 refresh — Stage 0 and Stage 2 audit

- Status: Stages 0 and 2 complete; Stages 1, 3 and 4 not executed
- Last updated: 2026-08-01
- Investigator: Claude Opus 5

## Question

Spring Tools `5.3.0.RELEASE` is the first upstream release published since this
repository pinned `5.2.0.RELEASE`, so the refresh gate in
[pinned-release-refresh-gate](../pinned-release-refresh-gate.md) is executable
for the first time. What actually changed between the two releases, and which of
this repository's `verified` rows does that change reach?

This document is the Stage 2 output the gate requires. It answers "what changed"
on its own, and it is the input that decides how much of Stage 3 is needed.

## Scope

Included: Stage 0's three preconditions, and all six Stage 2 axes — the
configuration schema, `problem-types.json`, the absent-key defaults this
extension supplies, the VS Code client launcher, the command set, and the
behavioural asserts individual inventory rows rest on.

Excluded, deliberately: no driven run was performed, no inventory row state was
changed, and `src/artifacts.rs` was not modified. Stage 1's re-pin commit and
Stage 3's tiered gates are separate work, and the gate requires Stage 1 to be
its own commit so a rollback can take the pin without the adaptation.

## Stage 0 — preconditions

All three pass.

1. **A newer release exists and is a full VSIX.** `5.3.0.RELEASE`, published
   2026-07-29T16:00:57Z, `prerelease: false`. It carries exactly one asset,
   `vscode-spring-boot-2.3.0-RC2.vsix`, 83,000,863 bytes. (The asset keeps an
   `-RC2` suffix while the release itself is final; that suffix is the VS Code
   extension's own version string, not the release's.)
2. **No other slice is in flight.** No open pull requests; the working tree held
   only two untracked, unrelated blog drafts.
3. **The current pin's driven evidence is present.** 31 gate directories under
   `tmp/`, including the two Tier A anchors the gate names by path —
   `tmp/offline-behaviour-20260726/evidence/` and
   `tmp/m5-jdk21-floor-20260726/evidence/`. The archived baseline VSIX at
   `tmp/s002-artifacts/vscode-spring-boot-2.2.0-RC1.vsix` hashes to
   `70943c4e…71bb3`, which is the `SHA256` constant in `src/artifacts.rs`
   verbatim, so the comparison below is against the exact bytes that every
   `verified` row was observed on.

## Confirmed facts

### Artifact identity (Stage 1 inputs, not yet applied)

| Constant | Pinned `5.2.0.RELEASE` | `5.3.0.RELEASE` |
| --- | --- | --- |
| `VERSION` | `5.2.0.RELEASE` | `5.3.0.RELEASE` |
| `ASSET` | `vscode-spring-boot-2.2.0-RC1.vsix` | `vscode-spring-boot-2.3.0-RC2.vsix` |
| `SIZE` | 82,759,143 | 83,000,863 |
| `SHA256` | `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` | `8e555da123e5b4edb7449d3ef1f922a922503e64a86cd66cbe713638f94a9e50` |

**The composition contract holds.** All six `REQUIRED` entries exist in the new
VSIX, `extension/jars/` carries the same seven jars as before, and
`extension/language-server/lib/` still exists — so the gate's stop condition
("an upstream release that drops or renames a required jar") is not triggered.
The one path that changes does so only through the embedded version number:

| `REQUIRED` entry | New digest |
| --- | --- |
| `extension/language-server/spring-boot-language-server-2.3.0-SNAPSHOT-exec.jar` | `eed894c869caa71ce139eaf1f95f56120e97518102d52471803fd5a9d436a682` |
| `extension/jars/io.projectreactor.reactor-core.jar` | `76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590` (unchanged) |
| `extension/jars/org.reactivestreams.reactive-streams.jar` | `71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038` (unchanged) |
| `extension/jars/jdt-ls-commons.jar` | `bfdb51f0ae7df7bd4f1ba7a07109ccab361b62f1f003ac1613cede0434040530` |
| `extension/jars/jdt-ls-extension.jar` | `7a6d24e436adec9674098b15fc3f28b8161d216d5bd372b7fdc29c50491e261c` |
| `extension/jars/sts-gradle-tooling.jar` | `8063a93858cc90bcf8d3f890a0c5ff11b557f9b4fd24cb0b954bb1e1b96c6d0e` |

Note the server jar's *path* changes with the release. `REQUIRED` keys on the
full path, so the entry must be rewritten, not just re-digested.

### Stage 2 axis 1 — configuration keys: no change at all

Parsing `contributes.configuration` from both `package.json` files and comparing
every key's default, type, enum and deprecation message:

- 118 keys before, 118 after.
- 0 added, 0 removed, **0 changed defaults**, 0 changed types, enums or
  deprecation messages.

The gate singles out changed defaults as the most easily missed delta. There are
none. The pinned count of 118 that [R011](011-vscode-spring-tools-capability-surface.md)
and [R018](018-spring-tools-zed-outcome-parity-audit.md) derive from is
unaffected.

The entire `package.json` diff is 28 lines: the `version` field, removal of the
`portfinder` runtime dependency, and an `esbuild` devDependency bump. No
command, language, view or activation-event contribution changed.

### Stage 2 axis 2 — `problem-types.json`: byte-identical

The file is identical between the two server jars: 11 categories, all problem
types, all severities unchanged. Because this file is the whole settings audit
for the Java reconcilers, its being unchanged is what keeps the diagnostics
gates out of Tier B *on the catalogue axis*. The reconciler *implementations*
did change — see axis 6.

### Stage 2 axis 3 — absent-key defaults: no change

`org/springframework/ide/vscode/boot/app/BootJavaConfig.class` is
**byte-identical** between the two releases
(`29a41ad049ff7fbfd97f02ebd32f26c14de6e1464920acb708b696d619aed94a`).

Every absent-key default that `spring_workspace_configuration` in `src/lib.rs`
exists to compensate for is therefore unchanged, including the four the
inventory records as instances of the trap — `jpql`, `inject-bean`, the XML
sub-settings and `modulith-project-tracking`. This refresh neither fixes nor
creates an instance. This axis needed no per-getter re-reading: one digest
settles it.

### Stage 2 axis 4 — the client launcher: one real delta

`extension/dist/extension.js` differs by 22 bytes, but the raw diff is 17,916
lines because the esbuild 0.27→0.28 bump renamed every minified identifier. That
diff is unreadable and misleading. Comparing the axes that survive minification
instead:

| Axis | Old | New | Result |
| --- | --- | --- | --- |
| `boot-java.*` settings | 5 | 5 | identical |
| `spring-boot.*` settings | 23 | 23 | identical |
| `sts/*` commands | 41 | 41 | identical |
| `sts.*` commands | 15 | 15 | identical |
| `vscode-spring-boot.*` commands | 21 | 21 | identical |
| `java.*` settings | 1 | 1 | identical |
| JVM `-D`/`-X`/`--` arguments | 33 | 29 | **4 removed** |

The four removed arguments are `-Djava.rmi.server.hostname`,
`-Dcom.sun.management.jmxremote.port`,
`-Dcom.sun.management.jmxremote.authenticate` and
`-Dcom.sun.management.jmxremote.ssl`.

They lived in the client's `DebugConfigurationProvider`, registered under
`boot-java.live-information.automatic-connection.on`, which appends VM arguments
when a Boot application is launched. The change is precise:

- **Still injected**, unchanged: `-Dspring.jmx.enabled=true`,
  `-Dmanagement.endpoints.jmx.exposure.include=*`,
  `-Dspring.application.admin.enabled=true`, `-Dspring.boot.project.name=…`.
- **No longer injected**: an explicit RMI hostname and a free JMX port obtained
  from `portfinder` (`getPortPromise({startPort: 10000})`), plus the two
  `jmxremote` authentication/SSL switches that accompanied it.

That `-Dspring.application.admin.enabled=true` survives matters directly: the
Open Boot app page URL row depends on it, because without it Boot 3.x masks the
environment port. That dependency is intact.

The connection handshake changed shape with it. The old client called
`vscode-spring-boot.live.activate` and keyed the process by its JMX URL; the new
client calls it with `{host: "127.0.0.1", port: null, urlScheme: "http",
jmxurl: null, manualConnect: true, processId, processName, projectName}` and
derives the process key from that payload. JMX mentions in the bundle fall from
15 to 4 and `getPortPromise` calls from 3 to 1.

### Stage 2 axis 5 — commands: no change

- Client side: all five command namespaces above are identical, including the
  41 `sts/*` server commands the client can call.
- Server side: scanning every string constant in all 938 server classes for
  `sts/`- and `sts.`-shaped identifiers yields 31 in both releases, with 0 added
  and 0 removed.

No command gained or lost an id. The inventory rows that rest on a command being
caller-less upstream — the WS4 build row's `sts.gradle.build` and
`sts.maven.goal` findings — keep their premise, since neither the client's
command registrations nor its callers changed.

### Stage 2 axis 6 — behavioural asserts and the server class delta

The server jar carries 936 classes before and 938 after. Four are removed, six
added, and 61 of the 932 common classes changed.

**Added / removed:**

| Change | Class |
| --- | --- |
| renamed | `boot/app/RestTemplateFactory` → `boot/app/ClientHttpRequestFactoryProvider` (with its `$1`, `$2`, `$HostExclusions` members) |
| added | `boot/java/livehover/v2/LocalJvmAttach` |
| added | `boot/index/cache/IndexGsonTypeFactories` |

**Changed, by package:** `boot/index/cache` 15, `boot/java/reconcilers` 12,
`boot/app` 12, `boot/validation/generations` 4, `boot/java/livehover/v2` 3,
`boot/java/beans` 3, `boot/mcp` 2, `boot/java/utils` 2, `boot/java/rewrite` 2,
and one each in `boot/metadata/util`, `boot/java/livehover`,
`boot/java/commands`, `boot/java`.

Six findings follow from reading them.

#### Finding 1 — the patch-only upgrade assert survives

`SpringBootUpgrade.class` changed, but its string constants are identical,
including `"Non patch version upgrades not supported!"` and
`"Only Maven projects supported"`. The only semantic difference in its
disassembly is that two call sites moved from
`Version.toMajorMinorPatchVersionStr()` to `Version.toString()`.

The behavioural assert the Spring Boot upgrade row rests on — that the upgrade
is patch-only and its major/minor quick fixes are dead code — is therefore
intact. The rendered version string it passes on is not, because `Version`
itself was rewritten (finding 2).

#### Finding 2 — `Version` was rewritten, and it is the widest-reaching change

`org/springframework/ide/vscode/commons/Version`, in
`commons-lsp-extensions-*.jar`, changed substantially:

| | `5.2.0.RELEASE` | `5.3.0.RELEASE` |
| --- | --- | --- |
| Fields | mutable `major`, `minor`, `patch`, `qualifier` | final `major`, `minor`, `patch`, **`build`**, `qualifier`, **`releaseType`** |
| Parse pattern | strict SemVer: `(0\|[1-9]\d*)\.(0\|[1-9]\d*)\.(0\|[1-9]\d*)…` — three components mandatory | `(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?([-.+].*)?` — one to five components |
| Qualifier typing | none | new nested enum `Version$ReleaseType` = `ALPHA`, `BETA`, `MILESTONE`, `RC`, `SNAPSHOT`, `RELEASE`, `SERVICE_PACK`, matched by `^(snapshot\|alpha\|a\|beta\|b\|milestone\|m\|rc\|cr\|sp)(\d*)$` plus the literals `final`, `ga`, `release` |

The release predicate moved with it. `MavenMetadata` previously carried its own
private `isRelease(Version)` — true when the qualifier was null, empty, or
case-insensitively `"RELEASE"`. It now calls `Version.isRelease()`, which is
true when `releaseType` is `RELEASE` **or `SERVICE_PACK`**.

The two predicates are not equivalent, and both the parse and the predicate move
the boundary:

- Versions with fewer than three components (`4`, `4.1`) previously failed to
  parse and were logged and dropped; they now parse.
- A four- or five-component version (`4.1.0.1`) now parses into the new `build`
  field.
- Qualifiers `GA` and `FINAL` now count as releases; previously only an
  empty qualifier or `RELEASE` did.
- `SP` qualifiers now count as releases.

This is the single change most likely to move an observable outcome, because
`MavenMetadata.getReleaseVersions()` feeds the Spring Boot version/support
validation row, and `Version.toString()` now feeds the upgrade row's target
version string.

#### Finding 3 — the local live-process attach mechanism moved into the server

`SpringProcessConnectorLocal` lost exactly three string constants —
`"Error starting local management agent"`, `"No JMX URL available!"` and
`"com.sun.management.jmxremote.localConnectorAddress"` — and the new
`LocalJvmAttach` class carries the third of them, with the signatures:

```
static String startLocalManagementAgent(String) throws Exception;
static String startLocalManagementAgent(VirtualMachineDescriptor) throws Exception;
```

This is the server-side half of axis 4's client change. Where the client used to
hand the server a JMX URL it had arranged in advance by injecting a port, the
server now attaches to the local JVM itself — by process id via the first
overload — and starts the local management agent. Taken together, the local
live-process connect route is a different mechanism in `5.3.0.RELEASE`, even
though no command id or setting key changed to signal it.

#### Finding 4 — every reconciler gained an explicit minimum-version literal

Each changed reconciler acquired a hard-coded version string it did not carry
before:

| Reconciler / contributor | New literal |
| --- | --- |
| `AddConfigurationIfBeansPresentReconciler` | `3.0.0` |
| `AuthorizeHttpRequestsReconciler` | `5.6.0` |
| `BeanRegistrarDeclarationReconciler` | `7.0.0` |
| `HttpSecurityLambdaDslReconciler` | `5.2.0` |
| `ServerHttpSecurityLambdaDslReconciler` | `5.2.0` |
| `WebSecurityConfigurerAdapterReconciler` | `5.7.0`, `6.1.0` |
| `SpringDataCassandraContributor` | `5.1.0-M2` |
| `SpringDataMongoDbContributor` | `5.1.0-M2` |
| `SpringDataCommonsContributor` | `4.1.0-M2` |
| `SpringDataRelationalContributor` | `4.1.0-M2` |

(`BeanMethodNotPublicReconciler` separately lost a `"binding"` literal.)

These are the `isApplicable` dependency gates. This repository already closed
one residual diagnostic by discovering that its precondition was
spring-data-commons ≥ 4.1.0 rather than a code shape; the corresponding gate is
now written as `4.1.0-M2`, which is a *looser* boundary. Combined with finding
2, the comparison these literals participate in is also being performed by a
rewritten parser.

#### Finding 5 — index cache keys are now path-validated

`IndexCacheKey`'s constructor gained a private `requireNoPathSeparator(String,
String)` applied to all four of its fields — `project`, `indexer`, `category`,
`version` — which rejects any value containing `/` (`String.indexOf(47)`). This
is path-traversal hardening on the on-disc index cache. The behavioural
consequence is that a project, indexer, category or version name containing a
forward slash now throws where it previously wrote a nested path.

Fifteen classes in `boot/index/cache` changed in total, alongside the new
`IndexGsonTypeFactories`, so the on-disc index format itself should be treated
as unverified against the old cache until driven. This repository has already
been caught once by a `~/.sts4` cache replay invalidating a control.

#### Finding 6 — `sts/jar/fetch-content` gained an SSRF guard

`boot/java/commands/Misc` implements `sts/jar/fetch-content`. It previously
called `URL.getContent()` on the supplied URL. It now opens the connection,
requires it to be a `JarURLConnection`, and requires the inner jar file URL's
protocol to be `file`, throwing `IllegalArgumentException` otherwise.

Impact here is low: `sts/jar/fetch-content` appears in this repository only in
R011's command inventory listing, and no inventory row rests on it.

### Dependency movements worth recording

The bundled `lib/` set goes from 168 to 167 jars (`LatencyUtils-2.0.3.jar`
dropped). Most entries are routine patch bumps, but two are not:

- **MCP: `mcp-1.1.0` → `mcp-2.0.0`, and Spring AI `2.0.0-M3` → `2.0.0` GA**
  (`mcp-core`, `mcp-json-jackson3`, `mcp-spring-webmvc`, and all eight
  `spring-ai-*` jars). The embedded MCP server row was verified on 2026-07-29
  against the milestone build; it now sits on a major SDK version and a GA
  Spring AI.
- **The server's own runtime: Spring Boot `4.0.6` → `4.1.0`**, Spring Framework
  `7.0.7` → `7.0.8`, Eclipse JDT core and ecj `3.45.0` → `3.46.0`.

## Inferences

### The refresh is safe to land mechanically, and its risk is concentrated

Three of the six Stage 2 axes are provably unchanged — the 118 configuration
keys, `problem-types.json`, and `BootJavaConfig`'s absent-key defaults — and a
fourth, the command set, is unchanged on both the client and server side. The
declared surface this repository derived its inventory from is identical.

The risk is entirely in implementation, and it concentrates in four places:
version parsing and the release predicate, the local live-process attach
mechanism, the index cache format, and the MCP SDK major bump.

### Tier B mapping for Stage 3

The gate asks that each Stage 2 delta be mapped mechanically to the rows that
cite it. Applying that:

**Tier A — run regardless** (unchanged from the gate's own list): cold install
and artifact verification via the offline gate; the LSP handshake and classpath
bridge reaching a resolved project; the removal/cleanup contract; and the
declared JDK 21 floor. The last is not idle here — the server's own runtime
moved to Spring Boot 4.1.0, which is exactly the kind of change that can raise a
launcher's asserted minimum Java version.

**Tier B — pulled in by a Stage 2 delta:**

| Row | Pulled in by |
| --- | --- |
| Spring Boot version/support validation | finding 2 — `MavenMetadata` release predicate and version parsing both changed |
| Spring Boot upgrade | finding 2 — `toString()` replaces `toMajorMinorPatchVersionStr()` in the upgrade path |
| Inlay-hint label commands (pom "Upgrade to the Latest Patch") | same path as above |
| Connect / disconnect to a local Boot process | finding 3 — local attach moved to `LocalJvmAttach`, process-id keyed |
| Live hover data; Show / hide / refresh live data; Metrics; Loggers; Automatic connection | finding 3 — all ride the local connector whose mechanism changed |
| Remote connect | axis 4 — the client's `live.activate` payload shape changed; the row's `jmxurl`-keyed process key needs re-confirming |
| Java Spring diagnostics and quick fixes | finding 4 — every reconciler's applicability gate is newly literal |
| Spring AI annotation diagnostics and indexing | findings 4 and the Spring AI GA bump |
| Embedded Spring Tools MCP server | MCP SDK 1.1.0 → 2.0.0 major bump |
| Workspace symbols (Spring symbols); Browse / navigate the Spring logical structure | finding 5 — 15 index-cache classes changed plus a new Gson type factory |

**Tier C — explicitly not re-run:** the properties/YAML rows, hover and
definition, conversion, completion elision, SpEL and Spring Data query
intelligence, cron, code actions, references and highlights, XML config,
Modulith, run/debug, Maven goal / Gradle build, Boot project info, Open Boot app
page URL, and embedded syntax highlighting. None of these is touched by a Stage
2 delta. Per the gate, they are recorded as untested against `5.3.0.RELEASE`,
which is a different statement from passing.

### The two issues this project filed upstream are closed against 5.4.0, but one root cause moved in 5.3.0

Both issues filed on 2026-07-29 are now closed, and both carry milestone
`5.4.0.RELEASE` — not `5.3.0.RELEASE`:

| Issue | Closed | Milestone |
| --- | --- | --- |
| spring-tools #1949 — MCP `getResolvedProjectClasspath` throws NPE when a classpath jar's file name is not strict SemVer (e.g. `snakeyaml-2.4.jar`) | 2026-07-31 | 5.4.0.RELEASE |
| spring-tools #1950 — `sts.maven.goal` deadlocks on builds that outgrow the pipe buffer | 2026-07-30 | 5.4.0.RELEASE |

Both closures postdate `5.3.0.RELEASE` (2026-07-29), so on the label alone
neither fix ships here. **For #1949 that label is contradicted by the bytecode.**
Its root cause is precisely the strict-SemVer parse that finding 2 shows was
replaced. Testing both extracted patterns against the reported input:

| Version string | `5.2.0` `VERSION_PATTERN` | `5.3.0` `RELEASE_PATTERN` |
| --- | --- | --- |
| `2.4` (from `snakeyaml-2.4.jar`, the reported trigger) | no match | match |
| `2.6` (the snakeyaml `5.3.0` actually bundles) | no match | match |
| `3.5`, `4` | no match | match |
| `2.4.0`, `1.5.34`, `4.1.0.1`, `5.1.0-M2` | match | match |

So the two-component jar version that could not be parsed in `5.2.0.RELEASE`
parses in `5.3.0.RELEASE`. Whether that removes the NPE depends on what the
caller does with the now-successful parse, which a class diff cannot settle — the
two changed `boot/mcp` classes moved no string constants. It should be treated
as a strong hypothesis for the MCP gate to test, not as a fix confirmed by the
milestone label.

#1950 has no such corroboration here: it is a client-side `Runtime.exec`
draining defect, and neither the launcher's command set nor its process handling
shows a relevant change.

## Unverified hypotheses

- That the `Version` rewrite changes an *observable* outcome. The predicate and
  parser demonstrably differ, but whether any version string that Spring Boot's
  actual `maven-metadata.xml` publishes falls on the changed side of that
  boundary is not established by reading bytecode. It requires the
  version/support validation gate.
- That the local live-process route still connects. `LocalJvmAttach` preserves
  the mechanism's *intent*, but attaching by process id through the Attach API
  has different failure modes than reading a JMX URL, and this host's
  `sandbox-exec`/JDK arrangement is not obviously neutral to it.
- That the on-disc index cache from `5.2.0.RELEASE` is invalidated rather than
  misread. The extension keys work directories by release, so the two caches
  should not meet — but that is the mechanism the rollback section says should
  be confirmed during the first real refresh rather than assumed.
- That the removed JMX launch arguments are irrelevant to this product. This
  extension never registers a debug configuration provider, so they have no
  direct analogue here; but the inventory's live-data rows were observed against
  fixture processes started with an explicit JMX port, and it is not established
  that the server's new attach path reaches a process started the old way.

## Primary sources

| Source | Version / commit | Accessed |
| --- | --- | --- |
| `spring-projects/spring-tools` releases API | tags `5.2.0.RELEASE`, `5.3.0.RELEASE` | 2026-08-01 |
| `vscode-spring-boot-2.3.0-RC2.vsix` | sha256 `8e555da1…a9e50` | 2026-08-01 |
| `vscode-spring-boot-2.2.0-RC1.vsix` | `tmp/s002-artifacts/`, sha256 `70943c4e…71bb3` | 2026-08-01 |
| `extension/package.json` (both) | `contributes.configuration`, 118 keys each | 2026-08-01 |
| `extension/dist/extension.js` (both) | 489,562 / 489,584 bytes | 2026-08-01 |
| `spring-boot-language-server-{2.2.0,2.3.0}-SNAPSHOT-exec.jar` | `problem-types.json`, 936 / 938 classes | 2026-08-01 |
| `commons-lsp-extensions-{2.2.0,2.3.0}-SNAPSHOT.jar` | `commons/Version.class` | 2026-08-01 |
| `docs/pinned-release-refresh-gate.md` | the procedure executed here | 2026-08-01 |
| `spring-projects/spring-tools` issues #1949, #1950 | both CLOSED, milestone `5.4.0.RELEASE` | 2026-08-01 |

Disassembly used Temurin JDK 21.0.11 (`javap -p -c`).

## Method note

Two comparisons in this audit were initially misread and are recorded so the
technique is not repeated incorrectly:

- The minified launcher diff is worthless as a diff. The esbuild bump renames
  every identifier, producing ~18,000 diff lines that contain one real change.
  Extracting the semantically stable axes — setting keys, command ids, JVM
  arguments — by regex is what made the delta visible.
- A `javap` diff of two classes that both fail to resolve produces an *empty*
  diff, which reads exactly like "identical". The `Version` class first appeared
  unchanged for this reason; it lives in `commons-lsp-extensions`, not
  `commons-util`. Any empty `javap` diff should be confirmed by checking that
  the class actually resolved on at least one side.

## Status

Stage 2 is complete and no repository state was changed by it. `src/artifacts.rs`
and `extension.toml` still pin `5.2.0.RELEASE`, every inventory row still says
what it said, and `COMPATIBILITY.md` still records one tuple.

The next step is Stage 1 as its own commit, using the constants tabulated above,
followed by the Tier A and Tier B gates mapped here.
