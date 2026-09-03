# Zed Spring Tools

**Spring Boot language intelligence for Zed.**

Zed Spring Tools brings Spring-aware editing, navigation, diagnostics, quick fixes, live-application integration, and selected Spring tooling into Zed while working alongside the required official Java extension.

> **Distribution status:** the extension is not published in the Zed Registry yet. The current supported testing path is a local Zed development extension checkout. The initial Registry submission is tracked in [zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875).

## What works today

On the currently verified environment, Zed Spring Tools provides:

- Spring Boot `.properties` and `.yaml` completion, hover, validation, and definition navigation.
- Spring-aware Java completion for property keys, bean names, profiles, scopes, Spring Data query methods, and related Spring contexts.
- Spring Java diagnostics and quick fixes, including JDT refactorings and supported OpenRewrite-backed fixes.
- Spring Data query validation and navigation for JPQL/HQL/SQL fragments.
- SpEL validation and navigation in Spring annotations and expressions.
- Bean, request-mapping, workspace-symbol, reference, and implementation navigation composed with the official Java language server.
- Spring Boot version/support diagnostics and related reviewable actions.
- Spring Modulith diagnostics and structure support for the verified Maven path.
- Spring CodeLens compatibility adapted to Zed-native UI where possible.
- Live application integration for supported local and remote Spring processes, including runtime data exposed through Spring Tools.
- Spring Tools' embedded MCP server as an explicit opt-in for AI-agent access to resolved project information.
- Offline language intelligence after the required pinned Spring Tools runtime has been downloaded once; network-dependent release/update diagnostics simply become unavailable rather than serving stale data.

For the exact row-by-row capability state, evidence, exceptions, and blockers, see the [capability inventory](docs/capability-inventory.md) and [compatibility matrix](COMPATIBILITY.md).

## How it fits into Zed

```text
Zed
├── official Java extension
│   └── Java language server / Java capabilities
└── Zed Spring Tools
    ├── Spring Tools language services
    ├── Java/Spring coordination
    ├── Zed-native command and UI adaptation
    └── bounded compatibility fallbacks
```

The project does not replace the official Java extension. It coordinates with it and adds Spring-specific capabilities while adapting Spring Tools behavior to the surfaces Zed actually exposes.

## Installation

### Current development-extension path

Until the Registry submission is merged and installable, use a local checkout as a Zed development extension.

The extension requires the official Java extension. If the Spring extension is installed after JDT LS has already started, restart Zed so the coordinated runtime can initialize cleanly.

Registry installation instructions will replace this section after the extension is actually published.

## Compatibility policy

Zed Spring Tools distinguishes between implementation and support evidence.

A capability is tracked as one of:

- **verified** — observed working on a named runtime tuple;
- **implemented** — built but not yet observed working on a supported tuple;
- **planned** — not built yet;
- **blocked-zed-api** — Zed lacks the required client/API surface;
- **blocked-upstream** — blocked by Spring Tools or the official Java extension;
- **zed-native-equivalent** — a different Zed-native workflow delivers the intended outcome;
- **not-pursued** — intentionally excluded because parity is already achieved another way or the capability is outside the target.

The current inventory tracks 59 capabilities, with 48 verified on the named evidence baseline. The remaining rows are explicit Zed API blockers, Zed-native equivalents, or decided-out exceptions rather than hidden unfinished work.

## Verified runtime boundary

Current runtime evidence is centered on macOS arm64 with Temurin JDK 25.0.3 and the declared JDK 21 floor exercised through the portability work. Other desktop/JDK tuples remain unverified until they receive equivalent driven evidence.

The implementation contains OS-aware coordination for Zed desktop platforms, but implementation portability is **not** treated as a support claim by itself.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the exact tested versions and runtime slices.

## Embedded syntax highlighting

Spring can provide semantic tokens for embedded query and SpEL fragments inside Java strings. Zed's semantic-token support must be enabled:

```json
{ "semantic_tokens": "combined" }
```

If you prefer Zed/the official Java server's normal Java coloring, Spring's embedded syntax highlighting can be disabled independently in the Spring Tools LSP settings while keeping the rest of the Spring language intelligence active.

## Project status

Capability delivery for the declared scope is complete; current work is focused on distribution and release readiness rather than inventing additional parity requirements.

The release path is tracked by [release Epic #108](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/108):

1. publish the existing `0.1.0` Registry submission;
2. exercise the real Registry install / first-run / restart / offline / uninstall lifecycle;
3. promote release claims only when that path has evidence.

No public release is claimed before the Registry lifecycle actually succeeds.

## Documentation

- [Capability inventory](docs/capability-inventory.md) — exact status of every tracked capability.
- [Compatibility](COMPATIBILITY.md) — tested components and runtime tuples.
- [Limitations](LIMITATIONS.md) — current unsupported or constrained behavior.
- [Capability delivery plan](docs/capability-delivery-plan.md) — architecture and fallback routes.
- [Release gate](docs/preview-release-gate.md) — Registry-first release policy and promotion rules.
- [`docs/spikes/`](docs/spikes/) — reproducible compatibility and architecture evidence.

## Scope

The goal is not to clone VS Code UI inside Zed. The project targets Spring development outcomes and uses Zed-native interaction surfaces where they provide the same result. Capabilities that require unavailable Zed APIs remain explicitly blocked rather than being simulated with fragile or hidden behavior.

## Contributing

Issues and pull requests should preserve the evidence-based compatibility model: implementation alone is not sufficient to broaden a support claim.

Security reports should use GitHub private vulnerability reporting rather than public issues.
