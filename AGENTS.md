# AGENTS.md

KeyTagger：通过截图（RapidOCR）识别并可视化编辑游戏键位的本地 Web 工具。后端 FastAPI 提供 API 并托管前端构建产物。

## 常用命令

```bash
python start.py          # 一键启动（生产）：检查依赖 → 构建前端 → 委托 run_app 启动服务
python start.py --dev    # 开发模式：后端:8000 + Vite:3000 热更新
python run_app.py        # 服务启动器（唯一入口，exe 打包入口）：端口预检 + OCR 预热 + 自动开浏览器
python run_app.py --no-browser  # 手动只起后端，不自动开浏览器
python test_ocr_mapping.py  # OCR 映射回归测试（扫描 test_data/ 的 png+json 用例）
python build_release.py  # 一键发布打包：完整版（PyInstaller → dist/KeyTagger/ + zip）+ 精简版（源码 zip）
启动.bat                 # 精简版用户入口（双击）：检测本地环境或自动建 venv 装依赖后启动
cd frontend && npm run build  # 构建前端 → frontend/dist（后端据此托管）
cd frontend && npm run dev    # Vite 开发服务器（端口 3000，代理 /api → :8000）
```

没有 lint、typecheck 配置。验证方式：`python test_ocr_mapping.py` 应全部 PASS（当前 13/13）；启动服务后请求 `GET /api/health` 与 `/api/keymap` 应返回 200。

## 必须注意的坑

- **从仓库根目录运行 Python**：后端用 `backend.` 包前缀导入，入口脚本都在根目录（`run_app.py` 的脚本目录自动进 `sys.path`，`start.py`/`test_ocr_mapping.py` 显式插入），无 `__init__.py`（依赖隐式命名空间包）。
- **OCR 用 RapidOCR（onnxruntime）**：`requirements.txt` 锁定 `rapidocr_onnxruntime==1.4.4`，PP-OCR 模型随包内置、无需联网下载。输出格式为 `[[box, text, score], ...]`（与 PaddleOCR 的 `[box, (text, score)]` 不同）。
- **`OCR_DET_LIMIT_SIDE_LEN=1216` 勿改小**（`config.py`）：检测阶段最小边长，键位截图里单个字母很小，默认 736 会漏检（曾导致 D/C/E/F3 全部丢失），1216 后单字符检出率大幅提升。
- **打包路径双分支**（`config.py`）：`sys.frozen` 时只读资源取 `sys._MEIPASS`（前端产物、OCR 模型），可写数据（uploads）放 exe 同级目录；开发模式维持 `backend/uploads`。新增文件路径一律走这两个常量。
- **Windows MIME 修复勿删**：`backend/app.py` 的 `MimeFixedStaticFiles` 把 `.js` 强制为 `application/javascript`。Windows 注册表把 `.js` 标为 `text/plain`，若还原为普通 `StaticFiles`，页面会因严格 MIME 检查白屏。
- **静态挂载必须在 API 路由之后**：`app.mount("/", ...)` 若在 `/api/*` 前注册会拦截 API 请求。
- **`requirements.txt` 保持纯 ASCII**：写入中文注释会让 Windows 下 `pip` 以 GBK 解码报错（曾踩过）。
- **依赖用 `>=` 最低版本而非 `==` 锁死**：工具可能装进用户共享环境，锁死会强行降级已有包；下限取已测试版本，完整版 exe 打包时自带的就是已测试组合。其中 **rapidocr 必须 ≥1.4**（`ocr_service.py` 依赖 1.4 的 `det_limit_*` 参数与 `[[box, text, score]]` 输出格式），`启动.bat` 的本地环境快速通道对该包做版本断言，不通过则走 venv 兜底。
- **PyInstaller 打包**：spec 里必须 `collect_all("rapidocr_onnxruntime")`（带走内置模型）并显式声明 uvicorn 的动态导入组件（见 `KeyTagger.spec`）；打包前需先构建前端。杀软对 PyInstaller exe 误报属常见现象。

## 架构要点

- **键位数据是内存单例**：`keyboard_service`（`backend/keyboard_service.py`）进程内维护 58 键映射，重启即丢失，无持久化。
- **双处布局必须同步**：后端 `config.py` 的 `QWERTY_LAYOUT`（按键名用浏览器 `KeyboardEvent.code`，如 `KeyW`）与前端 `frontend/src/components/Keyboard.jsx` 的 `KEY_MAP`（`react-simple-keyboard` 按钮字符串 → 按键名）一一对应，改一边必须同步另一边。
- **OCR 识别与映射分离**：`ocr_service.py::recognize` 只做引擎调用（RapidOCR → `OCRResult` 列表），`map_to_keys` 做映射（按 y 分组为行、行内按 x 排序，行内首个可匹配文本是按键标签、其余拼接为功能名），四级匹配依赖 `config.py` 的三张混淆映射表（字形/数字字母/复合键），与 OCR 引擎解耦——换引擎只动 `recognize`。
- **测试基线**：`test_data/` 内 png+同名 json（期望格式 `{"功能名": "键标签"}`），`test_ocr_mapping.py` 对比断言（忽略空格与全/半角括号差异）。

## 代码约定

- 注释用中文；前端 `React` 函数组件 + `useState`/`useCallback`，状态走 `store/keymapContext.jsx` 的 Context。
- API 返回格式统一为 `{"success": true, "keymap": {...}}`，`keymap` 值形如 `{key_name, label, function}`。

## Commit 规范

- 使用多行形式：首行 `type: 中文概要`（type 用 feat/fix/docs/refactor/chore），空一行后用 `- ` 列出要点
- 要点条数控制在 1-4 行，概括改动与行为影响，不写代码细节
- 只提交本次相关文件，不加多余文件
