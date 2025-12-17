import { getToken, saveAuth } from "./auth"

const API_BASE = "http://127.0.0.1:8000"

// --------------------
// Helpers
// --------------------
const safeJson = async res => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

const ensureArray = data => {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  if (data && Array.isArray(data.spaces)) return data.spaces
  if (data && Array.isArray(data.users)) return data.users
  if (data && Array.isArray(data.messages)) return data.messages
  return []
}

const authFetch = async (url, options = {}) => {
  const token = getToken()

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  if (res.status === 401) {
    localStorage.clear()
    window.location.reload()
    return Promise.reject("Unauthorized")
  }

  return res
}

// --------------------
// User Management
// --------------------

export const getUsers = async () => {
  const res = await authFetch(`${API_BASE}/users/`)
  const data = await safeJson(res)
  return ensureArray(data)
}

export const saveUser = async user => {
  if (!user.friends) user.friends = []
  if (!user.notifications) user.notifications = []

  const res = await authFetch(`${API_BASE}/users/signup`, {
    method: "POST",
    body: JSON.stringify(user)
  })

  const data = await safeJson(res)
  if (data?.user && data?.token) {
    saveAuth(data.user, data.token)
    return data
  }
  return data || null
}

export const login = async ({ email, password }) => {
  const res = await authFetch(`${API_BASE}/users/login`, {
    method: "POST",
    body: JSON.stringify({ email, password })
  })

  const data = await safeJson(res)
  if (data?.user && data?.token) {
    saveAuth(data.user, data.token)
    return data
  }
  return data || null
}

export const findUserByEmail = async email => {
  const res = await authFetch(`${API_BASE}/users/by-email/${email}`)
  const data = await safeJson(res)
  return data || null
}

export const searchUsersByName = async query => {
  if (!query) return []
  const res = await authFetch(`${API_BASE}/users/search/${query}`)
  const data = await safeJson(res)
  return ensureArray(data)
}

// --------------------
// Space Management
// --------------------

export const getSpaces = async () => {
  const res = await authFetch(`${API_BASE}/spaces/`)
  const data = await safeJson(res)
  return ensureArray(data)
}

export const saveSpace = async space => {
  await authFetch(`${API_BASE}/spaces/`, {
    method: "POST",
    body: JSON.stringify(space)
  })
}

export const getSpacesForUser = async userSpaceIds => {
  if (!Array.isArray(userSpaceIds) || userSpaceIds.length === 0) return []

  const res = await authFetch(`${API_BASE}/spaces/by-ids`, {
    method: "POST",
    body: JSON.stringify(userSpaceIds)
  })

  const data = await safeJson(res)
  return ensureArray(data)
}

// --------------------
// Message Management
// --------------------

export const getMessages = async chatId => {
  if (!chatId) return []
  const res = await authFetch(`${API_BASE}/messages/${chatId}`)
  const data = await safeJson(res)
  return ensureArray(data)
}

export const saveMessage = async (chatId, message) => {
  await authFetch(`${API_BASE}/messages/${chatId}`, {
    method: "POST",
    body: JSON.stringify(message)
  })
}

// --------------------
// Friend & DM Logic
// --------------------

export const getFriends = async friendIds => {
  if (!Array.isArray(friendIds) || friendIds.length === 0) return []
  const users = await getUsers()
  return users.filter(u => friendIds.includes(u.id))
}

export const sendFriendRequest = async (fromId, fromName, toUserId) => {
  const notification = {
    id: `fr-${Date.now()}-${Math.random()}`,
    type: "friend_request",
    from: fromName,
    fromId,
    status: "pending",
    timestamp: Date.now()
  }

  await authFetch(`${API_BASE}/actions/send-friend-request`, {
    method: "POST",
    body: JSON.stringify({
      toUserId,
      notification
    })
  })
}

/* ✅ FIXED — ONLY REQUIRED CHANGE */
export const acceptFriendRequest = async (friendId, notificationId = null) => {
  // Get current user from localStorage
  const userStr = localStorage.getItem("spaces_user")
  const user = userStr ? JSON.parse(userStr) : null

  if (!user) return null

  const res = await authFetch(`${API_BASE}/actions/accept-friend`, {
    method: "POST",
    body: JSON.stringify({
      userId: user.id,
      friendId: friendId,
      notificationId: notificationId
    })
  })

  return safeJson(res)
}

// --------------------
// Space Logic (Direct Add for Friends)
// --------------------

export const addMemberToSpace = async (userIdToDetail, spaceId) => {
  await authFetch(`${API_BASE}/actions/add-member`, {
    method: "POST",
    body: JSON.stringify({ userIdToDetail, spaceId })
  })
}

export const acceptInvite = async (userId, notificationId) => {
  const res = await authFetch(`${API_BASE}/actions/accept-invite`, {
    method: "POST",
    body: JSON.stringify({ userId, notificationId })
  })
  return safeJson(res)
}