import React, { useRef, useState } from 'react'
import { useKeymap } from './store/keymapContext'
import KeymapKeyboard from './components/Keyboard'

export default function App() {
  const { keymap, loading, error, upload, export: exportKeymap, reset } = useKeymap()
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')

  const keyCount = Object.values(keymap).filter((m) => m.function).length

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    upload(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  return (
    <div className="app">
      <header className="header">
        <h1>KeyTagger</h1>
        <p className="subtitle">游戏键位可视化编辑工具 — 上传截图，自动识别，一键导出</p>
      </header>

      <main className="main">
        <section className="upload-section">
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp"
              onChange={(e) => handleFile(e.target.files[0])}
              hidden
            />
            <div className="upload-icon">
              {loading ? '⏳' : '📁'}
            </div>
            <p className="upload-text">
              {loading ? '正在识别中...' : fileName || '点击或拖拽截图到此处上传'}
            </p>
            <p className="upload-hint">支持 PNG / JPG / WebP / BMP 格式</p>
          </div>
          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="keyboard-section">
          <div className="section-header">
            <h2>键盘布局</h2>
            <div className="section-actions">
              <span className="key-count">已识别 {keyCount} 个按键</span>
              <button className="btn btn-secondary" onClick={reset} disabled={keyCount === 0}>
                重置
              </button>
              <button className="btn btn-primary" onClick={exportKeymap} disabled={keyCount === 0}>
                导出 JSON
              </button>
            </div>
          </div>
          <KeymapKeyboard />
          <p className="keyboard-hint">点击任意按键可编辑其功能名称，拖拽已绑定按键可移动到其他按键上</p>
        </section>
      </main>
    </div>
  )
}