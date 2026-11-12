#!/usr/bin/env python3
"""轻羽RPA Native Messaging 宿主：HTTP ↔ Native Messaging 桥。

链路：桌面端(前端 fetch) → 本进程 HTTP 服务(127.0.0.1:19836)
      → native messaging(stdio) → Chrome 扩展 service-worker → content.js → 页面

HTTP 接口：
- POST /exec    body: {type, payload, timeout?}
                向扩展发送 {type:'leaf:exec', id, payload}，
                等待扩展回 {type:'leaf:result', id, ok, data|error}（默认超时 10s）
- GET  /status  → {ok: true, connected: <扩展心跳是否在线>}
- GET  /events?since=N
                → {ok: true, events: [...], seq}，增量拉取扩展上报的事件
                  （智能录制元素采集），seq 供下次续拉

native messaging：4 字节小端长度前缀 JSON，独立线程阻塞读 stdin 并分发到等待队列。
日志：%TEMP%\\leaf-rpa-native-host.log
"""
import json
import os
import queue
import socket
import struct
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 19836
DEFAULT_TIMEOUT = 10.0
HEARTBEAT_STALE_SECS = 60
MAX_MESSAGE = 64 * 1024 * 1024  # native 单条消息上限，防止异常长度打爆内存

LOG_PATH = os.path.join(os.environ.get("TEMP", "/tmp"), "leaf-rpa-native-host.log")

_log_lock = threading.Lock()
_stdin_lock = threading.Lock()
_pending_lock = threading.Lock()
_pending = {}  # 请求 id -> queue.Queue（等待扩展的 leaf:result）
_next_id = 0
_last_hb = 0.0  # 最近一次扩展心跳时间戳
_native_alive = True  # native 管道是否存活

# 扩展主动上报的事件（智能录制采集到的元素等），供桌面端轮询
_events = []
_event_seq = 0
_event_lock = threading.Lock()
EVENT_LIMIT = 500


def log(message: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}\n"
    with _log_lock:
        try:
            with open(LOG_PATH, "a", encoding="utf-8") as f:
                f.write(line)
        except OSError:
            pass


def read_exact(fd: int, n: int) -> bytes:
    """精确读取 n 字节；EOF 返回已读部分（可能少于 n）。

    注意：sys.stdin.buffer.read(n) 在管道上可能返回少于 n 字节，直接按长度前缀解析会
    错位导致协议失步（宿主读到错误长度后阻塞/退出）。这里必须循环读满。
    """
    chunks = []
    remaining = n
    while remaining > 0:
        chunk = os.read(fd, remaining)
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def send_message(message: dict) -> None:
    """通过 stdout 向 Chrome 扩展发送一条 native messaging 消息。"""
    encoded = json.dumps(message, ensure_ascii=False).encode("utf-8")
    with _stdin_lock:
        os.write(1, struct.pack("<I", len(encoded)))
        os.write(1, encoded)


def native_read_loop() -> None:
    """阻塞读取 Chrome 回传的 native messaging 消息并分发到等待队列。"""
    global _last_hb, _event_seq, _native_alive
    log("native read loop started")
    while True:
        try:
            raw = read_exact(0, 4)
            if len(raw) < 4:
                log("native stdin closed")
                break
            (length,) = struct.unpack("<I", raw)
            if length > MAX_MESSAGE:
                log(f"native 消息长度异常（{length}），丢弃并退出")
                break
            data = read_exact(0, length) if length else b""
            if len(data) < length:
                log("native stdin closed mid-message")
                break
            message = json.loads(data.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            log(f"native read error: {exc}")
            break

        msg_type = message.get("type", "")
        if msg_type in ("leaf:hello", "leaf:heartbeat"):
            _last_hb = time.time()
            continue
        if msg_type == "leaf:result":
            req_id = message.get("id")
            with _pending_lock:
                waiter = _pending.pop(req_id, None)
            if waiter is not None:
                waiter.put(message)
            else:
                log(f"result for unknown id={req_id}")
            continue
        if msg_type == "leaf:element":
            # 扩展主动上报（智能录制元素采集）：进入事件队列供桌面端轮询
            with _event_lock:
                _event_seq += 1
                _events.append(
                    {
                        "seq": _event_seq,
                        "payload": message.get("payload"),
                        "tab": message.get("tab"),
                        "frame": message.get("frame"),
                        "t": time.time(),
                    }
                )
                if len(_events) > EVENT_LIMIT:
                    del _events[: len(_events) - EVENT_LIMIT]
            continue
        log(f"recv: {json.dumps(message, ensure_ascii=False)[:500]}")

    # stdin 断开：让所有等待中的请求立即失败
    _native_alive = False
    with _pending_lock:
        pending = list(_pending.values())
        _pending.clear()
    for waiter in pending:
        waiter.put({"ok": False, "error": "与浏览器扩展的连接已断开"})
    log("native read loop exit")


def next_request_id() -> str:
    global _next_id
    with _pending_lock:
        _next_id += 1
        return f"req-{os.getpid()}-{_next_id}"


def exec_in_extension(payload_type: str, payload: dict, timeout: float) -> dict:
    """向扩展发送 leaf:exec 并同步等待 leaf:result。"""
    req_id = next_request_id()
    waiter = queue.Queue(maxsize=1)
    with _pending_lock:
        _pending[req_id] = waiter
    try:
        send_message({"type": "leaf:exec", "id": req_id, "payload": {"type": payload_type, "payload": payload}})
    except Exception as exc:  # noqa: BLE001
        with _pending_lock:
            _pending.pop(req_id, None)
        return {"ok": False, "error": f"发送指令失败：{exc}"}
    try:
        result = waiter.get(timeout=max(0.1, timeout))
    except queue.Empty:
        with _pending_lock:
            _pending.pop(req_id, None)
        return {"ok": False, "error": f"执行超时（{timeout}s）：{payload_type}"}
    result.pop("type", None)
    result.pop("id", None)
    return result


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") == "/status":
            # 优先看 native 管道是否存活；心跳作为兜底（旧版扩展不发心跳时仍可显示在线）
            if _native_alive:
                connected = True
            else:
                connected = (time.time() - _last_hb) < HEARTBEAT_STALE_SECS if _last_hb else False
            self._send_json(200, {"ok": True, "connected": connected})
            return
        if parsed.path.rstrip("/") == "/events":
            try:
                since = int(parse_qs(parsed.query).get("since", ["0"])[0])
            except (TypeError, ValueError):
                since = 0
            with _event_lock:
                events = [e for e in _events if e["seq"] > since]
                seq = _event_seq
            self._send_json(200, {"ok": True, "events": events, "seq": seq})
            return
        if parsed.path.rstrip("/") == "/picked":
            # 兼容元素抓取器：从事件队列里取最近一次 leaf:element 上报
            try:
                since = float(parse_qs(parsed.query).get("since", ["0"])[0])
            except (TypeError, ValueError):
                since = 0.0
            with _event_lock:
                picked = None
                picked_at = 0.0
                for e in reversed(_events):
                    if e.get("t", 0.0) > since and e.get("payload"):
                        picked = e["payload"]
                        picked_at = e["t"]
                        break
            self._send_json(200, {"ok": True, "element": picked, "time": picked_at})
            return
        self._send_json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/exec":
            self._send_json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            req = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}
        except Exception as exc:  # noqa: BLE001
            self._send_json(400, {"ok": False, "error": f"请求体不是有效 JSON：{exc}"})
            return
        payload_type = str(req.get("type") or "")
        if not payload_type:
            self._send_json(400, {"ok": False, "error": "缺少 type 字段"})
            return
        payload = req.get("payload")
        payload = payload if isinstance(payload, dict) else {}
        try:
            timeout = float(req.get("timeout") or DEFAULT_TIMEOUT)
        except (TypeError, ValueError):
            timeout = DEFAULT_TIMEOUT
        log(f"exec {payload_type} payload={json.dumps(payload, ensure_ascii=False)[:300]}")
        result = exec_in_extension(payload_type, payload, timeout)
        log(f"exec {payload_type} → ok={result.get('ok')} {str(result.get('error', ''))[:200]}")
        self._send_json(200, result)

    def log_message(self, fmt: str, *args) -> None:  # 静默默认 access log
        pass


class ExclusiveHTTPServer(ThreadingHTTPServer):
    """独占绑定 HTTP 端口，避免多个宿主同时 bind 同一端口把请求分发到没有管道的实例。"""

    allow_reuse_address = False

    def server_bind(self):
        if sys.platform.startswith("win"):
            # SO_EXCLUSIVEADDRUSE：禁止其他进程绑定同一端口（Windows）
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main() -> None:
    log(f"host starting（HTTP {HOST}:{PORT}）")
    try:
        server = ExclusiveHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        log(f"http server start failed: {exc}")
        # 端口被占用时可能已有宿主实例在运行，保持进程存活避免 Chrome 反复重启
        threading.Event().wait()
        return
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True, name="http").start()
    log("http server started")
    try:
        native_read_loop()
    finally:
        server.shutdown()
        log("host exit")


if __name__ == "__main__":
    main()
