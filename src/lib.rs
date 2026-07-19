mod artifacts;
mod platform;
mod runtime;

use std::env;
use std::path::Path;
use zed_extension_api as zed;

const SERVER_ID: &str = "spring-tools";
const JAVA_SERVER_ID: &str = "jdtls";
const EXTENSION_VERSION: &str = "0.1.0";

struct SpringToolsExtension;

impl zed::Extension for SpringToolsExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        require_server(language_server_id)?;
        let runtime = runtime::materialize()?;
        let spring = artifacts::ensure_installed(language_server_id)?;
        let node = zed::node_binary_path()
            .map_err(|error| format!("Zed-managed Node is required: {error}"))?;
        let java = platform::resolve_java(worktree)?;
        let extension_work = env::current_dir()
            .map_err(|error| format!("resolve extension work directory: {error}"))?;
        let java_work = platform::official_java_work_dir(&extension_work)?;
        let root = worktree.root_path();

        Ok(zed::Command {
            command: node,
            args: coordinator_arguments(
                &runtime,
                &spring,
                &root,
                &java,
                &java_work,
                zed::current_platform().0,
            )?,
            env: worktree.shell_env(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        require_server(language_server_id)?;
        Ok(Some(spring_initialization_options()))
    }

    fn language_server_workspace_configuration(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        require_server(language_server_id)?;
        Ok(Some(spring_workspace_configuration()))
    }

    fn language_server_additional_initialization_options(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        target_language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        require_server(language_server_id)?;
        if target_language_server_id.as_ref() != JAVA_SERVER_ID {
            return Ok(None);
        }
        let runtime = runtime::materialize()?;
        let spring = artifacts::ensure_installed(language_server_id)?;
        let mut bundles = spring.bundles;
        bundles.push(runtime.bridge);
        let values: Result<Vec<_>, _> = bundles
            .iter()
            .map(|path| platform::path_string(path))
            .collect();
        Ok(Some(zed::serde_json::json!({ "bundles": values? })))
    }
}

fn require_server(language_server_id: &zed::LanguageServerId) -> Result<(), String> {
    if language_server_id.as_ref() == SERVER_ID {
        Ok(())
    } else {
        Err(format!("unknown language server: {language_server_id}"))
    }
}

fn spring_initialization_options() -> zed::serde_json::Value {
    // The coordinator enables this only after the official Java route is
    // ready. This keeps Spring LS startup independent of editor tab order.
    zed::serde_json::json!({ "enableJdtClasspath": false })
}

fn spring_workspace_configuration() -> zed::serde_json::Value {
    // VS Code contributes these defaults through its settings schema. Zed has
    // no equivalent Spring settings schema, so provide the same effective
    // defaults explicitly or Spring's standard CodeLens providers stay off.
    //
    // `jpql` is off by default on the server (`BootJavaConfig.isJpqlEnabled()`
    // returns false when the key is absent, unlike the cron inlay hint which
    // defaults on). Without it `JpqlSupportState` stays disabled, so Spring Data
    // query intelligence — embedded JPQL/HQL semantic tokens and the
    // positional-parameter inlay hint — never runs. Enable it explicitly.
    zed::serde_json::json!({
        "boot-java": {
            "highlight-codelens": {
                "on": true
            },
            "highlight-copilot-codelens": {
                "on": true
            },
            "jpql": true,
            "java": {
                "codelens-over-query-methods": true,
                "codelens-web-configs-on-controller-classes": true
            }
        }
    })
}

fn coordinator_arguments(
    runtime: &runtime::RuntimePaths,
    spring: &artifacts::SpringPaths,
    root: &str,
    java: &str,
    java_work: &Path,
    os: zed::Os,
) -> Result<Vec<String>, String> {
    Ok(vec![
        platform::path_string(&runtime.coordinator)?,
        "--worktree".to_owned(),
        root.to_owned(),
        "--java".to_owned(),
        java.to_owned(),
        "--spring-server".to_owned(),
        platform::path_string(&spring.server)?,
        "--spring-home".to_owned(),
        platform::path_string(&spring.root)?,
        "--java-work-dir".to_owned(),
        platform::path_string(java_work)?,
        "--compatibility".to_owned(),
        platform::path_string(&runtime.compatibility)?,
        "--host-os".to_owned(),
        match os {
            zed::Os::Mac => "macos",
            zed::Os::Linux => "linux",
            zed::Os::Windows => "windows",
        }
        .to_owned(),
        "--extension-version".to_owned(),
        EXTENSION_VERSION.to_owned(),
    ])
}

zed::register_extension!(SpringToolsExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coordinator_arguments_are_shell_independent() {
        let runtime = runtime::RuntimePaths {
            coordinator: "/extension work/runtime/main.mjs".into(),
            bridge: "/extension work/runtime/bridge.jar".into(),
            compatibility: "/extension work/runtime/providers.json".into(),
        };
        let spring = artifacts::SpringPaths {
            root: "/extension work/spring".into(),
            server: "/extension work/spring/server.jar".into(),
            bundles: Vec::new(),
        };
        let arguments = coordinator_arguments(
            &runtime,
            &spring,
            "/work tree/프로젝트",
            "/jdks/temurin 25/bin/java",
            Path::new("/extensions/work/java"),
            zed::Os::Mac,
        )
        .unwrap();
        assert_eq!(arguments[0], "/extension work/runtime/main.mjs");
        assert_eq!(arguments[2], "/work tree/프로젝트");
        assert_eq!(arguments[4], "/jdks/temurin 25/bin/java");
        assert_eq!(arguments[10], "/extensions/work/java");
        assert_eq!(arguments[16], EXTENSION_VERSION);
        assert!(!arguments.iter().any(|argument| argument == "sh"));
        assert!(
            include_str!("../extension.toml")
                .contains(&format!("version = \"{EXTENSION_VERSION}\""))
        );
    }

    #[test]
    fn spring_initialization_does_not_race_the_official_java_server() {
        assert_eq!(
            spring_initialization_options(),
            zed::serde_json::json!({ "enableJdtClasspath": false })
        );
    }

    #[test]
    fn spring_workspace_configuration_enables_every_codelens_provider() {
        assert_eq!(
            spring_workspace_configuration(),
            zed::serde_json::json!({
                "boot-java": {
                    "highlight-codelens": { "on": true },
                    "highlight-copilot-codelens": { "on": true },
                    "jpql": true,
                    "java": {
                        "codelens-over-query-methods": true,
                        "codelens-web-configs-on-controller-classes": true
                    }
                }
            })
        );
    }

    #[test]
    fn spring_workspace_configuration_enables_jpql_query_intelligence() {
        // `boot-java.jpql` defaults off on the server, so it must be sent
        // explicitly or Spring Data query intelligence (semantic tokens +
        // the positional-parameter inlay hint) never runs.
        let config = spring_workspace_configuration();
        assert_eq!(config["boot-java"]["jpql"], zed::serde_json::json!(true));
    }
}
