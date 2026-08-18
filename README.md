# KeyTagger

> 通过截图识别并可视化编辑游戏键位设置的本地 Web 工具。

KeyTagger 是一款轻量级开源工具：上传一张游戏键位设置界面的截图，自动通过 OCR 识别每个按键对应的功能名称，在标准 QWERTY 键盘上可视化展示，支持手动修正并导出为 JSON 配置文件。

## 核心功能

| 功能 | 说明 |
| ---- | ---- |
| 📥 导入截图 | 点击或拖拽上传游戏键位设置界面截图（PNG / JPG / WebP / BMP） |
| 🤖 自动识别 | 调用 PaddleOCR 识别图片中的按键名称（如 `W`、`地图`）及坐标 |
| 🧭 智能映射 | 根据坐标自动将识别文字映射到标准 QWERTY 键盘布局的对应按键 |
| ⌨️ 可视化展示 | 使用 `react-simple-keyboard` 渲染键盘，每个按键上显示识别出的功能文本 |
| ✏️ 手动修正 | 点击键盘按键弹出输入框，修改/添加功能名称（如将识别错误的 `M` 改为 `地图`） |
| 💾 数据导出 | 一键将修改后的键位映射导出为 JSON 配置文件 |

## 工作原理

1. **上传截图**：用户上传游戏键位设置界面的截图。
2. **OCR 识别**：后端调用 PaddleOCR，返回所有文字的文本内容与边界框坐标 `(x, y, w, h)`。
3. **坐标映射**：识别结果按 `y` 坐标分组为行（对应键盘的物理行），行内按 `x` 坐标排序，依次映射到标准 QWERTY 布局对应行的按键上（`config.py` 中定义了 58 个物理按键的 `(row, col)` 位置）。
4. **可视化展示**：前端在键盘上展示每个按键的功能名称，有功能的按键高亮显示。
5. **手动修正**：点击按键即可编辑功能名，修改实时同步到后端。
6. **持久化导出**：将最终映射导出为 `keymap.json`。

## 快速开始

### 一键启动（推荐）

```bash
python start.py
```

脚本会自动完成：检查/安装后端依赖 → 检查/构建前端 → 启动服务 → 显示项目地址，浏览器访问 `http://localhost:8000`。

### 手动启动

```bash
# 1. 安装后端依赖
pip install -r requirements.txt

# 2. 安装并构建前端
cd frontend
npm install
npm run build
cd ..

# 3. 启动服务
python main.py
```

> 首次运行 PaddleOCR 会自动下载识别模型，请保持网络畅通。

### 开发模式（热更新）

```bash
# 终端1：后端服务（端口 8000）
python main.py

# 终端2：前端开发服务器（端口 5173，已配置代理到后端）
cd frontend
npm run dev
```

## API 文档

服务启动后，访问 `http://localhost:8000/docs` 查看完整的 Swagger 交互式文档。

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/upload` | 上传截图，OCR 识别并映射到键盘按键，返回完整键位映射 |
| `GET` | `/api/keymap` | 获取当前所有按键映射 |
| `PUT` | `/api/keymap` | 更新单个按键的功能名称 |
| `POST` | `/api/export` | 导出键位映射为 JSON 文件 |
| `POST` | `/api/reset` | 重置所有按键映射 |

### 导出的 JSON 格式示例

```json
{
  "KeyW": "前进",
  "KeyA": "向左移动",
  "Space": "跳跃",
  "MouseLeft": "开火"
}
```

## 项目结构

```
KeyTagger/
├── backend/                    # 后端（FastAPI + PaddleOCR）
│   ├── main.py                 # FastAPI 启动入口，挂载路由和静态文件
│   ├── routes.py               # API 路由层（/upload, /keymap, /export）
│   ├── ocr_service.py          # OCR 识别与坐标映射逻辑
│   ├── keyboard_service.py     # 键位状态管理（增删改查）
│   ├── config.py               # 全局配置（端口、QWERTY 布局、上传限制等）
│   └── models.py               # Pydantic 数据模型
├── frontend/                   # 前端（React + Vite）
│   ├── src/
│   │   ├── App.jsx             # 主界面：上传区 + 键盘展示区布局
│   │   ├── components/
│   │   │   └── Keyboard.jsx    # 封装 react-simple-keyboard，处理渲染和点击编辑
│   │   ├── api/
│   │   │   └── client.js       # Axios 封装，对接后端接口
│   │   ├── store/
│   │   │   └── keymapContext.jsx  # React Context，全局管理键位数据
│   │   └── main.jsx            # Vite 入口
│   ├── index.html
│   ├── package.json
│   └── vite.config.js          # 开发代理：/api → localhost:8000
├── start.py                    # 一键启动脚本（自动检查依赖并构建）
├── requirements.txt            # Python 依赖
└── README.md
```

## 配置说明

`backend/config.py` 中的主要配置项：

| 配置项 | 默认值 | 说明 |
| ------ | ------ | ---- |
| `PORT` | `8000` | 服务端口 |
| `MAX_UPLOAD_SIZE` | `10MB` | 上传图片大小限制 |
| `QWERTY_LAYOUT` | - | 标准 QWERTY 键盘 58 键布局定义 |

## 技术栈

- **后端**：Python 3.10+ · FastAPI · Uvicorn · PaddleOCR · Pydantic
- **前端**：React 18 · Vite · Axios · react-simple-keyboard
- **运行方式**：后端提供静态前端资源，通过 `python main.py` 启动，在 `http://localhost:8000` 提供服务

## 常见问题

**Q: 页面空白，控制台报 MIME type 错误？**

A: Windows 注册表可能将 `.js` 文件错误识别为 `text/plain`。项目已在 `main.py` 中强制注册正确的 MIME 类型，请重启服务并 `Ctrl+F5` 强制刷新浏览器缓存。

**Q: OCR 识别效果不理想？**

A: 识别精度与截图质量相关，建议使用高清截图。识别结果可通过点击键盘按键手动修正，这也是本工具的核心使用方式。

**Q: 端口被占用？**

A: 修改 `backend/config.py` 中的 `PORT` 配置即可更换端口。

## 开源协议

MIT License