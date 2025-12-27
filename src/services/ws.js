import { getToken } from "./auth"

// Derive WebSocket base safely from backend URL
const API_BASE = import.meta.env.VITE_API_URL || "https://spaces-wc1z.onrender.com"

const WS_BASE = (() => {
  if (API_BASE.startsWith("https://")) {
    return API_BASE.replace("https://", "wss://")
  }
  if (API_BASE.startsWith("http://")) {
    return API_BASE.replace("http://", "ws://")
  }
  return API_BASE
})()

export const connectChatSocket = (chatId, onMessage) => {
  const token = getToken()
  const ws = new WebSocket(`${WS_BASE}/ws/chat/${chatId}?token=${token}`)

  ws.onmessage = event => {
    const data = JSON.parse(event.data)
    onMessage(data)
  }

  return ws
}

// Connect a background socket for user-targeted notifications
export const connectUserSocket = onMessage => {
  const token = getToken()
  const ws = new WebSocket(`${WS_BASE}/ws/chat/notifications?token=${token}`)

  ws.onmessage = e => {
    try {
      const data = JSON.parse(e.data)
      onMessage(data)
    } catch (err) {
      console.error("Failed parsing user-socket message", err)
    }
  }

  ws.onopen = () => console.log("User socket connected")
  ws.onclose = () => console.log("User socket closed")
  ws.onerror = e => console.error("User socket error", e)

  return ws
}
