# 轻羽RPA Chrome 插件（网页自动化）

Manifest V3 浏览器扩展，供轻羽RPA 桌面端驱动 Chrome 完成网页操作。

## 架构

```
轻羽RPA 桌面端 ──HTTP(127.0.0.1:19836)──▶ leaf_host.py（native 宿主）
                                            ▲  │ stdin/stdout = Chrome 命名管道
                                            │  ▼
                             Chrome 扩展 service-worker（native messaging）
                                            │
                                            ▼
                                  content.js（所有 frame）
                                            │
                                            ▼
                                        页面元素
```

**宿主由 Chrome 拉起**：扩展 SW 调用 `chrome.runtime.connectNative('com.leafrpa.browser')`，
Chrome 按注册表 `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.leafrpa.browser`
找到 `com.leafrpa.browser.json`，再由其中的 `path` 启动 `leaf_host.bat`。
宿主独占 `127.0.0.1:19836` 提供 HTTP 接口，桌面端通过该端口下发指令。

> 【注意】桌面端**不会**再自行启动宿主进程。若自行 spawn，会抢占 19836 端口，
> 导致 Chrome 的宿主绑定失败、native 管道断开，表现为「插件永远连不上」。

## 安装（首次使用）

1. Chrome 打开 `chrome://extensions` → 右上角开启「开发者模式」
2. 点击「加载已解压的扩展程序」→ 选择 `plugin/leaf-extension`
3. 记下扩展 ID（形如 `lgmllpehpgpjgnldlplldncljmmpdjhj`）
4. 修改 `plugin/native-host/com.leafrpa.browser.json` 的 `allowed_origins`，把
   扩展 ID 填进去（改动后回到 `chrome://extensions` 点一下「重新加载」）
5. 执行注册脚本（当前用户，无需管理员）：
   ```powershell
   powershell -ExecutionPolicy Bypass -File plugin/native-host/install-host.ps1
   ```
   脚本会检查扩展 ID 与清单是否一致。
6. 重启 Chrome（让 native messaging 宿主注册生效），打开任意网页测试。

## 目录结构

```
plugin/
├── leaf-extension/            # Chrome 扩展
│   ├── manifest.json          # MV3 清单：nativeMessaging/tabs/scripting 权限，全 frame 注入
│   ├── background/
│   │   └── service-worker.js  # native 端口连接/保活 + 指令路由（桌面端 ⇄ 标签页）
│   ├── content/
│   │   └── content.js         # 元素抓取（PICK）+ 动作执行 + 选择器生成
│   ├── popup/                 # 工具栏弹窗：连接状态 / 抓取元素 / 动作测试
│   └── icons/
└── native-host/
    ├── leaf_host.py           # 宿主：HTTP 服务 + native 管道桥（Chrome 拉起）
    ├── leaf_host.bat          # 启动器（解析 Python 路径后执行 leaf_host.py）
    ├── com.leafrpa.browser.json  # Native Messaging 清单（allowed_origins 填扩展 ID）
    └── install-host.ps1       # 注册表脚本（HKCU，无需管理员）
```

## HTTP 接口（leaf_host.py）

| 接口 | 说明 |
| --- | --- |
| `POST /exec` | 下发指令：`{type, payload, timeout?}`，经 native 管道推给扩展并等待结果 |
| `GET /status` | `{ok, connected, mode, queued}`（mode: native / pipe-only / http-only） |
| `GET /picked?since=<ts>` | 最近一次抓取的元素（桌面端轮询用） |

宿主日志：`%TEMP%\leaf-rpa-native-host.log`

## 支持的网页动作（content.js 指令）

| 指令 | 参数 | 说明 |
| --- | --- | --- |
| `leaf:pick-start` / `leaf:pick-stop` | - | 开启/关闭元素抓取模式（Esc 取消） |
| `leaf:click` | `{ selector, mode? }` | 点击元素（mouse 完整事件链 / js） |
| `leaf:input` | `{ selector, value, clear? }` | 输入文本（兼容 React 受控组件） |
| `leaf:get-text` | `{ selector }` | 读取文本 |
| `leaf:get-attribute` | `{ selector, attribute }` | 读取属性/value |
| `leaf:extract` | `{ selector }` | 提取元素信息 + 相似元素列表（≤50） |
| `leaf:exists` | `{ selector }` | 元素是否存在 |
| `leaf:select` | `{ selector, value }` | 下拉选择（按 value 或文本） |
| `leaf:press-key` | `{ key, selector? }` | 按键（Enter/Tab/方向键…） |
| `leaf:scroll-into-view` / `leaf:scroll` | - | 滚动 |
| `leaf:page-open` / `leaf:page-close` | `{ url }` / `{ tabId? }` | 标签页管理（SW 直接处理） |
| `leaf:page-list` / `leaf:page-activate` | - | 标签列表 / 聚焦窗口（SW 直接处理） |

选择器统一格式：`{ css?: string, xpath?: string, text?: string, tag?: string }`（按顺序匹配）。
抓取元素时自动生成 `cssSelector`（id 优先 + nth-of-type 路径）与 `xpath`；
元素位于 iframe 中时额外记录 `framePath`，执行阶段会先定位到对应 frame 再查找。

## 消息链路

```
桌面端 → POST /exec {type, payload}
      → 宿主经 native 管道推给扩展 SW
      → SW 路由：标签页级直接处理，其余转发 content.js
      → content.js 在页面执行并返回
      → SW 经 native 管道回传结果
      → 宿主唤醒等待中的 /exec 并返回给桌面端
```

元素抓取上报：content → SW → `chrome.storage.session.lastPicked` + 宿主 `/picked`。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 提示「未连接浏览器宿主」 | Chrome 是否已打开并启用了本扩展；扩展 ID 是否与清单 `allowed_origins` 一致；宿主日志 `%TEMP%\leaf-rpa-native-host.log` |
| 指令返回「未知指令」 | 扩展或宿主代码过旧，重新加载扩展并重启 Chrome |
| 抓取不到元素 | 页面是否在 iframe 内（跨域 iframe 不支持）；页面是否还在加载 |
| 多实例宿主抢占端口 | 桌面端不要自行启动 `leaf_host.py`；宿主已改为独占端口绑定，重复启动会自动降级 |
