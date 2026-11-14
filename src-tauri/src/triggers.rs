//! 触发器：持久化配置 + 常驻后台调度。
//!
//! 触发器列表由前端维护（增删改后调用 [`save_triggers`] 全量同步），
//! Rust 侧持久化到数据目录下的 `triggers.json`，并由常驻线程每 5 秒检查一次到期情况，
//! 到期时通过 `trigger-due` 事件通知前端执行关联流程。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Trigger {
    pub id: String,
    pub name: String,
    /// 定时触发 / 循环触发 / 手动触发
    pub kind: String,
    /// 关联流程名（兼容旧数据）
    pub flow: String,
    /// 关联流程 ID（优先使用）
    pub flow_id: String,
    pub enabled: bool,
    /// 定时触发的执行时间 HH:mm
    pub time: String,
    /// 循环触发的间隔秒数
    pub interval: u64,
    /// 上次执行时间标签
    pub last_run: String,
    /// 上次执行时间戳（毫秒）
    pub last_run_at: u64,
}

impl Default for Trigger {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            kind: "定时触发".to_string(),
            flow: String::new(),
            flow_id: String::new(),
            enabled: true,
            time: "09:00".to_string(),
            interval: 60,
            last_run: "从未".to_string(),
            last_run_at: 0,
        }
    }
}

fn triggers_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = data_root(app)?;
    Ok(root.join("triggers.json"))
}

/// 数据根目录：与流程存储保持一致（自定义位置优先）。
fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let custom = crate::commands::load_settings(app).data_root;
    let trimmed = custom.trim().to_string();
    if trimmed.is_empty() {
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())
            .map(|p| p.join("flows"))
    } else {
        Ok(PathBuf::from(trimmed).join("flows"))
    }
}

/// 读写锁：串行化触发器文件的读改写，避免调度线程与保存命令互相覆盖。
static TRIGGER_LOCK: Mutex<()> = Mutex::new(());

fn read_triggers(path: &PathBuf) -> Vec<Trigger> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_triggers(path: &PathBuf, triggers: &[Trigger]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(triggers).map_err(|e| e.to_string())?;
    std::fs::write(path, text).map_err(|e| e.to_string())
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(0))
}

/// 读取全部触发器。
///
/// # Errors
///
/// 当无法获取数据目录时返回错误信息。
#[tauri::command]
pub fn get_triggers(app: AppHandle) -> Result<Vec<Trigger>, String> {
    let path = triggers_path(&app)?;
    let _guard = TRIGGER_LOCK.lock().map_err(|e| e.to_string())?;
    Ok(read_triggers(&path))
}

/// 全量保存触发器（前端增删改后调用）。
///
/// # Errors
///
/// 当无法获取数据目录或写入文件失败时返回错误信息。
#[tauri::command]
pub fn save_triggers(app: AppHandle, triggers: Vec<Trigger>) -> Result<(), String> {
    let path = triggers_path(&app)?;
    let _guard = TRIGGER_LOCK.lock().map_err(|e| e.to_string())?;
    write_triggers(&path, &triggers)
}

/// 判断定时触发是否到期：HH:mm 匹配且距上次执行超过 60 秒（避免同一分钟重复触发）。
fn timed_due(t: &Trigger, hhmm: &str, now: u64) -> bool {
    if t.time != hhmm {
        return false;
    }
    now.saturating_sub(t.last_run_at) >= 60_000
}

/// 判断循环触发是否到期：距上次执行超过间隔秒数。
const fn loop_due(t: &Trigger, now: u64) -> bool {
    let base = if t.last_run_at > 0 { t.last_run_at } else { 0 };
    now.saturating_sub(base) >= t.interval.saturating_mul(1000)
}

/// 常驻调度线程：每 5 秒扫描一次触发器，到期时更新状态并向前端发事件。
fn spawn_scheduler(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(5));
        let Ok(path) = triggers_path(&app) else { continue };
        let due: Vec<Trigger> = {
            let Ok(_guard) = TRIGGER_LOCK.lock() else { continue };
            let list = read_triggers(&path);
            if list.is_empty() {
                continue;
            }
            let now = now_millis();
            let local = now_local_hhmm();
            let due: Vec<Trigger> = list
                .iter()
                .filter(|t| {
                    if !t.enabled || t.kind == "手动触发" {
                        return false;
                    }
                    if t.kind == "定时触发" {
                        timed_due(t, &local, now)
                    } else {
                        loop_due(t, now)
                    }
                })
                .cloned()
                .collect();
            if due.is_empty() {
                continue;
            }
            // 先落盘 lastRunAt，再发事件，保证重启后不重复触发
            let mut updated = list;
            for t in &mut updated {
                if due.iter().any(|d| d.id == t.id) {
                    t.last_run_at = now;
                    if t.last_run.is_empty() || t.last_run == "从未" {
                        t.last_run = now_local_label();
                    }
                }
            }
            if write_triggers(&path, &updated).is_err() {
                continue;
            }
            due
        };
        for t in due {
            if app.emit("trigger-due", &t).is_err() {
                break;
            }
        }
    });
}

/// 本地时间 HH:mm：UTC 秒 + 时区偏移推算（时区偏移由前端启动时上报）。
fn local_secs() -> u64 {
    let secs = i64::try_from(now_millis() / 1000).unwrap_or(0) + tz_offset_secs();
    u64::try_from(secs.rem_euclid(86_400)).unwrap_or(0)
}

fn now_local_hhmm() -> String {
    let day_secs = local_secs();
    format!("{:02}:{:02}", day_secs / 3600, (day_secs % 3600) / 60)
}

fn now_local_label() -> String {
    let day_secs = local_secs();
    format!(
        "{:02}:{:02}:{:02}",
        day_secs / 3600,
        (day_secs % 3600) / 60,
        day_secs % 60
    )
}

/// 时区偏移（秒），由前端启动时通过 `set_tz_offset` 命令写入。
static TZ_OFFSET_SECS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

fn tz_offset_secs() -> i64 {
    TZ_OFFSET_SECS.load(std::sync::atomic::Ordering::Relaxed)
}

/// 前端启动时上报本地时区偏移（分钟，Date.getTimezoneOffset 的相反数）。
///
/// # Errors
///
/// 总是返回 Ok。
#[tauri::command]
pub fn set_tz_offset(offset_minutes: i64) -> Result<(), String> {
    TZ_OFFSET_SECS.store(offset_minutes * 60, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

/// 在应用启动时启动调度线程。
pub fn start(app: &AppHandle) {
    spawn_scheduler(app.clone());
}
