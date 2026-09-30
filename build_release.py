#!/usr/bin/env python3
"""
KeyTagger 发布打包脚本（仅 Windows）

一次产出两个发布包：
- 完整版 dist/KeyTagger/ → KeyTagger-windows-x64.zip（自带运行环境，解压双击即用）
- 精简版 KeyTagger-lite.zip（源码 + 前端构建产物，用户自备 Python，依赖自动安装）

用法：python build_release.py
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
FULL_ZIP = ROOT / "KeyTagger-windows-x64.zip"
LITE_ZIP = ROOT / "KeyTagger-lite.zip"

# 精简版包含的根目录文件：（来源，压缩包内路径）
LITE_FILES = [
    (ROOT / "start.py", "start.py"),
    (ROOT / "run_app.py", "run_app.py"),
    (ROOT / "requirements.txt", "requirements.txt"),
    (ROOT / "启动.bat", "启动.bat"),
    (ROOT / "README.md", "README.md"),
    (ROOT / "LICENSE", "LICENSE"),
]


def log(msg: str) -> None:
    print(f"[build] {msg}", flush=True)


def size_mb(path: Path) -> str:
    return f"{path.stat().st_size / 1024 / 1024:.1f} MB"


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


def make_zip_from_dir(src_dir: Path, zip_path: Path) -> None:
    """压缩目录为 zip（解压后得到以目录名命名的文件夹）"""
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in sorted(src_dir.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(src_dir.parent))


def build_full() -> bool:
    """完整版：PyInstaller 打包（自带运行环境）"""
    log("运行 PyInstaller（完整版，需要几分钟）...")
    result = subprocess.run(
        [sys.executable, "-m", "PyInstaller", str(SPEC), "--noconfirm", "--clean"],
        cwd=ROOT,
    )
    if result.returncode != 0:
        log("完整版打包失败，请检查上方 PyInstaller 输出")
        return False
    make_zip_from_dir(APP_DIR, FULL_ZIP)
    return True


def build_lite() -> None:
    """精简版：源码 + 前端构建产物，不含运行环境"""
    if LITE_ZIP.exists():
        LITE_ZIP.unlink()
    log(f"压缩精简版 → {LITE_ZIP.name} ...")
    with zipfile.ZipFile(LITE_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for src, arc in LITE_FILES:
            if src.exists():
                zf.write(src, f"KeyTagger/{arc}")
            else:
                log(f"[WARN] 缺少 {src.name}，已跳过")
        # 后端源码（仅 .py，天然排除 __pycache__ 与 uploads）
        for f in sorted((ROOT / "backend").rglob("*.py")):
            zf.write(f, f"KeyTagger/{f.relative_to(ROOT)}")
        # 前端构建产物（免 Node 环境）
        for f in sorted((FRONTEND_DIR / "dist").rglob("*")):
            if f.is_file():
                zf.write(f, f"KeyTagger/{f.relative_to(ROOT)}")


def main() -> None:
    if sys.platform != "win32":
        log("当前仅支持 Windows 打包")
        sys.exit(1)
    if not ensure_pyinstaller() or not build_frontend():
        sys.exit(1)

    if not build_full():
        sys.exit(1)
    build_lite()

    log(f"完成：{FULL_ZIP.name}（{size_mb(FULL_ZIP)}，自带运行环境）")
    log(f"      {LITE_ZIP.name}（{size_mb(LITE_ZIP)}，自备 Python）")


if __name__ == "__main__":
    main()
