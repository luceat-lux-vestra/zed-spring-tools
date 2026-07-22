#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { BridgeSession } from "./bridge_session.mjs";
import { JavaTransport } from "./java_transport.mjs";
import { LspDecoder, encodeLsp, errorFor, isRequest, responseFor } from "./lsp.mjs";

const ADD_CLASSPATH = "sts/addClasspathListener";
const REMOVE_CLASSPATH = "sts/removeClasspathListener";
const EXECUTE_SPRING_COMMAND = "workspace/executeCommand";
const ENABLE_CLASSPATH = "sts.vscode-spring-boot.enableClasspathListening";
const ENABLE_AI_CODE_LENSES = "sts/enable/copilot/features";
const REFRESH_INLAY_HINTS = "workspace/inlayHint/refresh";
const REFRESH_CODE_LENSES = "workspace/codeLens/refresh";
const SPRING_INDEX_UPDATED = "spring/index/updated";
const SPRING_HIGHLIGHT = "sts/highlight";
const CODE_LENS_REQUEST = "textDocument/codeLens";
const COORDINATOR_CODE_LENS_COMMAND = "zed-spring-tools.explain-code-lens";
const SHOW_HOVER_COMMAND = "sts.showHoverAtPosition";
const EXPLAIN_QUERY_COMMAND = "vscode-spring-boot.query.explain";
const OPEN_URL_COMMAND = "vscode-spring-boot.open.url";
const SHOW_DOCUMENT = "window/showDocument";
const VSCODE_OPEN_COMMAND = "vscode.open";
const ZED_SHOW_LOCATIONS_COMMAND = "editor.action.goToLocations";
const GENERATED_IMPLEMENTATION_COMMAND = "sts/boot/open-data-query-method-aot-definition";
const MAVEN_GOAL_COMMAND = "sts.maven.goal";
const CODE_ACTION_REQUEST = "textDocument/codeAction";
const EXECUTABLE_BOOT_PROJECTS_COMMAND = "sts/spring-boot/executableBootProjects";
const CONFIGURE_BOOT_RUN_COMMAND = "zed-spring-tools.configure-boot-run";
const CONFIGURE_BOOT_RUN_TITLE = "Spring Boot: Configure run/debug for a project…";
const SPRING_STRUCTURE_COMMAND = "sts/spring-boot/structure";
const GENERATE_STRUCTURE_DOCUMENT_COMMAND = "zed-spring-tools.generate-structure-document";
const GENERATE_STRUCTURE_DOCUMENT_TITLE = "Spring Boot: Generate or refresh Structure document";
const STRUCTURE_DOCUMENT_RELATIVE_PATH = path.join(".zed", "spring-structure.md");
const STRUCTURE_DOCUMENT_MARKER = "<!-- zed-spring-tools:generated-structure:v1 -->";
const MAX_STRUCTURE_NODES = 2_000;
const MAX_STRUCTURE_DEPTH = 16;
const MAX_STRUCTURE_LABEL_LENGTH = 300;
const BOOT_CONFIG_ACTION_KIND = "source";
const BOOT_CONFIG_LABEL_PREFIX = "Spring Boot (zed-spring-tools): ";
// Properties/YAML conversion and shared-metadata reload. The Spring server owns
// the conversion: given [sourceUri, targetUri, replaceOriginal] it computes the
// converted document and drives a `workspace/applyEdit` that creates the target
// (and, when replaceOriginal is true, removes the source). The coordinator only
// exposes the Code Action, computes a non-colliding target path the way the VS
// Code client does, and keeps the original by default so the result stays
// reviewable. See docs/research/011 for the client-command contract.
const PROPS_TO_YAML_SPRING_COMMAND = "sts/boot/props-to-yaml";
const YAML_TO_PROPS_SPRING_COMMAND = "sts/boot/yaml-to-props";
const RELOAD_PROPERTIES_METADATA_SPRING_COMMAND = "sts/common-properties/reload";
const CONVERT_PROPERTIES_YAML_COMMAND = "zed-spring-tools.convert-properties-yaml";
const RELOAD_PROPERTIES_METADATA_COMMAND = "zed-spring-tools.reload-properties-metadata";
const CONVERT_TO_YAML_TITLE = "Spring Boot: Convert .properties to .yaml";
const CONVERT_TO_PROPS_TITLE = "Spring Boot: Convert .yaml to .properties";
const RELOAD_PROPERTIES_METADATA_TITLE = "Spring Boot: Reload shared properties metadata";
const PROPERTIES_ACTION_KIND = "source";
// VS Code's `spring.tools.properties.replace-converted-file` defaults to false,
// which keeps the original file after conversion. Match that safe default so a
// conversion never deletes source the user has not yet reviewed.
const REPLACE_CONVERTED_FILE = false;
const CONVERSION_SPECS = Object.freeze({
  "props-to-yaml": { command: PROPS_TO_YAML_SPRING_COMMAND, extension: "yml" },
  "yaml-to-props": { command: YAML_TO_PROPS_SPRING_COMMAND, extension: "properties" },
});
const ALL_BOOT_PROJECTS_TITLE = "All projects";
const MAX_BOOT_PROJECT_SELECTION = 8;
// Cap generated per-profile entries so a project with many profiles cannot flood
// the task/debug pickers. Overflow profiles are named in the confirmation notice.
const MAX_BOOT_PROFILE_ENTRIES = 8;
const COORDINATOR_COMMANDS = [
  COORDINATOR_CODE_LENS_COMMAND,
  CONFIGURE_BOOT_RUN_COMMAND,
  GENERATE_STRUCTURE_DOCUMENT_COMMAND,
  CONVERT_PROPERTIES_YAML_COMMAND,
  RELOAD_PROPERTIES_METADATA_COMMAND,
];
const REGISTER_CAPABILITY = "client/registerCapability";
const UNREGISTER_CAPABILITY = "client/unregisterCapability";
const EXECUTE_COMMAND_CAPABILITY = "workspace/executeCommand";
const CLASSPATH_CALLBACK_COMMAND = /^sts4\.classpath\.[A-Za-z]{8}$/;
const CALLBACK_ID = /^[A-Za-z0-9._-]{1,128}$/;
const REQUEST_TIMEOUT_MS = 10_000;
const JAVA_ROUTE_TIMEOUT_MS = 30_000;
// A late-starting official Java server can still be importing the project when
// the route first registers, so the first classpath handshakes time out and
// recover once the import finishes. Keep re-driving the handshake for this long
// before surfacing the hard requirement error, so a slow startup does not raise
// a misleading "requires the official Java extension" popup. Each retry cycle is
// bounded by the Java transport timeout plus the backoff below, so this leaves
// room for several attempts against a cold project import.
const JAVA_HANDSHAKE_GRACE_MS = 60_000;
const CLASSPATH_RETRY_MS = 1_000;
// Spring can answer the editor's initial inlay request before its Java index is
// ready. Pre-warm recently visible documents after indexing, then refresh Zed
// so a premature empty result cannot become the stable editor state.
const INLAY_REFRESH_DELAY_MS = 2_000;
const INLAY_PREWARM_LIMIT = 8;
// A run/debug project selection is a human interaction, so it must outlive the
// short internal request timeout. It is still bounded so a dismissed or lost
// prompt cannot leak a pending request for the session lifetime.
const ZED_REQUEST_TIMEOUT_MS = 5 * 60_000;
const SERVER_JAR = "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";
const SPRING_TOOLS_VERSION = "5.2.0.RELEASE";
const COMPATIBILITY_REPORT_URL =
  "https://github.com/luceat-lux-vestra/zed-spring-tools/issues/new";
const MAX_COMPATIBILITY_REPORT_URL_LENGTH = 2_000;
const JAVA_FAILURE_REPORTS = Object.freeze({
  "java-data-route-failed-v1": "Official Java data route failed",
  "classpath-registration-failed-v1": "Official Java classpath registration failed",
  "classpath-enable-failed-v1": "Spring classpath enablement failed",
  "official-java-capability-failed-v1": "Required official Java capability failed",
});

export class Coordinator {
  constructor({
    sendSpring,
    sendZed,
    javaTransport,
    worktree,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    javaHandshakeGraceMs = JAVA_HANDSHAKE_GRACE_MS,
    classpathRetryMs = CLASSPATH_RETRY_MS,
    inlayRefreshDelayMs = INLAY_REFRESH_DELAY_MS,
    reportContext = {},
    targetExists = fileUriExists,
    logger = () => {},
  }) {
    this.sendSpring = sendSpring;
    this.sendZed = sendZed;
    this.javaTransport = javaTransport;
    this.worktree = worktree;
    this.requestTimeoutMs = requestTimeoutMs;
    this.javaHandshakeGraceMs = javaHandshakeGraceMs;
    this.classpathRetryMs = classpathRetryMs;
    this.inlayRefreshDelayMs = inlayRefreshDelayMs;
    this.targetExists = targetExists;
    this.logger = logger;
    this.pending = new Map();
    this.pendingZedRequests = new Set();
    this.initializeRequests = new Set();
    this.codeLensRequests = new Map();
    this.codeActionRequests = new Map();
    this.inlayHintRequests = new Map();
    this.inlayHintParams = new Map();
    this.inlayHints = new Map();
    this.zedRequests = new Map();
    this.documentVersions = new Map();
    this.liveCodeLenses = new Map();
    this.generatedTargets = new Map();
    this.generatedTargetResolutions = new Set();
    this.generatedResolutionTail = Promise.resolve();
    this.activeGeneratedTargetResolution = undefined;
    // Target URIs of in-flight properties/YAML conversions. After the create,
    // Spring drives a `window/showDocument` to reveal the new file; Zed already
    // opens it from the applied create edit, so that request must be answered
    // silently rather than through the CodeLens `showDocument` fallback notice.
    this.pendingConversionTargets = new Set();
    this.session = undefined;
    this.sequence = 0;
    this.sessionId = randomUUID();
    this.javaFailureShown = false;
    this.javaNotStartedShown = false;
    this.coordinationStartedAt = Date.now();
    // Set on the first Java document Zed opens; until then the official Java
    // server is not expected to be running, so no handshake failure is real.
    this.javaDocumentSeenAt = undefined;
    this.classpathRetryScheduled = false;
    this.inlayRefreshTimer = undefined;
    this.inlayRefreshPending = false;
    this.routedJavaMethods = new Set();
    this.ownedCapabilityRegistrations = new Set();
    this.shutdownIds = new Set();
    this.abortController = new AbortController();
    this.reportContext = {
      hostOs: reportContext.hostOs ?? "unknown",
      hostArch: reportContext.hostArch ?? normalizedArchitecture(process.arch),
      jdkVersion: reportContext.jdkVersion ?? "unknown",
      extensionVersion: reportContext.extensionVersion ?? "development",
    };
    this.enableTask = undefined;
    this.codeLensEnableTask = undefined;
    this.closed = false;
  }

  observeZedMessage(message) {
    this.#observeJavaDocument(message);
    if (message?.method === "textDocument/inlayHint" && message.id !== undefined) {
      const uri = message.params?.textDocument?.uri;
      this.inlayHintRequests.set(idKey(message.id), {
        id: message.id,
        params: structuredClone(message.params),
        uri,
        version: typeof uri === "string" ? this.documentVersions.get(uri) : undefined,
      });
      if (typeof uri === "string") {
        this.inlayHintParams.delete(uri);
        this.inlayHintParams.set(uri, {
          params: structuredClone(message.params),
          uri,
          version: this.documentVersions.get(uri),
        });
        while (this.inlayHintParams.size > INLAY_PREWARM_LIMIT) {
          this.inlayHintParams.delete(this.inlayHintParams.keys().next().value);
        }
      }
    }
    if (message?.method === "$/cancelRequest") {
      const cancelledKey = idKey(message.params?.id);
      this.inlayHintRequests.delete(cancelledKey);
    }
    const pendingKey = responseKey(message);
    if (pendingKey !== null && this.zedRequests.has(pendingKey)) {
      this.#settleZedRequest(pendingKey, message);
      return false;
    }
    if (pendingKey !== null && this.pendingZedRequests.delete(pendingKey)) {
      return false;
    }
    if (isRequest(message) && message.method === "shutdown") {
      this.shutdownIds.add(idKey(message.id));
    }
    if (isRequest(message) && message.method === "initialize") {
      this.initializeRequests.add(idKey(message.id));
    }
    if (isRequest(message) && message.method === CODE_LENS_REQUEST) {
      const uri = message.params?.textDocument?.uri;
      if (typeof uri === "string") {
        this.codeLensRequests.set(idKey(message.id), {
          uri,
          version: this.documentVersions.get(uri),
        });
      }
    }
    if (isRequest(message) && message.method === CODE_ACTION_REQUEST) {
      const uri = message.params?.textDocument?.uri;
      if (typeof uri === "string") {
        this.codeActionRequests.set(idKey(message.id), {
          uri,
          only: message.params?.context?.only,
        });
      }
    }
    this.#observeDocumentVersion(message);
    this.#observeGeneratedTargetInvalidation(message);
    if (this.#handleCoordinatorCodeLensCommand(message)) return false;
    if (this.#handleConfigureBootRunCommand(message)) return false;
    if (this.#handleGenerateStructureDocumentCommand(message)) return false;
    if (this.#handleConvertPropertiesYamlCommand(message)) return false;
    if (this.#handleReloadPropertiesMetadataCommand(message)) return false;
    if (message?.method === "initialized" && message.id === undefined) {
      this.#startSpringCodeLensProviders();
      this.#startClasspathCoordination();
    }
    return true;
  }

  async handleSpringMessage(message) {
    if (this.closed) return;
    const pendingKey = responseKey(message);
    const inlayRequest = pendingKey === null ? undefined : this.inlayHintRequests.get(pendingKey);
    if (inlayRequest !== undefined) {
      this.inlayHintRequests.delete(pendingKey);
      if (Array.isArray(message.result) && message.result.length > 0) {
        this.#cacheInlayHints(inlayRequest, message.result);
      } else if (Array.isArray(message.result)) {
        const cached = this.#cachedInlayHints(inlayRequest);
        if (cached.length > 0) {
          message = { ...message, result: cached };
        }
      }
    }
    if (pendingKey !== null && this.pending.has(pendingKey)) {
      this.#settlePending(pendingKey, message);
      return;
    }

    if (pendingKey !== null && this.shutdownIds.delete(pendingKey)) {
      const normalized = Object.hasOwn(message, "result")
        ? { ...message, result: null }
        : message;
      this.sendZed(encodeLsp(normalized));
      return;
    }

    if (pendingKey !== null && this.initializeRequests.delete(pendingKey)) {
      this.sendZed(encodeLsp(addCoordinatorCommands(message)));
      return;
    }

    if (pendingKey !== null && this.codeLensRequests.has(pendingKey)) {
      const request = this.codeLensRequests.get(pendingKey);
      this.codeLensRequests.delete(pendingKey);
      this.sendZed(encodeLsp(this.#mergeCodeLenses(message, request)));
      return;
    }

    if (pendingKey !== null && this.codeActionRequests.has(pendingKey)) {
      const request = this.codeActionRequests.get(pendingKey);
      this.codeActionRequests.delete(pendingKey);
      this.sendZed(encodeLsp(this.#mergeCodeActions(message, request)));
      return;
    }

    if (!isRequest(message)) {
      if (message?.method === SPRING_HIGHLIGHT) {
        this.#cacheLiveCodeLenses(message.params);
        return;
      }
      if (
        message?.method === SPRING_INDEX_UPDATED &&
        Array.isArray(message.params?.affectedProjects) &&
        message.params.affectedProjects.length > 0
      ) {
        this.inlayRefreshPending = true;
        this.#invalidateGeneratedTargets();
        this.#scheduleZedInlayHintsRefresh(this.inlayRefreshDelayMs);
      }
      this.sendZed(encodeLsp(message));
      return;
    }

    if (message.method === ADD_CLASSPATH) {
      await this.#answer(message, () => this.#addClasspath(message.params));
      return;
    }
    if (message.method === REMOVE_CLASSPATH) {
      await this.#answer(message, () => this.#removeClasspath(message.params));
      return;
    }
    if (this.#ownsClasspathCapabilityRequest(message)) {
      await this.#answer(message, () => null);
      return;
    }
    if (message.method === SHOW_DOCUMENT) {
      await this.#answer(message, () => this.#handleShowDocument(message.params));
      return;
    }
    if (this.javaTransport.supportsSpringClientMethod(message.method)) {
      await this.#answer(message, async () => {
        try {
          const result = await this.javaTransport.executeSpringClientMethod(
            message.method,
            message.params,
            { signal: this.abortController.signal },
          );
          this.#noteJavaRoute(message.method);
          return result;
        } catch (error) {
          if (!this.closed) this.#showJavaFailure("java-data-route-failed-v1");
          throw error;
        }
      });
      return;
    }

    this.sendZed(encodeLsp(message));
  }

  requestSpring(method, params) {
    const id = `zed-spring-tools:${this.sessionId}:${++this.sequence}`;
    const key = idKey(id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        this.sendSpring(
          encodeLsp({ jsonrpc: "2.0", method: "$/cancelRequest", params: { id } }),
        );
        reject(new Error("Spring Tools request timed out"));
      }, this.requestTimeoutMs);
      timer.unref?.();
      this.pending.set(key, { resolve, reject, timer });
      this.sendSpring(encodeLsp({ jsonrpc: "2.0", id, method, params }));
    });
  }

  // A run/debug selection prompt is the only request the coordinator sends to
  // Zed and awaits a response for. It reuses the Zed-namespaced id space and is
  // settled by observeZedMessage; the timeout keeps a lost prompt from leaking.
  requestZed(method, params) {
    const id = `zed-spring-tools:${this.sessionId}:zed:${++this.sequence}`;
    const key = idKey(id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.zedRequests.delete(key);
        reject(new Error("Zed request timed out"));
      }, ZED_REQUEST_TIMEOUT_MS);
      timer.unref?.();
      this.zedRequests.set(key, { resolve, reject, timer });
      this.sendZed(encodeLsp({ jsonrpc: "2.0", id, method, params }));
    });
  }

  #settleZedRequest(key, message) {
    const pending = this.zedRequests.get(key);
    this.zedRequests.delete(key);
    clearTimeout(pending.timer);
    if (Object.hasOwn(message, "result")) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error("Zed rejected a coordinator request"));
    }
  }

  beginClose() {
    if (this.closed) return;
    this.closed = true;
    this.abortController.abort();
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Spring Tools coordinator stopped"));
    }
    for (const { reject, timer } of this.zedRequests.values()) {
      clearTimeout(timer);
      reject(new Error("Spring Tools coordinator stopped"));
    }
    this.pending.clear();
    this.zedRequests.clear();
    this.pendingZedRequests.clear();
    this.initializeRequests.clear();
    this.codeLensRequests.clear();
    this.codeActionRequests.clear();
    this.inlayHintRequests.clear();
    this.inlayHintParams.clear();
    this.inlayHints.clear();
    this.documentVersions.clear();
    this.liveCodeLenses.clear();
    this.generatedTargets.clear();
    this.generatedTargetResolutions.clear();
    this.activeGeneratedTargetResolution = undefined;
    if (this.inlayRefreshTimer !== undefined) {
      clearTimeout(this.inlayRefreshTimer);
      this.inlayRefreshTimer = undefined;
    }
  }

  async close() {
    this.beginClose();
    const session = this.session;
    this.session = undefined;
    if (session !== undefined) await session.close();
    await this.enableTask;
    await this.codeLensEnableTask;
    await this.generatedResolutionTail;
    this.shutdownIds.clear();
  }

  #startSpringCodeLensProviders() {
    if (this.codeLensEnableTask !== undefined || this.closed) return;
    this.codeLensEnableTask = this.#enableSpringCodeLensProviders();
  }

  async #enableSpringCodeLensProviders() {
    try {
      await this.requestSpring(EXECUTE_SPRING_COMMAND, {
        command: ENABLE_AI_CODE_LENSES,
        arguments: [true],
      });
      if (this.closed) return;
      this.#refreshZedCodeLenses();
      this.logger("Spring AI-assisted CodeLens providers enabled");
    } catch (error) {
      if (this.closed || error?.name === "AbortError") return;
      this.logger("Spring AI-assisted CodeLens providers could not be enabled");
    }
  }

  async #addClasspath(params) {
    if (
      !hasExactKeys(params, ["batched", "callbackCommandId"]) ||
      params.batched !== true ||
      !CALLBACK_ID.test(params.callbackCommandId ?? "") ||
      this.session !== undefined
    ) {
      throw new Error("Spring classpath listener registration is invalid");
    }
    const session = new BridgeSession({
      transport: this.javaTransport,
      worktree: this.worktree,
      callbackId: params.callbackCommandId,
      signal: this.abortController.signal,
      sendClasspathToSpring: async (arguments_) =>
        await this.requestSpring(EXECUTE_SPRING_COMMAND, {
          command: params.callbackCommandId,
          arguments: structuredClone(arguments_),
        }),
    });
    try {
      await session.open();
      this.session = session;
      this.classpathRetryScheduled = false;
      this.logger("official Java classpath bridge registered");
      return "ok";
    } catch (error) {
      await session.close().catch(() => {});
      // A late-starting official Java server is still importing the project, so
      // registering the classpath listener times out and Spring gives up. Spring
      // does not retry on its own, so re-drive the enable handshake until the
      // server is ready; only surface the requirement error once that keeps
      // failing past the grace window.
      if (!this.closed) {
        if (this.#javaHandshakeGraceElapsed()) {
          this.#showJavaFailure("classpath-registration-failed-v1");
        } else {
          this.#scheduleClasspathRetry();
        }
      }
      throw error;
    }
  }

  #scheduleClasspathRetry() {
    if (this.classpathRetryScheduled || this.closed) return;
    this.classpathRetryScheduled = true;
    void (async () => {
      await retryDelay(this.classpathRetryMs, this.abortController.signal).catch(() => {});
      this.classpathRetryScheduled = false;
      if (this.closed || this.session !== undefined) return;
      if (this.#javaHandshakeGraceElapsed()) {
        this.#showJavaFailure("classpath-registration-failed-v1");
        return;
      }
      this.logger("official Java classpath handshake not ready yet; re-enabling");
      try {
        await this.requestSpring(EXECUTE_SPRING_COMMAND, {
          command: ENABLE_CLASSPATH,
          arguments: [true],
        });
      } catch (error) {
        if (this.closed || error?.name === "AbortError") return;
      }
      // Keep re-driving until the bridge registers or the grace window elapses,
      // even if Spring does not re-issue the registration request on its own.
      if (!this.closed && this.session === undefined) this.#scheduleClasspathRetry();
    })();
  }

  async #removeClasspath(params) {
    const callbackId = removalCallbackId(params);
    if (callbackId === undefined || this.session?.callbackId !== callbackId) {
      throw new Error("Spring classpath listener removal is invalid");
    }
    const session = this.session;
    await session.close();
    this.session = undefined;
    this.logger("official Java classpath bridge removed");
    return "ok";
  }

  #startClasspathCoordination() {
    if (this.enableTask !== undefined || this.closed) return;
    this.enableTask = this.#enableClasspathWhenJavaReady();
  }

  async #enableClasspathWhenJavaReady() {
    this.logger("waiting for the official Java language server route");
    while (!this.closed) {
      try {
        await this.javaTransport.waitUntilReady({ signal: this.abortController.signal });
      } catch (error) {
        if (this.closed || error?.name === "AbortError") return;
        this.logger("official Java route is not ready; continuing to wait");
        this.#showJavaNotStarted();
        await retryDelay(this.classpathRetryMs, this.abortController.signal).catch(() => {});
        continue;
      }
      if (this.closed) return;
      try {
        await this.requestSpring(EXECUTE_SPRING_COMMAND, {
          command: ENABLE_CLASSPATH,
          arguments: [true],
        });
        this.logger("Spring classpath coordination enabled");
        return;
      } catch (error) {
        if (this.closed || error?.name === "AbortError") return;
        this.#showJavaFailure("classpath-enable-failed-v1");
        await retryDelay(this.classpathRetryMs, this.abortController.signal).catch(() => {});
      }
    }
  }

  #refreshZedInlayHints() {
    const id = `zed-spring-tools:${this.sessionId}:zed:${++this.sequence}`;
    this.pendingZedRequests.add(idKey(id));
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        id,
        method: REFRESH_INLAY_HINTS,
        params: null,
      }),
    );
  }

  #scheduleZedInlayHintsRefresh(delayMs) {
    if (this.closed) return;
    if (this.inlayRefreshTimer !== undefined) clearTimeout(this.inlayRefreshTimer);
    this.inlayRefreshTimer = setTimeout(() => {
      this.inlayRefreshTimer = undefined;
      if (this.closed) return;
      if (this.inlayRefreshPending) void this.#warmAndRefreshZedInlayHints();
    }, delayMs);
    this.inlayRefreshTimer.unref?.();
  }

  async #warmAndRefreshZedInlayHints() {
    const visible = [...this.inlayHintParams.values()].filter(
      (request) => this.documentVersions.get(request.uri) === request.version,
    );
    await Promise.all(
      visible.map(async (request) => {
        try {
          const result = await this.requestSpring("textDocument/inlayHint", request.params);
          if (Array.isArray(result) && result.length > 0) {
            this.#cacheInlayHints(request, result);
          } else if (Array.isArray(result)) {
            // The pre-warm fires after a completed index update, so an empty
            // result here is authoritative: the hint is genuinely gone. Drop any
            // stale carry-over so a removed hint stops masking the empty.
            this.#dropStaleInlayHints(request);
          }
        } catch {
          // Refresh still lets Zed retry if one pre-warm request fails.
        }
      }),
    );
    if (this.closed) return;
    this.inlayRefreshPending = false;
    this.#refreshZedInlayHints();
  }

  #cacheInlayHints(request, hints) {
    if (typeof request.uri !== "string") return;
    const currentVersion = this.documentVersions.get(request.uri);
    const version = request.version ?? currentVersion;
    if (version !== currentVersion) return;
    const previous = this.inlayHints.get(request.uri);
    // A stale carry-over from a prior version is fully replaced by the first
    // fresh non-empty response; only accumulate across ranges of the same,
    // authoritative version.
    const retained = previous !== undefined && previous.version === version && !previous.stale
      ? previous.hints.filter((hint) => !positionInRange(hint?.position, request.params?.range))
      : [];
    this.inlayHints.set(request.uri, { version, hints: [...retained, ...hints] });
  }

  #cachedInlayHints(request) {
    if (typeof request.uri !== "string") return [];
    const cached = this.inlayHints.get(request.uri);
    if (cached === undefined || cached.version !== request.version) return [];
    return cached.hints.filter((hint) => positionInRange(hint?.position, request.params?.range));
  }

  #dropStaleInlayHints(request) {
    if (typeof request.uri !== "string") return;
    const cached = this.inlayHints.get(request.uri);
    if (cached?.stale && cached.version === request.version) {
      this.inlayHints.delete(request.uri);
    }
  }

  #carryInlayHintsForward(uri, version) {
    const previous = this.inlayHints.get(uri);
    if (previous === undefined || previous.hints.length === 0) {
      this.inlayHints.delete(uri);
      return;
    }
    // Retain the last non-empty hints under the new version, marked stale, so a
    // transient empty response during re-indexing keeps masking (no blink)
    // until the first authoritative Spring response replaces or clears them.
    this.inlayHints.set(uri, { version, hints: previous.hints, stale: true });
  }

  #refreshZedCodeLenses() {
    const id = `zed-spring-tools:${this.sessionId}:zed:${++this.sequence}`;
    this.pendingZedRequests.add(idKey(id));
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        id,
        method: REFRESH_CODE_LENSES,
        params: null,
      }),
    );
  }

  // Zed starts the official Java server lazily, on the first Java file, and
  // nothing this extension can do starts it: the extension API has no call for
  // starting another extension's language server, and `languages.<Lang>.
  // language_servers` only chooses among servers already declared for that
  // language — adding `jdtls` to Properties was driven-refuted on 2026-07-20.
  // So the two situations get different messages instead of one failure claim:
  // no Java file open yet is normal and needs an instruction, while a Java file
  // open with no route is a real compatibility failure.
  #observeJavaDocument(message) {
    if (this.javaDocumentSeenAt !== undefined) return;
    if (message?.method !== "textDocument/didOpen") return;
    const textDocument = message.params?.textDocument;
    if (textDocument?.languageId !== "java" && !/\.java$/i.test(textDocument?.uri ?? "")) {
      return;
    }
    this.javaDocumentSeenAt = Date.now();
    this.logger("a Java document was opened; the official Java route is now expected");
  }

  #javaHandshakeGraceElapsed() {
    if (this.javaDocumentSeenAt === undefined) return false;
    return Date.now() - this.javaDocumentSeenAt >= this.javaHandshakeGraceMs;
  }

  // Said once, when the classpath is genuinely absent rather than broken. The
  // user is not left guessing why validation is thin, and the only action that
  // actually works is the one named.
  #showJavaNotStarted() {
    if (this.javaNotStartedShown || this.javaFailureShown || this.closed) return;
    if (this.javaDocumentSeenAt !== undefined) return;
    if (Date.now() - this.coordinationStartedAt < this.javaHandshakeGraceMs) return;
    this.javaNotStartedShown = true;
    this.#showInfo(
      "Spring Boot: the official Java extension has not started, because this project has no Java file open. Until it does, property validation and completion only see syntax — key metadata comes from the project classpath. Open any .java file in this project to start it.",
    );
  }

  #observeDocumentVersion(message) {
    const method = message?.method;
    const textDocument = message?.params?.textDocument;
    const uri = textDocument?.uri;
    if (typeof uri !== "string") return;
    if (method === "textDocument/didOpen" || method === "textDocument/didChange") {
      if (Number.isInteger(textDocument.version)) {
        if (this.documentVersions.get(uri) !== textDocument.version) {
          this.#invalidateGeneratedTargets(uri);
          this.#carryInlayHintsForward(uri, textDocument.version);
        }
        this.documentVersions.set(uri, textDocument.version);
      }
    } else if (method === "textDocument/didClose") {
      this.documentVersions.delete(uri);
      this.liveCodeLenses.delete(uri);
      this.inlayHintParams.delete(uri);
      this.inlayHints.delete(uri);
      this.#invalidateGeneratedTargets(uri);
    }
  }

  #observeGeneratedTargetInvalidation(message) {
    if (
      message?.method === EXECUTE_SPRING_COMMAND &&
      message.params?.command === MAVEN_GOAL_COMMAND
    ) {
      this.#invalidateGeneratedTargets();
      return;
    }
    if (
      message?.method === "workspace/didChangeWatchedFiles" &&
      Array.isArray(message.params?.changes) &&
      message.params.changes.some((change) =>
        typeof change?.uri === "string" && /\/target(?:\/|%2F)/i.test(change.uri)
      )
    ) {
      this.#invalidateGeneratedTargets();
    }
  }

  #invalidateGeneratedTargets(sourceUri) {
    let changed = false;
    for (const [key, cached] of this.generatedTargets) {
      if (sourceUri === undefined || cached.sourceUri === sourceUri) {
        this.generatedTargets.delete(key);
        changed = true;
      }
    }
    if (changed && !this.closed) this.#refreshZedCodeLenses();
  }

  #cacheLiveCodeLenses(params) {
    const uri = params?.doc?.uri;
    const version = params?.doc?.version;
    if (typeof uri !== "string" || !Number.isInteger(version) || !Array.isArray(params.codeLenses)) {
      this.logger("ignored invalid sts/highlight payload");
      return;
    }
    const codeLenses = params.codeLenses.map((lens) => normalizeLiveCodeLens(lens));
    this.liveCodeLenses.set(uri, { version, codeLenses });
    this.#refreshZedCodeLenses();
  }

  #mergeCodeLenses(message, request) {
    if (!Object.hasOwn(message, "result")) return message;
    const standard = Array.isArray(message.result)
      ? message.result.map((lens) => this.#normalizeCodeLens(lens, request))
      : [];
    const live = this.liveCodeLenses.get(request.uri);
    const liveForVersion = live !== undefined && live.version === request.version
      ? live.codeLenses
      : [];
    return { ...message, result: [...standard, ...liveForVersion] };
  }

  #normalizeCodeLens(lens, request) {
    const candidate = generatedTargetCandidate(lens, request);
    if (candidate === undefined) return normalizeCodeLens(lens);
    const cached = this.generatedTargets.get(candidate.key);
    if (cached !== undefined && this.targetExists(cached.target.uri)) {
      return generatedTargetCodeLens(lens, request.uri, cached.target);
    }
    if (cached !== undefined) this.generatedTargets.delete(candidate.key);
    this.#scheduleGeneratedTargetResolution(candidate);
    return coordinatorCodeLens(lens, "generated-target");
  }

  #scheduleGeneratedTargetResolution(candidate) {
    if (this.closed || this.generatedTargetResolutions.has(candidate.key)) return;
    this.generatedTargetResolutions.add(candidate.key);
    this.generatedResolutionTail = this.generatedResolutionTail
      .catch(() => {})
      .then(() => this.#resolveGeneratedTarget(candidate))
      .catch(() => {
        if (!this.closed) this.logger("Spring generated target could not be pre-resolved");
      })
      .finally(() => this.generatedTargetResolutions.delete(candidate.key));
  }

  async #resolveGeneratedTarget(candidate) {
    if (this.closed || this.documentVersions.get(candidate.sourceUri) !== candidate.version) return;
    const active = { key: candidate.key, target: undefined };
    this.activeGeneratedTargetResolution = active;
    try {
      await this.requestSpring(EXECUTE_SPRING_COMMAND, {
        command: GENERATED_IMPLEMENTATION_COMMAND,
        arguments: structuredClone(candidate.arguments),
      });
    } finally {
      if (this.activeGeneratedTargetResolution === active) {
        this.activeGeneratedTargetResolution = undefined;
      }
    }
    if (this.closed || this.documentVersions.get(candidate.sourceUri) !== candidate.version) return;
    const previous = this.generatedTargets.get(candidate.key);
    if (active.target === undefined) {
      if (previous !== undefined) {
        this.generatedTargets.delete(candidate.key);
        this.#refreshZedCodeLenses();
      }
      return;
    }
    this.generatedTargets.set(candidate.key, {
      sourceUri: candidate.sourceUri,
      version: candidate.version,
      target: active.target,
    });
    if (previous === undefined || !sameLocation(previous.target, active.target)) {
      this.#refreshZedCodeLenses();
    }
  }

  #handleCoordinatorCodeLensCommand(message) {
    if (
      !isRequest(message) ||
      message.method !== EXECUTE_SPRING_COMMAND ||
      message.params?.command !== COORDINATOR_CODE_LENS_COMMAND
    ) {
      return false;
    }
    const kind = message.params?.arguments?.[0]?.kind;
    let explanation;
    if (kind === "hover") {
      explanation =
        "This live Spring lens selected the relevant source position, but stock Zed cannot open Hover from an LSP command. Run `editor: hover` (macOS: cmd-k cmd-i; Linux/Windows: ctrl-k ctrl-i). Please follow or report the Zed bridge limitation at https://github.com/zed-industries/zed/issues/20042.";
    } else if (kind === "ai") {
      explanation =
        "Spring Tools generated this lens locally, but its action exists only as a VS Code Copilot prompt; the Spring server has no non-AI explanation command. Current public Zed APIs do not let this extension detect whether Zed Agent is available or open/prefill Agent. To use AI, make a separate user-initiated Agent request; otherwise analyze the expression manually. This extension does not send the prompt or source to any AI service.";
    } else if (kind === "ai-edit") {
      explanation =
        "Spring Tools generated this lens locally, but the source conversion is delegated entirely to a VS Code AI prompt; the Spring server has no deterministic refactoring command for it. Current public Zed APIs do not let this extension detect whether Zed Agent is available or open/prefill Agent, so Zed Spring Tools leaves the source unchanged. To use AI, make a separate user-initiated Agent request. This extension does not send the prompt or source to any AI service.";
    } else if (kind === "generated-target") {
      explanation =
        "Spring Tools is resolving the authentic AOT-generated implementation in the background. This CodeLens refreshes to one-click navigation when the target is ready. If it remains unavailable, regenerate AOT metadata and wait for Spring indexing to finish.";
    } else if (kind === "url") {
      const url = message.params?.arguments?.[0]?.url;
      const target = typeof url === "string" ? ` Open ${url} in your browser.` : "";
      explanation =
        `This Spring lens uses a VS Code-only command to open its URL, which stock Zed cannot execute from CodeLens.${target} Please follow or report the Zed client-command bridge limitation at https://github.com/zed-industries/zed/issues/20042.`;
    } else {
      explanation =
        "This Spring CodeLens is informational. Its title is the available value; use native Hover, Project Symbols, or navigation for related details.";
    }
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        method: "window/showMessage",
        params: { type: 3, message: explanation },
      }),
    );
    this.sendZed(encodeLsp(responseFor(message, null)));
    return true;
  }

  #mergeCodeActions(message, request) {
    if (!Object.hasOwn(message, "result")) return message;
    const normalized = Array.isArray(message.result)
      ? {
          ...message,
          result: message.result.filter((candidate) => isValidCodeActionOrCommand(candidate)),
        }
      : message;
    const synthetic = syntheticCodeActions(request);
    if (synthetic.length === 0) return normalized;
    const existing = Array.isArray(normalized.result) ? normalized.result : [];
    return { ...normalized, result: [...existing, ...synthetic] };
  }

  #handleConfigureBootRunCommand(message) {
    if (
      !isRequest(message) ||
      message.method !== EXECUTE_SPRING_COMMAND ||
      message.params?.command !== CONFIGURE_BOOT_RUN_COMMAND
    ) {
      return false;
    }
    // Answer Zed's command immediately; the discovery, selection, and file
    // generation run asynchronously and report their own outcome. Blocking the
    // command response on a human selection prompt would stall Zed's UI.
    this.sendZed(encodeLsp(responseFor(message, null)));
    void this.#configureBootRun().catch((error) => {
      if (this.closed) return;
      this.logger(
        `Spring Boot run configuration failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      this.#showInfo(
        "Spring Boot run/debug configuration could not be prepared. Make sure the official Java extension has finished importing the project, then run the action again.",
      );
    });
    return true;
  }

  #handleGenerateStructureDocumentCommand(message) {
    if (
      !isRequest(message) ||
      message.method !== EXECUTE_SPRING_COMMAND ||
      message.params?.command !== GENERATE_STRUCTURE_DOCUMENT_COMMAND
    ) {
      return false;
    }
    // Structure collection may rebuild Spring's stereotype metadata. Answer the
    // editor command immediately and report the generated snapshot separately.
    this.sendZed(encodeLsp(responseFor(message, null)));
    void this.#generateStructureDocument().catch((error) => {
      if (this.closed) return;
      this.logger(`Spring Structure document failed: ${errorText(error)}`);
      this.#showInfo(`Spring Boot: The Structure document could not be generated. ${errorText(error)}`);
    });
    return true;
  }

  async #generateStructureDocument() {
    const target = path.join(this.worktree, STRUCTURE_DOCUMENT_RELATIVE_PATH);
    const ownership = structureDocumentOwnership(target);
    if (ownership === "foreign") {
      this.#showInfo(
        `Spring Boot: ${STRUCTURE_DOCUMENT_RELATIVE_PATH} already exists and is not owned by Zed Spring Tools, so it was left unchanged. Rename or remove that file before generating the Structure document.`,
      );
      return;
    }
    const result = await this.requestSpring(EXECUTE_SPRING_COMMAND, {
      command: SPRING_STRUCTURE_COMMAND,
      // Match the pinned VS Code client's explicit refresh contract. Omitting
      // affectedProjects and groups asks Spring for every project and its
      // default visible groups.
      arguments: [{ updateMetadata: true }],
    });
    if (!Array.isArray(result)) {
      throw new Error("Spring Tools returned an invalid logical-structure result.");
    }
    // Spring may rebuild metadata before answering. Recheck after that await so
    // a file created or edited while the request was in flight is never treated
    // as the previously observed target.
    const currentOwnership = structureDocumentOwnership(target);
    if (currentOwnership === "foreign") {
      this.#showInfo(
        `Spring Boot: ${STRUCTURE_DOCUMENT_RELATIVE_PATH} changed while Spring Tools was collecting the structure and is not owned by Zed Spring Tools, so it was left unchanged.`,
      );
      return;
    }
    const rendered = renderStructureDocument(result, target, this.worktree);
    writeStructureDocument(target, rendered);
    if (this.closed) return;
    this.#showInfo(
      `Spring Boot: ${currentOwnership === "missing" ? "Generated" : "Refreshed"} ${STRUCTURE_DOCUMENT_RELATIVE_PATH} with ${rendered.renderedNodes} logical ${rendered.renderedNodes === 1 ? "node" : "nodes"}. It is a regenerable snapshot; open the file to browse its source links and rerun this action after source changes.`,
    );
  }

  #handleConvertPropertiesYamlCommand(message) {
    if (
      !isRequest(message) ||
      message.method !== EXECUTE_SPRING_COMMAND ||
      message.params?.command !== CONVERT_PROPERTIES_YAML_COMMAND
    ) {
      return false;
    }
    // Answer Zed's command immediately. The Spring server drives the file
    // creation through its own workspace/applyEdit, which round-trips to Zed on
    // its own; blocking the command response is unnecessary and would stall Zed.
    this.sendZed(encodeLsp(responseFor(message, null)));
    void this.#convertPropertiesYaml(message.params?.arguments?.[0]).catch((error) => {
      if (this.closed) return;
      this.#showInfo(
        `Spring Boot: The properties/YAML conversion could not be completed. ${errorText(error)} Make sure the file is saved and the language server has finished importing the project, then try again.`,
      );
    });
    return true;
  }

  async #convertPropertiesYaml(argument) {
    const sourceUri = typeof argument?.uri === "string" ? argument.uri : undefined;
    const spec = CONVERSION_SPECS[argument?.direction];
    const sourcePath = sourceUri === undefined ? undefined : fileUriToPath(sourceUri);
    if (spec === undefined || sourcePath === undefined) {
      this.#showInfo("Spring Boot: No convertible properties or YAML file was provided.");
      return;
    }
    const targetPath = convertedTargetPath(sourcePath, spec.extension);
    const targetUri = pathToFileURL(targetPath).href;
    // Suppress the CodeLens `showDocument` fallback notice for Spring's
    // post-conversion reveal of the freshly created file; Zed opens it from the
    // applied create edit on its own.
    this.pendingConversionTargets.add(targetUri);
    try {
      await this.requestSpring(EXECUTE_SPRING_COMMAND, {
        command: spec.command,
        arguments: [sourceUri, targetUri, REPLACE_CONVERTED_FILE],
      });
    } finally {
      this.pendingConversionTargets.delete(targetUri);
    }
    if (this.closed) return;
    this.#showInfo(
      `Spring Boot: Converted ${path.basename(sourcePath)} to ${path.basename(targetPath)}. The original file was kept so you can review the result before deleting it.`,
    );
  }

  #handleReloadPropertiesMetadataCommand(message) {
    if (
      !isRequest(message) ||
      message.method !== EXECUTE_SPRING_COMMAND ||
      message.params?.command !== RELOAD_PROPERTIES_METADATA_COMMAND
    ) {
      return false;
    }
    this.sendZed(encodeLsp(responseFor(message, null)));
    void this.#reloadPropertiesMetadata().catch((error) => {
      if (this.closed) return;
      this.#showInfo(
        `Spring Boot: Shared properties metadata could not be reloaded. ${errorText(error)}`,
      );
    });
    return true;
  }

  async #reloadPropertiesMetadata() {
    // Spring answers `false` when no shared metadata file is configured:
    // `SpringPropertiesIndexManager.reloadCommonProperties()` returns early
    // unless `boot-java.common.properties-metadata` gave it a path. Reporting
    // success in that case would claim a refresh that never happened.
    const reloaded = await this.requestSpring(EXECUTE_SPRING_COMMAND, {
      command: RELOAD_PROPERTIES_METADATA_SPRING_COMMAND,
      arguments: [],
    });
    if (this.closed) return;
    this.#showInfo(
      reloaded === true
        ? "Spring Boot: Reloaded shared properties metadata. Completion and validation now use the refreshed metadata."
        : 'Spring Boot: No shared properties metadata file is configured, so there was nothing to reload. Set "boot-java": {"common": {"properties-metadata": "<path to a metadata JSON file>"}} under lsp."spring-tools".settings in your Zed settings.',
    );
  }

  async #configureBootRun() {
    const discovered = await this.requestSpring(EXECUTE_SPRING_COMMAND, {
      command: EXECUTABLE_BOOT_PROJECTS_COMMAND,
      arguments: [],
    });
    const projects = normalizeBootProjects(discovered);
    if (projects.length === 0) {
      this.#showInfo("No executable Spring Boot projects were found in this worktree.");
      return;
    }
    const chosen = await this.#selectBootProjects(projects);
    if (chosen.length === 0) return;
    const outcome = this.#writeBootConfigurations(chosen);
    this.#showInfo(describeBootConfiguration(outcome));
  }

  async #selectBootProjects(projects) {
    if (projects.length === 1) return projects;
    const shown = projects.slice(0, MAX_BOOT_PROJECT_SELECTION);
    const actions = [
      ...shown.map((project) => ({ title: project.name })),
      { title: ALL_BOOT_PROJECTS_TITLE },
    ];
    const response = await this.requestZed("window/showMessageRequest", {
      type: 3,
      message:
        "Select a Spring Boot project to add reviewable run/debug configuration for, or choose All projects. Nothing is written until you choose.",
      actions,
    });
    const title = response?.title;
    if (typeof title !== "string") return [];
    if (title === ALL_BOOT_PROJECTS_TITLE) return projects;
    const match = projects.find((project) => project.name === title);
    return match === undefined ? [] : [match];
  }

  #writeBootConfigurations(projects) {
    const worktree = this.worktree;
    const hostOs = this.reportContext.hostOs;
    const tasks = [];
    const debugConfigs = [];
    const skippedRun = [];
    const cappedProfiles = [];
    for (const project of projects) {
      const directory = resolveProjectDirectory(project.uri, worktree);
      const cwd = worktreeRelativeCwd(directory, worktree);
      const discovered = discoverProfiles(directory);
      const profiles = discovered.slice(0, MAX_BOOT_PROFILE_ENTRIES);
      if (discovered.length > profiles.length) {
        cappedProfiles.push({
          project: project.name,
          omitted: discovered.slice(MAX_BOOT_PROFILE_ENTRIES),
        });
      }
      const runTasks = bootRunTasks(project, directory, cwd, hostOs, profiles);
      if (runTasks.length === 0) skippedRun.push(project.name);
      else tasks.push(...runTasks);
      debugConfigs.push(...bootDebugConfigs(project, cwd, profiles));
    }
    const zedDirectory = path.join(worktree, ".zed");
    return {
      count: projects.length,
      skippedRun,
      cappedProfiles,
      tasks: writeMergedConfig(path.join(zedDirectory, "tasks.json"), tasks),
      debug: writeMergedConfig(path.join(zedDirectory, "debug.json"), debugConfigs),
    };
  }

  #showInfo(message) {
    if (this.closed) return;
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        method: "window/showMessage",
        params: { type: 3, message },
      }),
    );
  }

  #handleShowDocument(params) {
    if (this.activeGeneratedTargetResolution !== undefined) {
      const target = showDocumentTarget(params);
      if (target === undefined) return { success: false };
      this.activeGeneratedTargetResolution.target = target;
      return { success: true };
    }
    // A conversion's post-create reveal: Zed already opens the created file from
    // the applied edit, so acknowledge without the CodeLens-oriented notice.
    if (typeof params?.uri === "string" && this.pendingConversionTargets.has(params.uri)) {
      return { success: true };
    }
    const uri = typeof params?.uri === "string" ? params.uri : "the generated target";
    const line = Number.isInteger(params?.selection?.start?.line)
      ? ` at line ${params.selection.start.line + 1}`
      : "";
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        method: "window/showMessage",
        params: {
          type: 3,
          message:
            `Spring Tools resolved ${uri}${line}, but stock Zed does not support the LSP window/showDocument request needed by this CodeLens. On a Spring Data repository method, run Zed's native Go to Definition to open the same generated implementation directly, or open the displayed file manually. Please follow or report the Zed limitation at https://github.com/zed-industries/zed/issues/20042.`,
        },
      }),
    );
    return { success: false };
  }

  async #answer(request, operation) {
    try {
      const result = await operation();
      if (!this.closed) this.sendSpring(encodeLsp(responseFor(request, result)));
    } catch (error) {
      if (this.closed) return;
      const message = error instanceof Error ? error.message : "coordination failed";
      this.sendSpring(encodeLsp(errorFor(request, message)));
    }
  }

  #settlePending(key, message) {
    const pending = this.pending.get(key);
    this.pending.delete(key);
    clearTimeout(pending.timer);
    if (Object.hasOwn(message, "result")) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error("Spring Tools rejected an internal callback"));
    }
  }

  #noteJavaRoute(method) {
    if (this.routedJavaMethods.has(method)) return;
    this.routedJavaMethods.add(method);
    this.logger(`official Java data request ${method} answered`);
  }

  #ownsClasspathCapabilityRequest(message) {
    // Zed 1.11.3 replaces the server's static execute-command list when this
    // internal callback is dynamically registered. The coordinator owns the
    // callback route, so keeping the registration here preserves Spring's
    // user-facing commands without changing the server or Zed.
    if (message.method === REGISTER_CAPABILITY) {
      const registrations = message.params?.registrations;
      if (!Array.isArray(registrations) || registrations.length !== 1) return false;
      const registration = registrations[0];
      if (
        typeof registration?.id !== "string" ||
        registration.method !== EXECUTE_COMMAND_CAPABILITY ||
        !Array.isArray(registration.registerOptions?.commands) ||
        registration.registerOptions.commands.length !== 1 ||
        !CLASSPATH_CALLBACK_COMMAND.test(registration.registerOptions.commands[0])
      ) {
        return false;
      }
      this.ownedCapabilityRegistrations.add(registration.id);
      return true;
    }

    if (message.method !== UNREGISTER_CAPABILITY) return false;
    const registrations = message.params?.unregisterations;
    if (!Array.isArray(registrations) || registrations.length !== 1) return false;
    const registration = registrations[0];
    if (
      typeof registration?.id !== "string" ||
      registration.method !== EXECUTE_COMMAND_CAPABILITY ||
      !this.ownedCapabilityRegistrations.delete(registration.id)
    ) {
      return false;
    }
    return true;
  }

  #showJavaFailure(failureKind = "official-java-capability-failed-v1") {
    if (this.javaFailureShown || this.closed) return;
    this.javaFailureShown = true;
    const reportUrl = compatibilityReportUrl({
      failureKind,
      ...this.reportContext,
    });
    const id = `zed-spring-tools:${this.sessionId}:zed:${++this.sequence}`;
    this.pendingZedRequests.add(idKey(id));
    this.sendZed(
      encodeLsp({
        jsonrpc: "2.0",
        id,
        method: "window/showMessageRequest",
        params: {
          type: 1,
          message:
            `Zed Spring Tools requires a working official Java extension and JDK 21 or newer. [Review a bounded compatibility report](${reportUrl}). Nothing is submitted until you review and submit the public GitHub form; use private vulnerability reporting for security issues.`,
          // Zed immediately drops a showMessageRequest with no actions. This
          // dismissal action keeps the Markdown report link visible without
          // performing any external action on the user's behalf.
          actions: [{ title: "Not now" }],
        },
      }),
    );
  }
}

function addCoordinatorCommands(message) {
  const commands = message?.result?.capabilities?.executeCommandProvider?.commands;
  if (!Array.isArray(commands)) return message;
  const missing = COORDINATOR_COMMANDS.filter((command) => !commands.includes(command));
  if (missing.length === 0) return message;
  return {
    ...message,
    result: {
      ...message.result,
      capabilities: {
        ...message.result.capabilities,
        executeCommandProvider: {
          ...message.result.capabilities.executeCommandProvider,
          commands: [...commands, ...missing],
        },
      },
    },
  };
}

// The coordinator's synthetic Code Actions all use the `source` kind because
// they apply to the whole file regardless of cursor position or diagnostics.
// Compose them in one place so a single code-action response can offer the Java
// run/debug action and the properties/YAML actions without duplicating the
// only-filter handling.
function syntheticCodeActions(request) {
  const actions = [];
  if (offersBootRunAction(request)) {
    actions.push({
      title: CONFIGURE_BOOT_RUN_TITLE,
      kind: BOOT_CONFIG_ACTION_KIND,
      command: {
        title: CONFIGURE_BOOT_RUN_TITLE,
        command: CONFIGURE_BOOT_RUN_COMMAND,
        arguments: [{ uri: request.uri }],
      },
    });
    actions.push({
      title: GENERATE_STRUCTURE_DOCUMENT_TITLE,
      kind: BOOT_CONFIG_ACTION_KIND,
      command: {
        title: GENERATE_STRUCTURE_DOCUMENT_TITLE,
        command: GENERATE_STRUCTURE_DOCUMENT_COMMAND,
        arguments: [],
      },
    });
  }
  const conversion = propertiesConversionFor(request);
  if (conversion !== undefined) {
    actions.push({
      title: conversion.title,
      kind: PROPERTIES_ACTION_KIND,
      command: {
        title: conversion.title,
        command: CONVERT_PROPERTIES_YAML_COMMAND,
        arguments: [{ uri: request.uri, direction: conversion.direction }],
      },
    });
    actions.push({
      title: RELOAD_PROPERTIES_METADATA_TITLE,
      kind: PROPERTIES_ACTION_KIND,
      command: {
        title: RELOAD_PROPERTIES_METADATA_TITLE,
        command: RELOAD_PROPERTIES_METADATA_COMMAND,
        arguments: [],
      },
    });
  }
  return actions;
}

function offersBootRunAction(request) {
  return /\.java$/i.test(request?.uri ?? "") && onlyAllowsKind(request?.only, BOOT_CONFIG_ACTION_KIND);
}

// Offer conversion (and the reload companion) only on properties/YAML files, in
// the direction that produces the other format.
function propertiesConversionFor(request) {
  if (!onlyAllowsKind(request?.only, PROPERTIES_ACTION_KIND)) return undefined;
  const uri = request?.uri ?? "";
  if (/\.properties$/i.test(uri)) {
    return { direction: "props-to-yaml", title: CONVERT_TO_YAML_TITLE };
  }
  if (/\.ya?ml$/i.test(uri)) {
    return { direction: "yaml-to-props", title: CONVERT_TO_PROPS_TITLE };
  }
  return undefined;
}

// An absent or empty `only` means Zed asked for every action; otherwise the
// action's kind must match one of the requested kinds (or be a sub-kind of it).
function onlyAllowsKind(only, kind) {
  if (!Array.isArray(only) || only.length === 0) return true;
  return only.some(
    (requested) =>
      typeof requested === "string" && (requested === kind || kind.startsWith(`${requested}.`)),
  );
}

function errorText(error) {
  return error instanceof Error ? error.message : "The server reported an unknown error.";
}

function fileUriToPath(uri) {
  try {
    const url = new URL(uri);
    return url.protocol === "file:" ? fileURLToPath(url) : undefined;
  } catch {
    return undefined;
  }
}

function structureDocumentOwnership(target) {
  let status;
  try {
    status = fs.lstatSync(target);
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
  if (!status.isFile() || status.isSymbolicLink()) return "foreign";
  let contents;
  try {
    contents = fs.readFileSync(target, "utf8");
  } catch (error) {
    throw error;
  }
  return contents.startsWith(`${STRUCTURE_DOCUMENT_MARKER}\n`) ? "owned" : "foreign";
}

function writeStructureDocument(target, rendered) {
  const directory = path.dirname(target);
  try {
    const status = fs.lstatSync(directory);
    if (!status.isDirectory() || status.isSymbolicLink()) {
      throw new Error(`${STRUCTURE_DOCUMENT_RELATIVE_PATH} requires an ordinary .zed directory.`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    fs.mkdirSync(directory, { recursive: true });
  }
  const flags = fs.constants.O_WRONLY
    | fs.constants.O_CREAT
    | fs.constants.O_TRUNC
    | (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(target, flags, 0o644);
  try {
    fs.writeFileSync(descriptor, rendered.contents, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function renderStructureDocument(roots, target, worktree) {
  const state = { renderedNodes: 0, truncated: false };
  const lines = [
    STRUCTURE_DOCUMENT_MARKER,
    "# Spring Structure",
    "",
    "> Regenerable snapshot from Spring Tools. Rerun **Spring Boot: Generate or refresh Structure document** after source changes. This file is safe to delete and is not a live view.",
    "",
  ];
  for (const root of roots) renderStructureNode(root, 0, lines, state, target, worktree);
  if (state.renderedNodes === 0) {
    lines.push("_Spring Tools returned no logical structure for this worktree._", "");
  }
  if (state.truncated) {
    lines.push(
      `> Output was limited to ${MAX_STRUCTURE_NODES} nodes and ${MAX_STRUCTURE_DEPTH} levels. Use Project Symbols to reach omitted elements.`,
      "",
    );
  }
  return { contents: `${lines.join("\n").trimEnd()}\n`, renderedNodes: state.renderedNodes };
}

function renderStructureNode(node, depth, lines, state, target, worktree) {
  if (
    state.renderedNodes >= MAX_STRUCTURE_NODES ||
    depth >= MAX_STRUCTURE_DEPTH
  ) {
    state.truncated = true;
    return;
  }
  if (node === null || typeof node !== "object" || Array.isArray(node)) return;
  const label = structureLabel(node.attributes?.text);
  if (label === undefined) return;
  state.renderedNodes += 1;
  const location = safeStructureLocation(node.attributes?.location, target, worktree)
    ?? safeStructureLocation(node.attributes?.reference, target, worktree);
  const renderedLabel = location === undefined
    ? escapeMarkdownLabel(label)
    : `[${escapeMarkdownLabel(label)}](${location})`;
  lines.push(`${"  ".repeat(depth)}- ${renderedLabel}`);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) {
    renderStructureNode(child, depth + 1, lines, state, target, worktree);
  }
}

function structureLabel(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (normalized.length === 0) return undefined;
  return normalized.slice(0, MAX_STRUCTURE_LABEL_LENGTH);
}

function escapeMarkdownLabel(value) {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function safeStructureLocation(location, target, worktree) {
  const absolute = fileUriToPath(location?.uri);
  if (absolute === undefined) return undefined;
  const root = path.resolve(worktree);
  const resolved = path.resolve(absolute);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return undefined;
  const relative = path.relative(path.dirname(target), resolved);
  const encoded = relative
    .split(path.sep)
    .map((part) => part === ".." || part === "." ? part : encodeURIComponent(part))
    .join("/");
  const line = Number.isInteger(location?.range?.start?.line) && location.range.start.line >= 0
    ? `#L${location.range.start.line + 1}`
    : "";
  return `${encoded}${line}`;
}

// Mirror the VS Code client's target naming: same directory and base name with
// the converted extension, adding a numeric suffix when that file already
// exists so a conversion never silently overwrites an unrelated file.
function convertedTargetPath(sourcePath, extension) {
  const directory = path.dirname(sourcePath);
  const base = path.basename(sourcePath, path.extname(sourcePath));
  let candidate = path.join(directory, `${base}.${extension}`);
  for (let index = 1; index < Number.MAX_SAFE_INTEGER && fs.existsSync(candidate); index += 1) {
    candidate = path.join(directory, `${base}${index}.${extension}`);
  }
  return candidate;
}

function isValidCodeActionOrCommand(candidate) {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    typeof candidate.title === "string" &&
    candidate.title.length > 0
  );
}

function positionInRange(position, range) {
  if (range === undefined) return true;
  if (
    !Number.isInteger(position?.line) ||
    !Number.isInteger(position?.character) ||
    !Number.isInteger(range?.start?.line) ||
    !Number.isInteger(range?.start?.character) ||
    !Number.isInteger(range?.end?.line) ||
    !Number.isInteger(range?.end?.character)
  ) {
    return false;
  }
  return comparePositions(position, range.start) >= 0 && comparePositions(position, range.end) <= 0;
}

function comparePositions(left, right) {
  return left.line === right.line ? left.character - right.character : left.line - right.line;
}

// The executableBootProjects command returns Spring's own project records. Keep
// only the fields the run/debug generation needs, and require the ones without
// which no safe configuration can be written.
function normalizeBootProjects(discovered) {
  if (!Array.isArray(discovered)) return [];
  const seen = new Set();
  const projects = [];
  for (const item of discovered) {
    if (item === null || typeof item !== "object") continue;
    const name =
      typeof item.name === "string" && item.name.length > 0
        ? item.name
        : typeof item.projectName === "string" && item.projectName.length > 0
          ? item.projectName
          : undefined;
    const mainClass =
      typeof item.mainClass === "string" && item.mainClass.length > 0 ? item.mainClass : undefined;
    if (name === undefined || mainClass === undefined || seen.has(name)) continue;
    seen.add(name);
    const uri = typeof item.uri === "string" && item.uri.length > 0 ? item.uri : undefined;
    projects.push({ name, mainClass, uri });
  }
  return projects;
}

// Only ever return a directory at or beneath the worktree, so a generated cwd
// cannot point a task outside the project the user is working in.
function resolveProjectDirectory(uri, worktree) {
  const root = path.resolve(worktree);
  if (typeof uri === "string") {
    try {
      const resolved = path.resolve(fileURLToPath(uri));
      if ((resolved === root || resolved.startsWith(root + path.sep)) && isDirectory(resolved)) {
        return resolved;
      }
    } catch {
      // Fall through to the worktree root below.
    }
  }
  return root;
}

// Emit a worktree-relative cwd so the generated config is portable across
// machines instead of embedding an absolute host path.
function worktreeRelativeCwd(directory, worktree) {
  const relative = path.relative(path.resolve(worktree), directory);
  if (relative === "" || relative === ".") return "$ZED_WORKTREE_ROOT";
  return `$ZED_WORKTREE_ROOT/${relative.split(path.sep).join("/")}`;
}

function detectBuildTool(directory, hostOs) {
  const windows = hostOs === "windows";
  if (fileExists(path.join(directory, windows ? "mvnw.cmd" : "mvnw"))) {
    return { command: windows ? "mvnw.cmd" : "./mvnw", tool: "maven" };
  }
  if (fileExists(path.join(directory, "pom.xml"))) {
    return { command: "mvn", tool: "maven" };
  }
  if (fileExists(path.join(directory, windows ? "gradlew.bat" : "gradlew"))) {
    return { command: windows ? "gradlew.bat" : "./gradlew", tool: "gradle" };
  }
  if (
    fileExists(path.join(directory, "build.gradle")) ||
    fileExists(path.join(directory, "build.gradle.kts"))
  ) {
    return { command: "gradle", tool: "gradle" };
  }
  return undefined;
}

// Maven's Boot plugin takes profiles as a plugin property; Gradle's bootRun takes
// them as forwarded program arguments. Both stay reviewable in the task entry.
function runArgumentsFor(tool, profile) {
  const goal = tool === "maven" ? "spring-boot:run" : "bootRun";
  if (profile === undefined) return [goal];
  if (tool === "maven") return [goal, `-Dspring-boot.run.profiles=${profile}`];
  return [goal, `--args=--spring.profiles.active=${profile}`];
}

// One base entry plus one per discovered profile, so Zed's task picker becomes the
// profile selector. `env` is an empty editable slot for anything project-specific.
function bootRunTasks(project, directory, cwd, hostOs, profiles) {
  const build = detectBuildTool(directory, hostOs);
  if (build === undefined) return [];
  const entry = (profile) => ({
    label: `${BOOT_CONFIG_LABEL_PREFIX}${project.name} (run${profile === undefined ? "" : `: ${profile}`})`,
    command: build.command,
    args: runArgumentsFor(build.tool, profile),
    cwd,
    env: {},
  });
  return [entry(undefined), ...profiles.map((profile) => entry(profile))];
}

// `vmArgs`, `args`, and `env` are editable slots the official Java debug adapter
// honors; the per-profile entries pre-fill `vmArgs` with the active profile.
function bootDebugConfigs(project, cwd, profiles) {
  const entry = (profile) => ({
    adapter: "Java",
    request: "launch",
    label: `${BOOT_CONFIG_LABEL_PREFIX}${project.name} (debug${profile === undefined ? "" : `: ${profile}`})`,
    mainClass: project.mainClass,
    cwd,
    vmArgs: profile === undefined ? "" : `-Dspring.profiles.active=${profile}`,
    args: [],
    env: {},
    stopOnEntry: false,
  });
  return [entry(undefined), ...profiles.map((profile) => entry(profile))];
}

// Spring's default external-config locations, relative to the project directory.
const PROFILE_CONFIG_SUBDIRS = ["src/main/resources", "src/main/resources/config", "config", "."];
const PROFILE_FILENAME = /^application-(.+)\.(?:properties|ya?ml)$/i;
const APPLICATION_YAML = /^application\.ya?ml$/i;
const PROFILE_NAME = /^[A-Za-z0-9_.-]+$/;
const MODERN_PROFILE_PATH = "spring.config.activate.on-profile";
const LEGACY_PROFILE_PATH = "spring.profiles";
const YAML_KEY_VALUE = /^(\s*)([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;
const YAML_LIST_ITEM = /^(\s*)-\s*(\S.*)$/;

// Discover Spring profiles from both profile-specific filenames
// (`application-<profile>.yml`) and multi-document `application.yml` activation.
function discoverProfiles(directory) {
  const profiles = new Set();
  for (const subdir of PROFILE_CONFIG_SUBDIRS) {
    const resolved = path.resolve(directory, subdir);
    let entries;
    try {
      entries = fs.readdirSync(resolved, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const named = PROFILE_FILENAME.exec(entry.name);
      if (named !== null) {
        addProfileName(profiles, named[1]);
        continue;
      }
      if (APPLICATION_YAML.test(entry.name)) {
        let text;
        try {
          text = fs.readFileSync(path.join(resolved, entry.name), "utf8");
        } catch {
          continue;
        }
        for (const name of profilesFromYaml(text)) addProfileName(profiles, name);
      }
    }
  }
  return [...profiles].sort();
}

function profilesFromYaml(text) {
  const names = [];
  const path = [];
  let profileList;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*#.*$/, "").replace(/\s+#.*$/, "");
    if (line.trim().length === 0) continue;
    if (/^\s*(?:---|\.\.\.)\s*$/.test(line)) {
      path.length = 0;
      profileList = undefined;
      continue;
    }

    const listItem = YAML_LIST_ITEM.exec(line);
    if (listItem !== null) {
      const indent = listItem[1].length;
      if (profileList !== undefined && indent > profileList.indent) {
        names.push(...tokenizeProfileExpression(listItem[2]));
      }
      continue;
    }

    const property = YAML_KEY_VALUE.exec(line);
    if (property === null) continue;
    const indent = property[1].length;
    const key = property[2];
    const value = property[3].trim();
    while (path.length > 0 && path.at(-1).indent >= indent) path.pop();
    if (profileList !== undefined && indent <= profileList.indent) profileList = undefined;

    const dotted = [...path.map((part) => part.key), key].join(".");
    if (dotted === MODERN_PROFILE_PATH || dotted === LEGACY_PROFILE_PATH) {
      if (value.length === 0) profileList = { indent };
      else names.push(...tokenizeProfileExpression(value));
    }
    if (value.length === 0) path.push({ indent, key });
  }
  return names;
}

// A profile activation can be a scalar, a quoted value, a flow list, or a boolean
// expression (`prod & cloud`); pull the identifier tokens out of any of those.
function tokenizeProfileExpression(value) {
  return value
    .split(/[\s,&|!()"'[\]]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && PROFILE_NAME.test(token));
}

function addProfileName(set, name) {
  const trimmed = name.trim();
  if (PROFILE_NAME.test(trimmed)) set.add(trimmed);
}

function isOwnedConfigEntry(entry) {
  return (
    entry !== null &&
    typeof entry === "object" &&
    typeof entry.label === "string" &&
    entry.label.startsWith(BOOT_CONFIG_LABEL_PREFIX)
  );
}

// Merge safety: create when absent, replace only our own previously generated
// entries when the file is plain JSON, and never rewrite a file we cannot parse
// without loss (comments or non-array) — write a sidecar for manual merge then.
function writeMergedConfig(absolutePath, ours) {
  if (ours.length === 0) return { status: "empty", path: absolutePath, added: 0 };
  let existingText;
  try {
    existingText = fs.readFileSync(absolutePath, "utf8");
  } catch {
    existingText = undefined;
  }
  if (existingText === undefined || existingText.trim().length === 0) {
    return finalizeConfig(absolutePath, ours, "created", 0, ours.length);
  }
  if (hasCommentsOutsideStrings(existingText)) {
    return writeBootConfigSidecar(absolutePath, ours, "the existing file contains comments");
  }
  let parsed;
  try {
    parsed = parseTolerantJsonArray(existingText);
  } catch {
    parsed = undefined;
  }
  if (!Array.isArray(parsed)) {
    return writeBootConfigSidecar(absolutePath, ours, "the existing file is not a plain JSON array");
  }
  const preserved = parsed.filter((entry) => !isOwnedConfigEntry(entry));
  return finalizeConfig(absolutePath, [...preserved, ...ours], "merged", preserved.length, ours.length);
}

function finalizeConfig(absolutePath, entries, status, preserved, added) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, serializeConfigArray(entries));
  return { status, path: absolutePath, preserved, added };
}

function writeBootConfigSidecar(absolutePath, ours, reason) {
  const directory = path.dirname(absolutePath);
  const sidecar = path.join(directory, `${path.basename(absolutePath, ".json")}.zed-spring-tools.json`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(sidecar, serializeConfigArray(ours));
  return { status: "sidecar", path: sidecar, target: absolutePath, reason, added: ours.length };
}

function serializeConfigArray(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

function hasCommentsOutsideStrings(text) {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
      return true;
    }
  }
  return false;
}

// Zed writes JSON with trailing commas; tolerate only those (comments are
// rejected earlier) so a machine-authored file still merges without loss.
function parseTolerantJsonArray(text) {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === ",") {
      let next = i + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      if (text[next] === "]" || text[next] === "}") continue;
    }
    result += character;
  }
  return JSON.parse(result);
}

function describeBootConfiguration(outcome) {
  const parts = [
    describeConfigResult("Run tasks", outcome.tasks, ".zed/tasks.json"),
    describeConfigResult("Debug configurations", outcome.debug, ".zed/debug.json"),
  ];
  if (outcome.skippedRun.length > 0) {
    parts.push(
      `No Maven or Gradle build was detected for ${outcome.skippedRun.join(", ")}, so only a debug launch was written for ${outcome.skippedRun.length === 1 ? "it" : "them"}.`,
    );
  }
  for (const capped of outcome.cappedProfiles ?? []) {
    parts.push(
      `${capped.project} has more than ${MAX_BOOT_PROFILE_ENTRIES} profiles; entries were limited to the first ${MAX_BOOT_PROFILE_ENTRIES}, omitting ${capped.omitted.join(", ")} — add those by editing the files.`,
    );
  }
  parts.push(
    "Review the generated entries, then use Zed's task picker to run or the debug panel to launch; nothing runs automatically.",
  );
  return `Spring Boot: ${parts.join(" ")}`;
}

function describeConfigResult(label, result, file) {
  if (result.status === "empty") return `${label}: none generated.`;
  if (result.status === "sidecar") {
    const written = result.added === 1 ? "entry was" : "entries were";
    return `${label}: ${file} already exists and ${result.reason}, so ${result.added} reviewable ${written} written to ${path.join(".zed", path.basename(result.path))} to merge manually.`;
  }
  const verb = result.status === "created" ? "wrote" : "merged";
  const kept = result.preserved > 0 ? ` (kept ${result.preserved} existing)` : "";
  return `${label}: ${verb} ${result.added} ${result.added === 1 ? "entry" : "entries"} in ${file}${kept}.`;
}

function isDirectory(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function normalizeCodeLens(lens) {
  if (lens === null || typeof lens !== "object" || Array.isArray(lens)) return lens;
  const command = lens.command;
  if (command === null || typeof command !== "object" || Array.isArray(command)) return lens;
  const title = typeof command.title === "string" && command.title.length > 0
    ? command.title
    : typeof lens.data === "string" && lens.data.length > 0
      ? lens.data
      : "Spring information";

  if (command.command === VSCODE_OPEN_COMMAND) {
    const target = vscodeOpenTarget(command.arguments);
    if (target !== undefined) {
      return {
        ...lens,
        command: {
          title,
          command: ZED_SHOW_LOCATIONS_COMMAND,
          arguments: [target.uri, lens.range?.start ?? target.range.start, [target]],
        },
      };
    }
  }

  let kind;
  if (command.command === SHOW_HOVER_COMMAND) kind = "hover";
  else if (command.command === EXPLAIN_QUERY_COMMAND) {
    kind = /^Convert to Router Builder Pattern/i.test(title) ? "ai-edit" : "ai";
  }
  else if (command.command === OPEN_URL_COMMAND) kind = "url";
  else if (typeof command.command !== "string" || command.command.length === 0) kind = "info";
  else if (command.command.startsWith("vscode.") || command.command.startsWith("vscode-")) {
    kind = "client";
  }
  if (kind === undefined) return lens;

  return {
    ...lens,
    command: {
      title,
      command: COORDINATOR_CODE_LENS_COMMAND,
      arguments: [{
        kind,
        originalCommand: command.command ?? null,
        ...(kind === "url" && typeof command.arguments?.[0] === "string"
          ? { url: command.arguments[0] }
          : {}),
      }],
    },
  };
}

function generatedTargetCandidate(lens, request) {
  if (
    lens === null ||
    typeof lens !== "object" ||
    Array.isArray(lens) ||
    lens.command?.command !== GENERATED_IMPLEMENTATION_COMMAND ||
    !isRange(lens.range) ||
    !Array.isArray(lens.command.arguments) ||
    lens.command.arguments.length !== 1
  ) {
    return undefined;
  }
  const params = lens.command.arguments[0];
  if (
    params === null ||
    typeof params !== "object" ||
    Array.isArray(params) ||
    params.docId?.uri !== request.uri ||
    !boundedString(params.repoFqName, 512) ||
    !boundedString(params.queryMethodName, 256) ||
    !Array.isArray(params.paramTypes) ||
    params.paramTypes.length > 128 ||
    !params.paramTypes.every((value) => boundedString(value, 512)) ||
    !(params.originSelection === null || params.originSelection === undefined ||
      isRange(params.originSelection))
  ) {
    return undefined;
  }
  const arguments_ = structuredClone(lens.command.arguments);
  const key = JSON.stringify([request.uri, request.version ?? null, arguments_]);
  if (key.length > 16_384) return undefined;
  return {
    key,
    sourceUri: request.uri,
    version: request.version,
    arguments: arguments_,
  };
}

function generatedTargetCodeLens(lens, sourceUri, target) {
  const title = typeof lens.command?.title === "string" && lens.command.title.length > 0
    ? lens.command.title
    : "Go To Implementation";
  return {
    ...lens,
    command: {
      title,
      command: ZED_SHOW_LOCATIONS_COMMAND,
      arguments: [sourceUri, lens.range?.start ?? target.range.start, [target]],
    },
  };
}

function coordinatorCodeLens(lens, kind) {
  const title = typeof lens.command?.title === "string" && lens.command.title.length > 0
    ? lens.command.title
    : "Spring information";
  return {
    ...lens,
    command: {
      title,
      command: COORDINATOR_CODE_LENS_COMMAND,
      arguments: [{ kind, originalCommand: lens.command?.command ?? null }],
    },
  };
}

function showDocumentTarget(params) {
  if (
    typeof params?.uri !== "string" ||
    params.uri.length > 4_096 ||
    !params.uri.startsWith("file:") ||
    !isRange(params.selection)
  ) {
    return undefined;
  }
  return { uri: params.uri, range: structuredClone(params.selection) };
}

function fileUriExists(uri) {
  try {
    const url = new URL(uri);
    return url.protocol === "file:" && fs.statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function sameLocation(left, right) {
  return left.uri === right.uri && JSON.stringify(left.range) === JSON.stringify(right.range);
}

function normalizeLiveCodeLens(lens) {
  if (
    lens !== null &&
    typeof lens === "object" &&
    !Array.isArray(lens) &&
    (lens.command === undefined || lens.command === null)
  ) {
    return {
      ...lens,
      command: {
        title: "Spring live data — use Hover",
        command: COORDINATOR_CODE_LENS_COMMAND,
        arguments: [{ kind: "hover", originalCommand: null }],
      },
    };
  }
  return normalizeCodeLens(lens);
}

function vscodeOpenTarget(arguments_) {
  if (!Array.isArray(arguments_) || typeof arguments_[0] !== "string") return undefined;
  const selection = arguments_[1]?.selection;
  if (!isPosition(selection?.start) || !isPosition(selection?.end)) return undefined;
  return { uri: arguments_[0], range: { start: selection.start, end: selection.end } };
}

function isPosition(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Number.isInteger(value.line) &&
    value.line >= 0 &&
    Number.isInteger(value.character) &&
    value.character >= 0
  );
}

function isRange(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isPosition(value.start) &&
    isPosition(value.end)
  );
}

function boundedString(value, maximumLength) {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength;
}

export function parseOptions(arguments_) {
  const fields = [
    ["--worktree", "worktree"],
    ["--java", "java"],
    ["--spring-server", "springServer"],
    ["--spring-home", "springHome"],
    ["--java-work-dir", "javaWorkDirectory"],
    ["--compatibility", "compatibility"],
    ["--host-os", "hostOs"],
    ["--extension-version", "extensionVersion"],
  ];
  if (arguments_.length !== fields.length * 2) {
    throw new Error("coordinator arguments do not match the product contract");
  }
  const values = {};
  for (let index = 0; index < fields.length; index += 1) {
    const [flag, name] = fields[index];
    const value = arguments_[index * 2 + 1];
    if (arguments_[index * 2] !== flag || typeof value !== "string" || value.length === 0) {
      throw new Error(`missing required coordinator argument ${flag}`);
    }
    values[name] = name === "hostOs" || name === "extensionVersion" ? value : path.resolve(value);
  }
  if (!new Set(["macos", "linux", "windows"]).has(values.hostOs)) {
    throw new Error("coordinator host OS is invalid");
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(values.extensionVersion)) {
    throw new Error("extension version is invalid");
  }
  return values;
}

export function sanitizedEnvironment(environment) {
  const allowed = [
    "PATH",
    "JAVA_HOME",
    "HOME",
    "USER",
    "USERNAME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "NO_PROXY",
    "no_proxy",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "SYSTEMROOT",
    "WINDIR",
  ];
  return Object.fromEntries(
    allowed.filter((name) => environment[name] !== undefined).map((name) => [name, environment[name]]),
  );
}

export function javaMajor(versionOutput) {
  const version = javaVersion(versionOutput);
  const match = /^([0-9]+)(?:\.([0-9]+))?/.exec(version);
  const first = Number.parseInt(match[1], 10);
  return first === 1 ? Number.parseInt(match[2] ?? "0", 10) : first;
}

export function javaVersion(versionOutput) {
  const match = versionOutput.match(/(?:java|openjdk) version "([0-9][0-9A-Za-z._+-]{0,63})"/i);
  if (match === null) throw new Error("Java version output is not recognized");
  return match[1];
}

export function compatibilityReportUrl({
  failureKind,
  hostOs,
  hostArch,
  jdkVersion,
  extensionVersion,
}) {
  const failure = JAVA_FAILURE_REPORTS[failureKind];
  if (failure === undefined) throw new Error("compatibility failure kind is not allowlisted");
  const os = reportValue(hostOs, "host OS", /^(?:macos|linux|windows|unknown)$/);
  const architecture = reportValue(
    hostArch,
    "host architecture",
    /^(?:arm64|x86_64|unknown)$/,
  );
  const jdk = reportValue(jdkVersion, "JDK version", /^(?:[0-9][0-9A-Za-z._+-]{0,63}|unknown)$/);
  const product = reportValue(
    extensionVersion,
    "extension version",
    /^(?:[0-9A-Za-z][0-9A-Za-z.+-]{0,63}|development)$/,
  );
  const url = new URL(COMPATIBILITY_REPORT_URL);
  url.searchParams.set("title", `[Compatibility] ${failureKind}`);
  url.searchParams.set(
    "body",
    [
      "## Automatically prepared compatibility data",
      "",
      `- Failure: ${failure}`,
      `- Fingerprint: \`${failureKind}\``,
      `- Spring Tools: \`${SPRING_TOOLS_VERSION}\``,
      `- JDK: \`${jdk}\``,
      `- Host: \`${displayHostOs(os)} ${architecture}\``,
      `- Zed Spring Tools: \`${product}\``,
      "- Zed: `not observable by this extension`",
      "- Official Java extension: `not observable by this extension`",
      "",
      "## What happened?",
      "",
      "<!-- Remove private project details, then describe the failure. -->",
    ].join("\n"),
  );
  if (url.href.length > MAX_COMPATIBILITY_REPORT_URL_LENGTH) {
    throw new Error("compatibility report URL exceeds its bound");
  }
  return url.href;
}

function reportValue(value, label, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`compatibility report ${label} is invalid`);
  }
  return value;
}

function normalizedArchitecture(architecture) {
  if (architecture === "arm64") return "arm64";
  if (architecture === "x64") return "x86_64";
  return "unknown";
}

function displayHostOs(hostOs) {
  if (hostOs === "macos") return "macOS";
  if (hostOs === "windows") return "Windows";
  if (hostOs === "linux") return "Linux";
  return "Unknown OS";
}

export function validateCompatibility(value) {
  const provider = value?.schemaVersion === 1 && value.providers?.length === 1
    ? value.providers[0]
    : undefined;
  if (
    provider?.id !== "zed-java" ||
    provider.targetLanguageServerId !== "jdtls" ||
    provider.workDirectoryId !== "java" ||
    provider.route?.kind !== "utf8-worktree-hex-v1" ||
    provider.route?.directory !== "proxy" ||
    provider.route?.transport !== "loopback-http-json" ||
    provider.bridge?.schemaVersion !== 1 ||
    provider.bridge?.addCommand !== "zed.spring.bridge.v1.addClasspathListener" ||
    provider.bridge?.removeCommand !== "zed.spring.bridge.v1.removeClasspathListener"
  ) {
    throw new Error("official Java compatibility contract is invalid");
  }
  return provider;
}

export async function run(arguments_, dependencies = {}) {
  const options = parseOptions(arguments_);
  requireDirectory(options.worktree, "worktree");
  requireFile(options.java, "Java executable");
  requireFile(options.springServer, "Spring Tools server");
  requireDirectory(options.springHome, "Spring Tools home");
  requireFile(options.compatibility, "Java compatibility contract");
  if (path.basename(options.springServer) !== SERVER_JAR) {
    throw new Error("Spring Tools server artifact does not match the pinned release");
  }
  validateCompatibility(JSON.parse(fs.readFileSync(options.compatibility, "utf8")));

  const environment = sanitizedEnvironment(process.env);
  const version = (dependencies.spawnSync ?? spawnSync)(options.java, ["-version"], {
    encoding: "utf8",
    env: environment,
    shell: false,
    timeout: 5000,
  });
  if (version.error !== undefined || version.status !== 0) {
    throw new Error("JDK version check failed; configure a working JDK 21 or newer");
  }
  const versionOutput = `${version.stdout ?? ""}\n${version.stderr ?? ""}`;
  const jdkVersion = javaVersion(versionOutput);
  if (javaMajor(versionOutput) < 21) {
    throw new Error("JDK 21 or newer is required by Spring Tools");
  }

  const child = (dependencies.spawn ?? spawn)(options.java, springArguments(options.springServer), {
    cwd: options.worktree,
    env: environment,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const input = dependencies.input ?? process.stdin;
  const output = dependencies.output ?? process.stdout;
  const errorOutput = dependencies.errorOutput ?? process.stderr;
  child.stderr.pipe(errorOutput);
  const coordinator = new Coordinator({
    sendSpring: (bytes) => child.stdin.write(bytes),
    sendZed: (bytes) => output.write(bytes),
    javaTransport: new JavaTransport({
      javaWorkDirectory: options.javaWorkDirectory,
      worktree: options.worktree,
      timeoutMs: JAVA_ROUTE_TIMEOUT_MS,
    }),
    worktree: options.worktree,
    reportContext: {
      hostOs: options.hostOs,
      hostArch: normalizedArchitecture(process.arch),
      jdkVersion,
      extensionVersion: options.extensionVersion,
    },
    logger: (message) => errorOutput.write(`zed-spring-tools: ${message}\n`),
  });
  const decoder = new LspDecoder();
  let handling = Promise.resolve();
  let stopping = false;

  const stop = async (killChild) => {
    if (stopping) return;
    stopping = true;
    coordinator.beginClose();
    await handling.catch(() => {});
    await coordinator.close().catch(() => {
      process.exitCode = 1;
    });
    if (killChild && child.exitCode === null) child.kill();
  };

  child.stdout.on("data", (chunk) => {
    try {
      for (const message of decoder.push(chunk)) {
        handling = handling.then(() => coordinator.handleSpringMessage(message));
      }
      handling.catch(() => child.kill());
    } catch {
      process.exitCode = 1;
      child.kill();
    }
  });
  child.stdin.on("error", () => {
    if (!stopping) {
      process.exitCode = 1;
      void stop(true);
    }
  });
  monitorZedInput(
    input,
    coordinator,
    (bytes) => child.stdin.write(bytes),
    () => void stop(true),
    () => {
      process.exitCode = 1;
      void stop(true);
    },
  );
  child.once("error", () => {
    process.exitCode = 1;
    void stop(false);
  });
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) process.exitCode = code;
    void stop(false).finally(() => input.destroy());
  });
  process.once("SIGTERM", () => void stop(true));
  process.once("SIGINT", () => void stop(true));
  return { child, coordinator, stop };
}

function springArguments(server) {
  return [
    "-Xmx1024m",
    "-Dspring.config.location=classpath:/application.properties",
    "-Djdk.util.zip.disableZip64ExtraFieldValidation=true",
    "-Dspring.main.web-application-type=NONE",
    "-Xlog:jni+resolve=off",
    "-jar",
    server,
  ];
}

function requireFile(file, label) {
  if (!path.isAbsolute(file) || !fs.statSync(file).isFile()) {
    throw new Error(`${label} is not an absolute regular file`);
  }
}

function requireDirectory(directory, label) {
  if (!path.isAbsolute(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`${label} is not an absolute directory`);
  }
}

function removalCallbackId(params) {
  if (hasExactKeys(params, ["callbackCommandId"])) return params.callbackCommandId;
  if (hasExactKeys(params, ["batched", "callbackCommandId"]) && params.batched === false) {
    return params.callbackCommandId;
  }
  return undefined;
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function responseKey(message) {
  if (
    message === null ||
    typeof message !== "object" ||
    message.method !== undefined ||
    !Object.hasOwn(message, "id")
  ) {
    return null;
  }
  return idKey(message.id);
}

export function monitorZedInput(input, coordinator, sendSpring, stop, fail = stop) {
  const decoder = new LspDecoder();
  input.on("data", (chunk) => {
    try {
      for (const message of decoder.push(chunk)) {
        if (coordinator.observeZedMessage(message) !== false) {
          sendSpring(encodeLsp(message));
        }
      }
    } catch {
      fail();
    }
  });
  input.once("end", stop);
  input.once("error", fail);
}

function retryDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("coordination stopped"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("coordination stopped"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`zed-spring-tools coordinator failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
