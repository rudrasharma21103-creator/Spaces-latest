from fastapi import APIRouter
from app.database import users_collection, spaces_collection
from app.ws_manager import manager

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
    user_id = payload.get("userId")
    friend_id = payload.get("friendId")
    notification_id = payload.get("notificationId")

    # Expect the frontend to provide the current user's id (userId)
    if user_id and friend_id:
        users_collection.update_one(
            {"id": user_id},
            {"$addToSet": {"friends": friend_id}}
        )
        users_collection.update_one(
            {"id": friend_id},
            {"$addToSet": {"friends": user_id}}
        )

        # Remove the specific notification if provided
        if notification_id:
            users_collection.update_one(
                {"id": user_id},
                {"$pull": {"notifications": {"id": notification_id}}}
            )

        return {"status": "accepted"}

    return {"error": "Missing user_id or friend_id"}

@router.post("/add-member")
async def add_member_to_space(payload: dict):
    user_id_to_add = payload.get("userIdToDetail")
    space_id = payload.get("spaceId")
    
    spaces_collection.update_one(
        {"id": space_id},
        {"$addToSet": {"members": user_id_to_add}}
    )
    
    # Add space to user's spaces list
    users_collection.update_one(
        {"id": user_id_to_add},
        {"$addToSet": {"spaces": space_id}}
    )

    # 🔥 REAL-TIME POKE: Tell the added user to refresh their spaces
    try:
        await manager.send_to_user(user_id_to_add, {"type": "sync_spaces", "spaceId": space_id})
    except Exception:
        pass
    
    return {"status": "member added"}

@router.post("/accept-invite")
def accept_invite(payload: dict):
    user_id = payload.get("userId")
    notification_id = payload.get("notificationId")
    
    # In real app, you'd find the space from notification
    # For now, return a mock response
    return {
        "status": "accepted",
        "space": {
            "id": 12345,
            "name": "Test Space",
            "channels": [{"id": 1, "name": "general"}]
        }
    }