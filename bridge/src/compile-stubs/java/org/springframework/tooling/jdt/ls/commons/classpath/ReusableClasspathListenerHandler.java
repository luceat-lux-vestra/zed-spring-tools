package org.springframework.tooling.jdt.ls.commons.classpath;

import org.springframework.tooling.jdt.ls.commons.Logger;

/** Compile-only signature from Spring Tools JDT commons; excluded from the product JAR. */
public class ReusableClasspathListenerHandler {
    public ReusableClasspathListenerHandler(Logger logger, ClientCommandExecutor connection) {}

    public Object addClasspathListener(String callbackCommandId, boolean batched) {
        throw new UnsupportedOperationException("compile-only stub");
    }

    public Object removeClasspathListener(String callbackCommandId) {
        throw new UnsupportedOperationException("compile-only stub");
    }
}
