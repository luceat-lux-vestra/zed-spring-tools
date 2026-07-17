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
 * Verifies and transactionally prepares the fixed S009 inputs under ignored
 * tmp paths. This is disposable feasibility infrastructure, not an installer
 * or a product module.
 */
public final class PrepareS009 {
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String JAVA_SOURCE_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String ZED_SOURCE_COMMIT =
            "0c54c414d522234de7298039708ffe85a116892a";
    private static final String JDT_BUILD_DIRECTORY =
            "jdt-language-server-1.60.0-202606262232";
    private static final String JDT_TREE_SHA256 =
            "b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583";
    private static final String JAVA_EXTENSION_TREE_SHA256 =
            "58e1155d9a6339790470e0b1ac31e49a7fd771a0412b168b22165433347fae68";
    private static final String CATALOG_ENTRY = "gradle/checksums/versions.json";
    private static final String FIXTURE_RELATIVE =
            "spikes/s009-attributed-isolated-profile/fixture/S009Fixture.java";
    private static final String FIXTURE_SHA256 =
            "020c6382e955db42205da24cbbe42441c3c27b92ab59cde186531c1ce4b4c491";
    private static final long FIXTURE_SIZE = 134L;
    private static final String CARGO_LOCK_SHA256 =
            "6d8a9788e6727b3596488ddbf0919e743ef19c0f2e602f1a5cc782069513c583";
    private static final String TASK_HELPER_MANIFEST_SHA256 =
            "7fa67215a3bbbb8c6550cc54e41eb1d26aa94783a2a0e5d622a61f16f8f68480";

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
    private static final ArtifactSpec TASK_HELPER = new ArtifactSpec(
            542_960L,
            "e9b1028b2fa5201c787bf2b22849a9ff11d0859fc5745fd59aaa20e77846e0e7");

    private static final String PROFILE_ALLOWLIST = String.join(";",
            "config/settings.json",
            "fixed/java-lsp-proxy",
            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar",
            "extensions/index.json",
            "extensions/installed/java/**",
            "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY + "/**",
            "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper",
            "extensions/work/java/proxy/",
            "s009-prepared-manifest.txt");
    private static final String CORE_RUNTIME_ROOT_ALLOWLIST = String.join(";",
            "config", "db", "debug_adapters", "extensions", "hang_traces",
            "languages", "node", "prettier", "threads");
    private static final String PROHIBITED_PROFILE_STATE = String.join(";",
            "auth.db", "hosts.json", "apps.json", "credentials", "account", "token",
            "external_agents", "html", "s003-..s008-", "prior-jdt-data", "route-records");

    private static final Set<String> REQUIRED_MANIFEST_KEYS = Set.of(
            "java-source-commit",
            "zed-source-commit",
            "cargo-lock-size",
            "cargo-lock-sha256",
            "task-helper-manifest-size",
            "task-helper-manifest-sha256",
            "rustc-version",
            "cargo-version",
            "task-helper-size",
            "task-helper-sha256",
            "task-helper-architecture",
            "jdtls-tree-sha256",
            "jdt-core-size",
            "jdt-core-sha256",
            "buildship-size",
            "buildship-sha256",
            "catalog-source",
            "catalog-size",
            "catalog-sha256",
            "java-proxy-size",
            "java-proxy-sha256",
            "java-debug-size",
            "java-debug-sha256",
            "java-extension-wasm-size",
            "java-extension-wasm-sha256",
            "java-extension-manifest-size",
            "java-extension-manifest-sha256",
            "java-extension-tree-sha256",
            "zed-cli-size",
            "zed-cli-sha256",
            "zed-version",
            "java-runtime",
            "java-bin-size",
            "java-bin-sha256",
            "javac-bin-size",
            "javac-bin-sha256",
            "fixture-size",
            "fixture-sha256",
            "settings-size",
            "settings-sha256",
            "index-size",
            "index-sha256",
            "profile-allowlist",
            "core-runtime-root-allowlist",
            "prohibited-profile-state",
            "profile",
            "worktree",
            "worktree-sha1",
            "worktree-tree-sha256",
            "xdg-config-home",
            "xdg-cache-home",
            "xdg-data-home",
            "xdg-state-home",
            "catalog",
            "catalog-mtime",
            "expected-data",
            "managed-host-fallback",
            "packaged-host-fallback",
            "trust-all-worktrees",
            "auto-install-html",
            "auto-update-java",
            "disable-ai",
            "gh-copilot-token-at-prepare",
            "github-copilot-token-at-prepare",
            "fresh-destinations",
            "fresh-runtime-paths",
            "proxy-route-at-prepare",
            "live-processes-at-prepare",
            "catalog-runtime-policy",
            "cleanup-requirement",
            "normal-zed-restoration");

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

    private PrepareS009() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S009 preparation synthetic tests passed");
            return;
        }
        if (args.length != 15) {
            System.err.println(
                    "usage: java PrepareS009.java <managed-jdt-build> <java-lsp-proxy> "
                            + "<java-debug.jar> <java-source-checkout> "
                            + "<installed-java-extension> <embedded-zed-cli> <java-home> "
                            + "<java-task-helper> <repository-root> <fresh-profile> "
                            + "<fresh-worktree> <fresh-xdg-config> <fresh-xdg-cache> "
                            + "<fresh-xdg-data> <fresh-xdg-state>");
            System.exit(2);
        }
        Prepared prepared = prepare(
                Path.of(args[0]), Path.of(args[1]), Path.of(args[2]), Path.of(args[3]),
                Path.of(args[4]), Path.of(args[5]), Path.of(args[6]), Path.of(args[7]),
                Path.of(args[8]), Path.of(args[9]), Path.of(args[10]), Path.of(args[11]),
                Path.of(args[12]), Path.of(args[13]), Path.of(args[14]));
        System.out.println("profile=" + prepared.profile());
        System.out.println("task-helper-sha256=" + prepared.helperSha256());
        System.out.println("expected-data=" + prepared.expectedData());
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
            Path worktree,
            Path xdgConfig,
            Path xdgCache,
            Path xdgData,
            Path xdgState) throws Exception {
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
        String proxyHash = verifyArtifact(proxy, JAVA_PROXY);
        String debugHash = verifyArtifact(debug, JAVA_DEBUG);
        Path extensionWasm = requireRegularFile(
                installed.resolve("extension.wasm"), "Java extension WASM");
        Path extensionManifest = requireRegularFile(
                installed.resolve("extension.toml"), "Java extension manifest");
        String wasmHash = verifyArtifact(extensionWasm, JAVA_EXTENSION_WASM);
        String extensionManifestHash = verifyArtifact(
                extensionManifest, JAVA_EXTENSION_MANIFEST);
        verifyJavaExtensionManifest(extensionManifest);
        String installedTreeHash = treeSha256(installed);
        if (!installedTreeHash.equals(JAVA_EXTENSION_TREE_SHA256)) {
            throw new IOException("installed Java extension tree identity changed");
        }
        String cliHash = verifyArtifact(cli, ZED_CLI);
        verifyEmbeddedCli(cli);
        JdkIdentity jdkIdentity = verifyJavaHome(jdk);
        String helperHash = verifyTaskHelper(helper, TASK_HELPER);
        verifyTokenPresence(System.getenv());

        Path fixture = requireRegularFile(
                repository.resolve(FIXTURE_RELATIVE), "S009 Java fixture");
        if (Files.size(fixture) != FIXTURE_SIZE
                || !sha256(fixture).equals(FIXTURE_SHA256)) {
            throw new IOException("S009 fixture digest mismatch");
        }

        Path outputProfile = normalized(profile);
        Path outputWorktree = normalized(worktree);
        Path outputXdgConfig = normalized(xdgConfig);
        Path outputXdgCache = normalized(xdgCache);
        Path outputXdgData = normalized(xdgData);
        Path outputXdgState = normalized(xdgState);
        List<Path> destinations = List.of(
                outputProfile, outputWorktree, outputXdgConfig, outputXdgCache,
                outputXdgData, outputXdgState);
        requireDistinct(destinations);
        Path tmpRoot = requireDirectory(repository.resolve("tmp"), "repository tmp directory");
        for (Path destination : destinations) {
            if (!destination.getParent().equals(tmpRoot)) {
                throw new IOException("S009 destinations must be direct children of repository tmp");
            }
            requireFreshDestination(destination, "S009 destination");
        }

        requireNoRuntimeProcesses();
        RunPaths runPaths = runPaths(outputWorktree, outputXdgCache);
        requireRunFresh(runPaths);

        Path transaction = Files.createTempDirectory(tmpRoot, ".s009-transaction-");
        try {
            Path profileStage = transaction.resolve("profile");
            Path worktreeStage = transaction.resolve("worktree");
            Path xdgConfigStage = transaction.resolve("xdg-config");
            Path xdgCacheStage = transaction.resolve("xdg-cache");
            Path xdgDataStage = transaction.resolve("xdg-data");
            Path xdgStateStage = transaction.resolve("xdg-state");
            for (Path stage : List.of(profileStage, worktreeStage, xdgConfigStage,
                    xdgCacheStage, xdgDataStage, xdgStateStage)) {
                Files.createDirectories(stage);
            }

            Path settings = profileStage.resolve("config/settings.json");
            Files.createDirectories(settings.getParent());
            Path fixedProxy = profileStage.resolve("fixed/java-lsp-proxy");
            Path fixedDebug = profileStage.resolve(
                    "fixed/com.microsoft.java.debug.plugin-0.53.2.jar");
            Files.createDirectories(fixedProxy.getParent());
            Files.copy(proxy, fixedProxy);
            Files.copy(debug, fixedDebug);
            makeExecutable(fixedProxy);
            writeSettings(settings, jdk,
                    outputProfile.resolve("fixed/java-lsp-proxy"),
                    outputProfile.resolve(
                            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"));
            verifySettings(settings, jdk,
                    outputProfile.resolve("fixed/java-lsp-proxy"),
                    outputProfile.resolve(
                            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"));

            Path index = profileStage.resolve("extensions/index.json");
            Files.createDirectories(index.getParent());
            Files.writeString(index, JAVA_ONLY_INDEX, StandardCharsets.UTF_8);
            verifyJavaOnlyIndex(index);

            copyTree(installed, profileStage.resolve("extensions/installed/java"));
            copyTree(jdt, profileStage.resolve(
                    "extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY));
            Path stagedHelper = profileStage.resolve(
                    "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper");
            Files.createDirectories(stagedHelper.getParent());
            Files.copy(helper, stagedHelper);
            makeExecutable(stagedHelper);
            verifyTaskHelper(stagedHelper, TASK_HELPER);
            Files.createDirectories(profileStage.resolve("extensions/work/java/proxy"));

            Files.copy(fixture, worktreeStage.resolve("S009Fixture.java"));
            Path stagedCatalog = xdgCacheStage.resolve("tooling/gradle/versions.json");
            extractCatalog(core, stagedCatalog, CATALOG);

            Map<String, String> manifest = productionManifest(
                    source, helper, helperHash, jdtTreeHash, core, buildship,
                    proxyHash, debugHash, wasmHash, extensionManifestHash,
                    installedTreeHash, cliHash, jdkIdentity, settings, index,
                    Files.size(fixture),
                    treeSha256(worktreeStage),
                    outputProfile, outputWorktree, outputXdgConfig, outputXdgCache,
                    outputXdgData, outputXdgState,
                    outputXdgCache.resolve("tooling/gradle/versions.json"),
                    Files.getLastModifiedTime(stagedCatalog).toMillis(), runPaths);
            Path manifestPath = profileStage.resolve("s009-prepared-manifest.txt");
            writeManifest(manifestPath, manifest);
            verifyManifest(manifestPath);
            verifyPreparedProfile(profileStage, installedTreeHash, jdtTreeHash,
                    helperHash, proxyHash, debugHash, jdk,
                    outputProfile.resolve("fixed/java-lsp-proxy"),
                    outputProfile.resolve(
                            "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"));
            verifyFixtureOnly(worktreeStage);
            verifyEmptyRoot(xdgConfigStage);
            verifyCatalogOnly(xdgCacheStage);
            verifyEmptyRoot(xdgDataStage);
            verifyEmptyRoot(xdgStateStage);

            moveTransactionally(
                    List.of(profileStage, worktreeStage, xdgConfigStage, xdgCacheStage,
                            xdgDataStage, xdgStateStage),
                    destinations);
            return new Prepared(outputProfile, helperHash, runPaths.data());
        } finally {
            deleteRecursively(transaction);
        }
    }

    private static void verifySourceCheckout(Path checkout) throws Exception {
        if (!run(checkout, "git", "rev-parse", "HEAD").equals(JAVA_SOURCE_COMMIT)) {
            throw new IOException("unexpected Java extension source commit");
        }
        if (!run(checkout, "git", "status", "--porcelain").isBlank()) {
            throw new IOException("Java extension source checkout is not clean");
        }
        requireRegularFile(checkout.resolve("src/task.rs"), "task-helper resolution source");
        requireRegularFile(checkout.resolve("src/jdtls_server.rs"), "JDT command source");
        requireRegularFile(checkout.resolve("Cargo.lock"), "Cargo lockfile");
        requireRegularFile(checkout.resolve("task_helper/Cargo.toml"), "helper manifest");
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
        return new SourceIdentity(
                Files.size(lock), sha256(lock), Files.size(manifest), sha256(manifest),
                singleLine(run(checkout, "rustc", "--version")),
                singleLine(run(checkout, "cargo", "--version")));
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
        verifyArtifact(matches.get(0), expected);
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
        return new JdkIdentity(
                Files.size(java), sha256(java), Files.size(javac), sha256(javac));
    }

    private static String verifyTaskHelper(Path helper, ArtifactSpec expected)
            throws IOException {
        String hash = verifyArtifact(helper, expected);
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
        return hash;
    }

    private static void verifyTokenPresence(Map<String, String> environment) throws IOException {
        if (environment.containsKey("GH_COPILOT_TOKEN")
                || environment.containsKey("GITHUB_COPILOT_TOKEN")) {
            throw new IOException("Copilot token environment variable must be absent");
        }
    }

    private static void requireNoRuntimeProcesses() throws IOException {
        try (Stream<ProcessHandle> processes = ProcessHandle.allProcesses()) {
            boolean found = processes.anyMatch(process -> isRuntimeProcess(
                    process.info().command().orElse(""),
                    process.info().arguments().orElse(new String[0])));
            if (found) {
                throw new IOException("an existing Java proxy or JDT process prevents preparation");
            }
        }
    }

    private static boolean isRuntimeProcess(String command, String[] arguments) {
        Path fileName = Path.of(command).getFileName();
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

    private static RunPaths runPaths(Path worktree, Path xdgCache) {
        Path normalizedWorktree = normalized(worktree);
        Path normalizedCache = normalized(xdgCache);
        String fullHash = sha1(normalizedWorktree.toString());
        String basenameHash = sha1(normalizedWorktree.getFileName().toString());
        Path homeCache = Path.of(System.getProperty("user.home"), "Library", "Caches");
        return new RunPaths(
                normalizedWorktree,
                normalizedCache,
                fullHash,
                normalizedCache.resolve("jdtls-" + fullHash),
                homeCache.resolve("jdtls-" + fullHash),
                homeCache.resolve("jdtls").resolve("jdtls-" + basenameHash),
                normalizedCache.resolve("tooling/gradle/versions.json"));
    }

    private static void requireRunFresh(RunPaths runPaths) throws IOException {
        requireFreshDestination(runPaths.worktree(), "worktree");
        requireFreshDestination(runPaths.xdgCache(), "XDG cache root");
        requireFreshDestination(runPaths.data(), "expected JDT data");
        requireFreshDestination(runPaths.managedHostFallback(), "managed host fallback");
        requireFreshDestination(runPaths.packagedHostFallback(), "packaged host fallback");
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

    private static void writeSettings(
            Path destination, Path javaHome, Path proxy, Path debug) throws IOException {
        Files.writeString(destination, settingsText(javaHome, proxy, debug),
                StandardCharsets.UTF_8);
    }

    private static void verifySettings(
            Path settings, Path javaHome, Path proxy, Path debug) throws IOException {
        String actual = Files.readString(settings, StandardCharsets.UTF_8);
        if (!actual.equals(settingsText(javaHome, proxy, debug))) {
            throw new IOException("S009 settings identity changed");
        }
        for (String forbidden : List.of(
                "jdtls_launcher", "spring-boot-language-server",
                "s003-", "s004-", "s005-", "s006-", "s007-", "s008-")) {
            if (actual.contains(forbidden)) {
                throw new IOException("generated settings exceed S009 scope");
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
            if (selected == null || selected.getSize() != expected.size()) {
                throw new IOException("embedded Gradle catalog identity changed");
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
        verifyArtifact(destination, expected);
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
            long fixtureSize,
            String worktreeTreeHash,
            Path profile,
            Path worktree,
            Path xdgConfig,
            Path xdgCache,
            Path xdgData,
            Path xdgState,
            Path catalog,
            long catalogMtime,
            RunPaths runPaths) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("java-source-commit", JAVA_SOURCE_COMMIT);
        values.put("zed-source-commit", ZED_SOURCE_COMMIT);
        values.put("cargo-lock-size", Long.toString(source.cargoLockSize()));
        values.put("cargo-lock-sha256", source.cargoLockSha256());
        values.put("task-helper-manifest-size",
                Long.toString(source.helperManifestSize()));
        values.put("task-helper-manifest-sha256", source.helperManifestSha256());
        values.put("rustc-version", source.rustcVersion());
        values.put("cargo-version", source.cargoVersion());
        values.put("task-helper-size", Long.toString(Files.size(helper)));
        values.put("task-helper-sha256", helperHash);
        values.put("task-helper-architecture", "mach-o64-arm64");
        values.put("jdtls-tree-sha256", jdtTreeHash);
        values.put("jdt-core-size", Long.toString(JDT_CORE.size()));
        values.put("jdt-core-sha256", sha256(core));
        values.put("buildship-size", Long.toString(BUILDSHIP.size()));
        values.put("buildship-sha256", sha256(buildship));
        values.put("catalog-source", "jdt-core!/" + CATALOG_ENTRY);
        values.put("catalog-size", Long.toString(CATALOG.size()));
        values.put("catalog-sha256", CATALOG.sha256());
        values.put("java-proxy-size", Long.toString(JAVA_PROXY.size()));
        values.put("java-proxy-sha256", proxyHash);
        values.put("java-debug-size", Long.toString(JAVA_DEBUG.size()));
        values.put("java-debug-sha256", debugHash);
        values.put("java-extension-wasm-size",
                Long.toString(JAVA_EXTENSION_WASM.size()));
        values.put("java-extension-wasm-sha256", wasmHash);
        values.put("java-extension-manifest-size",
                Long.toString(JAVA_EXTENSION_MANIFEST.size()));
        values.put("java-extension-manifest-sha256", extensionManifestHash);
        values.put("java-extension-tree-sha256", installedTreeHash);
        values.put("zed-cli-size", Long.toString(ZED_CLI.size()));
        values.put("zed-cli-sha256", cliHash);
        values.put("zed-version", "1.10.3 build 20260713.002323");
        values.put("java-runtime", "Temurin 25.0.3+9");
        values.put("java-bin-size", Long.toString(jdkIdentity.javaSize()));
        values.put("java-bin-sha256", jdkIdentity.javaSha256());
        values.put("javac-bin-size", Long.toString(jdkIdentity.javacSize()));
        values.put("javac-bin-sha256", jdkIdentity.javacSha256());
        values.put("fixture-size", Long.toString(fixtureSize));
        values.put("fixture-sha256", FIXTURE_SHA256);
        values.put("settings-size", Long.toString(Files.size(settings)));
        values.put("settings-sha256", sha256(settings));
        values.put("index-size", Long.toString(Files.size(index)));
        values.put("index-sha256", sha256(index));
        values.put("profile-allowlist", PROFILE_ALLOWLIST);
        values.put("core-runtime-root-allowlist", CORE_RUNTIME_ROOT_ALLOWLIST);
        values.put("prohibited-profile-state", PROHIBITED_PROFILE_STATE);
        values.put("profile", profile.toString());
        values.put("worktree", worktree.toString());
        values.put("worktree-sha1", runPaths.fullPathHash());
        values.put("worktree-tree-sha256", worktreeTreeHash);
        values.put("xdg-config-home", xdgConfig.toString());
        values.put("xdg-cache-home", xdgCache.toString());
        values.put("xdg-data-home", xdgData.toString());
        values.put("xdg-state-home", xdgState.toString());
        values.put("catalog", catalog.toString());
        values.put("catalog-mtime", Long.toString(catalogMtime));
        values.put("expected-data", runPaths.data().toString());
        values.put("managed-host-fallback", runPaths.managedHostFallback().toString());
        values.put("packaged-host-fallback", runPaths.packagedHostFallback().toString());
        values.put("trust-all-worktrees", "true");
        values.put("auto-install-html", "false");
        values.put("auto-update-java", "false");
        values.put("disable-ai", "true");
        values.put("gh-copilot-token-at-prepare", "absent");
        values.put("github-copilot-token-at-prepare", "absent");
        values.put("fresh-destinations",
                "profile,worktree,xdg-config,xdg-cache,xdg-data,xdg-state");
        values.put("fresh-runtime-paths",
                "expected-data,managed-host-fallback,packaged-host-fallback");
        values.put("proxy-route-at-prepare", "empty");
        values.put("live-processes-at-prepare", "absent");
        values.put("catalog-runtime-policy", "refresh-mtime-once-immediately-before-run");
        values.put("cleanup-requirement", "stop-processes-wait-five-seconds-remove-route");
        values.put("normal-zed-restoration", "required-after-runtime");
        return values;
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
            if (values.put(line.substring(0, equals), line.substring(equals + 1)) != null) {
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
            if (entry.getKey().endsWith("-size")
                    && !entry.getValue().matches("[1-9][0-9]*")) {
                throw new IOException("manifest size value is malformed");
            }
        }
        if (!values.get("java-source-commit").equals(JAVA_SOURCE_COMMIT)
                || !values.get("zed-source-commit").equals(ZED_SOURCE_COMMIT)
                || !values.get("cargo-lock-sha256").equals(CARGO_LOCK_SHA256)
                || !values.get("task-helper-manifest-sha256")
                        .equals(TASK_HELPER_MANIFEST_SHA256)
                || !values.get("task-helper-size")
                        .equals(Long.toString(TASK_HELPER.size()))
                || !values.get("task-helper-sha256").equals(TASK_HELPER.sha256())
                || !values.get("task-helper-architecture").equals("mach-o64-arm64")
                || !values.get("jdtls-tree-sha256").equals(JDT_TREE_SHA256)
                || !values.get("jdt-core-size").equals(Long.toString(JDT_CORE.size()))
                || !values.get("jdt-core-sha256").equals(JDT_CORE.sha256())
                || !values.get("buildship-size").equals(Long.toString(BUILDSHIP.size()))
                || !values.get("buildship-sha256").equals(BUILDSHIP.sha256())
                || !values.get("catalog-source").equals("jdt-core!/" + CATALOG_ENTRY)
                || !values.get("catalog-size").equals(Long.toString(CATALOG.size()))
                || !values.get("catalog-sha256").equals(CATALOG.sha256())
                || !values.get("java-proxy-size").equals(Long.toString(JAVA_PROXY.size()))
                || !values.get("java-proxy-sha256").equals(JAVA_PROXY.sha256())
                || !values.get("java-debug-size").equals(Long.toString(JAVA_DEBUG.size()))
                || !values.get("java-debug-sha256").equals(JAVA_DEBUG.sha256())
                || !values.get("java-extension-wasm-size")
                        .equals(Long.toString(JAVA_EXTENSION_WASM.size()))
                || !values.get("java-extension-wasm-sha256")
                        .equals(JAVA_EXTENSION_WASM.sha256())
                || !values.get("java-extension-manifest-size")
                        .equals(Long.toString(JAVA_EXTENSION_MANIFEST.size()))
                || !values.get("java-extension-manifest-sha256")
                        .equals(JAVA_EXTENSION_MANIFEST.sha256())
                || !values.get("java-extension-tree-sha256")
                        .equals(JAVA_EXTENSION_TREE_SHA256)
                || !values.get("zed-cli-size").equals(Long.toString(ZED_CLI.size()))
                || !values.get("zed-cli-sha256").equals(ZED_CLI.sha256())
                || !values.get("zed-version").equals("1.10.3 build 20260713.002323")
                || !values.get("java-runtime").equals("Temurin 25.0.3+9")
                || !values.get("fixture-size").equals(Long.toString(FIXTURE_SIZE))
                || !values.get("fixture-sha256").equals(FIXTURE_SHA256)
                || !values.get("profile-allowlist").equals(PROFILE_ALLOWLIST)
                || !values.get("core-runtime-root-allowlist")
                        .equals(CORE_RUNTIME_ROOT_ALLOWLIST)
                || !values.get("prohibited-profile-state").equals(PROHIBITED_PROFILE_STATE)
                || !values.get("trust-all-worktrees").equals("true")
                || !values.get("auto-install-html").equals("false")
                || !values.get("auto-update-java").equals("false")
                || !values.get("disable-ai").equals("true")
                || !values.get("gh-copilot-token-at-prepare").equals("absent")
                || !values.get("github-copilot-token-at-prepare").equals("absent")
                || !values.get("proxy-route-at-prepare").equals("empty")
                || !values.get("live-processes-at-prepare").equals("absent")
                || !values.get("catalog-runtime-policy")
                        .equals("refresh-mtime-once-immediately-before-run")
                || !values.get("cleanup-requirement")
                        .equals("stop-processes-wait-five-seconds-remove-route")
                || !values.get("normal-zed-restoration")
                        .equals("required-after-runtime")) {
            throw new IOException("manifest preparation constraints changed");
        }
        if (!values.get("worktree-sha1").matches("[0-9a-f]{40}")) {
            throw new IOException("manifest worktree SHA-1 is malformed");
        }
        Set<String> xdgRoots = Set.of(
                values.get("xdg-config-home"), values.get("xdg-cache-home"),
                values.get("xdg-data-home"), values.get("xdg-state-home"));
        if (xdgRoots.size() != 4) {
            throw new IOException("manifest XDG roots are not independent");
        }
    }

    private static void verifyPreparedProfile(
            Path profile,
            String installedTreeHash,
            String jdtTreeHash,
            String helperHash,
            String proxyHash,
            String debugHash,
            Path javaHome,
            Path settingsProxy,
            Path settingsDebug) throws IOException {
        requireNames(profile,
                Set.of("config", "fixed", "extensions", "s009-prepared-manifest.txt"));
        requireNames(profile.resolve("config"), Set.of("settings.json"));
        Path fixed = profile.resolve("fixed");
        requireNames(fixed,
                Set.of("java-lsp-proxy", "com.microsoft.java.debug.plugin-0.53.2.jar"));
        Path stagedProxy = requireRegularFile(fixed.resolve("java-lsp-proxy"), "staged proxy");
        Path stagedDebug = requireRegularFile(
                fixed.resolve("com.microsoft.java.debug.plugin-0.53.2.jar"), "staged debug");
        if (!sha256(stagedProxy).equals(proxyHash) || !Files.isExecutable(stagedProxy)
                || !sha256(stagedDebug).equals(debugHash)) {
            throw new IOException("staged fixed Java artifact selection changed");
        }
        requireNames(profile.resolve("extensions"), Set.of("index.json", "installed", "work"));
        requireNames(profile.resolve("extensions/installed"), Set.of("java"));
        if (!treeSha256(profile.resolve("extensions/installed/java"))
                .equals(installedTreeHash)) {
            throw new IOException("staged Java extension tree identity changed");
        }
        Path javaWork = profile.resolve("extensions/work/java");
        requireNames(profile.resolve("extensions/work"), Set.of("java"));
        requireNames(javaWork, Set.of("jdtls", "bin", "proxy"));
        requireNames(javaWork.resolve("jdtls"), Set.of(JDT_BUILD_DIRECTORY));
        if (!treeSha256(javaWork.resolve("jdtls/" + JDT_BUILD_DIRECTORY))
                .equals(jdtTreeHash)) {
            throw new IOException("staged managed JDT tree identity changed");
        }
        requireNames(javaWork.resolve("bin"), Set.of(JAVA_SOURCE_COMMIT));
        Path helperDirectory = javaWork.resolve("bin/" + JAVA_SOURCE_COMMIT);
        requireNames(helperDirectory, Set.of("java-task-helper"));
        Path helper = requireRegularFile(
                helperDirectory.resolve("java-task-helper"), "staged task helper");
        if (!sha256(helper).equals(helperHash) || !Files.isExecutable(helper)) {
            throw new IOException("staged task helper selection changed");
        }
        requireNames(javaWork.resolve("proxy"), Set.of());
        verifySettings(profile.resolve("config/settings.json"),
                javaHome, settingsProxy, settingsDebug);
        verifyJavaOnlyIndex(profile.resolve("extensions/index.json"));
        verifyManifest(profile.resolve("s009-prepared-manifest.txt"));
        rejectForbiddenProfileState(profile);
    }

    private static void rejectForbiddenProfileState(Path profile) throws IOException {
        Set<String> forbiddenNames = Set.of(
                "auth.db", "hosts.json", "apps.json", "credentials", "account", "token",
                "external_agents", "html", "providers");
        try (Stream<Path> paths = Files.walk(profile)) {
            for (Path path : paths.toList()) {
                String name = path.getFileName().toString();
                String relative = profile.relativize(path).toString();
                if (forbiddenNames.contains(name)
                        || relative.matches(".*s00[3-8]-.*")
                        || relative.contains("jdtls-")
                                && !relative.contains(JDT_BUILD_DIRECTORY)) {
                    throw new IOException("profile contains prohibited prior or mutable state");
                }
            }
        }
    }

    private static void verifyFixtureOnly(Path worktree) throws IOException {
        requireNames(worktree, Set.of("S009Fixture.java"));
        Path fixture = worktree.resolve("S009Fixture.java");
        if (Files.size(fixture) != FIXTURE_SIZE
                || !sha256(fixture).equals(FIXTURE_SHA256)) {
            throw new IOException("staged S009 fixture identity changed");
        }
    }

    private static void verifyCatalogOnly(Path xdgCache) throws IOException {
        requireNames(xdgCache, Set.of("tooling"));
        requireNames(xdgCache.resolve("tooling"), Set.of("gradle"));
        requireNames(xdgCache.resolve("tooling/gradle"), Set.of("versions.json"));
        verifyArtifact(xdgCache.resolve("tooling/gradle/versions.json"), CATALOG);
    }

    private static void verifyEmptyRoot(Path root) throws IOException {
        requireNames(root, Set.of());
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

    private static String verifyArtifact(Path path, ArtifactSpec expected) throws IOException {
        Path artifact = requireRegularFile(path, "fixed artifact");
        if (Files.size(artifact) != expected.size()) {
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
            throw new IOException("S009 destinations must be distinct");
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
            throw new IOException("failed to make staged executable");
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

    private static String sha256(byte[] bytes) {
        return HexFormat.of().formatHex(messageDigest("SHA-256").digest(bytes));
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
        Path root = Files.createTempDirectory("s009-prepare-test-");
        try {
            testSettingsComposition(root);
            testJavaOnlyIndex(root);
            testCatalogExtractionAndRejection(root);
            testPathsAndXdgIndependence(root);
            testTokenPresence();
            testProcessIdentification();
            testProfileAllowlist(root);
            testTransactionCleanup(root);
            testManifestCompleteness(root);
        } finally {
            deleteRecursively(root);
        }
    }

    private static void testSettingsComposition(Path root) throws Exception {
        Path javaHome = root.resolve("JDK 25 한글");
        Path proxy = root.resolve("profile space/fixed/java-lsp-proxy");
        Path debug = root.resolve("profile space/fixed/debug.jar");
        Path settings = root.resolve("settings.json");
        writeSettings(settings, javaHome, proxy, debug);
        verifySettings(settings, javaHome, proxy, debug);

        String original = Files.readString(settings, StandardCharsets.UTF_8);
        for (String mutation : List.of(
                original.replace("\"disable_ai\": true", "\"disable_ai\": false"),
                original.replace("\"trust_all_worktrees\": true",
                        "\"trust_all_worktrees\": false"),
                original.replace("\"html\": false", "\"html\": true"),
                original.replace("\"java\": false", "\"java\": true"),
                original.replace("\"restore_unsaved_buffers\": false,\n", ""),
                original.replace("\"disable_ai\": true,",
                        "\"disable_ai\": true,\n  \"unexpected\": true,"))) {
            Files.writeString(settings, mutation, StandardCharsets.UTF_8);
            expectFailure(() -> verifySettings(settings, javaHome, proxy, debug));
        }
        Files.writeString(settings, original, StandardCharsets.UTF_8);
    }

    private static void testJavaOnlyIndex(Path root) throws Exception {
        Path index = root.resolve("index.json");
        Files.writeString(index, JAVA_ONLY_INDEX, StandardCharsets.UTF_8);
        verifyJavaOnlyIndex(index);
        Files.writeString(index, JAVA_ONLY_INDEX.replace("\"dev\": false", "\"dev\": true"),
                StandardCharsets.UTF_8);
        expectFailure(() -> verifyJavaOnlyIndex(index));
        Files.writeString(index, JAVA_ONLY_INDEX.replace(
                "\"extensions\": {", "\"extensions\": {\n    \"html\": {},"),
                StandardCharsets.UTF_8);
        expectFailure(() -> verifyJavaOnlyIndex(index));
    }

    private static void testCatalogExtractionAndRejection(Path root) throws Exception {
        byte[] catalog = "{\"versions\":[\"8.14\"]}".getBytes(StandardCharsets.UTF_8);
        ArtifactSpec expected = new ArtifactSpec(catalog.length, sha256(catalog));
        Path good = root.resolve("catalog-good.jar");
        writeZip(good, List.of(new TestZipEntry(CATALOG_ENTRY, catalog)));
        Path output = root.resolve("catalog-good/versions.json");
        extractCatalog(good, output, expected);
        require(java.util.Arrays.equals(Files.readAllBytes(output), catalog),
                "catalog extraction changed bytes");

        Path wrong = root.resolve("catalog-wrong.jar");
        writeZip(wrong, List.of(new TestZipEntry(CATALOG_ENTRY,
                "wrong".getBytes(StandardCharsets.UTF_8))));
        expectFailure(() -> extractCatalog(wrong, root.resolve("wrong/out"), expected));
        Path duplicate = root.resolve("catalog-duplicate.jar");
        writeZip(duplicate, List.of(
                new TestZipEntry(CATALOG_ENTRY, catalog),
                new TestZipEntry("gradle/checksums/./versions.json", catalog)));
        expectFailure(() -> extractCatalog(duplicate,
                root.resolve("duplicate/out"), expected));
        Path traversal = root.resolve("catalog-traversal.jar");
        writeZip(traversal, List.of(
                new TestZipEntry("../escape", catalog),
                new TestZipEntry(CATALOG_ENTRY, catalog)));
        expectFailure(() -> extractCatalog(traversal,
                root.resolve("traversal/out"), expected));
    }

    private static void testPathsAndXdgIndependence(Path root) throws Exception {
        Path worktree = root.resolve("work tree 한글");
        RunPaths first = runPaths(worktree, root.resolve("xdg cache one"));
        RunPaths second = runPaths(worktree, root.resolve("xdg cache two"));
        require(first.fullPathHash().equals(second.fullPathHash()),
                "worktree hash depends on XDG cache root");
        require(first.fullPathHash().equals(sha1(normalized(worktree).toString())),
                "worktree hash does not use the normalized full path");
        require(!first.data().equals(second.data()),
                "distinct XDG cache roots share expected data");
        require(first.data().startsWith(first.xdgCache()),
                "expected data is outside XDG cache root");

        List<Path> xdgRoots = List.of(
                root.resolve("config 한글"), root.resolve("cache 한글"),
                root.resolve("data 한글"), root.resolve("state 한글"));
        requireDistinct(xdgRoots);
        Path existing = root.resolve("existing-output");
        Files.createDirectory(existing);
        expectFailure(() -> requireFreshDestination(existing, "synthetic output"));
        Path symlink = root.resolve("existing-symlink");
        Files.createSymbolicLink(symlink, existing);
        expectFailure(() -> requireFreshDestination(symlink, "synthetic symlink"));
    }

    private static void testTokenPresence() throws Exception {
        verifyTokenPresence(Map.of());
        expectFailure(() -> verifyTokenPresence(Map.of("GH_COPILOT_TOKEN", "not-recorded")));
        expectFailure(() -> verifyTokenPresence(
                Map.of("GITHUB_COPILOT_TOKEN", "not-recorded")));
    }

    private static void testProcessIdentification() {
        require(isRuntimeProcess("/fixed/java-lsp-proxy", new String[0]),
                "proxy executable was not identified");
        require(isRuntimeProcess("/fixed/jdk/bin/java",
                new String[] {"-jar", "org.eclipse.equinox.launcher_1.7.0.jar"}),
                "JDT Java process was not identified");
        require(!isRuntimeProcess("/fixed/jdk/bin/java",
                new String[] {"PrepareS009", "/input/java-lsp-proxy"}),
                "preparation process was misidentified as runtime");
    }

    private static void testProfileAllowlist(Path root) throws Exception {
        Path installed = root.resolve("source-installed");
        Files.createDirectories(installed.resolve("languages/java"));
        Files.writeString(installed.resolve("extension.wasm"), "wasm", StandardCharsets.UTF_8);
        Files.writeString(installed.resolve("extension.toml"), "manifest", StandardCharsets.UTF_8);
        Path jdt = root.resolve("source-jdt");
        Files.createDirectories(jdt.resolve("config_mac_arm"));
        Files.createDirectories(jdt.resolve("plugins"));
        Files.createDirectories(jdt.resolve("bin"));
        Files.writeString(jdt.resolve("bin/jdtls"), "launcher", StandardCharsets.UTF_8);

        Path finalProfile = root.resolve("final-profile");
        Path profile = root.resolve("profile");
        Files.createDirectories(profile.resolve("config"));
        Files.createDirectories(profile.resolve("extensions"));
        Path fixedProxy = profile.resolve("fixed/java-lsp-proxy");
        Path fixedDebug = profile.resolve("fixed/com.microsoft.java.debug.plugin-0.53.2.jar");
        Files.createDirectories(fixedProxy.getParent());
        Files.writeString(fixedProxy, "proxy", StandardCharsets.UTF_8);
        Files.writeString(fixedDebug, "debug", StandardCharsets.UTF_8);
        makeExecutable(fixedProxy);
        Path settingsProxy = finalProfile.resolve("fixed/java-lsp-proxy");
        Path settingsDebug = finalProfile.resolve(
                "fixed/com.microsoft.java.debug.plugin-0.53.2.jar");
        Path javaHome = root.resolve("JDK 25");
        writeSettings(profile.resolve("config/settings.json"),
                javaHome, settingsProxy, settingsDebug);
        Files.writeString(profile.resolve("extensions/index.json"),
                JAVA_ONLY_INDEX, StandardCharsets.UTF_8);
        copyTree(installed, profile.resolve("extensions/installed/java"));
        copyTree(jdt, profile.resolve("extensions/work/java/jdtls/" + JDT_BUILD_DIRECTORY));
        Path helper = profile.resolve(
                "extensions/work/java/bin/" + JAVA_SOURCE_COMMIT + "/java-task-helper");
        Files.createDirectories(helper.getParent());
        Files.writeString(helper, "helper", StandardCharsets.UTF_8);
        makeExecutable(helper);
        Files.createDirectories(profile.resolve("extensions/work/java/proxy"));
        writeManifest(profile.resolve("s009-prepared-manifest.txt"), syntheticManifest(root));

        String installedHash = treeSha256(installed);
        String jdtHash = treeSha256(jdt);
        String helperHash = sha256(helper);
        String proxyHash = sha256(fixedProxy);
        String debugHash = sha256(fixedDebug);
        verifyPreparedProfile(profile, installedHash, jdtHash, helperHash,
                proxyHash, debugHash, javaHome, settingsProxy, settingsDebug);

        Path forbidden = profile.resolve("auth.db");
        Files.writeString(forbidden, "credential", StandardCharsets.UTF_8);
        expectFailure(() -> verifyPreparedProfile(profile, installedHash, jdtHash,
                helperHash, proxyHash, debugHash, javaHome, settingsProxy, settingsDebug));
        Files.delete(forbidden);
        Path html = profile.resolve("extensions/installed/html");
        Files.createDirectory(html);
        expectFailure(() -> verifyPreparedProfile(profile, installedHash, jdtHash,
                helperHash, proxyHash, debugHash, javaHome, settingsProxy, settingsDebug));
        Files.delete(html);
        Path sibling = helper.getParent().resolve("other-helper");
        Files.writeString(sibling, "unexpected", StandardCharsets.UTF_8);
        expectFailure(() -> verifyPreparedProfile(profile, installedHash, jdtHash,
                helperHash, proxyHash, debugHash, javaHome, settingsProxy, settingsDebug));
        Files.delete(sibling);
        Path secondJdt = profile.resolve("extensions/work/java/jdtls/other-jdt");
        Files.createDirectory(secondJdt);
        expectFailure(() -> verifyPreparedProfile(profile, installedHash, jdtHash,
                helperHash, proxyHash, debugHash, javaHome, settingsProxy, settingsDebug));
        Files.delete(secondJdt);
        Path route = profile.resolve("extensions/work/java/proxy/12345");
        Files.writeString(route, "route", StandardCharsets.UTF_8);
        expectFailure(() -> verifyPreparedProfile(profile, installedHash, jdtHash,
                helperHash, proxyHash, debugHash, javaHome, settingsProxy, settingsDebug));
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
        require(Files.exists(destination2), "failed transaction removed caller-owned output");
    }

    private static void testManifestCompleteness(Path root) throws Exception {
        Path manifest = root.resolve("synthetic-manifest.txt");
        writeManifest(manifest, syntheticManifest(root));
        verifyManifest(manifest);
        String text = Files.readString(manifest, StandardCharsets.UTF_8);
        require(!text.contains("not-recorded"), "manifest retained a synthetic token value");
        List<String> incomplete = Files.readAllLines(manifest, StandardCharsets.UTF_8);
        incomplete.remove(incomplete.size() - 1);
        Path truncated = root.resolve("truncated-manifest.txt");
        Files.write(truncated, incomplete, StandardCharsets.UTF_8);
        expectFailure(() -> verifyManifest(truncated));

        List<String> weakened = Files.readAllLines(manifest, StandardCharsets.UTF_8);
        for (int index = 0; index < weakened.size(); index++) {
            if (weakened.get(index).equals("disable-ai=true")) {
                weakened.set(index, "disable-ai=false");
            }
        }
        Path weak = root.resolve("weak-manifest.txt");
        Files.write(weak, weakened, StandardCharsets.UTF_8);
        expectFailure(() -> verifyManifest(weak));
    }

    private static Map<String, String> syntheticManifest(Path root) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String key : REQUIRED_MANIFEST_KEYS.stream().sorted().toList()) {
            if (key.endsWith("sha256")) {
                values.put(key, "a".repeat(64));
            } else if (key.endsWith("-size")) {
                values.put(key, "1");
            } else {
                values.put(key, "synthetic");
            }
        }
        values.put("java-source-commit", JAVA_SOURCE_COMMIT);
        values.put("zed-source-commit", ZED_SOURCE_COMMIT);
        values.put("cargo-lock-sha256", CARGO_LOCK_SHA256);
        values.put("task-helper-manifest-sha256", TASK_HELPER_MANIFEST_SHA256);
        values.put("task-helper-size", Long.toString(TASK_HELPER.size()));
        values.put("task-helper-sha256", TASK_HELPER.sha256());
        values.put("task-helper-architecture", "mach-o64-arm64");
        values.put("jdtls-tree-sha256", JDT_TREE_SHA256);
        values.put("jdt-core-size", Long.toString(JDT_CORE.size()));
        values.put("jdt-core-sha256", JDT_CORE.sha256());
        values.put("buildship-size", Long.toString(BUILDSHIP.size()));
        values.put("buildship-sha256", BUILDSHIP.sha256());
        values.put("catalog-source", "jdt-core!/" + CATALOG_ENTRY);
        values.put("catalog-size", Long.toString(CATALOG.size()));
        values.put("catalog-sha256", CATALOG.sha256());
        values.put("java-proxy-size", Long.toString(JAVA_PROXY.size()));
        values.put("java-proxy-sha256", JAVA_PROXY.sha256());
        values.put("java-debug-size", Long.toString(JAVA_DEBUG.size()));
        values.put("java-debug-sha256", JAVA_DEBUG.sha256());
        values.put("java-extension-wasm-size",
                Long.toString(JAVA_EXTENSION_WASM.size()));
        values.put("java-extension-wasm-sha256", JAVA_EXTENSION_WASM.sha256());
        values.put("java-extension-manifest-size",
                Long.toString(JAVA_EXTENSION_MANIFEST.size()));
        values.put("java-extension-manifest-sha256",
                JAVA_EXTENSION_MANIFEST.sha256());
        values.put("java-extension-tree-sha256", JAVA_EXTENSION_TREE_SHA256);
        values.put("zed-cli-size", Long.toString(ZED_CLI.size()));
        values.put("zed-cli-sha256", ZED_CLI.sha256());
        values.put("zed-version", "1.10.3 build 20260713.002323");
        values.put("java-runtime", "Temurin 25.0.3+9");
        values.put("fixture-size", Long.toString(FIXTURE_SIZE));
        values.put("fixture-sha256", FIXTURE_SHA256);
        values.put("worktree-sha1", "1".repeat(40));
        values.put("profile-allowlist", PROFILE_ALLOWLIST);
        values.put("core-runtime-root-allowlist", CORE_RUNTIME_ROOT_ALLOWLIST);
        values.put("prohibited-profile-state", PROHIBITED_PROFILE_STATE);
        values.put("trust-all-worktrees", "true");
        values.put("auto-install-html", "false");
        values.put("auto-update-java", "false");
        values.put("disable-ai", "true");
        values.put("gh-copilot-token-at-prepare", "absent");
        values.put("github-copilot-token-at-prepare", "absent");
        values.put("proxy-route-at-prepare", "empty");
        values.put("live-processes-at-prepare", "absent");
        values.put("catalog-runtime-policy", "refresh-mtime-once-immediately-before-run");
        values.put("cleanup-requirement", "stop-processes-wait-five-seconds-remove-route");
        values.put("normal-zed-restoration", "required-after-runtime");
        values.put("xdg-config-home", root.resolve("xdg config").toString());
        values.put("xdg-cache-home", root.resolve("xdg cache").toString());
        values.put("xdg-data-home", root.resolve("xdg data").toString());
        values.put("xdg-state-home", root.resolve("xdg state").toString());
        return values;
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
            long cargoLockSize,
            String cargoLockSha256,
            long helperManifestSize,
            String helperManifestSha256,
            String rustcVersion,
            String cargoVersion) {
    }

    private record JdkIdentity(
            long javaSize,
            String javaSha256,
            long javacSize,
            String javacSha256) {
    }

    private record RunPaths(
            Path worktree,
            Path xdgCache,
            String fullPathHash,
            Path data,
            Path managedHostFallback,
            Path packagedHostFallback,
            Path catalog) {
    }

    private record Prepared(Path profile, String helperSha256, Path expectedData) {
    }

    private record TestZipEntry(String name, byte[] data) {
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }
}
