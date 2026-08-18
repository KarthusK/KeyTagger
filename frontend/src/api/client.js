import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function getKeymap() {
  const res = await api.get('/keymap')
  return res.data
}

export async function updateKey(keyName, functionName) {
  const res = await api.put('/keymap', {
    key_name: keyName,
    function: functionName,
  })
  return res.data
}

export async function moveKey(source, target) {
  const res = await api.post('/keymap/move', {
    source,
    target,
  })
  return res.data
}

export async function exportKeymap() {
  const res = await api.post('/export', {}, { responseType: 'blob' })
  return res.data
}

export async function resetKeymap() {
  const res = await api.post('/reset')
  return res.data
}

export default api