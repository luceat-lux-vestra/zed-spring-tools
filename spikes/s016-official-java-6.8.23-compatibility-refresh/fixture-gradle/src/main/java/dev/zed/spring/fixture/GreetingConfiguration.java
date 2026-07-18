package dev.zed.spring.fixture;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

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
}
