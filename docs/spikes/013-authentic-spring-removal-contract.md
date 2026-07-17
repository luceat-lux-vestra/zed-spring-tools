# S013: Authentic Spring removal contract

- Status: Gate B prepared and reviewed; Gate C not started
- Last updated: 2026-07-17
- Target tuple: macOS 26.5.1 arm64, Zed 1.10.3, Temurin JDK 25.0.3
- Depends on: S012 Refuted on cleanup; D003 remains Proposed

## Objective and narrow hypothesis

Test one correction to the otherwise successful S012 unmodified-Java bridge:
accept the authentic Spring `sts/removeClasspathListener` wire shape without
weakening any other coordinator contract.

Spring Tools 5.2.0.RELEASE constructs removal with
`new ClasspathListenerParams(callbackCommandId)`. That class retains its
default `batched = false` property, so the JSON-RPC request contains exactly
`callbackCommandId` and `batched`. The copied S006 coordinator instead accepts
only `callbackCommandId`; S012 therefore rejected the request before its
official-Java transport or bridge removal command was reached.

If the S012 wrapper translates only the exact two-key removal shape with
`batched: false` to the coordinator's existing one-key internal shape, then the
same fixed official Java extension, official proxy, bridge registration, real
classpath event, Spring child, and visible `server.port` completion can also
produce an exact bridge removal result and remove the owned credential route.

## Confirmed facts and primary source references

- S012 final-v4 recorded the supported functional sequence through one visible
  `server.port`, followed by `jdt-remove-failed`; the official Java component,
  proxy, and bridge hashes remained fixed.
- The retained S012 wrapper rejects removal unless `message.params` has exactly
  one key. See
  `spikes/s006-spring-boot-end-to-end/extension/probe/spring_proxy.mjs`, method
  `Coordinator.#handleRemove`.
- Spring source commit `18d1a975dbea4f9314fd736d0237bd9e23f243f9`
  constructs removal in
  `headless-services/commons/commons-language-server/.../ClasspathListenerManager.java`
  and defines the defaulted `batched` property in
  `headless-services/commons/commons-lsp-extensions/.../ClasspathListenerParams.java`.
- The S012 failure occurred before the bridge remove command. It does not show
  that official Java or the injected bridge cannot remove the listener.

## Allowed disposable change

Add one pure frame-normalization helper to the disposable S012 Spring wrapper.
It may transform only a JSON-RPC request whose method is
`sts/removeClasspathListener`, whose ID is valid, and whose params contain
exactly `batched: false` plus a valid callback ID. It removes only the redundant
`batched` field before the existing coordinator receives the frame. Add,
callback, completion, response, notification, shutdown, and malformed removal
frames remain byte-for-byte or structurally unchanged as appropriate.

The original S012 final-v4 evidence and Refuted result remain immutable. All
new builds, profiles, routes, credentials, logs, and screenshots use wholly
fresh ignored S013 roots. No official Java, official proxy, JDT LS, Spring
binary, bridge Java source, product scaffold, or release file may change.

## Pre-runtime procedure

1. Add unit cases for the authentic two-key shape, already-canonical shape,
   `batched: true`, extra keys, malformed IDs, notifications, responses, and
   unrelated methods.
2. Rerun the complete S012 Node contracts, Java protocol test, wrapper
   self-test, preparation self-test, deterministic bridge check, adapter host
   tests, and fixed-hash verification.
3. Update only the wrapper identity in the preparation allowlist and create a
   wholly fresh profile, worktree, four XDG roots, and evidence root.
4. Review the final diff, generated settings, empty routes/evidence, exact six
   bundles, pristine JDT, and absence of runtime processes before launch.

## One bounded runtime

Repeat S012's exact bounded sequence once with the fresh S013 roots: empty
Zed-originated baseline; official bridge registration; authentic six-argument
classpath event; one real Spring handler result; one later Zed-originated and
visibly offered `server.port`; Spring disable; authentic two-key removal;
official bridge remove result; owned route deletion; process absence; fixed
asset rehash; derived Equinox cleanup; app detachment; and normal Zed restore.

No retry is allowed after baseline, registration, or classpath input. A failure
to remove after the authentic shape reaches the official transport is Refuted.
Wrong inputs, UI attribution failure, or premature termination are
Inconclusive.

## Success criteria

S013 is **Supported on macOS arm64/JDK 25** only if all S012 functional evidence
repeats unchanged and the evidence sequence additionally contains one
`s012-bridge-removed` and one `jdt-remove-result`, contains no removal failure,
and leaves no owned credential route or isolated process. The official Java
component and proxy must remain byte-for-byte fixed and no second JDT LS may
exist.

## Plan review record

Reviewed before implementation on 2026-07-17. The review rejected broadening
accepted params, changing the bridge protocol, manually invoking removal,
reusing final-v4, or treating process-exit cleanup as equivalent to the real
Spring remove request. It selected one exact wire-shape normalization at the
Spring boundary and requires a wholly fresh attributable run.

## Gate A/B implementation and verification record

The disposable wrapper now contains one pure
`normalizeSpringRemovalFrame` function. It accepts only a request with a string
or numeric ID, method `sts/removeClasspathListener`, exact keys
`callbackCommandId` and `batched`, `batched: false`, and the fixed dynamic
callback syntax. It removes only `batched` from the internal message passed to
the existing coordinator and retains the original raw frame. Seven negative
cases prove that canonical, batched-true, extra-key, malformed-ID,
notification, unrelated-method, and response frames remain unchanged.

The corrected wrapper is 17,208 bytes with SHA-256
`48fb355468b0b54a6c87481df2f0927e45b401398eccd00086c6a6c91135fd50`.
Its self-test passed. The complete eleven S012 Node contracts, preparation
self-test, Java bridge protocol self-test, five adapter host tests, bridge JAR
validation, and two-build bridge identity check also passed without changing
the bridge, adapter, official Java, or proxy identities.

The fresh ignored Gate B roots are prefixed
`tmp/s012-s013-gate-b-*-final-20260717`. The preparation manifest is
`tmp/s012-s013-gate-b-evidence-final-20260717/s012-prepared-manifest.txt`;
the derived JDT data suffix is
`e785bd8f41280ee743eec041d086267a821b28d6`. Preparation verified empty runtime
state, exact six bundles, pristine JDT, fixed inputs, no second JDT launcher,
and no running Zed/JDT/Spring process. Gate C has not started.

## Remaining uncertainty after support

A Supported result covers only the fixed local tuple and does not make the
official proxy endpoint public or stable, validate Java updates, resolve other
unhandled Spring client requests, establish multiplatform support, or by itself
approve production packaging.
