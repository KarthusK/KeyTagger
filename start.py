#!/usr/bin/env python3
"""
KeyTagger 一键启动脚本

生产模式（默认）:
    python start.py
    检查依赖 → 构建前端 → 启动后端服务 → 显示项目地址

开发模式（热更新）:
    python start.py --dev
    检查依赖 → 后台启动后端 → 前台启动 Vite → 显示项目地址
"""

from __future__ import annotations

import os
os.environ.setdefault("FLAGS_use_mkldnn", "0")

import argparse
import importlib.util
import signal
import subprocess
import sys
import time
from pathlib import Path

# 项目根目录（start.py 所在目录）
ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DIST_HTML = FRONTEND_DIR / "dist" / "index.html"
REQUIREMENTS = ROOT / "requirements.txt"


class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def log(msg: str, color: str = Colors.CYAN) -> None:
    timestamp = time.strftime("%H:%M:%S")
    print(f"{color}[{timestamp}]{Colors.RESET} {msg}", flush=True)


def print_url(url: str) -> None:
    """打印可点击的终端超链接（OSC 8 标准，Windows Terminal / VSCode / iTerm2 均支持）"""
    print(f"\n  {Colors.BOLD}  ** 服务已启动 **{Colors.RESET}")
    print(f"\033]8;;{url}\033\\  {Colors.GREEN}{Colors.BOLD}{url}{Colors.RESET}  \033]8;;\033\\")
    print()


def check_backend_deps() -> bool:
    """检查后端依赖是否完整，缺失时自动安装"""
    if not REQUIREMENTS.exists():
        log("未找到 requirements.txt，跳过依赖检查", Colors.YELLOW)
        return True

    log("检查后端依赖...", Colors.CYAN)
    missing: list[str] = []

    for line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # 取包名（去掉版本约束和 extras）
        pkg = line.split("==")[0].split(">=")[0].split(">")[0].split("[")[0].strip()
        # 模块名到包名的常见映射
        module = {
            "Pillow": "PIL",
            "python-multipart": "multipart",
            "paddlepaddle": "paddle",
        }.get(pkg, pkg.replace("-", "_"))
        # 使用 find_spec 仅检查包是否存在，不真正导入，避免触发初始化警告且速度更快
        if importlib.util.find_spec(module) is None:
            missing.append(line)

    if not missing:
        log("后端依赖已满足", Colors.GREEN)
        return True

    log(f"缺失 {len(missing)} 个依赖，开始安装...", Colors.YELLOW)
    python = sys.executable
    result = subprocess.run(
        [python, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
        cwd=ROOT,
    )
    if result.returncode != 0:
        log("依赖安装失败，请手动执行: pip install -r requirements.txt", Colors.RED)
        return False
    log("依赖安装完成", Colors.GREEN)
    return True


def build_frontend() -> bool:
    """检查前端构建产物，缺失时自动安装依赖并构建"""
    if DIST_HTML.exists():
        log("前端已构建，跳过", Colors.GREEN)
        return True

    log("未检测到前端构建产物，准备构建...", Colors.YELLOW)

    npm = "npm.cmd" if sys.platform == "win32" else "npm"

    if not (FRONTEND_DIR / "node_modules").exists():
        log("安装前端依赖 npm install...", Colors.YELLOW)
        result = subprocess.run([npm, "install"], cwd=FRONTEND_DIR)
        if result.returncode != 0:
            log("npm install 失败，请检查网络或手动执行", Colors.RED)
            return False
        log("依赖安装完成", Colors.GREEN)

    log("构建前端 npm run build...", Colors.YELLOW)
    result = subprocess.run([npm, "run", "build"], cwd=FRONTEND_DIR)
    if result.returncode != 0:
        log("前端构建失败，请检查控制台输出", Colors.RED)
        return False

    log("前端构建完成", Colors.GREEN)
    return True


def check_paddleocr_models() -> None:
    """检查 PaddleOCR 模型是否已下载，缺失时自动下载"""
    log("检查 PaddleOCR 模型...", Colors.YELLOW)
    sys.path.insert(0, str(ROOT))
    try:
        from paddleocr import PaddleOCR
        from backend.config import OCR_LANG
        PaddleOCR(use_textline_orientation=False, lang=OCR_LANG, show_log=False)
        log("PaddleOCR 模型就绪", Colors.GREEN)
    except Exception as e:
        log(f"PaddleOCR 模型下载失败: {e}", Colors.RED)
        sys.exit(1)


def start_production() -> None:
    """生产模式：检查依赖 → 检查模型 → 构建前端 → 后端提供服务（单进程）"""
    if not check_backend_deps():
        sys.exit(1)
    check_paddleocr_models()
    if not build_frontend():
        sys.exit(1)

    log("启动后端服务...", Colors.CYAN)
    url = "http://localhost:8000"
    print_url(url)

    # 将项目根目录加入路径，确保 backend 包可导入
    sys.path.insert(0, str(ROOT))
    import uvicorn

    try:
        uvicorn.run(
            "backend.main:app",
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_level="info",
        )
    except KeyboardInterrupt:
        log("服务已关闭", Colors.GREEN)


def start_dev() -> None:
    """开发模式：检查依赖 → 检查模型 → 后台后端 + 前台 Vite 热更新"""
    if not check_backend_deps():
        sys.exit(1)
    check_paddleocr_models()
    log("启动开发模式...", Colors.CYAN)

    python = sys.executable
    npm = "npm.cmd" if sys.platform == "win32" else "npm"

    # 启动后端（子进程）
    log("启动后端服务 (端口 8000, hot-reload)...", Colors.CYAN)
    backend = subprocess.Popen(
        [python, str(BACKEND_DIR / "main.py")],
        cwd=ROOT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    time.sleep(2)

    url = "http://localhost:5173"
    print_url(url)

    # 前台运行 Vite（用户 Ctrl+C 时在此处捕获）
    try:
        subprocess.run([npm, "run", "dev"], cwd=FRONTEND_DIR)
    except KeyboardInterrupt:
        pass
    finally:
        log("正在关闭后端服务...", Colors.YELLOW)
        if sys.platform == "win32":
            backend.send_signal(signal.CTRL_BREAK_EVENT)
        backend.terminate()
        try:
            backend.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend.kill()
            backend.wait()
        log("服务已关闭", Colors.GREEN)


def main() -> None:
    parser = argparse.ArgumentParser(description="KeyTagger 一键启动")
    parser.add_argument("--dev", action="store_true", help="开发模式（后端 + Vite 热更新）")
    args = parser.parse_args()

    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("  ┌──────────────────────────────┐")
    print("  │        KeyTagger v1.0        │")
    print("  │    游戏键位可视化编辑器        │")
    print("  └──────────────────────────────┘")
    print(f"{Colors.RESET}")

    if args.dev:
        start_dev()
    else:
        start_production()


if __name__ == "__main__":
    main()
