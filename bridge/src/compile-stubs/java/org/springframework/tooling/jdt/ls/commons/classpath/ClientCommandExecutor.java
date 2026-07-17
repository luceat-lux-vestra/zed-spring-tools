package org.springframework.tooling.jdt.ls.commons.classpath;

/** Compile-only signature from Spring Tools JDT commons; excluded from the product JAR. */
public interface ClientCommandExecutor {
    Object executeClientCommand(String id, Object... parameters) throws Exception;
}
