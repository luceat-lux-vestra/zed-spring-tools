# S011 disposable preparation

This directory contains only the preparation and verification tool for the
reviewed S011 integrated local PoC. It is not a product extension, installer,
launcher, server manager, or release package.

`tools/PrepareS011.java` combines read-only, fixed S010 and freshly prepared
S006 inputs into seven wholly fresh ignored roots: one isolated Zed profile,
one Spring Boot fixture worktree, four XDG roots, and one evidence directory.
It independently verifies the patched Java component, pristine JDT tree,
instrumented Java proxy, S006 adapter component, Spring server and its closed
168-library set, five JDT bundles, JDK, extension index, catalog, runtime-path
derivation, fresh-state allowlists, token absence, and process absence.

Compile and run its synthetic checks with Java 21 or newer:

```text
javac --release 21 -Xlint:all -Werror -d <ignored-classes> \
  spikes/s011-integrated-spring-boot-local-poc/tools/PrepareS011.java
java -cp <ignored-classes> PrepareS011 --self-test
```

The production preparation form and argument order are printed when the tool
is invoked without arguments. Every destination must be a distinct, absent,
direct child of repository `tmp/` whose basename starts with `s011`. The tool
does not launch Zed or either language server and does not perform UI
automation.
