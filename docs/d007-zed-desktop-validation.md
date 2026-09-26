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
3. launches isolated Zed on the Maven fixture and waits until the new launch process group contains a live `/Applications/Zed.app/Contents/MacOS/zed` process whose command line is bound to the exact staged `--user-data-dir`; the CLI launcher alone, a zombie, another profile, and foreground-log bytes cannot satisfy readiness;
4. removes any ignored stale root `extension.wasm`, invokes Zed's `Install Dev Extension` action, then drives Zed's **own OpenPathPrompt picker** by replacing its query with the repository's absolute path and confirming that directory once; it then waits until the isolated extension index contains `spring-tools` and the checkout has produced a new non-empty `extension.wasm`;
5. waits for Spring runtime startup evidence, then opens a generated `application-d007.properties` containing only `ser`
   and invokes Zed's `editor: show completions` action;
6. records a per-probe log boundary, invokes completion, and waits until both `textDocument/completion` and `server.port` appear after that boundary; bounded retries re-issue the same probe instead of sleeping blindly;
7. captures a completion screenshot, opens `FixtureApplication.java`, invokes `editor: toggle code actions`,
   selects `Spring Boot: Configure run/debug for a project…`, and verifies
   both generated `.zed/debug.json` and `.zed/tasks.json`;
8. waits for the generated files, retrying the exact Code Action on a bounded interval if necessary, then machine-checks the Java launch contract plus the fixture-specific run task: Maven must use `mvn spring-boot:run`, while Gradle must use the checked-in `./gradlew bootRun` wrapper path;
9. stops the isolated Zed **process group** with `SIGTERM`, waits for non-zombie members to disappear, escalates to `SIGKILL` if required, then repeats the independently bounded probe against the Gradle fixture; the `finally` path uses the same bounded cleanup without masking an earlier product/gate failure;
10. harvests only the post-boundary shared Zed log
   bytes, and checks retired private-boundary markers;
11. writes `evidence/desktop-gate.json` and `evidence/summary.json`.

A final `PASS` requires both Maven and Gradle run/debug configuration
generation, the expected Java launch entry and build-tool run task for each fixture,
no retired private-boundary marker, and runtime evidence containing both a
`textDocument/completion` request and `server.port`. If the UI
automation succeeds but the trace does not contain enough data to prove the
completion result, the gate returns `FAIL_OR_REVIEW_REQUIRED` rather than
silently promoting screenshot-only evidence. If a phase throws, the harness
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

The generated profile enables LSP tracing, disables AI and extension updates,
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
diagnostic only and is not a readiness oracle. Shutdown validation also uses
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

This invokes `zed: install dev extension` and selects the current repository.
Zed currently uses an in-editor `OpenPathPrompt` picker for this action rather
than a native macOS file chooser, so the harness enters the absolute repository
path directly into that picker and confirms it once. It uses macOS
Accessibility/System Events. If Accessibility permission is missing or the
picker cannot be driven, it fails closed and records
`evidence/dev-extension-install.json`; if compilation/registration does not
finish, it additionally records `evidence/dev-extension-readiness-failure.json`
with WASM/index state and the foreground-log tail. Do not treat UI-driving
failure as product failure.

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
