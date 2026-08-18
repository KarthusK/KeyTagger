import React, { useState, useMemo, useCallback } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { useKeymap } from '../store/keymapContext'

const LAYOUT = {
  default: [
    '{esc} f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12',
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{caps} a s d f g h j k l ; \' {enter}',
    '{shift} z x c v b n m , . / {shift}',
    '{ctrl} {alt} {space} {alt} {ctrl}',
  ],
}

const KEY_MAP = {
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
  '{shift}': 'ShiftLeft', 'z': 'KeyZ', 'x': 'KeyX', 'c': 'KeyC',
  'v': 'KeyV', 'b': 'KeyB', 'n': 'KeyN', 'm': 'KeyM',
  ',': 'Comma', '.': 'Period', '/': 'Slash',
  '{ctrl}': 'ControlLeft', '{alt}': 'AltLeft', '{space}': 'Space',
}

export default function KeymapKeyboard() {
  const { keymap, updateKey } = useKeymap()
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')

  const display = useMemo(() => {
    const d = {}
    for (const [layoutKey, keyName] of Object.entries(KEY_MAP)) {
      const mapping = keymap[keyName]
      if (mapping?.function) {
        d[layoutKey] = `${mapping.label}<br><span class="hg-key-fn">${mapping.function}</span>`
      } else {
        d[layoutKey] = mapping?.label || keyName
      }
    }
    return d
  }, [keymap])

  const handleKeyPress = useCallback((button) => {
    const keyName = KEY_MAP[button]
    if (!keyName) return
    const mapping = keymap[keyName]
    setEditingKey(keyName)
    setEditValue(mapping?.function || '')
  }, [keymap])

  const handleSave = useCallback(() => {
    if (editingKey) {
      updateKey(editingKey, editValue)
    }
    setEditingKey(null)
    setEditValue('')
  }, [editingKey, editValue, updateKey])

  const handleCancel = useCallback(() => {
    setEditingKey(null)
    setEditValue('')
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }, [handleSave, handleCancel])

  return (
    <div className="keyboard-container">
      <Keyboard
        layout={LAYOUT}
        display={display}
        onKeyPress={handleKeyPress}
        buttonTheme={[
          {
            class: 'hg-key-has-function',
            buttons: Object.entries(KEY_MAP)
              .filter(([, kn]) => keymap[kn]?.function)
              .map(([k]) => k)
              .join(' '),
          },
        ]}
      />

      {editingKey && (
        <div className="edit-overlay" onClick={handleCancel}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑按键：{keymap[editingKey]?.label || editingKey}</h3>
            <p className="edit-hint">输入该按键对应的游戏功能名称</p>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如：前进、跳跃、开火..."
              autoFocus
            />
            <div className="edit-actions">
              <button className="btn btn-secondary" onClick={handleCancel}>取消</button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}