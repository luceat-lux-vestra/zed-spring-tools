package dev.zed.spring.fixture;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

/**
 * A Spring Data JPA repository whose {@code @Query} carries a JPQL text block with a
 * <em>positional</em> parameter ({@code ?1}). Spring Tools renders the embedded-query
 * inlay hint (IH-2) here: {@code JdtDataQueriesInlayHintsProvider} maps {@code ?1} to
 * the first method parameter and shows its name ({@code message}) as an
 * {@code InlayHintKind.Parameter} hint. This only runs when the server's
 * {@code boot-java.jpql} support is enabled — off by default, so the Zed extension
 * sends it explicitly (see {@code spring_workspace_configuration} in {@code src/lib.rs}).
 * The coordinator relays {@code textDocument/inlayHint} transparently, the same path as
 * the cron hint (IH-1).
 */
@Repository
public interface GreetingRepository extends JpaRepository<Greeting, Long> {

    @Query("""
            select g
            from Greeting g
            where g.message = ?1
            """)
    List<Greeting> findByMessage(String message);

    /**
     * A derived query whose name is the completion gesture for
     * {@code DataRepositoryPrefixSensitiveCompletionProvider}. That provider takes the
     * text from the start of the line to the caret, keeps the last Java identifier part,
     * and parses it as a partial query method name — so a caret placed inside this name,
     * right after {@code findByMessageAnd}, reproduces exactly what a developer typing
     * that far would see, without editing the buffer. Both {@link Greeting} properties
     * are legal continuations there, which is why the method is a valid derived query and
     * the repository keeps working.
     */
    List<Greeting> findByMessageAndId(String message, Long id);
}
