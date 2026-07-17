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

    let javac = java_tool("javac");
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

    let jar_tool = java_tool("jar");
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

fn java_tool(name: &str) -> PathBuf {
    let executable = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_owned()
    };
    env::var_os("JAVA_HOME")
        .map(PathBuf::from)
        .map(|home| home.join("bin").join(&executable))
        .filter(|path| path.is_file())
        .unwrap_or_else(|| PathBuf::from(executable))
}

fn emit_rerun_paths(bridge: &Path) {
    println!("cargo:rerun-if-env-changed=JAVA_HOME");
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
