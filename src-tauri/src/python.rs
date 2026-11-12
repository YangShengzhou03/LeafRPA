use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Manager};

/// Python 执行结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonResult {
    pub ok: bool,
    #[serde(default)]
    pub result: serde_json::Value,
    #[serde(default)]
    pub vars: serde_json::Value,
    #[serde(default)]
    pub logs: String,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct PythonJob {
    code: String,
    vars: serde_json::Value,
}

/// 在 PATH 中查找可执行文件。
fn find_in_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            let exe = dir.join(format!("{name}.exe"));
            if exe.is_file() {
                return Some(exe);
            }
        }
    }
    None
}

/// 在项目根目录下查找相对路径（开发模式优先使用源码，避免资源拷贝过期）。
fn find_in_project(relative: &str) -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    for base in [cwd.clone(), cwd.join(".."), cwd.join("../..")] {
        let p = base.join(relative);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// 定位 Python 解释器：环境变量 → 内置运行时 → 系统 PATH。
fn find_python(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("LEAF_RPA_PYTHON") {
        let p = PathBuf::from(p);
        if p.exists() {
            return Ok(p);
        }
    }
    // 开发模式优先使用项目源码目录
    if cfg!(dev) {
        for rel in ["python-runtime/python.exe", "python-runtime/bin/python3"] {
            if let Some(p) = find_in_project(rel) {
                return Ok(p);
            }
        }
    }
    if let Ok(dir) = app.path().resource_dir() {
        let candidates = [
            dir.join("python-runtime").join("python.exe"),
            dir.join("python-runtime").join("python3.exe"),
            dir.join("python-runtime").join("bin").join("python3"),
            dir.join("python-runtime").join("bin").join("python"),
        ];
        for c in candidates {
            if c.exists() {
                return Ok(c);
            }
        }
    }
    if let Some(p) = find_in_project("python-runtime/python.exe") {
        return Ok(p);
    }
    for name in ["python", "python3", "py"] {
        if let Some(p) = find_in_path(name) {
            return Ok(p);
        }
    }
    Err("未找到 Python 解释器。请安装 Python，或设置 LEAF_RPA_PYTHON 环境变量。".to_string())
}

/// 定位 runner.py：源码目录 → 打包资源。
fn find_runner(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(p) = find_in_project("python/runner.py") {
        return Ok(p);
    }
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("python").join("runner.py");
        if p.exists() {
            return Ok(p);
        }
    }
    Err("未找到 python/runner.py，请确认 Python SDK 目录存在。".to_string())
}

/// 定位浏览器宿主脚本：打包资源 → 项目目录。
/// 兼容旧版本调用；当前宿主由 Chrome 经 native messaging 拉起，桌面端不再自行启动。
#[allow(dead_code)]
fn find_host_script(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(p) = find_in_project("plugin/native-host/leaf_host.py") {
        return Ok(p);
    }
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("plugin").join("native-host").join("leaf_host.py");
        if p.exists() {
            return Ok(p);
        }
    }
    Err("未找到 plugin/native-host/leaf_host.py".to_string())
}

/// 启动 Chrome（带插件的默认 profile）。用于插件未连接时自动拉起浏览器。
///
/// # Errors
///
/// 当找不到 Chrome 可执行文件或进程启动失败时返回错误信息。
#[tauri::command]
pub fn launch_chrome() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            std::env::var_os("ProgramFiles").map(|p| PathBuf::from(p).join("Google\\Chrome\\Application\\chrome.exe")),
            std::env::var_os("ProgramFiles(x86)")
                .map(|p| PathBuf::from(p).join("Google\\Chrome\\Application\\chrome.exe")),
            std::env::var_os("LOCALAPPDATA")
                .map(|p| PathBuf::from(p).join("Google\\Chrome\\Application\\chrome.exe")),
        ];
        let chrome = candidates.into_iter().flatten().find(|p| p.is_file());
        let chrome = chrome.ok_or_else(|| {
            "未找到 Chrome。请安装 Google Chrome，并在 chrome://extensions 中加载 plugin/leaf-extension 扩展。".to_string()
        })?;
        // 不加 --load-extension：使用用户默认 profile，扩展早已安装；
        // 首次使用请手动加载扩展（见 plugin/README.md）。
        std::process::Command::new(chrome)
            .arg("about:blank")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("启动 Chrome 失败: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Google Chrome", "about:blank"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("启动 Chrome 失败: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("google-chrome")
            .arg("about:blank")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("启动 Chrome 失败: {e}"))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    Err("不支持的操作系统".to_string())
}

/// 运行一段 Python 代码并返回结果。
///
/// # Errors
///
/// 当解释器缺失、进程启动失败、执行超时或结果解析失败时返回错误信息。
#[tauri::command]
pub async fn run_python_code(
    app: AppHandle,
    code: String,
    vars: serde_json::Value,
    timeout_secs: Option<u64>,
) -> Result<PythonResult, String> {
    let python = find_python(&app)?;
    let runner = find_runner(&app)?;
    let job = PythonJob { code, vars };
    let input = serde_json::to_string(&job).map_err(|e| e.to_string())? + "\n";
    let timeout = std::time::Duration::from_secs(timeout_secs.unwrap_or(120));

    let mut child = tokio::process::Command::new(&python)
        .arg(&runner)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("启动 Python 失败: {e}"))?;

    {
        use tokio::io::AsyncWriteExt;
        let mut stdin = child.stdin.take().ok_or("无法打开 Python stdin")?;
        stdin
            .write_all(input.as_bytes())
            .await
            .map_err(|e| format!("写入 Python 任务失败: {e}"))?;
    }

    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| format!("Python 执行超时（{} 秒）", timeout.as_secs()))?
        .map_err(|e| format!("等待 Python 进程失败: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let line = stdout
        .lines()
        .last()
        .ok_or("Python 未返回任何结果")?;
    let mut result: PythonResult =
        serde_json::from_str(line).map_err(|e| format!("解析 Python 结果失败: {e}"))?;

    if !stderr.trim().is_empty() {
        result.logs = if result.logs.is_empty() {
            stderr.to_string()
        } else {
            format!("{}\n{}", result.logs, stderr)
        };
    }
    Ok(result)
}
