# S010 disposable inputs

This directory contains only S010 feasibility infrastructure. It is not a
product extension, launcher, installer, or cache manager.

- `extension/private_configuration.patch` targets only Java extension commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d` and `src/jdtls.rs`.
- `fixture/S010Fixture.java` is the dependency-free Gate C Java input.
- `tools/PrepareS010.java` performs the Gate A contract/self-tests and the
  reviewed Gate B fixed-input, extraction, and transactional profile checks.

Gate A reproduction:

```text
javac -Xlint:all -d <ignored-classes> \
  spikes/s010-explicit-equinox-configuration-area/tools/PrepareS010.java
java -cp <ignored-classes> PrepareS010 --self-test
java -cp <ignored-classes> PrepareS010 --gate-a \
  <repository-root> <clean-fixed-java-checkout> <fresh-ignored-evidence-dir>
```

The Gate A command runs `git apply --check --unidiff-zero`; it does not apply
the patch, build the extension, prepare a Zed profile, or launch Zed/JDT.

Gate B reproduction uses the same compiled class and the explicit `--gate-b`
arguments printed by its usage message. It accepts separate fixed control and
patched checkouts/WASM files plus the pinned S009/S003/S008 inputs, and requires
seven fresh direct children of repository `tmp/` for the profile, Unicode
worktree, four XDG roots, and evidence. It canonicalizes the Java-only extension
index, requires Zed component-model WASM headers, verifies every fixed identity,
extracts a pristine JDT tree, and moves the prepared roots transactionally. The
corrected fixed build command targets `wasm32-wasip2`, matching the exact Zed
1.10.3 extension builder. Gate B itself does not launch Zed, the proxy, JDT LS,
Spring Tools, or UI automation. Gate C subsequently passed on macOS arm64/JDK
25; its raw host evidence remains under ignored `tmp/` paths.
