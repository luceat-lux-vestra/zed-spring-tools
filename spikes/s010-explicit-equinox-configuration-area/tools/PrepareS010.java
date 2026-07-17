import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import java.util.zip.GZIPInputStream;

/**
 * Verifies the disposable S010 patch and path contract. Gate A does not apply
 * the patch, build the Java extension, prepare a Zed profile, or launch JDT.
 */
public final class PrepareS010 {
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int TAR_BLOCK_SIZE = 512;
    private static final int MAX_ARCHIVE_ENTRIES = 50_000;
    private static final long MAX_ENTRY_BYTES = 536_870_912L;
    private static final long MAX_EXTRACTED_BYTES = 1_073_741_824L;
    private static final int MAX_PAX_BYTES = 16 * 1024;
    private static final Set<String> ALLOWED_PAX_KEYS = Set.of("uid", "gid", "mtime");
    private static final String JAVA_SOURCE_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String PATCH_RELATIVE =
            "spikes/s010-explicit-equinox-configuration-area/extension/"
                    + "private_configuration.patch";
    private static final String FIXTURE_RELATIVE =
            "spikes/s010-explicit-equinox-configuration-area/fixture/"
                    + "S010Fixture.java";
    private static final String ALLOWED_SOURCE = "src/jdtls.rs";
    private static final String PATCH_SHA256 =
            "fa38c919943eee5eb1bbe9893fd7c13aedcd8fec07e5c1efed9a4a1c095e510f";
    private static final String FIXTURE_SHA256 =
            "1ebee7526689ef8ac8bdebe26f779c1f4433a273bc87e9fe2f5d3d285d19b520";
    private static final String CONFIGURATION_PROPERTY =
            "-Dosgi.configuration.area={}";
    private static final String CONFIGURATION_DERIVATION =
            "let jdtls_configuration_path = jdtls_data_path.join(\"configuration\");";
    private static final String DERIVATION_HUNK =
            "@@ -284 +284,2 @@ pub fn build_jdtls_launch_args(";
    private static final String CONFIGURATION_HUNK =
            "@@ -297,2 +298,6 @@ pub fn build_jdtls_launch_args(";
    private static final String PATCHED_SOURCE_BLOB =
            "ae2fcbb8e65824643bc21fdeead413ec689cd9f2";
    private static final String JDT_BUILD_DIRECTORY =
            "jdt-language-server-1.60.0-202606262232";
    private static final String JDT_TREE_SHA256 =
            "b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583";
    private static final String INSTALLED_JAVA_TREE_SHA256 =
            "58e1155d9a6339790470e0b1ac31e49a7fd771a0412b168b22165433347fae68";
    private static final String CARGO_LOCK_SHA256 =
            "6d8a9788e6727b3596488ddbf0919e743ef19c0f2e602f1a5cc782069513c583";
    private static final ArtifactSpec JDT_ARCHIVE = new ArtifactSpec(
            50_925_681L,
            "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d");
    private static final ArtifactSpec CONTROL_WASM = new ArtifactSpec(
            1_912_230L,
            "c016f6500b9b96e3dbc3a8d581c9e5860271f449c6cacdbb546fc82e00d8886d");
    private static final ArtifactSpec PATCHED_WASM = new ArtifactSpec(
            1_912_656L,
            "b1a2f6e21649c011e111058bcebad3d886baf3ee5e7de37d88a45d50ecffd2d4");
    private static final ArtifactSpec OFFICIAL_WASM = new ArtifactSpec(
            2_128_402L,
            "62dbf7edbe1ef4066f74e588dcec68d223ab7984f1861b59e44db0b10f52e3fd");
    private static final ArtifactSpec EXTENSION_MANIFEST = new ArtifactSpec(
            824L,
            "db05627157294b03a3e09cdf72fad1ada97506cd49c0c262caf979524f564f7b");
    private static final ArtifactSpec SOURCE_EXTENSION_INDEX = new ArtifactSpec(
            2_265L,
            "8b41695750c2175a0a3179c87c62552f4e917cd5ccde3c09558f304000dccb68");
    private static final ArtifactSpec EXTENSION_INDEX = new ArtifactSpec(
            2_026L,
            "a734897946e174c3e2b63058bec95b98c281da9fa28726eacc5881d46b70e6eb");
    private static final ArtifactSpec JAVA_PROXY = new ArtifactSpec(
            834_304L,
            "53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076");
    private static final ArtifactSpec JAVA_DEBUG = new ArtifactSpec(
            3_107_682L,
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c");
    private static final ArtifactSpec TASK_HELPER = new ArtifactSpec(
            542_960L,
            "e9b1028b2fa5201c787bf2b22849a9ff11d0859fc5745fd59aaa20e77846e0e7");
    private static final ArtifactSpec CATALOG = new ArtifactSpec(
            413_663L,
            "f91a3840453686a21fc2b1508c645c1affd939b1448105cf10438d11b71c4d02");
    private static final ArtifactSpec ZED_DMG = new ArtifactSpec(
            143_545_589L,
            "717ab14826889b83ffb46992b5155cf3e32e801805044d5d739d893ffb19a1a0");
    private static final ArtifactSpec JAVA_BIN = new ArtifactSpec(
            70_432L,
            "0a1eea36b7899323b32caab6f1d0e416ad7208792b076391278062efab4b15d8");
    private static final ArtifactSpec JAVAC_BIN = new ArtifactSpec(
            70_464L,
            "b04c4b99d2aba55eca02bfc4158e26dc7c988fe45895a4a029cc109ef9e571ec");
    private static final Set<String> REQUIRED_MANIFEST_KEYS = Set.of(
            "status",
            "java-source-commit",
            "allowed-source",
            "patch-size",
            "patch-sha256",
            "fixture-size",
            "fixture-sha256",
            "configuration-property-count",
            "configuration-before-jar",
            "patch-apply-check",
            "synthetic-tests",
            "java-runtime");
    private static final Set<String> GATE_B_MANIFEST_KEYS = Set.of(
            "status", "java-source-commit", "patched-source-blob",
            "cargo-lock-sha256", "rustc-version", "cargo-version", "build-command",
            "control-wasm-size", "control-wasm-sha256", "patched-wasm-size",
            "patched-wasm-sha256", "official-java-tree-sha256",
            "patched-java-tree-sha256", "jdt-archive-size", "jdt-archive-sha256",
            "jdt-tree-sha256", "java-proxy-sha256", "java-debug-sha256",
            "task-helper-sha256", "catalog-sha256", "zed-dmg-sha256",
            "java-bin-sha256", "javac-bin-sha256", "profile", "worktree",
            "worktree-sha1", "worktree-tree-sha256", "xdg-config-home",
            "xdg-cache-home", "xdg-data-home", "xdg-state-home", "expected-data",
            "expected-configuration", "settings-sha256", "index-sha256",
            "catalog-mtime", "configuration-property-count", "configuration-before-jar",
            "fresh-jdt-configuration", "fresh-runtime-paths", "live-processes-at-prepare",
            "normal-zed-running", "token-environment", "gate-c-status");
    private static final String JAVA_ONLY_INDEX = """
            {
              "extensions": {
                "java": {
                  "manifest": {
                    "id": "java",
                    "name": "Java",
                    "version": "6.8.21",
                    "schema_version": 1,
                    "description": "Java support.",
                    "repository": "https://github.com/zed-extensions/java",
                    "authors": ["Java Extension Contributors"],
                    "lib": {"kind": "Rust", "version": "0.7.0"},
                    "themes": [],
                    "icon_themes": [],
                    "languages": ["languages/properties", "languages/java"],
                    "grammars": {
                      "java": {
                        "repository": "https://github.com/tree-sitter/tree-sitter-java",
                        "rev": "94703d5a6bed02b98e438d7cad1136c01a60ba2c",
                        "path": null
                      },
                      "properties": {
                        "repository": "https://github.com/tree-sitter-grammars/tree-sitter-properties",
                        "rev": "579b62f5ad8d96c2bb331f07d1408c92767531d9",
                        "path": null
                      }
                    },
                    "language_servers": {
                      "jdtls": {
                        "language": "Java",
                        "languages": [],
                        "language_ids": {},
                        "code_action_kinds": null
                      }
                    },
                    "context_servers": {},
                    "slash_commands": {},
                    "snippets": null,
                    "capabilities": [
                      {"kind": "process:exec", "command": "*", "args": ["-version"]}
                    ],
                    "debug_adapters": {"Java": {"schema_path": null}}
                  },
                  "dev": false
                }
              },
              "themes": {},
              "icon_themes": {},
              "languages": {
                "Java": {
                  "extension": "java",
                  "path": "languages/java",
                  "matcher": {
                    "path_suffixes": ["java"],
                    "first_line_pattern": null,
                    "modeline_aliases": []
                  },
                  "hidden": false,
                  "grammar": "java"
                },
                "Properties": {
                  "extension": "java",
                  "path": "languages/properties",
                  "matcher": {
                    "path_suffixes": ["properties"],
                    "first_line_pattern": null,
                    "modeline_aliases": []
                  },
                  "hidden": false,
                  "grammar": "properties"
                }
              }
            }
            """;

    private PrepareS010() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S010 Gate A synthetic tests passed");
            return;
        }
        if (args.length == 22 && args[0].equals("--gate-b")) {
            GateBResult result = prepareGateB(
                    Path.of(args[1]), Path.of(args[2]), Path.of(args[3]),
                    Path.of(args[4]), Path.of(args[5]), Path.of(args[6]),
                    Path.of(args[7]), Path.of(args[8]), Path.of(args[9]),
                    Path.of(args[10]), Path.of(args[11]), Path.of(args[12]),
                    Path.of(args[13]), Path.of(args[14]), Path.of(args[15]),
                    Path.of(args[16]), Path.of(args[17]), Path.of(args[18]),
                    Path.of(args[19]), Path.of(args[20]), Path.of(args[21]));
            System.out.println("status=gate-b-prepared");
            System.out.println("profile=" + result.profile());
            System.out.println("expected-data=" + result.data());
            System.out.println("expected-configuration=" + result.configuration());
            System.out.println("patched-java-tree-sha256=" + result.patchedJavaTree());
            System.out.println("manifest=" + result.manifest());
            return;
        }
        if (args.length != 4 || !args[0].equals("--gate-a")) {
            System.err.println(
                    "usage: java PrepareS010 --self-test\n"
                            + "   or: java PrepareS010 --gate-a <repository-root> "
                            + "<clean-java-checkout> <fresh-evidence-dir>\n"
                            + "   or: java PrepareS010 --gate-b <repository-root> "
                            + "<control-checkout> <patched-checkout> <control-wasm> "
                            + "<patched-wasm> <installed-java-template> <java-index> "
                            + "<jdt-archive> <java-proxy> <java-debug> <task-helper> "
                            + "<catalog> <zed-dmg> <java-home> <fresh-profile> "
                            + "<fresh-worktree> <fresh-xdg-config> <fresh-xdg-cache> "
                            + "<fresh-xdg-data> <fresh-xdg-state> <fresh-evidence>");
            System.exit(2);
        }

        Path manifest = verifyGateA(Path.of(args[1]), Path.of(args[2]), Path.of(args[3]));
        System.out.println("status=gate-a-validated");
        System.out.println("patch-sha256=" + PATCH_SHA256);
        System.out.println("fixture-sha256=" + FIXTURE_SHA256);
        System.out.println("manifest=" + manifest);
    }

    private static Path verifyGateA(Path repository, Path checkout, Path evidence)
            throws Exception {
        selfTest();
        Path repositoryRoot = requireDirectory(repository, "repository root");
        Path cleanCheckout = requireDirectory(checkout, "Java extension checkout");
        Path patch = requireRegularFile(repositoryRoot.resolve(PATCH_RELATIVE), "S010 patch");
        Path fixture = requireRegularFile(
                repositoryRoot.resolve(FIXTURE_RELATIVE), "S010 fixture");
        verifyHash(patch, PATCH_SHA256, "S010 patch");
        verifyHash(fixture, FIXTURE_SHA256, "S010 fixture");

        String patchText = Files.readString(patch, StandardCharsets.UTF_8);
        verifyPatchContract(patchText);
        verifyFixture(fixture);
        verifyCheckout(cleanCheckout, JAVA_SOURCE_COMMIT);
        run(cleanCheckout, "git", "apply", "--check", "--unidiff-zero",
                "--whitespace=error-all", patch.toString());

        Path output = normalized(evidence);
        requireFreshDestination(output, "Gate A evidence directory");
        try {
            Files.createDirectories(output);
            Map<String, String> values = new LinkedHashMap<>();
            values.put("status", "gate-a-validated");
            values.put("java-source-commit", JAVA_SOURCE_COMMIT);
            values.put("allowed-source", ALLOWED_SOURCE);
            values.put("patch-size", Long.toString(Files.size(patch)));
            values.put("patch-sha256", PATCH_SHA256);
            values.put("fixture-size", Long.toString(Files.size(fixture)));
            values.put("fixture-sha256", FIXTURE_SHA256);
            values.put("configuration-property-count", "1");
            values.put("configuration-before-jar", "true");
            values.put("patch-apply-check", "passed");
            values.put("synthetic-tests",
                    "patch-boundary;clean-checkout;paths;symlink;manifest;archive");
            values.put("java-runtime", singleLine(System.getProperty("java.runtime.version")));
            Path manifest = output.resolve("s010-gate-a-manifest.txt");
            writeManifest(manifest, values);
            verifyManifest(Files.readString(manifest, StandardCharsets.UTF_8));
            return manifest;
        } catch (Exception error) {
            deleteRecursively(output);
            throw error;
        }
    }

    private static GateBResult prepareGateB(
            Path repository,
            Path controlCheckout,
            Path patchedCheckout,
            Path controlWasm,
            Path patchedWasm,
            Path installedJavaTemplate,
            Path javaIndex,
            Path jdtArchive,
            Path javaProxy,
            Path javaDebug,
            Path taskHelper,
            Path catalog,
            Path zedDmg,
            Path javaHome,
            Path profile,
            Path worktree,
            Path xdgConfig,
            Path xdgCache,
            Path xdgData,
            Path xdgState,
            Path evidence) throws Exception {
        selfTest();
        Path repositoryRoot = requireDirectory(repository, "repository root");
        Path cleanControl = requireDirectory(controlCheckout, "control checkout");
        Path patchedSource = requireDirectory(patchedCheckout, "patched checkout");
        Path controlBinary = requireRegularFile(controlWasm, "control WASM");
        Path patchedBinary = requireRegularFile(patchedWasm, "patched WASM");
        Path installedTemplate = requireDirectory(
                installedJavaTemplate, "installed Java template");
        Path indexInput = requireRegularFile(javaIndex, "Java extension index");
        Path archiveInput = requireRegularFile(jdtArchive, "JDT archive");
        Path proxyInput = requireRegularFile(javaProxy, "Java proxy");
        Path debugInput = requireRegularFile(javaDebug, "Java debug bundle");
        Path helperInput = requireRegularFile(taskHelper, "Java task helper");
        Path catalogInput = requireRegularFile(catalog, "Gradle catalog");
        Path dmgInput = requireRegularFile(zedDmg, "Zed DMG");
        Path jdk = requireDirectory(javaHome, "Java home");

        Path patch = requireRegularFile(repositoryRoot.resolve(PATCH_RELATIVE), "S010 patch");
        Path fixture = requireRegularFile(repositoryRoot.resolve(FIXTURE_RELATIVE),
                "S010 fixture");
        verifyHash(patch, PATCH_SHA256, "S010 patch");
        verifyHash(fixture, FIXTURE_SHA256, "S010 fixture");
        verifyPatchContract(Files.readString(patch, StandardCharsets.UTF_8));
        verifyFixture(fixture);

        verifyCheckout(cleanControl, JAVA_SOURCE_COMMIT);
        verifyPatchedCheckout(patchedSource);
        verifyHash(cleanControl.resolve("Cargo.lock"), CARGO_LOCK_SHA256,
                "control Cargo.lock");
        verifyHash(patchedSource.resolve("Cargo.lock"), CARGO_LOCK_SHA256,
                "patched Cargo.lock");
        verifyArtifact(controlBinary, CONTROL_WASM, "control WASM");
        verifyArtifact(patchedBinary, PATCHED_WASM, "patched WASM");
        verifyWasm(controlBinary);
        verifyWasm(patchedBinary);
        require(!sha256(controlBinary).equals(sha256(patchedBinary)),
                "control and patched WASM are identical");

        verifyArtifact(installedTemplate.resolve("extension.wasm"),
                OFFICIAL_WASM, "official Java WASM");
        verifyArtifact(installedTemplate.resolve("extension.toml"),
                EXTENSION_MANIFEST, "Java extension manifest");
        require(treeSha256(installedTemplate).equals(INSTALLED_JAVA_TREE_SHA256),
                "installed Java template tree identity changed");
        verifyArtifact(indexInput, SOURCE_EXTENSION_INDEX,
                "source Java extension index");
        String indexText = Files.readString(indexInput, StandardCharsets.UTF_8);
        require(indexText.contains("\"id\": \"java\"")
                        && indexText.contains("\"version\": \"6.8.21\"")
                        && !indexText.contains("\"html\"")
                        && !indexText.contains("\"dev\": true"),
                "Java extension index exceeds the fixed identity");

        verifyArtifact(archiveInput, JDT_ARCHIVE, "JDT archive");
        verifyArtifact(proxyInput, JAVA_PROXY, "Java proxy");
        verifyArtifact(debugInput, JAVA_DEBUG, "Java debug bundle");
        verifyArtifact(helperInput, TASK_HELPER, "Java task helper");
        verifyArtifact(catalogInput, CATALOG, "Gradle catalog");
        verifyArtifact(dmgInput, ZED_DMG, "Zed DMG");
        Path java = requireRegularFile(jdk.resolve("bin/java"), "Java executable");
        Path javac = requireRegularFile(jdk.resolve("bin/javac"), "javac executable");
        verifyArtifact(java, JAVA_BIN, "Java executable");
        verifyArtifact(javac, JAVAC_BIN, "javac executable");
        require(run(jdk, java.toString(), "-version").contains("25.0.3"),
                "Java runtime version changed");
        require(run(jdk, javac.toString(), "-version").contains("25.0.3"),
                "javac version changed");
        verifyTokenEnvironment();
        verifyNoRuntimeProcesses(repositoryRoot);
        boolean normalZedRunning = isNormalZedRunning(repositoryRoot);

        Path outputProfile = normalized(profile);
        Path outputWorktree = normalized(worktree);
        Path outputXdgConfig = normalized(xdgConfig);
        Path outputXdgCache = normalized(xdgCache);
        Path outputXdgData = normalized(xdgData);
        Path outputXdgState = normalized(xdgState);
        Path outputEvidence = normalized(evidence);
        List<Path> destinations = List.of(
                outputProfile, outputWorktree, outputXdgConfig, outputXdgCache,
                outputXdgData, outputXdgState, outputEvidence);
        require(new HashSet<>(destinations).size() == destinations.size(),
                "Gate B destinations are not distinct");
        Path tmpRoot = requireDirectory(repositoryRoot.resolve("tmp"), "repository tmp");
        for (Path destination : destinations) {
            require(destination.getParent().equals(tmpRoot),
                    "Gate B destinations must be direct children of repository tmp");
            requireFreshDestination(destination, "Gate B destination");
        }
        RuntimePaths runtime = runtimePaths(outputWorktree, outputXdgCache);
        requireFreshDestination(runtime.data(), "expected JDT data");
        requireFreshDestination(runtime.configuration(), "expected private configuration");

        Path transaction = Files.createTempDirectory(tmpRoot, ".s010-transaction-");
        try {
            Path archiveStage = transaction.resolve("jdt-archive");
            extractTarGzip(archiveInput, archiveStage);
            requireNames(archiveStage, Set.of(
                    "bin", "features", "plugins", "config_linux",
                    "config_linux_arm", "config_mac", "config_mac_arm",
                    "config_ss_linux", "config_ss_linux_arm", "config_ss_mac",
                    "config_ss_mac_arm", "config_ss_win", "config_win"));
            Path jdt = requireDirectory(archiveStage, "fresh JDT tree");
            require(!Files.exists(jdt.resolve("configuration"), LinkOption.NOFOLLOW_LINKS),
                    "fresh JDT archive already contains private configuration");
            require(treeSha256(jdt).equals(JDT_TREE_SHA256),
                    "fresh JDT tree identity changed");

            Path profileStage = transaction.resolve("profile");
            Path worktreeStage = transaction.resolve("worktree");
            Path xdgConfigStage = transaction.resolve("xdg-config");
            Path xdgCacheStage = transaction.resolve("xdg-cache");
            Path xdgDataStage = transaction.resolve("xdg-data");
            Path xdgStateStage = transaction.resolve("xdg-state");
            Path evidenceStage = transaction.resolve("evidence");
            for (Path stage : List.of(profileStage, worktreeStage, xdgConfigStage,
                    xdgCacheStage, xdgDataStage, xdgStateStage, evidenceStage)) {
                Files.createDirectories(stage);
            }

            Path fixedProxy = profileStage.resolve("fixed/java-lsp-proxy");
            Path fixedDebug = profileStage.resolve(
                    "fixed/com.microsoft.java.debug.plugin-0.53.2.jar");
            Files.createDirectories(fixedProxy.getParent());
            Files.copy(proxyInput, fixedProxy);
            Files.copy(debugInput, fixedDebug);
            makeExecutable(fixedProxy);

            Path settings = profileStage.resolve("config/settings.json");
            Files.createDirectories(settings.getParent());
            Files.writeString(settings, settingsText(
                    jdk,
                    outputProfile.resolve("fixed/java-lsp-proxy"),
                    outputProfile.resolve(
                            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar")),
                    StandardCharsets.UTF_8);
            Path stagedIndex = profileStage.resolve("extensions/index.json");
            Files.createDirectories(stagedIndex.getParent());
            Files.writeString(stagedIndex, JAVA_ONLY_INDEX, StandardCharsets.UTF_8);
            verifyArtifact(stagedIndex, EXTENSION_INDEX,
                    "canonical Java extension index");

            Path stagedInstalled = profileStage.resolve("extensions/installed/java");
            copyTree(installedTemplate, stagedInstalled);
            Files.copy(patchedBinary, stagedInstalled.resolve("extension.wasm"),
                    StandardCopyOption.REPLACE_EXISTING);
            String patchedJavaTree = treeSha256(stagedInstalled);

            Path stagedJdt = profileStage.resolve(
                    "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY);
            copyTree(jdt, stagedJdt);
            makeExecutable(stagedJdt.resolve("bin/jdtls"));
            Path stagedHelper = profileStage.resolve(
                    "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper");
            Files.createDirectories(stagedHelper.getParent());
            Files.copy(helperInput, stagedHelper);
            makeExecutable(stagedHelper);
            Files.createDirectories(profileStage.resolve("extensions/work/java/proxy"));

            Files.copy(fixture, worktreeStage.resolve("S010Fixture.java"));
            Path stagedCatalog = xdgCacheStage.resolve("tooling/gradle/versions.json");
            Files.createDirectories(stagedCatalog.getParent());
            Files.copy(catalogInput, stagedCatalog);

            Map<String, String> manifest = gateBManifest(
                    cleanControl, patchedJavaTree, runtime, outputProfile, outputWorktree,
                    outputXdgConfig, outputXdgCache, outputXdgData, outputXdgState,
                    settings, stagedIndex, worktreeStage, stagedCatalog,
                    normalZedRunning, repositoryRoot);
            Path profileManifest = profileStage.resolve("s010-prepared-manifest.txt");
            Path evidenceManifest = evidenceStage.resolve("s010-gate-b-manifest.txt");
            writeGateBManifest(profileManifest, manifest);
            writeGateBManifest(evidenceManifest, manifest);
            verifyGateBManifest(profileManifest);
            verifyGateBManifest(evidenceManifest);

            verifyPreparedGateB(
                    profileStage, worktreeStage, xdgConfigStage, xdgCacheStage,
                    xdgDataStage, xdgStateStage, patchedJavaTree, settings,
                    outputProfile, jdk, fixedProxy, fixedDebug, stagedCatalog);
            verifyNoRuntimeProcesses(repositoryRoot);

            moveTransactionally(
                    List.of(profileStage, worktreeStage, xdgConfigStage, xdgCacheStage,
                            xdgDataStage, xdgStateStage, evidenceStage),
                    destinations);
            return new GateBResult(
                    outputProfile, runtime.data(), runtime.configuration(), patchedJavaTree,
                    outputEvidence.resolve("s010-gate-b-manifest.txt"));
        } finally {
            deleteRecursively(transaction);
        }
    }

    private static void verifyPatchedCheckout(Path checkout) throws Exception {
        require(run(checkout, "git", "rev-parse", "HEAD").equals(JAVA_SOURCE_COMMIT),
                "patched checkout source commit mismatch");
        require(run(checkout, "git", "status", "--porcelain=v1", "--untracked-files=all")
                        .equals("M " + ALLOWED_SOURCE),
                "patched checkout status exceeds the reviewed file");
        require(run(checkout, "git", "diff", "--name-only").equals(ALLOWED_SOURCE),
                "patched checkout changed-file set differs");
        require(run(checkout, "git", "diff", "--numstat")
                        .equals("5\t0\t" + ALLOWED_SOURCE),
                "patched checkout line change count differs");
        require(run(checkout, "git", "hash-object", ALLOWED_SOURCE)
                        .equals(PATCHED_SOURCE_BLOB),
                "patched source blob identity differs");
        run(checkout, "git", "diff", "--check");
    }

    private static Map<String, String> gateBManifest(
            Path controlCheckout,
            String patchedJavaTree,
            RuntimePaths runtime,
            Path profile,
            Path worktree,
            Path xdgConfig,
            Path xdgCache,
            Path xdgData,
            Path xdgState,
            Path settings,
            Path index,
            Path stagedWorktree,
            Path catalog,
            boolean normalZedRunning,
            Path repository) throws Exception {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("status", "gate-b-prepared");
        values.put("java-source-commit", JAVA_SOURCE_COMMIT);
        values.put("patched-source-blob", PATCHED_SOURCE_BLOB);
        values.put("cargo-lock-sha256", CARGO_LOCK_SHA256);
        values.put("rustc-version", singleLine(run(repository, "rustc", "--version")));
        values.put("cargo-version", singleLine(run(repository, "cargo", "--version")));
        values.put("build-command",
                "CARGO_INCREMENTAL=0 cargo build --release --locked --offline "
                        + "--target wasm32-wasip1 -p zed_java");
        values.put("control-wasm-size", Long.toString(CONTROL_WASM.size()));
        values.put("control-wasm-sha256", CONTROL_WASM.sha256());
        values.put("patched-wasm-size", Long.toString(PATCHED_WASM.size()));
        values.put("patched-wasm-sha256", PATCHED_WASM.sha256());
        values.put("official-java-tree-sha256", INSTALLED_JAVA_TREE_SHA256);
        values.put("patched-java-tree-sha256", patchedJavaTree);
        values.put("jdt-archive-size", Long.toString(JDT_ARCHIVE.size()));
        values.put("jdt-archive-sha256", JDT_ARCHIVE.sha256());
        values.put("jdt-tree-sha256", JDT_TREE_SHA256);
        values.put("java-proxy-sha256", JAVA_PROXY.sha256());
        values.put("java-debug-sha256", JAVA_DEBUG.sha256());
        values.put("task-helper-sha256", TASK_HELPER.sha256());
        values.put("catalog-sha256", CATALOG.sha256());
        values.put("zed-dmg-sha256", ZED_DMG.sha256());
        values.put("java-bin-sha256", JAVA_BIN.sha256());
        values.put("javac-bin-sha256", JAVAC_BIN.sha256());
        values.put("profile", profile.toString());
        values.put("worktree", worktree.toString());
        values.put("worktree-sha1", runtime.hash());
        values.put("worktree-tree-sha256", treeSha256(stagedWorktree));
        values.put("xdg-config-home", xdgConfig.toString());
        values.put("xdg-cache-home", xdgCache.toString());
        values.put("xdg-data-home", xdgData.toString());
        values.put("xdg-state-home", xdgState.toString());
        values.put("expected-data", runtime.data().toString());
        values.put("expected-configuration", runtime.configuration().toString());
        values.put("settings-sha256", sha256(settings));
        values.put("index-sha256", sha256(index));
        values.put("catalog-mtime", Long.toString(Files.getLastModifiedTime(catalog).toMillis()));
        values.put("configuration-property-count", "1");
        values.put("configuration-before-jar", "true");
        values.put("fresh-jdt-configuration", "absent");
        values.put("fresh-runtime-paths", "expected-data,expected-configuration");
        values.put("live-processes-at-prepare", "absent");
        values.put("normal-zed-running", Boolean.toString(normalZedRunning));
        values.put("token-environment", "absent");
        values.put("gate-c-status", "closed");
        require(run(controlCheckout, "git", "status", "--porcelain=v1").isEmpty(),
                "control checkout became dirty while recording the manifest");
        return values;
    }

    private static void writeGateBManifest(Path path, Map<String, String> values)
            throws IOException {
        require(values.keySet().equals(GATE_B_MANIFEST_KEYS),
                "Gate B manifest key set differs");
        StringBuilder text = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            text.append(entry.getKey()).append('=').append(singleLine(entry.getValue()))
                    .append('\n');
        }
        Files.writeString(path, text, StandardCharsets.UTF_8);
    }

    private static void verifyGateBManifest(Path path) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
            int separator = line.indexOf('=');
            require(separator > 0 && separator < line.length() - 1,
                    "Gate B manifest line is malformed");
            require(values.putIfAbsent(
                    line.substring(0, separator), line.substring(separator + 1)) == null,
                    "Gate B manifest contains a duplicate key");
        }
        require(values.keySet().equals(GATE_B_MANIFEST_KEYS),
                "Gate B manifest key set is incomplete");
        require(values.get("status").equals("gate-b-prepared")
                        && values.get("java-source-commit").equals(JAVA_SOURCE_COMMIT)
                        && values.get("patched-source-blob").equals(PATCHED_SOURCE_BLOB)
                        && values.get("control-wasm-sha256").equals(CONTROL_WASM.sha256())
                        && values.get("patched-wasm-sha256").equals(PATCHED_WASM.sha256())
                        && values.get("jdt-tree-sha256").equals(JDT_TREE_SHA256)
                        && values.get("configuration-property-count").equals("1")
                        && values.get("configuration-before-jar").equals("true")
                        && values.get("fresh-jdt-configuration").equals("absent")
                        && values.get("live-processes-at-prepare").equals("absent")
                        && values.get("token-environment").equals("absent")
                        && values.get("gate-c-status").equals("closed"),
                "Gate B manifest fixed constraints changed");
        require(values.get("worktree-sha1").matches("[0-9a-f]{40}"),
                "Gate B worktree SHA-1 is malformed");
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (entry.getKey().endsWith("sha256")) {
                require(entry.getValue().matches("[0-9a-f]{64}"),
                        "Gate B SHA-256 value is malformed");
            }
        }
    }

    private static void verifyPreparedGateB(
            Path profile,
            Path worktree,
            Path xdgConfig,
            Path xdgCache,
            Path xdgData,
            Path xdgState,
            String patchedJavaTree,
            Path settings,
            Path finalProfile,
            Path javaHome,
            Path fixedProxy,
            Path fixedDebug,
            Path catalog) throws IOException {
        requireNames(profile,
                Set.of("config", "fixed", "extensions", "s010-prepared-manifest.txt"));
        requireNames(profile.resolve("config"), Set.of("settings.json"));
        requireNames(profile.resolve("fixed"),
                Set.of("java-lsp-proxy", "com.microsoft.java.debug.plugin-0.53.2.jar"));
        verifyArtifact(fixedProxy, JAVA_PROXY, "staged Java proxy");
        verifyArtifact(fixedDebug, JAVA_DEBUG, "staged Java debug bundle");
        require(Files.isExecutable(fixedProxy), "staged Java proxy is not executable");
        requireNames(profile.resolve("extensions"), Set.of("index.json", "installed", "work"));
        verifyArtifact(profile.resolve("extensions/index.json"),
                EXTENSION_INDEX, "staged extension index");
        require(treeSha256(profile.resolve("extensions/installed/java"))
                        .equals(patchedJavaTree),
                "staged patched Java tree identity changed");
        verifyArtifact(profile.resolve("extensions/installed/java/extension.wasm"),
                PATCHED_WASM, "staged patched Java WASM");
        Path stagedJdt = profile.resolve(
                "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY);
        require(treeSha256(stagedJdt).equals(JDT_TREE_SHA256),
                "staged JDT tree identity changed");
        require(!Files.exists(stagedJdt.resolve("configuration"), LinkOption.NOFOLLOW_LINKS),
                "staged JDT contains private configuration state");
        verifyArtifact(profile.resolve(
                "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper"),
                TASK_HELPER, "staged Java task helper");
        requireNames(profile.resolve("extensions/work/java/proxy"), Set.of());
        require(Files.readString(settings, StandardCharsets.UTF_8)
                        .equals(settingsText(
                                javaHome,
                                finalProfile.resolve("fixed/java-lsp-proxy"),
                                finalProfile.resolve(
                                        "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"))),
                "staged settings identity changed");
        requireNames(worktree, Set.of("S010Fixture.java"));
        verifyHash(worktree.resolve("S010Fixture.java"), FIXTURE_SHA256,
                "staged S010 fixture");
        verifyEmptyRoot(xdgConfig);
        requireNames(xdgCache, Set.of("tooling"));
        verifyArtifact(catalog, CATALOG, "staged Gradle catalog");
        verifyEmptyRoot(xdgData);
        verifyEmptyRoot(xdgState);
    }

    private static void verifyArtifact(Path path, ArtifactSpec expected, String label)
            throws IOException {
        Path artifact = requireRegularFile(path, label);
        require(Files.size(artifact) == expected.size(), label + " size mismatch");
        verifyHash(artifact, expected.sha256(), label);
    }

    private static void verifyWasm(Path path) throws IOException {
        byte[] magic;
        try (InputStream input = Files.newInputStream(path)) {
            magic = input.readNBytes(4);
        }
        require(magic.length == 4
                        && magic[0] == 0
                        && magic[1] == 'a'
                        && magic[2] == 's'
                        && magic[3] == 'm',
                "WASM magic bytes are invalid");
    }

    private static void verifyTokenEnvironment() throws IOException {
        for (String name : List.of("GH_COPILOT_TOKEN", "GITHUB_COPILOT_TOKEN")) {
            require(System.getenv(name) == null, name + " must be absent for Gate B");
        }
    }

    private static void verifyNoRuntimeProcesses(Path directory) throws Exception {
        for (String line : run(directory, "ps", "-axo", "comm=,args=").lines().toList()) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            int separator = trimmed.indexOf(' ');
            String command = separator < 0 ? trimmed : trimmed.substring(0, separator);
            String basename = Path.of(command).getFileName().toString();
            require(!basename.equals("java-lsp-proxy"),
                    "a Java LSP proxy process is already running");
            if (basename.equals("java") || basename.equals("java.exe")) {
                require(!trimmed.contains("org.eclipse.equinox.launcher_"),
                        "a JDT LS Equinox process is already running");
            }
        }
    }

    private static boolean isNormalZedRunning(Path directory) throws Exception {
        for (String line : run(directory, "ps", "-axo", "comm=,args=").lines().toList()) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            int separator = trimmed.indexOf(' ');
            String command = separator < 0 ? trimmed : trimmed.substring(0, separator);
            String basename = Path.of(command).getFileName().toString();
            if (basename.equals("Zed") || basename.equals("zed")
                    || trimmed.contains("/Zed.app/Contents/MacOS/zed")) {
                return true;
            }
        }
        return false;
    }

    private static String settingsText(Path javaHome, Path proxy, Path debug)
            throws IOException {
        return """
                {
                  "disable_ai": true,
                  "session": {
                    "restore_unsaved_buffers": false,
                    "trust_all_worktrees": true
                  },
                  "auto_install_extensions": {
                    "html": false
                  },
                  "auto_update_extensions": {
                    "java": false
                  },
                  "log": {
                    "lsp": "trace",
                    "project": "warn"
                  },
                  "languages": {
                    "Java": {
                      "language_servers": ["jdtls"]
                    }
                  },
                  "lsp": {
                    "jdtls": {
                      "settings": {
                        "java_home": %s,
                        "lsp_proxy_path": %s,
                        "java_debug_jar": %s,
                        "lombok_support": false,
                        "jdk_auto_download": false,
                        "check_updates": "never"
                      }
                    }
                  }
                }
                """.formatted(
                        jsonString(normalized(javaHome).toString()),
                        jsonString(normalized(proxy).toString()),
                        jsonString(normalized(debug).toString()));
    }

    private static String jsonString(String value) throws IOException {
        for (int index = 0; index < value.length(); index++) {
            require(value.charAt(index) >= 0x20,
                    "JSON path contains a control character");
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static void makeExecutable(Path path) throws IOException {
        if (!path.toFile().setExecutable(true, true) && !Files.isExecutable(path)) {
            throw new IOException("failed to make staged executable");
        }
    }

    private static void verifyEmptyRoot(Path root) throws IOException {
        requireNames(root, Set.of());
    }

    private static void requireNames(Path directory, Set<String> expected)
            throws IOException {
        Set<String> actual = new HashSet<>();
        try (Stream<Path> entries = Files.list(
                requireDirectory(directory, "allowlisted directory"))) {
            for (Path entry : entries.toList()) {
                require(!Files.isSymbolicLink(entry),
                        "allowlisted directory contains a symlink");
                actual.add(entry.getFileName().toString());
            }
        }
        require(actual.equals(expected),
                "allowlisted directory entries changed: " + directory);
    }

    private static void copyTree(Path source, Path destination) throws IOException {
        requireFreshDestination(destination, "tree copy destination");
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : paths.sorted().toList()) {
                require(!Files.isSymbolicLink(path), "source tree contains a symlink");
                Path target = destination.resolve(source.relativize(path));
                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                    Files.createDirectories(target);
                } else if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                    Files.copy(path, target);
                } else {
                    throw new IOException("source tree contains an unsupported entry");
                }
            }
        } catch (Exception error) {
            deleteRecursively(destination);
            throw error;
        }
    }

    private static String treeSha256(Path root) throws IOException {
        MessageDigest digest = messageDigest("SHA-256");
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted().toList()) {
                if (path.equals(root)) {
                    continue;
                }
                require(!Files.isSymbolicLink(path), "tree contains a symlink");
                Path relative = root.relativize(path);
                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                    updateDigest(digest, "D\0" + relative + "\n");
                } else if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                    updateDigest(digest, "F\0" + relative + "\0" + Files.size(path)
                            + "\0" + sha256(path) + "\n");
                } else {
                    throw new IOException("tree contains an unsupported entry");
                }
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static void updateDigest(MessageDigest digest, String value) {
        digest.update(value.getBytes(StandardCharsets.UTF_8));
    }

    private static void extractTarGzip(Path archive, Path destination)
            throws IOException {
        Files.createDirectory(destination);
        long extracted = 0;
        int entries = 0;
        byte[] header = new byte[TAR_BLOCK_SIZE];
        try (InputStream input = new GZIPInputStream(
                new BufferedInputStream(Files.newInputStream(archive)))) {
            while (readBlock(input, header)) {
                if (allZero(header)) {
                    break;
                }
                require(++entries <= MAX_ARCHIVE_ENTRIES,
                        "TAR contains too many entries");
                String name = tarText(header, 0, 100);
                String prefix = tarText(header, 345, 155);
                if (!prefix.isEmpty()) {
                    name = prefix + "/" + name;
                }
                long size = tarOctal(header, 124, 12);
                require(size >= 0 && size <= MAX_ENTRY_BYTES,
                        "TAR entry exceeds the safety limit");
                int type = header[156] & 0xff;
                if (type == 'x' || type == 'g') {
                    validatePax(readExact(input, size));
                    skipPadding(input, size);
                    continue;
                }
                Path target = safeArchiveTarget(destination, name);
                if (type == '5') {
                    require(size == 0, "directory TAR entry has content");
                    Files.createDirectories(target);
                } else if (type == 0 || type == '0') {
                    Files.createDirectories(target.getParent());
                    extracted += copyExact(input, target, size);
                    require(extracted <= MAX_EXTRACTED_BYTES,
                            "TAR expands beyond the safety limit");
                } else {
                    throw new IOException("unsupported TAR entry type");
                }
                skipPadding(input, size);
            }
        } catch (Exception error) {
            deleteRecursively(destination);
            throw error;
        }
    }

    private static void validatePax(byte[] bytes) throws IOException {
        require(bytes.length <= MAX_PAX_BYTES, "PAX header exceeds limit");
        String text = new String(bytes, StandardCharsets.UTF_8);
        for (String record : text.split("\n")) {
            if (record.isEmpty()) {
                continue;
            }
            int space = record.indexOf(' ');
            int equals = record.indexOf('=', space + 1);
            require(space >= 1 && equals >= 0
                            && ALLOWED_PAX_KEYS.contains(
                                    record.substring(space + 1, equals)),
                    "unsupported PAX field");
        }
    }

    private static Path safeArchiveTarget(Path root, String name) throws IOException {
        require(!name.isBlank() && name.indexOf('\\') < 0 && name.indexOf('\0') < 0
                        && !name.startsWith("/") && !name.matches("^[A-Za-z]:.*"),
                "invalid archive path");
        Path relative = Path.of(name).normalize();
        require(!relative.isAbsolute() && !relative.startsWith(".."),
                "unsafe archive path");
        Path target = root.resolve(relative).normalize();
        require(target.startsWith(root), "archive path escapes destination");
        return target;
    }

    private static long copyExact(InputStream input, Path destination, long size)
            throws IOException {
        try (OutputStream output = new BufferedOutputStream(
                Files.newOutputStream(destination))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            long remaining = size;
            while (remaining > 0) {
                int read = input.read(buffer, 0,
                        (int) Math.min(buffer.length, remaining));
                if (read < 0) {
                    throw new IOException("truncated archive entry");
                }
                output.write(buffer, 0, read);
                remaining -= read;
            }
        }
        return size;
    }

    private static byte[] readExact(InputStream input, long size) throws IOException {
        require(size <= Integer.MAX_VALUE, "entry cannot fit in memory");
        byte[] bytes = new byte[(int) size];
        int offset = 0;
        while (offset < bytes.length) {
            int read = input.read(bytes, offset, bytes.length - offset);
            if (read < 0) {
                throw new IOException("truncated archive entry");
            }
            offset += read;
        }
        return bytes;
    }

    private static boolean readBlock(InputStream input, byte[] block)
            throws IOException {
        int offset = 0;
        while (offset < block.length) {
            int read = input.read(block, offset, block.length - offset);
            if (read < 0) {
                if (offset == 0) {
                    return false;
                }
                throw new IOException("truncated TAR header");
            }
            offset += read;
        }
        return true;
    }

    private static void skipPadding(InputStream input, long size) throws IOException {
        long padding = (TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
        while (padding > 0) {
            long skipped = input.skip(padding);
            if (skipped <= 0) {
                if (input.read() < 0) {
                    throw new IOException("truncated TAR padding");
                }
                skipped = 1;
            }
            padding -= skipped;
        }
    }

    private static String tarText(byte[] header, int offset, int length) {
        int end = offset;
        while (end < offset + length && header[end] != 0) {
            end++;
        }
        return new String(header, offset, end - offset, StandardCharsets.UTF_8);
    }

    private static long tarOctal(byte[] header, int offset, int length)
            throws IOException {
        String value = tarText(header, offset, length).trim();
        try {
            return value.isEmpty() ? 0 : Long.parseLong(value, 8);
        } catch (NumberFormatException error) {
            throw new IOException("invalid TAR size", error);
        }
    }

    private static boolean allZero(byte[] block) {
        for (byte value : block) {
            if (value != 0) {
                return false;
            }
        }
        return true;
    }

    private static void moveTransactionally(List<Path> sources, List<Path> destinations)
            throws IOException {
        require(sources.size() == destinations.size(),
                "transaction source/destination count differs");
        List<Path> moved = new ArrayList<>();
        try {
            for (int index = 0; index < sources.size(); index++) {
                requireFreshDestination(destinations.get(index),
                        "transaction destination");
                moveFresh(sources.get(index), destinations.get(index));
                moved.add(destinations.get(index));
            }
        } catch (Exception error) {
            for (int index = moved.size() - 1; index >= 0; index--) {
                deleteRecursively(moved.get(index));
            }
            throw error;
        }
    }

    private static void moveFresh(Path source, Path destination) throws IOException {
        try {
            Files.move(source, destination, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(source, destination);
        }
    }

    private static void verifyPatchContract(String patch) throws IOException {
        require(!patch.contains("\r"), "patch contains carriage returns");
        String expectedDiff = "diff --git a/" + ALLOWED_SOURCE + " b/" + ALLOWED_SOURCE;
        require(count(patch, "diff --git ") == 1 && patch.contains(expectedDiff),
                "patch must contain exactly one allowed diff");

        List<String> added = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        for (String line : patch.split("\n", -1)) {
            if (line.startsWith("diff --git ") && !line.equals(expectedDiff)) {
                throw new IOException("patch targets an unexpected diff path");
            }
            if (line.startsWith("--- ") && !line.equals("--- a/" + ALLOWED_SOURCE)) {
                throw new IOException("patch has an unexpected old path");
            }
            if (line.startsWith("+++ ") && !line.equals("+++ b/" + ALLOWED_SOURCE)) {
                throw new IOException("patch has an unexpected new path");
            }
            if (line.startsWith("+") && !line.startsWith("+++")) {
                added.add(line.substring(1));
            }
            if (line.startsWith("-") && !line.startsWith("---")) {
                removed.add(line.substring(1));
            }
        }

        List<String> expectedAdded = List.of(
                "    " + CONFIGURATION_DERIVATION,
                "        format!(",
                "            \"" + CONFIGURATION_PROPERTY + "\",",
                "            path_to_string(jdtls_configuration_path)?",
                "        ),");
        require(added.equals(expectedAdded), "patch additions exceed the reviewed five lines");
        require(removed.isEmpty(), "patch removes fixed Java extension source");
        require(count(patch, "\n@@ ") == 2 && patch.contains(DERIVATION_HUNK)
                        && patch.contains(CONFIGURATION_HUNK),
                "patch hunks moved outside the reviewed pre-jar argument positions");
        require(count(patch, CONFIGURATION_PROPERTY) == 1,
                "configuration property count is not exactly one");
        require(count(patch, CONFIGURATION_DERIVATION) == 1,
                "configuration path derivation count is not exactly one");

        require(patch.contains("path_to_string(jdtls_configuration_path)?"),
                "configuration path is not passed as one path argument");
    }

    private static void verifyFixture(Path fixture) throws IOException {
        String text = Files.readString(fixture, StandardCharsets.UTF_8);
        require(text.contains("public final class S010Fixture"),
                "fixture class identity changed");
        require(!text.contains("package ") && !text.contains("import "),
                "fixture gained an external source dependency");
        require(count(text, "class S010Fixture") == 1,
                "fixture class count changed");
    }

    private static void verifyCheckout(Path checkout, String expectedCommit) throws Exception {
        String head = run(checkout, "git", "rev-parse", "HEAD");
        if (!head.equals(expectedCommit)) {
            throw new IOException("Java extension source commit mismatch");
        }
        String status = run(checkout, "git", "status", "--porcelain=v1", "--untracked-files=all");
        if (!status.isEmpty()) {
            throw new IOException("Java extension source checkout is dirty");
        }
        requireRegularFile(checkout.resolve(ALLOWED_SOURCE), "allowed Java source");
    }

    private static RuntimePaths runtimePaths(Path worktree, Path cache) {
        Path worktreeRoot = normalized(worktree);
        Path cacheRoot = normalized(cache);
        String hash = sha1(worktreeRoot.toString());
        Path data = cacheRoot.resolve("jdtls-" + hash);
        return new RuntimePaths(worktreeRoot, cacheRoot, hash, data,
                data.resolve("configuration"));
    }

    private static void requireNonSymlinkDirectory(Path path, String label) throws IOException {
        Path value = normalized(path);
        if (!Files.isDirectory(value, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(value)) {
            throw new IOException(label + " is not a regular non-symlink directory");
        }
    }

    private static void validateArchive(Path archive) throws IOException {
        Path destination = normalized(archive).resolveSibling("synthetic-extraction-root");
        Set<Path> names = new HashSet<>();
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                String name = entries.nextElement().getName();
                if (name.isBlank() || name.indexOf('\0') >= 0 || name.indexOf('\\') >= 0
                        || name.startsWith("/") || name.matches("^[A-Za-z]:.*")) {
                    throw new IOException("archive contains an unsafe path");
                }
                Path relative = Path.of(name).normalize();
                Path resolved = destination.resolve(relative).normalize();
                if (relative.isAbsolute() || relative.startsWith("..")
                        || !resolved.startsWith(destination)) {
                    throw new IOException("archive entry escapes the destination");
                }
                if (!names.add(relative)) {
                    throw new IOException("archive contains a duplicate normalized path");
                }
            }
        }
    }

    private static void writeManifest(Path manifest, Map<String, String> values)
            throws IOException {
        require(values.keySet().equals(REQUIRED_MANIFEST_KEYS),
                "manifest keys differ from the Gate A contract");
        StringBuilder text = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            text.append(entry.getKey()).append('=').append(singleLine(entry.getValue()))
                    .append('\n');
        }
        Files.writeString(manifest, text, StandardCharsets.UTF_8);
    }

    private static Map<String, String> verifyManifest(String text) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : text.split("\n")) {
            if (line.isBlank()) {
                continue;
            }
            int separator = line.indexOf('=');
            if (separator <= 0) {
                throw new IOException("manifest line is malformed");
            }
            String key = line.substring(0, separator);
            String value = line.substring(separator + 1);
            if (values.putIfAbsent(key, singleLine(value)) != null) {
                throw new IOException("manifest contains a duplicate key");
            }
        }
        require(values.keySet().equals(REQUIRED_MANIFEST_KEYS),
                "manifest is missing or adding keys");
        return values;
    }

    private static void selfTest() throws Exception {
        Path root = Files.createTempDirectory("s010-gate-a-test-");
        try {
            testPatchContract();
            testCheckoutContract(root);
            testRuntimePaths(root);
            testManifestContract();
            testArchiveContract(root);
        } finally {
            deleteRecursively(root);
        }
    }

    private static void testPatchContract() throws Exception {
        String valid = syntheticPatch();
        verifyPatchContract(valid);
        expectFailure(() -> verifyPatchContract(valid.replace(
                "a/src/jdtls.rs b/src/jdtls.rs",
                "a/src/config.rs b/src/config.rs")));
        expectFailure(() -> verifyPatchContract(valid.replace(
                "+            \"" + CONFIGURATION_PROPERTY + "\",",
                "+            \"" + CONFIGURATION_PROPERTY + "\",\n"
                        + "+            \"" + CONFIGURATION_PROPERTY + "\",")));

        String afterJar = valid.replace(CONFIGURATION_HUNK,
                "@@ -327,2 +328,6 @@ pub fn build_jdtls_launch_args(");
        expectFailure(() -> verifyPatchContract(afterJar));
    }

    private static String syntheticPatch() {
        return String.join("\n",
                "diff --git a/src/jdtls.rs b/src/jdtls.rs",
                "index 24ada2d..ae2fcbb 100644",
                "--- a/src/jdtls.rs",
                "+++ b/src/jdtls.rs",
                DERIVATION_HUNK,
                "         .map_err(|err| format!(\"Failed to determine JDTLS data path: {err}\"))?;",
                "+    " + CONFIGURATION_DERIVATION,
                CONFIGURATION_HUNK,
                "         \"-Dosgi.configuration.cascaded=true\".to_string(),",
                "+        format!(",
                "+            \"" + CONFIGURATION_PROPERTY + "\",",
                "+            path_to_string(jdtls_configuration_path)?",
                "+        ),",
                "         \"-Djava.import.generatesMetadataFilesAtProjectRoot=false\".to_string(),");
    }

    private static void testCheckoutContract(Path root) throws Exception {
        Path checkout = root.resolve("checkout");
        Files.createDirectories(checkout.resolve("src"));
        Files.writeString(checkout.resolve(ALLOWED_SOURCE), "fn fixed() {}\n",
                StandardCharsets.UTF_8);
        run(checkout, "git", "init", "--quiet");
        run(checkout, "git", "config", "user.name", "S010 Test");
        run(checkout, "git", "config", "user.email", "s010@example.invalid");
        run(checkout, "git", "add", ALLOWED_SOURCE);
        run(checkout, "git", "commit", "--quiet", "-m", "fixed");
        String head = run(checkout, "git", "rev-parse", "HEAD");
        verifyCheckout(checkout, head);
        expectFailure(() -> verifyCheckout(checkout, "0000000000000000000000000000000000000000"));
        Files.writeString(checkout.resolve("dirty.txt"), "dirty\n", StandardCharsets.UTF_8);
        expectFailure(() -> verifyCheckout(checkout, head));
    }

    private static void testRuntimePaths(Path root) throws Exception {
        Path cache = root.resolve("cache space 한글");
        Path worktree = root.resolve("work tree 한글/project");
        RuntimePaths paths = runtimePaths(worktree, cache);
        require(paths.hash().equals(sha1(normalized(worktree).toString())),
                "worktree key is not the normalized full-path SHA-1");
        require(paths.data().equals(paths.cache().resolve("jdtls-" + paths.hash())),
                "JDT data path derivation changed");
        require(paths.configuration().equals(paths.data().resolve("configuration")),
                "private configuration is not below the expected JDT data path");

        RuntimePaths normalizedPath = runtimePaths(
                root.resolve("work tree 한글/child/../project"), cache);
        require(paths.equals(normalizedPath), "normalized roots derive different runtime paths");
        RuntimePaths prefix = runtimePaths(root.resolve("work tree 한글/project-other"), cache);
        require(!paths.hash().equals(prefix.hash()) && !paths.data().equals(prefix.data()),
                "prefix-colliding worktrees share runtime paths");

        Path real = root.resolve("real-worktree");
        Files.createDirectory(real);
        requireNonSymlinkDirectory(real, "real worktree");
        Path symlink = root.resolve("linked-worktree");
        Files.createSymbolicLink(symlink, real);
        expectFailure(() -> requireNonSymlinkDirectory(symlink, "linked worktree"));
        expectFailure(() -> requireFreshDestination(symlink, "linked destination"));
    }

    private static void testManifestContract() throws Exception {
        Map<String, String> values = new LinkedHashMap<>();
        for (String key : REQUIRED_MANIFEST_KEYS.stream().sorted().toList()) {
            values.put(key, "value");
        }
        StringBuilder valid = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            valid.append(entry.getKey()).append('=').append(entry.getValue()).append('\n');
        }
        verifyManifest(valid.toString());
        String first = values.keySet().iterator().next();
        expectFailure(() -> verifyManifest(valid + first + "=duplicate\n"));
        expectFailure(() -> verifyManifest(valid.toString().replaceFirst(
                first + "=value\\n", "")));
    }

    private static void testArchiveContract(Path root) throws Exception {
        byte[] value = "fixed".getBytes(StandardCharsets.UTF_8);
        Path good = root.resolve("good.zip");
        writeZip(good, List.of(new TestZipEntry("safe/input.txt", value)));
        validateArchive(good);

        Path traversal = root.resolve("traversal.zip");
        writeZip(traversal, List.of(new TestZipEntry("../escape", value)));
        expectFailure(() -> validateArchive(traversal));
        Path absolute = root.resolve("absolute.zip");
        writeZip(absolute, List.of(new TestZipEntry("/escape", value)));
        expectFailure(() -> validateArchive(absolute));
        Path drive = root.resolve("drive.zip");
        writeZip(drive, List.of(new TestZipEntry("C:/escape", value)));
        expectFailure(() -> validateArchive(drive));
        Path duplicate = root.resolve("duplicate.zip");
        writeZip(duplicate, List.of(
                new TestZipEntry("safe/../same", value),
                new TestZipEntry("same", value)));
        expectFailure(() -> validateArchive(duplicate));
    }

    private static void writeZip(Path archive, List<TestZipEntry> entries)
            throws IOException {
        try (ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(archive))) {
            for (TestZipEntry entry : entries) {
                output.putNextEntry(new ZipEntry(entry.name()));
                output.write(entry.bytes());
                output.closeEntry();
            }
        }
    }

    private static Path requireDirectory(Path path, String label) throws IOException {
        Path value = normalized(path);
        if (!Files.isDirectory(value, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(value)) {
            throw new IOException(label + " is not a regular non-symlink directory");
        }
        return value;
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path value = normalized(path);
        if (!Files.isRegularFile(value, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(value)) {
            throw new IOException(label + " is not a regular non-symlink file");
        }
        return value;
    }

    private static void requireFreshDestination(Path destination, String label)
            throws IOException {
        if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(label + " already exists");
        }
    }

    private static void verifyHash(Path file, String expected, String label)
            throws IOException {
        if (!sha256(file).equals(expected)) {
            throw new IOException(label + " digest mismatch");
        }
    }

    private static String singleLine(String value) throws IOException {
        if (value == null || value.isBlank()) {
            throw new IOException("recorded value is blank");
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character < 0x20 || character == 0x7f) {
                throw new IOException("recorded value contains a control character");
            }
        }
        return value;
    }

    private static int count(String value, String needle) {
        int result = 0;
        for (int index = 0; (index = value.indexOf(needle, index)) >= 0;
                index += needle.length()) {
            result++;
        }
        return result;
    }

    private static Path normalized(Path path) {
        return path.toAbsolutePath().normalize();
    }

    private static String sha256(Path path) throws IOException {
        MessageDigest digest = messageDigest("SHA-256");
        try (InputStream input = new BufferedInputStream(Files.newInputStream(path))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            for (int read; (read = input.read(buffer)) >= 0;) {
                digest.update(buffer, 0, read);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static String sha1(String value) {
        return HexFormat.of().formatHex(messageDigest("SHA-1").digest(
                value.getBytes(StandardCharsets.UTF_8)));
    }

    private static MessageDigest messageDigest(String algorithm) {
        try {
            return MessageDigest.getInstance(algorithm);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(algorithm + " unavailable", error);
        }
    }

    private static String run(Path directory, String... command) throws Exception {
        Process process = new ProcessBuilder(command)
                .directory(directory.toFile())
                .redirectErrorStream(true)
                .start();
        byte[] output = process.getInputStream().readNBytes(1024 * 1024);
        if (!process.waitFor(10, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IOException("command timed out: " + command[0]);
        }
        String text = new String(output, StandardCharsets.UTF_8).trim();
        if (process.exitValue() != 0) {
            throw new IOException("command failed: " + command[0] + ": " + text);
        }
        return text;
    }

    private static void deleteRecursively(Path root) throws IOException {
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static void expectFailure(ThrowingAction action) throws Exception {
        try {
            action.run();
        } catch (Exception expected) {
            return;
        }
        throw new AssertionError("expected operation to fail");
    }

    private static void require(boolean condition, String message) throws IOException {
        if (!condition) {
            throw new IOException(message);
        }
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }

    private record RuntimePaths(
            Path worktree,
            Path cache,
            String hash,
            Path data,
            Path configuration) {
    }

    private record TestZipEntry(String name, byte[] bytes) {
    }

    private record ArtifactSpec(long size, String sha256) {
    }

    private record GateBResult(
            Path profile,
            Path data,
            Path configuration,
            String patchedJavaTree,
            Path manifest) {
    }
}
