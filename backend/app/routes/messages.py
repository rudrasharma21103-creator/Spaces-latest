from fastapi import APIRouter, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from starlette import status
from app.ws_manager import manager
from app.database import messages_collection, spaces_collection
from app.auth import verify_ws_token
import time

_ACCESS_CACHE_TTL_SECONDS = 2.0
_channel_access_cache = {}

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


def _message_id_candidates(message_id: str):
    candidates = [message_id]
    try:
        mid = int(message_id)
        candidates.append(mid)
        candidates.append(str(mid))
    except Exception:
        pass
    # Preserve order while removing duplicates
    deduped = []
    seen = set()
    for item in candidates:
        key = f"{type(item).__name__}:{item}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _message_filter(chat_id: str, message_id):
    return {"chatId": chat_id, "message.id": {"$in": _message_id_candidates(str(message_id))}}


def _extract_id(value):
    if value is None:
        return None
    try:
        if isinstance(value, dict):
            if "id" in value:
                return str(value.get("id"))
            if "userId" in value:
                return str(value.get("userId"))
            if "_id" in value:
                nested_id = value.get("_id")
                if isinstance(nested_id, dict) and "$oid" in nested_id:
                    return str(nested_id.get("$oid"))
                return str(nested_id)
    except Exception:
        pass
    try:
        return str(value)
    except Exception:
        return None


def _id_in_list(uid, values):
    if uid is None or not values:
        return False

    expected = str(uid)
    for item in values:
        if _extract_id(item) == expected:
            return True
    return False


def _normalized_chat_ids(chat_id: str):
    normalized_ids = {chat_id}
    try:
        normalized_ids.add(str(chat_id))
    except Exception:
        pass

    try:
        cid = int(chat_id)
        normalized_ids.add(cid)
        normalized_ids.add(str(cid))
    except Exception:
        pass

    return normalized_ids


def _get_channel_role(chat_id: str, user_id: int):
    if user_id is None:
        return None

    # DMs have no owner/admin moderation role. A participant can only manage
    # their own messages.
    if isinstance(chat_id, str) and chat_id.startswith("dm_"):
        try:
            parts = chat_id.split("_")
            ids = [int(parts[1]), int(parts[2])]
            return "member" if user_id in ids else None
        except Exception:
            return None

    normalized_ids = _normalized_chat_ids(chat_id)
    space = spaces_collection.find_one({
        "channels.id": {"$in": list(normalized_ids)}
    }, {"ownerId": 1, "createdBy": 1, "members": 1, "channels.id": 1, "channels.members": 1, "channels.roles": 1})
    if not space:
        return None

    target_str_ids = {str(val) for val in normalized_ids if val is not None}
    channel = None
    for ch in (space.get("channels") or []):
        if str(ch.get("id")) in target_str_ids:
            channel = ch
            break
    if not channel:
        return None

    owner_id = space.get("ownerId") or space.get("createdBy")
    if _extract_id(owner_id) == str(user_id):
        return "owner"

    roles = channel.get("roles") or {}
    explicit_role = roles.get(str(user_id))
    if explicit_role in ("owner", "admin", "member"):
        return explicit_role

    if _id_in_list(user_id, channel.get("members") or []) or _id_in_list(user_id, space.get("members") or []):
        return "member"

    return None


def _message_owner_id(message: dict):
    for key in ("userId", "user_id", "createdBy", "created_by", "senderId", "sender_id"):
        owner = _extract_id(message.get(key))
        if owner is not None:
            return owner
    return None


def _can_delete_message(chat_id: str, user_id: int, message: dict):
    if user_id is None or not message:
        return False

    if _message_owner_id(message) == str(user_id):
        return True

    return _get_channel_role(chat_id, user_id) in ("owner", "admin")


def _attachment_matches(attachment: dict, attachment_id: str):
    if not attachment or attachment_id is None:
        return False

    candidates = (
        "id",
        "fileId",
        "drive_file_id",
        "driveId",
        "url",
        "public_url",
        "webViewLink",
        "name",
    )
    target = str(attachment_id)
    return any(attachment.get(key) is not None and str(attachment.get(key)) == target for key in candidates)


def _check_channel_access(chat_id: str, user_id: int):
    cache_key = (str(chat_id), str(user_id))
    cached = _channel_access_cache.get(cache_key)
    now = time.monotonic()
    if cached and cached[1] > now:
        return cached[0]

    # Allow DM chats where chat id is like 'dm_<id1>_<id2>' if user is participant
    if isinstance(chat_id, str) and chat_id.startswith("dm_"):
        try:
            parts = chat_id.split("_")
            ids = [int(parts[1]), int(parts[2])]
            allowed = user_id in ids
            _channel_access_cache[cache_key] = (allowed, now + _ACCESS_CACHE_TTL_SECONDS)
            return allowed
        except Exception:
            return False

    # Normalize id representations so we can match regardless of whether Mongo stored the channel
    # id as an int or a string (PyMongo may store JSON numbers as strings depending on source data).
    normalized_ids = _normalized_chat_ids(chat_id)

    # Find the space and channel that contains this channel id, using any normalized form
    space = spaces_collection.find_one({
        "channels.id": {"$in": list(normalized_ids)}
    }, {"ownerId": 1, "createdBy": 1, "members": 1, "channels.id": 1, "channels.members": 1})
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
            _channel_access_cache[cache_key] = (True, now + _ACCESS_CACHE_TTL_SECONDS)
            return True
    except Exception:
        pass

    # User has access if they are in space members, or in channel members
    if _id_in_list(user_id, space_members) or _id_in_list(user_id, channel_members):
        _channel_access_cache[cache_key] = (True, now + _ACCESS_CACHE_TTL_SECONDS)
        return True

    _channel_access_cache[cache_key] = (False, now + _ACCESS_CACHE_TTL_SECONDS)
    return False


def _fetch_messages(chat_id: str):
    docs = messages_collection.find({"chatId": chat_id}, {"_id": 0}).sort("message.timestamp", 1)
    return [d["message"] for d in docs]


def _fetch_message_document(chat_id: str, message_id: str):
    return messages_collection.find_one(_message_filter(chat_id, message_id), {"_id": 0})


def _count_messages(chat_id: str):
    return messages_collection.count_documents({"chatId": chat_id})


def _save_message_document(chat_id: str, message: dict):
    message_id = message.get("id")
    if message_id is not None:
        messages_collection.update_one(
            _message_filter(chat_id, message_id),
            {"$set": {"chatId": chat_id, "message": message}},
            upsert=True,
        )
        return

    messages_collection.insert_one({"chatId": chat_id, "message": message})


def _delete_message_documents(chat_id: str, message_id: str):
    return messages_collection.delete_many(_message_filter(chat_id, message_id))


def _remove_message_attachment(chat_id: str, message_id: str, attachment_id: str):
    doc = _fetch_message_document(chat_id, message_id)
    if not doc or not doc.get("message"):
        return {"found": False}

    message = doc["message"]
    attachments = message.get("attachments") or []
    remaining = [att for att in attachments if not _attachment_matches(att, attachment_id)]
    if len(remaining) == len(attachments):
        return {"found": True, "attachment_found": False, "message": message}

    message["attachments"] = remaining
    text = str(message.get("text") or "").strip()
    if not remaining and not text:
        res = _delete_message_documents(chat_id, message_id)
        return {
            "found": True,
            "attachment_found": True,
            "message_deleted": res.deleted_count > 0,
            "message": message,
        }

    messages_collection.update_one(
        _message_filter(chat_id, message_id),
        {"$set": {"message.attachments": remaining, "message.attachmentsUpdatedAt": time.time()}}
    )
    return {
        "found": True,
        "attachment_found": True,
        "message_deleted": False,
        "message": message,
    }


@router.get("/{chat_id}")
def get_messages(request: Request, chat_id: str):
    user_id = _get_user_id_from_request(request)
    has_access = _check_channel_access(chat_id, user_id) if user_id else False

    if user_id is None or not has_access:
        return []

    return _fetch_messages(chat_id)


@router.get("/{chat_id}/count")
def get_message_count(request: Request, chat_id: str):
    user_id = _get_user_id_from_request(request)
    if user_id is None or not _check_channel_access(chat_id, user_id):
        return {"count": 0}

    count = _count_messages(chat_id)
    return {"count": count}


@router.post("/{chat_id}")
async def save_message(request: Request, chat_id: str, message: dict):
    user_id = _get_user_id_from_request(request)
    has_access = await run_in_threadpool(_check_channel_access, chat_id, user_id) if user_id is not None else False
    if user_id is None or not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await run_in_threadpool(_save_message_document, chat_id, message)

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

    # Update the message document where message.id matches
    res = messages_collection.update_one(
        _message_filter(chat_id, message_id),
        {"$set": {"message": message}}
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    return {"status": "updated"}


@router.delete("/{chat_id}/{message_id}/attachments/{attachment_id}")
async def delete_message_attachment(request: Request, chat_id: str, message_id: str, attachment_id: str):
    user_id = _get_user_id_from_request(request)
    has_access = await run_in_threadpool(_check_channel_access, chat_id, user_id) if user_id is not None else False
    if user_id is None or not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    doc = await run_in_threadpool(_fetch_message_document, chat_id, message_id)
    if not doc or not doc.get("message"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    message = doc["message"]
    if not _can_delete_message(chat_id, user_id, message):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's file")

    result = await run_in_threadpool(_remove_message_attachment, chat_id, message_id, attachment_id)
    if not result.get("attachment_found"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")

    try:
        if result.get("message_deleted"):
            await manager.broadcast(chat_id, {
                "type": "message_deleted",
                "chatId": chat_id,
                "messageId": message_id,
            })
        else:
            await manager.broadcast(chat_id, result.get("message"))
    except Exception:
        pass

    return {"status": "deleted", "messageDeleted": bool(result.get("message_deleted"))}


@router.delete("/{chat_id}/{message_id}")
async def delete_message(request: Request, chat_id: str, message_id: str):
    user_id = _get_user_id_from_request(request)
    has_access = await run_in_threadpool(_check_channel_access, chat_id, user_id) if user_id is not None else False
    if user_id is None or not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    doc = await run_in_threadpool(_fetch_message_document, chat_id, message_id)
    if not doc or not doc.get("message"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if not _can_delete_message(chat_id, user_id, doc["message"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's message")

    res = await run_in_threadpool(_delete_message_documents, chat_id, message_id)

    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    try:
        await manager.broadcast(chat_id, {
            "type": "message_deleted",
            "chatId": chat_id,
            "messageId": message_id,
        })
    except Exception:
        pass

    return {"status": "deleted"}
