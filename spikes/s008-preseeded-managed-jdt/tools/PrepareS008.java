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

/**
 * Verifies and transactionally prepares the fixed S008 inputs under ignored
 * tmp paths. This is disposable feasibility infrastructure, not an installer
 * or a product module.
 */
public final class PrepareS008 {
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String JAVA_SOURCE_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String JDT_BUILD_DIRECTORY =
            "jdt-language-server-1.60.0-202606262232";
    private static final String JDT_TREE_SHA256 =
            "b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583";
    private static final String JAVA_EXTENSION_TREE_SHA256 =
            "58e1155d9a6339790470e0b1ac31e49a7fd771a0412b168b22165433347fae68";
    private static final String CATALOG_ENTRY = "gradle/checksums/versions.json";
    private static final String FIXTURE_RELATIVE =
            "spikes/s008-preseeded-managed-jdt/fixture/S008Fixture.java";
    private static final String FIXTURE_SHA256 =
            "056ece24f7bb2feb0676898b31be2a6d81b23bf0cf34bc6e03ac07fb7ba85906";
    private static final String PROFILE_ALLOWLIST = String.join(";",
            "config/settings.json",
            "fixed/java-lsp-proxy",
            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar",
            "extensions/index.json",
            "extensions/installed/java/**",
            "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY + "/**",
            "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper",
            "extensions/work/java/proxy/",
            "s008-prepared-manifest.txt");

    private static final ArtifactSpec JDT_CORE = new ArtifactSpec(
            1_802_764L,
            "e83035adc685b4519f2d8a8d42fe8651ce7ea4f4daf396f47ec453b5bff07be5");
    private static final ArtifactSpec BUILDSHIP = new ArtifactSpec(
            572_526L,
            "dfc5ee42407674608f6253c1ccdddeb6f12e2df5ff84ab4ef260de2cd453600d");
    private static final ArtifactSpec CATALOG = new ArtifactSpec(
            413_663L,
            "f91a3840453686a21fc2b1508c645c1affd939b1448105cf10438d11b71c4d02");
    private static final ArtifactSpec JAVA_PROXY = new ArtifactSpec(
            834_304L,
            "53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076");
    private static final ArtifactSpec JAVA_DEBUG = new ArtifactSpec(
            3_107_682L,
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c");
    private static final ArtifactSpec JAVA_EXTENSION_WASM = new ArtifactSpec(
            2_128_402L,
            "62dbf7edbe1ef4066f74e588dcec68d223ab7984f1861b59e44db0b10f52e3fd");
    private static final ArtifactSpec JAVA_EXTENSION_MANIFEST = new ArtifactSpec(
            824L,
            "db05627157294b03a3e09cdf72fad1ada97506cd49c0c262caf979524f564f7b");
    private static final ArtifactSpec ZED_CLI = new ArtifactSpec(
            3_570_560L,
            "f1dad0ae519a201fc784c54369252c4a4ca2e13f2411707018ed8a95653d8215");
    private static final String CARGO_LOCK_SHA256 =
            "6d8a9788e6727b3596488ddbf0919e743ef19c0f2e602f1a5cc782069513c583";
    private static final String TASK_HELPER_MANIFEST_SHA256 =
            "7fa67215a3bbbb8c6550cc54e41eb1d26aa94783a2a0e5d622a61f16f8f68480";

    private static final Set<String> REQUIRED_MANIFEST_KEYS = Set.of(
            "java-source-commit",
            "cargo-lock-sha256",
            "task-helper-manifest-sha256",
            "rustc-version",
            "cargo-version",
            "task-helper-size",
            "task-helper-sha256",
            "task-helper-architecture",
            "jdtls-tree-sha256",
            "jdt-core-sha256",
            "buildship-sha256",
            "catalog-size",
            "catalog-sha256",
            "java-proxy-sha256",
            "java-debug-sha256",
            "java-extension-wasm-sha256",
            "java-extension-manifest-sha256",
            "java-extension-tree-sha256",
            "zed-cli-sha256",
            "zed-version",
            "java-runtime",
            "java-bin-sha256",
            "javac-bin-sha256",
            "fixture-sha256",
            "settings-sha256",
            "index-sha256",
            "profile-allowlist",
            "profile",
            "worktree-1",
            "worktree-sha1-1",
            "xdg-1",
            "catalog-1",
            "catalog-mtime-1",
            "expected-data-1",
            "managed-host-fallback-1",
            "packaged-host-fallback-1",
            "worktree-2",
            "worktree-sha1-2",
            "xdg-2",
            "catalog-2",
            "catalog-mtime-2",
            "expected-data-2",
            "managed-host-fallback-2",
            "packaged-host-fallback-2",
            "fresh-destinations",
            "fresh-runtime-paths",
            "proxy-route-at-prepare",
            "live-processes-at-prepare",
            "catalog-runtime-policy");

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

    private PrepareS008() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S008 preparation synthetic tests passed");
            return;
        }
        if (args.length != 14) {
            System.err.println(
                    "usage: java PrepareS008.java <managed-jdt-build> <java-lsp-proxy> "
                            + "<java-debug.jar> <java-source-checkout> "
                            + "<installed-java-extension> <embedded-zed-cli> <java-home> "
                            + "<java-task-helper> <repository-root> <fresh-profile> "
                            + "<fresh-worktree-1> <fresh-xdg-1> <fresh-worktree-2> "
                            + "<fresh-xdg-2>");
            System.exit(2);
        }

        Prepared prepared = prepare(
                Path.of(args[0]), Path.of(args[1]), Path.of(args[2]), Path.of(args[3]),
                Path.of(args[4]), Path.of(args[5]), Path.of(args[6]), Path.of(args[7]),
                Path.of(args[8]), Path.of(args[9]), Path.of(args[10]), Path.of(args[11]),
                Path.of(args[12]), Path.of(args[13]));
        System.out.println("profile=" + prepared.profile());
        System.out.println("task-helper-sha256=" + prepared.helperSha256());
        System.out.println("run-data-paths-distinct="
                + !prepared.run1Data().equals(prepared.run2Data()));
    }

    private static Prepared prepare(
            Path managedJdtBuild,
            Path javaProxy,
            Path javaDebug,
            Path javaSourceCheckout,
            Path installedJavaExtension,
            Path embeddedZedCli,
            Path javaHome,
            Path taskHelper,
            Path repositoryRoot,
            Path profile,
            Path worktree1,
            Path xdg1,
            Path worktree2,
            Path xdg2) throws Exception {
        Path jdt = requireDirectory(managedJdtBuild, "managed JDT build");
        Path proxy = requireRegularFile(javaProxy, "Java proxy");
        Path debug = requireRegularFile(javaDebug, "Java debug bundle");
        Path checkout = requireDirectory(javaSourceCheckout, "Java source checkout");
        Path installed = requireDirectory(installedJavaExtension, "installed Java extension");
        Path cli = requireRegularFile(embeddedZedCli, "embedded Zed CLI");
        Path jdk = requireDirectory(javaHome, "Java home");
        Path helper = requireRegularFile(taskHelper, "Java task helper");
        Path repository = requireDirectory(repositoryRoot, "repository root");

        if (!jdt.getFileName().toString().equals(JDT_BUILD_DIRECTORY)) {
            throw new IOException("managed JDT build directory identity changed");
        }
        verifySourceCheckout(checkout);
        SourceIdentity source = sourceIdentity(checkout);
        verifyJdt(jdt);
        Path core = findSinglePlugin(jdt.resolve("plugins"), "org.eclipse.jdt.ls.core_", JDT_CORE);
        Path buildship = findSinglePlugin(
                jdt.resolve("plugins"), "org.eclipse.buildship.core_", BUILDSHIP);
        String jdtTreeHash = treeSha256(jdt);
        if (!jdtTreeHash.equals(JDT_TREE_SHA256)) {
            throw new IOException("managed JDT tree identity changed");
        }
        String proxyHash = verifyArtifact(proxy, JAVA_PROXY, true);
        String debugHash = verifyArtifact(debug, JAVA_DEBUG, true);
        Path extensionWasm = requireRegularFile(
                installed.resolve("extension.wasm"), "Java extension WASM");
        Path extensionManifest = requireRegularFile(
                installed.resolve("extension.toml"), "Java extension manifest");
        String wasmHash = verifyArtifact(extensionWasm, JAVA_EXTENSION_WASM, true);
        String extensionManifestHash = verifyArtifact(
                extensionManifest, JAVA_EXTENSION_MANIFEST, true);
        verifyJavaExtensionManifest(extensionManifest);
        String installedTreeHash = treeSha256(installed);
        if (!installedTreeHash.equals(JAVA_EXTENSION_TREE_SHA256)) {
            throw new IOException("installed Java extension tree identity changed");
        }
        String cliHash = verifyArtifact(cli, ZED_CLI, true);
        verifyEmbeddedCli(cli);
        JdkIdentity jdkIdentity = verifyJavaHome(jdk);
        String helperHash = verifyTaskHelper(helper);

        Path fixture = requireRegularFile(
                repository.resolve(FIXTURE_RELATIVE), "S008 Java fixture");
        if (!sha256(fixture).equals(FIXTURE_SHA256)) {
            throw new IOException("S008 fixture digest mismatch");
        }

        Path outputProfile = normalized(profile);
        Path firstWorktree = normalized(worktree1);
        Path firstXdg = normalized(xdg1);
        Path secondWorktree = normalized(worktree2);
        Path secondXdg = normalized(xdg2);
        List<Path> destinations = List.of(
                outputProfile, firstWorktree, firstXdg, secondWorktree, secondXdg);
        requireDistinct(destinations);
        Path tmpRoot = requireDirectory(repository.resolve("tmp"), "repository tmp directory");
        for (Path destination : destinations) {
            if (!destination.getParent().equals(tmpRoot)) {
                throw new IOException("S008 destinations must be direct children of repository tmp");
            }
            requireFreshDestination(destination, "S008 destination");
        }

        requireNoRuntimeProcesses();
        RunPaths run1 = runPaths(firstWorktree, firstXdg);
        RunPaths run2 = runPaths(secondWorktree, secondXdg);
        if (run1.fullPathHash().equals(run2.fullPathHash())
                || run1.data().equals(run2.data())) {
            throw new IOException("S008 run data identities are not distinct");
        }
        requireRunFresh(run1);
        requireRunFresh(run2);

        Path transaction = Files.createTempDirectory(tmpRoot, ".s008-transaction-");
        try {
            Path profileStage = transaction.resolve("profile");
            Path worktree1Stage = transaction.resolve("worktree-1");
            Path xdg1Stage = transaction.resolve("xdg-1");
            Path worktree2Stage = transaction.resolve("worktree-2");
            Path xdg2Stage = transaction.resolve("xdg-2");
            Files.createDirectories(profileStage);
            Files.createDirectories(worktree1Stage);
            Files.createDirectories(xdg1Stage);
            Files.createDirectories(worktree2Stage);
            Files.createDirectories(xdg2Stage);

            Path settings = profileStage.resolve("config/settings.json");
            Files.createDirectories(settings.getParent());
            Path fixedProxy = profileStage.resolve("fixed/java-lsp-proxy");
            Path fixedDebug = profileStage.resolve(
                    "fixed/com.microsoft.java.debug.plugin-0.53.2.jar");
            Files.createDirectories(fixedProxy.getParent());
            Files.copy(proxy, fixedProxy);
            Files.copy(debug, fixedDebug);
            makeExecutable(fixedProxy);
            if (!sha256(fixedProxy).equals(proxyHash)
                    || !sha256(fixedDebug).equals(debugHash)) {
                throw new IOException("staged fixed Java artifact identity changed");
            }
            writeSettings(
                    settings,
                    jdk,
                    outputProfile.resolve("fixed/java-lsp-proxy"),
                    outputProfile.resolve(
                            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"));
            verifySettings(settings);

            Path index = profileStage.resolve("extensions/index.json");
            Files.createDirectories(index.getParent());
            Files.writeString(index, JAVA_ONLY_INDEX, StandardCharsets.UTF_8);
            verifyJavaOnlyIndex(index);

            Path stagedInstalled = profileStage.resolve("extensions/installed/java");
            copyTree(installed, stagedInstalled);
            Path stagedJdt = profileStage.resolve(
                    "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY);
            copyTree(jdt, stagedJdt);
            Path stagedHelper = profileStage.resolve(
                    "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT
                            + "/java-task-helper");
            Files.createDirectories(stagedHelper.getParent());
            Files.copy(helper, stagedHelper);
            makeExecutable(stagedHelper);
            if (!sha256(stagedHelper).equals(helperHash)) {
                throw new IOException("staged task helper identity changed");
            }
            Files.createDirectories(profileStage.resolve("extensions/work/java/proxy"));

            Files.copy(fixture, worktree1Stage.resolve("S008Fixture.java"));
            Files.copy(fixture, worktree2Stage.resolve("S008Fixture.java"));
            Path catalog1 = xdg1Stage.resolve("tooling/gradle/versions.json");
            Path catalog2 = xdg2Stage.resolve("tooling/gradle/versions.json");
            extractCatalog(core, catalog1, CATALOG);
            extractCatalog(core, catalog2, CATALOG);

            Map<String, String> manifest = productionManifest(
                    source,
                    helper,
                    helperHash,
                    jdtTreeHash,
                    core,
                    buildship,
                    proxyHash,
                    debugHash,
                    wasmHash,
                    extensionManifestHash,
                    installedTreeHash,
                    cliHash,
                    jdkIdentity,
                    settings,
                    index,
                    outputProfile,
                    firstXdg.resolve("tooling/gradle/versions.json"),
                    Files.getLastModifiedTime(catalog1).toMillis(),
                    secondXdg.resolve("tooling/gradle/versions.json"),
                    Files.getLastModifiedTime(catalog2).toMillis(),
                    run1,
                    run2);
            Path manifestPath = profileStage.resolve("s008-prepared-manifest.txt");
            writeManifest(manifestPath, manifest);
            verifyManifest(manifestPath);
            verifyMinimalProfile(
                    profileStage,
                    installedTreeHash,
                    jdtTreeHash,
                    helperHash,
                    proxyHash,
                    debugHash);
            verifyFixtureOnly(worktree1Stage);
            verifyFixtureOnly(worktree2Stage);
            verifyCatalogOnly(xdg1Stage);
            verifyCatalogOnly(xdg2Stage);

            moveTransactionally(
                    List.of(profileStage, worktree1Stage, xdg1Stage, worktree2Stage, xdg2Stage),
                    destinations);
            return new Prepared(outputProfile, helperHash, run1.data(), run2.data());
        } finally {
            deleteRecursively(transaction);
        }
    }

    private static void verifySourceCheckout(Path checkout) throws Exception {
        String commit = run(checkout, "git", "rev-parse", "HEAD").trim();
        if (!commit.equals(JAVA_SOURCE_COMMIT)) {
            throw new IOException("unexpected Java extension source commit");
        }
        if (!run(checkout, "git", "status", "--porcelain").isBlank()) {
            throw new IOException("Java extension source checkout is not clean");
        }
        requireRegularFile(checkout.resolve("src/task.rs"), "Java task-helper resolution source");
        requireRegularFile(
                checkout.resolve("src/jdtls_server.rs"), "Java JDT command source");
        requireRegularFile(checkout.resolve("Cargo.lock"), "Java source Cargo lockfile");
        requireRegularFile(
                checkout.resolve("task_helper/Cargo.toml"), "task-helper Cargo manifest");
    }

    private static SourceIdentity sourceIdentity(Path checkout) throws Exception {
        Path lock = requireRegularFile(checkout.resolve("Cargo.lock"), "Cargo lockfile");
        Path manifest = requireRegularFile(
                checkout.resolve("task_helper/Cargo.toml"), "task-helper manifest");
        verifyHashOnly(lock, CARGO_LOCK_SHA256, "Cargo lockfile");
        verifyHashOnly(manifest, TASK_HELPER_MANIFEST_SHA256, "task-helper manifest");
        String manifestText = Files.readString(manifest, StandardCharsets.UTF_8);
        if (!manifestText.contains("name = \"java-task-helper\"")
                || !manifestText.contains("version = \"0.1.0\"")) {
            throw new IOException("task-helper package identity changed");
        }
        String rustc = singleLine(run(checkout, "rustc", "--version"));
        String cargo = singleLine(run(checkout, "cargo", "--version"));
        return new SourceIdentity(sha256(lock), sha256(manifest), rustc, cargo);
    }

    private static void verifyJdt(Path jdt) throws IOException {
        requireRegularFile(jdt.resolve("bin/jdtls"), "JDT launcher");
        requireDirectory(jdt.resolve("config_mac_arm"), "JDT macOS arm64 config");
        requireDirectory(jdt.resolve("plugins"), "JDT plugins");
    }

    private static Path findSinglePlugin(
            Path plugins, String prefix, ArtifactSpec expected) throws IOException {
        List<Path> matches;
        try (Stream<Path> entries = Files.list(requireDirectory(plugins, "JDT plugins"))) {
            matches = entries.filter(path -> {
                String name = path.getFileName().toString();
                return name.startsWith(prefix) && name.endsWith(".jar")
                        && Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                        && !Files.isSymbolicLink(path);
            }).toList();
        }
        if (matches.size() != 1) {
            throw new IOException("fixed JDT plugin candidate count changed: " + prefix);
        }
        verifyArtifact(matches.get(0), expected, true);
        return matches.get(0);
    }

    private static void verifyJavaExtensionManifest(Path manifest) throws IOException {
        String text = Files.readString(manifest, StandardCharsets.UTF_8);
        if (!text.contains("id = \"java\"") || !text.contains("version = \"6.8.21\"")) {
            throw new IOException("installed Java extension identity changed");
        }
    }

    private static void verifyEmbeddedCli(Path cli) throws Exception {
        String version = run(cli.getParent(), cli.toString(), "--version");
        if (!version.contains("Zed 1.10.3")) {
            throw new IOException("embedded Zed CLI version changed");
        }
    }

    private static JdkIdentity verifyJavaHome(Path javaHome) throws Exception {
        Path java = requireRegularFile(javaHome.resolve("bin/java"), "JDK java executable");
        Path javac = requireRegularFile(javaHome.resolve("bin/javac"), "JDK javac executable");
        if (!Files.isExecutable(java) || !Files.isExecutable(javac)) {
            throw new IOException("JDK executables are not executable");
        }
        String version = run(javaHome, java.toString(), "-version");
        if (!version.contains("25.0.3") || !version.contains("Temurin-25.0.3+9")) {
            throw new IOException("JDK runtime identity changed");
        }
        return new JdkIdentity(sha256(java), sha256(javac));
    }

    private static String verifyTaskHelper(Path helper) throws IOException {
        if (!Files.isExecutable(helper)) {
            throw new IOException("task helper is not executable");
        }
        byte[] header;
        try (InputStream input = Files.newInputStream(helper)) {
            header = input.readNBytes(8);
        }
        byte[] macArm64 = {
            (byte) 0xcf, (byte) 0xfa, (byte) 0xed, (byte) 0xfe,
            (byte) 0x0c, (byte) 0x00, (byte) 0x00, (byte) 0x01
        };
        if (!java.util.Arrays.equals(header, macArm64)) {
            throw new IOException("task helper is not a thin Mach-O 64 arm64 executable");
        }
        return sha256(helper);
    }

    private static void requireNoRuntimeProcesses() throws IOException {
        try (Stream<ProcessHandle> processes = ProcessHandle.allProcesses()) {
            boolean found = processes.anyMatch(process -> {
                ProcessHandle.Info info = process.info();
                return isRuntimeProcess(
                        info.command().orElse(""),
                        info.arguments().orElse(new String[0]));
            });
            if (found) {
                throw new IOException("an existing Java proxy or JDT process prevents preparation");
            }
        }
    }

    private static boolean isRuntimeProcess(String command, String[] arguments) {
        Path commandPath = Path.of(command);
        Path fileName = commandPath.getFileName();
        String executable = fileName == null ? "" : fileName.toString();
        if (executable.equals("java-lsp-proxy")) {
            return true;
        }
        if (!executable.equals("java") && !executable.equals("java.exe")) {
            return false;
        }
        String joined = String.join(" ", arguments);
        return joined.contains("org.eclipse.jdt.ls.core")
                || joined.contains("org.eclipse.equinox.launcher_");
    }

    private static RunPaths runPaths(Path worktree, Path xdg) {
        Path normalizedWorktree = normalized(worktree);
        Path normalizedXdg = normalized(xdg);
        String fullHash = sha1(normalizedWorktree.toString());
        String basenameHash = sha1(normalizedWorktree.getFileName().toString());
        Path homeCache = Path.of(System.getProperty("user.home"), "Library", "Caches");
        return new RunPaths(
                normalizedWorktree,
                normalizedXdg,
                fullHash,
                normalizedXdg.resolve("jdtls-" + fullHash),
                homeCache.resolve("jdtls-" + fullHash),
                homeCache.resolve("jdtls").resolve("jdtls-" + basenameHash),
                normalizedXdg.resolve("tooling/gradle/versions.json"));
    }

    private static void requireRunFresh(RunPaths run) throws IOException {
        requireFreshDestination(run.worktree(), "worktree");
        requireFreshDestination(run.xdg(), "XDG root");
        requireFreshDestination(run.data(), "expected JDT data");
        requireFreshDestination(run.managedHostFallback(), "managed host fallback");
        requireFreshDestination(run.packagedHostFallback(), "packaged host fallback");
    }

    private static void writeSettings(
            Path destination, Path javaHome, Path proxy, Path debug) throws IOException {
        String settings = """
                {
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
        Files.writeString(destination, settings, StandardCharsets.UTF_8);
    }

    private static void verifySettings(Path settings) throws IOException {
        String text = Files.readString(settings, StandardCharsets.UTF_8);
        for (String token : List.of(
                "\"Java\"",
                "\"language_servers\": [\"jdtls\"]",
                "\"lsp_proxy_path\"",
                "\"java_debug_jar\"",
                "\"lombok_support\": false",
                "\"jdk_auto_download\": false",
                "\"check_updates\": \"never\"")) {
            if (!text.contains(token)) {
                throw new IOException("generated settings are incomplete");
            }
        }
        for (String forbidden : List.of(
                "jdtls_launcher",
                "spring-boot-language-server",
                "s003-", "s004-", "s005-", "s006-", "s007-")) {
            if (text.contains(forbidden)) {
                throw new IOException("generated settings exceed S008 scope");
            }
        }
    }

    private static void verifyJavaOnlyIndex(Path index) throws IOException {
        String text = Files.readString(index, StandardCharsets.UTF_8);
        if (!text.equals(JAVA_ONLY_INDEX)
                || !text.contains("\"id\": \"java\"")
                || !text.contains("\"version\": \"6.8.21\"")
                || text.contains("\"html\"")
                || text.contains("\"dev\": true")) {
            throw new IOException("Java-only extension index identity changed");
        }
    }

    private static void extractCatalog(
            Path archive, Path destination, ArtifactSpec expected) throws IOException {
        requireFreshDestination(destination, "catalog destination");
        Files.createDirectories(destination.getParent());
        Set<String> identities = new HashSet<>();
        ZipEntry selected = null;
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                Path relative = safeZipPath(entry.getName());
                String identity = relative.toString().replace('\\', '/');
                if (!identities.add(identity)) {
                    throw new IOException("ZIP contains a duplicate normalized path");
                }
                if (identity.equals(CATALOG_ENTRY)) {
                    if (!entry.getName().equals(CATALOG_ENTRY) || entry.isDirectory()
                            || selected != null) {
                        throw new IOException("ZIP contains an unexpected catalog entry shape");
                    }
                    selected = entry;
                }
            }
            if (selected == null) {
                throw new IOException("JDT core ZIP does not contain the fixed Gradle catalog");
            }
            if (selected.getSize() != expected.size()) {
                throw new IOException("embedded Gradle catalog size changed");
            }
            try (InputStream input = new BufferedInputStream(zip.getInputStream(selected));
                    OutputStream output = new BufferedOutputStream(
                            Files.newOutputStream(destination))) {
                byte[] buffer = new byte[BUFFER_SIZE];
                long copied = 0;
                for (int read; (read = input.read(buffer)) >= 0;) {
                    copied += read;
                    if (copied > expected.size()) {
                        throw new IOException("embedded Gradle catalog exceeds fixed size");
                    }
                    output.write(buffer, 0, read);
                }
                if (copied != expected.size()) {
                    throw new IOException("embedded Gradle catalog is truncated");
                }
            }
        } catch (Exception error) {
            Files.deleteIfExists(destination);
            throw error;
        }
        verifyArtifact(destination, expected, true);
    }

    private static Path safeZipPath(String name) throws IOException {
        if (name.isBlank() || name.indexOf('\\') >= 0 || name.indexOf('\0') >= 0) {
            throw new IOException("invalid ZIP path");
        }
        for (int index = 0; index < name.length(); index++) {
            if (name.charAt(index) < 0x20) {
                throw new IOException("ZIP path contains a control character");
            }
        }
        if (name.length() >= 2 && Character.isLetter(name.charAt(0))
                && name.charAt(1) == ':') {
            throw new IOException("ZIP path contains a drive prefix");
        }
        Path raw = Path.of(name);
        Path relative = raw.normalize();
        if (raw.isAbsolute() || relative.isAbsolute() || relative.startsWith("..")
                || relative.toString().isEmpty()) {
            throw new IOException("unsafe ZIP path");
        }
        return relative;
    }

    private static Map<String, String> productionManifest(
            SourceIdentity source,
            Path helper,
            String helperHash,
            String jdtTreeHash,
            Path core,
            Path buildship,
            String proxyHash,
            String debugHash,
            String wasmHash,
            String extensionManifestHash,
            String installedTreeHash,
            String cliHash,
            JdkIdentity jdkIdentity,
            Path settings,
            Path index,
            Path profile,
            Path catalog1,
            long catalogMtime1,
            Path catalog2,
            long catalogMtime2,
            RunPaths run1,
            RunPaths run2) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("java-source-commit", JAVA_SOURCE_COMMIT);
        values.put("cargo-lock-sha256", source.cargoLockSha256());
        values.put("task-helper-manifest-sha256", source.helperManifestSha256());
        values.put("rustc-version", source.rustcVersion());
        values.put("cargo-version", source.cargoVersion());
        values.put("task-helper-size", Long.toString(Files.size(helper)));
        values.put("task-helper-sha256", helperHash);
        values.put("task-helper-architecture", "mach-o64-arm64");
        values.put("jdtls-tree-sha256", jdtTreeHash);
        values.put("jdt-core-sha256", sha256(core));
        values.put("buildship-sha256", sha256(buildship));
        values.put("catalog-size", Long.toString(CATALOG.size()));
        values.put("catalog-sha256", CATALOG.sha256());
        values.put("java-proxy-sha256", proxyHash);
        values.put("java-debug-sha256", debugHash);
        values.put("java-extension-wasm-sha256", wasmHash);
        values.put("java-extension-manifest-sha256", extensionManifestHash);
        values.put("java-extension-tree-sha256", installedTreeHash);
        values.put("zed-cli-sha256", cliHash);
        values.put("zed-version", "1.10.3 build 20260713.002323");
        values.put("java-runtime", "Temurin 25.0.3+9");
        values.put("java-bin-sha256", jdkIdentity.javaSha256());
        values.put("javac-bin-sha256", jdkIdentity.javacSha256());
        values.put("fixture-sha256", FIXTURE_SHA256);
        values.put("settings-sha256", sha256(settings));
        values.put("index-sha256", sha256(index));
        values.put("profile-allowlist", PROFILE_ALLOWLIST);
        values.put("profile", profile.toString());
        putRun(values, "1", catalog1, catalogMtime1, run1);
        putRun(values, "2", catalog2, catalogMtime2, run2);
        values.put("fresh-destinations", "profile,worktree-1,xdg-1,worktree-2,xdg-2");
        values.put("fresh-runtime-paths",
                "expected-data-1,managed-host-fallback-1,packaged-host-fallback-1,"
                        + "expected-data-2,managed-host-fallback-2,packaged-host-fallback-2");
        values.put("proxy-route-at-prepare", "empty");
        values.put("live-processes-at-prepare", "absent");
        values.put("catalog-runtime-policy", "refresh-mtime-once-immediately-before-each-run");
        return values;
    }

    private static void putRun(
            Map<String, String> values,
            String suffix,
            Path catalog,
            long catalogMtime,
            RunPaths run) {
        values.put("worktree-" + suffix, run.worktree().toString());
        values.put("worktree-sha1-" + suffix, run.fullPathHash());
        values.put("xdg-" + suffix, run.xdg().toString());
        values.put("catalog-" + suffix, catalog.toString());
        values.put("catalog-mtime-" + suffix, Long.toString(catalogMtime));
        values.put("expected-data-" + suffix, run.data().toString());
        values.put("managed-host-fallback-" + suffix, run.managedHostFallback().toString());
        values.put("packaged-host-fallback-" + suffix, run.packagedHostFallback().toString());
    }

    private static void writeManifest(Path destination, Map<String, String> values)
            throws IOException {
        if (!values.keySet().equals(REQUIRED_MANIFEST_KEYS)) {
            throw new IOException("manifest input key set is incomplete");
        }
        StringBuilder text = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            text.append(entry.getKey()).append('=').append(singleLine(entry.getValue()))
                    .append('\n');
        }
        Files.writeString(destination, text, StandardCharsets.UTF_8);
    }

    private static void verifyManifest(Path manifest) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
            int equals = line.indexOf('=');
            if (equals <= 0 || equals == line.length() - 1) {
                throw new IOException("manifest line is malformed");
            }
            String key = line.substring(0, equals);
            String value = line.substring(equals + 1);
            if (values.put(key, value) != null) {
                throw new IOException("manifest contains a duplicate key");
            }
        }
        if (!values.keySet().equals(REQUIRED_MANIFEST_KEYS)) {
            throw new IOException("manifest key set is incomplete");
        }
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (entry.getKey().endsWith("sha256")
                    && !entry.getValue().matches("[0-9a-f]{64}")) {
                throw new IOException("manifest SHA-256 value is malformed");
            }
        }
        if (values.get("worktree-sha1-1").equals(values.get("worktree-sha1-2"))
                || values.get("expected-data-1").equals(values.get("expected-data-2"))) {
            throw new IOException("manifest run identities are not distinct");
        }
        if (!values.get("profile-allowlist").equals(PROFILE_ALLOWLIST)
                || !values.get("task-helper-architecture").equals("mach-o64-arm64")
                || !values.get("proxy-route-at-prepare").equals("empty")
                || !values.get("live-processes-at-prepare").equals("absent")) {
            throw new IOException("manifest preparation constraints changed");
        }
    }

    private static void verifyMinimalProfile(
            Path profile,
            String installedTreeHash,
            String jdtTreeHash,
            String helperHash,
            String proxyHash,
            String debugHash) throws IOException {
        requireNames(
                profile,
                Set.of("config", "fixed", "extensions", "s008-prepared-manifest.txt"));
        requireNames(profile.resolve("config"), Set.of("settings.json"));
        Path fixed = profile.resolve("fixed");
        requireNames(
                fixed,
                Set.of("java-lsp-proxy", "com.microsoft.java.debug.plugin-0.53.2.jar"));
        Path fixedProxy = requireRegularFile(
                fixed.resolve("java-lsp-proxy"), "staged fixed Java proxy");
        Path fixedDebug = requireRegularFile(
                fixed.resolve("com.microsoft.java.debug.plugin-0.53.2.jar"),
                "staged fixed Java debug bundle");
        if (!sha256(fixedProxy).equals(proxyHash)
                || !Files.isExecutable(fixedProxy)
                || !sha256(fixedDebug).equals(debugHash)) {
            throw new IOException("staged fixed Java artifact selection changed");
        }
        requireNames(profile.resolve("extensions"), Set.of("index.json", "installed", "work"));
        requireNames(profile.resolve("extensions/installed"), Set.of("java"));
        Path installed = requireDirectory(
                profile.resolve("extensions/installed/java"), "staged Java extension");
        if (!treeSha256(installed).equals(installedTreeHash)) {
            throw new IOException("staged Java extension tree identity changed");
        }
        requireNames(profile.resolve("extensions/work"), Set.of("java"));
        Path javaWork = requireDirectory(
                profile.resolve("extensions/work/java"), "staged Java work directory");
        requireNames(javaWork, Set.of("jdtls", "bin", "proxy"));
        Path jdtRoot = javaWork.resolve("jdtls");
        requireNames(jdtRoot, Set.of(JDT_BUILD_DIRECTORY));
        if (!treeSha256(jdtRoot.resolve(JDT_BUILD_DIRECTORY)).equals(jdtTreeHash)) {
            throw new IOException("staged managed JDT tree identity changed");
        }
        Path bin = javaWork.resolve("bin");
        requireNames(bin, Set.of(JAVA_SOURCE_COMMIT));
        Path helperDirectory = bin.resolve(JAVA_SOURCE_COMMIT);
        requireNames(helperDirectory, Set.of("java-task-helper"));
        Path helper = requireRegularFile(
                helperDirectory.resolve("java-task-helper"), "staged task helper");
        if (!sha256(helper).equals(helperHash) || !Files.isExecutable(helper)) {
            throw new IOException("staged task helper selection shape changed");
        }
        Path proxy = requireDirectory(javaWork.resolve("proxy"), "proxy route directory");
        requireNames(proxy, Set.of());
        verifySettings(profile.resolve("config/settings.json"));
        verifyJavaOnlyIndex(profile.resolve("extensions/index.json"));
        verifyManifest(profile.resolve("s008-prepared-manifest.txt"));
        rejectForbiddenProfileNames(profile);
    }

    private static void rejectForbiddenProfileNames(Path profile) throws IOException {
        Set<String> forbidden = Set.of(
                "db", "threads", "external_agents", "logs", "prettier", "node", "providers");
        try (Stream<Path> paths = Files.walk(profile)) {
            for (Path path : paths.toList()) {
                String name = path.getFileName().toString();
                String relative = profile.relativize(path).toString();
                if (forbidden.contains(name)
                        || relative.contains("s003-")
                        || relative.contains("s004-")
                        || relative.contains("s005-")
                        || relative.contains("s006-")
                        || relative.contains("s007-")) {
                    throw new IOException("profile contains forbidden prior or mutable state");
                }
            }
        }
    }

    private static void verifyFixtureOnly(Path worktree) throws IOException {
        requireNames(worktree, Set.of("S008Fixture.java"));
        if (!sha256(worktree.resolve("S008Fixture.java")).equals(FIXTURE_SHA256)) {
            throw new IOException("staged S008 fixture identity changed");
        }
    }

    private static void verifyCatalogOnly(Path xdg) throws IOException {
        requireNames(xdg, Set.of("tooling"));
        requireNames(xdg.resolve("tooling"), Set.of("gradle"));
        requireNames(xdg.resolve("tooling/gradle"), Set.of("versions.json"));
        verifyArtifact(xdg.resolve("tooling/gradle/versions.json"), CATALOG, true);
    }

    private static void requireNames(Path directory, Set<String> expected) throws IOException {
        Set<String> actual = new HashSet<>();
        try (Stream<Path> entries = Files.list(requireDirectory(directory, "allowlisted directory"))) {
            for (Path entry : entries.toList()) {
                if (Files.isSymbolicLink(entry)) {
                    throw new IOException("allowlisted directory contains a symlink");
                }
                actual.add(entry.getFileName().toString());
            }
        }
        if (!actual.equals(expected)) {
            throw new IOException("allowlisted directory entries changed: " + directory);
        }
    }

    private static void copyTree(Path source, Path destination) throws IOException {
        requireFreshDestination(destination, "tree copy destination");
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : paths.sorted().toList()) {
                if (Files.isSymbolicLink(path)) {
                    throw new IOException("source tree contains a symlink");
                }
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
                if (Files.isSymbolicLink(path)) {
                    throw new IOException("tree contains a symlink");
                }
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

    private static String verifyArtifact(
            Path path, ArtifactSpec expected, boolean verifySize) throws IOException {
        Path artifact = requireRegularFile(path, "fixed artifact");
        if (verifySize && Files.size(artifact) != expected.size()) {
            throw new IOException("artifact size mismatch: " + artifact.getFileName());
        }
        String hash = sha256(artifact);
        if (!hash.equals(expected.sha256())) {
            throw new IOException("artifact digest mismatch: " + artifact.getFileName());
        }
        return hash;
    }

    private static void verifyHashOnly(Path path, String expected, String label)
            throws IOException {
        if (!sha256(path).equals(expected)) {
            throw new IOException(label + " digest mismatch");
        }
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path value = normalized(path);
        if (!Files.isRegularFile(value, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(value)) {
            throw new IOException(label + " is not a regular non-symlink file");
        }
        return value;
    }

    private static Path requireDirectory(Path path, String label) throws IOException {
        Path value = normalized(path);
        if (!Files.isDirectory(value, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(value)) {
            throw new IOException(label + " is not a regular non-symlink directory");
        }
        return value;
    }

    private static Path normalized(Path path) {
        return path.toAbsolutePath().normalize();
    }

    private static void requireDistinct(List<Path> paths) throws IOException {
        if (new HashSet<>(paths).size() != paths.size()) {
            throw new IOException("S008 destinations must be distinct");
        }
    }

    private static void requireFreshDestination(Path destination, String label)
            throws IOException {
        if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(label + " already exists");
        }
    }

    private static void makeExecutable(Path path) throws IOException {
        if (!path.toFile().setExecutable(true, true) && !Files.isExecutable(path)) {
            throw new IOException("failed to make staged task helper executable");
        }
    }

    private static String jsonString(String value) throws IOException {
        for (int index = 0; index < value.length(); index++) {
            if (value.charAt(index) < 0x20) {
                throw new IOException("JSON path contains a control character");
            }
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String singleLine(String value) throws IOException {
        if (value.isBlank()) {
            throw new IOException("recorded value is blank");
        }
        for (int index = 0; index < value.length(); index++) {
            if (value.charAt(index) < 0x20 || value.charAt(index) == 0x7f) {
                throw new IOException("recorded value contains a control character");
            }
        }
        return value;
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
        MessageDigest digest = messageDigest("SHA-1");
        return HexFormat.of().formatHex(
                digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static MessageDigest messageDigest(String algorithm) {
        try {
            return MessageDigest.getInstance(algorithm);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(algorithm + " unavailable", error);
        }
    }

    private static void updateDigest(MessageDigest digest, String value) {
        digest.update(value.getBytes(StandardCharsets.UTF_8));
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
        if (process.exitValue() != 0) {
            throw new IOException("command failed: " + command[0]);
        }
        return new String(output, StandardCharsets.UTF_8).trim();
    }

    private static void moveTransactionally(List<Path> sources, List<Path> destinations)
            throws IOException {
        if (sources.size() != destinations.size()) {
            throw new IOException("transaction source/destination count differs");
        }
        List<Path> moved = new ArrayList<>();
        try {
            for (int index = 0; index < sources.size(); index++) {
                requireFreshDestination(destinations.get(index), "transaction destination");
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

    private static void selfTest() throws Exception {
        Path root = Files.createTempDirectory("s008-prepare-test-");
        try {
            testCatalogExtraction(root);
            testCatalogRejection(root);
            testPathsAndFreshness(root);
            testProcessIdentification();
            testProfileAllowlist(root);
            testTransactionCleanup(root);
            testManifestCompleteness(root);
        } finally {
            deleteRecursively(root);
        }
    }

    private static void testCatalogExtraction(Path root) throws Exception {
        byte[] catalog = "{\"versions\":[\"8.14\"]}".getBytes(StandardCharsets.UTF_8);
        ArtifactSpec expected = new ArtifactSpec(catalog.length, sha256(catalog));
        Path archive = root.resolve("catalog-good.jar");
        writeZip(archive, List.of(
                new TestZipEntry("META-INF/MANIFEST.MF", "manifest".getBytes(StandardCharsets.UTF_8)),
                new TestZipEntry(CATALOG_ENTRY, catalog)));
        Path output = root.resolve("catalog-good/versions.json");
        extractCatalog(archive, output, expected);
        require(java.util.Arrays.equals(Files.readAllBytes(output), catalog),
                "catalog extraction changed bytes");
    }

    private static void testCatalogRejection(Path root) throws Exception {
        byte[] catalog = "catalog".getBytes(StandardCharsets.UTF_8);
        ArtifactSpec expected = new ArtifactSpec(catalog.length, sha256(catalog));

        Path wrong = root.resolve("catalog-wrong.jar");
        writeZip(wrong, List.of(new TestZipEntry(CATALOG_ENTRY, "wrong".getBytes(
                StandardCharsets.UTF_8))));
        expectFailure(() -> extractCatalog(wrong, root.resolve("wrong/out"), expected));

        Path duplicate = root.resolve("catalog-duplicate.jar");
        writeZip(duplicate, List.of(
                new TestZipEntry(CATALOG_ENTRY, catalog),
                new TestZipEntry("gradle/checksums/./versions.json", catalog)));
        expectFailure(() -> extractCatalog(
                duplicate, root.resolve("duplicate/out"), expected));

        Path traversal = root.resolve("catalog-traversal.jar");
        writeZip(traversal, List.of(
                new TestZipEntry("../escape", catalog),
                new TestZipEntry(CATALOG_ENTRY, catalog)));
        expectFailure(() -> extractCatalog(
                traversal, root.resolve("traversal/out"), expected));
    }

    private static void testPathsAndFreshness(Path root) throws Exception {
        RunPaths first = runPaths(root.resolve("work tree 한글"), root.resolve("xdg one"));
        RunPaths same = runPaths(root.resolve("work tree 한글"), root.resolve("xdg two"));
        require(first.fullPathHash().equals(same.fullPathHash()),
                "full-path hash depends on XDG root");
        require(first.fullPathHash().equals(sha1(normalized(
                root.resolve("work tree 한글")).toString())),
                "full-path hash does not include the normalized full path");
        RunPaths second = runPaths(root.resolve("other tree 한글"), root.resolve("xdg two"));
        require(!first.fullPathHash().equals(second.fullPathHash()),
                "distinct worktrees share a run key");
        require(first.data().startsWith(first.xdg()), "expected data is outside XDG root");

        Path existing = root.resolve("existing-output");
        Files.createDirectory(existing);
        expectFailure(() -> requireFreshDestination(existing, "synthetic output"));
    }

    private static void testProcessIdentification() {
        require(isRuntimeProcess("/fixed/java-lsp-proxy", new String[0]),
                "proxy executable was not identified");
        require(isRuntimeProcess(
                "/fixed/jdk/bin/java",
                new String[] {"-jar", "org.eclipse.equinox.launcher_1.7.0.jar"}),
                "JDT Java process was not identified");
        require(!isRuntimeProcess(
                "/fixed/jdk/bin/java",
                new String[] {"PrepareS008", "/fixed/input/java-lsp-proxy"}),
                "preparation input path was misidentified as a live proxy");
        require(!isRuntimeProcess(
                "/bin/zsh",
                new String[] {"-c", "inspect org.eclipse.jdt.ls.core"}),
                "non-Java inspection command was misidentified as JDT");
    }

    private static void testProfileAllowlist(Path root) throws Exception {
        Path installed = root.resolve("source-installed");
        Files.createDirectories(installed.resolve("languages/java"));
        Files.writeString(installed.resolve("extension.wasm"), "wasm", StandardCharsets.UTF_8);
        Files.writeString(installed.resolve("extension.toml"), "manifest", StandardCharsets.UTF_8);
        Files.writeString(
                installed.resolve("languages/java/config.toml"), "config", StandardCharsets.UTF_8);

        Path jdt = root.resolve("source-jdt");
        Files.createDirectories(jdt.resolve("config_mac_arm"));
        Files.createDirectories(jdt.resolve("plugins"));
        Files.createDirectories(jdt.resolve("bin"));
        Files.writeString(jdt.resolve("bin/jdtls"), "launcher", StandardCharsets.UTF_8);

        Path profile = root.resolve("profile");
        Files.createDirectories(profile.resolve("config"));
        Files.createDirectories(profile.resolve("extensions"));
        Path fixedProxy = profile.resolve("fixed/java-lsp-proxy");
        Path fixedDebug = profile.resolve(
                "fixed/com.microsoft.java.debug.plugin-0.53.2.jar");
        Files.createDirectories(fixedProxy.getParent());
        Files.writeString(fixedProxy, "proxy", StandardCharsets.UTF_8);
        Files.writeString(fixedDebug, "debug", StandardCharsets.UTF_8);
        makeExecutable(fixedProxy);
        writeSettings(
                profile.resolve("config/settings.json"),
                root.resolve("JDK 25"), fixedProxy, fixedDebug);
        Files.writeString(
                profile.resolve("extensions/index.json"), JAVA_ONLY_INDEX, StandardCharsets.UTF_8);
        copyTree(installed, profile.resolve("extensions/installed/java"));
        copyTree(jdt, profile.resolve(
                "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY));
        Path helper = profile.resolve(
                "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper");
        Files.createDirectories(helper.getParent());
        writeSyntheticHelper(helper);
        Files.createDirectories(profile.resolve("extensions/work/java/proxy"));
        Path manifest = profile.resolve("s008-prepared-manifest.txt");
        writeManifest(manifest, syntheticManifest(root));
        String installedHash = treeSha256(installed);
        String jdtHash = treeSha256(jdt);
        String helperHash = sha256(helper);
        String proxyHash = sha256(fixedProxy);
        String debugHash = sha256(fixedDebug);
        verifyMinimalProfile(
                profile, installedHash, jdtHash, helperHash, proxyHash, debugHash);

        Files.createDirectory(profile.resolve("threads"));
        expectFailure(() -> verifyMinimalProfile(
                profile, installedHash, jdtHash, helperHash, proxyHash, debugHash));
        Files.delete(profile.resolve("threads"));

        Path sibling = helper.getParent().resolve("other-helper");
        Files.writeString(sibling, "unexpected", StandardCharsets.UTF_8);
        expectFailure(() -> verifyMinimalProfile(
                profile, installedHash, jdtHash, helperHash, proxyHash, debugHash));
        Files.delete(sibling);

        Path secondJdt = profile.resolve("extensions/work/java/jdtls/other-jdt");
        Files.createDirectory(secondJdt);
        expectFailure(() -> verifyMinimalProfile(
                profile, installedHash, jdtHash, helperHash, proxyHash, debugHash));
        Files.delete(secondJdt);

        Path route = profile.resolve("extensions/work/java/proxy/12345");
        Files.writeString(route, "route", StandardCharsets.UTF_8);
        expectFailure(() -> verifyMinimalProfile(
                profile, installedHash, jdtHash, helperHash, proxyHash, debugHash));
        Files.delete(route);
    }

    private static void testTransactionCleanup(Path root) throws Exception {
        Path transaction = root.resolve("transaction-test");
        Files.createDirectories(transaction.resolve("source-1"));
        Files.createDirectories(transaction.resolve("source-2"));
        Path destination1 = root.resolve("transaction-destination-1");
        Path destination2 = root.resolve("transaction-destination-2");
        Files.createDirectory(destination2);
        expectFailure(() -> moveTransactionally(
                List.of(transaction.resolve("source-1"), transaction.resolve("source-2")),
                List.of(destination1, destination2)));
        require(!Files.exists(destination1), "failed transaction retained a moved output");
        require(Files.exists(destination2), "failed transaction removed a caller-owned output");
    }

    private static void testManifestCompleteness(Path root) throws Exception {
        Path manifest = root.resolve("synthetic-manifest.txt");
        writeManifest(manifest, syntheticManifest(root));
        verifyManifest(manifest);
        List<String> incomplete = Files.readAllLines(manifest, StandardCharsets.UTF_8);
        incomplete.remove(incomplete.size() - 1);
        Path truncated = root.resolve("truncated-manifest.txt");
        Files.write(truncated, incomplete, StandardCharsets.UTF_8);
        expectFailure(() -> verifyManifest(truncated));
    }

    private static Map<String, String> syntheticManifest(Path root) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String key : REQUIRED_MANIFEST_KEYS.stream().sorted().toList()) {
            values.put(key, key.endsWith("sha256") ? "a".repeat(64) : "synthetic");
        }
        values.put("profile-allowlist", PROFILE_ALLOWLIST);
        values.put("task-helper-architecture", "mach-o64-arm64");
        values.put("proxy-route-at-prepare", "empty");
        values.put("live-processes-at-prepare", "absent");
        values.put("worktree-sha1-1", "1".repeat(40));
        values.put("worktree-sha1-2", "2".repeat(40));
        values.put("expected-data-1", root.resolve("data one").toString());
        values.put("expected-data-2", root.resolve("data 둘").toString());
        return values;
    }

    private static void writeSyntheticHelper(Path helper) throws IOException {
        byte[] bytes = {
            (byte) 0xcf, (byte) 0xfa, (byte) 0xed, (byte) 0xfe,
            (byte) 0x0c, (byte) 0x00, (byte) 0x00, (byte) 0x01,
            (byte) 0x53, (byte) 0x30, (byte) 0x30, (byte) 0x38
        };
        Files.write(helper, bytes);
        makeExecutable(helper);
        verifyTaskHelper(helper);
    }

    private static void writeZip(Path archive, List<TestZipEntry> entries)
            throws IOException {
        try (ZipOutputStream output = new ZipOutputStream(
                new BufferedOutputStream(Files.newOutputStream(archive)))) {
            for (TestZipEntry entry : entries) {
                output.putNextEntry(new ZipEntry(entry.name()));
                output.write(entry.data());
                output.closeEntry();
            }
        }
    }

    private static String sha256(byte[] bytes) {
        return HexFormat.of().formatHex(messageDigest("SHA-256").digest(bytes));
    }

    private static void expectFailure(ThrowingAction action) throws Exception {
        try {
            action.run();
        } catch (IOException expected) {
            return;
        }
        throw new AssertionError("expected an IOException");
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private record ArtifactSpec(long size, String sha256) {
    }

    private record SourceIdentity(
            String cargoLockSha256,
            String helperManifestSha256,
            String rustcVersion,
            String cargoVersion) {
    }

    private record JdkIdentity(String javaSha256, String javacSha256) {
    }

    private record RunPaths(
            Path worktree,
            Path xdg,
            String fullPathHash,
            Path data,
            Path managedHostFallback,
            Path packagedHostFallback,
            Path catalog) {
    }

    private record Prepared(
            Path profile, String helperSha256, Path run1Data, Path run2Data) {
    }

    private record TestZipEntry(String name, byte[] data) {
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }
}
