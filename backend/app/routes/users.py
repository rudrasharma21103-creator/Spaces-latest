from fastapi import APIRouter
from app.auth import hash_password, verify_password, create_access_token
from app.database import users_collection

router = APIRouter(prefix="/users")

@router.get("/")
def get_users():
    users = list(users_collection.find({}, {"_id": 0}))
    for u in users:
        u.pop("password", None)
    return users

@router.post("/signup")
def signup(user: dict):
    existing = users_collection.find_one(
        {"email": {"$regex": f"^{user['email']}$", "$options": "i"}}
    )
    if existing:
        return {"error": "Email already registered"}

    user["password"] = hash_password(user["password"])
    users_collection.insert_one(user)

    token = create_access_token({"user_id": user["id"]})
    user.pop("_id", None)
    user.pop("password", None)

    return {"user": user, "token": token}

@router.post("/login")
def login(data: dict):
    user = users_collection.find_one(
        {"email": {"$regex": f"^{data['email']}$", "$options": "i"}}
    )

    if not user or not verify_password(data["password"], user["password"]):
        return {"error": "Invalid credentials"}

    token = create_access_token({"user_id": user["id"]})
    user.pop("_id", None)
    user.pop("password", None)

    return {"user": user, "token": token}

@router.get("/by-email/{email}")
def find_user_by_email(email: str):
    user = users_collection.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    if user:
        user.pop("password", None)
    return user

@router.get("/search/{query}")
def search_users(query: str):
    users = list(
        users_collection.find(
            {"name": {"$regex": query, "$options": "i"}},
            {"_id": 0}
        )
    )
    for u in users:
        u.pop("password", None)
    return users

@router.get("/__ping")
def users_ping():
    return {"users_router": "alive"}
