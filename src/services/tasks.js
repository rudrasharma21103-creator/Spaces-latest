import { getToken, getStoredUser } from './auth'

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

export const createTask = async (task) => {
  const url = `${API_BASE}/tasks`
  const token = getToken()
  const stored = getStoredUser()
  const uid = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { 'X-User-Id': String(uid) } : {})
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(task)
  })
  if (!res.ok) throw new Error('Failed to create task')
  return await res.json()
}

export const getTasksForUser = async (userId) => {
  const url = `${API_BASE}/tasks?userId=${encodeURIComponent(userId)}`
  const token = getToken()
  const stored = getStoredUser()
  const uid = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { 'X-User-Id': String(uid) } : {})
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return await res.json()
}

export const updateTask = async (taskId, patch) => {
  const url = `${API_BASE}/tasks/${encodeURIComponent(taskId)}`
  const token = getToken()
  const stored = getStoredUser()
  const uid = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(uid ? { 'X-User-Id': String(uid) } : {})
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch)
  })
  if (!res.ok) throw new Error('Failed to update task')
  return await res.json()
}
