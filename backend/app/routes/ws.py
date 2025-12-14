from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.ws_manager import manager
from app.auth import verify_ws_token

router = APIRouter()

@router.websocket("/ws/chat/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: str,
    token: str = Query(...)
):
    user_id = verify_ws_token(token)
    if not user_id:
        await websocket.close(code=1008)
        return

    await manager.connect(chat_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(chat_id, data)
    except WebSocketDisconnect:
        manager.disconnect(chat_id, websocket)
