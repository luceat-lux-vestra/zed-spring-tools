use std::env;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const FIXED_ZIP_DATE: &str = "1980-01-01T00:00:02Z";

fn main() {
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("manifest directory"));
    let out = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo OUT_DIR"));
    let bridge = root.join("bridge");
    let classes = out.join("bridge-classes");
    let jar = out.join("zed-spring-bridge.jar");

    emit_rerun_paths(&bridge);
    reset_directory(&classes);

    let mut sources = Vec::new();
    collect_files(&bridge.join("src/main/java"), "java", &mut sources);
    collect_files(&bridge.join("src/compile-stubs/java"), "java", &mut sources);
    sources.sort();
    assert!(!sources.is_empty(), "bridge Java sources are missing");

    // The bridge targets `--release 21`, so both tools must come from a JDK
    // that new. Runners (including the extension registry's) often default
    // JAVA_HOME to an older JDK while a 21 is installed elsewhere, so locate a
    // suitable home rather than trusting JAVA_HOME blindly.
    let jdk = select_jdk_home();
    let javac = java_tool("javac", jdk.as_deref());
    let mut compile = Command::new(&javac);
    compile
        .arg("--release")
        .arg("21")
        .arg("-Xlint:all,-options")
        .arg("-Werror")
        .arg("-encoding")
        .arg("UTF-8")
        .arg("-d")
        .arg(&classes)
        .args(&sources);
    require_success(compile.output(), "compile the Java bridge", &javac);

    let jar_tool = java_tool("jar", jdk.as_deref());
    let mut package = Command::new(&jar_tool);
    package
        .arg("--create")
        .arg("--file")
        .arg(&jar)
        .arg("--manifest")
        .arg(bridge.join("META-INF/MANIFEST.MF"))
        .arg("--date")
        .arg(FIXED_ZIP_DATE)
        .arg("-C")
        .arg(&classes)
        .arg("dev")
        .arg("-C")
        .arg(&bridge)
        .arg("plugin.xml");
    require_success(package.output(), "package the Java bridge", &jar_tool);

    let list = require_success(
        Command::new(&jar_tool)
            .arg("--list")
            .arg("--file")
            .arg(&jar)
            .output(),
        "inspect the Java bridge",
        &jar_tool,
    );
    let entries = String::from_utf8(list.stdout).expect("jar listing must be UTF-8");
    assert!(entries.contains("dev/zed/spring/bridge/BridgeCommandHandler.class"));
    assert!(entries.contains("plugin.xml"));
    assert!(
        !entries.lines().any(|line| line.starts_with("org/")),
        "compile-only API stubs entered the bridge JAR"
    );
}

/// Minimum JDK feature version the bridge compiles against (`--release 21`).
const MIN_JDK: u32 = 21;

/// Resolve a JDK tool from `jdk_home/bin`, falling back to a bare name on
/// `PATH` when no home was selected (or the tool is missing there).
fn java_tool(name: &str, jdk_home: Option<&Path>) -> PathBuf {
    let executable = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_owned()
    };
    jdk_home
        .map(|home| home.join("bin").join(&executable))
        .filter(|path| path.is_file())
        .unwrap_or_else(|| PathBuf::from(executable))
}

/// Locate a JDK home whose `javac` is at least [`MIN_JDK`]. Prefers
/// `JAVA_HOME`, then CI hints (`JAVA_HOME_21_*`, set by GitHub/Namespace
/// runners), then a scan of common install roots. `None` falls back to a
/// `javac`/`jar` on `PATH`.
fn select_jdk_home() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(home) = env::var_os("JAVA_HOME") {
        candidates.push(PathBuf::from(home));
    }
    for var in [
        "JAVA_HOME_21_X64",
        "JAVA_HOME_21_ARM64",
        "JAVA_HOME_21_AARCH64",
    ] {
        if let Some(home) = env::var_os(var) {
            candidates.push(PathBuf::from(home));
        }
    }

    let mut roots = vec![
        PathBuf::from("/usr/lib/jvm"),
        PathBuf::from("/usr/java"),
        PathBuf::from("/opt/java"),
        PathBuf::from("/Library/Java/JavaVirtualMachines"),
    ];
    if let Some(home) = env::var_os("HOME") {
        roots.push(PathBuf::from(home).join(".sdkman/candidates/java"));
    }
    for root in roots {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        let mut dirs: Vec<PathBuf> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect();
        dirs.sort();
        for dir in dirs {
            // macOS bundles nest the runnable home under Contents/Home.
            let nested = dir.join("Contents/Home");
            candidates.push(if nested.is_dir() { nested } else { dir });
        }
    }

    candidates
        .into_iter()
        .find(|home| jdk_major(home).is_some_and(|major| major >= MIN_JDK))
}

/// Major feature version reported by the JDK's `javac`, if it runs.
fn jdk_major(home: &Path) -> Option<u32> {
    let javac = home
        .join("bin")
        .join(if cfg!(windows) { "javac.exe" } else { "javac" });
    if !javac.is_file() {
        return None;
    }
    let output = Command::new(&javac).arg("--version").output().ok()?;
    // `javac --version` prints to stdout on modern JDKs; tolerate stderr too.
    let text = if output.stdout.is_empty() {
        String::from_utf8_lossy(&output.stderr)
    } else {
        String::from_utf8_lossy(&output.stdout)
    };
    // e.g. "javac 21.0.2" -> 21; legacy "javac 1.8.0_292" -> 1 (rejected).
    let version = text.split_whitespace().nth(1)?;
    version.split(['.', '-', '+', '_']).next()?.parse().ok()
}

fn emit_rerun_paths(bridge: &Path) {
    for var in [
        "JAVA_HOME",
        "JAVA_HOME_21_X64",
        "JAVA_HOME_21_ARM64",
        "JAVA_HOME_21_AARCH64",
    ] {
        println!("cargo:rerun-if-env-changed={var}");
    }
    println!("cargo:rerun-if-changed={}", bridge.display());
}

fn reset_directory(path: &Path) {
    if path.exists() {
        fs::remove_dir_all(path).expect("remove stale bridge classes");
    }
    fs::create_dir_all(path).expect("create bridge classes directory");
}

fn collect_files(directory: &Path, extension: &str, output: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory).unwrap_or_else(|error| {
        panic!("read {}: {error}", directory.display());
    }) {
        let path = entry.expect("directory entry").path();
        if path.is_dir() {
            collect_files(&path, extension, output);
        } else if path.extension() == Some(OsStr::new(extension)) {
            output.push(path);
        }
    }
}

fn require_success(result: std::io::Result<Output>, action: &str, tool: &Path) -> Output {
    let output = result.unwrap_or_else(|error| {
        panic!(
            "failed to execute {} while trying to {action}: {error}",
            tool.display()
        );
    });
    if !output.status.success() {
        panic!(
            "failed to {action} with {}\nstdout:\n{}\nstderr:\n{}",
            tool.display(),
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
    output
}
