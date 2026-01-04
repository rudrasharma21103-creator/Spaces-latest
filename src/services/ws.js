import { getToken, getStoredUser } from "./auth"

// Derive WebSocket base safely from backend URL
const API_BASE = import.meta.env.VITE_API_URL || "https://spaces-wc1z.onrender.com"

const rawWsBase = (() => {
  if (API_BASE.startsWith("https://")) {
    return API_BASE.replace("https://", "wss://")
  }
  if (API_BASE.startsWith("http://")) {
    return API_BASE.replace("http://", "ws://")
  }
  return API_BASE
})()

const WS_BASE = (() => {
  if (typeof window === "undefined") return rawWsBase
  if (rawWsBase.includes("localhost")) {
    const preferredHost = window.location.hostname && window.location.hostname !== "localhost"
      ? window.location.hostname
      : "127.0.0.1"
    return rawWsBase.replace("localhost", preferredHost)
  }
  return rawWsBase
})()

// Internal manager to keep one socket per chat and a single notifications socket
const socketStore = {
  chats: new Map(), // chatId -> socketWrapper
  notifications: null
}

const buildQuery = () => {
  const params = new URLSearchParams()
  const token = getToken()
  if (token) params.set("token", token)
  const stored = getStoredUser()
  const userId = stored && (stored.id || stored._id || (stored._id && stored._id.$oid))
  if (userId) params.set("userId", String(userId))
  // Add timestamp to avoid caches and help diagnose reconnect storms
  params.set("ts", String(Date.now()))
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

const makeSocketWrapper = (urlFactory, initialOnMessage, name = "socket") => {
  let ws = null
  let closedByUser = false
  let reconnectAttempts = 0
  let reconnectTimer = null
  const outQueue = []
  
  // Mutable onMessage callback that can be updated
  let onMessage = initialOnMessage

  // External handlers assigned by caller
  const handlers = {
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null
  }

  const log = (...args) => console.info(`[ws:${name}]`, ...args)

  const connect = () => {
    const wsUrl = typeof urlFactory === "function" ? urlFactory() : urlFactory
    log("connecting", wsUrl)
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      log("failed to create WebSocket", e)
      scheduleReconnect()
      return
    }

    ws.onopen = e => {
      reconnectAttempts = 0
      log("connected")
      // flush queue
      while (outQueue.length > 0) {
        const msg = outQueue.shift()
        try {
          const payload = typeof msg === "string" ? msg : JSON.stringify(msg)
          ws.send(payload)
        } catch (err) {
          console.warn(`[ws:${name}] queued send failed`, err)
          outQueue.unshift(msg)
          break
        }
      }
      if (handlers.onopen) handlers.onopen(e)
    }

    ws.onmessage = e => {
      let data = null
      try { data = JSON.parse(e.data) } catch (err) { console.warn("invalid json", err); return }
      if (onMessage) onMessage(data)
      if (handlers.onmessage) handlers.onmessage(e)
    }

    ws.onclose = e => {
      log("closed", e.code, e.reason)
      if (handlers.onclose) handlers.onclose(e)
      if (!closedByUser) scheduleReconnect()
    }

    ws.onerror = e => {
      console.error(`[ws:${name}] error`, e)
      if (handlers.onerror) handlers.onerror(e)
    }
  }

  const scheduleReconnect = () => {
    reconnectAttempts = Math.min(10, reconnectAttempts + 1)
    const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts))
    console.warn(`[ws:${name}] scheduling reconnect in`, delay, "ms")
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!closedByUser) connect()
    }, delay)
  }

  connect()

  return {
    send: msg => {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
        } else {
          outQueue.push(msg)
        }
      } catch (e) {
        console.warn(`[ws:${name}] send error`, e)
        outQueue.push(msg)
      }
    },
    close: () => {
      closedByUser = true
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      try { if (ws) ws.close() } catch (e) {}
    },
    // allow callers to set handlers via property assignment e.g. ws.onopen = fn
    _handlers: handlers,
    _raw: () => ws,
    // Allow updating the onMessage callback
    setOnMessage: fn => { onMessage = fn }
  }
}

// Public: connectChatSocket(chatId, onMessage)
export const connectChatSocket = (chatId, onMessage) => {
  if (!chatId) return null
  const key = String(chatId)
  if (socketStore.chats.has(key)) {
    const existing = socketStore.chats.get(key)
    // If caller provided an onMessage handler, update via setOnMessage
    if (onMessage && existing && existing._wrapper && existing._wrapper.setOnMessage) {
      existing._wrapper.setOnMessage(data => {
        if (data && data.type === 'presence_update') return
        onMessage(data)
      })
    }
    return existing
  }

  const wrapper = makeSocketWrapper(
    () => `${WS_BASE}/ws/chat/${encodeURIComponent(key)}${buildQuery()}`,
    data => {
    // Ignore presence updates or internal messages if any
    if (data && data.type === 'presence_update') return
    if (onMessage) onMessage(data)
    },
    `chat-${key}`
  )

  // Proxy handler property setters to wrapper._handlers so App.jsx can set ws.onopen etc.
  const proxy = {}
  Object.defineProperties(proxy, {
    onopen: {
      get: () => wrapper._handlers.onopen,
      set: v => { wrapper._handlers.onopen = v }
    },
    onclose: {
      get: () => wrapper._handlers.onclose,
      set: v => { wrapper._handlers.onclose = v }
    },
    onerror: {
      get: () => wrapper._handlers.onerror,
      set: v => { wrapper._handlers.onerror = v }
    },
    onmessage: {
      get: () => wrapper._handlers.onmessage,
      set: v => { wrapper._handlers.onmessage = v }
    }
  })
  proxy.send = wrapper.send
  Object.defineProperty(proxy, 'readyState', {
    get: () => {
      try { const r = wrapper._raw(); return r ? r.readyState : WebSocket.CLOSED } catch (e) { return WebSocket.CLOSED }
    }
  })
  proxy.close = () => { wrapper.close(); socketStore.chats.delete(key) }
  proxy._raw = wrapper._raw
  proxy._wrapper = wrapper  // Store reference to wrapper for setOnMessage access

  socketStore.chats.set(key, proxy)
  return proxy
}

// Public: connectUserSocket(onMessage)
export const connectUserSocket = onMessage => {
  if (socketStore.notifications) {
    // Socket exists, update the onMessage handler via the wrapper's setOnMessage
    const existing = socketStore.notifications
    if (onMessage && existing._wrapper && existing._wrapper.setOnMessage) {
      existing._wrapper.setOnMessage(data => {
        if (data && onMessage) onMessage(data)
      })
    }
    return existing
  }
  const wrapper = makeSocketWrapper(
    () => `${WS_BASE}/ws/notifications${buildQuery()}`,
    data => {
    if (data && onMessage) onMessage(data)
    },
    'notifications'
  )

  const proxy = {}
  Object.defineProperties(proxy, {
    onopen: { get: () => wrapper._handlers.onopen, set: v => { wrapper._handlers.onopen = v } },
    onclose: { get: () => wrapper._handlers.onclose, set: v => { wrapper._handlers.onclose = v } },
    onerror: { get: () => wrapper._handlers.onerror, set: v => { wrapper._handlers.onerror = v } },
    onmessage: { get: () => wrapper._handlers.onmessage, set: v => { wrapper._handlers.onmessage = v } }
  })
  proxy.send = wrapper.send
  proxy.close = () => { wrapper.close(); socketStore.notifications = null }
  proxy._raw = wrapper._raw
  proxy._wrapper = wrapper  // Store reference to wrapper for setOnMessage access
  Object.defineProperty(proxy, 'readyState', {
    get: () => {
      try { const r = wrapper._raw(); return r ? r.readyState : WebSocket.CLOSED } catch (e) { return WebSocket.CLOSED }
    }
  })

  socketStore.notifications = proxy
  return proxy
}
