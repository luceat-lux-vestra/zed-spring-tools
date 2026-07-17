package org.eclipse.jdt.ls.core.internal;

import java.util.List;
import org.eclipse.core.runtime.IProgressMonitor;

/** Compile-only signature from Eclipse JDT LS; excluded from the product JAR. */
public interface IDelegateCommandHandler {
    Object executeCommand(String commandId, List<Object> arguments, IProgressMonitor monitor)
            throws Exception;
}
