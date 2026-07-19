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
}
