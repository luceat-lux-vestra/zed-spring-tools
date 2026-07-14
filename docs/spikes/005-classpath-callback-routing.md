# S005: One Spring JDT classpath callback routing probe

- Status: Gate D attribution-correction plan reviewed; Gate C remains Inconclusive and no corrected runtime has begun
- Date: 2026-07-14
- Related research: R002, R003, R004, R005
- Depends on: S004 Supported on the local macOS arm64/JDK 25 tuple
- Implementation gate: Product scaffolding remains blocked; only a reviewed S005 attribution correction may continue

## Hypothesis

On the fixed Zed 1.10.3, Java extension 6.8.21, JDT LS 1.60.0, and Spring
Tools `5.2.0.RELEASE` tuple, invoking `sts.java.addClasspathListener` with the
deterministic callback command ID
`s005.classpath.callback.9f2c` will produce one real
`workspace/executeClientCommand` request for the one imported Maven fixture.

The official unmodified Java proxy and an unmodified source build will pass
that request to Zed, where the callback is not routed to the S005 sink. A
minimal disposable patch to the same pinned proxy source can instead intercept
only that method and callback ID, forward the unchanged six-argument payload to
a loopback mock Spring endpoint, return the endpoint's string result `"done"`
to JDT LS using the original JSON-RPC ID, and leave unrelated LSP traffic
unchanged.

This hypothesis tests one JDT-to-client callback boundary. It does not start
Spring Boot LS, implement the Spring-LS-to-JDT request direction, establish a
general coordination protocol, or claim that a proxy modification is an
approved product architecture.

## Decision this spike informs

S005 tests the remaining callback seam of Candidate B from R004 after S003 and
S004 supported bundle injection and synchronous Spring JDT commands.

- A Supported result would show that a protocol-aware native boundary can route
  one authentic classpath callback, while the unmodified Zed/Java path cannot.
  It would permit drafting the Go/Pivot/Limited/Stop direction decision, not
  product scaffolding. A product Candidate B would still require an accepted,
  versioned interface in the Zed Java extension or another explicit Pivot.
- A Refuted result would block this narrow callback-interception seam on the
  fixed tuple. It would permit only a decision review of whether Candidate C's
  snapshot approach deserves a separately planned experiment.
- An Inconclusive result would permit only an attribution, source-build, UI, or
  evidence correction. It would not authorize a larger coordinator.

## Why runtime verification is required

Source establishes that Spring's listener registers an Eclipse Java-model
listener and calls JDT LS's proposed `workspace/executeClientCommand` client
request. Source also establishes that the current Java proxy forwards
unrecognized requests to Zed and has no Spring callback handling. It cannot
establish:

- whether the fixed Spring bundle produces an initial event for the imported
  Maven fixture on this JDT LS version;
- the exact runtime payload emitted for that project;
- Zed's actual response and timing for the unsupported request;
- whether an instrumented proxy can preserve JSON-RPC correlation while
  forwarding the payload and result; or
- whether listener removal and process cleanup remain attributable.

## Scope boundaries

Included:

- the exact S004 Zed, Java extension, JDT LS, debug bundle, Spring JAR, JDK,
  and dependency-free Maven fixture tuple;
- one fixed non-batched callback command ID;
- one initial classpath event for the single imported fixture project;
- three isolated arms: official release proxy, source-built unmodified proxy,
  and source-built instrumented proxy;
- one add-listener and one remove-listener request per arm through the existing
  private HTTP oracle;
- one disposable Zed adapter and Node mock endpoint that also contribute the
  same five Spring bundle paths;
- one minimal patch applied only to an ignored checkout of the pinned Java
  proxy source;
- request, response, payload, timing, process, removal, and cleanup evidence;
  and
- macOS arm64/JDK 25 as the first execution tuple.

Excluded:

- launching Spring Boot LS or populating `JdtLsProjectCache` inside it;
- handling `sts/addClasspathListener` or `sts/removeClasspathListener` requests
  emitted by Spring Boot LS;
- Java-data search, Javadoc, completion, hierarchy, location, or GAV relays;
- a reusable bridge, coordinator, launcher, installer, server manager, or
  production proxy fork;
- changes to Zed, the installed Java extension, JDT LS, Spring JARs, or the
  official release proxy binary;
- dynamic callback registration, multiple listeners, batched events, project
  mutation, restart, multiple projects, or multiple worktrees;
- Gradle, Spring dependencies, remote development, WSL, or containers as host
  evidence;
- product packaging, CI, publishing, mirroring, or support claims; and
- any conclusion for Linux, Windows, x86_64, JDK 21, or another untested tuple.

## Confirmed facts and primary sources

All web sources in this section were accessed on 2026-07-14.

### Fixed Spring callback contract

The fixed Spring source is tag `5.2.0.RELEASE`, commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9`.

- [`ClasspathListenerHandler.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.extension/src/org/springframework/tooling/jdt/ls/extension/ClasspathListenerHandler.java)
  registers `sts.java.addClasspathListener` and
  `sts.java.removeClasspathListener`. Add takes the callback ID at argument 0,
  an optional batched boolean at argument 1, and returns `"ok"` after
  subscription.
- [`ReusableClasspathListenerHandler.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.commons/src/org/springframework/tooling/jdt/ls/commons/classpath/ReusableClasspathListenerHandler.java)
  enumerates accessible Java projects when a new listener subscribes and
  schedules their initial events. Removal deletes the subscription and returns
  `"ok"`.
- [`SendClasspathNotificationsJob.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.commons/src/org/springframework/tooling/jdt/ls/commons/classpath/SendClasspathNotificationsJob.java)
  sends a non-batched callback with six arguments: project URI, project name,
  deleted flag, classpath, project-build descriptor, and Java core options. It
  logs success only after the client request returns.
- [`Logger.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.commons/src/org/springframework/tooling/jdt/ls/commons/Logger.java)
  enables its Eclipse-plugin debug path only when the JVM system property named
  from the plugin bundle symbolic name plus `.DEBUG` is true. The fixed
  `jdt-ls-extension.jar` manifest names that bundle
  `org.springframework.tooling.jdt.ls.extension`; its local bytecode matches the
  source and writes enabled debug messages through the Eclipse plugin log.
- [`ClasspathListenerManager.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/commons/commons-language-server/src/main/java/org/springframework/ide/vscode/commons/languageserver/java/ls/ClasspathListenerManager.java)
  shows the Spring LS side accepts both batched and non-batched payloads,
  requires at least six elements, and returns `"done"` after dispatching an
  event to its listener.
- [`Classpath.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/commons/commons-lsp-extensions/src/main/java/org/springframework/ide/vscode/commons/protocol/java/Classpath.java)
  and [`ProjectBuild.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/commons/commons-lsp-extensions/src/main/java/org/springframework/ide/vscode/commons/protocol/java/ProjectBuild.java)
  define the classpath entry and Maven/Gradle build structures in the payload.
- [`STS4LanguageClient.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/commons/commons-lsp-extensions/src/main/java/org/springframework/ide/vscode/commons/protocol/STS4LanguageClient.java)
  defines the separate `sts/addClasspathListener` custom request sent by Spring
  LS to its editor client.
- [`classpath.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/commons-vscode/src/classpath.ts)
  is the VS Code client relay from that custom request to
  `sts.java.addClasspathListener` in the Java extension. It forwards only the
  callback ID, so the JDT handler uses its default non-batched mode; S005's
  explicit `false` fixes that same behavior deterministically.

### Fixed JDT LS callback transport

The pinned JDT LS source is commit
`57ed41bdddc93df13ace6a266d8e3c1d35c95618`.

- [`ExecuteCommandProposedClient.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/lsp/ExecuteCommandProposedClient.java)
  declares `workspace/executeClientCommand` as a JSON-RPC request carrying
  `ExecuteCommandParams`.
- [`JavaClientConnection.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/JavaClientConnection.java)
  waits for the request result. The Spring handler calls its no-timeout overload,
  so an unanswered callback can block the notification job.

### Fixed Java proxy boundary

The official Java extension source is commit
`9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, released as extension 6.8.21.

- [`proxy/src/main.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs)
  forwards JDT LS messages with IDs unless they match an HTTP-pending response
  or selected Java rewrite request. It contains no
  `workspace/executeClientCommand` or `sts.*` branch.
- [`proxy/src/http.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/http.rs)
  accepts arbitrary request method/params pairs and correlates the JDT LS
  response. S003 and S004 authorized this only as an ignored-evidence oracle.
- [`proxy/Cargo.toml`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/Cargo.toml)
  declares Apache-2.0 and source package version 6.8.12 at the 6.8.21 extension
  commit. Therefore S005 must identify the extension release, source commit,
  source package version, toolchain, and resulting binaries separately.
- The [Apache-2.0 license](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/LICENSE)
  applies to the upstream proxy source. Gate A must preserve attribution for any
  committed patch material.

### S004 runtime baseline

S004 confirmed on the local tuple that:

- the initialize array contains debug 0.53.2 and the five Spring JARs exactly
  once in release order;
- all five Spring bundles install and activate on JDT LS 1.60.0/JDK 25;
- the dependency-free Maven fixture imports as project
  `s004-command-fixture`;
- Spring delegate commands remain callable through the official proxy; and
- restart repeats that configuration without stale S003 state.

The fixed official proxy binary remains 834,304 bytes with SHA-256
`53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076`.
S005 must reverify, not replace, this binary in the official-proxy control arm.

## Fixed callback and structural expectations

The listener requests are fixed as follows:

```json
{
  "command": "sts.java.addClasspathListener",
  "arguments": ["s005.classpath.callback.9f2c", false]
}
```

```json
{
  "command": "sts.java.removeClasspathListener",
  "arguments": ["s005.classpath.callback.9f2c"]
}
```

The callback must be a JSON-RPC request whose method is
`workspace/executeClientCommand`, whose command is the fixed callback ID, and
whose non-batched `arguments` array has exactly six entries. The committed
summary may record only these structural checks:

| Index | Expected structure |
| ---: | --- |
| 0 | File URI of the active isolated fixture project |
| 1 | Exact project name `s004-command-fixture` |
| 2 | Boolean `false` for not deleted |
| 3 | Classpath object containing a `source` entry ending in `src/main/java`, with `isOwn: true`, `isJavaContent: true`, and `isTest: false` |
| 4 | Project build object with type `maven` and the active fixture `pom.xml` URI |
| 5 | Java core options object whose compiler compliance, source, and target-platform keys are all `21` and whose release key is `enabled` |

Absolute paths, the full classpath, JRE details, Java option values, JSON-RPC
IDs, route ports, and route tokens remain ignored evidence.

The exact Java option keys are
`org.eclipse.jdt.core.compiler.compliance`,
`org.eclipse.jdt.core.compiler.source`,
`org.eclipse.jdt.core.compiler.codegen.targetPlatform`, and
`org.eclipse.jdt.core.compiler.release`.

The fixed time bounds are:

- 10 seconds for mock route readiness before an add-listener request;
- 10 seconds to observe the initial callback in each arm;
- 5 seconds for the instrumented proxy's callback-to-sink request; and
- 10 seconds of observation after each remove-listener response.

### Fixed test-only route protocol

The ignored worktree-local route record has schema 1 and exactly these fields:

```json
{
  "schema": 1,
  "callbackCommandId": "s005.classpath.callback.9f2c",
  "port": "<ephemeral loopback port>",
  "token": "<fresh per-run random token>"
}
```

The instrumented proxy sends the sink one HTTP body whose `params` value is the
unchanged JDT LS `ExecuteCommandParams` object:

```json
{
  "token": "<same token>",
  "method": "workspace/executeClientCommand",
  "params": {
    "command": "s005.classpath.callback.9f2c",
    "arguments": [
      "<project URI>",
      "s004-command-fixture",
      false,
      "<original classpath object>",
      "<original project-build object>",
      "<original Java-options object>"
    ]
  }
}
```

Angle-bracket values illustrate redacted evidence. The three object positions
remain JSON objects in the real body, not strings, and all six original argument
values are forwarded without transformation.

The only successful sink response is `{"result":"done"}`. The proxy constructs
the JDT-facing JSON-RPC response with the original request ID and that result.
A route absence, schema or command mismatch, authentication failure, malformed
body, non-success response, or five-second timeout produces the fixed JSON-RPC
error code `-32005` with a non-sensitive S005 route-unavailable message. This
protocol is disposable experiment instrumentation, not a candidate public API.

## Inferences

1. The official-proxy arm distinguishes the currently shipped process boundary
   from the routed prototype; it is not enough to infer failure from source.
2. An unmodified source-build arm is necessary because an instrumented build
   cannot be compared byte-for-byte with the official release binary. Matching
   baseline behavior on the same local Rust toolchain isolates the patch as the
   intentional behavioral difference.
3. One imported project and non-batched mode constrain the expected initial
   event to one callback with six direct arguments.
4. Returning the mock endpoint's `"done"` through the original request ID proves
   bidirectional correlation. Merely logging or swallowing the request would
   prove interception, not routing.
5. A worktree-local route file lets the mock endpoint and instrumented proxy
   discover one another without modifying the installed Java extension. This is
   test infrastructure, not a proposed public coordination contract.

## Unverified hypotheses

1. The fixed imported Maven fixture causes exactly one initial callback.
2. Current Zed rejects or otherwise fails to handle the callback promptly enough
   for the control arms to complete and the listener to be removed.
3. A locally built unmodified proxy from the pinned commit reproduces the
   official binary's relevant launch, passthrough, and cleanup behavior.
4. The instrumented proxy can distinguish a server request from responses and
   notifications without disturbing existing pending-response and rewrite paths.
5. A loopback mock endpoint can receive the exact payload once, return `"done"`,
   and have that value reach the waiting JDT LS request.
6. The actual classpath payload has the six structures expected by the fixed
   Spring LS consumer.
7. Listener removal completes after both failed-control and successful-routed
   callbacks without leaving an active subscriber or stuck job.

## Items requiring runtime verification

- exact Zed response/error and callback duration in the unmodified arms;
- initial-event count and payload structure;
- source-built baseline parity;
- route-file readiness and stale-file rejection;
- original JSON-RPC ID preservation and result propagation;
- JDT log distinction between callback `FAILED` and `SUCCESS [done]`;
- absence of a second callback after removal during the fixed observation
  interval, without treating absence alone as proof of unsubscription; and
- process, port-file, route-file, and child cleanup in all three arms.

## Environment

Planned first execution environment:

| Component | Fixed value | S005 use |
| --- | --- | --- |
| OS | macOS 26.5.1, arm64 | First host only |
| Zed | 1.10.3, build `20260713.002323` | Client under test |
| Isolated profile | Retained ignored research profile | Java 6.8.21; S004 link removed before S005 |
| Java extension | 6.8.21, commit `9148b897...` | Installed extension remains unmodified |
| Official proxy | v6.8.21 fixed S004 binary | Arm A control |
| Source proxy | `proxy` package 6.8.12 at commit `9148b897...` | Arms B and C, built with same toolchain |
| JDT LS | 1.60.0, commit `57ed41b...` | Fresh extraction and cache per arm |
| Java debug | 0.53.2 | Retained in every bundle array |
| Spring JDT set | Five fixed `5.2.0.RELEASE` JARs | Same order and identity as S004 |
| Fixture | Unchanged S004 dependency-free Maven Java 21 project | One imported project per arm |
| Java runtime | SDKMAN Temurin JDK 25.0.3 | JDT runtime and preparation |
| Rust | rustup stable 1.97.0 | Adapter and proxy source builds |
| Node | Zed-resolved executable | Disposable mock endpoint only |

The planned worktree basenames map to distinct default JDT data-cache keys:

| Arm | Worktree basename | SHA-1 cache key |
| --- | --- | --- |
| A | `s005-official-worktree-9f2c` | `4a3536ce5e6800791e2927e1746deae242e20e5f` |
| B | `s005-source-worktree-9f2c` | `445d60479bff85ce1c42998152265e9d97254c8b` |
| C | `s005-routed-worktree-9f2c` | `6df57e0fe15486a4087ff8c5008582dfaa9c9686` |

This run supplies only macOS arm64/JDK 25 evidence. Representative validation
still requires macOS arm64, Linux x86_64, and Windows x86_64 with JDK 21 before
a Go or Limited direction decision, and the full six-tuple/JDK matrix before a
public support claim. Remote development and WSL remain excluded.

## Proposed disposable artifacts

Gate A added only the reviewed disposable tree below after plan review and
explicit continuation.

```text
spikes/s005-classpath-callback/
├── extension/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── extension.toml
│   ├── probe/callback_sink.js
│   └── src/lib.rs
├── proxy/
│   ├── UPSTREAM.md
│   ├── instrumented_proxy.patch
│   └── tests/                  # only patch/harness contract tests if needed
└── tools/
    └── PrepareS005.java
```

Generated inputs and evidence remain ignored:

```text
tmp/s005-java-source-baseline/
tmp/s005-java-source-instrumented/
tmp/s005-artifacts/
tmp/s005-evidence/
tmp/s005-official-worktree-9f2c/
tmp/s005-source-worktree-9f2c/
tmp/s005-routed-worktree-9f2c/
spikes/s005-classpath-callback/extension/target/
spikes/s005-classpath-callback/extension/extension.wasm
```

The committed patch may contain only the narrow upstream-source edits needed to
classify, forward, and answer the fixed callback plus test seams. It must not
vendor an upstream proxy tree, introduce a generic coordinator API, or be
installed into the user's normal Java extension.

## Direction-gate compatibility

Repository instructions prohibit a production bridge, coordinator, launcher,
installer, or server-manager module before a direction decision. S005 does not
authorize one. Its prospective native change is a disposable patch applied to
an ignored, commit-verified upstream checkout and exercised only as a controlled
runtime instrument.

Gate A must stop before implementation if review finds that the patch or mock
endpoint has become a reusable product abstraction, requires installation into
the official Java extension, or expands beyond the fixed method and callback
ID. Such a change would require a recorded direction decision first.

## Plan review gate before implementation

Implementation may begin only after review confirms all of the following:

1. the hypothesis tests one method, callback ID, fixture, and unbatched event;
2. all three arms use the same fixed JDT, Spring, fixture, JDK, adapter, and
   initialization inputs, with only the declared proxy variable changed;
3. Arm B reproduces the official control before Arm C can attribute a difference
   to the patch;
4. the mock endpoint returns the consumer-compatible string `"done"` and cannot
   turn a logged intercept into a false routing success;
5. the route file uses only loopback, a fresh per-run token, atomic creation, and
   worktree-local ignored storage, and rejects stale or mismatched registration;
6. unrelated LSP messages remain byte-preserving passthrough outside existing
   upstream transformations;
7. the patch preserves Apache-2.0 attribution and does not vendor upstream
   source or imply that the repository has selected a product license;
8. no normal Zed setting, installed Java extension file, or official proxy
   binary is modified;
9. no raw path, classpath, JRE, option map, port, token, request ID, or protocol
   trace can be committed;
10. implementation adds only the planned disposable S005 tree and required
    documentation/index updates; and
11. no real upstream checkout acquisition or mutation, fixed proxy build, fixed
    artifact preparation, Zed UI, or runtime execution begins until the complete
    Gate A diff is reviewed.

## Procedure

### Gate 0: completed source review

1. Pin the Spring callback producer, payload consumer, JDT client request, Java
   proxy passthrough, and upstream license sources listed above.
2. Fix non-batched mode, the callback ID, fixture project, six structural
   assertions, add/remove requests, and mock result.
3. Separate the official binary, source-built baseline, and patched source build
   so compiler/source-build differences cannot be attributed to the patch.
4. Record unsupported boundaries rather than treating a mock endpoint as Spring
   LS or a private route as a product API.

### Gate A: implementation, synthetic validation, and diff review

1. Add only the planned S005 disposable tree.
2. Make `PrepareS005.java` verify caller-supplied fixed S004 artifact identities,
   three absent destinations, a caller-supplied Java source checkout commit and
   cleanliness, and expected upstream proxy-file identities. Its self-tests must
   use generated archives and source-tree fixtures only; Gate A must not acquire,
   mutate, or build the real upstream checkout.
3. Implement transactional preparation of three fresh JDT extractions,
   worktrees, and distinct basename-derived data caches. Copy the unchanged
   S004 fixture and five verified Spring JARs to every synthetic arm.
4. Implement one adapter that contributes the exact five Spring paths to
   `jdtls` and starts the Node mock sink through Zed's Node API with argument
   arrays and worktree environment APIs.
5. Make the sink bind loopback on an ephemeral port, generate a per-run random
   token, atomically publish a worktree-local route record, implement minimal LSP
   lifecycle, fail rather than overwrite an existing route record, accept only
   the fixed callback, validate the six structural fields, return `"done"`, and
   append raw evidence only under ignored storage.
6. Implement the patch and validate its request classification, route protocol,
   and response construction against synthetic proxy fixtures. Do not apply it
   to the real upstream checkout in Gate A.
7. Make the patch intercept only JDT LS requests whose method and callback ID
   both match. Forward the unchanged `ExecuteCommandParams` to the registered
   sink, preserve the original JSON-RPC ID in the response to JDT LS, and return
   a five-second bounded error for missing, stale, unauthorized, malformed, or
   timed-out routes. Perform the route on a bounded worker rather than blocking
   the JDT stdout-reader loop, and do not forward the selected callback to Zed
   as well.
8. Add unit and integration tests for request/response classification, numeric
   and string IDs, notifications versus requests, unrelated passthrough,
   malformed payloads, token mismatch, stale route records, timeout, sink error,
   and exactly-once response behavior on macOS/Linux/Windows path forms.
9. Run format, locked synthetic tests, native/WASI checks where applicable, Java
   21 warning-as-error compilation, Node syntax/self-tests, synthetic patch
   applicability, license-attribution, ignored-path, and diff-scope checks.
10. Review the complete Gate A diff and commit it separately. Do not acquire,
    mutate, or build the real proxy source, prepare fixed runtime arms, or open
    Zed until the review passes and the user explicitly continues to Gate B.

### Gate B: fixed-source build and non-UI preparation

1. Obtain or reuse an ignored Java extension checkout only at exact commit
   `9148b897...`. Verify `git rev-parse HEAD`, clean state, expected proxy-file
   hashes, `proxy/Cargo.lock`, package metadata, and Apache-2.0 license before
   mutation.
2. Preserve an ignored pristine source copy for Arm B. Apply the committed patch
   to a separate ignored copy for Arm C. Require the patch to apply with no fuzz
   or unrelated diff.
3. Build both source proxies with rustup 1.97.0 and `cargo build --locked`, using
   the same target, profile, environment, and Cargo lock. Run their locked native
   tests and record source tree, toolchain, binary size, and SHA-256 separately.
4. Reverify every fixed S004 artifact and prepare all three fresh arms
   transactionally. Verify their exact distinct cache keys, empty mutable
   configuration state, identical fixtures/bundles, and the
   official/source/instrumented proxy assignment.
5. Run non-UI adapter, sink, preparation, patch, proxy, license, privacy, and
   process-start smoke checks. Do not start Zed or JDT LS.
6. Review the complete fixed-input and build evidence. Stop if Arm B or C uses an
   unlocked dependency, dirty source, unexpected upstream diff, or unverifiable
   binary. At that point, Gate C required another explicit user continuation.

### Gate C: isolated runtime execution

1. Reverify the exact installed Java extension 6.8.21. Stop normal Zed, remove
   the S004 development link from the retained isolated profile, and install
   only the reviewed S005 development extension.
2. For each arm, launch only its isolated worktree, open the unchanged Java
   fixture, wait for JDT import and `ServiceReady`, and verify the six-entry
   debug-plus-Spring bundle array with no S003/S004 adapter path.
3. Arm A — official release proxy: wait at most 10 seconds for a fresh sink route
   record, send exactly one fixed add-listener request,
   capture the real callback request and Zed response/timeout, require no sink
   delivery, then send exactly one fixed remove-listener request and stop the
   arm.
4. Arm B — source-built unmodified proxy: repeat Arm A. Require equivalent
   relevant behavior before continuing; otherwise classify the source-build
   comparison as Inconclusive and do not run Arm C.
5. Arm C — instrumented proxy: require a fresh authenticated route record, send
   exactly one fixed add-listener request, and require one sink delivery with all
   six structural assertions. Require the sink result `"done"` to reach JDT LS
   and the Spring job to log callback success. Send exactly one fixed
   remove-listener request.
6. In every arm, require add and remove to return `"ok"`, record bounded callback
   duration and point-in-time RSS, and inspect logs for bundle, project, listener,
   routing, response-correlation, timeout, and classloading errors.
7. Observe exactly 10 seconds after each remove response without modifying the
   project. Record whether another callback occurs; do not manufacture a
   filesystem event merely to force success, and do not treat silence alone as
   proof that the subscription was removed.
8. Stop each isolated instance before the next arm. Verify its adapter, sink,
   proxy, JDT LS, port file, and route record are gone or explicitly cleaned.
9. Reopen normal Zed, retain only the reusable isolated profile if desired,
    summarize all successful, failed, interrupted, and corrected observations,
    and classify the result without promoting spike code.

UI automation is permitted only for Gate C. Immediately before it starts, tell
the user not to use the keyboard or mouse until control is restored; immediately
after completion or interruption, restore the prior input state and tell the
user that normal interaction is safe again.

No retry may change the callback ID, event mode, mock result, payload assertions,
fixture, Spring/JDT/Java/Zed versions, source commit, toolchain, arm order, or
route mechanism. One documented correction is allowed only for an operator
setup mistake that does not change a hypothesis condition.

## Gate A implementation record

Gate A completed on 2026-07-14 without acquiring, mutating, or building the
real Java extension source checkout and without opening Zed. The implementation
is confined to `spikes/s005-classpath-callback/` and remains disposable.

### Confirmed Gate A facts

- `PrepareS005.java` fixes the S004 JDT LS, Spring VSIX, official proxy, debug
  bundle, Java extension commit, six upstream file identities, three worktree
  basenames, and three cache keys. Its production path rejects linked inputs,
  dirty or non-top-level source checkouts, mismatched identities, existing or
  overlapping destinations, and identical source/routed proxy binaries.
- Its generated-fixture self-test prepares three independent JDT extractions,
  data-cache directories, proxy/debug copies, Spring bundle sets, Maven fixture
  copies, and sink copies under one rollback-capable transaction.
- The adapter resolves Node through Zed, uses argument arrays and the worktree
  environment, contributes the exact five Spring bundles only to `jdtls`, and
  uses host-specific path construction covered for macOS, Linux, and Windows
  forms.
- The Node sink binds only IPv4 loopback, creates a fresh 256-bit token,
  atomically publishes a schema-1 route without overwriting an existing record,
  requests mode 0600 where the host supports POSIX permissions, verifies the
  exact method/command and six payload positions, accepts one callback, returns
  `{"result":"done"}`, and removes only its own route record.
- `instrumented_proxy.patch` changes only pinned `proxy/src/main.rs` and adds
  `proxy/src/s005_callback.rs`. The main-loop change diverts only the fixed
  request to one bounded in-flight worker; unrelated messages retain the
  upstream branches. The module preserves integer or string request IDs,
  forwards unchanged params, enforces loopback/schema/token/freshness/size/time
  bounds, and returns fixed error `-32005` without path or token details.
- `proxy/UPSTREAM.md` records the fixed source commit, extension/source package
  versions, Apache-2.0 provenance, patch targets, research-only scope, and Gate B
  application boundary.

### Gate A validation performed

- Node syntax and sink self-tests passed, including split/adjacent LSP frames,
  payload validation, atomic no-overwrite publication, owned-route cleanup,
  token mismatch, malformed HTTP input, successful result, and duplicate
  callback rejection.
- The extension passed locked native unit tests, formatting, Clippy with
  warnings denied, and an optimized `wasm32-wasip1` build. The generated WASM
  remains ignored and was not installed.
- The patch contract test reconstructed a generated upstream preimage, applied
  the patch with Git whitespace checking, extracted only the added Rust module,
  and passed locked formatting, Clippy-with-warnings-denied, and five Rust tests.
  Those tests covered integer/string IDs, notifications and unrelated methods,
  unchanged params, success correlation, malformed route data, sink errors,
  altered results, timeout, stale/future route timestamps, and non-sensitive
  errors.
- `PrepareS005.java` compiled with `--release 21 -Xlint:all -Werror` on JDK
  25.0.3 and passed its generated tar/VSIX/git/source-tree self-test.
- Repository diff, ignored-output, scope, fixed-ID, and privacy checks passed.

### Failed and corrected Gate A observations

1. The first Node check used a repository-relative path after already changing
   into the extension directory, so Node looked for a duplicated path. The
   corrected command used the local `probe/` path; no implementation condition
   changed.
2. The first synthetic patch applications rejected incorrect manually written
   unified-diff line counts and hunk positions. The patch contract exposed each
   mismatch; the headers were corrected against the pinned source locations and
   the final patch applies with Git whitespace checking.
3. The first Java self-test compared `/var` and `/private/var` spellings as raw
   absolute paths on macOS. The corrected check still rejects a linked checkout
   itself but compares Git top-level identity through canonical paths.
4. The first WASI build found only `wasm32-wasip2` installed. The official
   rustup `wasm32-wasip1` standard-library target was added, after which the
   unchanged locked Zed extension build passed.
5. Review found that the initial sink self-test exercised authentication and
   validation helpers but not the HTTP handler's duplicate branch. An in-memory
   HTTP fixture was added before the final validation.
6. Final review found that the preparation tool's nominal Git timeout began
   only after synchronous output draining. Output is now size-bounded and
   drained on a Java 21 virtual thread so the process timeout remains effective;
   the warning-as-error compile and self-test passed again.

### Still unverified after Gate A

- the patch against the complete clean upstream checkout rather than the
  generated preimage;
- locked Arm B and Arm C native builds from the fixed source tree;
- official/source-built proxy behavioral parity;
- all fixed real artifact preparation and proxy binary identities;
- Zed, JDT LS, Spring bundle, callback, listener-removal, and cleanup runtime
  behavior; and
- every platform/JDK tuple outside the already-known local prerequisites.

Gate B began only after a new explicit user continuation. It obtained the exact
clean upstream checkout, applied the reviewed patch to a separate ignored copy,
performed locked native builds, prepared the fixed arms, and stopped for this
evidence review before any Zed UI execution.

## Gate B implementation record

Gate B completed on 2026-07-14 without opening Zed, starting JDT LS, installing
the S005 extension, or changing the retained isolated Zed profile. All source
trees, native binaries, prepared runtimes, worktrees, and raw smoke evidence
remain under ignored `tmp/` paths.

### Confirmed Gate B facts

- The baseline checkout was fetched directly from
  `https://github.com/zed-extensions/java.git` at detached commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`. Its commit date is
  2026-07-09, its working tree remained clean after the build, and all six
  source/lock/license hashes fixed in Gate A matched.
- The fixed source declares proxy package 6.8.12 and Apache-2.0. It contains no
  `NOTICE` file at that commit. The separate instrumented checkout retained the
  same commit, Cargo lock, and license and contained only modified
  `proxy/src/main.rs` plus untracked `proxy/src/s005_callback.rs`.
- Both source proxies used rustc 1.97.0 commit `2d8144b...`, cargo 1.97.0 commit
  `c980f48...`, host/target `aarch64-apple-darwin`, the fixed Cargo lock,
  release profile, and `CARGO_INCREMENTAL=0`.
- The unmodified source build is 851,280 bytes with SHA-256
  `2c53fa08b3e33b3d35e56d8aa9c3e7b1607148e01720b2861af787906a001d33`.
  Its locked upstream test target contains zero tests and passed.
- The instrumented build is 895,392 bytes with SHA-256
  `8464afa22887301171446dcc1e2338c554fda27e1d5b2f8d86ae954883409595`.
  Its five fixed callback tests passed against the complete upstream crate.
- The official, source-built, and routed proxies are all arm64 Mach-O files
  without quarantine. `codesign --verify --strict` accepts their embedded
  linker-generated ad-hoc signatures; none has a Team ID, so this is not
  distribution-signing evidence.
- The official binary links `libSystem.B.dylib` current version 1351 while both
  local source builds link current version 1356. This expected build-environment
  difference reinforces that Gate C must test behavioral parity rather than
  binary equality.
- `PrepareS005` reverified the fixed JDT LS, Spring VSIX, official proxy, debug
  bundle, source commit, and both built proxies and transactionally created all
  three arms. Their proxy SHA-256 values exactly match the official, source,
  and routed values above.
- The three extracted JDT trees have aggregate content SHA-256
  `5c38d7a59e8a9efba4ab7ae9dc4ae94e8c15734fd830d1ac4ef729287efb184c`
  while their launcher files have three distinct inodes. The three initially
  prepared worktrees had identical aggregate content SHA-256
  `f7f1bd3f570fd4fe22d8977f8dbe7923889d2946387d1659b28d9e787e1676a3`.
- Each arm has only its fixed SHA-1 data-cache directory, five verified Spring
  bundles, the same Maven fixture and sink, no JDT `configuration` directory,
  and no `.project`, `.classpath`, `.settings`, route record, or build output at
  preparation audit time.

### Gate B non-UI validation performed

- The official, source-built, and routed proxies each started a `/usr/bin/true`
  child, created their private loopback HTTP listener, observed child exit 0,
  returned exit 0, and removed their port file. No JDT process was involved.
- The prepared routed sink started under local Node 26.5.0, the same binary and
  version previously observed through Zed's Node API, published a structurally
  valid fresh route, answered LSP initialize and shutdown, received exit,
  recorded a graceful stop with zero callbacks, and removed only its own route.
  Its ignored JSONL contains no absolute home path, route port, or token.
- The Gate A adapter tests, sink self-tests, patch contract, Java warning-as-error
  compilation, and preparation self-test remained valid. The corrected patch
  also passed apply-check against the complete clean baseline, complete-source
  rustfmt, locked tests, and release build.
- Final process inspection found no `java-lsp-proxy` or `jdtls` process and no
  S005 route or port file. Normal Zed remained running and untouched.

### Failed and corrected Gate B observations

1. A shell audit used zsh's special `path` array as a loop variable, which
   temporarily replaced `PATH` inside that one shell and prevented only the
   trailing disk-capacity command from running. The exact artifact audit had
   already completed; capacity and process checks were immediately rerun using
   safe variable names and absolute utility paths.
2. The first instrumented-scope assertion used `git diff --name-only`, which
   omits untracked files, and the command group did not use fail-fast mode. No
   source changed. All subsequent Gate B compound checks used
   `set -euo pipefail`, and exact scope was reverified with
   `git status --porcelain`; a second retry also avoided zsh's read-only
   `status` variable.
3. The first full-source instrumented `cargo fmt --check` found that the
   inserted `s005_callback_root` assignment needed rustfmt line wrapping. It
   stopped before test or build. The committed patch was corrected only for
   that formatting, then rechecked against both the generated Gate A preimage
   and complete clean upstream source before the successful locked build.

### Still unverified after Gate B

- whether the official and source-built unmodified proxies behave equivalently
  for the real callback despite their different build environments;
- whether Zed forwards, rejects, or times out the fixed callback in Arms A and B;
- whether the fixed Spring listener emits the expected initial event and exact
  six-position runtime payload;
- whether Arm C returns the sink's `"done"` result under the original ID and
  Spring records callback success;
- listener removal, post-remove silence, real JDT/proxy/sink cleanup, and normal
  Zed restoration; and
- every representative or full platform/JDK tuple.

Gate C began after explicit user continuation. It ran all three arms in order,
restored normal Zed and user input, and produced only local macOS arm64/JDK 25
evidence.

## Gate C runtime record

Gate C executed on 2026-07-14 with Zed 1.10.3, Java extension 6.8.21,
JDT LS 1.60.0, Spring Tools `5.2.0.RELEASE`, Temurin 25.0.3, and the three
Gate B proxy binaries. Raw protocol envelopes, paths, ports, tokens, logs,
screenshots, and process listings remain under ignored `tmp/` storage.

### Confirmed Gate C facts

- The retained isolated profile ended with only bundled HTML, the official Java
  extension 6.8.21, and the reviewed S005 development extension. The S004
  development link was removed. The user's normal extension profile was not
  modified.
- Each accepted arm used its planned worktree root and final six-entry
  initialization array: one arm-local debug 0.53.2 JAR followed by the same five
  Spring JARs in release order. JDT LS installed and started those entries,
  advertised the Spring commands, imported the one Maven fixture, reached
  `ServiceReady`, and reported zero diagnostics for the real Java fixture.
- Arm A's official proxy and Arm B's source-built unmodified proxy each exposed
  one authentic `workspace/executeClientCommand` request with the fixed callback
  ID. Zed returned JSON-RPC `-32601` with `Unrecognized method` in both arms,
  Spring recorded the callback as `FAILED`, and neither sink received a
  callback. The add responses were `"ok"` in 0.025 and 0.027 seconds,
  respectively.
- The Arm A and Arm B failure method, error code, Spring stack, sink count, and
  listener behavior were equivalent for this comparison. Their different
  official/local build environments did not produce a relevant runtime
  difference.
- Arm C's instrumented proxy caused exactly one authenticated sink acceptance.
  The unchanged request had the fixed method and command plus exactly six
  arguments. Runtime assertions passed for project URI, project name, deletion
  state, an owned main-Java source entry, Maven `pom.xml` build descriptor, and
  all four fixed Java 21 compiler options. No rejection, duplicate, or internal
  sink error was recorded. The add response was `"ok"` in 0.024 seconds.
- Every arm returned `"ok"` for the fixed remove command and logged removal for
  the fixed callback ID. After each response, the unchanged project was observed
  for exactly 10 seconds. Sink callback counts remained 0, 0, and 1 for Arms A,
  B, and C, so no post-remove duplicate was observed.
- Point-in-time RSS, recorded after the callback rather than as a benchmark, was:

  | Arm | Proxy | Sink | JDT LS |
  | --- | ---: | ---: | ---: |
  | A, official | 2,688 KiB | 53,600 KiB | 1,577,840 KiB |
  | B, source | 2,576 KiB | 53,376 KiB | 1,308,960 KiB |
  | C, routed | 2,992 KiB | 54,864 KiB | 1,299,984 KiB |

- Final inspection found no S005 adapter, sink, proxy, or JDT LS process and no
  arm route or proxy-port file. Normal Zed was reopened on the repository. The
  isolated profile and its S005 development extension were retained, following
  the user's earlier direction to reuse the isolated environment.

### Runtime inference

The Arm C sink handler records acceptance only after authentication and all six
payload checks, then returns `{"result":"done"}`. The reviewed proxy maps only
that exact successful response to the original JSON-RPC request ID. After the
event, JDT LS had no classpath notification worker blocked in
`executeClientCommand`, and Spring recorded no failure. Together these facts
strongly support the inference that `"done"` returned to JDT LS.

That inference is not promoted to a confirmed runtime fact. The expected Spring
`executing callback ... SUCCESS [done]` message uses its debug logger, and the
fixed run did not persist debug-level Spring output. The proxy also had no
runtime egress trace. Consequently, the original-ID response and Spring success
message were not observed directly.

### Failed, interrupted, and corrected Gate C observations

1. The first isolated launch passed the Java file itself as Zed's project path
   before S004 had been removed. Zed therefore treated the file as the worktree,
   S004 contributed nonexistent paths, and JDT LS logged bundle-load failures.
   No S005 add or remove request was sent. The operator stopped all processes,
   removed S004, installed S005, and relaunched the planned directory. However,
   that rejected launch had already created Arm A's local JDT
   `configuration/` area at 23:20; the accepted Arm A launch at 23:25 reused it.
   Gate B had required a fresh extraction with no such area, so Arm A no longer
   satisfied the fixed fresh-runtime condition.
2. During that same setup correction, the first quick-open attempt created only
   an unsaved empty root buffer. Closing it also closed the Zed window. The
   existing isolated process and worktree were reopened through the CLI, and the
   real `src/main/java` file then opened with its exact content and zero final
   diagnostics. No disk file was created or modified, but the intermediate
   buffer caused an attributable project diagnostic in Arm A's log.
3. Zed app termination did not give the disposable sink enough time to record a
   graceful `stop`. Arms A and B recorded `unexpected_eof`; Arm C observed a
   shutdown LSP message but no final stop entry. Each proxy also left its numeric
   port record, and Arm C left its authenticated route. After confirming that no
   related process remained, the numeric port records and the structurally
   verified Arm C-owned route were explicitly removed. This cleanup limitation
   is retained rather than hidden.

The first two items are one operator setup correction, not a change to the
callback ID, mode, artifacts, arm order, payload assertions, or route mechanism.
They nevertheless prevent the run from meeting the attribution bar because the
accepted Arm A was not restored to its prepared fresh state before its one fixed
request.

### Gate C validation performed

- Final Zed traces were checked for worktree roots, the exact six-entry arrays,
  command advertisement, `ServiceReady`, real fixture open, zero final
  diagnostics, control callbacks, and control responses.
- Per-arm JDT logs were checked for bundle installation/start, Spring command
  registration, add/remove handler records, control failures, project import,
  and attributable errors. Copies remain in ignored evidence.
- The sink JSONL was checked for exact callback count, authentication outcome,
  method, command, six-position payload structure, and rejected/error events.
- A post-callback JDT thread dump confirmed no worker remained blocked in the
  classpath callback path; this is supporting evidence, not a substitute for the
  missing success log.
- All final process, route, and private port-file checks passed, normal Zed was
  reopened, the repository worktree was inspected, and no raw evidence was
  staged.

### Gate C classification and remaining uncertainty

S005 is **Inconclusive on the tested macOS arm64/JDK 25 tuple**. The run is not
Refuted: both controls behaved equivalently, Arm C received one authentic and
structurally valid callback, and removal succeeded without duplication. It is
not Supported because two required attribution facts are missing:

1. Arm A reused a JDT runtime configuration created by the rejected setup
   launch rather than the fresh Gate B state.
2. Arm C did not directly preserve a Spring `SUCCESS [done]` record or another
   runtime trace proving that the sink result reached JDT LS under the original
   request ID.

Linux, Windows, JDK 21, other architectures, remote development, Spring Boot LS,
and the full product callback flow remain unverified. This result does not open
the direction-decision or product-scaffolding gate.

## Gate D attribution-correction plan

Gate D is a correction of the two missing attribution facts, not a new
hypothesis or an expanded spike. This plan was completed and reviewed on
2026-07-14. No Gate D preparation, build, Zed launch, or runtime execution has
begun. Another explicit user continuation is required.

### Confirmed correction inputs and primary evidence

- The retained isolated profile contains official Java extension 6.8.21 and
  the S005 development extension, with no S003 or S004 development extension.
  Its settings currently point at the routed Gate C arm. Gate D will verify
  this state without reinstalling the extension before it prepares any arm.
- Gate C left mutable JDT `configuration/` areas in all three prepared JDT
  trees and host data-cache directories for all three fixed arm keys. The
  rejected file-as-worktree launch also left the separately identified
  `5b1d71800f6997faaf4a25a43ead7512f50b44ca` host cache. None is a fresh Gate D
  input.
- The ignored Gate C evidence includes all three JDT logs, the two final Zed
  traces available for Arms B and C, sink JSONL, screenshots, and the recorded
  failed setup observations. The accepted logs show the regular Spring
  add/remove records; Arms A and B show `FAILED`, while Arm C has neither
  `FAILED` nor an enabled debug success record.
- Fixed Spring source at commit `18d1a975...` calls
  `executeClientCommand`, retains the returned object, and only then passes
  `executing callback <id> SUCCESS [<result>]` to its debug logger. The same
  commit's logger reads
  `org.springframework.tooling.jdt.ls.extension.DEBUG` for this bundle and
  writes enabled messages to the Eclipse plugin log. `javap -c -p` and the
  bundle manifest in each fixed Gate C arm reproduce those source facts.
- No further proxy, adapter, sink, Spring bundle, JDT LS, Java-extension, or
  fixture code change is necessary for the correction. The existing routed
  proxy's locked tests continue to establish that a successful fixed sink
  response is encoded with the original request ID; Gate D must add runtime
  evidence that the waiting Spring call actually completed with `"done"`.

### Correction inferences

1. Launching all three arms with the same JVM observation property preserves
   the proxy as the only intentional behavioral variable. Debug logging is
   observational: it reveals messages already constructed by fixed Spring
   code and does not change the callback method, ID, payload, result, route, or
   correlation code.
2. In Arm C, the conjunction of exactly one authenticated sink acceptance,
   the sink's fixed `{"result":"done"}` response, and Spring's persisted
   `SUCCESS [done]` means the synchronous JDT LS client request completed with
   that result. Because JSON-RPC completes that pending call by response ID,
   this is runtime evidence for the reviewed original-ID mapping rather than a
   proxy-write-only observation.
3. Reusing the installed isolated-profile extension before preparing new arms
   removes the installation step that contaminated Gate C Arm A. Freshness
   still requires independent checks of both the extracted runtime state and
   Zed Java extension's real host data-cache path before each launch.

These are plan-level inferences until Gate D supplies the corresponding runtime
records.

### Gate D unverified hypotheses and runtime checks

- The isolated Zed launch will pass its controlled `JAVA_TOOL_OPTIONS` value to
  JDT LS. A direct Temurin 25.0.3 launcher probe accepted the exact property,
  but that did not test Zed process inheritance or start JDT LS.
- The fixed Spring pre-execution debug message will persist in every arm's
  Eclipse log, and Arm C will persist `SUCCESS [done]` after the routed response.
- Archiving the four known caches and rerunning unchanged preparation will
  reproduce the Gate B identities without hidden mutable state elsewhere.
- Debug activation will add observation only and will not change the equivalent
  Arm A/Arm B callback failure, listener timing, import, or cleanup behavior.
- The retained installed S005 extension and directory-first launch will avoid a
  new UI/setup correction. Any unexpected dialog or restored invalid worktree
  remains a runtime blocker, not evidence of support or refutation.

### Evidence preservation and fresh-arm preparation

After explicit continuation, Gate D must perform these steps without launching
isolated Zed or JDT LS:

1. Verify no isolated Zed, S005 adapter, sink, Java proxy, or JDT LS process is
   running. Inventory the retained profile's extension index, S005 development
   link, settings, and the current Gate C generated paths before changing
   anything.
2. Create one ignored, timestamped Gate C preservation root under `tmp/`. Record
   a sorted file inventory, sizes, SHA-256 digests for regular evidence files,
   the three callback counts, relevant process absence, and the four known host
   cache paths. Do not include route tokens, ports, opaque JSON-RPC IDs, or
   protocol bodies in a committed file.
3. Move, without deleting, `tmp/s005-artifacts/`, `tmp/s005-evidence/`, the
   three Gate C worktrees, and only the three fixed-arm plus rejected-launch
   JDT host cache directories into that preservation root. Verify the inventory
   still resolves after the move. Do not touch unrelated S003/S004 caches,
   source checkouts, the installed isolated extension, or the user's normal Zed
   data.
4. Reverify the exact pinned source checkouts, clean baseline source, the
   reviewed two-file instrumented diff, rustup 1.97.0, both locked proxy binary
   identities, and every S004 fixed input. Rebuild nothing. An identity failure
   stops Gate D rather than authorizing a new version or dependency.
5. Run the unchanged `PrepareS005` production path to create all three arms
   again at their fixed basenames. Require the Gate B aggregate identities,
   arm-specific proxies, identical fixture and bundle sets, distinct cache
   keys, absent JDT `configuration/`, absent Eclipse project metadata/build
   outputs, absent route/port records, and absent real host data caches.
6. Verify the isolated profile still has only Java 6.8.21 plus S005 for Java,
   then point its settings to Arm A while isolated Zed is stopped. The launch
   target must be the Arm A directory, never the Java file. Opening the real
   Java source is a separate action only after the planned worktree exists.

Directory moves are preservation, not evidence deletion. If any move,
inventory, identity, or preparation check is partial, Gate D stops before Zed
launch and retains both old and partial-new material for diagnosis.

### Non-invasive success-trace setup

Launch the isolated Zed process for every arm from the same controlled shell
environment with exactly:

```text
JAVA_TOOL_OPTIONS=-Dorg.springframework.tooling.jdt.ls.extension.DEBUG=true
```

Do not persist this value in the user's shell configuration, normal Zed
settings, extension files, JDT launcher, or any fixed artifact. During the one
fixed callback in each arm, require the pre-execution
`executing callback <id> ...` debug message from the fixed Spring logger in
addition to the normal bundle activation and `ServiceReady` evidence. This
runtime check, rather than environment inheritance alone, confirms that the
observation property reached that arm's JDT process. Arm C must additionally
record the post-return `SUCCESS [done]` message.

Apply the property equally to Arms A, B, and C. A control-arm change beyond
additional debug messages is an attribution failure. Raw logs remain ignored;
the committed result may quote only the fixed callback ID, `FAILED`,
`SUCCESS [done]`, and structural counts.

### Gate D runtime procedure

1. Stop normal Zed, launch only the newly prepared Arm A directory under the
   controlled environment, and open its unchanged real Java file separately.
   Verify its exact worktree root, six bundle entries, import, `ServiceReady`,
   zero final diagnostics, and recorded pre-launch freshness before sending a
   request.
2. Run Arm A once with exactly the Gate C add/remove pair and timing. Require
   one authentic callback rejected by Zed as before, Spring `FAILED`, zero sink
   callbacks, and the fixed 10-second post-remove observation. Stop and audit
   cleanup before touching Arm B settings.
3. Recheck Arm B's absent local `configuration/` and host data cache, point the
   stopped profile to Arm B, and repeat the same procedure. Require parity with
   Arm A before continuing.
4. Recheck Arm C freshness, point the stopped profile to Arm C, and repeat once.
   Require exactly one authenticated six-argument sink acceptance, the fixed
   sink result, a JDT log entry exactly attributable as
   `executing callback s005.classpath.callback.9f2c SUCCESS [done]`, no callback
   failure, one successful remove, and no duplicate during the fixed interval.
5. Preserve per-arm Zed/JDT/sink logs and a post-callback thread/process audit,
   then verify route, proxy-port, adapter, sink, proxy, and JDT cleanup. Reopen
   normal Zed without `JAVA_TOOL_OPTIONS` and retain the isolated profile as
   previously directed.

The existing Gate C UI-automation rule remains in force. CLI launch and log
inspection do not require exclusive input. If an unexpected Zed dialog or
chooser requires UI automation, tell the user not to use the keyboard or mouse
immediately before automation and restore normal interaction immediately after
it ends.

### Gate D success, stop, and classification rules

Gate D may replace the Gate C Inconclusive classification with Supported on the
same tested tuple only when all original success criteria and all of these
correction criteria hold:

1. Gate C failed evidence remains preserved and inventoried.
2. Each accepted arm has a newly prepared JDT extraction and no pre-launch
   `configuration/`, Eclipse project state, build output, route, port record, or
   arm-specific host data cache.
3. The exact debug property is active in every arm and introduces no relevant
   control difference.
4. Arms A and B retain equivalent authentic failure behavior, while Arm C alone
   records one structurally valid sink callback and Spring
   `SUCCESS [done]` after that sink response.
5. Every arm still has exactly one add/remove pair, fixed timing, attributable
   removal, post-remove silence, and complete cleanup.

There is no in-place setup correction or arm reuse in Gate D. If a wrong launch
target, unexpected extension, pre-created mutable state, missing debug message,
UI interruption, or partial cleanup occurs before classification, stop and
classify the corrected attempt Inconclusive; preserve the evidence and do not
continue to the next arm. A missing success trace with an otherwise accepted
sink response is also Inconclusive because it repeats the evidence blocker.

Refuted remains reserved for an original failure criterion that persists after
freshness and debug activation are both proven. Gate D cannot authorize a
different callback, artifact, version, patch, retry mechanism, coordinator,
product scaffold, or platform claim.

### Gate D plan review record

The review confirmed that the correction changes only observation and runtime
freshness:

- the debug property is derived from fixed Spring source and bundle metadata,
  and is applied symmetrically to all arms;
- Spring success is stronger than a proxy egress trace because it is emitted
  only after the synchronous client request returns its actual value;
- previously failed evidence is preserved before generated paths are vacated;
- both extracted `configuration/` state and the Java extension's real host
  caches are checked, closing the Gate C freshness gap;
- retaining the installed S005 extension removes the contaminating install
  sequence without changing the extension under test;
- no code, build, version, request, route, fixture, timing, arm order, or
  product boundary changes; and
- strict stop-on-contamination rules prevent another accepted arm from reusing
  a rejected launch.

The review found no reason to add proxy egress instrumentation. Doing so would
change the instrumented binary and require a new implementation/build gate,
while the fixed Spring debug path directly observes the needed completion.

## Success criteria

The hypothesis is Supported on the tested host only if all of these hold:

1. Every fixed runtime input and source checkout matches its recorded identity;
   no unpinned server, proxy source, Spring artifact, dependency, wrapper, or
   toolchain is substituted.
2. All three arms import the same one-project fixture and initialize the same
   debug-plus-five-Spring bundle array without attributable bundle or project
   errors.
3. Arms A and B each expose one authentic
   `workspace/executeClientCommand` callback that is not delivered to the mock
   sink, and their relevant callback failure behavior is equivalent.
4. Arm C intercepts only the fixed callback, delivers it to the sink exactly
   once, and the six payload entries satisfy every structural assertion.
5. Arm C returns the sink's `"done"` result to JDT LS under the original request
   ID, and the Spring notification job records success rather than failure.
6. Every arm's add and remove command returns `"ok"`, the JDT/Spring handler log
   attributes the removal to the fixed callback ID, and no duplicate callback is
   observed during the fixed post-removal interval.
7. Unrelated LSP traffic and the existing Java proxy response-routing behavior
   remain functional in the source-built baseline and instrumented arms.
8. No unrelated UI, trust, build, framing, permission, import, or cleanup failure
   prevents attribution.

## Failure criteria

The hypothesis is Refuted for the tested host if any of these persists after the
single permitted setup correction:

- the fixed Spring listener does not emit an initial callback for the imported
  fixture;
- the emitted payload cannot satisfy the fixed Spring consumer's six-element
  contract;
- the source-built unmodified proxy cannot reproduce the official proxy's
  relevant callback behavior despite matching the pinned source;
- the instrumented proxy cannot distinguish, forward, correlate, or answer the
  callback without changing another component or widening the method scope;
- the sink receives zero, duplicate, altered, or unauthorized callback payloads;
- JDT LS does not receive `"done"` or the Spring job still records failure;
- removal fails or a second callback is observed after removal without a new
  subscription; or
- success requires a generic coordinator, installed Java-extension modification,
  different artifact/version, batched mode, extra project, or relaxed assertion.

The result is Inconclusive when a fixed input or pinned checkout cannot be
verified, Arm B differs because of an unattributable source-build/toolchain
problem, current Zed unexpectedly handles the method in a way that invalidates
the control model, route readiness cannot be distinguished from UI timing, or
required evidence is insufficient for attribution.

## Evidence and privacy rules

- Commit only source/patch/test text permitted by Gate A and summarized
  structural observations.
- Keep checkouts, built native binaries, JDT runtimes, Spring JARs, generated
  WASM, route records, tokens, port files, full classpaths, Java options, JRE
  details, protocol envelopes, logs, screenshots, and process listings under
  ignored `tmp/` storage.
- Do not commit credentials, environment values, absolute home paths, localhost
  ports, opaque JSON-RPC IDs, or unrelated documents.
- Record failed controls, timeouts, source-build differences, UI interruptions,
  and corrections; never remove them to make routing appear successful.
- Update this document, the spike index, and prerequisite status after each
  implementation or runtime gate.

## Blockers and constraints

- The public Zed extension API still has no arbitrary server-request handler.
- The existing Java proxy endpoint and port-file layout are private and cannot
  become a product dependency merely because they work in a spike.
- Candidate B requires upstream coordination or an explicit Pivot; this plan
  cannot grant that support contract.
- The upstream proxy source package version differs from the extension release
  number and locally built binaries will not be release-byte-identical.
- The repository has no selected project license. Any patch material must keep
  upstream Apache-2.0 attribution and remain research-only.
- Linux x86_64, Windows x86_64, JDK 21, additional architectures, signing,
  quarantine, and security scanning remain unavailable or untested.
- Third-party provenance gaps still prohibit project-operated Spring artifact
  mirroring or repackaging.

## Remaining uncertainty after a Supported result

Even Supported would not establish:

- the Spring Boot LS `sts/addClasspathListener` request direction;
- delivery into the real `JdtLsProjectCache` or useful Spring Java analysis;
- a generic or secure multi-worktree coordination protocol;
- dynamic callback IDs, batched events, project changes, restart recovery, or
  listener re-registration;
- a supported Java extension API, accepted upstream change, or release version;
- behavior on representative or full desktop/JDK matrices; or
- a Go, Pivot, Limited, or Stop decision by itself.

## Candidate follow-up

After S005, draft the direction decision from R001-R005 and S001-S005 evidence.
Do not start product scaffolding in the same task.

If S005 is Supported, the decision must explicitly address why successful
test-only proxy interception still requires upstream coordination or a Pivot.
If Refuted, the decision review may propose one separately planned Candidate C
snapshot spike only if the missing evidence could materially change Stop versus
Pivot. If Inconclusive, correct only the identified attribution blocker.

## Plan review record

The completed plan review covered hypothesis narrowness, control attribution,
source-build parity, payload determinism, route authentication, JSON-RPC ID
correlation, timeout and cleanup behavior, upstream license attribution,
multiplatform wording, evidence privacy, and the repository direction gate.

It found and corrected four material planning issues:

1. The first draft mixed real upstream proxy builds into Gate A while also
   requiring the Gate A diff to be reviewed before those builds. The corrected
   sequence uses Gate A for implementation and synthetic tests, Gate B for the
   pinned source builds and fixed-input preparation, and Gate C for Zed runtime.
2. The initial Java-options assertion said only "consistent with release 21."
   The corrected plan fixes the four exact JDT compiler keys and values.
3. The first draft bounded routing only conceptually. The corrected plan fixes
   route readiness, callback observation, sink request, and post-removal times,
   plus route schema 1, authentication, response shape, and error code.
4. Silence after listener removal could not independently prove unsubscription.
   The corrected criterion also requires the fixed remove response and an
   attributable handler log, while retaining the silent interval only as
   duplicate-callback evidence.

The review also confirmed that the three-arm structure isolates the official
binary, source-build, and patch variables; the mock sink cannot substitute for
Spring Boot LS; raw payloads remain ignored; and the prospective patch remains
a fixed-method runtime instrument rather than a reusable bridge/coordinator
module.

Plan review outcome at that time: **Ready for user review; implementation had
not started.** Gate A subsequently began only after explicit continuation and
received its complete diff review before the Gate B checkout, builds, and
fixed-artifact preparation.
