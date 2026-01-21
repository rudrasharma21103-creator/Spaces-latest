from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws_manager import manager
from app.auth import verify_ws_token
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws/chat/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: str,
    userId: str = None  # Capture userId from query params directly
):
    # Log incoming connection attempt for debugging
    try:
        logger.debug("WS chat connect attempt: path=%s, query=%s, headers=%s", websocket.url.path, websocket.query_params, dict(websocket.headers))
    except Exception:
        pass

    # Accept the connection first
    try:
        await websocket.accept()
    except Exception as e:
        logger.error("Failed to accept websocket for chat %s: %s", chat_id, e)
        return

    # Prefer token verification if provided, otherwise use the userId query param
    token = websocket.query_params.get("token")
    user_id = None
    try:
        user_id = verify_ws_token(token) if token else userId
    except Exception as e:
        logger.warning("Failed to verify WS token: %s", str(e))
        # fall back to userId if present
        user_id = userId

    if not user_id:
        logger.info("WebSocket connected without a verified user id for chat %s", chat_id)

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




@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    # Log incoming notifications socket attempt and accept
    try:
        logger.debug("WS notifications connect attempt: path=%s, query=%s, headers=%s", websocket.url.path, websocket.query_params, dict(websocket.headers))
    except Exception:
        pass

    # Notifications socket (no chat id) - accept and track by user token or userId query param
    try:
        await websocket.accept()
    except Exception as e:
        logger.error("Failed to accept notifications websocket: %s", e)
        return

    token = websocket.query_params.get("token")
    userId = websocket.query_params.get("userId")
    user_id = None
    try:
        user_id = verify_ws_token(token) if token else userId
    except Exception as e:
        logger.warning("Failed to verify WS token for notifications: %s", str(e))
        user_id = userId

    if not user_id:
        logger.info("Notifications WebSocket connected without a verified user id")

    await manager.connect("notifications", websocket, user_id=user_id)

    try:
        while True:
            data = await websocket.receive_json()
            # Handle WebRTC signaling - route to target user
            msg_type = data.get('type', '')
            if msg_type.startswith('webrtc-') or msg_type == 'ice-candidate':
                target_user_id = data.get('targetUserId')
                if target_user_id:
                    logger.info(f"WebRTC signaling: {msg_type} from {user_id} to {target_user_id}")
                    await manager.send_to_user(str(target_user_id), data)
                continue
            
            # For other notifications we route to the specific user id
            if user_id:
                await manager.send_to_user(user_id, data)
    except WebSocketDisconnect:
        await manager.disconnect("notifications", websocket, user_id=user_id)