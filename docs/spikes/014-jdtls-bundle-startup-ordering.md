# S014: jdtls bundle startup ordering

- Status: Planned
- Last updated: 2026-07-18
- Target tuple: macOS 26.5.1 arm64, Zed 1.10.3, official Java extension 6.8.21,
  Temurin JDK 25.0.3
- Depends on: [R012](../research/012-cold-cache-bridge-bundle-race.md) (confirmed
  cold-cache bridge race)

## Objective

Establish why `jdtls` starts without the bridge bundle on a cold cache, so the
race fix can be chosen from evidence instead of assumption. R012 confirmed the
symptom; this spike finds the mechanism and tests the two candidate fixes.

## What R012 already ruled out

The bridge cannot be contributed alone. `BridgeCommandHandler` reuses
`org.springframework.tooling.jdt.ls.commons.classpath.ReusableClasspathListenerHandler`,
which is a Spring class shipped in `jdt-ls-commons.jar` inside the VSIX. So
`jdtls` genuinely needs Spring VSIX bundles, and those need the download. A
"bridge-jar-only" contribution is not viable.

## Hypotheses

- **H1 — Zed does not hold `jdtls` for a slow contribution.** On a cold cache,
  `language_server_additional_initialization_options(target = jdtls)` does not
  return before `jdtls` initializes, either because Zed does not wait for it or
  because the call itself stalls in the artifact download. If Zed *does* wait,
  the fix is simply to make the callback reliably return; if it does not, no
  amount of blocking helps and the fix must reload after startup.
- **H2 — `java.reloadBundles` repairs a bare `jdtls`.** After the artifact is on
  disk, invoking JDT's `java.reloadBundles` with the bridge and Spring bundle
  paths causes JDT to register the bridge delegate commands
  (`zed.spring.bridge.v1.*`) into the already-running `jdtls`.

## Environment

A fresh `scripts/prepare-local-poc.mjs` root (cold cache) on the target tuple.
Spike code lives under `spikes/s014-.../` and modifies only a disposable copy of
the extension; production `src/` is not changed by this spike.

## Procedure

### Gate A — instrument the ordering (tests H1)

1. In a disposable extension copy, add timestamped stderr logging at the entry
   and exit of `language_server_additional_initialization_options`, and log
   whether it took the download path.
2. Install that extension on a cold root, open a Java file, and capture the Zed
   log with `tail -F`.
3. Compare three timestamps: callback entry, callback return, and `jdtls`
   `initialize`. Also note whether the callback's download completed or stalled.

### Gate B — reload after download (tests H2), only if authorized

4. On a warm root where `jdtls` has already started bare, invoke
   `java.reloadBundles` through the official Java proxy route with the bridge and
   Spring bundle paths.
5. Read JDT's `.metadata/.log` for the bridge commands under `Static Commands`
   and retry the classpath listener; observe whether a `server.port` completion
   then appears.

Gate B calls an official Java command outside the project allowlist. It runs only
to gather evidence; productizing it stays behind a decision (see Success below).

## Success criteria

- H1 is settled either way: the timestamps show whether Zed waits for the
  contribution. A "Zed waits" result points at a blocking-callback fix that
  crosses no boundary; a "Zed does not wait" result points at a reload fix.
- H2 is Supported if, after `java.reloadBundles`, JDT lists the bridge commands
  and the classpath flow produces a visible `server.port` completion in the same
  session with no restart; Refuted if the commands stay absent.

## Failure criteria

- If instrumentation cannot distinguish the timestamps (e.g. the callback and
  `initialize` interleave without ordering), Gate A is Inconclusive and needs a
  different probe.
- If `java.reloadBundles` errors or does not re-register delegate commands, H2 is
  Refuted and option 1 is not viable as specified; the fix falls back to
  serialising the download before `jdtls` by another means.

## Decision this feeds

- H1 "Zed waits" → fix by making the contribution reliably complete
  (production `src/` change, no gate). A decision doc is not required.
- H1 "Zed does not wait" and H2 Supported → a reload-based fix that calls
  `java.reloadBundles`, which needs a **D005** decision because it invokes an
  official Java command outside the allowlist.
- H2 Refuted → reopen options; record the constraint and stop.

## Remaining uncertainty before running

Whether Zed's contribution callback for another extension's language server is
awaited at all is undocumented in the inspected API and is the point of Gate A.
