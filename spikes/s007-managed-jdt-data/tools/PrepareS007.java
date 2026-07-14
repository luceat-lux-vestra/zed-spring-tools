import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
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
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Verifies and prepares the fixed S007 inputs under ignored tmp paths. This is
 * disposable feasibility infrastructure, not an installer or product module.
 */
public final class PrepareS007 {
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int TAR_BLOCK_SIZE = 512;
    private static final Limits PRODUCTION_LIMITS =
            new Limits(50_000, 536_870_912L, 1_073_741_824L, 16 * 1024);
    private static final Set<String> ALLOWED_PAX_KEYS = Set.of("uid", "gid", "mtime");

    private static final String JAVA_SOURCE_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String JDT_BUILD_DIRECTORY =
            "jdt-language-server-1.60.0-202606262232";
    private static final String FIXTURE_RELATIVE =
            "spikes/s007-managed-jdt-data/fixture/S007Fixture.java";
    private static final String FIXTURE_SHA256 =
            "5f13a198609f7377b1e94de674f05d733b5b11276a3130a8939d4c0d3f2d9a90";

    private static final ArtifactSpec JDT_ARCHIVE = new ArtifactSpec(
            50_925_681L,
            "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d");
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

    private static final Set<String> REQUIRED_MANIFEST_KEYS = Set.of(
            "jdtls-archive-sha256",
            "jdtls-tree-sha256",
            "java-proxy-sha256",
            "java-debug-sha256",
            "java-extension-wasm-sha256",
            "java-extension-manifest-sha256",
            "java-source-commit",
            "zed-cli-sha256",
            "zed-version",
            "java-runtime",
            "fixture-sha256",
            "settings-sha256",
            "staged-jdt-build",
            "managed-jdt-destination",
            "managed-config-mac-arm",
            "worktree-1",
            "worktree-sha1-1",
            "xdg-1",
            "expected-data-1",
            "managed-host-fallback-1",
            "packaged-host-fallback-1",
            "worktree-2",
            "worktree-sha1-2",
            "xdg-2",
            "expected-data-2",
            "managed-host-fallback-2",
            "packaged-host-fallback-2");

    private PrepareS007() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S007 preparation synthetic tests passed");
            return;
        }
        if (args.length != 14) {
            System.err.println(
                    "usage: java PrepareS007.java <jdtls.tar.gz> <java-lsp-proxy> "
                            + "<java-debug.jar> <java-source-checkout> "
                            + "<installed-java-extension> <embedded-zed-cli> <java-home> "
                            + "<repository-root> <java-extension-work-dir> "
                            + "<fresh-prepared-output> <fresh-worktree-1> <fresh-xdg-1> "
                            + "<fresh-worktree-2> <fresh-xdg-2>");
            System.exit(2);
        }

        Prepared prepared = prepare(
                Path.of(args[0]), Path.of(args[1]), Path.of(args[2]), Path.of(args[3]),
                Path.of(args[4]), Path.of(args[5]), Path.of(args[6]), Path.of(args[7]),
                Path.of(args[8]), Path.of(args[9]), Path.of(args[10]), Path.of(args[11]),
                Path.of(args[12]), Path.of(args[13]));
        System.out.println("jdtls-tree-sha256=" + prepared.jdtTreeSha256());
        System.out.println("settings-sha256=" + prepared.settingsSha256());
        System.out.println("run-data-paths-distinct="
                + !prepared.run1Data().equals(prepared.run2Data()));
    }

    private static Prepared prepare(
            Path jdtArchive,
            Path javaProxy,
            Path javaDebug,
            Path javaSourceCheckout,
            Path installedJavaExtension,
            Path embeddedZedCli,
            Path javaHome,
            Path repositoryRoot,
            Path javaExtensionWorkDirectory,
            Path preparedOutput,
            Path worktree1,
            Path xdg1,
            Path worktree2,
            Path xdg2) throws Exception {
        Path archive = requireRegularFile(jdtArchive, "JDT LS archive");
        Path proxy = requireRegularFile(javaProxy, "Java proxy");
        Path debug = requireRegularFile(javaDebug, "Java debug bundle");
        Path checkout = requireDirectory(javaSourceCheckout, "Java source checkout");
        Path installed = requireDirectory(installedJavaExtension, "installed Java extension");
        Path cli = requireRegularFile(embeddedZedCli, "embedded Zed CLI");
        Path jdk = requireDirectory(javaHome, "Java home");
        Path repository = requireDirectory(repositoryRoot, "repository root");
        Path javaWork = requireDirectory(
                javaExtensionWorkDirectory, "Java extension work directory");

        requireFileName(archive, "jdt-language-server-1.60.0-202606262232.tar.gz");
        String archiveHash = verifyArtifact(archive, JDT_ARCHIVE);
        String proxyHash = verifyArtifact(proxy, JAVA_PROXY);
        String debugHash = verifyArtifact(debug, JAVA_DEBUG);
        String wasmHash = verifyArtifact(
                requireRegularFile(installed.resolve("extension.wasm"), "Java extension WASM"),
                JAVA_EXTENSION_WASM);
        Path extensionManifest = requireRegularFile(
                installed.resolve("extension.toml"), "Java extension manifest");
        String extensionManifestHash = verifyArtifact(
                extensionManifest, JAVA_EXTENSION_MANIFEST);
        verifyJavaExtensionManifest(extensionManifest);
        String cliHash = verifyArtifact(cli, ZED_CLI);
        verifySourceCheckout(checkout);
        verifyEmbeddedCli(cli);
        verifyJavaHome(jdk);

        Path fixture = requireRegularFile(
                repository.resolve(FIXTURE_RELATIVE), "S007 Java fixture");
        if (!sha256(fixture).equals(FIXTURE_SHA256)) {
            throw new IOException("S007 fixture digest mismatch");
        }

        Path output = normalized(preparedOutput);
        Path firstWorktree = normalized(worktree1);
        Path firstXdg = normalized(xdg1);
        Path secondWorktree = normalized(worktree2);
        Path secondXdg = normalized(xdg2);
        List<Path> destinations = List.of(
                output, firstWorktree, firstXdg, secondWorktree, secondXdg);
        requireDistinct(destinations);
        Path tmpRoot = requireDirectory(repository.resolve("tmp"), "repository tmp directory");
        for (Path destination : destinations) {
            if (!destination.getParent().equals(tmpRoot)) {
                throw new IOException("S007 destinations must be direct children of repository tmp");
            }
            requireFreshDestination(destination, "S007 destination");
        }

        requireManagedWorkFresh(javaWork);
        requireNoJdtProcess();
        RunPaths run1 = runPaths(firstWorktree, firstXdg);
        RunPaths run2 = runPaths(secondWorktree, secondXdg);
        if (run1.data().equals(run2.data()) || run1.fullPathHash().equals(run2.fullPathHash())) {
            throw new IOException("S007 run data identities are not distinct");
        }
        requireRunFresh(run1);
        requireRunFresh(run2);

        Path transaction = Files.createTempDirectory(tmpRoot, ".s007-transaction-");
        List<Path> moved = new ArrayList<>();
        try {
            Path preparedStage = transaction.resolve("prepared");
            Path worktree1Stage = transaction.resolve("worktree-1");
            Path xdg1Stage = transaction.resolve("xdg-1");
            Path worktree2Stage = transaction.resolve("worktree-2");
            Path xdg2Stage = transaction.resolve("xdg-2");
            Files.createDirectories(preparedStage);
            Files.createDirectories(worktree1Stage);
            Files.createDirectories(xdg1Stage);
            Files.createDirectories(worktree2Stage);
            Files.createDirectories(xdg2Stage);

            Path stagedJdt = preparedStage.resolve("jdtls").resolve(JDT_BUILD_DIRECTORY);
            Files.createDirectories(stagedJdt.getParent());
            extractTarGzip(archive, stagedJdt, PRODUCTION_LIMITS);
            verifyJdtLayout(stagedJdt);
            requireExactlyOneManagedCandidate(stagedJdt.getParent(), JDT_BUILD_DIRECTORY);
            String jdtTreeHash = treeSha256(stagedJdt);

            Path stagedProxy = preparedStage.resolve("proxy/java-lsp-proxy");
            Path stagedDebug = preparedStage.resolve(
                    "debug/com.microsoft.java.debug.plugin-0.53.2.jar");
            Files.createDirectories(stagedProxy.getParent());
            Files.createDirectories(stagedDebug.getParent());
            Files.copy(proxy, stagedProxy);
            Files.copy(debug, stagedDebug);
            verifyArtifact(stagedProxy, JAVA_PROXY);
            verifyArtifact(stagedDebug, JAVA_DEBUG);
            makeExecutable(stagedProxy);

            Files.copy(fixture, worktree1Stage.resolve("S007Fixture.java"));
            Files.copy(fixture, worktree2Stage.resolve("S007Fixture.java"));

            Path settings = preparedStage.resolve("isolated-settings.json");
            writeSettings(
                    settings,
                    jdk,
                    output.resolve("proxy/java-lsp-proxy"),
                    output.resolve("debug/com.microsoft.java.debug.plugin-0.53.2.jar"));
            verifySettings(settings);
            String settingsHash = sha256(settings);

            Path managedJdt = javaWork.resolve("jdtls").resolve(JDT_BUILD_DIRECTORY);
            Path managedConfig = managedJdt.resolve("config_mac_arm");
            Path manifest = preparedStage.resolve("s007-prepared-manifest.txt");
            writeManifest(
                    manifest,
                    archiveHash,
                    jdtTreeHash,
                    proxyHash,
                    debugHash,
                    wasmHash,
                    extensionManifestHash,
                    cliHash,
                    settingsHash,
                    output.resolve("jdtls").resolve(JDT_BUILD_DIRECTORY),
                    managedJdt,
                    managedConfig,
                    run1,
                    run2);
            verifyManifest(manifest);

            moveFresh(preparedStage, output);
            moved.add(output);
            moveFresh(worktree1Stage, firstWorktree);
            moved.add(firstWorktree);
            moveFresh(xdg1Stage, firstXdg);
            moved.add(firstXdg);
            moveFresh(worktree2Stage, secondWorktree);
            moved.add(secondWorktree);
            moveFresh(xdg2Stage, secondXdg);
            moved.add(secondXdg);
            return new Prepared(jdtTreeHash, settingsHash, run1.data(), run2.data());
        } catch (Exception error) {
            for (int index = moved.size() - 1; index >= 0; index--) {
                deleteRecursively(moved.get(index));
            }
            throw error;
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
        requireRegularFile(checkout.resolve("src/jdtls.rs"), "Java JDT source");
        requireRegularFile(checkout.resolve("src/downloadable.rs"), "Java download source");
        requireRegularFile(checkout.resolve("src/jdtls_server.rs"), "Java server source");
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

    private static void verifyJavaHome(Path javaHome) throws Exception {
        Path java = requireRegularFile(javaHome.resolve("bin/java"), "JDK java executable");
        Path javac = requireRegularFile(javaHome.resolve("bin/javac"), "JDK javac executable");
        if (!Files.isExecutable(java) || !Files.isExecutable(javac)) {
            throw new IOException("JDK executables are not executable");
        }
        String version = run(javaHome, java.toString(), "-version");
        if (!version.contains("25.0.3") || !version.contains("Temurin-25.0.3+9")) {
            throw new IOException("JDK runtime identity changed");
        }
    }

    private static void requireManagedWorkFresh(Path javaWork) throws IOException {
        Path managedJdtRoot = javaWork.resolve("jdtls");
        if (Files.exists(managedJdtRoot, LinkOption.NOFOLLOW_LINKS)) {
            Path directory = requireDirectory(managedJdtRoot, "managed JDT root");
            try (Stream<Path> entries = Files.list(directory)) {
                if (entries.findAny().isPresent()) {
                    throw new IOException("managed JDT root contains an unknown candidate");
                }
            }
        }
        Path proxyRecords = javaWork.resolve("proxy");
        if (Files.exists(proxyRecords, LinkOption.NOFOLLOW_LINKS)) {
            Path directory = requireDirectory(proxyRecords, "Java proxy record directory");
            try (Stream<Path> entries = Files.list(directory)) {
                if (entries.findAny().isPresent()) {
                    throw new IOException("Java proxy record directory is not empty");
                }
            }
        }
    }

    private static void requireNoJdtProcess() throws IOException {
        try (Stream<ProcessHandle> processes = ProcessHandle.allProcesses()) {
            boolean found = processes.anyMatch(process -> {
                ProcessHandle.Info info = process.info();
                String command = info.command().orElse("");
                String arguments = String.join(" ", info.arguments().orElse(new String[0]));
                String combined = command + " " + arguments;
                return combined.contains("org.eclipse.jdt.ls.core")
                        || combined.contains("org.eclipse.equinox.launcher_");
            });
            if (found) {
                throw new IOException("an existing JDT process prevents fresh preparation");
            }
        }
    }

    private static RunPaths runPaths(Path worktree, Path xdg) {
        String fullHash = sha1(worktree.toString());
        String basenameHash = sha1(worktree.getFileName().toString());
        Path homeCache = Path.of(System.getProperty("user.home"), "Library", "Caches");
        return new RunPaths(
                worktree,
                xdg,
                fullHash,
                xdg.resolve("jdtls-" + fullHash),
                homeCache.resolve("jdtls-" + fullHash),
                homeCache.resolve("jdtls").resolve("jdtls-" + basenameHash));
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
                        jsonString(javaHome.toString()),
                        jsonString(proxy.toString()),
                        jsonString(debug.toString()));
        Files.writeString(destination, settings, StandardCharsets.UTF_8);
    }

    private static void verifySettings(Path settings) throws IOException {
        String text = Files.readString(settings, StandardCharsets.UTF_8);
        List<String> required = List.of(
                "\"Java\"",
                "\"language_servers\": [\"jdtls\"]",
                "\"lsp_proxy_path\"",
                "\"java_debug_jar\"",
                "\"lombok_support\": false",
                "\"jdk_auto_download\": false",
                "\"check_updates\": \"never\"");
        for (String token : required) {
            if (!text.contains(token)) {
                throw new IOException("generated settings are incomplete");
            }
        }
        if (text.contains("jdtls_launcher") || text.contains("Properties")
                || text.contains("spring")) {
            throw new IOException("generated settings exceed S007 scope");
        }
    }

    private static void writeManifest(
            Path destination,
            String archiveHash,
            String jdtTreeHash,
            String proxyHash,
            String debugHash,
            String wasmHash,
            String extensionManifestHash,
            String cliHash,
            String settingsHash,
            Path stagedJdt,
            Path managedJdt,
            Path managedConfig,
            RunPaths run1,
            RunPaths run2) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("jdtls-archive-sha256", archiveHash);
        values.put("jdtls-tree-sha256", jdtTreeHash);
        values.put("java-proxy-sha256", proxyHash);
        values.put("java-debug-sha256", debugHash);
        values.put("java-extension-wasm-sha256", wasmHash);
        values.put("java-extension-manifest-sha256", extensionManifestHash);
        values.put("java-source-commit", JAVA_SOURCE_COMMIT);
        values.put("zed-cli-sha256", cliHash);
        values.put("zed-version", "1.10.3+20260713.002323");
        values.put("java-runtime", "Temurin-25.0.3+9");
        values.put("fixture-sha256", FIXTURE_SHA256);
        values.put("settings-sha256", settingsHash);
        values.put("staged-jdt-build", stagedJdt.toString());
        values.put("managed-jdt-destination", managedJdt.toString());
        values.put("managed-config-mac-arm", managedConfig.toString());
        addRunManifest(values, "1", run1);
        addRunManifest(values, "2", run2);
        StringBuilder output = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (entry.getValue().indexOf('\n') >= 0 || entry.getValue().indexOf('\r') >= 0) {
                throw new IOException("manifest value contains a line break");
            }
            output.append(entry.getKey()).append('=').append(entry.getValue()).append('\n');
        }
        Files.writeString(destination, output, StandardCharsets.UTF_8);
    }

    private static void addRunManifest(
            Map<String, String> values, String number, RunPaths run) {
        values.put("worktree-" + number, run.worktree().toString());
        values.put("worktree-sha1-" + number, run.fullPathHash());
        values.put("xdg-" + number, run.xdg().toString());
        values.put("expected-data-" + number, run.data().toString());
        values.put("managed-host-fallback-" + number, run.managedHostFallback().toString());
        values.put("packaged-host-fallback-" + number, run.packagedHostFallback().toString());
    }

    private static void verifyManifest(Path manifest) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
            int equals = line.indexOf('=');
            if (equals < 1 || equals == line.length() - 1) {
                throw new IOException("manifest contains an invalid line");
            }
            String key = line.substring(0, equals);
            if (values.put(key, line.substring(equals + 1)) != null) {
                throw new IOException("manifest contains a duplicate key");
            }
        }
        if (!values.keySet().equals(REQUIRED_MANIFEST_KEYS)) {
            throw new IOException("manifest key set is incomplete");
        }
        if (values.get("expected-data-1").equals(values.get("expected-data-2"))) {
            throw new IOException("manifest run data paths are not distinct");
        }
        if (!values.get("managed-config-mac-arm").endsWith("/config_mac_arm")) {
            throw new IOException("manifest managed config path changed");
        }
    }

    private static void extractTarGzip(
            Path archive, Path destination, Limits limits) throws IOException {
        Files.createDirectory(destination);
        long extractedBytes = 0;
        int entries = 0;
        boolean localPaxPending = false;
        boolean endMarkerFound = false;
        Set<String> archivePaths = new HashSet<>();
        byte[] header = new byte[TAR_BLOCK_SIZE];
        try (InputStream input = new GZIPInputStream(
                new BufferedInputStream(Files.newInputStream(archive)))) {
            while (readBlock(input, header)) {
                if (allZero(header)) {
                    byte[] secondEndBlock = new byte[TAR_BLOCK_SIZE];
                    if (!readBlock(input, secondEndBlock) || !allZero(secondEndBlock)) {
                        throw new IOException("TAR end marker is incomplete");
                    }
                    endMarkerFound = true;
                    break;
                }
                verifyTarChecksum(header);
                if (++entries > limits.maxEntries()) {
                    throw new IOException("TAR contains too many entries");
                }
                String name = tarText(header, 0, 100);
                String prefix = tarText(header, 345, 155);
                if (!prefix.isEmpty()) {
                    name = prefix + "/" + name;
                }
                long size = tarOctal(header, 124, 12);
                if (size < 0 || size > limits.maxEntryBytes()) {
                    throw new IOException("TAR entry exceeds the safety limit");
                }
                int type = header[156] & 0xff;
                if (type == 'x') {
                    if (localPaxPending || size > limits.maxPaxBytes()) {
                        throw new IOException("invalid local PAX header");
                    }
                    safeRelativePath(name);
                    validatePax(readExact(input, size), limits.maxPaxBytes());
                    skipPadding(input, size);
                    localPaxPending = true;
                    continue;
                }
                if (type == 'g') {
                    throw new IOException("global PAX headers are unsupported");
                }

                Path relative = safeRelativePath(name);
                String identity = relative.toString();
                if (!archivePaths.add(identity)) {
                    throw new IOException("duplicate TAR entry");
                }
                Path target = destination.resolve(relative).normalize();
                if (!target.startsWith(destination)) {
                    throw new IOException("TAR entry escapes destination");
                }
                if (type == '5') {
                    if (size != 0) {
                        throw new IOException("directory TAR entry has content");
                    }
                    Files.createDirectories(target);
                } else if (type == 0 || type == '0') {
                    Files.createDirectories(target.getParent());
                    extractedBytes += copyExact(input, target, size);
                    if (extractedBytes > limits.maxExtractedBytes()) {
                        throw new IOException("TAR expands beyond the safety limit");
                    }
                } else {
                    throw new IOException("unsupported TAR entry type");
                }
                skipPadding(input, size);
                localPaxPending = false;
            }
            if (localPaxPending) {
                throw new IOException("TAR has a dangling local PAX header");
            }
            if (!endMarkerFound) {
                throw new IOException("TAR has no end marker");
            }
        } catch (Exception error) {
            deleteRecursively(destination);
            throw error;
        }
    }

    private static void validatePax(byte[] bytes, int maximum) throws IOException {
        if (bytes.length == 0 || bytes.length > maximum) {
            throw new IOException("PAX header exceeds the safety limit");
        }
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (!Arrays.equals(bytes, text.getBytes(StandardCharsets.UTF_8))) {
            throw new IOException("PAX header is not valid UTF-8");
        }
        int offset = 0;
        Set<String> keys = new HashSet<>();
        while (offset < text.length()) {
            int space = text.indexOf(' ', offset);
            if (space <= offset) {
                throw new IOException("PAX record has no length delimiter");
            }
            int length;
            try {
                length = Integer.parseInt(text.substring(offset, space));
            } catch (NumberFormatException error) {
                throw new IOException("PAX record length is invalid", error);
            }
            int end = offset + length;
            if (length <= 0 || end > text.length() || text.charAt(end - 1) != '\n') {
                throw new IOException("PAX record length is inconsistent");
            }
            int equals = text.indexOf('=', space + 1);
            if (equals < 0 || equals >= end - 1) {
                throw new IOException("PAX record has no key/value delimiter");
            }
            String key = text.substring(space + 1, equals);
            String value = text.substring(equals + 1, end - 1);
            if (!ALLOWED_PAX_KEYS.contains(key) || !keys.add(key)) {
                throw new IOException("unsupported or duplicate PAX key");
            }
            if ((key.equals("uid") || key.equals("gid")) && !value.matches("[0-9]+")) {
                throw new IOException("PAX owner value is invalid");
            }
            if (key.equals("mtime") && !value.matches("[0-9]+(?:\\.[0-9]+)?")) {
                throw new IOException("PAX mtime value is invalid");
            }
            offset = end;
        }
    }

    private static void verifyJdtLayout(Path jdt) throws IOException {
        requireRegularFile(jdt.resolve("bin/jdtls"), "JDT launcher");
        requireDirectory(jdt.resolve("config_mac_arm"), "JDT macOS arm64 config");
        Path plugins = requireDirectory(jdt.resolve("plugins"), "JDT plugins");
        List<Path> launchers;
        try (Stream<Path> entries = Files.list(plugins)) {
            launchers = entries.filter(path -> {
                String name = path.getFileName().toString();
                return Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                        && !Files.isSymbolicLink(path)
                        && (name.equals("org.eclipse.equinox.launcher.jar")
                                || name.startsWith("org.eclipse.equinox.launcher_")
                                        && name.endsWith(".jar"));
            }).toList();
        }
        if (launchers.size() != 1) {
            throw new IOException("JDT Equinox launcher count changed");
        }
    }

    private static void requireExactlyOneManagedCandidate(
            Path root, String expectedName) throws IOException {
        Path directory = requireDirectory(root, "staged managed JDT root");
        List<Path> candidates;
        try (Stream<Path> entries = Files.list(directory)) {
            candidates = entries
                    .filter(path -> Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)
                            && !Files.isSymbolicLink(path))
                    .toList();
        }
        if (candidates.size() != 1
                || !candidates.get(0).getFileName().toString().equals(expectedName)) {
            throw new IOException("staged managed JDT candidate set changed");
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
                    throw new IOException("staged JDT contains a symlink");
                }
                Path relative = root.relativize(path);
                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                    updateDigest(digest, "D\0" + relative + "\n");
                } else if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                    updateDigest(digest, "F\0" + relative + "\0" + Files.size(path)
                            + "\0" + sha256(path) + "\n");
                } else {
                    throw new IOException("staged JDT contains an unsupported entry");
                }
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static Path safeRelativePath(String name) throws IOException {
        if (name.isBlank() || name.indexOf('\\') >= 0 || name.indexOf('\0') >= 0) {
            throw new IOException("invalid archive path");
        }
        for (int index = 0; index < name.length(); index++) {
            if (name.charAt(index) < 0x20) {
                throw new IOException("archive path contains a control character");
            }
        }
        if (name.length() >= 2 && Character.isLetter(name.charAt(0))
                && name.charAt(1) == ':') {
            throw new IOException("archive path contains a drive prefix");
        }
        Path raw = Path.of(name);
        Path relative = raw.normalize();
        if (raw.isAbsolute() || relative.isAbsolute() || relative.startsWith("..")) {
            throw new IOException("unsafe archive path");
        }
        return relative;
    }

    private static void verifyTarChecksum(byte[] header) throws IOException {
        long expected = tarOctal(header, 148, 8);
        long actual = 0;
        for (int index = 0; index < header.length; index++) {
            actual += index >= 148 && index < 156 ? 32 : header[index] & 0xff;
        }
        if (actual != expected) {
            throw new IOException("TAR header checksum mismatch");
        }
    }

    private static String verifyArtifact(Path path, ArtifactSpec expected) throws IOException {
        if (Files.size(path) != expected.size()) {
            throw new IOException("artifact size mismatch: " + path.getFileName());
        }
        String hash = sha256(path);
        if (!hash.equals(expected.sha256())) {
            throw new IOException("artifact digest mismatch: " + path.getFileName());
        }
        return hash;
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

    private static void requireFileName(Path path, String expected) throws IOException {
        if (!path.getFileName().toString().equals(expected)) {
            throw new IOException("fixed artifact file name changed");
        }
    }

    private static void requireDistinct(List<Path> paths) throws IOException {
        if (new HashSet<>(paths).size() != paths.size()) {
            throw new IOException("S007 destinations must be distinct");
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
            throw new IOException("failed to make staged proxy executable");
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

    private static long copyExact(InputStream input, Path destination, long size)
            throws IOException {
        try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(destination))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            long remaining = size;
            while (remaining > 0) {
                int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (read < 0) {
                    throw new IOException("truncated TAR entry");
                }
                output.write(buffer, 0, read);
                remaining -= read;
            }
        }
        return size;
    }

    private static byte[] readExact(InputStream input, long size) throws IOException {
        if (size > Integer.MAX_VALUE) {
            throw new IOException("TAR metadata entry is too large");
        }
        byte[] bytes = new byte[(int) size];
        int offset = 0;
        while (offset < bytes.length) {
            int read = input.read(bytes, offset, bytes.length - offset);
            if (read < 0) {
                throw new IOException("truncated TAR entry");
            }
            offset += read;
        }
        return bytes;
    }

    private static boolean readBlock(InputStream input, byte[] block) throws IOException {
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
        long remaining = (TAR_BLOCK_SIZE - size % TAR_BLOCK_SIZE) % TAR_BLOCK_SIZE;
        while (remaining > 0) {
            long skipped = input.skip(remaining);
            if (skipped <= 0) {
                if (input.read() < 0) {
                    throw new IOException("truncated TAR padding");
                }
                skipped = 1;
            }
            remaining -= skipped;
        }
    }

    private static String tarText(byte[] header, int offset, int length) throws IOException {
        int end = offset;
        while (end < offset + length && header[end] != 0) {
            end++;
        }
        byte[] encoded = Arrays.copyOfRange(header, offset, end);
        String decoded = new String(encoded, StandardCharsets.UTF_8);
        if (!Arrays.equals(encoded, decoded.getBytes(StandardCharsets.UTF_8))) {
            throw new IOException("TAR text field is not valid UTF-8");
        }
        return decoded;
    }

    private static long tarOctal(byte[] header, int offset, int length) throws IOException {
        String value = tarText(header, offset, length).trim();
        try {
            return value.isEmpty() ? 0 : Long.parseLong(value, 8);
        } catch (NumberFormatException error) {
            throw new IOException("invalid TAR octal field", error);
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
        return new String(output, StandardCharsets.UTF_8);
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
        Path root = Files.createTempDirectory("s007-prepare-test-");
        try {
            testSafeExtraction(root);
            testMaliciousArchives(root);
            testPathsAndFreshness(root);
            testSettingsAndManifest(root);
        } finally {
            deleteRecursively(root);
        }
    }

    private static void testSafeExtraction(Path root) throws Exception {
        Path archive = root.resolve("good.tar.gz");
        writeTarGzip(archive, List.of(
                new TestEntry("bin/", '5', new byte[0]),
                new TestEntry("bin/jdtls", '0', "probe".getBytes(StandardCharsets.UTF_8)),
                new TestEntry("config_mac_arm/", '5', new byte[0]),
                new TestEntry("plugins/", '5', new byte[0]),
                new TestEntry(
                        "plugins/org.eclipse.equinox.launcher_1.jar",
                        '0',
                        new byte[] {1, 2, 3})));
        Path extracted = root.resolve("good-output");
        extractTarGzip(archive, extracted, PRODUCTION_LIMITS);
        verifyJdtLayout(extracted);
        require(Files.readString(extracted.resolve("bin/jdtls")).equals("probe"),
                "safe TAR content changed");
        require(treeSha256(extracted).length() == 64, "tree identity was not produced");

        Path missingLayout = root.resolve("missing-layout");
        Files.createDirectory(missingLayout);
        expectFailure(() -> verifyJdtLayout(missingLayout));

        Path candidates = root.resolve("candidates");
        Files.createDirectory(candidates);
        Files.createDirectory(candidates.resolve(JDT_BUILD_DIRECTORY));
        requireExactlyOneManagedCandidate(candidates, JDT_BUILD_DIRECTORY);
        Files.createDirectory(candidates.resolve("unknown"));
        expectFailure(() -> requireExactlyOneManagedCandidate(
                candidates, JDT_BUILD_DIRECTORY));
    }

    private static void testMaliciousArchives(Path root) throws Exception {
        List<List<TestEntry>> cases = List.of(
                List.of(new TestEntry("../escape", '0', new byte[] {1})),
                List.of(new TestEntry("/absolute", '0', new byte[] {1})),
                List.of(new TestEntry("link", '2', new byte[0])),
                List.of(new TestEntry("device", '3', new byte[0])),
                List.of(
                        new TestEntry("duplicate", '0', new byte[] {1}),
                        new TestEntry("duplicate", '0', new byte[] {2})),
                List.of(
                        new TestEntry(
                                "PaxHeaders/item",
                                'x',
                                paxRecord("path", "replacement")),
                        new TestEntry("item", '0', new byte[] {1})));
        int index = 0;
        for (List<TestEntry> entries : cases) {
            Path archive = root.resolve("bad-" + index + ".tar.gz");
            Path output = root.resolve("bad-output-" + index);
            writeTarGzip(archive, entries);
            expectFailure(() -> extractTarGzip(archive, output, PRODUCTION_LIMITS));
            require(!Files.exists(output), "failed TAR output was not removed");
            index++;
        }

        Path largeArchive = root.resolve("bad-limit.tar.gz");
        writeTarGzip(largeArchive, List.of(
                new TestEntry("large", '0', new byte[] {1, 2, 3, 4, 5})));
        expectFailure(() -> extractTarGzip(
                largeArchive,
                root.resolve("bad-limit-output"),
                new Limits(2, 4, 8, 64)));
    }

    private static void testPathsAndFreshness(Path root) throws Exception {
        Path first = root.resolve("one/same").toAbsolutePath().normalize();
        Path second = root.resolve("two/same").toAbsolutePath().normalize();
        require(!sha1(first.toString()).equals(sha1(second.toString())),
                "full-path hashing collapsed to basename hashing");
        require(sha1(first.getFileName().toString())
                        .equals(sha1(second.getFileName().toString())),
                "basename control is invalid");
        require(sha1("/tmp/s007 hash/프로젝트")
                        .equals("962f3628c300be08886caef0d7ae9d6e858ae035"),
                "SHA-1 UTF-8 calculation changed");

        Path unicodeWorktree = root.resolve("공백 프로젝트").toAbsolutePath().normalize();
        Path unicodeXdg = root.resolve("캐시 공간").toAbsolutePath().normalize();
        RunPaths unicode = runPaths(unicodeWorktree, unicodeXdg);
        require(unicode.data().startsWith(unicodeXdg),
                "Unicode/space XDG path was not preserved");
        RunPaths distinct = runPaths(root.resolve("other-worktree"), root.resolve("other-xdg"));
        require(!unicode.data().equals(distinct.data()), "run data keys are not distinct");

        Path existing = root.resolve("existing");
        Files.createDirectory(existing);
        expectFailure(() -> requireFreshDestination(existing, "test destination"));
    }

    private static void testSettingsAndManifest(Path root) throws Exception {
        Path settings = root.resolve("settings.json");
        writeSettings(
                settings,
                root.resolve("JDK 25"),
                root.resolve("proxy path/java-lsp-proxy"),
                root.resolve("debug path/debug.jar"));
        verifySettings(settings);
        require(!Files.readString(settings).contains("jdtls_launcher"),
                "custom launcher leaked into settings");

        RunPaths run1 = runPaths(root.resolve("run one"), root.resolve("xdg one"));
        RunPaths run2 = runPaths(root.resolve("run 둘"), root.resolve("xdg 둘"));
        Path manifest = root.resolve("manifest.txt");
        writeManifest(
                manifest,
                "a".repeat(64),
                "b".repeat(64),
                "c".repeat(64),
                "d".repeat(64),
                "e".repeat(64),
                "f".repeat(64),
                "1".repeat(64),
                sha256(settings),
                root.resolve("staged-jdt"),
                root.resolve("managed/jdtls/" + JDT_BUILD_DIRECTORY),
                root.resolve("managed/jdtls/" + JDT_BUILD_DIRECTORY + "/config_mac_arm"),
                run1,
                run2);
        verifyManifest(manifest);
        List<String> truncated = Files.readAllLines(manifest);
        truncated.remove(truncated.size() - 1);
        Path incomplete = root.resolve("incomplete-manifest.txt");
        Files.write(incomplete, truncated, StandardCharsets.UTF_8);
        expectFailure(() -> verifyManifest(incomplete));
    }

    private static void writeTarGzip(Path archive, List<TestEntry> entries)
            throws IOException {
        try (OutputStream output = new GZIPOutputStream(
                new BufferedOutputStream(Files.newOutputStream(archive)))) {
            for (TestEntry entry : entries) {
                byte[] header = new byte[TAR_BLOCK_SIZE];
                putTarText(header, 0, 100, entry.name());
                putTarOctal(header, 100, 8, entry.type() == '5' ? 0755 : 0644);
                putTarOctal(header, 108, 8, 0);
                putTarOctal(header, 116, 8, 0);
                putTarOctal(header, 124, 12, entry.data().length);
                putTarOctal(header, 136, 12, 0);
                Arrays.fill(header, 148, 156, (byte) ' ');
                header[156] = (byte) entry.type();
                putTarText(header, 257, 6, "ustar");
                long checksum = 0;
                for (byte value : header) {
                    checksum += value & 0xff;
                }
                putTarChecksum(header, checksum);
                output.write(header);
                output.write(entry.data());
                int padding = (TAR_BLOCK_SIZE - entry.data().length % TAR_BLOCK_SIZE)
                        % TAR_BLOCK_SIZE;
                output.write(new byte[padding]);
            }
            output.write(new byte[TAR_BLOCK_SIZE * 2]);
        }
    }

    private static byte[] paxRecord(String key, String value) {
        String body = key + "=" + value + "\n";
        int length = body.length() + 2;
        while (Integer.toString(length).length() + 1 + body.length() != length) {
            length = Integer.toString(length).length() + 1 + body.length();
        }
        return (length + " " + body).getBytes(StandardCharsets.UTF_8);
    }

    private static void putTarText(
            byte[] header, int offset, int length, String value) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        if (bytes.length >= length) {
            throw new IOException("synthetic TAR field is too long");
        }
        System.arraycopy(bytes, 0, header, offset, bytes.length);
    }

    private static void putTarOctal(
            byte[] header, int offset, int length, long value) throws IOException {
        String octal = Long.toOctalString(value);
        if (octal.length() > length - 2) {
            throw new IOException("synthetic TAR number is too large");
        }
        String formatted = "0".repeat(length - octal.length() - 1) + octal;
        byte[] bytes = formatted.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(bytes, 0, header, offset, bytes.length);
        header[offset + length - 1] = 0;
    }

    private static void putTarChecksum(byte[] header, long checksum) throws IOException {
        String octal = Long.toOctalString(checksum);
        if (octal.length() > 6) {
            throw new IOException("synthetic TAR checksum is too large");
        }
        String formatted = "0".repeat(6 - octal.length()) + octal;
        byte[] bytes = formatted.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(bytes, 0, header, 148, bytes.length);
        header[154] = 0;
        header[155] = (byte) ' ';
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

    private record Limits(
            int maxEntries, long maxEntryBytes, long maxExtractedBytes, int maxPaxBytes) {
    }

    private record RunPaths(
            Path worktree,
            Path xdg,
            String fullPathHash,
            Path data,
            Path managedHostFallback,
            Path packagedHostFallback) {
    }

    private record Prepared(
            String jdtTreeSha256, String settingsSha256, Path run1Data, Path run2Data) {
    }

    private record TestEntry(String name, char type, byte[] data) {
    }

    @FunctionalInterface
    private interface ThrowingAction {
        void run() throws Exception;
    }
}
