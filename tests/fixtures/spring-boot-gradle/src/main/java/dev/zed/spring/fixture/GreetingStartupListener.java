package dev.zed.spring.fixture;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;

/**
 * Registered through {@code META-INF/spring.factories} rather than as a bean, so the
 * fixture exercises the factories file the way Spring actually loads it. The class must
 * genuinely implement the factory type: Spring instantiates every entry during startup
 * and fails the context outright on a mismatch, which would break the run/debug checks
 * that boot this fixture.
 */
public class GreetingStartupListener implements ApplicationListener<ApplicationReadyEvent> {

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        // Intentionally quiet: the registration itself is what the fixture demonstrates.
    }
}
