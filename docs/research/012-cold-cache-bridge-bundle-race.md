# R012: Bridge/bundle startup ordering (originally mis-titled "cold-cache race")

- Status: Superseded by [S014](../spikes/014-jdtls-bundle-startup-ordering.md)
  Gate A. The cause is install ordering, not cache temperature.
- Last updated: 2026-07-18
- Investigator: Claude Opus 4.8
- Evidence baseline:
  - Product commit `91a3997`
  - macOS 26.5.1 arm64, Zed 1.10.3, official Java extension 6.8.21,
    Temurin JDK 25.0.3
  - Local evidence retained under the ignored paths
    `tmp/ws2-symbols-20260718/evidence/` and
    `tmp/s014-gate-a-010646/evidence/`

## Correction (2026-07-18)

This document first concluded the bridge fails because `jdtls` starts before a
cold-cache download finishes. That was wrong: it varied two things at once, the
cache temperature and whether the extension was installed before `jdtls` started.
S014 Gate A held the cache cold and varied only the ordering, and found that a
cold cache with the extension pre-installed registers the bridge fine — Zed waits
for the contribution callback through the download. The real cause is that the
failing runs opened a Java file first and installed the dev extension afterwards,
so `jdtls` had already started and was never re-queried for the bundles.

The confirmed facts below stand as recorded observations, but the inference that
the cache was the cause is retracted. Read S014 for the corrected conclusion.

## Question

Why does the classpath bridge fail to register on a fresh install with the error
"official Java rejected the compatibility command", and does the M2 gate's
clean-install claim still hold?

## Confirmed facts

1. The extension contributes the bridge and Spring bundles to `jdtls` from
   `language_server_additional_initialization_options`. That function calls
   `artifacts::ensure_installed()`, which downloads the 82 MB Spring VSIX and
   extracts the bundles, and only then returns the bundle list.
2. On a fresh profile, `jdtls` initialized at 00:31:50, but the bridge jar was
   materialized at 00:32:29 and the Spring bundles were extracted at 00:32:41 —
   `jdtls` started 51 seconds before its bundles existed.
3. JDT's own `.metadata/.log` recorded `Static Commands: []` on every cold
   attempt (11 occurrences): the bridge command
   `zed.spring.bridge.v1.addClasspathListener` was never registered, so JDT
   rejected the classpath-listener call.
4. After the same profile's cache was populated and Zed was restarted, JDT logged
   `Static Commands: [zed.spring.bridge.v1.addClasspathListener,
   zed.spring.bridge.v1.removeClasspathListener]` plus the Spring bundle
   commands, the bridge registered on the first attempt, and classpath
   coordination succeeded. The only variable between the two was whether the VSIX
   and bundles were already on disk when `jdtls` started.
5. `jdtls` asks each other extension for additional initialization options once,
   at its own startup. A bundle set that arrives after `jdtls` has started is not
   picked up, and there is no re-query.

## Inferences (both retracted by S014)

1. ~~Zed does not hold `jdtls` startup for a slow contribution callback.~~
   Retracted: S014 observed Zed waiting for the callback through the download.
2. ~~Contributing only the bridge jar may avoid the download dependency.~~
   Retracted twice over: the bridge reuses `ReusableClasspathListenerHandler`
   from the Spring `jdt-ls-commons` bundle, so it needs the VSIX bundles; and
   the download was not the cause anyway.

## Impact on the M2 gate (corrected)

The first version of this section claimed M2 succeeded only on a warm cache and
that a cold first launch fails. S014 shows that is wrong: a cold cache with the
extension pre-installed registers the bridge. M2's restart succeeded because the
extension was then present before `jdtls` started, which is also true of any
registry install. The M2 cold-install flow is sound; the "warm-cache caveat"
added to the plan, the inventory, and `LIMITATIONS.md` is being corrected to the
install-ordering finding.

## Secondary defect (fixed)

`java_transport.mjs` threw a fixed string, "official Java rejected the
compatibility command", for any error envelope, discarding JDT's real error. It
now includes the command name and the underlying reason, and a test covers it.
Fixing the message is independent of the race fix and is done.

## Items requiring runtime verification

1. Whether the classpath-to-completion flow works with only the bridge jar
   contributed and the Spring bundles omitted or deferred.
2. Whether `java.reloadBundles`, which JDT already exposes, re-registers a
   delegate command handler into a running `jdtls` when called after the download
   completes.
3. Whether eager pre-materialization (downloading before `jdtls` is contributed
   to) actually wins the race, given both language servers start on the same file
   open.

## Blockers and constraints

1. `java.reloadBundles` is an official Java command, not one of this project's
   allowlisted bridge commands. Invoking it expands what the project asks of the
   official Java extension, which `AGENTS.md` places behind a recorded decision.
   A reload-based fix therefore needs a decision document.
2. No Zed extension API lets one extension restart another extension's language
   server, so a "restart jdtls after bundles are ready" fix cannot be automated
   from within the extension.

## Candidate next experiments

1. A spike that contributes only the bridge jar and checks whether the classpath
   event, `server.port` completion, and diagnostics still reproduce. If they do,
   the race is removed for the core flow without crossing the official-Java
   command boundary.
2. A spike that calls `java.reloadBundles` after the download and checks JDT's
   `Static Commands` for the bridge commands, to decide whether a reload-based
   safety net for the Spring bundles is feasible.

## Reproduction

```sh
node scripts/prepare-local-poc.mjs --prepare <profile-src> <fresh-root> <jdk>
# Open a Java file via CLI on the FRESH root (cold cache) and watch:
#   JDT .metadata/.log -> "Static Commands: []"
#   Spring log         -> "official Java rejected ... compatibility command"
# Then quit Zed and relaunch (warm cache); the bridge registers on first try.
```
