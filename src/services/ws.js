import { getToken } from "./auth"

export const connectChatSocket = (chatId, onMessage) => {
  const token = getToken()
  const WS_BASE = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000"
  const ws = new WebSocket(`${WS_BASE}/ws/chat/${chatId}?token=${token}`)

  ws.onmessage = event => {
    const data = JSON.parse(event.data)
    onMessage(data)
  }

  return ws
}

// Connect a background socket for the currently authenticated user so the server
// can push user-targeted notifications (manager.send_to_user).
export const connectUserSocket = onMessage => {
  const token = getToken()
  // We connect to a stable 'notifications' chat id — manager will still register
  // the socket under the verified user id so server can call send_to_user.
  const WS_BASE = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000"
  const ws = new WebSocket(`${WS_BASE}/ws/chat/notifications?token=${token}`)
  ws.onmessage = e => {
    try {
      const data = JSON.parse(e.data)
      onMessage(data)
    } catch (err) {
      console.error('Failed parsing user-socket message', err)
    }
  }
  ws.onopen = () => console.log('User socket connected')
  ws.onclose = () => console.log('User socket closed')
  ws.onerror = e => console.error('User socket error', e)
  return ws
}
