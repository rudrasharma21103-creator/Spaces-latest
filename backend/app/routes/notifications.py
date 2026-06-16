from datetime import datetime, timezone
import time
import uuid

from fastapi import APIRouter, HTTPException, Request, status

from app.database import notifications_collection, spaces_collection, users_collection
from app.deps import get_request_user
from app.ws_manager import manager

router = APIRouter(prefix="/notifications")

INVITE_TYPES = {
    "friend_request",
    "connection_invite",
    "space_invite",
    "channel_invite",
}

RESPONSE_TYPES = {
    "connection_invite_response",
    "space_invite_response",
    "channel_invite_response",
}


def id_query_values(value):
    values = []
    for candidate in (value, str(value) if value is not None else None):
        if candidate is not None and candidate not in values:
            values.append(candidate)
    try:
        numeric = int(value)
        if numeric not in values:
            values.append(numeric)
    except (TypeError, ValueError):
        pass
    return values


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _now_ms():
    return int(time.time() * 1000)


def _get_actor(request: Request):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def _get_user_by_id(user_id, projection=None):
    if user_id is None:
        return None
    return users_collection.find_one({"id": {"$in": id_query_values(user_id)}}, projection)


def _find_space(space_id):
    if space_id is None:
        return None
    return spaces_collection.find_one({"id": {"$in": id_query_values(space_id)}})


def _find_channel(space, channel_id):
    if not space or channel_id is None:
        return None
    for channel in space.get("channels") or []:
        if str(channel.get("id")) == str(channel_id):
            return channel
    return None


def _display_name(user, fallback="Someone"):
    if not user:
        return fallback
    return user.get("name") or user.get("email") or str(user.get("id") or fallback)


def _timestamp_to_iso(value):
    if not value:
        return None
    if isinstance(value, str):
        return value
    try:
        numeric = float(value)
        if numeric < 100000000000:
            numeric *= 1000
        return datetime.fromtimestamp(numeric / 1000, timezone.utc).isoformat()
    except Exception:
        return None


def normalize_notification(notification: dict):
    if not notification:
        return None

    item = dict(notification)
    if item.get("_id") is not None:
        try:
            item["_id"] = str(item["_id"])
        except Exception:
            item.pop("_id", None)

    item["id"] = str(item.get("id") or item.get("_id") or f"notif-{uuid.uuid4().hex}")
    item["recipientId"] = str(item.get("recipientId") or item.get("userId") or item.get("toId") or "")
    sender_id = item.get("senderId")
    if sender_id is None:
        sender_id = item.get("fromId") or item.get("from")
    if sender_id is not None:
        item["senderId"] = str(sender_id)
        item.setdefault("fromId", str(sender_id))

    legacy_type = item.get("type")
    if legacy_type == "friend_request":
        item["type"] = "connection_invite"
    else:
        item["type"] = legacy_type or "info"

    item["status"] = item.get("status") if item.get("status") in ("unread", "read") else "unread"
    if item.get("actionStatus") is None and legacy_type == "friend_request":
        item["actionStatus"] = "pending"
    elif item.get("actionStatus") is None and item["type"] in INVITE_TYPES:
        item["actionStatus"] = item.get("status") if item.get("status") in ("pending", "accepted", "declined", "withdrawn") else "pending"
    elif item.get("actionStatus") is None:
        item["actionStatus"] = None

    metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
    for key in ("spaceName", "channelName", "taskTitle", "senderName", "recipientName", "dueDate", "source"):
        if item.get(key) is not None and metadata.get(key) is None:
            metadata[key] = item.get(key)
    if item.get("from") and not metadata.get("senderName"):
        metadata["senderName"] = item.get("from")
    item["metadata"] = metadata

    created_at = item.get("createdAt") or _timestamp_to_iso(item.get("timestamp")) or _now_iso()
    item["createdAt"] = created_at
    item["updatedAt"] = item.get("updatedAt") or created_at
    if item.get("timestamp") is None:
        item["timestamp"] = _now_ms()

    return item


async def create_notification(
    recipient_id,
    sender_id=None,
    type="info",
    message="",
    action_status=None,
    status_value="unread",
    space_id=None,
    channel_id=None,
    task_id=None,
    metadata=None,
    dedupe_key=None,
    extra=None,
):
    if recipient_id is None:
        return None

    now = _now_iso()
    notif_id = f"notif-{uuid.uuid4().hex}"
    payload = {
        "id": notif_id,
        "recipientId": str(recipient_id),
        "senderId": str(sender_id) if sender_id is not None else None,
        "fromId": str(sender_id) if sender_id is not None else None,
        "type": type,
        "status": status_value if status_value in ("unread", "read") else "unread",
        "actionStatus": action_status,
        "spaceId": str(space_id) if space_id is not None else None,
        "channelId": str(channel_id) if channel_id is not None else None,
        "taskId": str(task_id) if task_id is not None else None,
        "message": message or "",
        "metadata": metadata or {},
        "dedupeKey": dedupe_key,
        "createdAt": now,
        "updatedAt": now,
        "readAt": None,
        "timestamp": _now_ms(),
    }
    if extra:
        payload.update(extra)
    payload = normalize_notification(payload)

    if dedupe_key:
        existing_user = users_collection.find_one(
            {
                "id": {"$in": id_query_values(recipient_id)},
                "notifications": {"$elemMatch": {"dedupeKey": dedupe_key, "actionStatus": {"$ne": "withdrawn"}}},
            },
            {"notifications.$": 1},
        )
        existing = (existing_user or {}).get("notifications") or []
        if existing:
            return normalize_notification(existing[0])

    users_collection.update_one(
        {"id": {"$in": id_query_values(recipient_id)}},
        {"$push": {"notifications": payload}},
    )
    try:
        notifications_collection.update_one(
            {"id": payload["id"]},
            {"$set": payload},
            upsert=True,
        )
    except Exception:
        pass

    try:
        await manager.send_to_user(str(recipient_id), {"type": "notification", "notification": payload})
    except Exception:
        pass

    return payload


def _get_user_notification(user_id, notification_id):
    user = users_collection.find_one(
        {
            "id": {"$in": id_query_values(user_id)},
            "notifications.id": notification_id,
        },
        {"notifications.$": 1},
    )
    notifications = (user or {}).get("notifications") or []
    if notifications:
        return normalize_notification(notifications[0])
    found = notifications_collection.find_one({"id": notification_id, "recipientId": str(user_id)})
    return normalize_notification(found) if found else None


def _set_notification_fields(user_id, notification_id, fields):
    set_doc = {f"notifications.$.{key}": value for key, value in fields.items()}
    users_collection.update_one(
        {
            "id": {"$in": id_query_values(user_id)},
            "notifications.id": notification_id,
        },
        {"$set": set_doc},
    )
    notifications_collection.update_one({"id": notification_id}, {"$set": fields})


def _set_sender_copy_fields(sender_id, managed_notification_id, fields):
    if sender_id is None or not managed_notification_id:
        return
    set_doc = {f"notifications.$.{key}": value for key, value in fields.items()}
    users_collection.update_many(
        {
            "id": {"$in": id_query_values(sender_id)},
            "notifications.metadata.managedNotificationId": str(managed_notification_id),
        },
        {"$set": set_doc},
    )
    notifications_collection.update_many(
        {
            "recipientId": str(sender_id),
            "metadata.managedNotificationId": str(managed_notification_id),
        },
        {"$set": fields},
    )


def _apply_membership(space_id, channel_id, user_id):
    space = _find_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    channels = space.get("channels") or []
    if channel_id is not None:
        updated = False
        for channel in channels:
            if str(channel.get("id")) != str(channel_id):
                continue
            members = [str(member) for member in (channel.get("members") or [])]
            if str(user_id) not in members:
                channel.setdefault("members", []).append(user_id)
            roles = channel.get("roles") or {}
            roles.setdefault(str(user_id), "member")
            channel["roles"] = roles
            updated = True
            break
        if not updated:
            raise HTTPException(status_code=404, detail="Channel not found")
        spaces_collection.update_one(
            {"id": space.get("id")},
            {
                "$addToSet": {"members": user_id},
                "$set": {"channels": channels},
            },
        )
    else:
        spaces_collection.update_one({"id": space.get("id")}, {"$addToSet": {"members": user_id}})

    users_collection.update_one({"id": {"$in": id_query_values(user_id)}}, {"$addToSet": {"spaces": space.get("id")}})

    return spaces_collection.find_one({"id": space.get("id")}, {"_id": 0})


async def accept_notification_for_user(user_id, notification_id):
    notification = _get_user_notification(user_id, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.get("actionStatus") not in (None, "pending"):
        _set_notification_fields(user_id, notification_id, {"status": "read", "readAt": _now_iso(), "updatedAt": _now_iso()})
        return {"status": notification.get("actionStatus"), "notification": notification}

    actor = _get_user_by_id(user_id)
    sender_id = notification.get("senderId") or notification.get("fromId")
    sender = _get_user_by_id(sender_id)
    now = _now_iso()
    response_message = None
    joined_space = None

    if notification.get("type") in ("connection_invite", "friend_request"):
        if sender_id is None:
            raise HTTPException(status_code=400, detail="Sender missing")
        users_collection.update_one({"id": {"$in": id_query_values(user_id)}}, {"$addToSet": {"friends": sender_id}})
        users_collection.update_one({"id": {"$in": id_query_values(sender_id)}}, {"$addToSet": {"friends": user_id}})
        response_message = f"{_display_name(actor)} accepted your connection invite"
        await manager.send_to_user(str(user_id), {"type": "friends_updated"})
        await manager.send_to_user(str(sender_id), {"type": "friends_updated"})
    elif notification.get("type") in ("space_invite", "channel_invite"):
        joined_space = _apply_membership(notification.get("spaceId"), notification.get("channelId"), user_id)
        channel_name = notification.get("metadata", {}).get("channelName")
        space_name = notification.get("metadata", {}).get("spaceName") or (joined_space or {}).get("name") or "space"
        if notification.get("channelId"):
            response_message = f"{_display_name(actor)} accepted your invite to join #{channel_name or 'channel'} in {space_name}"
        else:
            response_message = f"{_display_name(actor)} accepted your invite to join {space_name}"
        await manager.send_to_user(str(user_id), {"type": "sync_spaces", "spaceId": notification.get("spaceId")})

    _set_notification_fields(
        user_id,
        notification_id,
        {"status": "read", "actionStatus": "accepted", "readAt": now, "updatedAt": now},
    )
    _set_sender_copy_fields(sender_id, notification_id, {"status": "read", "actionStatus": "accepted", "updatedAt": now})

    if sender_id and response_message:
        await create_notification(
            recipient_id=sender_id,
            sender_id=user_id,
            type="connection_invite_response" if notification.get("type") in ("connection_invite", "friend_request") else f"{notification.get('type')}_response",
            message=response_message,
            action_status="accepted",
            status_value="unread",
            space_id=notification.get("spaceId"),
            channel_id=notification.get("channelId"),
            metadata={
                **(notification.get("metadata") or {}),
                "senderName": _display_name(actor),
                "recipientName": _display_name(sender),
            },
        )

    return {"status": "accepted", "notificationId": notification_id, "space": joined_space}


async def decline_notification_for_user(user_id, notification_id):
    notification = _get_user_notification(user_id, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    actor = _get_user_by_id(user_id)
    sender_id = notification.get("senderId") or notification.get("fromId")
    sender = _get_user_by_id(sender_id)
    now = _now_iso()
    _set_notification_fields(
        user_id,
        notification_id,
        {"status": "read", "actionStatus": "declined", "readAt": now, "updatedAt": now},
    )
    _set_sender_copy_fields(sender_id, notification_id, {"status": "read", "actionStatus": "declined", "updatedAt": now})

    response_message = None
    if notification.get("type") in ("connection_invite", "friend_request"):
        response_message = f"{_display_name(actor)} declined your connection invite"
    elif notification.get("type") in ("space_invite", "channel_invite"):
        metadata = notification.get("metadata") or {}
        if notification.get("channelId"):
            response_message = f"{_display_name(actor)} declined your invite to join #{metadata.get('channelName') or 'channel'} in {metadata.get('spaceName') or 'space'}"
        else:
            response_message = f"{_display_name(actor)} declined your invite to join {metadata.get('spaceName') or 'space'}"

    if sender_id and response_message:
        await create_notification(
            recipient_id=sender_id,
            sender_id=user_id,
            type="connection_invite_response" if notification.get("type") in ("connection_invite", "friend_request") else f"{notification.get('type')}_response",
            message=response_message,
            action_status="declined",
            status_value="unread",
            space_id=notification.get("spaceId"),
            channel_id=notification.get("channelId"),
            metadata={
                **(notification.get("metadata") or {}),
                "senderName": _display_name(actor),
                "recipientName": _display_name(sender),
            },
        )

    return {"status": "declined", "notificationId": notification_id}


@router.get("")
def get_notifications(request: Request):
    actor = _get_actor(request)
    user = _get_user_by_id(actor.get("id"), {"notifications": 1})
    notifications = [normalize_notification(item) for item in ((user or {}).get("notifications") or [])]
    notifications = [item for item in notifications if item]
    notifications.sort(key=lambda item: item.get("createdAt") or "", reverse=True)
    return notifications


@router.get("/{notification_id}")
def get_notification(request: Request, notification_id: str):
    actor = _get_actor(request)
    notification = _get_user_notification(actor.get("id"), notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/{notification_id}/read")
def mark_notification_read(request: Request, notification_id: str):
    actor = _get_actor(request)
    now = _now_iso()
    _set_notification_fields(actor.get("id"), notification_id, {"status": "read", "readAt": now, "updatedAt": now})
    return {"status": "read", "notificationId": notification_id}


@router.post("/{notification_id}/accept")
async def accept_notification(request: Request, notification_id: str):
    actor = _get_actor(request)
    return await accept_notification_for_user(actor.get("id"), notification_id)


@router.post("/{notification_id}/decline")
async def decline_notification(request: Request, notification_id: str):
    actor = _get_actor(request)
    return await decline_notification_for_user(actor.get("id"), notification_id)


@router.post("/{notification_id}/withdraw")
def withdraw_notification(request: Request, notification_id: str):
    actor = _get_actor(request)
    notification = _get_user_notification(actor.get("id"), notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    now = _now_iso()
    metadata = notification.get("metadata") or {}
    managed_notification_id = metadata.get("managedNotificationId")
    managed_recipient_id = metadata.get("recipientId")
    if managed_notification_id and managed_recipient_id:
        _set_notification_fields(managed_recipient_id, managed_notification_id, {"actionStatus": "withdrawn", "status": "read", "updatedAt": now})
    _set_notification_fields(actor.get("id"), notification_id, {"actionStatus": "withdrawn", "status": "read", "updatedAt": now})
    return {"status": "withdrawn", "notificationId": notification_id}


@router.post("/{notification_id}/remind")
async def remind_notification(request: Request, notification_id: str):
    actor = _get_actor(request)
    notification = _get_user_notification(actor.get("id"), notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    metadata = notification.get("metadata") or {}
    managed_notification_id = metadata.get("managedNotificationId")
    managed_recipient_id = metadata.get("recipientId")
    if managed_notification_id and managed_recipient_id:
        target_notification = _get_user_notification(managed_recipient_id, managed_notification_id)
        if not target_notification:
            raise HTTPException(status_code=404, detail="Managed invite not found")
        try:
            await manager.send_to_user(str(managed_recipient_id), {"type": "notification", "notification": target_notification})
        except Exception:
            pass
        return {"status": "reminded", "notificationId": notification_id}
    try:
        await manager.send_to_user(str(notification.get("recipientId")), {"type": "notification", "notification": notification})
    except Exception:
        pass
    return {"status": "reminded", "notificationId": notification_id}
