# Known limitations

This repository is ready to be reviewed as experimental PoC source, not used as
a Spring development extension.

- There is no production extension manifest, packaged extension, installer,
  release artifact, or Marketplace entry.
- The disposable code under `spikes/` is evidence harness code. It is not a
  product implementation and will not be promoted directly into one.
- Only one macOS arm64/JDK 25 tuple has completed the integrated PoC. Every
  other desktop and runtime tuple is untested.
- The future product requires the official Zed Java extension. It does not
  replace Java debugging, tests, tasks, project import, or other Java ownership,
  and it will not offer a reduced standalone JDT fallback.
- The current coordination proof observes a private Java-provider transport.
  A product compatibility adapter and regression table are required because a
  future Java extension release may change that transport.
- The PoC proves one attributable Spring Boot property completion and cleanup
  path. It does not prove the rest of VS Code Spring Tools capability parity.
- Spring client requests including `vscode-spring-boot.ls.start` and
  `sts/javaType` still need product handling and tests.
- No Spring VSIX, JAR, JDT LS distribution, Zed application, or other third-party
  binary is stored in Git. Reproduction requires separately acquired, pinned,
  checksum-verified inputs.
- Automatic Spring artifact acquisition, offline installation, rollback,
  notices, and project-operated redistribution are undecided. Repackaging or
  mirroring remains blocked on a complete third-party license inventory and an
  appropriate review.
- SSH remote development and WSL-hosted remote projects are not in the initial
  product scope.

The reviewed delivery gates and remaining work are tracked in
[`docs/implementation-plan.md`](docs/implementation-plan.md).
