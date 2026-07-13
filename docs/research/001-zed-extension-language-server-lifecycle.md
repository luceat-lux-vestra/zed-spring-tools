# R001: Zed extension language-server lifecycle

- Status: Complete
- Last updated: 2026-07-14
- Investigator: Codex
- Evidence baseline:
  - Zed `main` commit `96ce8f2a05f8912851e5d20d808fe21f4134bd45`
  - Zed Java extension commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`
  - published `zed_extension_api` documentation version `0.7.0`

## Question

What lifecycle, configuration, process, and multi-server facilities does Zed
currently expose to a language-server extension, and which constraints affect a
possible JDT LS plus Spring Tools Language Server integration?

## Scope

Included:

- local development and extension activation;
- language-server registration and selection;
- server command, initialization, configuration, process, and shutdown flow;
- worktree context;
- downloads, extension capabilities, logging, and platform data;
- coexistence with the current Java extension; and
- public extension API surfaces relevant to coordination.

Excluded:

- JDT LS protocol and workspace behavior, except where the existing Java
  extension demonstrates Zed integration;
- Spring Tools Language Server internals;
- runtime verification inside Zed; and
- a product architecture decision.

## Confirmed facts

### Extension structure and execution environment

1. A Zed extension is a Git repository with an `extension.toml` manifest.
2. A language-server extension requires custom Rust code. Procedural extension
   code is compiled to WebAssembly.
3. A development extension can be installed from a local directory through
   `Install Dev Extension`.
4. Extension `stdout` and `stderr` are forwarded to the Zed process. The official
   development documentation recommends `zed: open log` and launching Zed with
   `zed --foreground` for troubleshooting.
5. The published Rust extension API exposes the current OS and architecture,
   file download helpers, executable permission changes, GitHub release helpers,
   language-server installation status, worktree environment access, and PATH
   lookup.

### Language-server registration and selection

1. An extension registers a language server in `extension.toml` and associates
   it with one or more Zed language names.
2. One extension may provide any number of language servers.
3. Multiple installed extensions may register language servers for the same
   language. Zed lets users order, include, and exclude those servers with the
   per-language `language_servers` setting.
4. When a server is selected, Zed asks its extension for a `Command` containing
   the executable, arguments, and environment through
   `language_server_command`.
5. The extension can separately return JSON initialization options and workspace
   configuration for each registered server and worktree.

### Cross-adapter configuration hooks

The public `Extension` trait includes:

- `language_server_additional_initialization_options`, and
- `language_server_additional_workspace_configuration`.

Each method receives the extension's own language-server ID, a target
language-server ID, and the worktree. The API documentation describes these as
options to pass to the other language server.

Zed's current `LspStore` implementation obtains a target adapter's own
initialization or workspace configuration, iterates over the other registered
LSP adapters, asks each for additional configuration targeting that adapter,
and merges returned JSON into the target configuration.

This is direct source evidence that one registered adapter can contribute JSON
configuration to another registered adapter. It does not by itself prove that
the hook satisfies the Spring Tools integration protocol.

### Worktree and server instance context

1. Language-server extension callbacks receive a `Worktree` exposing an ID,
   root path, text-file reads, shell environment, and executable lookup.
2. In current Zed source, a language-server seed includes worktree ID, server
   name, binary settings, initialization settings, and selected toolchain.
3. Zed reuses the server represented by an existing seed and otherwise starts a
   new server. Therefore, the observable server identity is worktree-sensitive,
   rather than being one unconditional global process for all open projects.
4. Zed waits for a worktree requiring trust to become trusted before starting
   its language server.

### Process ownership and shutdown

1. The extension returns a command; Zed's LSP implementation starts the process
   with the worktree path as its working directory and connects piped stdin,
   stdout, and stderr.
2. Zed marks the child process for termination when its process handle is
   dropped.
3. Normal shutdown is owned by Zed: it sends the LSP `shutdown` request, then the
   `exit` notification, waits for output completion, and kills the remaining
   child process. Dropping the Zed `LanguageServer` also starts that shutdown
   path.
4. Zed exposes user- and project-driven stop and restart paths and clears
   diagnostics and other per-server state when a server is removed.

These facts mean a basic stdio LSP server does not require the extension WASM
code to implement its own child-process lifetime manager.

### Downloads, capabilities, and publishing

1. Published extensions that provide a language server must not include the
   language-server binary in the extension. Official guidance requires the
   extension to download it or locate it in the user's environment.
2. The extension download API writes within the extension working directory.
3. Sensitive extension operations are capability-controlled. For example,
   `process:exec` controls commands invoked through the extension process API,
   and `download_file` can be restricted by host and path.
4. Users can reduce or remove granted extension capabilities, which can make an
   extension's installation or probing flow fail.
5. The current Zed Java extension demonstrates managed downloads, user-provided
   paths, worktree PATH lookup, platform-specific artifacts, and language-server
   installation status reporting.

### Current Java extension coexistence baseline

1. Java support is currently provided by the `zed-extensions/java` extension,
   which registers `jdtls` for the `Java` language.
2. At the inspected commit, the extension version is `6.8.21` and its
   `language_server_command` delegates to a JDT LS server implementation.
3. The Java extension returns initialization options containing a default
   worktree `workspaceFolders` entry and selected extended client capabilities.
4. The command returned to Zed starts a downloaded native `java-lsp-proxy`, which
   then wraps the actual JDT LS command.
5. The Java extension documents that this proxy supports features such as debug
   class resolution and classpath queries. Its source also rewrites selected LSP
   messages and URIs.

The existing Java extension is therefore not merely a direct `java -jar` JDT LS
launcher. Any design that assumes direct ownership of JDT LS must account for
the current proxy and extension behavior.

## Primary sources

All sources were accessed on 2026-07-14.

### Official documentation and published API

- [Developing Extensions](https://zed.dev/docs/extensions/developing-extensions)
  — manifest, local installation, Rust/WebAssembly, logging, publishing, and
  language-server binary rules.
- [Language Extensions](https://zed.dev/docs/extensions/languages) — server
  registration, command callbacks, and multiple servers.
- [Configuring Languages](https://zed.dev/docs/configuring-languages) —
  multi-server ordering and LSP settings.
- [Extension Capabilities](https://zed.dev/docs/extensions/capabilities) —
  capability enforcement and restrictions.
- [`zed_extension_api` 0.7.0](https://docs.rs/zed_extension_api/0.7.0/zed_extension_api/)
  — published API baseline.
- [`Extension` trait 0.7.0](https://docs.rs/zed_extension_api/0.7.0/zed_extension_api/trait.Extension.html)
  — command, configuration, and cross-adapter hooks.
- [`Worktree` 0.7.0](https://docs.rs/zed_extension_api/0.7.0/zed_extension_api/struct.Worktree.html)
  — worktree data exposed to extensions.

### Zed upstream source

Baseline commit: `96ce8f2a05f8912851e5d20d808fe21f4134bd45`.

- [`crates/extension_api/src/extension_api.rs`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/extension_api/src/extension_api.rs)
  — extension-facing methods. The crate in this source revision declares version
  `0.8.0`, newer than the inspected published API documentation.
- [`crates/extension/src/extension.rs`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/extension/src/extension.rs)
  — host-side extension interface and work directory.
- [`crates/project/src/lsp_store.rs`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/project/src/lsp_store.rs)
  — worktree-sensitive server identity, configuration merge, startup, stop, and
  restart behavior.
- [`crates/lsp/src/lsp.rs`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/lsp/src/lsp.rs)
  — child process creation, stdio, initialization, shutdown, and kill behavior.

### Zed Java extension

Baseline commit: `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`.

- [`extension.toml`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/extension.toml)
  — JDT LS registration and declared capabilities.
- [`src/java.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/java.rs)
  — extension callbacks.
- [`src/jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs)
  — proxy command and JDT LS options.
- [`proxy/src/main.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs)
  — native JDT LS proxy and message handling.
- [Java extension README](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/README.md)
  — configuration, proxy role, development, and remote behavior.

## Inferences

### A separate Spring language-server extension is structurally plausible

Zed supports multiple servers targeting the same language, and user settings can
keep both `jdtls` and another Java-targeting server enabled. This makes a separate
Spring language-server extension structurally plausible without immediately
forking the Java grammar extension.

This does not yet prove correct Spring behavior, absence of diagnostic conflicts,
or acceptable startup order.

### Extension-provided JSON augmentation may help configure JDT LS

The cross-adapter hooks may allow a Spring-related adapter to add initialization
or workspace JSON to `jdtls`. This could avoid duplicating some Java extension
logic if Spring Tools only needs configuration merged into JDT LS.

The exact merge shape, adapter selection rules, collision precedence, and whether
the required Spring information is expressible as JSON remain unverified.

### A native proxy or coordinator is likely required for message mediation

The public extension trait exposes commands and configuration but no generic API
for intercepting, rewriting, forwarding, or registering handlers for arbitrary
LSP messages. Zed itself owns the stdio connection. The current Java extension
uses a native proxy where message mediation is needed.

Therefore, if Spring Tools requires non-standard client handlers, direct JDT LS
message access, socket discovery, or bidirectional server-to-server mediation, a
native proxy/coordinator is likely necessary. This remains an inference until the
Spring Tools execution model is investigated.

### Process startup order is not an extension-controlled primitive

An extension can return commands and configuration, but the inspected public API
does not expose a general dependency declaration such as “start server B only
after server A is initialized.” If Spring Tools requires deterministic ordering,
that requirement may need to be handled by server behavior, a wrapper process,
or a coordinator rather than by the extension manifest alone.

## Unverified hypotheses

1. A separate extension can register a Spring server against the `Java` language
   supplied by the installed Java extension without duplicating Java language
   assets.
2. Zed starts both selected Java-targeting servers for one Java buffer and sends
   the expected document lifecycle notifications to both.
3. Cross-adapter additional options work across two separately installed
   extensions, not only between adapters from one extension.
4. The additional-options merge order is stable enough to safely modify JDT LS
   initialization without a conflicting user setting.
5. Zed's current built-in handlers cover every non-standard server-to-client
   request Spring Tools needs.
6. Stopping or restarting one of two Java-targeting servers does not unexpectedly
   stop or reset the other.
7. Server commands and downloaded artifacts behave the same way in local and SSH
   remote worktrees for a new extension.

## Runtime verification needed

1. Install the current Java extension and a minimal second dev extension that
   registers a no-op/test LSP for `Java`.
2. Confirm both servers appear in Zed's server controls and receive
   `initialize`, `initialized`, document open/change, `shutdown`, and `exit`.
3. Record process count and worktree association for one root, multiple roots,
   and multiple project roots within one worktree.
4. Have the second extension return additional initialization and workspace JSON
   targeting `jdtls`; capture the final values received by a test target or proxy.
5. Test user server ordering, exclusion, stop, and restart independently.
6. Send a custom server-to-client request from the test server and record Zed's
   response and logs.
7. Verify where extension logs, language-server stderr, protocol logs, and launch
   failures are visible to the user.

## Blockers and constraints

- The Spring Tools server protocol has not been inspected, so the importance of
  Zed's missing generic message-interception API is not yet known.
- The current Zed `main` extension API crate is version `0.8.0`, while docs.rs
  served `0.7.0` as the latest published version during this investigation.
  Spike code must pin a compatible version rather than assume `main` APIs are
  available in released Zed.
- Existing Java support already owns `jdtls` launch configuration and inserts a
  native proxy. Replacing, wrapping, or augmenting it has compatibility and
  maintenance implications.
- Users can disable one or more registered language servers or restrict extension
  capabilities, so a design cannot assume both servers always launch.
- Published extensions cannot bundle language-server binaries, making download,
  user-installation discovery, version pinning, integrity, and offline behavior
  product concerns if the project proceeds.
- The extension API does not expose a general-purpose UI surface for presenting
  a custom server manager; user-visible failures will likely need to fit existing
  installation status, errors, and logs unless future research finds another
  supported surface.

## Candidate next experiments

Do not implement these before R002 and R003 narrow the required behavior.

1. **Dual-adapter lifecycle harness:** a minimal second Java-targeting LSP that
   logs lifecycle messages alongside the current Java extension.
2. **Cross-extension option injection:** return a unique JSON marker for `jdtls`
   through both additional-options hooks and observe the final JDT LS input.
3. **Custom request probe:** make a test server send one unknown request to Zed
   and record the response.
4. **Independent restart probe:** restart each Java-targeting server separately
   and observe process and document state.

## Interim conclusion

Zed has enough public surface to register and run multiple standard stdio LSP
servers for Java, pass per-worktree initialization and configuration, and let one
registered adapter contribute JSON configuration to another. Zed itself owns the
normal child-process and LSP shutdown lifecycle.

The principal client-side risk is not basic dual-server launch. It is any Spring
Tools dependency on custom message handling, direct coordination with JDT LS, or
deterministic inter-server startup. The public extension API does not expose
generic LSP interception or server dependency orchestration, and the existing
Java extension already uses a native proxy for behaviors outside the simple
command/configuration path. R002 should therefore determine the Spring Tools
execution and protocol model before any Zed extension spike is written.

