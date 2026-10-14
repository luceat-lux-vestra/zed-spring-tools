# Zed Spring Tools

**Spring Boot language intelligence for Zed.**

[![CI](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/ci.yml)
[![Platform Validation](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml/badge.svg?branch=main)](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/platform-validation.yml)
[![CodeQL](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/luceat-lux-vestra/zed-spring-tools/actions/workflows/codeql.yml)
[![License](https://img.shields.io/github/license/luceat-lux-vestra/zed-spring-tools)](LICENSE)
<br>
[![Zed Registry](https://img.shields.io/badge/Zed%20Registry-pending-yellow)](https://github.com/zed-industries/extensions/pull/6875)
[![JDK](https://img.shields.io/badge/JDK-21%2B-blue)](COMPATIBILITY.md)
[![Spring Tools](https://img.shields.io/badge/Spring%20Tools-5.3.0.RELEASE-6DB33F)](protocol/spring-artifacts.json)

Zed Spring Tools brings Spring-aware editing, navigation, diagnostics, quick fixes, live-application integration, and selected Spring tooling into Zed. The official Java extension remains the Java editor/runtime owner, while Spring analysis runs in Spring Tools' official standalone language server inside this extension's own work boundary.

> **Distribution status:** This extension is not yet published in the Zed Registry; testing currently uses a local development extension checkout. The standalone publishing-boundary blocker [#159](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/159) was closed by [#160](https://github.com/luceat-lux-vestra/zed-spring-tools/pull/160), with exact-candidate CI and desktop validation. The existing `0.1.0` [Registry submission (zed-industries/extensions#6875)](https://github.com/zed-industries/extensions/pull/6875) has been refreshed and awaits upstream maintainer review/merge. Real Registry installation and lifecycle validation remain pending under [#112](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/112).

## What works today

The following outcomes have implementations and bounded validation evidence. The exact D007 standalone-runtime candidate passed the required review under [#159](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/159): 52 evidence-required capability rows accepted, 7 explicitly terminal, and 0 pending or failed. Historical JDT/bridge results are not automatically portable to the standalone architecture, and this does not imply Registry-installed or six-platform desktop support:

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
│   └── JDT LS / Java editing capabilities
└── Zed Spring Tools
    ├── Rust/WASM extension adapter
    ├── Node coordinator
    ├── official Spring Tools standalone Boot language server
    │   ├── Maven / Gradle project model
    │   └── Jandex-backed Spring Java indexing
    └── Zed-native command and UI adaptation
```

The project does not replace the official Java extension. It also no longer reads the Java extension's private work directory, route files, or localhost proxy and no longer injects a bridge bundle into JDT LS. Both language servers compose through Zed's normal language-server routing. [D007](docs/decisions/007-standalone-spring-publishing-boundary.md) is authoritative for this boundary.

## Installation

### Current development-extension path

Until the Registry submission is merged and installable, use a local checkout as a Zed development extension.

The extension requires the official Java extension for Zed's Java language/editing experience, but Spring runtime startup does not depend on the Java extension's private files or JDT lifecycle.

The currently pinned Spring Tools runtime is the official standalone server from `5.3.0.RELEASE` (artifact version `2.3.0`). Its exact size and SHA-256 are pinned in [`protocol/spring-artifacts.json`](protocol/spring-artifacts.json); it is downloaded from Spring's release CDN on first use, validated before activation, and then reused from this extension's own work directory.

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

The inventory tracks 59 capabilities. Historical driven observations remain recorded, but rows whose proof depended on the retired JDT/bridge architecture are not promoted on the standalone runtime without new evidence. The inventory is the authority for the current state of each row.

## Verified runtime boundary

Historical driven runtime evidence is centered on macOS arm64 with Temurin JDK 25.0.3 and includes the retired JDT/bridge architecture. That evidence is retained for regression history but is not automatically proof of the standalone runtime.

Automated native CI exercises Linux, macOS, and Windows on both x86_64 and arm64, including the portable coordinator contract and a real checksum-verified standalone Spring language-server smoke. The declared JDK 21 floor runs the same standalone runtime smoke independently.

That automated evidence is intentionally narrower than an integrated support claim: it does not run Zed desktop integration on all six platforms. Exact-final-HEAD Zed development-extension validation passed for the D007 candidate used by the refreshed Registry submission. The actual Registry install/restart/offline/uninstall lifecycle remains pending under [#112](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/112).

See [Automated platform validation](docs/platform-validation.md) for the continuously refreshed CI evidence boundary and [COMPATIBILITY.md](COMPATIBILITY.md) for exact driven runtime observations.

## Embedded syntax highlighting

Spring can provide semantic tokens for embedded query and SpEL fragments inside Java strings. Zed's semantic-token support must be enabled:

```json
{ "semantic_tokens": "combined" }
```

If you prefer Zed/the official Java server's normal Java coloring, Spring's embedded syntax highlighting can be disabled independently in the Spring Tools LSP settings while keeping the rest of the Spring language intelligence active.

## Project status

The declared capability scope remains frozen while initial Registry publication and release validation complete. Current work concerns release correctness rather than new parity surface.

The release path is tracked by [release Epic #108](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/108):

1. **Complete:** [#159](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/159) / [#160](https://github.com/luceat-lux-vestra/zed-spring-tools/pull/160) removed the private Java transport and passed exact-candidate D007 desktop and CI gates.
2. **Waiting on upstream:** the existing `0.1.0` [Registry submission](https://github.com/zed-industries/extensions/pull/6875) points to the reviewed source and awaits maintainer review/merge ([#109](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/109)).
3. **After publication:** validate real Registry installation, first run, restart, cached/offline startup, and uninstall ([#112](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/112)).
4. **After successful validation:** reconcile release claims and consider v1.0 promotion ([#110](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/110) / [#113](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/113)).

No public release is claimed before the Registry lifecycle actually succeeds.

## Documentation

- [Capability inventory](docs/capability-inventory.md) — exact status of every tracked capability.
- [Compatibility](COMPATIBILITY.md) — tested components and runtime tuples.
- [Automated platform validation](docs/platform-validation.md) — native six-tuple CI coverage, real Spring runtime smoke, and the boundary between CI evidence and driven support claims.
- [Limitations](LIMITATIONS.md) — current unsupported or constrained behavior.
- [Capability delivery plan](docs/capability-delivery-plan.md) — architecture and fallback routes.
- [Release gate](docs/preview-release-gate.md) — Registry-first release policy and promotion rules.
- [`docs/spikes/`](docs/spikes/) — reproducible compatibility and architecture evidence.

## Scope

The goal is not to clone VS Code UI inside Zed. The project targets Spring development outcomes and uses Zed-native interaction surfaces where they provide the same result. Capabilities that require unavailable Zed APIs remain explicitly blocked rather than being simulated with fragile or hidden behavior.

## Contributing

Issues and pull requests should preserve the evidence-based compatibility model: implementation alone is not sufficient to broaden a support claim.

Security reports should use GitHub private vulnerability reporting rather than public issues.
