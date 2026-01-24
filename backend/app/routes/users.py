from fastapi import APIRouter, HTTPException, Request
from app.auth import hash_password, verify_password, create_access_token
from app.database import users_collection, spaces_collection, organizations_collection
from app.ws_manager import manager
import time
import re
from bson import ObjectId


def sanitize(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "_id":
                continue
            out[k] = sanitize(v)
        return out
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    return obj

router = APIRouter(prefix="/users")

@router.get("/")
def get_users(request: Request):
    # Determine requester to enforce invite visibility rules
    requester = None
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1]
        try:
            from app.auth import verify_ws_token
            requester_id = verify_ws_token(token)
            if requester_id:
                requester = users_collection.find_one({"id": requester_id})
        except Exception:
            requester = None
    else:
        xuid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
        if xuid:
            try:
                requester = users_collection.find_one({"id": int(xuid)})
            except Exception:
                try:
                    requester = users_collection.find_one({"id": xuid})
                except Exception:
                    requester = None

    users_raw = list(users_collection.find({}, {"_id": 0}))
    users = [sanitize(u) for u in users_raw]
    for u in users:
        u.pop("password", None)

    # If requester exists and has company-only invite permissions, filter results
    try:
        if requester:
            perms = (requester.get("invitePermissions") or {})
            can_all = perms.get("canInviteAll")
            can_company = perms.get("canInviteCompanyOnly")
            if can_company and not can_all:
                # Determine requester's domain/org
                req_org = requester.get("organizationId")
                req_email = requester.get("email", "") or ""
                import re
                m = re.search(r"@([A-Za-z0-9.-]+)$", req_email)
                req_domain = m.group(1).lower() if m else None
                def visible(u):
                    if req_org and u.get("organizationId"):
                        return str(u.get("organizationId")) == str(req_org)
                    ue = u.get("email", "") or ""
                    mm = re.search(r"@([A-Za-z0-9.-]+)$", ue)
                    ud = mm.group(1).lower() if mm else None
                    return ud == req_domain
                users = [u for u in users if visible(u)]
    except Exception:
        pass

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
            # default invite permissions for verified org members
            user.setdefault("invitePermissions", {"canInviteAll": False, "canInviteCompanyOnly": True})
        else:
            # allow caller to set role, default to basic user
            user.setdefault("role", "user")
            # default invite permissions for non-org users
            user.setdefault("invitePermissions", {"canInviteAll": True, "canInviteCompanyOnly": False})
    except Exception:
        pass

    users_collection.insert_one(user)
    token = create_access_token({"user_id": user["id"]})
    user.pop("_id", None)
    user.pop("password", None)
    user = sanitize(user)

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
    user = sanitize(user)

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
        user = sanitize(user)
    else:
        print(f"[users.find_user_by_email] no user found for: {email}")
    return user

@router.get("/search/{query}")
def search_users(query: str, request: Request):
    users = list(
        users_collection.find(
            {"name": {"$regex": query, "$options": "i"}},
            {"_id": 0}
        )
    )
    for u in users:
        u.pop("password", None)
    users = [sanitize(u) for u in users]

    # Apply same visibility filtering as get_users
    try:
        requester = None
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
            from app.auth import verify_ws_token
            requester_id = verify_ws_token(token)
            if requester_id:
                requester = users_collection.find_one({"id": requester_id})
        else:
            xuid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
            if xuid:
                try:
                    requester = users_collection.find_one({"id": int(xuid)})
                except Exception:
                    requester = users_collection.find_one({"id": xuid})

        if requester:
            perms = (requester.get("invitePermissions") or {})
            can_all = perms.get("canInviteAll")
            can_company = perms.get("canInviteCompanyOnly")
            if can_company and not can_all:
                req_org = requester.get("organizationId")
                req_email = requester.get("email", "") or ""
                import re
                m = re.search(r"@([A-Za-z0-9.-]+)$", req_email)
                req_domain = m.group(1).lower() if m else None
                def visible(u):
                    if req_org and u.get("organizationId"):
                        return str(u.get("organizationId")) == str(req_org)
                    ue = u.get("email", "") or ""
                    mm = re.search(r"@([A-Za-z0-9.-]+)$", ue)
                    ud = mm.group(1).lower() if mm else None
                    return ud == req_domain
                users = [u for u in users if visible(u)]
    except Exception:
        pass

    return users


@router.get("/by-domain/{domain}")
def users_by_domain(domain: str):
    # Return users whose email domain matches the requested domain
    q = {"email": {"$regex": f"@{re.escape(domain)}$", "$options": "i"}}
    users = list(users_collection.find(q, {"_id": 0}))
    for u in users:
        u.pop("password", None)
    users = [sanitize(u) for u in users]
    return users


@router.post("/set-password")
def set_password(payload: dict):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")
    # Find existing user (case-insensitive)
    user = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})

    try:
        hashed = hash_password(password)
    except Exception as e:
        print(f"set_password: hashing failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to hash password")

    if user:
        # Update existing user
        try:
            users_collection.update_one({"id": user["id"]}, {"$set": {"password": hashed}})
        except Exception as e:
            print(f"set_password: failed to update password: {e}")
            raise HTTPException(status_code=500, detail="Failed to set password")
        user = users_collection.find_one({"id": user["id"]}, {"_id": 0})
    else:
        # Create a minimal admin user record (for first-time admin sign-in)
        try:
            new_id = int(time.time() * 1000)
            new_user = {
                "id": new_id,
                "name": email.split("@")[0],
                "email": email,
                "password": hashed,
                "role": "org_admin",
                "status": "active",
                "spaces": [],
                "friends": [],
                "notifications": []
            }
            users_collection.insert_one(new_user)
            user = users_collection.find_one({"id": new_id}, {"_id": 0})
        except Exception as e:
            print(f"set_password: failed to create user: {e}")
            raise HTTPException(status_code=500, detail="Failed to create admin user")

    if user:
        user.pop("password", None)
        user = sanitize(user)
    token = create_access_token({"user_id": user.get("id")})
    return {"user": user, "token": token}

@router.get("/__ping")
def users_ping():
    return {"users_router": "alive"}

@router.put("/{user_id}")
async def update_user(user_id: str, user: dict, request: Request):
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

    # If invitePermissions are being changed, enforce admin-only guard
    try:
        if "invitePermissions" in update_doc:
            # Determine requester
            requester = None
            auth = request.headers.get("authorization") or request.headers.get("Authorization")
            if auth and auth.lower().startswith("bearer "):
                token = auth.split(" ", 1)[1]
                try:
                    from app.auth import verify_ws_token
                    requester_id = verify_ws_token(token)
                    if requester_id:
                        requester = users_collection.find_one({"id": requester_id})
                except Exception:
                    requester = None
            else:
                xuid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
                if xuid:
                    try:
                        requester = users_collection.find_one({"id": int(xuid)})
                    except Exception:
                        requester = users_collection.find_one({"id": xuid})

            # If no requester, deny
            if not requester:
                raise HTTPException(status_code=403, detail="Not authorized to change invite permissions")

            # Allow if requester is updating their own record
            try:
                req_id = requester.get("id")
                if str(req_id) != str(actual_id):
                    # Not self - require org_admin role
                    if requester.get("role") != "org_admin":
                        raise HTTPException(status_code=403, detail="Only org admins can change other users' invite permissions")
                    # Optionally ensure same organization
                    req_org = requester.get("organizationId")
                    targ_org = existing_user.get("organizationId")
                    if req_org and targ_org and str(req_org) != str(targ_org):
                        raise HTTPException(status_code=403, detail="Org admin can only modify users in their organization")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=403, detail="Not authorized to change invite permissions")
    except HTTPException:
        raise
    except Exception:
        pass
    res = users_collection.update_one({"id": actual_id}, {"$set": update_doc})
    if res.matched_count == 0:
        return {"error": "User not found"}
    updated = users_collection.find_one({"id": actual_id}, {"_id": 0})
    if updated:
        updated.pop("password", None)
        updated = sanitize(updated)
        # Broadcast invitePermissions update to org admins for this user's domain
        try:
            inv = updated.get("invitePermissions")
            # normalize domain lookup
            domain = None
            org_id = updated.get("organizationId")
            if org_id:
                try:
                    org = organizations_collection.find_one({"_id": org_id})
                    if org:
                        domain = org.get("domain")
                except Exception:
                    domain = None
            if not domain:
                email = updated.get("email") or ""
                import re
                m = re.search(r"@([A-Za-z0-9.-]+)$", email)
                if m:
                    domain = m.group(1).lower()
            if domain:
                try:
                    import asyncio
                    msg = {
                        "type": "invite_permissions_updated",
                        "userId": str(actual_id),
                        "email": updated.get("email"),
                        "invitePermissions": inv
                    }
                    # fire-and-forget broadcast to admins for this domain
                    asyncio.create_task(manager.send_to_admins_for_domain(domain, msg))
                except Exception:
                    pass
        except Exception:
            pass
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
