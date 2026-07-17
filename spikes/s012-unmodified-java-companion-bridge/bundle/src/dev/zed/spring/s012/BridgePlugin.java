package dev.zed.spring.s012;

import org.osgi.framework.BundleActivator;
import org.osgi.framework.BundleContext;

public final class BridgePlugin implements BundleActivator {
    @Override
    public void start(BundleContext context) {
        BridgeCommandHandler.startup();
    }

    @Override
    public void stop(BundleContext context) {
        BridgeCommandHandler.shutdown();
    }
}
