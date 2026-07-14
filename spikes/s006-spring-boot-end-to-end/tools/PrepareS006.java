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
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Verifies and stages the fixed S006 inputs into one fresh ignored artifact
 * directory and one fresh worktree. This is disposable spike infrastructure,
 * not an installer, updater, downloader, or production packaging tool.
 */
public final class PrepareS006 {
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int TAR_BLOCK_SIZE = 512;
    private static final int MAX_ARCHIVE_ENTRIES = 50_000;
    private static final long MAX_ENTRY_BYTES = 536_870_912L;
    private static final long MAX_EXTRACTED_BYTES = 1_073_741_824L;
    private static final int MAX_PAX_BYTES = 16 * 1024;
    private static final Set<String> ALLOWED_PAX_KEYS = Set.of("uid", "gid", "mtime");

    private static final String UPSTREAM_COMMIT =
            "9148b8972c1b93fbe5512a9ecf0ba33c3182970d";
    private static final String SERVER_ENTRY =
            "extension/language-server/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";
    private static final String BUNDLE_PREFIX = "extension/jars/";
    private static final String METADATA_ENTRY = "META-INF/spring-configuration-metadata.json";
    private static final String FIXTURE_ROOT =
            "spikes/s006-spring-boot-end-to-end/fixture";
    private static final String PROXY_SOURCE =
            "spikes/s006-spring-boot-end-to-end/extension/probe/spring_proxy.mjs";

    private static final ArtifactSpec JDTLS = new ArtifactSpec(
            50_925_681L,
            "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d");
    private static final ArtifactSpec VSIX = new ArtifactSpec(
            82_759_143L,
            "70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3");
    private static final ArtifactSpec DEBUG = new ArtifactSpec(
            3_107_682L,
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c");
    private static final ArtifactSpec SERVER = new ArtifactSpec(
            -1,
            "ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1");

    private static final List<NamedArtifact> BUNDLES = List.of(
            new NamedArtifact(
                    "io.projectreactor.reactor-core.jar",
                    new ArtifactSpec(1_627_393L,
                            "76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590")),
            new NamedArtifact(
                    "org.reactivestreams.reactive-streams.jar",
                    new ArtifactSpec(21_386L,
                            "71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038")),
            new NamedArtifact(
                    "jdt-ls-commons.jar",
                    new ArtifactSpec(140_287L,
                            "0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69")),
            new NamedArtifact(
                    "jdt-ls-extension.jar",
                    new ArtifactSpec(23_886L,
                            "692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce")),
            new NamedArtifact(
                    "sts-gradle-tooling.jar",
                    new ArtifactSpec(8_293L,
                            "9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4")));

    private PrepareS006() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S006 preparation synthetic tests passed");
            return;
        }
        if (args.length != 11) {
            System.err.println(
                    "usage: java PrepareS006.java <jdtls.tar.gz> <spring.vsix> "
                            + "<source-proxy> <instrumented-proxy> <java-debug.jar> "
                            + "<clean-java-checkout> <repository-root> <boot-metadata.jar> "
                            + "<fresh-artifacts> <fresh-worktree> <expected-worktree-name>");
            System.exit(2);
        }

        Prepared prepared = prepare(
                Path.of(args[0]), Path.of(args[1]), Path.of(args[2]), Path.of(args[3]),
                Path.of(args[4]), Path.of(args[5]), Path.of(args[6]), Path.of(args[7]),
                Path.of(args[8]), Path.of(args[9]), args[10],
                new ExpectedInputs(JDTLS, VSIX, DEBUG, SERVER, BUNDLES));
        System.out.println("jdtls-sha256=" + prepared.jdtlsSha256());
        System.out.println("vsix-sha256=" + prepared.vsixSha256());
        System.out.println("source-proxy-sha256=" + prepared.sourceProxySha256());
        System.out.println("instrumented-proxy-sha256=" + prepared.instrumentedProxySha256());
        System.out.println("metadata-sha256=" + prepared.metadataSha256());
        System.out.println("source-commit=" + prepared.sourceCommit());
    }

    private static Prepared prepare(
            Path jdtArchive,
            Path vsix,
            Path sourceProxy,
            Path instrumentedProxy,
            Path debug,
            Path checkout,
            Path repositoryRoot,
            Path metadataJar,
            Path artifactDestination,
            Path worktreeDestination,
            String expectedWorktreeName,
            ExpectedInputs expected) throws Exception {
        Path jdtInput = requireRegularFile(jdtArchive, "JDT LS archive");
        Path vsixInput = requireRegularFile(vsix, "Spring VSIX");
        Path sourceInput = requireRegularFile(sourceProxy, "source proxy");
        Path instrumentedInput = requireRegularFile(instrumentedProxy, "instrumented proxy");
        Path debugInput = requireRegularFile(debug, "Java debug bundle");
        Path metadataInput = requireRegularFile(metadataJar, "Boot metadata JAR");
        if (!metadataInput.getFileName().toString().equals(
                "spring-boot-autoconfigure-3.5.5.jar")) {
            throw new IOException("Boot metadata JAR does not match the pinned coordinate");
        }
        Path sourceRoot = requireDirectory(repositoryRoot, "repository root");
        Path cleanCheckout = requireDirectory(checkout, "Java extension checkout");

        String jdtHash = verifyArtifact(jdtInput, expected.jdtls());
        String vsixHash = verifyArtifact(vsixInput, expected.vsix());
        verifyArtifact(debugInput, expected.debug());
        String sourceProxyHash = sha256(sourceInput);
        String instrumentedProxyHash = sha256(instrumentedInput);
        if (sourceProxyHash.equals(instrumentedProxyHash)) {
            throw new IOException("source and instrumented proxy binaries are identical");
        }
        verifyCheckout(cleanCheckout);
        verifyMetadata(metadataInput);
        requireRepositoryInputs(sourceRoot);

        Path artifacts = artifactDestination.toAbsolutePath().normalize();
        Path worktree = worktreeDestination.toAbsolutePath().normalize();
        if (artifacts.equals(worktree)) {
            throw new IOException("artifact and worktree destinations must be distinct");
        }
        if (!worktree.getFileName().toString().equals(expectedWorktreeName)
                || !expectedWorktreeName.matches("s006-[a-z0-9-]+")) {
            throw new IOException("worktree name does not match the fixed S006 pattern");
        }
        requireFreshDestination(artifacts, "artifact destination");
        requireFreshDestination(worktree, "worktree destination");
        Path parent = requireSharedParent(artifacts, worktree);
        Path transaction = Files.createTempDirectory(parent, ".s006-transaction-");
        List<Path> moved = new ArrayList<>();
        try {
            Path artifactStage = transaction.resolve("artifacts");
            Path worktreeStage = transaction.resolve("worktree");
            Files.createDirectories(artifactStage);
            Files.createDirectories(worktreeStage.resolve(".s006-artifacts"));

            extractTarGzip(jdtInput, artifactStage.resolve("jdtls"));
            makeExecutable(requireRegularFile(
                    artifactStage.resolve("jdtls/bin/jdtls"), "JDT launcher"));
            Files.createDirectories(artifactStage.resolve("proxy"));
            Path stagedSourceProxy = artifactStage.resolve("proxy/source-java-lsp-proxy");
            Path stagedInstrumentedProxy = artifactStage.resolve(
                    "proxy/instrumented-java-lsp-proxy");
            Files.copy(sourceInput, stagedSourceProxy);
            Files.copy(instrumentedInput, stagedInstrumentedProxy);
            makeExecutable(stagedSourceProxy);
            makeExecutable(stagedInstrumentedProxy);
            Files.createDirectories(artifactStage.resolve("debug"));
            Files.copy(debugInput, artifactStage.resolve("debug/java-debug.jar"));

            Path spring = worktreeStage.resolve(".s006-artifacts/spring");
            Path bundles = worktreeStage.resolve(".s006-artifacts/bundles");
            Files.createDirectories(spring);
            Files.createDirectories(bundles);
            extractSpringInputs(vsixInput, spring, bundles, expected);
            Path probe = worktreeStage.resolve(".s006-artifacts/probe");
            Files.createDirectories(probe);
            Files.copy(sourceRoot.resolve(PROXY_SOURCE), probe.resolve("spring_proxy.mjs"));
            copyTree(sourceRoot.resolve(FIXTURE_ROOT), worktreeStage);
            writeSettings(artifactStage.resolve("isolated-settings.json"));
            writeManifest(
                    artifactStage.resolve("s006-prepared-manifest.txt"),
                    jdtHash, vsixHash, sourceProxyHash, instrumentedProxyHash, sha256(metadataInput));

            moveFresh(artifactStage, artifacts);
            moved.add(artifacts);
            moveFresh(worktreeStage, worktree);
            moved.add(worktree);
            return new Prepared(
                    jdtHash, vsixHash, sourceProxyHash, instrumentedProxyHash,
                    sha256(metadataInput), UPSTREAM_COMMIT);
        } catch (Exception error) {
            for (int index = moved.size() - 1; index >= 0; index--) {
                deleteRecursively(moved.get(index));
            }
            throw error;
        } finally {
            deleteRecursively(transaction);
        }
    }

    private static void extractSpringInputs(
            Path vsix,
            Path springDestination,
            Path bundleDestination,
            ExpectedInputs expected) throws IOException {
        Map<String, DestinationSpec> selected = new LinkedHashMap<>();
        selected.put(SERVER_ENTRY,
                new DestinationSpec(springDestination.resolve(Path.of(SERVER_ENTRY).getFileName()), expected.server()));
        for (NamedArtifact bundle : expected.bundles()) {
            selected.put(BUNDLE_PREFIX + bundle.name(),
                    new DestinationSpec(bundleDestination.resolve(bundle.name()), bundle.spec()));
        }
        Set<String> found = new HashSet<>();
        try (ZipInputStream zip = new ZipInputStream(
                new BufferedInputStream(Files.newInputStream(vsix)))) {
            int entries = 0;
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; zip.closeEntry()) {
                if (++entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("VSIX contains too many entries");
                }
                DestinationSpec destination = selected.get(entry.getName());
                if (destination == null) {
                    continue;
                }
                if (entry.isDirectory() || !found.add(entry.getName())) {
                    throw new IOException("duplicate or invalid selected VSIX entry");
                }
                copyBounded(zip, destination.path(), MAX_ENTRY_BYTES);
                verifyArtifact(destination.path(), destination.spec());
            }
        }
        if (!found.equals(selected.keySet())) {
            throw new IOException("VSIX is missing a fixed Spring input");
        }
    }

    private static void extractTarGzip(Path archive, Path destination) throws IOException {
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
                if (++entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("TAR contains too many entries");
                }
                String name = tarText(header, 0, 100);
                String prefix = tarText(header, 345, 155);
                if (!prefix.isEmpty()) {
                    name = prefix + "/" + name;
                }
                long size = tarOctal(header, 124, 12);
                if (size < 0 || size > MAX_ENTRY_BYTES) {
                    throw new IOException("TAR entry exceeds the safety limit");
                }
                int type = header[156] & 0xff;
                if (type == 'x' || type == 'g') {
                    validatePax(readExact(input, size));
                    skipPadding(input, size);
                    continue;
                }
                Path target = safeArchiveTarget(destination, name);
                if (type == '5') {
                    Files.createDirectories(target);
                    if (size != 0) throw new IOException("directory TAR entry has content");
                } else if (type == 0 || type == '0') {
                    Files.createDirectories(target.getParent());
                    extracted += copyExact(input, target, size);
                    if (extracted > MAX_EXTRACTED_BYTES) {
                        throw new IOException("TAR expands beyond the safety limit");
                    }
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
        if (bytes.length > MAX_PAX_BYTES) throw new IOException("PAX header exceeds limit");
        String text = new String(bytes, StandardCharsets.UTF_8);
        for (String record : text.split("\n")) {
            if (record.isEmpty()) continue;
            int space = record.indexOf(' ');
            int equals = record.indexOf('=', space + 1);
            if (space < 1 || equals < 0 || !ALLOWED_PAX_KEYS.contains(record.substring(space + 1, equals))) {
                throw new IOException("unsupported PAX field");
            }
        }
    }

    private static void verifyMetadata(Path jar) throws IOException {
        boolean found = false;
        try (ZipInputStream zip = new ZipInputStream(
                new BufferedInputStream(Files.newInputStream(jar)))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; zip.closeEntry()) {
                if (entry.getName().equals(METADATA_ENTRY)) {
                    byte[] metadata = readBounded(zip, 64 * 1024 * 1024);
                    found = new String(metadata, StandardCharsets.UTF_8).contains("server.port");
                    break;
                }
            }
        }
        if (!found) throw new IOException("resolved Boot metadata does not contain server.port");
    }

    private static void verifyCheckout(Path checkout) throws Exception {
        String commit = run(checkout, "git", "rev-parse", "HEAD").trim();
        if (!commit.equals(UPSTREAM_COMMIT)) throw new IOException("unexpected Java source commit");
        if (!run(checkout, "git", "status", "--porcelain").isBlank()) {
            throw new IOException("Java source checkout is not clean");
        }
    }

    private static void requireRepositoryInputs(Path root) throws IOException {
        List<String> required = List.of(
                PROXY_SOURCE,
                FIXTURE_ROOT + "/pom.xml",
                FIXTURE_ROOT + "/src/main/java/dev/zed/spring/s006/S006Application.java",
                FIXTURE_ROOT + "/src/main/resources/application.properties",
                "spikes/s006-spring-boot-end-to-end/proxy/instrumented_proxy.patch");
        for (String relative : required) requireRegularFile(root.resolve(relative), relative);
        String properties = Files.readString(root.resolve(
                FIXTURE_ROOT + "/src/main/resources/application.properties"), StandardCharsets.UTF_8);
        if (!properties.equals("ser\n")) throw new IOException("fixture properties content changed");
    }

    private static void writeSettings(Path destination) throws IOException {
        String settings = """
                {
                  "languages": {
                    "Java": {
                      "language_servers": ["jdtls", "s006-spring-boot-end-to-end"]
                    },
                    "Properties": {
                      "language_servers": ["s006-spring-boot-end-to-end"]
                    }
                  }
                }
                """;
        Files.writeString(destination, settings, StandardCharsets.UTF_8);
    }

    private static void writeManifest(
            Path destination, String jdt, String vsix, String sourceProxy,
            String instrumentedProxy, String metadata) throws IOException {
        Files.writeString(destination,
                "jdtls=" + jdt + "\n"
                        + "vsix=" + vsix + "\n"
                        + "source-proxy=" + sourceProxy + "\n"
                        + "instrumented-proxy=" + instrumentedProxy + "\n"
                        + "metadata=" + metadata + "\n"
                        + "source-commit=" + UPSTREAM_COMMIT + "\n",
                StandardCharsets.UTF_8);
    }

    private static void copyTree(Path source, Path destination) throws IOException {
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : paths.sorted().toList()) {
                Path relative = source.relativize(path);
                Path target = destination.resolve(relative).normalize();
                if (!target.startsWith(destination)) throw new IOException("fixture escapes destination");
                if (Files.isSymbolicLink(path)) throw new IOException("fixture contains a symlink");
                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) Files.createDirectories(target);
                else if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) Files.copy(path, target);
                else throw new IOException("fixture contains an unsupported entry");
            }
        }
    }

    private static String verifyArtifact(Path path, ArtifactSpec expected) throws IOException {
        if (expected.size() >= 0 && Files.size(path) != expected.size()) {
            throw new IOException("artifact size mismatch: " + path.getFileName());
        }
        String digest = sha256(path);
        if (!digest.equals(expected.sha256())) {
            throw new IOException("artifact digest mismatch: " + path.getFileName());
        }
        return digest;
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path normalized = path.toAbsolutePath().normalize();
        if (!Files.isRegularFile(normalized, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(normalized)) {
            throw new IOException(label + " is not a regular non-symlink file");
        }
        return normalized;
    }

    private static Path requireDirectory(Path path, String label) throws IOException {
        Path normalized = path.toAbsolutePath().normalize();
        if (!Files.isDirectory(normalized, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(normalized)) {
            throw new IOException(label + " is not a regular directory");
        }
        return normalized;
    }

    private static void requireFreshDestination(Path destination, String label) throws IOException {
        if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(label + " already exists");
        }
    }

    private static void makeExecutable(Path path) throws IOException {
        if (!path.toFile().setExecutable(true, true) && !Files.isExecutable(path)) {
            throw new IOException("failed to make executable: " + path.getFileName());
        }
    }

    private static Path requireSharedParent(Path first, Path second) throws IOException {
        Path firstParent = first.getParent();
        Path secondParent = second.getParent();
        if (firstParent == null || !firstParent.equals(secondParent)
                || !Files.isDirectory(firstParent, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("S006 destinations must share one existing parent");
        }
        return firstParent;
    }

    private static Path safeArchiveTarget(Path root, String name) throws IOException {
        if (name.isBlank() || name.indexOf('\\') >= 0 || name.indexOf('\0') >= 0) {
            throw new IOException("invalid archive path");
        }
        Path relative = Path.of(name).normalize();
        if (relative.isAbsolute() || relative.startsWith("..")) throw new IOException("unsafe archive path");
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root)) throw new IOException("archive path escapes destination");
        return target;
    }

    private static long copyExact(InputStream input, Path destination, long size) throws IOException {
        try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(destination))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            long remaining = size;
            while (remaining > 0) {
                int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (read < 0) throw new IOException("truncated archive entry");
                output.write(buffer, 0, read);
                remaining -= read;
            }
        }
        return size;
    }

    private static void copyBounded(InputStream input, Path destination, long maximum) throws IOException {
        try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(destination))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            long total = 0;
            for (int read; (read = input.read(buffer)) >= 0;) {
                total += read;
                if (total > maximum) throw new IOException("archive entry exceeds limit");
                output.write(buffer, 0, read);
            }
        }
    }

    private static byte[] readBounded(InputStream input, int maximum) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[BUFFER_SIZE];
        for (int read; (read = input.read(buffer)) >= 0;) {
            if (output.size() + read > maximum) throw new IOException("entry exceeds read limit");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static byte[] readExact(InputStream input, long size) throws IOException {
        if (size > Integer.MAX_VALUE) throw new IOException("entry cannot fit in memory");
        byte[] bytes = new byte[(int) size];
        int offset = 0;
        while (offset < bytes.length) {
            int read = input.read(bytes, offset, bytes.length - offset);
            if (read < 0) throw new IOException("truncated archive entry");
            offset += read;
        }
        return bytes;
    }

    private static boolean readBlock(InputStream input, byte[] block) throws IOException {
        int offset = 0;
        while (offset < block.length) {
            int read = input.read(block, offset, block.length - offset);
            if (read < 0) {
                if (offset == 0) return false;
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
                if (input.read() < 0) throw new IOException("truncated TAR padding");
                skipped = 1;
            }
            padding -= skipped;
        }
    }

    private static String tarText(byte[] header, int offset, int length) {
        int end = offset;
        while (end < offset + length && header[end] != 0) end++;
        return new String(header, offset, end - offset, StandardCharsets.UTF_8);
    }

    private static long tarOctal(byte[] header, int offset, int length) throws IOException {
        String value = tarText(header, offset, length).trim();
        try {
            return value.isEmpty() ? 0 : Long.parseLong(value, 8);
        } catch (NumberFormatException error) {
            throw new IOException("invalid TAR size", error);
        }
    }

    private static boolean allZero(byte[] block) {
        for (byte value : block) if (value != 0) return false;
        return true;
    }

    private static String sha256(Path path) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable", error);
        }
        try (InputStream input = new BufferedInputStream(Files.newInputStream(path))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            for (int read; (read = input.read(buffer)) >= 0;) digest.update(buffer, 0, read);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static String run(Path directory, String... command) throws Exception {
        Process process = new ProcessBuilder(command)
                .directory(directory.toFile())
                .redirectErrorStream(true)
                .start();
        byte[] output = process.getInputStream().readNBytes(1024 * 1024);
        if (!process.waitFor(10, TimeUnit.SECONDS) || process.exitValue() != 0) {
            process.destroyForcibly();
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
        if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return;
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }

    private static void selfTest() throws Exception {
        Path root = Files.createTempDirectory("s006-prepare-test-");
        try {
            Path metadata = root.resolve("metadata.jar");
            writeZip(metadata, Map.of(METADATA_ENTRY,
                    "{\"properties\":[{\"name\":\"server.port\"}]}".getBytes(StandardCharsets.UTF_8)));
            verifyMetadata(metadata);
            Path missing = root.resolve("missing.jar");
            writeZip(missing, Map.of("other.json", new byte[] {1}));
            expectFailure(() -> verifyMetadata(missing));

            Path archive = root.resolve("good.tar.gz");
            writeTarGzip(archive, Map.of("bin/jdtls", "probe".getBytes(StandardCharsets.UTF_8)));
            Path extracted = root.resolve("extracted");
            extractTarGzip(archive, extracted);
            require(Files.readString(extracted.resolve("bin/jdtls")).equals("probe"),
                    "TAR fixture was not extracted");

            Path unsafe = root.resolve("unsafe.tar.gz");
            writeTarGzip(unsafe, Map.of("../escape", new byte[] {1}));
            expectFailure(() -> extractTarGzip(unsafe, root.resolve("unsafe-output")));

            Path route = root.resolve("existing");
            Files.writeString(route, "occupied");
            expectFailure(() -> requireFreshDestination(route, "test destination"));
            require(safeArchiveTarget(root, "space/프로젝트/file").startsWith(root),
                    "Unicode archive path was rejected");
        } finally {
            deleteRecursively(root);
        }
    }

    private static void writeZip(Path destination, Map<String, byte[]> entries) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(destination))) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        }
    }

    private static void writeTarGzip(Path destination, Map<String, byte[]> entries) throws IOException {
        try (OutputStream gzip = new GZIPOutputStream(Files.newOutputStream(destination))) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                byte[] header = new byte[TAR_BLOCK_SIZE];
                byte[] name = entry.getKey().getBytes(StandardCharsets.UTF_8);
                System.arraycopy(name, 0, header, 0, Math.min(name.length, 100));
                byte[] size = String.format(Locale.ROOT, "%011o\0", entry.getValue().length)
                        .getBytes(StandardCharsets.US_ASCII);
                System.arraycopy(size, 0, header, 124, size.length);
                header[156] = '0';
                gzip.write(header);
                gzip.write(entry.getValue());
                int padding = (TAR_BLOCK_SIZE - (entry.getValue().length % TAR_BLOCK_SIZE))
                        % TAR_BLOCK_SIZE;
                gzip.write(new byte[padding]);
            }
            gzip.write(new byte[TAR_BLOCK_SIZE * 2]);
        }
    }

    private static void expectFailure(ThrowingRunnable runnable) throws Exception {
        try {
            runnable.run();
            throw new AssertionError("expected operation to fail");
        } catch (IOException expected) {
            // Expected synthetic rejection.
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private record ArtifactSpec(long size, String sha256) {
    }

    private record NamedArtifact(String name, ArtifactSpec spec) {
    }

    private record DestinationSpec(Path path, ArtifactSpec spec) {
    }

    private record ExpectedInputs(
            ArtifactSpec jdtls,
            ArtifactSpec vsix,
            ArtifactSpec debug,
            ArtifactSpec server,
            List<NamedArtifact> bundles) {
    }

    private record Prepared(
            String jdtlsSha256,
            String vsixSha256,
            String sourceProxySha256,
            String instrumentedProxySha256,
            String metadataSha256,
            String sourceCommit) {
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
