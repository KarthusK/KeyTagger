import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useKeymap } from './store/keymapContext'
import KeymapKeyboard from './components/Keyboard'
import ImageExportModal from './components/ImageExportModal'
import { formatOverwriteTooltip } from './utils/overwriteTooltip'
import { UploadIcon, SunIcon, MoonIcon, JsonIcon } from './components/icons'

// 键盘总键数：与后端 QWERTY_LAYOUT 一致（71 键），用于「已设置 23 / 71」的进度表达
const TOTAL_KEYS = 71

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('kt-theme') === 'dark' ? 'dark' : 'light')
  // 用 layout effect 写 data-theme：在浏览器绘制前生效（避免首屏闪白），
  // 且早于子组件的 useEffect，保证同一轮渲染里各处读到的都是新主题
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : ''
  }, [theme])
  useEffect(() => {
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
      <header className="site-head">
        <div>
          <p className="wordmark">
            Key<span className="accent">Tagger</span>
          </p>
          <p className="tagline">上传键位截图，识别成可编辑的键盘图</p>
        </div>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main>
        <section aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="visually-hidden">上传键位截图</h2>
          {fileInput}
          {/* 上传槽是语义化按钮：可 Tab 聚焦、Enter/Space 触发；内部用 span 保持合法嵌套 */}
          <button
            type="button"
            className={`upload-slot${keyCount > 0 ? ' is-compact' : ''}` +
              `${dragActive ? ' is-drop-active' : ''}${loading ? ' is-busy' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-describedby={keyCount === 0 ? 'upload-formats upload-privacy' : undefined}
          >
            {/* 空闲态与加载态叠放在同一网格单元：识别中隐藏空闲态但保留占位，上传槽尺寸不变 */}
            <span className="slot-idle">
              <span className="slot-icon">
                <UploadIcon size={18} />
              </span>
              <span className="slot-body">
                <span className="slot-title">拖入截图，或点此选择文件</span>
                {/* 首次使用给出完整格式说明；已有结果后收成一行，把版面还给键盘 */}
                {keyCount === 0 ? (
                  <>
                    <span className="slot-meta" id="upload-formats">
                      PNG / JPG / WebP / BMP 截图 · .json 键位文件 · 可拖到页面任意位置
                    </span>
                    <span className="slot-meta" id="upload-privacy">
                      导入 JSON 会覆盖同名键位 · 全程仅在本机处理
                    </span>
                  </>
                ) : (
                  <span className="slot-meta">
                    PNG / JPG / WebP / BMP · .json · 全程仅在本机处理
                  </span>
                )}
              </span>
            </span>
            <span className="slot-busy">
              <span className="spinner" aria-hidden="true" />
              <span className="slot-title" role="status">
                {importing ? '正在导入…' : '正在识别…'}
              </span>
            </span>
          </button>
          {notice && <div className="alert alert-notice" role="status">{notice.text}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
        </section>

        <section
          className={`plate plate-board${background ? ' has-bg' : ''}`}
          style={background ? { backgroundImage: `url("${background.src}")` } : undefined}
          aria-labelledby="board-heading"
        >
          <div className="plate-head">
            <div className="plate-leading">
              <h2 className="plate-title" id="board-heading">键盘布局</h2>
              <span className="key-tally">
                已设置 <b>{keyCount}</b> / {TOTAL_KEYS} 键
              </span>
            </div>
            <div className="plate-actions">
              <button
                className={`btn btn-key${confirmingReset ? ' btn-danger' : ''}`}
                onClick={handleResetClick}
                disabled={keyCount === 0}
                title="清空全部按键绑定（需再点一次确认）"
              >
                {confirmingReset ? '确认清空？' : '清空绑定'}
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
                className="btn btn-key"
                onClick={() => bgInputRef.current?.click()}
                title={background ? '更换键盘与生成图片的背景' : '为键盘布局与生成图片设置同一张背景'}
              >
                背景图
              </button>
              {background && (
                <span className="bg-chip">
                  <span className="bg-chip-name" title={backgroundName}>{backgroundName}</span>
                  <button
                    type="button"
                    className="bg-chip-x"
                    onClick={clearBackground}
                    aria-label={`移除背景图 ${backgroundName}`}
                    title="移除背景图，恢复纯色键盘"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                className="btn btn-key"
                onClick={exportKeymap}
                disabled={keyCount === 0}
                title="把当前键位导出为 keymap.json（可再次导入）"
              >
                导出 JSON
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setImageModalOpen(true)}
                disabled={keyCount === 0}
                title="按当前键盘生成键位图，可复制到剪贴板或下载 PNG"
              >
                生成图片
              </button>
            </div>
          </div>
          {keyCount === 0 && (
            <p className="board-empty">
              还没有识别结果。上传一张键位截图，或导入 <b>keymap.json</b> 开始。
            </p>
          )}
          <div className="board-scroll">
            <KeymapKeyboard />
          </div>
          <p className="hint">
            点击按键编辑功能，拖动已设置的按键可换位
            {/* 窄屏下键盘在自己的容器里横滚，这里明确说出来，避免以为内容被裁掉 */}
            <span className="scroll-tip">· 左右滑动查看整张键盘</span>
          </p>
        </section>

        {uploads.length > 0 && (
          <section className="records" aria-labelledby="records-heading">
            <div className="records-head">
              <h2 className="plate-title" id="records-heading">本次记录</h2>
              <span className="key-tally">共 {uploads.length} 条</span>
            </div>
            <div className="records-list">
              {uploads.map((item) => {
                const clickable = item.kind === 'image'
                const Row = clickable ? 'button' : 'div'
                return (
                  <Row
                    key={item.key}
                    {...(clickable ? { type: 'button', onClick: () => setPreviewUrl(item.url) } : {})}
                    className={`record${clickable ? '' : ' is-static'}${item.refreshed ? ' is-fresh' : ''}`}
                    title={clickable ? '点击查看原图' : 'JSON 键位文件'}
                  >
                    {item.kind === 'json' ? (
                      <span className="record-thumb record-json" aria-hidden="true">
                        <JsonIcon size={22} />
                      </span>
                    ) : (
                      <img src={item.url} className="record-thumb" alt="" />
                    )}
                    <span className="record-name">{item.name}</span>
                    <span className="record-count">
                      {item.kind === 'json' ? '导入' : '识别'} <b>{item.count}</b> 键
                    </span>
                    {item.overwritten > 0 && (
                      <span
                        className="record-over"
                        title={formatOverwriteTooltip(item.overwrites)}
                      >
                        覆盖 <b>{item.overwritten}</b>
                      </span>
                    )}
                  </Row>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {previewUrl && (
        <div
          className="lightbox"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="截图原图预览"
        >
          <img src={previewUrl} alt="截图原图" />
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
