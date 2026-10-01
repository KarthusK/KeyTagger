// 键盘布局单一数据源（前端侧）
// 与后端 config.py 的 QWERTY_LAYOUT 一一对应：按键名统一用浏览器 KeyboardEvent.code（如 KeyW），
// 改一边必须同步另一边。屏幕键盘（components/Keyboard.jsx）与生成图片（utils/keymapImage.js）都从这里取布局。

export const LAYOUT = {
  default: [
    '{esc} f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12',
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{caps} a s d f g h j k l ; \' {enter}',
    '{shiftl} z x c v b n m , . / {shiftr}',
    '{ctrll} {altl} {space} {altr} {ctrlr}',
  ],
}

export const KEY_MAP = {
  '{esc}': 'Escape', 'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4',
  'f5': 'F5', 'f6': 'F6', 'f7': 'F7', 'f8': 'F8',
  'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
  '`': 'Backquote', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3',
  '4': 'Digit4', '5': 'Digit5', '6': 'Digit6', '7': 'Digit7',
  '8': 'Digit8', '9': 'Digit9', '0': 'Digit0', '-': 'Minus',
  '=': 'Equal', '{bksp}': 'Backspace',
  '{tab}': 'Tab', 'q': 'KeyQ', 'w': 'KeyW', 'e': 'KeyE',
  'r': 'KeyR', 't': 'KeyT', 'y': 'KeyY', 'u': 'KeyU',
  'i': 'KeyI', 'o': 'KeyO', 'p': 'KeyP', '[': 'BracketLeft',
  ']': 'BracketRight', '\\': 'Backslash',
  '{caps}': 'CapsLock', 'a': 'KeyA', 's': 'KeyS', 'd': 'KeyD',
  'f': 'KeyF', 'g': 'KeyG', 'h': 'KeyH', 'j': 'KeyJ',
  'k': 'KeyK', 'l': 'KeyL', ';': 'Semicolon', "'": 'Quote',
  '{enter}': 'Enter',
  '{shiftl}': 'ShiftLeft', 'z': 'KeyZ', 'x': 'KeyX', 'c': 'KeyC',
  'v': 'KeyV', 'b': 'KeyB', 'n': 'KeyN', 'm': 'KeyM',
  ',': 'Comma', '.': 'Period', '/': 'Slash',
  '{shiftr}': 'ShiftRight',
  '{ctrll}': 'ControlLeft', '{ctrlr}': 'ControlRight',
  '{altl}': 'AltLeft', '{altr}': 'AltRight', '{space}': 'Space',
}

// 把 LAYOUT.default 逐行解析为结构化数据：[{ button, keyName }]
export function buildRows() {
  return LAYOUT.default.map((row) => row.split(' ').map((button) => ({
    button,
    keyName: KEY_MAP[button],
  })))
}
