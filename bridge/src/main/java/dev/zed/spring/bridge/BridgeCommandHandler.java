package dev.zed.spring.bridge;

import java.util.List;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;
import org.springframework.tooling.jdt.ls.commons.Logger;
import org.springframework.tooling.jdt.ls.commons.classpath.ReusableClasspathListenerHandler;

public final class BridgeCommandHandler implements IDelegateCommandHandler {
    public static final String ADD = "zed.spring.bridge.v1.addClasspathListener";
    public static final String REMOVE = "zed.spring.bridge.v1.removeClasspathListener";

    private static final Object LOCK = new Object();
    private static final BridgeProtocol.Registry REGISTRY = new BridgeProtocol.Registry();
    private static final Logger REDACTING_LOGGER = new Logger() {
        @Override
        public void debug(String message) {}

        @Override
        public void log(String message) {}

        @Override
        public void log(Exception error) {}
    };
    private static final ReusableClasspathListenerHandler LISTENERS =
            new ReusableClasspathListenerHandler(
                    REDACTING_LOGGER,
                    (callbackId, arguments) ->
                            BridgeProtocol.postClasspathEvent(
                                    REGISTRY.require(callbackId), arguments));

    private static boolean active;

    @Override
    public Object executeCommand(
            String commandId, List<Object> arguments, IProgressMonitor monitor) throws Exception {
        synchronized (LOCK) {
            requireActive(monitor);
            if (arguments == null || arguments.size() != 1) {
                throw new IllegalArgumentException("bridge command requires one registration");
            }
            BridgeProtocol.Registration registration =
                    BridgeProtocol.parseRegistration(arguments.getFirst());
            return switch (commandId) {
                case ADD -> add(registration);
                case REMOVE -> remove(registration);
                default -> throw new IllegalArgumentException("unknown bridge command");
            };
        }
    }

    static void activate() {
        synchronized (LOCK) {
            active = true;
        }
    }

    static void deactivate() {
        synchronized (LOCK) {
            active = false;
            for (String callbackId : REGISTRY.callbackIds()) {
                try {
                    LISTENERS.removeClasspathListener(callbackId);
                } catch (RuntimeException ignored) {
                    // Route credentials are cleared even if upstream disposal fails.
                }
            }
            REGISTRY.clear();
        }
    }

    private static Object add(BridgeProtocol.Registration registration) {
        if (!REGISTRY.add(registration)) {
            return "ok";
        }
        try {
            LISTENERS.addClasspathListener(registration.callbackId(), false);
            return "ok";
        } catch (RuntimeException error) {
            REGISTRY.remove(registration);
            throw error;
        }
    }

    private static Object remove(BridgeProtocol.Registration registration) {
        if (!REGISTRY.containsExact(registration)) {
            return "ok";
        }
        LISTENERS.removeClasspathListener(registration.callbackId());
        REGISTRY.remove(registration);
        return "ok";
    }

    private static void requireActive(IProgressMonitor monitor) {
        if (!active) {
            throw new IllegalStateException("bridge bundle is not active");
        }
        if (monitor != null && monitor.isCanceled()) {
            throw new IllegalStateException("bridge command was cancelled");
        }
    }
}
