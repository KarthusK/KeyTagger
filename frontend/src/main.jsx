import React from 'react'
import ReactDOM from 'react-dom/client'
// 库样式必须先于全局样式导入：打包时后导入的同特异性规则会覆盖库的 .hg-theme-default 背景
import 'react-simple-keyboard/build/css/index.css'
import './styles.css'
import App from './App'
import { KeymapProvider } from './store/keymapContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <KeymapProvider>
      <App />
    </KeymapProvider>
  </React.StrictMode>
)