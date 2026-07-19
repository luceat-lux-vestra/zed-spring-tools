# Zed Spring Tools

Experimental Spring Boot language intelligence for Zed, built as a companion to
the required official Java extension.

> This is an early public-development project, not a stable release. The
> platform-neutral WASM adapter and OS-aware coordinator are written for Linux,
> macOS, and Windows; runtime evidence to date is on macOS arm64/JDK 25, and an
> extension-registry submission is in preparation.

## Project status

| Item | Current state |
| --- | --- |
| Development phase | M4 capability-parity program |
| Capability inventory | 17 `verified`, 5 `implemented`, 5 `zed-native-equivalent`, 30 `planned` |
| Distribution | Local development extension today; extension-registry submission in preparation |
| Runtime coverage | macOS arm64 with Temurin JDK 25.0.3; exact point releases and slices are recorded in compatibility evidence |
| Other desktop/JDK combinations | Supported by the platform-neutral adapter and OS-aware coordinator; not yet driven |

See the [capability inventory](docs/capability-inventory.md) for the evidence
behind each state and [compatibility](COMPATIBILITY.md) for the exact tested
components.
The [M4 capability delivery plan](docs/capability-delivery-plan.md) keeps each
preferred stock-Zed route beside its existing fallback and runtime gate.
The [final upstream audit](docs/research/014-final-upstream-capability-surface-audit.md)
found no better official stock-Zed architecture; it records the official Java
6.8.23 task improvement and the unavailable private/removed shortcuts.
S015 found that Java and Spring Document Symbols merge well after both servers
are ready, but restart can cache Spring-only results before JDT registers the
capability. Project Symbols therefore remains the supported navigation fallback.
S016 then verified official Java 6.8.23 coordination, warm-cache startup, and
its normal-profile Maven main runnable on the tested tuple. D006 makes official-
Java compatibility capability-first rather than release-pinned: a release
continues when the known runtime contract works and fails visibly when it does
not. The coordinator now presents a bounded, user-reviewed GitHub report as a
clickable Zed notification; the user's browser session handles GitHub sign-in
and nothing is submitted automatically.

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

The coordinator also implements Spring CodeLens compatibility: standard Spring
lenses retain server actions, source-opening lenses use Zed's native location
UI, and version-matched live `sts/highlight` lenses are merged without showing
stale data. A driven macOS run connected a real Boot process and verified
rendered endpoint URLs, live bean/injection lenses, refresh, click-selected
ranges, the explanatory fallback, and authentic Spring data in native Hover.
The same gate verified the commandless `@Value` adaptation: the lens kept the
runtime value out of persistent source UI, while native Hover returned
`CODELENS_SAMPLE_LIMIT : 37 (from: systemEnvironment)` from the connected
process.
The five separate static Spring provider families are enabled by product
defaults, contract-tested, and observed in the showcase. Data AOT `CL-4d` now
pre-resolves Spring's authentic generated target and rewrites the lens to Zed's
native location command; a driven click opened the exact AOT method while the
fixture's `/target/` remained ignored. AI-only titles remain visible regardless
of Zed AI state. Their notice now says precisely that current Zed APIs let this
extension neither detect nor invoke Agent and that the extension sends no
source or prompt to an AI service.

A Boot run/debug configuration Code Action discovers executable Spring Boot
projects on a Java file, prompts a bounded selection, and generates merge-safe
`.zed/tasks.json` run tasks (wrapper-aware `spring-boot:run`/`bootRun`) and
`.zed/debug.json` (`"adapter": "Java"`) launches — portable across machines,
secret-free, and never overwriting a config it cannot parse without loss (a
commented or non-array file receives a reviewable sidecar instead). It emits one
base entry plus one per discovered Spring profile (from `application-<profile>.*`
filenames and multi-document `application.yml` activation, capped at eight) so
Zed's task/debug picker becomes the profile selector, alongside editable
`vmArgs`/`args`/`env` slots. Driven checks on 2026-07-19 (macOS arm64, Zed 1.11.3,
official Java 6.8.21, JDK 25) verified discovery, generation, profile entries,
the generated run task serving `GET /greeting`, and a Java debug launch from the
generated `dev` entry after editing all three debug slots.

Newly implemented and contract-tested, with a driven run still pending before
promotion: `source` Code Actions on `.properties` and `.yaml`/`.yml` files that
convert between the two formats and reload shared properties metadata. The
coordinator computes a non-colliding target file beside the source and executes
Spring's `sts/boot/props-to-yaml` / `yaml-to-props` (keeping the original, to
match VS Code's default) or `sts/common-properties/reload`; the Spring server
performs the file creation through a standard `workspace/applyEdit`. These rows
stay `implemented` in the inventory until a driven Zed run confirms the edit is
applied.

The [CodeLens showcase and coverage matrix](docs/code-lens-showcase.md) maps
every standard provider, its user-visible subfeatures, the separate live-data
stream, and JDT reference lenses to numbered targets in one Java fixture file.

Zed disables CodeLens by default. To see Java and Spring lenses, add this to
your Zed settings:

```json
{
  "code_lens": "on"
}
```

For a live lens that needs more detail, clicking selects its source position.
Then run `editor: hover` (`cmd-k cmd-i` on macOS, `ctrl-k ctrl-i` on
Linux/Windows). Stock Zed cannot yet perform that second action automatically.
For a live endpoint URL lens, clicking explains that Zed cannot execute Spring
Tools' VS Code-only URL command; the visible URL can still be opened manually.
The CodeLens fixture ignores its own `target/` output. For other projects, Zed
offers no extension-controlled sort-last behavior; `.gitignore` or local
`.git/info/exclude` remains the project/user choice, and this extension does not
edit it.

## Try it locally

### Prerequisites

- Zed with the official Java extension installed (required); the product is not
  pinned to one extension point release, while exact tested releases remain
  recorded;
- an XML extension that registers the `XML` language (e.g. `sweetppro/zed-xml`)
  is optional but required for `pom.xml` Maven inlay hints — Zed has no built-in
  XML language, the same way Java support requires the official Java extension;
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

- This is not a stable release. The adapter and coordinator are written for
  Linux, macOS, and Windows, but only macOS arm64 has runtime evidence; other
  platforms are supported in code and not yet driven.
- The official Java extension is required. Compatibility is capability-based,
  so an upstream release can still break the private route and produce a visible
  failure until this project adapts.
- Automatic GitHub issue creation through Zed sign-in is unavailable. On a
  recognized compatibility failure, the implemented notification opens a
  bounded title/body-prefilled public issue in the user's browser for review
  and manual submission. A driven Zed-to-browser check passed; the test did not
  submit an issue. Security reports must use private vulnerability reporting.
- Installation after JDT LS has already started requires a Zed restart.
- The opt-in Java LSP Outline is not a supported Spring route: after restart it
  can omit ordinary Java symbols until a document edit forces recollection.
- First-use artifact acquisition can hang until Zed is restarted.
- Continuous integration runs format, lint, tests, and the WASM release build;
  there is no packaged release, offline install, rollback flow, or published
  registry entry yet.
- SSH remote development and WSL-hosted projects are outside the current scope.

Read [known limitations](LIMITATIONS.md) before relying on the extension.

## Evidence and roadmap

- [Capability inventory](docs/capability-inventory.md) — user-visible parity
  states and runtime evidence
- [CodeLens showcase](docs/code-lens-showcase.md) — one inspection fixture plus
  the provider/subfeature implementation and verification matrix
- [M4 capability delivery plan](docs/capability-delivery-plan.md) — preferred
  routes, preserved fallbacks, and verification gates
- [Implementation plan](docs/implementation-plan.md) — milestones and delivery
  gates
- [Compatibility](COMPATIBILITY.md) — exact verified and untested environments
- [Decisions](docs/decisions/README.md) — accepted product direction and stack
- [Research](docs/research/README.md) and [spikes](docs/spikes/README.md) — source
  findings and reproducible feasibility evidence
- [Contributing](CONTRIBUTING.md) — branch, evidence, validation, and PR rules
- [Contributors](CONTRIBUTORS.md) — generated from git history; AI assistants
  are credited in commit trailers, not here

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
node scripts/generate-contributors.mjs --check
cargo build --locked --release --target wasm32-wasip2
```

Continuous integration runs these same checks on every push and pull request.

The Spring Boot fixture can be compiled independently with:

```sh
mvn -f tests/fixtures/spring-boot-basic/pom.xml clean test
```

## License

This project's source is licensed under the [Apache License 2.0](LICENSE).
Third-party components keep their own licenses and are not redistributed here;
see [third-party notices](THIRD_PARTY_NOTICES.md).
