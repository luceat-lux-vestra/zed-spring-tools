use zed_extension_api as zed;

const SERVER_ID: &str = "s001-lifecycle-probe";
const PROBE_SCRIPT: &str = "spikes/s001-zed-lifecycle/probe/probe_server.mjs";
const EVENT_LOG: &str = "tmp/s001-lifecycle-events.jsonl";

struct LifecycleProbeExtension;

impl zed::Extension for LifecycleProbeExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        if language_server_id.as_ref() != SERVER_ID {
            return Err(format!(
                "unknown language server: {}",
                language_server_id.as_ref()
            ));
        }

        let node = zed::node_binary_path()
            .map_err(|error| format!("failed to resolve Zed-managed Node: {error}"))?;
        let root = worktree.root_path();

        Ok(zed::Command {
            command: node,
            args: vec![
                worktree_path(&root, PROBE_SCRIPT),
                "--log".to_owned(),
                worktree_path(&root, EVENT_LOG),
            ],
            env: worktree.shell_env(),
        })
    }
}

fn worktree_path(root: &str, relative: &str) -> String {
    format!("{}/{relative}", root.trim_end_matches(['/', '\\']))
}

zed::register_extension!(LifecycleProbeExtension);
