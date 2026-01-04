from typing import Dict, List, Set
from fastapi import WebSocket
import asyncio

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
            connections = list(self.user_connections[uid])
            print(f"[ws_manager] send_to_user: {uid} has {len(connections)} connection(s)")
            # Send concurrently to avoid slow clients blocking others
            tasks = [asyncio.create_task(self._safe_send(ws, message))
                     for ws in connections]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
        else:
            print(f"[ws_manager] send_to_user: {uid} not found in user_connections. Connected users: {list(self.user_connections.keys())[:10]}")

    async def broadcast(self, chat_id: str, message: dict):
        # Send concurrently to all clients in the chat to reduce latency
        tasks = [asyncio.create_task(self._safe_send(ws, message))
                 for ws in list(self.active_connections.get(chat_id, []))]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_presence(self):
        presence_msg = {"type": "presence_update", "online_users": list(self.online_users)}
        # Send this list to every websocket across all chats concurrently
        tasks = []
        for chat_group in self.active_connections.values():
            for ws in list(chat_group):
                tasks.append(asyncio.create_task(self._safe_send(ws, presence_msg)))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_all(self, message: dict):
        """Send a message to every connected websocket across all chats/notifications."""
        tasks = []
        for chat_group in self.active_connections.values():
            for ws in list(chat_group):
                tasks.append(asyncio.create_task(self._safe_send(ws, message)))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_send(self, ws: WebSocket, message: dict):
        try:
            await ws.send_json(message)
        except Exception:
            # ignore errors — connection may be closed or slow
            pass

manager = ConnectionManager()

