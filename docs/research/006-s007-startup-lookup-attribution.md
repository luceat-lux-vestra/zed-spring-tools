# R006: S007 startup lookup and cleanup attribution

- Status: Complete
- Last updated: 2026-07-16
- Investigator: Codex
- Fixed runtime evidence: S007 Gate C Run 1 on macOS arm64/JDK 25

## Question

Which fixed upstream component created S007's
`tooling/gradle/versions.json`, which other startup lookup remained possible,
and what preparation can make a new managed-JDT isolation spike attributable
without changing Zed, the Java extension, JDT LS, or the Java proxy?

## Scope

Included:

- exact source and binary inspection for Zed 1.10.3, Java extension 6.8.21,
  JDT LS 1.60.0, its packaged Buildship 3.1.10 snapshot, and the official Java
  proxy;
- S007's preserved preflight, runtime catalog, logs, profile, and proxy record;
- the two identified startup lookup paths and the proxy-record deletion path;
  and
- requirements for one new local-only prerequisite plan.

Excluded:

- another Zed/JDT launch, UI automation, Spring Tools, project import, or
  completion input;
- packet capture or a claim that every possible Zed subsystem was network
  silent;
- modification of upstream binaries or product architecture; and
- conclusions for any platform other than the tested macOS arm64/JDK 25 tuple.

## Confirmed facts

### Buildship owns the Gradle catalog creation

1. The fixed JDT core JAR is SHA-256
   `e83035adc685b4519f2d8a8d42fe8651ce7ea4f4daf396f47ec453b5bff07be5`.
   It contains an embedded 413,663-byte
   `gradle/checksums/versions.json` with SHA-256
   `f91a3840453686a21fc2b1508c645c1affd939b1448105cf10438d11b71c4d02`.
2. S007's empty-at-preflight XDG root gained a distinct 415,493-byte
   `tooling/gradle/versions.json` at JDT startup. Its SHA-256 is
   `6583154ec821d7dee9976ab21406bc8fe9d07d1f94d2de22dbe785536166d550`.
   It is not byte-equal to the JDT-embedded catalog.
3. The fixed JDT source explicitly starts `org.eclipse.buildship.core` during
   `Initialize After Load`, before Java core initialization. This happens even
   for S007's package-free Java fixture with no Gradle build files.
4. The packaged Buildship JAR is version
   `3.1.10.v20250827-0209-s`, SHA-256
   `dfc5ee42407674608f6253c1ccdddeb6f12e2df5ff84ab4ef260de2cd453600d`.
   Its signed manifest identifies source commit
   `d99d99a319906c88418fe7a4dbfeec0b48a35805`.
5. That exact Buildship source constructs `PublishedGradleVersionsWrapper`
   during service registration. Its constructor immediately schedules a
   `LoadVersionsJob` using `REMOTE_IF_NOT_CACHED`.
6. With `XDG_CACHE_HOME` present, the exact Buildship source resolves its cache
   to `tooling/gradle/versions.json`. If that file is absent, it opens
   `https://services.gradle.org/versions/all`, reads the response, creates the
   parent directories, and stores the response at that path. A cache older than
   one day also triggers a refresh attempt.
7. S007 preflight proved that cache file absent. The runtime file appeared at
   the exact Buildship path and differs from the JDT-embedded fallback.
   Combined with the fixed control flow, this attributes the file to a
   successful Buildship remote versions request rather than to Zed, the Java
   task helper, or JDT's embedded wrapper-validator fallback.

### The Java task-helper path bypasses `check_updates: "never"`

1. The fixed Java extension's `JdtlsServer::command` resolves the task helper
   after constructing the JDT command, regardless of whether any task is run.
2. The ordinary `Downloadable` path returns an error when update checks are
   `never` and no local installation exists. `TaskHelper` overrides that method,
   converts this result with `.unwrap_or(None)`, and proceeds to
   `fetch_latest_version` when no helper is local.
3. `fetch_latest_version` calls Zed's `latest_github_release` for
   `zed-extensions/java`. The exact Zed host implementation sends an HTTP GET to
   `https://api.github.com/repos/zed-extensions/java/releases` and selects the
   first matching stable release with assets.
4. `TaskHelper::find_local` accepts either `bin/java-task-helper` or a helper
   below one child of `bin/`. S007 had neither a local helper nor one on the
   worktree PATH, so the latest-release lookup branch was entered before its
   PATH fallback.
5. S007 retained no task-helper binary and no task-helper-specific log result.
   The lookup path is source-attributable, but whether its release query failed,
   returned a cached HTTP response, selected an asset, or failed during download
   is not established by the retained runtime evidence.

### Proxy-record deletion is best effort after child exit

1. The fixed official proxy writes the worktree-keyed port record immediately
   after starting JDT and binding its loopback listener.
2. Its main thread waits for the JDT child and attempts record removal only
   after `child.wait()` returns. The removal result is discarded.
3. S007's Zed log shows `shutdown`, its response, and `exit`; both proxy and JDT
   processes disappeared. The five-byte record nevertheless remained.
4. The retained evidence cannot distinguish early proxy termination, a race
   before the final removal, or a removal error. Automatic record deletion is
   therefore a separate best-effort observation, not a reliable proxy for
   process termination.

## Primary sources

All sources were accessed and exact local checkouts were verified clean on
2026-07-16.

- Zed commit `0c54c414d522234de7298039708ffe85a116892a`:
  [`crates/http_client/src/github.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/http_client/src/github.rs)
  and
  [`since_v0_8_0.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/extension_host/src/wasm_host/wit/since_v0_8_0.rs).
- Java extension commit `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`:
  [`jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs),
  [`task.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/task.rs),
  [`util.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/util.rs), and
  [`proxy/src/main.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs).
- Official Java extension
  [v6.8.21 release](https://github.com/zed-extensions/java/releases/tag/v6.8.21),
  whose stable assets include the platform proxies but no task-helper archive.
- JDT LS commit `57ed41bdddc93df13ace6a266d8e3c1d35c95618`:
  [`JavaLanguageServerPlugin.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/JavaLanguageServerPlugin.java),
  [`WrapperValidator.java`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/internal/gradle/checksums/WrapperValidator.java),
  and the core [`pom.xml`](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.core/pom.xml).
- Buildship commit `d99d99a319906c88418fe7a4dbfeec0b48a35805`:
  [`PublishedGradleVersions.java`](https://github.com/eclipse/buildship/blob/d99d99a319906c88418fe7a4dbfeec0b48a35805/org.eclipse.buildship.core/src/main/java/org/eclipse/buildship/core/internal/util/gradle/PublishedGradleVersions.java),
  [`PublishedGradleVersionsWrapper.java`](https://github.com/eclipse/buildship/blob/d99d99a319906c88418fe7a4dbfeec0b48a35805/org.eclipse.buildship.core/src/main/java/org/eclipse/buildship/core/internal/util/gradle/PublishedGradleVersionsWrapper.java),
  and
  [`CorePlugin.java`](https://github.com/eclipse/buildship/blob/d99d99a319906c88418fe7a4dbfeec0b48a35805/org.eclipse.buildship.core/src/main/java/org/eclipse/buildship/core/internal/CorePlugin.java).
- Ignored S007 evidence: fixed preflight, runtime log window, process snapshots,
  catalog identity, and proxy-record state under
  `tmp/s007-gate-c-run1-20260716T041407/`.

## Inferences

1. Copying the exact JDT-embedded catalog into each new XDG root immediately
   before runtime, preserving its hash and giving it a fresh modification time,
   should make Buildship take its under-one-day cache-read branch. This follows
   directly from the fixed source but still requires runtime verification.
2. Building `java-task-helper` from the same clean Java extension commit and
   staging it under the isolated Java work directory's `bin/` path should make
   `TaskHelper::find_local` return before the GitHub lookup branch.
3. A new minimal user-data profile containing only the official Java extension,
   fixed settings, managed JDT, source-built helper, and empty route directory
   should remove S007's unrelated provider-authentication noise. Zed may still
   initialize unrelated built-in subsystems, so this is not yet a fact.
4. A stale proxy record can be safely treated as cleanup evidence after both
   process absence and record identity are established, then explicitly removed
   before the next run. This preserves attribution without pretending that the
   upstream proxy guarantees automatic record deletion.

## Unverified hypotheses

1. The source-built fixed helper is byte-stable for one declared Rust toolchain
   and is selected by the installed Java WASM without a release lookup.
2. Buildship reads the preseeded catalog without modifying it or creating a
   checksum directory for the dependency-free fixture.
3. A minimal profile avoids ChatGPT/Copilot authentication attempts and starts
   the official Java extension without an extension-registry lookup.
4. Two new worktrees still produce two distinct exact JDT data paths and reach
   `ServiceReady` independently.
5. Explicit record cleanup after process absence is sufficient to make the
   second run fresh; automatic proxy cleanup may remain unreliable.

## Runtime verification needed

- verify the helper build source, toolchain, locked dependencies, binary hash,
  staged path, and no GitHub-release lookup evidence;
- verify both catalog copies before and after each run, including modification
  time and absence of `tooling/gradle/checksums`;
- verify a minimal Java-only profile has no provider/authentication state;
- run two distinct worktrees through the exact embedded CLI and compare actual
  process arguments, data paths, and retained filesystem state; and
- separate graceful process exit, automatic record deletion, and explicit test
  cleanup in the evidence.

## Blockers and constraints

- Source attribution covers the two observed startup lookup paths. It does not
  substitute for a system-wide packet capture or prove that every Zed feature
  is network silent.
- Buildship's cache decision depends on file modification time, not content
  identity. Preparation must verify the fixed content and refresh only the
  declared copies immediately before each bounded run.
- Java extension 6.8.21's stable release did not publish task-helper assets.
  A source build from the exact fixed commit is disposable spike input, not a
  released product artifact or a multiplatform support claim.
- The proxy ignores record-removal errors. A later product decision may need an
  upstream fix, but this prerequisite must not patch the proxy.

## Candidate next experiments

S008 should test exactly two preseeded managed-JDT runs with:

- one fixed source-built task helper in a new minimal Java-only profile;
- one exact JDT-embedded Gradle catalog copied into each run-specific XDG root;
- two absent-at-launch JDT data paths and no Gradle project input;
- source-level checks that the identified GitHub and Gradle lookup branches are
  bypassed, without claiming complete network silence; and
- process cleanup as a hard requirement while recording and explicitly cleaning
  any stale proxy record after process absence.

## Interim conclusion

S007's Gradle file is no longer unattributed: Buildship created it from a remote
versions response during unconditional JDT startup. The Java extension also
entered a separate latest-release lookup path because its task-helper override
does not honor the ordinary `never` failure. Both paths have narrow local
preseed conditions. This supports a new S008 plan, not an in-place S007 retry,
S006 reopening, product scaffolding, or a direction decision.
