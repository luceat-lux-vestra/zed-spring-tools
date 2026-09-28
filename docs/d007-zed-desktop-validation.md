# D007 isolated Zed desktop validation

## One-shot macOS gate

The normal gate automates dev-extension installation. The manual-install
variant below is retained only as a diagnostic fallback if macOS Accessibility
itself is unavailable:

```bash
HEAD_SHORT="$(git rev-parse --short=7 HEAD)"
ROOT="$PWD/tmp/d007-zed-$HEAD_SHORT"

node scripts/d007-zed-desktop-validation.mjs \
  --run-macos-manual-install \
  "$HOME/Library/Application Support/Zed" \
  "$ROOT" \
  "$JAVA_HOME"
```

The harness launches the isolated Zed instance, prints the exact checkout path,
and waits up to ten minutes while the user runs `zed: install dev extension`
inside that isolated window and selects that exact directory. It does not accept
manual copies or index edits: continuation still requires Zed itself to produce
a fresh non-empty `extension.wasm` and register `spring-tools` in the isolated
extension index. Once those two conditions are observed, the Maven/Gradle desktop
validation continues automatically.

## One-shot macOS gate

For the normal exact-final-HEAD validation, prefer the one-shot runner:

```bash
HEAD_SHORT="$(git rev-parse --short=7 HEAD)"
ROOT="$PWD/tmp/d007-zed-$HEAD_SHORT"

node scripts/d007-zed-desktop-validation.mjs \
  --run-macos \
  "$HOME/Library/Application Support/Zed" \
  "$ROOT" \
  "$JAVA_HOME"
```

It performs the following bounded sequence:

1. stages a fresh isolated profile and both build-tool fixtures;
2. records the current shared `~/Library/Logs/Zed/Zed.log` byte boundary;
3. launches the Maven fixture through **one foreground macOS Zed CLI process** bound to the exact staged `--user-data-dir`; that launch opens only the fixture root, avoiding any dependence on multi-path tab ordering;
4. waits until the new launch process group contains a live Zed app process bound to that isolated profile, removes any ignored stale root `extension.wasm`, dispatches Zed's public `zed::InstallDevExtension` action directly, then drives its `OpenPathPrompt` with the exact repository directory and requires Zed itself to build/register the exact checkout;
5. after that first launch, never invokes a second macOS Zed CLI to focus a file. The isolated D007 keymap opens Zed's public `file_finder::Toggle`, and the harness pastes the exact absolute fixture path so File Finder takes its explicit absolute-path resolver rather than fuzzy relative-path ranking;
6. because File Finder search is asynchronous, the harness does not send a blind Enter after a fixed delay. It repeatedly dispatches public `file_finder::OpenWithoutDismiss`, which is a safe no-op while no match exists; once coordinator evidence proves `textDocument/didOpen` for the exact target URI, one public `menu::Confirm` focuses that already-proven selected editor and dismisses the picker;
7. for `application-d007.properties:1:4`, the gate then requires coordinator startup and a positive `spring/index/updated`, invokes completion on the already-proven editor, and accepts only the exact URI at line 0 / character 3 with a correlated Spring response containing `server.port`;
8. opens `src/main/java/dev/zed/spring/fixture/FixtureApplication.java` through File Finder, toggles Code Actions, and accepts the editor only when the merged response contains `Spring Boot: Configure run/debug for a project…`;
9. dispatches the exact returned Code Action index through D007's `editor::ConfirmCodeAction { item_ix }` binding, then requires coordinator evidence for the actual `zed-spring-tools.configure-boot-run` command;
10. verifies the Java source SHA-256 is unchanged, waits for both generated `.zed/debug.json` and `.zed/tasks.json` **without re-dispatching the command**, and machine-checks the Java launch contract plus Maven `mvn spring-boot:run` or Gradle `./gradlew bootRun`;
11. stops the Maven isolated process group with bounded `SIGTERM`/optional `SIGKILL`, then repeats the same **single-foreground-process + public exact-file navigation** gate independently for the Gradle fixture;
12. records coordinator lifecycle events, harvests only post-boundary shared Zed log bytes, checks retired private-boundary markers, and writes `evidence/desktop-gate.json` plus `evidence/summary.json`.

A final `PASS` requires both Maven and Gradle run/debug configuration
generation, the expected Java launch entry and build-tool run task for each fixture,
no retired private-boundary marker, and coordinator protocol evidence proving
the completion request, correlated Spring response, and `server.port` item.
D007 enables this evidence only in the isolated launch environment; the
coordinator writes the bounded JSONL trace to
`<fixture>/.d007/coordinator-protocol.jsonl`. Normal extension runs do not
create this file. Before completion, target-readiness failures are classified as
`completion-target-document-not-opened`, `completion-coordinator-not-started`, or
`completion-spring-index-not-ready`. If completion itself cannot be proven, the fixture records one of
`completion-request-not-observed`,
`completion-request-target-mismatch`,
`completion-response-not-observed`,
`completion-response-target-mismatch`, or
`completion-response-missing-server-port` in
`evidence/<fixture>-completion-failure.json` together with a bounded runtime
tail. The gate never loops indefinitely. It intentionally avoids secondary macOS
Zed CLI invocations after the foreground fixture launch: upstream macOS CLI
requests are delivered through LaunchServices and a later `--user-data-dir`
argument is not a reliable routing key for selecting the already-running
isolated process. File identity is therefore selected inside that exact Zed process through the
public `file_finder::Toggle` action with the exact absolute fixture path. The
coordinator still proves the resulting LSP request URI/position, so an incorrect
picker result cannot silently satisfy the gate. Completion is dispatched directly
through the isolated keymap rather than reopening the command palette, so palette
focus cannot masquerade as editor focus. The Code Actions popover is treated as a
selection list, not a searchable input. The isolated profile gets D007-only bindings for `file_finder::Toggle`,
`file_finder::OpenWithoutDismiss`, `menu::Confirm`, `editor::ShowCompletions`,
`editor::ToggleCodeActions`, and indexed `editor::ConfirmCodeAction` actions.
The Properties picker query is the exact absolute fixture path plus `:1:4`, so the public File Finder action owns both exact-file selection and cursor placement. `OpenWithoutDismiss` is retried only while the picker remains focused; exact `didOpen` proves that its selected match really opened before the single `menu::Confirm` transfers focus to that editor. The gate does not send completion until that exact URI and a positive Spring index update are observed.
The harness waits for coordinator evidence that the configure action exists and
uses the exact returned item index. If the menu has not been materialized yet,
Zed's `ConfirmCodeAction` handler returns `None`, so bounded retries are
safe no-ops instead of editor text input. It never types the action title, and
the Java source digest must remain unchanged. Screenshot-only evidence is never
promoted to PASS. If a phase throws, the harness
records `evidence/gate-failure.json` with the exact phase before cleanup. A
cleanup problem is recorded separately and never replaces the primary failure.

This is the exact-final-HEAD desktop gate for the standalone Spring runtime
selected by D007. It replaces the retired JDT/private-bridge desktop procedures
for release acceptance.

The harness intentionally reuses only the **installed official Java extension**
from a known local Zed profile. It never copies or reads that extension's
`extensions/work/java` directory, proxy routes, helper binaries, or other
private runtime state.

## 1. Stage a fresh isolated profile

Run from the exact candidate checkout:

```bash
HEAD_SHORT="$(git rev-parse --short=7 HEAD)"
ROOT="$PWD/tmp/d007-zed-$HEAD_SHORT"

node scripts/d007-zed-desktop-validation.mjs \
  --stage \
  "$HOME/Library/Application Support/Zed" \
  "$ROOT" \
  "$JAVA_HOME"
```

The root must be a fresh direct child of this repository's `tmp/` directory
whose basename begins with `d007-zed-`.

The command records:

- exact source HEAD and clean-tree state;
- official Java extension version;
- runtime JDK version;
- isolated Zed profile/XDG paths;
- Maven and Gradle fixture copies and their tree hashes; and
- the retired private-boundary markers that must not appear in accepted
  evidence.

The generated profile enables LSP tracing for general diagnostics, disables AI and extension updates,
uses `jdtls` plus `spring-tools` for Java, and routes Properties/YAML directly
to `spring-tools`.

## 2. Launch isolated Zed

The harness owns the isolated launch and captures foreground output:

```bash
node scripts/d007-zed-desktop-validation.mjs \
  --launch-macos \
  "$ROOT" \
  maven
```

It launches the standard macOS Zed CLI with the staged `--user-data-dir`, XDG
roots and Maven worktree, then records the launcher/process-group leader PID,
exact user-data directory, worktree, and foreground log under `evidence/`.
Readiness is established from `ps`: the same process group must contain a live
Zed app binary with that exact `--user-data-dir`. Foreground log output is
diagnostic only and is not a Zed-process readiness oracle. Spring runtime
readiness is separate: after the dev extension is installed, the harness opens a
Properties probe first, then requires post-activation log-delta evidence that Zed
started a language-server process whose arguments include the pinned standalone
Spring Boot LS artifact. Shutdown validation also uses
`ps` process state, so an unreaped zombie created while the synchronous harness
is polling counts as stopped. Pass an explicit Zed CLI path as a fourth argument only
when the application is installed elsewhere.

Do not reuse a normal Zed process for this gate.

## 3. Install the exact checkout as a development extension

The harness can issue the existing Zed UI action on macOS:

```bash
node scripts/d007-zed-desktop-validation.mjs \
  --install-dev-extension-macos \
  "$ROOT"
```

This dispatches the public `zed::InstallDevExtension` action directly through the isolated D007 keymap; it does not search for the action through Command Palette. Zed then uses an in-editor `OpenPathPrompt` rather than a native macOS file chooser. The harness enters the exact absolute repository path with a trailing separator, making that directory itself the prompt's current-directory candidate instead of relying on fuzzy ranking.

`OpenPathPrompt` populates candidates asynchronously and its `confirm()` is a no-op when no selected candidate exists. The harness therefore does not use a one-shot Enter after a fixed delay. It performs bounded confirm attempts and stops immediately when Zed emits `compiling Rust extension <exact repository>`, which proves that the prompt resolved and `install_dev_extension` actually started. It then waits separately for the fresh `extension.wasm` and isolated extension-index registration. Accessibility failure, failure to start installation, compilation failure, and registration timeout are recorded independently in `evidence/dev-extension-install.json` / `evidence/dev-extension-readiness-failure.json`. Do not treat UI-driving failure as product failure.

Zed still owns compilation/installation of the development extension. The
harness does not synthesize Zed's extension state.

## 4. Maven gate

Open the staged Maven fixture and require:

1. Spring standalone LS starts successfully.
2. `application.properties` receives authentic Spring completion/diagnostics.
3. Java Spring-aware intelligence is present in addition to ordinary JDT
   behavior.
4. `Spring Boot: Configure run/debug for a project…` discovers the fixture.
5. No runtime evidence contains `work/java`, `java/proxy`,
   `java-lsp-proxy`, or `zed.spring.bridge`.

The fixture deliberately contains `ser` and `server.port` for property
language-intelligence checks.

## 5. Gradle gate

Stop the Maven run and relaunch the same isolated profile against the Gradle
fixture:

```bash
node scripts/d007-zed-desktop-validation.mjs --stop-macos "$ROOT"
node scripts/d007-zed-desktop-validation.mjs --launch-macos "$ROOT" gradle
```

Require standalone project initialization, Spring property intelligence,
executable Boot-project discovery, and generated Gradle-wrapper task behavior.

## 6. Known D007 reduction

Spring XML Java package/type value completion is not a failure condition.
`sts/javaCodeComplete` is answered with an empty result because Zed exposes no
public cross-language-server completion request route. Reintroducing the old
private Java transport to recover this feature would fail the D007 boundary.

## 7. Summarize private-boundary evidence

Copy relevant Zed/LSP/foreground logs into the staged `evidence/` directory,
then run:

```bash
node scripts/d007-zed-desktop-validation.mjs \
  --summarize \
  "$ROOT"
```

`privateBoundary` must be `PASS`.

The summary is intentionally narrow: absence of the retired boundary is
machine-checkable, while user-visible Maven/Gradle outcomes still need the
corresponding runtime trace/observation recorded for the exact source HEAD.

## Evidence invalidation

Any source commit after staging invalidates the desktop acceptance evidence.
Restage from a fresh root and rerun the gate. Stop the isolated process with
`--stop-macos` before discarding its root.


### Single-file worktree boundary

Zed can represent an exact-opened file as a single-file worktree whose root is
the file itself. The standalone Spring project model requires a directory root,
so the coordinator keeps an explicit fail-closed guard for that unsupported
case instead of walking to an inferred parent directory.

D007 no longer relies on a secondary `--existing` or `--add` CLI request for
fixture-file focus. Each fixture's one foreground launch opens only the directory
root; subsequent exact-file navigation stays inside that isolated Zed process
through File Finder's public absolute-path resolver, D007-only key bindings, and
protocol evidence.
