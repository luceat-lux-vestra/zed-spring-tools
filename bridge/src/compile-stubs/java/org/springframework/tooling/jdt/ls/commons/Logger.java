package org.springframework.tooling.jdt.ls.commons;

/** Compile-only signature from Spring Tools JDT commons; excluded from the product JAR. */
public interface Logger {
    void debug(String message);

    void log(String message);

    void log(Exception error);
}
