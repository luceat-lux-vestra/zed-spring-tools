package dev.zed.spring.fixture;

import java.util.List;

import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.EntityManager;

/**
 * Targets for Spring Data query intelligence: three deliberately unparseable queries and
 * two navigable ones.
 *
 * <p>Like {@link SpelSample} and {@link CronSyntaxSample} this type is not a bean — and
 * here that matters twice over. It is a plain interface rather than a
 * {@code Repository}, so Spring Data never derives an implementation for it and a broken
 * query cannot fail context refresh, which would stop {@link FixtureApplication} from
 * booting. {@code QueryJdtAstReconciler} needs none of that: it visits every annotation
 * in the AST and reconciles whatever {@code JdtQueryVisitorUtils} recognises as a query,
 * independent of the registered repository set. The valid derived-query method that the
 * completion gesture needs lives in {@link GreetingRepository}, because
 * {@code DataRepositoryCompletionProcessor} resolves the declaring type's
 * {@code Repository} interface to find the domain type.
 *
 * <p>Which grammar reconciles a query is decided by the project's dependencies, not by
 * the annotation. {@code QueryJdtAstReconciler.getQueryReconciler} picks HQL when
 * {@code hibernate-core} is on the classpath and JPQL otherwise, so this fixture — which
 * gets Hibernate transitively through {@code spring-boot-starter-data-jpa} — reports
 * {@code HQL_SYNTAX}. A native query goes to a SQL grammar chosen the same way:
 * MySQL for a MySQL/MariaDB driver, PostgreSQL for PostgreSQL <em>or</em> H2, and this
 * fixture's H2 runtime driver therefore selects the PostgreSQL parser and
 * {@code SQL_SYNTAX}.
 *
 * <p>The whole surface is gated on {@code boot-java.jpql}, which the server reads as
 * false when the key is absent; the extension sends it (see
 * {@code spring_workspace_configuration} in {@code src/lib.rs}). The diagnostics are
 * additionally gated on the {@code data-query} problem category, whose absent-key path
 * falls back to its own {@code ON} default and so needs nothing from the extension.
 */
public interface DataQuerySample {

    /**
     * A trailing {@code where} with no predicate. The query reconciler reports
     * {@code HQL_SYNTAX} on the annotation's string literal.
     */
    @Query("select g from Greeting g where")
    List<Greeting> unparseableQuery(String message);

    /**
     * The same shape in a native query, written as a {@code NormalAnnotation} so
     * {@code nativeQuery = true} can select the SQL grammar instead. Reported as
     * {@code SQL_SYNTAX}.
     */
    @Query(value = "select * from greeting where", nativeQuery = true)
    List<Greeting> unparseableNativeQuery(Long id);

    /**
     * Positional parameters. A caret on {@code 1} or {@code 2} is the navigation gesture:
     * {@code DataQueryParameterDefinitionProvider} takes the {@code parameter} semantic
     * token under the caret and maps the ordinal to that method parameter, so
     * {@code ?1} resolves to {@code message} and {@code ?2} to {@code id}. The same token
     * stream drives the {@code ?1} inlay hint already verified in
     * {@link GreetingRepository}.
     */
    @Query("select g from Greeting g where g.message = ?1 and g.id = ?2")
    List<Greeting> positionalParameters(String message, Long id);

    /**
     * A named parameter. {@code findParameter} parses the token text as an ordinal first
     * and falls back to matching a parameter's identifier, which is the branch a caret on
     * {@code message} here exercises. Named parameters carry no inlay hint — that
     * provider requires the token to follow a {@code ?} operator — so navigation is the
     * only surface this method has.
     */
    @Query("select g from Greeting g where g.message = :message")
    List<Greeting> namedParameter(String message);

    /**
     * A query written outside any annotation. {@code JdtQueryVisitorUtils} also matches a
     * {@code createQuery} invocation on {@code jakarta.persistence.EntityManager}, so the
     * reconciler's reach is wider than {@code @Query} — the same kind of finding as the
     * SpEL reconciler covering {@code @EventListener}. Static so the fixture needs no
     * instance, and never called.
     */
    static List<Greeting> unparseableEntityManagerQuery(EntityManager entityManager) {
        return entityManager.createQuery("select g from Greeting g where", Greeting.class).getResultList();
    }
}
