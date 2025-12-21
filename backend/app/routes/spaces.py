from fastapi import APIRouter
from app.database import spaces_collection, users_collection

router = APIRouter(prefix="/spaces")

@router.get("/")
def get_spaces():
    return list(spaces_collection.find({}, {"_id": 0}))

@router.post("/")
def save_space(space: dict):
    # Save or update the space
    spaces_collection.update_one(
        {"id": space["id"]},
        {"$set": space},
        upsert=True
    )

    # 🔥 IMPORTANT FIX:
    # Add this space to creator's user.spaces list (support both createdBy and ownerId fields)
    creator_id = space.get("createdBy") or space.get("ownerId")
    if creator_id:
        users_collection.update_one(
            {"id": creator_id},
            {"$addToSet": {"spaces": space["id"]}}
        )

    return space

@router.post("/by-ids")
def get_spaces_for_user(space_ids: list[int]):
    return list(
        spaces_collection.find(
            {"id": {"$in": space_ids}},
            {"_id": 0}
        )
    )
