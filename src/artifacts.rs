use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use zed_extension_api as zed;

const VERSION: &str = "5.2.0.RELEASE";
const ASSET: &str = "vscode-spring-boot-2.2.0-RC1.vsix";
const URL: &str = "https://github.com/spring-projects/spring-tools/releases/download/5.2.0.RELEASE/vscode-spring-boot-2.2.0-RC1.vsix";
const SIZE: u64 = 82_759_143;
const SHA256: &str = "70943c4e434d469090f8cee54dacf1de10ec1161f92685581dc2ef6164971bb3";
const MAX_ENTRIES: usize = 10_000;
const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 2 * 1024 * 1024 * 1024;

const REQUIRED: &[(&str, &str)] = &[
    (
        "extension/language-server/spring-boot-language-server-2.2.0-SNAPSHOT-exec.jar",
        "ec922c593895331943ee1eccda434461da034bb87ac20f406fd7fb5e211bc8e1",
    ),
    (
        "extension/jars/io.projectreactor.reactor-core.jar",
        "76ea420992e2c864f9a21d241ac29ac6582e857ae30ecd878cb96af827597590",
    ),
    (
        "extension/jars/org.reactivestreams.reactive-streams.jar",
        "71e23e2a0d9159fc1aae1158af714ac72fc67a384bb6fe195301081df49c2038",
    ),
    (
        "extension/jars/jdt-ls-commons.jar",
        "0134b2b2afdd2207be8c271c5501d916ca14fc709ae6d0c8067ea646955fbf69",
    ),
    (
        "extension/jars/jdt-ls-extension.jar",
        "692e8a63e6fc57a9c314121b506a0a709ddbcfcc9580c18aef6ed9b612b972ce",
    ),
    (
        "extension/jars/sts-gradle-tooling.jar",
        "9fd8165a92a930021ad93b7640ac6ebb06bb6659f65aa641ba9b4f4295901ec4",
    ),
];

#[derive(Debug, Clone)]
pub struct SpringPaths {
    pub root: PathBuf,
    pub server: PathBuf,
    pub bundles: Vec<PathBuf>,
}

pub fn ensure_installed(language_server_id: &zed::LanguageServerId) -> Result<SpringPaths, String> {
    let install = install_root();
    if validate_install(&install).is_ok() {
        return paths(install);
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
    let downloads = PathBuf::from("downloads").join(VERSION);
    fs::create_dir_all(&downloads)
        .map_err(|error| format!("create Spring Tools download directory: {error}"))?;
    let archive = downloads.join(ASSET);
    if validate_archive(&archive).is_err() {
        let _ = fs::remove_file(&archive);
        zed::download_file(
            URL,
            archive
                .to_str()
                .ok_or_else(|| "Spring Tools download path is not UTF-8".to_owned())?,
            zed::DownloadedFileType::Uncompressed,
        )
        .map_err(|error| format!("download pinned Spring Tools {VERSION}: {error}"))?;
        validate_archive(&archive)?;
    }

    let staging = install.with_extension("staging");
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("remove stale Spring Tools staging directory: {error}"))?;
    }
    fs::create_dir_all(&staging)
        .map_err(|error| format!("create Spring Tools staging directory: {error}"))?;
    if let Err(error) = extract_archive(&archive, &staging).and_then(|_| validate_install(&staging))
    {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    if install.exists() {
        fs::remove_dir_all(install)
            .map_err(|error| format!("remove invalid Spring Tools installation: {error}"))?;
    }
    if let Some(parent) = install.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("create Spring Tools install parent: {error}"))?;
    }
    fs::rename(&staging, install)
        .map_err(|error| format!("activate Spring Tools installation: {error}"))?;
    paths(install.to_path_buf())
}

fn install_root() -> PathBuf {
    PathBuf::from("spring-tools").join(VERSION)
}

fn validate_archive(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("read Spring Tools archive metadata: {error}"))?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() != SIZE {
        return Err("Spring Tools archive identity does not match the pinned size".to_owned());
    }
    if sha256_file(path)? != SHA256 {
        return Err("Spring Tools archive checksum does not match the pinned release".to_owned());
    }
    Ok(())
}

fn extract_archive(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let archive_file =
        File::open(archive_path).map_err(|error| format!("open Spring Tools archive: {error}"))?;
    let mut archive = zip::ZipArchive::new(archive_file)
        .map_err(|error| format!("parse Spring Tools VSIX: {error}"))?;
    if archive.len() > MAX_ENTRIES {
        return Err("Spring Tools VSIX has too many entries".to_owned());
    }
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("read Spring Tools VSIX entry: {error}"))?;
        if entry.is_symlink() {
            return Err("Spring Tools VSIX contains a symbolic link".to_owned());
        }
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| "Spring Tools VSIX contains an unsafe path".to_owned())?;
        let output = destination.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&output)
                .map_err(|error| format!("create extracted directory: {error}"))?;
            continue;
        }
        if entry.size() > MAX_FILE_BYTES {
            return Err("Spring Tools VSIX entry exceeds the file limit".to_owned());
        }
        total = total
            .checked_add(entry.size())
            .ok_or_else(|| "Spring Tools VSIX expanded size overflowed".to_owned())?;
        if total > MAX_TOTAL_BYTES {
            return Err("Spring Tools VSIX exceeds the expanded size limit".to_owned());
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("create extracted file parent: {error}"))?;
        }
        let mut file = File::create(&output)
            .map_err(|error| format!("create extracted Spring Tools file: {error}"))?;
        io::copy(&mut entry, &mut file)
            .map_err(|error| format!("extract Spring Tools file: {error}"))?;
        file.flush()
            .map_err(|error| format!("flush extracted Spring Tools file: {error}"))?;
    }
    Ok(())
}

fn validate_install(root: &Path) -> Result<(), String> {
    for (relative, expected) in REQUIRED {
        let path = root.join(relative);
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("missing required Spring Tools file {relative}: {error}"))?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err(format!(
                "required Spring Tools path is not a regular file: {relative}"
            ));
        }
        if sha256_file(&path)? != *expected {
            return Err(format!(
                "required Spring Tools checksum mismatch: {relative}"
            ));
        }
    }
    Ok(())
}

fn paths(root: PathBuf) -> Result<SpringPaths, String> {
    let server = root.join(REQUIRED[0].0);
    let bundles = REQUIRED[1..]
        .iter()
        .map(|(relative, _)| root.join(relative))
        .collect();
    Ok(SpringPaths {
        root,
        server,
        bundles,
    })
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
    fn product_manifest_contains_exact_five_spring_bundles() {
        assert_eq!(REQUIRED.len(), 6);
        assert!(REQUIRED[0].0.ends_with("-exec.jar"));
        assert_eq!(paths(PathBuf::from("/spring")).unwrap().bundles.len(), 5);
    }

    #[test]
    fn archive_identity_is_pinned_and_not_latest() {
        assert!(URL.contains(VERSION));
        assert!(URL.ends_with(ASSET));
        assert!(!URL.contains("latest"));
        assert_eq!(SHA256.len(), 64);
    }
}
