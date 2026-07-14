# S003: Cross-extension synthetic JDT LS bundle injection

- Status: Supported on macOS arm64 with JDK 25; other platforms untested
- Date: 2026-07-14
- Related research: R001, R003, R004, R005
- Depends on: S002
- Implementation state: Disposable Gate A and local Gate B complete; no product
  implementation authorized

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
| JDT LS | [`jdt-language-server-1.60.0-202606262232.tar.gz`](https://download.eclipse.org/jdtls/milestones/1.60.0/jdt-language-server-1.60.0-202606262232.tar.gz) | 50,925,681 bytes | `e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d` | Fixed official artifact downloaded, locally verified, and prepared under ignored `tmp/` |
| Java proxy | [release v6.8.21 `java-lsp-proxy-darwin-aarch64.tar.gz`](https://github.com/zed-extensions/java/releases/download/v6.8.21/java-lsp-proxy-darwin-aarch64.tar.gz) | 350,984 bytes | `3b128f058eed29e7b7a30c7aaccd430e2964917e45f62e5052d8df676dccb5e5` | Fixed official asset downloaded and locally hashed under ignored `tmp/` |
| Java debug | [release 0.53.2 `com.microsoft.java.debug.plugin-0.53.2.jar`](https://github.com/zed-industries/java-debug/releases/download/0.53.2/com.microsoft.java.debug.plugin-0.53.2.jar) | 3,107,682 bytes | `5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c` | Fixed official asset downloaded and locally hashed under ignored `tmp/` |

The JDT LS URL is the exact 1.60.0 milestone filename, not its mutable
`latest.txt` selector. Eclipse publishes the recorded `.sha256` alongside the
archive. The first local download attempt was abnormally slow and was stopped;
the partial file was deleted and is not evidence. Gate B later reacquired the
full archive and verified both exact size and digest before extraction.

The Java debug artifact's manifest reports bundle symbolic name
`com.microsoft.java.debug.plugin` and version 0.53.2. The proxy archive contains
one `java-lsp-proxy` executable. The fixed source copies and prepared runtime
files remain ignored and are not redistributed by this repository.

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
requires JDK 21 on Linux x86_64 and Windows x86_64 when platform validation
begins. D001, recorded after this run, no longer makes that evidence a
prerequisite for the local direction decision.

## Gate A disposable artifacts

Gate A added only the approved disposable files:

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
installer. It:

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

The disposable Rust adapter pins `zed_extension_api = "=0.7.0"`, registers
one secondary server for the existing `Java` language, and returns additional
initialization JSON only when its own server ID and target ID exactly match the
planned injector and `jdtls`. It will append one platform-aware absolute path:

```json
{"bundles":["<worktree>/tmp/s003-artifacts/prepared/s003-synthetic-bundle.jar"]}
```

Its own command uses Zed's managed Node path and a minimal lifecycle probe. It
does not download files, inspect the Java extension work directory, call the
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

Gate 0 was approved by the user on 2026-07-14 before S003 source files were
added. The approval did not authorize Gate B artifact extraction, Java extension
installation, or Zed runtime execution.

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

### Gate A confirmed observations

Gate A ran on the local macOS arm64 development host on 2026-07-14:

1. The disposable adapter, lifecycle probe, synthetic bundle metadata and Java
   handler, fixed fixture, and single-file Java preparation tool are the only
   S003 source artifacts added. Existing ignore rules already cover Rust output
   and all local artifacts and evidence.
2. The Rust manifest pins `zed_extension_api = "=0.7.0"`; its generated lockfile
   contains 86 package records including the spike crate. Four unit tests passed
   for exact source and target ID filtering, exactly-one bundle JSON, unknown
   server rejection, and macOS/Linux/Windows path construction including spaces
   and Korean text.
3. The Node probe self-test passed split-frame, adjacent-frame,
   `Content-Length`, and malformed-header cases. A piped initialize, shutdown,
   and exit integration run returned the declared server identity and recorded a
   graceful lifecycle.
4. `PrepareS003.java` compiled with `javac --release 21 -Xlint:all -Werror` on
   Temurin JDK 25.0.3. Its self-test prepared the committed bundle twice with the
   same digest and rejected wrong size, wrong digest, tar traversal, tar links,
   duplicate tar entries, a missing JDT plugin, ZIP traversal, invalid OSGi
   metadata, Java compilation failure, and an existing destination.
5. Supplying the fixed Java fixture as all three alleged external artifacts
   returned exit status 1 for an unexpected size and created no destination.
6. `cargo fmt --check`, native locked tests, locked `wasm32-wasip2` check,
   Clippy with warnings denied, and a locked release WASM build passed. The
   ignored release WASM is 226,209 bytes.
7. No full JDT LS archive was acquired or extracted during Gate A. No Java
   extension or S003 development extension was installed, no Zed UI was
   automated, and no JDT LS, Java proxy, or S003 probe process was left running.

Constraint retained for Gate B:

- The preparation tool intentionally rejects PAX, GNU long-name, link, and other
  unsupported tar records. Its parser was validated with generated USTAR input,
  but compatibility with the fixed real JDT LS archive remains runtime evidence.
  If the verified archive uses a rejected record, Gate B must stop for a reviewed
  tool change rather than bypassing validation with a platform `tar` command.

### Gate B preparation compatibility review

Gate B stopped at the planned compatibility boundary on 2026-07-14. The three
fixed inputs matched their recorded sizes and SHA-256 values, but the committed
preparation tool rejected the first JDT LS archive record because it is a local
PAX extended header (`typeflag x`). No JDT LS files were retained, no Java or
development extension was installed, and Zed runtime execution did not start.

Read-only inspection of the verified archive found 128 regular files and 13
directories. Its local PAX metadata uses only `uid`, `gid`, and `mtime`; it does
not override a path, link target, size, or other extraction-sensitive field.
There are 141 `uid` records, 141 `gid` records, and 140 `mtime` records. The
proxy archive contains one regular file and no PAX metadata.

The reviewed correction is deliberately narrower than general PAX support:

1. accept only a local `x` header immediately preceding one logical entry;
2. parse length-prefixed records strictly and allow only `uid`, `gid`, and
   `mtime` with numeric values;
3. ignore those ownership/time values instead of applying host metadata;
4. continue validating the following USTAR path, link field, size, type,
   checksum, collision, and extraction limits independently;
5. reject global PAX, path/link/size overrides, duplicate or malformed keys,
   consecutive local headers, and a dangling local header; and
6. count only logical file and directory entries in preparation evidence.

The correction must add positive local-metadata coverage and negative override,
global, malformed, duplicate, and dangling-header tests. Gate B may resume only
after the complete tool diff and all Gate A validations pass again.

The reviewed correction subsequently passed `javac --release 21 -Xlint:all
-Werror`, the expanded preparation self-test, the wrong-input/no-output check,
the Node self-test and piped lifecycle integration, Rust formatting and four
native unit tests, locked `wasm32-wasip2` check and Clippy, and the locked
release WASM build. Applying it to the verified inputs then prepared 141 JDT LS
logical entries and one proxy entry. The generated synthetic bundle SHA-256 is
`65106d63528b71527319d2e67902821cdd752dedf563c565340977c19fd37540`.

One validation wrapper invocation stopped before the Node and Rust checks
because it assigned to zsh's read-only `status` variable. Renaming only that
wrapper variable to `result_code` allowed the unchanged validations to pass;
the interruption did not alter an artifact, extension, hypothesis input, or
runtime condition. No Java extension was installed and no Zed UI, JDT LS, Java
proxy, or S003 development extension runtime was started during preparation.

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
14. Stop the isolated instance, verify no probe, proxy, or JDT LS process
    remains, restore any input-source change made for automation, and reopen
    normal Zed. Remove the development-extension link and generated WASM unless
    the user explicitly directs that the reusable isolated environment remain.
15. Summarize observations and classify the result. Do not promote any spike
    code or private endpoint use into production code.

No retry may change artifact versions, Java-extension source, the synthetic
command, or the hook mechanism. One documented correction is allowed only for a
clear operator setup mistake such as an incorrect prepared absolute path.

### Gate B confirmed observations

Gate B ran on the local macOS 26.5.1 arm64 host on 2026-07-14 with Zed 1.10.3
build `20260713.002323` and SDKMAN Temurin JDK 25.0.3.

1. The isolated extension manager installed the official Java extension exactly
   at 6.8.21. The isolated directory contained the bundled HTML extension, Java
   6.8.21, and the S003 development extension. The user's normal extension
   directory remained unchanged with only its pre-existing HTML and Kotlin
   entries.
2. The Java extension launched the prepared Java proxy and pinned JDT LS
   1.60.0. JDT LS identified OSGi version `1.60.0.202606262232`, Git commit
   `57ed41b`, Java 25.0.3, macOS, and aarch64. No managed JDT LS, debugger,
   Lombok, or task-helper artifact appeared in the Java extension work area.
3. The final initial initialization options contained exactly two bundle paths:
   the fixed Java debug 0.53.2 bundle and the S003 synthetic bundle. Each path
   occurred once and no Spring Tools path was present.
4. JDT LS logged both fixed bundles as installed and started, then registered
   `s003.synthetic.ping` as a static command. Its initialize response advertised
   only that synthetic command in the initial execute-command capability. No
   bundle install, resolution, activation, linkage, or extension-point error was
   recorded.
5. Initial JDT LS initialization completed in approximately 6.636 seconds. One
   proxy-oracle request with an empty argument array returned an object
   structurally equal to `{"spike":"s003","value":"ok-v1"}`.
6. Zed's `editor: restart language server` command restarted both active Java
   language servers rather than presenting a per-server selector. It replaced
   the injector, proxy, and JDT LS processes. The replacement JDT LS initialize
   options again contained the debug and synthetic paths exactly once, with no
   Spring path; the response again advertised `s003.synthetic.ping` and
   initialization completed in approximately 3.452 seconds.
7. Exactly one post-restart proxy-oracle request returned the same fixed object.
   The second JDT log retained `s003.synthetic.ping` as a static command and
   recorded no bundle error. It did not repeat the first session's installed and
   started messages because the JDT configuration area persisted across the
   restart.
8. Process snapshots showed approximately 46 MiB RSS for the Node injector and
   2 MiB for the proxy in both sessions. JDT LS snapshots were approximately
   1,264 MiB before restart and 587 MiB after restart; these are point-in-time
   values, not steady-state memory claims.
9. The restart sent `shutdown` and `exit` to both adapters. The injector observed
   both and exited gracefully. JDT LS returned `{}` to shutdown, which Zed could
   not deserialize as a unit result, but the old proxy/JDT processes stopped and
   replacements initialized successfully. On final application shutdown, the
   injector observed and answered `shutdown` but did not record `exit` before
   process termination, consistent with the S001 lifecycle constraint.
10. After the run, no injector, proxy, or JDT LS process remained. The normal Zed
    application and the original input method were restored. At the user's
    explicit direction, the ignored isolated directory, Java 6.8.21 installation,
    and S003 development-extension link were retained to avoid repeated setup.

### Gate B inference and classification

The unchanged Java extension contributed the debug path, while the separately
installed S003 adapter was the only configured source of the synthetic path.
The final merged options, JDT installation/start records, static-command
advertisement, deterministic proxy result, and successful restart therefore
support the inference that Zed's cross-extension additional-initialization hook
can augment the Java extension's JDT LS bundle list without modifying the Java
extension or proxy.

The S003 hypothesis is **Supported for the tested macOS arm64 and JDK 25 tuple**.
This is feasibility evidence for the injection mechanism only, not a product or
multiplatform support decision.

### Gate B remaining runtime constraints

- Zed's UI restart command restarted both Java adapters, so this run does not
  show a UI path that restarts only `jdtls` while leaving the contributor adapter
  process intact. It does show replacement proxy/JDT initialization with a fresh
  contributor process and no duplicate bundle.
- JDT LS's `{}` shutdown result remains a protocol-shape incompatibility with
  Zed's expected unit result, although it did not prevent restart or attribution.
- Final application shutdown again did not let the Node probe observe `exit`
  before termination; S001 already established that graceful final exit cannot
  be required.
- Raw traces, screenshots, proxy response envelopes, process listings, and port
  data remain only in ignored local evidence. Committed text contains only the
  summarized observations above.

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

## Remaining blockers and constraints

- The Java proxy HTTP endpoint and port-file layout are explicitly private and
  served only as the S003 observation mechanism. They are not a supported
  integration contract.
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
