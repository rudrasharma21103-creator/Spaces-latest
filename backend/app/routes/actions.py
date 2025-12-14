from fastapi import APIRouter
from app.database import users_collection, spaces_collection

router = APIRouter(prefix="/actions")

@router.post("/send-friend-request")
def send_friend_request(payload: dict):
    to_id = payload["toUserId"]
    notification = payload["notification"]

    users_collection.update_one(
        {"id": to_id},
        {"$push": {"notifications": notification}}
    )
    return {"status": "sent"}

@router.post("/accept-friend")
def accept_friend(payload: dict):
    user_id = payload["userId"]
    friend_id = payload["friendId"]

    users_collection.update_one(
        {"id": user_id},
        {"$addToSet": {"friends": friend_id}}
    )
    users_collection.update_one(
        {"id": friend_id},
        {"$addToSet": {"friends": user_id}}
    )
    return {"status": "accepted"}
