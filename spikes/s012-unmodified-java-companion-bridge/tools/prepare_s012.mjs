#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const JAVA_COMMIT = "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
const JDT_DIRECTORY = "jdt-language-server-1.60.0-202606262232";
const JDT_TREE = "b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583";
const OFFICIAL_JAVA_TREE = "58e1155d9a6339790470e0b1ac31e49a7fd771a0412b168b22165433347fae68";
const ADAPTER_ID = "s012-unmodified-java-companion";
const SERVER_NAME = "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";
const SPRING_LIBRARY_COUNT = 168;
const SPRING_LIBRARY_SET = "f1fe021fac5e94bd394ee2be1792dd385b5ce30bd527c67e7c7e77d87aeea56c";

const ARTIFACTS = Object.freeze({
  officialJavaWasm: artifact(2_128_402, "62dbf7edbe1ef4066f74e588dcec68d223ab7984f1861b59e44db0b10f52e3fd"),
  officialJavaManifest: artifact(824, "db05627157294b03a3e09cdf72fad1ada97506cd49c0c262caf979524f564f7b"),
  javaIndex: artifact(2_265, "8b41695750c2175a0a3179c87c62552f4e917cd5ccde3c09558f304000dccb68"),
  officialProxy: artifact(834_304, "53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076"),
  javaTaskHelper: artifact(542_960, "e9b1028b2fa5201c787bf2b22849a9ff11d0859fc5745fd59aaa20e77846e0e7"),
  javaDebug: artifact(3_107_682, "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c"),
  catalog: artifact(413_663, "f91a3840453686a21fc2b1508c645c1affd939b1448105cf10438d11b71c4d02"),
  adapterLock: artifact(-1, "596b4cce99860294bcb123837324d0571d739cf9f1eb42bcbccff915037f91f5"),
  adapterWasm: artifact(237_084, "3641228bf613c302515aa833b1d028405f79fa9e44cc69abb109ddf41ee4486d"),
  adapterCargo: artifact(177, "15d45b7d2f105b2ace2a36c6ba78ea79762acdfa3d4faf8cd938dc1ba24e6413"),
  adapterSource: artifact(7_625, "bb5f4a6219ff12c3184e5c4c54d1f1747f851c9f27ee6057fa267bcca1c40a4f"),
  adapterManifest: artifact(563, "d78c48be0faa18a81f821cbc27b9956d0c5f2c8030d8edad3be6a3ce03392e10"),
  bridge: artifact(12_104, "0d253fb645d5df05304ae916f9267365737d9870816624e692aae4134c12264b"),
  springServer: artifact(-1, "ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1"),
  baseProxy: artifact(-1, "bc504acc16d47c2074348db3e1f667b914c7304701c604b5b538115d2463369b"),
  wrapper: artifact(-1, "48fb355468b0b54a6c87481df2f0927e45b401398eccd00086c6a6c91135fd50"),
  bridgeEventRoute: artifact(-1, "69c007ae387b129c8f2d61b26daee4f1204200878376b24d35fe9ed5e9064775"),
  bridgeSession: artifact(-1, "17a19f497a3d3e540e2b747f95c6c6753b42ffb74a4393e990e5bf8b7f86ee9c"),
  officialTransport: artifact(-1, "00442f79bfb48232e958ec372cefef9825d615a66beecfa3087532e3d5bef67f"),
  java: artifact(70_432, "0a1eea36b7899323b32caab6f1d0e416ad7208792b076391278062efab4b15d8"),
});

const BUNDLES = Object.freeze({
  "io.projectreactor.reactor-core.jar": artifact(1_627_393, "76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590"),
  "org.reactivestreams.reactive-streams.jar": artifact(21_386, "71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038"),
  "jdt-ls-commons.jar": artifact(140_287, "0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69"),
  "jdt-ls-extension.jar": artifact(23_886, "692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce"),
  "sts-gradle-tooling.jar": artifact(8_293, "9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4"),
});

const ADAPTER_INDEX_ENTRY = `
    "${ADAPTER_ID}": {
      "manifest": {
        "id": "${ADAPTER_ID}",
        "name": "S012 Unmodified Java Companion Probe",
        "version": "0.0.1",
        "schema_version": 1,
        "description": "Disposable Spring bridge probe requiring the official Zed Java extension.",
        "repository": "https://github.com/luceat-lux-vestra/zed-spring-tools",
        "authors": ["Zed Spring Tools Contributors"],
        "lib": {"kind": "Rust", "version": null},
        "themes": [],
        "icon_themes": [],
        "languages": [],
        "grammars": {},
        "language_servers": {
          "${ADAPTER_ID}": {
            "language": null,
            "languages": ["Java", "Properties"],
            "language_ids": {"Java": "java", "Properties": "spring-boot-properties"},
            "code_action_kinds": null
          }
        },
        "context_servers": {},
        "slash_commands": {},
        "snippets": null,
        "capabilities": []
      },
      "dev": false
    }`;

function artifact(size, sha256) {
  return Object.freeze({ size, sha256 });
}

async function main(args) {
  if (args.length === 1 && args[0] === "--self-test") {
    await selfTest();
    process.stdout.write("S012 preparation synthetic tests passed\n");
    return;
  }
  if (args.length !== 20 || args[0] !== "--prepare") {
    throw new Error(
      "usage: prepare_s012.mjs --self-test\n" +
        "   or: prepare_s012.mjs --prepare <repo> <official-java-extension> " +
        "<java-only-index> <jdtls> <official-proxy> <task-helper> <java-debug> " +
        "<catalog> <spring-worktree> <adapter-build> <bridge-jar> <java-home> " +
        "<fresh-profile> <fresh-worktree> <fresh-xdg-config> <fresh-xdg-cache> " +
        "<fresh-xdg-data> <fresh-xdg-state> <fresh-evidence>",
    );
  }
  const result = await prepare(args.slice(1).map((value) => path.resolve(value)));
  for (const [key, value] of Object.entries(result)) {
    process.stdout.write(`${key}=${value}\n`);
  }
}

async function prepare(values) {
  const [
    repository,
    officialJava,
    javaIndex,
    jdtls,
    officialProxy,
    taskHelper,
    javaDebug,
    catalog,
    springWorktree,
    adapterBuild,
    bridgeJar,
    javaHome,
    profile,
    worktree,
    xdgConfig,
    xdgCache,
    xdgData,
    xdgState,
    evidence,
  ] = values;
  await selfTest();
  await verifyInputs({
    repository,
    officialJava,
    javaIndex,
    jdtls,
    officialProxy,
    taskHelper,
    javaDebug,
    catalog,
    springWorktree,
    adapterBuild,
    bridgeJar,
    javaHome,
  });
  await verifyNoRuntimeProcesses();
  verifyTokenEnvironment();

  const destinations = [profile, worktree, xdgConfig, xdgCache, xdgData, xdgState, evidence];
  await requireFreshDestinations(repository, destinations);
  const runtime = runtimePaths(xdgCache, worktree);
  const officialPort = path.join(
    profile,
    "extensions/work/java/proxy",
    proxyId(worktree),
  );
  assert.equal(await exists(runtime.data), false);
  assert.equal(await exists(officialPort), false);

  const transaction = await mkdtemp(path.join(repository, "tmp", ".s012-transaction-"));
  const stages = destinations.map((_, index) => path.join(transaction, `stage-${index}`));
  for (const stage of stages) await mkdir(stage);
  try {
    await stageProfile({
      repository,
      officialJava,
      javaIndex,
      jdtls,
      officialProxy,
      taskHelper,
      javaDebug,
      adapterBuild,
      javaHome,
      finalProfile: profile,
      stage: stages[0],
    });
    await stageWorktree({
      repository,
      springWorktree,
      bridgeJar,
      officialPort,
      stage: stages[1],
    });
    const stagedCatalog = path.join(stages[3], "tooling/gradle/versions.json");
    await mkdir(path.dirname(stagedCatalog), { recursive: true });
    await copyFile(catalog, stagedCatalog);

    await verifyFinalStages({
      repository,
      profile: stages[0],
      worktree: stages[1],
      xdgConfig: stages[2],
      xdgCache: stages[3],
      xdgData: stages[4],
      xdgState: stages[5],
      javaHome,
      finalProfile: profile,
      officialPort,
    });
    const manifest = new Map([
      ["status", "s012-gate-b-prepared"],
      ["target", "macOS-arm64-jdk25"],
      ["official-java-version", "6.8.21"],
      ["official-java-commit", JAVA_COMMIT],
      ["official-java-tree-sha256", OFFICIAL_JAVA_TREE],
      ["official-java-wasm-sha256", ARTIFACTS.officialJavaWasm.sha256],
      ["official-proxy-sha256", ARTIFACTS.officialProxy.sha256],
      ["jdt-tree-sha256", JDT_TREE],
      ["adapter-wasm-sha256", ARTIFACTS.adapterWasm.sha256],
      ["bridge-jar-sha256", ARTIFACTS.bridge.sha256],
      ["profile", profile],
      ["worktree", worktree],
      ["xdg-config-home", xdgConfig],
      ["xdg-cache-home", xdgCache],
      ["xdg-data-home", xdgData],
      ["xdg-state-home", xdgState],
      ["worktree-sha1", runtime.hash],
      ["expected-data", runtime.data],
      ["official-java-port-file", officialPort],
      ["injected-bundle-count", "6"],
      ["second-jdt-launcher", "absent"],
      ["managed-jdt-fallback", "absent"],
      ["instrumented-java-proxy", "absent"],
      ["runtime-processes", "absent"],
      ["routes-and-credentials", "absent"],
    ]);
    await writeManifest(path.join(stages[0], "s012-prepared-manifest.txt"), manifest);
    await writeManifest(path.join(stages[6], "s012-prepared-manifest.txt"), manifest);
    await moveTransactionally(stages, destinations);
    return {
      status: "s012-gate-b-prepared",
      profile,
      worktree,
      expectedData: runtime.data,
      officialJavaPortFile: officialPort,
      manifest: path.join(evidence, "s012-prepared-manifest.txt"),
    };
  } finally {
    await rm(transaction, { recursive: true, force: true });
  }
}

async function verifyInputs(input) {
  await requireDirectory(input.repository, "repository");
  await requireDirectory(input.officialJava, "official Java extension");
  assert.equal(await treeSha256(input.officialJava), OFFICIAL_JAVA_TREE);
  await verifyArtifact(path.join(input.officialJava, "extension.wasm"), ARTIFACTS.officialJavaWasm);
  await verifyArtifact(path.join(input.officialJava, "extension.toml"), ARTIFACTS.officialJavaManifest);
  await verifyComponent(path.join(input.officialJava, "extension.wasm"));
  await verifyArtifact(input.javaIndex, ARTIFACTS.javaIndex);
  await requireDirectory(input.jdtls, "JDT LS");
  assert.equal(await treeSha256(input.jdtls), JDT_TREE);
  assert.equal(await exists(path.join(input.jdtls, "configuration")), false);
  await verifyArtifact(input.officialProxy, ARTIFACTS.officialProxy);
  await verifyArtifact(input.taskHelper, ARTIFACTS.javaTaskHelper);
  await verifyArtifact(input.javaDebug, ARTIFACTS.javaDebug);
  await verifyArtifact(input.catalog, ARTIFACTS.catalog);
  await verifyArtifact(input.bridgeJar, ARTIFACTS.bridge);
  await verifyArtifact(path.join(input.adapterBuild, "Cargo.lock"), ARTIFACTS.adapterLock);
  await verifyArtifact(
    path.join(input.adapterBuild, "target/wasm32-wasip2/release/s012_unmodified_java_companion.wasm"),
    ARTIFACTS.adapterWasm,
  );
  await verifyComponent(
    path.join(input.adapterBuild, "target/wasm32-wasip2/release/s012_unmodified_java_companion.wasm"),
  );
  await verifyArtifact(
    path.join(input.repository, "spikes/s012-unmodified-java-companion-bridge/extension/extension.toml"),
    ARTIFACTS.adapterManifest,
  );
  await verifyArtifact(
    path.join(input.repository, "spikes/s012-unmodified-java-companion-bridge/extension/Cargo.toml"),
    ARTIFACTS.adapterCargo,
  );
  await verifyArtifact(
    path.join(input.repository, "spikes/s012-unmodified-java-companion-bridge/extension/src/lib.rs"),
    ARTIFACTS.adapterSource,
  );
  await verifySpringInput(input.springWorktree);
  await verifyProbeSources(input.repository);
  await verifyArtifact(path.join(input.javaHome, "bin/java"), ARTIFACTS.java);
}

async function verifySpringInput(worktree) {
  await requireNames(worktree, new Set([".s006-artifacts", "pom.xml", "src"]));
  const hidden = path.join(worktree, ".s006-artifacts");
  await verifyArtifact(path.join(hidden, "spring", SERVER_NAME), ARTIFACTS.springServer);
  await verifySpringLibraries(path.join(hidden, "spring/lib"));
  for (const [name, expected] of Object.entries(BUNDLES)) {
    await verifyArtifact(path.join(hidden, "bundles", name), expected);
  }
  assert.equal(
    await readFile(path.join(worktree, "src/main/resources/application.properties"), "utf8"),
    "ser\n",
  );
  for (const forbidden of [".s006-state", ".s006-evidence", ".project", ".classpath", ".settings", "target"]) {
    assert.equal(await exists(path.join(worktree, forbidden)), false);
  }
}

async function verifyProbeSources(repository) {
  const root = path.join(repository, "spikes/s012-unmodified-java-companion-bridge");
  await verifyArtifact(
    path.join(repository, "spikes/s006-spring-boot-end-to-end/extension/probe/spring_proxy.mjs"),
    ARTIFACTS.baseProxy,
  );
  await verifyArtifact(path.join(root, "extension/probe/spring_proxy.mjs"), ARTIFACTS.wrapper);
  await verifyArtifact(path.join(root, "coordinator/bridge_event_route.mjs"), ARTIFACTS.bridgeEventRoute);
  await verifyArtifact(path.join(root, "coordinator/companion_bridge_session.mjs"), ARTIFACTS.bridgeSession);
  await verifyArtifact(path.join(root, "coordinator/official_java_transport.mjs"), ARTIFACTS.officialTransport);
}

async function stageProfile(input) {
  const { stage } = input;
  await mkdir(path.join(stage, "config"), { recursive: true });
  await mkdir(path.join(stage, "fixed"), { recursive: true });
  await mkdir(path.join(stage, "extensions/installed"), { recursive: true });
  await mkdir(path.join(stage, "extensions/work/java/proxy"), { recursive: true });
  await copyTree(input.officialJava, path.join(stage, "extensions/installed/java"));
  const adapter = path.join(stage, "extensions/installed", ADAPTER_ID);
  await mkdir(adapter);
  await copyFile(
    path.join(input.repository, "spikes/s012-unmodified-java-companion-bridge/extension/extension.toml"),
    path.join(adapter, "extension.toml"),
  );
  await copyFile(
    path.join(input.adapterBuild, "target/wasm32-wasip2/release/s012_unmodified_java_companion.wasm"),
    path.join(adapter, "extension.wasm"),
  );
  await mkdir(path.join(stage, "extensions/work/java/jdtls"), { recursive: true });
  await copyTree(input.jdtls, path.join(stage, "extensions/work/java/jdtls", JDT_DIRECTORY));
  const helper = path.join(stage, "extensions/work/java/bin", JAVA_COMMIT, "java-task-helper");
  await mkdir(path.dirname(helper), { recursive: true });
  await copyFile(input.taskHelper, helper);
  await chmod(helper, 0o755);
  const proxy = path.join(stage, "fixed/java-lsp-proxy");
  await copyFile(input.officialProxy, proxy);
  await chmod(proxy, 0o755);
  await copyFile(input.javaDebug, path.join(stage, "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"));
  const sourceIndex = await readFile(input.javaIndex, "utf8");
  await writeFile(path.join(stage, "extensions/index.json"), combinedIndex(sourceIndex), "utf8");
  await writeFile(
    path.join(stage, "config/settings.json"),
    settings(input.javaHome, input.finalProfile),
    "utf8",
  );
}

async function stageWorktree(input) {
  await copyFile(path.join(input.springWorktree, "pom.xml"), path.join(input.stage, "pom.xml"));
  await copyTree(path.join(input.springWorktree, "src"), path.join(input.stage, "src"));
  const artifacts = path.join(input.stage, ".s012-artifacts");
  await mkdir(path.join(artifacts, "bundles"), { recursive: true });
  await mkdir(path.join(artifacts, "spring"), { recursive: true });
  await mkdir(path.join(artifacts, "probe"), { recursive: true });
  const source = path.join(input.springWorktree, ".s006-artifacts");
  await copyFile(path.join(source, "spring", SERVER_NAME), path.join(artifacts, "spring", SERVER_NAME));
  await copyTree(path.join(source, "spring/lib"), path.join(artifacts, "spring/lib"));
  for (const name of Object.keys(BUNDLES)) {
    await copyFile(path.join(source, "bundles", name), path.join(artifacts, "bundles", name));
  }
  await copyFile(input.bridgeJar, path.join(artifacts, "bundles/s012-bridge.jar"));
  const s012 = path.join(input.repository, "spikes/s012-unmodified-java-companion-bridge");
  await copyFile(
    path.join(input.repository, "spikes/s006-spring-boot-end-to-end/extension/probe/spring_proxy.mjs"),
    path.join(artifacts, "probe/s006_spring_proxy_base.mjs"),
  );
  await copyFile(path.join(s012, "extension/probe/spring_proxy.mjs"), path.join(artifacts, "probe/spring_proxy.mjs"));
  await copyFile(path.join(s012, "coordinator/bridge_event_route.mjs"), path.join(artifacts, "probe/bridge_event_route.mjs"));
  await copyFile(path.join(s012, "coordinator/companion_bridge_session.mjs"), path.join(artifacts, "probe/companion_bridge_session.mjs"));
  await copyFile(path.join(s012, "coordinator/official_java_transport.mjs"), path.join(artifacts, "probe/official_java_transport.mjs"));
  await writeFile(
    path.join(artifacts, "official-java-port-path.txt"),
    `${input.officialPort}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

async function verifyFinalStages(input) {
  await requireNames(input.profile, new Set(["config", "extensions", "fixed"]));
  assert.equal(
    await treeSha256(path.join(input.profile, "extensions/installed/java")),
    OFFICIAL_JAVA_TREE,
  );
  await verifyArtifact(path.join(input.profile, "fixed/java-lsp-proxy"), ARTIFACTS.officialProxy);
  await verifyArtifact(
    path.join(input.profile, "extensions/installed", ADAPTER_ID, "extension.wasm"),
    ARTIFACTS.adapterWasm,
  );
  const stagedJdt = path.join(input.profile, "extensions/work/java/jdtls", JDT_DIRECTORY);
  assert.equal(await treeSha256(stagedJdt), JDT_TREE);
  assert.equal(await exists(path.join(stagedJdt, "configuration")), false);
  const launchers = (await listFiles(path.join(stagedJdt, "plugins"))).filter((name) =>
    /^org\.eclipse\.equinox\.launcher_.*\.jar$/.test(name),
  );
  assert.equal(launchers.length, 1);
  assert.equal(
    await readFile(path.join(input.profile, "config/settings.json"), "utf8"),
    settings(input.javaHome, input.finalProfile),
  );
  const index = await readFile(path.join(input.profile, "extensions/index.json"), "utf8");
  assert.equal(count(index, '"id": "java"'), 1);
  assert.equal(count(index, `"id": "${ADAPTER_ID}"`), 1);
  assert.equal(index.includes('"id": "html"'), false);
  await requireNames(input.worktree, new Set([".s012-artifacts", "pom.xml", "src"]));
  const artifacts = path.join(input.worktree, ".s012-artifacts");
  await requireNames(artifacts, new Set(["bundles", "official-java-port-path.txt", "probe", "spring"]));
  await requireNames(
    path.join(artifacts, "bundles"),
    new Set([...Object.keys(BUNDLES), "s012-bridge.jar"]),
  );
  await verifyArtifact(path.join(artifacts, "bundles/s012-bridge.jar"), ARTIFACTS.bridge);
  assert.equal(
    (await readFile(path.join(artifacts, "official-java-port-path.txt"), "utf8")).trim(),
    input.officialPort,
  );
  for (const forbidden of [".s012-state", ".s012-evidence", ".project", ".classpath", ".settings", "target"]) {
    assert.equal(await exists(path.join(input.worktree, forbidden)), false);
  }
  await requireNames(input.xdgConfig, new Set());
  await requireNames(input.xdgData, new Set());
  await requireNames(input.xdgState, new Set());
  await verifyArtifact(path.join(input.xdgCache, "tooling/gradle/versions.json"), ARTIFACTS.catalog);
  assert.equal(await exists(input.officialPort), false);
}

function combinedIndex(source) {
  const marker = '\n  },\n  "themes": {}';
  const position = source.indexOf(marker);
  assert.ok(position > 0 && source.indexOf(marker, position + 1) < 0);
  const prefix = source.slice(0, position);
  assert.ok(prefix.endsWith("    }"));
  return `${prefix},${ADAPTER_INDEX_ENTRY}${source.slice(position)}`;
}

function settings(javaHome, profile) {
  return `${JSON.stringify(
    {
      disable_ai: true,
      session: { restore_unsaved_buffers: false, trust_all_worktrees: true },
      auto_install_extensions: { html: false },
      auto_update_extensions: { java: false, [ADAPTER_ID]: false },
      log: { lsp: "trace", project: "warn" },
      languages: {
        Java: { language_servers: ["jdtls", ADAPTER_ID] },
        Properties: { language_servers: [ADAPTER_ID] },
      },
      lsp: {
        jdtls: {
          settings: {
            java_home: javaHome,
            lsp_proxy_path: path.join(profile, "fixed/java-lsp-proxy"),
            java_debug_jar: path.join(profile, "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"),
            lombok_support: false,
            jdk_auto_download: false,
            check_updates: "never",
          },
        },
      },
    },
    null,
    2,
  )}\n`;
}

async function verifySpringLibraries(directory) {
  const names = await listFiles(directory);
  assert.equal(names.length, SPRING_LIBRARY_COUNT);
  const digest = createHash("sha256");
  for (const name of names.sort()) {
    const file = path.join(directory, name);
    assert.ok(name.endsWith(".jar"));
    digest.update(name).update("\0");
    digest.update(String((await stat(file)).size)).update("\0");
    digest.update(await sha256(file)).update("\n");
  }
  assert.equal(digest.digest("hex"), SPRING_LIBRARY_SET);
}

async function verifyNoRuntimeProcesses() {
  const { stdout } = await runFile("ps", ["-axo", "pid=,ppid=,comm=,args="], {
    encoding: "utf8",
  });
  for (const line of stdout.split("\n")) {
    const value = line.trim();
    if (value === "") continue;
    const match = /^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(value);
    assert.notEqual(match, null, "unexpected ps output");
    const pid = Number.parseInt(match[1], 10);
    if (pid === process.pid || pid === process.ppid) continue;
    const command = `${match[3]} ${match[4]}`;
    assert.equal(
      command.includes("java-lsp-proxy") ||
        command.includes("org.eclipse.equinox.launcher_") ||
        command.includes(SERVER_NAME) ||
        command.includes(".s012-artifacts/probe/spring_proxy.mjs"),
      false,
      "an S012 runtime process is already running",
    );
  }
}

function verifyTokenEnvironment() {
  for (const name of ["GH_COPILOT_TOKEN", "GITHUB_COPILOT_TOKEN"]) {
    assert.equal(process.env[name], undefined, `${name} must be absent`);
  }
}

async function requireFreshDestinations(repository, destinations) {
  const tmp = path.join(repository, "tmp");
  await requireDirectory(tmp, "repository tmp");
  assert.equal(new Set(destinations).size, destinations.length);
  for (const destination of destinations) {
    assert.equal(path.dirname(destination), tmp);
    assert.ok(path.basename(destination).startsWith("s012"));
    assert.equal(await exists(destination), false, `destination exists: ${destination}`);
  }
}

async function moveTransactionally(stages, destinations) {
  const moved = [];
  try {
    for (let index = 0; index < stages.length; index += 1) {
      assert.equal(await exists(destinations[index]), false);
      await rename(stages[index], destinations[index]);
      moved.push(destinations[index]);
    }
  } catch (error) {
    for (const destination of moved.reverse()) {
      await rm(destination, { recursive: true, force: true });
    }
    throw error;
  }
}

async function copyTree(source, destination) {
  await requireDirectory(source, "copy source");
  assert.equal(await exists(destination), false);
  await mkdir(destination);
  await copyTreeContents(source, destination);
}

async function copyTreeContents(source, destination) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    const metadata = await lstat(from);
    assert.equal(metadata.isSymbolicLink(), false);
    if (metadata.isDirectory()) {
      await mkdir(to);
      await copyTreeContents(from, to);
    } else {
      assert.ok(metadata.isFile());
      await copyFile(from, to);
    }
  }
}

async function treeSha256(root) {
  await requireDirectory(root, "tree root");
  const digest = createHash("sha256");
  async function visit(directory, relative) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const child = relative === "" ? entry.name : path.join(relative, entry.name);
      const metadata = await lstat(absolute);
      assert.equal(metadata.isSymbolicLink(), false);
      if (metadata.isDirectory()) {
        digest.update(`D\0${child}\n`);
        await visit(absolute, child);
      } else {
        assert.ok(metadata.isFile());
        digest.update(`F\0${child}\0${metadata.size}\0${await sha256(absolute)}\n`);
      }
    }
  }
  await visit(root, "");
  return digest.digest("hex");
}

async function verifyArtifact(file, expected) {
  await requireRegularFile(file, "artifact");
  const metadata = await stat(file);
  if (expected.size >= 0) assert.equal(metadata.size, expected.size, file);
  assert.equal(await sha256(file), expected.sha256, file);
}

async function verifyComponent(file) {
  const bytes = (await readFile(file)).subarray(0, 8);
  assert.deepEqual([...bytes], [0, 97, 115, 109, 13, 0, 1, 0]);
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function runtimePaths(cache, worktree) {
  const hash = createHash("sha1").update(worktree).digest("hex");
  return { hash, data: path.join(cache, `jdtls-${hash}`) };
}

function proxyId(worktree) {
  return Buffer.from(worktree.replace(/[\\/]$/, ""), "utf8").toString("hex");
}

async function writeManifest(file, values) {
  let text = "";
  for (const [key, value] of values) {
    assert.equal(key.includes("="), false);
    assert.equal(/[\r\n]/.test(value), false);
    text += `${key}=${value}\n`;
  }
  await writeFile(file, text, { encoding: "utf8", mode: 0o600 });
}

async function requireDirectory(directory, label) {
  const metadata = await lstat(directory);
  assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), `${label} is invalid`);
}

async function requireRegularFile(file, label) {
  const metadata = await lstat(file);
  assert.ok(metadata.isFile() && !metadata.isSymbolicLink(), `${label} is invalid`);
}

async function requireNames(directory, expected) {
  await requireDirectory(directory, "allowlisted directory");
  const actual = new Set((await readdir(directory)).sort());
  assert.deepEqual(actual, expected, directory);
}

async function listFiles(directory) {
  await requireDirectory(directory, "file directory");
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(entry.isFile() && !entry.isSymbolicLink());
    result.push(entry.name);
  }
  return result;
}

async function exists(value) {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

async function selfTest() {
  const root = await mkdtemp(path.join(os.tmpdir(), "s012-prepare-test-"));
  try {
    const tree = path.join(root, "tree");
    await mkdir(path.join(tree, "nested"), { recursive: true });
    await writeFile(path.join(tree, "a"), "alpha", "utf8");
    await writeFile(path.join(tree, "nested", "b"), "beta", "utf8");
    assert.match(await treeSha256(tree), /^[0-9a-f]{64}$/);
    const link = path.join(root, "link");
    await symlink(path.join(tree, "a"), link);
    await assert.rejects(requireRegularFile(link, "test symlink"));
    const sample = '{\n  "extensions": {\n    "java": {\n      "id": "java"\n    }\n  },\n  "themes": {},\n  "icon_themes": {},\n  "languages": {}\n}\n';
    const combined = combinedIndex(sample);
    assert.equal(count(combined, '"id": "java"'), 1);
    assert.equal(count(combined, `"id": "${ADAPTER_ID}"`), 1);
    assert.equal(
      proxyId("/tmp/space 한글/"),
      Buffer.from("/tmp/space 한글", "utf8").toString("hex"),
    );
    assert.notEqual(runtimePaths("/cache", "/tmp/a").data, runtimePaths("/cache", "/tmp/ab").data);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await main(process.argv.slice(2));
