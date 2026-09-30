import React, { useEffect, useRef, useState } from 'react'
import { useKeymap } from './store/keymapContext'
import KeymapKeyboard from './components/Keyboard'
import { UploadIcon, SunIcon, MoonIcon, JsonIcon } from './components/icons'

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('kt-theme') === 'dark' ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : ''
    localStorage.setItem('kt-theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export default function App() {
  const { keymap, loading, error, upload, importKeymap, export: exportKeymap, reset } = useKeymap()
  const [theme, toggleTheme] = useTheme()
  const fileInputRef = useRef(null)
  const resetTimerRef = useRef(null)
  const dragDepthRef = useRef(0)
  const objectUrlsRef = useRef([])
  const recordIdRef = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const [importing, setImporting] = useState(false) // 当前是否在处理 JSON 导入（决定加载文案）
  const [uploads, setUploads] = useState([]) // 本次会话上传过的截图 / 导入过的 JSON，最新在前
  const [previewUrl, setPreviewUrl] = useState(null) // lightbox 当前展示的图
  const [confirmingReset, setConfirmingReset] = useState(false)

  const keyCount = Object.values(keymap).filter((m) => m.function).length

  // 卸载时统一释放 objectURL
  useEffect(() => () => {
    clearTimeout(resetTimerRef.current)
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const handleFile = async (file) => {
    if (!file || loading) return
    const isJson = file.type === 'application/json' ||
      (file.name && file.name.toLowerCase().endsWith('.json'))
    setImporting(isJson)
    // 等处理完成再入列，失败时不进记录区（错误横幅已提示）
    const count = isJson ? await importKeymap(file) : await upload(file)
    setImporting(false)
    if (count === null) return
    const id = ++recordIdRef.current
    if (isJson) {
      setUploads((prev) => [{ id, name: file.name, kind: 'json', count }, ...prev])
    } else {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      setUploads((prev) => [{ id, name: file.name, url, kind: 'image', count }, ...prev])
    }
  }

  // 全窗口拖拽上传：文件拖到页面任意位置松手即可，拖拽期间顶部上传区高亮
  useEffect(() => {
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const onDragEnter = (e) => {
      e.preventDefault()
      if (hasFiles(e)) {
        dragDepthRef.current += 1
        setDragActive(true)
      }
    }
    const onDragOver = (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e) => {
      e.preventDefault()
      dragDepthRef.current -= 1
      if (dragDepthRef.current <= 0) {
        dragDepthRef.current = 0
        setDragActive(false)
      }
    }
    const onDrop = (e) => {
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
            {loading ? (
              <>
                <div className="spinner" />
                <span className="upload-text">{importing ? '正在导入中...' : '正在识别中...'}</span>
              </>
            ) : (
              <>
                <span className="upload-icon-sm">
                  <UploadIcon size={20} />
                </span>
                <span className="upload-text">点击或拖拽截图或键位文件到此处上传</span>
                <span className="upload-hint">PNG / JPG / WebP / BMP 截图 · .json 键位文件 · 可在页面任意位置拖放</span>
                <span className="upload-hint">导入 JSON 会覆盖对应的键位（其余保持不变） · 仅在本地处理</span>
              </>
            )}
          </div>
          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="keyboard-section">
          <div className="section-header">
            <h2>键盘布局</h2>
            <div className="section-actions">
              <span className="key-count">已识别 {keyCount} 个按键</span>
              <button
                className={`btn ${confirmingReset ? 'btn-reset-armed' : 'btn-secondary'}`}
                onClick={handleResetClick}
                disabled={keyCount === 0}
              >
                {confirmingReset ? '确认重置？' : '重置'}
              </button>
              <button className="btn btn-primary" onClick={exportKeymap} disabled={keyCount === 0}>
                导出 JSON
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
                  key={item.id}
                  className="shot-row"
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
    </div>
  )
}
