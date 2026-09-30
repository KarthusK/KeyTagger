@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem KeyTagger 精简版启动脚本：自动准备依赖并启动服务

where python >nul 2>nul
if errorlevel 1 (
    echo [KeyTagger] 未检测到 Python，请先安装 Python 3.10 以上版本：
    echo             https://www.python.org/downloads/
    echo             安装时勾选 "Add python.exe to PATH"
    pause
    exit /b 1
)

rem 本地已有依赖（含 rapidocr 最低版本校验，行为依赖 1.4+ 的检测参数与输出格式）时直接使用当前环境，零下载
python -c "import fastapi, uvicorn, rapidocr_onnxruntime; from importlib.metadata import version; assert tuple(int(x) for x in version('rapidocr_onnxruntime').split('.')[:3] if x.isdigit()) >= (1, 4, 0)" >nul 2>nul
if not errorlevel 1 (
    echo [KeyTagger] 检测到本地依赖，直接启动...
    python run_app.py
    exit /b 0
)

echo [KeyTagger] 首次运行：创建虚拟环境并安装依赖（约 1-2 分钟，取决于网速）...
python -m venv .venv
if errorlevel 1 (
    echo [KeyTagger] 创建虚拟环境失败，请确认 Python 安装完整后重试。
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 python -m pip install -r requirements.txt

python -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
    echo [KeyTagger] 依赖安装失败，请检查网络后重新运行本脚本。
    pause
    exit /b 1
)

echo [KeyTagger] 依赖就绪，正在启动...
python run_app.py
