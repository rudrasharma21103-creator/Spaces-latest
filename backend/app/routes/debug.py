from fastapi import APIRouter, HTTPException
from app.database import users_collection
from app.auth import verify_password, identify_hash_scheme

router = APIRouter(prefix="/debug")

@router.post("/login-check")
def login_check(data: dict):
    email = data.get("email")
    password = data.get("password")
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    user = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        return {"user_found": False}

    stored_hash = user.get("password")
    scheme = None
    try:
        scheme = identify_hash_scheme(stored_hash) if stored_hash else None
    except Exception as e:
        scheme = f"identify_error: {e}"

    try:
        ok = verify_password(password, stored_hash)
    except Exception as e:
        ok = False

    return {
        "user_found": True,
        "user_id": user.get("id"),
        "hash_scheme": scheme,
        "verify": ok,
        "hash_len": len(stored_hash or "")
    }

@router.post("/reset-password")
def reset_password(data: dict):
    """Dev-only: set a user's password to a known value (returns the new hash scheme).
    Use POST {"email": "...", "password": "newpass"}
    """
    email = data.get("email")
    password = data.get("password")
    if not email or password is None:
        raise HTTPException(status_code=400, detail="email and password required")

    user = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    # Hash password using the same logic as signup
    from app.auth import hash_password, identify_hash_scheme
    hashed = hash_password(password)
    users_collection.update_one({"email": {"$regex": f"^{email}$", "$options": "i"}}, {"$set": {"password": hashed}})

    scheme = identify_hash_scheme(hashed)
    return {"status": "ok", "hash_scheme": scheme, "hash_len": len(hashed)}