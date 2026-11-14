-- ============================================================
-- 轻羽 RPA 服务端建库脚本（唯一建表入口）
-- 幂等脚本：可重复执行；已存在的库 / 表 / 种子数据一律跳过，
-- 不会删除或覆盖任何已有数据（升级表结构请另行编写迁移脚本）。
-- 服务端 JPA 配置为 ddl-auto: none，不做任何建表/改表操作，
-- 数据库结构与初始数据完全由本脚本管理。
--
-- 表清单：
--   1. users            用户账号（注册 / 登录 / 找回密码）
--   2. market_apps      市场应用（含真实安装计数）
--   3. posts            社区帖子
--   4. post_replies     帖子回复（随帖子级联删除）
--   5. post_likes       帖子点赞记录（用户维度去重）
--   6. market_installs  市场应用安装记录（用户维度去重）
--   7. shared_flows     分享流程元数据（文件本体存服务端磁盘）
--   8. market_app_ratings    市场应用评分（用户维度去重，1-5 星）
--   9. market_app_comments   市场应用评论
-- ============================================================

CREATE DATABASE IF NOT EXISTS leaf_rpa
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE leaf_rpa;

CREATE USER IF NOT EXISTS 'leaf'@'%' IDENTIFIED BY 'leaf_rpa_dev';
GRANT ALL PRIVILEGES ON leaf_rpa.* TO 'leaf'@'%';
FLUSH PRIVILEGES;

-- ------------------------------------------------------------
-- 用户表（账号体系）
-- 注册接口写入；密码仅存 BCrypt 哈希，永不回传明文。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(32)  NOT NULL COMMENT '用户名',
    phone         VARCHAR(11)  NOT NULL COMMENT '手机号（找回密码凭证）',
    password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt 密码哈希',
    nickname      VARCHAR(32)  NULL COMMENT '昵称（展示名，空则用用户名）',
    email         VARCHAR(64)  NULL COMMENT '邮箱',
    gender        VARCHAR(8)   NOT NULL DEFAULT 'unknown' COMMENT '性别：unknown/male/female',
    signature     VARCHAR(128) NULL COMMENT '个性签名',
    avatar_url    VARCHAR(255) NULL COMMENT '头像图片 URL（用户自定义，空则显示用户名首字默认头像）',
    created_at    DATETIME(6)  NOT NULL COMMENT '注册时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    UNIQUE KEY uk_users_phone (phone),
    UNIQUE KEY uk_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '用户账号';

-- ------------------------------------------------------------
-- 市场应用表
-- installs 为真实安装计数（安装 +1 / 卸载 -1，最低 0）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_apps (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(64)  NOT NULL COMMENT '应用名称',
    description VARCHAR(255) NOT NULL COMMENT '应用描述',
    category    VARCHAR(32)  NOT NULL COMMENT '分类',
    installs    BIGINT       NOT NULL DEFAULT 0 COMMENT '真实安装计数',
    color       VARCHAR(9)   NOT NULL COMMENT '卡片主色，如 #3b6fe0',
    created_at  DATETIME(6)  NOT NULL COMMENT '上架时间',
    PRIMARY KEY (id),
    KEY idx_market_apps_category (category),
    KEY idx_market_apps_installs (installs)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '市场应用';

-- ------------------------------------------------------------
-- 社区帖子表
-- content 为长文本（TEXT）；likes 为点赞计数（post_likes 表做用户维度去重）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    author     VARCHAR(32)  NOT NULL COMMENT '作者用户名',
    title      VARCHAR(120) NOT NULL COMMENT '标题',
    content    TEXT         NOT NULL COMMENT '正文',
    likes      BIGINT       NOT NULL DEFAULT 0 COMMENT '点赞数',
    created_at DATETIME(6)  NOT NULL COMMENT '发布时间',
    category   VARCHAR(32)  NOT NULL DEFAULT '经验分享' COMMENT '帖子分类',
    PRIMARY KEY (id),
    KEY idx_posts_created (created_at),
    KEY idx_posts_likes (likes)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '社区帖子';

-- ------------------------------------------------------------
-- 帖子回复表
-- 随所属帖子级联删除（ON DELETE CASCADE）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_replies (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    post_id    BIGINT      NOT NULL COMMENT '所属帖子 id',
    author     VARCHAR(32) NOT NULL COMMENT '回复者用户名',
    content    TEXT        NOT NULL COMMENT '回复内容',
    created_at DATETIME(6) NOT NULL COMMENT '回复时间',
    PRIMARY KEY (id),
    KEY idx_post_replies_post (post_id),
    CONSTRAINT fk_post_replies_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '帖子回复';

-- ------------------------------------------------------------
-- 帖子点赞记录表
-- 同一用户对同一帖子仅一条记录（唯一键去重），点赞/取消即增删记录。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_likes (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL COMMENT '点赞用户 id（users.id）',
    post_id    BIGINT      NOT NULL COMMENT '帖子 id（posts.id）',
    created_at DATETIME(6) NOT NULL COMMENT '点赞时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_post_likes_user_post (user_id, post_id),
    KEY idx_post_likes_post (post_id),
    CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '帖子点赞记录';

-- ------------------------------------------------------------
-- 市场应用安装记录表
-- 同一用户对同一应用仅一条记录（唯一键去重），安装/卸载即增删记录。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_installs (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL COMMENT '安装用户 id（users.id）',
    app_id     BIGINT      NOT NULL COMMENT '应用 id（market_apps.id）',
    created_at DATETIME(6) NOT NULL COMMENT '安装时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_installs_user_app (user_id, app_id),
    KEY idx_market_installs_app (app_id),
    CONSTRAINT fk_market_installs_app FOREIGN KEY (app_id) REFERENCES market_apps (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '市场应用安装记录';

-- ------------------------------------------------------------
-- 分享流程表（.leafrpa 文件元数据；文件本体存服务端磁盘）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_flows (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    author      VARCHAR(32)  NOT NULL COMMENT '作者用户名',
    name        VARCHAR(120) NOT NULL COMMENT '流程名称',
    description VARCHAR(255) NULL COMMENT '流程描述',
    node_count  INT          NOT NULL DEFAULT 0 COMMENT '节点数',
    file_name   VARCHAR(64)  NOT NULL COMMENT '服务端存储文件名（UUID.leafrpa）',
    downloads   BIGINT       NOT NULL DEFAULT 0 COMMENT '下载计数',
    created_at  DATETIME(6)  NOT NULL COMMENT '上传时间',
    PRIMARY KEY (id),
    KEY idx_shared_flows_created (created_at),
    KEY idx_shared_flows_downloads (downloads)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '分享流程元数据';

-- ------------------------------------------------------------
-- 市场应用评分表
-- 同一用户对同一应用仅一条记录（唯一键去重），重复打分即更新该行；
-- stars 取值 1-5，刻意不用 TINYINT(1)（Connector/J 默认按布尔解析）。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_app_ratings (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    app_id     BIGINT      NOT NULL COMMENT '应用 id（market_apps.id）',
    user_id    BIGINT      NOT NULL COMMENT '评分用户 id（users.id）',
    stars      TINYINT     NOT NULL COMMENT '星级 1-5',
    created_at DATETIME(6) NOT NULL COMMENT '首次评分时间',
    updated_at DATETIME(6) NOT NULL COMMENT '最近评分时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_app_ratings_user_app (user_id, app_id),
    KEY idx_market_app_ratings_app (app_id),
    CONSTRAINT fk_market_app_ratings_app FOREIGN KEY (app_id) REFERENCES market_apps (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '市场应用评分';

-- ------------------------------------------------------------
-- 市场应用评论表
-- user_id 与 users 逻辑关联；仅本人可删，删除应用时随级联清理。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_app_comments (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    app_id     BIGINT       NOT NULL COMMENT '应用 id（market_apps.id）',
    user_id    BIGINT       NOT NULL COMMENT '评论用户 id（users.id）',
    content    VARCHAR(500) NOT NULL COMMENT '评论内容（1-500 字）',
    created_at DATETIME(6)  NOT NULL COMMENT '评论时间',
    PRIMARY KEY (id),
    KEY idx_market_app_comments_app (app_id),
    CONSTRAINT fk_market_app_comments_app FOREIGN KEY (app_id) REFERENCES market_apps (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = '市场应用评论';

-- ============================================================
-- 初始数据（幂等：按唯一业务键去重，已存在则跳过）
-- 说明：
--   1. 市场应用与后端 MarketSeeder 保持一致；Seeder 启动时
--      检测表非空即跳过，两侧互不冲突。
--   2. 用户表不预置账号，账号一律通过注册接口创建
--      （密码哈希由后端 BCryptPasswordEncoder 生成）。
-- ============================================================

-- 市场应用（与前端 marketApps.ts 目录一致，按应用名去重）
INSERT INTO market_apps (name, description, category, installs, color, created_at)
SELECT s.name, s.description, s.category, s.installs, s.color, NOW(6)
FROM (
    SELECT '网页数据抓取'     AS name, '批量采集网页表格、列表与详情页数据' AS description, '数据采集'   AS category, 126000 AS installs, '#3b6fe0' AS color
    UNION ALL SELECT 'Excel 批量处理',   '多表合并、清洗、汇总与格式转换',     '办公自动化', 98000, '#22c55e'
    UNION ALL SELECT '电商订单同步',     '订单自动下载、发货与库存回写',       '电商运营',   72000, '#f97154'
    UNION ALL SELECT '发票识别录入',     'OCR 识别发票信息并自动写入财务系统', '财务税务',   54000, '#a05ff7'
    UNION ALL SELECT '企业微信消息推送', '定时向群聊或客户发送通知与报表',     '办公自动化', 49000, '#0ea5e9'
    UNION ALL SELECT '数据库定时备份',   '按计划备份 MySQL / SQL Server 数据库', '开发工具',  31000, '#6366f1'
    UNION ALL SELECT '招聘网站简历收集', '自动筛选并下载符合条件的候选人简历', '数据采集',   28000, '#ec4899'
    UNION ALL SELECT '报销单自动审核',   '校验发票真伪与报销规则并生成台账',   '财务税务',   23000, '#f59e0b'
) AS s
WHERE NOT EXISTS (SELECT 1 FROM market_apps m WHERE m.name = s.name);

-- 社区示例帖子（按标题去重）
INSERT INTO posts (author, title, content, likes, created_at, category)
SELECT s.author, s.title, s.content, s.likes, NOW(6), s.category
FROM (
    SELECT '轻羽官方' AS author,
           '用轻羽RPA 搭建电商自动上架流程的完整实践' AS title,
           '做电商的朋友应该都懂：商品上架是最耗时却最重复的环节。今天要上架一个 SKU，往往要在 6 个平台分别登录、填表、传图、设置库存，一套流程走下来半小时就没了。\n我的思路是把整个上架拆成三段：采集、转换、发布。采集段用「网页数据抓取」把商品信息从源头页面拉下来；转换段用「数据处理」指令做字段映射和格式清洗；发布段按平台分别建立子流程，用「网页自动化」逐项填写并提交。\n实际跑下来，单 SKU 上架时间从 30 分钟压缩到 2 分钟，而且夜间可以挂着批量跑。' AS content,
           328 AS likes, '经验分享' AS category
    UNION ALL SELECT '轻羽官方',
           '定时触发器不执行？常见排查思路汇总',
           '第一，检查电脑是否休眠或关机。定时触发依赖客户端进程在后台运行，如果电脑睡眠或者客户端被关闭，触发自然不会执行。\n第二，检查触发器的时间设置。特别注意时区问题，很多同学设置的时间是本地时间，但系统按 UTC 解析，导致实际触发时间差了 8 小时。\n第三，检查关联流程是否存在且可运行。如果流程被删除或者流程本身有未处理的异常，触发器会静默跳过。',
           96, '问题求助'
    UNION ALL SELECT '轻羽官方',
           '轻羽RPA 服务端使用指南：市场、社区与流程分享',
           '市场：在「应用市场」页浏览各行业自动化应用，点击安装即可加入本地应用列表，安装计数实时同步服务端。\n社区：在「社区」页发布经验帖、回复他人、为优质内容点赞，内容保存在服务端，换设备登录也不丢失。\n流程分享：在设计器中导出 .leafrpa 文件后上传到「流程广场」，其他用户可直接下载导入，上传者可随时删除自己的分享。',
           54, '版本更新'
) AS s
WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.title = s.title);

-- 示例回复（挂在标题匹配的示例帖子下；按帖子 + 作者 + 内容去重）
INSERT INTO post_replies (post_id, author, content, created_at)
SELECT t.post_id, '轻羽官方', t.content, NOW(6)
FROM (
    SELECT p.id AS post_id,
           '感谢分享！补充一点：发布段的子流程建议按平台拆分维护，平台改版时只需要更新对应子流程。' AS content
    FROM posts p WHERE p.title LIKE '用轻羽RPA 搭建电商自动上架流程%'
    UNION ALL
    SELECT p.id,
           '排查清单很实用。另外建议客户端保持「关闭时最小化到托盘」，避免误关进程导致触发中断。'
    FROM posts p WHERE p.title LIKE '用轻羽RPA 搭建电商自动上架流程%'
    UNION ALL
    SELECT p.id,
           '排查清单很实用。另外建议客户端保持「关闭时最小化到托盘」，避免误关进程导致触发中断。'
    FROM posts p WHERE p.title LIKE '定时触发器不执行%'
) AS t
WHERE NOT EXISTS (
    SELECT 1 FROM post_replies pr
    WHERE pr.post_id = t.post_id AND pr.author = '轻羽官方' AND pr.content = t.content
);
