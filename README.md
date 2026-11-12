<div align="center">

# 轻羽 RPA · leaf-rpa

**一个使用 Tauri 2 + Vue 3 构建的桌面 RPA 客户端**

从流程设计器到触发器、从市场到社区，一个完整的自动化工作台。

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883.svg)](https://vuejs.org)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org)
[![Element Plus](https://img.shields.io/badge/Element%20Plus-2.14-409EFF.svg)](https://element-plus.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vitejs.dev)

</div>

---

## 这是什么

轻羽 RPA（leaf-rpa）是一个 RPA（机器人流程自动化）桌面客户端。它用 Rust 与 Tauri 2 提供轻量、原生的工作窗口，用 Vue 3 与 Element Plus 构建全部界面：你可以在可视化设计器里通过拖拽指令、连线编排来自由组合自动化流程，把流程交给触发器定时执行，也可以在市场中发现并安装现成的自动化应用。

项目界面以桌面 RPA 客户端的经典形态为参照进行设计：无边框窗口、自绘标题栏、左侧应用导航与顶部多标签页，追求与商业产品一致的交互质感，同时保持代码的简洁与可维护。

## 功能特性

- **流程设计器**：可视化画布，自由拖拽节点、连线编排执行顺序，支持节点选中、删除、右键菜单（复制 / 连线 / 删除）、属性编辑与画布连线交互。
- **指令体系**：内置 PC / 手机自动化指令与自定义指令定义，全部以表驱动方式声明，新增指令只需注册一条定义。
- **流程管理**：新建、打开、保存、删除流程，流程以 JSON 形式持久化在本机应用数据目录；支持流程导入 / 导出（JSON 文件）与复制节点。
- **编辑体验**：编辑自动保存（防抖 900ms），Ctrl+S 手动保存，Ctrl+Z / Ctrl+Y 撤销重做，顶部实时显示保存状态。
- **流程检查**：一键检查未连接的节点、空参数、非法数字与循环依赖（拓扑环检测），并在运行前拦截错误。
- **运行器**：按拓扑序执行流程节点，逐节点校验参数合法性并输出运行日志；日志输出、等待、变量设置、文本处理、JSON 解析、HTTP 请求（真实 fetch，支持超时与请求头）与打开系统浏览器等指令会真实执行，其余指令为模拟执行。
- **变量面板**：运行日志旁提供变量页，实时查看流程产生的变量并可一键复制。
- **触发器**：支持定时、循环、手动三种触发类型，可关联本地流程、随时启停，支持一键"立即运行"并记录最近执行与当日执行次数；调度由应用在前台实时完成（关闭应用后不会触发）。
- **市场**：分类浏览与搜索自动化应用，应用详情弹窗，安装 / 卸载状态保存在本机。
- **社区 / 教程**：帖子流与热门排行，帖子正文详情抽屉（含点赞与本地回复），视频教程卡片与详情弹窗，学习进度本地持久化，支持一键创建配套练习流程。
- **工作台细节**：消息中心、帮助中心、设置（数据位置与统计、清空全部数据、关于）、社区支持入口、邀请好友，新建流程的鼠标跟随光影动效，全键盘可达的焦点样式。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Tauri 2（Rust），无边框窗口 + 自绘标题栏 |
| 前端框架 | Vue 3（`<script setup>`）+ Pinia 4 |
| UI 组件 | Element Plus 2 + @element-plus/icons-vue |
| 构建 | Vite 8（rolldown）+ TypeScript 5 |
| 状态管理 | 单一 Pinia store，视图按 tab 切换（桌面单窗口场景，未引入路由） |

前端与 Rust 侧通过 `src/bridge.ts` 桥接层隔离：所有文件读写经由 Tauri command 完成，前端不直接接触文件系统；指令与节点类型全部集中在 `types.ts` / `commands.ts` 中声明，画布、属性面板、运行器均按定义驱动。

## Python 应用开发

流程中的「Python代码」节点可以运行真正的 Python 脚本，调用内置 `leafbot` SDK 完成网络请求、文件读写等操作，并与其他节点共享流程变量。

```python
import leafbot

def main(args):
    # args 是当前流程变量的字典
    name = leafbot.flow.get_var("name", "world")
    # 发起真实 HTTP 请求
    result = leafbot.http.get("https://httpbin.org/get?n=" + name)
    # 回写流程变量
    leafbot.flow.set_var("status", result["status"])
    leafbot.log.info("请求完成，状态码 " + str(result["status"]))
    # 返回值写入节点的"返回值变量"
    return result["status"]
```

**SDK 域**：`leafbot.http`（GET / POST，支持请求头、请求体、超时）、`leafbot.file`（读写、存在性、列目录）、`leafbot.flow`（读写流程变量）、`leafbot.log`（输出运行日志）。

**运行时来源**（按优先级）：

1. 环境变量 `LEAF_RPA_PYTHON`
2. 内置打包运行时 `python-runtime/`（发布版自带）
3. 系统 `PATH` 中的 `python` / `python3`

发布版打包前执行 `npm run setup-python` 下载内置运行时；开发环境若未下载则自动回退系统 Python。

**目录结构**：

```
python/
  leafbot/          # Python SDK（http / file / flow / log）
  runner.py         # 执行宿主：stdin 读任务 → 执行 → stdout 回传
python-runtime/     # 内置 Python 运行时（setup-python 下载）
scripts/setup-python.mjs
```

## Chrome 网页自动化插件

网页自动化指令通过 Chrome 扩展真实执行（点击、输入、抓取、标签页管理等）。

**安装**：

1. Chrome 打开 `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选择 `plugin/leaf-extension`
2. 记下扩展 ID，填入 `plugin/native-host/com.leafrpa.browser.json` 的 `allowed_origins`，然后重新加载扩展
3. 执行注册脚本（当前用户，无需管理员）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File plugin/native-host/install-host.ps1
   ```
4. 重启 Chrome 生效

**工作原理**：扩展 service worker 通过 Chrome native messaging 拉起宿主 `leaf_host.py`，
宿主独占 `127.0.0.1:19836` 提供 HTTP 接口，桌面端经该端口下发指令。宿主由 Chrome 生命周期
管理，Chrome 退出时宿主随之退出；Chrome 110+ 中开放的 native 端口会让 SW 保持常驻，避免
MV3 service worker 被挂起导致指令无人消费。

```
桌面端 ──HTTP(19836)──▶ leaf_host.py ──native 管道──▶ 扩展 SW ──▶ content.js ──▶ 页面
```

> 插件未连接时，打开网页会自动拉起 Chrome；仍失败则回退到系统浏览器。详见 [plugin/README.md](plugin/README.md)。

## 快速开始

环境要求：Node.js ≥ 20、Rust（stable，含 MSVC 工具链，Windows 平台）。

```bash
# 克隆并安装依赖
git clone https://gitee.com/Yangshengzhou/leaf-rpa.git
cd leaf-rpa
npm install

# 以桌面应用方式启动开发环境
npm start

# 仅在浏览器中预览前端（无 Tauri 外壳）
npm run dev
```

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动桌面应用开发环境（`tauri dev`） |
| `npm run dev` | 启动 Vite 开发服务器（仅浏览器预览） |
| `npm run build` | 前端生产构建（`vite build`） |
| `npm run lint` | TypeScript 严格模式类型检查（`vue-tsc --noEmit --strict`） |
| `npm run lint:rust` | Rust 侧 Clippy 检查（all / pedantic / nursery） |
| `npm run build-pro` | 前端构建 + 打包生产可执行程序（`tauri build`） |
| `npm run setup-python` | 下载内置 Python 运行时到 `python-runtime/` |
| `npm run clean` | 清理 node_modules / dist / target |

> 提示：修改 `src-tauri/icons/` 下的应用图标后，需要重新执行 `npm run build-pro` 才会反映到可执行文件与任务栏图标上。

## 开发路线

- [ ] 流程运行器：补齐更多真实指令（网页抓取、元素定位等仍待接入）
- [ ] 触发器调度：改为常驻后台（Rust 侧调度），关闭窗口后仍可执行
- [ ] Element Plus 按需引入，消除打包体积告警
- [ ] 市场与社区数据接入真实后端

## 参与贡献

欢迎提交 Issue 与 Pull Request。提交前请确保：

```bash
npm run lint        # 前端类型检查通过
npm run lint:rust   # Rust Clippy 检查通过
npm run build       # 构建通过
```

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。
