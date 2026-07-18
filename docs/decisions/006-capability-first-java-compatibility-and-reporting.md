# D006: Capability-first Java compatibility and user-reviewed reporting

- Status: Accepted
- Date: 2026-07-19
- Decision owner: Project owner

## Context

D003 and D004 began with one exact official-Java version because only that
tuple had runtime evidence. S016 later showed that the unchanged product works
with official Java 6.8.23 even though its embedded compatibility record still
says 6.8.21. The coordinator validates that self-declared record; it does not
observe the installed extension version. Promoting every upstream point release
through a separate product gate would therefore consume M4 effort without
providing the safety that the exact-version wording suggests.

The project also needs a low-friction way to learn when the private official-
Java transport really changes. The project owner prefers issue reports from
affected users over pre-validating every upstream release and asked whether a
Zed-signed-in GitHub user could submit those reports automatically.

## Evidence

- [D002](002-pivot-to-versioned-coordination.md) already states that a version
  change alone must not block an otherwise compatible release.
- [R009](../research/009-unmodified-java-companion-boundary.md) identifies the
  actual compatibility inputs: route discovery, request envelope, bundle and
  command behavior, and lifecycle.
- [S016](../spikes/016-official-java-6.8.23-compatibility-refresh.md) Supported
  the unchanged bridge and coordinator on 6.8.23 while the embedded provider
  record remained 6.8.21.
- [R016](../research/016-zed-github-compatibility-reporting.md) confirms that
  Zed sign-in has only GitHub `read:user`, the extension API exposes neither its
  token nor issue creation, GitHub Issues has no anonymous-author mode, and a
  prefilled issue form is reachable through clickable LSP Markdown.

## Options considered

1. Continue exact release admission and run a compatibility spike before every
   supported official-Java update.
2. Accept releases optimistically when the required runtime capabilities work,
   fail visibly on an actual contract break, and offer a user-reviewed prefilled
   issue report.
3. Automatically create issues through a separate OAuth flow or project-owned
   relay.
4. Ignore compatibility failures and rely on unstructured reports.

## Decision

**Pivot** the compatibility admission policy from exact official-Java release
allowlisting to capability-first optimistic compatibility.

- The official Zed Java extension remains required and unmodified.
- An extension release string is diagnostic metadata, not a startup gate.
- The coordinator attempts the known adapter contract for any installed
  official-Java release. Route shape, bounded transport, allowlisted command
  behavior, bridge schema, and required callback behavior remain the gates.
- A missing or failed required capability stops coordinated Spring behavior
  with an actionable diagnostic; no reduced or self-managed JDT fallback is
  added.
- A new official-Java release does not require its own spike or compatibility-
  table promotion. Latest-release smoke coverage may accompany ordinary feature
  or release validation when practical, without blocking unrelated M4 work.
- Compatibility failure reporting uses a user-reviewed, prefilled GitHub issue
  form reached from clickable Zed/LSP Markdown. The product must not claim that
  an issue was filed until the user submits it on GitHub.
- The report contains only allowlisted, bounded diagnostics. It never includes
  credentials, classpaths, worktree paths or names, source text, environment
  variables, raw logs, or arbitrary exception payloads.
- Suspected vulnerabilities continue to use private vulnerability reporting,
  never the public compatibility form.
- Automatic submission through Zed's GitHub identity, anonymous relay, a
  project bot, separate OAuth, and `gh` CLI invocation are not baseline routes.

This decision supersedes only D003/D004's exact-per-release admission and
compatibility-table promotion rules. It preserves their official-Java ownership,
versioned bridge protocol, fail-closed capability behavior, and lifecycle and
security boundaries. D002's Pivot remains closed.

## Rationale

The product already has the right runtime boundary: a private transport adapter,
strict command allowlist, bounded route parsing, bridge schema, and visible
failure. The installed release number is neither observed nor causal when those
capabilities remain stable. Exercising the real contract gives a better signal
than comparing a self-declared string.

User-reviewed web submission is the only stock-Zed path that combines the user's
GitHub authorship, no product-held token, no hosted service, low reporting effort,
and review before publishing diagnostics. A fully automatic route is currently
blocked by Zed's OAuth scope and extension API and would create disproportionate
security and operations work.

## Consequences

- `protocol/java-providers.json` becomes adapter-contract data rather than an
  exact installed-release allowlist. The self-declared `extensionVersion`,
  source commit, and verified tuple are removed from the runtime record and
  remain available in evidence documents.
- The coordinator's hard-coded 6.8.21 comparison and version-specific user
  message are replaced by structural validation and functional diagnostics.
- README, compatibility, limitations, inventory, and delivery plans must stop
  calling 6.8.23 an undeclared or unshipped companion while keeping every runtime
  observation tied to its exact tuple.
- The next primary M4 slice is authentic `sts/highlight` to CodeLens. The small
  policy/code cleanup belongs on that branch as an ancillary change, not a
  separate compatibility branch.
- A prefilled-report URL builder and notification require contract tests and a
  driven Zed UX gate before being called implemented or verified.
- Completed 2026-07-19: the bounded title/body URL builder, failure-linked
  notification, and stock-Zed-to-browser composer gate passed without submitting
  an issue.
- An upstream break may temporarily affect users before the project adapts.
  Actionable failure fingerprints and easy issue reporting are the mitigation.

## Revisit conditions

Reconsider the reporting route if Zed exposes a user-consented, repository-
scoped issue API or secure delegated credentials. Reconsider optimistic
compatibility if repeated upstream changes make runtime probes destructive,
misleading, or unable to distinguish safe from unsafe behavior before user
impact. Any hosted relay, telemetry, automatic public submission, or separate
OAuth flow requires a new decision.
