"""流程变量读写。

执行宿主在运行前会把当前流程变量注入 `_vars`，脚本结束后再回传。
"""

from __future__ import annotations

from typing import Any

# 由执行宿主在运行前注入流程变量
_vars: dict[str, Any] = {}


def get_var(name: str, default: Any = None) -> Any:
    return _vars.get(name, default)


def set_var(name: str, value: Any) -> None:
    _vars[name] = value


def vars_dict() -> dict[str, Any]:
    return dict(_vars)
