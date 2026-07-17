# S012: Unmodified Java companion bridge

- Status: Planned and reviewed; implementation not started
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
