from fastapi import APIRouter, Request, HTTPException
from starlette import status
from app.ws_manager import manager
from app.database import messages_collection, spaces_collection
from app.auth import verify_ws_token

def _get_user_id_from_request(request: Request):
    # Prefer explicit X-User-Id header
    user_header = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    try:
        if user_header:
            return int(user_header)
    except Exception:
        pass

    # Fallback: try Authorization: Bearer <token>
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and isinstance(auth, str) and auth.lower().startswith("bearer "):
        token = auth.split(None, 1)[1]
        try:
            uid = verify_ws_token(token)
            if uid:
                return int(uid)
        except Exception:
            pass

    return None

router = APIRouter(prefix="/messages")


def _check_channel_access(chat_id: str, user_id: int):
    # Allow DM chats where chat id is like 'dm_<id1>_<id2>' if user is participant
    if isinstance(chat_id, str) and chat_id.startswith("dm_"):
        try:
            parts = chat_id.split("_")
            ids = [int(parts[1]), int(parts[2])]
            return user_id in ids
        except Exception:
            return False

    # Normalize id representations so we can match regardless of whether Mongo stored the channel
    # id as an int or a string (PyMongo may store JSON numbers as strings depending on source data).
    normalized_ids = set()
    normalized_ids.add(chat_id)
    try:
        normalized_ids.add(str(chat_id))
    except Exception:
        pass

    try:
        cid = int(chat_id)
        normalized_ids.add(cid)
        normalized_ids.add(str(cid))
    except Exception:
        cid = None

    # Find the space and channel that contains this channel id, using any normalized form
    space = spaces_collection.find_one({
        "channels.id": {"$in": list(normalized_ids)}
    })
    if not space:
        return False

    # Locate the channel
    channel = None
    target_str_ids = {str(val) for val in normalized_ids if val is not None}
    for ch in (space.get("channels") or []):
        try:
            if str(ch.get("id")) in target_str_ids:
                channel = ch
                break
        except Exception:
            continue

    if not channel:
        return False

    # Check if user has access to the channel (owner, channel member, or space member)
    owner_id = space.get("ownerId") or space.get("createdBy")
    space_members = space.get("members") or []

    channel_members = channel.get("members") or []

    print(f"DEBUG _check_channel_access: user_id={user_id}, owner_id={owner_id}, space_members={space_members}, channel_members={channel_members}")

    # Helper: compare ids type-insensitively (str/int)
    def _id_in_list(uid, lst):
        if uid is None or not lst:
            return False

        # Normalize a member entry into a comparable id string
        def _extract_id(x):
            if x is None:
                return None
            # If it's a dict-like object, try common id fields
            try:
                if isinstance(x, dict):
                    if "id" in x:
                        return str(x.get("id"))
                    if "userId" in x:
                        return str(x.get("userId"))
                    if "_id" in x:
                        # support nested {_id: {"$oid": ...}} or plain _id
                        val = x.get("_id")
                        if isinstance(val, dict) and "$oid" in val:
                            return str(val.get("$oid"))
                        return str(val)
            except Exception:
                pass

            # Fallback: primitive values (int/str)
            try:
                return str(x)
            except Exception:
                return None

        s_uid = str(uid)
        for item in lst:
            try:
                item_id = _extract_id(item)
                if item_id is not None and item_id == s_uid:
                    return True
            except Exception:
                continue
        return False

    # Compare owner id type-insensitively as well
    # Normalize owner id which may be stored as a number, string or nested dict
    def _normalize_owner(oid):
        try:
            if oid is None:
                return None
            if isinstance(oid, dict):
                if "id" in oid:
                    return str(oid.get("id"))
                if "_id" in oid:
                    val = oid.get("_id")
                    if isinstance(val, dict) and "$oid" in val:
                        return str(val.get("$oid"))
                    return str(val)
            return str(oid)
        except Exception:
            return None

    try:
        norm_owner = _normalize_owner(owner_id)
        if norm_owner is not None and str(norm_owner) == str(user_id):
            return True
    except Exception:
        pass

    # User has access if they are in space members, or in channel members
    if _id_in_list(user_id, space_members) or _id_in_list(user_id, channel_members):
        return True

    return False


@router.get("/{chat_id}")
def get_messages(request: Request, chat_id: str):
    user_id = _get_user_id_from_request(request)
    has_access = _check_channel_access(chat_id, user_id) if user_id else False
    print(f"DEBUG get_messages: chat_id={chat_id}, user_id={user_id}, has_access={has_access}")

    if user_id is None or not has_access:
        # For development UX, return an empty list for chats the user cannot access.
        # This avoids repeated 403 exceptions and reduces frontend polling overhead
        # (the frontend already silently ignores empty lists for restricted channels).
        try:
            hdrs = dict(request.headers.items())
            print("DEBUG get_messages denied headers:", {k: hdrs.get(k) for k in ["x-user-id", "X-User-Id", "authorization", "Authorization"]})
        except Exception:
            pass
        return []

    docs = messages_collection.find(
        {"chatId": chat_id},
        {"_id": 0}
    )
    return [d["message"] for d in docs]


@router.post("/{chat_id}")
async def save_message(request: Request, chat_id: str, message: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None or not _check_channel_access(chat_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Persist the message
    messages_collection.insert_one({
        "chatId": chat_id,
        "message": message
    })

    # Broadcast immediately to connected websocket clients in this chat
    try:
        await manager.broadcast(chat_id, message)
    except Exception:
        # If broadcasting fails, ignore — message is persisted and clients will pick it up on refresh
        pass

    return {"status": "saved"}


@router.patch("/{chat_id}/{message_id}")
def update_message(request: Request, chat_id: str, message_id: str, message: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None or not _check_channel_access(chat_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Try to convert message_id to int for matching numeric ids
    try:
        mid = int(message_id)
    except Exception:
        mid = message_id

    # Update the message document where message.id matches
    res = messages_collection.update_one(
        {"chatId": chat_id, "message.id": mid},
        {"$set": {"message": message}}
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    return {"status": "updated"}
