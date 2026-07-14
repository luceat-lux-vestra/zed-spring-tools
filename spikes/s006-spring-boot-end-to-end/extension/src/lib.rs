use zed_extension_api as zed;

const SERVER_ID: &str = "s006-spring-boot-end-to-end";
const TARGET_SERVER_ID: &str = "jdtls";
const PROXY_SCRIPT: &str = ".s006-artifacts/probe/spring_proxy.mjs";
const SERVER_JAR: &str = concat!(
    ".s006-artifacts/spring/",
    "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar"
);
const JAVA_ROUTE: &str = ".s006-state/java-route.json";
const SPRING_ROUTE: &str = ".s006-state/spring-route.json";
const EVIDENCE_LOG: &str = ".s006-evidence/spring-proxy.jsonl";
const STDERR_LOG: &str = ".s006-evidence/spring-ls-stderr.log";
const BUNDLE_DIRECTORY: &str = ".s006-artifacts/bundles";
const BUNDLES: [&str; 5] = [
    "io.projectreactor.reactor-core.jar",
    "org.reactivestreams.reactive-streams.jar",
    "jdt-ls-commons.jar",
    "jdt-ls-extension.jar",
    "sts-gradle-tooling.jar",
];

struct SpringBootEndToEndExtension;

impl zed::Extension for SpringBootEndToEndExtension {
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
        let java = resolve_java(worktree)?;
        let root = worktree.root_path();

        Ok(zed::Command {
            command: node,
            args: command_args(&root, &java, zed::current_platform().0),
            env: worktree.shell_env(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        validate_server_id(language_server_id.as_ref())?;
        Ok(Some(initialization_options()))
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

fn resolve_java(worktree: &zed::Worktree) -> zed::Result<String> {
    if let Some(java) = worktree.which("java") {
        return Ok(java);
    }
    java_from_env(&worktree.shell_env(), zed::current_platform().0).ok_or_else(|| {
        "Java 21+ was not found with Worktree::which(\"java\") or JAVA_HOME".to_owned()
    })
}

fn java_from_env(env: &[(String, String)], os: zed::Os) -> Option<String> {
    let java_home = env
        .iter()
        .find(|(name, value)| name == "JAVA_HOME" && !value.is_empty())
        .map(|(_, value)| value.as_str())?;
    let executable = if os == zed::Os::Windows {
        "bin/java.exe"
    } else {
        "bin/java"
    };
    Some(host_path(java_home, executable, os))
}

fn command_args(root: &str, java: &str, os: zed::Os) -> Vec<String> {
    vec![
        host_path(root, PROXY_SCRIPT, os),
        "--root".to_owned(),
        root.to_owned(),
        "--java".to_owned(),
        java.to_owned(),
        "--jar".to_owned(),
        host_path(root, SERVER_JAR, os),
        "--java-route".to_owned(),
        host_path(root, JAVA_ROUTE, os),
        "--spring-route".to_owned(),
        host_path(root, SPRING_ROUTE, os),
        "--evidence".to_owned(),
        host_path(root, EVIDENCE_LOG, os),
        "--stderr".to_owned(),
        host_path(root, STDERR_LOG, os),
    ]
}

fn initialization_options() -> zed::serde_json::Value {
    zed::serde_json::json!({ "enableJdtClasspath": false })
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

zed::register_extension!(SpringBootEndToEndExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_shell_independent_arguments_for_all_host_families() {
        let mac = command_args(
            "/work tree/프로젝트/",
            "/jdks/temurin 25/bin/java",
            zed::Os::Mac,
        );
        assert_eq!(
            mac[0],
            "/work tree/프로젝트/.s006-artifacts/probe/spring_proxy.mjs"
        );
        assert_eq!(mac[4], "/jdks/temurin 25/bin/java");
        assert_eq!(
            mac[6],
            "/work tree/프로젝트/.s006-artifacts/spring/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar"
        );

        let windows = command_args(
            r"C:\work tree\프로젝트\",
            r"C:\Java\jdk-25\bin\java.exe",
            zed::Os::Windows,
        );
        assert_eq!(
            windows[0],
            r"C:\work tree\프로젝트\.s006-artifacts\probe\spring_proxy.mjs"
        );
        assert_eq!(
            windows[8],
            r"C:\work tree\프로젝트\.s006-state\java-route.json"
        );
    }

    #[test]
    fn disables_jdt_classpath_until_the_proxy_observes_the_baseline() {
        assert_eq!(
            initialization_options(),
            zed::serde_json::json!({ "enableJdtClasspath": false })
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
                    "/workspace/.s006-artifacts/bundles/io.projectreactor.reactor-core.jar",
                    "/workspace/.s006-artifacts/bundles/org.reactivestreams.reactive-streams.jar",
                    "/workspace/.s006-artifacts/bundles/jdt-ls-commons.jar",
                    "/workspace/.s006-artifacts/bundles/jdt-ls-extension.jar",
                    "/workspace/.s006-artifacts/bundles/sts-gradle-tooling.jar"
                ]
            }))
        );
        assert!(
            additional_initialization_options(SERVER_ID, "other", "/workspace", zed::Os::Linux)
                .is_none()
        );
    }

    #[test]
    fn resolves_java_home_without_platform_shells() {
        let unix = vec![("JAVA_HOME".to_owned(), "/jdks/temurin 25".to_owned())];
        assert_eq!(
            java_from_env(&unix, zed::Os::Linux).as_deref(),
            Some("/jdks/temurin 25/bin/java")
        );
        let windows = vec![("JAVA_HOME".to_owned(), r"C:\Java\jdk-25".to_owned())];
        assert_eq!(
            java_from_env(&windows, zed::Os::Windows).as_deref(),
            Some(r"C:\Java\jdk-25\bin\java.exe")
        );
        assert_eq!(java_from_env(&[], zed::Os::Mac), None);
    }

    #[test]
    fn rejects_unknown_server_id() {
        assert!(validate_server_id(SERVER_ID).is_ok());
        assert_eq!(
            validate_server_id("stale-s005-server").unwrap_err(),
            "unknown language server: stale-s005-server"
        );
    }
}
