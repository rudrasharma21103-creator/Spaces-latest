from typing import Dict, List, Set
from fastapi import WebSocket
import asyncio

class ConnectionManager:
    def __init__(self):
        # chat_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Set of unique user_ids currently online
        self.online_users: Set[str] = set()
        # Track per-user connection counts so users with multiple tabs aren't
        # removed from presence until all their connections close
        self.user_connections: Dict[str, int] = {}

    async def connect(self, chat_id: str, websocket: WebSocket, user_id: str = None):
        # websocket.accept() must be called by the route once before handing
        # the WebSocket to the manager. Do not accept here to avoid double-accept
        # which raises an ASGI RuntimeError.
        self.active_connections.setdefault(chat_id, []).append(websocket)
        if user_id:
            uid = str(user_id)
            self.user_connections[uid] = self.user_connections.get(uid, 0) + 1
            self.online_users.add(uid)
            # Broadcast the updated list to EVERYONE immediately
            await self.broadcast_presence()

    async def disconnect(self, chat_id: str, websocket: WebSocket, user_id: str = None):
        if chat_id in self.active_connections:
            try:
                self.active_connections[chat_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

        if user_id:
            uid = str(user_id)
            # Decrement per-user connection count; only remove from online_users
            # when the count reaches zero (handles multiple tabs)
            count = self.user_connections.get(uid, 0) - 1
            if count <= 0:
                self.user_connections.pop(uid, None)
                self.online_users.discard(uid)
            else:
                self.user_connections[uid] = count

        # Broadcast the updated presence list to everyone
        await self.broadcast_presence()

    async def broadcast(self, chat_id: str, message: dict):
        for ws in self.active_connections.get(chat_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                # Ignore send errors for now
                pass

    async def broadcast_presence(self):
        presence_msg = {
            "type": "presence_update",
            "online_users": list(self.online_users)
        }
        # Send this list to every websocket across all chats
        for chat_group in self.active_connections.values():
            for ws in chat_group:
                try:
                    await ws.send_json(presence_msg)
                except Exception:
                    pass

manager = ConnectionManager()

