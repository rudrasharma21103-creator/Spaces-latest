import { getToken, saveAuth } from "./auth"

// Use environment variable when deployed (Vite): VITE_API_URL
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

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

import { getStoredUser } from "./auth"

const authFetch = async (url, options = {}) => {
  const token = getToken()
  const storedUser = getStoredUser()

  try {
    console.log("authFetch ->", url, options && options.method ? options.method : "GET")
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storedUser ? { "X-User-Id": String(storedUser.id) } : {}),
        ...(options.headers || {})
      }
    })

    console.log("authFetch response status", res.status, "for", url)

    if (res.status === 401) {
      localStorage.clear()
      window.location.reload()
      return Promise.reject("Unauthorized")
    }

    if (res.status === 403) {
      // Surface forbidden errors to caller
      return Promise.reject({ status: 403, message: "Forbidden" })
    }

    return res
  } catch (err) {
    console.error("authFetch failed for", url, err)
    throw err
  }
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

  try {
    console.log("saveUser -> posting to /users/signup", { email: user.email })
    const res = await authFetch(`${API_BASE}/users/signup`, {
      method: "POST",
      body: JSON.stringify(user)
    })
    console.log("saveUser -> status", res.status)

    const data = await safeJson(res)
    console.log("saveUser -> response json", data)

    if (data?.user && data?.token) {
      saveAuth(data.user, data.token)
      return data
    }
    return data || null
  } catch (err) {
    console.error("saveUser failed", err)
    throw err
  }
}

export const login = async ({ email, password }) => {
  try {
    console.log("login -> posting to /users/login", { email })
    const res = await authFetch(`${API_BASE}/users/login`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    })
    console.log("login -> status", res.status)

    const data = await safeJson(res)
    console.log("login -> response json", data)

    if (data?.user && data?.token) {
      saveAuth(data.user, data.token)
      return data
    }
    return data || null
  } catch (err) {
    console.error("login failed", err)
    throw err
  }
}

export const findUserByEmail = async email => {
  try {
    const encoded = encodeURIComponent(email)
    console.log("findUserByEmail ->", encoded)
    const res = await authFetch(`${API_BASE}/users/by-email/${encoded}`)
    console.log("findUserByEmail status", res.status)
    const data = await safeJson(res)
    console.log("findUserByEmail response", data)
    return data || null
  } catch (err) {
    console.error("findUserByEmail failed", err)
    return null
  }
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

export const updateMessage = async (chatId, message) => {
  if (!chatId || !message || !message.id) return
  await authFetch(`${API_BASE}/messages/${chatId}/${message.id}`, {
    method: "PATCH",
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
  const res = await authFetch(`${API_BASE}/actions/add-member`, {
    method: "POST",
    body: JSON.stringify({ userIdToDetail, spaceId })
  })
  return safeJson(res)
}

// Remove a member from a space or a specific channel
export const removeMemberFromSpace = async (userIdToRemove, spaceId, channelId = null) => {
  const res = await authFetch(`${API_BASE}/actions/remove-member`, {
    method: "POST",
    body: JSON.stringify({ userIdToRemove, spaceId, channelId })
  })
  return safeJson(res)
}

export const acceptInvite = async (userId, notificationId) => {
  const res = await authFetch(`${API_BASE}/actions/accept-invite`, {
    method: "POST",
    body: JSON.stringify({ userId, notificationId })
  })
  return safeJson(res)
}

// --------------------
// Events
// --------------------

export const getEvents = async () => {
  try {
    const res = await authFetch(`${API_BASE}/events/`)
    const data = await safeJson(res)
    return ensureArray(data)
  } catch (err) {
    // fallback to localStorage
    try {
      const stored = JSON.parse(localStorage.getItem("spaces_events") || "[]")
      return Array.isArray(stored) ? stored : []
    } catch {
      return []
    }
  }
}

export const saveEvent = async event => {
  try {
    const res = await authFetch(`${API_BASE}/events/`, {
      method: "POST",
      body: JSON.stringify(event)
    })
    // if backend accepted, return
    if (res && res.ok) return safeJson(res)
  } catch (err) {
    // ignore and fallback
  }

  // localStorage fallback
  try {
    const stored = JSON.parse(localStorage.getItem("spaces_events") || "[]")
    stored.push(event)
    localStorage.setItem("spaces_events", JSON.stringify(stored))
  } catch (e) {
    console.error("saveEvent fallback failed", e)
  }
}

// --------------------
// Space / Channel Helpers (rename / delete / bulk add)
// --------------------

export const renameSpace = async (spaceId, newName) => {
  const spaces = await getSpaces()
  const space = spaces.find(s => s.id === spaceId)
  if (!space) return null
  const updated = { ...space, name: newName }
  await saveSpace(updated)
  return updated
}

export const renameChannel = async (spaceId, channelId, newName) => {
  const spaces = await getSpaces()
  const space = spaces.find(s => s.id === spaceId)
  if (!space) return null
  const newChannels = (space.channels || []).map(c =>
    c.id === channelId ? { ...c, name: newName } : c
  )
  const updated = { ...space, channels: newChannels }
  await saveSpace(updated)
  return updated
}

export const deleteChannel = async (spaceId, channelId) => {
  const spaces = await getSpaces()
  const space = spaces.find(s => s.id === spaceId)
  if (!space) return null
  const newChannels = (space.channels || []).filter(c => c.id !== channelId)
  const updated = { ...space, channels: newChannels }
  await saveSpace(updated)
  return updated
}

export const deleteSpace = async spaceId => {
  // Try RESTful delete if backend implements it
  try {
    const res = await authFetch(`${API_BASE}/spaces/${spaceId}`, {
      method: "DELETE"
    })
    if (res && res.ok) return safeJson(res)
  } catch (err) {
    // ignore and fallback
  }

  // Fallback: remove from localStorage-spaces if present (non-persistent if backend doesn't support delete)
  try {
    const stored = await getSpaces()
    const remaining = stored.filter(s => s.id !== spaceId)
    // Attempt to persist remaining spaces by re-saving each (best-effort)
    for (const s of remaining) {
      await saveSpace(s)
    }
    return { status: "deleted (client-side)" }
  } catch (e) {
    console.error("deleteSpace fallback failed", e)
    return null
  }
}

export const addBulkMembersToChannel = async (userIds, spaceId, channelId) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return
  for (const uid of userIds) {
    // call existing add-member action for each user
    try {
      // add-member now accepts optional channelId to add a member only to a specific channel
      await authFetch(`${API_BASE}/actions/add-member`, {
        method: "POST",
        body: JSON.stringify({ userIdToDetail: uid, spaceId, channelId })
      })
    } catch (e) {
      console.error("addBulkMembersToChannel error for", uid, e)
    }
  }
}

// --------------------
// Calls (local fallback)
// --------------------

const _readCalls = () => {
  try {
    return JSON.parse(localStorage.getItem("spaces_calls") || "[]")
  } catch {
    return []
  }
}

const _writeCalls = calls => {
  try {
    localStorage.setItem("spaces_calls", JSON.stringify(calls))
  } catch (e) {
    console.error("_writeCalls failed", e)
  }
}

export const initiateCall = async (fromUser, toUserId) => {
  const call = {
    id: `call-${Date.now()}-${Math.random()}`,
    fromId: fromUser.id,
    fromName: fromUser.name,
    fromAvatar: fromUser.avatar,
    toId: toUserId,
    status: "ringing",
    timestamp: Date.now()
  }
  const calls = _readCalls()
  calls.push(call)
  _writeCalls(calls)
  return call
}

export const updateCallStatus = async (callId, status) => {
  const calls = _readCalls()
  const idx = calls.findIndex(c => c.id === callId)
  if (idx === -1) return null
  calls[idx].status = status
  _writeCalls(calls)
  return calls[idx]
}

export const getIncomingCall = async userId => {
  const calls = _readCalls()
  // return first matching ringing/incoming call to this user
  return calls.find(c => String(c.toId) === String(userId) && (c.status === "ringing" || c.status === "initiated")) || null
}

export const getCalls = async () => _readCalls()

// --------------------
// Notifications helpers
// --------------------

export const deleteNotification = async (userId, notificationId) => {
  try {
    // Fetch current user from backend
    const users = await getUsers()
    const user = users.find(u => String(u.id) === String(userId))
    if (!user) return null
    const updated = { ...user, notifications: (user.notifications || []).filter(n => n.id !== notificationId) }
    const res = await authFetch(`${API_BASE}/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(updated)
    })
    return safeJson(res)
  } catch (e) {
    console.error("deleteNotification failed", e)
    return null
  }
}

export const rejectFriendRequest = async (friendId, notificationId) => {
  const userStr = localStorage.getItem("spaces_user")
  const user = userStr ? JSON.parse(userStr) : null
  if (!user) return null

  const res = await authFetch(`${API_BASE}/actions/reject-friend`, {
    method: "POST",
    body: JSON.stringify({ userId: user.id, friendId, notificationId })
  })
  return safeJson(res)
}

export const rejectInvite = async (userId, notificationId) => {
  // same as deleteNotification for invites
  return deleteNotification(userId, notificationId)
}