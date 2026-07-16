# R007: S008 isolated-profile startup attribution

- Status: Complete
- Last updated: 2026-07-17
- Investigator: Codex
- Fixed evidence: S008 Gate C and Zed 1.10.3 source

## Question

Which Zed 1.10.3 startup paths caused S008's trust dialog, HTML extension
installation, editor data, Copilot warning, and ChatGPT provider-auth warning,
and which source-supported controls can isolate those effects in one new
managed-JDT prerequisite without modifying Zed or normal user state?

## Scope

Included:

- the clean Zed source at commit
  `0c54c414d522234de7298039708ffe85a116892a` used by the pinned 1.10.3 runtime;
- S008's reviewed settings, fresh-profile inventories, log boundaries, and two
  successful direct managed-JDT runs;
- `--user-data-dir`, worktree trust, extension auto-install, Copilot config,
  language-model provider authentication, and AI-disable startup paths; and
- source-supported controls for one new local-only prerequisite spike.

Excluded:

- another Zed or JDT launch, UI automation, packet capture, Spring Tools, or
  product code;
- a claim that every Zed subsystem is offline or that all generated editor data
  can or should be suppressed;
- mutation of the normal Zed profile, normal credentials, shell startup files,
  or upstream source; and
- conclusions for non-macOS hosts, another architecture, or JDK 21.

## Confirmed facts

### Custom user data intentionally creates editor state

1. The Zed CLI and application both process `--user-data-dir` before ordinary
   path initialization and call `paths::set_custom_data_dir`.
2. With a custom directory, Zed's `config_dir` becomes `<custom>/config` and
   `data_dir` becomes the custom root. The setting is therefore a real boundary
   for Zed's own config/data consumers, but not a complete macOS filesystem
   sandbox.
3. Application startup explicitly creates config, extensions, languages,
   debug-adapters, database, logs, temporary, and hang-trace directories. On
   macOS, config/extensions/languages/debug/database/hang traces derive from the
   custom root, while logs remain under `~/Library/Logs/Zed`, temporary state
   under the platform cache directory, and application state under
   `~/.local/state/Zed`. Other initialized editor subsystems can create prompt-
   library and thread metadata below the custom root.
4. S008's post-launch databases and base editor directories are therefore not,
   by their presence alone, proof that the normal Zed profile leaked into the
   isolated run. S008's preflight still correctly established that they were
   absent before startup.

### The trust dialog follows a controllable default

1. Zed 1.10.3 defaults `session.trust_all_worktrees` to `false`.
2. When that setting is false and a path is not persisted as trusted, the
   trusted-worktree store restricts it. The security modal states that
   restricted mode prevents project settings, language servers, and MCP server
   installation.
3. `TrustedWorktreesStore::can_trust` returns `true` immediately when
   `session.trust_all_worktrees` is true. Auto-trusted paths are not persisted
   to the trusted-worktree database.
4. S008 did not set this field and used two wholly new worktrees. Its trust
   dialog was the fixed default behavior, not an unexplained UI failure.
5. Setting `session.trust_all_worktrees: true` only in a disposable isolated
   profile is a source-supported way to avoid the dialog without modifying the
   normal profile or trusting the shared temporary parent directory.

### HTML is a default automatic extension

1. Zed 1.10.3's default settings contain
   `auto_install_extensions: { "html": true }`.
2. After the extension index is loaded or rebuilt, `ExtensionStore` invokes
   `auto_install_extensions`. It installs each configured true extension that
   is not already indexed or suppressed.
3. The setting is a string-to-boolean map; setting
   `auto_install_extensions.html` to `false` overrides the default and excludes
   HTML from the installation list.
4. S008's prepared settings did not override this default. The added HTML
   extension and Java-plus-HTML index were expected fixed behavior, not evidence
   that a normal-profile extension was copied into the isolated profile.

### Copilot config is outside the custom Zed path unless XDG is set

1. Zed initializes `copilot_chat` during application startup regardless of
   whether an agent panel is opened.
2. On non-Windows platforms, `copilot_chat_config_dir` independently reads
   `XDG_CONFIG_HOME` and otherwise falls back to `~/.config/github-copilot`. It
   does not use Zed's `paths::config_dir` or `--user-data-dir` override.
3. Copilot startup reads legacy JSON token files and `auth.db`; an existing
   database token with the wrong shape emits the exact warning observed in both
   S008 corrected runs.
4. S008 set only a run-specific `XDG_CACHE_HOME`. It did not set
   `XDG_CONFIG_HOME`, so its isolated process could read the normal
   `~/.config/github-copilot/auth.db` despite the custom Zed profile.
5. A fresh run-specific `XDG_CONFIG_HOME`, combined with confirmed absence of
   `GH_COPILOT_TOKEN` and `GITHUB_COPILOT_TOKEN`, is the narrow source-supported
   control for this path. It does not require reading, copying, or changing the
   user's real Copilot files.

### ChatGPT authentication is caused by agent-panel provider enumeration

1. Zed registers the built-in ChatGPT Subscription provider during
   `language_models::init`. The provider loads any stored credentials through
   Zed's credentials provider.
2. Creating the native agent creates `LanguageModels`, which immediately calls
   `authenticate` on every visible provider to populate its model list.
3. An unauthenticated ChatGPT Subscription provider returns the exact sign-in
   error recorded by S008, and the provider-enumeration loop logs it as
   `Failed to authenticate provider`.
4. Workspace initialization loads the agent panel unless the top-level
   `disable_ai` setting is true. `agent.enabled: false` only affects panel
   enablement and is not the startup guard used by `setup_or_teardown_ai_panel`.
5. With `disable_ai: true`, Zed does not load the agent panel. The external
   agent registry also returns before cached-registry loading or refresh when
   the same setting is true.
6. `disable_ai: true` in the disposable profile is therefore the correct fixed
   control to test. It is a spike isolation control, not a proposed product
   default or a statement that the future extension conflicts with AI features.

## Primary sources

All source paths below are from the clean Zed commit
`0c54c414d522234de7298039708ffe85a116892a`, inspected on 2026-07-17.

- CLI/custom profile path:
  [`crates/zed/src/main.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/zed/src/main.rs),
  [`crates/cli/src/main.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/cli/src/main.rs), and
  [`crates/paths/src/paths.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/paths/src/paths.rs).
- Worktree trust:
  [`assets/settings/default.json`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/assets/settings/default.json),
  [`crates/project/src/trusted_worktrees.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/project/src/trusted_worktrees.rs), and
  [`crates/workspace/src/security_modal.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/workspace/src/security_modal.rs).
- Extension defaults and installation:
  [`crates/extension_host/src/extension_settings.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/extension_host/src/extension_settings.rs),
  [`crates/extension_host/src/extension_host.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/extension_host/src/extension_host.rs), and the same fixed default settings file.
- Copilot config and token loading:
  [`crates/copilot_chat/src/copilot_chat.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/copilot_chat/src/copilot_chat.rs).
- Language-model and agent startup:
  [`crates/language_models/src/language_models.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/language_models/src/language_models.rs),
  [`crates/language_models/src/provider/openai_subscribed.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/language_models/src/provider/openai_subscribed.rs),
  [`crates/agent/src/agent.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/agent/src/agent.rs),
  [`crates/zed/src/zed.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/zed/src/zed.rs), and
  [`crates/project/src/agent_registry_store.rs`](https://github.com/zed-industries/zed/blob/0c54c414d522234de7298039708ffe85a116892a/crates/project/src/agent_registry_store.rs).
- Ignored S008 evidence under `tmp/s008-gate-c-*`: preflight settings/index,
  initial trust-modal failure, corrected run log boundaries, profile
  inventories, process arguments, catalog/helper identities, screenshots, data
  manifests, route files, and restoration observations.

## Inferences

1. S008's strict minimal-profile criterion grouped source-expected editor
   initialization with true external-state leakage. The HTML install and trust
   modal are deterministic defaults; the Copilot warning is an XDG boundary
   leak; the ChatGPT warning is an agent-panel startup side effect.
2. A new profile that sets `session.trust_all_worktrees: true`,
   `auto_install_extensions.html: false`, and `disable_ai: true`, while launching
   with a fresh `XDG_CONFIG_HOME`, should eliminate the four observations that
   made S008 Inconclusive.
3. Setting all four run-specific XDG roots is safer and more reproducible than
   setting only the cache root, even though the confirmed Copilot path depends
   specifically on `XDG_CONFIG_HOME`. It does not relocate the fixed macOS Zed
   log, temp, or state paths, which require explicit boundaries and attribution.
4. Core profile directories and editor databases should be inventoried and
   attributed rather than prohibited. The meaningful isolation requirements are
   fixed settings/extensions, no normal-profile or credential content, no
   provider-auth warning, and the exact JDT runtime path.
5. One controlled managed-JDT run is sufficient for the next distinction:
   S008 already established two-run data isolation, while R007 changes only the
   profile/environment controls that precede child startup.

## Unverified hypotheses

1. The four controls compose correctly in the signed Zed 1.10.3 runtime and no
   trust modal appears for a new worktree.
2. HTML remains absent and the extension index remains Java-only after startup.
3. A fresh XDG config plus absent Copilot OAuth environment variables eliminates
   the Copilot `auth.db` warning without accessing the normal config path.
4. `disable_ai: true` prevents native-agent construction, ChatGPT provider
   enumeration, external-agent registry population, and their warnings while
   leaving Java/JDT startup unaffected.
5. The already-proven fixed helper/catalog and managed `-data` path still reach
   `ServiceReady` when all controls are applied together.

## Runtime verification needed

- create a wholly new profile, worktree, XDG config/cache/data/state roots, and
  expected JDT data path from fixed S008 inputs;
- verify the composed settings and preflight inventories before launch;
- launch the exact signed Zed 1.10.3 bundle with the fixture path supplied by
  the CLI, without trust interaction or normal-profile state;
- compare post-launch extension/index/profile/log state to the source-derived
  allowlist and verify absence of the two provider warnings;
- record boundaries for the shared macOS Zed log/temp/state paths without
  claiming that `--user-data-dir` or XDG relocates them;
- require the exact fixed proxy/JDK/JDT and one expected `-data` plus real
  `ServiceReady`; and
- preserve shutdown, route cleanup, normal-Zed restoration, and all unexpected
  observations.

## Blockers and constraints

- This attribution does not prove whole-application network silence. Zed's
  extension update path may still query its update endpoint even when no
  extension is eligible; packet capture is outside this investigation.
- On macOS, `--user-data-dir` does not relocate Zed's log, temp, or state roots.
  A later run must stop normal Zed, use a precise log boundary, and distinguish
  shared platform state from custom-profile data.
- `disable_ai` is intentionally broad and suitable for a disposable Java/JDT
  control. A later product workflow must coexist with normal AI features and
  must not require changing a user's global setting.
- `trust_all_worktrees` is acceptable only inside the isolated spike profile.
  It must never be written to the user's normal Zed settings by this project.
- macOS credentials may be backed by system facilities outside the custom data
  directory. The experiment avoids enumerating or exporting them and judges
  only source-controlled startup behavior and redacted warnings.
- Automatic proxy-route deletion remains independently unreliable. Ordered
  explicit removal after confirmed process absence remains the fixed cleanup.

## Candidate next experiments

S009 should perform one fixed-input managed-JDT run using:

- a new Java-only profile with `session.trust_all_worktrees: true`, HTML auto-
  install disabled, Java auto-update disabled for identity stability, and
  `disable_ai: true`;
- fresh run-specific XDG config/cache/data/state roots and absent Copilot OAuth
  environment variables;
- the fixed S008 Java extension, JDT, helper, catalog, proxy, debug bundle, Zed
  1.10.3 bundle, and Temurin 25.0.3;
- direct CLI opening of the worktree and contained Java fixture, with no trust
  UI interaction; and
- source-derived expected editor directories, Java-only extension identity,
  exact JDT process/data attribution, and preserved cleanup evidence.

## Interim conclusion

The S008 profile divergence is now source-attributed. It does not refute the
two successful managed-JDT runs and does not require a custom Zed build. Four
documented runtime controls should isolate the relevant startup paths, but their
composition with a real JDT start remains unverified. This supports a reviewed
S009 prerequisite only; it does not yet authorize a Spring end-to-end run,
product scaffolding, publication, or a direction decision.
