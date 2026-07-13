# S001: Minimal Zed development-extension lifecycle

- Status: Refuted on macOS arm64 — Gate B complete
- Date: 2026-07-14
- Related research: R001, R004, R005
- Implementation state: Complete and tested in Zed; disposable spike retained
- Plan approved: 2026-07-14

## Hypothesis

Zed 1.10.3 can compile and install a local Rust development extension, start a
minimal Node stdio language-server process for a text fixture, complete LSP
initialization, and perform a graceful `shutdown`/`exit` sequence when the user
restarts that server.

## Why runtime verification is required

Source inspection establishes the intended extension and process lifecycle but
cannot prove that the installed Zed build, local Rust toolchain, worktree
environment, manifest, and child-process command work together on this machine.

S001 deliberately avoids JDT LS, Spring Tools, artifact downloads, Java project
import, and cross-server coordination. A failure should therefore identify a
problem in the Zed development-extension baseline rather than in the target
servers.

## Scope boundaries

Included:

- one disposable Rust extension using `zed_extension_api`;
- one dependency-free Node stdio LSP probe using the executable returned by
  Zed's Node API;
- one plain-text fixture;
- `initialize`, `initialized`, `textDocument/didOpen`, `shutdown`, and `exit`
  observations; and
- one user-triggered language-server restart.

Excluded:

- JDT LS, Spring Tools, VSIX extraction, and Java project analysis;
- a production extension manifest or product module;
- downloading or redistributing a language-server binary;
- completion, diagnostics, semantic tokens, or other product behavior; and
- multi-server or cross-extension coordination.

## Environment

Observed through Gate B:

| Component | Value | Relevance |
| --- | --- | --- |
| OS | macOS 26.5.1 (25F80), arm64 | Host baseline |
| Zed | 1.10.3, build `20260713.002323` | Test subject |
| rustup | Installed under `~/.cargo/bin` | Required by Zed dev-extension build |
| Rust stable | rustc/cargo 1.97.0 | Extension compiler after PATH cleanup |
| Shell-selected Cargo | `~/.cargo/bin/cargo` | rustup shim verified |
| Zed API-resolved Node | `/opt/homebrew/bin/node`, v26.5.0, darwin arm64 | Observed probe runtime |
| Java | Temurin JDK 25.0.3 via SDKMAN | Recorded for S002; not used by S001 |

The rustup toolchain now has `wasm32-wasip2` installed. Current Zed source uses
that target for development-extension builds.

The user's login-shell PATH now places `~/.cargo/bin` before Homebrew, so
`cargo`, `rustc`, and `rustup` resolve to one coherent rustup toolchain. The
foreground Zed launch used the same ordering and preserved application
diagnostic output.

Java 25 is suitable: the inspected Spring Tools launcher and JDT LS require Java
21 or newer. Because the SDKMAN JDK is not registered with
`/usr/libexec/java_home`, commands must prefer the worktree PATH or
`$JAVA_HOME/bin/java` rather than macOS Java discovery.

The multiplatform boundary and outstanding test-host requirements are defined in
[the prerequisite matrix](prerequisites.md). S001 first ran on the available
macOS aarch64 host. The same committed spike revision must run on Linux x86_64
and Windows x86_64 before its result is treated as representative OS evidence.

## Gate A artifacts

Gate A added only:

```text
spikes/s001-zed-lifecycle/
├── extension/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── extension.toml
│   └── src/lib.rs
├── fixture/probe.txt
└── probe/
    ├── probe_server.mjs
    └── probe_server.test.mjs
```

Runtime logs are written under the repository's ignored `tmp/` directory.
Rust `target/` output must remain untracked.

### Implemented extension behavior

- Register one spike-only language server against Zed's `Plain Text` language.
- Resolve the Node executable with `zed::node_binary_path()` rather than a
  user-installed `node`, Python, or platform shell.
- Start `probe_server.mjs` directly with an explicit JSONL log destination under
  `tmp/`; do not invoke a platform shell.
- Return no custom initialization options, workspace configuration, or product
  capabilities.

### Implemented probe behavior

- Parse LSP `Content-Length` framed messages from stdin with Node's built-in JSON
  implementation.
- Write timestamped lifecycle metadata to JSONL without copying document text or
  environment variables into the log.
- Respond to `initialize` with only basic text synchronization capability.
- Respond to `shutdown` with `null` and exit only after receiving `exit`.
- Never write non-LSP content to stdout; diagnostic messages go to stderr.
- Return a nonzero status for malformed framing or an unexpected EOF before the
  normal shutdown path.

## Procedure

Implementation and execution are separate review gates.

### Gate A: implementation, only after plan approval

Completed on 2026-07-14. The implementation remains disposable spike code.

1. Add the planned disposable files without adding product scaffolding.
2. Pin `zed_extension_api` to exact version `=0.7.0`, the version used by the
   inspected official Java extension; do not use a floating Git dependency.
3. Add ignore rules only for generated spike output such as `target/` and JSONL
   logs.
4. Syntax-check and run the dependency-free probe test with a local Node binary
   when available, then format/check the Rust crate with the rustup toolchain.
   The local Node binary is a development convenience, not an end-user
   prerequisite.
5. Review the resulting diff before installing anything into Zed.

### Gate B: local Zed execution, only after implementation review

Approved and executed on 2026-07-14. The exact local launch was:

```sh
PATH="$HOME/.cargo/bin:$PATH" /Applications/Zed.app/Contents/MacOS/cli \
  --foreground \
  --user-data-dir "$PWD/tmp/s001-zed-user-data" \
  "$PWD"
```

1. Close existing Zed processes so the foreground process receives the intended
   PATH.
2. Launch the installed Zed binary from a terminal with
   `~/.cargo/bin` before `/opt/homebrew/bin` and with `--foreground`.
3. Use `Install Dev Extension` and select the planned `extension/` directory.
4. Confirm the extension compilation succeeds and record any automatic
   `wasm32-wasip2` target installation in the observation log.
5. Open the repository and then `fixture/probe.txt`.
6. Confirm the JSONL trace records one `initialize` request, one `initialized`
   notification, and one `textDocument/didOpen` notification.
7. Invoke `editor: restart language server` from Zed's command palette for the
   probe buffer (`editor::RestartLanguageServer` in keymap notation).
8. Confirm the first process records `shutdown` followed by `exit`, and a new
   process records a second `initialize` sequence.
9. Inspect Zed's language-server and application logs for protocol or extension
   errors.
10. Remove the development extension and stop the foreground Zed process.
11. Record exact observations and classify the result as Supported, Refuted, or
    Inconclusive. Do not promote spike code to production code.

## Success criteria

All of the following must be observed:

1. The development extension compiles and appears as installed in Zed 1.10.3.
2. Opening the fixture starts exactly one probe process for the worktree.
3. The probe completes `initialize` and observes `initialized` and `didOpen`.
4. Restart produces `shutdown`, then `exit`, before the first process ends.
5. Restart creates a new probe process that completes initialization again.
6. Zed logs contain no framing, manifest, WebAssembly, or unhandled-method error
   attributable to the probe.

## Failure criteria

The hypothesis is refuted for this environment if any of these persists after
one documented correction of a configuration mistake:

- Zed cannot compile or install the minimal extension with the pinned API;
- the language-server command is never requested for the open fixture;
- Zed starts the process but does not send a valid `initialize` request;
- a correct initialize response is rejected;
- restart kills the process without the expected `shutdown`/`exit` sequence; or
- the second process cannot initialize after restart.

The result is Inconclusive if UI selection, an unrelated Zed crash, or an
uncontrolled existing process prevents attribution to the hypothesis.

## Safety and cleanup

- Do not change the user's default Java, Rust, Zed, or shell configuration.
- Do not install or remove the official Java extension during S001.
- Gate A added the `wasm32-wasip2` target to the existing rustup toolchain. Keep
  it for Zed development-extension builds and remove it only if the user requests
  cleanup.
- Do not store file content, environment values, credentials, or absolute home
  paths in committed logs.
- Keep all runtime output under ignored `tmp/` and remove the dev extension after
  observation.

## Observations

Gate A observations on macOS 26.5.1 arm64:

1. The initial WASM check reproduced the anticipated mixed-toolchain failure:
   rustup Cargo invoked Homebrew `rustc`, which could not find the rustup
   `wasm32-wasip2` standard library.
2. After the user placed `~/.cargo/bin` before Homebrew in the login-shell PATH,
   `cargo`, `rustc`, and `rustup` all resolved through rustup stable 1.97.0.
3. `wasm32-wasip2` is installed in that rustup toolchain.
4. The extension pins `zed_extension_api = "=0.7.0"` and has a generated
   `Cargo.lock` containing the resolved dependency graph.
5. `cargo fmt --check`, locked WASM `cargo check`, and locked WASM Clippy with
   warnings denied all passed.
6. A locked WASM build produced the expected extension artifact under ignored
   `target/` output.
7. Node syntax checks passed for the probe and its test.
8. The dependency-free Node test sent `initialize`, `initialized`,
   `textDocument/didOpen`, `shutdown`, and `exit`; it received both required
   responses, observed exit code 0, and confirmed a graceful stop.
9. The test confirmed that logged events contain no LSP params or document text.
10. Zed Node API resolution, manifest loading, and actual Zed process
    lifecycle remained unobserved until Gate B.

Gate B observations on the same host:

11. Zed registered the development extension as
    `s001-lifecycle-probe`, created a development-extension symlink in the
    isolated user-data directory, and produced `extension.wasm` in the spike
    extension directory. The generated WASM file was removed after the run and
    is now ignored.
12. Opening `spikes/s001-zed-lifecycle/fixture/probe.txt` started exactly one
    probe process for that run. The executable returned by
    `zed::node_binary_path()` was `/opt/homebrew/bin/node`; the process reported
    Node v26.5.0 on darwin arm64.
13. The first trace recorded `initialize`, a successful initialize response,
    `initialized`, `workspace/didChangeConfiguration`, and
    `textDocument/didOpen` in order.
14. One interrupted operator session ended before a restart was requested. Its
    trace remains in the ignored JSONL log and was not removed from the
    observation set.
15. In the completed restart run, process 51239 initialized successfully. Zed
    then sent request id 2 for `shutdown`, received the probe's `null` response,
    terminated that process, and started process 51748 approximately 52 ms after
    the shutdown response.
16. Process 51748 completed the same initialize/configuration/didOpen sequence.
17. The probe did not observe an `exit` notification during either the restart
    or a later normal Zed application quit. Consequently it could not record its
    graceful `stop` event; both processes disappeared after their successful
    `shutdown` responses.
18. The foreground application output contained unrelated Copilot and ChatGPT
    authentication messages, but no manifest, WebAssembly, framing,
    unhandled-method, or probe process error.
19. Runtime evidence remains at `tmp/s001-lifecycle-events.jsonl` in the local
    ignored workspace. It contains lifecycle metadata only: no message params,
    document text, environment values, or absolute paths.
20. The development-extension symlink was removed from the isolated user-data
    directory, the isolated Zed process was stopped normally, no probe process
    remained, and the user's normal Zed application was reopened.

## Post-run source follow-up

### Confirmed facts

- The Zed source revision used by the prior research,
  [`96ce8f2a05f8912851e5d20d808fe21f4134bd45`](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/lsp/src/lsp.rs#L1086-L1141),
  implements shutdown by waiting up to five seconds for the `shutdown`
  response, enqueueing `exit`, closing the notification channel, waiting for
  its outgoing writer to finish, and then calling `child.kill()`.
- In the same file, the outgoing writer flushes each framed message and signals
  completion after its channel closes. That completion establishes that Zed
  finished writing; it does not acknowledge that the child read or processed
  the message.
- Upstream `main` at
  [`a21e87c07711e2afa5169cc6d25cf9a0649b7183`](https://github.com/zed-industries/zed/blob/a21e87c07711e2afa5169cc6d25cf9a0649b7183/crates/lsp/src/lsp.rs)
  retained the same shutdown sequence when checked on 2026-07-14.
- The [LSP 3.17 shutdown specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#shutdown)
  requires the client to send `exit` after the server responds to `shutdown`.
  S001's probe was designed to record when the server actually receives that
  notification.

### Inference

The immediate child termination request after Zed flushes `exit` creates a race:
the operating system may accept the pipe write while the child has not yet
scheduled and processed the message. That source sequence is consistent with
both runtime attempts ending after `shutdown` without a probe-observed `exit`,
but the trace alone cannot prove the exact scheduler timing.

### Unverified hypothesis

Another server or host may process `exit` within the timing window. S001 does
not establish that `exit` is never observable, only that integrations cannot
rely on observing it before termination. Whether Zed maintainers consider the
current sequencing intentional or defective was not verified.

### Constraint for later spikes

Server processes must finish essential cleanup before replying to `shutdown`.
S002 and later procedures must record `exit` if observed but must not depend on
it for correctness or classify its absence as a Spring-specific failure.

## Result

**Refuted on macOS 26.5.1 arm64 with Zed 1.10.3.** The exact hypothesis required
all success criteria, including `shutdown` followed by `exit`. Zed successfully
compiled and installed the extension, started and initialized the probe,
delivered `shutdown`, and initialized a replacement process. However, the probe
did not observe `exit` before Zed terminated either the restarted server or the
server present at normal application quit.

This result supports the narrower development-extension and process-restart
baseline on this one host. It does not support a graceful LSP termination claim
and does not establish multiplatform behavior.

## Remaining uncertainty

This local result does not establish:

- coexistence with the official Java extension;
- Java/JDK discovery or Spring LS startup on Java 25;
- VSIX download or extraction through the extension API;
- JDT bundle injection or custom Spring request handling; or
- production behavior on Linux, Windows, or multiple worktrees. Remote
  development is intentionally deferred and is not an S001 success condition.

Source inspection confirms that both the tested revision and current upstream
enqueue `exit` and then request child termination immediately after the client
writer finishes. Maintainer intent remains unknown, but integration behavior is
no longer blocked on that answer: a real server must tolerate termination after
its successful `shutdown` response and must not rely on processing `exit` for
essential cleanup.

## Next experiment

Write and review the S002 plan: launch the pinned Spring LS artifact with JDT
classpath integration disabled and measure which standard-LSP behavior remains.
The plan must carry forward the confirmed Zed shutdown constraint above and
must keep Java discovery, artifact selection, and runtime evidence explicit.

## Reusable findings

For local development, invoking rustup Cargo is insufficient if Cargo still finds
a Homebrew `rustc` first. The PATH must resolve all three Rust commands through
one rustup toolchain. This is a development-environment finding, not product
behavior.

`zed::node_binary_path()` returned the existing Homebrew Node executable on this
host. The extension remained independent of a hard-coded Node path, but this run
does not prove what the API returns on a host without a preinstalled Node.

## Gate B approval record

The reviewer approved execution on 2026-07-14 after accepting:

- the Gate A implementation diff;
- the `Plain Text` target instead of Java for this baseline;
- the dependency-free probe using Zed's Node executable API;
- the explicit foreground Zed launch with rustup-first PATH;
- the Gate B procedure and success/failure criteria above.
