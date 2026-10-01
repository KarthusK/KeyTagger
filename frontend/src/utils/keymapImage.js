// 键位图生成：纯几何计算（可在 Node 中校验）+ 浏览器端 Canvas 绘制
// 键宽不按 ANSI 比例臆造，而是直接量取屏幕上真实键盘的尺寸——界面里特殊键（{esc}/{bksp}/{shiftl}/{space}…）
// 是 hg-functionBtn，没有 width 规则、由内容撑开，与普通键（hg-standardBtn，width:20px + flex-grow:1）
// 各分一份剩余空间，只有实测才能保证图片与界面同比例。
import { buildRows, KEY_MAP } from './keyLayout.js'

// 项目品牌署名（换仓库/改名只需改这里），署名绘制在图片右下角
// nameParts 与主界面标题一致：首段用正文色、其余段用主色（Key 黑 + Tagger 蓝）
export const BRAND = {
  name: 'KeyTagger',
  nameParts: ['Key', 'Tagger'],
  url: 'github.com/KarthusK/KeyTagger',
}

// 标题兜底：未手动填写（空或仅空白）时默认使用项目名
export function resolveTitle(title) {
  return String(title || '').trim() || BRAND.name
}

// 版面常量（逻辑像素，输出整体 × scale）
const PAD = 36          // 四周留白
const TITLE_BLOCK = 96  // 标题区高度
const FOOTER = 62       // 署名区高度（开启水印时占用底部空间）
const KEY_R = 6         // 键圆角（对齐界面 6px）
const BORDER_TOP = 1    // 键描边 1px
const BORDER_BOTTOM = 3 // 界面键帽的 border-bottom-width: 3px

// 量不到屏幕键盘时的兜底尺寸（取值同样对齐界面 CSS）
const FALLBACK_KEY_H = 54
const FALLBACK_GAP = 5
const FALLBACK_ROW_GAP = 5

export const SCALE = 2  // 输出倍率（2 倍分辨率，文字更清晰）
// 键盘区目标宽度：对应界面 .simple-keyboard 的 max-width:1150px 减去容器 5px×2 内边距
export const KEYBOARD_W = 1140

// 字体与页面保持一致：优先读取页面 CSS 变量 --font-sans，读不到时用兜底栈（Node/无 DOM 环境）
const FALLBACK_FONT = '"Microsoft YaHei", "PingFang SC", "Segoe UI", system-ui, sans-serif'

function pageFont() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return FALLBACK_FONT
  const value = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
  return value || FALLBACK_FONT
}

// 固定浅色配色，与 styles.css 的设计令牌一致（导出图不跟随应用深浅色）
const COLOR = {
  bg: '#ffffff',
  keyBg: '#ffffff',      // --key-bg
  keyBorder: '#e2e5ea',  // --key-border
  keyText: '#374151',    // --key-text
  boundBg: '#eef2ff',    // --primary-soft
  boundBorder: '#c7d2fe',// --primary-border
  text: '#111827',       // --text
  accent: '#4f46e5',     // --primary
  muted: '#9ca3af',      // --text-muted
}

// 量取屏幕上真实键盘的尺寸：行、每键宽度、键间距、行距、键高
export function measureKeyboard() {
  if (typeof document === 'undefined') return null
  const root = document.querySelector('.simple-keyboard')
  if (!root) return null
  const rowEls = Array.from(root.querySelectorAll('.hg-row'))
  if (!rowEls.length) return null

  const rows = []
  const rowRects = []
  let totalWidth = 0
  let keyHeight = 0

  rowEls.forEach((rowEl) => {
    const btnEls = Array.from(rowEl.querySelectorAll('.hg-button[data-skbtn]'))
    if (!btnEls.length) return
    const rects = btnEls.map((el) => el.getBoundingClientRect())
    const keys = btnEls.map((el, i) => {
      const token = el.getAttribute('data-skbtn')
      return { token, keyName: KEY_MAP[token] || token, width: rects[i].width }
    })
    // 行内相邻左边界差 - 当前键宽 = 键间距（取首个正值，避免小数误差）
    let gap = 0
    for (let i = 1; i < rects.length; i += 1) {
      const g = rects[i].left - rects[i - 1].left - rects[i - 1].width
      if (g > 0.5) { gap = g; break }
    }
    totalWidth = Math.max(totalWidth, rects[rects.length - 1].right - rects[0].left)
    keyHeight = Math.max(keyHeight, rects[0].height)
    rowRects.push(rowEl.getBoundingClientRect())
    rows.push({ keys, gap })
  })

  if (!rows.length || totalWidth <= 0 || keyHeight <= 0) return null

  // 行距：相邻行上边界差 - 行高
  let rowGap = 0
  for (let i = 1; i < rowRects.length; i += 1) {
    const g = rowRects[i].top - rowRects[i - 1].bottom
    if (g > 0.5) { rowGap = g; break }
  }

  return { rows, totalWidth, keyHeight, rowGap }
}

// 纯几何计算：返回画布尺寸、每个键的框、署名的右对齐锚点（不依赖 DOM）
export function computeGeometry({ title, watermark, measured } = {}) {
  const hasMeasured = Boolean(measured && measured.rows && measured.rows.length)
  const srcRows = hasMeasured
    ? measured.rows.map((row) => ({ gap: row.gap, keys: row.keys, widths: row.keys.map((k) => k.width) }))
    : buildRows().map((keys) => ({ gap: FALLBACK_GAP, keys, widths: null }))

  // 水平归一化：把实测键盘缩放到固定目标宽度（桌面宽度下 K = 1，即 1:1 复刻）
  const K = hasMeasured && measured.totalWidth > 0 ? KEYBOARD_W / measured.totalWidth : 1
  const keyH = hasMeasured && measured.keyHeight > 0 ? measured.keyHeight : FALLBACK_KEY_H
  const rowGap = hasMeasured && measured.rowGap > 0 ? measured.rowGap : FALLBACK_ROW_GAP

  const rows = srcRows.length
  const hasTitle = Boolean(String(title || '').trim())
  const width = KEYBOARD_W + PAD * 2
  const height = PAD
    + (hasTitle ? TITLE_BLOCK : 0)
    + rows * keyH
    + (rows - 1) * rowGap
    + (watermark ? FOOTER : PAD)

  const boxes = []
  const rowKeyCounts = []
  let y = PAD + (hasTitle ? TITLE_BLOCK : 0)

  srcRows.forEach((row) => {
    const gap = row.gap * K
    const widths = row.widths
      ? row.widths.map((w) => w * K)
      : row.keys.map(() => (KEYBOARD_W - gap * (row.keys.length - 1)) / row.keys.length)
    const rowW = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1)
    let x = PAD + (KEYBOARD_W - rowW) / 2 // 行内水平居中
    row.keys.forEach((k, i) => {
      boxes.push({ token: k.token, keyName: k.keyName, x, y, w: widths[i], h: keyH })
      x += widths[i] + gap
    })
    rowKeyCounts.push(row.keys.length)
    y += keyH + rowGap
  })

  return {
    width,
    height,
    keyHeight: keyH,
    rowGap,
    K,
    rowKeyCounts,
    boxes,
    titleY: hasTitle ? PAD + TITLE_BLOCK / 2 : null,
    // 署名右对齐于画布右内边距；urlY 为第二行基线
    signature: watermark
      ? { x: width - PAD, y: height - FOOTER + 26, urlY: height - FOOTER + 48 }
      : null,
  }
}

// 圆角矩形路径（用 arcTo，避免依赖 ctx.roundRect）
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// 按字符贪心换行，最多 maxLines 行；放不下时在最后一行加省略号（对齐屏幕 .hg-key-fn 的 2 行 clamp）
function wrapText(ctx, text, maxWidth, maxLines) {
  const chars = Array.from(String(text))
  const lines = []
  let cur = ''
  for (let i = 0; i < chars.length; i += 1) {
    const next = cur + chars[i]
    if (cur && ctx.measureText(next).width > maxWidth) {
      if (lines.length === maxLines - 1) {
        let last = cur
        while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
        lines.push(`${last}…`)
        return lines
      }
      lines.push(cur)
      cur = chars[i]
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// 标题：单行居中，超宽自动缩字号，仍放不下则截断加省略号
function drawTitle(ctx, text, cx, cy, maxWidth, font) {
  let size = 34
  while (size > 20) {
    ctx.font = `700 ${size}px ${font}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 1
  }
  ctx.font = `700 ${size}px ${font}`
  let out = String(text)
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1)
  if (out !== text) out = `${out}…`
  ctx.fillStyle = COLOR.text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(out, cx, cy)
}

// 绘制键位图，返回离屏 canvas（浏览器环境）
export function renderKeymapImage({ keymap = {}, title = '', watermark = true, scale = SCALE, measured } = {}) {
  const effectiveTitle = resolveTitle(title)
  // measured 显式传入时以传入值为准（含 null 表示走兜底）；未传则现场量取
  const metrics = measured === undefined ? measureKeyboard() : measured
  const geo = computeGeometry({ title: effectiveTitle, watermark, measured: metrics })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(geo.width * scale)
  canvas.height = Math.round(geo.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  const font = pageFont() // 与页面同款字体，保证导出图与界面一致

  ctx.fillStyle = COLOR.bg
  ctx.fillRect(0, 0, geo.width, geo.height)

  if (geo.titleY !== null) {
    drawTitle(ctx, effectiveTitle, geo.width / 2, geo.titleY, geo.width - PAD * 2, font)
  }

  geo.boxes.forEach((box) => {
    const mapping = keymap[box.keyName]
    const fn = mapping?.function || ''
    const label = mapping?.label || box.keyName || box.token
    const borderColor = fn ? COLOR.boundBorder : COLOR.keyBorder
    const fillColor = fn ? COLOR.boundBg : COLOR.keyBg

    // 先按边框色填充整个圆角矩形，再叠一层内层圆角矩形 → 得到 1px 描边 + 3px 底边（界面的键帽观感）
    roundRectPath(ctx, box.x, box.y, box.w, box.h, KEY_R)
    ctx.fillStyle = borderColor
    ctx.fill()
    roundRectPath(
      ctx,
      box.x + BORDER_TOP,
      box.y + BORDER_TOP,
      box.w - BORDER_TOP * 2,
      box.h - BORDER_TOP - BORDER_BOTTOM,
      Math.max(1, KEY_R - BORDER_TOP),
    )
    ctx.fillStyle = fillColor
    ctx.fill()

    // 内容区中心：对齐 .hg-button 的 padding(4px 6px 7px) 与 1px/3px 边框
    const centerY = box.y + (box.h - 5) / 2
    const maxTextW = Math.max(8, box.w - 14)

    if (fn) {
      // 已绑定：功能名居中（最多 2 行，对齐 .hg-key-fn 的 11px/1.3/2 行），键帽标签缩到右下角
      ctx.font = `600 11px ${font}`
      const lines = wrapText(ctx, fn, maxTextW, 2)
      ctx.fillStyle = COLOR.text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const lineH = 14.3
      const startY = centerY - ((lines.length - 1) * lineH) / 2
      lines.forEach((line, i) => ctx.fillText(line, box.x + box.w / 2, startY + i * lineH))

      ctx.font = `600 9px ${font}`
      ctx.fillStyle = COLOR.accent
      ctx.globalAlpha = 0.85
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(label, box.x + box.w - 4, box.y + box.h - 3)
      ctx.globalAlpha = 1
    } else {
      // 未绑定：只显示键帽标签（对齐界面 13px/400 与 --key-text）
      ctx.font = `400 13px ${font}`
      ctx.fillStyle = COLOR.keyText
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, box.x + box.w / 2, centerY)
    }
  })

  if (geo.signature) {
    // 项目名分两段着色（与主界面标题同款：Key 用 --text，Tagger 用 --primary），整体右对齐
    ctx.textBaseline = 'alphabetic'
    ctx.font = `700 17px ${font}`
    const parts = BRAND.nameParts && BRAND.nameParts.length ? BRAND.nameParts : [BRAND.name]
    const totalW = parts.reduce((sum, part) => sum + ctx.measureText(part).width, 0)
    let tx = geo.signature.x - totalW
    ctx.textAlign = 'left'
    parts.forEach((part, i) => {
      ctx.fillStyle = i === 0 ? COLOR.text : COLOR.accent
      ctx.fillText(part, tx, geo.signature.y)
      tx += ctx.measureText(part).width
    })

    ctx.textAlign = 'right'
    ctx.font = `400 13px ${font}`
    ctx.fillStyle = COLOR.muted
    ctx.fillText(BRAND.url, geo.signature.x, geo.signature.urlY)
  }

  return canvas
}
