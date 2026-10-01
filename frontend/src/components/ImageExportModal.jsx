import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND, measureKeyboard, renderKeymapImage, resolveTitle, SCALE } from '../utils/keymapImage'
import { SunIcon, MoonIcon } from './icons'

// 生成键位图弹窗：自定义标题 + 可选右下角署名 + 共享背景，实时预览，支持复制到剪贴板与下载
// theme 仅作为重绘依赖：切换浅色/深色主题时，导出图配色随之刷新（配色由 Canvas 读 CSS 变量取得）
export default function ImageExportModal({ keymap, background, theme, onToggleTheme, onClose }) {
  const [title, setTitle] = useState('')       // 留空则用项目名兜底
  const [watermark, setWatermark] = useState(true)
  const [status, setStatus] = useState(null)   // { type: 'ok' | 'error', text }
  const [measured, setMeasured] = useState(null) // 屏幕键盘实测尺寸，用于同比例复刻
  const [zoom, setZoom] = useState(null)       // 放大层：{ src, width }，width 为逻辑宽
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

  // 键位/标题/水印/尺寸/背景/主题变化即重绘预览（绘制耗时毫秒级，无需防抖）
  // 配色从预览容器的 data-theme 解析（见 JSX），不依赖全局主题何时写入 <html>，避免慢一拍
  useEffect(() => {
    const canvas = renderKeymapImage({
      keymap,
      title: effectiveTitle,
      watermark,
      measured,
      background,
      paletteRoot: previewRef.current,
    })
    canvasRef.current = canvas
    if (previewRef.current) previewRef.current.replaceChildren(canvas)
  }, [keymap, effectiveTitle, watermark, measured, background, theme])

  // Esc 分层：放大层打开时先关放大层，否则关弹窗
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (zoom) setZoom(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, zoom])

  const toBlob = useCallback(() => new Promise((resolve) => {
    const canvas = canvasRef.current
    if (!canvas) { resolve(null); return }
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  }), [])

  // 点击预览放大：lightbox 最大按 1:1 逻辑尺寸展示整图（物理宽 = 逻辑宽 × SCALE）
  const openZoom = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) setZoom({ src: canvas.toDataURL('image/png'), width: canvas.width / SCALE })
  }, [])

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
    <>
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

          {/* data-theme 直接声明在预览容器上：配色只取决于这里的主题，不受全局主题写入时机影响 */}
          <div
            className="image-preview"
            ref={previewRef}
            data-theme={theme}
            onClick={openZoom}
            title="点击放大查看"
          />

          {status && (
            <div className={status.type === 'ok' ? 'notice-message' : 'error-message'} role="status">
              {status.text}
            </div>
          )}

          <div className="edit-actions">
            <button className="btn btn-secondary" onClick={onClose} title="关闭弹窗（Esc）">
              关闭
            </button>
            <div className="edit-actions-right">
              <button
                className="icon-btn"
                onClick={onToggleTheme}
                title={theme === 'dark' ? '切换到浅色主题（导出图配色随之切换）' : '切换到深色主题（导出图配色随之切换）'}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleDownload}
                title="保存到本地，文件名为 keymap.png"
              >
                下载 PNG
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCopy}
                title="复制到剪贴板，可直接粘贴到聊天窗口或画图"
              >
                复制图片
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 放大层与弹窗 overlay 平级：点击背景只关放大层；z-index 1100 盖在弹窗（1000）之上 */}
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          <img src={zoom.src} alt="生成图预览" style={{ maxWidth: `min(${zoom.width}px, 94vw)` }} />
        </div>
      )}
    </>
  )
}
