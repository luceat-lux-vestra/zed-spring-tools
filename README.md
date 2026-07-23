# Zed Spring Tools

Experimental Spring Boot language intelligence for Zed, built as a companion to
the required official Java extension.

> This is an early public-development project, not a stable release. The
> WASM adapter and OS-aware coordinator are designed for Zed's Linux, macOS,
> and Windows desktop boundary. Runtime evidence to date is limited to macOS
> arm64/JDK 25, and the extension-registry submission is under review.

## Project status

| Item | Current state |
| --- | --- |
| Development phase | M4 capability-parity program |
| Capability inventory | 36 `verified`, 1 `implemented`, 6 `zed-native-equivalent`, 12 `planned`, 2 `blocked-zed-api`, 1 `not-pursued` |
| Distribution | Local development extension today; submitted to the Zed extension registry as [zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875), awaiting maintainer review |
| Runtime coverage | macOS arm64 with Temurin JDK 25.0.3; exact point releases and slices are recorded in compatibility evidence |
| Other desktop/JDK combinations | Untested; the implementation is platform-aware, but that is not a support claim |

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
- `.properties`↔`.yaml` conversion, and shared properties metadata reload once
  `boot-java.common.properties-metadata` names a metadata file;
- Spring's own languages for `*.factories` and `META-INF/jpa-named-queries.properties`,
  including JPQL validation inside named queries;
- Spring workspace symbols, request-mapping navigation, and bean navigation;
- Spring-aware Java completion — property keys in `@Value`, bean names in
  `@Qualifier`, scopes, profiles, Spring Data query methods derived from the
  entity, and bean-injection proposals inside `@Component` methods;
- `@RequestMapping`/`@GetMapping`/`@PostMapping`/`@PutMapping` method templates
  inside controllers, with their imports added on insertion;
- cron inlay hints, cron expression completion, and cron syntax validation;
- Spring Data query intelligence — syntax validation of the JPQL, HQL or SQL
  inside `@Query`, a native query, or a bare `EntityManager.createQuery(…)`;
  Go to Definition from a `?1` or `:name` query parameter to the method
  parameter it stands for; the parameter-name inlay hint on `?1`; and
  continuation proposals while a derived query method name is being written;
- SpEL validation wherever Spring reads an expression — `@Value`, `@Cacheable`,
  `@EventListener`, `@ConditionalOnExpression` and the rest — including nested
  `${…}` placeholders, plus Go to Definition from a SpEL bean reference to its
  `@Bean` declaration and from a bean's method call to that method;
- Spring quick-fix code actions applied end to end;
- Java references and implementations through the official Java language
  server;
- Spring-specific references composed with official Java results; and
- Spring-to-Java type and classpath integration through the required official
  Java companion.

Zed-native language-server startup replaces the VS Code-specific
`vscode-spring-boot.ls.start` command. Much of the broader VS Code Spring Tools
surface is still planned or unverified. For live application data, a Code Action
lists processes, prompts a bounded connect/refresh/disconnect choice, and reports
connect success only when the server announces the process is connected, never
on the command's always-null result. This is the Zed-native equivalent of VS
Code's show/hide/refresh commands, which only wrap the same Spring operations for
its active debug app. The 2026-07-23 macOS arm64 gate connected a Boot 3.5.5
process, exposed refresh/disconnect choices, refreshed live CodeLens, and then
disconnected with JMX cleanup. The fixture had JMX and Actuator live-data
endpoints exposed. A separate Code Action generates a bounded, timestamped
`.zed/spring-live.md` snapshot for heap, non-heap, and GC-pause measurements.
The 2026-07-23 driven gate verified authentic values, rendered preview, explicit
refresh, and deletion/recreation against that connected process. The document
now also includes a bounded read-only logger snapshot, and another source action
pages logger choices, requires a final level-change confirmation, and reports
success only after Spring sends the matching update notification. A driven
Boot/JMX gate rendered 861 authentic loggers with an explicit 512-entry bound,
changed `ROOT` from `INFO` to `DEBUG`, verified the refreshed
effective/configured state, and restored it to `INFO`. Automatic local
connection is a verified default-off opt-in: generated Java debug entries add
reviewable local-management and project-identity properties, and the coordinator
connects only when Spring reports exactly one local process matching an
executable Boot project in the worktree. A 2026-07-23 Zed debug lifecycle gate
automatically connected the matching Boot 3.5.5 process, delivered live data,
honored manual disconnect without reconnecting, and cleaned up the debuggee and
owned processes on stop and exit. Applications running elsewhere connect through
the `boot-java.remote-apps` setting — the same settings-only route VS Code uses,
since neither client has a remote-connect command — and appear in the same
process action. A 2026-07-24 gate connected a Boot 3.5.5 HTTP-Actuator target
from one settings change, read 860 authentic loggers, and disconnected when the
array was cleared; a real-Zed run then showed the same route end to end, with
Spring hover naming the connected remote process in the editor.

Highlighting embedded SpEL and query fragments *inside* Java strings is not
delivered, and that is now settled rather than pending. It needs LSP semantic
tokens, and Zed 1.11.3 requests none for a Java buffer — not after Spring
registers the provider dynamically, and not after a static declaration either,
including the official Java server's own. Java code itself highlights correctly
through Zed's own grammar meanwhile, so only token-level colouring within those
strings is affected. Everything else for those embedded languages rides ordinary
LSP and works today: SpEL validation and navigation are verified above, and so
are query validation and parameter navigation inside `@Query` and in
`META-INF/jpa-named-queries.properties`.

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
`.zed/debug.json` (`"adapter": "Java"`) launches. Generated entries use
`$ZED_WORKTREE_ROOT`-relative working directories, contain no credentials, and
never overwrite a config that cannot be parsed without loss (a commented or
non-array file receives a reviewable sidecar instead). It emits one base entry
plus one per discovered Spring profile (from `application-<profile>.*`
filenames and multi-document `application.yml` activation, capped at eight) so
Zed's task/debug picker becomes the profile selector, alongside editable
`vmArgs`/`args`/`env` slots. Driven checks on 2026-07-19 (macOS arm64, Zed
1.11.3, official Java 6.8.21, JDK 25) verified discovery, generation, profile
entries, the generated run task serving `GET /greeting`, and a Java debug
launch from the generated `dev` entry after editing all three debug slots. A
2026-07-22 multi-project run then displayed `service-a`, `service-b`, and `All
projects`; selecting all generated one task/debug pair per module with the
correct worktree-relative directory and launched nothing automatically.

Now verified on the named macOS tuple: a Java-file `source` Code Action executes
Spring's authentic `sts/spring-boot/structure` command and writes
`.zed/spring-structure.md`. The opt-in Markdown snapshot preserves Spring's
project/group hierarchy, links only to source files inside the current worktree,
marks itself as regenerable and safe to delete, and refreshes only files carrying
its ownership marker. A driven Zed run proved authentic generation, rendered
hierarchy, source-file opening, byte-stable refresh, and deletion/recreation
without creating `.gitignore`. Zed 1.11.3 opens the linked file but discards the
Markdown `#L…` fragment, so Project Symbols remains the exact-location fallback.

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
  is optional but required for `pom.xml` Maven inlay hints and for opt-in Spring
  XML-config intelligence (set `boot-java.support-spring-xml-config.on`) — Zed
  has no built-in XML language, the same way Java support requires the official
  Java extension;
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
   indexing to finish. The broadest end-to-end coverage uses this repository's
   Maven fixture; narrower multi-project and Gradle observations are identified
   separately in the compatibility and capability evidence.

Keep at least one `.java` file open. Zed starts the official Java language
server only for Java buffers, and no extension can start it for you, so a
session with only `application.properties` open has no project classpath —
property validation and completion fall back to syntax only until a Java file
is opened. The extension says so once rather than reporting a failure.

If Java was already running when this extension was installed, restart Zed so
JDT LS receives the contributed bridge bundles. If the first Spring artifact
download remains stuck, restart Zed and retry. Both conditions are documented in
[known limitations](LIMITATIONS.md).

### Settings

Spring's own settings go under `lsp."spring-tools".settings` in Zed's settings
and are merged over this extension's defaults, so any `boot-java.*` key the VS
Code extension documents can be set here — including turning a default back off.

```json
{
  "lsp": {
    "spring-tools": {
      "settings": {
        "boot-java": {
          "common": { "properties-metadata": "config/shared-metadata.json" },
          "live-information": {
            "automatic-connection": { "on": true }
          }
        }
      }
    }
  }
}
```

`boot-java.common.properties-metadata` names a shared
`spring-configuration-metadata.json` whose keys validate and complete alongside
the project's own. A relative path is resolved against the worktree root. After
editing that file, run the **Spring Boot: Reload shared properties metadata**
code action from any properties or YAML file to pick up the change without
restarting the server; with no such file configured the action says so instead
of claiming a reload.

`boot-java.live-information.automatic-connection.on` is optional and defaults
off. When enabled, rerun **Spring Boot: Configure run/debug for a project…** so
the generated Java debug entries include the reviewable local JMX/Actuator and
project-identity JVM properties. After a matching debug launch, automatic
connection occurs only when exactly one worktree project/process match exists;
otherwise use the explicit **Connect or disconnect live process data…** action.
This route passed its real-Zed start/connect/manual-disconnect/stop lifecycle
gate on the macOS arm64 tuple recorded above. Other desktop/JDK combinations
remain untested.

`boot-java.remote-apps` connects live data to an application running elsewhere.
This is the same settings-only route the VS Code extension uses; there is no
separate remote-connect action in either client. Each entry needs a `jmxurl`,
and Spring starts tracking a target as soon as you declare it:

```json
{
  "lsp": {
    "spring-tools": {
      "settings": {
        "boot-java": {
          "remote-apps": [
            {
              "jmxurl": "http://staging.internal:8080/actuator",
              "host": "staging.internal",
              "urlScheme": "https",
              "port": 8443
            }
          ]
        }
      }
    }
  }
}
```

A `jmxurl` starting with `http` connects over Actuator HTTP; anything else is
treated as a JMX service URL. Declared targets appear in the **Connect or
disconnect live process data…** action and can feed the Live data document like
any local process. Spring identifies a remote target by its URL, so if yours
embeds credentials (`scheme://user:password@host`) this extension strips the
`user:password` part from every label it shows you or writes into
`.zed/spring-live.md`, keeping the host and port visible. Prefer a URL without
embedded credentials: Zed settings are ordinary files, and a project-level
`.zed/settings.json` is easy to commit by accident. The driven gate used a
localhost target over `http`, so a physically remote host and a
`service:jmx:rmi://` URL remain untested.

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
unrelated Java-route failures. A 2026-07-22 real-Zed run paused the isolated
jdtls process, observed the official-Java route's five-second bridge timeout and
bounded re-enablement without a misleading compatibility notice, then observed
bridge registration after that same jdtls process resumed.

## Important limitations

- This is not a stable release. The adapter and coordinator are written for
  Linux, macOS, and Windows, but only macOS arm64 has runtime evidence. Other
  desktop platforms remain untested, and the platform-aware implementation is
  not itself a support claim.
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
