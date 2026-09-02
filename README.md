# Zed Spring Tools

Spring Boot language intelligence for Zed, built as a companion to the required
official Java extension.

> The capability surface is complete: 48 of 59 tracked capabilities are
> driven-verified, and each of the remaining eleven names an exact missing Zed
> API, a native Zed equivalent, or a decided-out exception. What is not finished
> is distribution and platform breadth. No release is published yet — the
> extension-registry submission is under review — and runtime evidence to date is
> macOS arm64 on Temurin JDK 25.0.3 and 21.0.11. The WASM adapter and OS-aware
> coordinator are written for Zed's Linux, macOS, and Windows desktop boundary,
> but writing for a platform is not a support claim for it.

## Project status

| Item | Current state |
| --- | --- |
| Development phase | Capability delivery is complete for the declared scope. Release/distribution readiness is now tracked by [release Epic #108](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/108): first publish the existing `0.1.0` Zed Registry submission, then exercise the real Registry-install lifecycle before any v1.0 promotion. |
| Capability inventory | 59 tracked: 48 `verified`, 0 `implemented`, 0 `planned`, 3 `blocked-zed-api`, 0 `blocked-upstream`, 6 `zed-native-equivalent`, 2 `not-pursued` (inventory version 55) |
| Distribution | Local development extension today; submitted to the Zed extension registry as [zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875), awaiting maintainer review |
| Runtime coverage | macOS arm64 with Temurin JDK 25.0.3, and the declared floor 21.0.11 through the M5 portability core; exact point releases and slices are recorded in compatibility evidence |
| Other desktop tuples and JDKs | Untested — five desktop tuples and JDK 22 through 24; the implementation is platform-aware, but that is not a support claim |
| Build systems | Maven and Gradle. The [Gradle axis](docs/gradle-axis-resolution.md) was driven on 2026-07-29 against two Gradle fixtures, including running the generated `./gradlew bootRun` entries; the build system turned out not to be a dividing line anywhere except the Boot upgrade, which upstream gates on Maven. The Windows wrapper forms (`mvnw.cmd`/`gradlew.bat`) still need a Windows host |
| Path to a stable release | Keep the submitted Registry version at `0.1.0` until the first Registry publication completes. Then run the bounded real Registry install/first-run/restart/offline/uninstall gate. If no release-blocking defect is found and release-facing claims remain evidence-correct, the next intentional release may be `1.0.0`. Arbitrary `0.x` version churn, an arbitrary soak duration, the untested desktop matrix, and JDK 22/23/24 are not independent v1.0 blockers. See the current [release gate](docs/preview-release-gate.md) and [release Epic #108](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/108). |

See the [capability inventory](docs/capability-inventory.md) for the evidence
behind each state and [compatibility](COMPATIBILITY.md) for the exact tested
components. The row above carries all seven inventory states, including the two
that are empty, so it can be checked line by line against the inventory summary:

- `verified` — observed working on a named runtime tuple.
- `implemented` — built, but not yet observed working on any named tuple. Empty
  by design: nothing ships here on the strength of "the code exists". The
  embedded MCP server passed through this state on 2026-07-29 and left it the
  same day, once a driven run showed its tools answering against a real project.
- `planned` — not built yet, and no claim is made. Currently empty. The last row
  in this state was the embedded MCP server, decided, built and verified on
  2026-07-29; Spring Initializr and the AI explanation commands were decided the
  same day and moved to the states below.
- `blocked-zed-api` — Zed lacks the required UI or protocol surface, and the
  missing surface is named exactly.
- `blocked-upstream` — held up by Spring Tools or the official Java extension.
  Currently empty: no capability is waiting on an upstream fix.
- `zed-native-equivalent` — a different Zed workflow delivers the same outcome.
- `not-pursued` — intentionally not built because the outcome is already at
  parity; a documented exception, not backlog.

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
  including JPQL validation inside named queries and the Boot 3 unsupported-key
  error in `spring.factories` — verified on Zed 1.11.3 and 1.12.0;
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
- Spring's Java analysis on your own sources — the Boot 2.x best-practice checks
  (an unnecessary `@Autowired`, a `@Bean` method that can drop `public`, field
  injection worth turning into a constructor parameter, a class defining beans
  without `@Configuration`, a redundant `@Repository`, a mismatched repository id
  type, and more), the removed-in-Boot-3 type warnings, the Boot 4 API-versioning,
  bean-registrar and non-type-safe property-reference checks, the AOT-processor
  registration warning, and the Spring AI `@Tool` description checks. Every
  one of them can be tuned or switched off individually from Zed settings —
  a whole category through `boot-java.validation.java.*` or a single problem
  through `spring-boot.ls.problem.<category>.<CODE>` — so one noisy check never
  costs you the rest;
- Spring quick-fix code actions applied end to end, from both of Spring's fix
  engines: the JDT refactorings and the OpenRewrite recipes, so
  **Convert @Autowired field into Constructor Parameter** really rewrites the
  field and writes the constructor. The Spring Boot patch upgrade rides the same
  path — the version-validation quick fix at the top of a Maven build file bumps
  the Boot version through a reviewable edit you can inspect before saving, and a
  failed upgrade says so instead of doing nothing quietly;
- Boot version and support-range diagnostics on the build file — an available
  patch or minor release, whether the project's Boot generation is still inside
  OSS or commercial support, with the dates Spring itself publishes, and whether
  a Spring Cloud release on the classpath actually supports that Boot generation;
  the release notes and commercial-support quick fixes hand you the page address as a
  clickable link, because stock Zed cannot open a page on a server's request;
- Spring Modulith support for a Maven project — the application-module violation
  diagnostic fires on its own, flagging every reference that reaches into another
  module's internals while leaving references to its exposed types alone, the
  Structure document groups the project by application module and marks each type
  `(API)` or `(internal)`, and a **Refresh Modulith metadata…** action regenerates
  the metadata for a project you pick after a rebuild;
- Spring Tools' own embedded MCP server, off by default and opt-in through
  `boot-java.ai.mcp-server-enabled` (see [Settings](#settings)), which lets an AI
  agent query the resolved project directly — beans with their source ranges and
  injection points, request mappings, stereotypes, diagnostics, and live Spring
  release information. Two of its eighteen tools have known upstream defects;
- Java references and implementations through the official Java language
  server;
- Spring-specific references composed with official Java results;
- Spring-to-Java type and classpath integration through the required official
  Java companion; and
- working on a plane. Once the pinned Spring Tools release has been downloaded
  once, nothing above needs the network again — a run with every outbound
  connection blocked still gave completion, diagnostics, quick fixes and the
  classpath bridge. Only the Boot version and support-range diagnostics go quiet,
  because Spring asks Maven Central and `api.spring.io` for those; you lose the
  update advice rather than being shown stale advice. Before that first download
  the extension says so plainly and does nothing else: it names the release it
  needs and the address it could not reach, and it never starts a half-working
  mode.

Zed-native language-server startup replaces the VS Code-specific
`vscode-spring-boot.ls.start` command. The parity walk through the pinned VS Code
Spring Tools surface is finished: the last capability awaiting a direction
decision — the experimental embedded MCP server, whose blocker turned out to be
a fact nobody had checked — was decided, built and driven-verified on
2026-07-29, so what remains is three capabilities that each name an exact missing
Zed client surface. Spring Initializr is now a documented
exception: it is not in the pinned package at all, so it was never inside the
parity target. Everything else is either observed working on
the tested tuple or delivered through a different Zed workflow, and the
[capability inventory](docs/capability-inventory.md) says which, row by row. That
is parity evidence on one platform; every other desktop tuple is still
`untested`. For live application data, a Code Action
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
Spring hover naming the connected remote process in the editor. On the pinned
`5.3.0.RELEASE` the declaration no longer connects on its own — the target is
listed and one click connects it — which is upstream's change, described in the
remote-apps section below.

Once a process is connected, the running application's page URL is reachable from
the editor: Spring renders the request mapping's live Hover with a plain
clickable Markdown link for this client, and Zed opens it in the browser. A
2026-07-25 macOS arm64 gate hovered `@GetMapping` and opened
`http://127.0.0.1:8080/greeting`, reaching the running app. The URL CodeLens
shows the same address; because stock Zed cannot run its VS Code open-URL command
and a language server cannot open a browser itself, that notice points to the
Hover link rather than dead-ending.

Embedded SpEL and query fragments *inside* Java strings are highlighted as the
languages they are — the JPQL in a `@Query` gets its keywords, entity, property
and `?1` parameter coloured, with the surrounding Java untouched. This needs one
setting on your side, because it rides LSP semantic tokens and Zed's
`semantic_tokens` defaults to `"off"`:

```json
{ "semantic_tokens": "combined" }
```

The extension supplies the Spring half itself. This was published as blocked on
a missing Zed API for eight days and it was not: the spike that concluded it read
Zed's silence without reading the setting that causes it, which is written up in
full in [S017](docs/spikes/017-static-semantic-token-declaration.md) rather than
quietly deleted. Two things are worth knowing before you turn it on. Spring
answers with tokens for the whole Java file rather than only the embedded region,
so if you prefer Zed's own colouring for Java, set
`"boot-java": { "embedded-syntax-highlighting": false }` under
`lsp."spring-tools".settings` and keep the official Java server's tokens. And on
a cold start the first Java file you open can miss the highlighting, because a
transient upstream error answers the first request empty and Zed caches that per
buffer — any edit brings it back. Everything else for those embedded languages
rides ordinary LSP and works regardless: SpEL validation and navigation are
verified above, and so are query validation and parameter navigation inside
`@Query` and in `META-INF/jpa-named-queries.properties`.

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

A companion `source` Code Action, **Show this file's Boot project info**, answers
the per-file question instead of the workspace-wide one: which Boot project owns
the file in front of you, its main class, build tool, Spring Boot version, and
the JRE on its classpath. The 2026-07-26 driven run resolved each file to its own
module across a worktree pinning Boot 4.0.6, 3.5.5, 3.3.5, and 2.7.18 side by
side. Fields Spring cannot resolve are left out rather than shown as "unknown",
and a file outside every imported project gets an explanation of what the command
requires plus Spring's own message, not a generic failure.

Now verified on the named macOS tuple: a Java-file `source` Code Action executes
Spring's authentic `sts/spring-boot/structure` command and writes
`.zed/spring-structure.md`. The opt-in Markdown snapshot preserves Spring's
project/group hierarchy, links only to source files inside the current worktree,
marks itself as regenerable and safe to delete, and refreshes only files carrying
its ownership marker. A driven Zed run proved authentic generation, rendered
hierarchy, source-file opening, byte-stable refresh, and deletion/recreation
without creating `.gitignore`. Zed 1.11.3 opens the linked file but discards the
Markdown `#L…` fragment, so Project Symbols remains the exact-location fallback.

For a Spring Modulith project that same document is Spring's Modulith view: the
grouping becomes the project's application modules, and each type is marked
`(API)` or `(internal)` according to the module's named interfaces. A project
without a spring-modulith dependency in the same worktree keeps the ordinary
package grouping. Spring generates the underlying metadata by running Spring
Modulith's own exporter against the compiled classes, so build the project first;
it refreshes automatically as class files change, and the **Spring Boot: Refresh
Modulith metadata…** Code Action regenerates it for a project you choose when you
want to force the point. The grouping comes from that metadata but the listed
types come from the Spring index, so a project whose files you have not opened yet
can appear with empty modules until you open one of its files and regenerate.

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
- JDK 21 or newer available to Zed; Temurin 25.0.3 and the declared floor
  21.0.11 are the runtime-verified versions, and 22 through 24 are untested;
- Rust installed through `rustup`, which Zed requires when building a local
  development extension; and
- network access for the first pinned Spring Tools artifact download, and for
  that download only — later sessions run offline (see
  [known limitations](LIMITATIONS.md)).

### Install

1. Clone this repository.
2. Install the official Java extension before opening the Java project.
3. In Zed's Extensions page, choose **Install Dev Extension** — or run
   `zed: install dev extension` — and select this repository directory. See
   [Zed's development-extension instructions](https://zed.dev/docs/extensions/developing-extensions).
4. Open a Spring Boot project and wait for Java project import and Spring
   indexing to finish. The broadest end-to-end coverage uses this repository's
   Maven fixture, with a matching pair of Gradle fixtures covering the build
   system axis; narrower multi-project observations are identified separately in
   the compatibility and capability evidence.

Keep at least one `.java` file open. Zed starts the official Java language
server only for Java buffers, and no extension can start it for you, so a
session with only `application.properties` open has no project classpath —
property validation and completion fall back to syntax only until a Java file
is opened. The extension says so once rather than reporting a failure.

If Java was already running when this extension was installed, restart Zed so
JDT LS receives the contributed bridge bundles. If the first Spring artifact
download fails or remains stuck, the status bar reports it and names the release
and address it needed; restart Zed to retry, since a failed language server is
not restarted within the same session. Nothing partial is kept, so a retry starts
clean. Both conditions are documented in [known limitations](LIMITATIONS.md).

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

`boot-java.embedded-syntax-highlighting` is sent as `true`, matching the VS Code
extension's own default, and is what colours the JPQL, HQL, SQL and SpEL inside
your Java strings. It does nothing unless Zed's `semantic_tokens` is also on —
see [what works today](#what-works-today) above for that half and for the two
caveats. Set it to `false` to keep Zed's own colouring for Java: Spring
answers with tokens for the whole file, not only the embedded region.

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
separate remote-connect action in either client. Each entry needs a `jmxurl`.

**On the pinned `5.3.0.RELEASE`, declaring a target lists it but does not connect
it** — pick it from *Spring Boot: Connect or disconnect live process data…* to
connect. On `5.2.0.RELEASE` declaring it was enough. Upstream now forces every
entry read from this setting to `manualConnect = true`, overriding the value you
write, so there is no setting that restores the old behaviour. Everything after
the connect is unchanged: the same live data, and clearing the array still
disconnects.

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

`boot-java.ai.mcp-server-enabled` starts Spring Tools' own embedded MCP server,
which lets an AI agent query the Spring index directly — the project list, bean
details and usage, beans by type, request mappings, stereotypes and components,
resolved classpath, Boot and Java versions, Spring Tools diagnostics, plus live
`api.spring.io` release and support-generation lookups. It is **off by default**,
exactly as in the VS Code extension, and while it is off this extension launches
Spring precisely as it always has.

```json
{
  "lsp": {
    "spring-tools": {
      "settings": {
        "boot-java": {
          "ai": { "mcp-server-enabled": true, "mcp-server-port": 50627 }
        }
      }
    }
  }
}
```

`mcp-server-port` defaults to `50627` and is ignored unless the server is
enabled. Read what turning this on means before you do:

- The endpoint is **unauthenticated**. It binds to loopback only, so it is not
  reachable from the network, but any process on your machine can call it and
  read your beans, endpoints, and classpath through it.
- Five of the tools call `api.spring.io` at request time. With the server off,
  this extension makes no runtime network call at all; enabling it changes that
  for those tools.
- Point your MCP client at `http://localhost:<port>/mcp`, which speaks
  streamable HTTP. Zed supports remote MCP servers, but connecting it is your
  configuration step — this extension starts the server and does not register it
  as an MCP server on your behalf.
- Setting the port to `0` reproduces upstream's behaviour of letting Spring pick
  a free port. The chosen port is then only reported in the server's own log, so
  prefer a fixed port unless you have a reason not to.

All 18 tools were driven against a real resolved project on the tested tuple on
2026-07-29, and 17 returned real data — beans with their source ranges and
injection points, request mappings, project diagnostics, and live
`api.spring.io` release information. The eighteenth is the defect described
below. Enabling the server did not delay shutdown: Spring exits in 3.7 seconds
either way.

One upstream defect was found here and **is fixed in the pinned release**.
`getResolvedProjectClasspath` failed with a null version on a classpath entry on
`5.2.0.RELEASE` — one jar named like `snakeyaml-2.4.jar` was enough, so it
affected most projects — and was reported as
[spring-tools#1949](https://github.com/spring-projects/spring-tools/issues/1949).
Upstream's milestone label says `5.4.0.RELEASE`, but the 2026-08-01 refresh gate
drove the same fixture on `5.3.0.RELEASE` and the call answers with no error; the
entry's version simply comes back `null`. Treat the setting as experimental
— upstream labels it that way too — and note that only Maven, one project per
worktree, and this one tuple have been exercised.

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

The coordinator retries a classpath-listener handshake that times out while the
official Java server is still importing the project, and applies the same rule
to Spring's Java data requests: a failure is startup noise until it outlives the
handshake window, and it can never claim an incompatibility once the route has
answered. Regression tests cover transient recovery, grace-window exhaustion,
and reporting on both routes. Two real-Zed runs paused the isolated jdtls
process to force official Java's five-second timeout — 2026-07-22 for the
classpath handshake, 2026-07-29 for the data route, the latter A/B'd against a
build without the rule, which raised the notice fifteen seconds into an ordinary
project import. Both observed bounded recovery in the same session once that
jdtls process resumed.

## Important limitations

- No release is published yet, and runtime evidence is single-platform. The
  adapter and coordinator are written for Linux, macOS, and Windows, but only
  macOS arm64 has runtime evidence, on two JDKs. Other desktop platforms remain
  untested, and the platform-aware implementation is not itself a support claim.
- On a project's very first import, the compatibility notification can fire on a
  transient official-Java route timeout even though nothing is incompatible. See
  [known limitations](LIMITATIONS.md).
- The official Java extension is required. Compatibility is capability-based,
  so an upstream release can still break the private route and produce a visible
  failure until this project adapts.
- Automatic GitHub issue creation through Zed sign-in is unavailable. On a
  recognized compatibility failure, the notification opens a
  bounded title/body-prefilled public issue in the user's browser for review
  and manual submission. A driven Zed-to-browser check passed; the test did not
  submit an issue. Security reports must use private vulnerability reporting.
- Installation after JDT LS has already started requires a Zed restart.
- The opt-in Java LSP Outline is not a supported Spring route: after restart it
  can omit ordinary Java symbols until a document edit forces recollection.
- First-use artifact acquisition can hang until Zed is restarted.
- Continuous integration runs format, lint, tests, and the WASM release build;
  there is no packaged release and no way to install without that one artifact
  download. Rollback is written down in both directions and exercised in one:
  leaving a preview is covered by the [release gate](docs/preview-release-gate.md),
  while moving between two pinned Spring Tools releases is covered by the
  [refresh gate](docs/pinned-release-refresh-gate.md), which ran for real on
  2026-08-01. That run put the whole release identity in a single revertible
  commit, which is what makes a rollback one command — but reverting it has still
  not been tried. Once installed, running offline is verified — see
  [known limitations](LIMITATIONS.md).
- SSH remote development and WSL-hosted projects are outside the current scope.

Read [known limitations](LIMITATIONS.md) before relying on the extension.

## Evidence and roadmap

- [Capability inventory](docs/capability-inventory.md) — user-visible parity
  states and runtime evidence
- [CodeLens showcase](docs/code-lens-showcase.md) — one inspection fixture plus
  the provider/subfeature implementation and verification matrix
- [M4 capability delivery plan](docs/capability-delivery-plan.md) — preferred
  routes, preserved fallbacks, and verification gates
- [Implementation plan](docs/implementation-plan.md) — historical milestone
  delivery plan; current capability state is owned by the inventory and current
  release work by Epic #108
- [Release gate](docs/preview-release-gate.md) — current Registry-first release
  policy, release-currency checks, v1.0 meaning, and rollback rules
- [Pinned release refresh gate](docs/pinned-release-refresh-gate.md) — the
  procedure for moving to a newer Spring Tools release
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
node scripts/check-third-party-notices.mjs
cargo build --locked --release --target wasm32-wasip2
```

Continuous integration runs these same checks on every push and pull request.
Three more workflows run there and nowhere else: CodeQL analysis of the
workflows, coordinator, bridge, and Rust adapter; a dependency review of every
pull request; and path-based `area:*` labelling. Dependabot proposes weekly Cargo
and Actions updates, which land as ordinary pull requests through the checks
above.

The Spring Boot fixture can be compiled independently with:

```sh
mvn -f tests/fixtures/spring-boot-basic/pom.xml clean test
```

The Gradle fixtures behind the [Gradle axis](docs/gradle-axis-resolution.md)
need their wrapper regenerated first, because this repository does not commit
third-party binaries:

```sh
cd tests/fixtures/spring-boot-gradle && gradle wrapper --gradle-version 9.5.1 && ./gradlew classes
```

## License

This project's source is licensed under the [Apache License 2.0](LICENSE).
Third-party components keep their own licenses and are not redistributed here;
see [third-party notices](THIRD_PARTY_NOTICES.md).
