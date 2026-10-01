import React, { useEffect, useRef, useState } from 'react'
import { useKeymap } from './store/keymapContext'
import KeymapKeyboard from './components/Keyboard'
import ImageExportModal from './components/ImageExportModal'
import { formatOverwriteTooltip } from './utils/overwriteTooltip'
import { UploadIcon, SunIcon, MoonIcon, JsonIcon } from './components/icons'

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('kt-theme') === 'dark' ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : ''
    localStorage.setItem('kt-theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

// 记录去重键：优先用文件内容哈希（SHA-256）识别同一文件，改名/复制后的相同图片也能归并；
// crypto.subtle 不可用（非安全上下文，如局域网 http 访问）时退化为 文件名+大小
async function getFileKey(file) {
  if (file && crypto?.subtle) {
    try {
      const buf = await file.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', buf)
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch (e) {
      // 读取/摘要失败时走兜底键，保证去重仍生效
    }
  }
  return `${file?.name || ''}|${file?.size || 0}`
}

export default function App() {
  const {
    keymap, loading, error, upload, importKeymap, export: exportKeymap, reset,
    background, backgroundName, chooseBackground, clearBackground,
  } = useKeymap()
  const [theme, toggleTheme] = useTheme()
  const fileInputRef = useRef(null)
  const bgInputRef = useRef(null)
  const resetTimerRef = useRef(null)
  const dragDepthRef = useRef(0)
  const objectUrlsRef = useRef([])
  const recordIdRef = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const [importing, setImporting] = useState(false) // 当前是否在处理 JSON 导入（决定加载文案）
  const [uploads, setUploads] = useState([]) // 本次会话上传过的截图 / 导入过的 JSON，最新在前
  const [previewUrl, setPreviewUrl] = useState(null) // lightbox 当前展示的图
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [notice, setNotice] = useState(null) // 重复文件替换记录时的临时提示 { text, key }
  const noticeTimerRef = useRef(null)
  const [imageModalOpen, setImageModalOpen] = useState(false) // 生成图片弹窗

  const keyCount = Object.values(keymap).filter((m) => m.function).length

  // 卸载时统一释放 objectURL 并清理提示计时器
  useEffect(() => () => {
    clearTimeout(resetTimerRef.current)
    clearTimeout(noticeTimerRef.current)
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const handleFile = async (file) => {
    if (!file || loading) return
    const isJson = file.type === 'application/json' ||
      (file.name && file.name.toLowerCase().endsWith('.json'))
    setImporting(isJson)
    // 等处理完成再入列，失败时不进记录区（错误横幅已提示）
    const result = isJson ? await importKeymap(file) : await upload(file)
    setImporting(false)
    if (result === null) return
    const key = await getFileKey(file)
    addRecord(file, isJson ? 'json' : 'image', result.count, key, result.overwritten, result.overwrites)
  }

  // 重复文件替换记录时的临时提示：显示文案并高亮对应行约 3 秒后自动消失
  const showRefreshNotice = (text, key) => {
    setNotice({ text, key })
    clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null)
      setUploads((prev) => prev.map((it) => (
        it.key === key && it.refreshed ? { ...it, refreshed: false } : it
      )))
    }, 3000)
  }

  // 同一文件（内容哈希相同）重复上传时替换原记录：移到最前、刷新名称/按键数/覆盖数/缩略图，
  // 释放旧 objectURL，并给出「已重新识别/导入」提示 + 短暂高亮被刷新的行
  const addRecord = (file, kind, count, key, overwritten = 0, overwrites = []) => {
    const id = ++recordIdRef.current
    const replaced = uploads.some((it) => it.key === key)
    setUploads((prev) => {
      const old = prev.find((it) => it.key === key)
      if (old?.url) {
        URL.revokeObjectURL(old.url)
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== old.url)
      }
      const rec = { id, key, name: file.name, kind, count, overwritten, overwrites, refreshed: replaced }
      if (kind === 'image') {
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        rec.url = url
      }
      return [rec, ...prev.filter((it) => it.key !== key)]
    })
    if (replaced) {
      const text = kind === 'json'
        ? `已重新导入「${file.name}」，记录已刷新`
        : `已重新识别「${file.name}」，记录已刷新`
      showRefreshNotice(text, key)
    }
  }

  // 全窗口拖拽上传：只接管「文件」拖拽。绝不能干预内部元素拖拽（如键位拖拽），
  // 否则 window 级 dragover 会把键盘设好的 dropEffect='move' 覆盖成 'copy'，
  // 与 dragstart 的 effectAllowed='move' 冲突导致 drop 不触发（键位拖拽失效）。
  useEffect(() => {
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const onDragEnter = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepthRef.current += 1
      setDragActive(true)
    }
    const onDragOver = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e) => {
      if (!hasFiles(e)) return // 与 dragenter 配对，保证计数平衡
      e.preventDefault()
      dragDepthRef.current -= 1
      if (dragDepthRef.current <= 0) {
        dragDepthRef.current = 0
        setDragActive(false)
      }
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return // 键位拖拽不进入上传逻辑
      e.preventDefault()
      dragDepthRef.current = 0
      setDragActive(false)
      handleFile(e.dataTransfer?.files?.[0])
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [loading, upload, importKeymap])

  useEffect(() => {
    if (!previewUrl) return
    const onKey = (e) => e.key === 'Escape' && setPreviewUrl(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewUrl])

  const handleResetClick = () => {
    if (!confirmingReset) {
      setConfirmingReset(true)
      resetTimerRef.current = setTimeout(() => setConfirmingReset(false), 3000)
      return
    }
    clearTimeout(resetTimerRef.current)
    setConfirmingReset(false)
    reset()
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,.json,application/json"
      onChange={(e) => handleFile(e.target.files[0])}
      hidden
    />
  )

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            Key<span className="accent">Tagger</span>
          </h1>
          <p className="subtitle">上传游戏键位截图，自动识别并可视化编辑</p>
        </div>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换到浅色' : '切换到暗色'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main className="main">
        <section className="upload-section">
          {fileInput}
          <div
            className={`upload-zone ${dragActive ? 'drop-active' : ''} ${loading ? 'uploading' : ''}`}
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            {/* 空闲态与加载态叠放在同一网格单元：识别中隐藏空闲态但保留占位，上传区尺寸不变 */}
            <div className="upload-idle">
              <span className="upload-icon-sm">
                <UploadIcon size={20} />
              </span>
              <span className="upload-text">点击或拖拽截图或键位文件到此处上传</span>
              <span className="upload-hints">
                <span className="upload-hint">支持 PNG / JPG / WebP / BMP 截图与 .json 键位文件 · 可拖到页面任意位置</span>
                <span className="upload-hint">导入 JSON 会覆盖对应键位 · 仅在本地处理</span>
              </span>
            </div>
            <div className="upload-loading">
              <div className="spinner" />
              <span className="upload-text">{importing ? '正在导入中...' : '正在识别中...'}</span>
            </div>
          </div>
          {notice && <div className="notice-message" role="status">{notice.text}</div>}
          {error && <div className="error-message">{error}</div>}
        </section>

        <section
          className={`keyboard-section${background ? ' has-bg' : ''}`}
          style={background ? { backgroundImage: `url("${background.src}")` } : undefined}
        >
          <div className="section-header">
            <h2>键盘布局</h2>
            <div className="section-actions">
              <span className="key-count">已识别 {keyCount} 个按键</span>
              <button
                className={`btn ${confirmingReset ? 'btn-reset-armed' : 'btn-secondary'}`}
                onClick={handleResetClick}
                disabled={keyCount === 0}
                title="清空全部按键绑定（需再点一次确认）"
              >
                {confirmingReset ? '确认重置？' : '重置'}
              </button>
              {/* 背景图同时作用于屏幕键盘与生成图片（同一套规则与效果） */}
              <input
                ref={bgInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp"
                onChange={(e) => {
                  chooseBackground(e.target.files[0])
                  e.target.value = '' // 重置 value，允许重复选择同一文件
                }}
                hidden
              />
              <button
                className="btn btn-teal"
                onClick={() => bgInputRef.current?.click()}
                title={background
                  ? `当前背景：${backgroundName}（点击更换）`
                  : '为键盘布局与生成图片设置同一张背景'}
              >
                {background ? '更换背景' : '选择背景'}
              </button>
              {background && (
                <button className="link-btn" onClick={clearBackground} title="移除背景，恢复纯色键盘">
                  移除
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={exportKeymap}
                disabled={keyCount === 0}
                title="把当前键位导出为 keymap.json（可再次导入）"
              >
                导出 JSON
              </button>
              <button
                className="btn btn-success"
                onClick={() => setImageModalOpen(true)}
                disabled={keyCount === 0}
                title="按当前键盘生成键位图，可复制到剪贴板或下载 PNG"
              >
                生成图片
              </button>
            </div>
          </div>
          <KeymapKeyboard />
          <p className="keyboard-hint">点击任意按键可编辑其功能名称，拖拽已绑定按键可移动到其他按键上</p>
        </section>

        {uploads.length > 0 && (
          <section className="shots-section">
            <div className="section-header">
              <h2>导入记录</h2>
              <span className="key-count">点击截图可查看原图</span>
            </div>
            <div className="shots-list">
              {uploads.map((item) => (
                <div
                  key={item.key}
                  className={`shot-row ${item.refreshed ? 'shot-row-fresh' : ''}`}
                  onClick={() => item.kind === 'image' && setPreviewUrl(item.url)}
                  title={item.kind === 'image' ? '点击查看原图' : 'JSON 键位文件'}
                >
                  {item.kind === 'json' ? (
                    <span className="shot-thumb shot-thumb-json">
                      <JsonIcon size={24} />
                    </span>
                  ) : (
                    <img src={item.url} className="shot-thumb" alt={item.name} />
                  )}
                  <span className="shot-name">{item.name}</span>
                  <span className="shot-count">
                    {item.kind === 'json'
                      ? <>已导入 <b>{item.count}</b> 个按键</>
                      : <>已识别 <b>{item.count}</b> 个按键</>}
                  </span>
                  {item.overwritten > 0 && (
                    <span
                      className="shot-overwrite"
                      title={formatOverwriteTooltip(item.overwrites)}
                    >
                      覆盖 <b>{item.overwritten}</b> 个
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {previewUrl && (
        <div className="lightbox" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="截图预览" />
        </div>
      )}

      {imageModalOpen && (
        <ImageExportModal
          keymap={keymap}
          background={background}
          onClose={() => setImageModalOpen(false)}
        />
      )}
    </div>
  )
}
