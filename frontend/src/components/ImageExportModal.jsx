import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND, measureKeyboard, renderKeymapImage, resolveTitle } from '../utils/keymapImage'

// 生成键位图弹窗：自定义标题 + 可选右下角署名，实时预览，支持复制到剪贴板与下载
export default function ImageExportModal({ keymap, onClose }) {
  const [title, setTitle] = useState('')       // 留空则用项目名兜底
  const [watermark, setWatermark] = useState(true)
  const [status, setStatus] = useState(null)   // { type: 'ok' | 'error', text }
  const [measured, setMeasured] = useState(null) // 屏幕键盘实测尺寸，用于同比例复刻
  const previewRef = useRef(null)
  const canvasRef = useRef(null)

  const effectiveTitle = resolveTitle(title)

  // 打开时量取屏幕键盘尺寸；窗口尺寸变化后重新量取，保证图片与界面始终同比例
  useEffect(() => {
    const remeasure = () => setMeasured(measureKeyboard())
    remeasure()
    window.addEventListener('resize', remeasure)
    return () => window.removeEventListener('resize', remeasure)
  }, [])

  // 键位/标题/水印/尺寸变化即重绘预览（绘制耗时毫秒级，无需防抖）
  useEffect(() => {
    const canvas = renderKeymapImage({ keymap, title: effectiveTitle, watermark, measured })
    canvasRef.current = canvas
    if (previewRef.current) previewRef.current.replaceChildren(canvas)
  }, [keymap, effectiveTitle, watermark, measured])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toBlob = useCallback(() => new Promise((resolve) => {
    const canvas = canvasRef.current
    if (!canvas) { resolve(null); return }
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  }), [])

  const handleCopy = useCallback(async () => {
    setStatus(null)
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('clipboard unsupported')
      }
      const blob = await toBlob()
      if (!blob) throw new Error('canvas toBlob failed')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus({ type: 'ok', text: '已复制到剪贴板' })
    } catch (e) {
      setStatus({ type: 'error', text: '当前环境不支持复制到剪贴板，请使用「下载 PNG」' })
    }
  }, [toBlob])

  const handleDownload = useCallback(async () => {
    setStatus(null)
    const blob = await toBlob()
    if (!blob) {
      setStatus({ type: 'error', text: '图片生成失败，请重试' })
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'keymap.png'
    a.click()
    URL.revokeObjectURL(url)
    setStatus({ type: 'ok', text: '已开始下载 keymap.png' })
  }, [toBlob])

  return (
    <div className="edit-overlay" onClick={onClose}>
      <div className="edit-modal image-modal" onClick={(e) => e.stopPropagation()}>
        <h3>生成图片</h3>
        <p className="edit-hint">按当前键盘生成键位图，可复制到剪贴板或下载 PNG</p>

        <div className="image-form">
          <label className="image-field">
            <span className="image-field-label">图片标题</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={BRAND.name}
              autoFocus
            />
            <span className="image-field-hint">留空则默认使用项目名 {BRAND.name}</span>
          </label>
          <label className="image-check">
            <input
              type="checkbox"
              checked={watermark}
              onChange={(e) => setWatermark(e.target.checked)}
            />
            <span>附带水印（{BRAND.name} · {BRAND.url}）</span>
          </label>
        </div>

        <div className="image-preview" ref={previewRef} />

        {status && (
          <div className={status.type === 'ok' ? 'notice-message' : 'error-message'} role="status">
            {status.text}
          </div>
        )}

        <div className="edit-actions">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          <div className="edit-actions-right">
            <button className="btn btn-secondary" onClick={handleDownload}>下载 PNG</button>
            <button className="btn btn-primary" onClick={handleCopy}>复制图片</button>
          </div>
        </div>
      </div>
    </div>
  )
}
