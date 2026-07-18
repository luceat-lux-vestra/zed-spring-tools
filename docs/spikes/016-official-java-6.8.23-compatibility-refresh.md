# S016: Official Java 6.8.23 compatibility refresh

- Status: Proposed
- Date: 2026-07-18
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

Not run.

## Result

Pending. This plan adds no compatibility record and changes no capability state.

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
