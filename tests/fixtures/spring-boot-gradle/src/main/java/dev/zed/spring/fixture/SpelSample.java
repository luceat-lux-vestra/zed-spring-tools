package dev.zed.spring.fixture;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;

/**
 * Targets for the SpEL language-intelligence capability: two navigable expressions and
 * three deliberately unparseable ones.
 *
 * <p>Like {@link CronSyntaxSample}, this class carries no stereotype annotation. Spring's
 * {@code JdtSpelReconciler} and {@code SpelDefinitionProvider} both walk the AST rather
 * than the registered bean set, so an unregistered class is enough for them — while an
 * unparseable {@code @Value} on a real bean would fail context refresh and stop
 * {@link FixtureApplication} from booting, which the run/debug capability depends on.
 *
 * <p>{@code SpelDefinitionProvider} resolves only {@code @Value}, and only two shapes:
 * a bean reference token ({@code @beanName}) resolved through the Spring index, and a
 * method reference whose receiver is such a bean, resolved by searching that bean's own
 * source for a matching method declaration. Neither target is derivable from Java
 * syntax, so a result on either is attributable to Spring rather than to jdtls.
 *
 * <p>The reconciler's reach is wider than {@code @Value}:
 * {@code AnnotationParamSpelExtractor.SPEL_EXTRACTORS} also covers
 * {@code @Cacheable}/{@code @CacheEvict} key/condition/unless,
 * {@code @EventListener} condition, the four Spring Security {@code @Pre*}/{@code @Post*}
 * annotations, {@code @ConditionalOnExpression}, and {@code @Scheduled} cron. The
 * {@code @EventListener} case below is the representative non-{@code @Value} extractor;
 * unlike {@code @Value} its attribute is bare SpEL with no {@code #{…}} wrapper.
 */
public class SpelSample {

    /**
     * A bean reference into {@link GreetingConfiguration#greetingPrefix()}. A caret on
     * {@code greetingPrefix} is the bean-navigation gesture.
     */
    @Value("#{@greetingPrefix}")
    private String prefixFromBean;

    /**
     * A method reference on the {@link DefaultGreetingService} bean. A caret on
     * {@code greeting} is the method-navigation gesture; the provider looks the bean up
     * in the Spring index and then finds the method declaration in that bean's source.
     */
    @Value("#{@defaultGreetingService.greeting()}")
    private String greetingFromBean;

    /**
     * A trailing operator with no right operand, so the SpEL parser reports
     * {@code JAVA_SPEL_EXPRESSION_SYNTAX} with a {@code "SPEL: "} message prefix.
     */
    @Value("#{@greetingPrefix + }")
    private String unparseableExpression;

    /**
     * A property placeholder is reconciled by a second grammar, reported as
     * {@code PROPERTY_PLACE_HOLDER_SYNTAX} with a {@code "Place-Holder: "} prefix. Its
     * key is dot-separated identifiers, so the space below ends the key and leaves the
     * rest unmatched. The placeholder has to sit outside any quoted SpEL string: the
     * SpEL lexer only emits a {@code PROPERTY_PLACE_HOLDER} token for a bare
     * {@code ${…}}, and a quoted one is lexed as an ordinary string literal.
     */
    @Value("#{${fixture greeting.salutation}}")
    private String unparseablePlaceholder;

    /**
     * A property dereference with no property name. The listener is never registered,
     * because this class is not a bean.
     */
    @EventListener(condition = "#event.")
    public void onGreetingEvent(Object event) {
        // Never invoked: this class is intentionally not a Spring bean.
    }
}
