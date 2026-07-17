package dev.zed.spring.s012;

import java.util.List;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.jdt.ls.core.internal.IDelegateCommandHandler;
import org.springframework.tooling.jdt.ls.commons.Logger;
import org.springframework.tooling.jdt.ls.commons.classpath.ReusableClasspathListenerHandler;

public final class BridgeCommandHandler implements IDelegateCommandHandler {
    static final String ADD = "zed.spring.bridge.addClasspathListener";
    static final String REMOVE = "zed.spring.bridge.removeClasspathListener";

    private static final Object LOCK = new Object();
    private static final BridgeProtocol.Registry ROUTES = new BridgeProtocol.Registry();
    private static boolean active;
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
                    (callbackId, arguments) -> BridgeProtocol.postEvent(
                            ROUTES.require(callbackId), arguments));

    @Override
    public Object executeCommand(
            String commandId,
            List<Object> arguments,
            IProgressMonitor monitor) throws Exception {
        synchronized (LOCK) {
            if (!active) {
                throw new IllegalStateException("bridge bundle is not active");
            }
            if (monitor != null && monitor.isCanceled()) {
                throw new IllegalStateException("bridge command was cancelled");
            }
            if (arguments == null || arguments.size() != 1) {
                throw new IllegalArgumentException(
                        "bridge command requires one registration object");
            }
            BridgeProtocol.Registration registration =
                    BridgeProtocol.parseRegistration(arguments.get(0));

            return switch (commandId) {
                case ADD -> add(registration);
                case REMOVE -> remove(registration);
                default -> throw new IllegalArgumentException("unknown bridge command");
            };
        }
    }

    private static Object add(BridgeProtocol.Registration registration) {
        boolean added = ROUTES.add(registration);
        if (!added) {
            return "ok";
        }
        try {
            LISTENERS.addClasspathListener(registration.callbackId(), false);
            return "ok";
        } catch (RuntimeException error) {
            ROUTES.remove(registration);
            throw error;
        }
    }

    private static Object remove(BridgeProtocol.Registration registration) {
        if (!ROUTES.containsExact(registration)) {
            return "ok";
        }
        LISTENERS.removeClasspathListener(registration.callbackId());
        ROUTES.remove(registration);
        return "ok";
    }

    static void startup() {
        synchronized (LOCK) {
            active = true;
        }
    }

    static void shutdown() {
        synchronized (LOCK) {
            active = false;
            for (String callbackId : ROUTES.callbackIds()) {
                try {
                    LISTENERS.removeClasspathListener(callbackId);
                } catch (RuntimeException ignored) {
                    // Shutdown still clears credentials and prevents route reuse.
                }
            }
            ROUTES.clear();
        }
    }
}
