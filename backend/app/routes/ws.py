from http.cookies import SimpleCookie

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws_manager import manager
from app.auth import verify_ws_token
from app.database import organizations_collection, users_collection
from app.deps import AUTH_COOKIE_NAME
from app.routes.messages import _check_channel_access
import logging
import time

logger = logging.getLogger(__name__)

router = APIRouter()


def _user_id_candidates(user_id):
    candidates = []
    if user_id is None:
        return candidates
    candidates.append(user_id)
    try:
        string_id = str(user_id)
        if string_id != user_id:
            candidates.append(string_id)
    except Exception:
        pass
    try:
        int_id = int(user_id)
        if int_id != user_id:
            candidates.append(int_id)
    except (TypeError, ValueError):
        pass
    return candidates


def _cookie_token(websocket: WebSocket):
    try:
        if websocket.cookies.get(AUTH_COOKIE_NAME):
            return websocket.cookies.get(AUTH_COOKIE_NAME)
    except Exception:
        pass

    raw_cookie = websocket.headers.get("cookie")
    if not raw_cookie:
        return None
    try:
        cookie = SimpleCookie()
        cookie.load(raw_cookie)
        morsel = cookie.get(AUTH_COOKIE_NAME)
        return morsel.value if morsel else None
    except Exception:
        return None


def _resolve_ws_user(websocket: WebSocket):
    token = websocket.query_params.get("token") or _cookie_token(websocket)
    user_id = verify_ws_token(token) if token else None
    if user_id is None:
        return None

    user = users_collection.find_one({"id": {"$in": _user_id_candidates(user_id)}})
    return user

@router.websocket("/ws/chat/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: str,
):
    # Log incoming connection attempt for debugging
    try:
        logger.debug("WS chat connect attempt: path=%s, query=%s, headers=%s", websocket.url.path, websocket.query_params, dict(websocket.headers))
    except Exception:
        pass

    user = _resolve_ws_user(websocket)
    if not user:
        await websocket.close(code=1008, reason="Authentication required")
        return

    user_id = user.get("id")
    if not _check_channel_access(chat_id, user_id):
        await websocket.close(code=1008, reason="Access denied")
        return

    try:
        await websocket.accept()
    except Exception as e:
        logger.error("Failed to accept websocket for chat %s: %s", chat_id, e)
        return

    # Add to connection manager (pass user_id to track presence)
    await manager.connect(chat_id, websocket, user_id=user_id)

    try:
        while True:
            # Wait for messages
            data = await websocket.receive_json()
            if isinstance(data, dict):
                data["userId"] = user_id

            # Broadcast to all clients in this chat
            await manager.broadcast(chat_id, data)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        # Remove from connection manager (pass user_id so presence updates)
        await manager.disconnect(chat_id, websocket, user_id=user_id)




@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    # Log incoming notifications socket attempt and accept
    try:
        logger.debug("WS notifications connect attempt: path=%s, query=%s, headers=%s", websocket.url.path, websocket.query_params, dict(websocket.headers))
    except Exception:
        pass

    user = _resolve_ws_user(websocket)
    if not user:
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        await websocket.accept()
    except Exception as e:
        logger.error("Failed to accept notifications websocket: %s", e)
        return

    user_id = user.get("id")

    # Determine user's domain and role (best-effort) to allow domain-scoped admin notifications
    domain = None
    role = None
    u = user
    try:
        if u:
            role = u.get("role")
            # prefer explicit organizationId -> lookup org domain
            org_id = u.get("organizationId")
            if org_id:
                try:
                    org = organizations_collection.find_one({"_id": org_id})
                    if org:
                        domain = org.get("domain")
                except Exception:
                    pass
            # fallback to parsing email domain
            if not domain:
                email = u.get("email", "")
                import re
                m = re.search(r"@([A-Za-z0-9.-]+)$", email)
                if m:
                    domain = m.group(1).lower()
            # mark user as online
            try:
                users_collection.update_one({"id": u.get("id")}, {"$set": {"isOnline": True, "lastActive": int(time.time())}})
            except Exception:
                pass
    except Exception:
        pass

    await manager.connect("notifications", websocket, user_id=user_id, meta={"user_id": str(user_id) if user_id else None, "domain": domain, "role": role})

    # Notify connected org admins about this user's presence (domain-scoped)
    try:
        if domain and user_id:
            await manager.send_to_admins_for_domain(domain, {"type": "user_presence", "event": "online", "userId": str(user_id), "email": u.get("email") if u else None, "timestamp": int(time.time())})
    except Exception:
        pass

    # Send any recent org_verified events to the connecting socket so clients
    # that connected after a verification don't miss the notification.
    try:
        cutoff = int(time.time()) - 600
        recent = list(organizations_collection.find({"verified": True, "verifiedAt": {"$gte": cutoff}}, {"_id": 0, "domain": 1}))
        for org in recent:
            try:
                await websocket.send_json({"type": "org_verified", "domain": org.get("domain")})
            except Exception:
                pass
    except Exception as e:
        logger.debug("Failed to send recent org_verified events: %s", e)

    try:
        while True:
            data = await websocket.receive_json()
            # Handle WebRTC signaling - route to target user
            msg_type = data.get('type', '')
            if isinstance(data, dict):
                data["userId"] = user_id
            if msg_type.startswith('webrtc-') or msg_type == 'ice-candidate':
                target_user_id = data.get('targetUserId')
                if target_user_id:
                    logger.info(f"WebRTC signaling: {msg_type} from {user_id} to {target_user_id}")
                    await manager.send_to_user(str(target_user_id), data)
                continue

            # For other notifications we route to the specific user id
            if user_id:
                await manager.send_to_user(user_id, data)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        # mark user offline and update lastActive
        try:
            if user_id:
                users_collection.update_one({"id": user_id}, {"$set": {"isOnline": False, "lastActive": int(time.time())}})
        except Exception:
            pass
        # Notify admins about offline event
        try:
            if domain and user_id:
                await manager.send_to_admins_for_domain(domain, {"type": "user_presence", "event": "offline", "userId": str(user_id), "email": u.get("email") if u else None, "timestamp": int(time.time())})
        except Exception:
            pass
        await manager.disconnect("notifications", websocket, user_id=user_id)
