"""HTTP 请求（基于标准库 urllib，无需第三方依赖）。"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


def request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: Any = None,
    timeout: float = 15,
) -> dict[str, Any]:
    """发起 HTTP 请求，返回包含 status / headers / body 的字典。"""
    method = method.upper()
    data: bytes | None = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            data = body.encode("utf-8")
        elif isinstance(body, bytes):
            data = body
        else:
            data = str(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, method=method)
    for key, value in (headers or {}).items():
        req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            return {
                "ok": True,
                "status": res.status,
                "headers": dict(res.headers),
                "body": raw.decode("utf-8", errors="replace"),
            }
    except urllib.error.HTTPError as e:
        raw = e.read()
        return {
            "ok": False,
            "status": e.code,
            "headers": dict(e.headers),
            "body": raw.decode("utf-8", errors="replace"),
            "error": str(e),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get(url: str, **kwargs: Any) -> dict[str, Any]:
    return request(url, "GET", **kwargs)


def post(url: str, **kwargs: Any) -> dict[str, Any]:
    return request(url, "POST", **kwargs)
