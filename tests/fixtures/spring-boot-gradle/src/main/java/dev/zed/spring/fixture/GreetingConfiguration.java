package dev.zed.spring.fixture;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.context.annotation.Scope;

/**
 * A minimal bean definition so the Spring language server has a bean symbol to
 * expose, alongside the request mapping in {@link GreetingController}. Together
 * they give the logical-structure and bean-navigation capabilities something
 * real to act on during a driven verification run.
 */
@Configuration
public class GreetingConfiguration {

    @Bean
    public String greetingPrefix() {
        return "hello, ";
    }

    /**
     * Two more annotation-attribute completion targets, both reached by placing the
     * caret inside the string. {@code @Scope} resolves through
     * {@code ScopeCompletionProcessor}, whose proposals are the fixed scope names and
     * so need no Spring index — the cheapest canary that the Java completion route is
     * alive at all. {@code @Profile} resolves through {@code ProfileCompletionProvider},
     * which does read the index.
     *
     * <p>The bean is profile-scoped to {@code dev} so it stays absent under the default
     * profile and nothing else in the fixture can depend on it.
     */
    @Bean
    @Scope("singleton")
    @Profile("dev")
    public String greetingSuffix() {
        return "!";
    }
}
