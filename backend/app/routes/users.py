from fastapi import APIRouter, HTTPException
from app.auth import hash_password, verify_password, create_access_token
from app.database import users_collection, spaces_collection, organizations_collection
from app.ws_manager import manager
import time
import re

router = APIRouter(prefix="/users")

@router.get("/")
def get_users():
    users = list(users_collection.find({}, {"_id": 0}))
    for u in users:
        u.pop("password", None)
    return users

@router.post("/signup")
def signup(user: dict):
    print(f"[users.signup] received signup for: {user.get('email')}")
    existing = users_collection.find_one(
        {"email": {"$regex": f"^{user['email']}$", "$options": "i"}}
    )
    if existing:
        print(f"[users.signup] email already registered: {user.get('email')}")
        return {"error": "Email already registered"}

    # Debugging: inspect password type and length before hashing to diagnose
    pw = user.get("password")
    try:
        pw_bytes_len = len(pw.encode("utf-8")) if isinstance(pw, str) else len(str(pw).encode("utf-8"))
    except Exception:
        pw_bytes_len = None
    print(f"[users.signup] password type={type(pw)}, bytes_len={pw_bytes_len}")

    try:
        user["password"] = hash_password(user["password"])
    except Exception as e:
        # Raise a clear HTTP error instead of letting a 500 bubble up; helps CORS and client visibility
        print(f"[users.signup] password hashing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Password hashing failed: {e}")

    # Auto-link user to an organization if the domain matches a verified org
    try:
        email = user.get("email", "")
        domain = ""
        m = None
        import re
        m = re.search(r"@([A-Za-z0-9.-]+)$", email)
        if m:
            domain = m.group(1).lower()
        org = None
        if domain:
            org = organizations_collection.find_one({"domain": domain, "verified": True})
        if org:
            user["organizationId"] = org.get("_id") or org.get("domain")
            user["role"] = "employee"
        else:
            # allow caller to set role, default to basic user
            user.setdefault("role", "user")
    except Exception:
        pass

    users_collection.insert_one(user)

    token = create_access_token({"user_id": user["id"]})
    user.pop("_id", None)
    user.pop("password", None)

    print(f"[users.signup] created user id: {user.get('id')}")
    return {"user": user, "token": token}

@router.post("/login")
def login(data: dict):
    print(f"[users.login] login attempt for: {data.get('email')}")

    user = users_collection.find_one(
        {"email": {"$regex": f"^{data['email']}$", "$options": "i"}}
    )

    if not user:
        print(f"[users.login] no user found for: {data.get('email')}")
        return {"error": "Invalid credentials"}

    stored_hash = user.get("password")
    scheme = None
    try:
        from app.auth import identify_hash_scheme
        scheme = identify_hash_scheme(stored_hash)
    except Exception as e:
        print(f"[users.login] identify_hash_scheme failed: {e}")

    print(f"[users.login] found user id: {user.get('id')}, hash_scheme={scheme}, hash_len={len(stored_hash or '')}")

    ok = verify_password(data["password"], stored_hash)
    print(f"[users.login] verify_password returned: {ok}")

    if not ok:
        return {"error": "Invalid credentials"}

    token = create_access_token({"user_id": user["id"]})
    user.pop("_id", None)
    user.pop("password", None)

    return {"user": user, "token": token}

@router.get("/by-email/{email}")
def find_user_by_email(email: str):
    print(f"[users.find_user_by_email] called with: {email}")
    user = users_collection.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    if user:
        print(f"[users.find_user_by_email] found user: {user.get('email')}")
        user.pop("password", None)
    else:
        print(f"[users.find_user_by_email] no user found for: {email}")
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


@router.get("/by-domain/{domain}")
def users_by_domain(domain: str):
    # Return users whose email domain matches the requested domain
    q = {"email": {"$regex": f"@{re.escape(domain)}$", "$options": "i"}}
    users = list(users_collection.find(q, {"_id": 0}))
    for u in users:
        u.pop("password", None)
    return users

@router.get("/__ping")
def users_ping():
    return {"users_router": "alive"}

@router.put("/{user_id}")
async def update_user(user_id: str, user: dict):
    # Only allow updating existing users; avoid changing password here
    update_doc = {k: v for k, v in user.items() if k != "password"}
    
    # Handle type-flexible user lookup (id may be stored as string or int)
    existing_user = users_collection.find_one({"id": user_id})
    if not existing_user:
        try:
            existing_user = users_collection.find_one({"id": int(user_id)})
        except (ValueError, TypeError):
            pass
    if not existing_user:
        return {"error": "User not found"}
    
    # Use the actual id from the found document for update
    actual_id = existing_user.get("id")
    res = users_collection.update_one({"id": actual_id}, {"$set": update_doc})
    if res.matched_count == 0:
        return {"error": "User not found"}
    updated = users_collection.find_one({"id": actual_id}, {"_id": 0})
    if updated:
        updated.pop("password", None)
    # If avatar fields were updated, broadcast to friends and space members
    try:
        if any(k in update_doc for k in ("avatar_url", "avatar_preset", "profileImage", "avatar")):
            # Prepare avatar data with cache-busting timestamp
            raw_url = updated.get("avatar_url")
            ts = int(time.time() * 1000)
            avatar_url = raw_url  # Default to raw URL
            if isinstance(raw_url, str) and raw_url:
                # Don't append cache-buster to data: or blob: URLs
                if not (raw_url.startswith('data:') or raw_url.startswith('blob:')):
                    sep = '&' if '?' in raw_url else '?'
                    avatar_url = f"{raw_url}{sep}v={ts}"
                    # Persist versioned URL so subsequent fetches reflect new version
                    users_collection.update_one({"id": actual_id}, {"$set": {"avatar_url": avatar_url}})
                    updated["avatar_url"] = avatar_url

            avatar_data = {
                "avatar_url": avatar_url,
                "avatar_preset": updated.get("avatar_preset"),
                "name": updated.get("name")
            }

            # Collect recipients: friends + members of spaces the user belongs to
            recipients = set()
            for fid in (updated.get("friends") or []):
                if fid and str(fid) != str(actual_id):
                    recipients.add(str(fid))
            user_spaces = updated.get("spaces") or []
            for space in spaces_collection.find({"id": {"$in": user_spaces}}):
                for member_id in space.get("members", []):
                    if member_id and str(member_id) != str(actual_id):
                        recipients.add(str(member_id))

            notif = {
                "type": "avatar_updated",
                "userId": str(actual_id),
                "avatarData": avatar_data,
                "timestamp": int(time.time())
            }
            # Send notification to recipients - use string IDs for WebSocket lookup
            for rid in recipients:
                try:
                    await manager.send_to_user(str(rid), {"type": "notification", "notification": notif})
                except Exception:
                    pass
            # Also broadcast a lightweight profileUpdated event to notifications group
            # so only notification sockets receive it (avoids treating it as a chat message).
            try:
                await manager.broadcast("notifications", {
                    "type": "profileUpdated",
                    "userId": str(actual_id),
                    "avatar_url": avatar_url,
                    "avatar_preset": updated.get("avatar_preset")
                })
            except Exception:
                pass
    except Exception as e:
        # Don't fail the request on broadcast errors
        print(f"avatar broadcast failed: {e}")
    return updated
