import { getToken } from './auth'

const resolveApiBase = () => {
  let apiBase = "http://localhost:8000"

  try {
    const raw = import.meta.env.VITE_API_URL || ''
    if (raw && typeof raw === 'string') {
      if (/^https?:\/\//.test(raw)) {
        apiBase = raw
      } else if (/^:\d+/.test(raw)) {
        if (typeof window !== 'undefined') {
          apiBase = `${window.location.protocol}//${window.location.hostname}${raw}`
        } else {
          apiBase = `http://localhost${raw}`
        }
      } else if (raw.startsWith('//')) {
        apiBase = typeof window !== 'undefined' ? `${window.location.protocol}${raw}` : `http:${raw}`
      } else if (/^[A-Za-z0-9.-]+:\d+$/.test(raw) && typeof window !== 'undefined') {
        apiBase = `${window.location.protocol}//${raw}`
      } else if (/^[A-Za-z0-9.-]+(:\d+)?$/.test(raw)) {
        apiBase = `http://${raw}`
      } else if (raw.length > 0) {
        apiBase = raw
      } else if (typeof window !== 'undefined') {
        apiBase = window.location.origin
      }
    } else if (typeof window !== 'undefined') {
      apiBase = window.location.origin
    }
  } catch {
    // Keep the localhost fallback when env parsing fails.
  }

  return apiBase
}

const API_BASE = resolveApiBase()

export const createTask = async (task) => {
  const url = `${API_BASE}/tasks`
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(task)
  })
  if (!res.ok) throw new Error('Failed to create task')
  return await res.json()
}

export const getTasksForUser = async () => {
  const token = getToken()
  const url = `${API_BASE}/tasks`
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const res = await fetch(url, { headers, credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return await res.json()
}

export const updateTask = async (taskId, patch) => {
  const url = `${API_BASE}/tasks/${encodeURIComponent(taskId)}`
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(patch)
  })
  if (!res.ok) throw new Error('Failed to update task')
  return await res.json()
}
