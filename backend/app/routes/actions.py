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

    # 1) Add member to the space-level members list
    spaces_collection.update_one(
        {"id": space_id},
        {"$addToSet": {"members": user_id_to_add}}
    )

    # 2) Ensure each channel inside the space also contains the member
    #    (channels store their own members on the frontend and need to stay in sync)
    space = spaces_collection.find_one({"id": space_id})
    if space and isinstance(space.get("channels"), list):
        updated_channels = []
        for ch in space.get("channels", []):
            ch_members = ch.get("members", [])
            if user_id_to_add not in ch_members:
                ch_members.append(user_id_to_add)
            ch["members"] = ch_members
            updated_channels.append(ch)

        # Persist updated channels back to the DB
        spaces_collection.update_one(
            {"id": space_id},
            {"$set": {"channels": updated_channels}}
        )

    # 3) Add space id to the user's spaces list
    users_collection.update_one(
        {"id": user_id_to_add},
        {"$addToSet": {"spaces": space_id}}
    )

    # 4) Notify the added user to refresh their spaces (existing behavior)
    try:
        await manager.send_to_user(user_id_to_add, {"type": "sync_spaces", "spaceId": space_id})
    except Exception:
        pass

    # 5) Broadcast to each channel in the space so connected clients update UI immediately
    try:
        space_after = spaces_collection.find_one({"id": space_id})
        if space_after and isinstance(space_after.get("channels"), list):
            # 5a) Broadcast to each channel group so clients currently viewing those channels update immediately
            for ch in space_after.get("channels", []):
                try:
                    await manager.broadcast(ch.get("id"), {
                        "type": "space_updated",
                        "spaceId": space_id,
                        "memberId": user_id_to_add,
                        "members": space_after.get("members", [])
                    })
                except Exception:
                    pass

            # 5b) Also send a private update to each online member so they receive the update
            for member_id in space_after.get("members", []):
                try:
                    await manager.send_to_user(member_id, {
                        "type": "space_updated",
                        "spaceId": space_id,
                        "memberId": user_id_to_add,
                        "members": space_after.get("members", [])
                    })
                except Exception:
                    pass
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