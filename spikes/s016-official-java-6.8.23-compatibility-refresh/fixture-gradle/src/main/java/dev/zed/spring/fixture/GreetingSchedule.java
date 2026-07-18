package dev.zed.spring.fixture;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * A minimal scheduled task so the Spring language server has a cron expression to
 * annotate. Spring Tools renders a human-readable description of the cron string
 * as an inlay hint next to {@code @Scheduled(cron = ...)} when
 * {@code boot-java.cron.inlay-hints} is on, which is the concrete target the
 * inlay-hint capability needs during a driven verification run.
 */
@Component
public class GreetingSchedule {

    @Scheduled(cron = "0 0 * * * *")
    public void everyHour() {
        // Intentionally empty: the fixture only needs the annotated cron string,
        // not a running side effect.
    }
}
