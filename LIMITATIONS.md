# Known limitations

This repository is ready to be reviewed as experimental source with one working
vertical slice. It is not ready to be relied on as a Spring development
extension.

- Only property completion is proven. The extension installs and starts, but
  most VS Code Spring Tools capabilities are not implemented at all.
- There is no packaged extension, installer, release artifact, product CI, or
  Marketplace entry. Installation means a local development extension.
- The disposable code under `spikes/` is evidence harness code. It is not a
  product implementation and will not be promoted directly into one.
- Only one macOS arm64/JDK 25 tuple has completed the integrated PoC. Every
  other desktop and runtime tuple is untested.
- The product requires the official Zed Java extension. It does not replace Java
  debugging, tests, tasks, project import, or other Java ownership, and it will
  not offer a reduced standalone JDT fallback.
- The coordinator depends on a private Java-provider transport that the official
  Java extension does not document as public API. A future Java extension release
  may change it and break this project. The versioned adapter narrows that risk
  but cannot remove it.
- The PoC and the M2 slice prove attributable Spring Boot property completion and
  the cleanup path. They do not prove the rest of VS Code Spring Tools capability
  parity.
- First-use Spring artifact acquisition can hang indefinitely. It was observed
  once stalling for 24 minutes with no bytes transferred, no open connection, and
  no timeout while the network was healthy, showing only an indefinite
  `Downloading zed-spring-tools...`; quitting and relaunching Zed made the same
  download finish in seconds. Zed's `download_file` API accepts no timeout, so
  this cannot currently be bounded by the extension. If acquisition appears
  stuck, restart Zed.
- The missing/incompatible-Java diagnostic is implemented and contract-tested but
  has not been observed at runtime.
- Spring client requests including `vscode-spring-boot.ls.start` and
  `sts/javaType` still need product handling and tests.
- No Spring VSIX, JAR, JDT LS distribution, Zed application, or other third-party
  binary is stored in Git. Reproduction requires separately acquired, pinned,
  checksum-verified inputs.
- The extension downloads the pinned, checksum-verified Spring Tools
  `5.2.0.RELEASE` VSIX from its official GitHub release on first use. It requires
  network access for that download and does not mirror or repackage the artifact.
- Offline installation, rollback, and project-operated redistribution remain
  undecided. Repackaging or mirroring stays blocked on a complete third-party
  license inventory and an appropriate review.
- SSH remote development and WSL-hosted remote projects are not in the initial
  product scope.

The reviewed delivery gates and remaining work are tracked in
[`docs/implementation-plan.md`](docs/implementation-plan.md).
