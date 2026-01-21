import { getToken, saveAuth } from "./auth"

// Use environment variable when deployed (Vite): VITE_API_URL
const API_BASE = import.meta.env.VITE_API_URL || "https://spaces-wc1z.onrender.com"

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

import { getStoredUser, logout as clearAuth } from "./auth"

const authFetch = async (url, options = {}) => {
  const token = getToken()
  const storedUser = getStoredUser()
  
  // Normalize user id from possible shapes: `id`, `_id`, `_id.$oid`, or `userId`
  const userId = storedUser
    ? (storedUser.id || storedUser._id || (storedUser._id && storedUser._id.$oid) || storedUser.userId)
    : null
  try {
    console.log("authFetch ->", url, options && options.method ? options.method : "GET")
    console.log("authFetch headers ->", { token: !!token, userId: userId, extraHeaders: options && options.headers })
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(userId ? { "X-User-Id": String(userId) } : {}),
        ...(options.headers || {})
      }
    })

    console.log("authFetch response status", res.status, "for", url)

    if (res.status === 401) {
      try {
        clearAuth()
      } catch (e) {
        // ignore clear errors
      }
      return Promise.reject({ status: 401, message: "Unauthorized" })
    }

    if (res.status === 403) {
      // Log response body for debugging before rejecting
      try {
        const text = await res.text()
        console.warn("authFetch forbidden response body:", text)
      } catch (e) {}
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
  const cacheKey = "users_cache"
  const cacheTimeKey = "users_cache_time"
  const CACHE_TTL = 5000 // 5 seconds TTL for faster updates
  
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null")
    const cacheTime = parseInt(localStorage.getItem(cacheTimeKey) || "0", 10)
    
    if (Array.isArray(cached) && cached.length > 0) {
      // Return cached data immediately, refresh in background if stale
      if (Date.now() - cacheTime > CACHE_TTL) {
        ;(async () => {
          try {
            const res = await authFetch(`${API_BASE}/users/`)
            const data = await safeJson(res)
            const arr = ensureArray(data)
            localStorage.setItem(cacheKey, JSON.stringify(arr))
            localStorage.setItem(cacheTimeKey, String(Date.now()))
          } catch (e) {}
        })()
      }
      return cached
    }
  } catch (e) {}

  // No cache - fetch fresh
  const res = await authFetch(`${API_BASE}/users/`)
  const data = await safeJson(res)
  const arr = ensureArray(data)
  try {
    localStorage.setItem(cacheKey, JSON.stringify(arr))
    localStorage.setItem(cacheTimeKey, String(Date.now()))
  } catch(e){}
  return arr
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
  // Return cached spaces immediately if available, then refresh in background
  try {
    const cached = JSON.parse(localStorage.getItem("spaces_cache") || "null")
    if (Array.isArray(cached) && cached.length > 0) {
      ;(async () => {
        try {
          const res = await authFetch(`${API_BASE}/spaces/`)
          const data = await safeJson(res)
          const arr = ensureArray(data)
          localStorage.setItem("spaces_cache", JSON.stringify(arr))
        } catch (e) {
          // ignore background refresh failures
        }
      })()
      return cached
    }
  } catch (e) {
    // fall through to network fetch
  }

  const res = await authFetch(`${API_BASE}/spaces/`)
  const data = await safeJson(res)
  const arr = ensureArray(data)
  try { localStorage.setItem("spaces_cache", JSON.stringify(arr)) } catch(e){}
  return arr
}

export const saveSpace = async space => {
  await authFetch(`${API_BASE}/spaces/`, {
    method: "POST",
    body: JSON.stringify(space)
  })
}

export const getSpacesForUser = async userSpaceIds => {
  if (!Array.isArray(userSpaceIds) || userSpaceIds.length === 0) return []
  
  // Use a general spaces cache (all spaces the user has seen)
  const cacheKey = "spaces_cache"
  
  // Try cached spaces first - return immediately if available
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null")
    if (Array.isArray(cached) && cached.length > 0) {
      const filtered = cached.filter(s => userSpaceIds.includes(s.id))
      // If we have matching spaces in cache, return them and refresh in background
      if (filtered.length > 0) {
        ;(async () => {
          try {
            const res = await authFetch(`${API_BASE}/spaces/by-ids`, {
              method: "POST",
              body: JSON.stringify(userSpaceIds)
            })
            const data = await safeJson(res)
            const arr = ensureArray(data)
            // Merge with existing cache to preserve other spaces
            const existingIds = new Set(arr.map(s => s.id))
            const merged = [...arr, ...cached.filter(s => !existingIds.has(s.id))]
            localStorage.setItem(cacheKey, JSON.stringify(merged))
          } catch (e) {}
        })()
        return filtered
      }
    }
  } catch (e) {}

  // No cache hit - fetch from API
  const res = await authFetch(`${API_BASE}/spaces/by-ids`, {
    method: "POST",
    body: JSON.stringify(userSpaceIds)
  })

  const data = await safeJson(res)
  const arr = ensureArray(data)
  try {
    // Merge with existing cache
    const existing = JSON.parse(localStorage.getItem(cacheKey) || "[]")
    const existingIds = new Set(arr.map(s => s.id))
    const merged = [...arr, ...(Array.isArray(existing) ? existing.filter(s => !existingIds.has(s.id)) : [])]
    localStorage.setItem(cacheKey, JSON.stringify(merged))
  } catch(e){}
  return arr
}

// --------------------
// Message Management
// --------------------

export const getMessages = async chatId => {
  if (!chatId) return []
  const cacheKey = `messages_cache_${chatId}`
  const cacheTimeKey = `messages_cache_time_${chatId}`
  const CACHE_TTL = 3000 // 3 seconds - only use very fresh cache
  
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null")
    const cacheTime = parseInt(localStorage.getItem(cacheTimeKey) || "0", 10)
    
    // Only return cache if it's VERY fresh (within 3 seconds)
    // Otherwise always fetch from server to ensure we have latest messages
    if (Array.isArray(cached) && (Date.now() - cacheTime < CACHE_TTL)) {
      return cached
    }
  } catch (e) {}

  // Fetch fresh data from server
  try {
    const res = await authFetch(`${API_BASE}/messages/${chatId}`)
    const data = await safeJson(res)
    const arr = ensureArray(data)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(arr))
      localStorage.setItem(cacheTimeKey, String(Date.now()))
    } catch(e){}
    return arr
  } catch (err) {
    // On network error, fall back to cache if available
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null")
      if (Array.isArray(cached)) return cached
    } catch (e) {}
    if (err && err.status === 403) return []
    throw err
  }
}

export const saveMessage = async (chatId, message) => {
  // Optimistically persist to local cache so refreshes and other tabs see it immediately
  try {
    const cacheKey = `messages_cache_${chatId}`
    const cacheTimeKey = `messages_cache_time_${chatId}`
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null")
    const arr = Array.isArray(cached) ? cached : []
    // Avoid duplicates by checking if message ID already exists
    if (!arr.some(m => m.id === message.id)) {
      arr.push(message)
    }
    localStorage.setItem(cacheKey, JSON.stringify(arr))
    localStorage.setItem(cacheTimeKey, String(Date.now()))
  } catch (e) {}

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
  // Normalize IDs to strings for comparison to handle type mismatches
  const normalizedIds = friendIds.map(id => String(id))
  return users.filter(u => {
    const uId = String(u.id || u._id || '')
    return normalizedIds.includes(uId)
  })
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

  // Notify the recipient in real-time via backend so they receive an
  // incoming-call pop-up immediately (DM calls should not rely on localStorage polling)
  try {
    const payload = {
      organizerId: fromUser.id,
      targetUserIds: [toUserId],
      meetingLink: null,
      meetingTitle: `${fromUser.name} is calling you`,
      spaceId: null,
      channelId: null
    }
    // fire-and-forget; don't block call initiation on network
    authFetch(`${API_BASE}/actions/send-meet-invite`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).catch(e => {
      // log but ignore errors — fallback polling still exists
      console.error('Failed to send realtime call notification', e)
    })
  } catch (e) {
    console.error('Realtime call notification failed', e)
  }
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

// --------------------
// User update helper
// --------------------
export const updateUser = async (userId, updates) => {
  if (!userId) return null
  try {
    const res = await authFetch(`${API_BASE}/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    })
    return safeJson(res)
  } catch (e) {
    console.error("updateUser failed", e)
    return null
  }
}

// Notify backend to send Meet invites/notifications to users or a channel
export const sendMeetInvite = async (payload) => {
  try {
    const res = await authFetch(`${API_BASE}/actions/send-meet-invite`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return safeJson(res)
  } catch (e) {
    console.error('sendMeetInvite failed', e)
    return null
  }
}

// Broadcast avatar update to friends and members
export const broadcastAvatarUpdate = async (userId, avatarData) => {
  try {
    const res = await authFetch(`${API_BASE}/actions/broadcast-avatar-update`, {
      method: 'POST',
      body: JSON.stringify({ userId, avatarData })
    })
    return safeJson(res)
  } catch (e) {
    console.error('broadcastAvatarUpdate failed', e)
    return null
  }
}