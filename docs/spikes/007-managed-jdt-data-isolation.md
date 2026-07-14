# S007: Managed-local JDT data isolation through the Zed CLI

- Status: Gate B fixed preparation and profile transition complete and
  reviewed; Gate C not started
- Date: 2026-07-15
- Related decision: D001
- Related research: R001, R003, R004
- Depends on: S003-S005 Supported locally; S006 Inconclusive before hypothesis
  input
- Implementation gate: Gate C closed until a later explicit continuation

## Hypothesis

On the fixed macOS arm64/JDK 25 tuple, official Zed Java extension 6.8.21 can
start the pinned JDT LS 1.60.0 from its existing managed-local installation
path, without a configured `jdtls_launcher` and without a network lookup, while
the official embedded Zed CLI supplies a per-run `XDG_CACHE_HOME` to the
worktree environment.

For each of two fresh worktrees, the unmodified Java extension will construct a
direct Java/proxy command containing exactly one explicit `-data` argument equal
to:

```text
<run-specific-XDG_CACHE_HOME>/jdtls-<SHA-1(absolute-worktree-root)>
```

The real JDT process will use that exact empty-at-launch location and reach
`ServiceReady`. It will not start the packaged Python launcher, create either a
managed-path or packaged-launcher fallback under the host cache, select another
JDT installation, or reuse the first run's data.

This hypothesis tests one launch-and-data-isolation prerequisite only. It does
not start Spring Tools, inject a bundle, exercise a callback, request a
completion, select a product architecture, or reopen S006.

## Decision this spike informs

S006 could not start its accepted end-to-end run because its fixed custom JDT
launcher selected a host cache rather than the reviewed prepared data path.
Source review after S006 established that this was the launcher's documented
code path on Darwin, not evidence that macOS or Zed dropped
`XDG_CACHE_HOME`.

- A Supported result permits planning a new end-to-end spike that uses the
  official Java extension's managed-local JDT launch path. It does not change
  S006's Inconclusive result or authorize product scaffolding.
- A Refuted result shows that the existing managed-local path cannot provide
  the required attributable data isolation on the fixed tuple. Only then may a
  separately planned comparison consider a narrow upstream Java-extension
  setting, disposable wrapper, or other explicit `-data` mechanism.
- An Inconclusive result permits only an evidence, freshness, CLI attribution,
  or preparation correction. It does not permit another Spring end-to-end run.

## Why runtime verification is required

Pinned source establishes the intended branches but cannot prove their actual
composition in the installed Zed build:

- the Java extension can choose a pre-existing managed JDT directory when
  update checks are disabled;
- its managed branch constructs Java arguments itself and includes `-data`;
- its macOS data-path function prefers worktree `XDG_CACHE_HOME`;
- Zed's project environment prefers an inherited CLI environment over a new
  worktree shell capture; and
- the embedded CLI exposes `--foreground` and `--user-data-dir`.

Runtime evidence is still required to show that the exact installed CLI sends
its environment to the isolated project, the installed Java extension selects
the one staged managed JDT directory, the final proxy and JVM argument vectors
remain equal to the source expectation, JDT accepts the direct launch, and no
host or previous-run data contributes to success.

## Scope boundaries

Included:

- fixed Zed 1.10.3 build `20260713.002323` and its embedded signed CLI;
- official installed Java extension 6.8.21 without source modification;
- pinned JDT LS 1.60.0 staged as the only managed-local JDT directory under the
  retained isolated Java extension work directory;
- fixed official Java proxy and Java debug bundle from the 6.8.21/S003-S005
  baseline;
- `check_updates: "never"`, disabled Lombok and JDK auto-download, an explicit
  JDK 25 path, and no `jdtls_launcher` setting;
- two dependency-free Java worktrees, two distinct `XDG_CACHE_HOME` roots, and
  two distinct expected JDT data directories;
- official embedded CLI foreground launch, real JDT initialization,
  `ServiceReady`, process arguments, data creation, shutdown, route cleanup,
  and normal-Zed restoration evidence; and
- macOS arm64/JDK 25 only.

Excluded:

- Spring Boot LS, Spring JDT bundles, S006 proxies, Maven/Gradle import,
  `server.port`, completion UI, callbacks, or Java-data requests;
- modification or replacement of Zed, the Java extension WASM, Java proxy,
  JDT LS binaries, or the packaged JDT launcher;
- a wrapper, coordinator, launcher module, installer, server manager, or
  production implementation;
- automatic downloads, update checks, mutable `latest` selectors, or network
  resolution during the runtime gate;
- editing the user's shell startup files, global environment, normal Zed
  settings, or personal Java extension installation;
- using `.envrc`, direnv, `launchctl setenv`, or macOS application-service
  inheritance as a substitute for the fixed embedded-CLI path;
- project intelligence quality, debugging, tasks, Lombok, multiple projects in
  one process, or resource-budget claims;
- SSH remote development, WSL, containers, or remote projects; and
- conclusions for Linux, Windows, x86_64, JDK 21, or any other untested tuple.

## Confirmed facts and primary sources

All web sources in this section were accessed on 2026-07-15. Local source and
binary identities were rechecked on the same date.

### S006 custom-launcher cause

- The pinned JDT LS
  [`jdtls.py`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.product/scripts/jdtls.py)
  uses `%APPDATA%` on Windows, `$HOME/Library/Caches` on Darwin, and
  `$HOME/.cache` on Linux. Its Darwin branch does not read
  `XDG_CACHE_HOME`. It hashes the current directory basename, nests the result
  under `jdtls/`, and permits an explicit `-data` argument to override that
  default.
- The exact extracted 4,984-byte script used by S006 is retained under ignored
  S006 evidence at SHA-256
  `ba1f8d2978d985fe3a56f06172dc71912d7e2c8280763f006fecdd8ee887c363`.
  S006's actual JVM command used the
  corresponding host-cache default. The launch environment reported the
  planned XDG value, and JDT inherited the separately supplied Java options,
  but those observations alone did not prove that the Python child received
  XDG. The pinned Darwin branch makes that ambiguity immaterial because it does
  not read XDG in either case.
- The fixed Java extension
  [`jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs)
  passes a configured `jdtls_launcher` as the child executable and does not add
  a data argument. Therefore S006 delegated data selection to the packaged
  Python launcher exactly as observed.

These facts supersede the earlier S006 inference that Zed or macOS might have
removed `XDG_CACHE_HOME` before the launcher read it.

### Existing managed-local Java-extension path

The fixed official Java extension source is commit
`9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, released as 6.8.21.

- [`downloadable.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/downloadable.rs)
  and `should_use_local_or_download` require a local installation when
  `check_updates` is `never`; absence is an error instead of permission to
  download.
- [`jdtls.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls.rs)
  searches `jdtls/` in the extension work directory and selects the most
  recently created directory. S007 will make the candidate set exactly one,
  so creation-time ordering cannot choose an unknown version.
- In the same source, the managed branch invokes Java directly, selects
  `config_mac_arm` on macOS arm64, and appends one `-data` argument. Its data
  path is the platform cache root plus
  `jdtls-<SHA-1(worktree.root_path())>`; on macOS it prefers
  `worktree.shell_env()`'s `XDG_CACHE_HOME` and otherwise falls back to
  `$HOME/Library/Caches`.
- The custom-launcher branch and managed branch are mutually exclusive. Removing
  `jdtls_launcher` from the isolated settings is therefore a functional input,
  not a cosmetic settings change.
- The installed Java extension in the retained isolated profile is exactly
  version 6.8.21. Its WASM SHA-256 is
  `62dbf7edbe1ef4066f74e588dcec68d223ab7984f1861b59e44db0b10f52e3fd`,
  and its manifest SHA-256 is
  `db05627157294b03a3e09cdf72fad1ada97506cd49c0c262caf979524f564f7b`.

### Zed project environment and embedded CLI

- The exact tested Zed source commit is
  `0c54c414d522234de7298039708ffe85a116892a`. Its
  [`ProjectEnvironment`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/project/src/environment.rs)
  returns the inherited CLI environment first when a project was opened from
  the CLI. Only a project without that CLI environment launches a system shell
  in the worktree directory to capture variables.
- Zed's official
  [extension-development documentation](https://zed.dev/docs/extensions/developing-extensions)
  directs WASM extensions to use `Worktree` environment methods instead of
  process-global `std::env`, and documents `--foreground` for terminal-driven
  debugging.
- The signed local app contains a separate embedded CLI at
  `/Applications/Zed.app/Contents/MacOS/cli`. Its own help identifies it as the
  binary that invokes Zed and exposes `--foreground`, `--user-data-dir`, and
  `--new`. The 3,570,560-byte CLI is SHA-256
  `f1dad0ae519a201fc784c54369252c4a4ca2e13f2411707018ed8a95653d8215`.
- No global `zed` command is currently installed. S007 will invoke the exact
  embedded binary by absolute path and will not alter the user's shell or
  install a symlink.

### Fixed local tuple

| Component | Fixed identity | S007 role |
| --- | --- | --- |
| macOS | 26.5.1, build `25F80`, arm64 | Only runtime host |
| Zed | 1.10.3, build `20260713.002323`, source `0c54c414...892a` | Client and project environment |
| Embedded CLI | 3,570,560 bytes; SHA-256 `f1dad0ae519a201fc784c54369252c4a4ca2e13f2411707018ed8a95653d8215` | Foreground isolated launch with per-run environment |
| Java extension | 6.8.21, source `9148b897...970d` | Unmodified managed-local JDT launch |
| JDT LS | 1.60.0 archive, 50,925,681 bytes; SHA-256 `e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d` | Real server, staged locally |
| Java proxy | Official 6.8.21 binary, 834,304 bytes; SHA-256 `53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076` | Unmodified stdio proxy |
| Java debug | 0.53.2, 3,107,682 bytes; SHA-256 `5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c` | Preserve normal Java initialization |
| Java | SDKMAN Temurin 25.0.3+9 | JDT runtime and preparation tool |
| Fixture | One package-free `S007Fixture.java` | Activate Java/JDT only |

## Inferences

1. Opening each worktree through the embedded CLI with a run-specific
   `XDG_CACHE_HOME` should cause `worktree.shell_env()` to return that value
   because the exact Zed source prefers its inherited CLI environment.
2. Staging the pinned extraction as the only directory under the isolated Java
   extension's managed `jdtls/` directory should satisfy
   `check_updates: "never"` without any network access.
3. Removing the custom launcher should make the Java extension build the direct
   Java argument vector, so its source-level `-data` calculation—not the
   packaged Python script—owns the path.
4. Two absolute worktree roots and two XDG roots make both the hash suffix and
   parent directory distinct. Reusing data would therefore be directly
   observable rather than inferred from timestamps.
5. A dependency-free Java file is sufficient to start JDT and reach
   `ServiceReady`; Maven, Spring, and build output are unrelated to this
   prerequisite.

## Unverified hypotheses and runtime items

1. The embedded CLI's inherited environment reaches the exact isolated project
   when normal Zed is stopped and `--user-data-dir` plus `--new` are used.
2. The installed Java WASM sees the staged JDT directory inside its retained
   extension work area and does not attempt a version fetch.
3. The managed direct-launch path accepts the pinned pre-extracted JDT layout
   and selects `config_mac_arm`.
4. The Java proxy preserves the explicit `-data` argument and starts the real
   JVM in the requested directory.
5. JDT reaches `ServiceReady` twice without a host fallback, stale project,
   packaged Python process, duplicate JDT process, or unexpected download.
6. Foreground CLI shutdown removes the proxy record and all isolated children
   cleanly enough to make the second run attributable.

## Disposable artifact layout

Gate A may add only this minimal tracked structure after a later explicit
continuation:

```text
spikes/s007-managed-jdt-data/
├── fixture/
│   └── S007Fixture.java
└── tools/
    └── PrepareS007.java
```

No extension manifest, WASM, Java-extension patch, wrapper, shell script,
native launcher, proxy fork, Spring artifact, or production module is permitted
by this plan.

## Gate A: disposable preparation implementation

Gate A requires a new explicit continuation after this plan and review record
are committed. It may implement only `PrepareS007.java` and the fixed Java
fixture.

The preparation tool must:

1. compile with the fixed JDK using `--release 21 -Xlint:all -Werror` and use
   only JDK APIs;
2. verify the pinned JDT archive, official proxy, debug JAR, Java-extension
   source commit, installed Java version/WASM/manifest, embedded CLI, fixture,
   and destination identities before writing output;
3. safely extract the fixed JDT TAR/GZIP into one staged managed installation,
   rejecting absolute paths, traversal, links, devices, unsupported PAX fields,
   duplicate entries, entry-count/size limits, and missing launch/config files;
4. create two distinct fresh worktrees and two distinct empty XDG roots, then
   compute the expected cache name from the full normalized absolute worktree
   string using SHA-1 exactly as the pinned Java source does;
5. generate isolated settings with Java as the only relevant extension/server,
   exact proxy/debug/JDK paths, `check_updates: "never"`, disabled Lombok and
   JDK auto-download, and no `jdtls_launcher` key;
6. generate a manifest containing all input hashes, the exact staged JDT
   aggregate identity, both worktree roots, both XDG roots, both expected data
   paths, and the expected `config_mac_arm` path;
7. reject any destination, worktree metadata, data directory content, matching
   host fallback, prior Java proxy record, existing JDT process, or unknown
   managed JDT sibling; and
8. write all mutable output transactionally under ignored `tmp/` paths.

Synthetic tests must cover safe extraction, malicious archive rejection,
full-path rather than basename hashing, Unicode/space paths, distinct run keys,
existing-destination rejection, settings absence of `jdtls_launcher`, exactly
one managed candidate, and manifest completeness.

Gate A stops after source review, synthetic tests, and `git diff --check`. It
must not modify the retained profile, extract a real artifact through the
production path, start Zed/JDT, or use UI automation.

### Gate A implementation and review result

Gate A completed on 2026-07-15 without running the production preparation path.
It added only the reviewed package-free `S007Fixture.java` and
`PrepareS007.java` under `spikes/s007-managed-jdt-data/`.

#### Confirmed facts

- `PrepareS007` uses only JDK APIs and has no downloader, network client,
  mutable version lookup, wrapper, launcher replacement, proxy modification, or
  Zed-extension code.
- Its production path fixes and verifies the JDT archive, official proxy,
  debug JAR, Java extension WASM/manifest, Java source commit, embedded CLI,
  Temurin JDK, fixture, Java work directory, and five fresh output identities
  before creating a transaction directory.
- The TAR/GZIP reader bounds entries and bytes, verifies header checksums and
  two-block termination, permits only regular files/directories plus narrow
  local metadata PAX records, and rejects traversal, absolute/drive paths,
  invalid UTF-8, control characters, duplicate entries, links, devices, global
  or unsupported PAX data, missing runtime layout, and incomplete archives.
- The generated settings select only `jdtls` for Java, pin the Java home,
  proxy, and debug paths, disable Lombok/JDK auto-download, set update checks to
  `never`, and contain no `jdtls_launcher` key.
- The generated manifest records every fixed input hash, the deterministic JDT
  tree identity, one planned managed candidate/config path, both absolute
  worktree hashes, both XDG/data paths, both host-fallback shapes, and the
  settings identity.
- Warning-as-error compilation passed with Temurin 25.0.3 using
  `javac --release 21 -Xlint:all -Werror`. The compiled-class self-test and Java
  source-file-mode self-test both reported
  `S007 preparation synthetic tests passed`; `git diff --check` also passed.

#### Synthetic conditions exercised

- safe required-layout extraction and deterministic tree hashing;
- traversal, absolute path, symbolic-link, device, duplicate-entry,
  unsupported-PAX, and entry-size rejection with failed-output cleanup;
- a missing JDT layout and a second managed candidate;
- full absolute-path rather than basename hashing, including an independent
  fixed UTF-8 SHA-1 value and Unicode/space paths;
- distinct run data identities and existing-destination rejection; and
- Java-only settings without a custom launcher plus complete/incomplete
  manifest controls.

#### Unverified runtime and production items

- The production preparation path has not been invoked against the real pinned
  archive or retained profile, so real archive compatibility, its aggregate
  tree hash, fixed-input revalidation, and transactional output are not yet
  observed facts.
- No managed JDT candidate, proxy, debug JAR, settings, worktree, XDG root, or
  data path was staged for runtime use. The ignored
  `tmp/s007-gate-a-classes/` contains only disposable local compilation output.
- No Zed, Java proxy, or JDT process was started; no profile, normal setting,
  host cache, S006 evidence, or global environment was changed.

Gate A review found and corrected two boundary gaps before closure: the reader
now rejects non-round-trippable UTF-8/control/drive-prefixed TAR paths and
requires the standard two zero end blocks. Gate B remains closed.

The first combined final-validation command passed compilation and both
self-tests, then used `git check-ignore --quiet` with two path arguments, which
Git rejects as command misuse. The check was rerun once per ignored compilation
directory and both paths passed; this correction did not change source or test
output.

## Gate B: fixed preparation and isolated-profile transition

Gate B requires another explicit continuation after Gate A review. It may:

1. reverify every fixed input and run the preparation production path once;
2. preserve the retained profile state and every S006 ignored evidence path
   before changing the isolated profile;
3. remove S006 only from the isolated profile's active index/symlink while
   preserving its tracked source and ignored prior evidence;
4. stage exactly one verified pinned JDT extraction under
   `extensions/work/java/jdtls/<fixed-build-directory>`;
5. apply the generated Java-only settings and prove byte equality with the
   prepared settings;
6. verify the profile index contains official Java 6.8.21 and no S003-S006
   development extension relevant to Java;
7. verify both worktrees, both XDG roots, both expected data paths, both managed
   host-fallback paths, both packaged-launcher fallback paths, proxy records,
   and process space are fresh; and
8. record point-in-time disk/memory availability and all prepared hashes.

Gate B stops before invoking the embedded CLI, opening Zed, starting the proxy
or JDT, or controlling the UI.

### Gate B preparation and review result

Gate B completed on 2026-07-15 on the fixed macOS arm64/JDK 25 tuple. It did
not invoke the embedded CLI, open isolated Zed, start a Java proxy/JDT process,
or control the UI.

#### Preserved state

- The complete 27 MiB retained isolated profile was copied under ignored
  `tmp/s007-gate-b-preserved-20260715T055520/profile-before/` before mutation.
  File-by-file SHA-256 for 192 files, two link targets, and 82 directory names
  matched the source profile.
- The initial TAR-stream hashes of the source profile and identical copy did
  not match even though `diff -qr` and the file/link/directory manifests did.
  This failed comparison is retained; metadata-bearing TAR stream hashes were
  rejected as the preservation identity rather than treated as content hashes.
- All 15 pre-existing top-level ignored S006 paths remain in place. They
  contain 9,492 regular files and one link; no regular-file or link timestamp
  became newer than the pre-preservation boundary. The Java source checkout
  remains clean at commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`.
- The combined S006 TAR-stream hash also differed before and after even though
  no file/link timestamp changed; only the checkout `.git` directory timestamp
  changed when the preparation verifier ran `git status`. Both unreliable TAR
  hashes and a current file-by-file SHA-256 manifest are retained. No S006
  tracked source, Gate C evidence directory, log, screenshot, binary, or data
  directory was removed or rewritten.

#### Failed and corrected preparation

1. The first real preparation invocation reverified its inputs and extracted
   in a transaction, then failed before every final move with
   `generated settings exceed S007 scope`. Source review found that
   `verifySettings` rejected the substring `spring`, which also occurs in this
   repository's `zed-spring-tools` path. All five intended destinations and the
   transaction directory were absent afterward; the profile was unchanged.
2. The failed observation is retained under ignored
   `tmp/s007-gate-b-rejected-preparation-20260715T055520/`. The check was
   narrowed to actual S006/Spring language-server identifiers, and a generated
   path containing `zed-spring-tools` was added to the synthetic regression.
   Warning-as-error Java 21 compilation and both compiled/source-mode self-tests
   passed again.
3. The corrected production invocation used five wholly new destination names
   and completed. This is a preparation-only correction; it cannot contribute
   a runtime success or erase the first failed invocation.

#### Confirmed prepared and profile facts

- The corrected production path reverified the full hashes recorded above for
  JDT LS 1.60.0, official Java proxy, Java debug 0.53.2, installed Java 6.8.21
  WASM/manifest, embedded Zed CLI, fixture, source commit, and Temurin
  25.0.3+9.
- Safe extraction produced 128 regular JDT files and deterministic tree
  SHA-256
  `b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583`.
  The prepared `config_mac_arm` and single Equinox launcher were present.
- Generated settings SHA-256 is
  `bd83b4bbc5116e6d116ab5ba8d3e2f7b4a73110cc5b6e32a831779cbc117f87b`.
  The active isolated settings are byte-identical and contain no custom
  launcher or Spring server.
- The isolated Java work directory now contains exactly one managed JDT
  directory with the fixed build name. File-by-file hashes and directory lists
  equal the prepared extraction. The active extension index SHA-256 is
  `14b1ea782b1793f5ec2b2df43c8d0bfb2cc298cf3508103480e61387db06effa`.
- The isolated index contains official Java 6.8.21 with `dev: false`; the S006
  development entry/link is absent, as are all S003-S006 Java-relevant
  development links. Its tracked source and prior ignored evidence remain.
- Both prepared worktrees contain only the byte-identical package-free fixture.
  Both XDG roots are empty; both expected data paths, both managed host
  fallbacks, and both packaged-launcher host fallbacks are absent. The two
  full-worktree SHA-1 keys and expected data paths differ.
- The Java proxy record directory is empty and no JDT process exists. Normal
  Zed remained running on its normal profile and was not controlled.
- Point-in-time capacity was approximately 802 GiB free disk with 64 GiB
  installed memory. Raw manifests, paths, file hashes, and resource output stay
  under ignored Gate B evidence.

One combined freshness command was also corrected: assigning an expected path
to zsh's special `path` array removed commands from that subprocess's `PATH`.
The subprocess ended without a profile/global environment change; the complete
check was rerun with a non-special variable and passed.

#### Remaining uncertainty

- No runtime has proved that Zed selects this managed candidate, receives the
  CLI-supplied XDG value, constructs the reviewed direct Java command, or uses
  either expected data path.
- `ServiceReady`, process cleanup, proxy-record cleanup, network/update absence
  during startup, and normal-Zed restoration after isolated execution remain
  Gate C requirements.

Gate B is closed. Only a later explicit continuation may open Gate C.

## Gate C: two fresh local runtime runs

Gate C requires an explicit continuation after Gate B review.

### Shared preflight

1. Reverify normal Zed can be stopped and restored, all fixed/profile/prepared
   hashes, the single managed JDT candidate, settings, worktrees, XDG roots,
   expected data paths, fallback absence, process absence, and proxy-record
   absence.
2. Warn the user not to use keyboard or mouse before any permitted UI
   automation and release that restriction immediately after isolated Zed is
   stopped.
3. Record the normal-Zed state and the initial Zed log boundary without
   truncating or deleting earlier observations.

### Run 1

1. Stop normal Zed and invoke the exact embedded CLI in foreground with only
   run 1's `XDG_CACHE_HOME`, isolated `--user-data-dir`, `--new`, and run 1
   worktree. Do not use `open`, `launchctl`, a shell-startup edit, or a global
   CLI symlink.
2. Open only `S007Fixture.java` through bounded UI automation to trigger Java.
   Do not invoke completion, editing, build import, debug, task, or command
   actions.
3. Require Zed's LSP start log to show the official proxy and a direct Java
   child argument vector. The vector must contain the fixed Equinox launcher,
   `config_mac_arm`, exactly one `-data`, and the run 1 expected path; it must
   contain no packaged `bin/jdtls`, `jdtls.py`, second data argument, or unknown
   JDT path.
4. Require the actual JDT process argument vector and created filesystem state
   to match the same expected path before accepting `ServiceReady`.
5. Verify no host fallback, run 2 data, network/update attempt, duplicate JDT,
   unknown bundle, project metadata, or build output appears.
6. Record bounded timing, process RSS, redacted log evidence, data-file count,
   process cleanup, and proxy-record cleanup; stop isolated Zed and retain run
   1 data unchanged as ignored evidence.

### Run 2

Repeat the same procedure with run 2's different worktree and XDG root. Run 2
must not reuse, modify, or reference run 1 data. It must independently reach
`ServiceReady`, then clean up before normal Zed is restored without the
isolated profile.

No setup correction is permitted after a real proxy or JDT process starts. A
failure before either child starts may be corrected only once from wholly new
prepared destinations after the rejected state is preserved. Any other retry
requires a new gate decision and cannot contribute to Supported.

### Time bounds

- 30 seconds for the foreground isolated Zed process to appear;
- 30 seconds for the proxy/JDT process and exact `-data` vector to appear;
- 90 seconds for run 1 `ServiceReady` and 60 seconds for run 2;
- 10 seconds for graceful JDT/proxy cleanup; and
- 15 seconds for normal Zed restoration.

Timeouts are preserved and classified; they are not extended ad hoc.

## Success criteria

S007 is Supported on macOS arm64/JDK 25 only if both fresh runs satisfy all of
these:

1. Every fixed Zed, CLI, Java extension, JDT archive/extraction, proxy, debug,
   JDK, settings, profile, worktree, and expected-path identity matches the
   reviewed plan.
2. Official Java extension 6.8.21 selects the only staged managed JDT directory
   with `check_updates: "never"`; no lookup, download, update, wrapper, custom
   launcher, or modified Java extension contributes.
3. Zed starts one official proxy and one real pinned JDT process with a direct
   Java command containing exactly one explicit `-data` equal to the expected
   per-run path and `config_mac_arm`.
4. The expected data path is absent or empty at launch, becomes the only JDT
   data location for that run, and contains attributable real JDT state before
   `ServiceReady`.
5. Neither managed host fallback nor packaged-launcher host fallback is created
   or modified; no previous or other-run data is read or written.
6. The two absolute worktrees, XDG roots, hash suffixes, actual data paths, JDT
   processes, and retained evidence sets are distinct.
7. Both runs reach `ServiceReady` with the one Java fixture and no attributable
   JDT configuration, classloading, project, or protocol error.
8. Both isolated runs remove their child processes and proxy records, the
   temporary environment does not remain globally active, and normal Zed is
   restored.
9. Committed evidence contains no private absolute path, environment dump,
   token, port, raw process command, binary, or third-party artifact.

## Failure and classification criteria

S007 is Refuted on the tested tuple if all identities and freshness checks pass
but either run reproducibly:

- omits, duplicates, or changes the explicit `-data` argument;
- selects a host fallback or another managed JDT directory;
- starts the packaged Python launcher or requires a wrapper/Java-extension
  modification;
- cannot start the fixed JDT layout or cannot reach `ServiceReady` through the
  managed direct path; or
- reuses the other run's data despite distinct reviewed inputs.

S007 is Inconclusive if CLI ownership, profile identity, managed-directory
selection, process argument attribution, data freshness, log boundaries, user
input, timeout cause, cleanup, or required evidence is insufficient. A network
attempt, stale cache, unexpected extension, duplicate server, UI interruption,
or hidden correction is never deleted to obtain Supported.

## Evidence and privacy rules

- Keep the pinned archive, extracted JDT runtime/data, proxy/debug binaries,
  isolated profile, worktrees, CLI/JDT process output, process listings, proxy
  records, screenshots, and raw logs under ignored `tmp/` paths.
- Commit only the reviewed plan, later disposable source/test text, and redacted
  structural summaries.
- Preserve failed preparation, launch, environment, `-data`, timeout, shutdown,
  and cleanup observations with exact local hashes before any move.
- Summaries may record versions, counts, truncated hashes, timing ranges,
  presence/absence, path equality, and whether two paths differ. They must not
  publish the user's home path, full environment, token, port, or raw command.
- Update this document, the spike index, prerequisites, and decision readiness
  after every opened gate.

## Blockers and constraints

- Managed-local staging is an existing Java-extension behavior but is not yet a
  documented end-user artifact-pinning workflow.
- `find_local` selects the newest directory when multiple candidates exist;
  S007 avoids that ambiguity rather than proving general selection stability.
- The embedded CLI path is macOS-app-specific in this experiment. Product code
  still must use platform-aware Zed/worktree APIs and cannot depend on this test
  command as a cross-platform installer or launcher.
- The public Java extension has no explicit custom-launcher data-path setting.
  S007 deliberately tests the existing managed path before proposing such an
  upstream change.
- S007 does not address the unhandled Spring lifecycle command, classpath
  callback topology, distribution licensing, or VS Code Spring Tools parity.

## Candidate next experiment

- If Supported, write and review a new end-to-end spike that reuses the proven
  managed-local preparation and two-run data isolation, then independently
  reevaluates the Spring lifecycle command before any completion input.
- If Refuted, compare only the smallest explicit `-data` alternatives supported
  by evidence: first a narrow upstream Java-extension configuration change,
  then a disposable wrapper only if the upstream surface cannot express the
  requirement.
- If Inconclusive, correct only the named attribution or freshness gap in a new
  plan. Do not add Spring to the same retry.

## Plan review checklist

Before implementation can begin, verify that the plan:

- tests only managed-local JDT selection and data isolation;
- uses exact existing Zed/Java/JDT/proxy/debug identities;
- explains why S006's custom launcher ignored XDG on Darwin;
- uses no Java extension, proxy, JDT, or Zed modification;
- prevents every download and unknown managed candidate;
- fixes the full-path SHA-1 rule and both expected paths before runtime;
- requires direct process-argument and filesystem attribution twice;
- checks both relevant host fallback shapes;
- contains no Spring, build import, callback, completion, wrapper, or product
  component;
- preserves failed and cleanup evidence and normal Zed;
- retains local-only wording and all untested platform labels; and
- stops at a new end-to-end plan even if Supported.

## Plan review record

Reviewed on 2026-07-15 before implementation. The review made or confirmed
these changes:

1. It rejected the initial application-launch comparison premise after exact
   `jdtls.py` review showed that the fixed Darwin branch ignores
   `XDG_CACHE_HOME`; the S006 observation is no longer attributed to an
   unproven Zed/macOS environment boundary.
2. It deferred both a disposable wrapper and a Java-extension patch because the
   existing managed-local branch already constructs an explicit `-data`
   argument.
3. It distinguished the packaged launcher's basename hash and nested
   `jdtls/jdtls-*` cache from the Java extension's full-worktree-path hash and
   direct `jdtls-*` cache, and requires checks for both fallback shapes.
4. It fixed selection to one verified managed JDT candidate with update checks
   disabled and exact proxy, debug, JDK, WASM, manifest, CLI, and archive
   identities.
5. It requires two fresh worktrees and XDG roots, direct proxy/JVM argument
   attribution, `ServiceReady`, cleanup, and normal-Zed restoration in both
   runs.
6. It keeps Spring, callbacks, completion, product scaffolding, architecture,
   packaging, and multiplatform support claims outside this prerequisite.

No S007 code, fixture, managed JDT staging, isolated-profile mutation, Zed
launch, JDT process, or UI automation occurred during planning or plan review.
The later Gate A implementation and review are recorded separately above.
