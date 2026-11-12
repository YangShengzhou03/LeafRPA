"""运行日志输出（写入应用运行日志）。"""

from __future__ import annotations

import sys


def _emit(level: str, message: object) -> None:
    sys.stderr.write(f"[{level}] {message}\n")
    sys.stderr.flush()


def info(message: object) -> None:
    _emit("INFO", message)


def success(message: object) -> None:
    _emit("SUCCESS", message)


def warn(message: object) -> None:
    _emit("WARN", message)


def error(message: object) -> None:
    _emit("ERROR", message)
