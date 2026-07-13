# S002: Spring Boot LS standard-LSP baseline without JDT classpath

- Status: Refuted on macOS arm64 — Gate B complete
- Date: 2026-07-14
- Related research: R002, R004, R005
- Depends on: S001
- Implementation state: Disposable spike retained; no production promotion

## Hypothesis

On Zed 1.10.3 for macOS arm64, the Spring Boot Language Server extracted from
the pinned Spring Tools `5.2.0.RELEASE` VSIX can run on Temurin JDK 25 with
`enableJdtClasspath: false`, complete standard LSP initialization without a Zed
Java extension, and provide at least one deterministic Spring-metadata-aware
completion, hover, or diagnostic for an `application.properties` fixture.

The metadata-aware feature is essential to the hypothesis. Merely starting the
process or reporting a syntax-only duplicate-key diagnostic establishes a
transport baseline but does not demonstrate enough limited-mode value to support
Candidate A from R004.

## Decision this spike informs

S002 tests only Candidate A, the limited direct Spring LS mode. It does not
select a product architecture and cannot support a claim about full Spring Java
intelligence.

- A Supported result keeps the limited mode credible and permits S003 to
  investigate JDT bundle injection independently.
- A Refuted result shows that direct classpath-disabled Spring LS is not a
  meaningful properties-language MVP on the tested host. It does not refute the
  coordinated Candidates B-D.

## Why runtime verification is required

Pinned Spring Tools source confirms that the server can initialize with JDT
classpath listening disabled. It does not establish which properties metadata
is available when the production `JdtLsProjectCache` remains empty, whether Zed
maps the fixture to the required Spring language ID, or whether Zed accepts the
server's dynamic registrations and client requests.

The release artifact also uses mismatched external labels: release
`5.2.0.RELEASE`, asset `2.2.0-RC1`, package version `2.2.0`, and embedded server
filename `2.2.0-SNAPSHOT`. Runtime evidence must therefore record the actual
server response and logs rather than inferring its identity from one filename.

## Scope boundaries

Included:

- one disposable Rust/WASM Zed development extension;
- one locally supplied and digest-verified official Spring Tools VSIX;
- direct launch of the extracted Spring Boot LS JAR with Java 25;
- `Plain Text` to `spring-boot-properties` LSP language-ID mapping for isolated
  fixtures;
- `enableJdtClasspath: false` initialization;
- standard initialization, completion, hover, diagnostics, configuration, and
  lifecycle observations; and
- one Zed language-server restart under the S001 shutdown constraint.

Excluded:

- installing or configuring the Zed Java extension;
- JDT LS startup, Java project import, Spring JDT bundles, or classpath relay;
- Java-file, YAML, XML, Maven, Gradle, live-process, tree-view, or other advanced
  Spring behavior;
- custom `sts/*` request handling, a proxy, bridge, or coordinator;
- automatic artifact download, upgrade, rollback, or publication;
- committing or repackaging the VSIX or extracted JARs; and
- production language definitions, settings, packaging, or architecture.

## Confirmed inputs

### Spring Tools launch and initialization

At Spring Tools release commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9`:

- [`Main.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/lib/Main.ts#L151-L157)
  passes workspace folder URIs and starts with `enableJdtClasspath: false` before
  the VS Code classpath service deliberately enables it.
- [`Main.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/lib/Main.ts#L40-L70)
  prefers a JDK, requires Java 21+, selects a 1024 MiB heap, disables the web
  application mode when its optional MCP server is off, and supplies the
  packaged configuration and ZIP compatibility flags.
- [`launch-util.ts`](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/commons-vscode/src/launch-util.ts#L274-L348)
  adds `-Dsts.lsp.client=vscode`, disables verbose JNI resolve logging, and
  launches the packaged server with `-jar`.
- R002 confirms that the server also reads standard LSP `workspaceFolders` or
  `rootUri`. S002 will rely on Zed's standard initialize parameters and will add
  only `enableJdtClasspath: false` as custom initialization JSON.

The primary run intentionally omits `-Dsts.lsp.client=vscode` because Zed is the
client. If the server fails before initialization, one diagnostic rerun may add
only that flag. Such a rerun cannot turn the primary result into Supported; it
only identifies a client-mode dependency.

### Zed language mapping and lifecycle

- Zed's [language extension documentation](https://zed.dev/docs/extensions/languages)
  supports mapping a Zed language name to a server-specific LSP `languageId`
  through `language_ids`.
- The disposable extension will attach only to Zed's existing `Plain Text`
  language in an isolated user-data directory and map it to
  `spring-boot-properties`. It will not add a grammar or claim general
  `.properties` support.
- S001 proved local development-extension installation, WASM compilation,
  process startup, initialization, `shutdown`, and replacement-process startup.
- S001 also found that the probe did not process `exit` before termination.
  Inspected Zed source enqueues `exit`, waits for the writer, then calls
  `child.kill()`. S002 must collect essential evidence before invoking restart
  and must record, but not require, server processing of `exit`.

### Artifact identity

| Field | Pinned value |
| --- | --- |
| Release | Spring Tools `5.2.0.RELEASE` |
| Source commit | `18d1a975dbea4f9314fd736d0237bd9e23f243f9` |
| Asset | `vscode-spring-boot-2.2.0-RC1.vsix` |
| Size | 82,759,143 bytes |
| SHA-256 | `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` |
| Server entry | `extension/language-server/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar` |

Gate B reacquired this exact official asset into ignored local storage. The
preparation tool verified its pinned size and digest before extracting 204
entries totaling 91,193,648 bytes and confirming the expected server JAR and
license file. Neither the VSIX nor its extraction is committed.

## Inferences

1. A duplicate-key diagnostic should exercise parsing and diagnostic delivery
   without requiring project metadata. It is a transport/control observation,
   not sufficient proof of Candidate A value.
2. Completion or hover for `server.port`, or an integer-type diagnostic for its
   value, would demonstrate that useful Spring configuration metadata is
   available despite the empty JDT-backed project table.
3. Mapping `Plain Text` to `spring-boot-properties` isolates the server behavior
   without adding a production grammar or requiring the user's Java setup.

## Hypotheses before execution

1. The release server can initialize under Java 25 without the VS Code-only JVM
   client flag.
2. Zed sends `spring-boot-properties` in `textDocument/didOpen` after applying
   the extension's language-ID mapping.
3. The server does not issue `sts/addClasspathListener` when
   `enableJdtClasspath` is false.
4. At least one built-in or otherwise available metadata source provides a
   deterministic `server.port` completion, hover, or value diagnostic without a
   JDT project cache.
5. Zed handles the server's standard dynamic registrations and requests well
   enough for the properties feature to remain usable.

## Environment

Actual first execution environment:

| Component | Value | S002 use |
| --- | --- | --- |
| OS | macOS 26.5.1, arm64 | First host only |
| Zed | 1.10.3, build `20260713.002323` | Client under test |
| Zed Java extension | Not installed/configured | Intentionally excluded |
| Java runtime | SDKMAN Temurin JDK 25.0.3 | Spring LS process only |
| Java discovery | `Worktree::which("java")`, then `JAVA_HOME` fallback | No macOS-only discovery |
| Rust | rustup stable 1.97.0 with `wasm32-wasip2` | Dev-extension build |
| Spring Tools | Pinned values above | Reacquired and verified locally |

Java 25 being the user's default is acceptable for this local run because the
inspected launcher requires Java 21 or newer. It does not establish JDK 21
behavior or a Java 25 multiplatform support claim.

## Gate A disposable artifacts

Gate A added only the approved disposable files:

```text
spikes/s002-spring-ls-limited/
├── extension/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── extension.toml
│   └── src/lib.rs
├── fixture/
│   ├── application-completion.properties
│   ├── application-duplicate.properties
│   ├── application-hover.properties
│   └── application-invalid.properties
└── tools/
    └── PrepareSpringTools.java
```

The single-file Java preparation tool is spike infrastructure. It accepts a
local VSIX path and destination, verifies the exact byte count and SHA-256,
rejects unsafe ZIP paths, extracts to a fresh ignored directory, and verifies
that exactly one expected server entry exists. It does not download, modify, or
republish the asset.

Generated data remains ignored:

```text
tmp/s002-artifacts/
tmp/s002-zed-user-data/
tmp/s002-evidence/
spikes/s002-spring-ls-limited/extension/target/
spikes/s002-spring-ls-limited/extension/extension.wasm
```

## Gate A implementation behavior

The extension:

1. pin `zed_extension_api = "=0.7.0"` and register one spike-only language
   server for `Plain Text`;
2. map `Plain Text` to LSP language ID `spring-boot-properties`;
3. resolve Java through `Worktree::which("java")`, then a platform-aware
   `JAVA_HOME/bin/java` or `JAVA_HOME\\bin\\java.exe` fallback;
4. constructs only the fixed, verified extraction path under
   `tmp/s002-artifacts/extracted/extension/language-server/`;
5. return a direct command without a platform shell, with the pinned official
   launch arguments `-Xmx1024m`,
   `-Dspring.config.location=classpath:/application.properties`,
   `-Djdk.util.zip.disableZip64ExtraFieldValidation=true`,
   `-Dspring.main.web-application-type=NONE`, `-Xlog:jni+resolve=off`, `-jar`,
   and the verified server path, while omitting only the VS Code client flag;
6. pass `worktree.shell_env()` to the child without logging environment values;
7. return initialization JSON containing only
   `{"enableJdtClasspath": false}`; and
8. implement no download, proxy, request interception, JDT integration, or
   product settings.

The extension returns a clear error when Java discovery fails. The published
Zed extension API 0.7.0 `Worktree` interface exposes root-path, environment, and
executable-discovery operations but no arbitrary worktree-file existence check.
Consequently, the preparation tool is the fail-closed verification boundary for
the VSIX and expected JAR; if that prerequisite is bypassed or its output is
removed later, direct `java -jar` startup reports the missing file. The
extension does not scan arbitrary directories or accept a configurable JAR
path. This constraint must be accepted or revised before Gate B.

## Fixture and observation matrix

Every fixture is opened as `Plain Text` in the isolated Zed instance, but the
LSP trace must show `spring-boot-properties` as its language ID.

| Fixture | Fixed action or cursor | Expected observation | Role |
| --- | --- | --- | --- |
| `application-duplicate.properties` | Open unchanged and wait for diagnostics; no cursor-dependent action | Both duplicate `server.port` keys receive an attributable duplicate-key diagnostic | Parser/transport control |
| `application-completion.properties` | Invoke completion after `ser`: Zed line 1, column 4; LSP position `(0, 3)` | A completion identifies `server.port` | Metadata-aware value evidence |
| `application-hover.properties` | Hover inside the key: Zed line 1, column 2; LSP position `(0, 1)` | Hover identifies `server.port` and provides type or descriptive metadata | Metadata-aware value evidence |
| `application-invalid.properties` | Open unchanged and wait for diagnostics; no cursor-dependent action | Diagnostic identifies an integer/type mismatch | Metadata-aware value evidence |

The exact fixture text and cursor coordinates must be committed in Gate A and
must not be changed during Gate B to manufacture a passing result.

## Procedure

Implementation and execution remain separate review gates.

### Gate 0: plan review

Before any S002 code or artifact acquisition:

1. approve the properties-only scope and exclusion of the Zed Java extension;
2. approve the pinned local VSIX input and single-file Java verifier/extractor;
3. approve omission of `-Dsts.lsp.client=vscode` in the primary run;
4. approve the `Plain Text` language mapping as spike-only infrastructure; and
5. approve the Supported/Refuted threshold below.

Gate 0 was accepted by the user on 2026-07-14 before S002 files were added.

### Gate A: disposable implementation, only after plan approval

1. Add only the planned extension, four fixtures, and preparation tool.
2. Add ignore rules only if the existing patterns do not cover generated output.
3. Unit-test artifact verification, size/digest rejection, ZIP traversal
   rejection, expected-layout validation, Java selection, path handling, and
   initialization JSON without using the real VSIX.
4. Run the preparation tool against a deliberately wrong small input and record
   its safe failure.
5. Run Node only if useful as a test driver; it must not become an S002 runtime
   prerequisite.
6. Run Java source validation plus Rust format, locked WASM check, Clippy with
   warnings denied, and locked WASM build.
7. Review the complete diff before obtaining the real VSIX or installing the
   development extension.

### Gate A observations

Confirmed on the local macOS arm64 development host on 2026-07-14:

1. The disposable extension, four fixed fixtures, and single-file Java tool are
   the only S002 source artifacts added. Existing ignore patterns already cover
   build output, local artifacts, isolated Zed data, and evidence.
2. The Rust manifest pins `zed_extension_api = "=0.7.0"`; its lockfile was
   generated before locked checks.
3. Four Rust unit tests passed for host-specific path joining, space and Korean
   characters in a macOS path, macOS and Windows `JAVA_HOME` selection, missing
   Java fallback, and the exact initialization JSON.
4. The Java tool compiled with `javac --release 21 -Xlint:all`. Its self-test
   passed in compiled-class and JDK 25 single-source modes. The test covers a
   valid synthetic archive, wrong size, wrong digest, POSIX and backslash ZIP
   traversal, missing expected layout, and an existing destination.
5. Supplying `application-hover.properties` as the alleged VSIX returned exit
   status 1 with an unexpected-size error and created no destination.
6. `cargo fmt --check`, locked `wasm32-wasip2` check, Clippy with warnings
   denied, and locked release WASM build passed.
7. No real VSIX was acquired or extracted, no development extension was
   installed, no Zed process was automated, and no Spring LS process was run.

Constraint discovered during implementation:

- Zed extension API 0.7.0 cannot perform the planned pre-launch existence check
  for the worktree-relative JAR. Gate A therefore assigns artifact verification
  to the fail-closed preparation tool and leaves a missing-after-preparation JAR
  to fail through direct Java startup. This is an implementation constraint, not
  evidence for or against the runtime hypothesis.

### Gate B: artifact preparation and local Zed execution

1. Obtain the exact official VSIX from the pinned Spring Tools release into
   ignored `tmp/s002-artifacts/`; do not use `latest` or a mirror.
2. Run `PrepareSpringTools.java` with the local VSIX and ignored extraction
   destination. Record size, digest, server path, and license-file presence.
3. Independently record `java -version` and `javac -version`; require major
   version 21 or newer and a JDK marker.
4. Confirm the isolated Zed user-data directory has no Java extension and do not
   install one.
5. Close existing Zed processes, then launch Zed 1.10.3 in the foreground with a
   rustup-first PATH and `--user-data-dir tmp/s002-zed-user-data`.
6. Install the S002 development extension and confirm its WASM build and
   registration.
7. Open only the committed S002 fixtures. Confirm one Spring LS process starts,
   record the executable/arguments without environment values, and record cold
   initialization time and process memory as observations rather than success
   criteria.
8. In Zed's language-server log, record the initialize response, advertised
   capabilities, server identity if supplied, mapped didOpen language ID,
   server-to-client methods, and any method-not-found responses. Keep raw logs
   and screenshots under ignored `tmp/s002-evidence/` because they may contain
   fixture content or host paths.
9. Confirm no `sts/addClasspathListener` request occurs while classpath support
   is disabled.
10. Execute the four fixed fixture observations in the table without changing
    their text.
11. Invoke `editor: restart language server`; record `shutdown`, replacement
    process startup, reinitialization, and whether `exit` is processed. Do not
    require `exit` because of S001.
12. Inspect foreground application and Spring LS stderr logs for startup,
    registration, protocol, and Java errors.
13. If the primary process fails before initialize completes, perform at most
    one diagnostic rerun adding only `-Dsts.lsp.client=vscode`; keep both failed
    and control observations.
14. Remove the development extension from the isolated user data, stop the test
    Zed process normally, verify no Spring LS process remains, and reopen the
    user's normal Zed application.
15. Record exact observations and classify the result. Do not promote spike code
    into product code.

### Gate B confirmed observations

Gate B ran on the declared macOS arm64 host on 2026-07-14:

1. The official VSIX was verified as 82,759,143 bytes with SHA-256
   `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3`.
   Safe extraction produced 204 entries totaling 91,193,648 bytes and verified
   the expected server JAR and license file.
2. `java -version` and `javac -version` both reported SDKMAN Temurin 25.0.3.
   The isolated Zed 1.10.3 data directory contained no Java extension; only the
   bundled HTML extension and the disposable S002 development extension were
   present.
3. Zed launched the verified JAR directly with the planned JVM argument vector.
   The primary command omitted `-Dsts.lsp.client=vscode`. The server initialized
   successfully in 1.868 seconds, so the diagnostic client-flag rerun was not
   permitted or needed. The initial process reached approximately 265,280 KiB
   resident memory during observation.
4. The initialize request contained only
   `{"enableJdtClasspath":false}` as custom initialization data. The response
   advertised standard hover, definition, symbols, actions, inlay hints, and
   related capabilities but no `serverInfo` identity. Server logs confirmed
   that classpath listening remained disabled.
5. Every fixture `didOpen` used `spring-boot-properties`. Zed answered the
   server's dynamic completion, watched-file, workspace-folder, semantic-token,
   and inlay-hint refresh registrations or requests. No method-not-found or
   unhandled-method error was observed.
6. The trace contained zero `sts/addClasspathListener` requests. This agrees
   with the explicit classpath-disabled initialization and the server's
   `enableClasspath=false` log messages.

The fixed feature observations were:

| Fixture | Exact protocol result | Outcome |
| --- | --- | --- |
| Duplicate-key control | Diagnostics `[]` for both `server.port` entries | Control did not produce the planned diagnostic |
| Completion at `(0, 3)` | `{"isIncomplete":true,"items":[]}` | No `server.port` completion |
| Hover at `(0, 1)` | `{"contents":[]}` | No description or type metadata |
| Invalid integer value | Diagnostics `[]` for `server.port=not-a-number` | No type diagnostic |

The completion fixture also received `PROP_SYNTAX_ERROR` for the incomplete
text `ser`. That syntax-only parser result does not identify `server.port` and
does not satisfy the metadata-aware success threshold. The server log explicitly
reported zero completion candidates for the mapped language ID, so the empty
completion response is not a UI-display ambiguity.

### Restart and shutdown observations

`editor: restart language server` sent `shutdown`, followed by `exit`, and
replaced server PID 19948 with PID 23211. The replacement initialized in 1.945
seconds, reopened all four fixtures with the mapped language ID, and reached
approximately 289,936 KiB resident memory after about 51 seconds.

On both restart and final application shutdown, Spring LS returned the JSON
string `"OK"` as the shutdown result. Standard LSP shutdown expects `null`, so
Zed rejected the response with `invalid type: string "OK", expected unit` and
logged `Shutdown request failure`. Zed nevertheless sent `exit`; restart still
created and initialized the replacement process. This is a confirmed protocol
compatibility constraint, not the reason the metadata probes were empty.

The isolated Zed instance and Spring LS were stopped, the development-extension
link and generated WASM were removed, the user's two-set Korean input source was
restored, and the normal non-isolated Zed application was reopened. A filtered
314-line raw trace and UI screenshots remain only under ignored
`tmp/s002-evidence/`; they include host paths and are not committed.

### Result and inference

**Refuted on macOS arm64.** Direct classpath-disabled Spring LS startup and
standard LSP transport are feasible on this host, but Candidate A did not
provide the minimum properties-language value required by the hypothesis. The
three exact metadata-aware requests produced empty results, while trace evidence
confirmed the expected language ID, direct request delivery, server-side
processing, and successful dynamic registration. The failed duplicate control
is an additional negative observation; classification does not depend on it
because the metadata requests themselves have unambiguous protocol responses.

This result is limited to Zed 1.10.3, the pinned Spring Tools artifact, Temurin
JDK 25.0.3, and macOS arm64. It does not refute coordinated Candidates B-D or
establish behavior on another JDK, operating system, architecture, project
fixture, or with JDT-backed classpath data.

### Later representative runs

After the macOS result is committed, repeat the same spike revision on Linux
x86_64 and Windows x86_64 with JDK 21 before using S002 as direction-decision
evidence. The three runs establish representative OS evidence only, not the full
six-tuple support matrix.

## Success criteria

The hypothesis is Supported on the tested host only if all of these hold:

1. The verified release artifact launches directly on JDK 25 and completes LSP
   initialization in Zed without `-Dsts.lsp.client=vscode`.
2. The trace shows `enableJdtClasspath: false`, the mapped
   `spring-boot-properties` language ID, and no classpath-listener request.
3. The duplicate-key control produces an attributable diagnostic.
4. At least one of the three metadata-aware probes succeeds exactly as defined:
   `server.port` completion, descriptive/type hover, or integer/type diagnostic.
5. No unsupported custom request, dynamic registration, manifest, JVM, framing,
   or unhandled-method error prevents the successful feature from being used.
6. Zed restart receives the `shutdown` response and starts a replacement Spring
   LS process that completes initialization again.

## Failure criteria

The hypothesis is Refuted for the tested host if any of these persists after one
documented correction of a setup mistake:

- the verified JAR cannot start or initialize on the declared Java/Zed tuple;
- the server requires the VS Code-only client flag to initialize;
- Zed sends the wrong LSP language ID after the declared mapping;
- the server requests classpath listening despite the explicit false option and
  cannot continue without it;
- the duplicate-key control works but all three metadata-aware probes return no
  useful result;
- unsupported server-to-client messages prevent the otherwise available
  properties feature from working; or
- restart cannot initialize a replacement server after successful shutdown.

The result is Inconclusive when the pinned artifact cannot be reacquired, an
unrelated Zed/JDK/UI failure prevents attribution, logs cannot distinguish the
Spring LS result, or the fixed fixture oracle proves ambiguous before the feature
can be evaluated.

## Evidence and privacy rules

- Commit fixture text and summarized observations only.
- Keep VSIX files, extracted artifacts, raw protocol logs, screenshots, JVM
  logs, process listings, and host paths under ignored `tmp/`.
- Do not record environment values, credentials, unrelated open documents, or
  home-directory paths in committed evidence.
- Do not remove failed or interrupted traces from the observation summary.

## Remaining uncertainty

This macOS result does not establish:

- Java project awareness or coexistence with Zed's Java extension;
- custom configuration metadata from a real project classpath;
- YAML, XML, Java, Maven, Gradle, live-process, or advanced UI behavior;
- Spring JDT bundle compatibility or callback routing;
- offline installation, automatic download, licensing completeness, or safe
  publication; or
- Linux, Windows, x86_64, or additional Arm64 support.

## Blockers and constraints after Gate B

- Candidate A cannot pass the declared MVP threshold on the tested host without
  changing the classpath-disabled premise or the pinned inputs.
- The nonstandard shutdown result is a protocol compatibility defect even
  though Zed can still replace the process.
- Representative Linux and Windows hosts remain unavailable, so this result
  cannot support or reject a multiplatform claim by itself.
- S003 cannot execute locally until the official Zed Java extension environment
  is separately installed, inspected, and approved for that spike.

## Candidate next experiment

Candidate A is non-viable for the tested properties baseline. S003 should be
written and reviewed only if the project still wants to evaluate the coordinated
full-integration path independently. It would test one synthetic JDT LS bundle
through the existing Zed Java adapter and therefore requires separate setup and
review of the macOS Zed Java development environment before execution.

## Gate A approval record

The user approved Gate B after reviewing the Gate A implementation and accepted:

- no Zed Java environment setup during S002;
- properties-only scope using spike-only `Plain Text` language mapping;
- the exact pinned official VSIX and no automatic download;
- direct Java launch with classpath integration false and no proxy;
- omission of the VS Code client flag in the primary run;
- metadata-aware value as the minimum Supported threshold;
- the S001 shutdown constraint; and
- the preparation tool as the artifact-verification boundary given the Zed API
  file-check constraint; and
- the complete disposable diff before real artifact acquisition and Zed
  installation.
