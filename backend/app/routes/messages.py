from fastapi import APIRouter, Request, HTTPException
from starlette import status
from app.ws_manager import manager
from app.database import messages_collection, spaces_collection

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

    try:
        cid = int(chat_id)
    except Exception:
        return False

    # Find the space and channel that contains this channel id
    space = spaces_collection.find_one({"channels.id": cid})
    if not space:
        return False

    # Locate the channel
    channel = None
    for ch in (space.get("channels") or []):
        if ch.get("id") == cid:
            channel = ch
            break

    if not channel:
        return False

    # Access is granted if user is channel member or space owner
    if user_id == space.get("ownerId") or user_id in (channel.get("members") or []):
        return True

    return False


@router.get("/{chat_id}")
def get_messages(request: Request, chat_id: str):
    user_header = request.headers.get("x-user-id")
    try:
        user_id = int(user_header) if user_header else None
    except Exception:
        user_id = None

    if user_id is None or not _check_channel_access(chat_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    docs = messages_collection.find(
        {"chatId": chat_id},
        {"_id": 0}
    )
    return [d["message"] for d in docs]


@router.post("/{chat_id}")
def save_message(request: Request, chat_id: str, message: dict):
    user_header = request.headers.get("x-user-id")
    try:
        user_id = int(user_header) if user_header else None
    except Exception:
        user_id = None

    if user_id is None or not _check_channel_access(chat_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    messages_collection.insert_one({
        "chatId": chat_id,
        "message": message
    })
    return {"status": "saved"}


@router.patch("/{chat_id}/{message_id}")
def update_message(request: Request, chat_id: str, message_id: str, message: dict):
    user_header = request.headers.get("x-user-id")
    try:
        user_id = int(user_header) if user_header else None
    except Exception:
        user_id = None

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
