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
    /// 是否注释掉该步骤（运行与调试时跳过）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
    /// 是否设置断点
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breakpoint: Option<bool>,
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

/// 应用级设置（持久化在默认数据目录下的 settings.json）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    /// 自定义数据根目录，空字符串表示使用系统默认位置
    pub data_root: String,
    /// 关闭按钮行为：exit 退出 / minimize 最小化 / tray 最小化到托盘
    pub close_action: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            data_root: String::new(),
            close_action: "exit".to_string(),
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json"))
}

/// 读取应用设置，文件缺失或损坏时返回默认值。
pub fn load_settings(app: &AppHandle) -> AppSettings {
    settings_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

fn default_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
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
    let root = data_root(app)?;
    Ok(root.join("flows"))
}

/// 数据根目录：自定义位置优先，否则使用系统默认应用数据目录。
fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let custom = load_settings(app).data_root;
    let trimmed = custom.trim();
    if trimmed.is_empty() {
        default_root(app)
    } else {
        Ok(PathBuf::from(trimmed))
    }
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

/// 返回数据根目录（自定义位置或系统默认位置）。
///
/// # Errors
///
/// 当无法获取应用数据目录时返回错误信息。
#[tauri::command]
pub fn data_dir(app: AppHandle) -> Result<String, String> {
    data_root(&app).map(|p| p.to_string_lossy().to_string())
}

/// 返回应用设置（数据根目录 + 关闭按钮行为）。
#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    load_settings(&app)
}

/// 设置关闭按钮行为（exit / minimize / tray）。
///
/// # Errors
///
/// 当行为值非法或写入设置文件失败时返回错误信息。
#[tauri::command]
pub fn set_close_action(app: AppHandle, action: String) -> Result<(), String> {
    if !matches!(action.as_str(), "exit" | "minimize" | "tray") {
        return Err(format!("无效的关闭行为: {action}"));
    }
    let mut settings = load_settings(&app);
    settings.close_action = action;
    save_settings(&app, &settings)
}

/// 更改数据根目录，并把已有流程文件迁移过去。传空字符串表示恢复默认位置。
///
/// # Errors
///
/// 当目录创建、文件迁移或设置写入失败时返回错误信息。
#[tauri::command]
pub fn set_data_root(app: AppHandle, path: String) -> Result<String, String> {
    let trimmed = path.trim().to_string();
    let mut settings = load_settings(&app);
    let old_dir = flows_dir(&app)?;
    settings.data_root = trimmed.clone();
    save_settings(&app, &settings)?;

    let new_dir = flows_dir(&app)?;
    if trimmed.is_empty() {
        return Ok(new_dir.to_string_lossy().to_string());
    }
    fs::create_dir_all(&new_dir).map_err(|e| e.to_string())?;
    // 迁移旧目录中的流程文件（复制成功后才删除原文件）
    if old_dir != new_dir && old_dir.exists() {
        let entries = fs::read_dir(&old_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let from = entry.path();
            if from.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let to = new_dir.join(entry.file_name());
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
            fs::remove_file(&from).map_err(|e| e.to_string())?;
        }
    }
    ensure_flows_dir(&app)?;
    Ok(new_dir.to_string_lossy().to_string())
}

/// 弹出系统目录选择对话框（独立线程执行，避免阻塞主线程）。
#[tauri::command(async)]
pub fn pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("选择数据存储位置")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

