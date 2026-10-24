# KeyTagger 开发者文档

面向想了解内部实现或二次开发的开发者。使用说明请看 [README](./README.md)。

## API 文档

服务启动后，访问 `http://localhost:8000/docs` 查看完整的 Swagger 交互式文档。

所有响应统一为 `{"success": true, ...}`；`keymap` 字段形如 `{key_name: {key_name, label, function}}`。

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/upload` | 上传截图，OCR 识别并映射到键盘按键，返回本次识别键数（`mapped_count`）与覆盖明细（`overwrites`） |
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

## 前端约定（改样式前必读）

- **配色令牌是跨端契约**：`frontend/src/styles.css` 的 `:root` / `[data-theme='dark']` 令牌，与
  `frontend/src/utils/keymapImage.js` 的 `PALETTE_VARS` 一一对应（导出图用 Canvas 读同名 CSS 变量）。
  改令牌必须同时改 `PALETTE_VARS` 与 `PALETTE_FALLBACK`，否则导出图会静默退回兜底色、与界面不一致。
- **新增/删除令牌时同步 `PALETTE_FALLBACK`**：`PALETTE_FALLBACK` 是 Node 等无 DOM 环境的兜底值，
  也被 `pagePalette()` 用作「CSS 变量取空」时的回退，缺一项就会画出错色。
- **三层表面**：`--bg`（桌面）/ `--plate`（面板）/ `--case`（键盘机壳）。键帽必须比 `--case` 亮，
  这是「键帽是凸起实物」这套视觉成立的前提，调色时不要压平这三层。
- **导出图的文字底带**：有背景时标题与署名要垫 `drawFrostedPlate()`（虚化 + `--bg-plate-scrim`
  蒙层），与屏幕端 `.plate-board.has-bg .plate-head` 同一做法；直接压字在照片上必然读不清。
- **键盘改动的两个约束**：① 71 个键用 `useButtonTag` 渲染成真实 `<button>`（可 Tab / Enter / Space），
  依赖 `data-skbtn` 的委托事件与 `measureKeyboard()` 的实测尺寸不能被破坏；
  ② 「印刷上色」动画只允许动 `opacity` / `filter`，动 `transform` 会污染 `getBoundingClientRect` 实测。
- **窄屏**：`.simple-keyboard` 有 `min-width: 720px`，在 `.board-scroll` 内横滚；
  低于这个宽度中文功能名会一字一行竖排（390px 下每键仅 18px）。

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
│   │   ├── App.jsx             # 主界面：上传槽 / 键盘板 / 本次记录，主题与背景入口
│   │   ├── styles.css          # 设计令牌与全站样式（导出图共用同一套令牌）
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
└── requirements.txt            # Python 依赖
```
