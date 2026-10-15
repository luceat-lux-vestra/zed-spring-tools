# Release gate and registry lifecycle

- Status: Current release policy
- Updated: 2026-10-14
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
- #159 is closed: #160 removed the private Java transport and passed the
  exact-candidate D007 gate, with release evidence attached to that issue.
- #109 is waiting on upstream maintainer review/merge of the refreshed
  [zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875)
  at `0.1.0`.
- #112 remains blocked until the extension is actually visible through
  the Zed Registry; development-extension validation is not a substitute
  for the Registry-installed lifecycle.

Do not add an arbitrary milestone due date. Add one only when there is a real
external or project delivery commitment that the repository can cite.

The release milestone closes only after all release-owned issues are complete
or explicitly reclassified/moved, any release-blocking defects are resolved or
have an evidence-backed defer decision, release-facing documentation agrees
with the delivered state, and release Epic #108 is completed. Community
platform validation may remain open independently.

## Current release policy

The current path is intentionally narrow:

1. **Complete:** #159 / #160 resolved the private transport and passed
   exact-candidate D007 capability, desktop development-extension, and CI gates.
2. **Waiting on upstream:** keep the refreshed initial Registry submission at
   `0.1.0` pending maintainer review/merge; do not claim it is published.
3. **After publication:** verify a fresh install through the
   **real Zed Registry path**, including first-run artifact acquisition and
   maintained Java/Spring runtime coexistence.
4. Fix and re-run the bounded gate if that install reveals a release-blocking
   defect.
5. If the Registry lifecycle succeeds and release-facing claims still match the
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

The product is intended to be distributed through the Zed extension registry.
It is not yet published there. This repository contains source; it does not
publish a standalone application binary or its own Spring Tools distribution.

The initial registry submission is
[zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875).
It remains open after refresh to the reviewed D007 source commit
`f23dcc99d4ab40f9b53ec33fb646dac2109efeef`, with upstream review/merge
pending. The #159 publishing-boundary blocker is resolved. Until the extension
is actually installable from the Registry, the supported testing path remains
a Zed development extension checkout.

`extension.toml` is the Registry-visible extension version. A release operation
must keep source commit, registry pointer/version, release notes, and any Git tag
or GitHub Release used for project provenance coherent. Do not move or rewrite a
published release tag.

## Security pre-publication operator hold — R2A #105

The repository now provides an executable **nonpublishing** exact-SHA gate:
`.github/workflows/release-codeql-preflight.yml`, backed by
`tools/ci/release_codeql_preflight.py`. Dispatch it from trusted current
`main` with the immutable reviewed candidate source SHA. It first reuses an
eligible original four-language CodeQL scan or joins a matching active scan;
if absent it dispatches the canonical scanner for that exact protected-main
ancestor and waits for a bounded verification of original SARIF, four source
manifests, run identity and security findings. This gate never mutates the
external Zed Extension Registry.

```bash
repo=luceat-lux-vestra/zed-spring-tools
candidate="$(gh api "repos/$repo/git/ref/heads/main" --jq '.object.sha')"
gh workflow run release-codeql-preflight.yml -R "$repo" --ref main -f candidate_sha="$candidate"
# Inspect the run and original proof before requesting the upstream operator action.
```

Before an **operator-requested** Registry submission/update or upstream merge,
hold that step until this workflow has PASSED for the exact candidate SHA, plus
the other D007/desktop/version gates. The existing upstream PR and arbitrary
external maintainer/owner UI/API submissions cannot be technically blocked by
this repository's Actions: this is an operator governance requirement, not an
end-to-end enforcement claim.

The required `scripts/check-workflow-policy.mjs` policy also blocks any new
**repository-managed** publisher workflow without a `codeql-preflight` job
and an explicit publication-job dependency. It does not introduce an artificial
Registry automation merely to run the check.



Routine PRs intentionally do **not** execute CodeQL. Weekly and deliberate
manual runs analyze `actions`, `javascript-typescript`, `java-kotlin` (Java
only using `build-mode: none`; Kotlin sources fail coverage), and `rust`.
New security findings can therefore be discovered after a merge.

**HOLD before a new or updated Registry submission, requested upstream merge,
version release, public release tag, or change to a Registry source pointer:**
the operator verifies the exact reviewed source SHA, `extension.toml`
version, upstream Registry source pointer, and successful *four-language*
CodeQL on that same protected-main SHA. Each language must have the original
SHA-labelled SARIF artifact, valid invocation and expected CodeQL query pack,
and zero High/Critical findings as checked by
`.github/scripts/release-codeql-verdict.py`. Inspect the CodeQL workflow run
ID, job conclusions, per-language verdicts and retained raw SARIF artifacts.
Never use a green CI check or a different commit's scan as a substitute. If
the candidate changed or artifacts are missing/expired (90-day retention),
**do not publish**; scan the exact new candidate.

To launch a nonpublishing scan of reviewed `main`:

```bash
repo=luceat-lux-vestra/zed-spring-tools
sha="$(gh api "repos/$repo/commits/main" --jq .sha)"
gh workflow run codeql.yml -R "$repo" --ref main -f candidate_sha="$sha"
```

The actual distribution path is external
[zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875).
This is an **operator-enforced hold**, not an automatic upstream Registry
publication veto: local Actions cannot block an external maintainer or
owner-side UI/API action. Do not mutate that upstream PR, extension version,
or published tags in the course of this security CI migration.

## Release-currency checks

Every release candidate must pass the following checks against the exact final
candidate. A green CI run alone is not sufficient.

### 1. Capability inventory

[`capability-inventory.md`](capability-inventory.md) is authoritative for the
per-row historical evidence, while
[`protocol/d007-capability-acceptance.json`](../protocol/d007-capability-acceptance.json)
is the fail-closed overlay for the standalone migration. As of inventory version
57 the 59 historical row states remain 48 `verified`, 3
`blocked-zed-api`, 6 `zed-native-equivalent`, and 2 `not-pursued`, but
those numbers are **not a current standalone release-facing verified count**.

The source-controlled D007 acceptance matrix defines evidence obligations,
not the latest execution result: its 52 `currentClaim: pending-d007` entries
were assessed by the exact-candidate acceptance run attached to #159. That
release record reports 52 accepted evidence-required rows, 7 explicitly
terminal rows, and 0 pending/failed. The matrix was intentionally not
rewritten after the accepted run, since that would create a new source HEAD.
A desktop architecture-smoke PASS alone cannot promote rows.

A capability is never promoted merely because code exists or because a
historical tuple passed under the retired Java-transport architecture.

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
- coexistence of the official Java extension and standalone Spring runtime;
- representative Spring completion and diagnostics;
- no unexpected Spring error-level window messages during acceptance probes;
- actual execution of generated Maven/Gradle Boot run tasks where the release
  claims that generated workflow;
- restart and warm cached/offline startup;
- uninstall and owned-process/resource cleanup; and
- actionable failure behavior rather than partial startup.

For initial publication, #159 already cleared the repository-side publishing
boundary. The remaining real Registry lifecycle is tracked by #112 under
release Epic #108 and begins after upstream Registry publication.

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
