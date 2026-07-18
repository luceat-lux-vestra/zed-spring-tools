package dev.zed.spring.fixture;

import org.springframework.stereotype.Service;

/**
 * The sole implementation of {@link GreetingService}, registered as a Spring
 * bean so the fixture stays idiomatic. It gives
 * {@code textDocument/implementation} a single deterministic result and
 * contributes the {@code implements} reference that
 * {@code textDocument/references} on {@link GreetingService} must return.
 */
@Service
public class DefaultGreetingService implements GreetingService {

    @Override
    public String greeting() {
        return "hello";
    }
}
