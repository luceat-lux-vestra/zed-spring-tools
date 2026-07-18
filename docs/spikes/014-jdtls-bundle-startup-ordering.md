# S014: jdtls bundle startup ordering

- Status: Gate A complete — H1 answered; the cause is install ordering, not cache
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
  `java.reloadBundles`, which needs a separate direction decision because it
  invokes an official Java command outside the allowlist.
- H2 Refuted → reopen options; record the constraint and stop.

## Gate A result (2026-07-18)

Run on a cold root (`tmp/s014-gate-a-010646`, VSIX absent at launch) with the
extension already installed, using temporary `eprintln` probes in
`additional_initialization_options` (reverted, never committed). Evidence:
`tmp/s014-gate-a-010646/evidence/GATE-A-RESULT.md`.

**H1 answered: Zed holds `jdtls` startup for the callback, download included.**
The probe fired the full sequence — ENTER, bridge materialized, `ensure_installed`
returned, RETURN with 6 bundles — and `jdtls`'s `initialize` params then included
the bundles. JDT logged `Static Commands: [zed.spring.bridge.v1.*]` and the
coordinator logged "official Java classpath bridge registered". The bridge worked
on a cold cache.

This isolates the cause. R012 conflated cache temperature with install ordering;
holding the cache cold and varying only the ordering shows the cache was never
the cause. The failing runs opened a Java file first and installed the dev
extension afterwards, so `jdtls` had already started and was never re-queried for
the newly contributed bundles. Their restarts succeeded because the extension was
then present before `jdtls` started, not because the cache was warm.

**Gate B is not run.** With H1 answered, a registry install — where the extension
is present before any Java file is opened — needs no reload: Zed waits for the
callback and the bridge registers. The only failing scenario is the extension
becoming available after `jdtls` has started, which a `jdtls` restart resolves.
That does not clearly justify invoking the out-of-allowlist `java.reloadBundles`,
so Gate B and a reload-specific direction decision are shelved rather than
pursued. D005 now identifies the unrelated M4 capability-delivery decision.

## Residual uncertainty

- If the artifact download hangs (the separate defect in `LIMITATIONS.md`), the
  callback may never return even when the extension is pre-installed. Whether Zed
  then waits forever or times out into a bare `jdtls` was not tested; this run's
  download completed inside the callback.
- Whether Zed itself restarts a running `jdtls` when an extension is installed
  mid-session was not tested; if it does, even the install-ordering case would
  self-heal.
