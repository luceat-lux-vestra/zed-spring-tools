package dev.zed.spring.bridge;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.LinkedHashMap;
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
    private static final Pattern CALLBACK_ID = Pattern.compile("[A-Za-z0-9._-]{1,128}");
    private static final Pattern CREDENTIAL = Pattern.compile("[A-Za-z0-9_-]{32,256}");
    private static final Pattern WORKTREE_ID = Pattern.compile("[0-9a-f]{64}");
    private static final AtomicLong REQUEST_SEQUENCE = new AtomicLong();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
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
            throw new IllegalArgumentException("unsupported bridge schema version");
        }
        String callbackId = requireString(raw, "callbackId", CALLBACK_ID);
        String credential = requireString(raw, "credential", CREDENTIAL);
        String worktreeId = requireString(raw, "worktreeId", WORKTREE_ID);
        if (!(raw.get("batched") instanceof Boolean batched) || batched) {
            throw new IllegalArgumentException("only non-batched bridge events are supported");
        }

        URI endpoint;
        try {
            endpoint = URI.create(requireString(raw, "endpoint", null));
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("endpoint must be a valid URI", error);
        }
        validateEndpoint(endpoint);
        return new Registration(callbackId, endpoint, credential, worktreeId, false);
    }

    public static Object postClasspathEvent(Registration registration, Object... arguments)
            throws IOException, InterruptedException {
        Objects.requireNonNull(registration, "registration");
        Objects.requireNonNull(arguments, "arguments");
        if (arguments.length != 6) {
            throw new IllegalArgumentException("classpath event must contain six arguments");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("schemaVersion", SCHEMA_VERSION);
        body.put("requestId", REQUEST_SEQUENCE.incrementAndGet());
        body.put("callbackId", registration.callbackId());
        body.put("worktreeId", registration.worktreeId());
        body.put("arguments", arguments);
        String encoded = GsonAdapter.shared().toJson(body);
        if (encoded.getBytes(StandardCharsets.UTF_8).length > MAX_BODY_BYTES) {
            throw new IOException("bridge callback request is too large");
        }

        HttpRequest request = HttpRequest.newBuilder(registration.endpoint())
                .timeout(Duration.ofSeconds(3))
                .header("Authorization", "Bearer " + registration.credential())
                .header("Content-Type", "application/json")
                .header("X-Zed-Spring-Worktree", registration.worktreeId())
                .POST(HttpRequest.BodyPublishers.ofString(encoded))
                .build();
        HttpResponse<InputStream> response =
                HTTP.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() != 200) {
            response.body().close();
            throw new IOException("bridge callback returned HTTP " + response.statusCode());
        }
        try (InputStream responseBody = response.body()) {
            if (responseBody.readNBytes(MAX_BODY_BYTES + 1).length > MAX_BODY_BYTES) {
                throw new IOException("bridge callback response is too large");
            }
        }
        return "ok";
    }

    private static String requireString(Map<?, ?> values, String key, Pattern pattern) {
        Object value = values.get(key);
        if (!(value instanceof String text) || text.isEmpty() || text.length() > 512) {
            throw new IllegalArgumentException(key + " must be a bounded non-empty string");
        }
        if (pattern != null && !pattern.matcher(text).matches()) {
            throw new IllegalArgumentException(key + " has invalid syntax");
        }
        return text;
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
                throw new IllegalArgumentException("only non-batched bridge events are supported");
            }
        }
    }

    public static final class Registry {
        private final ConcurrentHashMap<String, Registration> registrations =
                new ConcurrentHashMap<>();

        public boolean add(Registration registration) {
            Registration previous =
                    registrations.putIfAbsent(registration.callbackId(), registration);
            if (previous == null) {
                return true;
            }
            if (!previous.equals(registration)) {
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

        public boolean remove(Registration registration) {
            if (!containsExact(registration)) {
                return false;
            }
            return registrations.remove(registration.callbackId(), registration);
        }

        public List<String> callbackIds() {
            return List.copyOf(registrations.keySet());
        }

        public void clear() {
            registrations.clear();
        }
    }

    private record GsonAdapter(Object instance, Method toJson) {
        private static final class Holder {
            private static final GsonAdapter INSTANCE = load();
        }

        static GsonAdapter shared() {
            return Holder.INSTANCE;
        }

        static GsonAdapter load() {
            try {
                Class<?> type = Class.forName("com.google.gson.Gson");
                return new GsonAdapter(type.getConstructor().newInstance(), type.getMethod("toJson", Object.class));
            } catch (ReflectiveOperationException error) {
                throw new ExceptionInInitializerError(error);
            }
        }

        String toJson(Object value) throws IOException {
            try {
                return (String) toJson.invoke(instance, value);
            } catch (IllegalAccessException | InvocationTargetException error) {
                throw new IOException("Gson could not encode a bridge callback", error);
            }
        }
    }
}
