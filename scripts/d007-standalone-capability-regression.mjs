#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Coordinator, run as runCoordinator, springArguments } from "../coordinator/src/main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "protocol", "spring-artifacts.json");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "spring-boot-basic");
const MODULITH_FIXTURE = path.join(
  ROOT,
  "tests",
  "fixtures",
  "spring-modulith-gradle",
);
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
  constructor(
    child,
    workspaceFolders,
    configuration,
    serverRequestResponder = null,
  ) {
    this.child = child;
    this.workspaceFolders = workspaceFolders;
    this.configuration = configuration;
    this.serverRequestResponder = serverRequestResponder;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.serverRequests = [];
    this.notifications = [];
    this.diagnostics = new Map();
    this.windowMessages = [];
    this.registrations = [];
    this.workspaceEdits = [];
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
        this.workspaceEdits.push(structuredClone(message.params ?? {}));
        result = { applied: true };
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
          message: String(message.params?.message ?? "").slice(0, 500),
        });
        result =
          message.method === "window/showMessageRequest" &&
          typeof this.serverRequestResponder === "function"
            ? this.serverRequestResponder(message)
            : null;
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
  const pomFile = path.join(worktree, "pom.xml");
  const pomText = fs.readFileSync(pomFile, "utf8");
  assert.match(pomText, /<\/dependencies>/);
  fs.writeFileSync(
    pomFile,
    pomText.replace(
      "</dependencies>",
      [
        "        <dependency>",
        "            <groupId>org.springframework.ai</groupId>",
        "            <artifactId>spring-ai-model</artifactId>",
        "            <version>1.0.0</version>",
        "        </dependency>",
        "    </dependencies>",
      ].join("\n"),
    ),
  );
  const aiToolsFile = path.join(
    worktree,
    "src",
    "main",
    "java",
    "dev",
    "zed",
    "spring",
    "fixture",
    "AiTools.java",
  );
  fs.writeFileSync(
    aiToolsFile,
    [
      "package dev.zed.spring.fixture;",
      "",
      "import org.springframework.ai.tool.annotation.Tool;",
      "import org.springframework.stereotype.Component;",
      "",
      "@Component",
      "public class AiTools {",
      "    @Tool",
      "    public String currentWeather() { return \"sunny\"; }",
      "",
      "    @Tool(description = \"short weather\")",
      "    public String forecast() { return \"sunny\"; }",
      "",
      "    @Tool(description = \"Get a detailed weather forecast for the requested location\")",
      "    public String detailedWeather() { return \"sunny\"; }",
      "}",
      "",
    ].join("\n"),
  );

  const resources = path.join(worktree, "src", "main", "resources");
  const propertiesFile = path.join(resources, "application.properties");
  fs.appendFileSync(
    propertiesFile,
    [
      "",
      "# D007 shared-metadata reload controls.",
      "shared.fleet.banner=before-reload",
      "shared.fleet.footer=after-reload",
      "",
    ].join("\n"),
  );
  const conversionPropertiesFile = path.join(resources, "conversion-d007.properties");
  const conversionYamlFile = path.join(resources, "conversion-d007.yaml");
  fs.writeFileSync(
    conversionPropertiesFile,
    "server.port=8081\nspring.application.name=d007-conversion\n",
  );
  fs.writeFileSync(
    conversionYamlFile,
    "server:\n  port: 8082\nspring:\n  application:\n    name: d007-yaml\n",
  );

  const xmlFile = path.join(resources, "beans.xml");
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

    evidence.checks.javaRequirementDiagnostic =
      await javaRequirementDiagnosticRegression(worktree, jar);

    evidence.checks.fixtureCompile = compileFixture(worktree, javaHome);

    const configuration = structuredClone(DEFAULT_CONFIGURATION);
    const sharedMetadataFile = path.join(
      worktree,
      "config",
      "shared-metadata.json",
    );
    configuration["boot-java"].common = {
      "properties-metadata": sharedMetadataFile,
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
    const pom = fileBy(files, "pom.xml");
    const aiTools = fileBy(files, "AiTools.java");

    const propsCompletionResult = await waitForCompletion(
      client,
      uri(props),
      positionAtExactLineEnd(props.text, "ser"),
      (items) => items.some((item) =>
        String(item?.label ?? "").includes("server.port")
      ),
      "server.port properties completion after standalone reindex",
    );
    const propsCompletion = propsCompletionResult.items;
    evidence.checks.propertiesCompletion = pass("server.port completion", {
      count: propsCompletion.length,
      attempts: propsCompletionResult.attempts,
    });

    const yamlCompletionResult = await waitForCompletion(
      client,
      uri(yaml),
      positionAtExactLineEnd(yaml.text, "ser"),
      (items) => items.length > 0,
      "YAML completion after standalone reindex",
    );
    const yamlCompletion = yamlCompletionResult.items;
    evidence.checks.yamlCompletion = pass("YAML completion", {
      count: yamlCompletion.length,
      attempts: yamlCompletionResult.attempts,
    });

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

    const sharedBaseline = await waitForDiagnostics(
      client,
      uri(props),
      (diagnostics) => {
        const messages = diagnostics.map((diagnostic) =>
          String(diagnostic.message ?? "")
        );
        return messages.some((message) => message.includes("shared.fleet.footer")) &&
          messages.some((message) => /'ser'|\bser\b/.test(message));
      },
      "shared metadata negative control plus independent ser diagnostic",
    );
    const sharedMetadata = JSON.parse(
      fs.readFileSync(sharedMetadataFile, "utf8"),
    );
    assert.equal(Array.isArray(sharedMetadata.properties), true);
    sharedMetadata.properties.push({
      name: "shared.fleet.footer",
      type: "java.lang.String",
      description: "Footer text added during D007 reload regression.",
      defaultValue: "reloaded",
    });
    fs.writeFileSync(
      sharedMetadataFile,
      JSON.stringify(sharedMetadata, null, 2) + "\n",
    );
    const reloadResult = await client.request(
      "workspace/executeCommand",
      {
        command: "sts/common-properties/reload",
        arguments: [],
      },
      90_000,
    );
    assert.equal(
      reloadResult,
      true,
      "standalone shared-properties reload must report an actual reload",
    );
    client.notify("textDocument/didChange", {
      textDocument: { uri: uri(props), version: 20 },
      contentChanges: [{ text: props.text }],
    });
    const sharedAfterReload = await waitForDiagnostics(
      client,
      uri(props),
      (diagnostics) => {
        const messages = diagnostics.map((diagnostic) =>
          String(diagnostic.message ?? "")
        );
        return !messages.some((message) => message.includes("shared.fleet.footer")) &&
          messages.some((message) => /'ser'|\bser\b/.test(message));
      },
      "shared metadata reload with negative control preserved",
    );
    evidence.checks.sharedPropertiesMetadataReload = pass(
      "sts/common-properties/reload updates metadata without clearing unrelated diagnostics",
      {
        baselineDiagnosticCount: sharedBaseline.length,
        afterReloadDiagnosticCount: sharedAfterReload.length,
      },
    );

    evidence.checks.propertiesToYaml = await conversionWorkspaceEdit(
      client,
      "sts/boot/props-to-yaml",
      conversionPropertiesFile,
      path.join(resources, "conversion-d007.yml"),
      ["server:", "port:", "spring:", "application:", "name:"],
    );
    evidence.checks.yamlToProperties = await conversionWorkspaceEdit(
      client,
      "sts/boot/yaml-to-props",
      conversionYamlFile,
      path.join(resources, "conversion-d007-output.properties"),
      ["server.port", "spring.application.name", "d007-yaml"],
    );

    evidence.checks.buildTaskExecution = runGeneratedBuildTaskRegression(
      worktree,
      javaHome,
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
    const xmlPropertyCompletionResult = await waitForCompletion(
      client,
      uri(xml),
      positionInside(xml.text, 'name="salutation"', 'name="'.length + 2),
      (items) => items.some((item) =>
        String(item?.label ?? item?.insertText ?? "").includes("salutation")
      ),
      "Spring XML property completion",
    );
    const xmlPropertyCompletion = xmlPropertyCompletionResult.items;
    evidence.checks.xmlCore = pass(
      "XML reconcile + property completion + hyperlink without private Java transport",
      {
        diagnosticCount: xmlDiagnostics.length,
        definitionCount: xmlDefinitionUris.length,
        completionCount: xmlPropertyCompletion.length,
      },
    );

    const scopeCompletionResult = await waitForCompletion(
      client,
      uri(configurationJava),
      positionInside(configurationJava.text, '"singleton"', 2),
      (items) => items.some((item) =>
        String(item?.label ?? "").toLowerCase().includes("singleton")
      ),
      "@Scope completion",
    );
    const scopeCompletion = scopeCompletionResult.items;
    evidence.checks.springJavaCompletion = pass("@Scope completion");

    const qualifierCompletionResult = await waitForCompletion(
      client,
      uri(injection),
      positionInside(injection.text, '"greetingPrefix"', 5),
      (items) => items.length > 0,
      "@Qualifier completion",
    );
    const qualifierCompletion = qualifierCompletionResult.items;
    evidence.checks.springIndexCompletion = pass("@Qualifier completion", {
      count: qualifierCompletion.length,
    });

    const requestMappingResult = await waitForCompletion(
      client,
      uri(controller),
      positionAfter(
        controller.text,
        "public class GreetingController {",
      ),
      (items) => items.some((item) =>
        /GetMapping/.test(String(item?.label ?? item?.insertText ?? ""))
      ),
      "request-mapping snippet completion",
    );
    const requestMappingTemplates = requestMappingResult.items;
    const getMappingTemplate = requestMappingTemplates.find((item) =>
      /GetMapping/.test(String(item?.label ?? item?.insertText ?? ""))
    );
    assert.ok(getMappingTemplate);
    assert.equal(getMappingTemplate.insertTextFormat, 2);
    evidence.checks.requestMappingTemplates = pass(
      "request-mapping snippet completion with snippet format",
      { count: requestMappingTemplates.length },
    );

    const derivedQueryResult = await waitForCompletion(
      client,
      uri(repositoryJava),
      positionAfter(repositoryJava.text, "findByMessageAnd"),
      (items) => items.length > 0,
      "derived-query completion",
    );
    const derivedQueryCompletion = derivedQueryResult.items;
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

    const cronCompletionResult = await waitForCompletion(
      client,
      uri(cron),
      positionInside(cron.text, "0 0 * * *", 3),
      (items) => items.length > 0,
      "cron completion",
    );
    const cronCompletion = cronCompletionResult.items;
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

    const aiDiagnostics = await waitForDiagnostics(
      client,
      uri(aiTools),
      (diagnostics) => {
        const codes = new Set(
          diagnostics.map((diagnostic) => String(diagnostic.code ?? "")),
        );
        return codes.has("SPRING_AI_TOOL_MISSING_DESCRIPTION") &&
          codes.has("SPRING_AI_TOOL_DESCRIPTION_TOO_SHORT");
      },
      "Spring AI @Tool diagnostics",
    );
    const aiCodes = new Set(
      aiDiagnostics.map((diagnostic) => String(diagnostic.code ?? "")),
    );
    assert.equal(aiCodes.has("SPRING_AI_TOOL_MISSING_DESCRIPTION"), true);
    assert.equal(aiCodes.has("SPRING_AI_TOOL_DESCRIPTION_TOO_SHORT"), true);
    assert.equal(
      aiDiagnostics.some((diagnostic) =>
        rangeContainsNeedle(
          aiTools.text,
          diagnostic.range,
          "detailedWeather",
        )
      ),
      false,
      "a sufficiently described @Tool method must remain the negative control",
    );

    const aiStructure = await client.request("workspace/executeCommand", {
      command: "sts/spring-boot/structure",
      arguments: [{ updateMetadata: true }],
    }, 90_000);
    const aiStructureText = JSON.stringify(aiStructure);
    for (const method of ["currentWeather", "forecast", "detailedWeather"]) {
      assert.equal(
        aiStructureText.includes(method),
        true,
        `Spring AI structure must index ${method}`,
      );
    }
    evidence.checks.springAi = pass(
      "Spring AI diagnostics and @Tool structure indexing",
      {
        diagnosticCodes: [...aiCodes].sort(),
        indexedMethods: ["currentWeather", "forecast", "detailedWeather"],
      },
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

    const versionDiagnostics = await waitForDiagnostics(
      client,
      uri(pom),
      (diagnostics) => diagnostics.some((diagnostic) =>
        String(diagnostic.code ?? "").includes("UPDATE_LATEST_PATCH_VERSION")
      ),
      "Spring Boot patch/version validation diagnostic",
    );
    const patchDiagnostic = versionDiagnostics.find((diagnostic) =>
      String(diagnostic.code ?? "").includes("UPDATE_LATEST_PATCH_VERSION")
    );
    assert.ok(patchDiagnostic);
    assert.match(
      String(patchDiagnostic.message ?? ""),
      /Newer patch version of Spring Boot available/i,
    );
    evidence.checks.versionSupport = pass(
      "standalone Spring version-validation diagnostic on pom.xml",
      {
        code: patchDiagnostic.code,
        message: patchDiagnostic.message,
        diagnosticCount: versionDiagnostics.length,
      },
    );

    const versionActions = await client.request(
      "textDocument/codeAction",
      {
        textDocument: { uri: uri(pom) },
        range: patchDiagnostic.range,
        context: { diagnostics: [patchDiagnostic] },
      },
      90_000,
    );
    assert.equal(Array.isArray(versionActions), true);
    const upgradeAction = versionActions.find((action) =>
      action?.command?.command === "sts/upgrade/spring-boot-patch"
    );
    assert.ok(
      upgradeAction,
      "patch version diagnostic must expose the standalone Spring Boot upgrade quick fix",
    );
    const upgradeArguments = upgradeAction.command.arguments ?? [];
    assert.equal(upgradeArguments.length >= 2, true);
    const targetVersion = String(upgradeArguments[1]);
    assert.match(targetVersion, /^3\.5\.[0-9A-Za-z.+-]+$/);

    const upgradeEditStart = client.workspaceEdits.length;
    const upgradeResult = await client.request(
      "workspace/executeCommand",
      {
        command: upgradeAction.command.command,
        arguments: upgradeArguments,
      },
      180_000,
    );
    assert.equal(
      upgradeResult,
      "success",
      "Spring Boot patch upgrade must report an applied workspace edit",
    );
    const upgradeEdits = client.workspaceEdits.slice(upgradeEditStart);
    const pomUri = uri(pom);
    const upgradeEdit = upgradeEdits.find((entry) => {
      const serialized = JSON.stringify(entry);
      return serialized.includes(pomUri) && serialized.includes(targetVersion);
    });
    assert.ok(
      upgradeEdit,
      "Spring Boot patch upgrade must edit the exact pom.xml to the advertised target version",
    );
    evidence.checks.bootUpgrade = pass(
      "sts/upgrade/spring-boot-patch produced an accepted pom.xml workspace edit",
      {
        targetVersion,
        workspaceEditCount: upgradeEdits.length,
      },
    );

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

    evidence.checks.mcpTools = await runEmbeddedMcpRegression(
      pin,
      jar,
      javaHome,
      runRoot,
    );

    const liveChecks = await runStandaloneLiveRegression(
      jar,
      javaHome,
      runRoot,
    );
    Object.assign(evidence.checks, liveChecks);

    const modulith = await runModulithRegression(
      pin,
      jar,
      javaHome,
      runRoot,
    );
    evidence.checks.modulithProjects = modulith.projects;
    evidence.checks.modulithMetadataRefresh = modulith.metadataRefresh;
    evidence.checks.modulithViolation = modulith.violation;
    evidence.checks.modulithStructure = modulith.structure;

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

async function javaRequirementDiagnosticRegression(worktree, jar) {
  const fakeJava = path.join(worktree, ".d007-java17");
  fs.writeFileSync(fakeJava, "");
  let spawnAttempted = false;
  let error = null;
  try {
    await runCoordinator(
      [
        "--worktree", worktree,
        "--java", fakeJava,
        "--spring-server", jar,
        "--spring-home", path.dirname(jar),
        "--host-os", process.platform === "darwin"
          ? "macos"
          : process.platform === "win32"
            ? "windows"
            : "linux",
        "--extension-version", "d007",
        "--automatic-live-connection", "false",
        "--mcp-server-port", "off",
      ],
      {
        environment: {},
        spawnSync: () => ({
          status: 0,
          stdout: "",
          stderr: 'openjdk version "17.0.12" 2024-07-16',
        }),
        spawn: () => {
          spawnAttempted = true;
          throw new Error("Spring child must not start under JDK 17");
        },
      },
    );
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof Error, "JDK 17 must be rejected");
  assert.match(error.message, /JDK 21 or newer is required by Spring Tools/);
  assert.equal(
    spawnAttempted,
    false,
    "Spring child must not start before the Java floor is satisfied",
  );
  return pass("coordinator rejects JDK 17 before Spring child launch", {
    message: error.message,
  });
}

async function conversionWorkspaceEdit(
  client,
  command,
  sourceFile,
  targetFile,
  expectedFragments,
) {
  const start = client.workspaceEdits.length;
  const sourceUri = pathToFileURL(sourceFile).href;
  const targetUri = pathToFileURL(targetFile).href;
  await client.request(
    "workspace/executeCommand",
    {
      command,
      arguments: [sourceUri, targetUri, false],
    },
    90_000,
  );
  const edits = client.workspaceEdits.slice(start);
  const matching = edits.find((entry) => {
    const text = JSON.stringify(entry);
    return text.includes(targetUri);
  });
  assert.ok(matching, `${command} must request a workspace edit for the exact target`);
  const serialized = JSON.stringify(matching);
  for (const fragment of expectedFragments) {
    assert.equal(
      serialized.includes(fragment),
      true,
      `${command} workspace edit must contain ${fragment}`,
    );
  }
  return pass(command + " produced an accepted workspace edit", {
    workspaceEditCount: edits.length,
    target: path.basename(targetFile),
  });
}

function runGeneratedBuildTaskRegression(worktree, javaHome) {
  const springWrites = [];
  const coordinator = new Coordinator({
    sendSpring: (bytes) => springWrites.push(bytes),
    sendZed: () => {},
    javaTransport: { supportsSpringClientMethod: () => false },
    worktree,
    reportContext: { hostOs: process.platform === "darwin" ? "macos" : process.platform },
  });
  const buildFile = path.join(worktree, "pom.xml");
  const handled = coordinator.observeZedMessage({
    jsonrpc: "2.0",
    id: "d007-build-task",
    method: "workspace/executeCommand",
    params: {
      command: "sts.maven.goal",
      arguments: [buildFile, "compile"],
    },
  });
  assert.equal(handled, false);
  assert.deepEqual(
    springWrites,
    [],
    "reviewable Maven build task must not be forwarded to Spring Runtime.exec",
  );

  const tasksFile = path.join(worktree, ".zed", "tasks.json");
  assert.equal(fs.existsSync(tasksFile), true);
  const tasks = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
  const task = tasks.find((entry) =>
    typeof entry?.label === "string" &&
    entry.label.startsWith("Spring Boot (zed-spring-tools) build:") &&
    Array.isArray(entry.args) &&
    entry.args.includes("compile")
  );
  assert.ok(task, "generated Maven build task must exist");
  assert.equal(task.cwd, "$ZED_WORKTREE_ROOT");
  assert.equal(task.command, "mvn");
  assert.deepEqual(task.args, ["compile"]);

  const result = spawnSync(task.command, task.args, {
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
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `generated Maven build task failed: ${String(result.stderr ?? "").slice(-8000)}`,
    );
  }
  return pass("generated reviewable sts.maven.goal task executed successfully", {
    command: task.command,
    args: task.args,
  });
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

async function runEmbeddedMcpRegression(
  pin,
  jar,
  javaHome,
  runRoot,
) {
  const worktree = path.join(runRoot, "mcp-fixture");
  fs.cpSync(FIXTURE, worktree, { recursive: true });
  compileFixture(worktree, javaHome);

  const java = path.join(
    javaHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  const child = spawn(java, springArguments(jar, worktree, 0), {
    cwd: worktree,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString("utf8")).slice(-256 * 1024);
  });
  const workspaceUri = directoryUri(worktree);
  const client = new LspClient(
    child,
    [{ uri: workspaceUri, name: "spring-boot-basic-mcp" }],
    structuredClone(DEFAULT_CONFIGURATION),
  );

  try {
    const initialize = await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "zed-spring-tools-d007-mcp", version: "1" },
      rootUri: workspaceUri,
      workspaceFolders: [{ uri: workspaceUri, name: "spring-boot-basic-mcp" }],
      capabilities: standardClientCapabilities(),
      initializationOptions: {},
    });
    assert.ok(initialize?.capabilities);
    client.notify("initialized", {});
    client.notify("workspace/didChangeConfiguration", {
      settings: structuredClone(DEFAULT_CONFIGURATION),
    });

    const javaFile = path.join(
      worktree,
      "src",
      "main",
      "java",
      "dev",
      "zed",
      "spring",
      "fixture",
      "FixtureApplication.java",
    );
    const propertiesFile = path.join(
      worktree,
      "src",
      "main",
      "resources",
      "application.properties",
    );
    for (const [file, languageId] of [
      [javaFile, "java"],
      [propertiesFile, "spring-boot-properties"],
    ]) {
      client.notify("textDocument/didOpen", {
        textDocument: {
          uri: pathToFileURL(file).href,
          languageId,
          version: 1,
          text: fs.readFileSync(file, "utf8"),
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
      "MCP Spring index",
      INDEX_TIMEOUT_MS,
    );

    let ports = [];
    await waitFor(
      () => {
        ports = listeningTcpPorts(child.pid);
        return ports.length > 0;
      },
      "embedded MCP listening port",
      60_000,
    );
    const attempts = [];
    let endpoint = null;
    let sessionId = null;
    let initialized = null;
    for (const candidate of ["/mcp", "/mcp/message", "/api/mcp", "/"]) {
      try {
        const response = await mcpHttpCall(
          ports[0],
          candidate,
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "zed-spring-tools-d007", version: "1" },
            },
          },
          null,
        );
        attempts.push({ endpoint: candidate, status: response.status });
        if (response.status === 200) {
          endpoint = candidate;
          sessionId = response.sessionId;
          initialized = parseMcpPayload(response.body);
          break;
        }
      } catch (error) {
        attempts.push({ endpoint: candidate, error: String(error).slice(0, 300) });
      }
    }
    assert.ok(endpoint, `embedded MCP initialize failed: ${JSON.stringify(attempts)}`);
    assert.ok(initialized?.result);

    await mcpHttpCall(
      ports[0],
      endpoint,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      sessionId,
    );
    const listResponse = await mcpHttpCall(
      ports[0],
      endpoint,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      sessionId,
    );
    assert.equal(listResponse.status, 200);
    const list = parseMcpPayload(listResponse.body);
    const toolList = list?.result?.tools ?? [];
    assert.equal(Array.isArray(toolList) && toolList.length > 0, true);
    const toolNames = toolList.map((tool) => tool.name);
    assert.equal(toolNames.includes("getProjectList"), true);

    const projectResponse = await mcpHttpCall(
      ports[0],
      endpoint,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "getProjectList", arguments: {} },
      },
      sessionId,
    );
    assert.equal(projectResponse.status, 200);
    const projectPayload = parseMcpPayload(projectResponse.body);
    assert.equal(projectPayload?.error === undefined, true);
    assert.equal(
      projectPayload?.result?.isError === true,
      false,
      "getProjectList must return a usable MCP tool result",
    );

    const completionResult = await waitForCompletion(
      client,
      pathToFileURL(propertiesFile).href,
      { line: 0, character: 3 },
      (items) => items.some((item) =>
        String(item?.label ?? item?.insertText ?? "").includes("server.port")
      ),
      "LSP server.port completion after MCP requests",
    );
    const completion = completionResult.items;

    await client.request("shutdown", null);
    client.notify("exit", null);
    return pass("embedded MCP and LSP coexist on the pinned standalone server", {
      port: ports[0],
      endpoint,
      toolCount: toolList.length,
      projectListCalled: true,
      lspCompletionAfterMcp: true,
    });
  } catch (error) {
    throw new Error(
      `embedded MCP regression failed: ${error instanceof Error ? error.message : String(error)}; ` +
      `stderr=${stderr.split(/\r?\n/).slice(-40).join(" | ")}`,
    );
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

function listeningTcpPorts(pid) {
  if (process.platform === "win32") {
    throw new Error("D007 embedded MCP desktop probe currently requires POSIX lsof");
  }
  const result = spawnSync(
    "lsof",
    ["-nP", "-a", "-p", String(pid), "-iTCP", "-sTCP:LISTEN"],
    { encoding: "utf8", shell: false, timeout: 5_000 },
  );
  if (result.error || result.status !== 0) return [];
  const ports = [];
  for (const line of String(result.stdout).split("\n").slice(1)) {
    const match = /:(\d+)\s+\(LISTEN\)\s*$/.exec(line);
    if (match) ports.push(Number(match[1]));
  }
  return [...new Set(ports)];
}

async function mcpHttpCall(port, endpoint, body, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return {
    status: response.status,
    sessionId: response.headers.get("mcp-session-id"),
    body: await response.text(),
  };
}

function parseMcpPayload(payload) {
  const trimmed = String(payload).trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  for (const line of trimmed.split("\n")) {
    if (line.startsWith("data:")) {
      return JSON.parse(line.slice(5).trim());
    }
  }
  throw new Error("MCP response contained no JSON-RPC payload");
}


async function runStandaloneLiveRegression(jar, javaHome, runRoot) {
  assert.notEqual(
    process.platform,
    "win32",
    "D007 standalone live regression currently requires POSIX process groups",
  );
  const worktree = path.join(runRoot, "live-fixture");
  fs.cpSync(FIXTURE, worktree, { recursive: true });

  const pomFile = path.join(worktree, "pom.xml");
  const pom = fs.readFileSync(pomFile, "utf8");
  assert.match(pom, /<\/dependencies>/);
  fs.writeFileSync(
    pomFile,
    pom.replace(
      "</dependencies>",
      [
        "        <dependency>",
        "            <groupId>org.springframework.boot</groupId>",
        "            <artifactId>spring-boot-starter-actuator</artifactId>",
        "        </dependency>",
        "    </dependencies>",
      ].join("\n"),
    ),
  );
  const propertiesFile = path.join(
    worktree,
    "src",
    "main",
    "resources",
    "application.properties",
  );
  const properties = fs.readFileSync(propertiesFile, "utf8");
  fs.writeFileSync(
    propertiesFile,
    properties.replace("server.port=8080", "server.port=0") +
      [
        "",
        "# D007 live-data runtime controls.",
        "spring.jmx.enabled=true",
        "management.endpoints.jmx.exposure.include=*",
        "management.endpoints.web.exposure.include=*",
        "management.endpoint.health.show-details=always",
        "",
      ].join("\n"),
  );
  compileFixture(worktree, javaHome);

  let appLog = "";
  const app = spawn("mvn", ["spring-boot:run"], {
    cwd: worktree,
    detached: true,
    shell: false,
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH ?? ""),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [app.stdout, app.stderr]) {
    stream.on("data", (chunk) => {
      appLog = (appLog + chunk.toString("utf8")).slice(-1024 * 1024);
    });
  }

  let coordinator = null;
  let automaticCoordinator = null;
  try {
    await waitFor(
      () =>
        /Started FixtureApplication/.test(appLog) &&
        /Tomcat started on port \d+/.test(appLog),
      "live fixture Boot application",
      180_000,
    );
    const portMatch = /Tomcat started on port (\d+)/.exec(appLog);
    assert.ok(portMatch);
    const appPort = Number(portMatch[1]);
    assert.equal(Number.isInteger(appPort) && appPort > 0, true);

    const configuration = structuredClone(DEFAULT_CONFIGURATION);
    configuration["boot-java"]["live-information"] = {
      ...(configuration["boot-java"]["live-information"] ?? {}),
      "all-local-java-processes": true,
    };

    let promptMode = "none";
    const responder = (message) => {
      const actions = message.params?.actions ?? [];
      const titles = actions.map((action) => String(action?.title ?? ""));
      let selected = null;
      if (promptMode === "connect-local") {
        selected = titles.find((title) => title.startsWith("Connect — "));
      } else if (promptMode === "refresh-local") {
        selected = titles.find((title) => title.startsWith("Refresh — "));
      } else if (promptMode === "disconnect-local") {
        selected = titles.find((title) => title.startsWith("Disconnect — "));
      } else if (promptMode === "connect-remote") {
        selected = titles.find(
          (title) => title.startsWith("Connect — ") && title.includes("d007-remote"),
        );
      } else if (promptMode === "logger") {
        if (/Select a logger/.test(String(message.params?.message ?? ""))) {
          selected = titles.find((title) => title.startsWith("ROOT — "));
        } else if (/Select a configured level/.test(String(message.params?.message ?? ""))) {
          selected = titles.find((title) => title === "DEBUG");
        } else if (/Set logger/.test(String(message.params?.message ?? ""))) {
          selected = titles.find((title) => title === "Apply DEBUG");
        }
      }
      return selected === null ? null : { title: selected };
    };

    ({ child: coordinator, client: coordinator.client } =
      await startCoordinatorRegressionClient({
        jar,
        javaHome,
        worktree,
        configuration,
        automaticLiveConnection: false,
        responder,
      }));
    const client = coordinator.client;
    const controller = liveControllerFile(worktree);
    await openLiveController(client, controller);
    await waitForSpringIndex(client, "live coordinator Spring index");

    const localDescriptor = await waitForLiveProcessDescriptor(
      client,
      (entry) =>
        entry?.action === "sts/livedata/connect" &&
        (
          entry?.projectName === "zed-spring-tools-fixture" ||
          /FixtureApplication|zed-spring-tools-fixture/.test(String(entry?.label ?? ""))
        ),
      "local Boot process descriptor",
    );
    assert.equal(typeof localDescriptor.processKey, "string");

    promptMode = "connect-local";
    const notificationStart = client.notifications.length;
    await client.request(
      "workspace/executeCommand",
      { command: "zed-spring-tools.manage-live-process", arguments: [] },
    );
    const localConnected = await waitForNotificationAfter(
      client,
      notificationStart,
      "sts/liveprocess/connected",
      (message) => message.params?.processKey === localDescriptor.processKey,
      "local live-process connected notification",
      60_000,
    );
    assert.equal(localConnected.params?.type, "local");

    const connected = await client.request(
      "workspace/executeCommand",
      { command: "sts/livedata/listConnected", arguments: [] },
      30_000,
    );
    assert.equal(
      Array.isArray(connected) &&
        connected.some((entry) => entry?.processKey === localDescriptor.processKey),
      true,
    );

    const liveLens = await waitForLiveUrlCodeLens(
      client,
      controller,
      appPort,
      60_000,
    );
    const liveUrl = liveLens.command.arguments?.[0]?.url;
    assert.equal(typeof liveUrl, "string");
    assert.match(liveUrl, new RegExp(":" + appPort + "/greeting"));

    const liveHover = await waitForLiveHover(
      client,
      controller,
      appPort,
      60_000,
    );
    assert.match(liveHover, /Process \[/);
    assert.match(liveHover, new RegExp(":" + appPort + "/greeting"));

    const liveDocument = path.join(worktree, ".zed", "spring-live.md");
    await client.request(
      "workspace/executeCommand",
      { command: "zed-spring-tools.generate-live-metrics-document", arguments: [] },
    );
    await waitFor(
      () => {
        if (!fs.existsSync(liveDocument)) return false;
        const content = fs.readFileSync(liveDocument, "utf8");
        return /Live metrics|Metrics/i.test(content) && /Loggers/i.test(content);
      },
      "generated authentic Live data document",
      90_000,
    );
    const liveDocumentText = fs.readFileSync(liveDocument, "utf8");
    assert.match(liveDocumentText, /jvm\.|memory|heap/i);
    assert.match(liveDocumentText, /ROOT/);

    promptMode = "logger";
    const loggerNotificationStart = client.notifications.length;
    await client.request(
      "workspace/executeCommand",
      { command: "zed-spring-tools.configure-live-log-level", arguments: [] },
    );
    await waitForNotificationAfter(
      client,
      loggerNotificationStart,
      "sts/liveprocess/loglevel/updated",
      () => true,
      "live logger level update",
      60_000,
    );
    const loggerState = await client.request(
      "workspace/executeCommand",
      {
        command: "sts/livedata/getLoggers",
        arguments: [
          {
            processKey: localDescriptor.processKey,
            processName: localConnected.params?.processName,
            type: "local",
            pid: localConnected.params?.pid,
          },
          { endpoint: "loggers" },
        ],
      },
      30_000,
    );
    assert.equal(
      loggerState?.loggers?.loggers?.ROOT?.configuredLevel === "DEBUG" ||
        loggerState?.loggers?.loggers?.ROOT?.effectiveLevel === "DEBUG",
      true,
      "ROOT logger must reflect the requested DEBUG level",
    );

    promptMode = "refresh-local";
    await client.request(
      "workspace/executeCommand",
      { command: "zed-spring-tools.manage-live-process", arguments: [] },
    );
    await waitForWindowMessage(
      client,
      /Refreshed live data|Requested live-data refresh/i,
      "live refresh notice",
      30_000,
    );

    promptMode = "disconnect-local";
    const disconnectStart = client.notifications.length;
    await client.request(
      "workspace/executeCommand",
      { command: "zed-spring-tools.manage-live-process", arguments: [] },
    );
    await waitForNotificationAfter(
      client,
      disconnectStart,
      "sts/liveprocess/disconnected",
      (message) => message.params?.processKey === localDescriptor.processKey,
      "local live-process disconnected notification",
      60_000,
    );

    const remoteUrl = "http://127.0.0.1:" + appPort + "/actuator";
    configuration["boot-java"]["remote-apps"] = [{
      jmxurl: remoteUrl,
      processName: "d007-remote",
      projectName: "zed-spring-tools-fixture",
      manualConnect: true,
      keepChecking: false,
    }];
    client.configuration = configuration;
    client.notify("workspace/didChangeConfiguration", { settings: configuration });
    const remoteDescriptor = await waitForLiveProcessDescriptor(
      client,
      (entry) =>
        entry?.action === "sts/livedata/connect" &&
        entry?.processKey === remoteUrl,
      "remote Boot process descriptor",
    );
    assert.match(String(remoteDescriptor.label ?? ""), /d007-remote|127\.0\.0\.1/);

    promptMode = "connect-remote";
    const remoteStart = client.notifications.length;
    await client.request(
      "workspace/executeCommand",
      { command: "zed-spring-tools.manage-live-process", arguments: [] },
    );
    const remoteConnected = await waitForNotificationAfter(
      client,
      remoteStart,
      "sts/liveprocess/connected",
      (message) => message.params?.processKey === remoteUrl,
      "remote live-process connected notification",
      60_000,
    );
    assert.equal(remoteConnected.params?.type, "remote");
    const remoteLoggers = await client.request(
      "workspace/executeCommand",
      {
        command: "sts/livedata/getLoggers",
        arguments: [
          {
            processKey: remoteUrl,
            processName: remoteConnected.params?.processName,
            type: "remote",
          },
          { endpoint: "loggers" },
        ],
      },
      30_000,
    );
    assert.equal(
      Object.keys(remoteLoggers?.loggers?.loggers ?? {}).length > 0,
      true,
      "remote HTTP Actuator connection must expose loggers",
    );

    configuration["boot-java"]["remote-apps"] = [];
    client.configuration = configuration;
    const remoteDisconnectStart = client.notifications.length;
    client.notify("workspace/didChangeConfiguration", { settings: configuration });
    await waitForNotificationAfter(
      client,
      remoteDisconnectStart,
      "sts/liveprocess/disconnected",
      (message) => message.params?.processKey === remoteUrl,
      "remote configuration disconnect notification",
      60_000,
    );

    await shutdownRegressionClient(coordinator);

    const automatic = await startCoordinatorRegressionClient({
      jar,
      javaHome,
      worktree,
      configuration,
      automaticLiveConnection: true,
      responder: () => null,
    });
    automaticCoordinator = automatic.child;
    automaticCoordinator.client = automatic.client;
    const automaticClient = automatic.client;
    await openLiveController(automaticClient, controller);
    const automaticStart = automaticClient.notifications.length;
    await waitForSpringIndex(
      automaticClient,
      "automatic live coordinator Spring index",
    );
    const automaticConnected = await waitForNotificationAfter(
      automaticClient,
      automaticStart,
      "sts/liveprocess/connected",
      (message) =>
        message.params?.type === "local" &&
        message.params?.processKey !== remoteUrl,
      "automatic local live-process connection",
      90_000,
    );
    assert.equal(automaticConnected.params?.type, "local");

    return {
      localConnect: pass("actual local Boot process connected and disconnected", {
        processKeyObserved: true,
      }),
      liveCodeLens: pass("live request-mapping CodeLens reached coordinator", {
        url: liveUrl,
      }),
      liveHover: pass("live request-mapping Hover includes process and URL"),
      openBootAppUrl: pass("live request-mapping CodeLens exposes running app URL", {
        url: liveUrl,
      }),
      metrics: pass("authentic live metrics rendered into owned Live document"),
      loggers: pass("authentic ROOT logger level changed and confirmed", {
        configuredLevel: "DEBUG",
      }),
      showHideRefresh: pass("explicit refresh and disconnect completed"),
      remoteConnect: pass("declared HTTP Actuator target connected through 5.3 manual route", {
        endpoint: remoteUrl,
      }),
      automaticConnection: pass("coordinator automatically connected one matching local Boot process"),
    };
  } catch (error) {
    throw new Error(
      "standalone live regression failed: " +
        (error instanceof Error ? error.message : String(error)) +
        "; appTail=" +
        appLog.split(/\r?\n/).slice(-80).join(" | "),
    );
  } finally {
    if (automaticCoordinator?.client) {
      await shutdownRegressionClient(automaticCoordinator).catch(() => {});
    } else if (automaticCoordinator !== null) {
      stopProcessGroup(automaticCoordinator);
    }
    if (coordinator?.client) {
      await shutdownRegressionClient(coordinator).catch(() => {});
    } else if (coordinator !== null) {
      stopProcessGroup(coordinator);
    }
    stopProcessGroup(app);
  }
}

async function startCoordinatorRegressionClient({
  jar,
  javaHome,
  worktree,
  configuration,
  automaticLiveConnection,
  responder,
}) {
  const java = path.join(
    javaHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  const coordinatorScript = path.join(ROOT, "coordinator", "src", "main.mjs");
  const args = [
    coordinatorScript,
    "--worktree", worktree,
    "--java", java,
    "--spring-server", jar,
    "--spring-home", path.dirname(jar),
    "--host-os", process.platform === "darwin" ? "macos" : "linux",
    "--extension-version", "d007-live-regression",
    "--automatic-live-connection", automaticLiveConnection ? "true" : "false",
    "--mcp-server-port", "off",
  ];
  const child = spawn(process.execPath, args, {
    cwd: worktree,
    detached: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      JAVA_HOME: javaHome,
      PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH ?? ""),
    },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString("utf8")).slice(-512 * 1024);
  });
  const workspaceUri = directoryUri(worktree);
  const client = new LspClient(
    child,
    [{ uri: workspaceUri, name: "zed-spring-tools-fixture" }],
    configuration,
    responder,
  );
  child.client = client;
  child.stderrTail = () => stderr;

  const initialize = await client.request("initialize", {
    processId: process.pid,
    clientInfo: { name: "zed-spring-tools-d007-live", version: "1" },
    rootUri: workspaceUri,
    workspaceFolders: [{ uri: workspaceUri, name: "zed-spring-tools-fixture" }],
    capabilities: standardClientCapabilities(),
    initializationOptions: {},
  }, 60_000);
  assert.ok(initialize?.capabilities);
  client.notify("initialized", {});
  client.notify("workspace/didChangeConfiguration", { settings: configuration });
  return { child, client };
}

function liveControllerFile(worktree) {
  const file = path.join(
    worktree,
    "src",
    "main",
    "java",
    "dev",
    "zed",
    "spring",
    "fixture",
    "GreetingController.java",
  );
  return {
    path: file,
    text: fs.readFileSync(file, "utf8"),
    languageId: "java",
  };
}

async function openLiveController(client, controller) {
  client.notify("textDocument/didOpen", {
    textDocument: {
      uri: pathToFileURL(controller.path).href,
      languageId: "java",
      version: 1,
      text: controller.text,
    },
  });
}

async function waitForSpringIndex(client, label) {
  await waitFor(
    () => client.notifications.some(
      (message) =>
        message.method === "spring/index/updated" &&
        Array.isArray(message.params?.affectedProjects) &&
        message.params.affectedProjects.length > 0,
    ),
    label,
    INDEX_TIMEOUT_MS,
  );
}

async function waitForLiveProcessDescriptor(client, predicate, label) {
  const deadline = Date.now() + 90_000;
  let last = [];
  while (Date.now() < deadline) {
    last = await client.request(
      "workspace/executeCommand",
      { command: "sts/livedata/listProcesses", arguments: [] },
      30_000,
    );
    if (Array.isArray(last)) {
      const found = last.find(predicate);
      if (found) return found;
    }
    await sleep(1000);
  }
  throw new Error(label + " not found; descriptors=" + JSON.stringify(last).slice(0, 3000));
}

async function waitForNotificationAfter(
  client,
  start,
  method,
  predicate,
  label,
  timeoutMs,
) {
  await waitFor(
    () => client.notifications
      .slice(start)
      .some((message) => message.method === method && predicate(message)),
    label,
    timeoutMs,
  );
  return client.notifications
    .slice(start)
    .find((message) => message.method === method && predicate(message));
}

async function waitForLiveUrlCodeLens(client, controller, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const targetUri = pathToFileURL(controller.path).href;
  while (Date.now() < deadline) {
    const result = await client.request(
      "textDocument/codeLens",
      { textDocument: { uri: targetUri } },
      30_000,
    );
    if (Array.isArray(result)) {
      const found = result.find((lens) => {
        const argument = lens?.command?.arguments?.[0];
        return lens?.command?.command === "zed-spring-tools.explain-code-lens" &&
          argument?.kind === "url" &&
          String(argument?.url ?? "").includes(":" + port + "/greeting");
      });
      if (found) return found;
    }
    await sleep(750);
  }
  throw new Error("live URL CodeLens did not appear");
}

async function waitForLiveHover(client, controller, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const targetUri = pathToFileURL(controller.path).href;
  const positions = [
    positionInside(controller.text, '"/greeting"', 3),
    positionInside(controller.text, "GetMapping", 3),
    positionInside(controller.text, "greeting()", 3),
  ];
  while (Date.now() < deadline) {
    for (const position of positions) {
      const hover = await client.request(
        "textDocument/hover",
        { textDocument: { uri: targetUri }, position },
        30_000,
      );
      const text = JSON.stringify(hover ?? {});
      if (text.includes("Process [") && text.includes(":" + port + "/greeting")) {
        return text;
      }
    }
    await sleep(750);
  }
  throw new Error("live request-mapping Hover did not include process and URL");
}

async function waitForWindowMessage(client, pattern, label, timeoutMs) {
  await waitFor(
    () => client.windowMessages.some((entry) => pattern.test(entry.message ?? "")),
    label,
    timeoutMs,
  );
}

async function shutdownRegressionClient(child) {
  if (!child?.client) return;
  try {
    await child.client.request("shutdown", null, 10_000);
    child.client.notify("exit", null);
  } catch {}
  await sleep(250);
  stopProcessGroup(child);
}

function stopProcessGroup(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function runModulithRegression(pin, jar, javaHome, runRoot) {
  const worktree = path.join(runRoot, "modulith-fixture");
  fs.cpSync(MODULITH_FIXTURE, worktree, { recursive: true });

  const compile = spawnSync(
    process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    ["classes", "--no-daemon"],
    {
      cwd: worktree,
      encoding: "utf8",
      shell: false,
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH ?? ""),
      },
    },
  );
  if (compile.error) throw compile.error;
  if (compile.status !== 0) {
    throw new Error(
      `Modulith Gradle classes failed: ${String(compile.stderr ?? "").slice(-8000)}`,
    );
  }

  const configuration = structuredClone(DEFAULT_CONFIGURATION);
  const java = path.join(
    javaHome,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  const child = spawn(java, springArguments(jar, worktree, null), {
    cwd: worktree,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString("utf8")).slice(-256 * 1024);
  });

  const workspaceUri = directoryUri(worktree);
  const client = new LspClient(
    child,
    [{ uri: workspaceUri, name: "inventory-app-gradle" }],
    configuration,
  );

  try {
    const initialize = await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "zed-spring-tools-d007-modulith", version: "1" },
      rootUri: workspaceUri,
      workspaceFolders: [{ uri: workspaceUri, name: "inventory-app-gradle" }],
      capabilities: standardClientCapabilities(),
      initializationOptions: {},
    });
    assert.ok(initialize?.capabilities);
    client.notify("initialized", {});
    client.notify("workspace/didChangeConfiguration", { settings: configuration });

    const javaFiles = findFilesByExtension(
      path.join(worktree, "src", "main", "java"),
      ".java",
    );
    assert.equal(javaFiles.length > 0, true);
    let version = 1;
    for (const file of javaFiles) {
      client.notify("textDocument/didOpen", {
        textDocument: {
          uri: pathToFileURL(file).href,
          languageId: "java",
          version: version++,
          text: fs.readFileSync(file, "utf8"),
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
      "Modulith standalone Spring index",
      INDEX_TIMEOUT_MS,
    );

    for (const file of javaFiles) {
      client.notify("textDocument/didChange", {
        textDocument: { uri: pathToFileURL(file).href, version: version++ },
        contentChanges: [{ text: fs.readFileSync(file, "utf8") }],
      });
    }

    const projects = await client.request("workspace/executeCommand", {
      command: "sts/modulith/projects",
      arguments: [],
    }, 90_000);
    assert.equal(projects !== null && typeof projects === "object", true);
    const projectEntries = Object.entries(projects);
    assert.equal(projectEntries.length > 0, true);
    const selected = projectEntries.find(([name]) => /inventory-app-gradle/.test(name))
      ?? projectEntries[0];
    assert.equal(typeof selected[1], "string");

    const refresh = await client.request("workspace/executeCommand", {
      command: "sts/modulith/metadata/refresh",
      arguments: [selected[1]],
    }, 120_000);

    const violation = await waitForAnyDiagnostic(
      client,
      (diagnostic) =>
        String(diagnostic.code ?? "").includes("MODULITH_TYPE_REF_VIOLATION") ||
        /Invalid reference to non-exposed type/i.test(String(diagnostic.message ?? "")),
      "Modulith type-reference violation",
      INDEX_TIMEOUT_MS,
    );

    const structure = await client.request("workspace/executeCommand", {
      command: "sts/spring-boot/structure",
      arguments: [{ updateMetadata: true }],
    }, 90_000);
    const structureText = JSON.stringify(structure);
    assert.match(structureText, /catalog/i);
    assert.match(structureText, /internal|API/i);

    const windowErrors = client.windowMessages.filter((message) => message.type === 1);
    assert.deepEqual(
      windowErrors,
      [],
      `Modulith standalone regression emitted an error popup; stderr=${stderr.slice(-4000)}`,
    );

    await client.request("shutdown", null);
    client.notify("exit", null);

    return {
      projects: pass("sts/modulith/projects", {
        count: projectEntries.length,
        selectedProject: selected[0],
      }),
      metadataRefresh: pass("sts/modulith/metadata/refresh completed", {
        resultWasNull: refresh === null,
      }),
      violation: pass("MODULITH_TYPE_REF_VIOLATION", {
        code: violation.code ?? null,
      }),
      structure: pass("Modulith structure contains module exposure markers"),
    };
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

async function waitForAnyDiagnostic(client, predicate, label, timeoutMs) {
  let match = null;
  await waitFor(
    () => {
      for (const diagnostics of client.diagnostics.values()) {
        match = diagnostics.find(predicate) ?? null;
        if (match !== null) return true;
      }
      return false;
    },
    label,
    timeoutMs,
  );
  return match;
}

function findFilesByExtension(directory, extension) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFilesByExtension(target, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(target);
    }
  }
  return files.sort();
}

function standardClientCapabilities() {
  return {
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
  };
}

function fixtureFiles(worktree) {
  const specs = [
    ["pom.xml", "xml"],
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
    ["src/main/java/dev/zed/spring/fixture/AiTools.java", "java"],
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

function positionAtExactLineEnd(text, expectedLine) {
  const lines = text.split("\n");
  const matches = [];
  for (let line = 0; line < lines.length; line += 1) {
    if (lines[line] === expectedLine) matches.push(line);
  }
  assert.deepEqual(
    matches.length,
    1,
    `expected exactly one line equal to ${JSON.stringify(expectedLine)}, found ${matches.length}`,
  );
  return {
    line: matches[0],
    character: expectedLine.length,
  };
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

function rangeContainsNeedle(text, range, needle) {
  if (!range?.start || !range?.end) return false;
  const lines = text.split("\n");
  const startOffset = lines
    .slice(0, range.start.line)
    .reduce((sum, line) => sum + line.length + 1, 0) + range.start.character;
  const endOffset = lines
    .slice(0, range.end.line)
    .reduce((sum, line) => sum + line.length + 1, 0) + range.end.character;
  const needleIndex = text.indexOf(needle);
  return needleIndex >= startOffset && needleIndex <= endOffset;
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

async function waitForCompletion(
  client,
  targetUri,
  position,
  predicate,
  label,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let lastItems = [];
  do {
    attempts += 1;
    lastItems = completionItems(await client.request(
      "textDocument/completion",
      {
        textDocument: { uri: targetUri },
        position,
      },
    ));
    if (predicate(lastItems)) {
      return { items: lastItems, attempts };
    }
    await sleep(POLL_MS);
  } while (Date.now() < deadline);

  throw new Error(
    `${label} did not become ready after ${attempts} bounded completion requests; lastItemCount=${lastItems.length}`,
  );
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
