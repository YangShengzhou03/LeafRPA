# CHANGELOG

## 迭代 4

### 市场评分与评论（端到端）

- 服务端：init-db.sql 新增 `market_app_ratings`（用户维度唯一去重，stars 1-5，重复打分即更新）与 `market_app_comments`（content 1-500 字，app_id 索引）两表，保持幂等建表风格；新增 `MarketFeedbackController` + `MarketFeedbackService`：`GET /api/market/apps/{id}/feedback`（平均分/评分人数/我的评分/评论倒序分页，未登录可看，myRating 为 null）、`POST|DELETE /api/market/apps/{id}/rating`（登录打分/撤销，返回最新汇总）、`POST /api/market/apps/{id}/comments`（登录发表）、`DELETE /api/market/apps/{id}/comments/{commentId}`（仅本人可删）；stars 与 content 服务端校验，非法参数统一 400。
- 桌面端：市场详情页新增「评分与评论」区——平均分 + 人数 + el-rate 打分（登录可打/改/撤销，未登录点打分行内提示），打分乐观更新并以服务端汇总回显；评论列表（作者/内容/相对时间，本人评论可删，超出 20 条可「查看更多」）与底部输入框（登录/空内容校验、发表 loading）；`api.ts` 补 `feedback/rate/removeRating/comment/removeComment`，i18n 新增 zh/en 词条各 21 条，全部文案走 `t('market.feedback.*')`。

### 桌面端

- 全面 i18n 化：TopBar、Sidebar、LoginView、HomeView、MarketView、CommunityView、TutorialView、TriggerView、ToolsPage、HelpPage、ServicePage、AppListView、BottomPanel、CommandPanel、CommandDialog、ElementEditor、FlowOutlinePanel、VariableInput、VariablePicker、CodeEditor 全部界面文案接入 `t()`，新增 zh/en 词条各 697 条；分类值（市场/社区/教程分类、触发器类型、问题类型）作为服务端参数保留中文原值，显示层经字典映射；帮助页 FAQ 与教程正文等教学内容暂保留中文。
- 设计器 i18n 收尾：DesignerView（工具栏/工具抽屉/调试栏/录制面板）、StepList（步骤行/删除确认/插入指令对话框）全部文案接入 `t()`；notify 默认标题、store 的设置失败/数据迁移/变量弹窗/流程检查/导入校验提示、触发器下次执行文案与执行通知同步接入；新增 zh/en 词条各 131 条，字典合计 989 条/语言且 key 双份一致；运行日志（`store.log`）与存储字段值（`lastRun:'从未'` 等）保留中文。

## 上线前体检与加固

### 服务端

- 并发计数加固：帖子点赞、市场应用安装/卸载、流程下载计数全部改为数据库原子自增（`@Modifying` UPDATE，配原生查询回读最新值），并发操作不再丢计数。
- 唯一键冲突（并发重复点赞/安装等）统一转 409「操作冲突，请刷新后重试」，不再返回 500。
- 登录失败统一提示「用户名或密码错误」，不再区分「账号不存在/密码错误」，避免暴露账号是否存在。
- 删除未使用代码：`MarketAppRepository` 两个无人调用的查询方法、`CommunityService.likedBy`、`MarketService.installedBy`、修改密码整条链路（`PUT /api/users/me/password` 接口、`UserProfileService.changePassword`、`ChangePasswordRequest`、`BCryptPasswordEncoder` 成员）、`LoginRequest` 的 `autoLogin`/`rememberPassword` 死字段、`PostLikeRepository.countByPostId`。

### 桌面端

- `SERVER_BASE` 支持构建期环境变量 `VITE_SERVER_BASE` 覆盖（默认 `http://192.168.65.101` 不变，`env.d.ts` 补充类型声明）。
- 删除未引用的 `userApi.profile`、`userApi.changePassword`（及随之无引用的 `UserProfile` 独立类型，并入 `UserProfileFull`）。

### Web 端（service/frontend）

- 401 统一处理：axios 响应拦截器清除本地会话并跳回登录页（与桌面端口径一致）；网络不可达/非 2xx 统一转中文错误提示。
- 登录/注册/重置密码：补充表单校验（手机号格式、密码长度、必填项）与提交 loading；登录/注册成功后自动跳回首页。
- 流程广场：列表加载失败提示与 v-loading、删除前二次确认、上传失败提示与 uploading 状态、仅 .leafrpa 校验前移；未登录点赞/回复/上传给出行内提示。
- 社区：发帖成功后按当前排序/筛选/分页重新加载列表；资料页加载失败显示空态文案。

### 部署

- docker-compose：mysql 补充 `restart: unless-stopped`；JWT 密钥覆盖说明注释与 README 风格对齐。
- init-db.sql 改为真幂等：移除 `DROP DATABASE`，改为 `CREATE DATABASE/TABLE IF NOT EXISTS` + 种子数据按唯一业务键 `WHERE NOT EXISTS` 去重，重跑不破坏已有数据；表结构与种子说明同步更新。
- tauri.conf.json：identifier 由 `com.leaf-rpa.desktop` 改为 `com.leafrpa.desktop`（连字符不兼容 macOS/iOS Bundle ID，上线前修正成本最低）。
- 已知待办（记录不阻塞上线）：注册/找回密码短信验证码未接入（现固定 123456）；tauri CSP 未配置（需与头像外联、插件端口联调后统一收紧）。
