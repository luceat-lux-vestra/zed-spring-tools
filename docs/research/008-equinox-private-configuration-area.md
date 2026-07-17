# R008: Equinox private configuration-area attribution

- Status: Complete
- Last updated: 2026-07-17
- Investigator: Codex
- Fixed evidence: S009 Gate C, Java extension commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, JDT LS
  `1.60.0-202606262232`, Equinox OSGi `3.24.300.v20260612-1540`

## Question

Why did S009 create `configuration/` inside the fixed JDT LS distribution even
though the Java extension selected `config_mac_arm` as a read-only shared
configuration, and what is the narrowest attributable experiment that can keep
the fixed distribution immutable?

## Scope

Included:

- the exact Java extension launch construction used by S009;
- the exact official `jdtls.py`, Equinox launcher, and Equinox OSGi JAR from
  the pinned JDT LS distribution;
- Equinox private, shared, install, and instance/data location selection;
- S008/S009 runtime-created `configuration/` evidence; and
- one candidate experiment for an explicit worktree-scoped private
  configuration area.

Excluded:

- another Zed, JDT LS, or Spring Tools launch;
- a Java extension patch, WASM build, or disposable runtime implementation;
- a product architecture, cache lifecycle, migration, or concurrency decision;
- treating an untested platform as supported; and
- changing or deleting the preserved S008/S009 evidence.

## Confirmed facts

### The Java extension specifies shared configuration but not private configuration

1. The fixed Java extension derives a platform-specific shared configuration
   path and passes these three JVM properties before the Equinox launcher JAR:
   `osgi.sharedConfiguration.area`,
   `osgi.sharedConfiguration.area.readOnly=true`, and
   `osgi.configuration.cascaded=true`.
2. The same raw-Java path passes the worktree-keyed JDT instance/data path as
   `-data`. It does not pass `-configuration`,
   `-Dosgi.configuration.area`, or `org.osgi.framework.storage`.
3. The `jvm_args` parameter in that builder is not a user-configured arbitrary
   JVM argument list. Its only caller supplies the optional Lombok
   `-javaagent`. The settings parser exposes heap sizing and a complete custom
   `jdtls_launcher`, but no arbitrary JDT JVM-property setting.
4. The exact official `bin/jdtls.py` in the pinned distribution constructs the
   same three shared/cascaded properties and also omits an explicit private
   configuration area. Its `--jvm-arg` option can add JVM properties when the
   script itself is used, but S009 used the Java extension's direct raw-Java
   branch so that the extension could supply the exact full-path-derived
   `-data` value.

### Equinox treats shared configuration as a parent, not a replacement

1. The exact `org.eclipse.osgi` manifest identifies version
   `3.24.300.v20260612-1540`, source tag `I20260613-1800`, and source commit
   `fde548a454aef85af997a0d8694122b0fc178165`.
2. In that source and matching class bytecode, `EquinoxLocations` first builds
   the private `osgi.configuration.area`. Only afterward it resolves
   `osgi.sharedConfiguration.area`; when the two URLs differ, it creates a
   read-only parent and attaches it to the private configuration location.
3. `osgi.configuration.cascaded=true` therefore does not make the shared
   `config_mac_arm` directory the writable runtime cache. The private and
   shared locations have distinct roles.
4. Eclipse's runtime-options documentation likewise defines
   `osgi.configuration.area` as the configuration for the current run and the
   shared area as the parent of a cascaded configuration. It defines
   `-configuration <location>` as equivalent to setting
   `osgi.configuration.area`.

### The omitted private location defaults to the install tree when writable

1. When neither `osgi.configuration.area.default` nor
   `osgi.configuration.area` is set, the exact `EquinoxLocations` source calls
   `computeDefaultConfigurationLocation()`.
2. That method resolves the install location, constructs its `configuration`
   child, calls `mkdirs()` if it is absent, and returns it when it exists and is
   writable. Only when that path cannot be used does it compute a user-area
   fallback.
3. S009's JDT distribution was writable. The single runtime created precisely
   `<fixed JDT install>/configuration`, containing Equinox framework storage,
   extracted `org.eclipse.osgi` bundle content, and registry/cache files.
4. The fixed original JDT files stayed byte-identical; the whole-tree digest
   changed only because the new directory was added. S008's two corrected
   profiles independently retain equivalent runtime-created configuration
   trees.
5. The exact source behavior, path, timing, and retained contents jointly
   attribute S009's unexpected tree to Equinox's default private configuration
   selection. It is expected derived runtime state at an unsuitable default
   location, not evidence that the profile controls selected a second JDT
   distribution.

### An explicit JVM property is the direct control on the existing launch path

1. Eclipse documents `-Dosgi.configuration.area=<location>` as the system-
   property form of the private configuration location. The JDT LS project
   documentation instructs launchers to use a user-owned `-configuration`
   directory so the product repository configuration remains untouched.
2. The Java extension's direct launch already constructs a JVM argument array
   before `-jar`. Adding one explicit
   `-Dosgi.configuration.area=<worktree-scoped path>` there does not require a
   shell, a Python launcher, or a change to the existing `-data`, shared
   configuration, or proxy topology.
3. Current released settings cannot inject that property into the direct path.
   Testing it therefore requires a narrowly instrumented, disposable build of
   the fixed Java extension rather than a settings-only S009 retry.

## Primary sources and exact artifacts

Inspected on 2026-07-17:

- Zed Java extension commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`:
  [`src/jdtls.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls.rs),
  [`src/jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs), and
  [`src/config.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/config.rs).
- Fixed local JDT LS `1.60.0-202606262232` `bin/jdtls.py`, SHA-256
  `ba1f8d2978d985fe3a56f06172dc71912d7e2c8280763f006fecdd8ee887c363`.
  The official `v1.60.0` source at commit
  `57ed41bdddc93df13ace6a266d8e3c1d35c95618` contains a byte-identical
  [script](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/org.eclipse.jdt.ls.product/scripts/jdtls.py).
- Fixed `org.eclipse.osgi_3.24.300.v20260612-1540.jar`, SHA-256
  `4f9ebafd82c344fe89f0860f32c6291becfbb4ab8d480a623e12b4c5ace57984`;
  its manifest points to exact
  [`EquinoxLocations.java`](https://github.com/eclipse-equinox/equinox/blob/fde548a454aef85af997a0d8694122b0fc178165/bundles/org.eclipse.osgi/container/src/org/eclipse/osgi/internal/location/EquinoxLocations.java).
- Fixed `org.eclipse.equinox.launcher_1.7.200.v20260619-2039.jar`, SHA-256
  `89007de5f1c1b600af7d6985665061b515f8678738a02c57098f0b3eece6e02e`;
  its manifest identifies source commit
  `cc174752fe5534f2e83d30dc504874c80b7d3c25`.
- Official [Eclipse runtime options](https://help.eclipse.org/latest/topic/org.eclipse.platform.doc.isv/reference/misc/runtime-options.html)
  and exact-source
  [JDT LS launch instructions](https://github.com/eclipse-jdtls/eclipse.jdt.ls/blob/57ed41bdddc93df13ace6a266d8e3c1d35c95618/README.md#running-from-the-command-line).
- [S009](../spikes/009-attributed-isolated-profile.md) and ignored retained
  S008/S009 runtime trees, process arguments, manifests, and log boundaries.

## Inferences

1. Relocating the private configuration is preferable to accepting a mutable
   directory inside the fixed distribution because it preserves a simple,
   verifiable artifact identity while retaining Equinox's expected writable
   cache.
2. The narrowest test path is `<expected JDT data>/configuration`. It is already
   worktree-scoped by the Java extension's normalized full-path hash, remains
   under the run-specific cache root, and requires no second path-key algorithm.
3. Making the install tree read-only and relying on Equinox's user-area fallback
   would test a more implicit and host-dependent branch. Predeclaring the
   install-tree directory as allowed mutable state would weaken fixed-artifact
   verification. Neither is the leading experiment.
4. `org.osgi.framework.storage` can override the configuration area in the
   exact Equinox source, but `osgi.configuration.area` is the documented Eclipse
   launch contract and is the more direct property for this experiment.

## Unverified hypotheses

1. An explicit private path below the expected JDT data directory is accepted
   by the pinned Equinox runtime and receives the same derived framework state.
2. The fixed shared `config_mac_arm` remains the read-only parent and JDT still
   reaches `ServiceReady` with the explicit private area.
3. The original JDT distribution remains byte-for-byte and tree-for-tree
   unchanged after that run.
4. A one-line launch-argument patch composes with the fixed Java proxy, JDK 25,
   direct full-path-derived `-data`, and S009 profile controls.
5. The same property and path construction are platform-neutral in design;
   runtime behavior outside macOS arm64 remains untested.

## Runtime verification needed

- build one disposable Java extension revision from the exact fixed source with
  only the private-configuration JVM argument added;
- prepare a fresh verified JDT extraction with no `configuration/` child and a
  fresh S009-style profile, worktree, and XDG roots;
- require the actual JVM vector to contain exactly one expected private
  configuration property before `-jar`, one shared configuration, and one
  exact `-data`;
- require `ServiceReady`, real state at both expected runtime paths, and no new
  entry or byte change in the fixed JDT distribution;
- preserve the existing trust, HTML, provider, process-exit, route-cleanup, and
  normal-Zed boundaries; and
- classify any unrelated pre-child/setup failure separately from the location
  hypothesis.

## Blockers and constraints

- The released Java extension cannot express the direct-path property through
  current settings. A successful disposable patch would be feasibility
  evidence, not authorization to modify or replace the upstream extension in a
  product.
- One run cannot establish concurrent-server locking, cache reuse, cleanup,
  migration from an old install-tree cache, or cache invalidation across JDT LS
  upgrades. Those are later lifecycle questions.
- The explicit path must be passed as one argument and must not use a shell.
  Spaces and Unicode remain part of the path test.
- The retained S009 JDT tree is already changed and cannot serve as a pristine
  S010 input. S010 must use a fresh extraction whose archive and pre-run tree
  identities match the pinned input.
- No Spring runtime, product scaffold, publication action, or platform-support
  claim follows from this attribution.

## Candidate next experiment

[S010](../spikes/010-explicit-equinox-configuration-area.md) should add exactly
one disposable launch property to the fixed Java extension and perform one
controlled macOS arm64/JDK 25 run. The private path is
`<expected JDT data>/configuration`; all S009 controls and fixed inputs remain
unchanged apart from the patched WASM and fresh JDT extraction.

## Interim conclusion

S009's unexpected tree is now source-attributed. Shared configuration does not
replace Equinox's writable private configuration, and the exact runtime defaults
that private location to `<JDT install>/configuration` when the install is
writable. R008 therefore supports a reviewed S010 relocation experiment. It
does not reclassify S009, prove the relocation at runtime, or open the Spring
end-to-end or product direction gates.
