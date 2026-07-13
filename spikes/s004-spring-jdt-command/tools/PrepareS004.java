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
import java.util.function.Consumer;
import java.util.jar.Attributes;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.jar.JarOutputStream;
import java.util.jar.Manifest;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public final class PrepareS004 {
    private static final int TAR_BLOCK_SIZE = 512;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final int MAX_ARCHIVE_ENTRIES = 50_000;
    private static final int MAX_PAX_HEADER_BYTES = 16 * 1024;
    private static final long MAX_ENTRY_BYTES = 536_870_912L;
    private static final long MAX_EXTRACTED_BYTES = 1_073_741_824L;
    private static final Set<String> ALLOWED_LOCAL_PAX_KEYS = Set.of("uid", "gid", "mtime");

    private static final String PACKAGE_ENTRY = "extension/package.json";
    private static final String BUNDLE_PREFIX = "extension/jars/";
    private static final String BUNDLE_OUTPUT = ".s004-artifacts/bundles";
    private static final String PROBE_OUTPUT = ".s004-artifacts/probe/lifecycle_probe.js";
    private static final String FIXTURE_JAVA =
            "fixture/src/main/java/dev/zed/spring/s004/S004OnlyProbe9F2C.java";
    private static final String FIXTURE_POM = "fixture/pom.xml";
    private static final String PROBE_SOURCE = "extension/probe/lifecycle_probe.js";
    private static final String RUNTIME_BASENAME = "s004-runtime-worktree-9f2c";

    private static final ArtifactSpec JDTLS = new ArtifactSpec(
            50_925_681L,
            "e94c303d8198f977930803582738771fd18c52c5492878410bf222b1aa81ef1d");
    private static final ArtifactSpec VSIX = new ArtifactSpec(
            82_759_143L,
            "70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3");
    private static final ArtifactSpec PROXY = new ArtifactSpec(
            834_304L,
            "53ed618c7044a6bf754117bd6573bc03c00f74728bbefcc8b295ed9e83c40076");
    private static final ArtifactSpec DEBUG = new ArtifactSpec(
            3_107_682L,
            "5275195905015ce786fc6318c8d039fef43a1fada1d03acdec24c69a3b9ba83c");
    private static final PackageSpec PACKAGE = new PackageSpec(
            53_677L,
            "14b6d18166f908925f42bea96afafe298e03a5638f164c4ba80483f7ab57aaa4");

    private static final List<BundleSpec> SPRING_BUNDLES = List.of(
            new BundleSpec(
                    "io.projectreactor.reactor-core.jar",
                    "io.projectreactor.reactor-core",
                    "3.3.1.202211021051-RELEASE",
                    "1.8",
                    1_627_393L,
                    "76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590",
                    null,
                    false),
            new BundleSpec(
                    "org.reactivestreams.reactive-streams.jar",
                    "org.reactivestreams.reactive-streams",
                    "1.0.3",
                    "1.6",
                    21_386L,
                    "71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038",
                    null,
                    false),
            new BundleSpec(
                    "jdt-ls-commons.jar",
                    "org.springframework.tooling.jdt.ls.commons",
                    "5.2.0.202606051943",
                    "21",
                    140_287L,
                    "0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69",
                    "fd85cae1aab8fbe46ff042d46409808cf2944ce266b03ca84b33499585423708",
                    false),
            new BundleSpec(
                    "jdt-ls-extension.jar",
                    "org.springframework.tooling.jdt.ls.extension",
                    "1.0.0.202606051943",
                    "21",
                    23_886L,
                    "692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce",
                    null,
                    true),
            new BundleSpec(
                    "sts-gradle-tooling.jar",
                    "org.springframework.tooling.gradle",
                    "5.2.0.202606051943",
                    "17",
                    8_293L,
                    "9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4",
                    null,
                    false));

    private static final Map<String, String> JDT_PROVIDERS = Map.ofEntries(
            Map.entry("com.google.gson", "2.14.0"),
            Map.entry("com.google.guava", "33.5.0.jre"),
            Map.entry("org.eclipse.buildship.core", "3.1.10.v20250827-0209-s"),
            Map.entry("org.eclipse.core.resources", "3.24.100.v20260611-1641"),
            Map.entry("org.eclipse.core.runtime", "3.35.0.v20260623-1631"),
            Map.entry("org.eclipse.jdt.core", "3.46.100.v20260621-2217"),
            Map.entry("org.eclipse.jdt.core.manipulation", "1.24.200.v20260624-1812"),
            Map.entry("org.eclipse.jdt.launching", "3.24.300.v20260609-0435"),
            Map.entry("org.eclipse.jdt.ls.core", "1.60.0.202606262232"),
            Map.entry("org.eclipse.lsp4j", "1.0.0.v20260209-1721"),
            Map.entry("org.eclipse.lsp4j.jsonrpc", "1.0.0.v20260209-1721"),
            Map.entry("org.eclipse.m2e.core", "2.7.700.20260205-1611"),
            Map.entry("org.eclipse.m2e.maven.runtime", "3.9.1200.20260112-2306"));

    private static final ExpectedSet OFFICIAL = new ExpectedSet(
            JDTLS,
            VSIX,
            PROXY,
            DEBUG,
            PACKAGE,
            SPRING_BUNDLES,
            JDT_PROVIDERS,
            RUNTIME_BASENAME);

    private PrepareS004() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
            System.out.println("S004 preparation self-test passed");
            return;
        }
        if (args.length != 7) {
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
                OFFICIAL);
        System.out.println("jdtls-size=" + prepared.jdtls().size());
        System.out.println("jdtls-sha256=" + prepared.jdtls().sha256());
        System.out.println("vsix-size=" + prepared.vsix().size());
        System.out.println("vsix-sha256=" + prepared.vsix().sha256());
        System.out.println("proxy-size=" + prepared.proxy().size());
        System.out.println("proxy-sha256=" + prepared.proxy().sha256());
        System.out.println("debug-size=" + prepared.debug().size());
        System.out.println("debug-sha256=" + prepared.debug().sha256());
        System.out.println("jdtls-entries=" + prepared.jdtEntries());
        System.out.println("spring-bundles=" + prepared.bundleCount());
        System.out.println("runtime-worktree=" + RUNTIME_BASENAME);
    }

    private static void printUsage() {
        System.err.println(
                "usage: java PrepareS004.java <jdtls.tar.gz> <spring.vsix> "
                        + "<java-lsp-proxy> <java-debug.jar> <s004-source-root> "
                        + "<artifact-destination> <runtime-worktree-destination>");
    }

    private static Prepared prepare(
            Path jdtArchive,
            Path vsix,
            Path proxy,
            Path debug,
            Path sourceRoot,
            Path artifactDestination,
            Path runtimeDestination,
            ExpectedSet expected) throws Exception {
        Path jdtInput = requireRegularFile(jdtArchive, "JDT LS archive");
        Path vsixInput = requireRegularFile(vsix, "Spring VSIX");
        Path proxyInput = requireRegularFile(proxy, "Java proxy executable");
        Path debugInput = requireRegularFile(debug, "Java debug bundle");
        Path sources = requireSourceRoot(sourceRoot);
        Path artifactOutput = artifactDestination.toAbsolutePath().normalize();
        Path runtimeOutput = runtimeDestination.toAbsolutePath().normalize();
        requireFreshDestination(artifactOutput, "artifact destination");
        requireFreshDestination(runtimeOutput, "runtime worktree destination");
        if (!runtimeOutput.getFileName().toString().equals(expected.runtimeBasename())) {
            throw new IOException("runtime worktree basename does not match the fixed cache key");
        }

        VerifiedArtifact verifiedJdt = verifyArtifact(jdtInput, expected.jdtls());
        VerifiedArtifact verifiedVsix = verifyArtifact(vsixInput, expected.vsix());
        VerifiedArtifact verifiedProxy = verifyArtifact(proxyInput, expected.proxy());
        VerifiedArtifact verifiedDebug = verifyArtifact(debugInput, expected.debug());

        Path artifactParent = requireParentDirectory(artifactOutput);
        Path runtimeParent = requireParentDirectory(runtimeOutput);
        Path artifactStage = Files.createTempDirectory(artifactParent, ".s004-artifacts-");
        Path runtimeStage = Files.createTempDirectory(runtimeParent, ".s004-runtime-");
        boolean artifactMoved = false;
        boolean runtimeMoved = false;
        try {
            Path jdtRoot = artifactStage.resolve("jdtls");
            TarStats tarStats = extractTarGzip(jdtInput, jdtRoot);
            List<Path> pluginJars = validateFreshJdtLayout(jdtRoot);
            makeExecutable(jdtRoot.resolve("bin/jdtls"));

            Path bundleOutput = runtimeStage.resolve(BUNDLE_OUTPUT);
            Files.createDirectories(bundleOutput);
            extractSpringBundles(
                    vsixInput,
                    bundleOutput,
                    expected.packageJson(),
                    expected.bundles());
            auditBundleClosure(pluginJars, bundleOutput, expected.bundles(), expected.providers());
            copyRuntimeSources(sources, runtimeStage);

            moveFresh(runtimeStage, runtimeOutput);
            runtimeMoved = true;
            moveFresh(artifactStage, artifactOutput);
            artifactMoved = true;
            return new Prepared(
                    verifiedJdt,
                    verifiedVsix,
                    verifiedProxy,
                    verifiedDebug,
                    tarStats.entryCount(),
                    expected.bundles().size());
        } finally {
            if (!artifactMoved) {
                deleteRecursively(artifactStage);
            }
            if (!runtimeMoved) {
                deleteRecursively(runtimeStage);
            }
            if (runtimeMoved && !artifactMoved) {
                deleteRecursively(runtimeOutput);
            }
        }
    }

    private static Path requireRegularFile(Path path, String label) throws IOException {
        Path normalized = path.toAbsolutePath().normalize();
        if (!Files.isRegularFile(normalized, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(normalized)) {
            throw new IOException(label + " is not a regular non-link file");
        }
        return normalized;
    }

    private static Path requireSourceRoot(Path sourceRoot) throws IOException {
        Path root = sourceRoot.toAbsolutePath().normalize();
        if (!Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(root)) {
            throw new IOException("S004 source root is not a regular directory");
        }
        for (String relative : List.of(FIXTURE_POM, FIXTURE_JAVA, PROBE_SOURCE)) {
            requireContainedRegularFile(root, relative);
        }
        return root;
    }

    private static Path requireContainedRegularFile(Path root, String relative) throws IOException {
        Path path = root.resolve(relative).normalize();
        if (!path.startsWith(root)
                || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(path)) {
            throw new IOException("required S004 source is missing or linked: " + relative);
        }
        return path;
    }

    private static Path requireParentDirectory(Path destination) throws IOException {
        Path parent = destination.getParent();
        if (parent == null) {
            throw new IOException("destination has no parent directory");
        }
        Files.createDirectories(parent);
        if (!Files.isDirectory(parent, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(parent)) {
            throw new IOException("destination parent is not a regular directory");
        }
        return parent;
    }

    private static void requireFreshDestination(Path destination, String label) throws IOException {
        if (Files.exists(destination, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(label + " already exists");
        }
    }

    private static VerifiedArtifact verifyArtifact(Path path, ArtifactSpec expected)
            throws IOException {
        long size = Files.size(path);
        if (size != expected.size()) {
            throw new IOException("artifact size mismatch");
        }
        String digest = sha256(path);
        if (!digest.equals(expected.sha256())) {
            throw new IOException("artifact SHA-256 mismatch");
        }
        return new VerifiedArtifact(size, digest);
    }

    private static TarStats extractTarGzip(Path archive, Path destination) throws IOException {
        Files.createDirectory(destination);
        Set<String> seen = new HashSet<>();
        int entries = 0;
        long extractedBytes = 0;
        boolean localPaxPending = false;

        try (InputStream raw = new BufferedInputStream(Files.newInputStream(archive));
                InputStream gzip = new GZIPInputStream(raw, BUFFER_SIZE)) {
            while (true) {
                byte[] header = readBlock(gzip);
                if (header == null) {
                    throw new IOException("tar archive ended without zero blocks");
                }
                if (isZeroBlock(header)) {
                    if (localPaxPending) {
                        throw new IOException("tar archive has a dangling local PAX header");
                    }
                    byte[] second = readBlock(gzip);
                    if (second == null || !isZeroBlock(second)) {
                        throw new IOException("tar archive has an incomplete end marker");
                    }
                    break;
                }

                validateTarChecksum(header);
                if (!tarString(header, 257, 6).startsWith("ustar")) {
                    throw new IOException("unsupported tar header format");
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

                if (type == 'x') {
                    if (localPaxPending) {
                        throw new IOException("consecutive local PAX headers are unsupported");
                    }
                    if (size > MAX_PAX_HEADER_BYTES) {
                        throw new IOException("local PAX header exceeds the safety limit");
                    }
                    safeRelativePath(name, "PAX tar");
                    validateLocalPax(readExactly(gzip, size));
                    skipExactly(gzip, (TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE);
                    localPaxPending = true;
                    continue;
                }

                entries++;
                if (entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("tar archive contains too many entries");
                }
                Path relative = safeRelativePath(name, "tar");
                String key = portableCollisionKey(relative);
                if (!seen.add(key)) {
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
                    Path parent = target.getParent();
                    if (parent == null) {
                        throw new IOException("tar entry has no destination parent");
                    }
                    Files.createDirectories(parent);
                    if (Files.exists(target, LinkOption.NOFOLLOW_LINKS)) {
                        throw new IOException("tar entry collides with an existing path: " + name);
                    }
                    try (OutputStream output = new BufferedOutputStream(Files.newOutputStream(target))) {
                        copyExactly(gzip, output, size);
                    }
                    extractedBytes += size;
                    if (extractedBytes > MAX_EXTRACTED_BYTES) {
                        throw new IOException("tar archive expands beyond the safety limit");
                    }
                } else {
                    throw new IOException("unsupported tar entry type " + printableType(type));
                }

                skipExactly(gzip, (TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE);
                localPaxPending = false;
            }
        }
        return new TarStats(entries, extractedBytes);
    }

    private static void validateLocalPax(byte[] data) throws IOException {
        if (data.length == 0) {
            throw new IOException("local PAX header is empty");
        }
        Set<String> seenKeys = new HashSet<>();
        int offset = 0;
        while (offset < data.length) {
            int space = offset;
            long declaredLength = 0;
            while (space < data.length && data[space] != ' ') {
                int digit = data[space] - '0';
                if (digit < 0 || digit > 9) {
                    throw new IOException("local PAX record has an invalid length");
                }
                declaredLength = declaredLength * 10 + digit;
                if (declaredLength > MAX_PAX_HEADER_BYTES) {
                    throw new IOException("local PAX record exceeds the safety limit");
                }
                space++;
            }
            if (space == offset || space >= data.length) {
                throw new IOException("local PAX record has no length delimiter");
            }
            int recordLength = Math.toIntExact(declaredLength);
            int recordEnd = Math.addExact(offset, recordLength);
            if (recordLength <= space - offset + 3
                    || recordEnd > data.length
                    || data[recordEnd - 1] != '\n') {
                throw new IOException("local PAX record length is inconsistent");
            }
            int equals = space + 1;
            while (equals < recordEnd - 1 && data[equals] != '=') {
                equals++;
            }
            if (equals == space + 1 || equals >= recordEnd - 1) {
                throw new IOException("local PAX record has no key/value delimiter");
            }
            String key = ascii(data, space + 1, equals, "local PAX key");
            if (!ALLOWED_LOCAL_PAX_KEYS.contains(key) || !seenKeys.add(key)) {
                throw new IOException("unsupported or duplicate local PAX key: " + key);
            }
            String value = ascii(data, equals + 1, recordEnd - 1, "local PAX value");
            if ((key.equals("uid") || key.equals("gid")) && !isUnsignedDecimal(value)) {
                throw new IOException("local PAX owner must be an unsigned integer");
            }
            if (key.equals("mtime") && !isDecimalTimestamp(value)) {
                throw new IOException("local PAX mtime must be a decimal timestamp");
            }
            offset = recordEnd;
        }
    }

    private static void extractSpringBundles(
            Path vsix,
            Path destination,
            PackageSpec packageSpec,
            List<BundleSpec> bundleSpecs) throws IOException {
        Map<String, BundleSpec> expectedEntries = new LinkedHashMap<>();
        for (BundleSpec spec : bundleSpecs) {
            expectedEntries.put(BUNDLE_PREFIX + spec.fileName(), spec);
        }
        Set<String> seen = new HashSet<>();
        Set<String> extracted = new HashSet<>();
        byte[] packageBytes = null;
        int entries = 0;

        try (ZipInputStream zip = new ZipInputStream(
                new BufferedInputStream(Files.newInputStream(vsix)))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null; zip.closeEntry()) {
                entries++;
                if (entries > MAX_ARCHIVE_ENTRIES) {
                    throw new IOException("VSIX contains too many entries");
                }
                Path relative = safeRelativePath(entry.getName(), "VSIX");
                if (!seen.add(portableCollisionKey(relative))) {
                    throw new IOException("duplicate or case-colliding VSIX entry");
                }
                String normalizedName = relative.toString().replace('\\', '/');
                if (normalizedName.equals(PACKAGE_ENTRY)) {
                    requireZipFile(entry, normalizedName);
                    packageBytes = readZipEntry(zip, 1_000_000L);
                } else if (expectedEntries.containsKey(normalizedName)) {
                    requireZipFile(entry, normalizedName);
                    BundleSpec spec = expectedEntries.get(normalizedName);
                    Path output = destination.resolve(spec.fileName());
                    writeZipEntryToFile(zip, output, spec.size());
                    extracted.add(normalizedName);
                }
            }
        }

        if (packageBytes == null) {
            throw new IOException("VSIX package.json is missing");
        }
        verifyBytes(packageBytes, packageSpec.size(), packageSpec.sha256(), "package.json");
        validatePackageOrder(packageBytes, bundleSpecs);
        if (!extracted.equals(expectedEntries.keySet())) {
            throw new IOException("VSIX is missing one or more declared Spring bundles");
        }
        for (BundleSpec spec : bundleSpecs) {
            validateBundle(destination.resolve(spec.fileName()), spec);
        }
    }

    private static void requireZipFile(ZipEntry entry, String name) throws IOException {
        if (entry.isDirectory()) {
            throw new IOException("required VSIX file is a directory: " + name);
        }
    }

    private static byte[] readZipEntry(InputStream input, long limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        copyWithLimit(input, output, limit);
        return output.toByteArray();
    }

    private static void writeZipEntryToFile(InputStream input, Path output, long expectedSize)
            throws IOException {
        if (Files.exists(output, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("bundle output already exists");
        }
        try (OutputStream file = new BufferedOutputStream(Files.newOutputStream(output))) {
            copyWithLimit(input, file, expectedSize);
        }
        if (Files.size(output) != expectedSize) {
            throw new IOException("bundle extracted size mismatch");
        }
    }

    private static void copyWithLimit(InputStream input, OutputStream output, long limit)
            throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        long written = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            written += read;
            if (written > limit) {
                throw new IOException("ZIP entry exceeds its safety limit");
            }
            output.write(buffer, 0, read);
        }
    }

    private static void verifyBytes(byte[] bytes, long size, String digest, String label)
            throws IOException {
        if (bytes.length != size || !sha256(bytes).equals(digest)) {
            throw new IOException(label + " identity mismatch");
        }
    }

    private static void validatePackageOrder(byte[] bytes, List<BundleSpec> specs)
            throws IOException {
        String json = new String(bytes, StandardCharsets.UTF_8);
        int cursor = json.indexOf("\"javaExtensions\"");
        if (cursor < 0) {
            throw new IOException("package.json has no javaExtensions contribution");
        }
        for (BundleSpec spec : specs) {
            String path = "\"./jars/" + spec.fileName() + "\"";
            int next = json.indexOf(path, cursor);
            if (next < 0) {
                throw new IOException("package.json bundle order or path mismatch");
            }
            cursor = next + path.length();
        }
        int arrayEnd = json.indexOf(']', cursor);
        if (arrayEnd < 0) {
            throw new IOException("package.json javaExtensions array is unterminated");
        }
        String contributionTail = json.substring(cursor, arrayEnd);
        if (contributionTail.contains("./jars/")) {
            throw new IOException("package.json declares an unexpected Java extension");
        }
    }

    private static void validateBundle(Path jar, BundleSpec spec) throws IOException {
        verifyArtifact(jar, new ArtifactSpec(spec.size(), spec.sha256()));
        try (JarFile jarFile = new JarFile(jar.toFile(), false)) {
            Manifest manifest = jarFile.getManifest();
            if (manifest == null) {
                throw new IOException("bundle manifest is missing");
            }
            Attributes attributes = manifest.getMainAttributes();
            String symbolicName = stripDirective(attributes.getValue("Bundle-SymbolicName"));
            if (!spec.symbolicName().equals(symbolicName)
                    || !spec.version().equals(attributes.getValue("Bundle-Version"))) {
                throw new IOException("bundle manifest identity mismatch: " + spec.fileName());
            }
            String capability = attributes.getValue("Require-Capability");
            if (capability == null || !capability.contains("version=" + spec.javaVersion())) {
                throw new IOException("bundle Java requirement mismatch: " + spec.fileName());
            }
            if (spec.nestedCommonsSha256() != null) {
                JarEntry nested = jarFile.getJarEntry("lib/commons-lsp-extensions.jar");
                if (nested == null) {
                    throw new IOException("nested commons protocol JAR is missing");
                }
                try (InputStream input = jarFile.getInputStream(nested)) {
                    if (!sha256(input).equals(spec.nestedCommonsSha256())) {
                        throw new IOException("nested commons protocol JAR digest mismatch");
                    }
                }
            }
            if (spec.requiresSearchCommand()) {
                JarEntry plugin = jarFile.getJarEntry("plugin.xml");
                if (plugin == null) {
                    throw new IOException("Spring JDT plugin.xml is missing");
                }
                String xml;
                try (InputStream input = jarFile.getInputStream(plugin)) {
                    xml = new String(input.readAllBytes(), StandardCharsets.UTF_8);
                }
                if (!xml.contains("id=\"sts.java.search.types\"")) {
                    throw new IOException("sts.java.search.types is not registered");
                }
            }
        }
    }

    private static List<Path> validateFreshJdtLayout(Path root) throws IOException {
        if (!Files.isRegularFile(root.resolve("bin/jdtls"))
                || !Files.isRegularFile(root.resolve("bin/jdtls.bat"))
                || !Files.isDirectory(root.resolve("plugins"))) {
            throw new IOException("JDT LS archive has an unexpected layout");
        }
        if (Files.exists(root.resolve("configuration"), LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("fresh JDT LS extraction contains mutable configuration state");
        }
        List<Path> plugins;
        try (Stream<Path> paths = Files.list(root.resolve("plugins"))) {
            plugins = paths
                    .filter(path -> Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS))
                    .filter(path -> path.getFileName().toString().endsWith(".jar"))
                    .sorted()
                    .toList();
        }
        if (plugins.isEmpty()) {
            throw new IOException("JDT LS plugin directory is empty");
        }
        return plugins;
    }

    private static void auditBundleClosure(
            List<Path> jdtPlugins,
            Path springDirectory,
            List<BundleSpec> springSpecs,
            Map<String, String> requiredProviders) throws IOException {
        Map<String, String> providers = new HashMap<>();
        for (Path jar : jdtPlugins) {
            try (JarFile jarFile = new JarFile(jar.toFile(), false)) {
                Manifest manifest = jarFile.getManifest();
                if (manifest == null) {
                    continue;
                }
                Attributes attributes = manifest.getMainAttributes();
                String symbolicName = stripDirective(attributes.getValue("Bundle-SymbolicName"));
                String version = attributes.getValue("Bundle-Version");
                if (symbolicName != null && providers.put(symbolicName, version) != null) {
                    throw new IOException("duplicate JDT bundle symbolic name: " + symbolicName);
                }
            }
        }
        for (BundleSpec spec : springSpecs) {
            if (providers.containsKey(spec.symbolicName())) {
                throw new IOException("Spring bundle collides with JDT LS: " + spec.symbolicName());
            }
            if (!Files.isRegularFile(springDirectory.resolve(spec.fileName()))) {
                throw new IOException("prepared Spring bundle is missing");
            }
        }
        for (Map.Entry<String, String> requirement : requiredProviders.entrySet()) {
            String actual = providers.get(requirement.getKey());
            if (!requirement.getValue().equals(actual)) {
                throw new IOException("JDT provider identity mismatch: " + requirement.getKey());
            }
        }
    }

    private static String stripDirective(String symbolicName) {
        if (symbolicName == null) {
            return null;
        }
        int directive = symbolicName.indexOf(';');
        return (directive < 0 ? symbolicName : symbolicName.substring(0, directive)).trim();
    }

    private static void copyRuntimeSources(Path sourceRoot, Path runtimeStage) throws IOException {
        Path pom = requireContainedRegularFile(sourceRoot, FIXTURE_POM);
        Path java = requireContainedRegularFile(sourceRoot, FIXTURE_JAVA);
        Path probe = requireContainedRegularFile(sourceRoot, PROBE_SOURCE);
        Path javaOutput = runtimeStage.resolve("src/main/java/dev/zed/spring/s004/")
                .resolve(java.getFileName());
        Path probeOutput = runtimeStage.resolve(PROBE_OUTPUT);
        Files.createDirectories(javaOutput.getParent());
        Files.createDirectories(probeOutput.getParent());
        Files.copy(pom, runtimeStage.resolve("pom.xml"));
        Files.copy(java, javaOutput);
        Files.copy(probe, probeOutput);
    }

    private static String ascii(byte[] data, int start, int end, String label)
            throws IOException {
        if (start >= end) {
            throw new IOException(label + " is empty");
        }
        for (int index = start; index < end; index++) {
            if (data[index] < 0x20 || data[index] > 0x7e) {
                throw new IOException(label + " contains a non-ASCII byte");
            }
        }
        return new String(data, start, end - start, StandardCharsets.US_ASCII);
    }

    private static boolean isUnsignedDecimal(String value) {
        return !value.isEmpty() && value.chars().allMatch(Character::isDigit);
    }

    private static boolean isDecimalTimestamp(String value) {
        return value.matches("-?[0-9]+(?:\\.[0-9]+)?");
    }

    private static byte[] readExactly(InputStream input, long bytes) throws IOException {
        if (bytes > Integer.MAX_VALUE) {
            throw new IOException("tar metadata is too large to buffer");
        }
        byte[] result = new byte[Math.toIntExact(bytes)];
        int offset = 0;
        while (offset < result.length) {
            int read = input.read(result, offset, result.length - offset);
            if (read == -1) {
                throw new IOException("truncated tar entry data");
            }
            offset += read;
        }
        return result;
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
        return new String(bytes, offset, end - offset, StandardCharsets.UTF_8);
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
        if (relative.isAbsolute() || relative.getNameCount() == 0 || relative.startsWith("..")) {
            throw new IOException("unsafe " + archiveType + " entry: " + name);
        }
        return relative;
    }

    private static String portableCollisionKey(Path path) {
        return path.toString().replace('\\', '/').toLowerCase(Locale.ROOT);
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
            return sha256(input);
        }
    }

    private static String sha256(byte[] bytes) {
        return HexFormat.of().formatHex(newDigest().digest(bytes));
    }

    private static String sha256(InputStream input) throws IOException {
        MessageDigest digest = newDigest();
        byte[] buffer = new byte[BUFFER_SIZE];
        int read;
        while ((read = input.read(buffer)) != -1) {
            digest.update(buffer, 0, read);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static MessageDigest newDigest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is unavailable", error);
        }
    }

    private static void selfTest() throws Exception {
        Path root = Files.createTempDirectory("s004-prepare-test-");
        try {
            Path sources = createTestSources(root.resolve("sources"));
            Map<String, String> providers = Map.of("test.provider", "1.2.3");
            byte[] providerJar = manifestJar("test.provider", "1.2.3", "21", null, null);
            byte[] springJar = manifestJar("test.spring", "4.5.6", "21", null, null);
            BundleSpec springSpec = new BundleSpec(
                    "spring.jar",
                    "test.spring",
                    "4.5.6",
                    "21",
                    springJar.length,
                    sha256(springJar),
                    null,
                    false);
            byte[] packageJson = "{\"contributes\":{\"javaExtensions\":[\"./jars/spring.jar\"]}}"
                    .getBytes(StandardCharsets.UTF_8);
            PackageSpec packageSpec = new PackageSpec(packageJson.length, sha256(packageJson));

            Path jdt = root.resolve("jdt.tar.gz");
            writeTarGzip(jdt, List.of(
                    TarTestEntry.file("bin/jdtls", new byte[] {1}),
                    TarTestEntry.file("bin/jdtls.bat", new byte[] {2}),
                    TarTestEntry.pax("PaxHeaders/provider", paxPayload("uid=1000")),
                    TarTestEntry.file("plugins/provider.jar", providerJar)));
            Path vsix = root.resolve("spring.vsix");
            writeZip(vsix, List.of(
                    new ZipTestEntry(PACKAGE_ENTRY, packageJson),
                    new ZipTestEntry(BUNDLE_PREFIX + "spring.jar", springJar),
                    new ZipTestEntry(BUNDLE_PREFIX + "undeclared.jar", new byte[] {9})));
            Path proxy = root.resolve("proxy");
            Path debug = root.resolve("debug.jar");
            Files.write(proxy, new byte[] {3, 4});
            Files.write(debug, new byte[] {5, 6, 7});
            ExpectedSet expected = new ExpectedSet(
                    artifactFor(jdt),
                    artifactFor(vsix),
                    artifactFor(proxy),
                    artifactFor(debug),
                    packageSpec,
                    List.of(springSpec),
                    providers,
                    "runtime-test");

            Path artifacts = root.resolve("prepared");
            Path runtime = root.resolve("runtime-test");
            Prepared prepared = prepare(
                    jdt, vsix, proxy, debug, sources, artifacts, runtime, expected);
            require(prepared.bundleCount() == 1, "full preparation changed bundle count");
            require(Files.isRegularFile(runtime.resolve(BUNDLE_OUTPUT).resolve("spring.jar")),
                    "declared Spring bundle was not staged");
            require(!Files.exists(runtime.resolve(BUNDLE_OUTPUT).resolve("undeclared.jar")),
                    "undeclared VSIX JAR was extracted");
            require(!Files.exists(artifacts.resolve("jdtls/configuration")),
                    "fresh preparation created configuration state");

            expectFailure("wrong digest", () -> verifyArtifact(
                    proxy,
                    new ArtifactSpec(Files.size(proxy), "0".repeat(64))));
            expectFailure("path traversal", () -> safeRelativePath("../escape", "test"));

            Path linkTar = root.resolve("link.tar.gz");
            writeTarGzip(linkTar, List.of(new TarTestEntry("link", new byte[0], (byte) '2')));
            expectExtractionFailure("tar link", linkTar, root.resolve("link-output"));

            Path duplicateTar = root.resolve("duplicate.tar.gz");
            writeTarGzip(duplicateTar, List.of(
                    TarTestEntry.file("Same", new byte[] {1}),
                    TarTestEntry.file("same", new byte[] {2})));
            expectExtractionFailure("case-colliding tar entries", duplicateTar,
                    root.resolve("duplicate-output"));

            byte[] malformed = "not-a-jar".getBytes(StandardCharsets.UTF_8);
            BundleSpec malformedSpec = new BundleSpec(
                    "bad.jar", "bad", "1", "21", malformed.length, sha256(malformed), null, false);
            Path malformedPath = root.resolve("bad.jar");
            Files.write(malformedPath, malformed);
            expectFailure("malformed bundle manifest", () -> validateBundle(
                    malformedPath, malformedSpec));

            Path pluginDirectory = root.resolve("audit-plugins");
            Path springDirectory = root.resolve("audit-spring");
            Files.createDirectories(pluginDirectory);
            Files.createDirectories(springDirectory);
            Files.write(pluginDirectory.resolve("provider.jar"), providerJar);
            Files.write(springDirectory.resolve("spring.jar"), springJar);
            List<Path> pluginList = List.of(pluginDirectory.resolve("provider.jar"));
            expectFailure("missing provider", () -> auditBundleClosure(
                    pluginList,
                    springDirectory,
                    List.of(springSpec),
                    Map.of("missing", "1")));
            expectFailure("provider version mismatch", () -> auditBundleClosure(
                    pluginList,
                    springDirectory,
                    List.of(springSpec),
                    Map.of("test.provider", "9")));
            BundleSpec collision = new BundleSpec(
                    "spring.jar",
                    "test.provider",
                    "4.5.6",
                    "21",
                    springJar.length,
                    sha256(springJar),
                    null,
                    false);
            expectFailure("bundle collision", () -> auditBundleClosure(
                    pluginList,
                    springDirectory,
                    List.of(collision),
                    providers));

            Path contaminated = root.resolve("contaminated");
            Files.createDirectories(contaminated.resolve("bin"));
            Files.createDirectories(contaminated.resolve("plugins"));
            Files.createDirectories(contaminated.resolve("configuration"));
            Files.write(contaminated.resolve("bin/jdtls"), new byte[] {1});
            Files.write(contaminated.resolve("bin/jdtls.bat"), new byte[] {1});
            Files.write(contaminated.resolve("plugins/provider.jar"), providerJar);
            expectFailure("pre-existing JDT configuration", () -> validateFreshJdtLayout(
                    contaminated));
            expectFailure("existing destination", () -> requireFreshDestination(
                    runtime, "runtime"));
        } finally {
            deleteRecursively(root);
        }
    }

    private static Path createTestSources(Path root) throws IOException {
        Files.createDirectories(root.resolve("fixture/src/main/java/dev/zed/spring/s004"));
        Files.createDirectories(root.resolve("extension/probe"));
        Files.writeString(root.resolve(FIXTURE_POM), "<project/>\n");
        Files.writeString(root.resolve(FIXTURE_JAVA), "package dev.zed.spring.s004; class X {}\n");
        Files.writeString(root.resolve(PROBE_SOURCE), "\"use strict\";\n");
        return root;
    }

    private static ArtifactSpec artifactFor(Path path) throws IOException {
        return new ArtifactSpec(Files.size(path), sha256(path));
    }

    private static byte[] manifestJar(
            String symbolicName,
            String version,
            String javaVersion,
            String extraEntry,
            byte[] extraBytes) throws IOException {
        Manifest manifest = new Manifest();
        Attributes attributes = manifest.getMainAttributes();
        attributes.put(Attributes.Name.MANIFEST_VERSION, "1.0");
        attributes.putValue("Bundle-ManifestVersion", "2");
        attributes.putValue("Bundle-SymbolicName", symbolicName);
        attributes.putValue("Bundle-Version", version);
        attributes.putValue(
                "Require-Capability",
                "osgi.ee;filter:=\"(&(osgi.ee=JavaSE)(version=" + javaVersion + "))\"");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (JarOutputStream jar = new JarOutputStream(bytes, manifest)) {
            if (extraEntry != null) {
                jar.putNextEntry(new JarEntry(extraEntry));
                jar.write(extraBytes);
                jar.closeEntry();
            }
        }
        return bytes.toByteArray();
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
                header[156] = entry.type();
                writeTarString(header, 157, 100, entry.type() == '2' ? "target" : "");
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
                int padding = (TAR_BLOCK_SIZE - (entry.data().length % TAR_BLOCK_SIZE))
                        % TAR_BLOCK_SIZE;
                gzip.write(new byte[padding]);
            }
            gzip.write(new byte[TAR_BLOCK_SIZE * 2]);
        }
    }

    private static byte[] paxPayload(String... fields) {
        StringBuilder payload = new StringBuilder();
        for (String field : fields) {
            int length = field.length() + 3;
            while (true) {
                int adjusted = Integer.toString(length).length() + field.length() + 2;
                if (adjusted == length) {
                    break;
                }
                length = adjusted;
            }
            payload.append(length).append(' ').append(field).append('\n');
        }
        return payload.toString().getBytes(StandardCharsets.US_ASCII);
    }

    private static void writeTarString(
            byte[] header, int offset, int length, String value) throws IOException {
        byte[] encoded = value.getBytes(StandardCharsets.UTF_8);
        if (encoded.length > length) {
            throw new IOException("self-test tar field is too long");
        }
        System.arraycopy(encoded, 0, header, offset, encoded.length);
    }

    private static void writeTarOctal(
            byte[] header, int offset, int length, long value) throws IOException {
        String text = Long.toOctalString(value);
        if (text.length() > length - 1) {
            throw new IOException("self-test tar number is too large");
        }
        Arrays.fill(header, offset, offset + length, (byte) '0');
        byte[] encoded = text.getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(encoded, 0, header, offset + length - 1 - encoded.length, encoded.length);
        header[offset + length - 1] = 0;
    }

    private static void expectExtractionFailure(String label, Path archive, Path output)
            throws Exception {
        expectFailure(label, () -> extractTarGzip(archive, output));
        deleteRecursively(output);
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

    private record PackageSpec(long size, String sha256) {
    }

    private record BundleSpec(
            String fileName,
            String symbolicName,
            String version,
            String javaVersion,
            long size,
            String sha256,
            String nestedCommonsSha256,
            boolean requiresSearchCommand) {
    }

    private record ExpectedSet(
            ArtifactSpec jdtls,
            ArtifactSpec vsix,
            ArtifactSpec proxy,
            ArtifactSpec debug,
            PackageSpec packageJson,
            List<BundleSpec> bundles,
            Map<String, String> providers,
            String runtimeBasename) {
    }

    private record VerifiedArtifact(long size, String sha256) {
    }

    private record TarStats(int entryCount, long extractedBytes) {
    }

    private record Prepared(
            VerifiedArtifact jdtls,
            VerifiedArtifact vsix,
            VerifiedArtifact proxy,
            VerifiedArtifact debug,
            int jdtEntries,
            int bundleCount) {
    }

    private record TarTestEntry(String name, byte[] data, byte type) {
        private TarTestEntry {
            data = data.clone();
        }

        private static TarTestEntry file(String name, byte[] data) {
            return new TarTestEntry(name, data, (byte) '0');
        }

        private static TarTestEntry pax(String name, byte[] data) {
            return new TarTestEntry(name, data, (byte) 'x');
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
