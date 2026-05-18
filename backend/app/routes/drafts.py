from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException, Request
from starlette import status

from app.database import drafts_collection
from app.routes.messages import _get_user_id_from_request

router = APIRouter(prefix="/drafts")


def _sanitize_draft(doc: dict):
    if not doc:
        return None
    clean = dict(doc)
    clean.pop("_id", None)
    clean["id"] = str(clean.get("id") or "")
    clean["userId"] = str(clean.get("userId") or "")
    if clean.get("recipientId") is not None:
        clean["recipientId"] = str(clean.get("recipientId"))
    if clean.get("spaceId") is not None:
        clean["spaceId"] = str(clean.get("spaceId"))
    if clean.get("channelId") is not None:
        clean["channelId"] = str(clean.get("channelId"))
    return clean


@router.get("")
def get_drafts(request: Request):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    docs = drafts_collection.find({"userId": str(user_id)}, {"_id": 0}).sort("updatedAt", -1)
    return [_sanitize_draft(doc) for doc in docs]


@router.post("")
def save_draft(request: Request, payload: dict):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Draft text is required")

    now = datetime.now(timezone.utc).isoformat()
    draft_id = str(payload.get("id") or uuid.uuid4())

    created_at = payload.get("createdAt") or now

    draft_doc = {
        "id": draft_id,
        "userId": str(user_id),
        "text": text,
        "chatId": payload.get("chatId"),
        "chatType": payload.get("chatType") or "dm",
        "chatName": payload.get("chatName") or "",
        "spaceId": payload.get("spaceId"),
        "channelId": payload.get("channelId"),
        "recipientId": payload.get("recipientId"),
        "recipientName": payload.get("recipientName") or "",
        "updatedAt": now,
    }

    drafts_collection.update_one(
        {"userId": str(user_id), "id": draft_id},
        {"$set": draft_doc, "$setOnInsert": {"createdAt": created_at}},
        upsert=True,
    )

    saved = drafts_collection.find_one({"userId": str(user_id), "id": draft_id})
    return _sanitize_draft(saved)


@router.delete("/{draft_id}")
def delete_draft(request: Request, draft_id: str):
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    result = drafts_collection.delete_one({"userId": str(user_id), "id": str(draft_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    return {"status": "deleted", "id": str(draft_id)}
