#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureSources = {
  maven: path.join(repository, "tests", "fixtures", "spring-boot-basic"),
  gradle: path.join(repository, "tests", "fixtures", "spring-boot-gradle"),
};
const FORBIDDEN = ["work/java", "java/proxy", "java-lsp-proxy", "zed.spring.bridge"];

const [command, ...args] = process.argv.slice(2);

if (command === "--self-test") {
  selfTest();
} else if (command === "--stage" && args.length === 3) {
  const [officialJavaProfile, freshRoot, javaHome] = args;
  process.stdout.write(JSON.stringify(stage(path.resolve(officialJavaProfile), path.resolve(freshRoot), path.resolve(javaHome)), null, 2) + "\n");
} else if (command === "--run-macos" && args.length === 3) {
  runMacos(path.resolve(args[0]), path.resolve(args[1]), path.resolve(args[2]), { manualDevInstall: false });
} else if (command === "--run-macos-manual-install" && args.length === 3) {
  runMacos(path.resolve(args[0]), path.resolve(args[1]), path.resolve(args[2]), { manualDevInstall: true });
} else if (command === "--launch-macos" && (args.length === 2 || args.length === 3)) {
  launchMacos(path.resolve(args[0]), args[1], args[2] ? path.resolve(args[2]) : undefined);
} else if (command === "--stop-macos" && args.length === 1) {
  const root = path.resolve(args[0]);
  stopAndWaitZed(root, readManifest(root), 10_000, 5_000);
} else if (command === "--install-dev-extension-macos" && args.length === 1) {
  installDevExtensionMacos(path.resolve(args[0]));
} else if (command === "--summarize" && args.length === 1) {
  process.stdout.write(JSON.stringify(summarize(path.resolve(args[0])), null, 2) + "\n");
} else {
  process.stderr.write(
    "usage:\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --stage <official-java-profile> <fresh-root> <java-home>\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --run-macos <official-java-profile> <fresh-root> <java-home>\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --run-macos-manual-install <official-java-profile> <fresh-root> <java-home>\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --launch-macos <staged-root> <maven|gradle> [zed-cli]\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --stop-macos <staged-root>\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --install-dev-extension-macos <staged-root>\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --summarize <staged-root>\n" +
      "  node scripts/d007-zed-desktop-validation.mjs --self-test\n",
  );
  process.exit(2);
}

function stage(javaProfile, root, javaHome) {
  requireDirectory(javaProfile, "official Java source profile");
  requireDirectory(javaHome, "JAVA_HOME");
  for (const source of Object.values(fixtureSources)) requireDirectory(source, "fixture");
  requireFreshRoot(root);

  const sourceHead = git(["rev-parse", "HEAD"]).trim();
  assert.match(sourceHead, /^[0-9a-f]{40}$/);
  assert.equal(git(["status", "--porcelain"]), "", "source checkout must be clean");

  const javaExtension = path.join(javaProfile, "extensions", "installed", "java");
  const javaIndex = path.join(javaProfile, "extensions", "index.json");
  requireDirectory(javaExtension, "official Java extension");
  requireFile(javaIndex, "official Java extension index");

  const javaManifest = fs.readFileSync(path.join(javaExtension, "extension.toml"), "utf8");
  assert.match(javaManifest, /^id = "java"$/m);
  const javaVersion = /^version = "([^"]+)"$/m.exec(javaManifest)?.[1];
  assert.ok(javaVersion, "official Java version must be declared");

  const profile = path.join(root, "profile");
  const worktrees = path.join(root, "worktrees");
  const evidence = path.join(root, "evidence");
  const xdgCache = path.join(root, "xdg-cache");
  const xdgData = path.join(root, "xdg-data");
  const xdgState = path.join(root, "xdg-state");

  for (const directory of [
    path.join(profile, "extensions", "installed"),
    path.join(profile, "config"),
    worktrees,
    evidence,
    xdgCache,
    xdgData,
    xdgState,
  ]) fs.mkdirSync(directory, { recursive: true });

  fs.cpSync(javaExtension, path.join(profile, "extensions", "installed", "java"), {
    recursive: true,
    dereference: false,
  });

  const index = JSON.parse(fs.readFileSync(javaIndex, "utf8"));
  assert.ok(index.extensions?.java, "official Java index entry must exist");
  index.extensions = { java: index.extensions.java };
  fs.writeFileSync(path.join(profile, "extensions", "index.json"), JSON.stringify(index, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });

  for (const [kind, source] of Object.entries(fixtureSources)) {
    fs.cpSync(source, path.join(worktrees, kind), { recursive: true, dereference: false });
  }

  for (const kind of Object.keys(fixtureSources)) {
    const probe = path.join(worktrees, kind, "src", "main", "resources", "application-d007.properties");
    fs.writeFileSync(probe, "ser", { encoding: "utf8", mode: 0o600 });
  }

  fs.writeFileSync(path.join(profile, "config", "settings.json"), JSON.stringify(settings(javaHome), null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.writeFileSync(path.join(profile, "config", "keymap.json"), JSON.stringify(d007Keymap(), null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });

  const manifest = {
    schemaVersion: 1,
    status: "staged",
    decision: "D007",
    sourceHead,
    repository,
    javaExtensionVersion: javaVersion,
    runtimeJdk: javaVersionFromHome(javaHome),
    profile,
    extensionSource: repository,
    worktrees: {
      maven: path.join(worktrees, "maven"),
      gradle: path.join(worktrees, "gradle"),
    },
    evidence,
    xdgCache,
    xdgData,
    xdgState,
    fixtureSha256: {
      maven: treeDigest(path.join(worktrees, "maven")),
      gradle: treeDigest(path.join(worktrees, "gradle")),
    },
    forbiddenPrivateBoundaryMarkers: FORBIDDEN,
  };
  fs.writeFileSync(path.join(evidence, "staged.json"), JSON.stringify(manifest, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  return manifest;
}

function d007CodeActionIndexKeys() {
  return [
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p",
  ];
}




function d007Keymap() {
  const workspaceBindings = {
    "ctrl-cmd-alt-i": "zed::InstallDevExtension",
  };
  const editorBindings = {
    "ctrl-cmd-alt-x": "editor::ToggleCodeActions",
    "ctrl-cmd-alt-z": "editor::ShowCompletions",
  };
  d007CodeActionIndexKeys().forEach((key, itemIx) => {
    editorBindings[`ctrl-cmd-alt-${key}`] = [
      "editor::ConfirmCodeAction",
      { item_ix: itemIx },
    ];
  });
  return [
    { context: "Workspace", bindings: workspaceBindings },
    { context: "Editor", bindings: editorBindings },
  ];
}

function d007ConfirmKey(itemIx) {
  const keys = d007CodeActionIndexKeys();
  assert.equal(Number.isInteger(itemIx), true, "Code Action index must be an integer");
  assert.ok(
    itemIx >= 0 && itemIx < keys.length,
    `Code Action index ${itemIx} exceeds the D007 keymap range`,
  );
  return keys[itemIx];
}



function settings(jdk) {
  return {
    disable_ai: true,
    session: { restore_unsaved_buffers: false, trust_all_worktrees: true },
    auto_install_extensions: { html: false },
    auto_update_extensions: { java: false, "spring-tools": false },
    log: { lsp: "trace", project: "warn" },
    languages: {
      Java: { language_servers: ["jdtls", "spring-tools"] },
      Properties: { language_servers: ["spring-tools"] },
      YAML: { language_servers: ["spring-tools"] },
    },
    lsp: {
      jdtls: {
        settings: {
          java_home: jdk,
          lombok_support: false,
          jdk_auto_download: false,
          check_updates: "once",
        },
      },
    },
  };
}

function runMacos(javaProfile, root, javaHome, { manualDevInstall = false } = {}) {
  assert.equal(process.platform, "darwin", "macOS desktop gate is required");
  const manifest = stage(javaProfile, root, javaHome);
  const sharedLog = path.join(os.homedir(), "Library", "Logs", "Zed", "Zed.log");
  const sharedStart = fileSize(sharedLog);

  const results = [];
  let phase = "maven-install-launch";
  let primaryError;
  try {
    launchMacos(root, "maven", { role: "install" });
    phase = "maven-install-zed-readiness";
    waitForZedReady(manifest, "maven", 45_000);

    phase = "dev-extension-install";
    if (manualDevInstall) {
      process.stdout.write(
        [
          "",
          "MANUAL STEP REQUIRED:",
          "  In the isolated Zed window, run: zed: install dev extension",
          `  Select this exact directory: ${repository}`,
          "  Do not open a different checkout.",
          "  The harness will continue automatically after Zed writes extension.wasm and registers spring-tools.",
          "",
        ].join("\n"),
      );
      fs.writeFileSync(path.join(manifest.evidence, "dev-extension-install.json"), JSON.stringify({
        attemptedAt: new Date().toISOString(),
        sourceHead: manifest.sourceHead,
        mode: "manual-zed-ui",
        repository,
        status: "awaiting-user-install",
      }, null, 2) + "\n", { mode: 0o600 });
    } else {
      installDevExtensionMacos(root);
    }

    phase = "dev-extension-readiness";
    waitForDevExtensionInstalled(manifest, manualDevInstall ? 600_000 : 180_000);
    phase = "maven-install-shutdown";
    stopAndWaitZed(root, manifest, 10_000, 5_000);

    for (const fixtureKind of ["maven", "gradle"]) {
      const propertiesRelative = "src/main/resources/application-d007.properties";
      const javaRelative = "src/main/java/dev/zed/spring/fixture/FixtureApplication.java";

      phase = `${fixtureKind}-completion-launch`;
      launchMacos(root, fixtureKind, {
        role: "completion",
        relativeTarget: propertiesRelative,
        row: 1,
        column: 4,
      });
      phase = `${fixtureKind}-completion-zed-readiness`;
      waitForZedReady(manifest, fixtureKind, 45_000);
      phase = `${fixtureKind}-completion-interaction`;
      runCompletionPhaseMacos(root, fixtureKind, sharedLog, sharedStart);
      phase = `${fixtureKind}-completion-shutdown`;
      stopAndWaitZed(root, manifest, 10_000, 5_000);

      phase = `${fixtureKind}-run-debug-launch`;
      launchMacos(root, fixtureKind, {
        role: "run-debug",
        relativeTarget: javaRelative,
      });
      phase = `${fixtureKind}-run-debug-zed-readiness`;
      waitForZedReady(manifest, fixtureKind, 45_000);
      phase = `${fixtureKind}-run-debug-interaction`;
      results.push(runDebugPhaseMacos(root, fixtureKind));
      phase = `${fixtureKind}-run-debug-shutdown`;
      stopAndWaitZed(root, manifest, 10_000, 5_000);
    }
  } catch (error) {
    primaryError = error;
    writeGateFailure(manifest, phase, error);
    throw error;
  } finally {
    let cleanupError;
    try {
      ensureZedStopped(root, manifest, 5_000, 5_000);
    } catch (error) {
      cleanupError = error;
      writeCleanupFailure(manifest, error);
      if (primaryError) {
        process.stderr.write(`D007 cleanup failure after primary ${phase} failure: ${errorText(error)}\n`);
      }
    }
    try {
      harvestSharedZedLog(manifest, sharedLog, sharedStart);
    } catch (error) {
      writeCleanupFailure(manifest, error, "shared-log-harvest");
      if (!cleanupError) cleanupError = error;
      if (primaryError) {
        process.stderr.write(`D007 log-harvest failure after primary ${phase} failure: ${errorText(error)}\n`);
      }
    }
    if (!primaryError && cleanupError) throw cleanupError;
  }

  const summary = summarize(root);
  const outcome = {
    sourceHead: manifest.sourceHead,
    fixtures: results,
    privateBoundary: summary.privateBoundary,
    completionEvidence: summary.completionEvidence,
    status: results.every((entry) => entry.debugConfig === "PASS" && entry.runTask === "PASS") &&
      summary.privateBoundary === "PASS" &&
      summary.completionEvidence === "PASS"
      ? "PASS"
      : "FAIL_OR_REVIEW_REQUIRED",
  };
  fs.writeFileSync(path.join(manifest.evidence, "desktop-gate.json"), JSON.stringify(outcome, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(JSON.stringify(outcome, null, 2) + "\n");
}

function runCompletionPhaseMacos(root, fixtureKind, sharedLog, sharedStart) {
  const manifest = readManifest(root);
  const completionBaseline = runtimeSnapshot(manifest, sharedLog, sharedStart);
  waitForSpringCompletion(
    manifest,
    sharedLog,
    sharedStart,
    fixtureKind,
    completionBaseline,
    120_000,
    3,
  );
  captureScreen(path.join(manifest.evidence, `${fixtureKind}-completion.png`));
}

function runDebugPhaseMacos(root, fixtureKind) {
  const manifest = readManifest(root);
  const probeRelative = "src/main/resources/application-d007.properties";
  const debugFile = path.join(manifest.worktrees[fixtureKind], ".zed", "debug.json");
  const tasksFile = path.join(manifest.worktrees[fixtureKind], ".zed", "tasks.json");

  triggerRunDebugMacos(manifest, fixtureKind, `${fixtureKind}-run-debug-1`);
  waitForFileWithRetry(
    debugFile,
    `${fixtureKind} generated .zed/debug.json`,
    90_000,
    null,
  );
  waitForFileWithRetry(
    tasksFile,
    `${fixtureKind} generated .zed/tasks.json`,
    30_000,
    null,
  );
  captureScreen(path.join(manifest.evidence, `${fixtureKind}-run-debug.png`));

  const generated = validateGeneratedRunDebug(fixtureKind, debugFile, tasksFile);
  const debugContent = fs.readFileSync(debugFile, "utf8");
  const tasksContent = fs.readFileSync(tasksFile, "utf8");
  const evidence = {
    fixture: fixtureKind,
    probe: probeRelative,
    completionScreenshot: `${fixtureKind}-completion.png`,
    debugConfig: generated.debugConfig,
    runTask: generated.runTask,
    expectedRunCommand: generated.expectedRunCommand,
    debugFile: path.relative(manifest.worktrees[fixtureKind], debugFile),
    tasksFile: path.relative(manifest.worktrees[fixtureKind], tasksFile),
    debugDigest: createHash("sha256").update(debugContent).digest("hex"),
    tasksDigest: createHash("sha256").update(tasksContent).digest("hex"),
  };
  fs.writeFileSync(path.join(manifest.evidence, `${fixtureKind}-result.json`), JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  return evidence;
}

function triggerRunDebugMacos(manifest, fixtureKind, evidenceName) {
  const javaRelative = "src/main/java/dev/zed/spring/fixture/FixtureApplication.java";
  const javaFile = path.join(manifest.worktrees[fixtureKind], javaRelative);
  requireFile(javaFile, `${fixtureKind} Java run/debug target`);
  const sourceDigestBefore = sha256File(javaFile);
  const protocolFile = coordinatorProtocolFile(manifest, fixtureKind);

  waitForLaunchTargetDocumentOpen(
    manifest,
    fixtureKind,
    javaRelative,
    45_000,
    `${evidenceName}-java`,
  );

  let offer;
  let codeActionAttempts = 0;
  const maxCodeActionAttempts = 3;
  while (offer === undefined && codeActionAttempts < maxCodeActionAttempts) {
    codeActionAttempts += 1;
    const protocolStart = fileSize(protocolFile);
    sendD007ActionKeyMacos(
      manifest,
      "x",
      `${evidenceName}-toggle-code-actions-${codeActionAttempts}`,
    );

    let sawResponse = false;
    const deadline = Date.now() + 7_500;
    do {
      const events = protocolEvidenceEvents(readFileDelta(protocolFile, protocolStart));
      offer = events.find(
        (event) =>
          event.event === "code-action-response" &&
          event.configureBootRunPresent === true,
      );
      if (offer !== undefined) break;
      if (events.some((event) => event.event === "code-action-response")) {
        sawResponse = true;
        break;
      }
      sleepMs(200);
    } while (Date.now() < deadline);

    if (offer === undefined) {
      cancelTransientUiMacos(
        manifest,
        `${evidenceName}-cancel-code-actions-${codeActionAttempts}`,
      );
      if (sawResponse && codeActionAttempts === maxCodeActionAttempts) break;
      sleepMs(500);
    }
  }

  if (offer === undefined) {
    throw new Error(
      `${fixtureKind} configure run/debug Code Action was not found after exact Java file targeting`,
    );
  }

  assert.equal(
    Number.isInteger(offer.configureBootRunIndex),
    true,
    "configure run/debug Code Action must have an integer item index",
  );
  d007ConfirmKey(offer.configureBootRunIndex);
  fs.writeFileSync(
    path.join(manifest.evidence, `${fixtureKind}-configure-code-action-ready.json`),
    JSON.stringify({
      sourceHead: manifest.sourceHead,
      fixture: fixtureKind,
      observedAt: new Date().toISOString(),
      itemCount: offer.itemCount,
      configureBootRunIndex: offer.configureBootRunIndex,
      codeActionAttempts,
      targetRelativePath: javaRelative,
      targeting: "fresh-foreground-cli-launch-target",
      status: "PASS",
    }, null, 2) + "\n",
    { mode: 0o600 },
  );

  const commandBaseline = fileSize(protocolFile);
  dispatchConfigureBootRunMacos(
    manifest,
    fixtureKind,
    evidenceName,
    offer,
    commandBaseline,
    10_000,
  );

  const sourceDigestAfter = sha256File(javaFile);
  if (sourceDigestAfter !== sourceDigestBefore) {
    throw new Error(
      `${fixtureKind} Java source changed during run/debug UI automation`,
    );
  }
  fs.writeFileSync(
    path.join(manifest.evidence, `${evidenceName}-source-integrity.json`),
    JSON.stringify({
      sourceHead: manifest.sourceHead,
      fixture: fixtureKind,
      relativePath: javaRelative,
      targeting: "fresh-foreground-cli-launch-target",
      sourceDigestBefore,
      sourceDigestAfter,
      status: "PASS",
    }, null, 2) + "\n",
    { mode: 0o600 },
  );
}

function dispatchConfigureBootRunMacos(
  manifest,
  fixtureKind,
  evidenceName,
  offer,
  protocolStart,
  timeoutMs,
) {
  const protocolFile = coordinatorProtocolFile(manifest, fixtureKind);
  const confirmKey = d007ConfirmKey(offer.configureBootRunIndex);
  const started = Date.now();
  let attempts = 0;
  while (Date.now() - started < timeoutMs) {
    attempts += 1;
    sendD007ActionKeyMacos(
      manifest,
      confirmKey,
      `${evidenceName}-confirm-code-action-${attempts}`,
    );
    const deadline = Math.min(started + timeoutMs, Date.now() + 750);
    do {
      const events = protocolEvidenceEvents(readFileDelta(protocolFile, protocolStart));
      if (events.some((event) => event.event === "configure-boot-run-command")) {
        fs.writeFileSync(
          path.join(manifest.evidence, `${evidenceName}-selection.json`),
          JSON.stringify({
            sourceHead: manifest.sourceHead,
            fixture: fixtureKind,
            selectedAt: new Date().toISOString(),
            selection: "d007-keymap-confirm-code-action",
            attempts,
            coordinatorItemCount: offer.itemCount,
            coordinatorConfigureBootRunIndex: offer.configureBootRunIndex,
            status: "PASS",
          }, null, 2) + "\n",
          { mode: 0o600 },
        );
        return;
      }
      sleepMs(100);
    } while (Date.now() < deadline);
  }
  throw new Error(
    `${fixtureKind} configure run/debug command was not dispatched after ${attempts} safe ConfirmCodeAction attempts`,
  );
}

function cancelTransientUiMacos(manifest, evidenceName) {
  const script = [
    'tell application "Zed" to activate',
    'tell application "System Events"',
    '  tell process "Zed" to set frontmost to true',
    '  key code 53',
    'end tell',
  ].join("\n");
  runOsa(script, evidenceName, manifest.evidence);
}

function sendD007ActionKeyMacos(manifest, key, evidenceName) {
  const script = [
    'tell application "Zed" to activate',
    'tell application "System Events"',
    '  tell process "Zed" to set frontmost to true',
    `  keystroke "${escapeAppleScript(key)}" using {control down, command down, option down}`,
    'end tell',
  ].join("\n");
  runOsa(script, evidenceName, manifest.evidence);
}

function waitForLaunchTargetDocumentOpen(
  manifest,
  fixtureKind,
  relativePath,
  timeoutMs,
  evidenceName,
) {
  const target = path.join(manifest.worktrees[fixtureKind], relativePath);
  requireFile(target, `${fixtureKind} launch target`);
  const targetUri = pathToFileURL(target).href;
  const protocolFile = coordinatorProtocolFile(manifest, fixtureKind);
  const processRecord = JSON.parse(
    fs.readFileSync(path.join(manifest.evidence, "zed-process.json"), "utf8"),
  );

  const started = Date.now();
  let opened = false;
  while (Date.now() - started < timeoutMs) {
    const events = protocolEvidenceEvents(
      fs.existsSync(protocolFile) ? fs.readFileSync(protocolFile, "utf8") : "",
    );
    opened = events.some(
      (event) => event.event === "document-open" && event.uri === targetUri,
    );
    if (opened) break;
    sleepMs(100);
  }

  const evidence = {
    sourceHead: manifest.sourceHead,
    fixture: fixtureKind,
    role: processRecord.role,
    relativePath,
    absolutePath: target,
    targetUri,
    launchTargets: processRecord.launchTargets,
    targeting: "fresh-foreground-cli-launch-target",
    exactDidOpenObserved: opened,
    status: opened ? "PASS" : "FAIL",
    protocolTail: !opened && fs.existsSync(protocolFile)
      ? fs.readFileSync(protocolFile, "utf8").slice(-16_000)
      : undefined,
  };
  fs.writeFileSync(
    path.join(manifest.evidence, `${evidenceName}-launch-target.json`),
    JSON.stringify(evidence, null, 2) + "\n",
    { mode: 0o600 },
  );

  if (!opened) {
    throw new Error(
      `${fixtureKind} fresh Zed launch did not open exact target ${relativePath}`,
    );
  }
  return { targetUri, targeting: "fresh-foreground-cli-launch-target", attempts: 1 };
}

function validateGeneratedRunDebug(fixtureKind, debugFile, tasksFile) {
  const debug = JSON.parse(fs.readFileSync(debugFile, "utf8"));
  const tasks = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
  assert.equal(Array.isArray(debug), true, ".zed/debug.json must contain an array");
  assert.equal(Array.isArray(tasks), true, ".zed/tasks.json must contain an array");

  const expectedRunCommand = fixtureKind === "maven" ? "mvn" : "./gradlew";
  const expectedRunArgs = fixtureKind === "maven" ? ["spring-boot:run"] : ["bootRun"];
  const runTask = tasks.find((entry) =>
    typeof entry?.label === "string" &&
    entry.label.startsWith("Spring Boot (zed-spring-tools): ") &&
    entry.label.endsWith(" (run)")
  );
  const debugConfig = debug.find((entry) =>
    entry?.adapter === "Java" &&
    entry?.request === "launch" &&
    entry?.mainClass === "dev.zed.spring.fixture.FixtureApplication" &&
    entry?.cwd === "$ZED_WORKTREE_ROOT"
  );

  const runTaskPass = runTask?.command === expectedRunCommand &&
    JSON.stringify(runTask?.args) === JSON.stringify(expectedRunArgs) &&
    runTask?.cwd === "$ZED_WORKTREE_ROOT";

  return {
    expectedRunCommand,
    runTask: runTaskPass ? "PASS" : "FAIL",
    debugConfig: debugConfig === undefined ? "FAIL" : "PASS",
  };
}

function waitForZedReady(manifest, fixtureKind, timeoutMs) {
  const processFile = path.join(manifest.evidence, "zed-process.json");
  const record = JSON.parse(fs.readFileSync(processFile, "utf8"));
  assert.equal(record.fixture, fixtureKind, "Zed process record must match the fixture being gated");
  assert.equal(record.userDataDir, manifest.profile, "Zed process record must bind the isolated profile");
  let observed;
  waitUntil(
    () => {
      observed = isolatedZedProcess(record);
      return observed !== undefined;
    },
    `${fixtureKind} isolated Zed app process`,
    timeoutMs,
  );
  fs.writeFileSync(path.join(manifest.evidence, `zed-${fixtureKind}-ready.json`), JSON.stringify({
    sourceHead: manifest.sourceHead,
    fixture: fixtureKind,
    observedAt: new Date().toISOString(),
    launcherPid: record.pid,
    appProcess: observed,
  }, null, 2) + "\n", { mode: 0o600 });
}

function zedReady(record) {
  return isolatedZedProcess(record) !== undefined;
}

function isolatedZedProcess(record) {
  const result = spawnSync("/bin/ps", ["-axo", "pid=,pgid=,stat=,command="], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ps failed while checking isolated Zed process: ${bounded(result.stderr)}`);
  }
  return findIsolatedZedProcess(result.stdout, record);
}

function findIsolatedZedProcess(psOutput, record) {
  const userDataNeedle = `--user-data-dir ${record.userDataDir}`;
  for (const line of String(psOutput).split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const [, pidText, pgidText, state, command] = match;
    if (Number(pgidText) !== record.pid || state.startsWith("Z")) continue;
    if (!command.includes(userDataNeedle)) continue;
    if (/\/Contents\/MacOS\/zed(?:\s|$)/.test(command)) {
      return {
        pid: Number(pidText),
        pgid: Number(pgidText),
        state,
        command: bounded(command),
      };
    }
  }
  return undefined;
}

function waitForDevExtensionInstalled(manifest, timeoutMs) {
  const indexFile = path.join(manifest.profile, "extensions", "index.json");
  const wasmFile = path.join(repository, "extension.wasm");
  const processRecord = JSON.parse(
    fs.readFileSync(path.join(manifest.evidence, "zed-process.json"), "utf8"),
  );
  const foreground = processRecord.logPath;
  try {
    waitUntil(
      () => devExtensionReady(indexFile, wasmFile),
      "spring-tools dev extension registration and WASM build",
      timeoutMs,
      () => {
        const text = fs.existsSync(foreground) ? fs.readFileSync(foreground, "utf8") : "";
        const fatal = [
          "Failed to install dev extension",
          "failed to build extension",
          "compiling Rust extension",
          "failed to install the `wasm32-wasip2` target",
          "failed to retrieve the `wasm32-wasip2` target libdir",
          "resolving clang path",
        ].find((marker) => text.includes(marker));
        if (fatal && /Failed to install dev extension|failed to build extension|failed to install the|failed to retrieve/.test(fatal)) {
          throw new Error(`Zed reported dev-extension installation failure: ${fatal}`);
        }
      },
    );
  } catch (error) {
    const state = devExtensionState(indexFile, wasmFile, foreground);
    fs.writeFileSync(
      path.join(manifest.evidence, "dev-extension-readiness-failure.json"),
      JSON.stringify({
        sourceHead: manifest.sourceHead,
        observedAt: new Date().toISOString(),
        ...state,
        error: errorText(error),
      }, null, 2) + "\n",
      { mode: 0o600 },
    );
    throw new Error(
      `${errorText(error)}; wasmExists=${state.wasmExists}, wasmSize=${state.wasmSize}, indexRegistered=${state.indexRegistered}; inspect evidence/dev-extension-readiness-failure.json and the install foreground log`,
      { cause: error },
    );
  }

  fs.writeFileSync(path.join(manifest.evidence, "dev-extension-ready.json"), JSON.stringify({
    sourceHead: manifest.sourceHead,
    observedAt: new Date().toISOString(),
    indexRegistered: true,
    wasmSha256: createHash("sha256").update(fs.readFileSync(wasmFile)).digest("hex"),
  }, null, 2) + "\n", { mode: 0o600 });
}

function devExtensionState(indexFile, wasmFile, foreground) {
  let indexRegistered = false;
  try {
    if (fs.existsSync(indexFile)) {
      const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
      indexRegistered = Boolean(index.extensions?.["spring-tools"]);
    }
  } catch {}

  const foregroundText = fs.existsSync(foreground) ? fs.readFileSync(foreground, "utf8") : "";
  return {
    wasmExists: fs.existsSync(wasmFile),
    wasmSize: fileSize(wasmFile),
    indexRegistered,
    foregroundTail: foregroundText.slice(-12_000),
  };
}

function devExtensionReady(indexFile, wasmFile) {
  if (!fs.existsSync(indexFile) || !fs.existsSync(wasmFile) || fileSize(wasmFile) === 0) return false;
  try {
    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    return Boolean(index.extensions?.["spring-tools"]);
  } catch {
    return false;
  }
}

function triggerCompletionMacos(manifest, fixtureKind, evidenceName) {
  sendD007ActionKeyMacos(manifest, "z", evidenceName);
}

function completionObservation(text, expectedRequest = null) {
  const events = protocolEvidenceEvents(text);
  const requests = events.filter((event) => event.event === "completion-request");
  const responses = events.filter((event) => event.event === "completion-response");
  const matchesTarget = (event) => expectedRequest === null || (
    event.uri === expectedRequest.uri &&
    event.line === expectedRequest.line &&
    event.character === expectedRequest.character
  );
  const matchingRequest = [...requests].reverse().find(matchesTarget);
  const matchingResponses = responses.filter(matchesTarget);
  const lastMatchingResponse = matchingResponses.at(-1);
  return {
    requestObserved: requests.length > 0,
    expectedRequestObserved: matchingRequest !== undefined,
    requestUri: matchingRequest?.uri ?? null,
    requestLine: Number.isInteger(matchingRequest?.line) ? matchingRequest.line : null,
    requestCharacter: Number.isInteger(matchingRequest?.character) ? matchingRequest.character : null,
    responseObserved: responses.length > 0,
    expectedResponseObserved: lastMatchingResponse !== undefined,
    itemCount: typeof lastMatchingResponse?.itemCount === "number"
      ? lastMatchingResponse.itemCount
      : null,
    serverPortObserved: matchingResponses.some((event) => event.serverPort === true),
  };
}

function protocolEvidenceEvents(text) {
  const events = [];
  for (const line of String(text).split("\n")) {
    if (!line.startsWith("{")) continue;
    try {
      const value = JSON.parse(line);
      if (typeof value?.event === "string") events.push(value);
    } catch {}
  }
  return events;
}

function springTargetReadiness(text, expectedUri) {
  const events = protocolEvidenceEvents(text);
  return {
    coordinatorStarted: events.some((event) => event.event === "coordinator-start"),
    targetDocumentOpened: events.some(
      (event) => event.event === "document-open" && event.uri === expectedUri,
    ),
    indexReady: events.some(
      (event) =>
        event.event === "spring-index-updated" &&
        Number.isInteger(event.affectedProjectCount) &&
        event.affectedProjectCount > 0,
    ),
  };
}

function waitForSpringTargetReadyMacos(
  manifest,
  fixtureKind,
  protocolFile,
  expectedRelativePath,
  expectedUri,
  started,
  timeoutMs,
) {
  const launchEvidence = waitForLaunchTargetDocumentOpen(
    manifest,
    fixtureKind,
    expectedRelativePath,
    Math.min(45_000, timeoutMs),
    `${fixtureKind}-completion-target`,
  );

  let readiness = springTargetReadiness(
    fs.existsSync(protocolFile) ? fs.readFileSync(protocolFile, "utf8") : "",
    expectedUri,
  );
  const readinessDeadline = Math.min(started + timeoutMs, Date.now() + 60_000);
  do {
    const allText = fs.existsSync(protocolFile) ? fs.readFileSync(protocolFile, "utf8") : "";
    readiness = springTargetReadiness(allText, expectedUri);
    if (
      readiness.coordinatorStarted &&
      readiness.targetDocumentOpened &&
      readiness.indexReady
    ) {
      const targetEvidence = {
        targetRelativePath: expectedRelativePath,
        targetUri: expectedUri,
        targeting: launchEvidence.targeting,
        requestedLaunchPosition: { row: 1, column: 4 },
        targetDocumentOpened: true,
      };
      fs.writeFileSync(
        path.join(manifest.evidence, `${fixtureKind}-spring-runtime-ready.json`),
        JSON.stringify({
          sourceHead: manifest.sourceHead,
          fixture: fixtureKind,
          observedAt: new Date().toISOString(),
          requiredEvidence: ["coordinator-start", "document-open exact URI"],
          ...targetEvidence,
          status: "PASS",
        }, null, 2) + "\n",
        { mode: 0o600 },
      );
      fs.writeFileSync(
        path.join(manifest.evidence, `${fixtureKind}-spring-index-ready.json`),
        JSON.stringify({
          sourceHead: manifest.sourceHead,
          fixture: fixtureKind,
          observedAt: new Date().toISOString(),
          requiredEvidence: ["spring-index-updated affectedProjectCount>0"],
          ...targetEvidence,
          status: "PASS",
        }, null, 2) + "\n",
        { mode: 0o600 },
      );
      return { attempts: 1, ...readiness };
    }
    sleepMs(250);
  } while (Date.now() < readinessDeadline);

  const classification = !readiness.targetDocumentOpened
    ? "completion-target-document-not-opened"
    : !readiness.coordinatorStarted
      ? "completion-coordinator-not-started"
      : "completion-spring-index-not-ready";
  fs.writeFileSync(
    path.join(manifest.evidence, `${fixtureKind}-completion-target-failure.json`),
    JSON.stringify({
      sourceHead: manifest.sourceHead,
      fixture: fixtureKind,
      observedAt: new Date().toISOString(),
      targetRelativePath: expectedRelativePath,
      targetUri: expectedUri,
      requestedLaunchPosition: { row: 1, column: 4 },
      targeting: launchEvidence.targeting,
      classification,
      ...readiness,
      protocolTail: fs.existsSync(protocolFile)
        ? fs.readFileSync(protocolFile, "utf8").slice(-16_000)
        : "",
    }, null, 2) + "\n",
    { mode: 0o600 },
  );
  throw new Error(
    `${fixtureKind} launch target opened but runtime readiness was not proven: ${classification}`,
  );
}

function waitForSpringCompletion(
  manifest,
  sharedLog,
  sharedStart,
  fixtureKind,
  baseline,
  timeoutMs,
  maxAttempts,
) {
  void sharedLog;
  void sharedStart;
  void baseline;
  const protocolFile = coordinatorProtocolFile(manifest, fixtureKind);
  const started = Date.now();
  let attempts = 0;
  const expectedRelativePath = "src/main/resources/application-d007.properties";
  const expectedPath = path.join(
    manifest.worktrees[fixtureKind],
    expectedRelativePath,
  );
  const expectedRequest = {
    uri: pathToFileURL(expectedPath).href,
    line: 0,
    character: 3,
  };
  let finalObservation = {
    requestObserved: false,
    expectedRequestObserved: false,
    requestUri: null,
    requestLine: null,
    requestCharacter: null,
    responseObserved: false,
    expectedResponseObserved: false,
    itemCount: null,
    serverPortObserved: false,
  };
  let text = "";

  const targetReadiness = waitForSpringTargetReadyMacos(
    manifest,
    fixtureKind,
    protocolFile,
    expectedRelativePath,
    expectedRequest.uri,
    started,
    timeoutMs,
  );

  for (
    let localAttempt = 0;
    localAttempt < maxAttempts && Date.now() - started < timeoutMs;
    localAttempt += 1
  ) {
    attempts += 1;
    // The picker was confirmed only after exact didOpen proved its selected
    // absolute-path match. Completion retries stay on that proven editor.
    const protocolStart = fileSize(protocolFile);
    triggerCompletionMacos(
      manifest,
      fixtureKind,
      `${fixtureKind}-completion-attempt-${localAttempt + 1}`,
    );

    let observation = {
      requestObserved: false,
      expectedRequestObserved: false,
      requestUri: null,
      requestLine: null,
      requestCharacter: null,
      responseObserved: false,
      expectedResponseObserved: false,
      itemCount: null,
      serverPortObserved: false,
    };
    const requestDeadline = Math.min(started + timeoutMs, Date.now() + 20_000);
    do {
      text = readFileDelta(protocolFile, protocolStart);
      observation = completionObservation(text, expectedRequest);
      if (observation.requestObserved) break;
      sleepMs(250);
    } while (Date.now() < requestDeadline);

    if (!observation.requestObserved) {
      cancelTransientUiMacos(
        manifest,
        `${fixtureKind}-completion-cancel-${localAttempt + 1}`,
      );
      continue;
    }

    const responseDeadline = Math.min(started + timeoutMs, Date.now() + 30_000);
    do {
      text = readFileDelta(protocolFile, protocolStart);
      observation = completionObservation(text, expectedRequest);
      if (observation.expectedResponseObserved || observation.responseObserved) break;
      sleepMs(250);
    } while (Date.now() < responseDeadline);

    finalObservation = {
      requestObserved: finalObservation.requestObserved || observation.requestObserved,
      expectedRequestObserved:
        finalObservation.expectedRequestObserved || observation.expectedRequestObserved,
      requestUri: observation.requestUri ?? finalObservation.requestUri,
      requestLine: observation.requestLine ?? finalObservation.requestLine,
      requestCharacter:
        observation.requestCharacter ?? finalObservation.requestCharacter,
      responseObserved: finalObservation.responseObserved || observation.responseObserved,
      expectedResponseObserved:
        finalObservation.expectedResponseObserved || observation.expectedResponseObserved,
      itemCount: observation.itemCount ?? finalObservation.itemCount,
      serverPortObserved:
        finalObservation.serverPortObserved || observation.serverPortObserved,
    };

    if (
      observation.expectedRequestObserved &&
      observation.expectedResponseObserved &&
      observation.serverPortObserved
    ) {
      fs.writeFileSync(
        path.join(manifest.evidence, `${fixtureKind}-completion-ready.json`),
        JSON.stringify({
          sourceHead: manifest.sourceHead,
          fixture: fixtureKind,
          observedAt: new Date().toISOString(),
          attempts,
          readinessAttempts: targetReadiness.attempts,
          targetRelativePath: expectedRelativePath,
          targetUri: expectedRequest.uri,
          targeting: "fresh-foreground-cli-launch-target",
          requestedLaunchPosition: { row: 1, column: 4 },
          ...observation,
          status: "PASS",
        }, null, 2) + "\n",
        { mode: 0o600 },
      );
      return expectedRelativePath;
    }

    cancelTransientUiMacos(
      manifest,
      `${fixtureKind}-completion-cancel-${localAttempt + 1}`,
    );
    if (observation.requestObserved && !observation.expectedRequestObserved) break;
    if (observation.responseObserved) break;
  }

  const classification = !finalObservation.requestObserved
    ? "completion-request-not-observed"
    : !finalObservation.expectedRequestObserved
      ? "completion-request-target-mismatch"
      : !finalObservation.responseObserved
        ? "completion-response-not-observed"
        : !finalObservation.expectedResponseObserved
          ? "completion-response-target-mismatch"
          : "completion-response-missing-server-port";
  fs.writeFileSync(
    path.join(manifest.evidence, `${fixtureKind}-completion-failure.json`),
    JSON.stringify({
      sourceHead: manifest.sourceHead,
      fixture: fixtureKind,
      observedAt: new Date().toISOString(),
      attempts,
      readinessAttempts: targetReadiness.attempts,
      targetRelativePath: expectedRelativePath,
      targetUri: expectedRequest.uri,
      targeting: "fresh-foreground-cli-launch-target",
      requestedLaunchPosition: { row: 1, column: 4 },
      classification,
      ...finalObservation,
      protocolTail: fs.existsSync(protocolFile)
        ? fs.readFileSync(protocolFile, "utf8").slice(-16_000)
        : "",
    }, null, 2) + "\n",
    { mode: 0o600 },
  );
  throw new Error(
    `${fixtureKind} Spring completion failed after ${attempts} exact-file attempts: ${classification}`,
  );
}

function waitForRuntimeEvidence(
  manifest,
  sharedLog,
  sharedStart,
  baseline,
  needles,
  label,
  timeoutMs,
  retry,
  retryIntervalMs = 10_000,
  pollIntervalMs = 500,
) {
  const started = Date.now();
  let nextRetry = started + retryIntervalMs;
  while (Date.now() - started < timeoutMs) {
    const text = runtimeTextSince(manifest, sharedLog, sharedStart, baseline);
    if (needles.every((needle) => text.includes(needle))) return;
    if (retry && Date.now() >= nextRetry) {
      retry();
      nextRetry = Date.now() + retryIntervalMs;
    }
    sleepMs(pollIntervalMs);
  }
  throw new Error(`timed out waiting for ${label}: required evidence ${needles.join(", ")}`);
}

function waitForFileWithRetry(
  file,
  label,
  timeoutMs,
  retry,
  retryIntervalMs = 10_000,
  pollIntervalMs = 500,
) {
  const started = Date.now();
  let nextRetry = started + retryIntervalMs;
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
    if (retry && Date.now() >= nextRetry) {
      retry();
      nextRetry = Date.now() + retryIntervalMs;
    }
    sleepMs(pollIntervalMs);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function waitForZedStopped(manifest, timeoutMs) {
  const processFile = path.join(manifest.evidence, "zed-process.json");
  const record = JSON.parse(fs.readFileSync(processFile, "utf8"));
  waitUntil(() => !processGroupAlive(record.pid), "isolated Zed process-group shutdown", timeoutMs);
}

function stopAndWaitZed(root, manifest, termTimeoutMs, killTimeoutMs) {
  const processFile = path.join(manifest.evidence, "zed-process.json");
  requireFile(processFile, "Zed process record");
  const record = JSON.parse(fs.readFileSync(processFile, "utf8"));
  if (!processGroupAlive(record.pid)) return { status: "already-stopped", pid: record.pid };

  stopMacos(root, "SIGTERM");
  try {
    waitForZedStopped(manifest, termTimeoutMs);
    return { status: "terminated", pid: record.pid };
  } catch (termError) {
    stopMacos(root, "SIGKILL");
    try {
      waitForZedStopped(manifest, killTimeoutMs);
      return { status: "killed", pid: record.pid, termError: errorText(termError) };
    } catch (killError) {
      throw new Error(
        `isolated Zed process group ${record.pid} survived SIGTERM and SIGKILL: ${errorText(killError)}`,
        { cause: termError },
      );
    }
  }
}

function ensureZedStopped(root, manifest, termTimeoutMs, killTimeoutMs) {
  const processFile = path.join(manifest.evidence, "zed-process.json");
  if (!fs.existsSync(processFile)) return;
  const record = JSON.parse(fs.readFileSync(processFile, "utf8"));
  if (!processGroupAlive(record.pid)) return;
  stopAndWaitZed(root, manifest, termTimeoutMs, killTimeoutMs);
}

function processGroupAlive(pid) {
  const result = spawnSync("/bin/ps", ["-axo", "pgid=,stat="], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ps failed while checking process group ${pid}: ${bounded(result.stderr)}`);
  }
  return processGroupHasLiveMember(result.stdout, pid);
}

function processGroupHasLiveMember(psOutput, pid) {
  return String(psOutput).split("\n").some((line) => {
    const match = /^\s*(\d+)\s+(\S+)/.exec(line);
    if (!match || Number(match[1]) !== pid) return false;
    return !match[2].startsWith("Z");
  });
}

function waitUntil(predicate, label, timeoutMs, observe) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    if (observe) observe();
    sleepMs(250);
  }
  throw new Error(`timed out waiting for ${label} after ${timeoutMs}ms`);
}

function processAlive(pid) {
  const result = spawnSync("/bin/ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
  if (result.status === 1 || result.stdout.trim() === "") return false;
  if (result.status !== 0) {
    throw new Error(`ps failed while checking pid ${pid}: ${bounded(result.stderr)}`);
  }
  const state = result.stdout.trim().split(/\s+/)[0] ?? "";
  return !state.startsWith("Z");
}

function coordinatorProtocolFile(manifest, fixtureKind) {
  return path.join(
    manifest.worktrees[fixtureKind],
    ".d007",
    "coordinator-protocol.jsonl",
  );
}

function runtimeSnapshot(manifest, sharedLog, sharedStart) {
  const foreground = {};
  const protocol = {};
  for (const fixtureKind of ["maven", "gradle"]) {
    const file = path.join(manifest.evidence, `zed-${fixtureKind}-foreground.log`);
    foreground[fixtureKind] = fileSize(file);
    protocol[fixtureKind] = fileSize(coordinatorProtocolFile(manifest, fixtureKind));
  }
  return {
    foreground,
    protocol,
    shared: Math.max(sharedStart, fileSize(sharedLog)),
  };
}

function runtimeTextSince(manifest, sharedLog, sharedStart, baseline) {
  const parts = [];
  for (const fixtureKind of ["maven", "gradle"]) {
    const file = path.join(manifest.evidence, `zed-${fixtureKind}-foreground.log`);
    const start = baseline.foreground?.[fixtureKind] ?? 0;
    parts.push(readFileDelta(file, start));

    const protocolFile = coordinatorProtocolFile(manifest, fixtureKind);
    const protocolStart = baseline.protocol?.[fixtureKind] ?? 0;
    parts.push(readFileDelta(protocolFile, protocolStart));
  }
  parts.push(readFileDelta(sharedLog, Math.max(sharedStart, baseline.shared ?? sharedStart)));
  return parts.join("\n");
}

function readFileDelta(file, start) {
  if (!fs.existsSync(file)) return "";
  const fd = fs.openSync(file, "r");
  try {
    const end = fs.fstatSync(fd).size;
    if (end <= start) return "";
    const buffer = Buffer.alloc(end - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function runtimeText(manifest, sharedLog, sharedStart) {
  const parts = [];
  for (const fixtureKind of ["maven", "gradle"]) {
    const file = path.join(manifest.evidence, `zed-${fixtureKind}-foreground.log`);
    if (fs.existsSync(file)) parts.push(fs.readFileSync(file, "utf8"));
  }
  if (fs.existsSync(sharedLog)) {
    const fd = fs.openSync(sharedLog, "r");
    try {
      const end = fs.fstatSync(fd).size;
      if (end > sharedStart) {
        const buffer = Buffer.alloc(end - sharedStart);
        fs.readSync(fd, buffer, 0, buffer.length, sharedStart);
        parts.push(buffer.toString("utf8"));
      }
    } finally {
      fs.closeSync(fd);
    }
  }
  return parts.join("\n");
}

function runOsa(script, name, evidence) {
  const result = spawnSync("osascript", ["-e", script], { encoding: "utf8" });
  fs.writeFileSync(path.join(evidence, `${name}-automation.json`), JSON.stringify({
    at: new Date().toISOString(),
    exitCode: result.status,
    stdout: bounded(result.stdout),
    stderr: bounded(result.stderr),
  }, null, 2) + "\n", { mode: 0o600 });
  if (result.status !== 0) throw new Error(`${name} UI automation failed`);
}

function captureScreen(destination) {
  const result = spawnSync("/usr/sbin/screencapture", ["-x", destination], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`screencapture failed: ${bounded(result.stderr)}`);
}

function harvestSharedZedLog(manifest, source, start) {
  if (!fs.existsSync(source)) return;
  const fd = fs.openSync(source, "r");
  try {
    const end = fs.fstatSync(fd).size;
    const length = Math.max(0, end - start);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    fs.writeFileSync(path.join(manifest.evidence, "zed-shared-log-delta.log"), buffer, { mode: 0o600 });
  } finally {
    fs.closeSync(fd);
  }
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function fileSize(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

function sleepMs(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}


function launchMacos(
  root,
  fixtureKind,
  { role = "root", relativeTarget = null, row = null, column = null, zedCli = null } = {},
) {
  assert.equal(process.platform, "darwin", "macOS launch is required");
  assert.ok(["maven", "gradle"].includes(fixtureKind), "fixture must be maven or gradle");
  const manifest = readManifest(root);
  assert.equal(manifest.sourceHead, git(["rev-parse", "HEAD"]).trim(), "staged HEAD must still equal checkout HEAD");
  assert.equal(git(["status", "--porcelain"]), "", "source checkout must remain clean");

  const cli = zedCli ?? "/Applications/Zed.app/Contents/MacOS/cli";
  requireFile(cli, "Zed CLI");
  const logPath = path.join(manifest.evidence, `zed-${fixtureKind}-${role}-foreground.log`);
  const logStartOffset = fileSize(logPath);
  const fd = fs.openSync(logPath, "a", 0o600);

  const worktree = manifest.worktrees[fixtureKind];
  const launchTargets = [worktree];
  let target = null;
  let targetArgument = null;
  if (relativeTarget !== null) {
    target = path.join(worktree, relativeTarget);
    requireFile(target, `${fixtureKind} ${role} launch target`);
    if (row !== null || column !== null) {
      assert.equal(Number.isInteger(row) && row > 0, true, "launch row must be a positive integer");
      assert.equal(Number.isInteger(column) && column > 0, true, "launch column must be a positive integer");
      targetArgument = `${target}:${row}:${column}`;
    } else {
      targetArgument = target;
    }
    launchTargets.push(targetArgument);
  }

  const child = spawn(cli, [
    "--foreground",
    "--user-data-dir",
    manifest.profile,
    ...launchTargets,
  ], {
    detached: true,
    stdio: ["ignore", fd, fd],
    env: {
      ...process.env,
      XDG_CACHE_HOME: manifest.xdgCache,
      XDG_DATA_HOME: manifest.xdgData,
      XDG_STATE_HOME: manifest.xdgState,
      ZED_SPRING_TOOLS_D007_PROTOCOL_EVIDENCE: "1",
      PATH: path.join(os.homedir(), ".cargo", "bin") + path.delimiter + (process.env.PATH ?? ""),
    },
  });
  child.unref();
  fs.closeSync(fd);
  fs.writeFileSync(path.join(manifest.evidence, "zed-process.json"), JSON.stringify({
    sourceHead: manifest.sourceHead,
    fixture: fixtureKind,
    role,
    pid: child.pid,
    launchedAt: new Date().toISOString(),
    cli,
    userDataDir: manifest.profile,
    worktree,
    relativeTarget,
    target,
    targetArgument,
    requestedPosition: relativeTarget !== null && row !== null ? { row, column } : null,
    launchTargets,
    controlPlane: "fresh-foreground-cli-per-phase",
    logPath,
    logStartOffset,
  }, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(
    `Launched isolated Zed pid ${child.pid} for ${fixtureKind}/${role}; targets: ${launchTargets.join(" | ")}; log: ${logPath}\n`,
  );
}

function stopMacos(root, signal = "SIGTERM") {
  const manifest = readManifest(root);
  const processFile = path.join(manifest.evidence, "zed-process.json");
  requireFile(processFile, "Zed process record");
  const record = JSON.parse(fs.readFileSync(processFile, "utf8"));
  let signaled = false;
  try {
    process.kill(-record.pid, signal);
    signaled = true;
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  const evidenceFile = signal === "SIGTERM" ? "zed-stop.json" : "zed-force-stop.json";
  fs.writeFileSync(path.join(manifest.evidence, evidenceFile), JSON.stringify({
    sourceHead: manifest.sourceHead,
    pid: record.pid,
    requestedAt: new Date().toISOString(),
    signal,
    scope: "process-group",
    processGroupWasLive: signaled,
  }, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(
    signaled
      ? `Requested ${signal} for isolated Zed process group ${record.pid}.\n`
      : "Isolated Zed process group was already absent.\n",
  );
}

function installDevExtensionMacos(root) {
  assert.equal(process.platform, "darwin", "macOS UI automation is required");
  const manifest = readManifest(root);
  assert.equal(manifest.sourceHead, git(["rev-parse", "HEAD"]).trim(), "staged HEAD must still equal checkout HEAD");
  assert.equal(git(["status", "--porcelain"]), "", "source checkout must remain clean");

  const wasmFile = path.join(repository, "extension.wasm");
  const staleWasmRemoved = fs.existsSync(wasmFile);
  fs.rmSync(wasmFile, { force: true });

  const processRecord = JSON.parse(
    fs.readFileSync(path.join(manifest.evidence, "zed-process.json"), "utf8"),
  );
  const foreground = processRecord.logPath;
  const foregroundStart = fileSize(foreground);
  const sharedLog = path.join(os.homedir(), "Library", "Logs", "Zed", "Zed.log");
  const sharedStart = fileSize(sharedLog);
  const extensionPath = repository + path.sep;

  sendD007ActionKeyMacos(
    manifest,
    "i",
    "dev-extension-install-action",
  );

  const pasteScript = [
    `set extensionPath to "${escapeAppleScript(extensionPath)}"`,
    "set previousClipboard to the clipboard",
    "try",
    "  set the clipboard to extensionPath",
    '  tell application "Zed" to activate',
    '  tell application "System Events"',
    '    tell process "Zed" to set frontmost to true',
    "    delay 0.5",
    '    keystroke "a" using {command down}',
    '    keystroke "v" using {command down}',
    "  end tell",
    "  delay 0.2",
    "  set the clipboard to previousClipboard",
    "on error errorMessage number errorNumber",
    "  set the clipboard to previousClipboard",
    "  error errorMessage number errorNumber",
    "end try",
  ].join("\n");
  runOsa(pasteScript, "dev-extension-install-path", manifest.evidence);

  const started = Date.now();
  const timeoutMs = 45_000;
  let attempts = 0;
  let buildStartObserved = false;
  let fatal = null;

  while (Date.now() - started < timeoutMs) {
    attempts += 1;
    const confirmScript = [
      'tell application "Zed" to activate',
      'tell application "System Events"',
      '  tell process "Zed" to set frontmost to true',
      '  key code 36',
      'end tell',
    ].join("\n");
    runOsa(
      confirmScript,
      `dev-extension-install-confirm-${attempts}`,
      manifest.evidence,
    );

    const probeDeadline = Math.min(started + timeoutMs, Date.now() + 2_000);
    do {
      const foregroundDelta = readFileDelta(foreground, foregroundStart);
      const sharedDelta = readFileDelta(sharedLog, sharedStart);
      const installText = `${foregroundDelta}\n${sharedDelta}`;
      fatal = [
        "Failed to install dev extension",
        "failed to build extension",
      ].find((marker) => installText.includes(marker)) ?? null;
      if (fatal !== null) break;

      buildStartObserved =
        installText.includes("compiling Rust extension") &&
        installText.includes(repository);
      if (buildStartObserved) break;
      sleepMs(100);
    } while (Date.now() < probeDeadline);

    if (fatal !== null || buildStartObserved) break;
  }

  const installEvidence = {
    attemptedAt: new Date().toISOString(),
    sourceHead: manifest.sourceHead,
    staleWasmRemoved,
    automation: "direct-action-open-path-prompt-bounded-confirm",
    action: "zed::InstallDevExtension",
    repository,
    promptQuery: extensionPath,
    promptQueryStrategy: "absolute-directory-with-trailing-separator",
    attempts,
    buildStartObserved,
    buildStartEvidence: "compiling Rust extension <exact repository>",
    fatal,
    foregroundTail: readFileDelta(foreground, foregroundStart).slice(-12_000),
    sharedLogTail: readFileDelta(sharedLog, sharedStart).slice(-12_000),
    status: fatal !== null
      ? "failed"
      : buildStartObserved
        ? "install-started"
        : "install-not-started",
  };
  fs.writeFileSync(
    path.join(manifest.evidence, "dev-extension-install.json"),
    JSON.stringify(installEvidence, null, 2) + "\n",
    { mode: 0o600 },
  );

  if (fatal !== null) {
    throw new Error(
      `Zed reported dev-extension installation failure after prompt confirmation: ${fatal}`,
    );
  }
  if (!buildStartObserved) {
    throw new Error(
      `Zed dev-extension OpenPathPrompt never started installation after ${attempts} bounded confirms; inspect evidence/dev-extension-install.json`,
    );
  }

  process.stdout.write(
    `Zed Install Dev Extension started after ${attempts} bounded OpenPathPrompt confirm attempt(s); waiting for registration/build readiness.\n`,
  );
}

function summarize(root) {
  const manifest = readManifest(root);
  const controlFiles = new Set(["staged.json", "summary.json"]);
  const files = findTextFiles(manifest.evidence).filter(
    (file) => !controlFiles.has(path.relative(manifest.evidence, file)),
  );
  const content = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const forbidden = FORBIDDEN.filter((marker) => content.includes(marker));
  const completionFixtures = Object.fromEntries(["maven", "gradle"].map((fixtureKind) => {
    const file = path.join(manifest.evidence, `${fixtureKind}-completion-ready.json`);
    if (!fs.existsSync(file)) return [fixtureKind, { status: "MISSING" }];
    try {
      const evidence = JSON.parse(fs.readFileSync(file, "utf8"));
      return [fixtureKind, {
        status: evidence.status,
        requestObserved: evidence.requestObserved === true,
        responseObserved: evidence.responseObserved === true,
        itemCount: evidence.itemCount,
        serverPortObserved: evidence.serverPortObserved === true,
        attempts: evidence.attempts,
      }];
    } catch {
      return [fixtureKind, { status: "INVALID" }];
    }
  }));
  const completionEvidence = Object.values(completionFixtures).every(
    (entry) => entry.status === "PASS" &&
      entry.requestObserved === true &&
      entry.responseObserved === true &&
      entry.serverPortObserved === true,
  ) ? "PASS" : "REVIEW_REQUIRED";
  const result = {
    sourceHead: manifest.sourceHead,
    evidenceFiles: files.map((file) => path.relative(manifest.evidence, file)),
    forbiddenPrivateBoundaryMarkersObserved: forbidden,
    privateBoundary: forbidden.length === 0 ? "PASS" : "FAIL",
    completionFixtures,
    completionEvidence,
  };
  fs.writeFileSync(path.join(manifest.evidence, "summary.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  return result;
}

function writeGateFailure(manifest, phase, error) {
  fs.writeFileSync(path.join(manifest.evidence, "gate-failure.json"), JSON.stringify({
    sourceHead: manifest.sourceHead,
    phase,
    observedAt: new Date().toISOString(),
    name: error?.name ?? "Error",
    message: errorText(error),
    stack: bounded(error?.stack),
  }, null, 2) + "\n", { mode: 0o600 });
}

function writeCleanupFailure(manifest, error, phase = "zed-cleanup") {
  fs.writeFileSync(path.join(manifest.evidence, "cleanup-failure.json"), JSON.stringify({
    sourceHead: manifest.sourceHead,
    phase,
    observedAt: new Date().toISOString(),
    name: error?.name ?? "Error",
    message: errorText(error),
    stack: bounded(error?.stack),
  }, null, 2) + "\n", { mode: 0o600 });
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function readManifest(root) {
  const file = path.join(root, "evidence", "staged.json");
  requireFile(file, "staged manifest");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireFreshRoot(root) {
  assert.equal(fs.existsSync(root), false, "D007 validation root must be fresh");
  assert.equal(path.dirname(root), path.join(repository, "tmp"), "root must be a direct child of repository tmp/");
  assert.equal(path.basename(root).startsWith("d007-zed-"), true, 'root basename must start with "d007-zed-"');
}

function requireDirectory(directory, label) {
  assert.equal(fs.existsSync(directory) && fs.statSync(directory).isDirectory(), true, `${label} must be a directory`);
}

function requireFile(file, label) {
  assert.equal(fs.existsSync(file) && fs.statSync(file).isFile(), true, `${label} must be a file`);
}

function javaVersionFromHome(home) {
  const release = fs.readFileSync(path.join(home, "release"), "utf8");
  return /^JAVA_VERSION="([^"]+)"$/m.exec(release)?.[1] ?? "unknown";
}

function git(args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout;
}

function treeDigest(directory) {
  const digest = createHash("sha256");
  for (const relative of walk(directory)) {
    digest.update(relative).update("\0").update(fs.readFileSync(path.join(directory, relative))).update("\n");
  }
  return digest.digest("hex");
}

function walk(directory, prefix = "", current = directory) {
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? walk(directory, relative, path.join(current, entry.name)) : [relative];
  }).sort();
}

function findTextFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return walk(directory).map((relative) => path.join(directory, relative)).filter((file) => {
    try {
      fs.readFileSync(file, "utf8");
      return true;
    } catch {
      return false;
    }
  });
}

function bounded(value) {
  return String(value ?? "").slice(0, 4000);
}

function escapeAppleScript(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function selfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "d007-zed-selftest-"));
  const roots = [];
  try {
    const javaHome = path.join(scratch, "jdk");
    fs.mkdirSync(javaHome, { recursive: true });
    fs.writeFileSync(path.join(javaHome, "release"), 'JAVA_VERSION="25.0.3"\n');

    const javaProfile = path.join(scratch, "java-profile");
    const javaDir = path.join(javaProfile, "extensions", "installed", "java");
    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(path.join(javaDir, "extension.toml"), 'id = "java"\nversion = "6.8.23"\n');
    fs.writeFileSync(path.join(javaProfile, "extensions", "index.json"), JSON.stringify({
      extensions: { java: { manifest: { id: "java", version: "6.8.23" } } },
    }));

    const root = path.join(repository, "tmp", `d007-zed-selftest-${process.pid}-${Date.now()}`);
    roots.push(root);
    const manifest = stage(javaProfile, root, javaHome);
    assert.equal(manifest.decision, "D007");
    assert.match(manifest.sourceHead, /^[0-9a-f]{40}$/);
    assert.equal(manifest.javaExtensionVersion, "6.8.23");
    assert.equal(manifest.runtimeJdk, "25.0.3");
    assert.equal(fs.existsSync(path.join(manifest.worktrees.maven, "pom.xml")), true);
    assert.equal(fs.existsSync(path.join(manifest.worktrees.gradle, "build.gradle")), true);
    assert.equal(fs.readFileSync(path.join(manifest.worktrees.maven, "src", "main", "resources", "application-d007.properties"), "utf8"), "ser");
    assert.equal(fs.readFileSync(path.join(manifest.worktrees.gradle, "src", "main", "resources", "application-d007.properties"), "utf8"), "ser");
    const stagedSettings = JSON.parse(fs.readFileSync(path.join(manifest.profile, "config", "settings.json"), "utf8"));
    assert.deepEqual(stagedSettings.languages.Java.language_servers, ["jdtls", "spring-tools"]);
    assert.equal(stagedSettings.lsp.jdtls.settings.java_home, javaHome);
    assert.equal(stagedSettings.lsp.jdtls.settings.check_updates, "once");
    const stagedKeymap = JSON.parse(fs.readFileSync(path.join(manifest.profile, "config", "keymap.json"), "utf8"));
    assert.equal(stagedKeymap[0].context, "Workspace");
    assert.equal(
      stagedKeymap[0].bindings["ctrl-cmd-alt-i"],
      "zed::InstallDevExtension",
    );
    assert.equal(
      stagedKeymap[0].bindings["ctrl-cmd-alt-v"],
      undefined,
    );
    assert.equal(stagedKeymap[1].context, "Editor");
    assert.equal(stagedKeymap[1].bindings["ctrl-cmd-alt-x"], "editor::ToggleCodeActions");
    assert.equal(stagedKeymap[1].bindings["ctrl-cmd-alt-z"], "editor::ShowCompletions");
    assert.deepEqual(
      stagedKeymap[1].bindings["ctrl-cmd-alt-0"],
      ["editor::ConfirmCodeAction", { item_ix: 0 }],
    );
    assert.equal(d007ConfirmKey(25), "p");
    assert.throws(() => d007ConfirmKey(26), /exceeds the D007 keymap range/);

    const harnessSource = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
    const retiredPaneAction = ["pane", "ActivateItem"].join("::");
    assert.equal(
      harnessSource.includes(retiredPaneAction),
      false,
      "D007 must not guess editor identity through pane indices",
    );
    const retiredFocusHelper = ["openFixture", "FileWithCli"].join("");
    assert.equal(
      harnessSource.includes(`function ${retiredFocusHelper}`),
      false,
      "D007 must not use a secondary macOS Zed CLI invocation for file focus",
    );
    assert.equal(
      harnessSource.includes('controlPlane: "fresh-foreground-cli-per-phase"'),
      true,
      "D007 launch evidence must record the fresh per-phase foreground control plane",
    );
    assert.equal(
      d007Keymap().some((entry) =>
        Object.values(entry.bindings).some((binding) =>
          JSON.stringify(binding).includes("file_finder")
        )
      ),
      false,
      "D007 target navigation must not depend on File Finder",
    );
    assert.equal(
      harnessSource.includes('"zed::InstallDevExtension"'),
      true,
      "D007 dev-extension installation must dispatch the public action directly",
    );
    const retiredInstallPaletteLiteral = ['set installAction to ', '"zed: install dev extension"'].join("");
    assert.equal(
      harnessSource.includes(retiredInstallPaletteLiteral),
      false,
      "D007 dev-extension installation must not depend on command-palette search",
    );
    assert.equal(
      harnessSource.includes('targeting: "fresh-foreground-cli-launch-target"'),
      true,
      "D007 exact-file targeting must use a fresh foreground CLI launch target",
    );
    assert.equal(fs.existsSync(path.join(manifest.profile, "extensions", "work", "java")), false,
      "D007 staging must not copy the Java extension work directory");

    fs.writeFileSync(path.join(manifest.evidence, "runtime.log"), "standalone spring ok\n");
    assert.equal(summarize(root).privateBoundary, "PASS");
    fs.appendFileSync(path.join(manifest.evidence, "runtime.log"), "java/proxy forbidden\n");
    assert.equal(summarize(root).privateBoundary, "FAIL");

    const readinessLog = path.join(manifest.evidence, "readiness.log");
    fs.writeFileSync(readinessLog, "old-log\n");
    const readinessRecord = {
      pid: process.pid,
      userDataDir: manifest.profile,
      logPath: readinessLog,
      logStartOffset: fileSize(readinessLog),
    };
    // Foreground output is diagnostic only. Readiness is bound to the actual
    // isolated app process, so stale/new log bytes cannot satisfy it by themselves.
    assert.equal(fileSize(readinessLog) > readinessRecord.logStartOffset, false);
    fs.appendFileSync(readinessLog, "new-log\n");
    assert.equal(fileSize(readinessLog) > readinessRecord.logStartOffset, true);

    const fakeIndex = path.join(scratch, "dev-extension-index.json");
    const fakeWasm = path.join(scratch, "extension.wasm");
    fs.writeFileSync(fakeIndex, JSON.stringify({ extensions: { "spring-tools": {} } }));
    assert.equal(devExtensionReady(fakeIndex, fakeWasm), false, "registration without a fresh WASM must not be ready");
    fs.writeFileSync(fakeWasm, "wasm");
    assert.equal(devExtensionReady(fakeIndex, fakeWasm), true, "registered extension with non-empty WASM is ready");

    assert.deepEqual(
      completionObservation("no completion evidence"),
      {
        requestObserved: false,
        expectedRequestObserved: false,
        requestUri: null,
        requestLine: null,
        requestCharacter: null,
        responseObserved: false,
        expectedResponseObserved: false,
        itemCount: null,
        serverPortObserved: false,
      },
    );
    assert.deepEqual(
      completionObservation('{"event":"completion-request"}'),
      {
        requestObserved: true,
        expectedRequestObserved: true,
        requestUri: null,
        requestLine: null,
        requestCharacter: null,
        responseObserved: false,
        expectedResponseObserved: false,
        itemCount: null,
        serverPortObserved: false,
      },
    );
    assert.deepEqual(
      springTargetReadiness([
        '{"event":"coordinator-start"}',
        '{"event":"document-open","uri":"file:///fixture/application-d007.properties"}',
        '{"event":"spring-index-updated","affectedProjectCount":1}',
      ].join("\n"), "file:///fixture/application-d007.properties"),
      {
        coordinatorStarted: true,
        targetDocumentOpened: true,
        indexReady: true,
      },
    );
    assert.deepEqual(
      completionObservation([
        '{"event":"completion-request"}',
        '{"event":"completion-response","itemCount":12,"serverPort":false}',
      ].join("\n")),
      {
        requestObserved: true,
        expectedRequestObserved: true,
        requestUri: null,
        requestLine: null,
        requestCharacter: null,
        responseObserved: true,
        expectedResponseObserved: true,
        itemCount: 12,
        serverPortObserved: false,
      },
    );
    assert.deepEqual(
      completionObservation([
        '{"event":"completion-request"}',
        '{"event":"completion-response","itemCount":37,"serverPort":true}',
      ].join("\n")),
      {
        requestObserved: true,
        expectedRequestObserved: true,
        requestUri: null,
        requestLine: null,
        requestCharacter: null,
        responseObserved: true,
        expectedResponseObserved: true,
        itemCount: 37,
        serverPortObserved: true,
      },
    );

    const sharedLog = path.join(scratch, "shared-zed.log");
    const foreground = path.join(manifest.evidence, "zed-maven-foreground.log");
    fs.writeFileSync(sharedLog, "");
    fs.writeFileSync(foreground, "textDocument/completion server.port\n");
    const staleBaseline = runtimeSnapshot(manifest, sharedLog, 0);
    assert.throws(
      () => waitForRuntimeEvidence(
        manifest,
        sharedLog,
        0,
        staleBaseline,
        ["textDocument/completion", "server.port"],
        "fresh completion evidence",
        20,
        null,
        5,
        2,
      ),
      /timed out waiting for fresh completion evidence/,
      "pre-baseline completion evidence must not satisfy a new probe",
    );

    let evidenceRetries = 0;
    waitForRuntimeEvidence(
      manifest,
      sharedLog,
      0,
      runtimeSnapshot(manifest, sharedLog, 0),
      ["textDocument/completion", "server.port"],
      "retried completion evidence",
      100,
      () => {
        evidenceRetries += 1;
        fs.appendFileSync(foreground, "textDocument/completion server.port\n");
      },
      10,
      2,
    );
    assert.equal(evidenceRetries >= 1, true, "runtime evidence wait must exercise bounded retry");

    const retriedFile = path.join(scratch, "debug.json");
    let fileRetries = 0;
    waitForFileWithRetry(
      retriedFile,
      "retried debug config",
      100,
      () => {
        fileRetries += 1;
        fs.writeFileSync(retriedFile, "{}\n");
      },
      10,
      2,
    );
    assert.equal(fileRetries >= 1, true, "file wait must exercise bounded retry");

    const generatedDebug = path.join(scratch, "generated-debug.json");
    const generatedTasks = path.join(scratch, "generated-tasks.json");
    fs.writeFileSync(generatedDebug, JSON.stringify([{
      adapter: "Java",
      request: "launch",
      mainClass: "dev.zed.spring.fixture.FixtureApplication",
      cwd: "$ZED_WORKTREE_ROOT",
    }]));
    fs.writeFileSync(generatedTasks, JSON.stringify([{
      label: "Spring Boot (zed-spring-tools): fixture (run)",
      command: "./gradlew",
      args: ["bootRun"],
      cwd: "$ZED_WORKTREE_ROOT",
      env: {},
    }]));
    assert.deepEqual(
      validateGeneratedRunDebug("gradle", generatedDebug, generatedTasks),
      { expectedRunCommand: "./gradlew", runTask: "PASS", debugConfig: "PASS" },
    );
    fs.writeFileSync(generatedTasks, JSON.stringify([{
      label: "Spring Boot (zed-spring-tools): fixture (run)",
      command: "gradle",
      args: ["bootRun"],
      cwd: "$ZED_WORKTREE_ROOT",
      env: {},
    }]));
    assert.equal(
      validateGeneratedRunDebug("gradle", generatedDebug, generatedTasks).runTask,
      "FAIL",
      "D007 must reject a Gradle fixture that bypasses its checked-in wrapper",
    );

    const fakeReadyRecord = { pid: 4242, userDataDir: "/tmp/d007-profile" };
    const fakePs = [
      "  4242  4242 S /Applications/Zed.app/Contents/MacOS/cli --foreground --user-data-dir /tmp/d007-profile",
      "  4243  4242 S /Applications/Zed.app/Contents/MacOS/zed zed://cli/fake --user-data-dir /tmp/other-profile",
      "  4244  4242 Z /Applications/Zed.app/Contents/MacOS/zed zed://cli/fake --user-data-dir /tmp/d007-profile",
      "  4245  4242 S /Applications/Zed.app/Contents/MacOS/zed zed://cli/fake --user-data-dir /tmp/d007-profile",
    ].join("\n");
    assert.deepEqual(
      findIsolatedZedProcess(fakePs, fakeReadyRecord),
      {
        pid: 4245,
        pgid: 4242,
        state: "S",
        command: "/Applications/Zed.app/Contents/MacOS/zed zed://cli/fake --user-data-dir /tmp/d007-profile",
      },
      "D007 readiness must bind to the live Zed app in the launch process group and exact isolated profile",
    );
    assert.equal(
      findIsolatedZedProcess(
        "  4242  4242 S /Applications/Zed.app/Contents/MacOS/cli --foreground --user-data-dir /tmp/d007-profile\n",
        fakeReadyRecord,
      ),
      undefined,
      "the CLI launcher alone must not satisfy Zed app readiness",
    );

    const primaryFailure = new Error("primary failure");
    writeGateFailure(manifest, "self-test-primary", primaryFailure);
    const recordedFailure = JSON.parse(
      fs.readFileSync(path.join(manifest.evidence, "gate-failure.json"), "utf8"),
    );
    assert.equal(recordedFailure.phase, "self-test-primary");
    assert.equal(recordedFailure.message, "primary failure");

    assert.equal(
      processGroupHasLiveMember("  101 S\n  101 Z\n  202 S\n", 101),
      true,
      "a process group with a live member must remain live even if another member is zombie",
    );
    assert.equal(
      processGroupHasLiveMember("  101 Z\n  101 Z+\n  202 S\n", 101),
      false,
      "a zombie-only process group must count as stopped",
    );

    assert.throws(() => stage(javaProfile, root, javaHome), /must be fresh/);
    process.stdout.write("D007 Zed desktop validation self-test: ok\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  }
}
