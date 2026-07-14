# S006: Real Spring Boot LS classpath-to-completion PoC

- Status: Gate A implementation and synthetic validation complete; Gate B not started
- Date: 2026-07-15
- Related decision: D001
- Related research: R001, R002, R003, R004, R005
- Depends on: S002 Refuted in limited mode; S003, S004, and S005 Supported on
  the local macOS arm64/JDK 25 tuple
- Next gate: no fixed-source native build, artifact preparation, extension
  installation, real language-server launch, or Zed execution until the Gate A
  diff is accepted and an explicit continuation opens Gate B

## Hypothesis

On the fixed local Zed, Java extension, JDT LS, Spring Tools, and JDK tuple, a
disposable protocol-aware Spring proxy plus a narrowly instrumented Java proxy
can complete the real Spring Boot LS classpath handshake and populate the real
`JdtLsProjectCache` for one imported Maven Spring Boot fixture.

In the same fresh Spring Boot LS process, a Zed-originated completion request at
`ser` in `application.properties` will first return no `server.port` item while
JDT classpath listening is disabled. After the real Spring LS generates its
dynamic callback ID, the proxies relay the add-listener request into JDT LS, the
initial classpath callback back into the real Spring LS command handler, and the
handler returns `"done"`, a second Zed-originated completion request will include
exactly identifiable `server.port` metadata for the fixture project.

This is one local end-to-end capability PoC. It does not select the production
coordination architecture, establish a supported private protocol, implement
the other Spring Java-data requests, or claim VS Code Spring Tools parity.

## Decision this spike informs

S006 supplies the local end-to-end evidence required by D001 before the project
direction decision and initial public GitHub source-release preparation.

- Supported permits drafting the Go/Pivot/Limited/Stop direction decision and
  beginning the public-source license, privacy, artifact, and reproducibility
  audit. It does not promote spike code into product code.
- Refuted means the proven S003-S005 seams do not compose into the fixed real
  Spring Boot LS property-completion flow. The direction review must then decide
  between a different narrow integration, a larger coordinator Pivot, Limited,
  or Stop.
- Inconclusive permits only correction of the identified attribution, fixture,
  launch, evidence, or timing blocker. It does not authorize product
  scaffolding.

## Scope

S006 includes only:

- one fresh Maven Spring Boot fixture;
- the real pinned Spring Boot LS release JAR;
- the existing Java extension and one JDT LS process;
- the five pinned Spring JDT bundles already verified by S004;
- one disposable Spring stdio proxy;
- one disposable extension adapter that launches that proxy and contributes the
  Spring JDT bundles to `jdtls`;
- one new disposable patch against the pinned Java proxy source;
- the real `sts/addClasspathListener` request, dynamic callback command,
  classpath event, and `JdtLsProjectCache` handler;
- one before/after `textDocument/completion` probe for `server.port` initiated
  through Zed; and
- listener removal, process cleanup, one fresh repetition, and evidence capture.

S006 excludes:

- any production extension manifest, module, launcher, coordinator, installer,
  server manager, build system, packaging, release automation, or CI;
- Java type, hierarchy, Javadoc, location, search, Java completion, project GAV,
  live-process, dashboard, Initializr, run, debug, test, or UI feature relays;
- Gradle, multi-module, multiple-project, multiple-worktree, remote, WSL,
  container-hosted, Linux, or Windows runtime testing;
- automatic Spring Tools download, update, rollback, offline recovery, mirror,
  or redistribution;
- general-purpose or unauthenticated cross-extension coordination;
- modifying the installed Java extension or Spring Tools release artifact; and
- a product architecture, capability-parity roadmap, support claim, or public
  release in the same task.

## Confirmed facts and primary sources

All source references below use Spring Tools tag `5.2.0.RELEASE`, commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9`, verified from the upstream tag on
2026-07-15 unless another commit is stated.

### Real Spring LS classpath lifecycle

- [`ClasspathListenerManager.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/commons/commons-language-server/src/main/java/org/springframework/ide/vscode/commons/languageserver/java/ls/ClasspathListenerManager.java)
  generates a fresh `sts4.classpath.` plus eight-letter callback command,
  registers its real `workspace/executeCommand` handler, registers that command
  with the client, and then sends `sts/addClasspathListener` to the client. Its
  handler accepts both batched and non-batched six-field classpath events and
  returns `"done"` after dispatching the event to the Spring project listener.
- [`classpath.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/commons-vscode/src/classpath.ts)
  is the production VS Code relay. It converts `sts/addClasspathListener` to
  JDT command `sts.java.addClasspathListener` and passes only the callback ID,
  even though the Spring request also describes batched support. S006 therefore
  uses the JDT handler's non-batched default instead of inventing a different
  relay contract.
- [`JdtLsProjectCache.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/jdt/ls/JdtLsProjectCache.java)
  reads `enableJdtClasspath`, exposes
  `sts.vscode-spring-boot.enableClasspathListening`, registers the classpath
  listener, converts an event into `ClasspathData`, `ProjectBuild`, and a real
  `JdtLsJavaProject`, places that project in its table, and notifies project
  observers.
- The same cache removes its listener through `sts/removeClasspathListener` when
  its subscription is disposed. Listener disablement changes `isSupported()`
  and must not be treated as cleanup merely because processes later disappear.

### Attributable completion behavior

- [`DefaultSpringPropertyIndexProvider.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/metadata/DefaultSpringPropertyIndexProvider.java)
  finds the Java project for the properties document and returns
  `SpringPropertyIndex.EMPTY_INDEX` when no project is present.
- [`SpringPropertiesCompletionEngine.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/properties/completions/SpringPropertiesCompletionEngine.java)
  calculates completion proposals directly from that document-specific property
  index.
- [`PropertiesLoader.java`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/metadata/PropertiesLoader.java)
  loads `META-INF/spring-configuration-metadata.json` from project classpath
  entries. A pinned Spring Boot dependency can therefore supply the fixed
  `server.port` property metadata after the real project enters the cache.
- S002 already observed the exact lower-bound control on this host: with the
  production `JdtLsProjectCache` left empty, completion at LSP position `(0, 3)`
  after `ser` returned `{"isIncomplete":true,"items":[]}`.

### Reused JDT and proxy seams

- S004 proved that the five release Spring JDT bundles load together in JDT LS
  1.60.0 and that a Spring JDT command can traverse one imported project.
- S005 proved that the unmodified Java proxy sends
  `workspace/executeClientCommand` to Zed, while a disposable exact-command
  patch can route the unchanged six-field callback, preserve the original
  request ID, return `"done"`, and leave the source-built control equivalent to
  the official proxy.
- The pinned Java proxy
  [`http.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/http.rs)
  already correlates HTTP-originated requests into JDT LS, but its current
  endpoint and port file are private, generic, and unauthenticated. S006 may use
  its mechanics only inside a more narrowly authenticated disposable route; it
  must not assert a product contract.

## Inferences

1. A before/after completion change in the same Spring LS process controls for
   server version, fixture, document, language ID, Zed client, and base startup
   differences better than comparing S002 and S006 alone.
2. The baseline empty response is necessary but insufficient. Supported also
   requires direct logs for the dynamic callback ID, JDT add result, authentic
   callback, real Spring handler `"done"`, cache event, and post-cache Zed
   response.
3. Relaying only the callback ID for add preserves the fixed VS Code behavior and
   keeps the initial JDT event non-batched, matching the S005 payload shape.
4. `server.port` completion should not require a separate synchronous
   `sts/javaType` or search relay because its metadata is read from classpath
   JARs after project lookup. Runtime tracing must stop rather than silently add
   another Java-data method if this inference is wrong.
5. A platform-neutral WASM adapter and Zed-managed Node process keep the future
   installation direction plausible, but a patched macOS Java proxy is only
   local feasibility evidence.

## Unverified hypotheses and runtime checks

- The fixed Maven fixture imports with its pinned Spring Boot dependency and
  exposes configuration metadata containing `server.port`.
- The disposable Spring proxy can preserve all unrelated initialization,
  registrations, document synchronization, standard completion, shutdown, and
  exit messages while intercepting only the two classpath requests.
- The real Spring LS emits exactly one active dynamic callback ID and accepts the
  relayed initial non-batched event.
- An authenticated worktree-local coordination record can pair exactly one Java
  proxy and one Spring proxy without reading another extension's private work
  directory.
- The Java proxy can expose only add/remove JDT commands and one exact active
  callback without disturbing its existing Zed/JDT response routing.
- The Spring callback handler reaches the real `JdtLsProjectCache` project table
  before the post-cache completion deadline.
- A Zed-originated post-cache completion contains `server.port` with a
  non-empty, structurally valid completion item and is displayed by Zed.
- Listener removal and both route owners clean up after the completion probe;
  prior Zed shutdown-response and forced-child termination limitations may
  recur.

## Fixed environment and inputs

The first execution is local-only:

| Component | Fixed value | S006 role |
| --- | --- | --- |
| Host | macOS 26.5.1 arm64 | Only tested tuple |
| Zed | 1.10.3, build `20260713.002323` | Real LSP client |
| Isolated profile | Retained S003-S005 research profile | Keep official Java 6.8.21; replace only the disposable dev extension link |
| Java extension | 6.8.21, commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d` | Existing JDT LS owner |
| JDT LS | 1.60.0, source commit `57ed41bdddc93df13ace6a266d8e3c1d35c95618` | Fresh prepared runtime |
| JDT archive | SHA-256 `e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d` | Reverify before preparation |
| Spring Tools | `5.2.0.RELEASE`, commit `18d1a975dbea4f9314fd736d0237bd9e23f243f9` | Exact source and release baseline |
| Spring VSIX | 82,759,143 bytes; SHA-256 `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` | Local ignored input only |
| Spring Boot LS JAR | SHA-256 `ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1` | Real child server |
| Spring JDT bundles | The five exact S004 names, order, sizes, and hashes | Inject once into JDT LS |
| Java debug | 0.53.2; SHA-256 `5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c` | Preserve normal Java bundle |
| Java runtime | SDKMAN Temurin 25.0.3 | Zed servers and preparation |
| Rust | rustup stable 1.97.0 | WASM adapter and pinned proxy build |
| Node | Zed-managed Node, currently 26.5.0 | Disposable Spring stdio proxy |

No `latest` selector or replacement release is allowed. An identity mismatch
stops preparation. Linux, Windows, other architectures, and JDK 21 remain
installability targets but untested runtime conditions under D001.

## Fixed fixture and observable

Gate A may add one dependency-minimal Maven fixture with:

- one fixed project name, group, artifact, and version unique to S006;
- Java source and target 21;
- parent `org.springframework.boot:spring-boot-starter-parent:3.5.5`, matching the
  fixed Spring Tools source test baseline;
- the single dependency `org.springframework.boot:spring-boot-starter`, inheriting
  exactly version `3.5.5`, to place Boot configuration metadata on the JDT
  classpath;
- one `@SpringBootApplication` main class;
- `src/main/resources/application.properties` containing exactly `ser` before
  the completion cursor; and
- no wrapper, generated output, committed dependency, or unrelated feature.

The preparation gate must prove from the resolved classpath that at least one
fixed JAR contains `META-INF/spring-configuration-metadata.json` and that the
metadata includes `server.port`. Dependency resolution is allowed only for the
pinned Maven coordinates and is recorded as a network/offline constraint.

The exact user-visible probe is:

```text
document: src/main/resources/application.properties
contents: ser
LSP position: line 0, character 3
baseline required item count for label server.port: 0
post-cache required item count for label server.port: 1
```

The committed result may record the label, kind, insert text or text edit, and
documentation/type presence. Full completion payloads and absolute paths remain
ignored evidence.

## Planned disposable topology

```text
Zed
├── stdio ── instrumented Java proxy ── JDT LS + five Spring bundles
│                 │                         ▲
│                 │ authenticated add/remove│
│                 └──── dynamic callback ───┘
│                              │
└── stdio ── S006 Spring proxy ── real Spring Boot LS
               │                         │
               └── exact callback as workspace/executeCommand
                                          └── JdtLsProjectCache
                                                └── property index
                                                      └── server.port completion
```

The Spring proxy owns the Spring LS child and preserves standard LSP traffic.
The Java proxy continues to own JDT LS. Neither proxy owns both servers, and the
topology is disposable Candidate B evidence rather than the selected product
architecture.

## Fixed disposable coordination contract

Gate A must specify and test two ignored, worktree-local, owner-checked records:

1. a Java route published by the instrumented Java proxy, containing a schema,
   loopback port, fresh random token, fixed proxy/source identity, and owner
   marker; and
2. a Spring callback route published by the Spring proxy only after it receives
   the real `sts/addClasspathListener`, containing a schema, loopback port,
   separate token, and that exact dynamic callback ID.

Both records must be regular non-symlink files, have exact field sets, bounded
size and age, reject replacement of an existing record, bind only to
`127.0.0.1`, use timeouts and body limits, and remove only a record whose token
and owner marker still match. Ports, tokens, process IDs, full paths, and raw
payloads remain ignored evidence.

The Java-side authenticated endpoint accepts only:

- `workspace/executeCommand` with command
  `sts.java.addClasspathListener` and exactly the active callback ID as its one
  argument; or
- `workspace/executeCommand` with command
  `sts.java.removeClasspathListener` and exactly that same callback ID.

The callback branch accepts only a JSON-RPC request with method
`workspace/executeClientCommand` and command equal to the active Spring route's
dynamic ID. It forwards the unchanged `ExecuteCommandParams` to the Spring
proxy, which sends those params to the real Spring child as
`workspace/executeCommand`. Only the child's matching JSON-RPC result may answer
the original JDT request ID. No fixed `"done"` may be synthesized by either
proxy.

Unexpected methods, commands, IDs, fields, routes, tokens, bodies, concurrent
callbacks, results, or timeouts must return a fixed non-sensitive error and must
not fall through to another coordination target. Unrelated JDT LSP messages
retain the upstream proxy path.

## Planned disposable artifacts

Only after Gate A is explicitly opened may it add:

```text
spikes/s006-spring-boot-end-to-end/
├── extension/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── extension.toml
│   ├── probe/
│   │   └── spring_proxy.mjs
│   └── src/
│       └── lib.rs
├── fixture/
│   ├── pom.xml
│   └── src/main/
│       ├── java/.../S006Application.java
│       └── resources/application.properties
├── proxy/
│   ├── UPSTREAM.md
│   ├── instrumented_proxy.patch
│   └── tests/
│       ├── Cargo.lock
│       ├── Cargo.toml
│       └── patch_contract.mjs
└── tools/
    └── PrepareS006.java
```

Generated JDT runtimes, Java source checkouts, proxy binaries, VSIX/JARs, Maven
cache material, worktrees, route records, logs, profiles, screenshots, and raw
evidence remain under ignored `tmp/` storage.

## Gate A: implementation and synthetic validation

Gate A may implement only the planned disposable tree. It must not download or
launch real servers.

### Adapter requirements

- Register one disposable Spring proxy language server for `Java` and
  `Properties`, with language IDs `java` and `spring-boot-properties`.
- Launch only Zed-managed Node with argument arrays and the worktree shell
  environment; do not invoke a shell.
- Contribute exactly the five fixed Spring bundle paths, in S004 release order,
  only to target server ID `jdtls`.
- Produce isolated-profile settings that order `jdtls` before the S006 server
  for `Java`, select only the S006 server for `Properties`, and contain no
  S002-S005 disposable server entry. The manifest and settings must use one
  fixed S006 language-server ID consistently.
- Return Spring initialization option `enableJdtClasspath: false` so the baseline
  request runs before the proxy explicitly enables the classpath listener.
- Use platform-aware path joining and include unit cases for macOS, Linux,
  Windows, spaces, and Unicode without claiming those hosts were run.

### Spring proxy requirements

- Spawn the exact caller-supplied Spring Boot LS JAR with the fixed S002 JVM
  arguments, `shell: false`, bounded shutdown, and inherited sanitized
  environment.
- Add only a selective DEBUG logger for `JdtLsProjectCache` and capture the
  Spring child stderr separately from its stdout protocol stream. Do not enable
  global debug or parse stderr as LSP.
- Frame and correlate concurrent JSON-RPC messages in both directions without
  parsing stdout logs as protocol.
- Preserve initialize, initialized, registrations, configuration, workspace,
  document, completion, diagnostics, shutdown, exit, cancellation, progress,
  and unrelated requests structurally unchanged except for correlated internal
  request-ID translation.
- Wait for one valid, fresh Java route with a bounded deadline before enabling
  classpath listening. Spring initialization and the empty baseline may finish
  before that route exists, but the enable command must not run until both the
  route and the valid baseline are present; route-order differences must not
  cause an unbounded startup wait.
- Intercept only `sts/addClasspathListener` and
  `sts/removeClasspathListener`; validate exact parameter shapes and the dynamic
  callback ID.
- After the first exact Zed-originated baseline completion response is proven
  empty for `server.port`, send one internal
  `sts.vscode-spring-boot.enableClasspathListening` command with `true`.
- Relay add/remove through the authenticated Java route, translate the authentic
  callback into a real child `workspace/executeCommand`, and return only the
  child's result.
- Distinguish Zed-originated completion IDs from internal readiness probes. An
  internal bounded readiness probe may determine when `server.port` is present,
  but Supported still requires a later Zed-originated response containing it.
- Record a structural digest of each child completion result and its
  corresponding Zed response after request-ID translation. The item order,
  labels, edits, kinds, data, and documentation must remain equal; neither
  proxy may add, remove, or rewrite `server.port`.
- Write redacted JSONL events for state transitions and structural assertions,
  never tokens, full classpaths, Java options, environment values, or absolute
  private paths.

### Java proxy patch requirements

- Target the exact Java proxy commit and retain Apache-2.0 attribution.
- Add a separate S006 module and the smallest reviewed hooks in `main.rs` and
  HTTP handling; do not modify completions, URI rewriting, documentation, or
  ordinary request paths.
- Publish and authenticate the fixed Java route; expose only the two fixed JDT
  commands; route only the exact active dynamic callback; preserve original JDT
  request IDs; and bound concurrency, sizes, timeouts, and cleanup.
- Keep a source-reconstruction contract test so the patch cannot silently apply
  to a different upstream preimage.

### Synthetic tests

- fragmented and coalesced LSP frames in both directions;
- notifications, numeric/string IDs, out-of-order responses, cancellation, and
  unrelated pass-through;
- exact baseline completion detection and single classpath-enable transition;
- both Java-first and Spring-first route startup, bounded route timeout, and the
  rule that enable requires both route readiness and a valid empty baseline;
- dynamic ID validation and rejection of fixed, stale, malformed, or mismatched
  IDs;
- add/remove argument shape matching the upstream VS Code relay;
- callback conversion to child `workspace/executeCommand` and propagation of
  the child's actual result;
- route field, ownership, age, symlink, size, token, port, timeout, body, status,
  duplicate, and concurrent-callback rejection;
- original JDT ID preservation and absence of synthesized success;
- route cleanup without deleting a foreign replacement;
- Spring child shutdown/exit and failure propagation; and
- Rust format, clippy with warnings denied, locked tests, Node syntax/tests,
  `cargo check --target wasm32-wasip2`, and Java preparation-tool compilation
  with `--release 21 -Xlint:all -Werror`.

Gate A stops after tests and a complete diff review. No real checkout, build,
artifact preparation, extension installation, or Zed launch is allowed in the
same gate.

## Gate A result: disposable implementation and synthetic validation

Gate A was opened and completed on 2026-07-15. This result validates the
reviewed disposable source and synthetic contracts only. It does not classify
the S006 end-to-end hypothesis, prove that the real servers compose, or make a
product or platform support claim.

### Implemented artifacts

- A platform-neutral Zed WASM adapter registers the single fixed S006 server
  for Java and Properties, resolves Zed-managed Node plus Java without a shell,
  returns `enableJdtClasspath: false`, and contributes the five fixed bundles
  only to `jdtls` in release order.
- The fixed Maven fixture uses Boot `3.5.5`, Java 21, one application class, one
  starter dependency, and `application.properties` containing only `ser`.
- The Spring stdio proxy frames fragmented/coalesced JSON-RPC, keeps unrelated
  traffic raw, verifies the exact opened fixture/language ID/text/position,
  controls the baseline-enable-callback-readiness-disable state machine, and
  preserves structural completion digests.
- The Spring proxy uses separate loopback-only Java and Spring route records
  with exact fields, fresh random tokens and owners, bounded age/size/timeouts,
  exclusive creation, owner-checked cleanup, fixed errors, and no logged token,
  port, classpath, URI, environment, or absolute path.
- The Java proxy patch targets only commit `9148b897...`, adds one S006 module
  plus minimal `main.rs` hooks, publishes the authenticated Java route, exposes
  only the fixed add/remove commands, and intercepts only a currently published
  `sts4.classpath.` callback. The Spring child's actual result and original JDT
  request ID are preserved; the patch contains no fixed successful result.
- `PrepareS006` verifies the fixed artifact identities, clean upstream commit,
  distinct proxy binaries, pinned Boot metadata coordinate and `server.port`,
  safe selected VSIX/TAR extraction, fresh destinations, exact fixture, and
  isolated Java/Properties server ordering before a future Gate B transaction.

All implementation remains under `spikes/s006-spring-boot-end-to-end/`. No
production extension skeleton, bridge, coordinator, installer, packaging, CI,
third-party binary, generated WASM, or runtime evidence is tracked.

### Synthetic validation performed

- `cargo fmt --check`, locked Clippy with warnings denied, and five locked Rust
  unit tests passed for the adapter; `cargo check --target wasm32-wasip2` also
  passed with rustup 1.97.0. The lockfile was resolved offline from the existing
  local Cargo cache.
- Node 26.5.0 syntax checking and the Spring proxy self-test passed. The test
  covers fragmented/coalesced frames, numeric/string and internal IDs,
  cancellation, unrelated pass-through, exact did-open baseline attribution,
  non-empty-baseline rejection, Java-first and Spring-first route readiness,
  add/remove shapes, dynamic callback validation, concurrent callback rejection,
  out-of-order child results, readiness/post-completion structural equality,
  route field/symlink/age/token/owner/duplicate checks, foreign replacement
  preservation, timeout, and disable transition.
- The patch contract verified the exact upstream `main.rs` SHA-256, applied the
  patch with Git whitespace checking to a synthetic copy, formatted and linted
  the added Rust module with warnings denied, and passed six locked unit tests.
  Its callback test returns a nested marker from the fake Spring endpoint and
  proves that exact value—not synthesized `"done"`—reaches the original JDT ID.
- `javac --release 21 -Xlint:all -Werror` and the `PrepareS006 --self-test`
  passed. Synthetic metadata ZIP, safe/unsafe TAR, Unicode/space paths, missing
  metadata, and existing-destination rejection were exercised.
- The complete tracked diff passed `git diff --check`. Generated targets,
  synthetic trees/classes, the retained upstream source, and all prior raw
  evidence remain ignored.

### Failed observations and review corrections

The intermediate failures were retained here rather than omitted:

1. The first Java compilation failed `-Werror` on one redundant integer cast;
   the cast was removed and compilation/self-test then passed.
2. Early patch-contract runs rejected an incorrect new-file hunk count, Rust
   formatting differences, a missing borrow/test constant qualification, and a
   public unit-error result flagged by Clippy. The patch and explicit error type
   were corrected before the final passing contract.
3. A later patch-contract run caught formatting introduced while adding pending
   cleanup/cancellation; the stored patch was reformatted and revalidated.
4. Manual diff review found an untested kebab-case-to-camelCase CLI mapping bug
   for the two route paths, possible duplicate shutdown cleanup, a partial route
   file on write failure, and a pending JDT request on write failure. Each was
   fixed and covered or revalidated before Gate A closed.

These were Gate A implementation defects, not real Spring/JDT runtime results.
No failed observation was deleted to make the gate pass.

### Remaining uncertainty and Gate B boundary

- No real Spring VSIX, JDT archive, Boot dependency, Java proxy binary, or
  prepared worktree was consumed by the Gate A production path.
- The patch was not applied to or built inside the real Java extension checkout;
  the contract used its verified `main.rs` only as a read-only preimage and
  applied the patch in a temporary synthetic tree.
- No real Spring Boot LS, JDT LS, Zed profile, extension installation, UI
  automation, classpath event, property index, or `server.port` completion ran.
- Gate B must still verify every retained input, apply and review the complete
  patch against the clean fixed checkout, build equivalent source/instrumented
  proxies, exercise the preparation production path and fake-child process
  smokes, and stop again before Zed.

## Gate B: fixed source build and preparation

Gate B requires explicit continuation after the full Gate A diff is reviewed.
It may:

1. verify every retained input identity and the clean Java proxy checkout at
   commit `9148b897...`;
2. prove the S006 patch applies only to that checkout and changes only the
   reviewed files;
3. build the unmodified and instrumented proxies with the same locked rustup
   1.97.0 native target, recording distinct hashes and source status;
4. compile and run `PrepareS006` synthetic tests before its production path;
5. verify the Spring VSIX, server JAR, bundle hashes/order, JDT archive, Java
   debug JAR, and fixture coordinates;
6. resolve only the pinned fixture dependencies and prove the resolved metadata
   includes `server.port`;
7. create a fresh uniquely named S006 worktree and fresh JDT runtime/data paths;
8. copy only fixed inputs into ignored worktree storage and produce exact
   settings for the isolated profile, including the reviewed Java and
   Properties server ordering; and
9. run process-only proxy smokes with fake children, without launching Zed or a
   real JDT/Spring language server.

Preparation must reject an existing destination, stale route, unexpected
project metadata, build output, JDT configuration, host cache, or unknown
artifact. It records aggregate hashes so the runtime gate can detect mutation.

Gate B stops for another review. No real Zed launch is allowed in the same gate.

## Gate C: local Zed end-to-end runtime

Gate C requires explicit continuation after Gate B identities, binaries,
settings, and freshness evidence are reviewed.

### Preflight

1. Preserve S005 raw evidence and verify its manifest hashes before moving or
   reusing any ignored path.
2. Verify normal Zed can be stopped and later restored, and that no isolated
   Zed, Spring proxy, Spring LS, S006 Java proxy, JDT LS, route, proxy port, or
   matching host cache is active.
3. Verify the isolated profile contains official Java 6.8.21 plus only the S006
   development extension relevant to Java/Properties.
4. Reverify all fixed input and prepared-output hashes, fresh worktree state,
   exact settings, and absence of prior completion evidence.
5. Record point-in-time disk and memory availability without treating them as a
   performance benchmark.

### Accepted run

1. Launch the fresh S006 worktree through the isolated profile. Open the
   directory, not a previously restored file, and wait for JDT `ServiceReady`,
   Maven import, six total debug-plus-Spring bundle paths, and Spring LS
   initialization.
2. Confirm `enableJdtClasspath: false`, no add-listener request, no Spring route,
   and no cache event before the baseline probe.
3. With no other UI input, open the exact `application.properties`, place the
   cursor after `ser`, and invoke completion once through Zed. UI automation may
   be used only after warning the user not to touch keyboard or mouse. Any
   unrelated input invalidates the run rather than being hidden.
4. Require the Spring proxy to retain the exact Zed-originated baseline request
   identity structurally and record zero `server.port` items. If the baseline
   already contains `server.port`, stop Inconclusive because the before/after
   control is invalid; do not enable the listener. Only after a valid empty
   baseline does the proxy issue the one internal enable command.
5. Observe the real Spring-generated dynamic callback ID, Spring add request,
   authenticated Java request, JDT add result `"ok"`, authentic six-field
   callback, proxy routing, real Spring `workspace/executeCommand`, child result
   `"done"`, and JDT Spring job success. No component may synthesize either
   success string.
6. Require Spring debug evidence for the classpath event, normalized fixture
   URI, `deleted=false`, real project creation, and project-observer/index
   invalidation. If a separate Java-data method appears, stop as an unplanned
   dependency rather than widening the relay.
7. Permit bounded internal completion readiness probes for at most 30 seconds.
   After readiness, invoke completion once more through Zed at the same document
   and position. Require exactly one `server.port` label in the Zed-originated
   response, structural equality with the real Spring child result apart from
   request-ID translation, and visible Zed completion UI.
8. Disable classpath listening through one internal command, observe the real
   Spring remove request and JDT remove result `"ok"`, remove the active Spring
   route, and wait 10 seconds with no further callback.
9. Record callback counts, completion counts, request durations, process RSS,
   relevant redacted logs, route cleanup, and child-process cleanup.
10. Stop isolated Zed, verify no isolated child remains, explicitly remove only
    owned stale route/port records if graceful cleanup again fails, and restore
    normal Zed without S006 observation settings.

### Fresh repetition

Repeat the accepted run once from a newly prepared worktree/JDT cache after all
first-run processes and owned routes are absent. The repetition may reuse the
verified extension installation and pinned Maven cache but not JDT data,
project metadata, build output, route state, Spring process, or completion
evidence. Both runs must satisfy all success criteria.

### Time bounds

- 120 seconds for first Maven/JDT import and 60 seconds on the fresh repetition;
- 30 seconds for Spring LS initialization;
- 10 seconds for the baseline completion response;
- 15 seconds from enable command to authentic callback result;
- 30 seconds from callback result to property-index readiness;
- 10 seconds for the post-cache Zed completion response;
- 10 seconds for remove-listener completion; and
- 10 seconds of post-removal duplicate observation.

A timeout is preserved as a failure or inconclusive observation according to
the classification rules; it is not extended ad hoc during the accepted run.

## Success criteria

S006 is Supported on the tested macOS arm64/JDK 25 tuple only if both fresh runs
satisfy all of these:

1. Every fixed source, artifact, toolchain, prepared runtime, fixture, and
   profile identity matches the reviewed plan.
2. Zed runs the official Java extension, one instrumented Java proxy/JDT LS, one
   S006 Spring proxy, and one real pinned Spring Boot LS with no unexpected
   duplicate server.
3. JDT imports the fixture and loads the debug bundle plus five Spring bundles
   exactly once without attributable bundle, classloading, or project errors.
4. The same Spring LS process returns zero `server.port` items to the exact
   Zed-originated baseline completion while classpath listening is disabled.
5. The real Spring LS generates the dynamic callback ID; the proxies relay the
   official add shape; JDT returns `"ok"`; one authentic classpath event reaches
   the real Spring command handler; that handler returns `"done"`; and the
   original JDT request receives that result.
6. Direct Spring LS debug evidence and structural event checks attribute one
   created fixture project to the real `JdtLsProjectCache` path.
7. The later exact Zed-originated completion contains one `server.port` item and
   Zed visibly offers it; the child and client-facing completion structures are
   equal apart from request-ID translation, without a different fixture,
   process, proxy mutation, or metadata source supplying the result.
8. No unplanned Java-data request, generic forwarding, duplicate callback,
   synthetic result, relaxed validation, or hidden setup correction contributes
   to success.
9. Listener removal returns `"ok"`, the active route is removed, no callback
   appears during the fixed interval, and all isolated processes and owned
   records are absent at cleanup.
10. Normal Zed is restored and the committed evidence contains no secret,
    absolute private path, raw classpath, full environment, token, port, or
    third-party binary.

## Failure and classification criteria

S006 is Refuted on the tested tuple if the fixed, fully attributable relay
completes but either:

- the real Spring handler rejects the authentic classpath payload or cannot
  create/find the fixture project;
- the property index cannot obtain the pinned Boot metadata from the created
  project;
- the post-cache Zed completion remains empty or lacks `server.port` in both
  fresh runs;
- the result requires an unplanned Java-data relay, generic coordinator method,
  Spring/JDT artifact change, different Boot dependency, or product component;
  or
- listener removal, response correlation, or duplicate prevention fails in a
  way intrinsic to the fixed topology.

S006 is Inconclusive when identity, artifact resolution, Zed UI attribution,
freshness, logging, route ownership, source-build parity inherited from S005,
timing, or required evidence is insufficient to decide the hypothesis. A
non-empty baseline that already contains `server.port`, crash, timeout, import
failure, unexpected request, or cleanup issue is classified from its
attributable cause and is never deleted to obtain Supported.

One setup-only correction may be planned after a rejected launch only if no
Spring add request, classpath callback, or completion probe ran. Preserve the
failed state and prepare a new worktree/cache. After any hypothesis input or
protocol behavior begins, no in-place correction or retry is allowed; use the
fresh repetition rule or record the result.

## Evidence and privacy rules

- Commit only the reviewed disposable source/patch/test text and summarized
  structural observations permitted by the opened gate.
- Keep source checkouts, compiled native/WASM/Java outputs, VSIX/JARs, Maven
  artifacts, JDT runtimes/data, worktrees, routes, proxy port files, tokens,
  process listings, screenshots, logs, raw LSP/HTTP payloads, full completions,
  classpaths, Java options, and environment details under ignored `tmp/` paths.
- Raw logs must remain attributable by monotonic sequence/time, direction,
  redacted request identity, method, command, and structural result without
  publishing opaque IDs or secrets.
- Preserve baseline-empty, failed callback, timeout, duplicate, UI interruption,
  shutdown error, forced cleanup, and retry observations.
- Record exact hashes for retained core evidence and verify them before any move
  or cleanup.
- Update this document, the spike index, prerequisites, and decision readiness
  after every opened gate.

## Blockers and constraints

- The public Zed extension API still cannot handle arbitrary server-to-client
  requests or directly coordinate two language servers.
- The installed Java extension exposes no supported coordination interface; the
  S006 patch remains disposable and requires an upstream contract or later
  Pivot before product use.
- The Spring VSIX third-party inventory remains incomplete for project-operated
  repackaging or mirroring. S006 uses the unchanged local verified asset only.
- The fixture introduces pinned Maven dependency resolution, so offline and
  repository availability behavior is not proven.
- Current Zed/JDT/Spring shutdown response mismatches and forced child cleanup
  may recur and must remain visible.
- JDT LS memory observations exceeded 1 GiB in some earlier runs; S006 records
  another observation but does not establish a budget or optimize it.
- All non-macOS tuples, JDK 21, Marketplace installation, signing, quarantine,
  security scanning, remote development, and WSL remain untested.

## Candidate follow-up

After S006 classification, do not start product scaffolding in the same task.

- If Supported, draft the project direction decision. Candidate B remains the
  leading full-integration shape, but the decision must choose how the Java
  coordination contract becomes supported and how spike code is discarded.
- In parallel with or after that decision, prepare the initial public-source
  license, history/privacy, third-party artifact, README, reproducibility, and
  tested/untested audit defined by D001.
- Then create a capability inventory for VS Code Spring Tools and prioritize the
  next smallest user-visible capability; do not describe the single completion
  as parity.
- If Refuted or Inconclusive, plan only the evidence-backed correction or
  architecture comparison that can change the direction outcome.

## Plan review checklist

Before the status can change to `Plan reviewed`, verify that the plan:

- tests one user-visible capability and one project only;
- uses the real release Spring Boot LS and real `JdtLsProjectCache` handler;
- includes a same-process baseline before enabling classpath;
- attributes the post-cache result to a Zed-originated request;
- preserves the upstream dynamic callback and non-batched relay behavior;
- never synthesizes `"ok"`, `"done"`, or `server.port`;
- bounds and authenticates both disposable directions;
- does not add a generic relay or silently widen to Java-data methods;
- separates implementation, native build/preparation, and Zed runtime gates;
- records UI automation and cleanup invalidation rules;
- preserves failed evidence and private raw artifacts;
- retains the local-only support wording and deferred multiplatform strategy;
- opens only a direction/public-source audit after Supported; and
- leaves product architecture, scaffolding, packaging, and parity work closed.

## Plan review record

Reviewed on 2026-07-15 before implementation. The review traced the fixed
Spring Tools source at commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9` and corrected or strengthened these
points:

1. The fixture now pins its Boot parent to `3.5.5` and limits the dependency set
   to the starter version inherited from that parent, rather than leaving the
   fixture version source or metadata input unspecified.
2. A non-empty baseline is explicitly Inconclusive and stops before listener
   enablement, preserving the same-process before/after control.
3. Spring child stderr is separated from stdout protocol framing and DEBUG is
   limited to `JdtLsProjectCache` attribution.
4. Route readiness is bounded and independent of Java-versus-Spring startup
   order; listener enablement requires both that route and the valid baseline.
5. Exact Java and Properties server selection is fixed for the isolated
   profile, excluding stale S002-S005 development entries.
6. Child and client-facing completion structures must match, so the disposable
   proxy cannot manufacture or rewrite `server.port`.

All checklist items were satisfied at plan level. Gate A was subsequently
opened, implemented, reviewed, and closed as recorded above. Gate B remains
closed until a later explicit continuation; no prepared runtime, extension
installation, real language-server execution, or Zed runtime has occurred.
