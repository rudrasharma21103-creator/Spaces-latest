import re

from fastapi import APIRouter, HTTPException, Request, status
from app.database import users_collection, spaces_collection
from app.deps import get_request_user
from app.routes.messages import _check_channel_access
from app.routes.notifications import create_notification, accept_notification_for_user
from app.ws_manager import manager

router = APIRouter(prefix="/actions")

FRIEND_REQUEST_SENDER_PROJECTION = {
    "id": 1,
    "email": 1,
    "organizationId": 1,
    "invitePermissions": 1,
    "friends": 1,
}

FRIEND_REQUEST_RECIPIENT_PROJECTION = {
    "id": 1,
    "email": 1,
    "organizationId": 1,
}


def id_query_values(value):
    values = []
    for candidate in (value, str(value) if value is not None else None):
        if candidate is not None and candidate not in values:
            values.append(candidate)
    try:
        numeric = int(value)
        if numeric not in values:
            values.append(numeric)
    except (TypeError, ValueError):
        pass
    return values


def get_user_by_id(user_id):
    user = users_collection.find_one({"id": user_id})
    if user:
        return user
    try:
        return users_collection.find_one({"id": int(user_id)})
    except (TypeError, ValueError):
        return None


def extract_email_domain(email):
    if not email:
        return None
    match = re.search(r"@([A-Za-z0-9.-]+)$", str(email))
    return match.group(1).lower() if match else None


def require_actor(request: Request):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def _space_manager_role(space, user_id, channel_id=None):
    if not space:
        return None
    if str(space.get("ownerId") or space.get("createdBy")) == str(user_id):
        return "owner"
    for ch in space.get("channels") or []:
        if channel_id is not None and str(ch.get("id")) != str(channel_id):
            continue
        role = (ch.get("roles") or {}).get(str(user_id))
        if role in ("owner", "admin", "member"):
            return role
    return None

@router.post("/send-friend-request")
async def send_friend_request(request: Request, payload: dict):
    actor = require_actor(request)
    to_id = payload["toUserId"]
    notification = dict(payload.get("notification") or {})
    from_id = actor.get("id")
    notification["fromId"] = from_id
    sender_id_values = id_query_values(from_id)
    recipient_id_values = id_query_values(to_id)

    if str(from_id) == str(to_id):
        raise HTTPException(status_code=400, detail="You cannot send a connection request to yourself")

    sender = users_collection.find_one({"id": {"$in": sender_id_values}}, FRIEND_REQUEST_SENDER_PROJECTION)
    recipient = users_collection.find_one({"id": {"$in": recipient_id_values}}, FRIEND_REQUEST_RECIPIENT_PROJECTION)
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if sender is None:
        raise HTTPException(status_code=404, detail="Sender not found")

    # Permission enforcement: if sender has company-only invite permission,
    # ensure recipient is in the same organization or domain
    try:
        if sender and sender.get("invitePermissions"):
            perms = sender.get("invitePermissions") or {}
            can_all = perms.get("canInviteAll")
            can_company = perms.get("canInviteCompanyOnly")
            if can_company and not can_all:
                # Compare organizationId first
                s_org = sender.get("organizationId")
                r_org = recipient.get("organizationId") if recipient else None
                if s_org and r_org:
                    if str(s_org) != str(r_org):
                        raise HTTPException(status_code=403, detail="Not allowed to invite users outside your organization")
                else:
                    # Fallback to email domain comparison
                    sd = extract_email_domain(sender.get("email"))
                    rd = extract_email_domain(recipient.get("email"))
                    if sd != rd:
                        raise HTTPException(status_code=403, detail="Not allowed to invite users outside your company domain")
    except HTTPException:
        raise
    except Exception:
        # On any unexpected failure, be conservative and deny
        raise HTTPException(status_code=403, detail="Invite not permitted")

    recipient_id = recipient.get("id")

    try:
        if any(str(friend_id) == str(recipient_id) for friend_id in sender.get("friends") or []):
            return {"status": "already_connected"}

        incoming_request = users_collection.find_one(
            {
                "id": {"$in": sender_id_values},
                "notifications": {
                    "$elemMatch": {
                        "type": {"$in": ["friend_request", "connection_invite"]},
                        "$or": [{"status": "pending"}, {"actionStatus": "pending"}],
                        "fromId": {"$in": id_query_values(recipient_id)},
                    }
                },
            },
            {"notifications.$": 1},
        )
        if incoming_request:
            notifications = incoming_request.get("notifications") or []
            return {"status": "incoming_request", "notificationId": notifications[0].get("id") if notifications else None}

        already_pending = users_collection.find_one(
            {
                "id": {"$in": id_query_values(recipient_id)},
                "notifications": {
                    "$elemMatch": {
                        "type": {"$in": ["friend_request", "connection_invite"]},
                        "$or": [{"status": "pending"}, {"actionStatus": "pending"}],
                        "fromId": {"$in": sender_id_values},
                    }
                },
            },
            {"_id": 1},
        )
        if already_pending:
            return {"status": "pending"}
    except HTTPException:
        raise
    except Exception:
        pass

    sender_name = actor.get("name") or actor.get("email") or "Someone"
    created = await create_notification(
        recipient_id=recipient_id,
        sender_id=from_id,
        type="connection_invite",
        message=f"{sender_name} wants to connect with you",
        action_status="pending",
        status_value="unread",
        dedupe_key=f"connection_invite:{from_id}:{recipient_id}",
        metadata={
            "senderName": sender_name,
            "recipientName": recipient.get("name") or recipient.get("email"),
        },
        extra={
            **notification,
            "type": "connection_invite",
            "from": sender_name,
            "fromId": from_id,
            "status": "unread",
            "actionStatus": "pending",
        },
    )

    return {"status": "sent", "notificationId": created.get("id") if created else None}

@router.post("/accept-friend")
async def accept_friend(request: Request, payload: dict):
    actor = require_actor(request)
    user_id = actor.get("id")
    friend_id = payload.get("friendId")
    notification_id = payload.get("notificationId")

    # Expect the frontend to provide the current user's id (userId)
    if user_id and friend_id:
        processed = True
        if notification_id:
            remove_result = users_collection.update_one(
                {
                    "id": user_id,
                    "notifications": {
                        "$elemMatch": {
                            "id": notification_id,
                            "type": {"$in": ["friend_request", "connection_invite"]},
                            "fromId": {"$in": id_query_values(friend_id)}
                        }
                    }
                },
                {"$pull": {"notifications": {"id": notification_id}}}
            )
            processed = remove_result.modified_count > 0
        if not processed:
            return {"status": "accepted"}

        users_collection.update_one(
            {"id": user_id},
            {"$addToSet": {"friends": friend_id}}
        )
        users_collection.update_one(
            {"id": friend_id},
            {"$addToSet": {"friends": user_id}}
        )

        # Notify the original requester (friend_id) that their request was accepted
        try:
            user = users_collection.find_one({"id": user_id})
            friend = users_collection.find_one({"id": friend_id})
            if friend:
                await create_notification(
                    recipient_id=friend_id,
                    sender_id=user_id,
                    type="connection_invite_response",
                    message=f"{user.get('name')} accepted your connection invite",
                    action_status="accepted",
                    status_value="unread",
                    metadata={
                        "senderName": user.get("name"),
                        "recipientName": friend.get("name"),
                    },
                )
                # Notify both users to refresh friend state immediately
                await manager.send_to_user(str(user_id), {"type": "friends_updated"})
                await manager.send_to_user(str(friend_id), {"type": "friends_updated"})
        except Exception:
            pass

        return {"status": "accepted"}

    return {"error": "Missing user_id or friend_id"}

@router.post("/reject-friend")
async def reject_friend(request: Request, payload: dict):
    actor = require_actor(request)
    user_id = actor.get("id")
    friend_id = payload.get("friendId")
    notification_id = payload.get("notificationId")

    if user_id and friend_id:
        processed = True
        if notification_id:
            remove_result = users_collection.update_one(
                {
                    "id": user_id,
                    "notifications": {
                        "$elemMatch": {
                            "id": notification_id,
                            "type": {"$in": ["friend_request", "connection_invite"]},
                            "fromId": {"$in": id_query_values(friend_id)}
                        }
                    }
                },
                {"$pull": {"notifications": {"id": notification_id}}}
            )
            processed = remove_result.modified_count > 0
        if not processed:
            return {"status": "rejected"}

        # Notify the original requester that their request was rejected
        try:
            user = users_collection.find_one({"id": user_id})
            friend = users_collection.find_one({"id": friend_id})
            if friend:
                await create_notification(
                    recipient_id=friend_id,
                    sender_id=user_id,
                    type="connection_invite_response",
                    message=f"{user.get('name')} declined your connection invite",
                    action_status="declined",
                    status_value="unread",
                    metadata={
                        "senderName": user.get("name"),
                        "recipientName": friend.get("name"),
                    },
                )
                await manager.send_to_user(str(friend_id), {"type": "friends_updated"})
        except Exception:
            pass

        return {"status": "rejected"}

@router.post("/add-member")
async def add_member_to_space(request: Request, payload: dict):
    actor = require_actor(request)
    actor_id = actor.get("id")
    user_id_to_add = payload.get("userIdToDetail")
    space_id = payload.get("spaceId")
    channel_id = payload.get("channelId")

    if not user_id_to_add or not space_id:
        return {"error": "Missing userIdToDetail or spaceId"}

    space = spaces_collection.find_one({"id": {"$in": id_query_values(space_id)}})
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    role = _space_manager_role(space, actor_id, channel_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    target = get_user_by_id(user_id_to_add)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    channel = None
    if channel_id:
        for ch in space.get("channels") or []:
            if str(ch.get("id")) == str(channel_id):
                channel = ch
                break
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        if any(str(member) == str(user_id_to_add) for member in (channel.get("members") or [])):
            return {"status": "already_member"}
    elif any(str(member) == str(user_id_to_add) for member in (space.get("members") or [])):
        return {"status": "already_member"}

    sender_name = actor.get("name") or actor.get("email") or "Someone"
    space_name = space.get("name") or "Space"
    channel_name = (channel or {}).get("name")
    invite_type = "channel_invite" if channel_id else "space_invite"
    invite_message = (
        f"{sender_name} invited you to join #{channel_name} in {space_name}"
        if channel_id
        else f"{sender_name} invited you to join {space_name}"
    )

    notification = await create_notification(
        recipient_id=user_id_to_add,
        sender_id=actor_id,
        type=invite_type,
        message=invite_message,
        action_status="pending",
        status_value="unread",
        space_id=space_id,
        channel_id=channel_id,
        dedupe_key=f"{invite_type}:{space_id}:{channel_id or 'space'}:{user_id_to_add}",
        metadata={
            "spaceName": space_name,
            "channelName": channel_name,
            "senderName": sender_name,
            "recipientName": target.get("name") or target.get("email"),
        },
        extra={
            "from": sender_name,
            "fromId": actor_id,
            "spaceName": space_name,
            "channelName": channel_name,
        },
    )

    if notification:
        target_name = target.get("name") or target.get("email") or "member"
        await create_notification(
            recipient_id=actor_id,
            sender_id=actor_id,
            type=invite_type,
            message=(
                f"Invite sent to {target_name} for #{channel_name} in {space_name}"
                if channel_id
                else f"Invite sent to {target_name} for {space_name}"
            ),
            action_status="pending",
            status_value="read",
            space_id=space_id,
            channel_id=channel_id,
            dedupe_key=f"sent:{invite_type}:{space_id}:{channel_id or 'space'}:{user_id_to_add}",
            metadata={
                "spaceName": space_name,
                "channelName": channel_name,
                "senderName": sender_name,
                "recipientName": target_name,
                "recipientId": str(user_id_to_add),
                "managedNotificationId": notification.get("id"),
                "senderCopy": True,
            },
        )

    return {"status": "invite_sent", "notificationId": notification.get("id") if notification else None}

@router.post("/remove-member")
async def remove_member(request: Request, payload: dict):
    actor = require_actor(request)
    actor_id = actor.get("id")
    user_id_to_remove = payload.get("userIdToRemove")
    space_id = payload.get("spaceId")
    channel_id = payload.get("channelId")

    if not user_id_to_remove or not space_id:
        return {"error": "Missing userIdToRemove or spaceId"}

    space = spaces_collection.find_one({"id": {"$in": id_query_values(space_id)}})
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    role = _space_manager_role(space, actor_id, channel_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if str(user_id_to_remove) == str(space.get("ownerId") or space.get("createdBy")):
        raise HTTPException(status_code=400, detail="Cannot remove space owner")

    # Remove user from space-level members
    spaces_collection.update_one(
        {"id": {"$in": id_query_values(space_id)}},
        {"$pull": {"members": user_id_to_remove}}
    )

    # Remove user from channel members (either specific channel or all channels)
    updated_channels = []
    if space and isinstance(space.get("channels"), list):
        for ch in space.get("channels", []):
            ch_members = ch.get("members", []) or []
            if channel_id:
                if str(ch.get("id")) == str(channel_id):
                    ch_members = [m for m in ch_members if str(m) != str(user_id_to_remove)]
            else:
                ch_members = [m for m in ch_members if str(m) != str(user_id_to_remove)]
            ch["members"] = ch_members
            updated_channels.append(ch)

        spaces_collection.update_one({"id": {"$in": id_query_values(space_id)}}, {"$set": {"channels": updated_channels}})

    # If removing from the whole space (no channel_id provided), also remove space from user's spaces
    if not channel_id:
        users_collection.update_one({"id": {"$in": id_query_values(user_id_to_remove)}}, {"$pull": {"spaces": space_id}})

    # Notify removed user
    try:
        notif = {
            "id": f"rm-{int(__import__('time').time()*1000)}",
            "type": "info",
            "message": f"You were removed from {space.get('name')}",
            "timestamp": __import__('time').time()
        }
        users_collection.update_one({"id": {"$in": id_query_values(user_id_to_remove)}}, {"$push": {"notifications": notif}})
        await manager.send_to_user(user_id_to_remove, {"type": "notification", "notification": notif})
    except Exception:
        pass

    # Broadcast updates to affected channels and inform members
    try:
        space_after = spaces_collection.find_one({"id": {"$in": id_query_values(space_id)}})
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
async def accept_invite(request: Request, payload: dict):
    actor = require_actor(request)
    user_id = actor.get("id")
    notification_id = payload.get("notificationId")
    if not notification_id:
        raise HTTPException(status_code=400, detail="notificationId required")
    return await accept_notification_for_user(user_id, notification_id)


@router.post("/send-meet-invite")
async def send_meet_invite(request: Request, payload: dict):
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
    actor = require_actor(request)
    organizer = actor.get("id")
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

    if channel_id:
        if not _check_channel_access(str(channel_id), organizer):
            raise HTTPException(status_code=403, detail="Access denied")
    elif space_id:
        space = spaces_collection.find_one({"id": space_id})
        if not space or not (
            str(space.get("ownerId") or space.get("createdBy")) == str(organizer)
            or any(str(member) == str(organizer) for member in (space.get("members") or []))
        ):
            raise HTTPException(status_code=403, detail="Access denied")

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
async def broadcast_avatar_update(request: Request, payload: dict):
    actor = require_actor(request)
    user_id = actor.get("id")
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
