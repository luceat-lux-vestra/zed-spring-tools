use std::path::{Path, PathBuf};
use zed_extension_api as zed;

pub fn resolve_java(worktree: &zed::Worktree) -> Result<String, String> {
    if let Some(java) = worktree.which("java") {
        return Ok(java);
    }
    java_from_env(&worktree.shell_env(), zed::current_platform().0).ok_or_else(|| {
        "A JDK 21 or newer is required for Spring Tools; configure PATH or JAVA_HOME".to_owned()
    })
}

pub fn java_from_env(environment: &[(String, String)], os: zed::Os) -> Option<String> {
    let home = environment
        .iter()
        .find(|(name, value)| name == "JAVA_HOME" && !value.is_empty())?
        .1
        .as_str();
    let executable = if os == zed::Os::Windows {
        "bin/java.exe"
    } else {
        "bin/java"
    };
    Some(host_join(home, executable, os))
}

pub fn host_join(root: &str, relative: &str, os: zed::Os) -> String {
    let root = root.trim_end_matches(['/', '\\']);
    let relative = relative.trim_start_matches(['/', '\\']);
    if os == zed::Os::Windows {
        format!("{}\\{}", root, relative.replace('/', "\\"))
    } else {
        format!("{}/{}", root, relative.replace('\\', "/"))
    }
}

pub fn path_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("path is not valid UTF-8: {}", path.display()))
}

pub fn official_java_work_dir(extension_work_dir: &Path) -> Result<PathBuf, String> {
    let work_root = extension_work_dir.parent().ok_or_else(|| {
        format!(
            "extension work directory has no shared parent: {}",
            extension_work_dir.display()
        )
    })?;
    Ok(work_root.join("java"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_all_host_path_families_without_a_shell() {
        assert_eq!(
            host_join("/work tree/프로젝트/", "runtime/main.mjs", zed::Os::Mac),
            "/work tree/프로젝트/runtime/main.mjs"
        );
        assert_eq!(
            host_join(
                r"C:\work tree\프로젝트\",
                "runtime/main.mjs",
                zed::Os::Windows
            ),
            r"C:\work tree\프로젝트\runtime\main.mjs"
        );
    }

    #[test]
    fn derives_the_official_java_sibling_work_directory() {
        let extension = Path::new("/zed/extensions/work/zed-spring-tools");
        assert_eq!(
            official_java_work_dir(extension).unwrap(),
            Path::new("/zed/extensions/work/java")
        );
    }
}
