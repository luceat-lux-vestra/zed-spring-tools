# R016: Zed-to-GitHub compatibility reporting

- Status: Complete; implementation and first stock-Zed browser gate passed
- Last updated: 2026-07-19
- Investigator: OpenAI Codex (GPT-5.6 Sol)

## Question

Can Zed Spring Tools use the GitHub identity of a user signed in to Zed to file
an official-Java compatibility issue automatically, and if not, what is the
safest low-friction stock-Zed alternative?

## Scope

This investigation covers Zed's GitHub sign-in scope, the extension API 0.7.0
used by this product, upstream extension API 0.8.0, GitHub issue authentication,
prefilled issue URLs, the existing LSP notification surface, bounded report
contents, and the completed diagnostic browser gate. It adds no telemetry or
hosted relay and did not submit a real issue.

## Confirmed facts

1. Zed signs users in through GitHub OAuth with only the `read:user` scope. Zed
   documents that this grants read-only access to GitHub profile information.
2. Neither `zed_extension_api` 0.7.0 nor upstream 0.8.0 exposes the signed-in
   Zed account, its GitHub OAuth token, a credential store, an issue-creation
   operation, or a general URL-opening export to an extension. Their GitHub
   interface only reads release metadata. The HTTP client accepts caller-
   supplied headers but does not provide a Zed or GitHub credential.
3. GitHub's classic OAuth scopes require `public_repo` for write access to
   public repositories; `read:user` only reads profile data. The REST issue
   endpoint is `POST /repos/{owner}/{repo}/issues` and creates content as an
   authenticated user or app with repository issue permission.
4. GitHub issues cannot be authored anonymously. An unauthenticated web visitor
   can read this public repository, but GitHub requires an account to submit an
   issue. A project service could accept an anonymous report and create a bot-
   authored issue, but the resulting issue would not be authored by the user.
5. GitHub supports `title`, `body`, `labels`, `template`, and issue-form field
   query parameters on `/issues/new`. GitHub warns that overlong URLs return
   `414 URI Too Long`, and permission-dependent parameters may fail or be
   ignored for users without the corresponding permission.
6. Zed's general LSP store handles `window/showMessageRequest`. Its notification
   renders Markdown and routes clicked links through `open_url_or_file`. The
   stock extension API does not need to expose a browser function for a language
   server to present a clickable GitHub issue URL.
7. The current product has no telemetry or runtime GitHub write path. Its
   manifest grants one narrow `download_file` capability for the pinned Spring
   Tools artifact, not general GitHub API access.
8. Security reports must continue through GitHub private vulnerability
   reporting. A public compatibility-report action must never suggest filing a
   credential exposure or suspected vulnerability as an issue.
9. The product now builds a strict title/body-prefilled `/issues/new` URL from
   an allowlisted failure kind, pinned Spring Tools version, JDK version, host
   OS/architecture, and extension version. It deliberately marks Zed and the
   official Java extension versions unobservable instead of guessing them.
10. Stock Zed 1.11.3 immediately closes an actionless
    `window/showMessageRequest`. Adding a non-destructive `Not now` action keeps
    its Markdown link visible. In the 2026-07-19 driven diagnostic, clicking
    that link opened the default browser's GitHub composer with the bounded
    title and body populated. No issue was submitted.

## Primary sources

- Zed repository `main` commit
  `54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698`, accessed 2026-07-19:
  - [`docs/src/authentication.md`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/docs/src/authentication.md)
    documents GitHub OAuth with only `read:user`.
  - [`crates/extension_api/wit/since_v0.8.0/extension.wit`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/extension_api/wit/since_v0.8.0/extension.wit),
    [`github.wit`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/extension_api/wit/since_v0.8.0/github.wit),
    and [`http-client.wit`](https://github.com/zed-industries/zed/blob/54fdf58d3a5ba58e3d71fdd862f47cf5ebc05698/crates/extension_api/wit/since_v0.8.0/http-client.wit)
    contain the complete upstream extension imports and exports.
  - `crates/lsp/src/lsp.rs` and
    `crates/workspace/src/notifications.rs`, already attributed in
    [R014](014-final-upstream-capability-surface-audit.md), contain the
    `window/showMessageRequest` and Markdown-link handling.
- Local pinned `zed_extension_api` 0.7.0 source,
  `wit/since_v0.6.0/{extension,github,http-client}.wit`, inspected from Cargo's
  exact locked source on 2026-07-19.
- GitHub Docs repository commit
  `27a4008f193706042a40cbb6c71cf85633249e79`, accessed 2026-07-19:
  - [Creating an issue](https://github.com/github/docs/blob/27a4008f193706042a40cbb6c71cf85633249e79/content/issues/tracking-your-work-with-issues/using-issues/creating-an-issue.md)
    documents prefilled URL and issue-form query parameters and the URL-length
    failure.
  - [OAuth app scopes](https://github.com/github/docs/blob/27a4008f193706042a40cbb6c71cf85633249e79/content/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps.md)
    distinguishes `read:user` from the write-capable `public_repo` scope.
  - [REST create issue](https://docs.github.com/en/rest/issues/issues#create-an-issue)
    documents the authenticated issue endpoint and request fields.
- Product sources inspected 2026-07-19:
  [`extension.toml`](../../extension.toml),
  [`coordinator/src/main.mjs`](../../coordinator/src/main.mjs),
  [`SECURITY.md`](../../SECURITY.md), and
  [R014](014-final-upstream-capability-surface-audit.md).

## Options evaluated

| Route | Feasibility | Main consequence |
| --- | --- | --- |
| Reuse the user's Zed GitHub login and post through REST | Not available | Zed neither grants issue-write scope nor exposes its token to extensions. |
| Submit anonymously to GitHub Issues | Not available | GitHub requires an authenticated author. |
| Run a project-owned relay/GitHub App that accepts anonymous reports | Technically possible, not selected | Requires hosted runtime, bot credentials, abuse prevention, privacy policy, retention, and operational ownership; reports are bot-authored. |
| Add a separate GitHub OAuth/device flow to the extension | Technically incomplete and not selected | Duplicates sign-in, needs new runtime network calls and secure token storage that the extension API does not provide. |
| Invoke an installed, authenticated `gh` CLI | Optional manual workaround only | It is a separate dependency and identity, needs process permission, and is not the Zed account. |
| Present a title/body-prefilled GitHub issue composer in a clickable Zed notification | Implemented and first-tuple verified | Uses the user's browser GitHub session, keeps final submission explicit, and handles no token or deployed-template dependency. |

## Inferences

1. Zed sign-in is evidence that the user has a GitHub identity, but it is not
   delegated authorization to write GitHub issues. Treating it as such would be
   both technically incorrect and a privilege escalation beyond `read:user`.
2. A user-reviewed prefilled issue composer is the lowest-friction route that works
   with stock Zed. It is not automatic submission, but it can reduce reporting
   to reviewing the bounded fields and pressing GitHub's submit button.
3. A project-owned anonymous relay would create more compatibility and security
   work than it saves at the current project scale. It would also make spam and
   sensitive-data publication the maintainer's responsibility.
4. The report URL should contain a small allowlisted diagnostic record, not raw
   logs. Safe candidate fields are product version, Zed `clientInfo`, host OS and
   architecture, JDK major/version, adapter schema, failed capability or phase,
   and a stable error fingerprint. Worktree paths, classpaths, environment
   variables, source text, credentials, ports, and arbitrary exception causes
   must be excluded.
5. Exact official-Java release admission is unnecessary for reporting. The
   runtime should attempt the known capability contract and offer the report
   only when a required route or command fails.

## Remaining hypotheses

1. A browser used for Zed sign-in often retains a GitHub session, but Zed's OAuth
   flow does not guarantee that the user's later default-browser session is
   still authenticated.
2. The signed-out flow will preserve the prefilled composer through GitHub login;
   it has not yet been driven.

## Runtime verification result

- Completed 2026-07-19: contract tests tie each required-capability failure to
  the allowlisted URL and notification. A diagnostic LSP stimulus then rendered
  the exact product notification in stock Zed; clicking its Markdown link
  opened a populated GitHub title/body composer in Orion. No issue was submitted.
- The captured URL contained no path, classpath, environment variable,
  credential, source text, arbitrary exception, or raw log. The 639-character
  sample remained below the 2,000-character product bound.
- Still needed: verify behavior while signed out of GitHub. The browser may ask the user to
  sign in, but the extension must not loop, discard diagnostics, or claim that
  the issue was submitted.

## Blockers and constraints

- Automatic creation as the signed-in Zed user is blocked by both the OAuth
  scope and the extension API; either one alone is sufficient to block it.
- Secure storage for a separate GitHub token is not available to this extension.
- Adding a hosted relay, new OAuth flow, telemetry, or runtime GitHub API call is
  a new runtime/network/security boundary and requires a separate decision.
- Public issue content is durable and searchable. User review is a safety
  property, not merely a UX compromise.
- GitHub URL length bounds require a compact report. Full logs remain manual,
  redacted attachments or pasted excerpts under the existing issue guidance.

## Candidate next experiments

1. During the `sts/highlight` CodeLens branch, add the policy and contract tests
   that remove exact official-Java release rejection while preserving functional
   route/command failure diagnostics.
2. Completed 2026-07-19: pure URL builder, strict allowlisting, length/redaction
   tests, persistent notification action, and Zed-to-browser composer gate.
3. Verify the signed-out GitHub transition without submitting an issue.
4. Revisit automatic submission only if Zed later exposes a user-consented,
   repository-scoped issue-report API or secure delegated credential facility.

## Conclusion

Stock Zed cannot automatically create an issue using the GitHub identity from
Zed sign-in, and GitHub Issues has no anonymous-author mode. The selected
low-friction direction is a user-reviewed, prefilled GitHub issue composer opened
from a clickable LSP notification after a required official-Java capability
fails. That route is implemented and passed its first stock-Zed browser gate. It
requires no token, relay, telemetry, deployed issue-form template, or exact
release allowlist and keeps public submission under the user's control.
