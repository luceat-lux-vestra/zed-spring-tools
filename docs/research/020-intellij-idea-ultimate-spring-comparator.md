# R020: IntelliJ IDEA Ultimate Spring comparator audit

- Status: Complete for declaration-level inventory; no driven observation
- Last updated: 2026-07-30
- Investigator: Claude Opus 5

## Question

IntelliJ IDEA Ultimate is the larger Spring comparator that the implementation
plan names but this repository has never measured. Which developer-facing Spring
capabilities does it actually declare, which of them does this project already
deliver through a different surface, which cannot be delivered in stock Zed, and
what is the exact reason in each blocked case?

This is a reference audit. It exists so that "why does this project stop at VS
Code Spring Tools parity?" has an evidence-backed answer instead of a citation
of AGENTS.md, and so that any future proposal to extend the product goal starts
from measured surface counts rather than reputation.

## Scope

**Included.** The eleven Spring-related plugins shipped inside IntelliJ IDEA
Ultimate 2026.2, read as declaration metadata: `Spring`, `spring-boot-plugin`,
`spring-data`, `spring-mvc-impl`, `spring-security`, `spring-modulith`,
`spring-messaging`, `spring-integration-core`, `spring-boot-cloud`,
`spring-boot-initializr`, `microservices-jvm`. The `microservices-plugin`
descriptor is read only for its tool-window declaration.

**Excluded.** IntelliJ's non-Spring surface (database tools, profiler, HTTP
client, VCS), its Kotlin/Groovy-specific Spring support beyond counting, and any
behavioural claim about how a declared feature renders. Decompiling or reading
IntelliJ implementation bytecode is out of scope; this audit reads only the XML
descriptors that the product ships to declare its own extension points.

**Method.** The same method R011 and R018 used against the VS Code package:
enumerate what the product *declares*, not what a reviewer remembers it doing.
Every jar under each plugin directory was opened, every `.xml` descriptor
containing `<idea-plugin>` or `<extensions>` was parsed, descriptors were
de-duplicated by content hash, and extension-point elements were counted.
Identical descriptors appear in both `lib/` and `lib/modules/` in this build, so
de-duplication is required before any count is meaningful.

## Confirmed facts

### 1. What IntelliJ declares

121 unique descriptors across 73 jars declare the following user-facing
extension points:

| Extension point | Count | What it delivers to the user |
| --- | ---: | --- |
| `localInspection` | 105 unique | Diagnostics |
| `psi.referenceContributor` | 61 | Reference resolution behind navigation |
| `codeInsight.lineMarkerProvider` | 53 | Gutter icons and gutter navigation |
| `action` | 30 unique ids | Menu and command-palette entries |
| `completion.contributor` | 41 | Completion |
| `intentionAction` | 24 | Quick fixes |
| `annotator` | 14 | Inline highlighting |
| `gotoRelatedProvider` | 8 | "Related item" navigation |
| `diagram.Provider` | 6 | UML/graph views |
| `runConfigurationProducer` | 2 | Run configuration generation |
| tool windows | 2 | `Endpoints`, `Beans` |

Inspections per plugin: `Spring` 64, `spring-data` 10, `spring-boot-plugin` 8,
`spring-mvc-impl` 6, `spring-security` 5, `spring-integration-core` 4,
`spring-modulith` 3, `spring-boot-cloud` 3, `microservices-jvm` 2.

### 2. The `Endpoints` tool window is not Spring-owned

`<toolWindow id="Endpoints" anchor="right" …>` is declared by
`microservices-plugin`, not by any Spring plugin, and `microservices-jvm`'s
`plugin.xml` contains `<toolWindowAllowlist id="Beans" />` rather than a
`Beans` tool-window declaration. Both panels are platform-level surfaces that
the Spring plugins populate. This matters for comparison: IntelliJ's two
headline Spring panels are IDE-platform features, and an equivalent in Zed would
have to be an IDE-platform feature there too, which is precisely what the
extension API does not expose.

### 3. Counting diagnostics across the two products is not like-for-like

Spring Tools 5.2.0 declares 71 problem types across 11 categories in
`problem-types.json`. IntelliJ declares 105 unique inspections. **These numbers
must not be read as a 105:71 capability ratio**, because the units differ: one
IntelliJ inspection is a single toggle that may perform many distinct checks
internally (`SpringBootApplicationYamlInspection` covers unknown keys, type
mismatches and deprecations at once), whereas a Spring Tools problem type is one
named check with its own code and severity (`YAML_UNKNOWN_PROPERTY`,
`YAML_VALUE_TYPE_MISMATCH`, `YAML_DEPRECATED_WARNING` are three). The honest
statement is that both products declare Spring diagnostics in the same order of
magnitude, and that the interesting difference is *which areas* they cover, not
the totals.

### 4. The two diagnostic sets barely overlap in kind

This is the substantive finding of the audit.

**IntelliJ is deep where this project has nothing**, and the depth is
concentrated in static Spring *model* analysis:

| Area | IntelliJ inspections (examples) | This project |
| --- | --- | --- |
| Bean model consistency | `DuplicatedBeanNamesInspection`, `SpringDependsOnUnresolvedBeanInspection`, `RequiredBeanTypeInspection`, `SpringJavaInjectionPointsAutowiringInspection`, `SpringBeanInstantiationInspection`, `InjectionValueTypeInspection` | none |
| AOP | `SpringAopErrorsInspection`, `SpringAopPointcutExpressionInspection`, `SpringAopWarningsInspection`, `MissingAspectjAutoproxyInspection` | none |
| Caching semantics | `SpringCacheableAndCachePutInspection`, `SpringCacheableMethodCallsInspection`, `SpringCacheNamesInspection`, `SpringCacheAnnotationsOnInterfaceInspection` | none |
| Transactions | `SpringTransactionalComponentInspection`, `SpringTransactionalMethodCallsInspection` | none |
| Profiles | `SpringInactiveProfileHighlightingInspection`, `SpringProfileExpressionInspection` | none |
| Testing | `SpringTestingDirtiesContextInspection`, `SpringTestingTransactionalInspection`, `SpringTestingOverridenBeanResolveInspection`, `SpringTestingSqlInspection` | `JAVA_TEST_SPRING_EXTENSION` only |
| XML model | `SpringXmlModelInspection`, `SpringXmlAutowiringInspection`, `SpringHandlersSchemasHighlightingInspection`, `UnparsedCustomBeanInspection` | XML config navigation is `verified`; no XML model diagnostics |
| Integration / Cloud | 7 inspections across `spring-integration-core` and `spring-boot-cloud` | none |

**This project is deep where IntelliJ is thin or absent:**

| Area | This project | IntelliJ |
| --- | --- | --- |
| Config file validation | 24 problem types (11 properties + 13 YAML): unknown key, type mismatch, deprecation, duplicate key, bean-property navigation, bracket/indexing syntax | ~5 inspections covering the same ground at coarser granularity |
| Version and support ranges | 8 problem types (`SUPPORTED_OSS_VERSION`, `UNSUPPORTED_COMMERCIAL_VERSION`, `UPDATE_LATEST_PATCH_VERSION`, `SPRING_CLOUD_INCOMPATIBLE_BOOT_VERSION`, …) plus a one-click upgrade quick fix | no equivalent inspection declared |
| Boot modernization | 17 `boot2` + 3 `boot3` + 7 `boot4` best-practice checks with quick fixes | partially overlapping; no equivalent version-targeted category |
| AOT | 3 problem types plus the AOT CodeLens family | one line marker (`SpringBootAotRepositoryMethodLineMarkerProvider`) |
| Spring AI | 2 problem types, plus `@Tool` indexing into the structure view | no Spring AI inspection declared |

The reading that follows is that IntelliJ optimizes for *understanding an
existing application's Spring model*, and Spring Tools optimizes for *writing
and keeping current a Boot application's configuration*. They are not the same
product with different amounts of the same thing.

### 5. Every IntelliJ delivery shape maps to one of four outcomes

| Bucket | IntelliJ declarations | Verdict |
| --- | ---: | --- |
| **A. Shape already delivered** — inspections, references, line markers, completion, intentions, annotators, goto-related | 306 | Delivered today through LSP diagnostics, definition/references, CodeLens, completion, code actions and document links. Content gaps in this bucket belong to the language server, not to this extension. |
| **B. Blocked by a missing Zed API** — 30 actions, 6 diagrams, 2 tool windows | 38 | Named below. |
| **C. Reachable only by new work here** | 1–2 | An endpoint index as a generated document; a bean index extension of the existing structure document. |
| **D. Out of scope or already delivered by another route** | remainder | Live/actuator surfaces, Initializr, repository-method execution. |

### 6. Why bucket B is blocked, by name

| IntelliJ surface | Missing Zed capability | Source |
| --- | --- | --- |
| 30 `action` ids (`SpringChangeActiveProfiles`, `ShowBeansDiagramAction`, `Spring.Create.Component.Java`, `GenerateSpringEndpointAction`, `DumpSpringConfiguration`, …) | An extension cannot contribute an arbitrary top-level Command Palette or menu action | [R013](013-zed-native-capability-delivery-surfaces.md) §1; [R014](014-final-upstream-capability-surface-audit.md) |
| 6 `diagram.Provider` (`SpringDiagramProvider`, `SpringLocalModelDependenciesDiagramProvider`, `SpringIntegrationDiagramProvider`) | No panel, webview, or virtual editor export | [R013](013-zed-native-capability-delivery-surfaces.md) §1, §3; [D005](../decisions/005-lsp-first-capability-delivery.md) |
| `Endpoints` and `Beans` tool windows | Same as above; `workspace::Panel` exists only in Zed's native Rust source, so an equivalent needs a custom Zed build or a future extension API | [R013](013-zed-native-capability-delivery-surfaces.md) §3 |

D005 already evaluated the escape hatch and rejected it: shipping a custom Zed
build with a native Spring panel scored 5/5 on value but 1/5 on feasibility and
1/5 on maintainability, because it converts the product into a maintained
editor fork. Nothing in this audit changes that arithmetic.

### 7. Areas where IntelliJ's surface is already met by a different shape

| IntelliJ | This project's equivalent |
| --- | --- |
| `LiveBeansClassLineMarkerProvider`, `Spring.Boot.Environment.Endpoint.Show/Hide.Values` | Live process connect, live beans/metrics/loggers, actuator env — all `verified` (WS3) |
| `SpringMvcRequestMappingLineMarkerProvider`, request-mapping gutter navigation | Request-mapping hover, project symbol search, Open Boot app page URL |
| `SpringScheduledTasksLineMarker` | Cron inlay hints and `cron` problem types |
| `SpringDataRunJpqlLineMarkerProvider` (query execution) | Query syntax diagnostics (`JPQL_SYNTAX`, `HQL_SYNTAX`, `SQL_SYNTAX`) and embedded query highlighting; execution itself is out of scope |
| `spring-boot-initializr` | Recorded `not-pursued`; Spring Initializr is a decided documented exception |
| Beans tool window (partial) | The generated `.zed/spring-structure.md` document already renders components, mappings and `@Tool` methods with per-line links |

## Primary sources

| Source | Version / identifier | Path | Accessed |
| --- | --- | --- | --- |
| IntelliJ IDEA Ultimate | 2026.2, build `262.8665.258`, `productCode` `IU` | `~/Applications/IntelliJ IDEA.app/Contents/plugins/` | 2026-07-30 |
| Spring Tools problem types | 5.2.0.RELEASE | `problem-types.json` in the pinned language-server package | 2026-07-30 |
| VS Code Spring Boot package | 2.2.0 | `tmp/s006-spring-tools-source/vscode-extensions/vscode-spring-boot/package.json` | 2026-07-30 |
| Zed extension API | 1.13.0 dev, commit `2ed83a1ee6` | `crates/extension_api/src/extension_api.rs`, `crates/project/src/project_settings.rs` | 2026-07-30 |
| R013 | — | `docs/research/013-zed-native-capability-delivery-surfaces.md` | 2026-07-30 |
| R014 | — | `docs/research/014-final-upstream-capability-surface-audit.md` | 2026-07-30 |
| D005 | — | `docs/decisions/005-lsp-first-capability-delivery.md` | 2026-07-30 |

Reproduction: the descriptor scan is ordinary `zipfile` + regex over the plugin
jars listed above, de-duplicated by SHA-1 of the descriptor text. No IntelliJ
process was started and no bytecode was read.

## Inferences

1. **The comparison mostly measures the language server, not this extension.**
   Bucket A is 306 of the ~345 user-facing declarations, and every gap inside it
   is an analysis-depth gap owned by Spring Tools upstream. This project is a
   delivery layer; it cannot close an analysis gap by writing extension code, and
   an IntelliJ comparison therefore does not generate a backlog for this
   repository the way the VS Code comparison did.

2. **The remaining gap is shaped, not sized.** What IntelliJ has and Zed cannot
   receive is concentrated in exactly three declaration kinds — arbitrary
   actions, diagrams, tool windows — all of which were already ruled out by R013,
   R014 and D005 for reasons that are about Zed's extension API and not about
   Spring. The "IntelliJ-class" gap is therefore mostly a UI-surface gap.

3. **The two products are complementary rather than ranked.** Fact 4 shows
   Spring Tools leading on configuration files, version currency, Boot
   modernization and Spring AI, and IntelliJ leading on bean/AOP/cache/
   transaction/test model analysis. A user choosing between them is choosing
   between those two emphases.

4. **The only genuinely new work this audit surfaces is an endpoint index.** The
   `Endpoints` tool window's user outcome is a list of mappings with navigation,
   and the generated-document pattern already demonstrated by
   `.zed/spring-structure.md` is a route to that outcome. The data exists: the
   language server already indexes request mappings, evidenced by the embedded
   MCP server's `getRequestMappings` returning the fixture's `/hello` `GET`
   mapping under controller `/greetings`.

## Unverified hypotheses

- That a generated endpoint index would be *used* the way an Endpoints panel is
  used. A document is opened deliberately; a panel is ambient. The outcomes are
  adjacent, not identical, and no user evidence supports the substitution.
- That the 105 inspections are all reachable in an ordinary Boot project. Many
  are XML-, Kotlin-, Groovy-, or framework-specific and would never fire on the
  fixtures used here.
- That IntelliJ's counts are stable across releases. One build was measured.

## Runtime verification needed

- What the `Endpoints` and `Beans` tool windows actually render for
  `tests/fixtures/` projects. Declaration metadata names the surface but not its
  content, and content is what an equivalent generated document would have to
  reproduce. This is the one observation worth making if bucket C is pursued.
- Whether any of the bucket-A inspections produce a materially different
  developer outcome than the corresponding Spring Tools problem type, rather
  than a differently worded one.

## Blockers and constraints

- **Declaration-level evidence only.** This audit did not start IntelliJ. It
  establishes what the product declares, which is sufficient for sizing buckets
  and insufficient for any claim about rendering or behaviour. No row here should
  be promoted to a capability-inventory state on this evidence.
- **Licensing.** IntelliJ's implementation is not readable the way Spring Tools'
  jars are. Attribution questions that were answerable for Spring — as in the
  `getResolvedProjectClasspath` defect, settled by reading a `transient` field —
  are not answerable here.
- **Product goal.** AGENTS.md fixes the goal as VS Code Spring Tools parity.
  Nothing in this audit changes that goal; extending it would require a decision
  document, and this audit is deliberately not one.

## Candidate next experiments

1. **Endpoint index feasibility (narrow).** Open the two fixtures in IntelliJ,
   record what `Endpoints` lists, and compare against what the language server
   already exposes. Resolves whether bucket C is one item or zero.
2. **Nothing else.** Buckets A, B and D are closed by this audit: A is upstream's,
   B is blocked by named missing Zed APIs, D is already delivered or already
   decided.

## Interim conclusion

IntelliJ IDEA Ultimate declares roughly 345 user-facing Spring surfaces. 306 of
them arrive through delivery shapes this project already implements, and their
content is owned by the language server rather than by this extension. 38 require
an arbitrary action, a diagram, or a tool window, each of which R013, R014 and
D005 had already established that stock Zed cannot provide, and D005 had already
rejected the only escape hatch. One or two items — an endpoint index, and an
extension of the existing bean structure document — are reachable by new work
here.

The gap to IntelliJ is therefore real but almost entirely a UI-surface gap plus a
language-server analysis-depth gap, and neither is closable by this repository.
The diagnostic comparison does not support a simple ranking: the two products
lead in different areas, and this project leads outright on configuration-file
validation, version and support currency, Boot modernization and Spring AI.

This audit answers the implementation plan's open question about coverage beyond
VS Code Spring Tools with measurements rather than impressions. It does not
propose extending the product goal, and it does not move any capability-inventory
state.
