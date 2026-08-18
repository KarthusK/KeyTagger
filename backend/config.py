import os

# 服务端口
PORT = 8000

# 上传文件大小限制（10MB）
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# 上传文件保存目录
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

# 前端构建产物目录
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

# 标准 QWERTY 键盘布局定义
# 每行按键从左到右排列，位置用 (row, col) 表示
QWERTY_LAYOUT = {
    # F 功能区
    "Escape": {"row": -1, "col": 0,  "label": "Esc"},
    "F1":     {"row": -1, "col": 2,  "label": "F1"},
    "F2":     {"row": -1, "col": 3,  "label": "F2"},
    "F3":     {"row": -1, "col": 4,  "label": "F3"},
    "F4":     {"row": -1, "col": 5,  "label": "F4"},
    "F5":     {"row": -1, "col": 6,  "label": "F5"},
    "F6":     {"row": -1, "col": 7,  "label": "F6"},
    "F7":     {"row": -1, "col": 8,  "label": "F7"},
    "F8":     {"row": -1, "col": 9,  "label": "F8"},
    "F9":     {"row": -1, "col": 10, "label": "F9"},
    "F10":    {"row": -1, "col": 11, "label": "F10"},
    "F11":    {"row": -1, "col": 12, "label": "F11"},
    "F12":    {"row": -1, "col": 13, "label": "F12"},
    # 第一行
    "Backquote":  {"row": 0, "col": 0,  "label": "`"},
    "Digit1":     {"row": 0, "col": 1,  "label": "1"},
    "Digit2":     {"row": 0, "col": 2,  "label": "2"},
    "Digit3":     {"row": 0, "col": 3,  "label": "3"},
    "Digit4":     {"row": 0, "col": 4,  "label": "4"},
    "Digit5":     {"row": 0, "col": 5,  "label": "5"},
    "Digit6":     {"row": 0, "col": 6,  "label": "6"},
    "Digit7":     {"row": 0, "col": 7,  "label": "7"},
    "Digit8":     {"row": 0, "col": 8,  "label": "8"},
    "Digit9":     {"row": 0, "col": 9,  "label": "9"},
    "Digit0":     {"row": 0, "col": 10, "label": "0"},
    "Minus":      {"row": 0, "col": 11, "label": "-"},
    "Equal":      {"row": 0, "col": 12, "label": "="},
    "Backspace":  {"row": 0, "col": 13, "label": "退格"},
    # 第二行
    "Tab":        {"row": 1, "col": 0,  "label": "Tab"},
    "KeyQ":       {"row": 1, "col": 1,  "label": "Q"},
    "KeyW":       {"row": 1, "col": 2,  "label": "W"},
    "KeyE":       {"row": 1, "col": 3,  "label": "E"},
    "KeyR":       {"row": 1, "col": 4,  "label": "R"},
    "KeyT":       {"row": 1, "col": 5,  "label": "T"},
    "KeyY":       {"row": 1, "col": 6,  "label": "Y"},
    "KeyU":       {"row": 1, "col": 7,  "label": "U"},
    "KeyI":       {"row": 1, "col": 8,  "label": "I"},
    "KeyO":       {"row": 1, "col": 9,  "label": "O"},
    "KeyP":       {"row": 1, "col": 10, "label": "P"},
    "BracketLeft":  {"row": 1, "col": 11, "label": "["},
    "BracketRight": {"row": 1, "col": 12, "label": "]"},
    "Backslash":    {"row": 1, "col": 13, "label": "\\"},
    # 第三行
    "CapsLock":   {"row": 2, "col": 0,  "label": "Caps"},
    "KeyA":       {"row": 2, "col": 1,  "label": "A"},
    "KeyS":       {"row": 2, "col": 2,  "label": "S"},
    "KeyD":       {"row": 2, "col": 3,  "label": "D"},
    "KeyF":       {"row": 2, "col": 4,  "label": "F"},
    "KeyG":       {"row": 2, "col": 5,  "label": "G"},
    "KeyH":       {"row": 2, "col": 6,  "label": "H"},
    "KeyJ":       {"row": 2, "col": 7,  "label": "J"},
    "KeyK":       {"row": 2, "col": 8,  "label": "K"},
    "KeyL":       {"row": 2, "col": 9,  "label": "L"},
    "Semicolon":  {"row": 2, "col": 10, "label": ";"},
    "Quote":      {"row": 2, "col": 11, "label": "'"},
    "Enter":      {"row": 2, "col": 12, "label": "回车"},
    # 第四行
    "ShiftLeft":  {"row": 3, "col": 0,  "label": "Shift"},
    "KeyZ":       {"row": 3, "col": 1,  "label": "Z"},
    "KeyX":       {"row": 3, "col": 2,  "label": "X"},
    "KeyC":       {"row": 3, "col": 3,  "label": "C"},
    "KeyV":       {"row": 3, "col": 4,  "label": "V"},
    "KeyB":       {"row": 3, "col": 5,  "label": "B"},
    "KeyN":       {"row": 3, "col": 6,  "label": "N"},
    "KeyM":       {"row": 3, "col": 7,  "label": "M"},
    "Comma":      {"row": 3, "col": 8,  "label": ","},
    "Period":     {"row": 3, "col": 9,  "label": "."},
    "Slash":      {"row": 3, "col": 10, "label": "/"},
    "ShiftRight": {"row": 3, "col": 11, "label": "Shift"},
    # 第五行
    "ControlLeft":  {"row": 4, "col": 0,  "label": "Ctrl"},
    "AltLeft":      {"row": 4, "col": 1,  "label": "Alt"},
    "Space":        {"row": 4, "col": 2,  "label": "空格"},
    "AltRight":     {"row": 4, "col": 3,  "label": "Alt"},
    "ControlRight": {"row": 4, "col": 4,  "label": "Ctrl"},
}