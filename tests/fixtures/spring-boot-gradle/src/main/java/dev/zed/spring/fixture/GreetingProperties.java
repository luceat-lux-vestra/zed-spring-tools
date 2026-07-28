package dev.zed.spring.fixture;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * A minimal {@code @ConfigurationProperties} binding so the Spring language
 * server has an own-project property to document and navigate to. The Spring
 * Boot configuration processor emits {@code spring-configuration-metadata.json}
 * for this type at compile time; that metadata is what powers hover
 * documentation on {@code fixture.greeting.*} keys and the property-to-definition
 * jump back to the field below. Together with the built-in {@code server.*}
 * metadata that ships with the starter, it gives a driven verification run both
 * a framework-provided and a project-provided target.
 */
@ConfigurationProperties(prefix = "fixture.greeting")
public class GreetingProperties {

    /**
     * The salutation prefixed to every greeting, for example {@code hello}.
     */
    private String salutation = "hello";

    public String getSalutation() {
        return salutation;
    }

    public void setSalutation(String salutation) {
        this.salutation = salutation;
    }
}
