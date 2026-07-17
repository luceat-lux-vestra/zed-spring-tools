package org.osgi.framework;

/** Compile-only signature from OSGi Core; excluded from the product JAR. */
public interface BundleActivator {
    void start(BundleContext context) throws Exception;

    void stop(BundleContext context) throws Exception;
}
