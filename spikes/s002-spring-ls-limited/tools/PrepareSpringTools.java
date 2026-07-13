import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Verifies and extracts the one Spring Tools VSIX pinned by S002.
 *
 * <p>This is disposable spike infrastructure, not a downloader or product
 * installer. It requires a caller-supplied local VSIX and a fresh destination.
 */
public final class PrepareSpringTools {
    private static final long EXPECTED_SIZE = 82_759_143L;
    private static final String EXPECTED_SHA256 =
            "70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3";
    private static final String EXPECTED_SERVER_ENTRY =
            "extension/language-server/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar";
    private static final String EXPECTED_LICENSE_ENTRY = "extension/LICENSE.txt";
    private static final String EXPECTED_LIBRARY_DIRECTORY = "extension/language-server/lib";
    private static final int MAX_ENTRIES = 10_000;
    private static final long MAX_EXTRACTED_BYTES = 1_073_741_824L;
    private static final int BUFFER_SIZE = 64 * 1024;

    private static final ExpectedArtifact OFFICIAL_ARTIFACT = new ExpectedArtifact(
            EXPECTED_SIZE,
            EXPECTED_SHA256,
            EXPECTED_SERVER_ENTRY,
            EXPECTED_LICENSE_ENTRY,
            EXPECTED_LIBRARY_DIRECTORY);

    private PrepareSpringTools() {
    }

    public static void main(String[] args) {
        try {
            if (args.length == 1 && args[0].equals("--self-test")) {
                selfTest();
                System.out.println("PrepareSpringTools self-test passed");
                return;
            }
            if (args.length != 2) {
                System.err.println("usage: java PrepareSpringTools.java <vsix> <fresh-destination>");
                System.err.println("       java PrepareSpringTools.java --self-test");
                System.exit(2);
            }

            PreparedArtifact prepared = prepare(Path.of(args[0]), Path.of(args[1]), OFFICIAL_ARTIFACT);
            System.out.println("verified-size=" + prepared.archiveSize());
            System.out.println("verified-sha256=" + prepared.archiveSha256());
            System.out.println("server-entry=" + prepared.serverEntry());
            System.out.println("license-entry=" + prepared.licenseEntry());
            System.out.println("archive-entries=" + prepared.entryCount());
            System.out.println("extracted-bytes=" + prepared.extractedBytes());
        } catch (Exception error) {
            System.err.println("Spring Tools artifact preparation failed: " + error.getMessage());
            System.exit(1);
        }
    }

    private static PreparedArtifact prepare(
            Path archive,
            Path destination,
            ExpectedArtifact expected) throws IOException {
        Path normalizedArchive = archive.toAbsolutePath().normalize();
        Path normalizedDestination = destination.toAbsolutePath().normalize();
        if (!Files.isRegularFile(normalizedArchive)) {
            throw new IOException("input is not a regular file: " + normalizedArchive);
        }
        if (Files.exists(normalizedDestination)) {
            throw new IOException("destination must not already exist: " + normalizedDestination);
        }

        long archiveSize = Files.size(normalizedArchive);
        if (archiveSize != expected.size()) {
            throw new IOException(
                    "unexpected archive size: expected " + expected.size() + ", got " + archiveSize);
        }
        String archiveSha256 = sha256(normalizedArchive);
        if (!archiveSha256.equals(expected.sha256())) {
            throw new IOException(
                    "unexpected SHA-256: expected " + expected.sha256() + ", got " + archiveSha256);
        }

        Path parent = normalizedDestination.getParent();
        if (parent == null) {
            throw new IOException("destination has no parent: " + normalizedDestination);
        }
        Files.createDirectories(parent);
        Path staging = parent.resolve(
                normalizedDestination.getFileName() + ".partial-" + UUID.randomUUID()).normalize();
        boolean stagingCreated = false;
        boolean moved = false;
        try {
            Files.createDirectory(staging);
            stagingCreated = true;
            ExtractionStats stats = extract(normalizedArchive, staging);
            validateLayout(staging, expected);
            moveFresh(staging, normalizedDestination);
            moved = true;
            return new PreparedArtifact(
                    archiveSize,
                    archiveSha256,
                    normalizedDestination.resolve(expected.serverEntry()).normalize(),
                    normalizedDestination.resolve(expected.licenseEntry()).normalize(),
                    stats.entryCount(),
                    stats.extractedBytes());
        } finally {
            if (stagingCreated && !moved) {
                deleteRecursively(staging);
            }
        }
    }

    private static ExtractionStats extract(Path archive, Path staging) throws IOException {
        Set<String> seenPaths = new java.util.HashSet<>();
        int entryCount = 0;
        long extractedBytes = 0;
        byte[] buffer = new byte[BUFFER_SIZE];

        try (ZipInputStream zip = new ZipInputStream(
                new BufferedInputStream(Files.newInputStream(archive)))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; zip.closeEntry()) {
                entryCount++;
                if (entryCount > MAX_ENTRIES) {
                    throw new IOException("archive contains too many entries");
                }

                String entryName = entry.getName();
                if (entryName == null
                        || entryName.isBlank()
                        || entryName.indexOf('\0') >= 0
                        || entryName.indexOf('\\') >= 0) {
                    throw new IOException("archive contains an invalid or non-portable entry name");
                }
                Path relative = Path.of(entryName).normalize();
                if (relative.isAbsolute()
                        || relative.getNameCount() == 0
                        || relative.startsWith("..")) {
                    throw new IOException("unsafe ZIP entry: " + entryName);
                }

                Path target = staging.resolve(relative).normalize();
                if (!target.startsWith(staging)) {
                    throw new IOException("ZIP entry escapes destination: " + entryName);
                }
                String collisionKey = relative.toString()
                        .replace('\\', '/')
                        .toLowerCase(Locale.ROOT);
                if (!seenPaths.add(collisionKey)) {
                    throw new IOException("duplicate or case-colliding ZIP entry: " + entryName);
                }

                if (entry.isDirectory()) {
                    Files.createDirectories(target);
                    continue;
                }

                Path targetParent = target.getParent();
                if (targetParent == null) {
                    throw new IOException("ZIP entry has no destination parent: " + entryName);
                }
                Files.createDirectories(targetParent);
                try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(target))) {
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        extractedBytes += read;
                        if (extractedBytes > MAX_EXTRACTED_BYTES) {
                            throw new IOException("archive expands beyond the safety limit");
                        }
                        output.write(buffer, 0, read);
                    }
                }
            }
        }
        return new ExtractionStats(entryCount, extractedBytes);
    }

    private static void validateLayout(Path root, ExpectedArtifact expected) throws IOException {
        Path server = root.resolve(expected.serverEntry()).normalize();
        Path license = root.resolve(expected.licenseEntry()).normalize();
        Path libraries = root.resolve(expected.libraryDirectory()).normalize();
        if (!Files.isRegularFile(server)) {
            throw new IOException("expected Spring Boot LS entry is missing: " + expected.serverEntry());
        }
        if (!Files.isRegularFile(license)) {
            throw new IOException("expected license entry is missing: " + expected.licenseEntry());
        }
        if (!Files.isDirectory(libraries)) {
            throw new IOException("expected language-server library directory is missing");
        }

        Path languageServerDirectory = server.getParent();
        if (languageServerDirectory == null) {
            throw new IOException("expected Spring Boot LS entry has no parent directory");
        }
        try (Stream<Path> entries = Files.list(languageServerDirectory)) {
            var serverJars = entries
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String name = path.getFileName().toString();
                        return name.contains("language-server") && name.endsWith(".jar");
                    })
                    .collect(Collectors.toList());
            if (serverJars.size() != 1 || !serverJars.getFirst().equals(server)) {
                throw new IOException("expected exactly one pinned language-server JAR");
            }
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
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is unavailable", error);
        }
        byte[] buffer = new byte[BUFFER_SIZE];
        try (InputStream input = new BufferedInputStream(Files.newInputStream(path))) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static void selfTest() throws Exception {
        Path root = Files.createTempDirectory("s002-prepare-spring-tools-");
        try {
            Path good = root.resolve("good.vsix");
            writeZip(good, new LinkedHashMap<>(Map.of(
                    EXPECTED_SERVER_ENTRY, new byte[] {1, 2, 3},
                    EXPECTED_LICENSE_ENTRY, "test license".getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    EXPECTED_LIBRARY_DIRECTORY + "/dependency.jar", new byte[] {4, 5, 6})));
            ExpectedArtifact goodExpected = expectedFor(good);
            PreparedArtifact prepared = prepare(good, root.resolve("good-output"), goodExpected);
            require(Files.isRegularFile(prepared.serverEntry()), "good server entry was not extracted");
            require(Files.isRegularFile(prepared.licenseEntry()), "good license was not extracted");

            expectFailure("size mismatch", () -> prepare(
                    good,
                    root.resolve("wrong-size-output"),
                    new ExpectedArtifact(
                            goodExpected.size() + 1,
                            goodExpected.sha256(),
                            goodExpected.serverEntry(),
                            goodExpected.licenseEntry(),
                            goodExpected.libraryDirectory())));
            expectFailure("digest mismatch", () -> prepare(
                    good,
                    root.resolve("wrong-digest-output"),
                    new ExpectedArtifact(
                            goodExpected.size(),
                            "0".repeat(64),
                            goodExpected.serverEntry(),
                            goodExpected.licenseEntry(),
                            goodExpected.libraryDirectory())));

            Path traversal = root.resolve("traversal.vsix");
            writeZip(traversal, new LinkedHashMap<>(Map.of(
                    "../escape.txt", new byte[] {9},
                    EXPECTED_SERVER_ENTRY, new byte[] {1},
                    EXPECTED_LICENSE_ENTRY, new byte[] {2},
                    EXPECTED_LIBRARY_DIRECTORY + "/dependency.jar", new byte[] {3})));
            expectFailure("ZIP traversal", () -> prepare(
                    traversal,
                    root.resolve("traversal-output"),
                    expectedFor(traversal)));
            require(!Files.exists(root.resolve("escape.txt")), "ZIP traversal wrote outside destination");

            Path backslashTraversal = root.resolve("backslash-traversal.vsix");
            writeZip(backslashTraversal, new LinkedHashMap<>(Map.of(
                    "..\\escape.txt", new byte[] {9},
                    EXPECTED_SERVER_ENTRY, new byte[] {1},
                    EXPECTED_LICENSE_ENTRY, new byte[] {2},
                    EXPECTED_LIBRARY_DIRECTORY + "/dependency.jar", new byte[] {3})));
            expectFailure("backslash ZIP traversal", () -> prepare(
                    backslashTraversal,
                    root.resolve("backslash-traversal-output"),
                    expectedFor(backslashTraversal)));

            Path missingLayout = root.resolve("missing-layout.vsix");
            writeZip(missingLayout, new LinkedHashMap<>(Map.of(
                    EXPECTED_LICENSE_ENTRY, new byte[] {1})));
            expectFailure("missing server layout", () -> prepare(
                    missingLayout,
                    root.resolve("missing-layout-output"),
                    expectedFor(missingLayout)));

            Path existingDestination = root.resolve("existing-output");
            Files.createDirectory(existingDestination);
            expectFailure("existing destination", () -> prepare(
                    good,
                    existingDestination,
                    goodExpected));
        } finally {
            deleteRecursively(root);
        }
    }

    private static ExpectedArtifact expectedFor(Path archive) throws IOException {
        return new ExpectedArtifact(
                Files.size(archive),
                sha256(archive),
                EXPECTED_SERVER_ENTRY,
                EXPECTED_LICENSE_ENTRY,
                EXPECTED_LIBRARY_DIRECTORY);
    }

    private static void writeZip(Path destination, LinkedHashMap<String, byte[]> entries)
            throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(
                new BufferedOutputStream(Files.newOutputStream(destination)))) {
            for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue());
                zip.closeEntry();
            }
        }
    }

    private static void expectFailure(String label, ThrowingRunnable action) throws Exception {
        try {
            action.run();
        } catch (IOException expected) {
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
        if (root == null || !Files.exists(root)) {
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

    private record ExpectedArtifact(
            long size,
            String sha256,
            String serverEntry,
            String licenseEntry,
            String libraryDirectory) {
    }

    private record ExtractionStats(int entryCount, long extractedBytes) {
    }

    private record PreparedArtifact(
            long archiveSize,
            String archiveSha256,
            Path serverEntry,
            Path licenseEntry,
            int entryCount,
            long extractedBytes) {
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
