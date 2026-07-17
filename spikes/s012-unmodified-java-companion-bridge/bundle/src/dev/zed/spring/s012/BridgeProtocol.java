package dev.zed.spring.s012;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

public final class BridgeProtocol {
    public static final int SCHEMA_VERSION = 1;
    public static final String EVENT_PATH = "/v1/classpath";

    private static final int MAX_BODY_BYTES = 1024 * 1024;
    private static final Set<String> REGISTRATION_KEYS = Set.of(
            "schemaVersion",
            "callbackId",
            "endpoint",
            "credential",
            "worktreeId",
            "batched");
    private static final Pattern CALLBACK_ID =
            Pattern.compile("[A-Za-z0-9._-]{1,128}");
    private static final Pattern CREDENTIAL =
            Pattern.compile("[A-Za-z0-9_-]{32,256}");
    private static final Pattern WORKTREE_ID =
            Pattern.compile("[0-9a-f]{64}");
    private static final Gson GSON = new Gson();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private static final AtomicLong REQUEST_SEQUENCE = new AtomicLong();

    private BridgeProtocol() {}

    public static Registration parseRegistration(Object value) {
        if (!(value instanceof Map<?, ?> raw)) {
            throw new IllegalArgumentException("registration must be an object");
        }

        Set<String> keys = new HashSet<>();
        for (Object key : raw.keySet()) {
            if (!(key instanceof String stringKey)) {
                throw new IllegalArgumentException("registration keys must be strings");
            }
            keys.add(stringKey);
        }
        if (!keys.equals(REGISTRATION_KEYS)) {
            throw new IllegalArgumentException("registration keys do not match schema");
        }

        Object schema = raw.get("schemaVersion");
        if (!(schema instanceof Number number)
                || number.intValue() != SCHEMA_VERSION
                || number.doubleValue() != SCHEMA_VERSION) {
            throw new IllegalArgumentException("unsupported schema version");
        }

        String callbackId = requireString(raw, "callbackId", CALLBACK_ID);
        String credential = requireString(raw, "credential", CREDENTIAL);
        String worktreeId = requireString(raw, "worktreeId", WORKTREE_ID);
        if (!(raw.get("batched") instanceof Boolean batched) || batched) {
            throw new IllegalArgumentException("only non-batched events are supported");
        }

        URI endpoint;
        try {
            endpoint = URI.create(requireString(raw, "endpoint", null));
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("endpoint must be a valid URI");
        }
        validateEndpoint(endpoint);

        return new Registration(
                callbackId, endpoint, credential, worktreeId, false);
    }

    public static Object postEvent(Registration registration, Object... arguments)
            throws IOException, InterruptedException {
        Objects.requireNonNull(registration, "registration");
        Objects.requireNonNull(arguments, "arguments");
        if (arguments.length != 6) {
            throw new IllegalArgumentException("classpath event must contain six arguments");
        }

        JsonObject body = new JsonObject();
        body.addProperty("schemaVersion", SCHEMA_VERSION);
        body.addProperty("requestId", REQUEST_SEQUENCE.incrementAndGet());
        body.addProperty("callbackId", registration.callbackId());
        body.addProperty("worktreeId", registration.worktreeId());
        body.add("arguments", GSON.toJsonTree(arguments));

        String encodedBody = GSON.toJson(body);
        if (encodedBody.getBytes(StandardCharsets.UTF_8).length > MAX_BODY_BYTES) {
            throw new IOException("bridge callback request is too large");
        }
        HttpRequest request = HttpRequest.newBuilder(registration.endpoint())
                .timeout(Duration.ofSeconds(3))
                .header("Authorization", "Bearer " + registration.credential())
                .header("Content-Type", "application/json")
                .header("X-Zed-Spring-Worktree", registration.worktreeId())
                .POST(HttpRequest.BodyPublishers.ofString(encodedBody))
                .build();
        HttpResponse<InputStream> response =
                HTTP.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200) {
            response.body().close();
            throw new IOException("bridge callback returned HTTP " + response.statusCode());
        }

        byte[] responseBytes;
        try (InputStream responseBody = response.body()) {
            responseBytes = responseBody.readNBytes(MAX_BODY_BYTES + 1);
        }
        if (responseBytes.length > MAX_BODY_BYTES) {
            throw new IOException("bridge callback response is too large");
        }

        JsonElement parsed;
        try {
            parsed = JsonParser.parseString(new String(responseBytes, StandardCharsets.UTF_8));
        } catch (RuntimeException error) {
            throw new IOException("bridge callback returned invalid JSON");
        }
        if (!parsed.isJsonObject()) {
            throw new IOException("bridge callback response must be an object");
        }
        JsonObject object = parsed.getAsJsonObject();
        if (object.has("error")) {
            throw new IOException("bridge callback reported an error");
        }
        if (!object.has("result")) {
            throw new IOException("bridge callback response has no result");
        }
        return GSON.fromJson(object.get("result"), Object.class);
    }

    private static String requireString(
            Map<?, ?> map, String key, Pattern pattern) {
        Object value = map.get(key);
        if (!(value instanceof String stringValue) || stringValue.isEmpty()) {
            throw new IllegalArgumentException(key + " must be a non-empty string");
        }
        if (stringValue.length() > 512) {
            throw new IllegalArgumentException(key + " is too long");
        }
        if (pattern != null && !pattern.matcher(stringValue).matches()) {
            throw new IllegalArgumentException(key + " has invalid syntax");
        }
        return stringValue;
    }

    private static void validateEndpoint(URI endpoint) {
        String host = endpoint.getHost();
        boolean loopback =
                "127.0.0.1".equals(host) || "localhost".equals(host) || "::1".equals(host);
        if (!"http".equals(endpoint.getScheme())
                || !loopback
                || endpoint.getPort() <= 0
                || !EVENT_PATH.equals(endpoint.getPath())
                || endpoint.getUserInfo() != null
                || endpoint.getQuery() != null
                || endpoint.getFragment() != null) {
            throw new IllegalArgumentException(
                    "endpoint must be an explicit loopback HTTP /v1/classpath URI");
        }
    }

    public record Registration(
            String callbackId,
            URI endpoint,
            String credential,
            String worktreeId,
            boolean batched) {
        public Registration {
            Objects.requireNonNull(callbackId, "callbackId");
            Objects.requireNonNull(endpoint, "endpoint");
            Objects.requireNonNull(credential, "credential");
            Objects.requireNonNull(worktreeId, "worktreeId");
            if (batched) {
                throw new IllegalArgumentException("only non-batched events are supported");
            }
        }
    }

    public static final class Registry {
        private final ConcurrentHashMap<String, Registration> registrations =
                new ConcurrentHashMap<>();

        public boolean add(Registration registration) {
            Registration prior =
                    registrations.putIfAbsent(registration.callbackId(), registration);
            if (prior == null) {
                return true;
            }
            if (!prior.equals(registration)) {
                throw new IllegalStateException("callback ID is already registered");
            }
            return false;
        }

        public Registration require(String callbackId) {
            Registration registration = registrations.get(callbackId);
            if (registration == null) {
                throw new IllegalStateException("callback ID is not registered");
            }
            return registration;
        }

        public boolean remove(Registration registration) {
            Registration current = registrations.get(registration.callbackId());
            if (current == null) {
                return false;
            }
            if (!current.equals(registration)) {
                throw new IllegalStateException("callback registration does not match");
            }
            return registrations.remove(registration.callbackId(), registration);
        }

        public boolean containsExact(Registration registration) {
            Registration current = registrations.get(registration.callbackId());
            if (current == null) {
                return false;
            }
            if (!current.equals(registration)) {
                throw new IllegalStateException("callback registration does not match");
            }
            return true;
        }

        public List<String> callbackIds() {
            return List.copyOf(registrations.keySet());
        }

        public void clear() {
            registrations.clear();
        }
    }
}
