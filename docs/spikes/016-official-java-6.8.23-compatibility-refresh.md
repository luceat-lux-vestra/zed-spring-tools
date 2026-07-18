# S016: Official Java 6.8.23 compatibility refresh

- Status: Prepared; runtime driven run pending (see Preparation below)
- Date: 2026-07-18 (prepared 2026-07-19)
- Related research:
  [R014](../research/014-final-upstream-capability-surface-audit.md)
- Decisions:
  [D003](../decisions/003-java-companion-product-architecture.md) and
  [D005](../decisions/005-lsp-first-capability-delivery.md)

## Hypothesis

On the fixed macOS arm64/JDK 25 tuple, unmodified official Java extension 6.8.23
preserves the accepted Java/Spring coordination and cleanup contract and its
official main-class runnable can launch the representative Maven Spring Boot
application without a product-generated duplicate Java task.

## Why runtime verification is required

D003 rejects unknown Java providers until their exact transport and lifecycle
contract is verified. Java 6.8.23 changes the extension substantially: it adds a
downloaded task helper, Maven/Gradle/vanilla task resolution, Gradle LS, new
language resources, and proxy code changes. Source inspection shows useful
execution functionality but cannot prove compatibility with the product's
bridge, cold installation, callbacks, cleanup, logging, or the fixture's Boot
main class.

## Environment

- macOS 26.5.1 arm64
- stock compatibility-tested Zed version selected when the spike starts; record
  the exact version and commit
- official Java extension exactly 6.8.23, commit
  `ddc13dafaf9ddc44ab46c9ff9768832aa98dfe11`
- Spring Tools `5.2.0.RELEASE`
- Temurin JDK 25.0.3
- the current product built from reviewed source
- the existing non-secret Maven Spring Boot fixture used for capability runs
- an isolated Zed profile and ignored evidence directory

Other desktop, architecture, JDK, Zed, Java-extension, and build-tool tuples
remain untested.

## Preparation (2026-07-19, source-backed; no runtime claim)

Groundwork completed before the driven run. Nothing here asserts a runtime
result; the compatibility state is unchanged.

### Environment pinned and captured

Host, Zed, JDK, and product source are recorded in
`tmp/s016-java-6.8.23-20260719/evidence/` (`env.txt`, `README.md`). The host is
now macOS **26.5.2** (build 25F84), a point release above the 26.5.1 recorded on
the earlier tested tuple; each run must record the exact observed value rather
than assume the earlier release. Zed is `1.11.3`, runtime JDK Temurin `25.0.3`.

### 6.8.23 is not present locally; obtaining it is a network step

Every `extensions/installed/java/extension.toml` on the host — the live Zed data
dir and every warm `tmp/` profile — reports `version = "6.8.21"`. Official Java
`6.8.23` exists nowhere locally. Acquiring it means updating the `java` extension
in a real Zed from the Zed extension registry (a runtime network fetch), then
building the isolated profile from that installed tree with
`scripts/prepare-local-poc.mjs`, which copies `extensions/installed/java` plus
the `jdtls`/`bin` work dirs and asserts the manifest version. That assertion is
currently pinned to `6.8.21` and must be pointed at `6.8.23` for this spike's
profile preparation. Record the installed 6.8.23 digest on download; do not use
an unpinned `latest` as an asserted supported configuration.

### The compatibility contract is self-asserted, not runtime-detected

Source review of the product (not a runtime observation):

- The extension writes its own embedded `protocol/java-providers.json` into the
  runtime work dir (`src/runtime.rs`), and the coordinator validates *that* file.
  `validateCompatibility` (`coordinator/src/main.mjs:454`) requires exactly one
  provider and hard-codes `provider.extensionVersion !== "6.8.21"` alongside the
  route/bridge shape.
- `platform::resolve_java` (`src/platform.rs`) discovers only the `java`
  *executable* via `worktree.which("java")`. Nothing reads the installed Java
  *extension's* `extension.toml` version.
- The coordinator reaches the official proxy purely through a port file at
  `<javaWork>/proxy/<routeId>` (`coordinator/src/java_transport.mjs:31`); the
  bridge handshake exchanges a schema version, not an extension version.

Consequence for Procedure step 3: the "rejection control" cannot be a
version-string refusal of the installed extension, because the product performs
no such detection. With the unchanged contract the coordinator will still attempt
to connect to whatever proxy exists at the pinned path. A mismatch can therefore
surface only *structurally* — a changed proxy route/directory, port-file scheme,
or bridge command/schema in 6.8.23. Adding a "6.8.23 compatibility record" is, in
the current design, a source edit to `java-providers.json` plus the hard-coded
`6.8.21` check (and the `providers.length === 1` shape); it changes the product's
self-declared support, not any runtime gate. The driven run must therefore:

1. observe whether unchanged 6.8.21-contracted product still resolves the pinned
   route and bridge against a real 6.8.23 install (the true structural gate), and
2. treat "accepts only the explicitly added record" as a statement about the
   self-asserted contract, noting that a genuine installed-version guard does not
   yet exist and recording whether the spike result argues for adding one.

This is the reusable design finding to carry into the follow-up decision on how
6.8.23 should be admitted.

### Profile-prep scaffolding staged

`spikes/s016-official-java-6.8.23-compatibility-refresh/` holds a disposable
6.8.23 analog of `scripts/prepare-local-poc.mjs` plus a driven-run runbook. Its
`--self-test` passes against a synthetic 6.8.23 source without a live install, so
step 2 (isolated-profile build) is automated once a real 6.8.23 install exists;
the interactive Zed steps remain manual.

## Procedure

1. Record the clean source commit, product artifacts, exact official Java 6.8.23
   release artifact and digest, Spring artifact digest, JDK, Zed, OS, and
   architecture. Do not use an unpinned `latest` URL.
2. Prepare a clean isolated Zed profile. Install official Java 6.8.23 unchanged
   before installing the development product, preserving the S014 ordering
   contract.
3. Start the fixture and verify the coordinator accepts only the explicitly
   added 6.8.23 compatibility record. A run without that record is the rejection
   control and must not enter a reduced mode.
4. Exercise the accepted D003 boundary: bridge bundle contribution, official
   proxy discovery, Spring startup, authentic Java classpath/project callbacks,
   visible `server.port` completion, and one verified navigation or Code Action
   route.
5. Trigger the official Java `Run <main class>` runnable on the fixture's
   `@SpringBootApplication` class. Attribute the command to Java 6.8.23's task
   helper and the project Maven wrapper, then verify the application becomes
   reachable and its output is visible in Zed's terminal/task UI.
6. Stop the task through Zed and verify the Boot process exits. Then close the
   worktree and uninstall the product through the accepted lifecycle.
7. Prove the authentic Spring removal reaches the bridge, every owned route and
   process is removed, official Java remains installed and unmodified, and a
   restart does not resurrect product-owned state.
8. Scan retained logs for credentials, complete classpaths, authorization data,
   and unexpected absolute user paths. Record bounded, redacted evidence only.
9. Repeat a warm offline start using only already verified local artifacts. Do
   not claim general offline support from this one tuple.

## Success criteria

- The unknown-provider control rejects Java 6.8.23 without starting a reduced
  managed-JDT mode.
- The explicit 6.8.23 compatibility record supports the same bridge, callback,
  visible Spring completion, and cleanup outcomes accepted for 6.8.21.
- The official Java main runnable uses its task helper and the Maven wrapper,
  starts the representative Spring Boot application, exposes useful terminal
  output, and stops cleanly through Zed.
- Product uninstall removes every product-owned process and route while leaving
  official Java unchanged.
- Retained normal logs contain no credentials or complete classpaths.

## Failure criteria

- Java 6.8.23 is accepted without an explicit compatibility record or falls back
  to a self-managed JDT mode.
- Bridge contribution, proxy discovery, callbacks, visible Spring behavior, or
  authentic cleanup regresses.
- The official runnable cannot launch the Maven Boot main class, bypasses the
  wrapper unexpectedly, hides actionable output, or leaves an owned process.
- The test requires modifying official Java, its proxy, or its work directory
  beyond the already allowlisted product commands.
- Normal logs expose credentials or complete classpaths.

A task-helper-only failure with the coordination contract otherwise intact is a
split result: Java 6.8.23 compatibility may be Supported while reuse of its main
runnable is Refuted. Record both outcomes instead of collapsing them.

## Observations

Runtime steps not run. Preparation only (see the Preparation section): the
environment is pinned and captured, 6.8.23 is confirmed absent locally, and the
self-asserted-contract finding reframes step 3. No runtime behavior observed.

## Result

Pending. This plan adds no compatibility record and changes no capability state.
Preparation confirmed the environment pin and surfaced that no installed-version
guard exists today; the structural route/bridge gate is what the driven run must
exercise.

## Remaining uncertainty

- Gradle and vanilla Java task behavior.
- Java test runnables and debug behavior.
- Every untested platform/JDK tuple.
- Future official Java and Zed releases.
- Whether Java 6.8.23's Gradle LS affects larger mixed Maven/Gradle worktrees.

## Next experiment

If the coordination contract is Supported, add 6.8.23 through a separately
reviewed compatibility-table change. If the runnable is also Supported, prefer
it for matching generic main/test actions and keep generated Zed tasks only for
Spring-specific or unmatched commands. Boot Debug remains a separate explicit
`.zed/debug.json` experiment.

## Reusable findings

Preserve the exact release digests, rejection control, task-helper command
attribution, visible terminal behavior, stop path, removal payload, and redacted
cleanup evidence so later official-Java versions can repeat this gate.
