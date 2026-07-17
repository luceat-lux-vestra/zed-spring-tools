package dev.zed.spring.bridge;

import org.osgi.framework.BundleActivator;
import org.osgi.framework.BundleContext;

public final class BridgePlugin implements BundleActivator {
    @Override
    public void start(BundleContext context) {
        BridgeCommandHandler.activate();
    }

    @Override
    public void stop(BundleContext context) {
        BridgeCommandHandler.deactivate();
    }
}
