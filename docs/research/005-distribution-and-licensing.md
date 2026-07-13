# R005: Distribution and licensing

- Status: Complete
- Last updated: 2026-07-14
- Investigator: Codex
- Evidence baseline:
  - Spring Tools tag `5.2.0.RELEASE`, commit
    `18d1a975dbea4f9314fd736d0237bd9e23f243f9`
  - Zed `main` commit `96ce8f2a05f8912851e5d20d808fe21f4134bd45`

## Question

How can a Zed extension obtain pinned Spring Tools runtime artifacts, and which
licensing, provenance, integrity, and platform constraints must be resolved
before publishing or redistributing them?

## Scope

Included:

- official Spring Tools release artifacts and their contents;
- Zed extension publishing and download constraints;
- version pinning and integrity verification;
- extension-code and external-runtime license boundaries; and
- low-risk artifact strategies for feasibility spikes.

Excluded:

- a legal opinion that redistribution is permitted;
- selection of this repository's final license;
- implementation of an artifact downloader; and
- a production release or supply-chain policy.

This is a technical compliance inventory, not legal advice.

## Confirmed facts

### Zed publishing constraints

1. A published Zed extension that provides a language server must not bundle the
   server binary. It must download the server or locate it in the user's
   environment.
2. Zed's extension API can download and extract ZIP files into the extension
   working directory. Network access is controlled by declared host and path
   capabilities.
3. Zed requires the extension repository to contain a recognized license for the
   code compiled into the extension binary. Its accepted list does not include
   EPL-1.0.
4. Zed explicitly distinguishes extension code from downloaded or external
   language servers: its accepted-license rule applies to the former, not the
   latter.

Consequently, the future extension code needs its own Zed-accepted license. That
does not relicense Spring Tools and does not remove obligations attached to the
external Spring Tools artifacts.

### Official Spring Tools release artifact

The official `5.2.0.RELEASE` GitHub release, published on 2026-06-10, exposes one
asset:

| Field | Value |
| --- | --- |
| Asset | `vscode-spring-boot-2.2.0-RC1.vsix` |
| Size | 82,759,143 bytes |
| GitHub SHA-256 | `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` |
| Locally calculated SHA-256 | `70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3` |

The local digest matches the digest published by GitHub's release API.

The inspected release history exposes VSIX assets; no separately packaged,
standalone Spring Boot Language Server archive was observed. This establishes the
current official download shape, not a promise that future releases will remain
the same.

### Contents required by the current integration model

The VSIX is a ZIP archive. It contains:

- `extension/language-server/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar`;
- the server's expanded `extension/language-server/lib/` dependency directory;
- `jdt-ls-extension.jar` and `jdt-ls-commons.jar`;
- Reactor, Reactive Streams, and Gradle tooling JARs declared through
  `contributes.javaExtensions`; and
- `extension/LICENSE.txt`.

The Spring Boot Language Server is therefore not represented by the executable
JAR alone. Any spike must preserve the expected directory layout or prove a
different classpath explicitly.

The package manifest declares version `2.2.0`, license `EPL-1.0`, VS Code engine
`^1.92.0`, and dependencies on Red Hat Java and the VS Code Maven extension. The
VS Code dependencies reinforce that the VSIX as a whole cannot be treated as a
drop-in Zed extension, even though selected Java runtime artifacts can be
launched independently.

### Provenance and notice gaps

1. The final Spring Tools release tag is named `5.2.0.RELEASE`, while its only
   downloadable asset is named `2.2.0-RC1` and the embedded server JAR contains
   `2.2.0-SNAPSHOT` in its filename.
2. The VSIX license file says the package content is provided under EPL-1.0 and
   points to a detailed third-party license list in the former `sts4` repository.
3. The inspected VSIX does not contain that third-party license list.
4. At the corresponding source tag, `open-source-licenses.txt` contains only
   `work-in-progress`.

These are provenance and compliance-documentation concerns. They do not prove
that use or redistribution is forbidden, but they prevent this research from
claiming that a repackaged distribution is ready for publication.

### Runtime and platform implications

The Spring server and its inspected JDT extension components are Java archives,
so one artifact set can in principle serve Zed's supported desktop platforms.
The current server still requires a suitable Java runtime (Java 21 or newer in
the inspected VS Code launcher; see R002).

Any native proxy or coordinator introduced by Candidates B-D is a separate
distribution problem. It would require pinned builds and checksums for every
supported OS/architecture pair or a local build strategy. That obligation does
not exist for Candidate A's direct Java-process baseline.

## Primary sources

All sources were accessed on 2026-07-14.

- [Spring Tools `5.2.0.RELEASE`](https://github.com/spring-projects/spring-tools/releases/tag/5.2.0.RELEASE)
  — official release date and asset.
- [`vscode-spring-boot-2.2.0-RC1.vsix`](https://github.com/spring-projects/spring-tools/releases/download/5.2.0.RELEASE/vscode-spring-boot-2.2.0-RC1.vsix)
  — inspected official binary asset.
- [`package.json` at the release commit](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/package.json)
  — package version, license declaration, dependencies, and JDT extension JARs.
- [`LICENSE` at the release commit](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/LICENSE)
  — EPL-1.0 package license text.
- [`open-source-licenses.txt` at the release commit](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/vscode-extensions/vscode-spring-boot/open-source-licenses.txt)
  — third-party inventory status at the tag.
- [Spring Tools repository license](https://github.com/spring-projects/spring-tools/blob/18d1a975dbea4f9314fd736d0237bd9e23f243f9/license.txt)
  — repository-level EPL-1.0 text.
- [Zed: Developing Extensions](https://zed.dev/docs/extensions/developing-extensions)
  — accepted extension-code licenses, external-tool distinction, and no-bundled
  language-server rule.
- [`downloaded-file-type` and `download-file` at the inspected Zed commit](https://github.com/zed-industries/zed/blob/96ce8f2a05f8912851e5d20d808fe21f4134bd45/crates/extension_api/wit/since_v0.5.0/extension.wit)
  — ZIP extraction support and extension working-directory destination.
- [Zed: Extension Capabilities](https://zed.dev/docs/extensions/capabilities)
  — download host/path restrictions.

## Inferences

### Runtime download is preferable to repository bundling

Zed's publishing rules require this separation, and the official VSIX is already
a downloadable ZIP-compatible artifact. A future extension can plausibly fetch a
pinned official VSIX and extract the required subtree locally. The `.vsix`
filename extension should be verified against Zed's ZIP extractor in a spike;
the underlying archive format alone does not guarantee host implementation
behavior.

### Downloading the original asset is lower risk than repackaging it

Fetching the publisher's unchanged asset avoids this project becoming the
source of a modified binary and preserves its original package context. It does
not eliminate license-notice, integrity, availability, or user-consent
responsibilities.

### `latest` is not an acceptable production selector

Spring Tools, the embedded JDT bundles, JDT LS, and Java runtime form a versioned
compatibility set. Releases must be pinned by explicit tag, asset name, and
expected digest, then upgraded through a recorded compatibility test. Redirects
or release-name matching alone are insufficient.

### The current release cannot yet be approved for project-operated redistribution

The missing third-party inventory, mismatched release labels, and absence of a
standalone server artifact require clarification or a project-generated license
inventory before hosting a repackaged mirror. This is a stage-gate conclusion,
not a legal determination.

## Unverified hypotheses

1. Zed's ZIP downloader accepts a `.vsix` URL directly when the caller specifies
   `DownloadedFileType::Zip`.
2. Extracting the official VSIX without repackaging satisfies all notices needed
   for the intended distribution and usage model.
3. The embedded `2.2.0-SNAPSHOT` server was deliberately built from the final
   `5.2.0.RELEASE` source state despite its filename.
4. The listed Java archives are sufficient on macOS, Linux, and Windows without
   native dependencies hidden elsewhere in the VSIX.
5. Spring Tools maintainers can provide or regenerate the complete third-party
   component and license inventory for the release.

## Runtime verification needed

1. Download and extract the pinned VSIX through a minimal Zed development
   extension.
2. Verify the required file layout and calculate the digest before accepting or
   activating the extraction.
3. Launch the server on each intended platform with a discovered Java 21+
   runtime.
4. Record the server's reported implementation/version, not only its filename.
5. Test offline, checksum-mismatch, partial-download, and upgrade rollback paths
   before production work.

## Blockers and constraints

- Project-operated redistribution or repackaging remains blocked on a complete
  third-party license inventory and an appropriate legal/compliance review.
- The future extension repository must choose a Zed-accepted license independently
  of Spring Tools' EPL-1.0 license.
- Runtime downloads need explicit GitHub host/path capabilities and a usable
  failure path when users deny them.
- GitHub availability cannot be the only recovery strategy for offline or
  restricted environments; a user-provided local path should remain possible.
- Native coordinator candidates add per-platform binary publishing and signing
  work.

## Candidate next experiments

For S001-S005, use one of these inputs in preference order:

1. a user-supplied local path to the already downloaded official VSIX or its
   extraction;
2. a spike-only script or dev extension that downloads the exact official asset
   and verifies the recorded SHA-256; or
3. a source build from the pinned tag, only if a spike specifically needs to
   compare source and release behavior.

Do not publish, mirror, or commit the VSIX or extracted JARs during the
feasibility stage.

## Interim conclusion

The technical path for feasibility spikes is clear: pin the official VSIX,
verify its SHA-256, extract it locally, preserve the original package and license
context, and support a user-supplied path. This is sufficient to begin runtime
experiments without adding binaries to this repository.

A production distribution decision is intentionally deferred. Automatic runtime
download remains plausible, but project-operated repackaging or mirroring is not
ready for approval until the third-party license inventory and release provenance
questions are resolved.
