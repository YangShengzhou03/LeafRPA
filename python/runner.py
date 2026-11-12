"""leafbot 执行宿主。

从 stdin 读取一个 JSON 任务，执行其中的 Python 代码，再把结果写回 stdout。
协议（一行 JSON）：

    输入: {"code": "...", "vars": {...}, "timeout": 30}
    输出: {"ok": true, "result": ..., "vars": {...}, "logs": "...", "error": null}

说明：
- 脚本中 `print()` 的输出会被捕获进 `logs`；
- `leafbot.log.*` 写入 stderr，由宿主一并收集；
- 若脚本定义了 `main(args)`，则调用它并把返回值作为 `result`；
  否则按普通脚本执行，`result` 为 null。
"""

from __future__ import annotations

import io
import json
import os
import sys
import traceback
from typing import Any


def _sanitize(value: Any) -> Any:
    """确保返回值可被 JSON 序列化。"""
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def main() -> None:
    raw = sys.stdin.readline()
    if not raw:
        return
    try:
        job = json.loads(raw)
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "error": f"任务解析失败: {e}"}, ensure_ascii=False))
        sys.stdout.flush()
        return

    code = job.get("code", "")
    vars_in = job.get("vars") or {}

    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)

    try:
        import leafbot
    except Exception as e:
        sys.stdout.write(
            json.dumps({"ok": False, "error": f"leafbot SDK 加载失败: {e}"}, ensure_ascii=False)
        )
        sys.stdout.flush()
        return

    leafbot.flow._vars = dict(vars_in)

    real_stdout = sys.stdout
    captured = io.StringIO()
    sys.stdout = captured

    ok = True
    error: str | None = None
    result: Any = None
    try:
        namespace: dict[str, Any] = {"__name__": "__main__", "__file__": "<leafbot>"}
        exec(compile(code, "<leafbot>", "exec"), namespace)
        main_fn = namespace.get("main")
        if callable(main_fn):
            result = main_fn(dict(vars_in))
    except BaseException:
        ok = False
        error = traceback.format_exc()
    finally:
        sys.stdout = real_stdout

    response = {
        "ok": ok,
        "result": _sanitize(result),
        "vars": _sanitize(dict(leafbot.flow._vars)),
        "logs": captured.getvalue(),
        "error": error,
    }
    real_stdout.write(json.dumps(response, ensure_ascii=False))
    real_stdout.flush()


if __name__ == "__main__":
    main()
