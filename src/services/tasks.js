import { getStoredUser, getToken } from './auth'

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

const getTasksCacheKey = () => {
  const stored = getStoredUser()
  const uid = stored && (stored.id || stored._id || (stored._id && stored._id.$oid) || stored.userId)
  return `spaces_tasks_${uid ? String(uid) : "guest"}`
}

const readCachedTasks = () => {
  try {
    const raw = localStorage.getItem(getTasksCacheKey())
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeCachedTasks = tasks => {
  try {
    localStorage.setItem(getTasksCacheKey(), JSON.stringify(Array.isArray(tasks) ? tasks : []))
  } catch {
    // Cache writes are best effort only.
  }
}

const mergeTaskLists = (...lists) => {
  const merged = new Map()
  lists.flat().forEach(task => {
    if (!task || task.id === undefined || task.id === null) return
    merged.set(String(task.id), task)
  })
  return Array.from(merged.values())
}

export const peekTasksForUser = () => readCachedTasks()

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
  const savedTask = await res.json()
  writeCachedTasks(mergeTaskLists([savedTask], readCachedTasks()))
  return savedTask
}

export const getTasksForUser = async () => {
  const cachedTasks = readCachedTasks()
  const token = getToken()
  const url = `${API_BASE}/tasks`
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  try {
    const res = await fetch(url, { headers, credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch tasks')
    const tasks = await res.json()
    const safeTasks = Array.isArray(tasks) ? tasks : []
    writeCachedTasks(safeTasks)
    return safeTasks
  } catch (error) {
    if (cachedTasks.length > 0) return cachedTasks
    throw error
  }
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
  const task = await res.json()
  writeCachedTasks(mergeTaskLists([task], readCachedTasks()))
  return task
}
