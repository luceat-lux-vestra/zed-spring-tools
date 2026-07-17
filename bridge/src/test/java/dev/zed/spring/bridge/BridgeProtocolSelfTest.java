package dev.zed.spring.bridge;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

public final class BridgeProtocolSelfTest {
    private BridgeProtocolSelfTest() {}

    public static void main(String[] arguments) {
        Map<String, Object> value = registration("A".repeat(43));
        BridgeProtocol.Registration parsed = BridgeProtocol.parseRegistration(value);
        require(parsed.callbackId().equals("sts4.classpath.AbCdEfGh"), "callback ID");
        require(parsed.endpoint().equals(URI.create("http://127.0.0.1:43121/v1/classpath")), "endpoint");

        BridgeProtocol.Registry registry = new BridgeProtocol.Registry();
        require(registry.add(parsed), "first add");
        require(!registry.add(parsed), "idempotent add");
        require(registry.containsExact(parsed), "exact registration");
        require(registry.remove(parsed), "remove");
        require(!registry.remove(parsed), "idempotent remove");

        expectFailure(() -> BridgeProtocol.parseRegistration(registration("short")));
        Map<String, Object> extra = registration("B".repeat(43));
        extra.put("unexpected", true);
        expectFailure(() -> BridgeProtocol.parseRegistration(extra));
        Map<String, Object> remote = registration("C".repeat(43));
        remote.put("endpoint", "http://example.com:43121/v1/classpath");
        expectFailure(() -> BridgeProtocol.parseRegistration(remote));
        System.out.println("bridge protocol self-test passed");
    }

    private static Map<String, Object> registration(String credential) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("schemaVersion", 1);
        value.put("callbackId", "sts4.classpath.AbCdEfGh");
        value.put("endpoint", "http://127.0.0.1:43121/v1/classpath");
        value.put("credential", credential);
        value.put("worktreeId", "d".repeat(64));
        value.put("batched", false);
        return value;
    }

    private static void expectFailure(Runnable runnable) {
        try {
            runnable.run();
            throw new AssertionError("expected failure");
        } catch (IllegalArgumentException expected) {
            // Expected.
        }
    }

    private static void require(boolean condition, String label) {
        if (!condition) {
            throw new AssertionError(label);
        }
    }
}
