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

// 功能名的纯文本版（用于按钮的 title / aria-label）：去掉空白并限长，避免提示框过宽
function plainFunction(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

export default function KeymapKeyboard() {
  const { keymap, moveKey, updateKey } = useKeymap()
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const kRef = useRef(null)
  const dragSourceRef = useRef(null)
  const dragElementRef = useRef(null)
  const dropTargetRef = useRef(null)
  const editModalRef = useRef(null)
  const restoreFocusRef = useRef(null) // 弹窗关闭后把焦点还给触发它的按键

  // 同步每个按键的可拖拽状态、title 与 aria-label：
  // 键盘是 71 个真实 <button>（useButtonTag），读屏与 Tab 都能到达，
  // 需要一个能说清「哪个键、绑了什么」的可访问名称
  useEffect(() => {
    const kb = kRef.current
    if (!kb) return
    Object.entries(KEY_MAP).forEach(([button, keyName]) => {
      const elements = kb.getButtonElement(button)
      const list = Array.isArray(elements) ? elements : [elements]
      const fn = plainFunction(keymap[keyName]?.function)
      const label = keymap[keyName]?.label || keyName
      list.forEach((el) => {
        if (!el) return
        el.draggable = Boolean(fn)
        el.title = fn ? `${label}：${fn}` : `${label}（未设置，点击编辑）`
        el.setAttribute('aria-label', fn ? `${label}，已设置：${fn}` : `${label}，未设置`)
      })
    })
  }, [keymap])

  const display = useMemo(() => {
    const d = {}
    for (const [layoutKey, keyName] of Object.entries(KEY_MAP)) {
      const mapping = keymap[keyName]
      if (mapping?.function) {
        // 功能名为主内容（CSS 限 2 行截断，全文见按钮 title），原键帽标签缩为右下角标
        d[layoutKey] = `<span class="hg-key-fn">${escapeHtml(mapping.function)}</span><span class="hg-key-tag">${escapeHtml(mapping.label)}</span>`
      } else {
        d[layoutKey] = escapeHtml(mapping?.label || keyName)
      }
    }
    return d
  }, [keymap])

  // 本批写入的键做一次「印刷上色」：keymap 变化时对比上一次的绑定，只让新增/改写的键动
  const prevKeymapRef = useRef({})
  const freshTimerRef = useRef(null)
  useEffect(() => {
    const kb = kRef.current
    const prev = prevKeymapRef.current
    prevKeymapRef.current = keymap
    if (!kb) return
    const changed = Object.keys(keymap).filter(
      (keyName) => (keymap[keyName]?.function || '') !== (prev[keyName]?.function || ''),
    )
    if (!changed.length) return
    changed.slice(0, 71).forEach((keyName, index) => {
      const button = Object.keys(KEY_MAP).find((b) => KEY_MAP[b] === keyName)
      if (!button) return
      const el = kb.getButtonElement(button)
      const list = Array.isArray(el) ? el : [el]
      list.forEach((node) => {
        if (!node) return
        // 错峰 12ms，总时长封顶：只用 opacity/filter，不动 transform 与尺寸
        node.style.animationDelay = `${Math.min(index * 12, 320)}ms`
        node.classList.remove('hg-key-fresh')
        // 强制重排以重启动画（同一键连续两次写入也能重放）
        void node.offsetWidth
        node.classList.add('hg-key-fresh')
      })
    })
    clearTimeout(freshTimerRef.current)
    freshTimerRef.current = setTimeout(() => {
      const instance = kRef.current
      if (!instance) return
      Object.keys(KEY_MAP).forEach((button) => {
        const el = instance.getButtonElement(button)
        const list = Array.isArray(el) ? el : [el]
        list.forEach((node) => {
          if (!node) return
          node.classList.remove('hg-key-fresh')
          node.style.animationDelay = ''
        })
      })
    }, 700)
  }, [keymap])

  useEffect(() => () => clearTimeout(freshTimerRef.current), [])

  const boundButtons = Object.entries(KEY_MAP)
    .filter(([, kn]) => keymap[kn]?.function)
    .map(([k]) => k)
    .join(' ')

  const getPointedKey = useCallback((e) => {
    const el = e.target.closest('[data-skbtn]')
    const keyName = el && KEY_MAP[el.dataset.skbtn]
    return { el, keyName }
  }, [])

  const handleKeyPress = useCallback(() => {
    // 点击由下方的原生 click 统一处理（见 handleClick）；
    // 键盘上的 Enter/Space 会同时触发 click 与 keyPress，这里不重复开弹窗
  }, [])

  const openEditor = useCallback((keyName, el) => {
    restoreFocusRef.current = el || null
    setEditingKey(keyName)
    setEditValue(keymap[keyName]?.function || '')
  }, [keymap])

  const handleClick = useCallback((e) => {
    const { el, keyName } = getPointedKey(e)
    if (!keyName) return
    openEditor(keyName, el)
  }, [getPointedKey, openEditor])

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

  const handleUnbind = useCallback(() => {
    if (editingKey) {
      updateKey(editingKey, '')
    }
    setEditingKey(null)
    setEditValue('')
  }, [editingKey, updateKey])

  // 弹窗打开时把焦点移入输入框，关闭后归还给触发它的按键
  useEffect(() => {
    if (editingKey) {
      const input = editModalRef.current?.querySelector('input')
      if (input) input.focus()
      return
    }
    const target = restoreFocusRef.current
    if (target && document.contains(target)) {
      target.focus()
    }
    restoreFocusRef.current = null
  }, [editingKey])

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

  const editLabel = editingKey ? (keymap[editingKey]?.label || editingKey) : ''
  const editFn = editingKey ? (keymap[editingKey]?.function || '') : ''

  return (
    <div
      className="keyboard-container"
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {/* useButtonTag：71 个键是真实 <button>，可 Tab 聚焦、Enter/Space 打开编辑 */}
      <Keyboard
        keyboardRef={(instance) => { kRef.current = instance }}
        layout={LAYOUT}
        display={display}
        onKeyPress={handleKeyPress}
        useButtonTag
        buttonTheme={boundButtons ? [{ class: 'hg-key-has-function', buttons: boundButtons }] : []}
      />

      {editingKey && (
        <div className="modal-layer" onClick={handleCancel}>
          <div
            className="modal modal-edit"
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // 焦点陷阱：Tab 只在弹窗内循环，避免跑到背后的键盘上
              if (e.key !== 'Tab') return
              const focusables = e.currentTarget.querySelectorAll(
                'button, input, [tabindex]:not([tabindex="-1"])',
              )
              if (!focusables.length) return
              const first = focusables[0]
              const last = focusables[focusables.length - 1]
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
              }
            }}
          >
            <h3 className="modal-title" id="edit-title">
              编辑按键
              <span className="key-badge">{editLabel}</span>
            </h3>
            <p className="modal-hint">
              {editFn ? `当前功能：${plainFunction(editFn)}` : '这个按键还没有功能名称'}
            </p>
            <label className="field">
              <span className="visually-hidden">功能名称</span>
              <input
                className="text-input"
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例如：前进、跳跃、开火…"
              />
            </label>
            <div className="modal-foot">
              {editFn && (
                <button
                  className="btn btn-danger-quiet"
                  onClick={handleUnbind}
                  title="清空该按键的功能名称"
                >
                  解除绑定
                </button>
              )}
              <div className="modal-foot-right">
                <button
                  className="btn btn-key"
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
