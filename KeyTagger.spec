# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包配置：python -m PyInstaller KeyTagger.spec --noconfirm"""

from PyInstaller.utils.hooks import collect_all

datas = [
    ("frontend/dist", "frontend/dist"),
]
binaries = []
hiddenimports = [
    # uvicorn 按需动态导入的组件，需显式声明才能进包
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.wsproto_impl",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
]

# RapidOCR 的内置模型与配置文件必须随包携带
pkg_datas, pkg_binaries, pkg_hidden = collect_all("rapidocr_onnxruntime")
datas += pkg_datas
binaries += pkg_binaries
hiddenimports += pkg_hidden

a = Analysis(
    ["run_app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="KeyTagger",
    debug=False,
    console=True,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="KeyTagger",
)
