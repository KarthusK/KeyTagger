import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { useKeymap } from '../store/keymapContext'

const LAYOUT = {
  default: [
    '{esc} f1 f2 f3 f4 f5 f6 f7 f8 f9 f10 f11 f12',
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{caps} a s d f g h j k l ; \' {enter}',
    '{shiftl} z x c v b n m , . / {shiftr}',
    '{ctrll} {altl} {space} {altr} {ctrlr}',
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
  '{shiftl}': 'ShiftLeft', 'z': 'KeyZ', 'x': 'KeyX', 'c': 'KeyC',
  'v': 'KeyV', 'b': 'KeyB', 'n': 'KeyN', 'm': 'KeyM',
  ',': 'Comma', '.': 'Period', '/': 'Slash',
  '{shiftr}': 'ShiftRight',
  '{ctrll}': 'ControlLeft', '{ctrlr}': 'ControlRight',
  '{altl}': 'AltLeft', '{altr}': 'AltRight', '{space}': 'Space',
}

const MAX_FN_PER_LINE = 4
const NO_WRAP_KEYS = new Set(['ControlLeft', 'AltLeft', 'Space', 'AltRight', 'ControlRight'])

function wrapFnText(text) {
  const parts = []
  for (let i = 0; i < text.length; i += MAX_FN_PER_LINE) {
    parts.push(text.slice(i, i + MAX_FN_PER_LINE))
  }
  return parts.join('<br>')
}

export default function KeymapKeyboard() {
  const { keymap, moveKey, updateKey } = useKeymap()
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const kRef = useRef(null)
  const pendingEditRef = useRef(null)
  const dragSourceRef = useRef(null)
  const dragElementRef = useRef(null)
  const dropTargetRef = useRef(null)

  useEffect(() => {
    const kb = kRef.current
    if (!kb) return
    Object.entries(KEY_MAP).forEach(([button, keyName]) => {
      const elements = kb.getButtonElement(button)
      const list = Array.isArray(elements) ? elements : [elements]
      const draggable = Boolean(keymap[keyName]?.function)
      list.forEach((el) => {
        if (el) el.draggable = draggable
      })
    })
  }, [keymap])

  const display = useMemo(() => {
    const d = {}
    for (const [layoutKey, keyName] of Object.entries(KEY_MAP)) {
      const mapping = keymap[keyName]
      if (mapping?.function) {
        const noWrap = NO_WRAP_KEYS.has(keyName)
        const fnClass = noWrap ? 'hg-key-fn hg-key-fn-nowrap' : 'hg-key-fn'
        const fnText = noWrap ? mapping.function : wrapFnText(mapping.function)
        d[layoutKey] = `<span class="hg-key-label">${mapping.label}</span><span class="${fnClass}"><span class="hg-key-fn-text">${fnText}</span></span>`
      } else {
        d[layoutKey] = mapping?.label || keyName
      }
    }
    return d
  }, [keymap])

  const boundButtons = Object.entries(KEY_MAP)
    .filter(([, kn]) => keymap[kn]?.function)
    .map(([k]) => k)
    .join(' ')

  const getPointedKey = useCallback((e) => {
    const el = e.target.closest('[data-skbtn]')
    const keyName = el && KEY_MAP[el.dataset.skbtn]
    return { el, keyName }
  }, [])

  const handleKeyPress = useCallback((button) => {
    const keyName = KEY_MAP[button]
    if (!keyName) return
    pendingEditRef.current = keyName
  }, [])

  const handleClick = useCallback((e) => {
    const { keyName } = getPointedKey(e)
    pendingEditRef.current = null
    if (!keyName) return
    setEditingKey(keyName)
    setEditValue(keymap[keyName]?.function || '')
  }, [getPointedKey, keymap])

  const handleSave = useCallback(() => {
    pendingEditRef.current = null
    if (editingKey) {
      updateKey(editingKey, editValue)
    }
    setEditingKey(null)
    setEditValue('')
  }, [editingKey, editValue, updateKey])

  const handleCancel = useCallback(() => {
    pendingEditRef.current = null
    setEditingKey(null)
    setEditValue('')
  }, [])

  const clearDragHighlights = useCallback(() => {
    if (dropTargetRef.current) {
      dropTargetRef.current.classList.remove('hg-drop-target')
      dropTargetRef.current = null
    }
    if (dragElementRef.current) {
      dragElementRef.current.classList.remove('hg-dragging')
      dragElementRef.current = null
    }
  }, [])

  const handleDragStart = useCallback((e) => {
    pendingEditRef.current = null
    const { el, keyName } = getPointedKey(e)
    if (!keyName || !keymap[keyName]?.function) {
      e.preventDefault()
      return
    }
    dragSourceRef.current = keyName
    dragElementRef.current = el
    e.dataTransfer.setData('text/plain', keyName)
    e.dataTransfer.effectAllowed = 'move'
    el.classList.add('hg-dragging')
  }, [getPointedKey, keymap])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const { el, keyName } = getPointedKey(e)
    if (!el || !keyName || keyName === dragSourceRef.current) return
    if (dropTargetRef.current && dropTargetRef.current !== el) {
      dropTargetRef.current.classList.remove('hg-drop-target')
      dropTargetRef.current = null
    }
    if (!el.classList.contains('hg-drop-target')) {
      el.classList.add('hg-drop-target')
      dropTargetRef.current = el
    }
  }, [getPointedKey])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    pendingEditRef.current = null
    const { keyName: targetKey } = getPointedKey(e)
    const sourceKey = dragSourceRef.current || e.dataTransfer.getData('text/plain')
    clearDragHighlights()
    dragSourceRef.current = null
    if (sourceKey && targetKey && sourceKey !== targetKey) {
      moveKey(sourceKey, targetKey)
    }
  }, [getPointedKey, moveKey, clearDragHighlights])

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null
    clearDragHighlights()
  }, [clearDragHighlights])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }, [handleSave, handleCancel])

  return (
    <div
      className="keyboard-container"
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <Keyboard
        keyboardRef={(instance) => { kRef.current = instance }}
        layout={LAYOUT}
        display={display}
        onKeyPress={handleKeyPress}
        buttonTheme={boundButtons ? [{ class: 'hg-key-has-function', buttons: boundButtons }] : []}
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