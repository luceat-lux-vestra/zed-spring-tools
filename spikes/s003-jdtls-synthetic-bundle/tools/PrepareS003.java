import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.jar.Attributes;
import java.util.jar.JarFile;
import java.util.jar.Manifest;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

/**
 * Verifies and prepares the fixed external inputs and synthetic bundle for S003.
 *
 * <p>This is disposable spike infrastructure. It downloads nothing, invokes no
 * platform shell, and refuses mutable or unverified inputs.
 */
public final class PrepareS003 {
    private static final long JDTLS_SIZE = 50_925_681L;
    private static final String JDTLS_SHA256 =
            "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d";
    private static final long PROXY_SIZE = 350_984L;
    private static final String PROXY_SHA256 =
            "3b128f058eed29e7b7a30c7aaccd430e2964917e45f62e5052d8df676dccb5e5";
    private static final long DEBUG_SIZE = 3_107_682L;
    private static final String DEBUG_SHA256 =
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c";

    private static final String JDTLS_LAUNCHER = "jdtls/bin/jdtls";
    private static final String JDTLS_WINDOWS_LAUNCHER = "jdtls/bin/jdtls.bat";
    private static final String PROXY_EXECUTABLE = "proxy/java-lsp-proxy";
    private static final String DEBUG_BUNDLE =
            "debug/com.microsoft.java.debug.plugin-0.53.2.jar";
    private static final String SYNTHETIC_BUNDLE = "s003-synthetic-bundle.jar";
    private static final String HANDLER_SOURCE =
            "src/dev/zed/spring/s003/SyntheticCommandHandler.java";
    private static final String HANDLER_CLASS =
            "dev/zed/spring/s003/SyntheticCommandHandler.class";
    private static final String BUNDLE_SYMBOLIC_NAME = "dev.zed.spring.s003.synthetic";
    private static final String BUNDLE_VERSION = "0.0.1";
    private static final String DEBUG_SYMBOLIC_NAME = "com.microsoft.java.debug.plugin";
    private static final String DEBUG_VERSION = "0.53.2";
    private static final String COMMAND_ID = "s003.synthetic.ping";

    private static final int TAR_BLOCK_SIZE = 512;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int MAX_ARCHIVE_ENTRIES = 50_000;
    private static final long MAX_ENTRY_BYTES = 536_870_912L;
    private static final long MAX_EXTRACTED_BYTES = 1_073_741_824L;

    private static final ExpectedInputs OFFICIAL_INPUTS = new ExpectedInputs(
            new ExpectedArtifact(JDTLS_SIZE, JDTLS_SHA256),
            new ExpectedArtifact(PROXY_SIZE, PROXY_SHA256),
            new ExpectedArtifact(DEBUG_SIZE, DEBUG_SHA256));

    private PrepareS003() {
    }

    public static void main(String[] args) {
        try {
            if (args.length == 2 && args[0].equals("--self-test")) {
                selfTest(Path.of(args[1]));
                System.out.println("PrepareS003 self-test passed");
                return;
            }
            if (args.length != 5) {
                printUsage();
                System.exit(2);
            }

            PreparedS003 prepared = prepare(
                    Path.of(args[0]),
                    Path.of(args[1]),
                    Path.of(args[2]),
                    Path.of(args[3]),
                    Path.of(args[4]),
                    OFFICIAL_INPUTS);
            System.out.println("jdtls-size=" + prepared.jdtls().size());
            System.out.println("jdtls-sha256=" + prepared.jdtls().sha256());
            System.out.println("proxy-size=" + prepared.proxy().size());
            System.out.println("proxy-sha256=" + prepared.proxy().sha256());
            System.out.println("debug-size=" + prepared.debug().size());
            System.out.println("debug-sha256=" + prepared.debug().sha256());
            System.out.println("jdtls-entries=" + prepared.jdtlsEntries());
            System.out.println("proxy-entries=" + prepared.proxyEntries());
            System.out.println("synthetic-sha256=" + prepared.syntheticSha256());
            System.out.println("jdtls-launcher=" + JDTLS_LAUNCHER);
            System.out.println("proxy-executable=" + PROXY_EXECUTABLE);
            System.out.println("debug-bundle=" + DEBUG_BUNDLE);
            System.out.println("synthetic-bundle=" + SYNTHETIC_BUNDLE);
        } catch (Exception error) {
            System.err.println("S003 preparation failed: " + error.getMessage());
            System.exit(1);
        }
    }

    private static void printUsage() {
        System.err.println(
                "usage: java PrepareS003.java <jdtls.tar.gz> <proxy.tar.gz> "
                        + "<debug.jar> <bundle-source-dir> <fresh-destination>");
        System.err.println(
                "       java PrepareS003.java --self-test <bundle-source-dir>");
    }

    private static PreparedS003 prepare(
            Path jdtlsArchive,
            Path proxyArchive,
            Path debugArchive,
            Path bundleSource,
            Path destination,
            ExpectedInputs expected) throws IOException {
        Path normalizedJdtls = requireRegularFile(jdtlsArchive, "JDT LS archive");
        Path normalizedProxy = requireRegularFile(proxyArchive, "Java proxy archive");
        Path normalizedDebug = requireRegularFile(debugArchive, "Java debug bundle");
        Path normalizedBundleSource = bundleSource.toAbsolutePath().normalize();
        Path normalizedDestination = destination.toAbsolutePath().normalize();
        if (!Files.isDirectory(normalizedBundleSource)) {
            throw new IOException("bundle source is not a directory");
        }
        if (Files.exists(normalizedDestination)) {
            throw new IOException("destination must not already exist");
        }

        VerifiedArtifact jdtls = verifyArtifact(normalizedJdtls, expected.jdtls());
        VerifiedArtifact proxy = verifyArtifact(normalizedProxy, expected.proxy());
        VerifiedArtifact debug = verifyArtifact(normalizedDebug, expected.debug());
        validateBundleSources(normalizedBundleSource);
        validateJar(normalizedDebug, DEBUG_SYMBOLIC_NAME, DEBUG_VERSION, false);

        Path parent = normalizedDestination.getParent();
        if (parent == null) {
            throw new IOException("destination has no parent");
        }
        Files.createDirectories(parent);
        Path staging = parent.resolve(
                normalizedDestination.getFileName() + ".partial-" + UUID.randomUUID()).normalize();
        boolean created = false;
        boolean moved = false;
        try {
            Files.createDirectory(staging);
            created = true;
            TarStats jdtlsStats = extractTarGzip(normalizedJdtls, staging.resolve("jdtls"));
            TarStats proxyStats = extractTarGzip(normalizedProxy, staging.resolve("proxy"));
            List<Path> pluginJars = validateJdtlsLayout(staging);
            validateProxyLayout(staging);

            Path debugTarget = staging.resolve(DEBUG_BUNDLE);
            Files.createDirectories(debugTarget.getParent());
            Files.copy(normalizedDebug, debugTarget);
            Path syntheticTarget = staging.resolve(SYNTHETIC_BUNDLE);
            buildSyntheticBundle(normalizedBundleSource, pluginJars, staging, syntheticTarget);
            validateJar(syntheticTarget, BUNDLE_SYMBOLIC_NAME, BUNDLE_VERSION, true);

            makeExecutable(staging.resolve(JDTLS_LAUNCHER));
            makeExecutable(staging.resolve(PROXY_EXECUTABLE));
            moveFresh(staging, normalizedDestination);
            moved = true;
            return new PreparedS003(
                    jdtls,
                    proxy,
                    debug,
                    jdtlsStats.entryCount(),
                    proxyStats.entryCount(),
                    sha256(normalizedDestination.resolve(SYNTHETIC_BUNDLE)));
        } finally {
            if (created && !moved) {
                deleteRecursively(staging);
            }
        }
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path normalized = path.toAbsolutePath().normalize();
        if (!Files.isRegularFile(normalized)) {
            throw new IOException(label + " is not a regular file");
        }
        return normalized;
    }

    private static VerifiedArtifact verifyArtifact(Path path, ExpectedArtifact expected)
            throws IOException {
        long size = Files.size(path);
        if (size != expected.size()) {
            throw new IOException(
                    "unexpected artifact size: expected " + expected.size() + ", got " + size);
        }
        String digest = sha256(path);
        if (!digest.equals(expected.sha256())) {
            throw new IOException(
                    "unexpected SHA-256: expected " + expected.sha256() + ", got " + digest);
        }
        return new VerifiedArtifact(size, digest);
    }

    private static TarStats extractTarGzip(Path archive, Path destination) throws IOException {
        Files.createDirectory(destination);
        Set<String> seen = new HashSet<>();
        int entries = 0;
        long extractedBytes = 0;

        try (InputStream raw = new BufferedInputStream(Files.newInputStream(archive));
                InputStream gzip = new GZIPInputStream(raw, BUFFER_SIZE)) {
            while (true) {
                byte[] header = readBlock(gzip);
                if (header == null) {
                    throw new IOException("tar archive ended without zero blocks");
                }
                if (isZeroBlock(header)) {
                    byte[] second = readBlock(gzip);
                    if (second == null || !isZeroBlock(second)) {
                        throw new IOException("tar archive has an incomplete end marker");
                    }
                    break;
                }

                validateTarChecksum(header);
                String magic = tarString(header, 257, 6);
                if (!magic.startsWith("ustar")) {
                    throw new IOException("unsupported tar header format");
                }
                entries++;
                if (entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("tar archive contains too many entries");
                }

                String name = tarName(header);
                long size = parseTarOctal(header, 124, 12, "size");
                if (size > MAX_ENTRY_BYTES) {
                    throw new IOException("tar entry exceeds the per-entry safety limit");
                }
                byte type = header[156];
                if (!tarString(header, 157, 100).isEmpty()) {
                    throw new IOException("tar links are unsupported");
                }
                Path relative = safeRelativePath(name, "tar");
                String collisionKey = relative.toString()
                        .replace('\\', '/')
                        .toLowerCase(Locale.ROOT);
                if (!seen.add(collisionKey)) {
                    throw new IOException("duplicate or case-colliding tar entry: " + name);
                }
                Path target = destination.resolve(relative).normalize();
                if (!target.startsWith(destination)) {
                    throw new IOException("tar entry escapes destination: " + name);
                }

                if (type == '5') {
                    if (size != 0) {
                        throw new IOException("tar directory contains data: " + name);
                    }
                    Files.createDirectories(target);
                } else if (type == 0 || type == '0') {
                    Path targetParent = target.getParent();
                    if (targetParent == null) {
                        throw new IOException("tar entry has no destination parent");
                    }
                    Files.createDirectories(targetParent);
                    if (Files.exists(target)) {
                        throw new IOException("tar entry collides with an existing path: " + name);
                    }
                    try (OutputStream output = new BufferedOutputStream(
                            Files.newOutputStream(target))) {
                        copyExactly(gzip, output, size);
                    }
                    extractedBytes += size;
                    if (extractedBytes > MAX_EXTRACTED_BYTES) {
                        throw new IOException("tar archive expands beyond the safety limit");
                    }
                } else {
                    throw new IOException(
                            "unsupported tar entry type " + printableType(type) + ": " + name);
                }

                long padding = (TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
                skipExactly(gzip, padding);
            }
        }
        return new TarStats(entries, extractedBytes);
    }

    private static byte[] readBlock(InputStream input) throws IOException {
        byte[] block = new byte[TAR_BLOCK_SIZE];
        int offset = 0;
        while (offset < block.length) {
            int read = input.read(block, offset, block.length - offset);
            if (read == -1) {
                if (offset == 0) {
                    return null;
                }
                throw new IOException("truncated tar block");
            }
            offset += read;
        }
        return block;
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
        long stored = parseTarOctal(header, 148, 8, "checksum");
        long calculated = 0;
        for (int index = 0; index < header.length; index++) {
            calculated += index >= 148 && index < 156 ? 32 : Byte.toUnsignedInt(header[index]);
        }
        if (stored != calculated) {
            throw new IOException("tar header checksum mismatch");
        }
    }

    private static String tarName(byte[] header) throws IOException {
        String name = tarString(header, 0, 100);
        String prefix = tarString(header, 345, 155);
        if (!prefix.isEmpty()) {
            name = prefix + "/" + name;
        }
        if (name.isBlank()) {
            throw new IOException("tar entry has an empty name");
        }
        return name;
    }

    private static String tarString(byte[] bytes, int offset, int length) throws IOException {
        int end = offset;
        int limit = offset + length;
        while (end < limit && bytes[end] != 0) {
            end++;
        }
        String value = new String(bytes, offset, end - offset, StandardCharsets.UTF_8);
        if (value.indexOf('\0') >= 0) {
            throw new IOException("tar field contains an embedded NUL");
        }
        return value;
    }

    private static long parseTarOctal(byte[] bytes, int offset, int length, String field)
            throws IOException {
        if ((bytes[offset] & 0x80) != 0) {
            throw new IOException("base-256 tar " + field + " is unsupported");
        }
        String value = tarString(bytes, offset, length).trim();
        if (value.isEmpty()) {
            return 0;
        }
        try {
            return Long.parseLong(value, 8);
        } catch (NumberFormatException error) {
            throw new IOException("invalid tar " + field, error);
        }
    }

    private static Path safeRelativePath(String name, String archiveType) throws IOException {
        if (name.indexOf('\0') >= 0
                || name.indexOf('\\') >= 0
                || name.startsWith("/")
                || name.startsWith("~")
                || name.matches("^[A-Za-z]:.*")) {
            throw new IOException(archiveType + " entry has an unsafe or non-portable name");
        }
        Path relative = Path.of(name).normalize();
        if (relative.isAbsolute()
                || relative.getNameCount() == 0
                || relative.startsWith("..")) {
            throw new IOException("unsafe " + archiveType + " entry: " + name);
        }
        return relative;
    }

    private static void copyExactly(InputStream input, OutputStream output, long bytes)
            throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        long remaining = bytes;
        while (remaining > 0) {
            int read = input.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read == -1) {
                throw new IOException("truncated tar entry data");
            }
            output.write(buffer, 0, read);
            remaining -= read;
        }
    }

    private static void skipExactly(InputStream input, long bytes) throws IOException {
        long remaining = bytes;
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

    private static String printableType(byte type) {
        return type == 0 ? "NUL" : "'" + (char) type + "'";
    }

    private static List<Path> validateJdtlsLayout(Path staging) throws IOException {
        Path launcher = staging.resolve(JDTLS_LAUNCHER);
        Path windowsLauncher = staging.resolve(JDTLS_WINDOWS_LAUNCHER);
        Path plugins = staging.resolve("jdtls/plugins");
        if (!Files.isRegularFile(launcher)
                || !Files.isRegularFile(windowsLauncher)
                || !Files.isDirectory(plugins)) {
            throw new IOException("JDT LS archive has an unexpected launcher or plugin layout");
        }

        List<Path> pluginJars;
        try (Stream<Path> paths = Files.list(plugins)) {
            pluginJars = paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".jar"))
                    .sorted()
                    .collect(Collectors.toList());
        }
        requireExactlyOnePrefix(pluginJars, "org.eclipse.jdt.ls.core_");
        requireExactlyOnePrefix(pluginJars, "org.eclipse.equinox.common_");
        return pluginJars;
    }

    private static Path requireExactlyOnePrefix(List<Path> paths, String prefix)
            throws IOException {
        List<Path> matches = paths.stream()
                .filter(path -> path.getFileName().toString().startsWith(prefix))
                .collect(Collectors.toList());
        if (matches.size() != 1) {
            throw new IOException("expected exactly one JDT plugin with prefix " + prefix);
        }
        return matches.getFirst();
    }

    private static void validateProxyLayout(Path staging) throws IOException {
        Path proxyRoot = staging.resolve("proxy");
        Path executable = staging.resolve(PROXY_EXECUTABLE);
        if (!Files.isRegularFile(executable)) {
            throw new IOException("Java proxy archive has an unexpected layout");
        }
        try (Stream<Path> paths = Files.walk(proxyRoot)) {
            long regularFiles = paths.filter(Files::isRegularFile).count();
            if (regularFiles != 1) {
                throw new IOException("Java proxy archive must contain exactly one file");
            }
        }
    }

    private static void validateBundleSources(Path sourceRoot) throws IOException {
        Path manifestPath = sourceRoot.resolve("META-INF/MANIFEST.MF");
        Path pluginPath = sourceRoot.resolve("plugin.xml");
        Path handlerPath = sourceRoot.resolve(HANDLER_SOURCE);
        if (!Files.isRegularFile(manifestPath)
                || !Files.isRegularFile(pluginPath)
                || !Files.isRegularFile(handlerPath)) {
            throw new IOException("synthetic bundle source layout is incomplete");
        }
        try (InputStream input = Files.newInputStream(manifestPath)) {
            Manifest manifest = new Manifest(input);
            requireManifestIdentity(manifest, BUNDLE_SYMBOLIC_NAME, BUNDLE_VERSION);
        }
        String plugin = Files.readString(pluginPath, StandardCharsets.UTF_8);
        if (plugin.contains("<!DOCTYPE")
                || !plugin.contains("org.eclipse.jdt.ls.core.delegateCommandHandler")
                || !plugin.contains("dev.zed.spring.s003.SyntheticCommandHandler")
                || !plugin.contains("id=\"" + COMMAND_ID + "\"")
                || !plugin.contains("static=\"true\"")) {
            throw new IOException("synthetic plugin.xml does not declare the fixed static command");
        }
    }

    private static void buildSyntheticBundle(
            Path sourceRoot,
            List<Path> pluginJars,
            Path staging,
            Path destination) throws IOException {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IOException("a JDK compiler is required to build the synthetic bundle");
        }
        Path classes = staging.resolve("synthetic-classes");
        Files.createDirectory(classes);
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        Path handlerSource = sourceRoot.resolve(HANDLER_SOURCE);
        String classpath = pluginJars.stream()
                .map(Path::toString)
                .collect(Collectors.joining(File.pathSeparator));

        try (StandardJavaFileManager fileManager =
                compiler.getStandardFileManager(diagnostics, Locale.ROOT, StandardCharsets.UTF_8)) {
            Iterable<? extends JavaFileObject> units =
                    fileManager.getJavaFileObjects(handlerSource.toFile());
            List<String> options = List.of(
                    "--release", "21",
                    "-Xlint:all",
                    "-Werror",
                    "-classpath", classpath,
                    "-d", classes.toString());
            boolean success = Boolean.TRUE.equals(
                    compiler.getTask(null, fileManager, diagnostics, options, null, units).call());
            if (!success) {
                String summary = diagnostics.getDiagnostics().stream()
                        .limit(3)
                        .map(PrepareS003::formatDiagnostic)
                        .collect(Collectors.joining("; "));
                throw new IOException("synthetic handler compilation failed: " + summary);
            }
        }

        Path handlerClass = classes.resolve(HANDLER_CLASS);
        if (!Files.isRegularFile(handlerClass)) {
            throw new IOException("compiler did not produce the expected synthetic handler class");
        }
        byte[] manifest = normalizeManifest(
                Files.readString(sourceRoot.resolve("META-INF/MANIFEST.MF"), StandardCharsets.UTF_8));
        byte[] plugin = normalizeText(
                Files.readString(sourceRoot.resolve("plugin.xml"), StandardCharsets.UTF_8));
        try (ZipOutputStream jar = new ZipOutputStream(
                new BufferedOutputStream(Files.newOutputStream(destination)))) {
            writeZipEntry(jar, "META-INF/MANIFEST.MF", manifest);
            writeZipEntry(jar, "plugin.xml", plugin);
            writeZipEntry(jar, HANDLER_CLASS, Files.readAllBytes(handlerClass));
        }
        deleteRecursively(classes);
    }

    private static String formatDiagnostic(Diagnostic<? extends JavaFileObject> diagnostic) {
        return diagnostic.getKind() + " line " + diagnostic.getLineNumber() + ": "
                + diagnostic.getMessage(Locale.ROOT);
    }

    private static byte[] normalizeManifest(String value) {
        String normalized = value.replace("\r\n", "\n").replace('\r', '\n');
        normalized = normalized.stripTrailing() + "\n\n";
        return normalized.replace("\n", "\r\n").getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] normalizeText(String value) {
        String normalized = value.replace("\r\n", "\n").replace('\r', '\n');
        return (normalized.stripTrailing() + "\n").getBytes(StandardCharsets.UTF_8);
    }

    private static void writeZipEntry(ZipOutputStream zip, String name, byte[] data)
            throws IOException {
        ZipEntry entry = new ZipEntry(name);
        entry.setTime(0L);
        zip.putNextEntry(entry);
        zip.write(data);
        zip.closeEntry();
    }

    private static void validateJar(
            Path jarPath,
            String expectedSymbolicName,
            String expectedVersion,
            boolean requireSyntheticEntries) throws IOException {
        validateZipEntryNames(jarPath);
        try (JarFile jar = new JarFile(jarPath.toFile())) {
            Manifest manifest = jar.getManifest();
            if (manifest == null) {
                throw new IOException("JAR manifest is missing");
            }
            requireManifestIdentity(manifest, expectedSymbolicName, expectedVersion);
            if (requireSyntheticEntries) {
                if (jar.getJarEntry("plugin.xml") == null || jar.getJarEntry(HANDLER_CLASS) == null) {
                    throw new IOException("synthetic bundle entries are missing");
                }
                String plugin;
                try (InputStream input = jar.getInputStream(jar.getJarEntry("plugin.xml"))) {
                    plugin = new String(input.readAllBytes(), StandardCharsets.UTF_8);
                }
                if (!plugin.contains(COMMAND_ID)) {
                    throw new IOException("synthetic bundle command declaration is missing");
                }
            }
        }
    }

    private static void requireManifestIdentity(
            Manifest manifest,
            String expectedSymbolicName,
            String expectedVersion) throws IOException {
        Attributes attributes = manifest.getMainAttributes();
        String symbolicName = attributes.getValue("Bundle-SymbolicName");
        String version = attributes.getValue("Bundle-Version");
        if (symbolicName == null
                || !symbolicName.split(";", 2)[0].equals(expectedSymbolicName)
                || !expectedVersion.equals(version)) {
            throw new IOException("unexpected OSGi bundle identity");
        }
    }

    private static void validateZipEntryNames(Path archive) throws IOException {
        Set<String> seen = new HashSet<>();
        int entries = 0;
        try (ZipInputStream zip = new ZipInputStream(
                new BufferedInputStream(Files.newInputStream(archive)))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; zip.closeEntry()) {
                entries++;
                if (entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("ZIP contains too many entries");
                }
                Path relative = safeRelativePath(entry.getName(), "ZIP");
                String collisionKey = relative.toString()
                        .replace('\\', '/')
                        .toLowerCase(Locale.ROOT);
                if (!seen.add(collisionKey)) {
                    throw new IOException("duplicate or case-colliding ZIP entry");
                }
            }
        }
    }

    private static void makeExecutable(Path path) throws IOException {
        if (!Files.isRegularFile(path)) {
            throw new IOException("expected executable is missing");
        }
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

    private static void selfTest(Path bundleSource) throws Exception {
        Path source = bundleSource.toAbsolutePath().normalize();
        validateBundleSources(source);
        Path root = Files.createTempDirectory("s003-prepare-");
        try {
            StubPlugins stubs = createStubPlugins(root);
            Path goodJdtls = root.resolve("jdtls.tar.gz");
            writeTarGzip(goodJdtls, List.of(
                    TarTestEntry.file("bin/jdtls", "launcher\n".getBytes(StandardCharsets.UTF_8)),
                    TarTestEntry.file("bin/jdtls.bat", "@echo off\r\n".getBytes(StandardCharsets.UTF_8)),
                    TarTestEntry.file(
                            "plugins/org.eclipse.jdt.ls.core_test.jar",
                            Files.readAllBytes(stubs.jdtCore())),
                    TarTestEntry.file(
                            "plugins/org.eclipse.equinox.common_test.jar",
                            Files.readAllBytes(stubs.equinoxCommon()))));
            Path goodProxy = root.resolve("proxy.tar.gz");
            writeTarGzip(goodProxy, List.of(
                    TarTestEntry.file("java-lsp-proxy", new byte[] {1, 2, 3})));
            Path goodDebug = root.resolve("debug.jar");
            writeManifestJar(goodDebug, DEBUG_SYMBOLIC_NAME, DEBUG_VERSION, List.of());
            ExpectedInputs goodExpected = expectedFor(goodJdtls, goodProxy, goodDebug);

            Path goodOutput = root.resolve("good-output");
            PreparedS003 prepared = prepare(
                    goodJdtls, goodProxy, goodDebug, source, goodOutput, goodExpected);
            require(Files.isRegularFile(goodOutput.resolve(SYNTHETIC_BUNDLE)),
                    "synthetic bundle was not created");
            require(prepared.jdtlsEntries() == 4, "unexpected synthetic JDT entry count");
            PreparedS003 repeated = prepare(
                    goodJdtls,
                    goodProxy,
                    goodDebug,
                    source,
                    root.resolve("repeated-output"),
                    goodExpected);
            require(
                    prepared.syntheticSha256().equals(repeated.syntheticSha256()),
                    "synthetic bundle output was not deterministic");

            expectPrepareFailure(
                    "size mismatch",
                    root.resolve("wrong-size-output"),
                    () -> prepare(
                            goodJdtls,
                            goodProxy,
                            goodDebug,
                            source,
                            root.resolve("wrong-size-output"),
                            new ExpectedInputs(
                                    new ExpectedArtifact(Files.size(goodJdtls) + 1, sha256(goodJdtls)),
                                    goodExpected.proxy(),
                                    goodExpected.debug())));
            expectPrepareFailure(
                    "digest mismatch",
                    root.resolve("wrong-digest-output"),
                    () -> prepare(
                            goodJdtls,
                            goodProxy,
                            goodDebug,
                            source,
                            root.resolve("wrong-digest-output"),
                            new ExpectedInputs(
                                    new ExpectedArtifact(Files.size(goodJdtls), "0".repeat(64)),
                                    goodExpected.proxy(),
                                    goodExpected.debug())));

            Path traversal = root.resolve("traversal.tar.gz");
            writeTarGzip(traversal, List.of(
                    TarTestEntry.file("../escape", new byte[] {9}),
                    TarTestEntry.file("bin/jdtls", new byte[] {1})));
            expectPrepareFailure(
                    "tar traversal",
                    root.resolve("traversal-output"),
                    () -> prepare(
                            traversal,
                            goodProxy,
                            goodDebug,
                            source,
                            root.resolve("traversal-output"),
                            expectedFor(traversal, goodProxy, goodDebug)));
            require(!Files.exists(root.resolve("escape")), "tar traversal escaped destination");

            Path link = root.resolve("link.tar.gz");
            writeTarGzip(link, List.of(new TarTestEntry("bin/jdtls", new byte[0], (byte) '2')));
            expectPrepareFailure(
                    "tar link",
                    root.resolve("link-output"),
                    () -> prepare(
                            link,
                            goodProxy,
                            goodDebug,
                            source,
                            root.resolve("link-output"),
                            expectedFor(link, goodProxy, goodDebug)));

            Path duplicate = root.resolve("duplicate.tar.gz");
            writeTarGzip(duplicate, List.of(
                    TarTestEntry.file("bin/jdtls", new byte[] {1}),
                    TarTestEntry.file("bin/jdtls", new byte[] {2})));
            expectPrepareFailure(
                    "duplicate tar entry",
                    root.resolve("duplicate-output"),
                    () -> prepare(
                            duplicate,
                            goodProxy,
                            goodDebug,
                            source,
                            root.resolve("duplicate-output"),
                            expectedFor(duplicate, goodProxy, goodDebug)));

            Path missingPlugin = root.resolve("missing-plugin.tar.gz");
            writeTarGzip(missingPlugin, List.of(
                    TarTestEntry.file("bin/jdtls", new byte[] {1}),
                    TarTestEntry.file("bin/jdtls.bat", new byte[] {2}),
                    TarTestEntry.file(
                            "plugins/org.eclipse.equinox.common_test.jar",
                            Files.readAllBytes(stubs.equinoxCommon()))));
            expectPrepareFailure(
                    "missing JDT plugin",
                    root.resolve("missing-plugin-output"),
                    () -> prepare(
                            missingPlugin,
                            goodProxy,
                            goodDebug,
                            source,
                            root.resolve("missing-plugin-output"),
                            expectedFor(missingPlugin, goodProxy, goodDebug)));

            Path unsafeDebug = root.resolve("unsafe-debug.jar");
            writeManifestJar(
                    unsafeDebug,
                    DEBUG_SYMBOLIC_NAME,
                    DEBUG_VERSION,
                    List.of(new ZipTestEntry("../escape", new byte[] {1})));
            expectPrepareFailure(
                    "ZIP traversal",
                    root.resolve("unsafe-debug-output"),
                    () -> prepare(
                            goodJdtls,
                            goodProxy,
                            unsafeDebug,
                            source,
                            root.resolve("unsafe-debug-output"),
                            expectedFor(goodJdtls, goodProxy, unsafeDebug)));

            Path invalidMetadata = root.resolve("invalid-metadata-source");
            copyTree(source, invalidMetadata);
            Files.writeString(
                    invalidMetadata.resolve("plugin.xml"),
                    "<plugin/>",
                    StandardCharsets.UTF_8);
            expectPrepareFailure(
                    "invalid bundle metadata",
                    root.resolve("invalid-metadata-output"),
                    () -> prepare(
                            goodJdtls,
                            goodProxy,
                            goodDebug,
                            invalidMetadata,
                            root.resolve("invalid-metadata-output"),
                            goodExpected));

            Path invalidSource = root.resolve("invalid-java-source");
            copyTree(source, invalidSource);
            Files.writeString(
                    invalidSource.resolve(HANDLER_SOURCE),
                    "this is not Java",
                    StandardCharsets.UTF_8);
            expectPrepareFailure(
                    "handler compilation failure",
                    root.resolve("invalid-java-output"),
                    () -> prepare(
                            goodJdtls,
                            goodProxy,
                            goodDebug,
                            invalidSource,
                            root.resolve("invalid-java-output"),
                            goodExpected));

            Path existing = root.resolve("existing-output");
            Files.createDirectory(existing);
            expectFailure("existing destination", () -> prepare(
                    goodJdtls, goodProxy, goodDebug, source, existing, goodExpected));
        } finally {
            deleteRecursively(root);
        }
    }

    private static StubPlugins createStubPlugins(Path root) throws IOException {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IOException("self-test requires a JDK compiler");
        }
        Path sources = root.resolve("stub-sources");
        Path classes = root.resolve("stub-classes");
        Path monitor = sources.resolve("org/eclipse/core/runtime/IProgressMonitor.java");
        Path handler = sources.resolve(
                "org/eclipse/jdt/ls/core/internal/IDelegateCommandHandler.java");
        Files.createDirectories(monitor.getParent());
        Files.createDirectories(handler.getParent());
        Files.createDirectory(classes);
        Files.writeString(
                monitor,
                "package org.eclipse.core.runtime; public interface IProgressMonitor {}\n",
                StandardCharsets.UTF_8);
        Files.writeString(
                handler,
                "package org.eclipse.jdt.ls.core.internal;"
                        + " import java.util.List;"
                        + " import org.eclipse.core.runtime.IProgressMonitor;"
                        + " public interface IDelegateCommandHandler {"
                        + " Object executeCommand(String id, List<Object> args,"
                        + " IProgressMonitor monitor) throws Exception; }\n",
                StandardCharsets.UTF_8);
        try (StandardJavaFileManager manager =
                compiler.getStandardFileManager(null, Locale.ROOT, StandardCharsets.UTF_8)) {
            Iterable<? extends JavaFileObject> units = manager.getJavaFileObjects(
                    monitor.toFile(), handler.toFile());
            boolean success = Boolean.TRUE.equals(compiler.getTask(
                    null,
                    manager,
                    null,
                    List.of("--release", "21", "-d", classes.toString()),
                    null,
                    units).call());
            if (!success) {
                throw new IOException("failed to compile self-test JDT stubs");
            }
        }
        Path coreJar = root.resolve("org.eclipse.jdt.ls.core_test.jar");
        Path commonJar = root.resolve("org.eclipse.equinox.common_test.jar");
        writeClassJar(
                coreJar,
                classes,
                "org/eclipse/jdt/ls/core/internal/IDelegateCommandHandler.class");
        writeClassJar(
                commonJar,
                classes,
                "org/eclipse/core/runtime/IProgressMonitor.class");
        return new StubPlugins(coreJar, commonJar);
    }

    private static void writeClassJar(Path jarPath, Path classes, String className)
            throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(
                new BufferedOutputStream(Files.newOutputStream(jarPath)))) {
            writeZipEntry(zip, className, Files.readAllBytes(classes.resolve(className)));
        }
    }

    private static ExpectedInputs expectedFor(Path jdtls, Path proxy, Path debug)
            throws IOException {
        return new ExpectedInputs(
                new ExpectedArtifact(Files.size(jdtls), sha256(jdtls)),
                new ExpectedArtifact(Files.size(proxy), sha256(proxy)),
                new ExpectedArtifact(Files.size(debug), sha256(debug)));
    }

    private static void writeManifestJar(
            Path destination,
            String symbolicName,
            String version,
            List<ZipTestEntry> extraEntries) throws IOException {
        String manifest = "Manifest-Version: 1.0\r\n"
                + "Bundle-ManifestVersion: 2\r\n"
                + "Bundle-SymbolicName: " + symbolicName + ";singleton:=true\r\n"
                + "Bundle-Version: " + version + "\r\n\r\n";
        try (ZipOutputStream zip = new ZipOutputStream(
                new BufferedOutputStream(Files.newOutputStream(destination)))) {
            writeZipEntry(
                    zip,
                    "META-INF/MANIFEST.MF",
                    manifest.getBytes(StandardCharsets.UTF_8));
            for (ZipTestEntry entry : extraEntries) {
                writeZipEntry(zip, entry.name(), entry.data());
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
                header[156] = entry.type();
                writeTarString(header, 257, 6, "ustar");
                writeTarString(header, 263, 2, "00");
                long checksum = 0;
                for (byte value : header) {
                    checksum += Byte.toUnsignedInt(value);
                }
                String checksumText = String.format(Locale.ROOT, "%06o", checksum);
                writeTarString(header, 148, 6, checksumText);
                header[154] = 0;
                header[155] = (byte) ' ';
                gzip.write(header);
                gzip.write(entry.data());
                int padding = (TAR_BLOCK_SIZE - (entry.data().length % TAR_BLOCK_SIZE))
                        % TAR_BLOCK_SIZE;
                gzip.write(new byte[padding]);
            }
            gzip.write(new byte[TAR_BLOCK_SIZE * 2]);
        }
    }

    private static void writeTarString(
            byte[] header,
            int offset,
            int length,
            String value) throws IOException {
        byte[] encoded = value.getBytes(StandardCharsets.UTF_8);
        if (encoded.length > length) {
            throw new IOException("self-test tar field is too long");
        }
        System.arraycopy(encoded, 0, header, offset, encoded.length);
    }

    private static void writeTarOctal(
            byte[] header,
            int offset,
            int length,
            long value) throws IOException {
        String text = Long.toOctalString(value);
        if (text.length() > length - 1) {
            throw new IOException("self-test tar number is too large");
        }
        Arrays.fill(header, offset, offset + length, (byte) '0');
        byte[] encoded = text.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(encoded, 0, header, offset + length - 1 - encoded.length, encoded.length);
        header[offset + length - 1] = 0;
    }

    private static void copyTree(Path source, Path destination) throws IOException {
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : paths.sorted().toList()) {
                Path target = destination.resolve(source.relativize(path));
                if (Files.isDirectory(path)) {
                    Files.createDirectories(target);
                } else {
                    Files.copy(path, target);
                }
            }
        }
    }

    private static void expectPrepareFailure(
            String label,
            Path destination,
            ThrowingRunnable action) throws Exception {
        expectFailure(label, action);
        require(!Files.exists(destination), label + " left a destination behind");
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

    private record ExpectedArtifact(long size, String sha256) {
    }

    private record ExpectedInputs(
            ExpectedArtifact jdtls,
            ExpectedArtifact proxy,
            ExpectedArtifact debug) {
    }

    private record VerifiedArtifact(long size, String sha256) {
    }

    private record TarStats(int entryCount, long extractedBytes) {
    }

    private record PreparedS003(
            VerifiedArtifact jdtls,
            VerifiedArtifact proxy,
            VerifiedArtifact debug,
            int jdtlsEntries,
            int proxyEntries,
            String syntheticSha256) {
    }

    private record StubPlugins(Path jdtCore, Path equinoxCommon) {
    }

    private record TarTestEntry(String name, byte[] data, byte type) {
        private static TarTestEntry file(String name, byte[] data) {
            return new TarTestEntry(name, data.clone(), (byte) '0');
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
