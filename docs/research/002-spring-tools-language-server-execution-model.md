# R002: Spring Tools Language Server execution model

- Status: Complete
- Last updated: 2026-07-14
- Investigator: Codex
- Evidence baseline: Spring Tools commit
  `0a141b2d0b669aa2d5caf4766481c29be6e99762`

## Question

Can the Spring Boot Language Server run as an independent LSP server, and what
client, JDT LS, initialization, protocol, and packaging behavior is required for
its Java- and Spring-aware features?

## Scope

Included:

- the current Spring Boot Language Server process and transport;
- its VS Code launch and initialization behavior;
- documents handled by the server;
- its relationship with Red Hat's Java extension and JDT LS;
- the Spring Tools JDT LS extension bundles;
- standard LSP versus Spring-specific protocol messages; and
- expected behavior when JDT classpath integration is absent.

Excluded:

- a complete feature-by-feature capability inventory;
- JDT LS launch and bundle-loading mechanics outside the Spring Tools source;
- redistribution approval and third-party license analysis;
- runtime execution against Zed; and
- an integration architecture decision.

## Confirmed facts

### The Spring Boot Language Server is a separate process

1. The Spring Tools repository contains a dedicated
   `headless-services/spring-boot-language-server` Java application packaged as a
   JAR.
2. The VS Code extension launches this application with a Java executable. Its
   normal packaged launch uses `java ... -jar <language-server-jar>`; the
   development/exploded launch uses a classpath and main class.
3. The current VS Code extension requires Java 21 or newer to launch the server
   and defaults its maximum heap to 1024 MiB unless configured otherwise.
4. In the normal mode, the server uses stdin and stdout for JSON-RPC/LSP. The
   source also contains socket modes used by development or an environment
   switch, but stdio is the normal client-launched path.
5. The server is not embedded inside the JDT LS process. It is a distinct process
   with its own LSP connection to the editor client.

### The server speaks standard LSP plus custom Spring Tools protocol

The Spring Boot Language Server is built on LSP4J and exposes standard language
server capabilities. The VS Code client attaches it to:

- Java files;
- Spring Boot application and bootstrap properties files;
- Spring Boot application and bootstrap YAML files;
- Spring XML;
- `spring.factories`; and
- selected JPA query property files.

The server and client also use a custom `STS4LanguageClient` protocol extending
the standard LSP client. Its source declares custom messages including:

- `sts/addClasspathListener` and `sts/removeClasspathListener`;
- `sts/javaType`;
- `sts/javadoc` and `sts/javadocHoverLink`;
- `sts/javaLocation`;
- `sts/javaSearchTypes` and `sts/javaSearchPackages`;
- `sts/javaSubTypes` and `sts/javaSuperTypes`;
- `sts/javaCodeComplete`;
- `sts/project/gav`;
- `sts/moveCursor` and `sts/highlight`; and
- live-process notifications.

The server also exposes many Spring-specific `workspace/executeCommand`
commands, including property conversion, live data, Spring structure, executable
Boot project discovery, Spring index operations, and other advanced functions.

### The VS Code extension is an active protocol adapter

The VS Code extension does more than launch the Spring Boot LS:

1. It creates a `vscode-languageclient` with Spring-specific document selectors,
   synchronized configuration sections, initialization options, and URI
   conversion.
2. It registers handlers for custom requests sent from the Spring Boot LS.
3. For Java-data requests, those handlers call VS Code's
   `java.execute.workspaceCommand`, targeting commands supplied inside JDT LS.
4. It registers client-side handling for Spring-specific highlights, cursor
   movement, live-process notifications, content URIs, tree views, and other UI
   behavior.
5. It starts and stops the Spring Boot LS separately from the Java language
   server.

The editor extension is therefore a required coordinator for the full VS Code
feature set, not a passive executable locator.

### Spring Tools installs extension bundles into JDT LS

The VS Code extension declares a dependency on `redhat.java`. It contributes
several JARs through the `javaExtensions` contribution point, including:

- `jdt-ls-extension.jar`;
- `jdt-ls-commons.jar`;
- Reactor dependencies; and
- a Spring Tools Gradle tooling JAR.

The Spring Tools JDT LS extension registers JDT LS delegate command handlers for
classpath listeners and Java model operations. Commands include:

- `sts.java.addClasspathListener` and `sts.java.removeClasspathListener`;
- `sts.java.type`;
- `sts.java.javadoc` and `sts.java.javadocHoverLink`;
- `sts.java.location`;
- type and package search;
- subtype and supertype queries;
- Java completion; and
- project GAV lookup.

This code executes inside JDT LS and has access to Eclipse JDT's imported project
model and resolved classpath.

### JDT LS communication is relayed through the editor client

The main classpath flow is:

1. The Spring Boot LS sends `sts/addClasspathListener` to its LSP client.
2. The VS Code Spring extension handles that request.
3. The handler invokes `java.execute.workspaceCommand` against the Java
   extension, requesting JDT LS command `sts.java.addClasspathListener`.
4. The Spring Tools bundle running inside JDT LS registers a classpath listener.
5. That bundle emits classpath events through a dynamically generated client
   callback command.
6. The callback reaches the Spring Boot LS command handler, which creates or
   updates its own cached Java project representation.

Other Java-data operations use the same client-relay pattern: Spring Boot LS asks
the editor-side Spring extension, which executes a Spring-provided workspace
command inside JDT LS and returns the result.

The two language-server processes do not establish a direct Spring-LS-to-JDT-LS
socket in this implementation.

### Initialization and workspace behavior

The VS Code extension supplies initialization options containing:

- the current workspace folder URIs; and
- `enableJdtClasspath: false` initially.

The false value prevents the Spring Boot LS from asking for JDT classpath data
before the VS Code extension has registered the required custom request handlers.
After the Spring Boot LS starts and the handlers exist, the client invokes the
server command `sts.vscode-spring-boot.enableClasspathListening` based on the Java
extension's server mode.

The server also reads standard `workspaceFolders` or `rootUri`, declares workspace
folder support, and dynamically registers for workspace-folder changes.

### Behavior without JDT classpath integration

The current production configuration creates a `JdtLsProjectCache` as the Spring
Boot LS Java project service. That cache is populated from the custom classpath
listener flow described above.

If classpath listening is enabled but the client cannot handle
`sts/addClasspathListener`, registration fails or times out and classpath
listening is disabled. If initialization explicitly leaves JDT classpath support
disabled, the server can complete its base LSP initialization, but its Java
project table is not populated through the production path.

Therefore:

- the process can launch and complete basic LSP initialization independently;
- the production Java project model depends on custom client/JDT integration;
  and
- the exact subset of property, YAML, XML, and Java features that remains useful
  without that project model requires runtime verification.

### Distribution form and source license baseline

The VS Code build creates the Spring Boot LS artifact and places an extracted
server distribution inside the VS Code extension. It also packages the JDT LS
extension JARs and dependencies used by `javaExtensions`.

The repository and VS Code package identify the Spring Tools code as Eclipse
Public License 1.0, and the package includes a separate third-party license list.
This is only a source-license observation. Redistribution requirements and the
correct downloadable artifact for a Zed extension remain R005 work.

## Primary sources

All sources were accessed on 2026-07-14. Source links are pinned to Spring Tools
commit `0a141b2d0b669aa2d5caf4766481c29be6e99762`.

### Process and VS Code client

- [`vscode-extensions/vscode-spring-boot/lib/Main.ts`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/vscode-spring-boot/lib/Main.ts)
  — launch parameters, document selectors, initialization options, custom
  services, and UI integration.
- [`vscode-extensions/commons-vscode/src/launch-util.ts`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/commons-vscode/src/launch-util.ts)
  — JVM selection, JAR launch, stdio/socket client creation, and custom messages.
- [`LanguageServerRunner.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/commons/commons-language-server/src/main/java/org/springframework/ide/vscode/commons/languageserver/LanguageServerRunner.java)
  — server-side stdio and socket transport.
- [`SimpleLanguageServer.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/commons/commons-language-server/src/main/java/org/springframework/ide/vscode/commons/languageserver/util/SimpleLanguageServer.java)
  — initialization, workspace folders, capabilities, commands, and client
  connection.

### JDT integration protocol

- [`vscode-extensions/commons-vscode/src/classpath.ts`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/commons-vscode/src/classpath.ts)
  — client relay for classpath listener requests.
- [`vscode-extensions/commons-vscode/src/java-data.ts`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/commons-vscode/src/java-data.ts)
  — client relay for Java type, search, hierarchy, completion, Javadoc, location,
  and GAV operations.
- [`STS4LanguageClient.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/commons/commons-lsp-extensions/src/main/java/org/springframework/ide/vscode/commons/protocol/STS4LanguageClient.java)
  — custom server-to-client JSON-RPC interface.
- [`JdtLsProjectCache.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/spring-boot-language-server/src/main/java/org/springframework/ide/vscode/boot/jdt/ls/JdtLsProjectCache.java)
  — classpath listener lifecycle and Spring LS Java project cache.
- [`ClasspathListenerManager.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/commons/commons-language-server/src/main/java/org/springframework/ide/vscode/commons/languageserver/java/ls/ClasspathListenerManager.java)
  — dynamic callback command and custom client request flow.

### JDT LS extension bundles and packaging

- [`vscode-spring-boot/package.json`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/vscode-spring-boot/package.json)
  — `javaExtensions`, language definitions, version, Java extension dependency,
  commands, settings, and package license.
- [`vscode-spring-boot/scripts/preinstall.sh`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/vscode-extensions/vscode-spring-boot/scripts/preinstall.sh)
  — server and JDT extension artifact assembly.
- [`jdt-ls-extension/.../plugin.xml`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.extension/plugin.xml)
  — JDT LS delegate commands.
- [`ClasspathListenerHandler.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.extension/src/org/springframework/tooling/jdt/ls/extension/ClasspathListenerHandler.java)
  — JDT-side listener registration and client callback.
- [`SendClasspathNotificationsJob.java`](https://github.com/spring-projects/spring-tools/blob/0a141b2d0b669aa2d5caf4766481c29be6e99762/headless-services/jdt-ls-extension/org.springframework.tooling.jdt.ls.commons/src/org/springframework/tooling/jdt/ls/commons/classpath/SendClasspathNotificationsJob.java)
  — classpath event payload and callback execution.
- [Spring Tools installation documentation](https://github.com/spring-projects/spring-tools/wiki/Installation)
  — separate language-server process and JVM discovery.

## Inferences

### Direct dual-server registration is necessary but insufficient

Zed can plausibly start JDT LS and the Spring Boot LS as separate standard LSP
servers. That covers document synchronization and standard LSP requests, but it
does not implement the custom Spring-LS-to-client-to-JDT-LS request relay.

Therefore, dual registration alone is unlikely to provide the Java-aware Spring
feature set users see in VS Code.

### The Spring JDT LS bundles are a necessary integration component

The current production flow expects Spring-specific delegate commands inside JDT
LS. Those commands are delivered by Spring Tools JARs, not by stock JDT LS.

A Zed integration that reuses this design likely needs all of the following:

1. inject compatible Spring Tools bundles into JDT LS initialization;
2. handle Spring Boot LS custom server-to-client requests;
3. execute the corresponding commands against the correct JDT LS instance; and
4. route JDT LS callback commands back to the correct Spring Boot LS instance.

### Zed's additional-options hook solves only one layer

R001 found that one Zed adapter can add JSON initialization options to another.
That may be sufficient to append Spring JDT LS bundle paths to JDT LS
initialization, subject to R003 verification.

It does not supply arbitrary request handlers or cross-process message routing,
so it cannot by itself replace the VS Code coordinator behavior.

### A coordinator or protocol-aware proxy is the leading integration candidate

Because current Zed extension WASM code cannot register arbitrary LSP
server-to-client request handlers, the full relay probably requires a native
process in the LSP path. Candidate forms include:

- one coordinator that owns both JDT LS and Spring Boot LS;
- cooperating proxies around each server with a private side channel;
- an extension of the existing Zed Java proxy; or
- a reduced integration that does not implement Java-project-dependent Spring
  features.

No candidate is selected yet.

## Unverified hypotheses

1. The Spring JDT LS extension bundles can be loaded by the JDT LS version used
   by the current Zed Java extension through its `bundles` initialization option.
2. The existing Zed Java proxy preserves every custom JDT command and callback
   needed by the Spring Tools bundles.
3. A separate proxy around only the Spring Boot LS can reach and command the
   independently managed JDT LS instance without changing the Java extension.
4. Useful application properties/YAML completion and diagnostics remain when
   `enableJdtClasspath` is false and no Java project cache is populated.
5. Zed supports enough of the Spring Boot LS standard advertised capabilities
   for a valuable limited integration even when custom client messages fail.
6. Spring Boot LS accepts Zed as a client without relying on
   `-Dsts.lsp.client=vscode` behavior for essential features.
7. Workspace-folder changes and multi-root classpath events can be correlated
   correctly between independently managed Zed server instances.

## Runtime verification needed

1. Launch the pinned Spring Boot LS JAR over stdio with a minimal standard LSP
   harness and record initialization, advertised capabilities, custom requests,
   shutdown, and exit.
2. Run once with `enableJdtClasspath: false`; test a small matrix of properties,
   YAML, XML, and Java features and record which ones work without project data.
3. Run with classpath enabled but return method-not-found for
   `sts/addClasspathListener`; record failure timing and residual functionality.
4. Inject the pinned Spring Tools bundles into a compatible JDT LS and execute
   every command required by the minimum integration path.
5. Capture a VS Code reference trace for initial classpath registration and one
   Java-data request so a future coordinator has an exact behavioral oracle.
6. Test whether Zed accepts the Spring Boot LS dynamic registrations and standard
   capabilities without a proxy.

## Blockers and constraints

- Stock Zed does not implement the custom `STS4LanguageClient` Java-data and
  classpath requests identified here.
- The Zed extension API does not expose generic handlers for those requests.
- Spring Boot LS and the Spring JDT LS extension must be version-compatible; the
  source explicitly reports a JDT LS extension version mismatch when classpath
  event payloads do not have the expected shape.
- The existing Zed Java extension currently manages JDT LS and a native proxy,
  so a new extension does not automatically own or have a direct channel to the
  JDT LS process.
- The VS Code package bundles artifacts, while Zed publishing guidance prohibits
  bundling a language server in the extension. An alternate artifact acquisition
  and integrity strategy is required if the project proceeds.
- EPL 1.0 and bundled third-party components require a dedicated redistribution
  analysis before choosing an artifact or publishing mechanism.

## Candidate next experiments

Do not run product-facing Zed experiments until R003 confirms the JDT LS bundle
and initialization path.

1. **Headless Spring LS baseline:** launch over stdio with JDT classpath disabled
   and test one properties diagnostic/completion.
2. **Custom-request failure probe:** enable classpath and observe behavior when
   the client rejects `sts/addClasspathListener`.
3. **JDT bundle command probe:** load the Spring Tools JDT bundles in the same JDT
   LS version used for a later Zed spike and call one static command such as
   `sts.java.search.types`.
4. **Reference protocol trace:** record the complete classpath handshake under VS
   Code for comparison with a future coordinator.

## Interim conclusion

The Spring Boot Language Server is independently launchable as a Java stdio LSP
process, but its production Java project model is not independent of JDT LS. The
integration uses Spring-provided bundles inside JDT LS and the editor client as a
bidirectional relay between the two servers.

This changes the main feasibility question. It is no longer whether Zed can start
two processes; R001 already indicates that it can. The decisive question is
whether this project can safely inject the Spring bundles into the existing Zed
JDT LS setup and reproduce the custom request/callback relay, or whether a useful
MVP can deliberately omit Java-project-dependent features. R003 must now inspect
the exact JDT LS bundle, command, workspace, and Zed Java proxy constraints.

