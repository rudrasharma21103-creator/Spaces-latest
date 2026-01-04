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

    # 1) Add member to the space-level members list only when no channelId provided
    if not channel_id:
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

    # 3) Add space id to the user's spaces list so the user sees the space
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

@router.post("/remove-member")
async def remove_member(payload: dict):
    user_id_to_remove = payload.get("userIdToRemove")
    space_id = payload.get("spaceId")
    channel_id = payload.get("channelId")

    if not user_id_to_remove or not space_id:
        return {"error": "Missing userIdToRemove or spaceId"}

    # Remove user from space-level members
    spaces_collection.update_one(
        {"id": space_id},
        {"$pull": {"members": user_id_to_remove}}
    )

    # Remove user from channel members (either specific channel or all channels)
    space = spaces_collection.find_one({"id": space_id})
    updated_channels = []
    if space and isinstance(space.get("channels"), list):
        for ch in space.get("channels", []):
            ch_members = ch.get("members", []) or []
            if channel_id:
                if ch.get("id") == channel_id:
                    ch_members = [m for m in ch_members if m != user_id_to_remove]
            else:
                ch_members = [m for m in ch_members if m != user_id_to_remove]
            ch["members"] = ch_members
            updated_channels.append(ch)

        spaces_collection.update_one({"id": space_id}, {"$set": {"channels": updated_channels}})

    # If removing from the whole space (no channel_id provided), also remove space from user's spaces
    if not channel_id:
        users_collection.update_one({"id": user_id_to_remove}, {"$pull": {"spaces": space_id}})

    # Notify removed user
    try:
        notif = {
            "id": f"rm-{int(__import__('time').time()*1000)}",
            "type": "info",
            "message": f"You were removed from {space.get('name')}",
            "timestamp": __import__('time').time()
        }
        users_collection.update_one({"id": user_id_to_remove}, {"$push": {"notifications": notif}})
        await manager.send_to_user(user_id_to_remove, {"type": "notification", "notification": notif})
    except Exception:
        pass

    # Broadcast updates to affected channels and inform members
    try:
        space_after = spaces_collection.find_one({"id": space_id})
        if space_after and isinstance(space_after.get("channels"), list):
            if channel_id:
                try:
                    await manager.broadcast(channel_id, {
                        "type": "space_updated",
                        "spaceId": space_id,
                        "removedMemberId": user_id_to_remove,
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
                            "removedMemberId": user_id_to_remove,
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
                        "removedMemberId": user_id_to_remove,
                        "members": space_after.get("members", [])
                    })
                except Exception:
                    pass
    except Exception:
        pass

    return {"status": "member removed"}

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


@router.post("/send-meet-invite")
async def send_meet_invite(payload: dict):
    """Notify users about a Google Meet link or broadcast to a channel.
    Expected payload keys:
      - organizerId: id of the user creating the meeting
      - targetUserIds: list of user ids to notify (optional)
      - spaceId: optional space id
      - channelId: optional channel id (numeric or str)
      - meetingLink: the URL to join the meeting
      - meetingTitle: optional title
      - start, end: optional timestamps
    """
    organizer = payload.get("organizerId")
    targets = payload.get("targetUserIds") or []
    space_id = payload.get("spaceId")
    channel_id = payload.get("channelId")
    meeting_link = payload.get("meetingLink")
    meeting_title = payload.get("meetingTitle") or "Video call"

    # Attach organizer details if available
    org = None
    try:
        if organizer:
            org = users_collection.find_one({"id": organizer})
    except Exception:
        org = None

    notif = {
        "id": f"meet-{int(__import__('time').time()*1000)}",
        "type": "meet_invite",
        "from": organizer,
        "fromName": org.get("name") if org else None,
        "fromAvatar": org.get("avatar") if org else None,
        "spaceId": space_id,
        "channelId": channel_id,
        "title": meeting_title,
        "link": meeting_link,
        "timestamp": __import__('time').time()
    }

    # 1) If channel_id provided, broadcast to that channel group
    try:
        if channel_id:
            # Send the same `notification` envelope used for private sends so
            # clients listening on the user/notification socket and channel
            # socket handle the payload consistently and show the incoming-call
            # pop-up. Do not persist to DB here.
            await manager.broadcast(channel_id, {"type": "notification", "notification": notif})
    except Exception:
        pass

    # 2) Send private real-time notification to each listed user (do NOT persist as regular notification)
    for uid in list(targets):
        try:
            await manager.send_to_user(uid, {"type": "notification", "notification": notif})
        except Exception:
            pass

    return {"status": "invites_sent"}

@router.post("/broadcast-avatar-update")
async def broadcast_avatar_update(payload: dict):
    user_id = payload.get("userId")
    avatar_data = payload.get("avatarData")
    
    if not user_id or not avatar_data:
        return {"error": "Missing userId or avatarData"}
    
    # Get user's friends and space memberships - handle both string and int id types
    user = users_collection.find_one({"id": user_id})
    if not user:
        # Try integer conversion if string lookup fails
        try:
            user = users_collection.find_one({"id": int(user_id)})
        except (ValueError, TypeError):
            pass
    if not user:
        # Try string conversion if original was int
        user = users_collection.find_one({"id": str(user_id)})
    if not user:
        print(f"[broadcast-avatar] User not found: {user_id}")
        return {"error": "User not found"}
    
    # Collect all users who should receive this update
    recipients = set()
    
    # Add all friends
    friends = user.get("friends", [])
    for friend_id in friends:
        if friend_id:
            recipients.add(str(friend_id))
    
    # Add all members from spaces this user belongs to
    user_spaces = user.get("spaces", [])
    for space in spaces_collection.find({"id": {"$in": user_spaces}}):
        members = space.get("members", [])
        for member_id in members:
            if member_id and str(member_id) != str(user_id):  # Don't send to self
                recipients.add(str(member_id))
    
    print(f"[broadcast-avatar] User {user_id} has {len(friends)} friends and is in {len(user_spaces)} spaces. Broadcasting to {len(recipients)} recipients: {list(recipients)[:5]}...")
    
    # Create notification payload with cache-busting timestamp
    ts = int(__import__('time').time() * 1000)
    notif = {
        "type": "avatar_updated",
        "userId": user_id,
        "avatarData": avatar_data,
        "timestamp": ts
    }
    
    # Broadcast to all recipients - ensure recipient_id is string for WebSocket lookup
    sent_count = 0
    for recipient_id in recipients:
        try:
            await manager.send_to_user(str(recipient_id), {"type": "notification", "notification": notif})
            sent_count += 1
        except Exception as e:
            print(f"[broadcast-avatar] Failed to send to {recipient_id}: {e}")
    
    print(f"[broadcast-avatar] Sent avatar update to {sent_count}/{len(recipients)} recipients")
    return {"status": "broadcasted", "recipients": len(recipients), "sent": sent_count}