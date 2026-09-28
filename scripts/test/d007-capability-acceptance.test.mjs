import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const inventoryFile = path.join(root, "docs", "capability-inventory.md");
const matrixFile = path.join(root, "protocol", "d007-capability-acceptance.json");
const desktopHarnessFile = path.join(root, "scripts", "d007-zed-desktop-validation.mjs");
const standaloneRegressionFile = path.join(root, "scripts", "d007-standalone-capability-regression.mjs");
const basicPropertiesFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "src", "main", "resources", "application.properties");
const basicYamlFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "src", "main", "resources", "application.yaml");
const extensionManifestFile = path.join(root, "extension.toml");
const basicPomFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "pom.xml");
const greetingRepositoryFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "src", "main", "java", "dev", "zed", "spring", "fixture", "GreetingRepository.java");
const spelFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "src", "main", "java", "dev", "zed", "spring", "fixture", "SpelSample.java");
const namedQueriesFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "src", "main", "resources", "META-INF", "jpa-named-queries.properties");
const codeLensProbeFixture = path.join(root, "tests", "fixtures", "spring-boot-basic", "src", "main", "java", "dev", "zed", "spring", "fixture", "CodeLensProbeController.java");

const STATES = new Set([
  "verified",
  "implemented",
  "planned",
  "blocked-zed-api",
  "blocked-upstream",
  "zed-native-equivalent",
  "not-pursued",
]);

function inventoryRows() {
  const rows = [];
  for (const line of fs.readFileSync(inventoryFile, "utf8").split("\n")) {
    if (!line.startsWith("| ")) continue;
    const columns = line.split("|").slice(1, -1).map((value) => value.trim());
    if (columns.length < 2) continue;
    const state = columns[1].replaceAll("`", "");
    const capability = columns[0];
    if (!STATES.has(state) || STATES.has(capability.replaceAll("`", ""))) continue;
    rows.push({ capability, historicalState: state });
  }
  return rows;
}

test("D007 classifies every tracked capability exactly once", () => {
  const inventory = inventoryRows();
  const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));

  assert.equal(inventory.length, 59);
  assert.equal(matrix.schemaVersion, 1);
  assert.equal(matrix.decision, "D007");
  assert.equal(matrix.entries.length, inventory.length);

  const expected = new Map(inventory.map((entry) => [entry.capability, entry.historicalState]));
  const seen = new Set();
  for (const entry of matrix.entries) {
    assert.equal(typeof entry.capability, "string");
    assert.equal(seen.has(entry.capability), false, `duplicate D007 capability: ${entry.capability}`);
    seen.add(entry.capability);

    assert.equal(expected.has(entry.capability), true, `unknown D007 capability: ${entry.capability}`);
    assert.equal(entry.historicalState, expected.get(entry.capability));
    assert.match(entry.classification, /^(?:unaffected|existing-blocker|not-pursued|retained-requires-standalone-evidence|redesigned-requires-evidence)$/);
    assert.equal(typeof entry.evidenceGroup, "string");
    assert.notEqual(entry.evidenceGroup.length, 0);
    assert.equal(typeof entry.reason, "string");
    assert.notEqual(entry.reason.length, 0);

    if (
      entry.classification === "retained-requires-standalone-evidence" ||
      entry.classification === "redesigned-requires-evidence"
    ) {
      assert.equal(
        entry.currentClaim,
        "pending-d007",
        `${entry.capability} must not reuse historical evidence as a current standalone claim`,
      );
      assert.equal(
        Array.isArray(entry.requiredEvidence) && entry.requiredEvidence.length > 0,
        true,
        `${entry.capability} must name exact D007 evidence`,
      );
      assert.equal(
        entry.requiredEvidence.some((requirement) =>
          requirement?.source === "unmapped-d007-evidence"
        ),
        false,
        `${entry.capability} must not use an unmapped D007 evidence placeholder`,
      );
    }
    if (entry.classification === "existing-blocker") {
      assert.equal(entry.currentClaim, entry.historicalState);
    }
    if (entry.classification === "not-pursued") {
      assert.equal(entry.currentClaim, "not-pursued");
    }
  }

  assert.deepEqual([...seen].sort(), [...expected.keys()].sort());
});

test("D007 explicitly classifies the private-Java dependent redesigns", () => {
  const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));
  const byCapability = new Map(matrix.entries.map((entry) => [entry.capability, entry]));

  for (const capability of [
    "Executable Boot projects discovery",
    "Spring XML config support",
    "Embedded Spring Tools MCP server",
    "Start Spring Boot Language Server on demand",
    "Spring Java type/index resolution",
    "Spring project/index synchronization",
    "Spring runtime Java requirement diagnostic",
  ]) {
    assert.equal(
      byCapability.get(capability)?.classification,
      "redesigned-requires-evidence",
      capability,
    );
    assert.equal(byCapability.get(capability)?.currentClaim, "pending-d007");
  }

  assert.equal(
    byCapability.get("References and implementations")?.classification,
    "unaffected",
  );
  assert.equal(
    byCapability.get("References and implementations")?.currentClaim,
    "verified",
  );

  assert.equal(
    byCapability.get("Spring-specific document highlights")?.currentClaim,
    "blocked-zed-api",
  );
  assert.equal(
    byCapability.get("Inlay-hint label commands (pom \"Upgrade to the Latest Patch\")")?.currentClaim,
    "blocked-zed-api",
  );
  assert.equal(
    byCapability.get("Explain SpEL / queries / AOP (AI assistant)")?.currentClaim,
    "blocked-zed-api",
  );
});


test("D007 live and external-page acceptance consumes the produced standalone regression evidence", () => {
  const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));
  const byCapability = new Map(matrix.entries.map((entry) => [entry.capability, entry]));

  for (const capability of [
    "Connect / disconnect to a local Boot process",
    "Remote connect",
    "Live hover data",
    "Show / hide / refresh live data",
    "Metrics",
    "Loggers and log levels",
    "Automatic connection",
    "Live-data highlight CodeLens",
    "Open Boot app page URL",
  ]) {
    const requirements = byCapability.get(capability)?.requiredEvidence ?? [];
    assert.equal(requirements.length > 0, true, capability);
    assert.equal(
      requirements.every((requirement) =>
        requirement.source === "standalone-capability-regression"
      ),
      true,
      `${capability} must consume evidence emitted by the standalone regression runner`,
    );
  }
});


test("D007 evidence sources are all produced by the exact-head desktop harness", () => {
  const matrix = JSON.parse(fs.readFileSync(matrixFile, "utf8"));
  const harness = fs.readFileSync(desktopHarnessFile, "utf8");
  const sources = [...new Set(
    matrix.entries.flatMap((entry) =>
      (entry.requiredEvidence ?? []).map((requirement) => requirement.source)
    ),
  )].sort();

  assert.deepEqual(sources, [
    "desktop-dap-regression",
    "desktop-gate",
    "standalone-capability-regression",
    "standalone-offline-regression",
  ]);
  for (const source of sources) {
    assert.equal(
      harness.includes(`"${source}.json"`),
      true,
      `D007 matrix source ${source} must have a concrete evidence producer`,
    );
  }
});


test("D007 completion probes target the actual incomplete fixture lines", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");
  const properties = fs.readFileSync(basicPropertiesFixture, "utf8");
  const yaml = fs.readFileSync(basicYamlFixture, "utf8");

  assert.equal(
    properties.split("\n").filter((line) => line === "ser").length,
    1,
    "properties fixture must contain exactly one incomplete ser probe line",
  );
  assert.equal(
    yaml.split("\n").filter((line) => line === "ser").length,
    1,
    "YAML fixture must contain exactly one incomplete ser probe line",
  );
  assert.equal(
    regression.includes('positionAfter(props.text, "ser")'),
    false,
    "properties completion must not use first-substring lookup because the fixture comments also contain ser",
  );
  assert.equal(
    regression.includes('positionAfter(yaml.text, "ser")'),
    false,
    "YAML completion should use the same exact-line targeting contract",
  );
  assert.equal(
    regression.includes('positionAtExactLineEnd(props.text, "ser")'),
    true,
  );
  assert.equal(
    regression.includes('positionAtExactLineEnd(yaml.text, "ser")'),
    true,
  );
});


test("D007 fixture language ids match the production Spring server mapping", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");
  const extensionManifest = fs.readFileSync(extensionManifestFile, "utf8");

  assert.equal(
    extensionManifest.includes('YAML = "spring-boot-properties-yaml"'),
    true,
    "production YAML mapping must remain explicit",
  );
  assert.equal(
    regression.includes('["src/main/resources/application.yaml", "spring-boot-properties-yaml"]'),
    true,
    "standalone regression must send the same YAML language id as production",
  );
  assert.equal(
    regression.includes('["src/main/resources/application.yaml", "spring-boot-yaml"]'),
    false,
    "retired harness-only YAML id must not reappear",
  );
});


test("D007 fixture explicitly enables configuration metadata processing on JDK 23+", () => {
  const pom = fs.readFileSync(basicPomFixture, "utf8");
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    pom.includes("org.springframework.boot.configurationprocessor.ConfigurationMetadataAnnotationProcessor"),
    true,
    "fixture must explicitly list the Spring Boot configuration metadata processor",
  );
  assert.equal(
    regression.includes("fixture compile must generate spring-configuration-metadata.json before project-property capability checks"),
    true,
    "standalone regression must fail at compile time if project metadata was not generated",
  );
});


test("D007 ambiguous capability probes use exact fixture lines", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");
  const properties = fs.readFileSync(basicPropertiesFixture, "utf8");
  const repository = fs.readFileSync(greetingRepositoryFixture, "utf8");
  const spel = fs.readFileSync(spelFixture, "utf8");

  assert.equal((properties.match(/server\.port/g) ?? []).length > 1, true);
  assert.equal((properties.match(/fixture\.greeting\.salutation/g) ?? []).length > 1, true);
  assert.equal((repository.match(/findByMessageAnd/g) ?? []).length > 1, true);
  assert.equal((spel.match(/greetingPrefix/g) ?? []).length > 1, true);

  for (const forbidden of [
    'positionInside(props.text, "server.port", 3)',
    'positionInside(props.text, "fixture.greeting.salutation", 12)',
    'positionAfter(repositoryJava.text, "findByMessageAnd")',
    'positionInside(spel.text, "greetingPrefix", 3)',
  ]) {
    assert.equal(
      regression.includes(forbidden),
      false,
      `ambiguous first-substring probe must not reappear: ${forbidden}`,
    );
  }

  for (const required of [
    '"server.port=8080"',
    '"fixture.greeting.salutation=hi"',
    '"    List<Greeting> findByMessageAndId(String message, Long id);"',
    "'    @Value(\"#{@greetingPrefix}\")'",
  ]) {
    assert.equal(
      regression.includes(required),
      true,
      `exact fixture anchor must remain present: ${required}`,
    );
  }
});


test("D007 request-mapping acceptance selects the Spring snippet item, not a plain GetMapping completion", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    regression.includes('String(item?.label ?? "").startsWith("@GetMapping")'),
    true,
    "request-mapping acceptance must identify the Spring snippet label",
  );
  assert.equal(
    regression.includes("item?.insertTextFormat === 2"),
    true,
    "request-mapping acceptance must require LSP snippet format",
  );
  assert.equal(
    regression.includes('/GetMapping/.test(String(item?.label ?? item?.insertText ?? ""))'),
    false,
    "broad first-match selection must not reappear",
  );
});

test("D007 standalone completion client advertises snippets and keeps bounded completion failure evidence", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    (regression.match(/completionItem: \{ snippetSupport: true \}/g) ?? []).length,
    2,
    "both standalone client capability declarations must advertise LSP snippet support",
  );
  assert.equal(
    regression.includes(
      "lastItemSummary=${JSON.stringify(boundedCompletionItemSummary(lastItems))}",
    ),
    true,
    "completion timeout must retain a bounded summary of the actual returned items",
  );
  for (const field of [
    "label:",
    "kind:",
    "insertText:",
    "insertTextFormat:",
    "textEditNewText:",
    "detail:",
    "data:",
  ]) {
    assert.equal(
      regression.includes(field),
      true,
      `bounded completion diagnostics must retain ${field}`,
    );
  }
});

test("D007 diagnostic waits retain bounded latest and history evidence on failure", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    regression.includes("this.diagnosticHistory = new Map()"),
    true,
    "client must retain bounded publishDiagnostics history per URI",
  );
  assert.equal(
    regression.includes("latestDiagnostics=${JSON.stringify(boundedDiagnosticSummary(latest))}"),
    true,
    "diagnostic timeout must report the latest bounded diagnostic set",
  );
  assert.equal(
    regression.includes("diagnosticHistory=${JSON.stringify(history)}"),
    true,
    "diagnostic timeout must report bounded diagnostic history",
  );
  assert.equal(
    regression.includes("if (history.length > 8) history.shift()"),
    true,
    "diagnostic history must remain bounded",
  );
});

test("D007 named-query fixture uses the proven HQL syntax failure and requires project-aware HQL diagnostics", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");
  const namedQueries = fs.readFileSync(namedQueriesFixture, "utf8");

  assert.equal(
    namedQueries.includes("Greeting.broken=select g from Greeting g where"),
    true,
    "named-query fixture must use the same trailing-where syntax failure already proven by the Java HQL probe",
  );
  assert.equal(
    namedQueries.includes("select g form Greeting g"),
    false,
    "the unverified form-typo fixture must not return",
  );
  assert.equal(
    regression.includes('String(diagnostic.code ?? "") === "HQL_SYNTAX"'),
    true,
    "standalone acceptance must prove project-aware HQL reconciliation for the spring-data-jpa fixture",
  );
});

test("D007 static CodeLens acceptance targets an authentic isolated WebConfig provider", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");
  const probe = fs.readFileSync(codeLensProbeFixture, "utf8");

  assert.equal(
    probe.includes("HandlerTypePredicate.forAssignableType(CodeLensProbeController.class)"),
    true,
    "CodeLens path-prefix configuration must target only the dedicated probe controller",
  );
  assert.equal(
    probe.includes('configurer.addPathPrefix(') && probe.includes('"/d007"'),
    true,
    "probe must expose a WebConfig path-prefix index element",
  );
  assert.equal(
    regression.includes('fileBy(files, "CodeLensProbeController.java")'),
    true,
    "standalone regression must request CodeLens on the dedicated provider target",
  );
  assert.equal(
    regression.includes('lens?.command?.command === "vscode.open"') &&
      regression.includes('includes("Path Prefix: /d007")'),
    true,
    "acceptance must require the actual WebConfig lens command and path-prefix title",
  );
});

test("D007 version validation uses deterministic loopback metadata and the Spring Tools 5.3 upgrade command", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    regression.includes("startDeterministicVersionMetadataServer()"),
    true,
    "version validation must not depend on mutable live Maven/Spring release metadata",
  );
  assert.equal(
    regression.includes('"use-project-build-file": false'),
    true,
    "version validation must force the deterministic Spring projects provider path",
  );
  assert.equal(
    regression.includes('String(diagnostic.code ?? "") === "BOOT_VERSION_VALIDATION_CODE"') &&
      regression.includes("Newer patch version of Spring Boot available: 3\\.5\\.6"),
    true,
    "5.3 version acceptance must use Spring's generic version code plus the exact patch message",
  );
  assert.equal(
    regression.includes("canonicalDocumentUri(uri)") &&
      regression.includes("canonicalDocumentUri(targetUri)"),
    true,
    "published Java file:/ URIs and Node file:/// target URIs must share one diagnostic key",
  );
  assert.equal(
    regression.includes('version: "3.5.6"') &&
      regression.includes('assert.equal(targetVersion, "3.5.6")'),
    true,
    "the patch-upgrade target must be fixed by the local metadata fixture",
  );
  assert.equal(
    regression.includes('action?.command?.command === "sts/upgrade/spring-boot"'),
    true,
    "5.3 patch diagnostics must use the current SpringBootUpgrade command",
  );
  assert.equal(
    regression.includes('sts/upgrade/spring-boot-patch'),
    false,
    "the retired 5.2-era patch command must not reappear",
  );
});

test("D007 MCP coexistence establishes completion before and after tool calls", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    regression.includes("LSP server.port completion before MCP requests") &&
      regression.includes("LSP server.port completion after MCP requests"),
    true,
    "MCP coexistence must compare an indexed pre-MCP completion baseline with the post-MCP result",
  );
  assert.equal(
    regression.includes('textDocument: {\n        uri: pathToFileURL(propertiesFile).href,\n        version: 2') &&
      regression.includes('contentChanges: [{ text: fs.readFileSync(propertiesFile, "utf8") }]'),
    true,
    "the MCP sub-run must re-reconcile the open properties buffer after project index readiness",
  );
  assert.equal(
    regression.includes("lspCompletionBeforeMcp: true") &&
      regression.includes("lspCompletionAfterMcp: true"),
    true,
    "MCP evidence must preserve both sides of the coexistence comparison",
  );
});

test("D007 MCP coexistence completion probes track the exact ser fixture line", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  assert.equal(
    regression.includes('{ line: 0, character: 3 }'),
    false,
    "MCP completion must not use the stale top-of-file coordinate after fixture comments were added",
  );
  const exactMcpProbe =
    'positionAtExactLineEnd(fs.readFileSync(propertiesFile, "utf8"), "ser")';
  assert.equal(
    regression.split(exactMcpProbe).length - 1,
    2,
    "both pre-MCP and post-MCP completion probes must target the exact incomplete ser line",
  );
});

test("D007 live regression proves mappings and Hover before merged live CodeLens", () => {
  const regression = fs.readFileSync(standaloneRegressionFile, "utf8");

  const mappingsIndex = regression.indexOf("const liveMappings = await waitForLiveRequestMappings(");
  const hoverIndex = regression.indexOf("const liveHover = await waitForLiveHover(");
  const lensIndex = regression.indexOf("const liveLens = await waitForLiveUrlCodeLens(");
  assert.equal(mappingsIndex >= 0, true, "live mappings must be established");
  assert.equal(hoverIndex > mappingsIndex, true, "source matching Hover must follow authentic mappings");
  assert.equal(lensIndex > hoverIndex, true, "merged live CodeLens must be checked after Hover");

  assert.equal(
    regression.includes('command: "sts/livedata/get"') &&
      regression.includes('arguments: [{ processKey, endpoint: "mappings" }]'),
    true,
    "live mapping evidence must use Spring Tools public sts/livedata/get contract",
  );
  assert.equal(
    regression.includes("live /greeting mapping must identify GreetingController before source matching"),
    true,
    "live mapping evidence must bind the runtime mapping to the fixture controller",
  );
  assert.equal(
    regression.includes("lastCodeLenses="),
    true,
    "live CodeLens timeout must preserve a bounded final result for diagnosis",
  );
});

