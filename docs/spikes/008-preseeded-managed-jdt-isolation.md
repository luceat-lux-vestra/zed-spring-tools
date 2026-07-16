# S008: Preseeded managed-JDT isolation with attributed startup inputs

- Status: Gate B real preparation complete with retained pre-runtime corrections; Gate C not started
- Date: 2026-07-16
- Related decision: D001
- Related research: R003, R004, R006
- Depends on: S007 Inconclusive after one core-path success
- Implementation gate: Gate C closed until a later explicit continuation

## Hypothesis

On the fixed macOS arm64/JDK 25 tuple, official Zed Java extension 6.8.21 can
start pinned JDT LS 1.60.0 twice through its managed-local direct launch path
when every identified startup input is preseeded:

- one `java-task-helper` built from the exact clean Java extension commit and
  staged in the extension's accepted local `bin/` layout; and
- one byte-fixed JDT-embedded Gradle versions catalog staged with a fresh
  modification time in each run-specific XDG cache.

For two fresh worktrees, the installed unmodified Java WASM and official proxy
will produce exactly one explicit `-data` argument equal to each precomputed
run-specific path, create real JDT state only there, and independently reach
`ServiceReady`. The fixed helper and catalog will remain unchanged, the two
source-identified GitHub/Gradle lookup branches will not contribute, and no
managed or packaged-launcher host fallback will appear.

This hypothesis does not claim that the entire Zed application is network
silent. It tests only the startup lookup branches attributed by R006 plus the
managed JDT data path. Automatic proxy-record deletion is observed separately
from mandatory process exit; a retained record may be preserved and explicitly
removed after process absence without converting the run into a failure.

## Decision this spike informs

- A Supported result permits writing a new end-to-end Spring PoC plan that
  carries forward the fixed helper, catalog, minimal profile, explicit data
  path, and cleanup procedure. It does not reopen or change S006/S007.
- A Refuted result shows that the preseeded official managed path still cannot
  provide two attributable local JDT runtimes on the fixed tuple. Only a later
  plan may compare an upstream explicit-data setting or disposable launcher.
- An Inconclusive result permits correction only of a named preparation,
  identity, minimal-profile, or evidence gap in a new gate decision.

No outcome authorizes product scaffolding, Spring startup in S008, release
automation, or a multiplatform support claim.

## Why runtime verification is required

R006 proves the fixed branches but not the composed installed behavior:

- Buildship source should read a fresh XDG catalog instead of requesting its
  remote endpoint;
- the Java extension should select a local task helper before invoking Zed's
  GitHub release API;
- the minimal user-data profile should still load the installed official Java
  extension without unrelated provider state;
- S007's observed direct `-data` path must repeat across two new worktrees; and
- process exit and explicit route cleanup must leave Run 2 attributable.

## Scope boundaries

Included:

- the exact S007 Zed, CLI, Java extension, JDT, proxy, debug, JDK, and source
  identities;
- a release build of `java-task-helper` from clean Java extension commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d` with locked dependencies and a
  recorded toolchain/binary hash;
- the 413,663-byte JDT-embedded Gradle catalog at SHA-256
  `f91a3840453686a21fc2b1508c645c1affd939b1448105cf10438d11b71c4d02`;
- a wholly new minimal Java-only user-data profile, two new worktrees, two new
  XDG roots, and two absent-at-launch JDT data paths;
- two official embedded-CLI foreground runs, direct process/data attribution,
  `ServiceReady`, bounded shutdown, normal-Zed restoration, and retained
  cleanup evidence; and
- macOS arm64/JDK 25 only.

Excluded:

- Spring LS/bundles, Maven/Gradle projects, build import, completion, callbacks,
  tasks, debug, Lombok, or Java commands;
- modification of Zed, Java WASM, JDT LS, Buildship, proxy, debug bundle, or
  task-helper source;
- use of a mutable release asset or a downloaded `latest` version as a fixed
  supported input;
- a wrapper, coordinator, installer, launcher, server manager, production
  manifest, build system, packaging, CI, or product architecture;
- packet-capture-based claims, complete application network silence, and
  unrelated built-in Zed services;
- normal Zed settings/profile mutation, shell startup edits, global
  environment changes, or reuse of S007's consumed runtime paths; and
- Linux, Windows, x86_64, JDK 21, remote development, WSL, containers, or any
  public support claim.

## Confirmed facts and fixed sources

R006 records the full source chain. S008 fixes these inputs:

| Component | Fixed identity | Preparation rule |
| --- | --- | --- |
| Zed | 1.10.3 build `20260713.002323`; source `0c54c414...892a` | Exact signed app/embedded CLI only |
| Java extension | 6.8.21; source `9148b897...970d`; WASM `62dbf7ed...e3fd` | Copy official installed tree unchanged |
| JDT LS | 1.60.0 archive `e94c303d...f1d`; core JAR `e83035ad...be5` | Exactly one managed candidate |
| Buildship | 3.1.10 snapshot; source `d99d99a3...805`; JAR `dfc5ee42...00d` | No modification; satisfy its cache-read branch |
| Gradle catalog | JDT-embedded 413,663-byte file `f91a3840...4d02` | Copy once per XDG root and refresh only its mtime before run |
| Java task helper | Source package 0.1.0 from `9148b897...970d` | Locked release build; stage exact recorded binary |
| Java proxy | Official 6.8.21 binary `53ed618c...0076` | Unmodified; record auto-delete separately |
| Java debug | 0.53.2 `52751959...a83c` | Fixed existing JAR |
| JDK | Temurin 25.0.3+9 | Runtime and preparation |

Primary code references:

- R006's fixed
  [Buildship cache source](https://github.com/eclipse/buildship/blob/d99d99a319906c88418fe7a4dbfeec0b48a35805/org.eclipse.buildship.core/src/main/java/org/eclipse/buildship/core/internal/util/gradle/PublishedGradleVersions.java)
  and
  [background loader](https://github.com/eclipse/buildship/blob/d99d99a319906c88418fe7a4dbfeec0b48a35805/org.eclipse.buildship.core/src/main/java/org/eclipse/buildship/core/internal/util/gradle/PublishedGradleVersionsWrapper.java);
- the Java extension's
  [task-helper resolution](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/task.rs)
  and
  [JDT command composition](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs); and
- the official proxy's
  [record lifecycle](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs).

## Inferences and unverified hypotheses

1. A freshly copied fixed catalog should bypass Buildship's remote branch for
   the bounded run because its modification time is less than one day old.
2. A fixed helper at `extensions/work/java/bin/<fixed-id>/java-task-helper`
   should satisfy `find_local` before the swallowed `never` error and GitHub
   lookup.
3. Copying only the official Java install, a Java-only index, fixed work files,
   and settings into a new user-data root should be sufficient for Zed to load
   Java without the previous profile's account/provider databases.
4. S007's managed direct path should work twice with distinct full-worktree
   SHA-1 keys and no cross-run data reuse.
5. A leftover port record after process absence is a proxy cleanup limitation,
   not evidence that JDT data was reused. Explicit removal before Run 2 should
   restore route freshness without altering either run's JDT evidence.

## Disposable artifact layout

Gate A may add only:

```text
spikes/s008-preseeded-managed-jdt/
├── fixture/
│   └── S008Fixture.java
└── tools/
    └── PrepareS008.java
```

No extension manifest, Rust product code, proxy patch, launcher, wrapper,
Spring artifact, binary, or generated profile is tracked.

## Gate A: preparation implementation and synthetic review

Gate A requires a later explicit continuation. `PrepareS008.java` must use only
JDK APIs and must:

1. verify every fixed artifact/source identity above, the clean Java source
   commit, fixture, embedded CLI, JDK, and caller-supplied task-helper binary;
2. extract only `gradle/checksums/versions.json` from the fixed JDT core JAR,
   reject duplicate/traversal/unexpected ZIP entries relevant to that read, and
   verify its fixed size/hash;
3. construct a new minimal profile transactionally under ignored `tmp/`,
   containing only fixed settings, a Java-only index, the exact official Java
   install, one managed JDT candidate, the exact task helper, and an empty proxy
   route directory;
4. exclude databases, threads, external agents, provider/account state,
   unrelated extensions, S003-S007 development links, logs, and prior JDT data;
5. create two new fixture-only worktrees and two new XDG roots, each containing
   only the fixed catalog before runtime, and compute two distinct expected JDT
   data paths from the full normalized worktree roots;
6. record a manifest with every input/tree/binary hash, task-helper build
   identity, profile allowlist, both catalog paths, both expected data paths,
   both host fallback shapes, and every freshness constraint; and
7. reject an existing destination, unexpected profile file, helper sibling,
   second JDT candidate, existing data/fallback, proxy record, or live
   proxy/JDT process.

Synthetic tests must cover catalog identity/rejection, minimal-profile
allowlisting, helper-path selection shape, full-path hashing with spaces and
Unicode, distinct run keys, existing-output rejection, transaction cleanup,
and manifest completeness. Compile with
`--release 21 -Xlint:all -Werror`; run both compiled and source-file-mode tests.

Gate A stops before building the real helper, copying the real profile,
refreshing a real catalog mtime, invoking Zed/JDT, or controlling the UI.

## Gate B: fixed helper build and real preparation

Gate B requires a new explicit continuation after Gate A review. It may:

1. verify the clean Java extension commit and active rustup toolchain, then run
   `cargo build --release --locked -p java-task-helper` directly from that
   checkout with a wholly new ignored `CARGO_TARGET_DIR`, without a target
   update or dependency change;
2. record the Rust/Cargo versions, lockfile hash, source-tree identity, build
   command, output architecture, size, and SHA-256;
3. run `PrepareS008` once against fixed real inputs and wholly new ignored
   destinations;
4. verify the helper is an executable native arm64 file, then verify the minimal
   profile allowlist and byte equality of the official Java install, managed
   JDT, helper, settings, and preflight index; after Zed runs, permit only a
   semantically identical index serialization with its changed hash recorded;
5. verify each XDG root contains exactly one fixed catalog, while each expected
   JDT data path, host fallback, proxy record, and other mutable path is absent;
   and
6. preserve capacity, process-space, normal-Zed, and all preparation evidence.

Gate B stops before any project-opening or foreground CLI invocation, isolated
Zed start, proxy/JDT start, or UI action. The version-only CLI identity check
required by Gate A is preparation, not a Gate C runtime run.

## Gate C: two bounded runtime runs

Gate C requires a new explicit continuation after Gate B review.

### Shared preflight

1. Reverify all fixed/prepared identities, exactly one JDT/helper candidate,
   the minimal profile allowlist, process absence, route absence, two fixture-
   only worktrees, and both absent expected data paths/fallbacks.
2. Recopy each catalog from the fixed extracted source after verifying its
   content hash. Record its fresh modification time immediately before its run;
   do not alter the catalog contents.
3. Record the normal-Zed state and log boundary. Warn the user before bounded UI
   automation and release the input restriction immediately after isolated Zed
   stops.

### Run procedure

For Run 1 and then Run 2:

1. Stop normal Zed; invoke the exact embedded CLI in foreground with only that
   run's `XDG_CACHE_HOME`, the new minimal `--user-data-dir`, `--new`, and the
   run-specific worktree.
2. Open only `S008Fixture.java` through bounded UI automation.
3. Require the Zed log and actual proxy/JVM argument vectors to select the fixed
   proxy/JDT/JDK/config/launcher and exactly one `-data` equal to that run's
   precomputed expected path. Reject `jdtls.py`, `bin/jdtls`, a second data
   argument, another JDT candidate, or a host fallback.
4. Require real JDT state at only the expected path and `ServiceReady`. Record
   bounded timing, file count, RSS, logs, and process identity.
5. Verify the fixed catalog content and mtime are unchanged after startup, no
   `tooling/gradle/checksums` appears, the fixed helper remains unchanged, and
   no helper download/install artifact, GitHub-release error, provider-auth
   warning, other-run data reference, project metadata, or build output appears.
6. Gracefully stop isolated Zed and require proxy/JDT process absence within 10
   seconds. Observe the route directory after a stable wait. If the run's record
   remains, preserve its size/hash and explicitly remove it only after process
   absence; record this as automatic-cleanup failure, not core-path failure.
7. Before Run 2, reverify Run 1 data is unchanged and every Run 2 input is
   fresh. After Run 2, restore normal Zed without isolated arguments.

No setup correction is permitted after a real proxy/JDT start. A pre-child
preparation failure may be corrected once only with wholly new destinations and
preserved rejected evidence. Any other retry needs a new gate decision.

### Time bounds

- 30 seconds for isolated Zed and 30 seconds for proxy/JDT appearance;
- 90 seconds for Run 1 and 60 seconds for Run 2 `ServiceReady`;
- 10 seconds for child-process exit and a separate 5-second stable route check;
  and
- 15 seconds for normal-Zed restoration.

## Success criteria

S008 is Supported on macOS arm64/JDK 25 only if:

1. every fixed source, artifact, helper build, profile, catalog, worktree, and
   expected-path identity matches this plan;
2. both runs select the fixed managed JDT and direct Java command with exactly
   one correct explicit `-data` path and independently reach `ServiceReady`;
3. each expected data path is absent at launch, becomes attributable real JDT
   state, and remains isolated from the other run and both host fallbacks;
4. the local task helper and fresh catalog remain byte-identical, no Gradle
   checksum cache or helper install artifact appears, and the two identified
   latest-release/Gradle-versions lookup branches do not contribute;
5. the minimal profile introduces no unexpected extension, provider/account
   state, provider-auth warning, project metadata, or build output;
6. proxy/JDT processes exit after both runs, any retained route record is
   preserved then explicitly removed only after process absence, and Run 2
   starts route-fresh; and
7. normal Zed is restored and committed evidence contains no private absolute
   path, environment dump, token, raw port/command, binary, or third-party
   artifact.

Automatic proxy-record deletion is reported as passed or failed independently;
it is not required for core-path Supported when mandatory process absence and
the declared explicit cleanup both pass.

## Failure and classification criteria

S008 is Refuted if fixed identities and preparation pass but either run:

- selects another JDT, omits/changes/duplicates `-data`, uses a host fallback,
  or starts the packaged launcher;
- reuses the other run's data or cannot reach `ServiceReady` through the fixed
  direct managed path;
- ignores the staged helper and necessarily requires the latest-release branch;
  or
- ignores a fresh fixed catalog and necessarily requires the remote Gradle
  versions response for startup.

S008 is Inconclusive if helper provenance, catalog freshness, minimal-profile
identity, process/log attribution, user input, timeout cause, explicit cleanup,
or required evidence is insufficient. Unexpected network/provider behavior,
stale state, or a hidden correction is preserved rather than removed to obtain
Supported.

## Evidence and privacy rules

- Keep source checkouts, helper binaries, profiles, XDG/data paths, route files,
  process arguments/listings, raw logs, screenshots, and all generated evidence
  under ignored `tmp/` paths.
- Commit only this reviewed plan, later disposable source/test text, and
  redacted structural summaries.
- Record exact versions, commits, hashes, counts, timing, path equality, and
  cleanup order without publishing a home path, raw port, token, environment,
  or opaque command line.
- Preserve failed preparation, catalog, helper, launch, shutdown, restoration,
  and cleanup observations.

## Blockers and constraints

- This plan bypasses two source-identified lookup branches; it cannot prove
  system-wide network silence without a separately approved capture/isolation
  method.
- The fixed catalog's freshness is time-based. It is a reproducibility input,
  not a product update mechanism or a supported offline guarantee.
- The helper is source-built because stable Java extension 6.8.21 did not ship
  a helper asset. Its use is local disposable evidence only.
- Automatic proxy-record deletion remains best effort in the fixed source.
- All non-macOS tuples and JDK 21 remain untested.

## Candidate next experiment

- If Supported, write and review a new Spring end-to-end spike derived from
  S006 but using the S008 minimal profile, fixed helper/catalog, managed data
  path, and explicit route cleanup. Reevaluate the Spring lifecycle command
  before completion input.
- If Refuted, plan the smallest explicit-data alternative supported by the
  failing condition; prefer an upstream setting before a disposable launcher.
- If Inconclusive, correct only the named attribution or freshness gap in a new
  plan. Do not add Spring to the same retry.

## Plan review checklist

- one managed-JDT prerequisite only; no Spring or product code;
- exact source/artifact/helper/catalog identities and no mutable `latest` input;
- fresh minimal profile with no provider/account state;
- two distinct worktrees, XDG roots, and expected data paths;
- source-attributed bypass checks without a whole-app network-silence claim;
- separate process exit, automatic route deletion, and explicit cleanup;
- preserved failed evidence, normal-Zed restoration, and local-only wording;
- no product architecture, packaging, release, or platform support claim; and
- a new end-to-end plan, not S006/S007 reopening, even if Supported.

## Plan review record

Reviewed on 2026-07-16 before implementation. The review:

1. rejected an in-place S007 retry and assigned wholly new profile, XDG,
   worktree, evidence, and data identities;
2. replaced S007's unsupported assumption that `check_updates: "never"` blocks
   all lookups with exact helper/catalog preseed conditions from R006;
3. narrowed the claim from complete network silence to the two identified
   startup branches, because no packet-capture method is in scope;
4. required a minimal profile to remove unrelated provider-authentication state;
5. separated mandatory process exit from the proxy's best-effort route deletion
   and made any explicit record removal ordered, observable, and reproducible;
6. retained two runs because one correct S007 path does not establish isolation
   across distinct worktrees; and
7. kept Spring, completion, callbacks, product scaffolding, architecture,
   publication, and multiplatform claims outside S008.

No S008 code, fixture, helper build, profile, catalog copy, runtime path, Zed
launch, JDT process, or UI automation occurred during planning or review.

## Gate A implementation and synthetic review result

Gate A completed on 2026-07-16 and added only the two disposable artifacts
authorized by this plan:

- `spikes/s008-preseeded-managed-jdt/fixture/S008Fixture.java`; and
- `spikes/s008-preseeded-managed-jdt/tools/PrepareS008.java`.

### Confirmed implementation facts

1. The preparation tool uses only JDK APIs and contains no downloader, network
   client, product extension manifest, Rust product module, launcher, wrapper,
   coordinator, installer, or Spring artifact.
2. Production preparation requires the fixed clean Java source commit, Cargo
   lockfile and task-helper manifest hashes, exact managed JDT tree, core and
   Buildship JARs, exact official Java extension tree, proxy, debug JAR,
   embedded CLI, Temurin 25.0.3+9, fixture, and a caller-supplied executable
   thin Mach-O arm64 task helper.
3. The tool reads the JDT core JAR with `ZipFile`, validates every entry name,
   rejects traversal and duplicate normalized identities, accepts only the
   exact catalog entry shape, and verifies its 413,663-byte fixed digest before
   retaining either catalog copy.
4. The generated profile has an explicit allowlist for one fixed settings
   file, fixed byte-identical proxy/debug inputs, one Java-only index, the exact
   official Java install tree, one exact managed JDT tree, one helper selection
   path, an empty proxy route directory, and the preparation manifest. Top-level
   databases, threads, provider state, logs, unrelated extensions,
   previous-spike paths, helper siblings, second JDT candidates, and nonempty
   proxy records fail verification.
5. All five destinations must be distinct, absent direct children of the
   repository's ignored `tmp/` directory. The tool stages them in one temporary
   transaction, removes already-moved outputs on a later move failure, and
   always removes the transaction directory.
6. Each staged worktree contains only the fixed fixture. Each staged XDG root
   contains only `tooling/gradle/versions.json`. Run identities use SHA-1 of the
   full normalized worktree path, preserve the two host-fallback shapes, and
   require all expected data and fallback paths to be absent.
7. The manifest records the source/build inputs, binary and tree hashes,
   task-helper size and architecture, Java and `javac` hashes, settings/index
   hashes, complete profile allowlist, both catalog paths and preparation
   mtimes, both data/fallback paths, and every declared freshness constraint.

### Validation performed

On Temurin JDK 25.0.3+9, the source compiled successfully for the Java 21 API
boundary with:

```text
javac --release 21 -Xlint:all -Werror -d tmp/s008-gate-a-classes \
  spikes/s008-preseeded-managed-jdt/tools/PrepareS008.java
```

Both compiled-class mode and Java source-file mode reported
`S008 preparation synthetic tests passed`. The tests cover:

- exact catalog extraction plus wrong identity, duplicate-normalized-entry,
  and traversal rejection;
- minimal-profile allowlisting, helper selection shape, helper siblings,
  second JDT candidates, retained proxy records, and unexpected root state;
- full normalized path hashing with spaces and Unicode, XDG independence, and
  distinct run keys;
- existing-output rejection and rollback after a partially moved transaction;
  and
- exact manifest-key completeness and truncation rejection.

`git diff --check` also passed. Read-only comparison of two separately retained
official Java 6.8.21 installs produced the same fixed tree digest recorded by
the tool. The retained S007 managed JDT tree independently reproduced its
already-recorded fixed digest.

### Runtime verification still required

- Gate A did not invoke the production preparation path against the real
  inputs, so the composed real profile/index behavior remains unverified.
- No real helper was built, and no claim is made yet that the fixed source build
  produces the required executable or that the Java extension selects it.
- No real catalog was copied or refreshed, no Zed/CLI/proxy/JDT process was
  started, and no UI automation occurred.
- Catalog cache use, absence of the two attributed lookup contributions,
  direct `-data` selection, `ServiceReady`, two-run isolation, proxy cleanup,
  and normal-Zed restoration all remain Gate C runtime questions.
- Linux, Windows, x86_64, JDK 21, remote development, WSL, and every public
  support claim remain outside this result.

### Gate A conclusion and next gate

The Gate A implementation is ready for the separately authorized Gate B fixed
helper build and real preparation. This is an implementation-readiness result,
not evidence for the S008 runtime hypothesis.

## Gate B fixed helper build and real preparation result

Gate B completed on 2026-07-16 on the local macOS arm64/Temurin 25.0.3+9
tuple. It produced the real helper and final prepared inputs, but it did not
open either fixture in Zed, start an isolated project session, start the Java
proxy or JDT, refresh a catalog for a runtime run, or control the UI.

### Fixed Zed artifact recovery

The installed Zed app had automatically advanced from the planned 1.10.3 to
1.11.3 before Gate B. It was not downgraded, replaced, or modified. No local
copy of the fixed 1.10.3 CLI remained, so Gate B downloaded only the pinned
official
[Zed v1.10.3 Apple Silicon DMG](https://github.com/zed-industries/zed/releases/download/v1.10.3/Zed-aarch64.dmg)
on 2026-07-16 under ignored `tmp/` evidence. The release API reported, and the
download independently matched, size 143,545,589 and SHA-256
`717ab14826889b83ffb46992b5155cf3e32e801805044d5d739d893ffb19a1a0`.

Read-only mounting verified the APFS image checksum. `codesign --verify --deep
--strict` passed for identifier `dev.zed.Zed`, Team ID `MQ55VZLNZQ`, and the
Zed Industries Developer ID chain; `spctl` accepted it as a notarized Developer
ID app. Its bundle-local CLI reproduced the planned 3,570,560-byte SHA-256
`f1dad0ae519a201fc784c54369252c4a4ca2e13f2411707018ed8a95653d8215`
and reported Zed 1.10.3. The image was detached after preparation. The
downloaded DMG and one copied-out CLI remain ignored evidence; the copied-out
CLI is not a valid runtime launch input because it lacks its containing bundle.

### Helper build facts

- The clean source remained at commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, Git tree
  `fa498e0a79edcff6d59976af7c16a719fc9a1772`, with the fixed Cargo lockfile
  and task-helper manifest hashes.
- The active rustup toolchain was `stable-aarch64-apple-darwin`: Rust 1.97.0
  commit `2d8144b7880597b6e6d3dfd63a9a9efae3f533d3` and Cargo 1.97.0 commit
  `c980f4866141969fab6254a680546a277789d6f0`.
- `cargo build --release --locked -p java-task-helper` used a wholly new ignored
  `CARGO_TARGET_DIR`, completed without a lockfile/source change, and produced
  one 542,960-byte Mach-O 64-bit arm64 executable. `file`, `lipo`, and `otool`
  independently identified arm64; SHA-256 is
  `e9b1028b2fa5201c787bf2b22849a9ff11d0859fc5745fd59aaa20e77846e0e7`.

### Preserved preparation corrections

1. Pre-invocation review found that the original process scan searched every
   process argument for `java-lsp-proxy`, which could misclassify the
   preparation process's own input path. It now accepts the proxy executable
   name exactly and limits JDT argument matching to Java executables. Synthetic
   tests cover both positive runtime identities and the two false-positive
   shapes. No production destination existed when this was corrected.
2. The first production invocation used the byte-fixed CLI copied outside its
   app bundle. Its version command returned exit code 1 before transaction
   creation. All five destinations and every transaction path remained absent.
   The failed copied CLI is retained under ignored evidence.
3. The second invocation used the signed read-only bundle-local CLI and passed
   its identity check, then correctly rejected settings that still referenced
   the retained S007 proxy/debug paths. It failed before final movement and left
   all five newly named destinations and transaction paths absent.
4. The correction did not weaken previous-spike rejection. The tool now copies
   the exact official proxy and debug JAR into an explicit `fixed/` profile
   allowlist and writes settings against those final S008-local paths. Compiled
   and source-mode synthetic tests passed again before a third invocation used
   wholly new final destination names.

One independent `jq` validation expression and one Ruby assertion expression
also had command-syntax errors after successful preparation. Neither mutated
evidence. Corrected expressions were rerun and passed; these command failures
do not contribute to the preparation result.

### Confirmed final preparation facts

- The final profile contains 153 regular files, 31 directories, and no
  symlinks. Its roots are only `config`, `fixed`, `extensions`, and the
  49-key preparation manifest. There is no database, threads, provider/account
  state, unrelated extension, previous-spike path, log, prior JDT data, or
  proxy route record.
- The staged official Java 6.8.21 tree is byte-for-byte equal to its retained
  input and independently reproduces tree SHA-256
  `58e1155d9a6339790470e0b1ac31e49a7fd771a0412b168b22165433347fae68`.
  The single managed JDT tree is byte-for-byte equal to its input and reproduces
  `b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583`.
- The fixed profile proxy, debug JAR, and helper reproduce SHA-256 values
  `53ed618c...0076`, `52751959...a83c`, and `e9b1028b...e0e7`. The proxy and
  helper are executable, exactly one helper selection path exists, and exactly
  one managed JDT candidate exists.
- Settings SHA-256 is
  `0624babd5fa25f4a9491e33bf61073e5b9b42832fb451b2081d893e96dad392b`.
  It selects only `jdtls`, points to the final S008-local fixed proxy/debug,
  disables Lombok and JDK auto-download, sets `check_updates: "never"`, and
  contains no custom launcher or previous-spike/Spring server path.
- Preflight index SHA-256 is
  `a734897946e174c3e2b63058bec95b98c281da9fa28726eacc5881d46b70e6eb`.
  Independent JSON parsing found only official Java 6.8.21 with `dev: false`
  and only Java/Properties language entries.
- Each worktree contains only the fixed fixture at SHA-256
  `056ece24f7bb2feb0676898b31be2a6d81b23bf0cf34bc6e03ac07fb7ba85906`.
  Each XDG root contains only one 413,663-byte catalog at fixed SHA-256
  `f91a3840...4d02`; the two full-path run keys and expected data paths differ.
- Both expected data paths, both managed host fallbacks, both packaged-launcher
  fallbacks, and the empty proxy directory's records were absent. No proxy or
  JDT process existed. Independent manifest checks matched 13 fixed/dynamic
  identities, all 49 required keys, both run shapes, and every freshness rule.
- Approximately 800 GiB disk remained free and the host has 64 GiB memory.
  Source status remained clean after every build and verification.

### Normal-Zed observation and inference

Normal Zed was running from the installed 1.11.3 `/Applications` bundle at
preflight. Its process identity changed during the early copied-out-CLI
verification sequence, and the replacement normal process reported a start
time of 23:40:28 KST. The installed CLI remained byte-identical at SHA-256
`9289fa39...6975`, still reported 1.11.3, had no isolated arguments, and was
still running normally after the fixed DMG was detached.

The copied-out 1.10.3 CLI attempt may have contributed to that normal-app
restart, but the available process evidence cannot prove causation. Therefore
Gate B does not claim uninterrupted normal-Zed process identity. It does
confirm that no fixed 1.10.3 isolated project, proxy, JDT, or UI run began and
that the installed app was not replaced. Gate C must establish a new normal-Zed
baseline and log boundary before it deliberately stops the normal app.

### Runtime verification still required

- No runtime has shown that Java 6.8.21 selects the staged helper, bypasses its
  latest-release contribution, or uses the fresh embedded Gradle catalog
  without the attributed remote contribution.
- Neither run has started; direct command/JDK/JDT selection, exact `-data`,
  `ServiceReady`, data isolation, catalog stability, process exit, route
  cleanup, and normal-Zed restoration remain unverified.
- The catalogs' preparation mtimes are not runtime-freshness evidence. Gate C
  must reverify their bytes and refresh each copy exactly once immediately
  before its corresponding run.
- Gate C must remount and reverify the pinned signed 1.10.3 DMG and use only its
  bundle-local CLI. It must never use the installed 1.11.3 CLI or the retained
  copied-out 1.10.3 CLI.
- Linux, Windows, x86_64, JDK 21, remote development, WSL, and public support
  claims remain untested or outside scope.

### Gate B conclusion and next gate

The final fixed helper and preparation outputs are ready for Gate C preflight.
The two rejected preparation paths and the unexplained normal-Zed restart are
retained constraints, not erased successes. This remains preparation evidence,
not support for the S008 runtime hypothesis. Gate C requires a new explicit
continuation and must begin by reviewing this result, establishing a fresh
normal-Zed/log boundary, remounting the signed fixed app, and reverifying every
prepared identity before any UI restriction or runtime input.
