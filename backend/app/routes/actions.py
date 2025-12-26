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

        # Notify the original requester (friend_id) that their request was accepted
        try:
            user = users_collection.find_one({"id": user_id})
            friend = users_collection.find_one({"id": friend_id})
            if friend:
                notif = {
                    "id": f"fr-accept-{int(__import__('time').time()*1000)}",
                    "type": "info",
                    "message": f"{user.get('name')} accepted your friend request",
                    "timestamp": __import__('time').time()
                }
                users_collection.update_one({"id": friend_id}, {"$push": {"notifications": notif}})
                try:
                    manager.send_to_user(friend_id, {"type": "notification", "notification": notif})
                except Exception:
                    pass
        except Exception:
            pass

        return {"status": "accepted"}

    return {"error": "Missing user_id or friend_id"}

@router.post("/reject-friend")
def reject_friend(payload: dict):
    user_id = payload.get("userId")
    friend_id = payload.get("friendId")
    notification_id = payload.get("notificationId")

    if user_id and friend_id:
        # Remove the notification from the rejecting user's notifications
        if notification_id:
            users_collection.update_one(
                {"id": user_id},
                {"$pull": {"notifications": {"id": notification_id}}}
            )

        # Notify the original requester that their request was rejected
        try:
            user = users_collection.find_one({"id": user_id})
            friend = users_collection.find_one({"id": friend_id})
            if friend:
                notif = {
                    "id": f"fr-reject-{int(__import__('time').time()*1000)}",
                    "type": "info",
                    "message": f"{user.get('name')} rejected your friend request",
                    "timestamp": __import__('time').time()
                }
                users_collection.update_one({"id": friend_id}, {"$push": {"notifications": notif}})
                try:
                    manager.send_to_user(friend_id, {"type": "notification", "notification": notif})
                except Exception:
                    pass
        except Exception:
            pass

        return {"status": "rejected"}

@router.post("/add-member")
async def add_member_to_space(payload: dict):
    user_id_to_add = payload.get("userIdToDetail")
    space_id = payload.get("spaceId")
    channel_id = payload.get("channelId")

    if not user_id_to_add or not space_id:
        return {"error": "Missing userIdToDetail or spaceId"}

    # 1) Add member to the space-level members list
    spaces_collection.update_one(
        {"id": space_id},
        {"$addToSet": {"members": user_id_to_add}}
    )

    # 2) If a channelId is provided, add the user to that channel only
    space = spaces_collection.find_one({"id": space_id})
    updated_channels = []
    if space and isinstance(space.get("channels"), list):
        for ch in space.get("channels", []):
            ch_members = ch.get("members", [])
            if channel_id:
                # Only update the specific channel
                if ch.get("id") == channel_id:
                    if user_id_to_add not in ch_members:
                        ch_members.append(user_id_to_add)
                # Else leave channel members unchanged
            else:
                # Old behavior: add to all channels when channelId not provided
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

    # 5) Broadcast: inform only affected channels and space members
    try:
        space_after = spaces_collection.find_one({"id": space_id})
        if space_after and isinstance(space_after.get("channels"), list):
            # If channelId provided, broadcast only to that channel
            if channel_id:
                try:
                    await manager.broadcast(channel_id, {
                        "type": "space_updated",
                        "spaceId": space_id,
                        "memberId": user_id_to_add,
                        "members": space_after.get("members", [])
                    })
                except Exception:
                    pass
            else:
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

            # Also send a private update to each online member so they receive the update
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