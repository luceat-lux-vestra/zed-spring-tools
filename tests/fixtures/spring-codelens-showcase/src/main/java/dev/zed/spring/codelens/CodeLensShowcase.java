package dev.zed.spring.codelens;

import static org.springframework.web.servlet.function.RequestPredicates.GET;
import static org.springframework.web.servlet.function.RouterFunctions.route;
import static org.springframework.web.servlet.function.ServerResponse.ok;

import java.util.List;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;

/**
 * A single inspection point for the CodeLens families that can appear in a
 * Spring Java file. Open this file in Zed with {@code "code_lens": "on"}; the
 * numbered markers below map to {@code docs/code-lens-showcase.md}.
 *
 * <p>Not every lens appears at once. JDT reference lenses need the official
 * Java setting, Data lenses change after AOT metadata is generated, and live
 * lenses need a connected running app. Zed Spring Tools enables the static
 * Spring provider families during language-server startup.
 */
@SpringBootApplication
@RestController
public class CodeLensShowcase {

    private final GreetingService greetingService;

    // CL-5a: CopilotCodeLensProvider offers a SpEL explanation lens.
    @Value("#{T(java.lang.Math).max(2, 5)}")
    private int sampleLimit;

    // CL-7c: with a connected app, Spring live Hover reports the runtime
    // property value and source. This is not the CL-5a AI explanation feature.
    @Value("${CODELENS_SAMPLE_LIMIT}")
    private int configuredSampleLimit;

    // CL-7: a connected app can report bean/injection information here.
    public CodeLensShowcase(GreetingService greetingService) {
        this.greetingService = greetingService;
    }

    public static void main(String[] arguments) {
        SpringApplication.run(CodeLensShowcase.class, arguments);
    }

    // CL-1: JDT reference count.
    // CL-7: connected-app endpoint URL and live hover detail.
    @GetMapping("/codelens-showcase")
    public String annotatedEndpoint() {
        return greetingService.greeting()
                + " (limits=" + sampleLimit + "," + configuredSampleLimit + ")";
    }

    // CL-6: the intentionally old static-import form can offer AI conversion
    // to RouterFunctions.route().GET(...).build().
    @Bean
    RouterFunction<ServerResponse> staticImportRouter() {
        return route(GET("/functional-codelens-showcase"),
                this::functionalHandler);
    }

    // CL-2: WebfluxHandlerCodeLensProvider shows the HTTP method/path for a
    // handler referenced by a functional route. It is not the annotated MVC
    // endpoint summary that the old marker implied.
    ServerResponse functionalHandler(ServerRequest request) {
        return ok().body(greetingService.greeting());
    }
}

/**
 * CL-3 target. The lens appears above the CodeLensShowcase controller class,
 * not above annotatedEndpoint, and links here.
 */
@Configuration
class CodeLensShowcaseWebConfiguration implements WebMvcConfigurer {

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer.addPathPrefix("/api", HandlerTypePredicate.forAnnotation(RestController.class));
    }
}

/**
 * CL-4: the derived method gains query text, generated-implementation,
 * turn-into-{@code @Query}, and AOT-refresh lenses after process-aot. The
 * annotated method is also a CL-5b AI query-explanation target.
 */
interface CodeLensShowcaseRepository extends JpaRepository<CodeLensShowcaseEntity, Long> {

    // CL-4b: after process-aot, the generated query text appears above this method.
    // CL-4c: Turn into @Query adds an explicit annotation to this disposable source.
    // CL-4d: Go To Implementation must open the Spring-resolved generated target in
    //         one click after the coordinator rewrites it to a Zed location command.
    // CL-4e: Refresh AOT Metadata reruns the Maven process-aot goal.
    List<CodeLensShowcaseEntity> findByMessageContainingIgnoreCase(String fragment);

    @Query("select item from CodeLensShowcaseEntity item where item.message = ?1")
    List<CodeLensShowcaseEntity> findExactly(String message);
}

@Entity
class CodeLensShowcaseEntity {

    @Id
    @GeneratedValue
    private Long id;

    private String message;

    protected CodeLensShowcaseEntity() {
    }
}

interface GreetingService {

    String greeting();
}

@Service
class DefaultGreetingService implements GreetingService {

    @Override
    public String greeting() {
        return "hello";
    }
}

/** CL-5c: an AOP annotation is another AI-explanation lens target. */
@Aspect
@Component
class CodeLensShowcaseAspect {

    @Pointcut("execution(* dev.zed.spring.codelens.CodeLensShowcase.*(..))")
    void showcaseOperations() {
    }

    @Before("showcaseOperations()")
    void beforeShowcaseOperation() {
    }
}
