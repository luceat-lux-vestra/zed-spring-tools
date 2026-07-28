package dev.zed.spring.fixture;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Trigger sites for the Spring-aware Java completion families that
 * {@code BootJavaCompletionEngineConfigurer} registers by annotation type. Each
 * annotation below is already valid and the class boots normally; a driven run places
 * the caret <em>inside</em> the annotation's string and asks for completion, which is
 * how these providers are reached:
 *
 * <ul>
 * <li>{@code @Value("${...}")} → {@code ValueCompletionProcessor}, which proposes
 * property keys from the project's own metadata as well as the starter's.</li>
 * <li>{@code @Qualifier("...")} → {@code QualifierCompletionProvider}, which proposes
 * qualifiers from the Spring index — {@code greetingPrefix} in
 * {@link GreetingConfiguration} is the resolvable one here.</li>
 * </ul>
 *
 * <p>The constructor parameter also gives bean-injection completion a home: that
 * provider ({@code BeanCompletionProvider}) is the one family gated by a setting,
 * {@code boot-java.java.completions.inject-bean}, which reads false when absent even
 * though VS Code's schema defaults it true. The Zed extension therefore sends it
 * explicitly; see {@code spring_default_configuration} in {@code src/lib.rs}.
 */
@Component
public class GreetingInjection {

    @Value("${fixture.greeting.salutation}")
    private String salutation;

    private final String prefix;

    public GreetingInjection(@Qualifier("greetingPrefix") String prefix) {
        this.prefix = prefix;
    }

    public String salutation() {
        return salutation;
    }

    public String prefix() {
        return prefix;
    }
}
