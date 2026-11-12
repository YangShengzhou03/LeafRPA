# leafRPA 项目长期笔记

## 技术栈
Tauri 2 + Vue 3（`<script setup>`）+ TypeScript + Pinia + Element Plus + Vite 8，RPA 桌面应用，界面复刻「轻羽 RPA」。

## 本机开发环境
- Node：建议用托管版 `C:\Users\freedom\.workbuddy\binaries\node\versions\22.22.2-6`（npm 11.14.1）。
- Rust：安装于 **D:\tools\Rust**
  - `RUSTUP_HOME=D:\tools\Rust\rustup`
  - `CARGO_HOME=D:\tools\Rust\cargo`（bin 目录在用户 PATH 中）
  - 工具链 `stable-x86_64-pc-windows-msvc`
- MSVC：VS Community 2019（Toolset 14.29.30133）+ Windows SDK 10.0.19041.0，未加入 PATH，由 rustc 自动探测。
- cargo 走**中科大 USTC** 镜像：见 `D:\tools\Rust\cargo\config.toml`（sparse 索引 + 镜像自建 crate 代理）。不要用清华 TUNA —— 它的 dl 指回 static.crates.io，下载只有 ~38KB/s。
- npm registry 为 npmmirror，偶发 tarball 400，直接重试即可。

## 常用命令
- `npm install` 装依赖
- `npm run dev` → Vite 浏览器预览 http://localhost:5173（无 Tauri 后端，流程数据走 localStorage，见 src/bridge.ts 的 hasTauri 判断）
- `npm start` → tauri dev 桌面模式
- `npm run build-pro` → 打包
- `npm run lint`（vue-tsc）/ `npm run lint:rust`（cargo clippy）
