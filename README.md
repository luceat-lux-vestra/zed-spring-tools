# Zed Spring Tools

Experimental Spring Boot language intelligence for Zed, built as a companion to
the required official Java extension.

> This is an early public-development project, not a stable release. It is
> available only as a local development extension and has runtime evidence on
> one macOS arm64/JDK 25 environment.

## Project status

| Item | Current state |
| --- | --- |
| Development phase | M4 capability-parity program |
| Capability inventory | 14 `verified`, 3 `zed-native-equivalent`, 29 `planned` |
| Distribution | Local development extension only; no package or Marketplace entry |
| Runtime coverage | macOS 26.5.1 arm64 with Temurin JDK 25.0.3 |
| Other desktop/JDK combinations | Untested |

See the [capability inventory](docs/capability-inventory.md) for the evidence
behind each state and [compatibility](COMPATIBILITY.md) for the exact tested
components.
The [M4 capability delivery plan](docs/capability-delivery-plan.md) keeps each
preferred stock-Zed route beside its existing fallback and runtime gate.
The [final upstream audit](docs/research/014-final-upstream-capability-surface-audit.md)
found no better official stock-Zed architecture; it records the compatibility-
gated official Java 6.8.23 task improvement and the unavailable private/removed
shortcuts.

## What works today

The following outcomes have been observed on the tested environment:

- Spring Boot property and YAML completion, hover, validation, and definition
  navigation;
- Spring workspace symbols, request-mapping navigation, and bean navigation;
- cron inlay hints;
- Spring quick-fix code actions applied end to end;
- Java references and implementations through the official Java language
  server; and
- the `sts/javaType` Spring-to-Java data route.

Zed-native language-server startup replaces the VS Code-specific
`vscode-spring-boot.ls.start` command. Most of the broader VS Code Spring Tools
surface is still planned or unverified.

## Try it locally

### Prerequisites

- Zed with the official Java extension version `6.8.21` installed;
- JDK 21 or newer available to Zed; only Temurin JDK 25.0.3 is runtime-verified;
- Rust installed through `rustup`, which Zed requires when building a local
  development extension; and
- network access for the first pinned Spring Tools artifact download.

### Install

1. Clone this repository.
2. Install the official Java extension before opening the Java project.
3. In Zed's Extensions page, choose **Install Dev Extension** — or run
   `zed: install dev extension` — and select this repository directory. See
   [Zed's development-extension instructions](https://zed.dev/docs/extensions/developing-extensions).
4. Open a Spring Boot project and wait for Java project import and Spring
   indexing to finish. The integrated product path is verified only with the
   repository's Maven fixture.

If Java was already running when this extension was installed, restart Zed so
JDT LS receives the contributed bridge bundles. If the first Spring artifact
download remains stuck, restart Zed and retry. Both conditions are documented in
[known limitations](LIMITATIONS.md).

## How it fits together

```text
Zed
├── official Java extension ──> Java-owned JDT LS
│                                  └── contributed Spring/bridge bundles
└── Zed Spring Tools ────────> coordinator ──> Spring Boot LS
                                   │
                                   └── versioned loopback bridge to JDT LS
```

The official Java extension and its proxy remain unmodified. This project owns
the Rust/WASM Zed adapter, the Node coordinator, the reviewed Java bridge, and
the versioned coordination protocol. It does not provide a reduced or
self-managed JDT fallback.

The coordinator now retries a classpath-listener handshake that times out while
the official Java server is still importing the project. Regression tests cover
transient recovery, grace-window exhaustion, and immediate reporting for
unrelated Java-route failures. A forced-timeout recovery run in real Zed remains
pending.

## Important limitations

- This is not a stable release and does not claim multiplatform support.
- The official Java extension `6.8.21` is required.
- Official Java 6.8.23 is a planned compatibility refresh, not yet supported.
- Installation after JDT LS has already started requires a Zed restart.
- First-use artifact acquisition can hang until Zed is restarted.
- There is no product continuous integration, packaged release, offline install,
  rollback flow, or Marketplace entry yet.
- SSH remote development and WSL-hosted projects are outside the current scope.

Read [known limitations](LIMITATIONS.md) before relying on the extension.

## Evidence and roadmap

- [Capability inventory](docs/capability-inventory.md) — user-visible parity
  states and runtime evidence
- [M4 capability delivery plan](docs/capability-delivery-plan.md) — preferred
  routes, preserved fallbacks, and verification gates
- [Implementation plan](docs/implementation-plan.md) — milestones and delivery
  gates
- [Compatibility](COMPATIBILITY.md) — exact verified and untested environments
- [Decisions](docs/decisions/README.md) — accepted product direction and stack
- [Research](docs/research/README.md) and [spikes](docs/spikes/README.md) — source
  findings and reproducible feasibility evidence
- [Contributing](CONTRIBUTING.md) — branch, evidence, validation, and PR rules

## Repository layout

```text
src/            Rust/WASM Zed extension adapter
coordinator/    Dependency-free Node coordinator and tests
bridge/         Java bridge contributed to the Java-owned JDT LS
protocol/       Versioned schemas and compatibility fixtures
scripts/        Local PoC preparation and bridge verification
tests/          Product fixtures
docs/           Decisions, research, spikes, inventory, and roadmap
spikes/         Disposable experiment code; never production code
```

No Spring VSIX, JAR, JDT LS distribution, Zed application, or other third-party
binary is committed to this repository.

## Development checks

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --locked
node --test "coordinator/test/*.test.mjs"
cargo build --locked --release --target wasm32-wasip2
```

The Spring Boot fixture can be compiled independently with:

```sh
mvn -f tests/fixtures/spring-boot-basic/pom.xml clean test
```

## License

This project's source is licensed under the [Apache License 2.0](LICENSE).
Third-party components keep their own licenses and are not redistributed here;
see [third-party notices](THIRD_PARTY_NOTICES.md).
