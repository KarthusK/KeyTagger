#!/usr/bin/env python3
"""
KeyTagger 一键打包脚本（仅 Windows）

流程：确保 PyInstaller → 构建前端 → PyInstaller 打包（KeyTagger.spec）→ 压缩为 zip
产物：dist/KeyTagger/ 目录 与 根目录下 KeyTagger-windows-x64.zip

用法：python build_exe.py
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"
DIST_HTML = FRONTEND_DIR / "dist" / "index.html"
SPEC = ROOT / "KeyTagger.spec"
APP_DIR = ROOT / "dist" / "KeyTagger"
ZIP_PATH = ROOT / "KeyTagger-windows-x64.zip"


def log(msg: str) -> None:
    print(f"[build] {msg}", flush=True)


def ensure_pyinstaller() -> bool:
    if importlib.util.find_spec("PyInstaller") is not None:
        return True
    log("未检测到 PyInstaller，自动安装...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"])
    if result.returncode != 0:
        log("PyInstaller 安装失败，请手动执行: pip install pyinstaller")
        return False
    return True


def build_frontend() -> bool:
    if DIST_HTML.exists():
        log("前端已构建，跳过")
        return True

    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    if not (FRONTEND_DIR / "node_modules").exists():
        log("安装前端依赖 npm install...")
        if subprocess.run([npm, "install"], cwd=FRONTEND_DIR).returncode != 0:
            log("npm install 失败，请检查网络")
            return False

    log("构建前端 npm run build...")
    if subprocess.run([npm, "run", "build"], cwd=FRONTEND_DIR).returncode != 0:
        log("前端构建失败，请检查控制台输出")
        return False
    return True


def make_zip() -> None:
    """压缩 dist/KeyTagger 为 zip（解压后得到 KeyTagger 文件夹）"""
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    log(f"压缩 {APP_DIR.name}/ → {ZIP_PATH.name} ...")
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in sorted(APP_DIR.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(APP_DIR.parent))


def main() -> None:
    if sys.platform != "win32":
        log("当前仅支持 Windows 打包")
        sys.exit(1)
    if not ensure_pyinstaller() or not build_frontend():
        sys.exit(1)

    log("运行 PyInstaller（需要几分钟）...")
    result = subprocess.run(
        [sys.executable, "-m", "PyInstaller", str(SPEC), "--noconfirm", "--clean"],
        cwd=ROOT,
    )
    if result.returncode != 0:
        log("打包失败，请检查上方 PyInstaller 输出")
        sys.exit(1)

    make_zip()
    size_mb = ZIP_PATH.stat().st_size / 1024 / 1024
    log(f"完成：{ZIP_PATH.name}（{size_mb:.0f} MB）")
    log(f"应用目录：{APP_DIR}")


if __name__ == "__main__":
    main()
