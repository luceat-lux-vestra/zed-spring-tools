import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
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
 * Verifies the disposable S010 patch and path contract. Gate A does not apply
 * the patch, build the Java extension, prepare a Zed profile, or launch JDT.
 */
public final class PrepareS010 {
    private static final int BUFFER_SIZE = 64 * 1024;
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
            "c0cf71f44b1cbf3d745e0ff9a588d1aa80e67d2dd5713effaa0859bd0220fcfa";
    private static final String FIXTURE_SHA256 =
            "1ebee7526689ef8ac8bdebe26f779c1f4433a273bc87e9fe2f5d3d285d19b520";
    private static final String CONFIGURATION_PROPERTY =
            "-Dosgi.configuration.area={}";
    private static final String CONFIGURATION_DERIVATION =
            "let jdtls_configuration_path = jdtls_data_path.join(\"configuration\");";
    private static final String DERIVATION_HUNK =
            "@@ -284,0 +285 @@ pub fn build_jdtls_launch_args(";
    private static final String CONFIGURATION_HUNK =
            "@@ -297,0 +299,4 @@ pub fn build_jdtls_launch_args(";
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

    private PrepareS010() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S010 Gate A synthetic tests passed");
            return;
        }
        if (args.length != 4 || !args[0].equals("--gate-a")) {
            System.err.println(
                    "usage: java PrepareS010 --self-test\n"
                            + "   or: java PrepareS010 --gate-a <repository-root> "
                            + "<clean-java-checkout> <fresh-evidence-dir>");
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
        run(cleanCheckout, "git", "apply", "--check", "--whitespace=error-all",
                patch.toString());

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
                "@@ -327,0 +330,4 @@ pub fn build_jdtls_launch_args(");
        expectFailure(() -> verifyPatchContract(afterJar));
    }

    private static String syntheticPatch() {
        return String.join("\n",
                "diff --git a/src/jdtls.rs b/src/jdtls.rs",
                "index 24ada2d..ae2fcbb 100644",
                "--- a/src/jdtls.rs",
                "+++ b/src/jdtls.rs",
                DERIVATION_HUNK,
                "+    " + CONFIGURATION_DERIVATION,
                CONFIGURATION_HUNK,
                "+        format!(",
                "+            \"" + CONFIGURATION_PROPERTY + "\",",
                "+            path_to_string(jdtls_configuration_path)?",
                "+        ),");
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
}
