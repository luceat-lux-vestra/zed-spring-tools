# Third-party material and boundaries

This file covers both things a release of this project puts in front of a user:
the experimental source tree, and the WebAssembly binary the Zed extension
registry builds from it. It is not a complete notice inventory for a future
repackaged product distribution, which remains an open question — see the Spring
Tools section below.

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

This extension downloads the unchanged official Spring Tools VSIX as a separately
acquired, pinned, checksum-verified input. The pin is **`5.3.0.RELEASE`**
(`vscode-spring-boot-2.3.0-RC2.vsix`) since 2026-08-01; the local PoC and every
gate before that date used `5.2.0.RELEASE` (`vscode-spring-boot-2.2.0-RC1.vsix`).
Neither VSIX nor its extracted content is committed here, and this repository's
eventual project license will not relicense it.

The licensing input was re-read when the pin moved rather than carried over. In
the `5.3.0.RELEASE` package, `extension/package.json` declares `"license":
"EPL-1.0"`, and `extension/LICENSE.txt` is **byte-identical** to the file already
inspected in `5.2.0.RELEASE` (11,615 bytes). So the Eclipse Public License 1.0
characterisation above is verified against the artifact now shipped, not
inherited from the previous one.

**A third-party inventory does ship, and it covers part of the package.** The
language server jar carries `META-INF/third-party-open-source-licenses.txt`, a
per-artifact list naming groupId, artifactId, version and license: **243
artifacts in `5.3.0.RELEASE`** and 244 in `5.2.0.RELEASE`, the difference being
the dependency movement the refresh audit recorded. An earlier version of this
file said no such inventory existed; that was read from the VSIX tree, which has
no package-level notice file, and it missed the one inside the jar.

What is still missing is coverage of the rest of the package: the seven other
bundled jars — `commons-lsp-extensions`, `jdt-ls-commons`, `jdt-ls-extension`,
`xml-ls-extension`, `sts-gradle-tooling`, `reactor-core` and
`reactive-streams` — carry no notice or license file of their own, and the VSIX
has none at the package level. So the inventory is real but partial, which is
not the same as absent and still not enough to approve project-operated
repackaging or mirroring. The current low-risk boundary is user-supplied or
direct acquisition of the unchanged official asset; the production acquisition
decision remains open.

See [`docs/research/005-distribution-and-licensing.md`](docs/research/005-distribution-and-licensing.md)
for exact artifact identity, checksums, primary sources, inferences, and
unresolved compliance questions.

## Tree-sitter properties grammar

`extension.toml` declares one grammar dependency so Zed can classify
`*.factories` and `jpa-named-queries.properties` as their own languages — Zed
routes a file to a language server only through a language, and a language
requires a grammar.

- Upstream source:
  <https://github.com/tree-sitter-grammars/tree-sitter-properties>
- Pinned revision: `579b62f5ad8d96c2bb331f07d1408c92767531d9` (upstream v0.3.0, the same revision the official Java extension pins)
- Upstream license: MIT
- Local use: the two `languages/*/highlights.scm` files are adapted from that
  repository's `queries/highlights.scm`.

Zed fetches and builds this grammar at extension install time. No grammar source
or generated parser is committed here.

## Rust dependencies compiled into the distributed WebAssembly

This repository commits no binary, but the extension registry builds
`zed-spring-tools` from this source on its own runners and serves the resulting
`extension.wasm` to every user. The Rust dependency tree is statically linked
into that binary, so those crates are redistributed even though they appear here
only as a lockfile. They are listed for that reason.

`Cargo.lock` is the authoritative pinned set: 104 packages besides this crate,
all resolved through crates.io with a recorded checksum. The four direct
dependencies are:

| Crate | Version | License |
| --- | --- | --- |
| `zed_extension_api` | 0.7.0 | Apache-2.0 |
| `flate2` | 1.1.9 | MIT OR Apache-2.0 |
| `sha2` | 0.11.0 | MIT OR Apache-2.0 |
| `zip` | 7.1.0 | MIT |

Across the whole locked tree, all 104 packages were read from the local cargo
registry cache and every one carries a permissive license: `MIT OR Apache-2.0`
and its orderings dominate (54), alongside `Unicode-3.0` for the 18 ICU crates,
`Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT` for the 12 `rustix`-family
crates, `Zlib` for `foldhash`, `0BSD OR MIT OR Apache-2.0` for `adler2`,
`MIT OR Zlib OR Apache-2.0` for `miniz_oxide`, `Unlicense OR MIT` for `memchr`,
`(MIT OR Apache-2.0) AND Unicode-3.0` for `unicode-ident`, and
`MIT OR Apache-2.0 OR LGPL-2.1-or-later` for `r-efi`, whose disjunction permits
taking MIT or Apache-2.0. No copyleft-only license appears, and no package leaves
its license field unstated.

The two packages this section previously recorded as **unread rather than
cleared** are both resolved. `derive_arbitrary` 1.4.2 left the tree with `zip`
6.x, together with `arbitrary` 1.4.2, which is why the count fell from 106 to
104. `linux-raw-sys` 0.12.1 is now present in the local cache and reads
`Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT`. Nothing in the current
tree rests on an inference from the target rather than a license reading.

The Java bridge under `bridge/` is this project's own source, compiled by
`build.rs` with `javac --release 21` and embedded in the WASM. It adds no
third-party dependency.
