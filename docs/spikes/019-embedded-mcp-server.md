# S019: The embedded MCP server in the pinned Spring language server

- Status: Mixed — clauses 1 and 2 Supported (the flag alone gates it; one JVM
  serves both), clause 3 **Refuted** (the port is also on stderr)
- Date: 2026-07-29
- Related: [capability-inventory](../capability-inventory.md) row *Embedded MCP
  server*; [implementation-plan](../implementation-plan.md) M6, "Closing the
  three `planned` scope decisions";
  [R018](../research/018-spring-tools-zed-outcome-parity-audit.md) hypothesis 6;
  `embedded-mcp-server-surface` memory

## Hypothesis

The pinned server jar's own `BOOT-INF/classes/application.properties` sets
`spring.ai.mcp.server.enabled=true`, `stdio=false`, `protocol=STREAMABLE`,
`server.port=0`, `server.address=localhost`, and `lib/` carries tomcat-embed 11
plus `spring-ai-starter-mcp-server-webmvc`. This project nevertheless launches
that jar with `-Dspring.main.web-application-type=NONE`
(`coordinator/src/main.mjs`, `springArguments`), which prevents the embedded
Tomcat from starting at all.

The claim: **lifting that one flag is sufficient** — the same JVM then serves
streamable-HTTP MCP and stdio LSP concurrently, from one process, with no change
to the pinned artifact, and the listening port is discoverable only from the
`window/showMessage` notification that `EmbeddedMcpServer` sends.

## Why runtime verification is required

The row has been `planned` since the inventory was written and its premise is
untested **in both directions**. Source inspection establishes that the server is
configured and that our flag suppresses it; it cannot establish that lifting the
flag produces a working MCP endpoint, because three independent things could
still fail:

1. Spring Boot could fall back to a non-web context for another reason (a
   missing servlet class on the runtime classpath, an `spring.main` override
   elsewhere), so the MCP endpoint never binds.
2. The LSP transport is stdio. Starting an HTTP server in the same JVM could
   disturb it — banner or Tomcat startup text on `System.out` corrupts the LSP
   stream instantly, and that is exactly the failure mode a source read cannot
   see. R018 hypothesis 6 (one JVM serving both) has never been observed.
3. The port announcement path is asserted from one class's source. If the port
   is also written to a file, logged to stderr in a parseable form, or fixed by
   another property, the decision that follows this spike changes.

This is a **decision-input spike, not an implementation slice**. No product code
changes on this branch. The listening-port, `api.spring.io` and offline
consequences are decided afterwards, from what is observed here.

## Environment

- macOS 26.5.x arm64, Temurin JDK 25.0.3 (`~/.sdkman/candidates/java/25.0.3-tem`)
- Pinned Spring Tools 5.2.0.RELEASE server jar
  `spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar`, sha256
  `ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1` — the same
  digest the product materializes into
  `<profile>/extensions/work/spring-tools/spring-tools/5.2.0.RELEASE/extension/language-server/`
- Fixture: the Boot 3.5.5 `practices-app` Maven worktree reused from the
  2026-07-29 data-route gate
- Run directory `/private/tmp/zst-mcp/`; evidence under the ignored
  `tmp/s019-embedded-mcp-20260729/evidence/`

**No Zed, and no jdtls.** The harness speaks LSP to the jar directly, which is
the [`incompatible-java-diagnostic-observed`] direct-spawn pattern: for a
startup-time question, a direct spawn with the product's own argument vector is
a faithful observation, and it isolates the one variable under test. The cost is
stated in *Remaining uncertainty*: with no official-Java bridge there is no
resolved project, so index-backed tool **results** are out of scope here. Tool
*reachability* is not.

## Procedure

`spikes/019-embedded-mcp-server/probe.mjs` runs three arms against the same jar
and writes one JSON transcript per arm.

1. **Arm A — control.** Spawn with the product's exact `springArguments` vector,
   including `-Dspring.main.web-application-type=NONE`. Complete an LSP
   `initialize`/`initialized` handshake over stdio, open a fixture
   `application.properties` document, wait for diagnostics. Record every
   `window/showMessage`, every listening socket the child holds, and the result
   of an HTTP probe against each. Expectation: LSP works, no socket, no
   announcement.
2. **Arm B — flag lifted.** Identical, minus `-Dspring.main.web-application-type=NONE`.
   Record the same four things.
3. **Arm C — MCP under load.** Only if B binds a port. With the LSP session from
   B still open and still answering, drive the MCP endpoint over streamable HTTP:
   `initialize`, `notifications/initialized`, `tools/list`, then one no-argument
   tool call (`getProjectList`). Then issue a further LSP request and confirm the
   same session still answers.

Port discovery is deliberately done **twice by different means** so the
announcement claim is falsifiable: from the `window/showMessage` text, and
independently from `lsof -p <pid>` on the child. If the two disagree, or if a
port exists that was never announced, the hypothesis' third clause is refuted.

## Success criteria

- Arm A binds no listening socket and sends no MCP announcement.
- Arm B binds exactly one localhost listening socket, and an MCP `initialize`
  over streamable HTTP returns a protocol-conformant result.
- Arm B's LSP session is undamaged: the handshake completes, the properties
  document produces the same diagnostics as Arm A, and no non-LSP bytes appear
  on stdout.
- Arm C's `tools/list` returns the tool set, the sampled tool call returns a
  result rather than a transport error, and the LSP request issued afterwards
  still answers on the same session.
- The port observed by `lsof` equals the port in the `window/showMessage` text,
  and no other announcement channel carries it.

## Failure criteria

- Arm B binds nothing, or the context still starts non-web → the row's premise
  is false and the decision is made without an MCP option.
- Stdout carries Tomcat/banner text, or Arm A and Arm B diagnostics differ, or
  the post-MCP LSP request does not answer → one JVM cannot serve both, R018
  hypothesis 6 is Refuted, and the row can only be `not-pursued` or blocked on a
  second process.
- The port turns out to be reachable by another route (file, stderr line, fixed
  property) → the third clause is Refuted, which makes the row *easier*, not
  harder, and that must be recorded rather than smoothed over.

## Observations

Transcripts: `tmp/s019-embedded-mcp-20260729/evidence/arm-{a,b}.json` and the
matching `-stderr.log` (ignored, not committed).

### Precondition found before either arm could run

The first Arm A attempt never completed `initialize`. Spring answered
`-32603 Internal error` with
`NullPointerException … ServerCapabilities.getExecuteCommandProvider()` at
`JdtLsProjectCache.initialize:338`. The cause is a **client** capability, not a
server fault: `SimpleLanguageServer` only builds an `ExecuteCommandOptions` when
`hasExecuteCommandSupport` holds, and `JdtLsProjectCache` then unconditionally
appends `sts.enableClasspathListening` to that list. A client that omits
`workspace.executeCommand` therefore crashes Spring's handshake outright. The
harness declares it; the record is here because any future direct-spawn LSP
client will hit the same wall.

### Arm A — control, flag present (the product today)

| | observed |
| --- | --- |
| `initialize` | completed; 15 capability keys incl. `executeCommandProvider` |
| Listening sockets on the child (`lsof`) | **none** |
| `window/showMessage` | **none** |
| Non-LSP bytes on stdout | 0 |
| Diagnostics for the fixture properties file | one **empty** publish |
| Server→client requests | `client/registerCapability`, `sts/addClasspathListener` |

So the product's current launch does exactly what the source read predicted: the
MCP server is configured but cannot bind, and nothing about its absence is
surfaced.

### Arm B — the same jar, one flag removed

The **only** difference is dropping `-Dspring.main.web-application-type=NONE`.

| | observed |
| --- | --- |
| Tomcat | started; one socket, `TCP 127.0.0.1:51098 (LISTEN)` |
| Announcement | `window/showMessage` type 3: `Embedded Spring Tools MCP server started at port: 51098` |
| Non-LSP bytes on stdout | **0** — the LSP stream is untouched |
| Diagnostics | one empty publish, **identical to Arm A** |
| MCP endpoint | `POST /mcp` → 200 on the first candidate tried |
| MCP `initialize` | `protocolVersion 2025-06-18`, `serverInfo spring-language-server-mcp 2.1.0`, capabilities `completions/logging/prompts/resources/tools` |
| Session | `Mcp-Session-Id` issued with **no credential of any kind** |
| `tools/list` | **18 tools**, exactly the set inventoried from `McpConfig.registerTools` |
| LSP request issued *after* the MCP exchange | answered on the same session |

Two runs of Arm B bound 50321 and 51098 — random, as `server.port=0` implies.

### The port has a second announcement channel

The hypothesis said `window/showMessage` was the only route. It is not. Tomcat's
own startup line reaches **stderr**, which the coordinator already pipes:

```
INFO [main] o.s.boot.tomcat.TomcatWebServer : Tomcat started on port 51098 (http) with context path '/'
```

`lsof` and the `showMessage` text agreed on the port in both runs, and the stderr
line carried the same number. `EmbeddedMcpServer.class` confirms the product-level
path — it consumes `ServletWebServerInitializedEvent`, reads `getPort()`, and
sends one `MessageParams` through `STS4LanguageClient.showMessage` inside
`doOnInitialized` — but it is not the only place the number appears.

### What the sampled tool calls show

Three no-argument calls, chosen to separate the two data sources:

| tool | latency | result |
| --- | --- | --- |
| `getProjectList` | 17 ms | `[]`, `isError: false` |
| `getLatestReleaseInformation` | 1147 ms | `null`, `isError: false` |
| `getGenerations` | 1260 ms | `404 Not Found: [no body]`, `isError: true` |

The 17 ms local answer versus two ~1.2 s answers is the observation that matters:
the spring.io tools performed **real outbound network calls** from the language
server process. `SpringIoMcpUrls.class` carries the default base
`https://api.spring.io`, derived from the projects-list URL setting. The empty
and 404 results are expected here — the harness has no official-Java bridge, so
no project resolves, and the two network tools were called without the project
argument they need. Reachability, not payload, is what these calls establish.

## Result

**Mixed.**

- Clause 1, *lifting the flag is sufficient*: **Supported.** One flag is the
  entire difference between no server and a working one, on the unmodified
  pinned artifact.
- Clause 2, *one JVM serves streamable-HTTP MCP and stdio LSP concurrently*:
  **Supported**, and this closes R018 hypothesis 6, which had never been
  observed. The specific risk — Tomcat or banner text corrupting the stdio LSP
  stream — did not materialise: zero contaminating bytes, byte-identical
  diagnostics across arms, and a post-MCP LSP request answered normally.
- Clause 3, *the port is announced only through `window/showMessage`*:
  **Refuted.** Tomcat's stderr line is a second, parseable channel on a stream
  the coordinator already handles.

Clause 3 failing makes the row *easier*, which is why it is stated plainly
rather than smoothed into the other two: a coordinator that wants the port does
not have to intercept a user-facing notification to get it.

## Remaining uncertainty

- **Tool results against a resolved project were not observed.** With no jdtls
  and no bridge, `getProjectList` is correctly empty, so every index-backed tool
  is reachable but unexercised. This spike establishes the transport, not the
  payload.
- **Nothing here was driven through Zed.** The product would need the flag
  removed from `springArguments` for that, which is the decision's
  implementation, not this spike's evidence.
- **The endpoint is unauthenticated.** A session id was issued to an anonymous
  POST. It binds to loopback only (`127.0.0.1`, per `server.address=localhost`),
  so exposure is host-local — but host-local is not nothing, and any local
  process could enumerate the user's beans, mappings and classpath through it.
  Quantifying that is the decision's job, not the spike's.
- **Offline behaviour of the spring.io tools was not measured.** They are now
  known to make live calls; how they fail under the `sandbox-exec` network
  denial recipe is unmeasured, and it bears directly on the closed offline row.
- Only the streamable-HTTP protocol was exercised. `stdio=false` was left as
  shipped.

## Next experiment

If the decision moves toward building this, the smallest useful follow-up is a
driven Zed run with the flag removed and the official-Java bridge present, to
observe (a) index-backed tool payloads against a real resolved project and
(b) whether Tomcat startup shifts server-ready timing enough to matter. If the
decision moves the other way, no follow-up is needed and the observations above
are the record of what was declined.

## Reusable findings

- A direct-spawn LSP client for this server **must** declare
  `workspace.executeCommand`, or Spring's `initialize` throws before returning.
- The whole embedded MCP surface is gated by one JVM flag in
  `coordinator/src/main.mjs`. No upstream change, no new artifact, and no new
  dependency is involved in turning it on — which is precisely why the row is a
  decision rather than a build.
- Spring's stdio LSP transport tolerates an embedded Tomcat in the same JVM.
  Boot's banner is already off via `spring.main.banner-mode: off` in the jar's
  own `application.properties`, and Tomcat logs to stderr, so stdout stays clean.
- `spikes/019-embedded-mcp-server/probe.mjs` is disposable spike code. It is not
  production code and must not be promoted.
