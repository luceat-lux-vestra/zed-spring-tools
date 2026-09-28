#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { springArguments } from "../coordinator/src/main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "protocol", "spring-artifacts.json");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "spring-boot-basic");
const DOWNLOAD_TIMEOUT_MS = 180_000;
const INDEX_TIMEOUT_MS = 180_000;
const REQUEST_TIMEOUT_MS = 45_000;
const POLL_MS = 250;
const FORBIDDEN_PRIVATE_CALLBACKS = new Set([
  "sts/addClasspathListener",
  "sts/removeClasspathListener",
  "sts/javaType",
  "sts/javadoc",
  "sts/javadocHoverLink",
  "sts/javaLocation",
  "sts/javaSearchTypes",
  "sts/javaSearchPackages",
  "sts/javaSubTypes",
  "sts/javaSuperTypes",
]);

const DEFAULT_CONFIGURATION = {
  "boot-java": {
    "highlight-codelens": { on: true },
    "highlight-copilot-codelens": { on: true },
    jpql: true,
    "embedded-syntax-highlighting": true,
    "modulith-project-tracking": true,
    "live-information": {
      "all-local-java-processes": true,
    },
    "support-spring-xml-config": {
      on: true,
      "content-assist": true,
      hyperlinks: true,
      "scan-folders": "src/main",
    },
    java: {
      "codelens-over-query-methods": true,
      "codelens-web-configs-on-controller-classes": true,
      completions: {
        "inject-bean": true,
      },
    },
  },
};

class LspClient {
  constructor(child, workspaceFolders, configuration) {
    this.child = child;
    this.workspaceFolders = workspaceFolders;
    this.configuration = configuration;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.serverRequests = [];
    this.notifications = [];
    this.diagnostics = new Map();
    this.windowMessages = [];
    this.registrations = [];
    this.fatalError = null;

    child.stdout.on("data", (chunk) => {
      try {
        this.onData(chunk);
      } catch (error) {
        this.fail(error);
      }
    });
    child.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        this.fail(new Error(`Spring LS exited early: code=${code} signal=${signal}`));
      }
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const header = this.buffer.indexOf("Content-Length:");
      if (header < 0) return;
      if (header > 0) this.buffer = this.buffer.subarray(header);
      const separator = this.buffer.indexOf("\r\n\r\n");
      if (separator < 0) return;
      const match = /^Content-Length:\s*(\d+)$/im.exec(
        this.buffer.subarray(0, separator).toString("ascii"),
      );
      if (!match) throw new Error("invalid LSP header");
      const length = Number(match[1]);
      const frameEnd = separator + 4 + length;
      if (this.buffer.length < frameEnd) return;
      const message = JSON.parse(
        this.buffer.subarray(separator + 4, frameEnd).toString("utf8"),
      );
      this.buffer = this.buffer.subarray(frameEnd);
      this.handle(message);
    }
  }

  handle(message) {
    if (message.id !== undefined && message.method === undefined) {
      const key = String(message.id);
      const pending = this.pending.get(key);
      if (!pending) return;
      this.pending.delete(key);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(
          new Error(`${pending.method}: ${JSON.stringify(message.error)}`),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && typeof message.method === "string") {
      this.serverRequests.push(message.method);
      let result = null;
      if (message.method === "workspace/configuration") {
        result = (message.params?.items ?? []).map((item) =>
          configurationValue(this.configuration, item?.section)
        );
      } else if (message.method === "workspace/workspaceFolders") {
        result = this.workspaceFolders;
      } else if (message.method === "workspace/applyEdit") {
        result = { applied: false };
      } else if (message.method === "window/workDoneProgress/create") {
        result = null;
      } else if (
        message.method === "client/registerCapability" ||
        message.method === "client/unregisterCapability"
      ) {
        if (message.method === "client/registerCapability") {
          this.registrations.push(...(message.params?.registrations ?? []));
        }
        result = null;
      } else if (message.method === "sts/project/gav") {
        const projectUris = message.params?.projectUris;
        assert.ok(Array.isArray(projectUris));
        result = projectUris.map(() => null);
      } else if (message.method === "sts/javaCodeComplete") {
        result = [];
      } else if (FORBIDDEN_PRIVATE_CALLBACKS.has(message.method)) {
        throw new Error(
          `standalone Spring LS attempted forbidden private Java callback: ${message.method}`,
        );
      } else if (
        message.method === "window/showMessageRequest" ||
        message.method === "window/showMessage"
      ) {
        this.windowMessages.push({
          method: message.method,
          type: Number.isInteger(message.params?.type) ? message.params.type : null,
        });
        result = null;
      } else if (message.method === "window/showDocument") {
        result = { success: false };
      }
      this.send({ jsonrpc: "2.0", id: message.id, result });
      return;
    }

    if (typeof message.method === "string") {
      this.notifications.push(message);
      if (message.method === "textDocument/publishDiagnostics") {
        const uri = message.params?.uri;
        if (typeof uri === "string") {
          this.diagnostics.set(uri, message.params?.diagnostics ?? []);
        }
      }
      if (
        message.method === "window/showMessage" ||
        message.method === "window/showMessageRequest"
      ) {
        this.windowMessages.push({
          method: message.method,
          type: Number.isInteger(message.params?.type) ? message.params.type : null,
        });
      }
    }
  }

  request(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (this.fatalError) return Promise.reject(this.fatalError);
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(String(id))) {
          reject(new Error(`${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.pending.set(String(id), { method, resolve, reject, timer });
    });
    this.send({ jsonrpc: "2.0", id, method, params });
    return promise;
  }

  notify(method, params) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  send(message) {
    const body = Buffer.from(JSON.stringify(message));
    this.child.stdin.write(
      Buffer.concat([
        Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
        body,
      ]),
    );
  }

  fail(error) {
    if (this.fatalError) return;
    this.fatalError = error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function main() {
  const output = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(ROOT, "tmp", "d007-standalone-capability-regression.json");
  const javaHome = process.argv[3]
    ? path.resolve(process.argv[3])
    : process.env.JAVA_HOME;
  if (!javaHome) throw new Error("JAVA_HOME or an explicit Java home argument is required");

  const sourceHead = gitHead();
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const pin = manifest.springTools;
  assert.equal(pin.mode, "standalone");

  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zst-d007-capability-"));
  const worktree = path.join(runRoot, "fixture");
  const jar = path.join(runRoot, pin.asset);
  fs.cpSync(FIXTURE, worktree, { recursive: true });
  const factoriesFile = path.join(
    worktree,
    "src",
    "main",
    "resources",
    "META-INF",
    "spring.factories",
  );
  fs.appendFileSync(
    factoriesFile,
    [
      "",
      "# D007 standalone-only negative control: Boot 3 rejects this legacy key.",
      "org.springframework.boot.autoconfigure.EnableAutoConfiguration=\\",
      "  dev.zed.spring.fixture.GreetingStartupListener",
      "",
    ].join("\n"),
  );
  const xmlFile = path.join(worktree, "src", "main", "resources", "beans.xml");
  fs.writeFileSync(
    xmlFile,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<beans xmlns="http://www.springframework.org/schema/beans"',
      '       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '       xsi:schemaLocation="http://www.springframework.org/schema/beans https://www.springframework.org/schema/beans/spring-beans.xsd">',
      '  <bean id="greetingPropertiesXml" class="dev.zed.spring.fixture.GreetingProperties">',
      '    <property name="salutation" value="#{1 + }"/>',
      '  </bean>',
      '</beans>',
      '',
    ].join("\n"),
  );

  const evidence = {
    schemaVersion: 1,
    decision: "D007",
    sourceHead,
    gateScope: "standalone-capability-regression",
    platform: {
      os: process.platform,
      arch: process.arch,
      release: os.release(),
    },
    checks: {},
    serverRequests: [],
    unexpectedWindowErrors: [],
    forbiddenPrivateCallbacks: [],
    status: "running",
  };

  let child;
  let stderr = "";
  try {
    await downloadPinnedArtifact(pin, jar);
    assert.equal(fs.statSync(jar).size, pin.size);
    assert.equal(sha256(jar), pin.sha256);

    evidence.checks.fixtureCompile = compileFixture(worktree, javaHome);

    const configuration = structuredClone(DEFAULT_CONFIGURATION);
    configuration["boot-java"].common = {
      "properties-metadata": path.join(worktree, "config", "shared-metadata.json"),
    };

    const args = springArguments(jar, worktree, null);
    const java = path.join(
      javaHome,
      "bin",
      process.platform === "win32" ? "java.exe" : "java",
    );
    assert.equal(fs.existsSync(java), true, `Java executable missing: ${java}`);
    child = spawn(java, args, {
      cwd: worktree,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-512 * 1024);
    });

    const workspaceUri = directoryUri(worktree);
    const client = new LspClient(
      child,
      [{ uri: workspaceUri, name: "spring-boot-basic" }],
      configuration,
    );

    const initialize = await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "zed-spring-tools-d007-capability-regression", version: "1" },
      rootUri: workspaceUri,
      workspaceFolders: [{ uri: workspaceUri, name: "spring-boot-basic" }],
      capabilities: {
        workspace: {
          configuration: true,
          applyEdit: true,
          workspaceFolders: true,
          symbol: { dynamicRegistration: true },
          executeCommand: { dynamicRegistration: true },
        },
        textDocument: {
          synchronization: { dynamicRegistration: true },
          publishDiagnostics: {},
          completion: { dynamicRegistration: true },
          hover: { dynamicRegistration: true },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          implementation: { dynamicRegistration: true },
          codeAction: { dynamicRegistration: true },
          codeLens: { dynamicRegistration: true },
          inlayHint: { dynamicRegistration: true },
          semanticTokens: { dynamicRegistration: true, requests: { full: true } },
          documentSymbol: { dynamicRegistration: true },
        },
        window: {
          showMessage: {},
          showDocument: { support: true },
          workDoneProgress: true,
        },
      },
      initializationOptions: {},
    });
    assert.ok(initialize?.capabilities);
    client.notify("initialized", {});
    client.notify("workspace/didChangeConfiguration", { settings: configuration });

    const files = fixtureFiles(worktree);
    for (const file of files) {
      client.notify("textDocument/didOpen", {
        textDocument: {
          uri: pathToFileURL(file.path).href,
          languageId: file.languageId,
          version: 1,
          text: file.text,
        },
      });
    }

    await waitFor(
      () => client.notifications.some(
        (message) =>
          message.method === "spring/index/updated" &&
          Array.isArray(message.params?.affectedProjects) &&
          message.params.affectedProjects.length > 0,
      ),
      "standalone Spring index",
      INDEX_TIMEOUT_MS,
    );
    evidence.checks.indexReady = pass("spring/index/updated affectedProjects > 0");

    for (const file of files) {
      client.notify("textDocument/didChange", {
        textDocument: { uri: uri(file), version: 2 },
        contentChanges: [{ text: file.text }],
      });
    }

    const executableProjects = await waitForExecutableProject(client);
    const executable = executableProjects.find(
      (project) => project?.mainClass === "dev.zed.spring.fixture.FixtureApplication",
    );
    assert.ok(executable);
    evidence.checks.executableBootProjects = pass(
      "standalone executable project discovery",
      { mainClass: executable.mainClass, gav: executable.gav ?? null },
    );

    const props = fileBy(files, "application.properties");
    const yaml = fileBy(files, "application.yaml");
    const injection = fileBy(files, "GreetingInjection.java");
    const configurationJava = fileBy(files, "GreetingConfiguration.java");
    const repositoryJava = fileBy(files, "GreetingRepository.java");
    const spel = fileBy(files, "SpelSample.java");
    const dataQuery = fileBy(files, "DataQuerySample.java");
    const cron = fileBy(files, "CronSyntaxSample.java");
    const controller = fileBy(files, "GreetingController.java");
    const namedQueries = fileBy(files, "jpa-named-queries.properties");
    const factories = fileBy(files, "spring.factories");
    const xml = fileBy(files, "beans.xml");

    const propsCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(props) },
        position: positionAfter(props.text, "ser"),
      },
    ));
    assert.equal(
      propsCompletion.some((item) => String(item?.label ?? "").includes("server.port")),
      true,
    );
    evidence.checks.propertiesCompletion = pass("server.port completion");

    const yamlCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(yaml) },
        position: positionAfter(yaml.text, "ser"),
      },
    ));
    assert.equal(yamlCompletion.length > 0, true);
    evidence.checks.yamlCompletion = pass("YAML completion", { count: yamlCompletion.length });

    const hover = await client.request("textDocument/hover", {
      textDocument: { uri: uri(props) },
      position: positionInside(props.text, "server.port", 3),
    });
    assert.ok(hover);
    evidence.checks.propertyHover = pass("server.port hover");

    const propertyDiagnostics = await waitForDiagnostics(
      client,
      uri(props),
      (diagnostics) => diagnostics.some((diagnostic) =>
        /unknown property/i.test(String(diagnostic.message ?? ""))
      ),
      "unknown property diagnostic",
    );
    evidence.checks.propertyDiagnostics = pass("unknown property diagnostic", {
      count: propertyDiagnostics.length,
    });

    const propertyDefinition = await client.request("textDocument/definition", {
      textDocument: { uri: uri(props) },
      position: positionInside(props.text, "fixture.greeting.salutation", 12),
    });
    const propertyDefinitionUris = locationUris(propertyDefinition);
    assert.equal(
      propertyDefinitionUris.some((value) => value.endsWith("/GreetingProperties.java")),
      true,
    );
    evidence.checks.propertyDefinition = pass(
      "project property definition resolves to GreetingProperties.java",
      { count: propertyDefinitionUris.length },
    );

    const factoriesDiagnostics = await waitForDiagnostics(
      client,
      uri(factories),
      (diagnostics) => diagnostics.some((diagnostic) =>
        String(diagnostic.code ?? "").includes("FACTORIES_KEY_NOT_SUPPORTED")
      ),
      "spring.factories project-aware diagnostic",
    );
    evidence.checks.springFactories = pass(
      "spring-factories language reached standalone project model",
      { count: factoriesDiagnostics.length },
    );

    const xmlDiagnostics = await waitForDiagnostics(
      client,
      uri(xml),
      (diagnostics) => diagnostics.some((diagnostic) =>
        /SPEL:|JAVA_SPEL_EXPRESSION_SYNTAX/i.test(
          `${diagnostic.code ?? ""} ${diagnostic.message ?? ""}`,
        )
      ),
      "Spring XML SpEL diagnostic",
    );
    const xmlDefinition = await client.request("textDocument/definition", {
      textDocument: { uri: uri(xml) },
      position: positionInside(xml.text, 'name="salutation"', 'name="'.length + 3),
    });
    const xmlDefinitionUris = locationUris(xmlDefinition);
    assert.equal(
      xmlDefinitionUris.some((value) => value.endsWith("/GreetingProperties.java")),
      true,
    );
    const xmlPropertyCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(xml) },
        position: positionInside(xml.text, 'name="salutation"', 'name="'.length + 2),
      },
    ));
    assert.equal(
      xmlPropertyCompletion.some((item) =>
        String(item?.label ?? item?.insertText ?? "").includes("salutation")
      ),
      true,
    );
    evidence.checks.xmlCore = pass(
      "XML reconcile + property completion + hyperlink without private Java transport",
      {
        diagnosticCount: xmlDiagnostics.length,
        definitionCount: xmlDefinitionUris.length,
        completionCount: xmlPropertyCompletion.length,
      },
    );

    const scopeCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(configurationJava) },
        position: positionInside(configurationJava.text, '"singleton"', 2),
      },
    ));
    assert.equal(
      scopeCompletion.some((item) => String(item?.label ?? "").toLowerCase().includes("singleton")),
      true,
    );
    evidence.checks.springJavaCompletion = pass("@Scope completion");

    const qualifierCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(injection) },
        position: positionInside(injection.text, '"greetingPrefix"', 5),
      },
    ));
    assert.equal(qualifierCompletion.length > 0, true);
    evidence.checks.springIndexCompletion = pass("@Qualifier completion", {
      count: qualifierCompletion.length,
    });

    const requestMappingTemplates = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(controller) },
        position: positionAfter(
          controller.text,
          "public class GreetingController {",
        ),
      },
    ));
    const getMappingTemplate = requestMappingTemplates.find((item) =>
      /GetMapping/.test(String(item?.label ?? item?.insertText ?? ""))
    );
    assert.ok(getMappingTemplate);
    assert.equal(getMappingTemplate.insertTextFormat, 2);
    evidence.checks.requestMappingTemplates = pass(
      "request-mapping snippet completion with snippet format",
      { count: requestMappingTemplates.length },
    );

    const derivedQueryCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(repositoryJava) },
        position: positionAfter(repositoryJava.text, "findByMessageAnd"),
      },
    ));
    assert.equal(derivedQueryCompletion.length > 0, true);
    evidence.checks.springDataCompletion = pass("derived-query completion", {
      count: derivedQueryCompletion.length,
    });

    const spelDiagnostics = await waitForDiagnostics(
      client,
      uri(spel),
      (diagnostics) => diagnostics.some((diagnostic) =>
        /SPEL:|Place-Holder:/i.test(String(diagnostic.message ?? ""))
      ),
      "SpEL diagnostics",
    );
    evidence.checks.spelDiagnostics = pass("SpEL diagnostics", {
      count: spelDiagnostics.length,
    });

    const queryDiagnostics = await waitForDiagnostics(
      client,
      uri(dataQuery),
      (diagnostics) => {
        const text = diagnostics.map((diagnostic) =>
          `${diagnostic.code ?? ""} ${diagnostic.message ?? ""}`
        ).join("\n");
        return /HQL_SYNTAX/.test(text) && /SQL_SYNTAX/.test(text);
      },
      "Spring Data HQL and SQL diagnostics",
    );
    evidence.checks.springDataDiagnostics = pass("HQL + SQL diagnostics", {
      count: queryDiagnostics.length,
    });

    const cronDiagnostics = await waitForDiagnostics(
      client,
      uri(cron),
      (diagnostics) => diagnostics.some((diagnostic) =>
        /CRON:/i.test(String(diagnostic.message ?? ""))
      ),
      "cron diagnostics",
    );
    evidence.checks.cronDiagnostics = pass("cron diagnostics", {
      count: cronDiagnostics.length,
    });

    const cronCompletion = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: uri(cron) },
        position: positionInside(cron.text, "0 0 * * *", 3),
      },
    ));
    assert.equal(cronCompletion.length > 0, true);
    evidence.checks.cronCompletion = pass("cron completion", {
      count: cronCompletion.length,
    });

    const namedQueryDiagnostics = await waitForDiagnostics(
      client,
      uri(namedQueries),
      (diagnostics) => diagnostics.some((diagnostic) =>
        /JPQL_SYNTAX|mismatched|syntax/i.test(
          `${diagnostic.code ?? ""} ${diagnostic.message ?? ""}`,
        )
      ),
      "named-query diagnostics",
    );
    evidence.checks.jpaNamedQueryDiagnostics = pass("jpa-query-properties diagnostics", {
      count: namedQueryDiagnostics.length,
    });

    const inlayHints = await client.request("textDocument/inlayHint", {
      textDocument: { uri: uri(repositoryJava) },
      range: fullRange(repositoryJava.text),
    });
    assert.equal(Array.isArray(inlayHints) && inlayHints.length > 0, true);
    evidence.checks.inlayHints = pass("Spring Data/Java inlay hints", {
      count: inlayHints.length,
    });

    const queryParameterDefinition = await client.request(
      "textDocument/definition",
      {
        textDocument: { uri: uri(dataQuery) },
        position: positionInside(
          dataQuery.text,
          "g.message = ?1 and g.id = ?2",
          "g.message = ?".length,
        ),
      },
    );
    const queryParameterUris = locationUris(queryParameterDefinition);
    assert.equal(
      queryParameterUris.some((value) => value.endsWith("/DataQuerySample.java")),
      true,
    );
    evidence.checks.springDataNavigation = pass(
      "Spring Data positional parameter definition",
      { count: queryParameterUris.length },
    );

    const definition = await client.request("textDocument/definition", {
      textDocument: { uri: uri(spel) },
      position: positionInside(spel.text, "greetingPrefix", 3),
    });
    const definitionUris = locationUris(definition);
    assert.equal(
      definitionUris.some((value) => value.endsWith("/GreetingConfiguration.java")),
      true,
    );
    evidence.checks.springNavigation = pass("SpEL bean definition", {
      count: definitionUris.length,
    });

    const references = await client.request("textDocument/references", {
      textDocument: { uri: uri(injection) },
      position: positionInside(injection.text, '"greetingPrefix"', 5),
      context: { includeDeclaration: true },
    });
    assert.equal(Array.isArray(references), true);
    const referenceUris = locationUris(references);
    assert.equal(
      referenceUris.some((value) => value.endsWith("/GreetingConfiguration.java")),
      true,
    );
    evidence.checks.springReferences = pass(
      "@Qualifier Spring reference reaches @Bean declaration",
      { count: referenceUris.length },
    );

    const semanticTokens = await springSemanticTokens(
      client,
      repositoryJava,
      3,
    );
    const springTokenTypeObserved = semanticTokenTypes(semanticTokens).some(
      (type) => type >= 17,
    );
    assert.equal(springTokenTypeObserved, true);
    evidence.checks.embeddedSemanticTokens = pass(
      "Spring semantic tokens include Spring-only token type index >= 17",
      { tokenCount: Math.floor((semanticTokens.data?.length ?? 0) / 5) },
    );

    const documentSymbols = await client.request("textDocument/documentSymbol", {
      textDocument: { uri: uri(controller) },
    });
    assert.equal(Array.isArray(documentSymbols) && documentSymbols.length > 0, true);
    evidence.checks.documentSymbols = pass("Spring document symbols", {
      count: documentSymbols.length,
    });

    const codeLenses = await client.request("textDocument/codeLens", {
      textDocument: { uri: uri(controller) },
    });
    assert.equal(Array.isArray(codeLenses) && codeLenses.length > 0, true);
    evidence.checks.codeLens = pass("Spring CodeLens", { count: codeLenses.length });

    const configurationDiagnostics = await waitForDiagnostics(
      client,
      uri(configurationJava),
      (diagnostics) => diagnostics.some((diagnostic) =>
        /JAVA_PUBLIC_BEAN_METHOD/.test(String(diagnostic.code ?? ""))
      ),
      "Java Spring diagnostic with quick fix",
    );
    const publicBeanDiagnostic = configurationDiagnostics.find((diagnostic) =>
      /JAVA_PUBLIC_BEAN_METHOD/.test(String(diagnostic.code ?? ""))
    );
    assert.ok(publicBeanDiagnostic);
    evidence.checks.javaSpringDiagnostics = pass(
      "JAVA_PUBLIC_BEAN_METHOD diagnostic",
      { count: configurationDiagnostics.length },
    );

    const javaCodeActions = await client.request("textDocument/codeAction", {
      textDocument: { uri: uri(configurationJava) },
      range: publicBeanDiagnostic.range,
      context: { diagnostics: [publicBeanDiagnostic] },
    });
    assert.equal(Array.isArray(javaCodeActions), true);
    assert.equal(
      javaCodeActions.some((action) =>
        action?.command?.command === "sts.vscode-spring-boot.codeAction" ||
        action?.command === "sts.vscode-spring-boot.codeAction"
      ),
      true,
    );
    evidence.checks.javaSpringQuickFix = pass(
      "Spring Java quick fix command",
      { count: javaCodeActions.length },
    );

    const workspaceSymbols = await client.request("workspace/symbol", {
      query: "greeting",
    });
    assert.equal(Array.isArray(workspaceSymbols) && workspaceSymbols.length > 0, true);
    const workspaceSymbolUris = workspaceSymbols.flatMap((symbol) =>
      locationUris(symbol?.location ?? symbol)
    );
    assert.equal(
      workspaceSymbolUris.some((value) => value.endsWith("/GreetingController.java")),
      true,
    );
    evidence.checks.workspaceSymbols = pass(
      "Spring workspace symbols include request mapping source",
      { count: workspaceSymbols.length },
    );

    const structure = await client.request("workspace/executeCommand", {
      command: "sts/spring-boot/structure",
      arguments: [{ updateMetadata: true }],
    }, 90_000);
    assert.equal(Array.isArray(structure) && structure.length > 0, true);
    evidence.checks.structure = pass("Spring logical structure", {
      count: structure.length,
    });

    const bootInfo = await client.request("workspace/executeCommand", {
      command: "sts/spring-boot/bootProjectInfo",
      arguments: [uri(controller)],
    });
    assert.equal(bootInfo?.buildTool, "maven");
    assert.equal(
      bootInfo?.mainClass,
      "dev.zed.spring.fixture.FixtureApplication",
    );
    evidence.checks.bootProjectInfo = pass("Boot project info", {
      buildTool: bootInfo.buildTool,
      mainClass: bootInfo.mainClass,
    });

    evidence.serverRequests = [...new Set(client.serverRequests)].sort();
    evidence.forbiddenPrivateCallbacks = evidence.serverRequests.filter((method) =>
      FORBIDDEN_PRIVATE_CALLBACKS.has(method)
    );
    assert.deepEqual(evidence.forbiddenPrivateCallbacks, []);
    assert.equal(client.serverRequests.includes("sts/project/gav"), true);
    assert.equal(
      client.serverRequests.includes("sts/javaCodeComplete"),
      false,
      "D007 XML core acceptance must not silently depend on blocked Java package/type completion",
    );

    evidence.unexpectedWindowErrors = client.windowMessages.filter(
      (message) => message.type === 1,
    );
    assert.deepEqual(
      evidence.unexpectedWindowErrors,
      [],
      "standalone capability regression must not emit an error popup",
    );

    await client.request("shutdown", null);
    client.notify("exit", null);

    evidence.status = "pass";
    evidence.finishedAt = new Date().toISOString();
    evidence.stderrTail = stderr.split(/\r?\n/).slice(-80);
    writeEvidence(output, evidence);
    process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
  } catch (error) {
    if (child && child.exitCode === null) child.kill();
    evidence.status = "fail";
    evidence.error = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    evidence.finishedAt = new Date().toISOString();
    evidence.stderrTail = stderr.split(/\r?\n/).slice(-120);
    writeEvidence(output, evidence);
    throw error;
  } finally {
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
}

function configurationValue(configuration, section) {
  if (typeof section !== "string" || section.length === 0) {
    return structuredClone(configuration);
  }
  let value = configuration;
  for (const segment of section.split(".")) {
    if (
      value === null ||
      typeof value !== "object" ||
      !Object.hasOwn(value, segment)
    ) {
      return null;
    }
    value = value[segment];
  }
  return structuredClone(value);
}

function compileFixture(worktree, javaHome) {
  const result = spawnSync(
    "mvn",
    ["-q", "-DskipTests", "compile"],
    {
      cwd: worktree,
      encoding: "utf8",
      shell: false,
      timeout: 240_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH ?? ""),
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `rich fixture Maven compile failed: ${String(result.stderr ?? "").slice(-8000)}`,
    );
  }
  return pass("mvn -DskipTests compile", {
    generatedConfigurationMetadata: fs.existsSync(
      path.join(
        worktree,
        "target",
        "classes",
        "META-INF",
        "spring-configuration-metadata.json",
      ),
    ),
  });
}

function fixtureFiles(worktree) {
  const specs = [
    ["src/main/resources/application.properties", "spring-boot-properties"],
    ["src/main/resources/application.yaml", "spring-boot-yaml"],
    ["src/main/resources/META-INF/jpa-named-queries.properties", "jpa-query-properties"],
    ["src/main/resources/META-INF/spring.factories", "spring-factories"],
    ["src/main/resources/beans.xml", "xml"],
    ["src/main/java/dev/zed/spring/fixture/FixtureApplication.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/GreetingController.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/GreetingConfiguration.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/GreetingInjection.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/GreetingRepository.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/SpelSample.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/DataQuerySample.java", "java"],
    ["src/main/java/dev/zed/spring/fixture/CronSyntaxSample.java", "java"],
  ];
  return specs.map(([relative, languageId]) => {
    const absolute = path.join(worktree, relative);
    return {
      relative,
      path: absolute,
      languageId,
      text: fs.readFileSync(absolute, "utf8"),
    };
  });
}

function fileBy(files, basename) {
  const found = files.find((file) => file.path.endsWith(path.sep + basename));
  assert.ok(found, `fixture file missing: ${basename}`);
  return found;
}

function uri(file) {
  return pathToFileURL(file.path).href;
}

function positionAfter(text, needle) {
  const index = text.indexOf(needle);
  assert.notEqual(index, -1, `needle not found: ${needle}`);
  return offsetPosition(text, index + needle.length, needle);
}

function positionInside(text, needle, offset) {
  const index = text.indexOf(needle);
  assert.notEqual(index, -1, `needle not found: ${needle}`);
  return offsetPosition(text, index + offset, needle);
}

function offsetPosition(text, offset, label) {
  assert.equal(Number.isInteger(offset) && offset >= 0, true, label);
  const before = text.slice(0, offset);
  const lines = before.split("\n");
  return {
    line: lines.length - 1,
    character: lines.at(-1).length,
  };
}

function fullRange(text) {
  const lines = text.split("\n");
  return {
    start: { line: 0, character: 0 },
    end: { line: lines.length - 1, character: lines.at(-1).length },
  };
}

async function springSemanticTokens(client, file, attempts) {
  let response = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await client.request("textDocument/semanticTokens/full", {
      textDocument: { uri: uri(file) },
    });
    if (
      response &&
      Array.isArray(response.data) &&
      response.data.length > 0 &&
      semanticTokenTypes(response).some((type) => type >= 17)
    ) {
      return response;
    }
    client.notify("textDocument/didChange", {
      textDocument: { uri: uri(file), version: 2 + attempt },
      contentChanges: [{ text: file.text }],
    });
    await sleep(500);
  }
  return response;
}

function semanticTokenTypes(response) {
  if (!Array.isArray(response?.data)) return [];
  const types = [];
  for (let index = 3; index < response.data.length; index += 5) {
    types.push(response.data[index]);
  }
  return types;
}

function completionItems(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

function locationUris(result) {
  if (Array.isArray(result)) {
    return result.flatMap((entry) => locationUris(entry));
  }
  if (typeof result?.uri === "string") return [result.uri];
  if (typeof result?.targetUri === "string") return [result.targetUri];
  return [];
}

async function waitForDiagnostics(client, targetUri, predicate, label) {
  await waitFor(
    () => predicate(client.diagnostics.get(targetUri) ?? []),
    label,
    INDEX_TIMEOUT_MS,
  );
  return client.diagnostics.get(targetUri) ?? [];
}

async function waitForExecutableProject(client) {
  const deadline = Date.now() + INDEX_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await client.request(
        "workspace/executeCommand",
        {
          command: "sts/spring-boot/executableBootProjects",
          arguments: [],
        },
        REQUEST_TIMEOUT_MS,
      );
      if (Array.isArray(result) && result.length > 0) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw lastError ?? new Error("executable Boot project discovery timed out");
}

async function waitFor(predicate, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(POLL_MS);
  }
  throw new Error(`timed out waiting for ${label} after ${timeoutMs}ms`);
}

function pass(proof, details = undefined) {
  return details === undefined
    ? { status: "pass", proof }
    : { status: "pass", proof, details };
}

async function downloadPinnedArtifact(pin, destination) {
  const response = await fetch(pin.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { "user-agent": "zed-spring-tools-d007-capability-regression" },
  });
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function directoryUri(directory) {
  return pathToFileURL(directory.endsWith(path.sep) ? directory : directory + path.sep).href;
}

function writeEvidence(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(value, null, 2) + "\n");
}

function gitHead() {
  const result = spawnSync(
    "git",
    ["-C", ROOT, "rev-parse", "HEAD"],
    { encoding: "utf8", shell: false },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${String(result.stderr ?? "").trim()}`);
  }
  const head = result.stdout.trim();
  assert.match(head, /^[0-9a-f]{40}$/);
  return head;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
