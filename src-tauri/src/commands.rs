use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub props: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub id: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub flow_type: String,
    #[serde(rename = "createdAt")]
    pub created_at: f64,
    #[serde(rename = "updatedAt")]
    pub updated_at: f64,
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowMeta {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub flow_type: String,
    #[serde(rename = "createdAt")]
    pub created_at: f64,
    #[serde(rename = "updatedAt")]
    pub updated_at: f64,
}

impl From<Flow> for FlowMeta {
    fn from(flow: Flow) -> Self {
        Self {
            id: flow.id,
            name: flow.name,
            flow_type: flow.flow_type,
            created_at: flow.created_at,
            updated_at: flow.updated_at,
        }
    }
}

/// 确保流程存储目录存在。
///
/// # Errors
///
/// 当无法获取应用数据目录或创建目录失败时返回错误信息。
pub fn ensure_flows_dir(app: &AppHandle) -> Result<(), String> {
    let dir = flows_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(())
}

fn flows_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("flows"))
}

fn flow_path(dir: &Path, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err(format!("非法的流程 ID: {id}"));
    }
    Ok(dir.join(format!("{id}.json")))
}

fn now_millis() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0.0, |d| d.as_secs_f64() * 1000.0)
}

fn now_millis_u128() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis())
}

fn new_id(prefix: &str) -> String {
    let now = now_millis_u128();
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.subsec_nanos());
    format!("{prefix}{now}{seed}")
}

/// 列出全部流程元信息，按更新时间倒序。
///
/// # Errors
///
/// 当读取流程目录或解析流程文件失败时返回错误信息。
#[tauri::command]
pub fn list_flows(app: AppHandle) -> Result<Vec<FlowMeta>, String> {
    ensure_flows_dir(&app)?;
    let dir = flows_dir(&app)?;
    let mut metas: Vec<FlowMeta> = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let flow: Flow = serde_json::from_str(&text).map_err(|e| e.to_string())?;
        metas.push(flow.into());
    }
    metas.sort_by(|a, b| {
        b.updated_at
            .partial_cmp(&a.updated_at)
            .unwrap_or(Ordering::Equal)
    });
    Ok(metas)
}

/// 读取指定 ID 的流程。
///
/// # Errors
///
/// 当 ID 非法、文件不存在或解析失败时返回错误信息。
#[tauri::command]
pub fn read_flow(app: AppHandle, id: String) -> Result<Flow, String> {
    let dir = flows_dir(&app)?;
    let path = flow_path(&dir, &id)?;
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

/// 保存流程并返回其元信息。
///
/// # Errors
///
/// 当序列化或写入文件失败时返回错误信息。
#[tauri::command]
pub fn write_flow(app: AppHandle, flow: Flow) -> Result<FlowMeta, String> {
    ensure_flows_dir(&app)?;
    let dir = flows_dir(&app)?;
    let path = flow_path(&dir, &flow.id)?;
    let text = serde_json::to_string_pretty(&flow).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(flow.into())
}

/// 新建空白流程。
///
/// # Errors
///
/// 当创建目录或写入文件失败时返回错误信息。
#[tauri::command]
pub fn create_flow(app: AppHandle, name: String, flow_type: String) -> Result<FlowMeta, String> {
    ensure_flows_dir(&app)?;
    let now = now_millis();
    let flow = Flow {
        id: new_id("flow_"),
        name,
        flow_type,
        created_at: now,
        updated_at: now,
        nodes: Vec::new(),
        edges: Vec::new(),
    };
    write_flow(app, flow)
}

/// 删除指定 ID 的流程文件，文件不存在时视为成功。
///
/// # Errors
///
/// 当 ID 非法或删除文件失败时返回错误信息。
#[tauri::command]
pub fn delete_flow(app: AppHandle, id: String) -> Result<(), String> {
    let dir = flows_dir(&app)?;
    let path = flow_path(&dir, &id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 使用系统默认浏览器打开网址。
///
/// # Errors
///
/// 当网址不是 http/https、长度不足或系统命令执行失败时返回错误信息。
#[tauri::command]
pub fn open_in_browser(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    let ok = trimmed.starts_with("http://") || trimmed.starts_with("https://");
    if !ok || trimmed.len() < 8 {
        return Err("仅支持 http/https 网址".to_string());
    }
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("cmd")
        .args(["/C", "start", "", trimmed])
        .status();
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open").arg(trimmed).status();
    #[cfg(target_os = "linux")]
    let status = std::process::Command::new("xdg-open").arg(trimmed).status();
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let status = Err(std::io::Error::other("不支持的操作系统"));
    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(_) => Err("打开浏览器失败".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

/// 返回应用数据目录（流程文件保存位置）。
///
/// # Errors
///
/// 当无法获取应用数据目录时返回错误信息。
#[tauri::command]
pub fn data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

