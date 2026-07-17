# R012: Cold-cache bridge/bundle startup race

- Status: Confirmed on macOS arm64/JDK 25; fix direction undecided
- Last updated: 2026-07-18
- Investigator: Claude Opus 4.8
- Evidence baseline:
  - Product commit `91a3997`
  - macOS 26.5.1 arm64, Zed 1.10.3, official Java extension 6.8.21,
    Temurin JDK 25.0.3
  - Local evidence retained under the ignored path
    `tmp/ws2-symbols-20260718/evidence/` (`lsp.log`, `lsp2.log`, JDT
    `.metadata/.log`, `BRIDGE-RACE-FINDING.md`)

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

## Inferences

1. Zed does not hold `jdtls` startup for a slow cross-extension
   `additional_initialization_options` callback. When our download exceeds
   whatever Zed allows, `jdtls` starts without our bundles.
2. The classpath flow this project uses is carried by the bridge commands
   (`zed.spring.bridge.v1.*`), not the Spring bundle commands (`sts.java.*`).
   The bridge jar is built by this project and materializes without a download,
   so contributing only the bridge jar may avoid the download dependency
   entirely — but which bundles each capability needs is not yet established.

## Impact on the M2 gate

M2 recorded that a clean development install reproduces the flow. That run hit
the download hang, was restarted, and only then succeeded — so its cache was warm
on the successful attempt. The honest statement is that the flow works on a warm
cache, and a genuinely cold first launch fails the bridge race until a restart
warms the cache. The M2 gate note and the inventory's "classpath listening"
evidence are annotated with this caveat.

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
