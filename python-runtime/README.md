# python-runtime

此目录用于存放**内置打包的 Python 运行时**，供轻羽 RPA 在发布版中执行 Python 代码节点。

## 目录约定

```
python-runtime/
  python.exe          # Windows
  python3             # macOS / Linux
  Lib/                # 标准库
  ...
```

Rust 侧会按以下顺序查找解释器：

1. 环境变量 `LEAF_RPA_PYTHON`
2. `python-runtime/python.exe`（Windows）或 `python-runtime/bin/python3`（macOS / Linux）
3. 系统 `PATH` 中的 `python` / `python3`

## 填充方式

运行项目根目录的下载脚本：

```bash
npm run setup-python
```

它会自动下载官方独立的 Python 发行版并解压到本目录（GitHub 不可达时自动回退到 npmmirror 镜像）。也可以手动下载后把解释器与标准库放进来。

> 开发环境下若本目录为空，会自动回退到系统 Python，不影响 `npm start` 调试。
