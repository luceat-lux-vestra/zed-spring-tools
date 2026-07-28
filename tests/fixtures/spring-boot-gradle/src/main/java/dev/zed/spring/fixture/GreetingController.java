package dev.zed.spring.fixture;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A minimal request mapping so the Spring language server has a symbol to expose.
 * Spring Tools surfaces {@code @GetMapping} as a navigable workspace symbol, which
 * is what the capability inventory's "browse the Spring logical structure" row
 * needs in order to be verified against Zed's outline panel and symbol search.
 */
@RestController
public class GreetingController {

    @GetMapping("/greeting")
    public String greeting() {
        return "hello";
    }
}
