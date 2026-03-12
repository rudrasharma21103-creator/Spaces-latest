from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from starlette import status

from app.database import contexts_collection
from app.routes.messages import _check_channel_access, _get_user_id_from_request

router = APIRouter(prefix="/contexts")


def _normalize_channel_state(chat_id: str, payload: dict):
    contexts = payload.get("contexts") or []
    decisions = payload.get("decisions") or []
    tasks = payload.get("tasks") or []
    now = datetime.now(timezone.utc).isoformat()

    normalized_contexts = []
    for item in contexts:
        if not isinstance(item, dict):
            continue
        context = dict(item)
        context["channelId"] = chat_id
        normalized_contexts.append(context)

    normalized_decisions = []
    for item in decisions:
        if isinstance(item, dict):
            normalized_decisions.append(dict(item))

    normalized_tasks = []
    for item in tasks:
        if isinstance(item, dict):
            normalized_tasks.append(dict(item))

    return {
        "chatId": chat_id,
        "contexts": normalized_contexts,
        "decisions": normalized_decisions,
        "tasks": normalized_tasks,
        "updatedAt": now,
    }


@router.get("/{chat_id}")
def get_context_state(request: Request, chat_id: str):
    user_id = _get_user_id_from_request(request)
    if user_id is None or not _check_channel_access(chat_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    doc = contexts_collection.find_one({"chatId": chat_id}, {"_id": 0})
    if not doc:
        return {"chatId": chat_id, "contexts": [], "decisions": [], "tasks": []}

    return {
        "chatId": chat_id,
        "contexts": doc.get("contexts") or [],
        "decisions": doc.get("decisions") or [],
        "tasks": doc.get("tasks") or [],
        "updatedAt": doc.get("updatedAt"),
    }


@router.put("/{chat_id}")
def save_context_state(request: Request, chat_id: str, payload: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None or not _check_channel_access(chat_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    doc = _normalize_channel_state(chat_id, payload or {})
    contexts_collection.update_one({"chatId": chat_id}, {"$set": doc}, upsert=True)
    return doc
