package dev.zed.spring.fixture;

import org.springframework.scheduling.annotation.Scheduled;

/**
 * A deliberately invalid cron expression, so the cron <em>validation</em> capability
 * has something to diagnose. {@code JdtCronReconciler} visits every
 * {@code NormalAnnotation} carrying a cron attribute and reports
 * {@code CronProblemType.SYNTAX}/{@code FIELD} with a {@code "CRON: "} message prefix;
 * it does not require the declaring type to be a Spring bean, because reconciling
 * walks the AST rather than the registered bean set.
 *
 * <p>That distinction is the reason this class carries no stereotype annotation. An
 * unparseable cron on a real {@code @Component} would make
 * {@code ScheduledAnnotationBeanPostProcessor} throw during refresh, so the fixture
 * would stop booting — and {@link FixtureApplication} has to stay runnable for the
 * run/debug capability. Keeping the broken expression on an unregistered class gives
 * the reconciler its target while Spring never schedules the method.
 *
 * <p>Spring's cron parser requires six fields (second through day-of-week); the five
 * below are the classic Unix crontab shape and are rejected.
 */
public class CronSyntaxSample {

    @Scheduled(cron = "0 0 * * *")
    public void tooFewFields() {
        // Never invoked: this class is intentionally not a Spring bean.
    }
}
