"""文件读写。"""

from __future__ import annotations

import os


def read(path: str, encoding: str = "utf-8") -> str:
    with open(path, "r", encoding=encoding) as f:
        return f.read()


def write(path: str, content: str, encoding: str = "utf-8", append: bool = False) -> None:
    mode = "a" if append else "w"
    with open(path, mode, encoding=encoding) as f:
        f.write(content)


def read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def write_bytes(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def exists(path: str) -> bool:
    return os.path.exists(path)


def list_dir(path: str) -> list[str]:
    return os.listdir(path)


def join(*parts: str) -> str:
    return os.path.join(*parts)
