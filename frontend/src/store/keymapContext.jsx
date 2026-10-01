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
        // 返回本次识别出的键位数、其中覆盖的键位数与覆盖明细；失败时返回 null 由调用方区分
        return {
          count: data.mapped_count ?? 0,
          overwritten: data.overwritten_count ?? 0,
          overwrites: data.overwrites ?? [],
        }
      }
      return null
    } catch (e) {
      setError(e.response?.data?.detail || '上传或识别失败，请重试')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const handleImport = useCallback(async (file) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.importKeymap(file)
      if (data.success) {
        setKeymap(data.keymap)
        // 返回本次导入的键位数、其中覆盖的键位数与覆盖明细；失败时返回 null 由调用方区分
        return {
          count: data.imported_count ?? 0,
          overwritten: data.overwritten_count ?? 0,
          overwrites: data.overwrites ?? [],
        }
      }
      return null
    } catch (e) {
      setError(e.response?.data?.detail || '导入失败，请检查 JSON 文件格式')
      return null
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

  const handleMoveKey = useCallback(async (source, target) => {
    setError(null)
    try {
      const data = await api.moveKey(source, target)
      if (data.success) {
        setKeymap(data.keymap)
      }
    } catch (e) {
      setError(e.response?.data?.detail || '移动绑定失败，请重试')
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
      importKeymap: handleImport,
      updateKey: handleUpdateKey,
      moveKey: handleMoveKey,
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