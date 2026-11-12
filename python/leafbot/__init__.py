"""leafbot - 轻羽 RPA Python SDK。

在流程的「Python代码」节点中使用：

    import leafbot

    leafbot.log.info("开始处理")
    leafbot.flow.set_var("name", "value")
    result = leafbot.http.get("https://example.com")
    leafbot.file.write(r"C:\\out.txt", result["body"])

SDK 设计为纯 Python 实现，无需第三方依赖；后续可通过宿主 RPC 扩展原生能力。
"""

from . import file, flow, http, log

__all__ = ["file", "flow", "http", "log"]
__version__ = "0.1.0"
