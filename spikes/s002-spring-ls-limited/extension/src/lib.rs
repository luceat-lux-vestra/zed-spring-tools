use zed_extension_api as zed;

const SERVER_ID: &str = "s002-spring-boot-ls";
const SERVER_JAR: &str = concat!(
    "tmp/s002-artifacts/extracted/extension/language-server/",
    "spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar"
);

const JVM_ARGS: &[&str] = &[
    "-Xmx1024m",
    "-Dspring.config.location=classpath:/application.properties",
    "-Djdk.util.zip.disableZip64ExtraFieldValidation=true",
    "-Dspring.main.web-application-type=NONE",
    "-Xlog:jni+resolve=off",
    "-jar",
];

struct SpringLsLimitedExtension;

impl zed::Extension for SpringLsLimitedExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        validate_server_id(language_server_id)?;

        let java = resolve_java(worktree)?;
        let server_jar = worktree_path(&worktree.root_path(), SERVER_JAR);
        let mut args = JVM_ARGS
            .iter()
            .map(|argument| (*argument).to_owned())
            .collect::<Vec<_>>();
        args.push(server_jar);

        Ok(zed::Command {
            command: java,
            args,
            env: worktree.shell_env(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        validate_server_id(language_server_id)?;
        Ok(Some(initialization_options()))
    }
}

fn validate_server_id(language_server_id: &zed::LanguageServerId) -> zed::Result<()> {
    if language_server_id.as_ref() == SERVER_ID {
        Ok(())
    } else {
        Err(format!(
            "unknown language server: {}",
            language_server_id.as_ref()
        ))
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

fn initialization_options() -> zed::serde_json::Value {
    zed::serde_json::json!({ "enableJdtClasspath": false })
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

zed::register_extension!(SpringLsLimitedExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_host_paths_without_a_shell() {
        assert_eq!(
            host_path("/worktree/", "/tmp/server.jar", zed::Os::Linux),
            "/worktree/tmp/server.jar"
        );
        assert_eq!(
            host_path(r"C:\worktree\", r"\tmp/server.jar", zed::Os::Windows),
            r"C:\worktree\tmp\server.jar"
        );
        assert_eq!(
            host_path("/work tree/프로젝트/", r"tmp\server.jar", zed::Os::Mac),
            "/work tree/프로젝트/tmp/server.jar"
        );
    }

    #[test]
    fn resolves_java_home_for_each_host_family() {
        let env = vec![("JAVA_HOME".to_owned(), "/jdks/temurin 25".to_owned())];
        assert_eq!(
            java_from_env(&env, zed::Os::Mac).as_deref(),
            Some("/jdks/temurin 25/bin/java")
        );

        let env = vec![("JAVA_HOME".to_owned(), r"C:\Java\jdk-25".to_owned())];
        assert_eq!(
            java_from_env(&env, zed::Os::Windows).as_deref(),
            Some(r"C:\Java\jdk-25\bin\java.exe")
        );
    }

    #[test]
    fn rejects_missing_java_home_fallback() {
        assert_eq!(java_from_env(&[], zed::Os::Linux), None);
        assert_eq!(
            java_from_env(&[("JAVA_HOME".to_owned(), String::new())], zed::Os::Linux),
            None
        );
    }

    #[test]
    fn disables_jdt_classpath_in_initialization_options() {
        assert_eq!(
            initialization_options(),
            zed::serde_json::json!({ "enableJdtClasspath": false })
        );
    }
}
