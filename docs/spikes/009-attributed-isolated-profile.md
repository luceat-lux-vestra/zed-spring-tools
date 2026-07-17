# S009: Source-controlled isolated-profile JDT startup

- Status: Gate B complete and reviewed; Gate C not started
- Date: 2026-07-17
- Related decision: D001
- Related research: R003, R006, R007
- Depends on: S008 Inconclusive after two direct-path successes
- Implementation gate: Gate C requires a later explicit continuation

## Hypothesis

On the fixed macOS arm64/JDK 25 tuple, one wholly new Zed 1.10.3 isolated
profile can start the already-proven fixed managed JDT path without S008's four
profile-attribution failures when it applies the source-supported controls from
R007:

- `session.trust_all_worktrees: true` only in the disposable profile;
- `auto_install_extensions.html: false` and
  `auto_update_extensions.java: false`;
- top-level `disable_ai: true`; and
- fresh run-specific XDG config/cache/data/state roots with both Copilot OAuth
  environment variables (`GH_COPILOT_TOKEN` and `GITHUB_COPILOT_TOKEN`) absent.

The CLI will open one new worktree and its contained Java fixture directly,
without trust UI input. The extension index will remain Java-only, no Copilot
`auth.db` or ChatGPT Subscription authentication warning will occur, and the
fixed Java proxy/JDK/JDT will use exactly one precomputed managed `-data` path
and reach `ServiceReady`. Source-expected editor directories and databases may
be created under the isolated profile; they will be inventoried and attributed
rather than treated as normal-profile leakage merely because they exist.

## Decision this spike informs

- A Supported result closes the profile-attribution prerequisite and permits a
  separately written and reviewed Spring end-to-end PoC plan using the fixed
  S008 helper/catalog/data/cleanup procedure plus the S009 controls.
- A Refuted result shows that at least one fixed source-supported control cannot
  compose with an otherwise proven managed-JDT start on this tuple. A later
  source investigation must isolate only that control.
- An Inconclusive result preserves an identity, environment, UI, timing,
  provider, or evidence gap for a new plan; S009 is not retried in place after
  a real proxy/JDT child starts.

No result authorizes product scaffolding, a Spring runtime inside S009,
publication, packaging, CI, or a platform support claim.

## Why runtime verification is required

R007 proves each fixed source branch separately, but not their composed signed-
application behavior:

- settings merging must apply the three profile controls before worktree trust,
  extension auto-install, and panel initialization;
- the foreground bundle launch must preserve all four XDG roots and absent
  Copilot token variables;
- disabling AI must prevent provider enumeration without preventing Java/JDT;
- supplying the worktree and contained fixture to the CLI must open Java
  without bounded UI automation; and
- the fixed S008 helper/catalog/direct-data path must remain valid under the new
  controls.

## Scope boundaries

Included:

- the exact signed Zed 1.10.3 Apple Silicon bundle and source commit
  `0c54c414d522234de7298039708ffe85a116892a`;
- official Java extension 6.8.21, managed JDT LS 1.60.0, fixed source-built
  helper, fixed Gradle catalog, official proxy, Java debug bundle, and Temurin
  25.0.3 identities already established by S008;
- one new Java-only profile, one fixture-only worktree, one XDG root set, one
  absent-at-launch expected JDT data path, and one foreground run;
- source-derived profile settings, extension/index identity, provider-warning
  absence, exact process/data attribution, bounded shutdown, explicit route
  cleanup, shared macOS log/temp/state boundaries, and normal-Zed restoration;
  and
- macOS arm64/JDK 25 only.

Excluded:

- a second isolation run, because S008 already proved two distinct direct data
  paths and unchanged Run 1 data during Run 2;
- Spring LS/bundles, Maven/Gradle project import, completion, callbacks, tasks,
  debug, Lombok, Java commands, or product behavior;
- changes to Zed, Java WASM, JDT LS, Buildship, the proxy, debug bundle, helper,
  normal Zed settings, normal credentials, or shell startup files;
- deletion or inspection of the user's real Copilot database or system
  credentials;
- packet capture, complete network-silence claims, or prohibiting every core
  editor database/directory;
- a wrapper, coordinator, installer, launcher, server manager, production
  manifest/build, packaging, release automation, CI, or architecture; and
- Linux, Windows, x86_64, JDK 21, remote development, WSL, containers, or any
  public support claim.

## Confirmed facts and fixed inputs

R006, R007, and S008 fix the following:

| Input or behavior | Fixed fact | S009 rule |
| --- | --- | --- |
| Zed | Signed/notarized 1.10.3 bundle; source `0c54c414...892a` | Reverify DMG, bundle, and embedded CLI before runtime |
| Java | Official 6.8.21 WASM/install tree | Copy unchanged; exactly one Java extension |
| JDT | Managed 1.60.0 with fixed macOS arm64 config and Equinox launcher | Exactly one candidate and one direct `-data` |
| Helper | 542,960-byte arm64 binary, SHA-256 `e9b1028b...e0e7` | Reuse retained fixed binary; do not rebuild or download |
| Gradle catalog | 413,663 bytes, SHA-256 `f91a3840...4d02` | Fresh fixed copy; content/mtime unchanged during run |
| Trust | Default false causes restricted mode; true bypasses the check without persistence | Set true only in isolated settings; no trust UI action |
| HTML | Default auto-install is true | Set `html: false`; require Java-only post-run index |
| Java updates | Extension auto-update is independently configurable | Set Java false for identity stability; make no network-silence claim |
| Copilot | Reads `XDG_CONFIG_HOME` or normal `~/.config`, not custom Zed config | Fresh XDG config; token variables confirmed absent without printing values |
| ChatGPT warning | Native-agent model enumeration authenticates visible providers | Set top-level `disable_ai: true`; require no agent panel/provider-auth warning |
| Core editor state | Zed intentionally creates profile directories and databases | Inventory against a source-derived allowlist; do not demand an empty post-run profile |
| macOS log/temp/state | Fixed Zed paths are not all relocated by custom data or XDG | Stop normal Zed; record exact boundaries; make no full-sandbox claim |
| Proxy route | Automatic deletion is best effort | Require process absence; preserve then explicitly remove any record |

## Inferences and unverified hypotheses

1. Settings in the custom profile are loaded early enough for trust,
   auto-install, Java auto-update selection, and AI-panel guards.
2. A fresh `XDG_CONFIG_HOME` with absent token variables prevents the Copilot
   warning without affecting the Java extension or JDT's cache root.
3. `disable_ai: true` prevents external-agent registry population and native-
   agent provider enumeration while leaving language-server infrastructure
   active.
4. Passing both the worktree directory and contained fixture path to the exact
   CLI opens Java directly and triggers JDT without a trust dialog or separate
   UI action.
5. Reusing the fixed S008 helper and JDT-embedded catalog is sufficient; no new
   helper build, JDT download, or catalog response is needed.

## Disposable artifact layout

Gate A may add only:

```text
spikes/s009-attributed-isolated-profile/
├── fixture/
│   └── S009Fixture.java
└── tools/
    └── PrepareS009.java
```

No extension manifest, Rust product code, proxy patch, wrapper, launcher,
Spring artifact, binary, or generated profile is tracked.

## Gate A: preparation implementation and synthetic review

Gate A was explicitly authorized on 2026-07-17. `PrepareS009.java` uses only JDK
APIs and must:

1. verify the fixed source/artifact/tree/binary identities inherited from S008,
   including the exact retained helper and catalog source;
2. create one new profile transactionally with only the fixed Java install,
   managed JDT, helper, proxy/debug inputs, Java-only index, empty route
   directory, and source-controlled settings;
3. require settings to contain the exact S009 controls and the fixed Java/JDT
   settings while rejecting a weaker, missing, duplicated, or unexpected value;
4. create one new package-free Java fixture worktree and four new XDG roots,
   stage only the fixed fresh catalog in the cache root, and compute the exact
   managed JDT data path from the normalized worktree root;
5. record which core profile roots may be generated by fixed Zed startup and
   separately prohibit unrelated installed extensions, credential copies,
   account/token exports, external-agent registry payloads, previous-spike
   paths, prior JDT data, and route records at preflight;
6. record a manifest with every fixed input hash/size, settings/index hash,
   profile allowlist, XDG paths, expected/fallback data paths, worktree hash,
   absence assertions, and cleanup/restoration requirements; and
7. reject existing destinations, symlinks, a second JDT/helper candidate,
   unexpected profile roots, stale catalogs/data/routes, live proxy/JDT
   processes, or a non-fresh XDG root.

Synthetic tests must cover settings composition, Java-only index identity,
source-derived allowed/prohibited roots, XDG independence, absent Copilot token
flags without storing values, full-path hashing with spaces and Unicode,
existing-output rejection, rollback, and manifest completeness. Compile with
`--release 21 -Xlint:all -Werror`; run compiled and source-file-mode tests.

Gate A stops before copying real destinations, refreshing a real catalog,
mounting or invoking Zed, starting Java/JDT, modifying normal state, or using UI
automation.

## Gate B: real preparation and preflight review

Gate B was explicitly authorized on 2026-07-17 after Gate A review. It may:

1. reverify the clean fixed checkouts/artifacts, retained fixed helper, JDK,
   signed Zed DMG, and available capacity without rebuilding or downloading a
   mutable input;
2. run `PrepareS009` once against wholly new ignored destinations and verify its
   manifest independently;
3. verify the prepared settings semantically and byte/hash record, Java-only
   index, exact official Java/JDT/helper/proxy/debug trees, fresh catalog, four
   empty/fixed XDG roots, fixture-only worktree, absent expected/fallback data,
   empty route directory, and process absence;
4. confirm only the presence/absence of `GH_COPILOT_TOKEN` and
   `GITHUB_COPILOT_TOKEN`; never print or store their values or a full
   environment; and
5. record normal-Zed identity plus current macOS Zed log/temp/state identities
   and a precise shared-log boundary, but do not stop it or invoke the fixed
   app.

Gate B stops before the fixture is opened, normal Zed is stopped, the catalog
mtime is refreshed for runtime, the fixed foreground CLI is invoked, or any UI
input occurs.

## Gate C: one bounded attributed runtime

Gate C requires a final explicit continuation after Gate B review:

1. Warn the user only if unexpected UI automation becomes necessary. Under the
   hypothesis, no UI input restriction is needed because the CLI receives both
   the worktree and contained fixture paths.
2. Reverify and read-only mount the fixed Zed 1.10.3 DMG. Recopy the fixed
   catalog, refresh that copy's mtime exactly once, and record its size/hash/
   mtime immediately before launch. Recheck the shared macOS log/temp/state
   boundaries; do not delete or reset them.
3. Gracefully stop normal Zed. Launch only the exact bundle-local CLI in the
   foreground with `--new`, the prepared `--user-data-dir`, all four run-
   specific XDG variables, the two Copilot token variables unset, the worktree,
   and its contained fixture. Do not change `HOME` or normal settings.
4. Require no trust modal and no manual trust action. Require the Java fixture
   to be visibly open from CLI input. If it is not open before any proxy/JDT
   child, preserve the failure; at most one pre-child correction with wholly
   new destinations may adjust only an incorrectly composed CLI file argument.
5. Require one fixed proxy and one fixed Temurin JVM. Verify the full JVM vector
   selects the fixed JDT/config/launcher and exactly one `-data` equal to the
   manifest path, with no packaged launcher, `jdtls.py`, host fallback, prior
   data path, or other JDT/helper candidate.
6. Require real JDT state only at the expected path and `ServiceReady`. Record
   startup timing, file count, RSS, redacted log window, and process identity.
7. Verify the catalog content and mtime, helper, settings, Java/JDT trees, and
   worktree remain fixed; no checksum cache, helper install/download error,
   project metadata, or worktree build output appears.
8. Require the post-run extension index to contain only Java and no HTML
   install/update. Inventory source-expected core profile state separately from
   prohibited extension, credential, token, account, or external-agent
   registry payloads. Attribute any shared macOS log/temp/state change to the
   bounded isolated-process interval and require no S008 Copilot or ChatGPT
   warning after the new log boundary.
9. Gracefully stop the isolated app and require Zed/proxy/JDT absence within 10
   seconds. After a separate stable five-second wait, preserve and explicitly
   remove any route record only after process absence.
10. Restore normal Zed from `/Applications` without isolated arguments within
    15 seconds, verify no isolated child remains, then detach the fixed image.

No preparation/settings/environment correction is allowed after a real proxy
or JDT child starts. Any such retry needs a new reviewed spike.

### Time bounds

- 30 seconds for isolated Zed and direct fixture opening;
- 30 seconds for proxy/JDT appearance and 60 seconds for `ServiceReady`;
- 10 seconds for child-process exit and a separate five-second route check; and
- 15 seconds for normal-Zed restoration.

## Success criteria

S009 is Supported on macOS arm64/JDK 25 only if:

1. every fixed input and fresh destination matches the reviewed manifest;
2. the fixture opens without a trust dialog or UI trust action;
3. HTML remains absent, the extension index remains Java-only, and settings
   retain every exact S009 control;
4. neither S008 provider warning appears and no prohibited credential/account/
   external-agent payload is introduced;
5. one fixed proxy/JVM uses exactly one correct managed `-data`, creates real
   state only there, and reaches `ServiceReady` within bounds;
6. helper/catalog/JDT/worktree identities remain unchanged and neither known
   helper/catalog fallback contributes; and
7. all isolated processes exit, explicit route cleanup passes if needed, normal
   Zed is restored, and committed evidence contains no private absolute path,
   secret, raw environment, binary, or third-party artifact.

Source-expected core editor directories and databases are reported, not treated
as failures, when they stay inside the isolated profile and contain no
prohibited copied user state.

## Failure and classification criteria

S009 is Refuted if fixed preparation passes but the signed runtime:

- still requires trust UI despite the applied trust setting;
- installs HTML despite the explicit false override;
- still reads the normal Copilot config despite the fresh XDG config and absent
  token variables, or still loads the native agent/provider loop despite
  `disable_ai: true`;
- necessarily prevents Java/JDT startup because of one of the fixed controls;
  or
- selects another JDT/data path or cannot reach `ServiceReady` through the
  otherwise proven fixed direct path.

S009 is Inconclusive if any fixed identity, settings merge, environment
presence flag, log boundary, direct file opening, timing, process/data
attribution, profile inventory, user input, cleanup, or restoration evidence is
insufficient. An unexpected but not yet source-attributed provider/editor path
is preserved as Inconclusive rather than removed to obtain Supported.

## Evidence and privacy rules

- Keep profiles, XDG roots, process listings, raw logs, screenshots, data,
  routes, binaries, and generated manifests under ignored `tmp/` paths.
- Commit only the reviewed plan, later disposable source/test text, and
  redacted structural results.
- Record environment-variable presence only; never record values or a full
  environment dump.
- Do not inspect, copy, hash, delete, or disclose the user's normal Copilot
  database or system credentials.
- Preserve failed preparation, launch, profile, process, cleanup, and
  restoration evidence.

## Blockers and constraints

- This spike controls the source-attributed S008 paths but does not prove whole-
  application network silence.
- On macOS, custom data and XDG variables do not relocate every Zed log/temp/
  state path. The plan relies on process exclusion and exact boundaries rather
  than calling the application fully sandboxed.
- `disable_ai` and trust-all are disposable profile controls, not product
  requirements. Product behavior must coexist with the user's ordinary
  settings after the direction gate.
- The fixed helper is a retained local build and the fixed DMG/JDT/Java trees
  remain ignored third-party evidence; none may be committed or redistributed.
- Automatic proxy-route deletion remains best effort and is recorded
  independently from mandatory process exit.
- All non-macOS tuples and JDK 21 remain untested.

## Candidate next experiment

- If Supported, write and review a new Spring end-to-end PoC spike using a
  fresh Maven fixture and the fixed S008/S009 controls. Reevaluate the Spring
  lifecycle command and exact completion/add/callback success sequence before
  any implementation.
- If Refuted, source-review only the failing control and plan the smallest
  independent runtime distinction.
- If Inconclusive, correct only the named evidence or attribution gap in a new
  plan; do not add Spring to the same run.

## Gate A implementation and review record

Gate A completed on 2026-07-17 without passing any fixed S008 artifact through
the preparation path or creating a real S009 destination. The disposable
implementation adds only the two files allowed by this plan:

- `spikes/s009-attributed-isolated-profile/fixture/S009Fixture.java`; and
- `spikes/s009-attributed-isolated-profile/tools/PrepareS009.java`.

Confirmed by code review and synthetic execution:

1. the preparation path verifies the inherited source commit, clean checkout,
   source manifests, fixed JDT/plugins/catalog source, Java extension tree,
   proxy, debug bundle, embedded Zed CLI, Temurin runtime, and the retained
   542,960-byte helper with its exact digest and arm64 Mach-O header;
2. it stages one profile, fixture-only worktree, and four distinct XDG roots in
   one rollback-capable transaction, with only the catalog in XDG cache;
3. settings are accepted only by exact byte composition and include trust-all,
   HTML auto-install false, Java auto-update false, top-level AI disable, and
   the inherited fixed Java/JDT controls;
4. profile structure, Java-only index, single JDT/helper candidates, empty
   route, fresh destinations/runtime paths, allowed core runtime roots, and
   prohibited credential/provider/prior-spike state are checked separately;
5. the manifest records fixed file sizes/hashes, tree hashes, catalog source,
   settings/index/worktree identities, all XDG and expected/fallback paths,
   boolean controls, token-variable absence flags without values, and cleanup/
   restoration requirements; and
6. synthetic tests cover settings weakening/extra fields, Java index mutation,
   catalog extraction attacks, spaces/Unicode full-path hashing, independent
   XDG roots, existing and symlink outputs, token-variable presence, process
   identification, prohibited profile candidates, rollback, and manifest
   truncation/weakening.

Validation on Temurin 25.0.3+9:

```text
javac --release 21 -Xlint:all -Werror ... PrepareS009.java S009Fixture.java
java -cp <classes> PrepareS009 --self-test
S009 preparation synthetic tests passed
java spikes/s009-attributed-isolated-profile/tools/PrepareS009.java --self-test
S009 preparation synthetic tests passed
```

At Gate A close, the ignored fixed inputs had not been passed through this new
tool, no real profile/worktree/XDG destination or manifest existed, token
absence had not been checked for a real launch environment, and Zed, proxy, and
JDT had not been started. Gate B addressed the preparation items; runtime
questions remain Gate C concerns.

## Gate B real preparation and preflight review record

Gate B completed on 2026-07-17 on the local macOS 26.5.1 arm64/Temurin
25.0.3+9 tuple. `PrepareS009` was compiled with the Gate A strict flags and
executed exactly once against six wholly new ignored destinations. It completed
without a correction or retry. No fixture was opened, catalog mtime refreshed,
normal Zed stopped, fixed app launched, proxy/JDT process started, or UI input
performed.

### Fixed-input revalidation

- The retained 143,545,589-byte Zed 1.10.3 Apple Silicon DMG reproduced
  SHA-256 `717ab148...1a0` and passed APFS checksum verification. Its read-only
  mount passed deep/strict code-signature verification for identifier
  `dev.zed.Zed`, Team ID `MQ55VZLNZQ`, and the Zed Industries Developer ID
  chain; `spctl` accepted it as a notarized Developer ID app.
- The bundle-local 3,570,560-byte CLI reproduced SHA-256 `f1dad0ae...d8215`
  and reported Zed 1.10.3. The image was detached after preparation.
- The clean Java extension checkout remained at
  `9148b897...2970d`, and the clean Zed source checkout remained at
  `0c54c414...892a`. Fixed Cargo source files, Rust/Cargo 1.97.0 identities,
  Temurin binaries, official Java 6.8.21 tree, managed JDT/plugins, proxy,
  debug bundle, embedded catalog, and retained helper all passed the Gate A
  size/hash/shape checks. No rebuild or download occurred.
- Both Copilot token variables were checked for presence only and were absent.
  Approximately 800 GiB remained available before preparation.

### Prepared identity and independent review

- The profile contains 153 regular files, 31 directories, no symlinks, and
  only the roots `config`, `fixed`, `extensions`, and the 71-key manifest.
  Exactly one Java extension, one managed JDT candidate, one helper candidate,
  and an empty proxy-route directory exist.
- Independent tree hashing and recursive comparison reproduced Java tree
  SHA-256 `58e1155d...fae68` and JDT tree SHA-256
  `b64b2372...f7583` for both retained inputs and prepared copies. The proxy,
  debug bundle, helper, and catalog reproduced their fixed hashes.
- Exact settings are 910 bytes, SHA-256 `3d248a2c...81d7f`. Independent JSON
  parsing confirmed top-level `disable_ai: true`, trust-all enabled only in the
  isolated profile, HTML auto-install and Java auto-update disabled, Java-only
  `jdtls`, the final local proxy/debug paths, Lombok and JDK auto-download
  disabled, and updates set to `never`.
- The 2,026-byte extension index retained SHA-256 `a7348979...e6eb` and parsed
  as only official Java 6.8.21 with `dev: false` and Java/Properties language
  entries. No HTML or other extension exists.
- The package-free worktree contains only the 134-byte fixed fixture. Its
  fixture SHA-256 is `020c6382...c491`, full-path SHA-1 is
  `b5062417...d3944`, and tree SHA-256 is `f0cd9800...301d`.
- XDG config, data, and state roots are empty. XDG cache contains only the
  413,663-byte fixed Gradle catalog, SHA-256 `f91a3840...4d02`; its preparation
  mtime `1784252793304` ms was independently reproduced and was not refreshed.
- The manifest has 71 unique complete keys. Its expected data path is derived
  from the normalized full worktree path. That path, the managed host fallback,
  and the packaged-launcher fallback are all absent. No prohibited credential,
  provider, previous-spike, prior-data, or route state and no proxy/JDT process
  were found.

### Normal-Zed and shared-path boundary

Normal Zed remained the installed 1.11.3 app throughout preparation: PID 47245,
start time 2026-07-17 05:57:11 KST, installed CLI SHA-256
`9289fa39...6975`, and no isolated arguments. The final shared-path boundary is
2026-07-17 10:48:26 KST (epoch `1784252906`):

| Boundary | Size or state | mtime epoch | inode |
| --- | ---: | ---: | ---: |
| `~/Library/Logs/Zed/Zed.log` | 767,618 bytes | 1784235432 | 121592491 |
| `~/Library/Logs/Zed/Zed.log.old` | 1,048,579 bytes | 1783265325 | 156857117 |
| `~/Library/Logs/Zed/telemetry.log` | 8,244 bytes | 1784252574 | 121592518 |
| `~/Library/Caches/Zed` | directory; 11 direct entries | 1784235431 | 121592490 |
| `~/.local/state/Zed` | absent | n/a | n/a |

These paths are shared macOS boundaries, not proof of complete sandboxing. Gate
C must establish a new immediate prelaunch boundary and attribute only changes
after it.

### Gate B conclusion and remaining runtime work

Gate B is complete and the single prepared input set is ready for Gate C. This
is preparation evidence only. It does not prove settings application, direct
fixture opening, warning absence, exact runtime process arguments, `-data`
selection, `ServiceReady`, catalog stability, post-run profile identity,
shutdown, route cleanup, or normal-Zed restoration. Gate C remains closed until
an explicit continuation and must use this exact prepared set without a setup
correction after any proxy or JDT child starts.

## Plan review record

Reviewed on 2026-07-17 before implementation. The review:

1. rejected another two-run JDT-isolation spike because S008 already proved
   distinct data paths twice;
2. replaced S008's impossible empty-post-profile expectation with a source-
   derived distinction between normal isolated editor state and prohibited
   user/provider leakage;
3. selected `disable_ai`, not `agent.enabled`, because only the former guards
   agent-panel loading and external-agent registry reads in the fixed source;
4. selected a fresh XDG config plus absent-token flags rather than inspecting or
   altering the user's real Copilot data;
5. replaced trust UI automation with an isolated trust-all setting and direct
   CLI fixture input;
6. retained the fixed helper/catalog/JDT path so the new run changes only the
   source-attributed profile controls;
7. kept automatic route deletion separate from process exit and explicit
   cleanup; and
8. kept Spring, product scaffolding, publication, and multiplatform claims
   outside S009.

Gate A's disposable code and Gate B's ignored real preparation now exist. No
fixture opening, catalog runtime refresh, fixed Zed launch, proxy/JDT process,
normal-Zed stop, or UI action has occurred. Gate C remains closed until a later
explicit continuation.
