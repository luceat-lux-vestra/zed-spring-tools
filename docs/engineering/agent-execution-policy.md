# Portable Agent Execution and Engineering Integrity

- **Policy ID:** EG-AI-001
- **Owner:** [engineering-governance #26](https://github.com/luceat-lux-vestra/engineering-governance/issues/26)
- **Status:** Repository-local execution authority for zed-spring-tools.
- **Adoption provenance:** engineering-governance/main@46e45199082c7fc61368bc8162fb6814de2a83a5

This policy establishes a tool-agnostic baseline for ChatGPT, OMP, local language
models, IDE agents, scripted agents, and their delegates. The execution contract
applies to an agent's behavior, not only to the text of a prompt or a specific UI.

## 1. Authority, applicability, and precedence

- An agent may act only within the current user's authorization and the
  active repository's accepted contracts, security boundaries, and applicable
  branch/ruleset/merge requirements. Do not infer permission from an Issue,
  portfolio entry, prior session, subagent instruction, or central policy alone.
- Before each consequential operation, reconcile the live owning Issue, current
  refs/PRs/checks as relevant, working tree, accepted architecture decisions,
  and local project instructions. A prior checkpoint or memory is not
  authoritative evidence that a mutation succeeded.
- This repository explicitly adopts the portable execution contract through its
  own reviewed rollout. An existing policy, implementation or configuration
  is observed state, not a veto on the authorized desired state. Identify the
  actual security, correctness and explicit external obligations that must
  hold; replace superseded rules and implementations through the owning
  repository's authorized change. Do not silently weaken an obligation,
  invent a compatibility constraint or bypass live enforcement. If precedence
  or authorization is materially ambiguous, resolve it before dependent
  mutation.
- The [contribution contract](../../CONTRIBUTING.md), accepted decisions and
  [release gate](../preview-release-gate.md) own product semantics. The local
  [agent recovery contract](agent-recovery.md) remains authoritative for
  GitHub-specific crash recovery, canonical Issue checkpoint comments,
  exact-HEAD evidence, and conditional same-HEAD/base-advancement reuse.
  Central portfolio governance is not a runtime dependency.
  Do not duplicate those detailed authorities here.

## 2. One authorized execution cycle = one bounded work unit

A **work item** is the persistent feature, defect, campaign, or Issue and can
span many sessions. A **work unit** is one coherent, bounded phase with a clear
objective, scope, evidence obligations, and stop condition. An
**authorization cycle** is one human request to proceed (or a separately
approved bounded automated invocation).

- Each authorization cycle permits **exactly one** selected work unit, but a
  work unit is **not** synonymous with one API call, one file edit, one finding,
  or one lifecycle micro-step. Size it large enough to complete a coherent
  phase while keeping its stop condition and evidence boundary explicit.
- For repository rollouts, use these coarse-grained default units unless
  actual evidence/authority boundaries or the user's request require another
  shape; obsolete target process wording is migration input, not a reason to
  manufacture micro-steps:
  1. **comprehensive audit + consolidated implementation**: inspect all
     relevant repository policy, architecture, workflow, validation, open-PR,
     and enforcement surfaces; establish the complete in-scope finding set;
     fix those findings together; perform local/static/source validation; and
     produce one durable candidate;
  2. **PR creation + first exact-HEAD CI/enforcement observation**: open the
     PR, read back its exact HEAD/base/diff, then perform at most one logical
     CI/enforcement snapshot for that exact revision;
  3. **comprehensive remediation**, only when required: analyze the complete
     observed failure set and relevant adjacent surfaces, identify root-cause
     clusters, fix all justified in-scope defects together, and produce a new
     exact candidate rather than patching one symptom per authorization;
  4. **final exact-candidate review + merge**: reconcile final HEAD/base,
     review the complete candidate and merge preconditions, and merge in the
     same unit only when every required precondition is already PASS;
  5. **post-merge verification + target closure + central coordination**:
     verify merged-main state, finish the target's acceptance/housekeeping,
     close its owning work item when justified, and update central rollout
     coordination. Do not start the next target's implementation in that same
     unit unless the user explicitly authorizes that larger scope.
- **Audit before edit.** Do not intentionally operate as
  "find one problem -> patch it -> run CI -> find the next problem." Before
  implementation, inspect the relevant surface broadly enough to identify the
  known in-scope gap set. If later evidence exposes an additional defect,
  expand the next remediation analysis to the complete related surface rather
  than applying another isolated symptom patch.
- Planning, tool calls, internal validation, agent handoffs, advisors/reviewers,
  retries, and subagent recursion do not create additional authorization.
  A multi-agent supervisor is accountable for the same selected work-unit
  boundary.
- A work unit may contain multiple material mutations and internal verification
  steps. Each consequential mutation still requires authoritative precondition
  reconciliation and postcondition read-back; successful read-back permits the
  unit to continue until its declared stop condition.
- Never cross a **pending, conflicting, materially unknown, or failed**
  evidence boundary merely to finish a larger unit. Record the truthful state
  and STOP. Recovery from an uncertain mutation requires read-back, **not**
  blind replay.
- Read-only investigation or a bounded local experiment may itself be a work
  unit when it has a clear question, output, evidence, and stop condition.
  Scheduled work requires separate, explicit authorization and must remain
  within its approved scope.

## 3. One durable rolling checkpoint per owning work item

- For GitHub-tracked work, use **one canonical mutable checkpoint comment** on
  the owning Issue with marker `<!-- agent-resume-checkpoint:v1 -->`.
  Find and update the existing comment in place. Its body is the **latest
  current-state snapshot, not an append-only work log**: replace or remove
  superseded state, keep completed work only as concise outcome summaries, and
  retain the current state, blockers, next safe unit, and STOP condition. Do
  not accumulate per-turn, per-phase, CI-run, agent, or session history in the
  checkpoint. Historical audit trail belongs to Git commits, PRs, Issue events,
  review records, and independently durable evidence. Do not delete or rewrite
  human decisions, independent review discussion, or immutable evidence merely
  to shorten the checkpoint.
- A purely local work item without a GitHub Issue uses one
  repository-appropriate durable, access-controlled checkpoint outside the
  mutable production source/commit history, such as an ignored local state
  file or an approved persistent task record. The local path and location
  must be **discovered/configured**, not assumed from a fixed machine layout.
  Do not create competing GitHub/local authorities for the same work item.
- The owning work item has **one designated checkpoint writer**. Delegates
  may propose updates but must not concurrently overwrite the checkpoint.
  Where multiple processes can access the state, protect updates with an
  appropriate lock/lease or version-checked compare-and-swap and an atomic
  durable replacement (including crash-safe persistence where supported).
  Confirm the prior revision before committing a new one. If coordination,
  conflict detection, or atomic persistence cannot be assured, operate with
  one writer only; on a conflicting or uncertain write, re-read authoritative
  state, reconcile, and STOP instead of using last-writer-wins.
- On every resume: read the authoritative execution state, compare with the
  checkpoint, classify mismatch or uncertainty, and derive one safe next unit.
  Only after a mutation's postcondition is independently read back may the
  checkpoint advance. Never silently overwrite concurrent changes.
- Record only the current snapshot needed to resume safely: owning work item,
  branch/base and candidate/exact HEAD SHA when relevant, concise completed
  outcomes, current verification/acceptance state, blockers, **next safe unit**,
  and explicit STOP condition. Use `PASS`, `FAIL`, `PENDING`,
  `UNVERIFIED`, `BLOCKED`, or `NOT STARTED` per current obligation.
  Remove superseded checkpoint state instead of retaining it for chronology;
  preserve historical/immutable evidence in its authoritative GitHub or Git
  record and link it only when the current snapshot needs it.
- `PASS` requires affirmative evidence for the precise claim.
  `PENDING` is not failure; `UNVERIFIED` is not success.
  For a consequential authorization/merge decision, materially unknown or
  insufficient evidence is **fail-closed**; do not relabel an incomplete check
  as an actual test failure.

## 4. No CI polling or evidence laundering

- CI observation/judgment may be a standalone unit or the final observation
  step of a selected **PR creation + first exact-HEAD observation** unit.
  Perform **one bounded logical observation pass** over the required
  status/evidence for the exact commit SHA. This pass may use the minimum
  distinct API endpoints needed for check-runs, workflow-runs, commit
  statuses, required check identities/rulesets, event, and provenance; it is
  **not limited to one HTTP request**.
- If CI is queued/in progress, report `PENDING` and STOP. If a check is
  missing or provenance cannot be established, report `UNVERIFIED` or
  `BLOCKED` as appropriate and STOP. No waiting loops, repeated status
  requests, implicit retries, speculative success, or automatic
  wait-to-green behavior.
- If the observation is `FAIL`, preserve the complete observed failure set
  and STOP unless comprehensive remediation was explicitly part of the
  selected work unit and its preconditions were already known. Do not patch
  the first failing check and immediately re-observe CI. The next remediation
  unit should inspect all observed failures and the relevant adjacent surface,
  cluster root causes, and consolidate justified fixes before producing a new
  exact HEAD.
- A later user-authorized observation or a merge-precondition unit may take a
  **new single authoritative snapshot** when necessary. This is not permission
  to poll repeatedly within one unit. Never rerun a job to conceal a failing
  result.
- A passing check proves only what its exact input and provenance covered.
  A changed PR HEAD invalidates prior HEAD-specific evidence. An unchanged
  HEAD after base advancement is governed by the strict, conditional
  [same-HEAD evidence policy](agent-recovery.md#same-head-evidence-after-base-advancement);
  neither automatic reuse nor automatic re-run is authorized.
- Do not weaken branch protection, required checks, test coverage, safety
  verification, or merge queues to obtain a green result.

## 5. No hardcoding, fake success, or test-specific bypass

**Rule:** Production behavior must derive mutable or environment-dependent
facts from the designated authoritative source, explicit contract, discovery,
configuration, or validated input. Do not bake in convenient answers.

**Prohibited shortcuts include:**

- Embedding machine-specific absolute paths, hostnames, service endpoints,
  ports, credentials, keys, tenant/resource identifiers, current Git refs,
  commit SHAs, transient process IDs, or runtime-dependent values as
  universal production assumptions.
- Special-casing a known fixture, environment, input, version, user, or
  CI invocation to return success or skip real work; fabricated status,
  hardcoded output, placebo integrations, swallowed errors, or fake
  test/benchmark measurements presented as real execution.
- Magic numbers or unexplained thresholds that alter business or recovery
  semantics; silent fallback to arbitrary values when required configuration
  or authoritative data is missing.
- Weakening tests, assertions, data provenance, or fail-closed validation
  merely to accommodate an implementation defect or force CI green.

**Legitimate, reviewable values are not forbidden:** standard/protocol
constants, accepted domain invariants, stable API route templates,
intentional dependency/version/security pins, documented safe defaults,
reproducible test fixtures, golden outputs, and explicitly required
compatibility cases supported by current contract/evidence.
Give them clear names, scope, source/rationale, and tests. A legacy path or
compatibility exception is not legitimate merely because it already exists. Do not needlessly
externalize true domain constants or make reproducibility impossible.

When mandatory data is unavailable, report a precise failure or unsupported
state. A documented optional default is allowed only when the domain contract
defines its semantics, and must not disguise missing mandatory input. Secrets
belong in approved secret stores or injected configuration, never committed
to agent policies, checkpoints, source, test logs, or PR descriptions.

## 6. Replacement-first engineering and honest verification

- Establish the correct authorized target contract before selecting a design.
  Existing code, configuration, architecture decisions, policy, tests and
  compatibility declarations are audit inputs, not protected implementations.
  Determine which obligations are genuinely required by current product,
  security, correctness, external consumers and explicit user decisions.
  Do not infer a compatibility requirement from old behavior or a historical
  declaration alone.
- Replace, consolidate or delete obsolete/conflicting structures directly.
  Prefer one canonical implementation, configuration and policy authority.
  Do not add an adapter, compatibility path, parallel policy, dual execution,
  fallback, special case or bespoke migration mechanism merely to keep the old
  design alive. Update affected callers, configuration, dependencies, tests
  and documentation together; remove superseded paths in the same coherent
  candidate. A genuinely necessary transition or compatibility obligation must
  have concrete evidence, explicit scope, owner and, where temporary, a
  removal condition.
- Diagnose the root cause across the relevant surface, rather than patching
  symptoms. A pure refactor still satisfies its accepted observable contract;
  an authorized redesign can intentionally change obsolete behavior. Verify
  the resulting contract, including failure/recovery, concurrency,
  persistence, security, performance and external interfaces as applicable.
  Replace tests asserting superseded behavior with tests of the authorized
  new contract; retain independent negative/regression evidence and do not
  weaken verification to manufacture success.
- Mocks and fixtures are valid **only as clearly labeled test instruments**,
  never substitutes for production behavior or physical verification claims.
  CI sharding/fan-out follows the existing
  [R2A #112 evidence and diagnostic protocol](https://github.com/luceat-lux-vestra/research-to-action/issues/112):
  measure critical path and duplicated setup; retain independent semantic proof
  matrices. Do not create a competing central CI-sharding policy.
- Scope replacement to the authorized work. Do not delete unrelated user work,
  rewrite independent historical evidence, mutate third-party/upstream-owned
  surfaces without authority, expose secrets, or remove an actual safety or
  externally required obligation just to simplify implementation. Meet those
  obligations through the correct new design, not necessarily the old code.

## 7. Adoption, agent loading, and enforcement

- The central revision above is provenance, not a runtime dependency. Keep a
  concise bootstrap and these self-contained local policies. Replace obsolete
  instructions directly; require owning Issue/PR, exact base/HEAD evidence and
  post-merge verification.
- Verify actual target-local instruction loading before claiming coverage. For
  OMP or other multi-agent runtimes, verify installed version, configuration
  precedence, local loading, subagent inheritance and persistent RULES.md
  behavior. Until demonstrated, runtime coverage is UNVERIFIED.
- Prefer mechanical checks for objective invariants; review and independent
  negative controls remain necessary. A passing linter cannot prove absence of
  all hardcoding or unsafe workarounds.
- A draft or candidate is not merged adoption. Release/capability evidence and
  publication require the exact obligations in the local release contract.
