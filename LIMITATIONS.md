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
- **The first launch on a fresh install does not work; a restart fixes it.** The
  bridge that carries Spring's classpath information into the Java language server
  is contributed at Java-server startup, but on a cold cache the Spring artifact
  download has not finished by then, so the Java server starts without the bridge
  and Spring features that need the classpath (completion, validation) stay dead.
  Quitting and reopening Zed, once the artifact is on disk, makes it work. This is
  a confirmed, reproducible startup race; the fix is undecided. See
  `docs/research/012-cold-cache-bridge-bundle-race.md`.
- **First-use Spring artifact acquisition hangs, and it reproduces.** After a
  fresh `install dev extension`, the first download stalls with no bytes
  transferred, no open connection to the release host, no timeout, and Zed idle
  at roughly zero CPU, showing only an indefinite `Downloading
  zed-spring-tools...`. Quitting and relaunching Zed makes the same download
  complete in seconds. Observed twice on 2026-07-17: once stalling 24 minutes,
  then finishing in under 12 seconds after a restart; and once stalling over 3
  minutes, then delivering 79 MB within 10 seconds of a restart. The network was
  healthy both times, verified independently at about 4.9 MB/s.
  **Workaround: if acquisition appears stuck, quit and reopen Zed.** Zed's
  `download_file` API accepts no timeout, so the extension cannot currently bound
  or retry it. The cause is not established.
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
