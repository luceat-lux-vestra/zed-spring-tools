# S010 disposable inputs

This directory contains only S010 feasibility infrastructure. It is not a
product extension, launcher, installer, or cache manager.

- `extension/private_configuration.patch` targets only Java extension commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d` and `src/jdtls.rs`.
- `fixture/S010Fixture.java` is the dependency-free Gate C Java input.
- `tools/PrepareS010.java` performs Gate A contract/self-tests and will be
  extended only within the reviewed Gate B boundary.

Gate A reproduction:

```text
javac -Xlint:all -d <ignored-classes> \
  spikes/s010-explicit-equinox-configuration-area/tools/PrepareS010.java
java -cp <ignored-classes> PrepareS010 --self-test
java -cp <ignored-classes> PrepareS010 --gate-a \
  <repository-root> <clean-fixed-java-checkout> <fresh-ignored-evidence-dir>
```

The Gate A command runs `git apply --check`; it does not apply the patch, build
the extension, prepare a Zed profile, or launch Zed/JDT.
