import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public final class PrepareS005 {
    private static final int TAR_BLOCK_SIZE = 512;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int MAX_ARCHIVE_ENTRIES = 50_000;
    private static final long MAX_ENTRY_BYTES = 536_870_912L;
    private static final long MAX_EXTRACTED_BYTES = 1_073_741_824L;
    private static final int MAX_PAX_BYTES = 16 * 1024;
    private static final Set<String> ALLOWED_PAX_KEYS = Set.of("uid", "gid", "mtime");

    private static final String UPSTREAM_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String PACKAGE_ENTRY = "extension/package.json";
    private static final String BUNDLE_PREFIX = "extension/jars/";
    private static final String FIXTURE_ROOT = "spikes/s004-spring-jdt-command/fixture";
    private static final String FIXTURE_POM = FIXTURE_ROOT + "/pom.xml";
    private static final String FIXTURE_JAVA = FIXTURE_ROOT
            + "/src/main/java/dev/zed/spring/s004/S004OnlyProbe9F2C.java";
    private static final String SINK_SOURCE =
            "spikes/s005-classpath-callback/extension/probe/callback_sink.js";
    private static final String ARTIFACTS = ".s005-artifacts";

    private static final ArtifactSpec JDTLS = new ArtifactSpec(
            50_925_681L,
            "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d");
    private static final ArtifactSpec VSIX = new ArtifactSpec(
            82_759_143L,
            "70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3");
    private static final ArtifactSpec OFFICIAL_PROXY = new ArtifactSpec(
            834_304L,
            "53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076");
    private static final ArtifactSpec DEBUG = new ArtifactSpec(
            3_107_682L,
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c");
    private static final ArtifactSpec PACKAGE_JSON = new ArtifactSpec(
            53_677L,
            "14b6d18166f908925f42bea96afafe298e03a5638f164c4ba80483f7ab57aaa4");

    private static final List<BundleSpec> SPRING_BUNDLES = List.of(
            new BundleSpec(
                    "io.projectreactor.reactor-core.jar",
                    1_627_393L,
                    "76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590"),
            new BundleSpec(
                    "org.reactivestreams.reactive-streams.jar",
                    21_386L,
                    "71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038"),
            new BundleSpec(
                    "jdt-ls-commons.jar",
                    140_287L,
                    "0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69"),
            new BundleSpec(
                    "jdt-ls-extension.jar",
                    23_886L,
                    "692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce"),
            new BundleSpec(
                    "sts-gradle-tooling.jar",
                    8_293L,
                    "9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4"));

    private static final Map<String, String> UPSTREAM_FILES = Map.of(
            "proxy/src/main.rs",
            "ccf1d7c18b527f6809b09919f9eec6333c2f88cc5d9ff9a1dcf5f263b1aa1243",
            "proxy/src/http.rs",
            "6390b496a14368d0c8ea13c5950f630293ed5da99e57a57731f2aea080c5ff62",
            "proxy/src/lsp.rs",
            "ae8841428ab6cb3edbea0f0b43b8efa98eda695abba7749637219f0b201e7af1",
            "proxy/Cargo.toml",
            "e33af593704fd4959bb2b79bcc0e42ed1c1129fbda442dfc3a89bd2663f23b44",
            "proxy/Cargo.lock",
            "8de3d126ea0d99fac9b47796a40bbd8f88f4266c57cca796717cfdce512c3437",
            "LICENSE",
            "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4");

    private static final List<ArmSpec> ARMS = List.of(
            new ArmSpec(
                    "official",
                    "s005-official-worktree-9f2c",
                    "4a3536ce5e6800791e2927e1746deae242e20e5f"),
            new ArmSpec(
                    "source",
                    "s005-source-worktree-9f2c",
                    "445d60479bff85ce1c42998152265e9d97254c8b"),
            new ArmSpec(
                    "routed",
                    "s005-routed-worktree-9f2c",
                    "6df57e0fe15486a4087ff8c5008582dfaa9c9686"));

    private static final ExpectedSet OFFICIAL = new ExpectedSet(
            JDTLS,
            VSIX,
            OFFICIAL_PROXY,
            DEBUG,
            PACKAGE_JSON,
            SPRING_BUNDLES,
            UPSTREAM_COMMIT,
            UPSTREAM_FILES,
            ARMS);

    private PrepareS005() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S005 preparation self-test passed");
            return;
        }
        if (args.length != 12) {
            printUsage();
            System.exit(2);
        }

        Prepared prepared = prepare(
                Path.of(args[0]),
                Path.of(args[1]),
                Path.of(args[2]),
                Path.of(args[3]),
                Path.of(args[4]),
                Path.of(args[5]),
                Path.of(args[6]),
                Path.of(args[7]),
                Path.of(args[8]),
                List.of(Path.of(args[9]), Path.of(args[10]), Path.of(args[11])),
                OFFICIAL);
        System.out.println("jdtls-sha256=" + prepared.jdtls().sha256());
        System.out.println("vsix-sha256=" + prepared.vsix().sha256());
        System.out.println("official-proxy-sha256=" + prepared.proxies().get(0).sha256());
        System.out.println("source-proxy-sha256=" + prepared.proxies().get(1).sha256());
        System.out.println("routed-proxy-sha256=" + prepared.proxies().get(2).sha256());
        System.out.println("debug-sha256=" + prepared.debug().sha256());
        System.out.println("source-commit=" + prepared.sourceCommit());
        System.out.println("arms=" + prepared.armCount());
    }

    private static void printUsage() {
        System.err.println(
                "usage: java PrepareS005.java <jdtls.tar.gz> <spring.vsix> "
                        + "<official-proxy> <source-proxy> <routed-proxy> <java-debug.jar> "
                        + "<clean-java-source-checkout> <repository-root> <artifact-destination> "
                        + "<official-worktree> <source-worktree> <routed-worktree>");
    }

    private static Prepared prepare(
            Path jdtArchive,
            Path vsix,
            Path officialProxy,
            Path sourceProxy,
            Path routedProxy,
            Path debug,
            Path checkout,
            Path sourceRoot,
            Path artifactDestination,
            List<Path> worktreeDestinations,
            ExpectedSet expected) throws Exception {
        Path jdtInput = requireRegularFile(jdtArchive, "JDT LS archive");
        Path vsixInput = requireRegularFile(vsix, "Spring VSIX");
        Path officialInput = requireRegularFile(officialProxy, "official Java proxy");
        Path sourceInput = requireRegularFile(sourceProxy, "source-built Java proxy");
        Path routedInput = requireRegularFile(routedProxy, "routed Java proxy");
        Path debugInput = requireRegularFile(debug, "Java debug bundle");
        Path sources = requireSourceRoot(sourceRoot);
        String commit = verifyCheckout(checkout, expected.sourceCommit(), expected.sourceFiles());

        VerifiedArtifact verifiedJdt = verifyArtifact(jdtInput, expected.jdtls());
        VerifiedArtifact verifiedVsix = verifyArtifact(vsixInput, expected.vsix());
        VerifiedArtifact verifiedOfficial = verifyArtifact(officialInput, expected.officialProxy());
        VerifiedArtifact verifiedSource = verifyArtifact(sourceInput);
        VerifiedArtifact verifiedRouted = verifyArtifact(routedInput);
        VerifiedArtifact verifiedDebug = verifyArtifact(debugInput, expected.debug());
        if (verifiedSource.sha256().equals(verifiedRouted.sha256())) {
            throw new IOException("source and routed proxy binaries are identical");
        }

        DestinationSet destinations = validateDestinations(
                artifactDestination, worktreeDestinations, expected.arms());
        Path transaction = Files.createTempDirectory(destinations.parent(), ".s005-transaction-");
        List<Path> moved = new ArrayList<>();
        try {
            Path artifactStage = transaction.resolve("artifacts");
            Files.createDirectory(artifactStage);
            List<Path> worktreeStages = new ArrayList<>();
            for (int index = 0; index < expected.arms().size(); index++) {
                ArmSpec arm = expected.arms().get(index);
                Path armArtifacts = artifactStage.resolve(arm.id());
                Files.createDirectories(armArtifacts.resolve("jdt-data").resolve(arm.cacheKey()));
                extractTarGzip(jdtInput, armArtifacts.resolve("jdtls"));
                validateJdtLayout(armArtifacts.resolve("jdtls"));
                makeExecutable(armArtifacts.resolve("jdtls/bin/jdtls"));
                Files.createDirectories(armArtifacts.resolve("proxy"));
                Files.createDirectories(armArtifacts.resolve("debug"));
                Path proxy = List.of(officialInput, sourceInput, routedInput).get(index);
                Files.copy(proxy, armArtifacts.resolve("proxy/java-lsp-proxy"));
                makeExecutable(armArtifacts.resolve("proxy/java-lsp-proxy"));
                Files.copy(debugInput, armArtifacts.resolve("debug/java-debug.jar"));

                Path worktree = transaction.resolve("worktree-" + index);
                stageWorktree(worktree, sources, vsixInput, expected);
                worktreeStages.add(worktree);
            }

            List<Path> staged = new ArrayList<>();
            staged.add(artifactStage);
            staged.addAll(worktreeStages);
            List<Path> targets = new ArrayList<>();
            targets.add(destinations.artifacts());
            targets.addAll(destinations.worktrees());
            for (int index = 0; index < staged.size(); index++) {
                requireFreshDestination(targets.get(index), "transaction target");
                moveFresh(staged.get(index), targets.get(index));
                moved.add(targets.get(index));
            }
            return new Prepared(
                    verifiedJdt,
                    verifiedVsix,
                    List.of(verifiedOfficial, verifiedSource, verifiedRouted),
                    verifiedDebug,
                    commit,
                    expected.arms().size());
        } catch (Exception error) {
            for (int index = moved.size() - 1; index >= 0; index--) {
                deleteRecursively(moved.get(index));
            }
            throw error;
        } finally {
            deleteRecursively(transaction);
        }
    }

    private static DestinationSet validateDestinations(
            Path artifactDestination, List<Path> worktrees, List<ArmSpec> arms)
            throws IOException {
        if (worktrees.size() != arms.size()) {
            throw new IOException("exactly three worktree destinations are required");
        }
        Path artifacts = artifactDestination.toAbsolutePath().normalize();
        Path parent = requireParent(artifacts);
        requireFreshDestination(artifacts, "artifact destination");
        List<Path> normalized = new ArrayList<>();
        Set<Path> unique = new HashSet<>();
        unique.add(artifacts);
        for (int index = 0; index < worktrees.size(); index++) {
            Path worktree = worktrees.get(index).toAbsolutePath().normalize();
            if (!worktree.getFileName().toString().equals(arms.get(index).basename())) {
                throw new IOException("worktree basename does not match fixed arm " + arms.get(index).id());
            }
            if (!sha1(arms.get(index).basename()).equals(arms.get(index).cacheKey())) {
                throw new IOException("fixed cache key does not match worktree basename");
            }
            if (!requireParent(worktree).equals(parent)) {
                throw new IOException("all transaction destinations must share one parent");
            }
            if (!unique.add(worktree)) {
                throw new IOException("transaction destinations overlap");
            }
            requireFreshDestination(worktree, "worktree destination");
            normalized.add(worktree);
        }
        return new DestinationSet(parent, artifacts, List.copyOf(normalized));
    }

    private static Path requireParent(Path destination) throws IOException {
        Path parent = destination.getParent();
        if (parent == null) {
            throw new IOException("destination has no parent");
        }
        Files.createDirectories(parent);
        if (!Files.isDirectory(parent, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(parent)) {
            throw new IOException("destination parent is not a regular directory");
        }
        return parent;
    }

    private static void stageWorktree(
            Path destination, Path sourceRoot, Path vsix, ExpectedSet expected) throws IOException {
        Files.createDirectory(destination);
        Path bundleOutput = destination.resolve(ARTIFACTS).resolve("bundles");
        Files.createDirectories(bundleOutput);
        extractSpringBundles(
                vsix, bundleOutput, expected.packageJson(), expected.bundles());
        copyContained(sourceRoot, FIXTURE_POM, destination.resolve("pom.xml"));
        copyContained(
                sourceRoot,
                FIXTURE_JAVA,
                destination.resolve("src/main/java/dev/zed/spring/s004/S004OnlyProbe9F2C.java"));
        copyContained(
                sourceRoot,
                SINK_SOURCE,
                destination.resolve(ARTIFACTS).resolve("probe/callback_sink.js"));
    }

    private static Path requireSourceRoot(Path sourceRoot) throws IOException {
        Path root = sourceRoot.toAbsolutePath().normalize();
        if (!Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(root)) {
            throw new IOException("repository source root is not a regular directory");
        }
        for (String relative : List.of(FIXTURE_POM, FIXTURE_JAVA, SINK_SOURCE)) {
            requireContainedFile(root, relative);
        }
        return root;
    }

    private static void copyContained(Path root, String relative, Path destination)
            throws IOException {
        Path source = requireContainedFile(root, relative);
        Files.createDirectories(destination.getParent());
        Files.copy(source, destination);
    }

    private static Path requireContainedFile(Path root, String relative) throws IOException {
        Path file = root.resolve(relative).normalize();
        if (!file.startsWith(root)
                || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(file)) {
            throw new IOException("required source is missing or linked: " + relative);
        }
        return file;
    }

    private static String verifyCheckout(
            Path checkout, String expectedCommit, Map<String, String> expectedFiles)
            throws Exception {
        Path supplied = checkout.toAbsolutePath().normalize();
        if (!Files.isDirectory(supplied, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(supplied)) {
            throw new IOException("Java source checkout is not a regular directory");
        }
        Path root = supplied.toRealPath();
        String topLevel = runGit(root, "rev-parse", "--show-toplevel");
        if (!Path.of(topLevel).toRealPath().equals(root)) {
            throw new IOException("Java source checkout is not the Git top level");
        }
        String commit = runGit(root, "rev-parse", "HEAD");
        if (!commit.equals(expectedCommit)) {
            throw new IOException("Java source checkout commit mismatch");
        }
        if (!runGit(root, "status", "--porcelain=v1", "--untracked-files=all").isEmpty()) {
            throw new IOException("Java source checkout is not clean");
        }
        for (Map.Entry<String, String> entry : expectedFiles.entrySet()) {
            Path file = requireContainedFile(root, entry.getKey());
            if (!sha256(file).equals(entry.getValue())) {
                throw new IOException("upstream source identity mismatch: " + entry.getKey());
            }
        }
        return commit;
    }

    private static String runGit(Path root, String... arguments) throws Exception {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.add("-C");
        command.add(root.toString());
        command.addAll(List.of(arguments));
        return runProcess(root, command);
    }

    private static String runProcess(Path root, List<String> command) throws Exception {
        Process process = new ProcessBuilder(command)
                .directory(root.toFile())
                .redirectErrorStream(true)
                .start();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        AtomicReference<IOException> drainFailure = new AtomicReference<>();
        Thread drain = Thread.ofVirtual().start(() -> {
            try (InputStream input = process.getInputStream()) {
                copyWithLimit(input, output, 1_000_000L);
            } catch (IOException error) {
                drainFailure.set(error);
            }
        });
        if (!process.waitFor(10, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            drain.join(1_000);
            throw new IOException("bounded process timed out");
        }
        drain.join(1_000);
        if (drain.isAlive()) {
            process.destroyForcibly();
            throw new IOException("bounded process output did not close");
        }
        if (drainFailure.get() != null) {
            throw new IOException("bounded process output failed", drainFailure.get());
        }
        String text = output.toString(StandardCharsets.UTF_8).trim();
        if (process.exitValue() != 0) {
            throw new IOException("bounded process failed");
        }
        return text;
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path normalized = path.toAbsolutePath().normalize();
        if (!Files.isRegularFile(normalized, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(normalized)) {
            throw new IOException(label + " is not a regular non-link file");
        }
        return normalized;
    }

    private static void requireFreshDestination(Path path, String label) throws IOException {
        if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(label + " already exists");
        }
    }

    private static VerifiedArtifact verifyArtifact(Path file, ArtifactSpec expected)
            throws IOException {
        VerifiedArtifact actual = verifyArtifact(file);
        if (actual.size() != expected.size() || !actual.sha256().equals(expected.sha256())) {
            throw new IOException("fixed artifact identity mismatch");
        }
        return actual;
    }

    private static VerifiedArtifact verifyArtifact(Path file) throws IOException {
        return new VerifiedArtifact(Files.size(file), sha256(file));
    }

    private static void extractSpringBundles(
            Path vsix,
            Path destination,
            ArtifactSpec packageSpec,
            List<BundleSpec> bundleSpecs) throws IOException {
        Map<String, BundleSpec> expected = new LinkedHashMap<>();
        for (BundleSpec spec : bundleSpecs) {
            expected.put(BUNDLE_PREFIX + spec.fileName(), spec);
        }
        Set<String> seen = new HashSet<>();
        Set<String> extracted = new HashSet<>();
        byte[] packageBytes = null;
        int entries = 0;
        try (ZipInputStream zip = new ZipInputStream(
                new BufferedInputStream(Files.newInputStream(vsix)))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; zip.closeEntry()) {
                if (++entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("VSIX contains too many entries");
                }
                Path relative = safeRelativePath(entry.getName(), "VSIX");
                String key = collisionKey(relative);
                if (!seen.add(key)) {
                    throw new IOException("duplicate or case-colliding VSIX entry");
                }
                String name = relative.toString().replace('\\', '/');
                if (name.equals(PACKAGE_ENTRY)) {
                    packageBytes = readLimited(zip, 1_000_000L);
                } else if (expected.containsKey(name)) {
                    BundleSpec spec = expected.get(name);
                    Path output = destination.resolve(spec.fileName());
                    writeLimited(zip, output, spec.size());
                    if (!sha256(output).equals(spec.sha256())) {
                        throw new IOException("Spring bundle digest mismatch");
                    }
                    extracted.add(name);
                }
            }
        }
        if (packageBytes == null
                || packageBytes.length != packageSpec.size()
                || !sha256(packageBytes).equals(packageSpec.sha256())) {
            throw new IOException("VSIX package identity mismatch");
        }
        if (!extracted.equals(expected.keySet())) {
            throw new IOException("VSIX is missing a fixed Spring bundle");
        }
        String packageText = new String(packageBytes, StandardCharsets.UTF_8);
        int prior = -1;
        for (BundleSpec spec : bundleSpecs) {
            int position = packageText.indexOf("./jars/" + spec.fileName());
            if (position <= prior) {
                throw new IOException("VSIX Spring bundle declaration order mismatch");
            }
            prior = position;
        }
    }

    private static byte[] readLimited(InputStream input, long limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        copyWithLimit(input, output, limit);
        return output.toByteArray();
    }

    private static void writeLimited(InputStream input, Path output, long expectedSize)
            throws IOException {
        try (OutputStream file = new BufferedOutputStream(Files.newOutputStream(output))) {
            copyWithLimit(input, file, expectedSize);
        }
        if (Files.size(output) != expectedSize) {
            throw new IOException("Spring bundle size mismatch");
        }
    }

    private static void copyWithLimit(InputStream input, OutputStream output, long limit)
            throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        long total = 0;
        for (int read; (read = input.read(buffer)) != -1; ) {
            total += read;
            if (total > limit) {
                throw new IOException("archive entry exceeds its limit");
            }
            output.write(buffer, 0, read);
        }
    }

    private static void extractTarGzip(Path archive, Path destination) throws IOException {
        Files.createDirectory(destination);
        Set<String> seen = new HashSet<>();
        long extracted = 0;
        int entries = 0;
        boolean paxPending = false;
        try (InputStream raw = new BufferedInputStream(Files.newInputStream(archive));
                InputStream gzip = new GZIPInputStream(raw, BUFFER_SIZE)) {
            while (true) {
                byte[] header = readBlock(gzip);
                if (header == null) {
                    throw new IOException("tar ended without a zero marker");
                }
                if (isZeroBlock(header)) {
                    byte[] second = readBlock(gzip);
                    if (second == null || !isZeroBlock(second) || paxPending) {
                        throw new IOException("tar has an invalid end marker");
                    }
                    break;
                }
                validateTarChecksum(header);
                if (!tarString(header, 257, 6).startsWith("ustar")) {
                    throw new IOException("unsupported tar format");
                }
                String name = tarName(header);
                long size = parseTarOctal(header, 124, 12);
                if (size > MAX_ENTRY_BYTES) {
                    throw new IOException("tar entry exceeds the safety limit");
                }
                byte type = header[156];
                if (!tarString(header, 157, 100).isEmpty()) {
                    throw new IOException("tar links are unsupported");
                }
                if (type == 'x') {
                    if (paxPending || size > MAX_PAX_BYTES) {
                        throw new IOException("invalid local PAX header");
                    }
                    safeRelativePath(name, "PAX tar");
                    validatePax(readExactly(gzip, size));
                    skipExactly(gzip, padding(size));
                    paxPending = true;
                    continue;
                }
                if (++entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("tar contains too many entries");
                }
                Path relative = safeRelativePath(name, "tar");
                if (!seen.add(collisionKey(relative))) {
                    throw new IOException("duplicate or case-colliding tar entry");
                }
                Path target = destination.resolve(relative).normalize();
                if (!target.startsWith(destination)) {
                    throw new IOException("tar entry escapes destination");
                }
                if (type == '5') {
                    if (size != 0) {
                        throw new IOException("tar directory contains data");
                    }
                    Files.createDirectories(target);
                } else if (type == 0 || type == '0') {
                    Files.createDirectories(target.getParent());
                    try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(target))) {
                        copyExactly(gzip, output, size);
                    }
                    extracted += size;
                    if (extracted > MAX_EXTRACTED_BYTES) {
                        throw new IOException("tar expands beyond the safety limit");
                    }
                } else {
                    throw new IOException("unsupported tar entry type");
                }
                skipExactly(gzip, padding(size));
                paxPending = false;
            }
        }
    }

    private static void validatePax(byte[] bytes) throws IOException {
        int offset = 0;
        Set<String> keys = new HashSet<>();
        while (offset < bytes.length) {
            int space = offset;
            while (space < bytes.length && bytes[space] != ' ') {
                space++;
            }
            if (space == offset || space >= bytes.length) {
                throw new IOException("invalid PAX record length");
            }
            int length;
            try {
                length = Integer.parseInt(new String(
                        bytes, offset, space - offset, StandardCharsets.US_ASCII));
            } catch (NumberFormatException error) {
                throw new IOException("invalid PAX record length", error);
            }
            int end = Math.addExact(offset, length);
            if (end > bytes.length || bytes[end - 1] != '\n') {
                throw new IOException("inconsistent PAX record length");
            }
            int equals = space + 1;
            while (equals < end - 1 && bytes[equals] != '=') {
                equals++;
            }
            String key = new String(bytes, space + 1, equals - space - 1, StandardCharsets.US_ASCII);
            if (!ALLOWED_PAX_KEYS.contains(key) || !keys.add(key)) {
                throw new IOException("unsupported or duplicate PAX key");
            }
            offset = end;
        }
    }

    private static void validateJdtLayout(Path root) throws IOException {
        if (!Files.isRegularFile(root.resolve("bin/jdtls"), LinkOption.NOFOLLOW_LINKS)
                || !Files.isRegularFile(root.resolve("bin/jdtls.bat"), LinkOption.NOFOLLOW_LINKS)
                || !Files.isDirectory(root.resolve("plugins"), LinkOption.NOFOLLOW_LINKS)
                || Files.exists(root.resolve("configuration"), LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("fresh JDT LS layout mismatch");
        }
        try (Stream<Path> files = Files.list(root.resolve("plugins"))) {
            if (files.noneMatch(path -> Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS))) {
                throw new IOException("JDT LS plugin directory is empty");
            }
        }
    }

    private static Path safeRelativePath(String name, String archive) throws IOException {
        if (name.isEmpty()
                || name.indexOf('\0') >= 0
                || name.indexOf('\\') >= 0
                || name.startsWith("/")
                || name.startsWith("~")
                || name.matches("^[A-Za-z]:.*")) {
            throw new IOException(archive + " entry has an unsafe name");
        }
        Path relative = Path.of(name).normalize();
        if (relative.isAbsolute() || relative.startsWith("..")) {
            throw new IOException(archive + " entry escapes its root");
        }
        return relative;
    }

    private static String collisionKey(Path path) {
        return path.toString().replace('\\', '/').toLowerCase(Locale.ROOT);
    }

    private static byte[] readBlock(InputStream input) throws IOException {
        byte[] block = input.readNBytes(TAR_BLOCK_SIZE);
        if (block.length == 0) {
            return null;
        }
        if (block.length != TAR_BLOCK_SIZE) {
            throw new IOException("truncated tar block");
        }
        return block;
    }

    private static byte[] readExactly(InputStream input, long size) throws IOException {
        if (size > Integer.MAX_VALUE) {
            throw new IOException("entry is too large for memory validation");
        }
        byte[] bytes = input.readNBytes((int) size);
        if (bytes.length != size) {
            throw new IOException("truncated archive entry");
        }
        return bytes;
    }

    private static void copyExactly(InputStream input, OutputStream output, long size)
            throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        long remaining = size;
        while (remaining > 0) {
            int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read == -1) {
                throw new IOException("truncated tar entry");
            }
            output.write(buffer, 0, read);
            remaining -= read;
        }
    }

    private static void skipExactly(InputStream input, long size) throws IOException {
        long remaining = size;
        while (remaining > 0) {
            long skipped = input.skip(remaining);
            if (skipped > 0) {
                remaining -= skipped;
            } else if (input.read() == -1) {
                throw new IOException("truncated tar padding");
            } else {
                remaining--;
            }
        }
    }

    private static long padding(long size) {
        return (TAR_BLOCK_SIZE - size % TAR_BLOCK_SIZE) % TAR_BLOCK_SIZE;
    }

    private static boolean isZeroBlock(byte[] block) {
        for (byte value : block) {
            if (value != 0) {
                return false;
            }
        }
        return true;
    }

    private static void validateTarChecksum(byte[] header) throws IOException {
        long expected = parseTarOctal(header, 148, 8);
        long actual = 0;
        for (int index = 0; index < header.length; index++) {
            actual += index >= 148 && index < 156 ? ' ' : Byte.toUnsignedInt(header[index]);
        }
        if (actual != expected) {
            throw new IOException("tar checksum mismatch");
        }
    }

    private static String tarName(byte[] header) throws IOException {
        String prefix = tarString(header, 345, 155);
        String name = tarString(header, 0, 100);
        if (name.isEmpty()) {
            throw new IOException("tar entry has no name");
        }
        return prefix.isEmpty() ? name : prefix + "/" + name;
    }

    private static String tarString(byte[] bytes, int offset, int length) {
        int end = offset;
        while (end < offset + length && bytes[end] != 0) {
            end++;
        }
        return new String(bytes, offset, end - offset, StandardCharsets.UTF_8);
    }

    private static long parseTarOctal(byte[] bytes, int offset, int length) throws IOException {
        if ((bytes[offset] & 0x80) != 0) {
            throw new IOException("base-256 tar values are unsupported");
        }
        String text = tarString(bytes, offset, length).trim();
        try {
            return text.isEmpty() ? 0 : Long.parseLong(text, 8);
        } catch (NumberFormatException error) {
            throw new IOException("invalid tar number", error);
        }
    }

    private static void makeExecutable(Path path) throws IOException {
        if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
            Set<java.nio.file.attribute.PosixFilePermission> permissions =
                    Files.getPosixFilePermissions(path);
            permissions.add(java.nio.file.attribute.PosixFilePermission.OWNER_EXECUTE);
            Files.setPosixFilePermissions(path, permissions);
        }
    }

    private static void moveFresh(Path source, Path destination) throws IOException {
        try {
            Files.move(source, destination, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException error) {
            Files.move(source, destination);
        }
    }

    private static String sha256(Path path) throws IOException {
        try (InputStream input = new BufferedInputStream(Files.newInputStream(path))) {
            return digest("SHA-256", input);
        }
    }

    private static String sha256(byte[] bytes) {
        return HexFormat.of().formatHex(newDigest("SHA-256").digest(bytes));
    }

    private static String sha1(String text) {
        return HexFormat.of().formatHex(
                newDigest("SHA-1").digest(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String digest(String algorithm, InputStream input) throws IOException {
        MessageDigest digest = newDigest(algorithm);
        byte[] buffer = new byte[BUFFER_SIZE];
        for (int read; (read = input.read(buffer)) != -1; ) {
            digest.update(buffer, 0, read);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static MessageDigest newDigest(String algorithm) {
        try {
            return MessageDigest.getInstance(algorithm);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(algorithm + " is unavailable", error);
        }
    }

    private static void selfTest() throws Exception {
        Path root = Files.createTempDirectory("s005-prepare-test-");
        try {
            Path sources = createTestSources(root.resolve("sources"));
            Path checkout = createTestCheckout(root.resolve("checkout"));
            String commit = runGit(checkout, "rev-parse", "HEAD");
            Map<String, String> sourceFiles = new HashMap<>();
            for (String relative : List.of(
                    "proxy/src/main.rs",
                    "proxy/src/http.rs",
                    "proxy/src/lsp.rs",
                    "proxy/Cargo.toml",
                    "proxy/Cargo.lock",
                    "LICENSE")) {
                sourceFiles.put(relative, sha256(checkout.resolve(relative)));
            }

            Path jdt = root.resolve("jdt.tar.gz");
            writeTarGzip(jdt, List.of(
                    TarTestEntry.file("bin/jdtls", new byte[] {1}),
                    TarTestEntry.file("bin/jdtls.bat", new byte[] {2}),
                    TarTestEntry.file("plugins/core.jar", new byte[] {3})));
            byte[] bundle = new byte[] {4, 5, 6};
            byte[] packageJson = "{\"contributes\":{\"javaExtensions\":[\"./jars/spring.jar\"]}}"
                    .getBytes(StandardCharsets.UTF_8);
            Path vsix = root.resolve("spring.vsix");
            writeZip(vsix, List.of(
                    new ZipTestEntry(PACKAGE_ENTRY, packageJson),
                    new ZipTestEntry(BUNDLE_PREFIX + "spring.jar", bundle)));
            Path official = writeBytes(root.resolve("official"), 7, 8);
            Path source = writeBytes(root.resolve("source"), 9, 10);
            Path routed = writeBytes(root.resolve("routed"), 11, 12);
            Path debug = writeBytes(root.resolve("debug.jar"), 13, 14);
            List<ArmSpec> arms = List.of(
                    arm("official", "s005-official-worktree-9f2c"),
                    arm("source", "s005-source-worktree-9f2c"),
                    arm("routed", "s005-routed-worktree-9f2c"));
            ExpectedSet expected = new ExpectedSet(
                    artifactFor(jdt),
                    artifactFor(vsix),
                    artifactFor(official),
                    artifactFor(debug),
                    new ArtifactSpec(packageJson.length, sha256(packageJson)),
                    List.of(new BundleSpec("spring.jar", bundle.length, sha256(bundle))),
                    commit,
                    sourceFiles,
                    arms);

            Path parent = root.resolve("outputs");
            Files.createDirectory(parent);
            Path artifacts = parent.resolve("artifacts");
            List<Path> worktrees = arms.stream().map(arm -> parent.resolve(arm.basename())).toList();
            Prepared prepared = prepare(
                    jdt,
                    vsix,
                    official,
                    source,
                    routed,
                    debug,
                    checkout,
                    sources,
                    artifacts,
                    worktrees,
                    expected);
            require(prepared.armCount() == 3, "preparation changed arm count");
            for (int index = 0; index < arms.size(); index++) {
                ArmSpec arm = arms.get(index);
                require(Files.isDirectory(
                                artifacts.resolve(arm.id()).resolve("jdt-data").resolve(arm.cacheKey())),
                        "arm cache directory is missing");
                require(Files.isRegularFile(worktrees.get(index).resolve("pom.xml")),
                        "fixture was not copied");
                require(Files.isRegularFile(worktrees.get(index)
                                .resolve(ARTIFACTS).resolve("probe/callback_sink.js")),
                        "sink was not copied");
            }

            Files.writeString(checkout.resolve("dirty.txt"), "dirty\n");
            expectFailure("dirty source checkout", () -> verifyCheckout(checkout, commit, sourceFiles));
            Files.delete(checkout.resolve("dirty.txt"));
            expectFailure(
                    "wrong worktree basename",
                    () -> validateDestinations(
                            parent.resolve("other-artifacts"),
                            List.of(
                                    parent.resolve("wrong"),
                                    parent.resolve("source-test"),
                                    parent.resolve("routed-test")),
                            List.of(
                                    arm("official", "official-test"),
                                    arm("source", "source-test"),
                                    arm("routed", "routed-test"))));
            expectFailure("existing destination", () -> requireFreshDestination(
                    artifacts, "artifact destination"));
            expectFailure("archive traversal", () -> safeRelativePath("../escape", "test"));
        } finally {
            deleteRecursively(root);
        }
    }

    private static Path createTestSources(Path root) throws IOException {
        Files.createDirectories(root.resolve(Path.of(FIXTURE_POM).getParent()));
        Files.createDirectories(root.resolve(Path.of(FIXTURE_JAVA).getParent()));
        Files.createDirectories(root.resolve(Path.of(SINK_SOURCE).getParent()));
        Files.writeString(root.resolve(FIXTURE_POM), "<project/>\n");
        Files.writeString(root.resolve(FIXTURE_JAVA), "package dev.zed.spring.s004; class X {}\n");
        Files.writeString(root.resolve(SINK_SOURCE), "\"use strict\";\n");
        return root;
    }

    private static Path createTestCheckout(Path root) throws Exception {
        Files.createDirectories(root.resolve("proxy/src"));
        Files.writeString(root.resolve("proxy/src/main.rs"), "fn main() {}\n");
        Files.writeString(root.resolve("proxy/src/http.rs"), "// http\n");
        Files.writeString(root.resolve("proxy/src/lsp.rs"), "// lsp\n");
        Files.writeString(root.resolve("proxy/Cargo.toml"), "[package]\nname='test'\nversion='0.0.0'\n");
        Files.writeString(root.resolve("proxy/Cargo.lock"), "version = 4\n");
        Files.writeString(root.resolve("LICENSE"), "Apache-2.0 test fixture\n");
        runCommand(root, "git", "init", "--quiet");
        runCommand(root, "git", "config", "user.email", "s005@example.invalid");
        runCommand(root, "git", "config", "user.name", "S005 Test");
        runCommand(root, "git", "add", ".");
        runCommand(root, "git", "commit", "--quiet", "-m", "fixture");
        return root;
    }

    private static void runCommand(Path root, String... command) throws Exception {
        runProcess(root, List.of(command));
    }

    private static ArmSpec arm(String id, String basename) {
        return new ArmSpec(id, basename, sha1(basename));
    }

    private static Path writeBytes(Path path, int... values) throws IOException {
        byte[] bytes = new byte[values.length];
        for (int index = 0; index < values.length; index++) {
            bytes[index] = (byte) values[index];
        }
        Files.write(path, bytes);
        return path;
    }

    private static ArtifactSpec artifactFor(Path path) throws IOException {
        return new ArtifactSpec(Files.size(path), sha256(path));
    }

    private static void writeZip(Path destination, List<ZipTestEntry> entries)
            throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(
                new BufferedOutputStream(Files.newOutputStream(destination)))) {
            for (ZipTestEntry entry : entries) {
                zip.putNextEntry(new ZipEntry(entry.name()));
                zip.write(entry.data());
                zip.closeEntry();
            }
        }
    }

    private static void writeTarGzip(Path destination, List<TarTestEntry> entries)
            throws IOException {
        try (OutputStream file = new BufferedOutputStream(Files.newOutputStream(destination));
                OutputStream gzip = new GZIPOutputStream(file)) {
            for (TarTestEntry entry : entries) {
                byte[] header = new byte[TAR_BLOCK_SIZE];
                writeTarString(header, 0, 100, entry.name());
                writeTarOctal(header, 100, 8, 0644);
                writeTarOctal(header, 108, 8, 0);
                writeTarOctal(header, 116, 8, 0);
                writeTarOctal(header, 124, 12, entry.data().length);
                writeTarOctal(header, 136, 12, 0);
                Arrays.fill(header, 148, 156, (byte) ' ');
                header[156] = '0';
                writeTarString(header, 257, 6, "ustar");
                writeTarString(header, 263, 2, "00");
                long checksum = 0;
                for (byte value : header) {
                    checksum += Byte.toUnsignedInt(value);
                }
                writeTarString(header, 148, 6, String.format(Locale.ROOT, "%06o", checksum));
                header[154] = 0;
                header[155] = (byte) ' ';
                gzip.write(header);
                gzip.write(entry.data());
                gzip.write(new byte[(int) padding(entry.data().length)]);
            }
            gzip.write(new byte[TAR_BLOCK_SIZE * 2]);
        }
    }

    private static void writeTarString(
            byte[] header, int offset, int length, String value) throws IOException {
        byte[] encoded = value.getBytes(StandardCharsets.UTF_8);
        if (encoded.length > length) {
            throw new IOException("test tar field is too long");
        }
        System.arraycopy(encoded, 0, header, offset, encoded.length);
    }

    private static void writeTarOctal(
            byte[] header, int offset, int length, long value) throws IOException {
        String text = Long.toOctalString(value);
        if (text.length() > length - 1) {
            throw new IOException("test tar number is too large");
        }
        Arrays.fill(header, offset, offset + length, (byte) '0');
        byte[] encoded = text.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(encoded, 0, header, offset + length - 1 - encoded.length, encoded.length);
        header[offset + length - 1] = 0;
    }

    private static void expectFailure(String label, ThrowingRunnable action) throws Exception {
        try {
            action.run();
        } catch (IOException | ArithmeticException expected) {
            return;
        }
        throw new IllegalStateException("self-test did not reject " + label);
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalStateException(message);
        }
    }

    private static void deleteRecursively(Path root) throws IOException {
        if (root == null || !Files.exists(root, LinkOption.NOFOLLOW_LINKS)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(root)) {
            Consumer<Path> delete = path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException error) {
                    throw new UncheckedIOException(error);
                }
            };
            paths.sorted(Comparator.reverseOrder()).forEach(delete);
        } catch (UncheckedIOException error) {
            throw error.getCause();
        }
    }

    private record ArtifactSpec(long size, String sha256) {
    }

    private record BundleSpec(String fileName, long size, String sha256) {
    }

    private record ArmSpec(String id, String basename, String cacheKey) {
    }

    private record ExpectedSet(
            ArtifactSpec jdtls,
            ArtifactSpec vsix,
            ArtifactSpec officialProxy,
            ArtifactSpec debug,
            ArtifactSpec packageJson,
            List<BundleSpec> bundles,
            String sourceCommit,
            Map<String, String> sourceFiles,
            List<ArmSpec> arms) {
    }

    private record VerifiedArtifact(long size, String sha256) {
    }

    private record DestinationSet(Path parent, Path artifacts, List<Path> worktrees) {
    }

    private record Prepared(
            VerifiedArtifact jdtls,
            VerifiedArtifact vsix,
            List<VerifiedArtifact> proxies,
            VerifiedArtifact debug,
            String sourceCommit,
            int armCount) {
    }

    private record TarTestEntry(String name, byte[] data) {
        private TarTestEntry {
            data = data.clone();
        }

        private static TarTestEntry file(String name, byte[] data) {
            return new TarTestEntry(name, data);
        }
    }

    private record ZipTestEntry(String name, byte[] data) {
        private ZipTestEntry {
            data = data.clone();
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
