# Gradle axis resolution

- Status: **Survey complete, driven gate pending**
- Date: 2026-07-29
- Related: [implementation-plan](implementation-plan.md) M6 gap 1;
  [capability-inventory](capability-inventory.md);
  [capability-delivery-plan](capability-delivery-plan.md);
  [LIMITATIONS](../LIMITATIONS.md)

Every driven gate in this repository so far ran on a Maven project. M6 names
that as a gap and fixes the exit condition: before a stable release, each
capability with a build-system dependency must sit in exactly one of two
states — **driven on a Gradle fixture**, or **declared a first-class Maven-only
limitation in release-facing text**. "Untested, probably fine" is neither.

This document is the resolution. It first establishes *which* rows actually
have a build-system dependency, because the honest answer is far fewer than the
59 tracked capabilities, and then records the outcome for each.

## What this axis is not

It is not a platform tuple. M5's six-tuple matrix will never touch it, and a
passing M5 says nothing about Gradle. The two gaps are independent, and one
sub-axis belongs to both — see [the wrapper sub-axis](#the-wrapper-sub-axis).

## Classification

A capability is build-system-sensitive only if some code — Spring's or this
extension's — branches on the build tool, reads the build file, or writes a
build command. Everything else reaches Spring through the jdtls classpath,
where Maven and Gradle have already been normalised into one `IJavaProject`.

| Class | Meaning | Resolution it needs |
| --- | --- | --- |
| **A** | Reaches Spring only through the resolved project index. No build-tool branch on either side. | One driven observation that the class holds on Gradle. Not one gate per row. |
| **B** | Reads the build tool, the build file, or writes a build command. | Its own Gradle evidence. |
| **C** | Maven-only in upstream's own code. | A stated limitation, plus evidence of what the user actually sees. |

Class A is a claim about code, so it is falsifiable: if the Gradle observation
finds any class-A row behaving differently, the classification is wrong and the
row moves to B. That is the point of driving the class rather than asserting it.

### Class A — resolved by the project index

All property surfaces (completion, hover, validation, definition, metadata
reload, both conversions), both contributed languages, every language-
intelligence row (symbols, mappings, bean navigation, CodeLens, inlay hints,
code actions, references and implementations, Spring-aware completion,
templates, SpEL, Spring Data queries, cron), every live-data row, Structure,
Open app page URL, Java type resolution, classpath listening, the Java
reconcilers, and Spring AI indexing.

Live data is the strongest case in the class: it talks to a *running JMX
process* and never sees a build file at all.

The foundation is already observed. S016's third driven run
([spike 016](spikes/016-official-java-6.8.23-compatibility-refresh.md), run 3,
2026-07-19) opened a Gradle mirror of the Maven fixture in the same isolated
Zed and saw jdtls import it through **GradleProjectImporter** (Buildship), the
Gradle worktree get its own coordinator and Spring Boot LS, and — the decisive
part — **visible `server.port` completion in the Gradle worktree's
`application.properties`**. Spring cannot answer that without a resolved
classpath, so the classpath route works on Gradle.

What S016 did *not* do is sweep the class. It observed one property completion,
which is why this axis still needs a gate rather than a citation.

### Class B — needs its own Gradle evidence

| Row | Where the build system enters | Prediction to test |
| --- | --- | --- |
| Boot project info | Spring returns a `buildTool` field; every observation so far read `maven` | Reports `gradle` |
| Executable Boot projects discovery | Feeds the generator below | Finds the Gradle project |
| Run / debug a Boot application | `detectBuildTool` and `runArgumentsFor` in `coordinator/src/main.mjs` | `./gradlew bootRun`, profiles as `--args=--spring.profiles.active=<p>`, and the task actually runs |
| Maven goal / Gradle build | `buildTaskRequest` accepts both command ids | Nothing fires on Gradle — see below |
| Spring Boot version/support validation | Publishes to `IProjectBuild.getBuildFile()` | Diagnostic lands on `build.gradle` |
| Modulith metadata refresh | Spawns `ApplicationModulesExporter` over the project classpath | Works once the project is compiled |
| Embedded Spring Tools MCP server | `getResolvedProjectClasspath` and the version tools read the classpath | Answers for a Gradle project |
| Offline behaviour | Gradle's own first import resolves dependencies over the network | Import fails offline in a way Maven's warm `~/.m2` hid |

Two of these were sharpened by reading the pinned jar rather than the prose.

**Version validation is build-tool-neutral by construction.**
`BootVersionValidationEngine` publishes its diagnostics against
`IJavaProject.getProjectBuild().getBuildFile()` and contains no build-tool test
of any kind. So the Gradle question is not "does it run" but "does the
diagnostic anchor on `build.gradle`", which is a matter of what jdtls reports
as the build file.

**`sts.gradle.build` is unreachable in the pinned release, so its row's Gradle
half cannot be driven at all.** It has no caller anywhere in the server, and the
only reachable build operation, `sts.maven.goal`, is emitted solely by the Data
AOT lenses with `org.springframework.boot:spring-boot-maven-plugin:process-aot`
— a Maven plugin coordinate with no Gradle counterpart in this release. This is
therefore not a gap in coverage: there is no Gradle build surface upstream to
reach parity with. The coordinator's interception of `sts.gradle.build` remains
defensive, contract-tested, and dead by upstream design.

### Class C — Maven-only in upstream's own code

**Spring Boot upgrade.** The rejection is confirmed in two independent places in
the pinned jar, and the user-visible consequence is milder than "rejects Gradle
outright" suggested:

1. `UpdateBootVersion.canProvideQuickfix(IJavaProject)` compiles to exactly
   `"maven".equals(project.getProjectBuild().getType())`, and
   `validatePatchVersion` consults it *before* attaching the upgrade action.
2. `SpringBootUpgrade` independently asserts the same condition with the message
   `Only Maven projects supported`.

So on a Gradle project the upgrade quick fix is **never offered**, and the
command that would throw is never reachable through the UI. The same method
adds `openReleaseNotesCodeAction` **unconditionally**, outside the quick-fix
branch, so a Gradle user still gets the diagnostic and one action — read the
release notes — and simply not the one-click upgrade.

One consequence worth recording: the coordinator's upgrade failure-visibility
path, added because Spring throws when `~/.m2/settings.xml` is absent, is
unreachable on Gradle. That is correct, not a hole.

## The wrapper sub-axis

Two wrapper questions are distinct from the build tool itself.

**Windows wrapper forms are hardware-blocked.** `detectBuildTool` selects
`mvnw.cmd`/`gradlew.bat` when the host OS is Windows. There is no Windows host
here, so that branch stays untested for the same reason M5 slices 2-4 are
blocked. **M6 therefore cannot fully close on this host, and this document says
so rather than smoothing it over.** The branch is covered by contract tests, and
a contract test is not a driven gate.

**A subproject deliberately does not inherit the root wrapper.**
`detectBuildTool` looks only beside the build file, so a Gradle subproject with
no wrapper of its own resolves to the bare `gradle` from `PATH`, not to the
root's `./gradlew`. That is a deliberate choice — substituting a wrapper from
further up the tree would change which build the user asked for — and it
applies identically to Maven multi-module. The Gradle gate should observe it
rather than leave it as a code comment.

## Fixture

`tests/fixtures/spring-boot-gradle/` — added by this slice, and durable rather
than disposable, because the Gradle axis is a standing re-test surface and every
future gate needs it.

## Outcome

Pending the driven gate. Each row above lands in exactly one of:

- **Driven** — evidence path recorded, inventory row amended.
- **Maven-only** — stated in `LIMITATIONS.md` and the row, with what the user
  sees instead.
- **Unreachable upstream** — no parity target exists, recorded as such.
