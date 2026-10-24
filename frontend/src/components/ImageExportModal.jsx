import React, { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND, measureKeyboard, renderKeymapImage, resolveTitle, SCALE } from '../utils/keymapImage'
import { SunIcon, MoonIcon } from './icons'

// 生成键位图弹窗：自定义标题 + 可选右下角署名 + 共享背景，实时预览，支持复制到剪贴板与下载
// 「图片配色」是弹窗内的独立状态：只影响预览与导出的图片，不改动全站主题。
// 机制与全站主题一致——配色由 Canvas 读取 preview 容器上的 data-theme 决定（见 paletteRoot）。
export default function ImageExportModal({ keymap, background, onClose }) {
  const [title, setTitle] = useState('')       // 留空则用项目名兜底
  const [watermark, setWatermark] = useState(true)
  const [status, setStatus] = useState(null)   // { type: 'ok' | 'error', text }
  const [measured, setMeasured] = useState(null) // 屏幕键盘实测尺寸，用于同比例复刻
  const [zoom, setZoom] = useState(null)       // 放大层：{ src, width }，width 为逻辑宽
  // 导出配色：初值跟随当前全站主题，之后仅在本弹窗内变化
  const [exportTheme, setExportTheme] = useState(
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
  )
  const previewRef = useRef(null)
  const canvasRef = useRef(null)
  const modalRef = useRef(null)
  const restoreFocusRef = useRef(null)

  const effectiveTitle = resolveTitle(title)

  // 打开时量取屏幕键盘尺寸；窗口尺寸变化后重新量取，保证图片与界面始终同比例
  useEffect(() => {
    const remeasure = () => setMeasured(measureKeyboard())
    remeasure()
    window.addEventListener('resize', remeasure)
    return () => window.removeEventListener('resize', remeasure)
  }, [])

  // 键位/标题/水印/尺寸/背景/导出配色变化即重绘预览（绘制耗时毫秒级，无需防抖）
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
  }, [keymap, effectiveTitle, watermark, measured, background, exportTheme])

  // 关闭后把焦点还给打开弹窗的按钮
  useEffect(() => {
    restoreFocusRef.current = document.activeElement
    const input = modalRef.current?.querySelector('input')
    if (input) input.focus()
    return () => {
      const target = restoreFocusRef.current
      if (target && document.contains(target) && typeof target.focus === 'function') {
        target.focus()
      }
    }
  }, [])

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
      setStatus({ type: 'ok', text: '已复制到剪贴板，可直接粘贴' })
    } catch (e) {
      setStatus({ type: 'error', text: '当前环境不支持复制到剪贴板，请改用「下载 PNG」' })
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

  const dark = exportTheme === 'dark'

  return (
    <>
      <div className="modal-layer" onClick={onClose}>
        <div
          className="modal modal-image"
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
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
          <h3 className="modal-title" id="export-title">生成图片</h3>
          <p className="modal-hint">按当前键盘生成键位图，可复制到剪贴板或下载 PNG</p>

          <div className="image-form">
            <label className="field">
              <span className="field-label">图片标题</span>
              <input
                className="text-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={BRAND.name}
              />
              <span className="field-hint">留空则使用项目名 {BRAND.name}</span>
            </label>
            <div className="image-row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={watermark}
                  onChange={(e) => setWatermark(e.target.checked)}
                />
                <span>附带署名（{BRAND.name} · {BRAND.url}）</span>
              </label>
              {/* 只改导出图的配色，不影响全站主题 */}
              <button
                type="button"
                className="btn btn-key"
                onClick={() => setExportTheme(dark ? 'light' : 'dark')}
                aria-pressed={dark}
                title="只切换这张图的配色，全站主题保持不变"
              >
                {dark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
                图片配色：{dark ? '深色' : '浅色'}
              </button>
            </div>
          </div>

          {/* data-theme 直接声明在预览容器上：配色只取决于这里的值，不受全站主题写入时机影响 */}
          <div
            className="preview"
            ref={previewRef}
            data-theme={exportTheme}
            onClick={openZoom}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openZoom()
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="放大查看生成的键位图"
            title="点击放大查看"
          />

          {status && (
            <div
              className={status.type === 'ok' ? 'alert alert-notice' : 'alert alert-error'}
              role={status.type === 'ok' ? 'status' : 'alert'}
            >
              {status.text}
            </div>
          )}

          <div className="modal-foot">
            <button className="btn btn-key" onClick={onClose} title="关闭弹窗（Esc）">
              关闭
            </button>
            <div className="modal-foot-right">
              <button className="btn btn-key" onClick={handleDownload} title="保存到本地，文件名为 keymap.png">
                下载 PNG
              </button>
              <button className="btn btn-primary" onClick={handleCopy} title="复制到剪贴板，可直接粘贴到聊天窗口或画图">
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
