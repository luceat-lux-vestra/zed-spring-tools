# S001: Minimal Zed development-extension lifecycle

- Status: Gate A approved
- Date: 2026-07-14
- Related research: R001, R004, R005
- Implementation state: Not started
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
- one dependency-free Node stdio LSP probe using Zed's managed Node binary;
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

Observed before implementation:

| Component | Value | Relevance |
| --- | --- | --- |
| OS | macOS 26.5.1 (25F80), arm64 | Host baseline |
| Zed | 1.10.3, build `20260713.002323` | Test subject |
| rustup | Installed under `~/.cargo/bin` | Required by Zed dev-extension build |
| Rust stable | rustc/cargo 1.96.1 | Planned extension compiler |
| Shell-selected Cargo | `/opt/homebrew/bin/cargo` | Must not be used by Zed for this spike |
| Zed-managed Node | Path/version not yet observed | Planned probe runtime; resolved through extension API |
| Java | Temurin JDK 25.0.3 via SDKMAN | Recorded for S002; not used by S001 |

The rustup toolchain does not yet have `wasm32-wasip2` installed. Current Zed
source uses that target and attempts to install it with rustup when needed.

The Zed process must be launched with `~/.cargo/bin` before Homebrew in `PATH` so
that `cargo`, `rustc`, and `rustup` resolve to one coherent rustup toolchain. The
foreground launch also preserves extension diagnostic output.

Java 25 is suitable: the inspected Spring Tools launcher and JDT LS require Java
21 or newer. Because the SDKMAN JDK is not registered with
`/usr/libexec/java_home`, commands must prefer the worktree PATH or
`$JAVA_HOME/bin/java` rather than macOS Java discovery.

The multiplatform boundary and outstanding test-host requirements are defined in
[the prerequisite matrix](prerequisites.md). S001 will first run on the available
macOS aarch64 host, then use the same committed spike revision on Linux x86_64
and Windows x86_64 before its result is treated as representative OS evidence.

## Planned disposable artifacts

No artifact in this section exists yet. Implementation would add only:

```text
spikes/s001-zed-lifecycle/
├── extension/
│   ├── Cargo.toml
│   ├── extension.toml
│   └── src/lib.rs
├── fixture/probe.txt
└── probe/probe_server.mjs
```

Runtime logs would be written under the repository's ignored `tmp/` directory.
Rust `target/` output must remain untracked.

### Planned extension behavior

- Register one spike-only language server against Zed's `Plain Text` language.
- Resolve the Node executable with `zed::node_binary_path()` rather than a
  user-installed `node`, Python, or platform shell.
- Start `probe_server.mjs` directly with an explicit JSONL log destination under
  `tmp/`; do not invoke a platform shell.
- Return no custom initialization options, workspace configuration, or product
  capabilities.

### Planned probe behavior

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

1. Add the planned disposable files without adding product scaffolding.
2. Pin `zed_extension_api` to exact version `=0.7.0`, the version used by the
   inspected official Java extension; do not use a floating Git dependency.
3. Add ignore rules only for generated spike output such as `target/` and JSONL
   logs.
4. Syntax-check the probe with a local Node binary when available and
   format/check the Rust crate with the rustup toolchain. The local Node binary
   is a development convenience, not an end-user prerequisite.
5. Review the resulting diff before installing anything into Zed.

### Gate B: local Zed execution, only after implementation review

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
7. Invoke Zed's `editor::RestartLanguageServer` command for the probe buffer.
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
- Zed may add the `wasm32-wasip2` target to the existing rustup toolchain; record
  this before/after state and remove it only if the user requests cleanup.
- Do not store file content, environment values, credentials, or absolute home
  paths in committed logs.
- Keep all runtime output under ignored `tmp/` and remove the dev extension after
  observation.

## Observations

Not started. This section remains empty until both review gates are approved.

## Result

Not run.

## Remaining uncertainty

Even a Supported result will not establish:

- coexistence with the official Java extension;
- Java/JDK discovery or Spring LS startup on Java 25;
- VSIX download or extraction through the extension API;
- JDT bundle injection or custom Spring request handling; or
- production behavior on Linux, Windows, or multiple worktrees. Remote
  development is intentionally deferred and is not an S001 success condition.

## Next experiment

If Supported, proceed to S002: launch the pinned Spring LS artifact with JDT
classpath integration disabled and measure which standard-LSP behavior remains.

If Refuted, resolve the Zed extension/toolchain baseline before adding any
Spring-specific variable.

## Reusable findings

None yet. Findings will be added only from recorded runtime evidence.

## Review checklist

Implementation must not begin until the reviewer accepts:

- the `Plain Text` target instead of Java for this baseline;
- the dependency-free probe using Zed's managed Node binary;
- the explicit foreground Zed launch with rustup-first PATH;
- possible installation of the `wasm32-wasip2` rustup target; and
- the success/failure criteria above.
