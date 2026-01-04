from fastapi import APIRouter
from app.database import spaces_collection, users_collection

router = APIRouter(prefix="/spaces")

@router.get("/")
def get_spaces():
    return list(spaces_collection.find({}, {"_id": 0}))

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
            
            # Update in database if needed
            if needs_update:
                spaces_collection.update_one(
                    {"id": space["id"]},
                    {"$set": {"members": space["members"], "channels": channels}}
                )
    
    return spaces
