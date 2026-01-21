from fastapi import APIRouter, Request, HTTPException
from starlette import status
from app.database import spaces_collection, users_collection
from app.routes.messages import _get_user_id_from_request
from app.ws_manager import manager

router = APIRouter(prefix="/spaces")

@router.get("/")
def get_spaces():
    spaces = list(spaces_collection.find({}, {"_id": 0}))

    # Ensure owner appears in members and is assigned as owner in channel roles for existing spaces
    for space in spaces:
        owner_id = space.get("ownerId")
        if not owner_id:
            continue
        changed = False
        # ensure space members
        members = space.get('members') or []
        if owner_id not in members:
            members.append(owner_id)
            space['members'] = members
            changed = True

        # ensure each channel has roles map and owner assigned
        channels = space.get('channels') or []
        for ch in channels:
            ch_members = ch.get('members') or []
            if owner_id not in ch_members:
                ch_members.append(owner_id)
                ch['members'] = ch_members
                changed = True

            roles = ch.get('roles') or {}
            # if no owner present in roles, assign space owner
            if not any(r == 'owner' for r in roles.values()):
                roles[str(owner_id)] = 'owner'
                ch['roles'] = roles
                changed = True

        if changed:
            try:
                spaces_collection.update_one({'id': space['id']}, {'$set': {'members': space.get('members'), 'channels': channels}})
            except Exception:
                pass

    return spaces


@router.post("/channel/role")
def set_channel_role(request: Request, payload: dict):
    """Set a user's role in a channel. Only space Owner can promote/demote to Owner/Admin."""
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authentication required")

    space_id = payload.get('space_id')
    channel_id = payload.get('channel_id')
    target_user = payload.get('user_id')
    new_role = payload.get('role')  # 'owner'|'admin'|'member'

    if not space_id or not channel_id or not target_user or not new_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='space_id, channel_id, user_id and role required')

    space = spaces_collection.find_one({'id': space_id})
    if not space:
        raise HTTPException(status_code=404, detail='Space not found')

    # Only Owner of space can change roles to Owner/Admin
    if str(space.get('ownerId')) != str(user_id):
        raise HTTPException(status_code=403, detail='Only space owner can change roles')

    channels = space.get('channels') or []
    updated = False
    for ch in channels:
        if str(ch.get('id')) == str(channel_id):
            roles = ch.get('roles') or {}
            # assign role
            roles[str(target_user)] = new_role
            ch['roles'] = roles
            updated = True
            break

    if updated:
        spaces_collection.update_one({'id': space_id}, {'$set': {'channels': channels}})
        # broadcast role change
        try:
            manager.broadcast(str(space_id), {'type': 'channel_roles_updated', 'space_id': space_id, 'channel_id': channel_id, 'roles': roles})
        except Exception:
            pass
        return {'status': 'ok', 'roles': roles}

    raise HTTPException(status_code=404, detail='Channel not found')


@router.post('/channel/member')
def modify_channel_member(request: Request, payload: dict):
    """Add or remove a member from a channel. Owner/Admin allowed (Owner required for owner role changes)."""
    user_id = _get_user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authentication required")

    action = payload.get('action')  # 'add' or 'remove'
    space_id = payload.get('space_id')
    channel_id = payload.get('channel_id')
    target_user = payload.get('user_id')

    if action not in ('add', 'remove') or not space_id or not channel_id or not target_user:
        raise HTTPException(status_code=400, detail='action(add|remove), space_id, channel_id and user_id required')

    space = spaces_collection.find_one({'id': space_id})
    if not space:
        raise HTTPException(status_code=404, detail='Space not found')

    # Determine requester role in channel or space owner
    channels = space.get('channels') or []
    channel = None
    for ch in channels:
        if str(ch.get('id')) == str(channel_id):
            channel = ch
            break
    if not channel:
        raise HTTPException(status_code=404, detail='Channel not found')

    roles = channel.get('roles') or {}
    requester_role = roles.get(str(user_id))
    # Space owner is implicitly Owner
    if str(space.get('ownerId')) == str(user_id):
        requester_role = 'owner'

    # Only owner/admin can add/remove members
    if requester_role not in ('owner', 'admin'):
        raise HTTPException(status_code=403, detail='Insufficient permissions')

    members = channel.get('members') or []
    roles_map = roles

    if action == 'add':
        if target_user not in members:
            members.append(target_user)
        # default role member
        roles_map.setdefault(str(target_user), 'member')
    else:
        # remove
        # Safeguards: prevent removing last owner
        if roles_map.get(str(target_user)) == 'owner':
            # count owners
            owner_count = 0
            for r in roles_map.values():
                if r == 'owner':
                    owner_count += 1
            # include space.ownerId
            if str(space.get('ownerId')) == str(target_user):
                # cannot remove space owner
                raise HTTPException(status_code=400, detail='Cannot remove space owner')
            if owner_count <= 1:
                raise HTTPException(status_code=400, detail='At least one owner required')
        if target_user in members:
            members = [m for m in members if str(m) != str(target_user)]
        if str(target_user) in roles_map:
            del roles_map[str(target_user)]

    # persist
    channel['members'] = members
    channel['roles'] = roles_map
    # update space channels
    for i, ch in enumerate(channels):
        if str(ch.get('id')) == str(channel_id):
            channels[i] = channel
            break

    spaces_collection.update_one({'id': space_id}, {'$set': {'channels': channels}})

    # broadcast change
    try:
        manager.broadcast(str(space_id), {'type': 'channel_member_changed', 'space_id': space_id, 'channel_id': channel_id, 'members': members, 'roles': roles_map})
    except Exception:
        pass

    return {'status': 'ok', 'members': members, 'roles': roles_map}

@router.post("/")
def save_space(space: dict):
    # Ensure creator is in members array
    creator_id = space.get("createdBy") or space.get("ownerId")
    if creator_id:
        if "members" not in space:
            space["members"] = []
        if creator_id not in space["members"]:
            space["members"].append(creator_id)
    
    # Save or update the space
    spaces_collection.update_one(
        {"id": space["id"]},
        {"$set": space},
        upsert=True
    )

    # Add this space to creator's user.spaces list (support both createdBy and ownerId fields)
    if creator_id:
        users_collection.update_one(
            {"id": creator_id},
            {"$addToSet": {"spaces": space["id"]}}
        )

    # Ensure each channel has roles map and assign creator as owner for channels without explicit role
    channels = space.get('channels') or []
    roles_broadcasts = []
    changed = False
    for ch in channels:
        ch_members = ch.get('members') or []
        if creator_id not in ch_members:
            ch_members.append(creator_id)
            ch['members'] = ch_members
            changed = True

        roles = ch.get('roles') or {}
        # If no owner assigned in this channel, assign the space creator as owner
        owners = [r for r in roles.values() if r == 'owner']
        if len(owners) == 0:
            roles[str(creator_id)] = 'owner'
            ch['roles'] = roles
            changed = True
            roles_broadcasts.append({'space_id': space['id'], 'channel_id': ch.get('id'), 'roles': roles})

    if changed:
        space['channels'] = channels
        spaces_collection.update_one(
            {"id": space["id"]},
            {"$set": {"channels": channels, "members": space["members"]}}
        )

    # Broadcast roles for newly created channels so clients update in real-time
    for rb in roles_broadcasts:
        try:
            manager.broadcast(str(rb['space_id']), {'type': 'channel_roles_updated', 'space_id': rb['space_id'], 'channel_id': rb['channel_id'], 'roles': rb['roles']})
        except Exception:
            pass

    return space

@router.post("/by-ids")
def get_spaces_for_user(space_ids: list[int]):
    spaces = list(
        spaces_collection.find(
            {"id": {"$in": space_ids}},
            {"_id": 0}
        )
    )
    
    # Fix: Ensure owner is in members array for each space and its channels
    for space in spaces:
        owner_id = space.get("ownerId")
        needs_update = False
        
        if owner_id:
            # Fix space members
            members = space.get("members", [])
            if owner_id not in members:
                members.append(owner_id)
                space["members"] = members
                needs_update = True
            
            # Fix channel members for each channel
            channels = space.get("channels", [])
            for channel in channels:
                channel_members = channel.get("members", [])
                if owner_id not in channel_members:
                    channel_members.append(owner_id)
                    channel["members"] = channel_members
                    needs_update = True
                # Ensure roles map assigns owner role for previous spaces
                roles = channel.get('roles') or {}
                if not any(r == 'owner' for r in roles.values()):
                    roles[str(owner_id)] = 'owner'
                    channel['roles'] = roles
                    needs_update = True
            
            # Update in database if needed
            if needs_update:
                spaces_collection.update_one(
                    {"id": space["id"]},
                    {"$set": {"members": space["members"], "channels": channels}}
                )
    
    return spaces
