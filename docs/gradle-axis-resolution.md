# Gradle axis resolution

- Status: **Resolved**, except the Windows wrapper forms, which stay
  hardware-blocked
- Date: 2026-07-29
- Driven tuple: macOS 26.5.2 arm64, Zed 1.12.1, official Java 6.8.21 (jdtls
  1.60.0), Spring Tools 5.2.0, Temurin JDK 25.0.3 for jdtls / project JRE
  21.0.11, Gradle 9.5.1 wrapper
- Evidence: `tmp/gradle-axis-20260729/evidence/`
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

## Fixtures

Both are durable rather than disposable, because the Gradle axis is a standing
re-test surface and every future gate needs it.

- `tests/fixtures/spring-boot-gradle/` — a copy of `spring-boot-basic` on a
  Gradle build, pinned one patch behind at Boot 3.5.0 so version validation has
  something to publish, with `dev` and `prod` profile files.
- `tests/fixtures/spring-modulith-gradle/` — a copy of the Maven Modulith
  fixture's `inventory-app` arm, same Boot 3.5.5 / Spring Modulith 1.4.12, the
  arm that carries the application-module violation.

## Outcome

Both Gradle projects resolved through jdtls's Buildship import in one isolated
Zed, and the gate was driven against them together.

### Class A holds — the classification was not refuted

Spring answered from the resolved Gradle classpath on every class-A surface the
run touched, and the shapes are identical to the Maven arm:

| Surface | Observed on Gradle |
| --- | --- |
| Property completion | `ser` → the whole `server.*` list with types and `Network address to which the server should bind.` |
| Property validation | `PROP_UNKNOWN_PROPERTY` `'ser' is an unknown property. Did you mean 'server.address'?` plus `PROP_SYNTAX_ERROR` |
| Java reconcilers | `JAVA_PUBLIC_BEAN_METHOD`, `JAVA_REPOSITORY` |
| Spring Data queries | `HQL_SYNTAX` and `SQL_SYNTAX` (PostgreSQL), i.e. the dependency-selected grammars |
| SpEL | `JAVA_SPEL_EXPRESSION_SYNTAX` and `PROPERTY_PLACE_HOLDER_SYNTAX` |
| Cron | `SYNTAX` `CRON: mismatched input '<EOF>' expecting WS` |
| CodeLens / code actions | all seven product `source` actions offered, unioned with jdtls's own |

No class-A row behaved differently, so none moves to class B.

### Class B — all driven

| Row | Result |
| --- | --- |
| Boot project info | `gradle build` — the notice read *project zed-spring-tools-fixture-gradle-worktree — main class dev.zed.spring.fixture.FixtureApplication · gradle build · Spring Boot 3.5.0 · Java 21.0.11*. Closes the row's "`buildTool` was `maven` throughout" limit. |
| Executable Boot projects discovery | Found the Gradle project; single project, so no selection prompt, as designed |
| Run / debug generation | `./gradlew` (the wrapper, over the bare `gradle`), `bootRun`, three task entries and three debug entries, `$ZED_WORKTREE_ROOT` cwd |
| Run / debug **execution** | **Both generated commands were run verbatim.** The base entry served `GET /greeting` → `200 hello` on 8080; the `dev` entry, with the Gradle-specific `--args=--spring.profiles.active=dev`, served the same on **8081** — the port `application-dev.properties` sets. The port move is what proves the argument took effect rather than merely being accepted. |
| Version / support validation | Publishes on **`build.gradle`** in both projects: `Newer patch version of Spring Boot available: 3.5.16` and the OSS-support-ended notice |
| Modulith metadata refresh | Spring's own `Project 'inventory-app-gradle-modulith' Modulith metadata has been changed.` The non-Modulith Gradle project was correctly not offered. |
| Modulith violation diagnostic | `MODULITH_TYPE_REF_VIOLATION` `Invalid reference to non-exposed type of module 'catalog'!` |
| Embedded MCP server | Through the shipped opt-in setting on the Gradle worktree: `getProjectList` → the Gradle project with JRE 21.0.11, `getSpringBootVersion` → 3.5.0 (i.e. read from the Gradle build), `getRequestMappings` → the `/greeting` `GET` mapping, `getBeanDetails` 27 895 B with source ranges, `getProjectDiagnostics` 11 932 B |
| Maven goal / Gradle build | Not driveable and correctly so — see below |

**`getResolvedProjectClasspath` fails identically on Gradle**, with the same
`Classpath$CPE.getVersion()` null dereference the Maven run found. Reproducing
across both build systems is useful corroboration that the defect is upstream's
missing null check and not a Maven-shaped input.

**The plan's "Modulith metadata generation is Maven-only in practice" was
wrong.** `ModulithService` builds a classpath string from `IClasspath` entries
and spawns `ApplicationModulesExporter` against it; nothing in that path reads a
build file. The real precondition is *compiled classes*, which is build-system
agnostic — `./gradlew classes` satisfies it exactly as `mvn compile` does.

### Class C — Maven-only, stated

Spring Boot upgrade, for the reasons read from the jar above. The
release-facing statement is in [LIMITATIONS](../LIMITATIONS.md).

### Unreachable upstream, not a coverage gap

`sts.gradle.build`. There is no Gradle build surface in the pinned release to
reach parity with, so this cannot be driven and its absence is not a limitation
of this extension.

## What is still open

**The Windows wrapper forms.** `mvnw.cmd` and `gradlew.bat` are selected by
`detectBuildTool` only when the host OS is Windows, and there is no Windows host
here. Contract tests cover the branch; a contract test is not a driven gate.
**M6 therefore does not fully close on this host**, and the honest statement is
that the Gradle axis is resolved on macOS arm64 while one wrapper sub-axis
remains blocked on the same hardware M5 slices 2-4 are blocked on.

Two smaller items the gate did not cover, recorded rather than implied:

- Workspace symbol search was not exercised on Gradle, because Zed's picker
  cannot be driven from `osascript`. It is class A and the same index answered
  every other request in the run, but it was not individually observed.
- Multi-project Gradle builds. Each fixture is a single-project build, so the
  documented behaviour that a subproject without its own wrapper resolves to the
  bare `gradle` remains contract-tested only.
