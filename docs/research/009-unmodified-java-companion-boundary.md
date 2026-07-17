# R009: Unmodified Zed Java companion boundary

- Status: Complete
- Last updated: 2026-07-17
- Investigator: Codex
- Inputs: R001-R004, S003-S005, S011, D002

## Question

What boundary can an independently packaged Spring companion use with the
official Zed Java extension without modifying, forking, or replacing that Java
extension, and what still requires runtime verification before product
scaffolding?

## Confirmed facts

### Product boundary selected by the owner

The initial product requires the official Zed Java extension. It does not start
a reduced self-managed JDT LS when the Java extension is absent or incompatible.
The Java extension remains responsible for ordinary Java language support,
JDT LS, project import, debugging, tests, and tasks. `zed-spring-tools` adds the
Spring-specific JDT bundles, Spring Boot LS, and coordination behavior. The
extension description must disclose this dependency and injected-bundle model.

### Cross-extension bundle contribution already works

S003 proved on Zed 1.10.3 that a separately installed adapter can contribute an
additional bundle path to the `jdtls` initialization options owned by Java
extension 6.8.21. Zed's adapter composition appended the bundle rather than
replacing the Java extension's debugger bundle, and the unmodified JDT LS loaded
and executed the synthetic command. S004 repeated the mechanism with the five
fixed Spring JDT bundles. This modifies the JDT LS runtime composition, not the
official Java extension source or package.

### The current official Java proxy has a one-way request side channel

At Java extension commit
`9148b8972c1b93fbe5512a9ecf0ba33c3182970d`, version 6.8.21:

- `proxy/src/main.rs` binds an ephemeral loopback TCP port, derives a proxy ID
  from the current worktree path, and writes only the numeric port to
  `<extension-workdir>/proxy/<proxy-id>`;
- `proxy/src/http.rs` accepts an HTTP `POST` body containing arbitrary `method`
  and `params`, turns it into a JDT LS JSON-RPC request, correlates the response,
  and applies a five-second timeout; and
- the endpoint has no authentication, protocol-version handshake, capability
  declaration, or public stability statement.

S003 and S004 used this unchanged path to invoke commands in the existing JDT LS.
The path is therefore technically usable by a local companion on the tested
version, but remains an observed private transport rather than a promised API.

### The current official proxy does not deliver the required reverse callback

The fixed Spring Tools JDT extension at commit
`18d1a975dbea4f9314fd736d0237bd9e23f243f9` implements
`sts.java.addClasspathListener` with `ReusableClasspathListenerHandler`. Each
classpath event calls `JavaClientConnection.executeClientCommand` with the
dynamic callback ID. JDT LS emits that call as
`workspace/executeClientCommand` toward its LSP client.

The unmodified Java proxy forwards that request to Zed. It has no branch that
routes the dynamic Spring callback to another extension or process. S005
captured this failure and proved one disposable proxy patch; S011 reused the
instrumented proxy to complete the real classpath-to-`server.port` flow. S011
therefore proves the feature and coordination semantics, but not the final
unmodified-Java-extension transport.

### Current version changes are a compatibility concern, not a fork obligation

Nothing in the companion decision requires copying or merging the official
Java extension source. A later Java extension release matters only when an
observed integration input changes: adapter composition, injected-bundle
compatibility, worktree/proxy discovery, request envelope, JDT LS command
behavior, or lifecycle. A companion can probe these capabilities, select a
tested transport adapter, and reject an incompatible combination explicitly.
This does not turn the private transport into a public contract or prove future
versions compatible.

## Primary sources and source-code references

All sources below were accessed on 2026-07-17.

- Zed Java extension 6.8.21, commit
  `9148b8972c1b93fbe5512a9ecf0ba33c3182970d`:
  [`extension.toml`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/extension.toml),
  [`src/jdtls_server.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/src/jdtls_server.rs),
  [`proxy/src/main.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/main.rs), and
  [`proxy/src/http.rs`](https://github.com/zed-extensions/java/blob/9148b8972c1b93fbe5512a9ecf0ba33c3182970d/proxy/src/http.rs).
- Spring Tools 5.2.0.RELEASE source, commit
  `18d1a975dbea4f9314fd736d0237bd9e23f243f9`:
  `ClasspathListenerHandler.java`, `ReusableClasspathListenerHandler.java`,
  `ClientCommandExecutor.java`, and `plugin.xml` under
  `headless-services/jdt-ls-extension`.
- JDT LS 1.60.0 source, commit
  `57ed41bdddc93df13ace6a266d8e3c1d35c95618`:
  `InitHandler.java`, `IDelegateCommandHandler.java`, and the
  `delegateCommandHandler` extension-point schema.
- [S003](../spikes/003-jdtls-synthetic-bundle-injection.md),
  [S004](../spikes/004-spring-jdt-bundle-command.md),
  [S005](../spikes/005-classpath-callback-routing.md), and
  [S011](../spikes/011-integrated-spring-boot-local-poc.md) contain the fixed
  local runtime evidence.

## Inferences

1. The official Java extension can remain unmodified if an additional Spring
   bridge bundle, loaded through the already-supported initialization merge,
   owns the missing reverse path. A credible design is a bridge command invoked
   through the existing Java proxy request channel that registers a
   worktree-scoped authenticated callback endpoint; subsequent JDT classpath
   events go directly from the bridge bundle to the Spring coordinator.
2. The coordinator can translate Spring LS client requests such as
   `sts/javaType` into fixed JDT delegate commands through the same versioned
   transport adapter. The exact method inventory still requires capability
   mapping.
3. Keeping the Java proxy unchanged avoids release-by-release fork merges. A
   small adapter around its observed port-file/request shape is lower cost, but
   must fail closed when its probes do not match.
4. Upstream support would reduce compatibility risk but is an optional later
   improvement. It is not needed to test the unmodified companion architecture.

## Unverified hypotheses

1. A disposable injected bridge bundle can register add/remove commands, reuse
   or reproduce the Spring classpath listener semantics, and send the unchanged
   six-field event to a loopback coordinator without using
   `workspace/executeClientCommand`.
2. The bridge and coordinator can authenticate, correlate, time out, unregister,
   and clean up one worktree route without leaving a listener or secret.
3. The unmodified official proxy can invoke that bridge command and preserve
   results while the bridge sends events concurrently.
4. The bridge path can reproduce S011's empty baseline, real project-cache
   transition, and one `server.port` completion in the same Spring LS process.
5. Zed exposes enough user-facing error/status behavior for a missing or
   incompatible Java extension. Automatic dependency installation has not been
   established and must not be promised.
6. The observed transport can be adapted on Linux and Windows. Only macOS arm64
   has runtime evidence.

## Items requiring runtime verification

- Build and load one disposable bridge bundle beside the five Spring bundles
  using an entirely unmodified Java extension 6.8.21 and official proxy asset.
- Prove authenticated direct callback delivery and exact add/remove behavior.
- Repeat the S011 before/after completion control without the S005/S006 Java
  proxy patch.
- Verify missing/incompatible-provider failure behavior separately from the
  successful runtime; do not launch another JDT LS.

## Blockers and constraints

- The existing Java proxy request endpoint and port file are private and
  unauthenticated. The companion may evaluate a capability-checked adapter but
  may not describe this as an official stable API.
- The bridge bundle executes inside the JDT LS process owned by the Java
  extension. Its dependencies, threads, sockets, listener cleanup, and failure
  isolation must be strictly bounded.
- No product scaffold may encode the proposed transport until the unmodified
  runtime experiment succeeds and the detailed architecture decision is
  accepted.
- Missing Java support is an installation/compatibility error. A reduced
  standalone JDT LS is outside the selected product direction.

## Candidate next experiment

S012 should test exactly one unmodified-companion transport: invoke a custom
bridge command through the official Java proxy's existing request channel, send
the authentic classpath event directly from the injected bridge bundle to an
authenticated Spring coordinator route, and reproduce the S011
`server.port` transition. It must not patch the Java extension or proxy, start a
second JDT LS, add product scaffolding, or generalize the private endpoint into
a support claim.
