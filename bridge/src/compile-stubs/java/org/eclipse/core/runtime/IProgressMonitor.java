package org.eclipse.core.runtime;

/** Compile-only signature from Eclipse Core Runtime; excluded from the product JAR. */
public interface IProgressMonitor {
    boolean isCanceled();
}
