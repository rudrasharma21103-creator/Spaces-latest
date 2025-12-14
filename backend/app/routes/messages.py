from fastapi import APIRouter
from app.ws_manager import manager
from app.database import messages_collection

router = APIRouter(prefix="/messages")

@router.get("/{chat_id}")
def get_messages(chat_id: str):
    docs = messages_collection.find(
        {"chatId": chat_id},
        {"_id": 0}
    )
    return [d["message"] for d in docs]

@router.post("/{chat_id}")
def save_message(chat_id: str, message: dict):
    messages_collection.insert_one({
        "chatId": chat_id,
        "message": message
    })
    return {"status": "saved"}
