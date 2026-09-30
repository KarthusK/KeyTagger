#!/usr/bin/env python3
"""
KeyTagger 服务启动器（唯一启动入口，PyInstaller 打包入口）

- 源码运行：python run_app.py              # 启动服务 + 自动打开浏览器
           python run_app.py --no-browser  # 只起服务，不自动开浏览器
- 仅监听本机 127.0.0.1；后台预热 OCR 模型，首次上传不卡顿
- 端口被占用时给出明确提示并暂停窗口，避免双击运行闪退
"""

from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import urllib.request
import webbrowser

import uvicorn

from backend.app import app
from backend.config import PORT


def _open_browser_when_ready(url: str, timeout: float = 20.0) -> None:
    """轮询健康检查接口，服务就绪后打开浏览器"""
    health = url + "/api/health"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=1) as resp:
                if resp.status == 200:
                    webbrowser.open(url)
                    return
        except Exception:
            time.sleep(0.3)


def _warmup_ocr() -> None:
    """后台预热 OCR 模型，避免首次上传时识别卡顿"""
    try:
        from backend.ocr_service import ocr_service
        ocr_service._get_ocr()
    except Exception:
        pass  # 预热失败不影响服务，上传时会重新初始化并返回明确错误


def _port_in_use(port: int) -> bool:
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def main() -> None:
    parser = argparse.ArgumentParser(description="KeyTagger 服务启动器")
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    args = parser.parse_args()

    if _port_in_use(PORT):
        print(f"\n  端口 {PORT} 已被其他程序占用，无法启动。")
        print("  请关闭占用该端口的程序后重试。")
        _pause_if_frozen()
        return

    url = f"http://127.0.0.1:{PORT}"
    print(f"\n  KeyTagger 运行中：{url}")
    if args.no_browser:
        print("  按 Ctrl+C 停止服务")
    else:
        print("  服务就绪后浏览器将自动打开，按 Ctrl+C 停止服务")
        threading.Thread(target=_open_browser_when_ready, args=(url,), daemon=True).start()
    threading.Thread(target=_warmup_ocr, daemon=True).start()

    try:
        uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
    except KeyboardInterrupt:
        pass
    _pause_if_frozen()


def _pause_if_frozen() -> None:
    """双击 exe 运行时暂停窗口，让用户能看到提示信息"""
    if getattr(sys, "frozen", False):
        input("\n  按回车键关闭窗口...")


if __name__ == "__main__":
    main()
