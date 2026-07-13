# S003: Cross-extension synthetic JDT LS bundle injection

- Status: Proposed — awaiting Gate 0 review
- Date: 2026-07-14
- Related research: R001, R003, R004, R005
- Depends on: S002
- Implementation state: Plan only; no S003 code or Java extension installed

## Hypothesis

On Zed 1.10.3 for macOS arm64, the official Java extension 6.8.21 can launch
the pinned Eclipse JDT LS 1.60.0 through its unmodified pinned Java proxy while a
separately installed disposable Java-targeting adapter appends exactly one
synthetic OSGi bundle path through
`language_server_additional_initialization_options`. JDT LS will load that
bundle and execute its static `s003.synthetic.ping` delegate command, returning
a JSON object structurally equal to `{"spike":"s003","value":"ok-v1"}`.

This hypothesis covers the cross-extension bundle-injection path only. It does
not claim that the Spring Tools bundles are compatible, that Spring LS can use
JDT data, or that callback routing is feasible.

## Decision this spike informs

S003 tests the first shared premise of coordinated Candidates B and C from R004:
a separate extension can augment the existing Zed-managed JDT LS process without
forking or replacing the Java extension.

- A Supported result permits S004 to test the pinned Spring Tools JDT bundles
  and one real Spring delegate command.
- A Refuted result blocks the planned cross-extension injection route on the
  tested tuple. The next investigation must then determine whether an explicit
  user initialization setting, a Java-extension change, or a larger coordinator
  pivot is required.
- An Inconclusive result permits only a narrower correction or environment
  investigation; it does not justify S004.

## Why runtime verification is required

Pinned Zed source shows that it asks other registered adapters for additional
initialization options and recursively merges their JSON into the target
adapter's options. Pinned Java-extension source preserves a `bundles` array and
JDT LS source loads bundle paths before registering capabilities.

Those source facts do not prove that:

- the hook runs across two separately installed extensions for the `Java`
  language;
- an absolute path under the worktree remains readable by the Java proxy and JDT
  LS child;
- the pinned synthetic OSGi metadata resolves against the exact JDT LS build;
- the Java extension's debugger bundle survives the additional array merge; or
- restart repeats the merge without dropping or duplicating the bundle.

## Scope boundaries

Included:

- one isolated Zed user-data directory;
- the official Java extension exactly at version 6.8.21;
- pinned JDT LS 1.60.0, Java proxy v6.8.21, and Java debug bundle 0.53.2;
- one disposable Rust/WASM adapter registered for `Java`;
- one minimal Node lifecycle server so that the second adapter is valid and
  independently observable;
- one synthetic JDT LS OSGi bundle containing one static delegate command;
- one fixed dependency-free Java fixture;
- initialize, bundle-load, command, process, memory, restart, shutdown, and
  cleanup observations; and
- one direct HTTP request through the unchanged Java proxy as a spike-only test
  oracle.

Excluded:

- Spring Boot LS startup or any Spring Tools JDT bundle;
- classpath listeners, `workspace/executeClientCommand`, `sts/*` callbacks, or a
  coordinator;
- modification, replacement, or forking of the official Java extension, Java
  proxy, Zed, or JDT LS;
- Maven, Gradle, project import, Java feature quality, debugging, Lombok, task
  execution, or multiple worktrees;
- remote development and WSL;
- automatic `latest` downloads or treating an unpinned artifact as supported;
  and
- production manifests, build systems, packaging, architecture, or support
  claims.

## Confirmed inputs and primary sources

All sources in this section were accessed on 2026-07-14.

### Zed merge behavior

The tested Zed build identifies itself as 1.10.3, build `20260713.002323`, and
LSP client commit `0c54c414d522234de7298039708ffe85a116892a`.

- The published [`Extension` trait
  0.7.0](https://docs.rs/zed_extension_api/0.7.0/zed_extension_api/trait.Extension.html)
  exposes `language_server_additional_initialization_options` with the source
  and target language-server IDs plus the worktree.
- The exact tested Zed [`lsp_store.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/project/src/lsp_store.rs)
  iterates other registered adapters, requests their additional options, and
  merges each returned JSON value into the target initialization object.
- R001 and R003 record the recursive object merge and array-append behavior.

### Official Java extension and proxy

The official Java extension source remains at commit
`9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, manifest version 6.8.21, and
`zed_extension_api = "0.7.0"`.

- [`extension.toml`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/extension.toml)
  registers `jdtls` for `Java`.
- [`jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs)
  accepts a configured launcher and proxy, builds initialization options, and
  preserves and augments a valid `bundles` array with its debugger bundle.
- [`lsp.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/lsp.rs)
  documents the localhost proxy request channel and worktree-derived port file.
- [`proxy/src/main.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs)
  writes the port file and starts JDT LS without altering the child command.
- [Java extension release
  v6.8.21](https://github.com/zed-extensions/java/releases/tag/v6.8.21)
  publishes the fixed macOS arm64 proxy used by this plan.

The proxy endpoint is private implementation detail. S003 may use it only to
send one test request to the already-running JDT LS instance. Its use is not
evidence that another production extension may depend on it.

### Eclipse JDT LS bundle and command behavior

The pinned runtime is JDT LS tag `v1.60.0`, source commit
`57ed41bdddc93df13ace6a266d8e3c1d35c95618`.

- [`InitHandler.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/handlers/InitHandler.java)
  reads initialization options and loads supplied bundles.
- [`BundleUtils.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/handlers/BundleUtils.java)
  installs, refreshes, and starts extension bundles.
- [`IDelegateCommandHandler.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/IDelegateCommandHandler.java)
  defines the synthetic handler interface.
- The [`delegateCommandHandler` schema](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/schema/org.eclipse.jdt.ls.core.delegateCommandHandler.exsd)
  permits a static command to be registered during initialization.
- [`WorkspaceExecuteCommandHandler.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/handlers/WorkspaceExecuteCommandHandler.java)
  discovers and invokes delegate handlers.

### Fixed external artifacts

| Component | Fixed identity | Size | SHA-256 | Verification state |
| --- | --- | ---: | --- | --- |
| JDT LS | [`jdt-language-server-1.60.0-202606262232.tar.gz`](https://download.eclipse.org/jdtls/milestones/1.60.0/jdt-language-server-1.60.0-202606262232.tar.gz) | 50,925,681 bytes | `e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d` | Size and digest published by Eclipse; full local download deferred |
| Java proxy | [release v6.8.21 `java-lsp-proxy-darwin-aarch64.tar.gz`](https://github.com/zed-extensions/java/releases/download/v6.8.21/java-lsp-proxy-darwin-aarch64.tar.gz) | 350,984 bytes | `3b128f058eed29e7b7a30c7aaccd430e2964917e45f62e5052d8df676dccb5e5` | Fixed official asset downloaded and locally hashed under ignored `tmp/` |
| Java debug | [release 0.53.2 `com.microsoft.java.debug.plugin-0.53.2.jar`](https://github.com/zed-industries/java-debug/releases/download/0.53.2/com.microsoft.java.debug.plugin-0.53.2.jar) | 3,107,682 bytes | `5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c` | Fixed official asset downloaded and locally hashed under ignored `tmp/` |

The JDT LS URL is the exact 1.60.0 milestone filename, not its mutable
`latest.txt` selector. Eclipse publishes the recorded `.sha256` alongside the
archive. The first local download attempt was abnormally slow and was stopped;
the partial file was deleted and is not evidence. Gate B must reacquire the full
archive and verify both exact size and digest before extraction.

The Java debug artifact's manifest reports bundle symbolic name
`com.microsoft.java.debug.plugin` and version 0.53.2. The proxy archive contains
one `java-lsp-proxy` executable. These two fixed research copies remain ignored
and are not installed.

## Inferences

1. A final JDT LS initialize request containing the existing debugger bundle and
   exactly one synthetic bundle path would demonstrate successful cross-adapter
   JSON composition without replacement of the Java extension's options.
2. Advertising `s003.synthetic.ping` and returning its deterministic payload
   would demonstrate that JDT LS both resolved the bundle extension point and
   instantiated the handler; a log line alone is weaker evidence.
3. Calling the command through the official proxy avoids adding a second JDT LS
   client solely for observation. This does not make the private endpoint a
   viable product integration API.
4. A dependency-free Java fixture is enough to activate the `Java` language and
   JDT LS. Project import correctness is unrelated to the static synthetic
   command.

## Unverified hypotheses

1. The official extension manager will install exactly Java extension 6.8.21 in
   the isolated user-data directory when Gate B begins.
2. A separately installed adapter registered for `Java` participates in the
   additional-options merge for `jdtls`.
3. The worktree-relative bundle path can be converted to an absolute local path
   that remains readable by the proxied JDT LS process.
4. The synthetic bundle's OSGi requirements resolve against JDT LS 1.60.0.
5. The debugger bundle and synthetic bundle coexist without duplication or
   ordering-dependent failure.
6. The unchanged proxy returns the synthetic command result through its HTTP
   side channel.
7. Restart rebuilds the same initialization array and command registration.

## Environment

Planned first execution environment:

| Component | Value | S003 use |
| --- | --- | --- |
| OS | macOS 26.5.1, arm64 | First host only |
| Zed | 1.10.3, build `20260713.002323` | Client under test |
| Official Java extension | 6.8.21, not currently installed | Install only in isolated Gate B data |
| JDT LS | 1.60.0 fixed milestone above | Custom local launcher; no managed latest download |
| Java proxy | v6.8.21 fixed macOS arm64 asset | Unmodified proxy path supplied in isolated settings |
| Java debug bundle | 0.53.2 fixed asset | Preserve normal Java-extension bundle injection |
| Lombok | Disabled | Avoid unrelated artifact and agent behavior |
| Task helper | Not supplied | `check_updates: "never"`; nonessential lookup may fail without blocking JDT LS |
| Java runtime | SDKMAN Temurin JDK 25.0.3 | JDT LS and preparation tool |
| Rust | rustup stable 1.97.0 with `wasm32-wasip2` | Disposable adapter build |

Java 25 is evidence for this local run only. Representative S003 evidence still
requires JDK 21 on Linux x86_64 and Windows x86_64 if S003 later contributes to
a direction decision.

## Planned disposable artifacts

Only after Gate 0 approval, Gate A may add:

```text
spikes/s003-jdtls-synthetic-bundle/
├── extension/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── extension.toml
│   ├── probe/lifecycle_probe.js
│   └── src/lib.rs
├── bundle/
│   ├── META-INF/MANIFEST.MF
│   ├── plugin.xml
│   └── src/dev/zed/spring/s003/SyntheticCommandHandler.java
├── fixture/S003Fixture.java
└── tools/PrepareS003.java
```

Generated data must remain ignored:

```text
tmp/s003-artifacts/
tmp/s003-zed-user-data/
tmp/s003-evidence/
spikes/s003-jdtls-synthetic-bundle/extension/target/
spikes/s003-jdtls-synthetic-bundle/extension/extension.wasm
```

The single-file Java preparation tool is spike infrastructure, not a product
installer. It will:

1. accept only caller-supplied local paths for the three fixed artifacts;
2. verify the exact sizes and SHA-256 values above before extraction;
3. parse gzip/tar and JAR input without invoking a platform shell;
4. reject absolute paths, traversal, links, duplicate entries, unsupported tar
   records, unsafe destination states, and unexpected layouts;
5. extract the pinned JDT LS launcher and proxy into a fresh ignored directory;
6. verify the debug bundle identity;
7. compile the committed handler with the JDK compiler API against the pinned
   JDT LS plugin set using `--release 21`;
8. build a deterministic synthetic OSGi JAR containing only the committed
   class, manifest, and `plugin.xml`; and
9. print the prepared paths, entry counts, and digests without environment
   values or home-directory paths.

The disposable Rust adapter will pin `zed_extension_api = "=0.7.0"`, register
one secondary server for the existing `Java` language, and return additional
initialization JSON only when its own server ID and target ID exactly match the
planned injector and `jdtls`. It will append one platform-aware absolute path:

```json
{"bundles":["<worktree>/tmp/s003-artifacts/prepared/s003-synthetic-bundle.jar"]}
```

Its own command will use Zed's managed Node path and a minimal lifecycle probe.
It will not download files, inspect the Java extension work directory, call the
proxy, start JDT LS, or add Spring behavior.

The synthetic handler accepts only `s003.synthetic.ping`, rejects unexpected
command IDs or arguments, and returns only the fixed JSON-compatible map. It
does not read files, environment variables, system properties, or network data.

## Procedure

Implementation and execution remain separate review gates.

### Gate 0: plan review

Before any S003 source code, Java extension installation, or JDT LS extraction:

1. approve the synthetic-command-only hypothesis and exclusion of Spring
   artifacts;
2. approve Java extension 6.8.21 and the three fixed runtime inputs;
3. approve isolated Java setup with custom artifact paths, Lombok disabled, and
   `check_updates: "never"`;
4. approve the Java preparation tool as the shell-independent verification,
   extraction, and bundle-build boundary;
5. approve the minimal Node server as the secondary Java adapter's disposable
   lifecycle endpoint;
6. approve use of the unchanged private proxy endpoint only as a test oracle;
   and
7. approve the Supported, Refuted, and Inconclusive thresholds below.

### Gate A: disposable implementation, only after plan approval

1. Add only the planned adapter, lifecycle probe, synthetic bundle sources,
   fixed Java fixture, and preparation tool.
2. Unit-test exact target-ID filtering, path joining on macOS/Linux/Windows,
   spaces and non-ASCII worktree paths, one-element bundle JSON, and Node probe
   lifecycle framing.
3. Unit-test valid synthetic preparation plus wrong size, wrong digest, tar and
   ZIP traversal, link rejection, duplicate entry, missing JDT plugin, invalid
   bundle metadata, compilation failure, and existing destination cases using
   generated small inputs rather than the real JDT archive.
4. Compile the tool with `javac --release 21 -Xlint:all`, run its self-test, and
   confirm a wrong local input fails without creating output.
5. Run Rust unit tests, format checking, locked `wasm32-wasip2` check, Clippy
   with warnings denied, and locked release WASM build.
6. Review the complete diff before installing the Java extension, extracting
   the real JDT LS archive, or starting Zed Gate B.

### Gate B: fixed-artifact preparation and isolated Zed execution

1. Reacquire the exact fixed JDT LS archive into ignored local storage. Verify
   all three inputs with the committed preparation tool and create a fresh
   ignored prepared directory.
2. Record `java -version`, `javac -version`, artifact sizes and digests, prepared
   entry counts, synthetic bundle digest, and executable paths without recording
   environment values.
3. Create isolated Zed settings that use the exact prepared `jdtls_launcher`,
   `lsp_proxy_path`, and `java_debug_jar`, set `lombok_support: false`,
   `jdk_auto_download: false`, and `check_updates: "never"`, and enable LSP
   trace logging. Do not change the user's normal Zed settings.
4. Close normal Zed only when the UI phase begins, notify the user not to use
   mouse or keyboard, and launch Zed with the isolated user-data directory and a
   rustup-first PATH.
5. Install the official Java extension in the isolated directory. Require its
   installed manifest to report exactly 6.8.21; stop as Inconclusive if the
   extension manager supplies another version.
6. Install the S003 development extension and verify its WASM build. Confirm the
   isolated directory contains only expected bundled extensions, Java 6.8.21,
   and the S003 development extension.
7. Open the unchanged `S003Fixture.java`, establish worktree trust, and confirm
   one official Java proxy/JDT LS pair plus one S003 Node probe start for the
   worktree. Record command paths and arguments without environment values.
8. Capture the final JDT LS initialize request and response. Require its
   `bundles` array to retain the fixed debug bundle and contain the synthetic
   bundle path exactly once, with no Spring Tools path.
9. Inspect JDT LS and Zed logs for bundle install, resolution, activation,
   capability registration, errors, server-to-client methods, initialization
   time, and process memory.
10. Require the initialize response to advertise `s003.synthetic.ping`. Discover
    the proxy port file using the exact pinned source algorithm, keep its path
    private in ignored evidence, and send one local HTTP
    `workspace/executeCommand` request for the synthetic command with an empty
    argument array.
11. Record the exact returned payload. Do not send any other private proxy
    request and do not treat endpoint discovery as a reusable integration API.
12. Restart `jdtls` once. Confirm replacement proxy and JDT LS processes,
    reinitialization, exactly-once bundle injection, command advertisement, and
    the same deterministic command result after restart.
13. Record shutdown and `exit` behavior without requiring graceful process exit,
    following S001's lifecycle constraint.
14. Stop the isolated instance, remove the development-extension link and
    generated WASM, verify no probe, proxy, or JDT LS process remains, restore
    any input-source change made for automation, and reopen normal Zed.
15. Summarize observations and classify the result. Do not promote any spike
    code or private endpoint use into production code.

No retry may change artifact versions, Java-extension source, the synthetic
command, or the hook mechanism. One documented correction is allowed only for a
clear operator setup mistake such as an incorrect prepared absolute path.

## Success criteria

The hypothesis is Supported on the tested host only if all of these hold:

1. Every installed or executed component matches the fixed identities and
   digests, and no managed `latest` JDT LS, proxy, debugger, Lombok, or task
   helper is downloaded during the hypothesis run.
2. The official unmodified Java extension and proxy start the pinned JDT LS and
   complete initialization on JDK 25.
3. The final JDT LS initialization options retain the Java debug bundle and add
   the exact synthetic bundle path once, with no Spring bundle path.
4. JDT LS reports no install, resolution, activation, linkage, or extension-point
   error for the synthetic bundle.
5. The initialize response advertises `s003.synthetic.ping`, and the unchanged
   proxy returns a JSON object structurally equal to
   `{"spike":"s003","value":"ok-v1"}` for it.
6. JDT LS restart repeats criteria 2-5 without accumulating a duplicate bundle
   or requiring a Java extension/proxy modification.
7. No unrelated UI, trust, Java runtime, framing, permission, or logging failure
   prevents attribution of the bundle-injection result.

## Failure criteria

The hypothesis is Refuted for the tested host if any of these persists after
the one permitted setup correction:

- the separately installed adapter is not asked for additional options targeting
  `jdtls`;
- the final initialization options omit the synthetic path, replace the debug
  bundle, or duplicate the synthetic path;
- JDT LS rejects, cannot resolve, or cannot activate the verified synthetic
  bundle;
- the static command is absent, cannot be instantiated, or does not return the
  fixed payload through the unchanged proxy;
- success requires changing the Java extension, proxy, JDT LS, Zed, or fixed
  bundle contract; or
- restart loses or duplicates the otherwise successful injection.

The result is Inconclusive when the official manager no longer provides Java
extension 6.8.21, a fixed artifact cannot be reacquired or verified, an unrelated
Zed/JDK/UI failure prevents JDT LS initialization, the proxy test oracle is
unavailable before command behavior can be distinguished, or required logs are
insufficient to attribute the result.

## Evidence and privacy rules

- Commit only fixed fixture/source text and summarized observations.
- Keep archives, extracted servers, executables, generated bundles, raw protocol
  logs, port files, screenshots, process listings, and host paths under ignored
  `tmp/`.
- Do not record environment values, credentials, localhost port numbers,
  unrelated documents, or home-directory paths in committed evidence.
- Preserve failed, interrupted, and corrected observations in the summary.

## Blockers and constraints before execution

- The official Java extension is not installed in either the user's normal Zed
  setup or a fresh S003 isolated directory.
- The full pinned JDT LS archive has not yet been locally acquired and verified.
- The Java proxy HTTP endpoint and port-file layout are explicitly private and
  may serve only as the S003 observation mechanism.
- S003 provides no evidence for Spring bundle compatibility or callback routing.
- Linux x86_64 and Windows x86_64 execution hosts remain unavailable.

## Remaining uncertainty after a Supported result

Even Supported would not establish:

- compatibility of any Spring Tools JDT bundle with JDT LS 1.60.0;
- successful execution of a Spring command or useful Java project data;
- handling of `workspace/executeClientCommand` or any classpath callback;
- safe public coordination with the Java extension's proxy;
- Maven, Gradle, multi-worktree, restart-race, offline-installation, or artifact
  update behavior; or
- Linux, Windows, x86_64, or additional Arm64 support.

## Candidate next experiment

If Supported, write and review S004 to load only the pinned Spring Tools JDT
bundle set into the same fixed JDT LS tuple and execute one non-listener Spring
delegate command. S004 must perform an explicit Spring/JDT bundle compatibility
review before code or runtime changes.

If Refuted, do not proceed to S004 through this hook. Record the failed premise
for Candidates B and C and investigate only the smallest alternative injection
surface supported by evidence.
