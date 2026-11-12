<div align="center">

# 轻羽 RPA · leaf-rpa

**一个软件，把你从重复劳动里解放出来。纯本机运行，数据不出你的电脑。**

[![License: MIT](https://img.shields.io/badge/License-MIT-red?style=for-the-badge)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-FFC131?style=for-the-badge&logo=tauri&logoColor=000)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Element Plus](https://img.shields.io/badge/Element%20Plus-2-409EFF?style=for-the-badge&logo=elementplus&logoColor=white)](https://element-plus.org)
[![Platform-Windows](https://img.shields.io/badge/Platform-Windows-eeeeee?style=for-the-badge)](#系统要求)

</div>

---

## 你是否也有这样的烦恼

每天上班第一件事是打开五个网页后台，把报表数据从 A 系统复制到 B 系统，再对着表格点几百次鼠标。每周固定要把一批文件按日期归档、按规则重命名、把截图里的内容录入表格。这些活不需要动脑，却吃掉了你大量的时间。你想过自动化，但市面上的 RPA 软件要么按年收费动辄上千，要么必须把你的账号密码、网页数据上传到别人的云端，你敢用吗？

轻羽 RPA 就是为了这个而生的。

打开软件，用可视化设计器拖几个指令、连几条线，流程就搭好了。可以手动运行，可以定时触发，可以在浏览器里真实地点击、输入、抓取。流程保存在你自己的电脑上，随时导出成专有流程文件分享给别人。不需要写代码，不需要联网上传任何数据。

## 流程设计器

你不需要懂编程。流程设计器给你一块可视化画布，左边是指令面板，中间是流程画布，右边是属性配置。添加一个「打开网页」节点，再加一个「点击元素」节点，连线，一个自动化的雏形就有了。

节点自由拖拽摆放，连线决定执行顺序，右键即可复制、连线、删除。属性面板按指令定义自动生成表单，每个参数该填什么一目了然。还需要精细调整时，可以切到底部面板查看运行日志、页面元素和变量，随查随用。画布下方还有流程大纲，节点多了一目了然。

选择器不知道怎么填？内置元素抓取功能直接从页面上抓，选中元素自动生成 CSS / XPath 选择器，还能校验可用性后再插入流程。录制功能更直接：开启后在浏览器里照常操作，每一步点击都会自动转换成流程节点。

## 指令体系

内置覆盖 PC 自动化与网页自动化的完整指令库，从文件读写、HTTP 请求、JSON 解析，到浏览器点击、输入、抓取、标签页管理，全部以表驱动方式声明。新增一条指令只需要注册一个定义，设计器画布、属性面板、参数校验、运行器全部自动跟上，不需要改任何一行界面代码。

每个指令参数都有类型标注，文本、数字、布尔、下拉选项各自对应专属控件，非法参数在运行前就被拦截。

## 流程管理

新建、打开、保存、删除，全都在应用列表里完成。流程以 JSON 形式持久化在本机应用数据目录，编辑自动保存，防抖 900 毫秒，Ctrl+S 随时手动保存，顶部实时显示保存状态。Ctrl+Z / Ctrl+Y 撤销重做，误删节点不慌。

导出流程会生成轻羽 RPA 专有的 `.leafrpa` 流程文件，内置格式标识与版本号。你全程接触不到任何 JSON 代码：导出面板只显示流程名称、类型和节点数，点一下「保存文件」就得到一个可以发给同事的流程文件；对方在设计器里点「导入」，流程原样恢复。分享应用也是同一个格式，一条通道，全程无脑。

## 流程检查与运行

运行前一键体检：未连接的节点、空参数、非法数字、循环依赖（拓扑环检测）全部查出来，错误在运行前拦截，提醒用警告标签分级展示。

运行器按拓扑序执行节点，逐节点校验参数。日志输出、等待、变量设置、文本处理、JSON 解析、HTTP 请求（真实 fetch，支持超时与请求头）、打开系统浏览器等指令真实执行，网页操作通过 Chrome 插件真实落到页面上。运行日志实时滚动，变量面板同步显示流程产生的每一个变量，一键复制。

## 触发器

定时、循环、手动三种触发类型。每天早上八点抓一次数据、每小时同步一次文件、周末批量整理一次下载目录——设好触发器，到点自动跑。支持关联任意本地流程，一键「立即运行」测试，最近执行时间与当日执行次数都记录在案。

## 市场与社区

市场里分类浏览现成的自动化应用，搜索、查看详情、一键安装，装完直接跑。社区里有帖子流与热门排行，教程区有视频卡片与配套练习流程，学习进度自动保存。别人的流程装上就能用，别人的经验看一眼就会。

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

```
python/
  leafbot/          # Python SDK（http / file / flow / log）
  runner.py         # 执行宿主：stdin 读任务 → 执行 → stdout 回传
python-runtime/     # 内置 Python 运行时（setup-python 下载）
scripts/setup-python.mjs
```

## Chrome 网页自动化插件

网页自动化指令通过 Chrome 扩展真实执行（点击、输入、抓取、标签页管理等），不是模拟，是真的一步步在你的浏览器里操作。

**安装**：

1. Chrome 打开 `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选择 `plugin/leaf-extension`
2. 记下扩展 ID，填入 `plugin/native-host/com.leafrpa.browser.json` 的 `allowed_origins`，然后重新加载扩展
3. 执行注册脚本（当前用户，无需管理员）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File plugin/native-host/install-host.ps1
   ```
4. 重启 Chrome 生效

**工作原理**：扩展 service worker 通过 Chrome native messaging 拉起宿主 `leaf_host.py`，宿主独占 `127.0.0.1:19836` 提供 HTTP 接口，桌面端经该端口下发指令。宿主由 Chrome 生命周期管理，Chrome 退出时宿主随之退出；Chrome 110+ 中开放的 native 端口会让 SW 保持常驻，避免 MV3 service worker 被挂起导致指令无人消费。

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

## 为什么是轻羽 RPA

市面上有大量 RPA 软件，很多采用订阅制收费，一年上千块，授权还绑死在厂商云端。你的流程存在别人的服务器上，你的网页账号密码经过别人的网络，断网就罢工。界面臃肿，找一个功能要翻三层菜单，上手门槛高到需要报培训班。

轻羽 RPA 的差异化非常直接。流程数据全部保存在本机应用数据目录，导出导入用专有 `.leafrpa` 格式，点对点分享，不经过任何第三方。基于 Tauri 2 构建，利用系统原生 WebView，安装包体积小、内存占用低，老旧电脑也能流畅运行。指令全部表驱动声明，界面与运行器按定义自动生成，扩展一条指令就是注册一个对象，可持续维护性拉满。网页自动化走 Chrome 官方 native messaging 通道，真实操作你的浏览器，而非模拟点击。Python 节点支持真正的脚本执行，复杂逻辑兜底无忧。

## 技术架构

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Tauri 2（Rust），无边框窗口 + 自绘标题栏 |
| 前端框架 | Vue 3（`<script setup>`）+ Pinia |
| UI 组件 | Element Plus + @element-plus/icons-vue |
| 构建 | Vite（rolldown）+ TypeScript |
| 状态管理 | 单一 Pinia store，视图按 tab 切换（桌面单窗口场景，未引入路由） |

前端与 Rust 侧通过 `src/bridge.ts` 桥接层隔离：所有文件读写经由 Tauri command 完成，前端不直接接触文件系统；指令与节点类型全部集中在 `types.ts` / `commands.ts` 中声明，画布、属性面板、运行器均按定义驱动。

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

让每一个用户，零成本、零门槛拥有专业级流程自动化能力。
