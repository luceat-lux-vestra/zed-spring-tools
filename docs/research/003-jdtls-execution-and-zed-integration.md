# R003: JDT LS execution and Zed integration

- Status: Complete
- Last updated: 2026-07-14
- Investigator: Codex
- Evidence baseline:
  - Eclipse JDT LS commit `e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d`
  - Zed Java extension commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`
  - Zed commit `96ce8f2a05f8912851e5d20d808fe21f4134bd45`
  - Spring Tools commit `0a141b2d0b669aa2d5caf4766481c29be6e99762`

## Question

Can the current Zed JDT LS integration load the Spring Tools JDT extension
bundles and provide the command and callback paths required by the Spring Boot
Language Server?

## Scope

Included:

- JDT LS launch and data-directory constraints;
- initialization options and extension bundle loading;
- delegate workspace commands and client callbacks;
- the current Zed Java extension's initialization behavior;
- the current native Java LSP proxy and side channel; and
- worktree/process implications relevant to Spring Tools.

Excluded:

- exhaustive JDT LS feature and settings documentation;
- Maven and Gradle import correctness across versions;
- actual Spring bundle loading under Zed;
- distribution and legal analysis; and
- selection of a production integration architecture.

## Confirmed facts

### JDT LS launch and workspace data

1. JDT LS is an Eclipse/OSGi Java process launched with a platform
   configuration and a `-data` directory.
2. Upstream documentation states that `-data` stores workspace-specific state and
   must be unique per workspace or project.
3. The current Zed Java extension requires a Java 21-or-newer runtime for its
   managed JDT LS path, locates or downloads JDT LS, and constructs the Equinox
   launch command.
4. The extension derives the `-data` directory from a SHA-1 hash of the Zed
   worktree root and places it under the platform cache directory.
5. Zed's LSP store keys a server instance using the worktree, server name,
   selected binary/initialization settings, and toolchain. The current managed
   JDT LS launch is therefore worktree-sensitive at both Zed process selection
   and JDT LS data-directory levels.

### JDT LS loads extension bundles from initialization options

1. JDT LS reads a top-level `bundles` collection from `initializationOptions`.
2. Its initialization handler calls `BundleUtils.loadBundles` before completing
   normal capability registration.
3. Bundle loading installs, refreshes, and starts the supplied OSGi bundles. A
   bundle load error is logged and does not intentionally prevent the base
   language server from continuing.
4. Spring Tools supplies JDT LS extension bundles specifically for this mechanism
   in its VS Code package.

### The current Zed Java extension preserves a bundles array

The Java extension constructs initialization options from user/worktree LSP
settings, adds default workspace and extended-client values, and injects its Java
debug bundle. Its debugger injection logic:

- uses an existing `bundles` array if present;
- appends the debugger bundle if it is absent; and
- errors if `bundles` has an incompatible JSON type.

Therefore, correctly formed Spring Tools bundle paths can coexist in the same
initialization array as the Java debug bundle.

### Zed can merge bundle paths from another registered adapter

R001 established the cross-adapter additional initialization hook. Current Zed
source merges JSON objects recursively and appends source arrays to target
arrays. Zed obtains the target adapter's initialization options, merges
additional options from other registered adapters, and then merges user override
initialization options.

A Spring adapter returning `{"bundles": [absolute paths...]}` for target
`jdtls` should therefore produce an additive bundle array at the JSON merge
layer. Availability across separately installed extensions and path validity
still require runtime verification.

### Spring's JDT LS commands are compatible with JDT LS extension points

1. JDT LS exposes the
   `org.eclipse.jdt.ls.core.delegateCommandHandler` extension point.
2. Its `workspace/executeCommand` handler discovers delegate handlers registered
   for a command and invokes the matching handler.
3. The Spring Tools JDT LS bundle registers its classpath, Java data, search,
   hierarchy, completion, and GAV commands through that extension point.
4. Consequently, if the Spring bundles load successfully, their commands are
   addressable through standard LSP `workspace/executeCommand` requests to JDT
   LS.

### JDT LS classpath callbacks use a non-standard client request

JDT LS defines `workspace/executeClientCommand` as a proposed client request. The
Spring classpath listener uses JDT LS's client connection to send a dynamically
generated callback command through this request. It waits for the client result.

This direction is different from calling Spring commands inside JDT LS:

- request into JDT LS: standard `workspace/executeCommand`;
- callback out of JDT LS: non-standard `workspace/executeClientCommand`.

### The current Zed Java proxy already provides a JDT LS request side channel

The current Zed Java extension does not launch JDT LS directly. It starts a
native `java-lsp-proxy`, which starts JDT LS and forwards stdio.

The proxy also:

1. opens a localhost HTTP server on an ephemeral port;
2. stores that port in the Java extension work directory using a key derived from
   the project root;
3. accepts an arbitrary LSP method and params in an HTTP POST;
4. writes a new JSON-RPC request to JDT LS;
5. intercepts the matching response before it reaches Zed; and
6. returns that response over HTTP.

The Java extension WASM currently uses this side channel for JDT LS workspace
commands needed by debugging and classpath resolution. The source describes the
mechanism as a temporary workaround for the extension API not being able to send
LSP requests directly.

This side channel could technically invoke Spring-provided delegate commands
after their bundles are loaded.

### The current proxy does not handle Spring's callback direction

The Java proxy forwards unrecognized JDT LS messages to Zed. Its special handling
is limited to response routing for its HTTP requests and selected Java URI,
completion, and documentation transformations.

No handling for `workspace/executeClientCommand`, Spring callback command IDs, or
`sts.*` methods exists at the inspected commit. Zed's public extension API also
does not expose a handler for arbitrary server requests.

As a result, current code provides a path **into** JDT LS but not the required
classpath callback path **out of** JDT LS to a Spring Boot LS coordinator.

## Primary sources

All sources were accessed on 2026-07-14.

### Eclipse JDT LS

Baseline commit: `e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d`.

- [JDT LS README](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d/README.md)
  — launch command, platform configuration, Java build requirement, and unique
  `-data` guidance.
- [`InitHandler.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/handlers/InitHandler.java)
  — initialization bundle loading.
- [`BundleUtils.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/handlers/BundleUtils.java)
  — install, refresh, start, and error behavior for extension bundles.
- [`WorkspaceExecuteCommandHandler.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/handlers/WorkspaceExecuteCommandHandler.java)
  — delegate command discovery and execution.
- [`ExecuteCommandProposedClient.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/lsp/ExecuteCommandProposedClient.java)
  — `workspace/executeClientCommand` protocol declaration.
- [`JavaClientConnection.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/e3bd5edfff4b34e1f8876b3d7db7ab57a31c127d/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/JavaClientConnection.java)
  — outbound client command execution.

### Zed Java extension

Baseline commit: `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`.

- [`src/jdtls.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls.rs)
  — managed launch, Java requirement, and hashed `-data` path.
- [`src/jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs)
  — initialization options and proxy command.
- [`src/debugger.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/debugger.rs)
  — additive debug bundle injection.
- [`src/lsp.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/lsp.rs)
  — extension-side HTTP-to-LSP request helper.
- [`proxy/src/main.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs)
  — JDT LS child process, stdio forwarding, HTTP side channel, and response
  interception.
- [`proxy/src/http.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/http.rs)
  — arbitrary method/params request forwarding.

### Zed merge and process behavior

Baseline commit: `96ce8f2a05f8912851e5d20d808fe21f4134bd45`.

- [`crates/project/src/lsp_store.rs`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/project/src/lsp_store.rs)
  — server seed and initialization merge order.
- [`crates/util/src/util.rs`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/util/src/util.rs)
  — recursive object merge and array append behavior.

### Spring Tools JDT extension

See R002 for the pinned Spring Tools command, classpath listener, and packaging
sources at commit `0a141b2d0b669aa2d5caf4766481c29be6e99762`.

## Inferences

### Bundle injection is likely feasible without forking the Java extension

The JSON merge behavior, the existing Java extension's additive bundle handling,
and JDT LS's supported `bundles` option form a credible path for a separate
Spring extension to inject absolute Spring Tools bundle paths into `jdtls`.

This depends on the cross-extension hook being called before JDT LS starts and on
the selected bundle set being compatible with the current JDT LS version.

### Synchronous Java-data requests may reuse the existing proxy side channel

A coordinator that can discover the current Java proxy port can send
`workspace/executeCommand` requests for `sts.java.type`, search, hierarchy,
completion, location, Javadoc, and GAV. These request/response operations align
with the proxy's existing arbitrary HTTP request facility.

Access control, port discovery across extension work directories, concurrency,
versioning, and ownership are not designed as a public inter-extension API, so
depending on the current port file directly would be fragile unless coordinated
with the Java extension maintainers.

### Classpath synchronization requires changing or replacing a process boundary

The missing callback path cannot be implemented with initialization JSON. A
viable full integration must place protocol-aware code where it can intercept
`workspace/executeClientCommand` before Zed responds with method-not-found.

The narrowest technical change appears to be extending the Java proxy to route
selected client commands to a coordinator. Other options are a coordinator that
owns JDT LS itself or a reduced mode that obtains project classpaths independently
and keeps JDT classpath listening disabled.

### Independent replacement of JDT LS would duplicate mature Zed Java behavior

Launching a second private JDT LS under a Spring coordinator would provide full
protocol ownership but would duplicate project import, cache, Java runtime,
debugger bundle, proxy transformations, server downloads, and resource usage.
That option is technically cleaner at the protocol boundary but operationally
expensive.

## Unverified hypotheses

1. Zed calls a Spring extension's additional-initialization hook for `jdtls`
   across extension boundaries before starting the Java server.
2. Absolute paths in another extension's work directory remain readable to the
   JDT LS process in local and remote worktrees.
3. The Spring Tools bundle set at one pinned version resolves and starts under
   the exact JDT LS build managed by the Zed Java extension.
4. Spring delegate commands remain visible through the existing Java proxy after
   bundle loading.
5. The current Java proxy port file can be safely discovered by a different
   extension or native helper without relying on unstable internal paths.
6. Zed sends method-not-found for `workspace/executeClientCommand` quickly enough
   to avoid a JDT LS deadlock when the Spring classpath listener is accidentally
   enabled without a coordinator.
7. Multiple worktrees can map each Spring LS instance to the correct Java proxy
   without collisions or stale port files.

## Runtime verification needed

1. Create a minimal second Java-targeting adapter that returns a pinned local test
   bundle in additional initialization options for `jdtls`.
2. Confirm from JDT LS logs and `workspace/executeCommand` that the bundle loaded
   and registered one command.
3. Repeat with the pinned Spring Tools bundle set and call a non-listener command.
4. Invoke the command both through Zed's normal LSP path and through the existing
   Java proxy HTTP side channel.
5. Register the Spring classpath listener and capture the exact
   `workspace/executeClientCommand` failure produced by current Zed.
6. Test one and two worktrees, server restarts, remote development, and stale
   proxy port cleanup.

## Blockers and constraints

- No supported public contract currently lets a separate extension use the Java
  extension's private proxy port file or HTTP endpoint.
- The callback direction is absent in both the public Zed extension API and the
  current Java proxy.
- Spring Tools bundles use JDT LS internal/extension APIs and require explicit
  compatibility testing for every pinned JDT LS/Spring Tools pair.
- Additional initialization options are relevant only if both adapters are
  registered and selected for the worktree; user server selection can alter this.
- The Java extension's managed server and proxy update policies can change
  independently of a future Spring extension unless versions are coordinated.
- Separate extension work directories and remote-host propagation may prevent
  naive local absolute-path assumptions.

## Candidate next experiments

1. **Synthetic bundle injection:** verify the complete cross-extension bundles
   path with a tiny JDT LS command bundle before using Spring artifacts.
2. **Pinned Spring command:** load the exact Spring bundle set and execute
   `sts.java.search.types` through the Java proxy side channel.
3. **Callback failure trace:** register a classpath listener without a bridge and
   capture the request, Zed response, timeout, and cleanup behavior.
4. **Proxy callback prototype:** in disposable spike code only, intercept one
   generated `workspace/executeClientCommand` callback and forward it to a mock
   Spring endpoint.

## Interim conclusion

The current Zed Java integration is closer to supporting Spring Tools than a
plain dual-LSP client would be. It already supports additive JDT LS bundles and
contains a native proxy with an arbitrary request side channel. These mechanisms
make Spring command injection and synchronous Java-data requests credible.

The remaining hard boundary is classpath/event callback routing. Current Spring
Tools requires JDT LS to call the client with `workspace/executeClientCommand`,
while current Zed and the public extension API provide no handler for that
request. R004 should compare architectures around this exact boundary rather
than broadly debating whether a bridge might be useful.

