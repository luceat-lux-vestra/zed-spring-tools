# Third-party material and boundaries

This file describes the current experimental source tree. It is not a complete
notice inventory for a future product distribution.

## No third-party runtime binaries in Git

The repository does not contain the Spring Tools VSIX or extracted JARs, JDT LS,
the official Zed Java extension or proxy binary, a Zed application, generated
WASM, or other acquired runtime artifacts. Local experiments keep those inputs
and their evidence under ignored `tmp/` paths.

## Official Zed Java extension patch experiments

S005 and S006 contain research-only patch files targeting the official
`zed-extensions/java` proxy at commit
`9148b8972c1b93fbe5512a9ecf0ba33c3182970d`. The upstream project identifies
that source as Apache License 2.0. The patch headers and adjacent `UPSTREAM.md`
files retain the exact provenance and scope. No patched proxy binary is
included, and the accepted product architecture does not use either patch.

- Upstream source: <https://github.com/zed-extensions/java>
- Fixed upstream license:
  <https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/LICENSE>
- Local provenance:
  [`spikes/s005-classpath-callback/proxy/UPSTREAM.md`](spikes/s005-classpath-callback/proxy/UPSTREAM.md)
  and
  [`spikes/s006-spring-boot-end-to-end/proxy/UPSTREAM.md`](spikes/s006-spring-boot-end-to-end/proxy/UPSTREAM.md)

## Spring Tools experiment inputs

The local PoC used the unchanged official Spring Tools `5.2.0.RELEASE` VSIX as
a separately acquired, pinned, checksum-verified input. The package identifies
its content as Eclipse Public License 1.0. Neither the VSIX nor its extracted
content is committed here, and this repository's eventual project license will
not relicense it.

The inspected release did not include the complete third-party inventory needed
to approve project-operated repackaging or mirroring. The current low-risk
boundary is user-supplied or direct acquisition of the unchanged official asset;
the production acquisition decision remains open.

See [`docs/research/005-distribution-and-licensing.md`](docs/research/005-distribution-and-licensing.md)
for exact artifact identity, checksums, primary sources, inferences, and
unresolved compliance questions.
