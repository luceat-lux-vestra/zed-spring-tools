package dev.zed.spring.fixture;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/**
 * A minimal JPA entity so the Spring language server has a managed domain type to
 * resolve inside embedded queries. Spring Data query intelligence needs an entity
 * and its fields to type-check the JPQL in {@link GreetingRepository} — the same
 * query text drives the positional-parameter inlay hint (IH-2) and the
 * {@code JPQL_SYNTAX}/{@code HQL_SYNTAX} diagnostics.
 */
@Entity
public class Greeting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String message;

    public Long getId() {
        return id;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
