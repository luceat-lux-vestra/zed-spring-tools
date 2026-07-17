import java.io.IOException;
import java.io.InputStream;
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
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.jar.Attributes;
import java.util.jar.JarFile;
import java.util.stream.Stream;

/**
 * Combines the fixed S010 managed-JDT runtime and freshly prepared S006 Spring
 * inputs into wholly fresh S011 runtime roots. This is disposable spike
 * infrastructure, not an installer or production package builder.
 */
public final class PrepareS011 {
    private static final String JAVA_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String JDT_DIRECTORY =
            "jdt-language-server-1.60.0-202606262232";
    private static final String JDT_TREE =
            "b64b23722e3c0ccf6093571852ccfe551d4604e7dc175d0e0adbfcdb7aef7583";
    private static final String PATCHED_JAVA_TREE =
            "a8ec9f4d63155742c7e4b5107c2662a042ecf2524e24eff31faa8a61147f5851";
    private static final Artifact PATCHED_JAVA_WASM = new Artifact(
            2_000_470L,
            "aca6555668c84e9668f9be99de85763503a85e31c6ce554a78dac77eacae6605");
    private static final Artifact JAVA_DEBUG = new Artifact(
            3_107_682L,
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c");
    private static final Artifact TASK_HELPER = new Artifact(
            542_960L,
            "e9b1028b2fa5201c787bf2b22849a9ff11d0859fc5745fd59aaa20e77846e0e7");
    private static final Artifact CATALOG = new Artifact(
            413_663L,
            "f91a3840453686a21fc2b1508c645c1affd939b1448105cf10438d11b71c4d02");
    private static final Artifact JAVA_ONLY_INDEX = new Artifact(
            2_265L,
            "8b41695750c2175a0a3179c87c62552f4e917cd5ccde3c09558f304000dccb68");
    private static final Artifact INSTRUMENTED_PROXY = new Artifact(
            958_496L,
            "422bb95e1baa738412ae25388267a34e932da20ae6c71eab1e5d49f8c35209eb");
    private static final Artifact ADAPTER_WASM = new Artifact(
            236_990L,
            "29cbef364deabafe639fa0b909ceb2e86a52b98e04fdc368daba6e10cf485d55");
    private static final Artifact ADAPTER_MANIFEST = new Artifact(
            545L,
            "5a4acb5464d0eb1e1b99fb007380b570c907719cf471154e33fd38a4ee5f741d");
    private static final Artifact SPRING_SERVER = new Artifact(
            -1L,
            "ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1");
    private static final int SPRING_LIBRARY_COUNT = 168;
    private static final String SPRING_LIBRARY_SET =
            "f1fe021fac5e94bd394ee2be1792dd385b5ce30bd527c67e7c7e77d87aeea56c";
    private static final String SERVER_NAME =
            "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";
    private static final String ADAPTER_ID = "s006-spring-boot-end-to-end";

    private static final List<NamedArtifact> BUNDLES = List.of(
            new NamedArtifact("io.projectreactor.reactor-core.jar", new Artifact(
                    1_627_393L,
                    "76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590")),
            new NamedArtifact("org.reactivestreams.reactive-streams.jar", new Artifact(
                    21_386L,
                    "71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038")),
            new NamedArtifact("jdt-ls-commons.jar", new Artifact(
                    140_287L,
                    "0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69")),
            new NamedArtifact("jdt-ls-extension.jar", new Artifact(
                    23_886L,
                    "692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce")),
            new NamedArtifact("sts-gradle-tooling.jar", new Artifact(
                    8_293L,
                    "9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4")));

    private static final String ADAPTER_INDEX_ENTRY = """
                "s006-spring-boot-end-to-end": {
                  "manifest": {
                    "id": "s006-spring-boot-end-to-end",
                    "name": "S006 Spring Boot End-to-End Probe",
                    "version": "0.0.1",
                    "schema_version": 1,
                    "description": "Disposable real Spring Boot LS classpath-to-completion probe for S006.",
                    "repository": "https://github.com/luceat-lux-vestra/zed-spring-tools",
                    "authors": ["Zed Spring Tools Contributors"],
                    "lib": {"kind": "Rust", "version": null},
                    "themes": [],
                    "icon_themes": [],
                    "languages": [],
                    "grammars": {},
                    "language_servers": {
                      "s006-spring-boot-end-to-end": {
                        "language": null,
                        "languages": ["Java", "Properties"],
                        "language_ids": {
                          "Properties": "spring-boot-properties",
                          "Java": "java"
                        },
                        "code_action_kinds": null
                      }
                    },
                    "context_servers": {},
                    "slash_commands": {},
                    "snippets": null,
                    "capabilities": []
                  },
                  "dev": true
                }
            """;

    private PrepareS011() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S011 preparation synthetic tests passed");
            return;
        }
        if (args.length != 14 || !args[0].equals("--prepare")) {
            System.err.println(
                    "usage: java PrepareS011 --self-test\n"
                            + "   or: java PrepareS011 --prepare <repository-root> "
                            + "<s010-profile> <s010-xdg-cache> <s006-artifacts> "
                            + "<s006-worktree> <java-home> <fresh-profile> "
                            + "<fresh-worktree> <fresh-xdg-config> <fresh-xdg-cache> "
                            + "<fresh-xdg-data> <fresh-xdg-state> <fresh-evidence>");
            System.exit(2);
        }
        Result result = prepare(
                Path.of(args[1]), Path.of(args[2]), Path.of(args[3]),
                Path.of(args[4]), Path.of(args[5]), Path.of(args[6]),
                Path.of(args[7]), Path.of(args[8]), Path.of(args[9]),
                Path.of(args[10]), Path.of(args[11]), Path.of(args[12]),
                Path.of(args[13]));
        System.out.println("status=s011-prepared");
        System.out.println("profile=" + result.profile());
        System.out.println("worktree=" + result.worktree());
        System.out.println("expected-data=" + result.data());
        System.out.println("expected-configuration=" + result.configuration());
        System.out.println("manifest=" + result.manifest());
    }

    private static Result prepare(
            Path repository,
            Path s010Profile,
            Path s010Cache,
            Path s006Artifacts,
            Path s006Worktree,
            Path javaHome,
            Path profile,
            Path worktree,
            Path xdgConfig,
            Path xdgCache,
            Path xdgData,
            Path xdgState,
            Path evidence) throws Exception {
        selfTest();
        Path root = requireDirectory(repository, "repository root");
        Path baseProfile = requireDirectory(s010Profile, "S010 profile");
        Path baseCache = requireDirectory(s010Cache, "S010 XDG cache");
        Path springArtifacts = requireDirectory(s006Artifacts, "S006 artifacts");
        Path springWorktree = requireDirectory(s006Worktree, "S006 worktree");
        Path jdk = requireDirectory(javaHome, "Java home");
        Path extension = requireDirectory(
                root.resolve("spikes/s006-spring-boot-end-to-end/extension"),
                "S006 extension");

        verifyInputs(baseProfile, baseCache, springArtifacts, springWorktree, extension, jdk);
        verifyNoRuntimeProcesses(root);
        verifyTokenEnvironment();

        List<Path> destinations = List.of(
                normalized(profile), normalized(worktree), normalized(xdgConfig),
                normalized(xdgCache), normalized(xdgData), normalized(xdgState),
                normalized(evidence));
        requireDistinctFreshDestinations(root, destinations);
        RuntimePaths runtime = runtimePaths(destinations.get(3), destinations.get(1));
        require(!Files.exists(runtime.data(), LinkOption.NOFOLLOW_LINKS)
                        && !Files.exists(runtime.configuration(), LinkOption.NOFOLLOW_LINKS),
                "S011 runtime paths already exist");

        Path transaction = Files.createTempDirectory(root.resolve("tmp"), ".s011-transaction-");
        List<Path> stages = new ArrayList<>();
        for (int index = 0; index < destinations.size(); index++) {
            Path stage = transaction.resolve("stage-" + index);
            Files.createDirectory(stage);
            stages.add(stage);
        }

        try {
            Path profileStage = stages.get(0);
            Path worktreeStage = stages.get(1);
            Path configStage = stages.get(2);
            Path cacheStage = stages.get(3);
            Path dataStage = stages.get(4);
            Path stateStage = stages.get(5);
            Path evidenceStage = stages.get(6);

            stageProfile(baseProfile, extension, springArtifacts, jdk,
                    destinations.get(0), profileStage);
            copyTreeContents(springWorktree, worktreeStage);
            Path stagedCatalog = cacheStage.resolve("tooling/gradle/versions.json");
            Files.createDirectories(stagedCatalog.getParent());
            Files.copy(baseCache.resolve("tooling/gradle/versions.json"), stagedCatalog);

            verifyFinalStages(
                    profileStage, worktreeStage, configStage, cacheStage,
                    dataStage, stateStage, extension, destinations.get(0), jdk);
            Map<String, String> manifest = manifest(
                    destinations, runtime, profileStage, worktreeStage, stagedCatalog);
            writeManifest(profileStage.resolve("s011-prepared-manifest.txt"), manifest);
            writeManifest(evidenceStage.resolve("s011-prepared-manifest.txt"), manifest);

            moveTransactionally(stages, destinations);
            return new Result(
                    destinations.get(0), destinations.get(1), runtime.data(),
                    runtime.configuration(),
                    destinations.get(6).resolve("s011-prepared-manifest.txt"));
        } finally {
            deleteRecursively(transaction);
        }
    }

    private static void verifyInputs(
            Path profile,
            Path cache,
            Path s006Artifacts,
            Path worktree,
            Path extension,
            Path javaHome) throws IOException {
        Path java = profile.resolve("extensions/installed/java");
        require(treeSha256(java).equals(PATCHED_JAVA_TREE),
                "patched Java tree identity changed");
        verifyArtifact(java.resolve("extension.wasm"), PATCHED_JAVA_WASM,
                "patched Java component");
        verifyComponent(java.resolve("extension.wasm"));
        Path jdt = profile.resolve("extensions/work/java/jdtls/" + JDT_DIRECTORY);
        require(treeSha256(jdt).equals(JDT_TREE), "pristine JDT tree identity changed");
        require(!Files.exists(jdt.resolve("configuration"), LinkOption.NOFOLLOW_LINKS),
                "JDT input contains mutable configuration state");
        verifyArtifact(profile.resolve(
                "extensions/work/java/bin/" + JAVA_COMMIT + "/java-task-helper"),
                TASK_HELPER, "Java task helper");
        verifyArtifact(profile.resolve(
                "fixed/com.microsoft.java.debug.plugin-0.53.2.jar"),
                JAVA_DEBUG, "Java debug bundle");
        verifyArtifact(profile.resolve("extensions/index.json"),
                JAVA_ONLY_INDEX, "Java-only extension index");
        verifyArtifact(cache.resolve("tooling/gradle/versions.json"),
                CATALOG, "Gradle catalog");

        verifyArtifact(s006Artifacts.resolve("proxy/instrumented-java-lsp-proxy"),
                INSTRUMENTED_PROXY, "instrumented Java proxy");
        require(Files.isExecutable(
                s006Artifacts.resolve("proxy/instrumented-java-lsp-proxy")),
                "instrumented Java proxy is not executable");
        verifyArtifact(extension.resolve("extension.wasm"), ADAPTER_WASM,
                "S006 adapter component");
        verifyComponent(extension.resolve("extension.wasm"));
        verifyArtifact(extension.resolve("extension.toml"), ADAPTER_MANIFEST,
                "S006 adapter manifest");

        requireNames(worktree, Set.of(".s006-artifacts", "pom.xml", "src"));
        Path hidden = worktree.resolve(".s006-artifacts");
        requireNames(hidden, Set.of("bundles", "probe", "spring"));
        verifyArtifact(hidden.resolve("spring/" + SERVER_NAME), SPRING_SERVER,
                "Spring Boot language server");
        verifySpringLibraries(hidden.resolve("spring/" + SERVER_NAME),
                hidden.resolve("spring/lib"));
        for (NamedArtifact bundle : BUNDLES) {
            verifyArtifact(hidden.resolve("bundles/" + bundle.name()),
                    bundle.artifact(), "Spring JDT bundle " + bundle.name());
        }
        require(Files.readString(worktree.resolve(
                "src/main/resources/application.properties"), StandardCharsets.UTF_8)
                        .equals("ser\n"),
                "Spring fixture completion prefix changed");
        for (String forbidden : List.of(
                ".s006-state", ".s006-evidence", ".project", ".classpath",
                ".settings", "target")) {
            require(!Files.exists(worktree.resolve(forbidden), LinkOption.NOFOLLOW_LINKS),
                    "S006 input contains generated state: " + forbidden);
        }
        verifyArtifact(javaHome.resolve("bin/java"), new Artifact(
                70_432L,
                "0a1eea36b7899323b32caab6f1d0e416ad7208792b076391278062efab4b15d8"),
                "JDK java binary");
    }

    private static void stageProfile(
            Path source,
            Path extension,
            Path s006Artifacts,
            Path javaHome,
            Path finalProfile,
            Path stage) throws IOException {
        Files.createDirectories(stage.resolve("config"));
        Files.createDirectories(stage.resolve("fixed"));
        Files.createDirectories(stage.resolve("extensions/installed"));
        Files.createDirectories(stage.resolve("extensions/work/java"));
        copyTree(source.resolve("extensions/installed/java"),
                stage.resolve("extensions/installed/java"));
        copyTree(source.resolve("extensions/work/java/jdtls"),
                stage.resolve("extensions/work/java/jdtls"));
        copyTree(source.resolve("extensions/work/java/bin"),
                stage.resolve("extensions/work/java/bin"));
        Files.createDirectories(stage.resolve("extensions/work/java/proxy"));
        Files.copy(source.resolve("fixed/com.microsoft.java.debug.plugin-0.53.2.jar"),
                stage.resolve("fixed/com.microsoft.java.debug.plugin-0.53.2.jar"));
        Path proxy = stage.resolve("fixed/java-lsp-proxy");
        Files.copy(s006Artifacts.resolve("proxy/instrumented-java-lsp-proxy"), proxy);
        makeExecutable(proxy);

        Path devLink = stage.resolve("extensions/installed/" + ADAPTER_ID);
        Files.createSymbolicLink(devLink, extension);
        String index = combinedIndex(Files.readString(
                source.resolve("extensions/index.json"), StandardCharsets.UTF_8));
        Files.writeString(stage.resolve("extensions/index.json"), index,
                StandardCharsets.UTF_8);
        Files.writeString(stage.resolve("config/settings.json"),
                settings(javaHome, finalProfile), StandardCharsets.UTF_8);
    }

    private static void verifyFinalStages(
            Path profile,
            Path worktree,
            Path config,
            Path cache,
            Path data,
            Path state,
            Path extension,
            Path finalProfile,
            Path javaHome) throws IOException {
        requireNames(profile, Set.of("config", "extensions", "fixed"));
        requireNames(profile.resolve("fixed"),
                Set.of("java-lsp-proxy", "com.microsoft.java.debug.plugin-0.53.2.jar"));
        verifyArtifact(profile.resolve("fixed/java-lsp-proxy"),
                INSTRUMENTED_PROXY, "staged instrumented proxy");
        require(Files.isExecutable(profile.resolve("fixed/java-lsp-proxy")),
                "staged instrumented proxy is not executable");
        Path link = profile.resolve("extensions/installed/" + ADAPTER_ID);
        require(Files.isSymbolicLink(link)
                        && Files.readSymbolicLink(link).equals(extension),
                "S006 development extension link changed");
        require(treeSha256(profile.resolve("extensions/installed/java"))
                        .equals(PATCHED_JAVA_TREE),
                "staged Java tree identity changed");
        Path jdt = profile.resolve("extensions/work/java/jdtls/" + JDT_DIRECTORY);
        require(treeSha256(jdt).equals(JDT_TREE), "staged JDT tree identity changed");
        require(!Files.exists(jdt.resolve("configuration"), LinkOption.NOFOLLOW_LINKS),
                "staged JDT contains mutable configuration state");
        String index = Files.readString(profile.resolve("extensions/index.json"),
                StandardCharsets.UTF_8);
        require(count(index, "\"id\": \"java\"") == 1
                        && count(index, "\"id\": \"" + ADAPTER_ID + "\"") == 1
                        && !index.contains("\"id\": \"html\"")
                        && count(index, "\"dev\": true") == 1,
                "combined extension index identity changed");
        require(Files.readString(profile.resolve("config/settings.json"),
                StandardCharsets.UTF_8).equals(settings(javaHome, finalProfile)),
                "staged settings identity changed");
        requireNames(worktree, Set.of(".s006-artifacts", "pom.xml", "src"));
        requireNames(config, Set.of());
        requireNames(cache, Set.of("tooling"));
        verifyArtifact(cache.resolve("tooling/gradle/versions.json"),
                CATALOG, "staged Gradle catalog");
        requireNames(data, Set.of());
        requireNames(state, Set.of());
    }

    private static String combinedIndex(String source) throws IOException {
        String marker = "\n  },\n  \"themes\": {}";
        int position = source.indexOf(marker);
        require(position > 0 && source.indexOf(marker, position + 1) < 0,
                "Java-only index structure changed");
        String prefix = source.substring(0, position);
        require(prefix.endsWith("    }"), "Java-only extension object changed");
        return prefix + ",\n" + ADAPTER_INDEX_ENTRY + source.substring(position);
    }

    private static String settings(Path javaHome, Path profile) throws IOException {
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
                    "java": false,
                    "s006-spring-boot-end-to-end": false
                  },
                  "log": {
                    "lsp": "trace",
                    "project": "warn"
                  },
                  "languages": {
                    "Java": {
                      "language_servers": ["jdtls", "s006-spring-boot-end-to-end"]
                    },
                    "Properties": {
                      "language_servers": ["s006-spring-boot-end-to-end"]
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
                        json(javaHome.toString()),
                        json(profile.resolve("fixed/java-lsp-proxy").toString()),
                        json(profile.resolve(
                                "fixed/com.microsoft.java.debug.plugin-0.53.2.jar").toString()));
    }

    private static void verifySpringLibraries(Path server, Path directory)
            throws IOException {
        Set<String> files = new HashSet<>();
        try (Stream<Path> entries = Files.list(requireDirectory(
                directory, "Spring library directory"))) {
            for (Path entry : entries.toList()) {
                require(Files.isRegularFile(entry, LinkOption.NOFOLLOW_LINKS)
                                && !Files.isSymbolicLink(entry)
                                && entry.getFileName().toString().endsWith(".jar"),
                        "Spring library directory contains an invalid entry");
                require(files.add(entry.getFileName().toString()),
                        "Spring library names are not unique");
            }
        }
        require(files.size() == SPRING_LIBRARY_COUNT,
                "Spring library count changed");
        String classPath;
        try (JarFile jar = new JarFile(server.toFile(), false)) {
            require(jar.getManifest() != null, "Spring server manifest is absent");
            classPath = jar.getManifest().getMainAttributes()
                    .getValue(Attributes.Name.CLASS_PATH);
        }
        require(classPath != null, "Spring server class path is absent");
        Set<String> referenced = new HashSet<>();
        for (String item : classPath.trim().split("\\s+")) {
            require(item.startsWith("lib/")
                            && referenced.add(item.substring("lib/".length())),
                    "Spring server class path contains an invalid entry");
        }
        require(referenced.equals(files),
                "Spring server class path and library directory differ");
        MessageDigest digest = digest("SHA-256");
        for (String name : files.stream().sorted().toList()) {
            Path file = directory.resolve(name);
            update(digest, name);
            digest.update((byte) 0);
            update(digest, Long.toString(Files.size(file)));
            digest.update((byte) 0);
            update(digest, sha256(file));
            digest.update((byte) '\n');
        }
        require(HexFormat.of().formatHex(digest.digest()).equals(SPRING_LIBRARY_SET),
                "Spring library-set identity changed");
    }

    private static Map<String, String> manifest(
            List<Path> destinations,
            RuntimePaths runtime,
            Path profile,
            Path worktree,
            Path catalog) throws IOException {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("status", "s011-prepared");
        values.put("target", "macOS-arm64-jdk25");
        values.put("java-source-commit", JAVA_COMMIT);
        values.put("patched-java-tree-sha256", PATCHED_JAVA_TREE);
        values.put("jdt-tree-sha256", JDT_TREE);
        values.put("instrumented-proxy-sha256", INSTRUMENTED_PROXY.sha256());
        values.put("adapter-wasm-sha256", ADAPTER_WASM.sha256());
        values.put("spring-server-sha256", SPRING_SERVER.sha256());
        values.put("spring-library-count", Integer.toString(SPRING_LIBRARY_COUNT));
        values.put("spring-library-set-sha256", SPRING_LIBRARY_SET);
        values.put("profile", destinations.get(0).toString());
        values.put("worktree", destinations.get(1).toString());
        values.put("xdg-config-home", destinations.get(2).toString());
        values.put("xdg-cache-home", destinations.get(3).toString());
        values.put("xdg-data-home", destinations.get(4).toString());
        values.put("xdg-state-home", destinations.get(5).toString());
        values.put("worktree-sha1", runtime.hash());
        values.put("expected-data", runtime.data().toString());
        values.put("expected-configuration", runtime.configuration().toString());
        values.put("settings-sha256", sha256(profile.resolve("config/settings.json")));
        values.put("index-sha256", sha256(profile.resolve("extensions/index.json")));
        values.put("worktree-tree-sha256", treeSha256(worktree));
        values.put("catalog-sha256", sha256(catalog));
        values.put("fresh-runtime-paths", "expected-data,expected-configuration");
        values.put("routes-and-evidence", "absent");
        values.put("live-runtime-processes", "absent");
        values.put("token-environment", "absent");
        return values;
    }

    private static void writeManifest(Path path, Map<String, String> values)
            throws IOException {
        StringBuilder text = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            require(!entry.getKey().contains("=")
                            && !entry.getValue().contains("\n")
                            && !entry.getValue().contains("\r"),
                    "manifest value is not single-line");
            text.append(entry.getKey()).append('=').append(entry.getValue()).append('\n');
        }
        Files.writeString(path, text, StandardCharsets.UTF_8);
    }

    private static void selfTest() throws Exception {
        require(sha1(Path.of("/tmp/space 한글").toAbsolutePath().normalize().toString())
                        .matches("[0-9a-f]{40}"),
                "SHA-1 path derivation failed");
        byte[] core = new byte[] {0, 'a', 's', 'm', 1, 0, 0, 0};
        byte[] component = new byte[] {0, 'a', 's', 'm', 0x0d, 0, 1, 0};
        require(!isComponent(core) && isComponent(component),
                "component-model discriminator failed");
        String sample = "{\n  \"extensions\": {\n    \"java\": {\n"
                + "      \"id\": \"java\"\n    }\n  },\n  \"themes\": {},\n"
                + "  \"icon_themes\": {},\n  \"languages\": {}\n}\n";
        String combined = combinedIndex(sample);
        require(count(combined, "\"id\": \"java\"") == 1
                        && count(combined, "\"id\": \"" + ADAPTER_ID + "\"") == 1,
                "combined index synthetic test failed");
    }

    private static RuntimePaths runtimePaths(Path cache, Path worktree) {
        String hash = sha1(worktree.toString());
        Path data = cache.resolve("jdtls-" + hash);
        return new RuntimePaths(hash, data, data.resolve("configuration"));
    }

    private static void verifyNoRuntimeProcesses(Path directory) throws Exception {
        Process process = new ProcessBuilder("ps", "-axo", "comm=,args=")
                .directory(directory.toFile()).redirectErrorStream(true).start();
        String output = new String(process.getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);
        require(process.waitFor() == 0, "failed to inspect runtime processes");
        for (String line : output.lines().toList()) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;
            require(!trimmed.contains("java-lsp-proxy")
                            && !trimmed.contains("org.eclipse.equinox.launcher_")
                            && !trimmed.contains(SERVER_NAME)
                            && !trimmed.contains("spring_proxy.mjs"),
                    "an S011 runtime process is already running");
        }
    }

    private static void verifyTokenEnvironment() throws IOException {
        for (String name : List.of("GH_COPILOT_TOKEN", "GITHUB_COPILOT_TOKEN")) {
            require(System.getenv(name) == null,
                    name + " must be absent while preparing S011");
        }
    }

    private static void requireDistinctFreshDestinations(Path root, List<Path> paths)
            throws IOException {
        Path tmp = root.resolve("tmp").toAbsolutePath().normalize();
        requireDirectory(tmp, "repository tmp directory");
        require(new HashSet<>(paths).size() == paths.size(),
                "S011 destinations are not distinct");
        for (Path path : paths) {
            require(path.getParent() != null && path.getParent().equals(tmp)
                            && path.getFileName().toString().startsWith("s011"),
                    "S011 destination must be a direct fresh tmp/s011 child");
            requireFreshDestination(path, "S011 destination");
        }
    }

    private static void moveTransactionally(List<Path> sources, List<Path> destinations)
            throws IOException {
        List<Path> moved = new ArrayList<>();
        try {
            for (int index = 0; index < sources.size(); index++) {
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
        requireFreshDestination(destination, "transaction destination");
        try {
            Files.move(source, destination, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, destination);
        }
    }

    private static void copyTree(Path source, Path destination) throws IOException {
        requireFreshDestination(destination, "tree destination");
        Files.createDirectory(destination);
        copyTreeContents(source, destination);
    }

    private static void copyTreeContents(Path source, Path destination) throws IOException {
        Path input = requireDirectory(source, "tree source");
        try (Stream<Path> paths = Files.walk(input)) {
            for (Path path : paths.sorted().toList()) {
                if (path.equals(input)) continue;
                require(!Files.isSymbolicLink(path), "tree source contains a symlink");
                Path target = destination.resolve(input.relativize(path)).normalize();
                require(target.startsWith(destination), "tree copy escapes destination");
                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                    Files.createDirectories(target);
                } else if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                    Files.copy(path, target);
                } else {
                    throw new IOException("tree source contains an unsupported entry");
                }
            }
        }
    }

    private static String treeSha256(Path root) throws IOException {
        Path input = requireDirectory(root, "tree identity root");
        MessageDigest digest = digest("SHA-256");
        try (Stream<Path> paths = Files.walk(input)) {
            for (Path path : paths.sorted().toList()) {
                if (path.equals(input)) continue;
                require(!Files.isSymbolicLink(path), "identity tree contains a symlink");
                Path relative = input.relativize(path);
                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                    update(digest, "D\0" + relative + "\n");
                } else if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                    update(digest, "F\0" + relative + "\0" + Files.size(path)
                            + "\0" + sha256(path) + "\n");
                } else {
                    throw new IOException("identity tree contains an unsupported entry");
                }
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static void verifyArtifact(Path path, Artifact expected, String label)
            throws IOException {
        Path file = requireRegularFile(path, label);
        if (expected.size() >= 0) {
            require(Files.size(file) == expected.size(), label + " size changed");
        }
        require(sha256(file).equals(expected.sha256()), label + " SHA-256 changed");
    }

    private static void verifyComponent(Path path) throws IOException {
        byte[] header;
        try (InputStream input = Files.newInputStream(path)) {
            header = input.readNBytes(8);
        }
        require(isComponent(header), "WASM is not a component-model binary");
    }

    private static boolean isComponent(byte[] bytes) {
        return bytes.length == 8
                && bytes[0] == 0 && bytes[1] == 'a' && bytes[2] == 's' && bytes[3] == 'm'
                && bytes[4] == 0x0d && bytes[5] == 0 && bytes[6] == 1 && bytes[7] == 0;
    }

    private static String sha256(Path path) throws IOException {
        MessageDigest digest = digest("SHA-256");
        try (InputStream input = Files.newInputStream(path)) {
            byte[] buffer = new byte[64 * 1024];
            for (int read; (read = input.read(buffer)) >= 0;) {
                digest.update(buffer, 0, read);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static String sha1(String value) {
        MessageDigest digest = digest("SHA-1");
        return HexFormat.of().formatHex(digest.digest(
                value.getBytes(StandardCharsets.UTF_8)));
    }

    private static MessageDigest digest(String algorithm) {
        try {
            return MessageDigest.getInstance(algorithm);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private static void update(MessageDigest digest, String value) {
        digest.update(value.getBytes(StandardCharsets.UTF_8));
    }

    private static int count(String text, String needle) {
        int result = 0;
        for (int offset = 0; (offset = text.indexOf(needle, offset)) >= 0;
                offset += needle.length()) {
            result++;
        }
        return result;
    }

    private static String json(String value) throws IOException {
        for (int index = 0; index < value.length(); index++) {
            require(value.charAt(index) >= 0x20, "JSON path contains a control character");
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static void makeExecutable(Path path) throws IOException {
        require(path.toFile().setExecutable(true, true) || Files.isExecutable(path),
                "failed to make executable");
    }

    private static Path normalized(Path path) {
        return path.toAbsolutePath().normalize();
    }

    private static Path requireDirectory(Path path, String label) throws IOException {
        Path normalized = normalized(path);
        require(Files.isDirectory(normalized, LinkOption.NOFOLLOW_LINKS)
                        && !Files.isSymbolicLink(normalized),
                label + " is not a regular directory");
        return normalized;
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path normalized = normalized(path);
        require(Files.isRegularFile(normalized, LinkOption.NOFOLLOW_LINKS)
                        && !Files.isSymbolicLink(normalized),
                label + " is not a regular file");
        return normalized;
    }

    private static void requireFreshDestination(Path path, String label) throws IOException {
        require(!Files.exists(path, LinkOption.NOFOLLOW_LINKS),
                label + " already exists: " + path);
        require(path.getParent() != null
                        && Files.isDirectory(path.getParent(), LinkOption.NOFOLLOW_LINKS),
                label + " parent is absent");
    }

    private static void requireNames(Path directory, Set<String> expected)
            throws IOException {
        Set<String> actual = new HashSet<>();
        try (Stream<Path> entries = Files.list(requireDirectory(
                directory, "allowlisted directory"))) {
            for (Path entry : entries.toList()) {
                actual.add(entry.getFileName().toString());
            }
        }
        require(actual.equals(expected),
                "allowlisted entries changed: " + directory + " -> " + actual);
    }

    private static void deleteRecursively(Path root) throws IOException {
        if (root == null || !Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return;
        if (Files.isSymbolicLink(root)) {
            Files.delete(root);
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static void require(boolean condition, String message) throws IOException {
        if (!condition) throw new IOException(message);
    }

    private record Artifact(long size, String sha256) {
    }

    private record NamedArtifact(String name, Artifact artifact) {
    }

    private record RuntimePaths(String hash, Path data, Path configuration) {
    }

    private record Result(
            Path profile, Path worktree, Path data, Path configuration, Path manifest) {
    }
}
