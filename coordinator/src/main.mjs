#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const BOOT_CONFIG_ACTION_KIND = "source";
const BOOT_CONFIG_LABEL_PREFIX = "Spring Boot (zed-spring-tools): ";
const ALL_BOOT_PROJECTS_TITLE = "All projects";
const MAX_BOOT_PROJECT_SELECTION = 8;
const COORDINATOR_COMMANDS = [COORDINATOR_CODE_LENS_COMMAND, CONFIGURE_BOOT_RUN_COMMAND];
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
    this.targetExists = targetExists;
    this.logger = logger;
    this.pending = new Map();
    this.pendingZedRequests = new Set();
    this.initializeRequests = new Set();
    this.codeLensRequests = new Map();
    this.codeActionRequests = new Map();
    this.zedRequests = new Map();
    this.documentVersions = new Map();
    this.liveCodeLenses = new Map();
    this.generatedTargets = new Map();
    this.generatedTargetResolutions = new Set();
    this.generatedResolutionTail = Promise.resolve();
    this.activeGeneratedTargetResolution = undefined;
    this.session = undefined;
    this.sequence = 0;
    this.sessionId = randomUUID();
    this.javaFailureShown = false;
    this.coordinationStartedAt = Date.now();
    this.classpathRetryScheduled = false;
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
    if (message?.method === "initialized" && message.id === undefined) {
      this.#startSpringCodeLensProviders();
      this.#startClasspathCoordination();
    }
    return true;
  }

  async handleSpringMessage(message) {
    if (this.closed) return;
    const pendingKey = responseKey(message);
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
        this.#invalidateGeneratedTargets();
        this.#refreshZedInlayHints();
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
    this.documentVersions.clear();
    this.liveCodeLenses.clear();
    this.generatedTargets.clear();
    this.generatedTargetResolutions.clear();
    this.activeGeneratedTargetResolution = undefined;
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
        if (Date.now() - this.coordinationStartedAt >= this.javaHandshakeGraceMs) {
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
      if (Date.now() - this.coordinationStartedAt >= this.javaHandshakeGraceMs) {
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
    this.coordinationStartedAt = Date.now();
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
        await retryDelay(this.classpathRetryMs, this.abortController.signal).catch(() => {});
        continue;
      }
      if (this.closed) return;
      try {
        await this.requestSpring(EXECUTE_SPRING_COMMAND, {
          command: ENABLE_CLASSPATH,
          arguments: [true],
        });
        this.#refreshZedInlayHints();
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

  #observeDocumentVersion(message) {
    const method = message?.method;
    const textDocument = message?.params?.textDocument;
    const uri = textDocument?.uri;
    if (typeof uri !== "string") return;
    if (method === "textDocument/didOpen" || method === "textDocument/didChange") {
      if (Number.isInteger(textDocument.version)) {
        if (this.documentVersions.get(uri) !== textDocument.version) {
          this.#invalidateGeneratedTargets(uri);
        }
        this.documentVersions.set(uri, textDocument.version);
      }
    } else if (method === "textDocument/didClose") {
      this.documentVersions.delete(uri);
      this.liveCodeLenses.delete(uri);
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
    if (!offersBootRunAction(request)) return message;
    const existing = Array.isArray(message.result) ? message.result : [];
    const action = {
      title: CONFIGURE_BOOT_RUN_TITLE,
      kind: BOOT_CONFIG_ACTION_KIND,
      command: {
        title: CONFIGURE_BOOT_RUN_TITLE,
        command: CONFIGURE_BOOT_RUN_COMMAND,
        arguments: [{ uri: request.uri }],
      },
    };
    return { ...message, result: [...existing, action] };
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
    for (const project of projects) {
      const directory = resolveProjectDirectory(project.uri, worktree);
      const cwd = worktreeRelativeCwd(directory, worktree);
      const runTask = bootRunTask(project, directory, cwd, hostOs);
      if (runTask === undefined) skippedRun.push(project.name);
      else tasks.push(runTask);
      debugConfigs.push(bootDebugConfig(project, cwd));
    }
    const zedDirectory = path.join(worktree, ".zed");
    return {
      count: projects.length,
      skippedRun,
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

function offersBootRunAction(request) {
  if (!/\.java$/i.test(request?.uri ?? "")) return false;
  const only = request?.only;
  if (!Array.isArray(only) || only.length === 0) return true;
  return only.some(
    (kind) =>
      typeof kind === "string" &&
      (kind === BOOT_CONFIG_ACTION_KIND || BOOT_CONFIG_ACTION_KIND.startsWith(`${kind}.`)),
  );
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

function detectBuildRun(directory, hostOs) {
  const windows = hostOs === "windows";
  if (fileExists(path.join(directory, windows ? "mvnw.cmd" : "mvnw"))) {
    return { command: windows ? "mvnw.cmd" : "./mvnw", args: ["spring-boot:run"] };
  }
  if (fileExists(path.join(directory, "pom.xml"))) {
    return { command: "mvn", args: ["spring-boot:run"] };
  }
  if (fileExists(path.join(directory, windows ? "gradlew.bat" : "gradlew"))) {
    return { command: windows ? "gradlew.bat" : "./gradlew", args: ["bootRun"] };
  }
  if (
    fileExists(path.join(directory, "build.gradle")) ||
    fileExists(path.join(directory, "build.gradle.kts"))
  ) {
    return { command: "gradle", args: ["bootRun"] };
  }
  return undefined;
}

function bootRunTask(project, directory, cwd, hostOs) {
  const build = detectBuildRun(directory, hostOs);
  if (build === undefined) return undefined;
  return {
    label: `${BOOT_CONFIG_LABEL_PREFIX}${project.name} (run)`,
    command: build.command,
    args: build.args,
    cwd,
  };
}

function bootDebugConfig(project, cwd) {
  return {
    adapter: "Java",
    request: "launch",
    label: `${BOOT_CONFIG_LABEL_PREFIX}${project.name} (debug)`,
    mainClass: project.mainClass,
    cwd,
    stopOnEntry: false,
  };
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
