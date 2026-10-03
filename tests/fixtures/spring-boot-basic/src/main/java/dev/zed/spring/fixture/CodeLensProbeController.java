package dev.zed.spring.fixture;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Dedicated static-CodeLens probe. The path-prefix predicate targets only this
 * controller, so the fixture's existing /greeting runtime route remains unchanged.
 */
@RestController
public class CodeLensProbeController {

    @GetMapping("/codelens-probe")
    public String probe() {
        return "codelens";
    }
}

@Configuration
class CodeLensProbeWebConfiguration implements WebMvcConfigurer {

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix(
                "/d007",
                HandlerTypePredicate.forAssignableType(CodeLensProbeController.class));
    }
}
