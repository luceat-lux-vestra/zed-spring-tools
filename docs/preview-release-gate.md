# Preview release gate and currency rules

- Status: Defined, **executed once** — see [Execution status](#execution-status)
- Date: 2026-07-29
- Related: [implementation-plan](implementation-plan.md) M6;
  [capability-inventory](capability-inventory.md);
  [COMPATIBILITY](../COMPATIBILITY.md); [LIMITATIONS](../LIMITATIONS.md);
  [pinned release refresh gate](pinned-release-refresh-gate.md)

M6 permits experimental previews only when "their capability inventory,
compatibility table, tested matrix, known blockers, third-party notices,
checksums, and rollback instructions are current". That sentence names seven
surfaces and defines none of them, so it cannot be passed or failed as written.
This document turns it into a gate: what a preview release *is* in this project,
what "current" means for each of the seven, how each is checked, and which
failures block a publish.

It deliberately does not add release automation. AGENTS.md lists product
packaging, release automation, and product CI as requiring their own direction
decision, and no such decision exists. Everything below is manual and stays that
way until one does.

## What a preview release is here — and what it is not

The distinguishing fact is that **this project does not control its own
distribution channel.** A Zed extension reaches users through the extension
registry, and the submission
([zed-industries/extensions#6875](https://github.com/zed-industries/extensions/pull/6875))
is still open. Merging it is a zed-industries maintainer's action, not ours. So
a preview release here cannot mean "users can now install this from Zed".

What the project does control is three things, and a preview release is exactly
those three moving together:

| Controlled | What it is |
| --- | --- |
| A git tag on this repository | The immutable commit the gate below passed on |
| A GitHub release marked pre-release | The published notes for that tag, carrying the currency snapshot |
| The commit the registry submodule pointer targets | What the pending submission would publish if merged |

A preview release therefore **ships no binary and adds no installer**. Its
install path is the one the README already documents — Install Dev Extension
against a checkout of the tag — plus the pinned Spring Tools VSIX the extension
downloads at first use. That is a narrower thing than the word "release"
normally implies, and the release notes must say so in their first paragraph
rather than let the tag imply otherwise.

## Version scheme, and the registry interlock

`extension.toml`'s `version` is not a private choice: it is the version the
registry would publish, and it must stay a plain SemVer release string. The
submission was prepared that way deliberately — the version was promoted from
`0.1.0-alpha.1` to `0.1.0` because the registry carried no pre-release entries
to follow. Treat that as the established convention for this submission rather
than as a validated registry rule; nothing in the registry's own validation was
observed rejecting a pre-release string.

That rules out carrying preview identity in the version string. It is carried by
GitHub's own pre-release flag instead:

- The git tag is `v<version>` and matches `extension.toml` exactly. No suffix.
- The GitHub release is created with `--prerelease`. That flag, not the version
  string, is what says "preview".
- Successive previews bump the patch: `0.1.0`, `0.1.1`, `0.1.2`.
- **Stability is declared by dropping the pre-release flag, never by the version
  string reaching some number.** This restates M6's standing rule that feature
  count is not a stability signal, in the one place where a version number would
  otherwise smuggle the claim back in.

The interlock to watch: bumping `extension.toml` and moving the registry pointer
are separate acts. Moving the pointer to a tag whose version equals an
already-published registry version publishes nothing and silently does nothing.
Bump first, tag second, move the pointer third.

## The seven currency rules

Each rule states what must be true, how it is checked, and whether a failure
blocks the publish. "Blocking" means the preview does not go out until it is
fixed or the claim is narrowed — never until the check is skipped.

### 1. Capability inventory — blocking

**Must be true.** Every row's state matches the evidence that row cites; the
summary counts equal the counts in the workstream tables; the inventory version
was bumped by whatever last moved a row.

**Check.** Mechanical, because the summary and the tables are two independent
statements of the same fact and drift between them is invisible by eye:

```bash
awk 'NR>=813' docs/capability-inventory.md | awk -F'|' 'NF>=4 {gsub(/[ `]/,"",$3); if ($3 ~ /^(verified|implemented|planned|blocked-zed-api|blocked-upstream|zed-native-equivalent|not-pursued)$/) print $3}' | sort | uniq -c
```

The line offset is the first workstream heading; the state is the second table
column. Compare the result against the `## Summary` table and against the tracked
total. Any mismatch is blocking, because the summary is what every other document
quotes.

### 2. Compatibility table — blocking

**Must be true.** Every tuple that a `verified` row rests on appears in
`COMPATIBILITY.md`, and no tuple appears there that no gate actually ran on.

**Check.** For each capability gate merged since the previous preview, confirm
its tuple is recorded. The direction that matters is the second one: a tuple
listed without a gate behind it is a support claim the project did not earn, and
that is the failure mode this rule exists to catch.

### 3. Tested matrix — blocking

**Must be true.** The desktop and Java matrices mark as `Untested` everything
that has not been driven, and no release-facing text — notes, README status row,
registry description — widens them.

**Check.** Read the two matrices, then read the release notes draft against them.
This is the rule most likely to be violated by *prose* rather than by a table,
because "works on macOS, Linux and Windows" is a natural sentence to write about
platform-neutral code that has only ever run on one host.

### 4. Known blockers — blocking

**Must be true.** `LIMITATIONS.md`, the README's limitations section, and the
inventory's `blocked-*` rows agree with each other — including their numbers.

**Check.** Compare the counts stated in prose against rule 1's extraction. Prose
counts are the weakest link in this repository: they are copied by hand, they
appear in at least three files, and nothing recomputes them. This rule found the
first real defect the gate has caught (see Execution status).

### 5. Third-party notices — blocking

**Must be true.** The notices cover everything the release distributes. For this
project that is *two* things, and only the first is obvious:

- the source tree, whose third-party inputs are the pinned Spring Tools VSIX
  (acquired by the user at runtime, not redistributed), the tree-sitter
  properties grammar (fetched and built by Zed at install time), and the
  research-only proxy patches;
- **the WebAssembly binary the registry builds from that source and serves to
  every user.** The Rust dependency tree is compiled into it. Those crates are
  redistributed by the registry even though this repository never commits a
  binary, which is exactly why they are easy to omit.

**Check.** Enumerate the locked dependency tree and its licenses:

```bash
python3 - <<'EOF'
import re,pathlib,collections
lock=pathlib.Path('Cargo.lock').read_text()
pkgs=re.findall(r'\[\[package\]\]\nname = "([^"]+)"\nversion = "([^"]+)"',lock)
src=list(pathlib.Path.home().glob('.cargo/registry/src/*/'))
lic=collections.Counter(); missing=[]
for n,v in pkgs:
    if n=='zed-spring-tools': continue
    for s in src:
        p=s/f'{n}-{v}'/'Cargo.toml'
        if p.exists():
            m=re.search(r'^license\s*=\s*"([^"]+)"',p.read_text(),re.M)
            lic[m.group(1) if m else 'NO-LICENSE-FIELD']+=1
            break
    else: missing.append(f'{n} {v}')
print(len(pkgs)-1,'packages'); print(lic.most_common()); print('uncached:',missing)
EOF
```

A non-permissive license, or a `NO-LICENSE-FIELD`, is blocking. An uncached crate
is not a pass — it is unread, and must be resolved before the licenses can be
called clean.

### 6. Checksums — blocking

**Must be true.** The pinned-artifact constants are internally consistent and
have been exercised against a real download, not merely typed.

**Check.** `cargo test` covers the shape assertions in `src/artifacts.rs`
(`URL` contains `VERSION`, `URL` ends with `ASSET`, `SHA256` is 64 characters).
Consistency is not sufficiency: the constants are only *proven* by an install
that verifies them, so the standing evidence is the offline gate
(`tmp/offline-behaviour-20260726/evidence/`), which exercises checksum
verification and repair of a corrupt install. A preview whose pin changed since
that gate must re-run it.

Note what this rule is *not* about: the release publishes no artifact of its own,
so there are no release checksums to compute. The checksums that matter are the
ones the extension enforces at install time on someone else's artifact.

### 7. Rollback instructions — blocking

**Must be true.** Both directions are written down and reachable from the release
notes: a user can get off this preview, and the project can withdraw it.

**Check.** The [Rollback and withdrawal](#rollback-and-withdrawal) section below
is that instruction; the rule is that the release notes link it and that it still
matches how the extension actually installs.

## Publish procedure

Manual, in this order. Steps 1-3 are the gate; steps 4-6 are the publish.

1. Confirm the working tree is `main` at the exact commit to be tagged, and that
   no slice is in flight.
2. Run all seven rules. Record each verdict — pass, or the specific defect — in a
   dated evidence directory under the ignored `tmp/preview-<version>-<date>/`
   path, the same convention the driven gates use.
3. Fix every blocking defect on its own branch and merge it before continuing.
   A gate whose findings are fixed in the release commit itself cannot be
   audited afterwards.
4. Bump `extension.toml` `version` and the matching `Cargo.toml` `version` if
   this preview publishes a new version, and merge that as its own change.
5. Tag `v<version>` on the merged commit and create the GitHub release with
   `--prerelease`. The notes must open by stating what the release is not — no
   binary, no registry availability until the submission merges, one tested
   tuple — and then link the inventory, `COMPATIBILITY.md`, `LIMITATIONS.md`,
   and the rollback section here.
6. If the registry submission is still open, move its submodule pointer to the
   new tag's commit and confirm the registry's own checks pass. If it has
   merged, this step is a new submission PR instead.

Steps 5 and 6 are the outward-facing ones and are the maintainer's to fire.

## Rollback and withdrawal

Neither direction has been exercised. Both are written from how the extension
demonstrably installs and removes itself, and should be confirmed the first time
either is actually needed.

**A user leaving a preview.** The install path is a dev extension built from a
checkout, so leaving one is a checkout of the previous tag and a rebuild, or an
uninstall. Uninstall is the better-evidenced half: the removal contract is
driven and verified — it removes the official Java classpath bridge, leaves no
owned process or route, and empties the install directory. The pinned Spring
Tools artifacts stay in the per-version work and download directories, so moving
between two tags does not re-download them.

**A user on a registry install** cannot choose a version; Zed installs the
current one. The project's only lever is publishing a higher version that
reverts the change. That asymmetry is a reason to keep previews frequent and
small rather than large and rare.

**The project withdrawing a preview.** `main` is protected and history must stay
linear, so a published tag is not deleted and not moved. Withdraw by editing the
GitHub release to say plainly that it is withdrawn and why, publishing the next
patch with the revert, and — if the registry submission is open — moving its
pointer off the withdrawn commit. The tag stays as the record that it existed.

## Execution status

**Executed once, on 2026-07-29, against `main` at the M6 slice-5 merge**
(`31ae3e1`). Evidence: `tmp/preview-release-gate-20260729/evidence/`. All
seven rules were run. Four passed; three found defects, all three of them
currency drift rather than product faults, and all three fixed in the same change
that added this document — an exception to the procedure's step 3, taken because
this run *is* the document's first draft and there was no prior gate to audit it
against. Later runs follow step 3.

| Rule | Verdict | Finding |
| --- | --- | --- |
| 1. Capability inventory | Pass | Extraction returns 47 `verified`, 6 `zed-native-equivalent`, 4 `blocked-zed-api`, 2 `not-pursued`, summing to 59, which matches the summary table exactly. Inventory version 49. |
| 2. Compatibility table | Pass | Every tuple cited by a `verified` row is recorded, including the two added on 2026-07-29 for the Gradle axis and the embedded MCP server. |
| 3. Tested matrix | Pass | Five of six desktop tuples `Untested`; JDK 22-24 `Untested` with the reason stated. No release-facing text widens either. |
| 4. Known blockers | **Defect, fixed** | `LIMITATIONS.md` stated "46 of 59 tracked capabilities are proven" against an actual 47. The count went stale when the embedded MCP server was promoted to `verified` in #78; the README status row and the inventory summary were both updated then and the prose count was not. |
| 5. Third-party notices | **Defect, fixed** | `THIRD_PARTY_NOTICES.md` covered the VSIX, the grammar and the proxy patches, but said nothing about the 106 locked Rust crates compiled into the WASM the registry builds and serves. 104 were resolved from the local cargo cache and are all permissive; `derive_arbitrary` and `linux-raw-sys` were not cached and are recorded as unread rather than assumed. |
| 6. Checksums | Pass | `src/artifacts.rs` carries `VERSION`, `ASSET`, `URL`, `SIZE`, `SHA256` and 5 per-entry `REQUIRED` digests, consistent under `cargo test`, and last exercised end to end by the 2026-07-26 offline gate. The pin has not changed since. |
| 7. Rollback instructions | **Defect, fixed** | No rollback instruction existed in either direction. The README said only that there is "no rollback flow", which was accurate and is now superseded by the section above. |

**No preview has been published.** The gate now passes, so the remaining step is
steps 4-6 of the procedure, which are outward-facing and belong to the
maintainer. Until one is published, M6's stable-release criterion that a preview
has been published *and observed in use* is unmet — and it is worth stating that
the observation half is the part that cannot be shortcut: publishing is an
afternoon, and being observed in use is not.
