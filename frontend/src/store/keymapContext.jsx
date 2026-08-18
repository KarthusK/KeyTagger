import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import * as api from '../api/client'

const KeymapContext = createContext(null)

export function KeymapProvider({ children }) {
  const [keymap, setKeymap] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getKeymap().then((data) => {
      if (data.success) {
        setKeymap(data.keymap)
      }
    }).catch(() => {})
  }, [])

  const handleUpload = useCallback(async (file) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.uploadImage(file)
      if (data.success) {
        setKeymap(data.keymap)
      }
    } catch (e) {
      setError(e.response?.data?.detail || '上传或识别失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleUpdateKey = useCallback(async (keyName, functionName) => {
    setError(null)
    try {
      const data = await api.updateKey(keyName, functionName)
      if (data.success) {
        setKeymap(data.keymap)
      }
    } catch (e) {
      setError(e.response?.data?.detail || '更新失败，请重试')
    }
  }, [])

  const handleExport = useCallback(async () => {
    try {
      const blob = await api.exportKeymap()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'keymap.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError('导出失败，请重试')
    }
  }, [])

  const handleReset = useCallback(async () => {
    setError(null)
    try {
      const data = await api.resetKeymap()
      if (data.success) {
        setKeymap(data.keymap)
      }
    } catch (e) {
      setError(e.response?.data?.detail || '重置失败')
    }
  }, [])

  return (
    <KeymapContext.Provider value={{
      keymap, loading, error,
      upload: handleUpload,
      updateKey: handleUpdateKey,
      export: handleExport,
      reset: handleReset,
    }}>
      {children}
    </KeymapContext.Provider>
  )
}

export function useKeymap() {
  const ctx = useContext(KeymapContext)
  if (!ctx) throw new Error('useKeymap 必须在 KeymapProvider 内使用')
  return ctx
}