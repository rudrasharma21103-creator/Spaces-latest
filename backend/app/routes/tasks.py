from fastapi import APIRouter, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from starlette import status
from app.database import tasks_collection, messages_collection, spaces_collection
from app.ws_manager import manager
from app.routes.messages import _get_user_id_from_request
from datetime import datetime, timezone

router = APIRouter(prefix="/tasks")


def _insert_task_document(task_doc: dict):
    res = tasks_collection.insert_one(task_doc)
    return str(res.inserted_id)


def _insert_task_messages(space_id, created_by, message, timestamp, assigned_to, status_field, task_id):
    if not space_id:
        return []

    payload = {
        "id": task_id,
        "userId": created_by,
        "text": message,
        "timestamp": timestamp,
        "type": "task",
        "assigned_to": assigned_to,
        "status": status_field,
        "optimistic": False,
    }

    messages_collection.insert_one({"chatId": str(space_id), "message": payload})

    space = spaces_collection.find_one({"id": space_id}, {"channels.id": 1})
    channel_ids = []
    channels = (space.get("channels") or []) if space else []
    for ch in channels:
        ch_id = ch.get("id") if isinstance(ch, dict) else ch
        if ch_id is None:
            continue
        messages_collection.insert_one({"chatId": str(ch_id), "message": payload})
        channel_ids.append(str(ch_id))
    return channel_ids


def _update_task_status(task_id: str, new_status: str):
    oid = None
    res = None
    try:
        from bson.objectid import ObjectId
        oid = ObjectId(task_id)
        res = tasks_collection.update_one({"_id": oid}, {"$set": {"status": new_status}})
    except Exception:
        oid = None
        res = None

    if not res or res.matched_count == 0:
        try:
            res = tasks_collection.update_one({"id": task_id}, {"$set": {"status": new_status}})
        except Exception:
            res = None

    if not res or res.matched_count == 0:
        try:
            res = tasks_collection.update_one({"id": int(task_id)}, {"$set": {"status": new_status}})
        except Exception:
            res = None

    try:
        messages_collection.update_many({"message.id": task_id}, {"$set": {"message.status": new_status}})
        if oid:
            messages_collection.update_many({"message.id": oid}, {"$set": {"message.status": new_status}})
    except Exception:
        pass

    updated = None
    try:
        updated = tasks_collection.find_one({"id": task_id})
    except Exception:
        updated = None

    if not updated and oid:
        try:
            updated = tasks_collection.find_one({"_id": oid})
        except Exception:
            updated = None

    return updated


@router.post("")
async def create_task(request: Request, payload: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authentication required")

    # Basic payload validation
    created_by = payload.get("created_by") or user_id
    assigned_to = payload.get("assigned_to") or []
    message = payload.get("message") or ""
    space_id = payload.get("space_id")
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
        "status": status_field,
        "timestamp": timestamp
    }

    # Persist (if DB is unavailable, fallback to in-memory id so request doesn't fail)
    try:
        task_doc["id"] = await run_in_threadpool(_insert_task_document, task_doc)
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
    # Save a chat message for the task in the messages collection so it appears in the channel and persists after refresh
    try:
        if space_id:
            channel_ids = await run_in_threadpool(
                _insert_task_messages,
                space_id,
                created_by,
                message,
                timestamp,
                assigned_to,
                status_field,
                task_doc["id"],
            )
    except Exception as e:
        try:
            import traceback
            print("[tasks] Failed to save chat message for task:", str(e))
            traceback.print_exc()
        except Exception:
            pass

    # Notify assigned users individually
    try:
        for uid in assigned_to or []:
            try:
                await manager.send_to_user(str(uid), {"type": "task_created", "task": task_doc})
            except Exception:
                pass
    except Exception:
        pass

    # Broadcast to space chat (if space_id provided) so everyone sees task message in chat
    try:
        if space_id:
            await manager.broadcast(str(space_id), {"type": "task", "task": task_doc})
            for channel_id in channel_ids:
                await manager.broadcast(channel_id, {"type": "task", "task": task_doc})
    except Exception:
        pass

    return {"status": "created", "task": task_doc}



@router.patch("/{task_id}")
async def update_task(request: Request, task_id: str, payload: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authentication required")

    # Allow only updates to status for simplicity
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status required")

    updated = await run_in_threadpool(_update_task_status, task_id, new_status)

    if updated:
        # Convert _id to id if present
        if "_id" in updated:
            try:
                updated["id"] = str(updated["_id"])
            except Exception:
                pass
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
        # Broadcast to space chat
        try:
            space_id = updated.get("space_id")
            if space_id:
                await manager.broadcast(str(space_id), {"type": "task", "task": updated})
        except Exception:
            pass

        return {"status": "updated", "task": updated}

    raise HTTPException(status_code=404, detail="Task not found")


@router.get("")
def get_tasks(request: Request, userId: str = None):
    # Return tasks assigned to or created by the provided userId
    if not userId:
        # If no user supplied, try header
        userId = _get_user_id_from_request(request)
    try:
        uid = str(userId)
    except Exception:
        uid = None

    if not uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="userId required")

    # Support matching user id stored as string or number in the DB
    uid_variants = [uid]
    try:
        uid_int = int(uid)
        uid_variants.append(uid_int)
    except Exception:
        uid_int = None

    docs = tasks_collection.find({
        "$or": [
            {"assigned_to": {"$in": uid_variants}},
            {"created_by": {"$in": uid_variants}}
        ]
    }).sort("timestamp", -1)
    results = []
    for d in docs:
        # Always return id as string and remove _id
        if "_id" in d:
            d["id"] = str(d["_id"])
            d.pop("_id", None)
        elif "id" in d:
            d["id"] = str(d["id"])
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
