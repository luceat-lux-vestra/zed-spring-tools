package dev.zed.spring.s012;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

public final class BridgeProtocolSelfTest {
    private static final String CALLBACK = "sts4.classpath.BXkGBqyn";
    private static final String CREDENTIAL =
            "0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String OTHER_CREDENTIAL =
            "abcdef0123456789abcdef0123456789abcdef0123456789";
    private static final String WORKTREE =
            "ce1ccd15725f4635025436e2e97c010844f0f048000000000000000000000000";

    public static void main(String[] args) throws Exception {
        parseAndRejectInvalidRegistrations();
        enforceRegistryIdentityAndIdempotence();
        postAuthenticatedCorrelatedEvent();
        rejectRemoteErrorsWithoutCredentialDisclosure();
        enforceCallbackDeadline();
        System.out.println("S012 bridge protocol self-test: PASS");
    }

    private static void parseAndRejectInvalidRegistrations() {
        Map<String, Object> valid = registration(43123, CREDENTIAL);
        BridgeProtocol.Registration parsed =
                BridgeProtocol.parseRegistration(valid);
        assertEquals(CALLBACK, parsed.callbackId(), "callback");
        assertEquals("127.0.0.1", parsed.endpoint().getHost(), "host");
        assertEquals(WORKTREE, parsed.worktreeId(), "worktree");

        Map<String, Object> remote = new HashMap<>(valid);
        remote.put("endpoint", "http://example.com:43123/v1/classpath");
        expectFailure(() -> BridgeProtocol.parseRegistration(remote), "loopback");

        Map<String, Object> unknown = new HashMap<>(valid);
        unknown.put("extra", true);
        expectFailure(() -> BridgeProtocol.parseRegistration(unknown), "keys");

        Map<String, Object> shortCredential = new HashMap<>(valid);
        shortCredential.put("credential", "short");
        expectFailure(
                () -> BridgeProtocol.parseRegistration(shortCredential),
                "credential");

        Map<String, Object> batched = new HashMap<>(valid);
        batched.put("batched", true);
        expectFailure(() -> BridgeProtocol.parseRegistration(batched), "non-batched");
    }

    private static void enforceRegistryIdentityAndIdempotence() {
        BridgeProtocol.Registry registry = new BridgeProtocol.Registry();
        BridgeProtocol.Registration first =
                BridgeProtocol.parseRegistration(registration(43123, CREDENTIAL));
        BridgeProtocol.Registration mismatch =
                BridgeProtocol.parseRegistration(registration(43123, OTHER_CREDENTIAL));

        assertTrue(registry.add(first), "first add");
        assertTrue(!registry.add(first), "idempotent add");
        assertTrue(registry.containsExact(first), "exact registration");
        expectFailure(() -> registry.add(mismatch), "already registered");
        expectFailure(() -> registry.containsExact(mismatch), "does not match");
        expectFailure(() -> registry.remove(mismatch), "does not match");
        assertTrue(registry.remove(first), "first remove");
        assertTrue(!registry.remove(first), "idempotent remove");
    }

    private static void postAuthenticatedCorrelatedEvent() throws Exception {
        AtomicReference<JsonObject> captured = new AtomicReference<>();
        HttpServer server = startServer(exchange -> {
            assertEquals(
                    "Bearer " + CREDENTIAL,
                    exchange.getRequestHeaders().getFirst("Authorization"),
                    "authorization");
            assertEquals(
                    WORKTREE,
                    exchange.getRequestHeaders().getFirst("X-Zed-Spring-Worktree"),
                    "worktree header");
            JsonObject body = JsonParser.parseString(
                    new String(
                            exchange.getRequestBody().readAllBytes(),
                            StandardCharsets.UTF_8))
                    .getAsJsonObject();
            captured.set(body);
            respond(exchange, 200, "{\"result\":\"done\"}");
        });
        try {
            int port = server.getAddress().getPort();
            BridgeProtocol.Registration registration =
                    BridgeProtocol.parseRegistration(registration(port, CREDENTIAL));
            Object result = BridgeProtocol.postEvent(
                    registration,
                    "project",
                    Map.of("entries", 3),
                    true,
                    25,
                    "maven",
                    "file:///fixture");
            assertEquals("done", result, "callback result");
            JsonObject body = captured.get();
            assertEquals(CALLBACK, body.get("callbackId").getAsString(), "body callback");
            assertEquals(WORKTREE, body.get("worktreeId").getAsString(), "body worktree");
            assertEquals(6, body.getAsJsonArray("arguments").size(), "argument count");
            assertTrue(!body.toString().contains(CREDENTIAL), "credential redaction");
        } finally {
            server.stop(0);
        }
    }

    private static void rejectRemoteErrorsWithoutCredentialDisclosure() throws Exception {
        HttpServer server = startServer(
                exchange -> respond(exchange, 500, "{\"error\":\"denied\"}"));
        try {
            BridgeProtocol.Registration registration =
                    BridgeProtocol.parseRegistration(
                            registration(server.getAddress().getPort(), CREDENTIAL));
            try {
                BridgeProtocol.postEvent(registration, 1, 2, 3, 4, 5, 6);
                throw new AssertionError("expected HTTP failure");
            } catch (IOException expected) {
                assertTrue(!expected.getMessage().contains(CREDENTIAL), "error redaction");
                assertTrue(expected.getMessage().contains("HTTP 500"), "HTTP status");
            }
        } finally {
            server.stop(0);
        }
    }

    private static void enforceCallbackDeadline() throws Exception {
        HttpServer server = startServer(exchange -> {
            try {
                Thread.sleep(3500);
                respond(exchange, 200, "{\"result\":\"late\"}");
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } catch (IOException ignored) {
                // Expected when the client deadline closes the exchange.
            }
        });
        try {
            BridgeProtocol.Registration registration =
                    BridgeProtocol.parseRegistration(
                            registration(server.getAddress().getPort(), CREDENTIAL));
            long start = System.nanoTime();
            try {
                BridgeProtocol.postEvent(registration, 1, 2, 3, 4, 5, 6);
                throw new AssertionError("expected timeout");
            } catch (IOException expected) {
                long elapsedMillis = (System.nanoTime() - start) / 1_000_000;
                assertTrue(elapsedMillis >= 2500, "timeout lower bound");
                assertTrue(elapsedMillis < 5000, "timeout upper bound");
                assertTrue(!expected.getMessage().contains(CREDENTIAL), "timeout redaction");
            }
        } finally {
            server.stop(0);
        }
    }

    private static HttpServer startServer(ExchangeHandler handler) throws IOException {
        HttpServer server =
                HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(BridgeProtocol.EVENT_PATH, exchange -> {
            try {
                handler.handle(exchange);
            } catch (Throwable error) {
                try {
                    respond(exchange, 500, "{\"error\":\"test-handler\"}");
                } catch (IOException ignored) {
                    // The assertion is rethrown after closing the exchange.
                }
                if (error instanceof RuntimeException runtime) {
                    throw runtime;
                }
                if (error instanceof Error fatal) {
                    throw fatal;
                }
                throw new RuntimeException(error);
            } finally {
                exchange.close();
            }
        });
        server.start();
        return server;
    }

    private static Map<String, Object> registration(int port, String credential) {
        Map<String, Object> registration = new HashMap<>();
        registration.put("schemaVersion", 1);
        registration.put("callbackId", CALLBACK);
        registration.put(
                "endpoint",
                "http://127.0.0.1:" + port + BridgeProtocol.EVENT_PATH);
        registration.put("credential", credential);
        registration.put("worktreeId", WORKTREE);
        registration.put("batched", false);
        return registration;
    }

    private static void respond(HttpExchange exchange, int status, String body)
            throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static void expectFailure(CheckedRunnable action, String messagePart) {
        try {
            action.run();
            throw new AssertionError("expected failure containing " + messagePart);
        } catch (Exception expected) {
            assertTrue(
                    expected.getMessage() != null
                            && expected.getMessage().contains(messagePart),
                    "failure message: " + messagePart);
        }
    }

    private static void assertTrue(boolean condition, String label) {
        if (!condition) {
            throw new AssertionError(label);
        }
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!expected.equals(actual)) {
            throw new AssertionError(
                    label + ": expected=" + expected + ", actual=" + actual);
        }
    }

    @FunctionalInterface
    private interface CheckedRunnable {
        void run() throws Exception;
    }

    @FunctionalInterface
    private interface ExchangeHandler {
        void handle(HttpExchange exchange) throws Exception;
    }
}
