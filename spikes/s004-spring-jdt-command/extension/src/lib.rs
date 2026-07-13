use zed_extension_api as zed;

const SERVER_ID: &str = "s004-spring-jdt-injector";
const TARGET_SERVER_ID: &str = "jdtls";
const PROBE_SCRIPT: &str = ".s004-artifacts/probe/lifecycle_probe.js";
const EVENT_LOG: &str = ".s004-artifacts/evidence/injector-events.jsonl";
const BUNDLE_DIRECTORY: &str = ".s004-artifacts/bundles";
const BUNDLES: [&str; 5] = [
    "io.projectreactor.reactor-core.jar",
    "org.reactivestreams.reactive-streams.jar",
    "jdt-ls-commons.jar",
    "jdt-ls-extension.jar",
    "sts-gradle-tooling.jar",
];

struct SpringJdtCommandExtension;

impl zed::Extension for SpringJdtCommandExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        validate_server_id(language_server_id.as_ref())?;

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

    fn language_server_additional_initialization_options(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        target_language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        Ok(additional_initialization_options(
            language_server_id.as_ref(),
            target_language_server_id.as_ref(),
            &worktree.root_path(),
            zed::current_platform().0,
        ))
    }
}

fn validate_server_id(language_server_id: &str) -> zed::Result<()> {
    if language_server_id == SERVER_ID {
        Ok(())
    } else {
        Err(format!("unknown language server: {language_server_id}"))
    }
}

fn additional_initialization_options(
    language_server_id: &str,
    target_language_server_id: &str,
    root: &str,
    os: zed::Os,
) -> Option<zed::serde_json::Value> {
    if language_server_id != SERVER_ID || target_language_server_id != TARGET_SERVER_ID {
        return None;
    }

    let bundles: Vec<String> = BUNDLES
        .iter()
        .map(|name| host_path(root, &format!("{BUNDLE_DIRECTORY}/{name}"), os))
        .collect();
    Some(zed::serde_json::json!({ "bundles": bundles }))
}

fn worktree_path(root: &str, relative: &str) -> String {
    host_path(root, relative, zed::current_platform().0)
}

fn host_path(root: &str, relative: &str, os: zed::Os) -> String {
    let root = root.trim_end_matches(['/', '\\']);
    let relative = relative.trim_start_matches(['/', '\\']);
    if os == zed::Os::Windows {
        format!("{}\\{}", root, relative.replace('/', "\\"))
    } else {
        format!("{}/{}", root, relative.replace('\\', "/"))
    }
}

zed::register_extension!(SpringJdtCommandExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_shell_independent_paths_for_every_host_family() {
        assert_eq!(
            host_path(
                "/work tree/프로젝트/",
                r".s004-artifacts\bundle.jar",
                zed::Os::Mac
            ),
            "/work tree/프로젝트/.s004-artifacts/bundle.jar"
        );
        assert_eq!(
            host_path("/worktree/", "/.s004-artifacts/bundle.jar", zed::Os::Linux),
            "/worktree/.s004-artifacts/bundle.jar"
        );
        assert_eq!(
            host_path(
                r"C:\work tree\프로젝트\",
                "/.s004-artifacts/bundle.jar",
                zed::Os::Windows
            ),
            r"C:\work tree\프로젝트\.s004-artifacts\bundle.jar"
        );
    }

    #[test]
    fn contributes_exactly_the_release_bundle_order_only_to_jdtls() {
        assert_eq!(
            additional_initialization_options(
                SERVER_ID,
                TARGET_SERVER_ID,
                "/workspace",
                zed::Os::Linux,
            ),
            Some(zed::serde_json::json!({
                "bundles": [
                    "/workspace/.s004-artifacts/bundles/io.projectreactor.reactor-core.jar",
                    "/workspace/.s004-artifacts/bundles/org.reactivestreams.reactive-streams.jar",
                    "/workspace/.s004-artifacts/bundles/jdt-ls-commons.jar",
                    "/workspace/.s004-artifacts/bundles/jdt-ls-extension.jar",
                    "/workspace/.s004-artifacts/bundles/sts-gradle-tooling.jar"
                ]
            }))
        );
    }

    #[test]
    fn ignores_other_source_and_target_adapters() {
        assert_eq!(
            additional_initialization_options(
                "another-source",
                TARGET_SERVER_ID,
                "/workspace",
                zed::Os::Linux,
            ),
            None
        );
        assert_eq!(
            additional_initialization_options(
                SERVER_ID,
                "another-target",
                "/workspace",
                zed::Os::Linux,
            ),
            None
        );
    }

    #[test]
    fn rejects_unknown_command_server_id() {
        assert!(validate_server_id(SERVER_ID).is_ok());
        assert_eq!(
            validate_server_id("another-server").unwrap_err(),
            "unknown language server: another-server"
        );
    }
}
