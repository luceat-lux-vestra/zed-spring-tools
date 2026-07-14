use zed_extension_api as zed;

const SERVER_ID: &str = "s005-classpath-callback-probe";
const TARGET_SERVER_ID: &str = "jdtls";
const SINK_SCRIPT: &str = ".s005-artifacts/probe/callback_sink.js";
const ROUTE_RECORD: &str = ".s005-artifacts/callback-route.json";
const EVIDENCE_LOG: &str = ".s005-artifacts/evidence/callback-sink.jsonl";
const BUNDLE_DIRECTORY: &str = ".s005-artifacts/bundles";
const BUNDLES: [&str; 5] = [
    "io.projectreactor.reactor-core.jar",
    "org.reactivestreams.reactive-streams.jar",
    "jdt-ls-commons.jar",
    "jdt-ls-extension.jar",
    "sts-gradle-tooling.jar",
];

struct ClasspathCallbackExtension;

impl zed::Extension for ClasspathCallbackExtension {
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
            args: command_args(&root, zed::current_platform().0),
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

fn command_args(root: &str, os: zed::Os) -> Vec<String> {
    vec![
        host_path(root, SINK_SCRIPT, os),
        "--root".to_owned(),
        root.to_owned(),
        "--route".to_owned(),
        host_path(root, ROUTE_RECORD, os),
        "--log".to_owned(),
        host_path(root, EVIDENCE_LOG, os),
    ]
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

fn host_path(root: &str, relative: &str, os: zed::Os) -> String {
    let root = root.trim_end_matches(['/', '\\']);
    let relative = relative.trim_start_matches(['/', '\\']);
    if os == zed::Os::Windows {
        format!("{}\\{}", root, relative.replace('/', "\\"))
    } else {
        format!("{}/{}", root, relative.replace('\\', "/"))
    }
}

zed::register_extension!(ClasspathCallbackExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_shell_independent_sink_arguments_for_every_host_family() {
        assert_eq!(
            command_args("/work tree/프로젝트/", zed::Os::Mac),
            vec![
                "/work tree/프로젝트/.s005-artifacts/probe/callback_sink.js",
                "--root",
                "/work tree/프로젝트/",
                "--route",
                "/work tree/프로젝트/.s005-artifacts/callback-route.json",
                "--log",
                "/work tree/프로젝트/.s005-artifacts/evidence/callback-sink.jsonl",
            ]
        );
        assert_eq!(
            command_args(r"C:\work tree\프로젝트\", zed::Os::Windows)[0],
            r"C:\work tree\프로젝트\.s005-artifacts\probe\callback_sink.js"
        );
    }

    #[test]
    fn contributes_exact_release_bundle_order_only_to_jdtls() {
        assert_eq!(
            additional_initialization_options(
                SERVER_ID,
                TARGET_SERVER_ID,
                "/workspace",
                zed::Os::Linux,
            ),
            Some(zed::serde_json::json!({
                "bundles": [
                    "/workspace/.s005-artifacts/bundles/io.projectreactor.reactor-core.jar",
                    "/workspace/.s005-artifacts/bundles/org.reactivestreams.reactive-streams.jar",
                    "/workspace/.s005-artifacts/bundles/jdt-ls-commons.jar",
                    "/workspace/.s005-artifacts/bundles/jdt-ls-extension.jar",
                    "/workspace/.s005-artifacts/bundles/sts-gradle-tooling.jar"
                ]
            }))
        );
        assert!(
            additional_initialization_options(
                "other",
                TARGET_SERVER_ID,
                "/workspace",
                zed::Os::Linux,
            )
            .is_none()
        );
        assert!(
            additional_initialization_options(SERVER_ID, "other", "/workspace", zed::Os::Linux,)
                .is_none()
        );
    }

    #[test]
    fn rejects_unknown_command_server_id() {
        assert!(validate_server_id(SERVER_ID).is_ok());
        assert_eq!(
            validate_server_id("other").unwrap_err(),
            "unknown language server: other"
        );
    }
}
