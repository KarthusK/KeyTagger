// 内联 SVG 图标：线条风格，颜色跟随 currentColor，避免 emoji 跨平台渲染不一致
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function UploadIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    </svg>
  )
}

export function SunIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2m0 15v2M4.8 4.8l1.4 1.4m11.6 11.6l1.4 1.4M2.5 12h2m15 0h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a7 7 0 0 0 9.7 9.7z" />
    </svg>
  )
}
