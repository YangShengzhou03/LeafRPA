# 轻羽 RPA 设计规范

本文档约束 leaf-rpa 的视觉基调与 UI 编写规则。所有界面改动必须遵守本文档；新增颜色、圆角、阴影等设计值时，应先在 `src/style.css` 中定义 CSS 变量，再通过变量引用，禁止在组件里硬编码新的散落值。

## 0. 强制规则（违反即打回）

- **禁用 emoji**：界面文案、注释、日志、提示信息一律不得出现 emoji（pre-commit 有 `check:emoji` 校验）。
- **禁用 Element Plus 的 `small` 尺寸组件**：不得使用 `size="small"`（含 `el-button`、`el-input`、`el-tag`、`el-table` 等一切组件）；需要紧凑排版时通过间距变量调整，不缩小控件尺寸。默认尺寸为唯一基准。
- **必须使用 Element Plus 组件库**：按钮、输入框、下拉、单选、复选、开关、对话框、消息、标签、分页等一律使用 Element Plus 现成组件，**禁止手搓**（不得用原生 `<div>/<button>` + CSS 仿造控件）。Element Plus 已有的能力（含 `el-tooltip`、`el-empty`、`el-rate`、`el-pagination`）必须直接使用。
- 唯一例外：顶栏窗口控制、品牌区、拖拽热区等**无现成组件对应的纯装饰/窗口级元素**，以及画布、流程步骤列表等领域专属视图，允许自定义实现，但其中的控件（按钮、输入、确认框等）仍必须用 Element Plus。

## 1. 主题色基调

项目采用**红为主色、中性灰为骨架**的亮色主题，参照国内桌面效率工具的视觉习惯，整体气质：轻量、克制、亲和。

| 角色 | 变量 | 值 | 用途 |
| --- | --- | --- | --- |
| 主色（品牌红） | `--accent` | `#f53f3f` | 主按钮、选中态、链接、未读红点、危险强调 |
| 主色悬停 | `--accent-hover` | `#e03838` | 主色元素的 hover / active |
| 主色弱底 | `--accent-soft` | `#fff1f0` | 主色的浅色背景（选中行、强调底） |
| 页面底色 | `--bg` | `#ffffff` | 主内容区、卡片、输入框背景 |
| 面板底色 | `--panel` | `#f4f4f7` | 顶栏、侧边栏、次级面板、嵌套区块 |
| 悬停底色 | `--hover` | `#e9e9eb` | 列表项 / 按钮 hover 背景 |
| 描边 | `--border` | `#e8e8ea` | 卡片、输入框、分割线 |
| 主文本 | `--text` | `#1f2329` | 标题、正文 |
| 次级文本 | `--text-2` | `#646a73` | 描述、辅助说明 |
| 三级文本 | `--text-3` | `#8f959e` | 时间戳、占位符、弱化信息 |

### 品牌渐变（仅限 Ai 标识）

`linear-gradient(90deg, #5ab8ff 0%, #a05ff7 50%, #f74d87 100%)`

只在顶栏 `brand-tag`（Ai 标识）上使用，不得扩散到其他元素，以保持主色红的唯一性。

### 指令分类色（commands.ts）

指令节点与指令面板的分类色，已固定，不得随意更改：

| 分类 | 色值 |
| --- | --- |
| 网页自动化 | `#3b82f6` |
| 桌面自动化 | `#8b5cf6` |
| 数据处理 | `#10b981` |
| 控制流 | `#f59e0b` |
| 网络与通知 | `#0ea5e9` |
| Python | `#06b6d4` |
| 等待与录屏 | `#64748b` |

其他场景（教程封面、市场图标、头像底色等）可使用同明度区间的多彩色板：`#3b6fe0` `#22c55e` `#f97154` `#a05ff7` `#0ea5e9` `#ec4899` `#f59e0b` `#6366f1`，但同一视图中不宜超过 4 种彩色。

## 2. 圆角与阴影

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--radius` | `8px` | 卡片、弹窗内区块、面板 |
| （小圆角） | `4px ~ 6px` | 按钮、输入框、标签（跟随 Element Plus 或写 6px） |
| （胶囊） | `999px` | 分类筛选按钮、圆形标签 |
| `--shadow` | `0 2px 10px rgba(31,35,41,.06)` | 卡片静置 |
| `--shadow-lg` | `0 8px 24px rgba(31,35,41,.14)` | 浮层、hover 抬升、弹窗 |

阴影统一使用 `rgba(31, 35, 41, …)` 中性灰，不使用带色相的阴影。

## 3. 字体与字号

- 字体栈：`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif`（在 `body` 上统一设置，组件不再单独声明）。
- 基准字号 **13px**，正文与控件默认 13px。
- 层级：页面大标题 22px / 区块标题 16-17px / 卡片标题 14px / 正文 13px / 辅助与时间戳 12px / 极弱说明 11px。
- 字重：标题与关键值用 500，正文 400；本产品不使用 700 以上的重字重。

## 4. 布局与间距

- 顶栏高度固定 **64px**；主内容区左上角 10px 圆角衔接面板底色。
- 间距使用 4 的倍数：4 / 8 / 12 / 16 / 20 / 24。
- 卡片栅格（市场、教程等）使用 `card-grid` 统一样式；页面统一套用 `page` / `page-head` / `page-title` / `page-sub` 结构。
- 弹窗宽度惯例：小 400px、中 420~480px，不使用超过 600px 的对话框。

## 5. 组件约定

- **只使用 Element Plus 组件 + `@element-plus/icons-vue` 图标**，不引入其他 UI 库或图标库。
- 主按钮用 Element Plus `type="primary"`（Element Plus 主题已在 `style.css` 中对齐品牌红：`--el-color-primary` 系列变量）；次级操作用 `text` / `link` 按钮。
- 危险操作（删除、卸载）用 `type="danger"`，且必须带 `ElMessageBox.confirm` 确认。
- 操作反馈统一使用 `ElMessage`（成功 / 警告 / 失败），不使用 `alert`。
- 标签（tag）级别映射：入门→`success`、进阶→`primary`、实战→`warning`、类型标签→`info`，统一 `effect="light" round`。
- 空状态使用 `el-empty` 或统一的 `.empty` / `.canvas-empty` 样式，并给出下一步动作指引文案。
- 表格使用 `--el-table-border-color: var(--border)`、`--el-table-header-bg-color: var(--panel)` 对齐主题。

## 6. 交互细节

- 所有可点击元素必须有真实行为，禁止 no-op 与"开发中"占位；未实现的能力如实提示或隐藏。
- 文案不得虚构权益、承诺或联系方式；支持渠道一律指向开源仓库 Issue。
- 键盘可达：按钮用 `<button>`，列表项提供 `role="button"` + `tabindex` + Enter 键处理；画布支持 Delete 删除选中节点、Esc 取消选中。
- hover 反馈：列表项底色切到 `--hover`，卡片用 `--shadow-lg` 轻抬升，均需 150ms 左右过渡。
- 滚动条全局隐藏（`::-webkit-scrollbar { display: none }`），滚动区域需保证触控板 / 滚轮可用。

## 7. 新增设计值的流程

1. 确认现有变量不能满足需求；
2. 在 `src/style.css` 的 `:root` 中新增语义化变量（如 `--success: #22c55e`）；
3. 组件中只引用变量，不写裸值；
4. 同步更新本文档对应表格。
