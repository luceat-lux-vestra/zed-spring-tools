package dev.zed.spring.fixture;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableConfigurationProperties(GreetingProperties.class)
@EnableScheduling
public class FixtureApplication {
    public static void main(String[] arguments) {
        SpringApplication.run(FixtureApplication.class, arguments);
    }
}
