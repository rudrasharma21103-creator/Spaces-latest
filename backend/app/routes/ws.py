from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws_manager import manager
from app.auth import verify_ws_token

router = APIRouter()

@router.websocket("/ws/chat/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: str,
    userId: str = None  # Capture userId from query params directly
):
    # Accept the connection first
    await websocket.accept()

    # Prefer token verification if provided, otherwise use the userId query param
    token = websocket.query_params.get("token")
    user_id = verify_ws_token(token) if token else userId

    # Add to connection manager (pass user_id to track presence)
    await manager.connect(chat_id, websocket, user_id=user_id)

    try:
        while True:
            # Wait for messages
            data = await websocket.receive_json()

            # Broadcast to all clients in this chat
            await manager.broadcast(chat_id, data)
    except WebSocketDisconnect:
        # Remove from connection manager (pass user_id so presence updates)
        await manager.disconnect(chat_id, websocket, user_id=user_id)