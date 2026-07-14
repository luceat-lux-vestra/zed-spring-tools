# D001: Local-first capability parity and staged public development

- Status: Accepted
- Date: 2026-07-15
- Decision owner: Project owner

## Context

R001-R005 and S001-S005 established the local integration constraints and three
critical JDT/Spring seams on macOS arm64. They did not establish an end-to-end
Spring Boot LS product flow or multiplatform runtime support. Linux and Windows
test hosts are not currently available, but delaying all product-direction and
public-development work until those hosts exist would prevent useful local
progress.

Zed procedural extensions compile to WebAssembly and expose the current host
platform, worktree environment, executable discovery, and managed work paths.
The current disposable extension code already treats host separators explicitly.
These are confirmed portability inputs, not proof that the future product works
on an untested operating system. Native coordination code, if selected, remains
a separate per-platform delivery concern.

The source and runtime basis is recorded in [R001](../research/001-zed-extension-language-server-lifecycle.md),
[R002](../research/002-spring-tools-language-server-execution-model.md),
[R004](../research/004-integration-structure-candidates.md),
[R005](../research/005-distribution-and-licensing.md),
[S004](../spikes/004-spring-jdt-bundle-command.md),
[S005](../spikes/005-classpath-callback-routing.md), and the
[prerequisite matrix](../spikes/prerequisites.md). This decision records a goal
and delivery order; it does not select Candidate B, C, D, or any production
architecture.

## Decision

1. The long-term goal is capability parity with VS Code Spring Tools. Maintain a
   capability inventory covering language intelligence, commands, navigation,
   project and application workflows, diagnostics, configuration, and other
   user-visible Spring Tools behavior.
2. Parity means equivalent user outcomes in Zed, not pixel-identical VS Code UI.
   A missing Zed API does not remove a capability from the goal. Record it as a
   blocker, pursue an upstream surface, or design a Zed-native alternative.
3. First complete a basic end-to-end PoC on the available macOS arm64 host. The
   PoC must start the real Spring Boot LS, use the real JDT integration path,
   populate the real Spring Java project data path, and demonstrate at least one
   attributable Spring feature in a fixture. Its exact hypothesis and criteria
   require a separately reviewed spike plan.
4. After that PoC, publish this source repository on GitHub and continue
   development publicly and incrementally. The initial public state is
   experimental research/PoC, not a stable product or support declaration.
5. Design the future extension package to be installable on every
   Zed-supported macOS, Linux, and Windows desktop from the start. Do not add an
   unnecessary platform restriction merely because runtime testing occurred on
   macOS.
6. Runtime support labels remain evidence-based. Before validation, Linux,
   Windows, x86_64, and additional Arm64 combinations are `untested`. Full
   desktop and JDK matrix validation occurs incrementally after the local PoC
   and initial public source release, and remains mandatory before a stable
   multiplatform support claim.

## Initial public-source gate

Before making the GitHub repository public:

- complete and document the accepted local end-to-end PoC;
- choose a repository license accepted for a future Zed extension;
- scan tracked history and files for secrets, machine-specific private data,
  generated binaries, and third-party artifacts;
- keep the Spring VSIX and extracted JARs out of Git;
- document exact tested versions and macOS arm64/JDK status;
- label every other target as untested; and
- provide reproducible setup plus known limitations and blockers.

A later experimental Zed Marketplace preview additionally requires a recorded
product direction, a reviewed product manifest and implementation, compliant
artifact acquisition, and a successful clean local installation. It does not
by itself assert multiplatform runtime support.

## Consequences

- Linux and Windows hosts no longer block the local direction decision or the
  initial GitHub source publication.
- All implementation plans must preserve platform-neutral extension packaging,
  host-aware paths, executable discovery, and explicit tested/untested labels.
- The first public version may be useful only on the tested macOS tuple while
  remaining installable but unverified elsewhere.
- Capability parity becomes an incremental program, so the later roadmap must
  distinguish PoC, preview, supported core, and parity milestones.
- Upstream work with the Zed Java extension and possibly Zed itself remains
  likely; public development can make those coordination proposals reviewable.

## Remaining uncertainty

- The product architecture and ownership of the coordination boundary.
- Whether the existing Java extension maintainers will accept the necessary
  versioned coordination interface.
- The real Spring Boot LS end-to-end data flow and first attributable feature.
- Runtime behavior outside macOS arm64 and with JDK 21.
- Which VS Code Spring Tools capabilities require new Zed APIs or alternative
  workflows.
- Distribution provenance, third-party notices, offline installation, signing,
  quarantine, and security-scanner behavior.

## Revisit conditions

Revisit this delivery order if the local end-to-end PoC is Refuted, Zed rejects
an experimental extension that exposes untested targets, a required dependency
cannot be distributed lawfully, or early public feedback materially changes the
parity priorities. Do not silently lower the long-term parity goal; record a new
decision if it must change.
