import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { useKeymap } from '../store/keymapContext'
// 布局与按键映射来自共享模块，与后端 config.py 的 QWERTY_LAYOUT 一一对应
import { LAYOUT, KEY_MAP } from '../utils/keyLayout'

// 功能文本经 innerHTML 注入按钮，先转义防止 OCR/用户输入中的特殊字符破坏结构
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
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
      const fn = keymap[keyName]?.function || ''
      list.forEach((el) => {
        if (el) {
          el.draggable = Boolean(fn)
          el.title = fn
        }
      })
    })
  }, [keymap])

  const display = useMemo(() => {
    const d = {}
    for (const [layoutKey, keyName] of Object.entries(KEY_MAP)) {
      const mapping = keymap[keyName]
      if (mapping?.function) {
        // 功能名为主内容（CSS 限 2 行截断，全文见按钮 title），原键帽标签缩为右下角标
        d[layoutKey] = `<span class="hg-key-fn">${escapeHtml(mapping.function)}</span><span class="hg-key-tag">${mapping.label}</span>`
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

  const handleUnbind = useCallback(() => {
    if (editingKey) {
      updateKey(editingKey, '')
    }
    pendingEditRef.current = null
    setEditingKey(null)
    setEditValue('')
  }, [editingKey, updateKey])

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
    if (!dragSourceRef.current) return // 只接管键位自身的拖拽，避免影响文件拖入本区域的放置
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
            <h3>
              编辑按键
              <span className="edit-key-badge">{keymap[editingKey]?.label || editingKey}</span>
            </h3>
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
              {keymap[editingKey]?.function && (
                <button
                  className="btn btn-danger-ghost"
                  onClick={handleUnbind}
                  title="清空该按键的功能名称"
                >
                  解除绑定
                </button>
              )}
              <div className="edit-actions-right">
                <button
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  title="关闭弹窗，不保存修改（Esc）"
                >
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  title="保存该按键的功能名称（Enter）"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}