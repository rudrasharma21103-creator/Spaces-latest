import { getToken } from "./auth"

export const connectChatSocket = (chatId, onMessage) => {
  const token = getToken()
  const ws = new WebSocket(
    `ws://127.0.0.1:8000/ws/chat/${chatId}?token=${token}`
  )

  ws.onmessage = event => {
    const data = JSON.parse(event.data)
    onMessage(data)
  }

  return ws
}
