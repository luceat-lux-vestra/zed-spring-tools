# S011: Integrated Spring Boot local PoC

- Status: Pre-runtime verification passed; bounded runtime not started
- Last updated: 2026-07-17
- Target tuple: macOS 26.5.1 arm64, Zed 1.10.3, Temurin JDK 25.0.3
- Depends on: S003-S005 and S010 Supported; S006-S009 retained as
  Inconclusive prerequisite work

## Objective and hypothesis

This is the final local basic PoC required before the product direction
decision. If S010's fixed managed-JDT component and private configuration are
combined with the unchanged S006 adapter, authenticated Java proxy patch,
Spring stdio proxy, pinned Spring JDT bundles, real Spring Boot LS, and imported
Boot 3.5.5 Maven fixture, then one isolated Zed session can complete the real
classpath handshake and offer `server.port` completion in
`application.properties`.

The same Spring LS process must first return zero `server.port` items while
`enableJdtClasspath` is false. Only after that attributable baseline may the
proxy enable listening, relay the real dynamically generated callback through
JDT LS, receive the real Spring handler result, and allow a later Zed-originated
completion containing exactly one `server.port` item.

## Fixed composition

- Zed 1.10.3 signed arm64 DMG and isolated-profile controls proven by S009-S010.
- Java extension 6.8.21 at commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, built as a
  `wasm32-wasip2` component with only S010's reviewed five-line private-area
  addition.
- JDT LS `1.60.0-202606262232`, pristine tree SHA-256
  `b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583`.
- S006 instrumented native Java proxy, S006 Spring stdio proxy and adapter,
  their already-passed synthetic contracts, and exactly five Spring JDT
  bundles. S011 may not weaken or rewrite their callback/completion logic.
- Spring Tools VSIX SHA-256
  `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3`,
  executable server SHA-256
  `ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1`,
  and its closed set of 168 adjacent libraries.
- The fixed Boot 3.5.5 fixture and resolved metadata JAR already verified to
  contain `server.port`.

All binaries, VSIX/JARs, profiles, worktrees, logs, screenshots, routes, tokens,
and completion payloads remain under ignored `tmp/` roots.

## Allowed disposable implementation

S011 may add only a preparation/verification tool and short reproduction
metadata under `spikes/s011-integrated-spring-boot-local-poc/`. It may reuse the
tracked S006 adapter/proxies/fixture without copying or modifying them and reuse
the tracked S010 Java-extension patch without expanding it.

The preparation tool must transactionally create fresh profile, worktree, four
XDG roots, evidence, pristine JDT, patched Java component, Java-only plus S006
dev-extension index/link, fixed instrumented proxy/debug/helper/catalog, and
the exact Spring artifacts. It must independently derive `D` and
`C = D/configuration`, require both absent, and reject core-module WASM, stale
routes, mutable JDT state, unexpected extensions, dirty fixed source, or an
existing destination.

This remains spike infrastructure. It is not a production extension manifest,
coordinator, installer, cache manager, release workflow, or support claim.

## Pre-runtime verification

Before launching Zed:

1. rerun S006 adapter, Node proxy, Java-proxy patch, and preparation synthetic
   tests plus Rust/Java format, lint, component, and fixed-hash checks;
2. prove the S006 adapter component and S010 Java component are loadable
   component-model binaries and only Java plus the S006 dev extension are
   registered;
3. require a fresh Maven fixture without generated Eclipse/build state, fresh
   `D`/`C`, pristine JDT, empty routes/evidence, fixed catalog, and absent
   proxy/JDT/Spring processes; and
4. review the generated settings and manifests before any normal-Zed stop.

## One bounded runtime

After warning the user not to interact:

1. stop normal Zed, mount/reverify the fixed app, refresh the fixed catalog once,
   and launch the isolated profile in the foreground with all four XDG roots
   and both Copilot token variables absent;
2. require one patched Java component, instrumented proxy/JDT LS with the exact
   S010 `C`, shared configuration and `D` vector, one S006 adapter/proxy, and one
   real Spring child using the closed 168-library set;
3. require JDT `ServiceReady`, Maven fixture import, six debug-plus-Spring
   bundles, and Spring initialization with `classpathEnabled=false`;
4. open only the fixed `application.properties` at `(0,3)`. Require the first
   Zed-originated completion to contain zero `server.port` items;
5. require one real Spring dynamic callback ID, add-listener relay, authentic
   JDT classpath event, real Spring handler result `"done"`, and project-cache
   readiness. Neither proxy may synthesize or rewrite success/completion data;
6. require a later exact Zed-originated completion to contain one structurally
   preserved `server.port` item and visibly offer it in Zed;
7. remove the listener, stop all isolated processes, explicitly clean only
   retained owned routes after process absence, verify the pristine JDT tree,
   detach the app, and restore normal Zed.

No retry is allowed after a real baseline completion, add-listener request, or
classpath callback. A pre-child or pre-baseline setup error may be corrected
only with wholly fresh final roots while preserving the rejected evidence.

## Success, refuted, and inconclusive criteria

S011 is **Supported on macOS arm64/JDK 25** only when all fixed identities and
isolation controls pass, the real baseline is empty, the authentic callback and
Spring cache transition complete, the later Zed completion contains exactly one
`server.port`, no proxy manufactures the item, the JDT distribution remains
pristine, and shutdown/restoration pass.

S011 is **Refuted on this tuple** if the fixed hypothesis input is reached but
the real callback cannot populate the Spring project cache, the later real
Spring completion lacks `server.port`, or the unchanged S006 coordination seam
cannot preserve the required result.

S011 is **Inconclusive** for wrong/mutable inputs, server or UI attribution
failure, stale state, unexpected extension/provider/process/path, premature
termination, missing evidence, or any condition that prevents the fixed
hypothesis input from being tested cleanly.

## Plan review record

Reviewed before implementation on 2026-07-17. The review chose a new spike
instead of reopening S006, reused rather than duplicated its already-tested
protocol code, replaced S006's invalid Darwin launcher/data assumption with the
Supported S010 managed-JDT path, retained the before/after completion control,
required real Zed-originated evidence, preserved strict fresh-state and
no-synthesis rules, and excluded every production or multiplatform claim.

## Preparation and pre-runtime verification record

The reviewed disposable preparation implementation was completed on
2026-07-17 without adding product scaffolding or changing the S006 protocol
code. `PrepareS011` accepts only fixed local inputs and transactionally creates
the isolated profile, Spring fixture worktree, four XDG roots, and evidence
root. It verifies component-model WASM headers, exact Java/JDT/proxy/adapter/
Spring/JDK identities, the closed 168-library server class path, five bundle
hashes, the Java-plus-S006 extension index, the one allowed development link,
fresh runtime paths, empty state/evidence/routes, token absence, and process
absence.

The final ignored preparation roots use profile
`tmp/s011-profile-final-20260717`, Unicode/space worktree
`tmp/s011 Spring Boot PoC 한글 20260717`, the four corresponding
`tmp/s011-xdg-*-final-20260717` roots, and
`tmp/s011-evidence-final-20260717`. The derived JDT data suffix is
`ce1ccd15725f4635025436e2e97c010844f0f048`; both its data directory and
`configuration` child were absent after preparation. The combined extension
index SHA-256 is `89cc4dadeaaf9a2e582bb0927b1abbc7c0dbf11b7c2d47919f528746c29bc9`.

Pre-runtime checks passed with Temurin 25.0.3 and Rust 1.97.0: Java
warning-as-error compilation and the S011/S006 preparation self-tests; Node
syntax and complete Spring-proxy self-test; S006 adapter formatting, five
locked tests, warnings-denied Clippy and `wasm32-wasip2` check; instrumented
Java-proxy formatting, six locked tests and warnings-denied Clippy; JSON
parsing, fixed hashes, allowlists, symlink target, and absence of runtime
processes. No Zed, JDT, Spring child, completion request, callback, or UI
automation has run for S011 yet.

One pre-runtime correction is retained: the first S011 preparation rejected an
incorrect manually expanded Spring library-set digest copied from an earlier
abbreviated prose reference. The tool constant was corrected to the exact
fresh S006 manifest value
`f1fe021fac5e94bd394ee2be1792dd385b5ce30bd527c67e7c7e77d87aeea56c`;
the wholly fresh final roots were created only after that verification passed.
No hypothesis input or server process had started.
