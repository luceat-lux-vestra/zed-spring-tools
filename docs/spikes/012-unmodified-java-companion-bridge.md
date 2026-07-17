# S012: Unmodified Java companion bridge

- Status: Gate B prepared and reviewed; Gate C not started
- Last updated: 2026-07-17
- Target tuple: macOS 26.5.1 arm64, Zed 1.10.3, Temurin JDK 25.0.3
- Depends on: R009, D002, proposed D003, and S011

## Objective and narrow hypothesis

Test whether the required-companion architecture can reproduce S011 without
modifying the official Zed Java extension or its native proxy.

If one disposable Spring bridge bundle is appended to the same JDT LS
initialization as the five fixed Spring bundles, then the unchanged official
Java proxy's existing request channel can invoke a narrowly allowlisted bridge
registration command. The bridge can send the authentic JDT classpath event
directly to an authenticated Spring coordinator route, allowing the same real
Spring Boot LS process to move from zero to exactly one `server.port`
completion. No `workspace/executeClientCommand` callback relay through the Java
proxy is required.

This hypothesis tests one transport only. It does not assert that the observed
official proxy endpoint is a stable API, that future Java releases are
compatible, or that the product architecture is ready.

## Fixed environment and identities

- Zed 1.10.3 signed macOS arm64 application and the S009 isolated-profile
  controls.
- Official Zed Java extension 6.8.21 at commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`.
- Official unmodified proxy asset SHA-256
  `3b128f058eed29e7b7a30c7aaccd430e2964917e45f62e5052d8df676dccb5e5`.
- JDT LS `1.60.0-202606262232`, source commit
  `57ed41bdddc93df13ace6a266d8e3c1d35c95618`, and the pristine distribution
  tree identity retained by S010/S011.
- Spring Tools 5.2.0.RELEASE source commit
  `18d1a975dbea4f9314fd736d0237bd9e23f243f9`, fixed five JDT bundles, fixed
  Spring Boot LS VSIX/server/libraries, and the S011 Boot 3.5.5 Maven fixture.
- The existing S006 Spring stdio proxy may be copied only into a disposable
  S012 probe and changed narrowly to invoke the S012 bridge commands. The S006
  Java proxy patch may not be used, copied, loaded, or present in the final
  profile.

All acquired binaries, generated bundles, profiles, logs, credentials, routes,
worktrees, screenshots, and evidence remain under ignored `tmp/` roots.

## Written design before code

The disposable bridge contributes two delegate commands:

- `zed.spring.bridge.addClasspathListener`
- `zed.spring.bridge.removeClasspathListener`

Add accepts exactly one validated object containing schema version, callback
ID, loopback endpoint, one process-scoped credential, worktree identity, and
the non-batched flag. It stores one active registration and subscribes to JDT
classpath changes by reusing the fixed Spring listener semantics or a source-
equivalent narrow copy justified in the implementation record. Each resulting
event is posted directly to the S012 Spring coordinator route with the original
callback ID and unchanged argument array.

Remove accepts the same schema/identity and unregisters idempotently. The bridge
must reject non-loopback endpoints, unknown keys/versions, empty or oversized
values, duplicate mismatched registrations, and commands after shutdown. It
must use bounded deadlines and must not log credentials or full classpaths.

The S012 Spring proxy retains all unrelated LSP messages unchanged. For
`sts/addClasspathListener`, it discovers and probes the official proxy for the
same worktree, invokes the S012 add command, receives direct bridge events, and
passes the authentic event to the real Spring handler. It maps
`sts/removeClasspathListener` to the exact S012 remove command. It may not
synthesize callback success, cache readiness, or completion items.

## Gate A: static and synthetic implementation

Before any real Zed runtime:

1. create only disposable code under
   `spikes/s012-unmodified-java-companion-bridge/` after this plan is committed;
2. build the bridge bundle from pinned compile inputs and record its manifest,
   imported/exported packages, exact source list, size, and SHA-256;
3. add deterministic unit/contract tests for add/remove validation,
   authentication, callback correlation, duplicate/idempotent behavior,
   deadlines, redaction, and shutdown;
4. test the Spring-proxy mapping against mock official-proxy and bridge endpoints
   with success, timeout, wrong-token, wrong-worktree, duplicate, removal, and
   malformed-response cases;
5. statically compare the final official Java component and proxy hashes to the
   fixed release inputs and reject any Java source checkout, patched proxy, or
   configured replacement proxy in the runtime profile; and
6. review the complete Gate A diff before preparing Gate B.

## Gate A implementation and verification record

Gate A was implemented on 2026-07-17 only under
`spikes/s012-unmodified-java-companion-bridge/`. It contains no Zed extension
manifest, production scaffold, official Java source, Rust proxy patch, copied
S005/S006 callback relay, second JDT LS launcher, or binary artifact. Generated
classes and the bridge JAR remain under ignored `tmp/` roots.

### Confirmed implementation facts

- One OSGi bundle registers only
  `zed.spring.bridge.addClasspathListener` and
  `zed.spring.bridge.removeClasspathListener`. It reuses the exported fixed
  Spring `ReusableClasspathListenerHandler`; no Spring source was copied.
- Registration requires an exact schema, non-batched bridge delivery, an
  explicit loopback HTTP endpoint, a 32-to-256-character credential, a
  64-hex-character worktree identity, and an exact callback identity.
- The Node coordinator permits only those two commands through the official
  proxy request endpoint, rejects symlinked or malformed port records, bounds
  request time and response size, and does not include remote error text in its
  own errors.
- The direct event route requires bearer authentication and the same worktree
  identity, validates the correlated event and exact six-argument shape, and
  returns only the Spring handler result.
- The Spring mapper accepts the real Spring-side batched add shape, registers
  one non-batched bridge listener, forwards the unchanged six arguments to the
  same callback command on the Spring child, and removes the exact registration.
  This is an intentional transport translation, not a synthesized classpath.
- OSGi stop removes known listeners and clears registrations and credentials.
  Actual Equinox activation and stop behavior remain a Gate B/C runtime item.

### Fixed compile inputs and output

The host toolchain was Temurin `java`/`javac` 25.0.3. Sources were compiled with
`--release 21` because the manifest declares `JavaSE-21`. The fixed inputs used
by Gate A were:

| Input | SHA-256 |
| --- | --- |
| JDT LS `com.google.gson_2.14.0.jar` | `2cbd119bf1961c28788310963dc80ba65f58cdeec1dd139c8bdb1240faa2c36f` |
| JDT LS `org.eclipse.core.runtime_3.35.0.v20260623-1631.jar` | `5b0c2794e9fe1785360dec920cc802f3388a0eb72ee25b89054b79ff3e2f07c9` |
| JDT LS `org.eclipse.jdt.ls.core_1.60.0.202606262232.jar` | `e83035adc685b4519f2d8a8d42fe8651ce7ea4f4daf396f47ec453b5bff07be5` |
| JDT LS `org.eclipse.osgi_3.24.300.v20260612-1540.jar` | `4f9ebafd82c344fe89f0860f32c6291becfbb4ab8d480a623e12b4c5ace57984` |
| Spring `jdt-ls-commons.jar` | `0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69` |
| Spring `jdt-ls-extension.jar` | `692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce` |
| Spring `sts-gradle-tooling.jar` | `9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4` |
| Spring `reactor-core.jar` | `76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590` |
| Spring `reactive-streams.jar` | `71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038` |

The deterministic disposable output contained only the manifest, `plugin.xml`,
and six expected class files. `jar --validate` passed. Its identity was 12,092
bytes and SHA-256
`818de215d85c23e27e0c3d429d05e1f7e2d34340f248e9a6da616898cb514984`.
Two clean builds produced the same identity.

The fixed official release archive at
`tmp/s003-research-artifacts/java-lsp-proxy-darwin-aarch64.tar.gz` was rehashed
as `3b128f058eed29e7b7a30c7aaccd430e2964917e45f62e5052d8df676dccb5e5`.
It was not extracted, copied, executed, or modified for Gate A. Gate B must
derive its fresh profile from this fixed release input and separately verify
the extracted executable identity.

### Tests and retained observations

Node 26.5.0 syntax checks passed for all four coordinator modules. Eleven Node
contract tests passed, covering the allowlisted official-proxy envelope,
unsafe registration and port rejection, deadline, malformed response, JSON-RPC
error redaction, direct route authentication and worktree correlation,
six-argument preservation, exact add/remove lifecycle, failed-registration
cleanup, failed-removal identity retention and retry, the Spring request
mapping, duplicate rejection, and idempotent shutdown.

The Java protocol self-test passed registration rejection, registry identity
and idempotence, authenticated correlated event delivery, credential redaction,
HTTP failure, and the three-second deadline. The full three-source bundle then
compiled against the fixed JDT LS and Spring inputs with warnings treated as
errors.

The first Java compile used `-Xlint:all -Werror` and failed with six `classfile`
warnings because the fixed Gson binary references absent Error Prone annotation
classes. This observation is retained. Review confirmed that the warnings came
from the fixed external classfile rather than S012 source, so the corrected
command disabled only `classfile` lint (`-Xlint:all,-classfile -Werror`); all
other warnings in owned source remain fatal.

### Gate A conclusion and remaining uncertainty

Gate A is **supported synthetically** for the stated contracts. This is not an
S012 runtime result and does not change proposed D003 to Accepted. Gate A did
not load the bundle in Equinox, invoke it through a running official Java
extension, start Spring Boot LS, prove `server.port`, exercise Zed UI, or verify
cleanup in real processes. Those uncertainties remain exclusively for fresh
Gate B preparation and the bounded Gate C run.

## Gate B: isolated preparation

Create wholly fresh ignored roots derived from the S011 controls. The
preparation tool must:

- install only the official Java extension plus the disposable S012 Spring
  adapter;
- use the exact official proxy asset and reject local/path overrides;
- append exactly the five fixed Spring bundles plus the one S012 bridge bundle;
- prepare the fixed Spring LS and fixture without generated project state;
- prove no second JDT LS launcher, Java proxy, or managed-JDT fallback exists;
- create empty authenticated route/evidence directories with secrets excluded
  from manifests;
- validate all fixed hashes, allowlists, component-model binaries, process
  absence, and token absence; and
- print the exact bounded runtime procedure without launching Zed.

## Gate B implementation and preparation record

Gate B completed on 2026-07-17 and stopped before any Zed, Java proxy, JDT LS,
Spring LS, or UI launch. All generated builds, profiles, worktrees, XDG roots,
and evidence remain below ignored `tmp/` paths.

### Disposable S012 adapter and Spring coordinator

The Gate B adapter is a spike-only procedural Zed extension. It starts only the
Spring Boot LS wrapper and contributes the exact five fixed Spring JDT bundles
plus `s012-bridge.jar` to the official `jdtls` initialization. It does not
contain or start a JDT LS, Java debugger, Java task runner, Java proxy, or
managed-JDT fallback.

The Spring wrapper reuses the unchanged S006 Spring stdio coordinator core for
LSP passthrough, the same-child baseline/completion controls, and Spring child
request correlation. Its injected Java call site replaces S006's instrumented
route with the Gate A `OfficialJavaTransport` and `CompanionBridgeSession`.
Consequently, the copied Spring test harness may still use its internal S006
method names, but the only commands sent to the official Java proxy are the two
S012 `zed.spring.bridge.*` commands. No S005/S006 Java proxy binary or Java
proxy patch is copied, loaded, or present in the prepared profile.

The wrapper self-test passed an actual loopback add/event/remove cycle against
a mock official transport and fake Spring child handler. It verified the
authenticated direct event, unchanged six arguments, authentic child result,
and exact removal registration. The Gate A contract suite remains the source
of the lower-level timeout, malformed-response, wrong-token, wrong-worktree,
duplicate, and retry coverage.

### Adapter build

- Toolchains: Cargo 1.97.0 and rustc 1.97.0 with installed
  `wasm32-wasip2`.
- The generated locked build reused S006's fixed dependency lock and changed
  only the root package name. The resulting ignored lock SHA-256 is
  `596b4cce99860294bcb123837324d0571d739cf9f1eb42bcbccff915037f91f5`.
- Five host unit tests passed for shell-independent macOS/Linux/Windows paths,
  Java discovery, JDT-only contribution, exact six-bundle order, classpath
  disable, and server-ID rejection.
- Two clean release builds produced a byte-identical 237,084-byte component-
  model WASM with SHA-256
  `3641228bf613c302515aa833b1d028405f79fa9e44cc69abb109ddf41ee4486d`.
  Multiplatform code shape is present, but only the macOS arm64 runtime is being
  tested and all other targets remain `untested`.

### Fresh prepared roots and fixed identities

The preparation tool verified and staged:

- the Zed-installed official Java extension 6.8.21 tree
  `58e1155d9a6339790470e0b1ac31e49a7fd771a0412b168b22165433347fae68`,
  including unmodified official component
  `62dbf7edbe1ef4066f74e588dcec68d223ab7984f1861b59e44db0b10f52e3fd`;
- the official 834,304-byte Java proxy executable
  `53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076`;
- the pristine fixed JDT LS tree
  `b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583`
  with no runtime `configuration/` and exactly one Equinox launcher;
- the fixed Java task helper, debugger, Gradle catalog, Spring server and 168-
  library set, five Spring JDT bundles, and clean Boot fixture; and
- the deterministic S012 bridge JAR and S012 adapter identities from Gate A/B.

The final ignored manifest is
`tmp/s012-gate-b-evidence-final-v3-20260717/s012-prepared-manifest.txt`. It records
the fresh profile/worktree/XDG paths, full-path-derived JDT data path, exact
official proxy port-file path, six injected bundles, and absence of a second
JDT launcher, managed fallback, instrumented proxy, runtime processes, routes,
and credentials. Independent post-preparation checks rehashed all four central
components, ran the staged wrapper self-test, and reconfirmed that the JDT data
path, official port record, `.s012-state`, and `.s012-evidence` were absent.

### Retained preflight corrections

Three setup attempts stopped before creating any final destination:

1. the initial Node tree verifier used locale-aware sorting and disagreed with
   the established Java/code-point JDT tree digest; it was corrected to exact
   code-point ordering without changing the input;
2. the first declared system JDK path did not exist because this host's Temurin
   25.0.3 is SDKMAN-managed; preparation now records the resolved non-symlinked
   JDK home; and
3. process inspection matched the preparation command's own official-proxy
   input argument; it now excludes only its own PID and direct shell parent
   before applying the same runtime-process allowlist.

None reached a runtime hypothesis input or created a partial final profile.
They are preparation corrections, not S012 runtime failures.

The first otherwise successful prepared profile was also retained but rejected
by final code review before runtime: a registration failure whose compensating
remove also failed could lose the wrapper's session object. The wrapper now
retains that exact identity and retries removal during shutdown. A wholly fresh
profile was prepared from the corrected source. A final self-test was then
added for that exact failed-add/failed-remove retention path, so a second
unlaunched preparation was superseded by the wholly fresh `final-v3` profile.
Only `final-v3` is authorized for Gate C; neither rejected profile was launched.

### Known official-Java runtime state

Because S012 deliberately restores the unmodified official Java component, it
does not contain S010's disposable private-configuration JVM argument. R008
therefore predicts that the official launch may create derived
`configuration/` state below its writable JDT work tree. Gate C must record
that state explicitly, remove it only after all isolated processes stop, and
then reverify the original JDT files/tree. This official-provider behavior is
not a modification of the Java extension package or proxy and is separate from
the S012 bridge hypothesis; any different or unattributed path remains
Inconclusive.

### Gate B conclusion

Gate B is **prepared and statically supported**. This is not a runtime result,
does not accept D003, and does not establish product or platform support. Gate C
is the remaining direction gate and must start only after the user is warned
not to interact with Zed during the bounded isolated run.

## Gate C: one bounded runtime

After warning the user not to interact with Zed:

1. stop normal Zed and launch one isolated foreground session with the fixed
   official Java extension and S012 adapter;
2. prove the official Java component and proxy hashes are unchanged, exactly one
   JDT LS exists, and the six injected Spring/bridge bundles resolve;
3. require JDT `ServiceReady`, fixture import, Spring initialization with
   classpath disabled, and one attributable empty `server.port` baseline;
4. require the S012 proxy capability probe and one authenticated bridge add
   result through the official request channel;
5. require one authentic initial JDT classpath event to travel directly from the
   bridge to the Spring route, the real Spring handler to return its result, and
   the real project cache to become ready;
6. require a later Zed-originated completion from the same Spring child to
   contain exactly one structurally preserved `server.port` and show it in Zed;
7. require exact bridge removal, Spring disable, route/credential cleanup,
   absence of stale listeners and all isolated processes, pristine JDT/official
   Java assets, app detachment, and normal Zed restoration.

No retry is allowed after the real baseline, bridge registration, or first
classpath event. A setup-only failure before those inputs may be corrected only
with wholly fresh final roots and retained rejected evidence.

## Success, refuted, and inconclusive criteria

S012 is **Supported on macOS arm64/JDK 25** only when the official Java extension
and proxy remain byte-for-byte fixed, one bridge bundle is the only new JDT
bundle beyond the S011 five, the authentic classpath event bypasses
`workspace/executeClientCommand`, the same real Spring child transitions from
zero to exactly one visible `server.port`, removal and shutdown pass, and no
second JDT LS or stale state exists.

S012 is **Refuted on this tuple** if all fixed inputs and the official proxy
request channel are reached but the bridge cannot register, deliver the
authentic event, populate the Spring cache, remove its listener, or preserve the
real completion without modifying/replacing the official Java extension or
proxy.

S012 is **Inconclusive** for wrong/mutable artifacts, provider discovery or UI
attribution failure, unexpected extensions/processes, stale paths, missing
evidence, build-input mismatch, premature termination, or any condition that
prevents the exact unmodified-companion hypothesis from being reached.

## Plan review record

Reviewed before implementation on 2026-07-17. The review rejected both the
reduced managed-JDT fallback and a Java-extension fork, kept the official Java
extension as an explicit dependency, reused S011's same-child before/after
control, moved the missing callback into one owned injected bundle, prohibited
the S005/S006 proxy patch, required authentication and exact removal, and kept
all product scaffolding outside the spike. Gate A may begin only after this plan,
R009, D002 amendment, proposed D003, and all relevant indexes are committed.

## Remaining uncertainty after a supported result

Even a Supported result will cover only Java extension 6.8.21, JDT LS 1.60.0,
Zed 1.10.3, macOS arm64, and JDK 25. It will not make the private proxy endpoint
official, prove future Java versions compatible, validate missing-provider UX,
approve product languages or packaging, or establish multiplatform support.
