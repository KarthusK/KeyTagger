# AGENTS.md

KeyTagger：通过截图（PaddleOCR）识别并可视化编辑游戏键位的本地 Web 工具。后端 FastAPI 提供 API 并托管前端构建产物。

## 常用命令

```bash
python start.py          # 一键启动（生产）：检查依赖 → 构建前端 → 服务 http://localhost:8000
python start.py --dev    # 开发模式：后端:8000 + Vite:3000 热更新
python backend/main.py   # 手动启动后端（必须从仓库根目录运行）
cd frontend && npm run build  # 构建前端 → frontend/dist（后端据此托管）
cd frontend && npm run dev    # Vite 开发服务器（端口 3000，代理 /api → :8000）
```

没有测试、lint、typecheck 配置。验证方式：启动服务后请求 `GET /api/health` 与 `/api/keymap` 应返回 200。

## 必须注意的坑

- **从仓库根目录运行 Python**：后端用 `backend.` 包前缀导入，`main.py`/`start.py` 会把根目录插入 `sys.path`，无 `__init__.py`（依赖隐式命名空间包）。
- **PaddleOCR 固定 2.x**：`requirements.txt` 锁定 `paddleocr==2.8.1`/`paddlepaddle==2.6.2`。`ocr_service.py` 使用 2.x API（`ocr(img, cls=False)` 返回嵌套列表），升级到 3.x 会破坏识别逻辑。
- **导入 paddle 前必须设置 `FLAGS_use_mkldnn=0`**（见 `ocr_service.py` 和 `main.py` 顶部），否则 Windows/部分 CPU 上初始化崩溃或卡死。
- **Windows MIME 修复勿删**：`backend/main.py` 的 `MimeFixedStaticFiles` 把 `.js` 强制为 `application/javascript`。Windows 注册表把 `.js` 标为 `text/plain`，若还原为普通 `StaticFiles`，页面会因严格 MIME 检查白屏。
- **静态挂载必须在 API 路由之后**：`app.mount("/", ...)` 若在 `/api/*` 前注册会拦截 API 请求。
- **`start.py` 的 dev URL 是错的**：`vite.config.js` 的 dev 端口是 `3000`，但 `start.py` 打印的是 `5173`。--dev 模式下实际访问 `http://localhost:3000`。
- **`requirements.txt` 保持纯 ASCII**：写入中文注释会让 Windows 下 `pip` 以 GBK 解码报错（曾踩过）。

## 架构要点

- **键位数据是内存单例**：`keyboard_service`（`backend/keyboard_service.py`）进程内维护 58 键映射，重启即丢失，无持久化。
- **双处布局必须同步**：后端 `config.py` 的 `QWERTY_LAYOUT`（按键名用浏览器 `KeyboardEvent.code`，如 `KeyW`）与前端 `frontend/src/components/Keyboard.jsx` 的 `KEY_MAP`（`react-simple-keyboard` 按钮字符串 → 按键名）一一对应，改一边必须同步另一边。
- **OCR 坐标映射策略**（`ocr_service.py::map_to_keys`）：按 y 分组为行、行内按 x 排序，依次映射到 QWERTY 对应行，取前 N 个。截图内容顺序即映射顺序。

## 代码约定

- 注释用中文；前端 `React` 函数组件 + `useState`/`useCallback`，状态走 `store/keymapContext.jsx` 的 Context。
- API 返回格式统一为 `{"success": true, "keymap": {...}}`，`keymap` 值形如 `{key_name, label, function}`。