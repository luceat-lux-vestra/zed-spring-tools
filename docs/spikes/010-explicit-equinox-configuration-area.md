# S010: Explicit Equinox private configuration area

- Status: Gate A implemented and validated; Gate B not started
- Last updated: 2026-07-17
- Depends on: R008 complete; S009 Inconclusive
- Target tuple: macOS 26.5.1 arm64, Zed 1.10.3, Temurin JDK 25.0.3

## Hypothesis

If the exact fixed Java extension's direct managed-JDT launch adds one explicit
`-Dosgi.configuration.area=<expected JDT data>/configuration` JVM argument,
then the pinned JDT LS will keep its shared `config_mac_arm`, use the same exact
worktree-scoped `-data`, reach `ServiceReady`, create its private Equinox state
only below that data path, and leave the fresh fixed JDT distribution tree
unchanged.

## Why this experiment is next

S008 already proved two distinct direct data paths. S009 proved the isolated
trust, HTML, AI/provider, XDG, fixed-child, and direct `ServiceReady` controls.
R008 then attributed S009's only new blocker: the fixed Java extension and
official JDT wrapper specify a shared configuration but no private one, so the
exact Equinox runtime creates `<install>/configuration` when the install is
writable.

This spike changes only that missing private-location argument. It is not
another broad isolation run and does not include Spring Tools.

## Fixed inputs

| Input | Fixed identity | S010 rule |
| --- | --- | --- |
| Zed | Signed 1.10.3 macOS arm64 DMG/app/CLI already pinned by S007-S009 | Reverify before preparation and runtime |
| Java source | `9148b8972c1b93fbe5512a9ecf0ba33c3182970d` | Clean control checkout plus one reviewed disposable patch |
| Java extension | 6.8.21 source/manifest and locked dependencies | Build control and patched WASM under identical toolchain conditions |
| JDT LS | `1.60.0-202606262232` pinned archive | Fresh verified extraction; `configuration/` absent before launch |
| Equinox OSGi | `3.24.300.v20260612-1540`, SHA-256 `4f9ebafd...7984` | Unmodified |
| Equinox launcher | `1.7.200.v20260619-2039`, SHA-256 `89007de5...02e` | Unmodified |
| Java proxy/debug/helper/catalog | Exact S009 fixed identities | Copy and reverify; no update lookup or patch |
| JDK | Temurin 25.0.3+9 | Exact executable and identity |
| Fixture/profile | New copy of S009's Java-only fixture and controls | Fresh paths; no preserved mutable runtime reuse |

The complete digests must be copied into Gate A/B manifests. Abbreviations in
this table are descriptive only and must never be accepted by a verifier.

## Allowed change

The disposable patch may change only the fixed Java extension launch builder:

1. derive `configuration_path` as `jdtls_data_path.join("configuration")`;
2. append exactly one
   `-Dosgi.configuration.area=<configuration_path>` argument before `-jar`; and
3. leave the existing shared configuration, read-only/cascaded properties,
   heap arguments, launcher, and `-data` untouched.

The tracked spike implementation may contain only a patch, a preparation/
verification tool, a dependency-free Java fixture, and short reproduction
metadata under `spikes/s010-explicit-equinox-configuration-area/`. Generated
source checkouts, WASM, catalogs, JDT/JDK/binary artifacts, profiles, logs, and
runtime state stay under ignored `tmp/` paths.

## Excluded work

- Spring Boot LS, Spring JDT bundles, callback routing, completion, or S006
  continuation;
- a production extension manifest, product module, launcher, wrapper,
  coordinator, installer, cache manager, or release workflow;
- changing Java extension settings or exposing a product-facing option;
- changing JDT LS, Equinox, proxy, debug, task helper, catalog, Zed, or the
  normal user profile;
- relying on filesystem read-only fallback or accepting install-tree
  `configuration/` as mutable;
- concurrent server, restart/reuse, upgrade, migration, eviction, or cleanup
  policy testing; and
- any non-macOS runtime or support claim.

## Environment and path model

Gate B must create wholly new absolute paths for:

- isolated Zed profile and Java extension work directory;
- worktree containing spaces and Unicode plus its contained Java fixture;
- `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, and `XDG_STATE_HOME`;
- expected JDT data `D = <XDG_CACHE_HOME>/jdtls-<SHA-1(normalized full worktree path)>`;
- expected private configuration `C = D/configuration`;
- proxy route directory, evidence directory, mounted fixed Zed app, and bounded
  log interval.

`D` and `C` must be computed independently by the preparation tool and recorded
as complete values in an ignored manifest. Both must be absent before launch.
No normal-profile credential contents are read or copied.

## Gate A: disposable implementation and static verification

Gate A requires a new explicit continuation after this plan review. It may:

1. add the narrow tracked patch, fixture, and preparation/verification tool;
2. reject a source commit mismatch, dirty baseline, patch outside the allowed
   source file, more than one private-location argument, or placement after
   `-jar`;
3. test full-path hashing, spaces/Unicode, prefix-collision, symlink/normalized-
   root behavior, duplicate manifest keys, traversal/archive attacks, and
   expected `D`/`C` derivation using generated fixtures only;
4. compile and format the disposable tool and validate the patch applies to the
   exact clean source; and
5. record the complete intended diff and validation output without building a
   real extension or launching Zed/JDT.

Gate A must stop for review before Gate B.

## Gate B: fixed build and non-UI preparation

After Gate A review and a new explicit continuation, Gate B may:

1. reverify the clean fixed source, toolchains, pinned archive, Zed image, proxy,
   debug JAR, helper, catalog, and fixture;
2. build unmodified and patched Java WASM from separate clean checkouts with the
   same locked commands and environment, retaining build logs and identities;
3. prove the patched checkout differs only by the reviewed source hunk and that
   the unmodified checkout remains clean;
4. prepare one fresh Java-only isolated profile using the patched WASM and the
   exact S009 trust/HTML/AI/update/XDG controls;
5. extract a new fixed JDT tree from the verified archive and require its
   pre-run tree digest to match the pristine reference with no `configuration/`;
6. record complete settings, extension index, worktree, XDG, `D`, `C`, allowed
   profile roots, fixed child identities, normal-Zed baseline, process absence,
   route absence, and log boundary in a preparation manifest; and
7. perform no Zed, proxy, JDT, Spring, or UI launch.

Gate B must stop for implementation/build/preflight review. Gate C requires a
new explicit continuation.

## Gate C: one bounded runtime run

1. Reverify every Gate B identity and absence condition. If any pre-child
   condition fails, stop without launching and classify the preparation issue.
2. Stop normal Zed, record its baseline, mount and verify the pinned signed Zed
   app, establish a fresh log boundary, and launch only the isolated profile
   with the worktree and contained fixture supplied directly.
3. Use no trust interaction and no editor input. UI automation is allowed only
   for bounded observation or graceful shutdown if the fixed CLI/app path
   cannot do so; announce that the user must avoid foreground interaction before
   taking control.
4. Require the actual proxy/JVM vector to select the exact proxy, JDK, fresh JDT,
   platform config, and launcher, and to contain:
   - exactly one `-Dosgi.configuration.area=C` before `-jar`;
   - exactly one `-Dosgi.sharedConfiguration.area=<fresh JDT>/config_mac_arm`;
   - the existing shared read-only and cascaded properties; and
   - exactly one `-data D`, with no wrapper, fallback, or second candidate.
5. Require real JDT `ServiceReady`, JDT instance state below `D`, and Equinox
   private configuration content below `C`.
6. Require no `configuration/` anywhere in the fresh fixed JDT root and require
   its complete post-run tree digest and every file digest to equal preflight.
7. Recheck S009's source-attributed boundaries: no trust modal, HTML install,
   Copilot/ChatGPT provider warning, normal-profile content, unexpected
   extension, unexpected child, host data fallback, or unplanned mutable path.
8. Gracefully stop the isolated app; require Zed, proxy, and JVM absence within
   the fixed deadline. Record automatic route deletion separately, then remove
   a retained route explicitly only after process absence.
9. Detach the fixed app, restore normal Zed, verify its baseline identity, and
   preserve all unexpected observations. Do not correct or retry after a real
   proxy/JDT child starts.

Suggested fixed bounds are those already proven by S009: 30 seconds for child
appearance, 60 seconds for `ServiceReady`, and 10 seconds for child absence.
Gate A may copy the exact values from S009 into the verifier; it must not silently
extend them during Gate C.

## Success criteria

S010 is **Supported on macOS arm64/JDK 25** only if all of these hold:

1. the implemented diff is exactly the reviewed one-property patch;
2. all fixed inputs and isolated-profile controls pass;
3. the actual JVM vector contains the exact `C`, shared configuration, and `D`
   values once each in their required positions;
4. JDT reaches `ServiceReady` and its expected instance/private state exists
   only below `D`/`C`;
5. the complete fresh JDT distribution identity is unchanged and contains no
   runtime-created `configuration/`;
6. no prohibited provider/profile/child/path observation occurs; and
7. shutdown, explicit cleanup if needed, fixed-app detach, and normal-Zed
   restoration pass with retained evidence.

Supported means only that an explicit private configuration property fixes the
S009 distribution-mutation prerequisite on this tested tuple. It does not
select a product architecture or prove Spring Tools end to end.

## Refuted criteria

S010 is **Refuted on this tuple** if the fixed hypothesis input is reached and
one of these attributable outcomes occurs:

- Equinox ignores or overrides the exact explicit private configuration and
  creates state below the fixed JDT root or another path;
- the exact patched launch cannot reach `ServiceReady` while the fixed inputs
  and process vector otherwise satisfy the plan;
- the shared configuration is no longer attached/usable and an attributable
  bundle or framework failure results; or
- the fixed JDT tree changes despite all mutable state appearing at `C`.

## Inconclusive criteria

Classify the run **Inconclusive** if the hypothesis was not cleanly tested,
including a wrong build/input, stale path, normal-profile/process overlap,
unattributed UI/provider/editor state, failed evidence capture, premature
termination, external interruption, or an unexpected observation whose source
cannot be assigned within the preserved evidence. Do not remove a failed
observation or retry in place.

## Evidence to retain

- exact source commits, clean statuses, reviewed patch, control/patched build
  commands, toolchain identities, full digests, and build logs;
- preparation manifest, settings/index, path derivations, pre/post JDT tree
  manifests, and `D`/`C` inventories;
- bounded Zed logs, proxy/JVM argument vectors, `ServiceReady` evidence,
  extension/profile inventories, screenshots only if needed, and shared macOS
  path observations;
- shutdown/process/route evidence, explicit cleanup result, fixed-app detach,
  and normal-Zed restoration; and
- both successful and failed conditions plus all remaining uncertainty.

Committed documentation must redact private absolute paths and secrets. Raw
host-specific evidence remains ignored.

## Gate A implementation and validation result

Gate A completed on 2026-07-17 without building the Java extension or launching
Zed, the proxy, JDT LS, or Spring Tools.

### Tracked disposable inputs

- `extension/private_configuration.patch` targets only
  `src/jdtls.rs` at Java extension commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`. Its five added lines derive
  `jdtls_configuration_path` from the existing worktree-scoped data path and
  insert exactly one private-configuration property after the shared/cascaded
  properties and before `-jar`. It removes no source. The 416-byte zero-context
  patch has SHA-256
  `c0cf71f44b1cbf3d745e0ff9a588d1aa80e67d2dd5713effaa0859bd0220fcfa`.
- `fixture/S010Fixture.java` is dependency-free, 127 bytes, and has SHA-256
  `1ebee7526689ef8ac8bdebe26f779c1f4433a273bc87e9fe2f5d3d285d19b520`.
- `tools/PrepareS010.java` contains the Gate A contract and generated-fixture
  tests. Its reviewed Gate A source has SHA-256
  `47690c7b6c8a3f3b288a3621ea52fcc48bda1c7a1998b2f92b71cd38fad3e3bb`.
- The local reproduction commands and explicit non-product boundary are in the
  tracked spike README. Generated classes and the validation manifest remain
  under ignored `tmp/` paths.

### Passed checks

1. `javac -Xlint:all` compiled the tool on Temurin 25.0.3+9-LTS without a
   diagnostic.
2. `--self-test` passed rejection cases for another source path, duplicate
   private properties, placement after `-jar`, wrong source commit, dirty
   checkout, prefix-colliding worktrees, symlink inputs, duplicate/missing
   manifest keys, ZIP traversal, absolute/drive paths, and duplicate normalized
   archive entries.
3. Spaces and Unicode, normalized full-root SHA-1 derivation, distinct prefix
   paths, `D = <cache>/jdtls-<hash>`, and `C = D/configuration` passed.
4. `--gate-a` verified the real clean fixed checkout, both tracked input
   digests, the five-line/no-removal patch contract, and
   `git apply --check --whitespace=error-all` against the exact source commit.
5. The patch was applied only to an ignored disposable review worktree.
   `cargo fmt --check` passed with rustfmt 1.9.0-stable, and its changed-file
   set was exactly `src/jdtls.rs`.
6. The ignored Gate A manifest records one property, placement before `-jar`,
   the complete commit/digests, passed apply check, test groups, and JDK runtime.

### Gate A boundary

- No source-built control or patched WASM exists.
- No pinned JDT archive was extracted for S010 and no isolated profile, XDG
  roots, worktree, proxy route, or fixed Zed mount was prepared.
- No real Java extension, Zed, proxy, JDT, Spring, or UI process was started.
- Gate A does not test the runtime hypothesis and does not change S009's
  Inconclusive classification.
- Gate B is the next eligible step, but it requires review of this tracked diff
  and a new explicit continuation before any fixed build or non-UI preparation.

## Plan review record

Reviewed on 2026-07-17 before implementation. The review:

1. selected an explicit documented private location instead of relying on a
   read-only-install fallback or weakening the fixed distribution identity;
2. kept the extension's already-proven full-path-derived data key and placed
   private state below it to avoid a second cache-key algorithm;
3. required a disposable fixed-source patch because current Java settings do
   not expose arbitrary direct-path JVM properties;
4. retained the direct raw-Java launch so the exact S009 `-data` path remains
   observable and unchanged;
5. used one patched runtime run because S009 is the fixed unpatched control and
   R008 source/bytecode attributes its behavior; identical control/patched
   source builds remain a Gate B compiler-attribution check;
6. required a fresh pristine JDT extraction because the retained S008/S009
   trees already contain runtime configuration state;
7. retained all S009 profile, process, cleanup, and restoration controls; and
8. excluded Spring, lifecycle policy, product code, publication, and
   multiplatform claims.

The user explicitly opened Gate A on 2026-07-17. The tracked disposable
implementation and static validation above are now ready for review. No Gate B
build/preparation, Gate C runtime, UI automation, or Spring continuation is
authorized until a new explicit continuation.
