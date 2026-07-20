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
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        require_server(language_server_id)?;
        let user = zed::settings::LspSettings::for_worktree(SERVER_ID, worktree)
            .ok()
            .and_then(|settings| settings.settings);
        Ok(Some(spring_workspace_configuration(
            user,
            &worktree.root_path(),
        )))
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

// VS Code contributes these defaults through its settings schema. Zed has no
// equivalent Spring settings schema, so provide the same effective defaults
// explicitly or Spring's standard CodeLens providers stay off.
//
// `jpql` is off by default on the server (`BootJavaConfig.isJpqlEnabled()`
// returns false when the key is absent, unlike the cron inlay hint which
// defaults on). Without it `JpqlSupportState` stays disabled, so Spring Data
// query intelligence — embedded JPQL/HQL semantic tokens and the
// positional-parameter inlay hint — never runs. Enable it explicitly.
//
// `java.completions.inject-bean` is the same trap: VS Code's schema defaults it
// `true`, but `BootJavaConfig.isBeanInjectionCompletionEnabled()` is
// `Boolean.TRUE.equals(...)`, so an absent key reads false and
// `BeanCompletionProvider` returns nothing. Only this one provider is gated
// that way; every other Spring-aware Java completion family in
// `BootJavaCompletionEngineConfigurer` is registered unconditionally.
fn spring_default_configuration() -> zed::serde_json::Value {
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
                "codelens-web-configs-on-controller-classes": true,
                "completions": {
                    "inject-bean": true
                }
            }
        }
    })
}

// The user's `lsp."spring-tools".settings` wins over our defaults so any
// `boot-java.*` key VS Code exposes can be set in Zed, including
// `boot-java.common.properties-metadata` — the path Spring reads in
// `BootJavaConfig.getCommonPropertiesFile()`. Without that key
// `SpringPropertiesIndexManager.reloadCommonProperties()` returns false and the
// reload command cannot do anything, so this passthrough is what makes shared
// metadata reachable at all.
fn spring_workspace_configuration(
    user: Option<zed::serde_json::Value>,
    worktree_root: &str,
) -> zed::serde_json::Value {
    let mut configuration = spring_default_configuration();
    if let Some(user) = user {
        merge_configuration(&mut configuration, user);
    }
    absolutize_common_properties_file(&mut configuration, worktree_root);
    configuration
}

// Deep-merge objects key by key; any non-object user value replaces ours
// outright, so a user can turn an enabled default back off.
fn merge_configuration(target: &mut zed::serde_json::Value, source: zed::serde_json::Value) {
    match (target, source) {
        (zed::serde_json::Value::Object(target), zed::serde_json::Value::Object(source)) => {
            for (key, value) in source {
                merge_configuration(
                    target.entry(key).or_insert(zed::serde_json::Value::Null),
                    value,
                );
            }
        }
        (target, source) => *target = source,
    }
}

// Spring resolves this path with `Paths.get(String)`, so a relative path would
// resolve against the coordinator's working directory rather than the project.
// Anchor it to the worktree root instead, which is what a user writing a
// project-relative path means.
fn absolutize_common_properties_file(
    configuration: &mut zed::serde_json::Value,
    worktree_root: &str,
) {
    let Some(configured) = configuration
        .get("boot-java")
        .and_then(|boot| boot.get("common"))
        .and_then(|common| common.get("properties-metadata"))
        .and_then(|value| value.as_str())
    else {
        return;
    };
    let configured = configured.trim();
    if configured.is_empty() || Path::new(configured).is_absolute() {
        return;
    }
    let resolved = Path::new(worktree_root).join(configured);
    let Some(resolved) = resolved.to_str() else {
        return;
    };
    configuration["boot-java"]["common"]["properties-metadata"] =
        zed::serde_json::Value::String(resolved.to_owned());
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
    fn spring_only_files_are_classified_and_carry_their_own_language_ids() {
        // Spring keys its component set off the didOpen language id, so routing
        // these files as ordinary Properties would silently hand them to the
        // Boot properties components instead of the JPA/factories ones.
        let manifest = include_str!("../extension.toml");
        assert!(manifest.contains(r#""Spring Factories" = "spring-factories""#));
        assert!(manifest.contains(r#""JPA Query Properties" = "jpa-query-properties""#));
        assert!(manifest.contains(
            r#"languages = ["languages/spring-factories", "languages/jpa-query-properties"]"#
        ));
        // The grammar is a third-party dependency, so it stays pinned to an
        // exact revision rather than a branch — and to the same revision the
        // official Java extension already pins, so this adds no new upstream
        // source for a user who already has that extension installed.
        assert!(manifest.contains(r#"rev = "579b62f5ad8d96c2bb331f07d1408c92767531d9""#));

        let factories = include_str!("../languages/spring-factories/config.toml");
        assert!(factories.contains(r#"path_suffixes = ["factories"]"#));
        let jpa = include_str!("../languages/jpa-query-properties/config.toml");
        assert!(jpa.contains(r#"path_suffixes = ["jpa-named-queries.properties"]"#));
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
            spring_workspace_configuration(None, "/work"),
            zed::serde_json::json!({
                "boot-java": {
                    "highlight-codelens": { "on": true },
                    "highlight-copilot-codelens": { "on": true },
                    "jpql": true,
                    "java": {
                        "codelens-over-query-methods": true,
                        "codelens-web-configs-on-controller-classes": true,
                        "completions": { "inject-bean": true }
                    }
                }
            })
        );
    }

    #[test]
    fn spring_workspace_configuration_enables_bean_injection_completion() {
        // `boot-java.java.completions.inject-bean` reads false when absent
        // (`Boolean.TRUE.equals`), while VS Code's schema defaults it true, so
        // without this key `BeanCompletionProvider` is silently dead.
        let config = spring_workspace_configuration(None, "/work");
        assert_eq!(
            config["boot-java"]["java"]["completions"]["inject-bean"],
            zed::serde_json::json!(true)
        );
    }

    #[test]
    fn spring_workspace_configuration_enables_jpql_query_intelligence() {
        // `boot-java.jpql` defaults off on the server, so it must be sent
        // explicitly or Spring Data query intelligence (semantic tokens +
        // the positional-parameter inlay hint) never runs.
        let config = spring_workspace_configuration(None, "/work");
        assert_eq!(config["boot-java"]["jpql"], zed::serde_json::json!(true));
    }

    #[test]
    fn user_settings_reach_spring_without_dropping_defaults() {
        // Without this passthrough `BootJavaConfig.getCommonPropertiesFile()`
        // is always null, so `reloadCommonProperties()` returns false and the
        // reload command is a guaranteed no-op.
        let config = spring_workspace_configuration(
            Some(zed::serde_json::json!({
                "boot-java": { "common": { "properties-metadata": "/shared/metadata.json" } }
            })),
            "/work",
        );
        assert_eq!(
            config["boot-java"]["common"]["properties-metadata"],
            zed::serde_json::json!("/shared/metadata.json")
        );
        assert_eq!(config["boot-java"]["jpql"], zed::serde_json::json!(true));
        assert_eq!(
            config["boot-java"]["highlight-codelens"]["on"],
            zed::serde_json::json!(true)
        );
    }

    #[test]
    fn user_settings_override_an_enabled_default() {
        let config = spring_workspace_configuration(
            Some(zed::serde_json::json!({ "boot-java": { "jpql": false } })),
            "/work",
        );
        assert_eq!(config["boot-java"]["jpql"], zed::serde_json::json!(false));
        // A sibling under the same object survives the merge.
        assert_eq!(
            config["boot-java"]["java"]["codelens-over-query-methods"],
            zed::serde_json::json!(true)
        );
    }

    #[test]
    fn a_relative_metadata_path_anchors_to_the_worktree_root() {
        // Spring calls `Paths.get(value)`, which would otherwise resolve
        // against the coordinator's working directory.
        let config = spring_workspace_configuration(
            Some(zed::serde_json::json!({
                "boot-java": { "common": { "properties-metadata": "config/shared-metadata.json" } }
            })),
            "/work/project",
        );
        assert_eq!(
            config["boot-java"]["common"]["properties-metadata"],
            zed::serde_json::json!("/work/project/config/shared-metadata.json")
        );
    }
}
