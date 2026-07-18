# CodeLens showcase and manual verification

CodeLens is the small, clickable text shown above a declaration. In this
project it can come from three independent sources: the official Java/JDT
server, five standard Spring Tools providers, and Spring's running-application
`sts/highlight` stream. The single source file
[`CodeLensShowcase.java`](../tests/fixtures/spring-codelens-showcase/src/main/java/dev/zed/spring/codelens/CodeLensShowcase.java)
contains a numbered target for every family.

The extension supplies the Spring settings that VS Code normally contributes,
enables the AI-assisted provider after LSP initialization regardless of Zed AI
state, refreshes Zed after activation, preserves Spring server commands, and
converts or explains VS Code-only commands. All five standard provider families
are now observed and contract-tested. The 2026-07-19 driven gate also verified
`CL-4d` one-click navigation and the corrected AI-boundary notices.

## One-time setup

Use a disposable copy because `Turn into @Query` intentionally edits Java
source and the AOT commands generate a `target/` tree:

```sh
CODELENS_FIXTURE="$(mktemp -d /tmp/zed-spring-codelens.XXXXXX)"
cp -R tests/fixtures/spring-codelens-showcase/. "$CODELENS_FIXTURE/"
mvn -f "$CODELENS_FIXTURE/pom.xml" clean test
printf '%s\n' "$CODELENS_FIXTURE"
```

Merge these values into Zed settings. The two JDT settings make `CL-1`
deterministic; the Spring settings are supplied by this extension and do not
need to be copied into user settings.

```json
{
  "code_lens": "on",
  "lsp": {
    "jdtls": {
      "settings": {
        "java": {
          "implementationCodeLens": "all",
          "referencesCodeLens": {
            "enabled": true
          }
        }
      }
    }
  }
}
```

Install this repository with **zed: install dev extension**, then fully restart
Zed. A restart is required when JDT LS was already running, because the Spring
bridge bundles are contributed when the official Java server starts. Open the
printed disposable directory, then open
`src/main/java/dev/zed/spring/codelens/CodeLensShowcase.java`. Wait until Maven
import and Spring indexing have settled. Searching for `CL-` in the file is the
fastest way to move through the targets.

The fixture includes `/target/` in `.gitignore`, so generated AOT sources do
not flood Zed's `cmd-p` file finder. Zed has no “sort this directory last”
setting or extension API. For a Maven project that does not already ignore build
output, the project/user must choose `.gitignore` or local
`.git/info/exclude`. Zed's `file_scan_exclusions` is not an equivalent default:
it removes the directory from scans, searches, and the project tree, overrides
inclusions, and can interfere with generated-source navigation. This extension
does not edit user ignore or Zed settings. See
[R019](research/019-zed-codelens-agent-navigation-and-build-output.md).

## Verification pass A — no AOT metadata

Run this first, before `process-aot`:

```sh
mvn -f "$CODELENS_FIXTURE/pom.xml" clean test
```

Reopen the Java file or run **language server: restart** and wait for indexing.
Check the following items.

| Check | Expected lens | Expected click result |
| --- | --- | --- |
| `CL-1` | JDT reference and/or implementation count above a type or method | Zed's native references/implementations UI opens |
| `CL-2` | HTTP method/path summary above `functionalHandler`, which is referenced by the functional route | An informational notice explains that the lens title itself is the value |
| `CL-3` | `Web Config - Path Prefix: /api` above the `CodeLensShowcase` class declaration | Zed navigates to `CodeLensShowcaseWebConfiguration.configurePathMatch` |
| `CL-4a` | `Show AOT-generated Implementation, Query, etc...` above the derived repository method | Spring starts the Maven AOT metadata build |
| `CL-5a` | `Explain SpEL Expression with AI` above the SpEL `@Value` | A notice explains that Spring has no non-AI command, the extension cannot detect or invoke Zed Agent, and this extension sends nothing to AI |
| `CL-5b` | `Explain Query with AI` above `@Query` | The same explicit optional-AI/manual fallback appears |
| `CL-5c` | `Explain AOP annotation with AI` above `@Pointcut` and `@Before` | The same explicit optional-AI/manual fallback appears |
| `CL-6` | `Convert to Router Builder Pattern with AI` above `staticImportRouter` | A distinct notice explains that upstream supplies only an AI prompt, not a deterministic refactoring command; source must not change |

The AI-assisted lens titles are generated locally and remain visible regardless
of Zed's `disable_ai` value or configured model. Their actions are only prompts
for VS Code Copilot: Spring Tools does not expose a non-AI server command that
explains the expression or performs the router edit. Zed's public CodeLens and
extension APIs expose neither authoritative AI-state detection nor Agent
dispatch/prefill, so this project can improve only the explanatory wording.
Clicking never contacts an AI service because the coordinator intercepts the
command. A user may make a separate explicit Zed Agent request when available.

## Verification pass B — generated Data metadata

If `CL-4a` was clicked, wait for the build to finish. The deterministic terminal
equivalent is:

```sh
mvn -f "$CODELENS_FIXTURE/pom.xml" \
  compile org.springframework.boot:spring-boot-maven-plugin:process-aot
test -f "$CODELENS_FIXTURE/target/spring-aot/main/resources/dev/zed/spring/codelens/CodeLensShowcaseRepository.json"
```

Run **language server: restart**, reopen the Java file, and wait for indexing.
Above `findByMessageContainingIgnoreCase`, verify all of these:

| Check | Expected result |
| --- | --- |
| `CL-4b` | The generated query text is visible as an informational lens |
| `CL-4c` | `Turn into @Query` applies a workspace edit and adds an explicit `@Query` annotation to the disposable source |
| `CL-4d` | `Go To Implementation` first resolves Spring's authentic generated target; after the automatic refresh, one click opens the exact generated method through `editor.action.goToLocations`, including when `/target/` is ignored |
| `CL-4e` | `Refresh AOT Metadata` starts the Maven refresh command again |

After testing `Turn into @Query`, save and confirm that the edited disposable
fixture still compiles:

```sh
mvn -f "$CODELENS_FIXTURE/pom.xml" test
```

## Existing runtime evidence — live application lenses

`CL-7` is separate from the five static providers. It requires a running Boot
process connected through Spring Tools' live-data agent/JMX contract. Normal
connection UX is a separate capability and is not implemented by this CodeLens
slice, so this is not a maintainer manual step. The
2026-07-19 driven gate already verified this path on macOS arm64, Zed 1.11.3,
official Java 6.8.21, Spring Tools 5.2.0, and JDK 25:

- `← DefaultGreetingService` and `→ CodeLensShowcase` were rendered;
- the endpoint URL, request count, and timing were rendered;
- clicking a relationship lens selected the correct source range and explained
  the native Hover gesture;
- `cmd-k cmd-i` then rendered authentic Spring bean, type, resource, bean-id,
  and process details; and
- clicking a URL lens retained the visible URL and explained the manual-browser
  fallback; and
- Spring's `ValueHoverProvider` was confirmed upstream to provide runtime
  `${...}` property values and their sources through live Hover. Its commandless
  highlight range is adapted to a visible `Spring live data — use Hover` lens;
  the actual value remains in Hover so environment secrets are not exposed
  persistently above source code. The dedicated `CL-7c` run used
  `CODELENS_SAMPLE_LIMIT=37`; native Hover returned
  `CODELENS_SAMPLE_LIMIT : 37 (from: systemEnvironment)` and the connected
  process identity. This is distinct from the `CL-5a` AI lens.

The fixture defines `CODELENS_SAMPLE_LIMIT=5` in `application.properties`, so
it remains runnable without an external variable. The live gate overrides it
with `CODELENS_SAMPLE_LIMIT=37`. The source deliberately uses
`${CODELENS_SAMPLE_LIMIT}` rather than `${CODELENS_SAMPLE_LIMIT:5}` because the
inspected Spring Tools 5.2.0 `ValueHoverProvider` includes `:5` in its lookup
key and therefore does not match the live property. This is an upstream
provider constraint, not a coordinator transformation.

There is no need to repeat this pass for the static-provider acceptance check.
The evidence is under the ignored local directory
`tmp/codelens-runtime-20260719.udLvyE/evidence/`.

## Coverage and implementation state

| Marker | Upstream provider | Zed handling | Current state |
| --- | --- | --- | --- |
| `CL-1` | Official Java/JDT | Native CodeLens and navigation; this project does not intercept it | Runtime verified |
| `CL-2` | `WebfluxHandlerCodeLensProvider` | Visible informational lens plus explicit click explanation | Product implementation and contract test complete |
| `CL-3` | `WebConfigCodeLensProvider` | `vscode.open` translated to `editor.action.goToLocations` | Product implementation and contract test complete |
| `CL-4a`–`CL-4e` | `DataRepositoryAotMetadataCodeLensProvider` | Query text retained; Spring build/refactor commands preserved; `CL-4d` authentic target pre-resolved and rewritten to Zed navigation | All subfeatures observed; `CL-4d` one-click generated-method navigation runtime verified with ignored `/target/` |
| `CL-5a`–`CL-5c` | `CopilotCodeLensProvider` | Provider enabled regardless of Zed AI state; command intercepted with an explicit API-boundary/manual explanation | Lenses and corrected notices observed; direct Agent action remains blocked by Zed API |
| `CL-6` | `RouterFunctionCodeLensProvider` | Provider enabled automatically; absence of a deterministic upstream edit is explained without changing source | Product implementation and contract test complete; maintainer confirmed fallback display |
| `CL-7a`–`CL-7b` | versioned `sts/highlight` | Merged into standard CodeLens with refresh, stale rejection, native Hover and URL fallbacks | Runtime verified |
| `CL-7c` | `ValueHoverProvider` over live `sts/highlight` | A commandless upstream range becomes `Spring live data — use Hover`; runtime value/source stays in native Hover | Runtime verified with environment value `37` and `systemEnvironment` source |

`CL-5` is one provider with several expression families. `CL-4` is one provider
that can return several lenses for one repository method. This is why the
developer-visible subfeature count is larger than the five standard Spring
provider classes.

## Result report

Reply with this compact form; a screenshot is useful only for a failed or
ambiguous row.

```text
Environment: OS/arch, Zed, official Java extension, JDK
PASS: CL-1, CL-2, ...
FAIL: CL-x — visible lens title / click result
NOT SEEN: CL-x — waited about N seconds after restart
```

Also include the last relevant lines from **zed: open log** for a missing lens.
Do not include environment variables, credentials, or a full classpath.
