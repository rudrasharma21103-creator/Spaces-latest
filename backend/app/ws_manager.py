from typing import Dict, List, Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # chat_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # user_id -> list of websockets (supports multiple tabs/devices)
        self.user_connections: Dict[str, List[WebSocket]] = {}
        # Set of unique user_ids currently online
        self.online_users: Set[str] = set()

    async def connect(self, chat_id: str, websocket: WebSocket, user_id: str = None):
        # websocket.accept() must be called by the route once before handing
        # the WebSocket to the manager. Do not accept here to avoid double-accept
        # which raises an ASGI RuntimeError.
        self.active_connections.setdefault(chat_id, []).append(websocket)

        if user_id:
            uid = str(user_id)
            self.user_connections.setdefault(uid, []).append(websocket)
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
            if uid in self.user_connections:
                try:
                    self.user_connections[uid].remove(websocket)
                except ValueError:
                    pass
                if not self.user_connections[uid]:
                    # No more connections for this user
                    del self.user_connections[uid]
                    self.online_users.discard(uid)

        # Broadcast the updated presence list to everyone
        await self.broadcast_presence()

    async def send_to_user(self, user_id: str, message: dict):
        """Sends a private real-time update to a specific user"""
        uid = str(user_id)
        if uid in self.user_connections:
            # Make a copy to avoid modification during iteration
            for ws in list(self.user_connections[uid]):
                try:
                    await ws.send_json(message)
                except Exception:
                    # ignore errors for now
                    pass

    async def broadcast(self, chat_id: str, message: dict):
        for ws in self.active_connections.get(chat_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                # Ignore send errors for now
                pass

    async def broadcast_presence(self):
        presence_msg = {"type": "presence_update", "online_users": list(self.online_users)}
        # Send this list to every websocket across all chats
        for chat_group in self.active_connections.values():
            for ws in chat_group:
                try:
                    await ws.send_json(presence_msg)
                except Exception:
                    pass

manager = ConnectionManager()

