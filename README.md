# KeyTagger

> 通过截图识别并可视化编辑游戏键位设置的本地 Web 工具。

上传一张游戏键位设置界面的截图，自动通过 OCR 识别每个按键对应的功能名称，在标准 QWERTY 键盘上可视化展示；支持手动修正、JSON 导入导出，还能一键生成键位图片、为键盘自定义背景。所有处理均在本地完成。

## 核心功能

| 功能 | 说明 |
| ---- | ---- |
| 📥 导入截图 | 点击上传，或把文件拖到页面任意位置（PNG / JPG / WebP / BMP），同一文件自动去重 |
| 🤖 自动识别 | 调用 RapidOCR 识别按键名称与坐标，显示本次识别的键位数；新键位覆盖旧绑定时给出覆盖明细 |
| 🧭 智能映射 | 识别文字按行映射到 QWERTY 对应按键，内置常见误识纠错（如 `口`→D、`5`→S） |
| ⌨️ 可视化编辑 | 点击按键编辑功能名、拖拽移动绑定；浅色 / 暗色主题可切换，可为键盘自定义背景图 |
| 🖼️ 生成图片 | 将当前键位渲染为一张键位图（PNG）：可自定义标题与水印、附带背景虚化，支持下载或复制到剪贴板 |
| 💾 JSON 导入导出 | 导出 `keymap.json` 备份，也可导入已有 JSON 覆盖合并到当前键位 |

## 快速开始

### 版本选择

| 版本 | 体积 | 环境要求 | 适合人群 |
| ---- | ---- | -------- | -------- |
| 完整版 `KeyTagger-windows-x64.zip` | ~123MB | 无 | 没装 Python 的普通用户 |
| 精简版 `KeyTagger-lite.zip` | ~0.1MB | Python 3.10+ | 已装 Python、想快速下载的用户 |

### 完整版（免安装）

1. 下载并解压 `KeyTagger-windows-x64.zip`
2. 双击 `KeyTagger.exe`，浏览器会自动打开 `http://127.0.0.1:8000`
3. 使用完毕后关闭命令行窗口即可退出

> - 导出的 JSON 与运行数据保存在 exe 同级的 `uploads/` 文件夹
> - 个别杀毒软件可能对未签名的打包程序误报，添加信任即可
> - 服务固定使用 8000 端口，被占用时请先关闭占用该端口的程序

### 精简版（自备 Python）

1. 下载并解压 `KeyTagger-lite.zip`
2. 双击 `启动.bat`：本地已有依赖则直接启动；否则自动创建虚拟环境并通过国内镜像安装依赖（首次约 1-2 分钟），完成后自动打开浏览器

也可以手动执行（等价）：

```bash
pip install -r requirements.txt
python start.py
```

### 源码运行

```bash
# 一键启动：检查/安装依赖 → 检查/构建前端 → 启动服务并自动打开浏览器
python start.py
```

或手动执行：

```bash
# 1. 安装后端依赖
pip install -r requirements.txt

# 2. 安装并构建前端
cd frontend
npm install
npm run build
cd ..

# 3. 启动服务
python run_app.py
```

> OCR 模型随 `rapidocr_onnxruntime` 包内置，无需额外下载。

### 开发模式（热更新）

```bash
# 终端1：后端服务（端口 8000，不自动开浏览器）
python run_app.py --no-browser

# 终端2：前端开发服务器（端口 3000，已配置代理到后端）
cd frontend
npm run dev
```

## API 文档

服务启动后，访问 `http://localhost:8000/docs` 查看完整的 Swagger 交互式文档。

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/upload` | 上传截图，OCR 识别并映射到键盘按键，返回本次识别键数与覆盖明细 |
| `GET` | `/api/keymap` | 获取当前所有按键映射 |
| `PUT` | `/api/keymap` | 更新单个按键的功能名称 |
| `POST` | `/api/keymap/move` | 将源按键的绑定移动到目标按键 |
| `POST` | `/api/import` | 导入 JSON 键位文件，覆盖式合并到当前键位 |
| `POST` | `/api/export` | 导出当前键位映射为 JSON 文件 |
| `POST` | `/api/reset` | 重置所有按键映射 |

### 导出的 JSON 格式示例

```json
{
  "KeyW": "前进",
  "Space": "跳跃",
  "F3": "其他交互",
  "Tab": "物品栏（切换）"
}
```

## 项目结构

```
KeyTagger/
├── backend/                    # 后端（FastAPI + RapidOCR）
│   ├── app.py                  # FastAPI 应用定义：健康检查、路由挂载、静态托管（MIME 修复）
│   ├── routes.py               # API 路由层（上传识别、键位增删改、JSON 导入导出）
│   ├── ocr_service.py          # OCR 识别与坐标映射逻辑
│   ├── keyboard_service.py     # 键位状态管理（内存单例，含导入覆盖合并）
│   ├── config.py               # 全局配置（端口、QWERTY 布局、OCR 参数、混淆映射表）
│   └── models.py               # Pydantic 数据模型
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # 主界面：上传区 / 键盘区 / 截图对照区，主题与背景入口
│   │   ├── components/
│   │   │   ├── Keyboard.jsx    # 屏幕键盘：渲染、点击编辑、拖拽移动绑定
│   │   │   ├── ImageExportModal.jsx  # 生成图片弹窗：实时预览、标题/水印、下载与复制
│   │   │   └── icons.jsx       # 内联 SVG 图标
│   │   ├── store/
│   │   │   └── keymapContext.jsx  # 全局状态：键位数据与背景图管理
│   │   ├── utils/
│   │   │   ├── keyLayout.js    # 键盘布局单一数据源（屏幕键盘与生成图片共用）
│   │   │   ├── keymapImage.js  # 键位图 Canvas 绘制（几何计算与渲染）
│   │   │   └── overwriteTooltip.js  # 覆盖明细提示格式化
│   │   ├── api/
│   │   │   └── client.js       # Axios 封装，对接后端接口
│   │   └── main.jsx            # React 入口
│   └── vite.config.js          # 开发代理：/api → localhost:8000
├── start.py                    # 一键启动脚本（自动检查依赖并构建）
├── run_app.py                  # 服务启动器：端口预检 + 自动开浏览器（exe 打包入口）
├── 启动.bat                    # 精简版用户入口：自动建 venv 装依赖并启动
├── build_release.py            # 发布打包：完整版（PyInstaller）+ 精简版（源码 zip）
├── KeyTagger.spec              # PyInstaller 打包配置
├── test_ocr_mapping.py         # OCR 识别与映射回归测试
├── test_data/                  # 测试截图与期望映射（png + json 成对）
├── requirements.txt            # Python 依赖
└── README.md
```

## 配置说明

`backend/config.py` 中的主要配置项：

| 配置项 | 默认值 | 说明 |
| ------ | ------ | ---- |
| `PORT` | `8000` | 服务端口 |
| `MAX_UPLOAD_SIZE` | `10MB` | 上传图片大小限制 |
| `QWERTY_LAYOUT` | - | 标准 QWERTY 键盘 71 键布局定义 |
| `OCR_DET_LIMIT_SIDE_LEN` | `1216` | OCR 检测阶段最小边长，勿调小（会漏检单字母键位） |

## 技术栈

- **后端**：Python 3.10+ · FastAPI · Uvicorn · RapidOCR（onnxruntime）· Pydantic
- **前端**：React 18 · Vite · Axios · react-simple-keyboard（键位图导出为原生 Canvas 实现，零额外依赖）

## 常见问题

**Q: 页面空白，控制台报 MIME type 错误？**

A: Windows 注册表可能将 `.js` 文件错误识别为 `text/plain`。项目已在 `backend/app.py` 中强制注册正确的 MIME 类型，请重启服务并 `Ctrl+F5` 强制刷新浏览器缓存。

**Q: OCR 识别效果不理想？**

A: 识别精度与截图质量相关，建议使用高清截图。识别结果可通过点击键盘按键手动修正，这也是本工具的核心使用方式。

**Q: 端口被占用？**

A: 源码运行时可修改 `backend/config.py` 中的 `PORT` 配置更换端口；免安装版固定使用 8000 端口，请先关闭占用该端口的程序。

**Q: 我的截图、背景图会被上传吗？**

A: 不会。键位截图仅用于本地 OCR 识别，识别后立即删除；背景图与生成的键位图片全程在浏览器内处理（Canvas 渲染），不会经过服务器。

## 打包发布（开发者）

在装有 Python 与 Node.js 的机器上执行：

```bash
python build_release.py
```

一次产出两个发布包：
- **完整版**：PyInstaller 打包 → `dist/KeyTagger/` 目录和 `KeyTagger-windows-x64.zip`（约 123MB，自带运行环境）
- **精简版**：`KeyTagger-lite.zip`（约 0.1MB，源码 + 前端构建产物，用户自备 Python）

打包配置见 `KeyTagger.spec`（需携带 RapidOCR 内置模型与前端构建产物）。

## 开源协议

MIT License
