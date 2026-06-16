from fastapi import APIRouter, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from starlette import status
from app.database import tasks_collection, messages_collection, spaces_collection, users_collection
from app.ws_manager import manager
from app.routes.messages import _get_user_id_from_request
from app.routes.notifications import create_notification
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/tasks")


def _id_query_values(value):
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


def _insert_task_document(task_doc: dict):
    res = tasks_collection.insert_one(task_doc)
    return str(task_doc.get("id") or res.inserted_id)


def _insert_task_messages(
    space_id,
    channel_id,
    created_by,
    message,
    timestamp,
    assigned_to,
    status_field,
    task_id,
    list_id=None,
    list_name=None,
    source_message_id=None,
    assignee_statuses=None,
):
    if not channel_id:
        return []

    payload = {
        "id": task_id,
        "taskId": task_id,
        "userId": created_by,
        "text": message,
        "timestamp": timestamp,
        "type": "task",
        "assigned_to": assigned_to,
        "assignee_statuses": assignee_statuses or {},
        "status": status_field,
        "optimistic": False,
    }
    if space_id:
        payload["spaceId"] = str(space_id)
        payload["space_id"] = str(space_id)
    payload["channelId"] = str(channel_id)
    payload["channel_id"] = str(channel_id)
    if list_id:
        payload["list_id"] = str(list_id)
    if list_name:
        payload["listName"] = str(list_name)
    if source_message_id:
        payload["sourceMessageId"] = str(source_message_id)

    messages_collection.insert_one({"chatId": str(channel_id), "message": payload})
    return [str(channel_id)]


def _user_can_access_space(space_id, user_id):
    if not space_id or user_id is None:
        return False
    space = spaces_collection.find_one(
        {"id": {"$in": _id_query_values(space_id)}},
        {"ownerId": 1, "createdBy": 1, "members": 1, "channels.members": 1},
    )
    if not space:
        return False
    if str(space.get("ownerId") or space.get("createdBy")) == str(user_id):
        return True
    if any(str(member) == str(user_id) for member in (space.get("members") or [])):
        return True
    return any(
        str(member) == str(user_id)
        for channel in (space.get("channels") or [])
        for member in (channel.get("members") or [])
    )


def _find_space_and_channel(space_id, channel_id):
    if not space_id or not channel_id:
        return None, None
    space = spaces_collection.find_one(
        {"id": {"$in": _id_query_values(space_id)}},
        {"id": 1, "name": 1, "ownerId": 1, "createdBy": 1, "members": 1, "channels": 1},
    )
    if not space:
        return None, None
    channel = None
    for ch in space.get("channels") or []:
        if str(ch.get("id")) == str(channel_id):
            channel = ch
            break
    return space, channel


def _user_can_access_channel(space_id, channel_id, user_id):
    space, channel = _find_space_and_channel(space_id, channel_id)
    if not space or not channel:
        return False
    if str(space.get("ownerId") or space.get("createdBy")) == str(user_id):
        return True
    if any(str(member) == str(user_id) for member in (channel.get("members") or [])):
        return True
    if channel.get("type") != "private" and any(str(member) == str(user_id) for member in (space.get("members") or [])):
        return True
    return False


def _get_user_by_id(user_id):
    if user_id is None:
        return None
    values = [user_id, str(user_id)]
    try:
        values.append(int(user_id))
    except Exception:
        pass
    return users_collection.find_one({"id": {"$in": values}}, {"_id": 0, "id": 1, "name": 1, "email": 1})


def _task_lookup_filters(task_id: str):
    filters = [{"id": task_id}]
    try:
        filters.append({"id": int(task_id)})
    except Exception:
        pass
    if len(str(task_id)) == 24:
        try:
            filters.append({"_id": ObjectId(task_id)})
        except Exception:
            pass
    return filters


def _find_task_by_id(task_id: str):
    for query in _task_lookup_filters(task_id):
        try:
            found = tasks_collection.find_one(query)
            if found:
                return found
        except Exception:
            pass
    return None


def _user_can_mutate_task(task_doc: dict, user_id):
    if not task_doc:
        return False
    assigned_ids = {str(item) for item in (task_doc.get("assigned_to") or [])}
    if assigned_ids:
        return str(user_id) in assigned_ids
    return str(task_doc.get("created_by")) == str(user_id)


def _user_can_delete_task(task_doc: dict, user_id):
    if not task_doc:
        return False
    if str(task_doc.get("created_by")) == str(user_id):
        return True
    return any(str(item) == str(user_id) for item in (task_doc.get("assigned_to") or []))


def _normalize_assignee_statuses(task_doc: dict):
    assigned = [str(item) for item in (task_doc.get("assigned_to") or []) if item is not None]
    raw = task_doc.get("assignee_statuses") or task_doc.get("assigneeStatuses") or {}
    statuses = raw if isinstance(raw, dict) else {}
    normalized = {}
    for assignee_id in assigned:
        item = statuses.get(assignee_id) or statuses.get(str(assignee_id)) or {}
        if not isinstance(item, dict):
            item = {"status": str(item)}
        status_value = "completed" if item.get("status") == "completed" else "pending"
        normalized[assignee_id] = {
            "status": status_value,
            "completedAt": item.get("completedAt") or item.get("completed_at"),
        }
    if assigned and task_doc.get("status") == "completed":
        completed_at = task_doc.get("completedAt") or task_doc.get("completed_at") or task_doc.get("timestamp")
        for assignee_id in assigned:
            normalized[assignee_id] = {
                **normalized.get(assignee_id, {}),
                "status": "completed",
                "completedAt": normalized.get(assignee_id, {}).get("completedAt") or completed_at,
            }
    return normalized


def _rollup_task_status(assigned_to, assignee_statuses, fallback_status="pending"):
    assigned = [str(item) for item in (assigned_to or []) if item is not None]
    if not assigned:
        return "completed" if fallback_status == "completed" else "pending"
    return "completed" if all((assignee_statuses.get(user_id) or {}).get("status") == "completed" for user_id in assigned) else "pending"


def _normalize_task_doc(task_doc: dict):
    if not task_doc:
        return task_doc
    db_id = None
    if "_id" in task_doc:
        try:
            db_id = str(task_doc["_id"])
        except Exception:
            db_id = None
        task_doc.pop("_id", None)
    if task_doc.get("id") is not None:
        task_doc["id"] = str(task_doc.get("id"))
    elif db_id:
        task_doc["id"] = db_id
    task_doc["assigned_to"] = [str(item) for item in (task_doc.get("assigned_to") or []) if item is not None]
    task_doc["created_by"] = str(task_doc.get("created_by") or "")
    task_doc["assignee_statuses"] = _normalize_assignee_statuses(task_doc)
    task_doc["status"] = _rollup_task_status(
        task_doc.get("assigned_to") or [],
        task_doc.get("assignee_statuses") or {},
        task_doc.get("status") or "pending",
    )
    hidden_for = task_doc.get("hidden_for") or task_doc.get("hiddenFor") or []
    try:
        task_doc["hidden_for"] = [str(item) for item in hidden_for]
    except Exception:
        task_doc["hidden_for"] = []
    return task_doc


def _message_task_ids(task_doc: dict, task_id: str):
    ids = [task_id, str(task_id)]
    if task_doc:
        if task_doc.get("id") is not None:
            ids.append(task_doc.get("id"))
            ids.append(str(task_doc.get("id")))
        if task_doc.get("_id") is not None:
            ids.append(task_doc.get("_id"))
            ids.append(str(task_doc.get("_id")))
    seen = set()
    unique_ids = []
    for item in ids:
        key = str(item)
        if key in seen:
            continue
        seen.add(key)
        unique_ids.append(item)
    return unique_ids


def _sync_task_messages(task_doc: dict, task_id: str, patch: dict):
    ids = _message_task_ids(task_doc, task_id)
    set_patch = {f"message.{key}": value for key, value in patch.items()}
    if not set_patch:
        return
    try:
        messages_collection.update_many(
            {"$or": [{"message.id": {"$in": ids}}, {"message.taskId": {"$in": ids}}]},
            {"$set": set_patch},
        )
    except Exception:
        pass


def _delete_task_document(task_id: str):
    existing = _find_task_by_id(task_id)
    if not existing:
        return None

    deleted = False
    if existing.get("_id") is not None:
        try:
            deleted = tasks_collection.delete_one({"_id": existing["_id"]}).deleted_count > 0
        except Exception:
            deleted = False

    if not deleted:
        for query in _task_lookup_filters(task_id):
            try:
                if tasks_collection.delete_one(query).deleted_count > 0:
                    deleted = True
                    break
            except Exception:
                pass

    if deleted:
        ids = _message_task_ids(existing, task_id)
        try:
            messages_collection.delete_many(
                {
                    "message.type": "task",
                    "$or": [{"message.id": {"$in": ids}}, {"message.taskId": {"$in": ids}}],
                }
            )
            messages_collection.update_many(
                {
                    "message.type": {"$ne": "task"},
                    "message.taskId": {"$in": ids},
                },
                {"$unset": {"message.taskId": "", "message.taskStatus": ""}},
            )
        except Exception:
            pass

    return existing if deleted else None


def _hide_task_for_user(task_id: str, user_id):
    existing = _find_task_by_id(task_id)
    if not existing:
        return None
    hidden_user_id = str(user_id)
    for query in _task_lookup_filters(task_id):
        try:
            res = tasks_collection.update_one(query, {"$addToSet": {"hidden_for": hidden_user_id}})
            if res and res.matched_count > 0:
                break
        except Exception:
            pass
    ids = _message_task_ids(existing, task_id)
    try:
        messages_collection.update_many(
            {"$or": [{"message.id": {"$in": ids}}, {"message.taskId": {"$in": ids}}]},
            {"$addToSet": {"message.hidden_for": hidden_user_id}},
        )
    except Exception:
        pass
    return existing


def _update_task_status(task_id: str, new_status: str):
    return _update_task_status_for_user(task_id, new_status, None)


def _update_task_status_for_user(task_id: str, new_status: str, user_id):
    existing = _find_task_by_id(task_id)
    if not existing:
        return None

    normalized = _normalize_task_doc(dict(existing))
    assigned = [str(item) for item in (normalized.get("assigned_to") or []) if item is not None]
    assignee_statuses = dict(normalized.get("assignee_statuses") or {})
    status_value = "completed" if new_status == "completed" else "pending"
    now = datetime.now(timezone.utc).isoformat()

    if assigned and user_id is not None:
        assignee_id = str(user_id)
        if assignee_id not in assigned:
            return None
        assignee_statuses[assignee_id] = {
            **(assignee_statuses.get(assignee_id) or {}),
            "status": status_value,
            "completedAt": now if status_value == "completed" else None,
        }
    elif not assigned:
        # Personal/unassigned tasks behave as single-owner tasks.
        assignee_statuses = {}
    else:
        # Older callers without user context should only use this path for bulk normalization.
        return None

    next_status = _rollup_task_status(assigned, assignee_statuses, status_value)
    patch = {
        "status": next_status,
        "assignee_statuses": assignee_statuses,
    }
    if next_status == "completed":
        patch["completedAt"] = now
    else:
        patch["completedAt"] = None

    res = None
    for query in _task_lookup_filters(task_id):
        try:
            res = tasks_collection.update_one(query, {"$set": patch})
            if res and res.matched_count > 0:
                break
        except Exception:
            res = None

    if not res or res.matched_count == 0:
        return None

    updated = _find_task_by_id(task_id)
    _sync_task_messages(
        updated,
        task_id,
        {
            "status": next_status,
            "taskStatus": next_status,
            "assignee_statuses": assignee_statuses,
        },
    )
    return updated


@router.post("")
async def create_task(request: Request, payload: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    # Basic payload validation
    created_by = user_id
    assigned_to = [str(item) for item in (payload.get("assigned_to") or []) if item is not None]
    if not assigned_to:
        assigned_to = [str(user_id)]
    message = payload.get("message") or ""
    source = payload.get("source") or ("channel" if (payload.get("channelId") or payload.get("channel_id")) else "tasks_section")
    if source not in ("tasks_section", "channel"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task source")

    space_id = payload.get("space_id") or payload.get("spaceId")
    channel_id = payload.get("channelId") or payload.get("channel_id")
    channel_name = payload.get("channelName") or payload.get("channel_name")
    space_name = payload.get("spaceName") or payload.get("space_name")

    if source == "channel":
        if not space_id or channel_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="channelId and spaceId are required for channel tasks")
        if not _user_can_access_channel(space_id, channel_id, user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        space_doc, channel_doc = _find_space_and_channel(space_id, channel_id)
        space_name = space_name or (space_doc or {}).get("name")
        channel_name = channel_name or (channel_doc or {}).get("name")
    elif space_id and not _user_can_access_space(space_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    status_field = payload.get("status") or "pending"
    timestamp = payload.get("timestamp")
    # Ensure timestamp exists and is an ISO string
    if not timestamp:
        # Store timestamps as UTC ISO strings with explicit Z for consistency
        timestamp = datetime.now(timezone.utc).isoformat()

    task_doc = {
        "created_by": created_by,
        "assigned_to": assigned_to,
        "message": message,
        "space_id": space_id,
        "channel_id": channel_id if source == "channel" else None,
        "channelName": channel_name if source == "channel" else None,
        "spaceName": space_name,
        "source": source,
        "status": status_field,
        "timestamp": timestamp,
        "assignee_statuses": {
            str(assignee_id): {
                "status": "completed" if status_field == "completed" else "pending",
                "completedAt": timestamp if status_field == "completed" else None,
            }
            for assignee_id in assigned_to
        },
        "hidden_for": [],
    }
    client_task_id = payload.get("id") or payload.get("taskId")
    if client_task_id:
        task_doc["id"] = str(client_task_id)
    list_id = payload.get("list_id") or payload.get("listId")
    list_name = payload.get("listName") or payload.get("list") or payload.get("list_name")
    source_message_id = payload.get("sourceMessageId") or payload.get("source_message_id")
    if list_id:
        task_doc["list_id"] = str(list_id)
    if list_name:
        task_doc["listName"] = str(list_name)
    if source_message_id:
        task_doc["sourceMessageId"] = str(source_message_id)
    task_doc["status"] = _rollup_task_status(
        task_doc.get("assigned_to") or [],
        task_doc.get("assignee_statuses") or {},
        task_doc.get("status") or "pending",
    )

    # Persist (if DB is unavailable, fallback to in-memory id so request doesn't fail)
    try:
        saved_task_id = await run_in_threadpool(_insert_task_document, task_doc)
        task_doc["id"] = str(task_doc.get("id") or saved_task_id)
        if "_id" in task_doc:
            del task_doc["_id"]
    except Exception as e:
        # Fallback: generate a UUID for the task id and continue so clients still receive the task
        import uuid, traceback
        task_doc["id"] = str(uuid.uuid4())
        # Log the DB error for diagnostics but do not fail the request
        try:
            print("[tasks] DB insert failed, falling back to in-memory id:", str(e))
            traceback.print_exc()
        except Exception:
            pass

    channel_ids = []
    # Save a chat message only when the task is created from a specific channel.
    try:
        if source == "channel" and channel_id is not None:
            channel_ids = await run_in_threadpool(
                _insert_task_messages,
                space_id,
                channel_id,
                created_by,
                message,
                timestamp,
                assigned_to,
                status_field,
                task_doc["id"],
                task_doc.get("list_id"),
                task_doc.get("listName"),
                task_doc.get("sourceMessageId"),
                task_doc.get("assignee_statuses"),
            )
    except Exception as e:
        try:
            import traceback
            print("[tasks] Failed to save chat message for task:", str(e))
            traceback.print_exc()
        except Exception:
            pass

    # Notify assigned users individually and create durable notifications.
    try:
        creator = _get_user_by_id(created_by)
        creator_name = (creator or {}).get("name") or (creator or {}).get("email") or "Someone"
        for uid in assigned_to or []:
            try:
                await manager.send_to_user(str(uid), {"type": "task_created", "task": task_doc})
            except Exception:
                pass
            try:
                source_label = "Assigned from Tasks" if source == "tasks_section" else f"Assigned from #{channel_name or 'channel'}"
                await create_notification(
                    recipient_id=str(uid),
                    sender_id=created_by,
                    type="task_assigned",
                    message=f"{creator_name} assigned you: {message}",
                    action_status=None,
                    status_value="unread",
                    space_id=space_id,
                    channel_id=channel_id if source == "channel" else None,
                    task_id=task_doc.get("id"),
                    dedupe_key=f"task_assigned:{task_doc.get('id')}:{uid}",
                    metadata={
                        "taskTitle": message,
                        "senderName": creator_name,
                        "dueDate": task_doc.get("dueDate") or task_doc.get("due_date"),
                        "source": source,
                        "sourceLabel": source_label,
                        "spaceName": space_name,
                        "channelName": channel_name,
                    },
                )
            except Exception:
                pass
    except Exception:
        pass

    # Broadcast only to the source channel so other channels do not receive task messages.
    try:
        if source == "channel":
            for channel_id in channel_ids:
                await manager.broadcast(channel_id, {"type": "task", "task": task_doc})
    except Exception:
        pass

    return {"status": "created", "task": _normalize_task_doc(task_doc)}



@router.patch("/{task_id}")
async def update_task(request: Request, task_id: str, payload: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    # Allow only updates to status for simplicity
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status required")

    existing = _find_task_by_id(task_id)
    if existing and not _user_can_mutate_task(existing, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = await run_in_threadpool(_update_task_status_for_user, task_id, new_status, user_id)

    if updated:
        updated = _normalize_task_doc(updated)
        # Notify assigned users and the creator so both sides stay in sync
        assigned = updated.get("assigned_to") or []
        creator = updated.get("created_by")
        notify_targets = set([str(x) for x in (assigned or []) if x is not None])
        if creator is not None:
            notify_targets.add(str(creator))
        for uid in notify_targets:
            try:
                await manager.send_to_user(str(uid), {"type": "task_updated", "task": updated})
            except Exception:
                pass
        # Broadcast only to the linked channel when this task originated in a channel.
        try:
            channel_id = updated.get("channel_id") or updated.get("channelId")
            if channel_id:
                await manager.broadcast(str(channel_id), {"type": "task", "task": updated})
        except Exception:
            pass

        return {"status": "updated", "task": updated}

    raise HTTPException(status_code=404, detail="Task not found")


@router.delete("/{task_id}")
async def delete_task(request: Request, task_id: str):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    existing = _find_task_by_id(task_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")
    if not _user_can_delete_task(existing, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    is_creator = str(existing.get("created_by")) == str(user_id)
    if is_creator:
        deleted = await run_in_threadpool(_delete_task_document, task_id)
    else:
        deleted = await run_in_threadpool(_hide_task_for_user, task_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")

    normalized = _normalize_task_doc(dict(deleted))
    notify_targets = set(str(x) for x in (normalized.get("assigned_to") or []) if x is not None) if is_creator else {str(user_id)}
    creator = normalized.get("created_by")
    if is_creator and creator is not None:
        notify_targets.add(str(creator))
    for uid in notify_targets:
        try:
            await manager.send_to_user(
                str(uid),
                {
                    "type": "task_deleted",
                    "taskId": normalized.get("id") or task_id,
                    "hiddenOnly": not is_creator,
                },
            )
        except Exception:
            pass
    try:
        channel_id = normalized.get("channel_id") or normalized.get("channelId")
        if channel_id and is_creator:
            await manager.broadcast(str(channel_id), {"type": "task_deleted", "taskId": normalized.get("id") or task_id})
    except Exception:
        pass

    return {"status": "hidden" if not is_creator else "deleted", "taskId": normalized.get("id") or task_id}


@router.get("")
def get_tasks(request: Request, userId: str = None):
    # Return tasks assigned to or created by the authenticated user only.
    userId = _get_user_id_from_request(request)
    try:
        uid = str(userId)
    except Exception:
        uid = None

    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    # Support matching user id stored as string or number in the DB
    uid_variants = [uid]
    try:
        uid_int = int(uid)
        uid_variants.append(uid_int)
    except Exception:
        uid_int = None

    docs = tasks_collection.find({
        "$and": [
            {
                "$or": [
                    {"assigned_to": {"$in": uid_variants}},
                    {"created_by": {"$in": uid_variants}}
                ]
            },
            {"hidden_for": {"$nin": uid_variants}},
        ]
    }).sort("timestamp", -1)
    results = []
    for d in docs:
        d = _normalize_task_doc(d)
        # Ensure all required fields for frontend and normalize types
        d.setdefault("assigned_to", [])
        # normalize assigned_to ids to strings for consistent frontend matching
        try:
            d["assigned_to"] = [str(x) for x in (d.get("assigned_to") or [])]
        except Exception:
            d["assigned_to"] = []
        d.setdefault("status", "pending")
        d.setdefault("message", "")
        d.setdefault("created_by", "")
        d["created_by"] = str(d.get("created_by") or "")
        d.setdefault("timestamp", "")
        results.append(d)
    return results
