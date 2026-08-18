import React from 'react'
import ReactDOM from 'react-dom/client'
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