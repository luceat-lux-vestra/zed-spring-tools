use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use zed_extension_api as zed;

const VERSION: &str = "5.3.0.RELEASE";
const ASSET: &str = "spring-boot-language-server-standalone-exec.jar";
const URL: &str = "https://cdn.spring.io/spring-tools/release/language-server/spring-boot/2.3.0/spring-boot-language-server-standalone-exec.jar";
const SIZE: u64 = 98_065_695;
const SHA256: &str = "a4c83e721c2799e4bca72939db840ad29440da34227e291b0447a6c06ff23a6b";

#[derive(Debug, Clone)]
pub struct SpringPaths {
    pub root: PathBuf,
    pub server: PathBuf,
}

pub fn ensure_installed(language_server_id: &zed::LanguageServerId) -> Result<SpringPaths, String> {
    let install = install_root()?;
    let server = install.join(ASSET);
    if validate_file(&server).is_ok() {
        return Ok(SpringPaths {
            root: install,
            server,
        });
    }

    zed::set_language_server_installation_status(
        language_server_id,
        &zed::LanguageServerInstallationStatus::Downloading,
    );
    let result = install_from_download(&install);
    match &result {
        Ok(_) => zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        ),
        Err(error) => zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::Failed(error.clone()),
        ),
    }
    result
}

fn install_from_download(install: &Path) -> Result<SpringPaths, String> {
    fs::create_dir_all(install)
        .map_err(|error| format!("create Spring Tools install directory: {error}"))?;
    let server = install.join(ASSET);
    let staging = install.join(format!("{ASSET}.download"));
    let _ = fs::remove_file(&staging);

    zed::download_file(
        URL,
        staging
            .to_str()
            .ok_or_else(|| "Spring Tools download path is not UTF-8".to_owned())?,
        zed::DownloadedFileType::Uncompressed,
    )
    .map_err(|error| format!("download pinned Spring Tools {VERSION}: {error}"))?;

    if let Err(error) = validate_file(&staging) {
        let _ = fs::remove_file(&staging);
        return Err(error);
    }
    if server.exists() {
        fs::remove_file(&server)
            .map_err(|error| format!("remove invalid Spring Tools installation: {error}"))?;
    }
    fs::rename(&staging, &server)
        .map_err(|error| format!("activate Spring Tools installation: {error}"))?;

    Ok(SpringPaths {
        root: install.to_path_buf(),
        server,
    })
}

fn install_root() -> Result<PathBuf, String> {
    Ok(env::current_dir()
        .map_err(|error| format!("resolve extension work directory: {error}"))?
        .join("spring-tools")
        .join(VERSION))
}

fn validate_file(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("read Spring Tools artifact metadata: {error}"))?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() != SIZE {
        return Err(
            "Spring Tools standalone artifact identity does not match the pinned size".to_owned(),
        );
    }
    if sha256_file(path)? != SHA256 {
        return Err(
            "Spring Tools standalone artifact checksum does not match the pinned release"
                .to_owned(),
        );
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("open file for checksum {}: {error}", path.display()))?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("read file for checksum {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    Ok(digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn standalone_artifact_identity_is_pinned_and_not_latest() {
        assert_eq!(VERSION, "5.3.0.RELEASE");
        assert!(URL.ends_with(ASSET));
        assert!(!URL.contains("latest"));
        assert_eq!(SHA256.len(), 64);
    }

    #[test]
    fn install_paths_are_absolute_before_the_language_server_changes_working_directory() {
        let root = install_root().unwrap();
        assert!(root.is_absolute());
        assert!(root.join(ASSET).is_absolute());
    }
}
