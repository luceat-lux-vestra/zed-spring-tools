# R010: Experimental public-source audit

- Status: Complete; owner decisions block publication
- Last updated: 2026-07-17
- Audited commit: `11f1845a6d9a2a6ddc610dfe4f0b6153b9c8c2b2`
- Scope: reachable Git history and the public-source document set

## Question

Is the current repository mechanically suitable for an experimental public
GitHub source release, and which remaining decisions cannot be made safely by
the implementation agent?

## Confirmed facts

### Reachable history and size

1. The audited `main` history contains 51 commits and 132 tracked files.
2. All reachable history contains 335 distinct blob observations totaling
   4,608,944 bytes. The largest reachable blob is 80,065 bytes.
3. No reachable path has a binary, archive, credential-container, or generated
   runtime suffix from the audited set: JAR, WAR, EAR, ZIP, TAR variants, 7z,
   DMG, PKG, EXE, DLL, SO, dylib, WASM, class, VSIX, PEM, P12, PFX, or key.
4. No Git LFS path is configured or tracked.
5. Ignored `tmp/`, log, Rust target, and generated extension-WASM paths are not
   part of the tracked source.

### Credential and privacy pattern review

1. A full reachable-history scan found no GitHub token, AWS access-key ID,
   private-key header, Slack token, or Google API-key-shaped value under the
   explicit high-confidence patterns recorded below.
2. A broader assignment scan found `token`, `secret`, and `password` fields only
   in the loopback-protocol experiments and tests. Inspection confirmed random
   generation, field/type declarations, empty-URL-password validation, or
   obvious repeated-character fixtures. No retained runtime credential was
   found.
3. A full reachable-history scan found no absolute macOS, Linux, or Windows home
   path of the forms `/Users/...`, `/home/...`, or `X:\\Users\\...`.
4. Git commit metadata contains one distinct author identity with a non-noreply
   email address. Publishing the existing history will publish that address.
   The project owner must explicitly accept it or request a history rewrite.

### Third-party and repository identity review

1. No acquired Spring, JDT, Zed Java, Zed application, or generated runtime
   binary is reachable. `THIRD_PARTY_NOTICES.md` records the source-patch and
   ignored-local-artifact boundaries.
2. S005 and S006 patch files retain the fixed official-Java commit and
   Apache-2.0 provenance. The accepted product architecture does not use those
   instrumented proxy patches.
3. The repository has no `LICENSE`, `NOTICE`, or `COPYING` file. R005 confirms
   that the project license is independent from the external Spring Tools
   EPL-1.0 boundary and must be accepted by Zed for future extension code.
4. Nine spike manifest/generator locations currently identify
   `https://github.com/algorist/zed-spring-tools`. No repository exists at that
   path. The locally authenticated GitHub account is a different namespace, and
   no repository exists at the same project name there either.
5. No Git remote is configured. The audited commit therefore has not been
   pushed by this worktree.
6. All relative Markdown links in the 46 Markdown files present at the audited
   commit resolve locally.

## Reproduction commands

The audit used read-only Git, ripgrep, GitHub CLI, and a local Markdown-link
check. The important command classes were:

```text
git status --short
git rev-list --count HEAD
git rev-list --objects --all | git cat-file --batch-check=...
git grep ... $(git rev-list --all)
git log --format=... | sort -u
git lfs ls-files
git check-attr filter -- <tracked paths>
git remote -v
rg <absolute-home and credential patterns>
gh repo view <candidate namespace/repository>
```

High-confidence credential shapes included GitHub prefixed tokens, AWS
`AKIA...` identifiers, PEM private-key headers, Slack tokens, and Google API
keys. Matches were reported by path only during the initial scan, then reviewed
as source or fixtures without copying any potential credential into this
document.

## Primary inputs and references

- Local Git object database and reachable refs at audited commit
  `11f1845a6d9a2a6ddc610dfe4f0b6153b9c8c2b2`.
- `.gitignore`, tracked path list, Git attributes, commit metadata, and remote
  configuration in this worktree, accessed 2026-07-17.
- GitHub repository lookup through the authenticated GitHub CLI, accessed
  2026-07-17.
- [R005](005-distribution-and-licensing.md) for external artifact and license
  boundaries.
- Root `COMPATIBILITY.md`, `LIMITATIONS.md`, `THIRD_PARTY_NOTICES.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` at the audited
  commit.

## Inferences

1. A normal Git push of `main` will not transmit local unreachable objects,
   ignored runtime evidence, or untracked artifacts. Only reachable refs and
   the objects they require are in the publication boundary.
2. The small, source-only reachable object set does not require Git LFS for the
   experimental publication.
3. The current public documents are sufficient to explain that the repository
   is research-only, requires official Java in the future product, has one
   verified local tuple, and makes no multiplatform or Marketplace claim.

## Unverified hypotheses

1. The owner accepts publication of the existing Git author name and email.
2. The authenticated GitHub account is the intended public owner rather than
   the namespace currently embedded in spike manifests.
3. The owner will choose a permissive Zed-accepted license rather than a
   copyleft or dual-license policy.
4. GitHub private vulnerability reporting will be enabled immediately after
   repository creation so `SECURITY.md` has a working private route.

## Runtime verification needed

No additional Zed/JDT/Spring runtime is required for this publication audit.
After the remote is created, verify that the default branch tree matches the
local commit, relative links render on GitHub, private vulnerability reporting
is available, and GitHub's repository-side secret scanning reports no alert.

## Blockers and constraints

- The project owner must select the repository license.
- The project owner must accept the existing author metadata or authorize a
  history rewrite before publication.
- The project owner must select the GitHub namespace so the nine embedded
  repository URLs can be corrected consistently.
- Remote creation and push must wait until those decisions are reflected in a
  final clean audit.
- This pattern review reduces publication risk but is not proof that arbitrary
  sensitive information cannot exist. Repository-side scanning and human
  review remain part of the post-push check.

## Candidate next actions

1. Record the license, author-metadata, and namespace decisions together.
2. Add the exact license text and correct the nine repository URLs.
3. Re-run this audit against the new reachable commit and ensure the worktree is
   clean.
4. Create the public repository, enable private vulnerability reporting, push
   `main`, and verify the remote tree and rendered documentation.
5. Only after M1 exits, start D004; do not add a product scaffold during this
   publication step.

## Conclusion

The mechanical source boundary is clean enough for an experimental public
release: it is small, source-only, link-valid, free of detected retained runtime
credentials and absolute home paths, and explicit about third-party binaries.
Publication is not yet authorized because the license, author metadata, and
GitHub namespace are owner-controlled decisions with visible external effects.
