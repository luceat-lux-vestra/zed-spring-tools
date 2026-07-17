# S012 Gate A disposable implementation

This directory contains only the disposable Gate A contracts for S012. It is
not a production extension, packaged dependency, or support claim.

## Components

- `bundle/`: one JDT LS OSGi bridge bundle with two allowlisted commands;
- `coordinator/official_java_transport.mjs`: bounded requests to the official
  Java proxy's existing loopback request endpoint;
- `coordinator/bridge_event_route.mjs`: authenticated direct classpath event
  route;
- `coordinator/companion_bridge_session.mjs`: exact add/remove lifecycle;
- `coordinator/spring_classpath_mapper.mjs`: mapping between Spring LS
  classpath requests, the bridge lifecycle, and the Spring child command; and
- `tests/`: Java protocol and Node contract tests.

All generated classes and JARs belong below the ignored root `tmp/`. The bridge
is compiled for Java 21 compatibility while the tested default toolchain is
Temurin JDK 25.0.3.

## Gate A verification

Run the Node contracts from the repository root:

```sh
node --check spikes/s012-unmodified-java-companion-bridge/coordinator/official_java_transport.mjs
node --check spikes/s012-unmodified-java-companion-bridge/coordinator/bridge_event_route.mjs
node --check spikes/s012-unmodified-java-companion-bridge/coordinator/companion_bridge_session.mjs
node --check spikes/s012-unmodified-java-companion-bridge/coordinator/spring_classpath_mapper.mjs
node --test spikes/s012-unmodified-java-companion-bridge/tests/coordinator_contract.test.mjs
```

Compile and run the pure Java protocol test using the fixed S011 Gson input:

```sh
mkdir -p tmp/s012-gate-a-protocol-classes
javac --release 21 --add-modules jdk.httpserver -Xlint:all,-classfile -Werror \
  -cp tmp/s011-s006-artifacts-input-20260717/jdtls/plugins/com.google.gson_2.14.0.jar \
  -d tmp/s012-gate-a-protocol-classes \
  spikes/s012-unmodified-java-companion-bridge/bundle/src/dev/zed/spring/s012/BridgeProtocol.java \
  spikes/s012-unmodified-java-companion-bridge/tests/dev/zed/spring/s012/BridgeProtocolSelfTest.java
java --add-modules jdk.httpserver \
  -cp tmp/s012-gate-a-protocol-classes:tmp/s011-s006-artifacts-input-20260717/jdtls/plugins/com.google.gson_2.14.0.jar \
  dev.zed.spring.s012.BridgeProtocolSelfTest
```

The full bundle compile also requires the fixed JDT LS plugin directory and the
five fixed S011 Spring bundles. The exact build inputs, output identity, and
retained lint observation are recorded in the S012 spike document.
