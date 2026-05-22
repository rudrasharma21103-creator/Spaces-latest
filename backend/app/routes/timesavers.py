from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pymongo import ReturnDocument
from starlette import status

from app.database import (
    messages_collection,
    pinned_channels_collection,
    spaces_collection,
    starred_messages_collection,
    users_collection,
)
from app.routes.messages import (
    _check_channel_access,
    _extract_id,
    _get_user_id_from_request,
    _message_id_candidates,
)
from app.ws_manager import manager

router = APIRouter()


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _user_id_candidates(user_id):
    candidates = [user_id, str(user_id)]
    try:
        candidates.append(int(user_id))
    except (TypeError, ValueError):
        pass
    deduped = []
    seen = set()
    for item in candidates:
        key = f"{type(item).__name__}:{item}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _require_user_id(request: Request):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user_id


def _find_accessible_message(message_id: str, user_id):
    docs = list(messages_collection.find(
        {"message.id": {"$in": _message_id_candidates(str(message_id))}},
        {"_id": 0},
    ))
    inaccessible_found = False
    for doc in docs:
        chat_id = doc.get("chatId")
        message = doc.get("message")
        if not chat_id or not message:
            continue
        if _check_channel_access(str(chat_id), user_id):
            return doc
        inaccessible_found = True

    if inaccessible_found:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")


def _find_channel_space(channel_id: str):
    candidates = [channel_id, str(channel_id)]
    try:
        candidates.append(int(channel_id))
    except (TypeError, ValueError):
        pass
    return spaces_collection.find_one(
        {"channels.id": {"$in": candidates}},
        {"_id": 0},
    )


def _find_channel_in_space(space: dict, channel_id: str):
    if not space:
        return None
    for channel in space.get("channels") or []:
        if str(channel.get("id")) == str(channel_id):
            return channel
    return None


def _space_channel_index():
    index = {}
    projection = {"_id": 0, "id": 1, "name": 1, "ownerId": 1, "createdBy": 1, "members": 1, "channels": 1}
    for space in spaces_collection.find({}, projection):
        for channel in space.get("channels") or []:
            channel_id = channel.get("id")
            if channel_id is not None:
                index[str(channel_id)] = {"space": space, "channel": channel}
    return index


def _space_owner_id(space: dict):
    return _extract_id(space.get("ownerId") or space.get("createdBy"))


def _has_channel_access(space: dict, channel: dict, user_id):
    if not space or not channel:
        return False
    if _space_owner_id(space) == str(user_id):
        return True
    channel_members = channel.get("members") or []
    space_members = space.get("members") or []
    return (
        any(_extract_id(member) == str(user_id) for member in channel_members) or
        any(_extract_id(member) == str(user_id) for member in space_members)
    )


def _message_context(chat_id, channel_index=None):
    if isinstance(chat_id, str) and chat_id.startswith("dm_"):
        return {
            "spaceId": None,
            "spaceName": "Direct messages",
            "channelId": chat_id,
            "channelName": "Direct message",
        }
    match = (channel_index or {}).get(str(chat_id))
    space = match.get("space") if match else _find_channel_space(str(chat_id))
    channel = match.get("channel") if match else (_find_channel_in_space(space, str(chat_id)) if space else None)
    return {
        "spaceId": space.get("id") if space else None,
        "spaceName": space.get("name") if space else None,
        "channelId": channel.get("id") if channel else chat_id,
        "channelName": channel.get("name") if channel else None,
    }


def _sender_for_message(message: dict, sender_cache=None):
    user_id = message.get("userId") or message.get("senderId") or message.get("createdBy")
    cache_key = str(user_id) if user_id is not None else None
    if sender_cache is not None and cache_key in sender_cache:
        user = sender_cache[cache_key]
    else:
        user = users_collection.find_one({"id": {"$in": _user_id_candidates(user_id)}}, {"_id": 0, "name": 1, "id": 1}) if user_id is not None else None
        if sender_cache is not None and cache_key is not None:
            sender_cache[cache_key] = user
    return {
        "id": user.get("id") if user else user_id,
        "name": user.get("name") if user else message.get("userName") or "Unknown user",
    }


async def _send_timesavers_update(user_id, kind, action, payload):
    try:
        await manager.send_to_user(str(user_id), {
            "type": "timesavers_updated",
            "kind": kind,
            "action": action,
            "payload": payload,
        })
    except Exception:
        pass


def _starred_response_item(star: dict, doc: dict = None, channel_index=None, sender_cache=None):
    if not doc and not star.get("message"):
        doc = messages_collection.find_one(
            {"chatId": star.get("chatId"), "message.id": {"$in": _message_id_candidates(str(star.get("messageId")))}},
            {"_id": 0},
        )
    if doc and doc.get("message"):
        message = doc["message"]
        chat_id = doc.get("chatId")
    else:
        message = star.get("message")
        chat_id = star.get("chatId")
    if not message:
        return None
    context = {
        "spaceId": star.get("spaceId"),
        "spaceName": star.get("spaceName"),
        "channelId": star.get("channelId"),
        "channelName": star.get("channelName"),
    }
    if not context.get("channelId"):
        context = _message_context(chat_id, channel_index)
    return {
        "id": f"{chat_id}:{message.get('id')}",
        "messageId": message.get("id"),
        "chatId": chat_id,
        "message": message,
        "sender": star.get("sender") or _sender_for_message(message, sender_cache),
        "spaceId": context.get("spaceId"),
        "spaceName": context.get("spaceName"),
        "channelId": context.get("channelId"),
        "channelName": context.get("channelName"),
        "createdAt": star.get("createdAt"),
    }


def _pinned_response_item(pin: dict, channel_index=None):
    match = (channel_index or {}).get(str(pin.get("channelId")))
    space = match.get("space") if match else _find_channel_space(str(pin.get("channelId")))
    channel = match.get("channel") if match else (_find_channel_in_space(space, str(pin.get("channelId"))) if space else None)
    if not space or not channel:
        return None
    return {
        "id": f"{space.get('id')}:{channel.get('id')}",
        "spaceId": space.get("id"),
        "spaceName": space.get("name"),
        "channelId": channel.get("id"),
        "channelName": channel.get("name"),
        "createdAt": pin.get("createdAt"),
    }


@router.post("/messages/{message_id}/star")
async def star_message(request: Request, message_id: str):
    user_id = _require_user_id(request)
    doc = _find_accessible_message(message_id, user_id)
    message = doc["message"]
    now = _now_iso()
    context = _message_context(doc.get("chatId"))
    sender = _sender_for_message(message)
    record = starred_messages_collection.find_one_and_update(
        {"userId": user_id, "messageId": str(message.get("id")), "chatId": doc.get("chatId")},
        {
            "$set": {
                "message": message,
                "sender": sender,
                "spaceId": context.get("spaceId"),
                "spaceName": context.get("spaceName"),
                "channelId": context.get("channelId"),
                "channelName": context.get("channelName"),
                "updatedAt": now,
            },
            "$setOnInsert": {
                "userId": user_id,
                "messageId": str(message.get("id")),
                "chatId": doc.get("chatId"),
                "createdAt": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    item = _starred_response_item(record, doc=doc)
    await _send_timesavers_update(user_id, "starred_messages", "star", item)
    return {"status": "starred", "item": item}


@router.delete("/messages/{message_id}/star")
async def unstar_message(request: Request, message_id: str):
    user_id = _require_user_id(request)
    doc = _find_accessible_message(message_id, user_id)
    starred_messages_collection.delete_one({
        "userId": user_id,
        "messageId": str(doc["message"].get("id")),
        "chatId": doc.get("chatId"),
    })
    payload = {"messageId": doc["message"].get("id"), "chatId": doc.get("chatId")}
    await _send_timesavers_update(user_id, "starred_messages", "unstar", payload)
    return {"status": "unstarred"}


@router.get("/me/starred-messages")
def get_starred_messages(request: Request):
    user_id = _require_user_id(request)
    records = list(starred_messages_collection.find({"userId": user_id}, {"_id": 0}).sort("createdAt", -1))
    items = []
    stale_records = []
    channel_index = _space_channel_index()
    sender_cache = {}
    for record in records:
        chat_id = record.get("chatId")
        if not chat_id or not _check_channel_access(str(chat_id), user_id):
            continue
        item = _starred_response_item(record, channel_index=channel_index, sender_cache=sender_cache)
        if item:
            items.append(item)
        else:
            stale_records.append(record)
    for record in stale_records:
        starred_messages_collection.delete_one({
            "userId": user_id,
            "messageId": record.get("messageId"),
            "chatId": record.get("chatId"),
        })
    return {"items": items}


@router.post("/channels/{channel_id}/pin")
async def pin_channel(request: Request, channel_id: str):
    user_id = _require_user_id(request)
    space = _find_channel_space(channel_id)
    channel = _find_channel_in_space(space, channel_id) if space else None
    if not space or not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    if not _has_channel_access(space, channel, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    now = _now_iso()
    record = pinned_channels_collection.find_one_and_update(
        {"userId": user_id, "channelId": str(channel.get("id"))},
        {
            "$set": {
                "spaceId": space.get("id"),
                "spaceName": space.get("name"),
                "channelName": channel.get("name"),
                "updatedAt": now,
            },
            "$setOnInsert": {
                "userId": user_id,
                "channelId": str(channel.get("id")),
                "createdAt": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    item = _pinned_response_item(record, {str(channel.get("id")): {"space": space, "channel": channel}})
    await _send_timesavers_update(user_id, "pinned_channels", "pin", item)
    return {"status": "pinned", "item": item}


@router.delete("/channels/{channel_id}/pin")
async def unpin_channel(request: Request, channel_id: str):
    user_id = _require_user_id(request)
    space = _find_channel_space(channel_id)
    channel = _find_channel_in_space(space, channel_id) if space else None
    if not space or not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    if not _has_channel_access(space, channel, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    pinned_channels_collection.delete_one({"userId": user_id, "channelId": str(channel.get("id"))})
    payload = {"channelId": channel.get("id"), "spaceId": space.get("id")}
    await _send_timesavers_update(user_id, "pinned_channels", "unpin", payload)
    return {"status": "unpinned"}


@router.get("/me/pinned-channels")
def get_pinned_channels(request: Request):
    user_id = _require_user_id(request)
    records = list(pinned_channels_collection.find({"userId": user_id}, {"_id": 0}).sort("createdAt", -1))
    items = []
    stale_records = []
    channel_index = _space_channel_index()
    for record in records:
        match = channel_index.get(str(record.get("channelId")))
        space = match.get("space") if match else None
        channel = match.get("channel") if match else None
        if not space or not channel:
            stale_records.append(record)
            continue
        if not _has_channel_access(space, channel, user_id):
            continue
        item = _pinned_response_item(record, channel_index)
        if item:
            items.append(item)
    for record in stale_records:
        pinned_channels_collection.delete_one({"userId": user_id, "channelId": record.get("channelId")})
    return {"items": items}
