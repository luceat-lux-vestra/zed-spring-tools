package dev.zed.spring.fixture;

/**
 * A minimal service interface so the Java language server has an implementation
 * relationship to resolve. "Go to Implementation" on this type (or on
 * {@link #greeting()}) navigates to {@link DefaultGreetingService}, and "Find
 * All References" on the type returns this declaration together with the
 * {@code implements} clause on that class. That pair is the concrete target the
 * references-and-implementations capability needs during a driven verification
 * run. Both are standard LSP requests ({@code textDocument/references} and
 * {@code textDocument/implementation}) served directly by the official Java
 * extension's JDT language server, not by the Spring server or this project's
 * coordinator.
 */
public interface GreetingService {

    String greeting();
}
