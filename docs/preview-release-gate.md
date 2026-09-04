# Release gate and registry lifecycle

- Status: Current release policy
- Updated: 2026-09-04
- Authoritative release tracker: [release Epic #108](https://github.com/luceat-lux-vestra/zed-spring-tools/issues/108)
- Native release milestone: `Registry publication & v1.0 readiness`
- Related: [capability inventory](capability-inventory.md),
  [compatibility](../COMPATIBILITY.md), [limitations](../LIMITATIONS.md),
  [pinned release refresh gate](pinned-release-refresh-gate.md)

This document defines the repository-side release gate for Zed Spring Tools.
It supersedes the earlier M6 policy that treated a sequence of GitHub
pre-releases plus an open-ended observation period as a prerequisite for a
stable release.

The 2026-07-29 preview-gate run remains useful historical evidence: it proved
that capability inventory, compatibility claims, limitations, third-party
notices, pinned-artifact checksums, and rollback instructions could be audited
as one release-currency set. Those checks remain part of the release gate. What
changed is the **promotion policy**, not the evidence discipline.

## GitHub-native planning model

The release program uses GitHub's native planning surfaces for different jobs:

- release Epic #108 is the policy and ownership root;
- native sub-issues under #108 are authoritative for Epic → Track → Task
  decomposition;
- native milestone `Registry publication & v1.0 readiness` is the bounded
  release horizon and owns #108, release Tracks #109/#110, release Tasks
  #112/#113, and any later issue whose completion is required for this release
  horizon;
- community platform Track #111 and Tasks #114-#118 remain outside that
  milestone while they are non-blocking validation work;
- #113 is release-blocked by #112 and should use the native GitHub issue
  dependency relationship in addition to prose references;
- #112 remains externally blocked until
  [zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875)
  is merged and the extension is actually visible through the Zed Registry.

Do not add an arbitrary milestone due date. Add one only when there is a real
external or project delivery commitment that the repository can cite.

The release milestone closes only after all release-owned issues are complete
or explicitly reclassified/moved, any release-blocking defects are resolved or
have an evidence-backed defer decision, release-facing documentation agrees
with the delivered state, and release Epic #108 is completed. Community
platform validation may remain open independently.

## Current release policy

The current path is intentionally narrow:

1. Keep the already submitted Zed Registry version at `0.1.0` until the first
   Registry publication completes.
2. Verify a fresh install through the **real Zed Registry path**, including
   first-run artifact acquisition and the official Java/Spring coordinator
   lifecycle.
3. Fix and re-run the bounded gate if that install reveals a release-blocking
   defect.
4. If the Registry lifecycle succeeds and release-facing claims still match the
   evidence, the next intentional release may be `1.0.0`.

There is no requirement to manufacture `0.1.1`, `0.1.2`, and similar preview
releases merely to signal maturity, and there is no arbitrary soak-duration
requirement. Community validation on additional platforms remains valuable and
independently tracked, but it is not a v1.0 blocker while public support claims
remain scoped to evidence.

Likewise, JDK 22/23/24 do not need a matrix solely because those feature
releases exist. The project maintains its declared JDK floor and its currently
tested runtime; new JDK gates are added for a new LTS or an actual compatibility
risk/defect.

## Distribution model

The product is distributed through the Zed extension registry. This repository
contains source; it does not publish a standalone application binary or its own
Spring Tools distribution.

The initial registry submission is
[zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875).
Until that submission is merged and installable from the Registry, the supported
installation path for testing remains a Zed development extension checkout.

`extension.toml` is the Registry-visible extension version. A release operation
must keep source commit, registry pointer/version, release notes, and any Git tag
or GitHub Release used for project provenance coherent. Do not move or rewrite a
published release tag.

## Release-currency checks

Every release candidate must pass the following checks against the exact final
candidate. A green CI run alone is not sufficient.

### 1. Capability inventory

[`capability-inventory.md`](capability-inventory.md) is authoritative for the
capability state counts and per-row evidence. Release-facing prose must agree
with it. As of inventory version 55 the current summary is:

- 59 tracked
- 48 `verified`
- 0 `implemented`
- 0 `planned`
- 3 `blocked-zed-api`
- 0 `blocked-upstream`
- 6 `zed-native-equivalent`
- 2 `not-pursued`

A capability is never promoted merely because code exists.

### 2. Compatibility claims

[`COMPATIBILITY.md`](../COMPATIBILITY.md) owns the exact tested runtime tuples.
No README, release note, registry description, or v1.0 claim may widen support
beyond maintained evidence.

The platform-aware implementation is not itself multiplatform evidence.
Community desktop validation remains tracked separately from the release gate.

### 3. Known limitations

[`LIMITATIONS.md`](../LIMITATIONS.md), README limitations, and capability
inventory blockers must describe the same current product boundary. A known
release-blocking correctness defect must be fixed or the claim narrowed before
publication.

### 4. Third-party notices and pinned artifacts

[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) must remain consistent with
what the Registry build/runtime actually redistributes or acquires. The pinned
Spring Tools artifact identity and checksums must match `src/artifacts.rs` and
must have real acquisition evidence when the pin changes.

### 5. Registry/version/provenance identity

For the exact candidate, verify:

- the Registry submission/submodule points at the intended reviewed commit;
- `extension.toml` carries the intended Registry version;
- any release tag/GitHub Release used for provenance names that same release;
- no already-published version/tag is rewritten; and
- rollback can identify the previous known-good source/version unambiguously.

### 6. Real Registry install lifecycle

The first Registry publication and every release whose installation/runtime
boundary materially changes must be exercised through the actual Registry path,
not inferred from Install Dev Extension evidence.

The bounded lifecycle gate covers at least:

- clean Registry installation;
- first-run pinned Spring Tools acquisition and checksum verification;
- official Java/coordinator handshake;
- representative Spring completion and diagnostics;
- restart and warm cached/offline startup;
- uninstall and owned-process/resource cleanup; and
- actionable failure behavior rather than partial startup.

For the initial publication this work is tracked by #112 under release Epic
#108.

### 7. Rollback and withdrawal

A bad release is corrected by publishing a new version from reviewed source, not
by mutating a published tag/version. Release notes should clearly mark a
withdrawn/bad version and point users to the corrective version when applicable.

Pinned Spring Tools rollback remains governed by the separate
[pinned-release refresh gate](pinned-release-refresh-gate.md), which keeps that
upstream identity change independently revertible and evidenced.

## v1.0 meaning

For this project, `1.0.0` means:

- the currently declared product scope is intentionally stable;
- the official Registry distribution path has been exercised successfully;
- capability, compatibility, limitation, and dependency/provenance claims are
  current; and
- no known defect invalidates those claims.

It does **not** mean complete VS Code UI parity, implementation of capabilities
blocked by missing Zed APIs, every desktop/architecture tuple tested, every JDK
feature release tested, or a predetermined amount of calendar-time soak.

## Historical M6 preview-gate record

On 2026-07-29 the original seven-rule preview gate was executed once against the
then-current M6 candidate. That run found documentation/release-currency drift
rather than a product correctness failure: a stale capability count, incomplete
third-party-notice coverage for Rust dependencies compiled into the Registry
WASM artifact, and missing rollback instructions. Those findings were fixed and
the gate passed.

That run remains historical evidence for the currency checks above. Its former
promotion rule — successive preview patch releases followed by an observation
period before stability — is **superseded** by the current Registry-first policy
in release Epic #108.

## Decision rule

> Release claims follow current evidence. Distribution-path evidence is required
> before v1.0; arbitrary version churn, arbitrary soak time, untested-platform
> claims, and CI-green-only approval are not substitutes for that evidence.
