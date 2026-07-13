# R004: Integration structure candidates

- Status: Complete
- Last updated: 2026-07-14
- Investigator: Codex
- Inputs: R001, R002, and R003

## Question

Which integration structures remain technically credible given Zed's extension
API, the current Zed Java extension, and Spring Tools' client-relayed dependency
on JDT LS?

## Scope

This document compares structures and identifies discriminating experiments. It
does not select a production architecture or assert that an MVP is feasible.

## Confirmed constraints

The following constraints come directly from R001-R003:

1. Zed can register and run multiple language servers for Java.
2. The Spring Boot LS is a separate stdio LSP process.
3. Its production Java project model depends on Spring bundles inside JDT LS and
   custom client-mediated requests and callbacks.
4. A separate Zed adapter can plausibly append Spring bundle paths to JDT LS
   initialization.
5. The public Zed extension API cannot register generic handlers for Spring's
   custom server-to-client requests.
6. The current Java proxy offers an arbitrary request path into JDT LS but does
   not route `workspace/executeClientCommand` callbacks out of JDT LS.
7. The current Java extension owns mature JDT LS download, runtime, workspace,
   proxy, debug bundle, and lifecycle behavior.

## Evaluation criteria

Candidates are compared on:

- ability to provide Java-project-aware Spring features;
- coexistence with the current Java extension;
- required upstream changes;
- reliance on private implementation details;
- process and resource duplication;
- version compatibility burden;
- multi-worktree and remote-development viability;
- failure isolation; and
- suitability for a small feasibility spike.

## Candidate A: limited direct dual-server extension

### Structure

```text
Zed ──stdio──> existing Java proxy ──stdio──> JDT LS
  └──stdio──> Spring Boot LS
               JDT classpath integration disabled
```

The new extension registers the Spring Boot LS for relevant languages and starts
it with `enableJdtClasspath: false`. It implements no custom Java-data relay.

### Potential value

- Standard LSP support for application properties, YAML, XML, and Java documents
  may provide a useful subset.
- It requires no modification to the Java extension or Zed.
- It is the smallest way to establish a factual lower bound on available Spring
  functionality.

### Limitations

- The Spring LS Java project cache remains empty through the production path.
- Project-classpath-aware completion, navigation, indexing, and Java analysis are
  expected to be missing or degraded.
- Custom Spring client requests and advanced UI commands remain unsupported.

### Status

Credible as a limited product direction only if runtime tests show meaningful
user value. It is the best first Spring LS runtime baseline, not the leading full
integration architecture.

## Candidate B: coordinated integration with the existing Java proxy

### Structure

```text
                       ┌──────────────> JDT LS + Spring bundles
Zed ──stdio──> Java proxy/coordinator
  └──stdio──> Spring proxy ───────────> Spring Boot LS
                    private coordination channel
```

The current Java proxy gains a generic, versioned coordination interface for
selected JDT LS commands and `workspace/executeClientCommand` callbacks. A Spring
proxy handles Spring LS custom requests and communicates with the Java proxy.

### Potential value

- Reuses the existing JDT LS process, project import, Java cache, debug bundle,
  and Java extension lifecycle.
- Can reproduce the current Spring Tools classpath and Java-data relay closely.
- Avoids a second JDT LS process.
- The existing Java proxy already implements one half of the required side
  channel.

### Costs and risks

- Requires changes and coordination in the Zed Java extension or a maintained
  fork.
- Introduces a private protocol that must correlate worktrees, restarts, and
  versions.
- Spring and Java extension release compatibility must be managed jointly.
- Remote worktrees require both native proxies and artifacts on the remote host.

### Status

Leading candidate for a full integration if Java extension maintainers accept a
generic coordination mechanism. It should not be implemented as an undocumented
dependency on the current proxy port file.

## Candidate C: Spring proxy plus custom JDT snapshot bundle

### Structure

```text
Zed ──stdio──> existing Java proxy ──stdio──> JDT LS
  │                                    + Spring/custom query bundles
  └──stdio──> Spring proxy ──stdio──> Spring Boot LS
                 └──request side channel──> existing Java proxy
```

A Spring proxy intercepts Spring LS custom requests. It queries JDT LS through
the existing Java proxy's request side channel. Instead of relying on JDT LS
callbacks, an additional JDT bundle exposes snapshot or polling commands for the
project model and classpath.

### Potential value

- May avoid modifying the existing Java proxy's callback path.
- Reuses the current JDT LS process and Spring LS Java-data APIs.
- A purpose-built snapshot command could simplify correlation compared with the
  dynamic callback protocol.

### Costs and risks

- Depends on an undocumented Java proxy port-file and HTTP contract unless that
  interface becomes supported upstream.
- Requires maintaining a new JDT LS bundle that mirrors classpath and project
  information expected by Spring LS.
- Polling can be stale or expensive; event triggers would have to come from file
  watching or another signal.
- Translating snapshot data into Spring LS's expected project lifecycle may be
  as complex as forwarding the original callbacks.

### Status

Useful fallback research candidate. It is less attractive than B unless a narrow
snapshot command proves substantially simpler and the Java proxy side channel is
formalized.

## Candidate D: unified coordinator owning both servers

### Structure

```text
Zed ──stdio──> unified coordinator
                 ├──> JDT LS + Spring bundles
                 └──> Spring Boot LS
```

One native coordinator is the LSP endpoint visible to Zed and owns both child
servers, routing standard LSP traffic and Spring/JDT custom messages internally.

### Potential value

- Full control of startup order, process lifetime, message routing, version
  pairing, and callback handling.
- No dependency on private cross-extension side channels.
- The VS Code relay behavior can be reproduced within one process boundary.

### Costs and risks

- Duplicates or replaces the current Java extension's JDT LS launcher, downloads,
  proxy transformations, configuration, debugger integration, and project cache.
- Risks two JDT LS processes if users also keep the Java extension enabled.
- Must merge responses and capabilities from two servers without confusing Zed.
- Has the largest packaging, compatibility, remote-host, and maintenance burden.

### Status

Technically credible but a major pivot. Consider only if the existing Java
extension cannot expose a supported coordination point and limited mode is not
valuable.

## Comparison

| Criterion | A: limited dual | B: existing proxy coordination | C: snapshot bundle | D: unified coordinator |
| --- | --- | --- | --- | --- |
| Reuses current JDT LS | Yes | Yes | Yes | No/replace |
| Full classpath relay | No | Intended | Reimplemented | Intended |
| Java extension change | No | Yes | Preferably formalize side channel | No, but replaces behavior |
| Private API reliance | Low | Low if upstreamed | High unless upstreamed | Low |
| Extra native process | Spring LS only or proxy | Spring proxy/coordinator | Spring proxy | Unified coordinator |
| Duplicate JDT LS | No | No | No | Likely |
| Implementation size | Small | Medium/high | High | Very high |
| Best use | Lower-bound MVP test | Full integration lead | Fallback experiment | Last-resort pivot |

## Inferences

### There is no credible extension-WASM-only full integration

Command construction and initialization merging are available in extension WASM,
but arbitrary Spring client requests and JDT callbacks are not. A full
integration needs protocol-aware native code or a Zed core/API change.

### Upstream collaboration is an architectural dependency for Candidate B

Candidate B is attractive only if the coordination interface is treated as part
of the Java extension's supported design. Copying its internal work-directory and
port-file behavior into another published extension would create a brittle
cross-extension dependency.

### A limited MVP and a full architecture can be evaluated independently

Candidate A can determine whether standard Spring LS features alone justify a
small extension. Candidates B-D answer the separate question of whether deep
Java-aware Spring functionality is feasible. A positive limited result should
not be presented as proof of full integration.

## Unverified hypotheses

1. Candidate A provides at least one reliable, project-relevant Spring feature.
2. A Spring proxy can transparently preserve all standard LSP behavior while
   handling only `sts/*` requests.
3. The Java extension maintainers are willing to accept a generic coordination
   interface or Spring-specific routing.
4. Candidate B can correlate server instances using worktree identity without a
   race during start, restart, or remote propagation.
5. A snapshot command in Candidate C can replace the listener flow without
   unacceptable latency or semantic loss.
6. A unified coordinator can merge two LSP servers without regressing Java
   completion, diagnostics, edits, semantic tokens, or commands.

## Runtime verification needed

The candidates should be distinguished in this order:

1. Run the headless Spring LS baseline with classpath disabled. Stop Candidate A
   evaluation if no stable user value remains.
2. Verify cross-extension Spring bundle injection into the existing Zed JDT LS.
3. Invoke one Spring JDT command through the existing Java proxy side channel.
4. Capture the classpath callback failure and prototype routing exactly one
   callback in disposable code.
5. Only if callback routing cannot be made supportable, prototype one project
   snapshot command for Candidate C.
6. Evaluate Candidate D only after B and C encounter evidence-backed blockers.

## Blockers and constraints

- Candidate B requires external coordination with the Java extension project;
  source evidence alone cannot grant that support contract.
- Candidates B and C require exact Spring bundle/JDT LS compatibility.
- All candidates need a distribution strategy satisfying Zed's no-bundled-server
  publishing rule.
- Advanced Spring UI features remain outside Zed's extension surface even if
  language intelligence works.
- User-controlled language-server selection can disable either half of a
  coordinated setup and must produce a comprehensible degraded mode.

## Candidate next experiments

Proposed spike sequence after completing R001-R005:

1. S001: minimal Zed dev extension and lifecycle observation.
2. S002: Spring LS headless standard-LSP baseline with classpath disabled.
3. S003: inject one synthetic JDT LS bundle through a second adapter.
4. S004: load the pinned Spring JDT bundles and execute one command.
5. S005: intercept and route one classpath callback in disposable proxy code.

Each spike must use pinned artifacts and record exact logs and protocol traces.

## Interim conclusion

Four structures remain credible, but they serve different goals. Candidate A is
the smallest limited-value test. Candidate B is the leading full-integration
structure because it reuses the existing Java extension and matches Spring
Tools' current architecture. Candidate C is a fallback if callback routing
cannot be upstreamed, and Candidate D is a substantial pivot that should be
considered last.

No Go/Pivot decision is justified yet. R005 establishes a safe input-artifact
strategy, but the ordered runtime spikes above are still required.
