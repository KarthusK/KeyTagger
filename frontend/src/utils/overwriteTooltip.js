// 覆盖明细 → 角标悬停提示文本（纯函数，无 DOM 依赖，便于在 Node 中校验）

// 压掉换行与连续空白，保证"一行一条"不被内容自身换行破坏
function flatten(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * 把覆盖明细格式化为多行提示文本：
 *   W: 前进 → 冲刺
 *   F1: aaa → BBB
 * 超过 maxLines 条时只列前 maxLines 条，并以「…共 N 个覆盖」收尾。
 *
 * @param {Array<{key_name: string, label?: string, from: string, to: string}>} overwrites
 * @param {{maxLines?: number}} [options]
 * @returns {string} 空数组返回空字符串
 */
export function formatOverwriteTooltip(overwrites, { maxLines = 12 } = {}) {
  const list = Array.isArray(overwrites) ? overwrites : []
  if (!list.length) return ''

  const lines = list.slice(0, maxLines).map((item) => {
    const name = flatten(item?.label) || flatten(item?.key_name)
    return `${name}: ${flatten(item?.from)} → ${flatten(item?.to)}`
  })
  if (list.length > maxLines) lines.push(`…共 ${list.length} 个覆盖`)
  return lines.join('\n')
}
