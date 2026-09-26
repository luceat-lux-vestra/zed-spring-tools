use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const RUNTIME_VERSION: &str = "0.2.0-alpha.1";
const COORDINATOR_FILES: &[(&str, &str)] = &[
    ("main.mjs", include_str!("../coordinator/src/main.mjs")),
    ("lsp.mjs", include_str!("../coordinator/src/lsp.mjs")),
];

#[derive(Debug, Clone)]
pub struct RuntimePaths {
    pub coordinator: PathBuf,
}

pub fn materialize() -> Result<RuntimePaths, String> {
    let root = env::current_dir()
        .map_err(|error| format!("resolve extension work directory: {error}"))?
        .join("runtime")
        .join(RUNTIME_VERSION);
    let coordinator_root = root.join("coordinator");
    fs::create_dir_all(&coordinator_root)
        .map_err(|error| format!("create coordinator runtime directory: {error}"))?;

    for (name, contents) in COORDINATOR_FILES {
        write_if_changed(&coordinator_root.join(name), contents.as_bytes())?;
    }

    Ok(RuntimePaths {
        coordinator: coordinator_root.join("main.mjs"),
    })
}

fn write_if_changed(path: &Path, expected: &[u8]) -> Result<(), String> {
    if let Ok(existing) = fs::read(path)
        && digest(&existing) == digest(expected)
    {
        return Ok(());
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("runtime path has no parent: {}", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("create runtime parent {}: {error}", parent.display()))?;
    let temporary = path.with_extension("tmp");
    let _ = fs::remove_file(&temporary);
    fs::write(&temporary, expected)
        .map_err(|error| format!("write runtime asset {}: {error}", temporary.display()))?;
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("replace runtime asset {}: {error}", path.display()))?;
    }
    fs::rename(&temporary, path)
        .map_err(|error| format!("activate runtime asset {}: {error}", path.display()))?;
    Ok(())
}

fn digest(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_coordinator_assets_are_nonempty() {
        assert!(COORDINATOR_FILES.iter().all(|(_, body)| !body.is_empty()));
    }
}
