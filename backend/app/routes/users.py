import logging
import re
import time
from urllib.parse import urlparse, urlunparse

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from pymongo.errors import PyMongoError

from app.auth import create_access_token, hash_password, verify_password
from app.database import organizations_collection, spaces_collection, users_collection
from app.models import ProfessionalProfilePayload
from app.ws_manager import manager

logger = logging.getLogger("app.routes.users")

USER_LIST_PROJECTION = {"_id": 0, "password": 0, "notifications": 0}
FRIEND_CARD_PROJECTION = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "email": 1,
    "professionalProfile": 1,
    "companyName": 1,
    "position": 1,
    "linkedInUrl": 1,
    "linkedinUrl": 1,
    "linkedinURL": 1,
    "avatar_url": 1,
    "avatar_preset": 1,
    "isOnline": 1,
    "status": 1,
    "lastActive": 1,
}
USER_SEARCH_PROJECTION = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "email": 1,
    "organizationId": 1,
    "friends": 1,
    "companyName": 1,
    "position": 1,
    "linkedInUrl": 1,
    "linkedinUrl": 1,
    "linkedinURL": 1,
    "professionalProfile": 1,
    "avatar_url": 1,
    "avatar_preset": 1,
    "notifications.id": 1,
    "notifications.type": 1,
    "notifications.status": 1,
    "notifications.fromId": 1,
}
MAX_SEARCH_LIMIT = 50
PROFILE_FIELD_ALIASES = ("companyName", "position", "linkedInUrl", "linkedinUrl", "linkedinURL")

router = APIRouter(prefix="/users")


def sanitize(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        out = {}
        for key, value in obj.items():
            if key == "_id":
                continue
            out[key] = sanitize(value)
        return out
    if isinstance(obj, list):
        return [sanitize(value) for value in obj]
    return obj


def clean_optional_text(value, max_length=None):
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    if not value:
        return None
    if max_length is not None:
        value = value[:max_length]
    return value


def extract_email_domain(email):
    if not email:
        return None
    match = re.search(r"@([A-Za-z0-9.-]+)$", str(email))
    return match.group(1).lower() if match else None


def normalize_linkedin_url(value):
    cleaned = clean_optional_text(value, 500)
    if not cleaned:
        return None

    candidate = cleaned if re.match(r"^https?://", cleaned, re.IGNORECASE) else f"https://{cleaned}"
    parsed = urlparse(candidate)
    host = (parsed.netloc or "").lower()
    normalized_host = host[4:] if host.startswith("www.") else host

    if not normalized_host.endswith("linkedin.com"):
        raise HTTPException(status_code=422, detail="LinkedIn URL must point to linkedin.com")

    normalized = urlunparse(
        (
            parsed.scheme or "https",
            parsed.netloc,
            parsed.path or "",
            parsed.params,
            parsed.query,
            "",
        )
    )
    return normalized[:500]


def normalize_professional_profile(source, strict=False):
    raw = {}
    if isinstance(source, dict):
        nested = source.get("professionalProfile")
        if isinstance(nested, dict):
            raw.update(nested)
        raw.update(source)

    company_name = clean_optional_text(raw.get("companyName"), 120)
    position = clean_optional_text(raw.get("position"), 120)
    linkedin_raw = (
        raw.get("linkedInUrl")
        or raw.get("linkedinUrl")
        or raw.get("linkedinURL")
    )
    linkedin_url = None
    if linkedin_raw is not None:
        if strict:
            linkedin_url = normalize_linkedin_url(linkedin_raw)
        else:
            try:
                linkedin_url = normalize_linkedin_url(linkedin_raw)
            except HTTPException:
                linkedin_url = clean_optional_text(linkedin_raw, 500)

    profile = {}
    if company_name:
        profile["companyName"] = company_name
    if position:
        profile["position"] = position
    if linkedin_url:
        profile["linkedInUrl"] = linkedin_url
    return profile or None


def build_profile_update_ops(profile):
    if not profile:
        return {
            "$unset": {
                "professionalProfile": "",
                "companyName": "",
                "position": "",
                "linkedInUrl": "",
                "linkedinUrl": "",
                "linkedinURL": "",
            }
        }

    set_doc = {
        "professionalProfile": profile,
        "companyName": profile.get("companyName"),
        "position": profile.get("position"),
        "linkedInUrl": profile.get("linkedInUrl"),
    }
    unset_doc = {
        "linkedinUrl": "",
        "linkedinURL": "",
    }
    for key in ("companyName", "position", "linkedInUrl"):
        if set_doc.get(key) is None:
            unset_doc[key] = ""
            set_doc.pop(key, None)

    ops = {"$set": set_doc}
    if unset_doc:
        ops["$unset"] = unset_doc
    return ops


def serialize_user(user, include_notifications=False):
    if not user:
        return None

    sanitized = sanitize(user)
    sanitized.pop("password", None)

    profile = normalize_professional_profile(sanitized)
    if profile:
        sanitized["professionalProfile"] = profile
    else:
        sanitized.pop("professionalProfile", None)

    for key in PROFILE_FIELD_ALIASES:
        sanitized.pop(key, None)

    if not sanitized.get("status"):
        if user.get("isOnline") is True:
            sanitized["status"] = "online"
        elif user.get("isOnline") is False:
            sanitized["status"] = "offline"

    if include_notifications:
        sanitized["notifications"] = sanitize(user.get("notifications") or [])
    else:
        sanitized.pop("notifications", None)

    return sanitized


def build_bootstrap_payload(requester):
    serialized_user = serialize_user(requester, include_notifications=True)
    friend_ids = requester.get("friends") or []

    friends_raw = fetch_users_by_ids(friend_ids, FRIEND_CARD_PROJECTION)
    friends_by_id = {str(friend.get("id")): friend for friend in friends_raw if friend.get("id") is not None}

    ordered_friends = []
    seen = set()
    for raw_id in friend_ids:
        friend_id = str(raw_id)
        if friend_id in seen:
            continue
        seen.add(friend_id)
        friend = friends_by_id.get(friend_id)
        if friend:
            ordered_friends.append(serialize_user(friend))

    return {
        "user": serialized_user,
        "friends": ordered_friends,
    }


def get_user_by_id(user_id, projection=None):
    user = users_collection.find_one({"id": user_id}, projection)
    if user:
        return user
    try:
        return users_collection.find_one({"id": int(user_id)}, projection)
    except (TypeError, ValueError):
        return None


def expand_user_ids_for_query(user_ids):
    query_ids = []
    seen = set()

    for raw_id in user_ids or []:
        if raw_id is None:
            continue

        candidates = [raw_id]
        string_id = str(raw_id)
        if string_id != raw_id:
            candidates.append(string_id)

        try:
            int_id = int(raw_id)
        except (TypeError, ValueError):
            int_id = None

        if int_id is not None and int_id != raw_id:
            candidates.append(int_id)

        for candidate in candidates:
            marker = (type(candidate).__name__, str(candidate))
            if marker in seen:
                continue
            seen.add(marker)
            query_ids.append(candidate)

    return query_ids


def fetch_users_by_ids(user_ids, projection=None):
    query_ids = expand_user_ids_for_query(user_ids)
    if not query_ids:
        return []
    return list(users_collection.find({"id": {"$in": query_ids}}, projection))


def resolve_requester(request: Request):
    requester = None
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1]
        try:
            from app.auth import verify_ws_token

            requester_id = verify_ws_token(token)
            if requester_id is not None:
                requester = get_user_by_id(requester_id)
        except Exception:
            requester = None

    if requester:
        return requester

    x_user_id = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if not x_user_id:
        return None
    return get_user_by_id(x_user_id)


def can_requester_see_user(requester, candidate):
    if not requester:
        return True

    permissions = requester.get("invitePermissions") or {}
    can_invite_all = permissions.get("canInviteAll")
    can_invite_company_only = permissions.get("canInviteCompanyOnly")

    if not can_invite_company_only or can_invite_all:
        return True

    requester_org = requester.get("organizationId")
    candidate_org = candidate.get("organizationId")
    if requester_org and candidate_org:
        return str(requester_org) == str(candidate_org)

    requester_domain = extract_email_domain(requester.get("email"))
    candidate_domain = extract_email_domain(candidate.get("email"))
    return bool(requester_domain and requester_domain == candidate_domain)


def build_relationship_state(requester, candidate):
    if not requester:
        return "can_connect", None

    requester_id = str(requester.get("id"))
    candidate_id = str(candidate.get("id"))

    if requester_id == candidate_id:
        return "self", None

    requester_friends = {str(friend_id) for friend_id in requester.get("friends") or []}
    if candidate_id in requester_friends:
        return "connected", None

    incoming_request = next(
        (
            notification
            for notification in requester.get("notifications") or []
            if notification.get("type") == "friend_request"
            and notification.get("status") == "pending"
            and str(notification.get("fromId")) == candidate_id
        ),
        None,
    )
    if incoming_request:
        return "incoming_request", incoming_request.get("id")

    outgoing_request = any(
        notification.get("type") == "friend_request"
        and notification.get("status") == "pending"
        and str(notification.get("fromId")) == requester_id
        for notification in candidate.get("notifications") or []
    )
    if outgoing_request:
        return "outgoing_request", None

    return "can_connect", None


def build_user_search_result(candidate, requester):
    serialized = serialize_user(candidate)
    relationship_status, notification_id = build_relationship_state(requester, candidate)
    return {
        "id": serialized.get("id"),
        "name": serialized.get("name") or "",
        "avatar_url": serialized.get("avatar_url"),
        "avatar_preset": serialized.get("avatar_preset"),
        "professionalProfile": serialized.get("professionalProfile"),
        "relationshipStatus": relationship_status,
        "incomingRequestNotificationId": notification_id,
    }


def search_users_core(query: str, request: Request, limit: int = 25):
    requester = resolve_requester(request)
    safe_limit = max(1, min(int(limit or 25), MAX_SEARCH_LIMIT))
    normalized_query = query.strip()
    if not normalized_query:
        return []

    escaped_query = re.escape(normalized_query)
    prefix_pattern = f"^{escaped_query}"
    contains_pattern = escaped_query
    query_length = len(normalized_query)
    should_run_contains_fallback = query_length >= 3

    try:
        prefix_limit = safe_limit if query_length > 1 else min(safe_limit, 10)
        candidates = list(
            users_collection.find(
                {"name": {"$regex": prefix_pattern, "$options": "i"}},
                USER_SEARCH_PROJECTION,
            ).limit(prefix_limit)
        )

        if should_run_contains_fallback and len(candidates) < safe_limit:
            existing_ids = {str(candidate.get("id")) for candidate in candidates}
            remaining = max(safe_limit - len(candidates), 0)
            fallback_limit = min(max(remaining + 4, 6), safe_limit + 4)
            fallback_candidates = list(
                users_collection.find(
                    {
                        "name": {"$regex": contains_pattern, "$options": "i"},
                        "id": {"$nin": [candidate.get("id") for candidate in candidates if candidate.get("id") is not None]},
                    },
                    USER_SEARCH_PROJECTION,
                )
                .limit(fallback_limit)
            )
            for candidate in fallback_candidates:
                candidate_id = str(candidate.get("id"))
                if candidate_id in existing_ids:
                    continue
                candidates.append(candidate)
                existing_ids.add(candidate_id)
                if len(candidates) >= safe_limit:
                    break
    except PyMongoError as exc:
        logger.error("Failed to search users for query %s: %s", normalized_query, exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")

    visible_candidates = [candidate for candidate in candidates if can_requester_see_user(requester, candidate)]
    visible_candidates.sort(key=lambda candidate: (candidate.get("name") or "").lower())
    results = [build_user_search_result(candidate, requester) for candidate in visible_candidates[:safe_limit]]
    return results


def discover_people_core(request: Request, limit: int = 8):
    requester = resolve_requester(request)
    safe_limit = max(1, min(int(limit or 8), 24))

    try:
        candidates = list(
            users_collection.find({}, USER_SEARCH_PROJECTION).sort("name", 1).limit(200)
        )
    except PyMongoError as exc:
        logger.error("Failed to load discover users: %s", exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")

    results = []
    for candidate in candidates:
        if not can_requester_see_user(requester, candidate):
            continue

        card = build_user_search_result(candidate, requester)
        if card["relationshipStatus"] in {"self", "connected"}:
            continue

        results.append(card)

    relationship_order = {
        "incoming_request": 0,
        "can_connect": 1,
        "outgoing_request": 2,
    }
    results.sort(key=lambda item: (relationship_order.get(item["relationshipStatus"], 3), item["name"].lower()))
    return results[:safe_limit]


@router.get("/")
def get_users(request: Request):
    requester = resolve_requester(request)

    try:
        users_raw = list(users_collection.find({}, USER_LIST_PROJECTION))
    except PyMongoError as exc:
        logger.error("Failed to load users list: %s", exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")

    users = []
    requester_id = str(requester.get("id")) if requester else None
    for user in users_raw:
        if requester and str(user.get("id")) == requester_id:
            users.append(serialize_user(requester, include_notifications=True))
            continue
        if can_requester_see_user(requester, user):
            users.append(serialize_user(user))

    return users


@router.get("/me")
def get_current_user(request: Request):
    requester = resolve_requester(request)
    if not requester:
        raise HTTPException(status_code=401, detail="Authentication required")
    return serialize_user(requester, include_notifications=True)


@router.get("/bootstrap")
def get_bootstrap_data(request: Request):
    requester = resolve_requester(request)
    if not requester:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        return build_bootstrap_payload(requester)
    except PyMongoError as exc:
        logger.error("Failed to build bootstrap payload for %s: %s", requester.get("id"), exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")


@router.post("/by-ids")
def get_users_by_ids(user_ids: list, request: Request):
    requester = resolve_requester(request)
    requester_id = str(requester.get("id")) if requester else None
    requester_friend_ids = {str(friend_id) for friend_id in (requester.get("friends") or [])} if requester else set()

    try:
        users_raw = fetch_users_by_ids(user_ids, USER_LIST_PROJECTION)
    except PyMongoError as exc:
        logger.error("Failed to load users by ids %s: %s", user_ids, exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")

    users_by_id = {str(user.get("id")): user for user in users_raw if user.get("id") is not None}
    ordered_users = []
    seen = set()

    for raw_id in user_ids or []:
        user_id = str(raw_id)
        if user_id in seen:
            continue
        seen.add(user_id)

        if requester and user_id == requester_id:
            ordered_users.append(serialize_user(requester, include_notifications=True))
            continue

        candidate = users_by_id.get(user_id)
        if candidate and (
            user_id in requester_friend_ids
            or can_requester_see_user(requester, candidate)
        ):
            ordered_users.append(serialize_user(candidate))

    return ordered_users


@router.post("/signup")
def signup(user: dict):
    logger.info("[users.signup] received signup for: %s", user.get("email"))
    existing = users_collection.find_one(
        {"email": {"$regex": f"^{re.escape(user['email'])}$", "$options": "i"}}
    )
    if existing:
        return {"error": "Email already registered"}

    try:
        user["password"] = hash_password(user["password"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Password hashing failed: {exc}")

    try:
        domain = extract_email_domain(user.get("email"))
        organization = organizations_collection.find_one({"domain": domain, "verified": True}) if domain else None
        if organization:
            user["organizationId"] = organization.get("_id") or organization.get("domain")
            user["role"] = "employee"
            user.setdefault("invitePermissions", {"canInviteAll": False, "canInviteCompanyOnly": True})
        else:
            user.setdefault("role", "user")
            user.setdefault("invitePermissions", {"canInviteAll": True, "canInviteCompanyOnly": False})
    except Exception:
        pass

    user.setdefault("spaces", [])
    user.setdefault("friends", [])
    user.setdefault("notifications", [])

    profile = normalize_professional_profile(user, strict=True)
    if profile:
        user["professionalProfile"] = profile

    users_collection.insert_one(user)
    token = create_access_token({"user_id": user["id"]})
    return {"user": serialize_user(user, include_notifications=True), "token": token}


@router.post("/login")
def login(data: dict):
    logger.info("[users.login] login attempt for: %s", data.get("email"))
    user = users_collection.find_one(
        {"email": {"$regex": f"^{re.escape(data['email'])}$", "$options": "i"}}
    )

    if not user or not verify_password(data["password"], user.get("password")):
        return {"error": "Invalid credentials"}

    token = create_access_token({"user_id": user["id"]})
    return {"user": serialize_user(user, include_notifications=True), "token": token}


@router.get("/by-email/{email}")
def find_user_by_email(email: str):
    try:
        user = users_collection.find_one(
            {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
            USER_LIST_PROJECTION,
        )
    except PyMongoError as exc:
        logger.error("Failed to look up user by email %s: %s", email, exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")
    return serialize_user(user) if user else None


@router.get("/search")
def search_users_query(request: Request, q: str = Query(..., min_length=1), limit: int = Query(25, ge=1, le=MAX_SEARCH_LIMIT)):
    return search_users_core(q, request, limit)


@router.get("/search/{query}")
def search_users_legacy(query: str, request: Request, limit: int = Query(25, ge=1, le=MAX_SEARCH_LIMIT)):
    return search_users_core(query, request, limit)


@router.get("/discover")
def discover_people(request: Request, limit: int = Query(8, ge=1, le=24)):
    return discover_people_core(request, limit)


@router.get("/by-domain/{domain}")
def users_by_domain(domain: str):
    query = {"email": {"$regex": f"@{re.escape(domain)}$", "$options": "i"}}
    try:
        users = list(users_collection.find(query, USER_LIST_PROJECTION))
    except PyMongoError as exc:
        logger.error("Failed to list users for domain %s: %s", domain, exc)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable. Please retry.")
    return [serialize_user(user) for user in users]


@router.post("/set-password")
def set_password(payload: dict):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    user = users_collection.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})

    try:
        hashed = hash_password(password)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to hash password")

    if user:
        try:
            users_collection.update_one({"id": user["id"]}, {"$set": {"password": hashed}})
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to set password")
        updated = users_collection.find_one({"id": user["id"]}, {"_id": 0})
        return {"user": serialize_user(updated, include_notifications=True), "token": create_access_token({"user_id": updated["id"]})}

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
            "notifications": [],
        }
        users_collection.insert_one(new_user)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to create admin user")

    return {"user": serialize_user(new_user, include_notifications=True), "token": create_access_token({"user_id": new_id})}


@router.get("/__ping")
def users_ping():
    return {"users_router": "alive"}


@router.put("/{user_id}/professional-profile")
async def update_professional_profile(user_id: str, payload: ProfessionalProfilePayload, request: Request):
    existing_user = get_user_by_id(user_id)
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    requester = resolve_requester(request)
    actual_id = existing_user.get("id")
    if requester and str(requester.get("id")) != str(actual_id) and requester.get("role") != "org_admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")

    normalized_profile = normalize_professional_profile(payload.model_dump(), strict=True)
    update_ops = build_profile_update_ops(normalized_profile)
    users_collection.update_one({"id": actual_id}, update_ops)
    updated = get_user_by_id(actual_id)
    return serialize_user(updated, include_notifications=bool(requester and str(requester.get("id")) == str(actual_id)))


@router.put("/{user_id}")
async def update_user(user_id: str, user: dict, request: Request):
    update_doc = {key: value for key, value in user.items() if key != "password"}
    existing_user = get_user_by_id(user_id)
    if not existing_user:
        return {"error": "User not found"}

    actual_id = existing_user.get("id")
    requester = resolve_requester(request)

    try:
        if "invitePermissions" in update_doc:
            if not requester:
                raise HTTPException(status_code=403, detail="Not authorized to change invite permissions")

            requester_id = requester.get("id")
            if str(requester_id) != str(actual_id):
                if requester.get("role") != "org_admin":
                    raise HTTPException(status_code=403, detail="Only org admins can change other users' invite permissions")
                requester_org = requester.get("organizationId")
                target_org = existing_user.get("organizationId")
                if requester_org and target_org and str(requester_org) != str(target_org):
                    raise HTTPException(status_code=403, detail="Org admin can only modify users in their organization")
    except HTTPException:
        raise

    profile_fields_present = "professionalProfile" in update_doc or any(
        key in update_doc for key in PROFILE_FIELD_ALIASES
    )
    if profile_fields_present:
        normalized_profile = normalize_professional_profile(update_doc, strict=True)
        for key in PROFILE_FIELD_ALIASES:
            update_doc.pop(key, None)
        update_doc.pop("professionalProfile", None)

    update_ops = {}
    set_doc = dict(update_doc)
    unset_doc = {}

    if profile_fields_present:
        profile_ops = build_profile_update_ops(normalized_profile)
        set_doc.update(profile_ops.get("$set", {}))
        unset_doc.update(profile_ops.get("$unset", {}))

    if set_doc:
        update_ops["$set"] = set_doc
    if unset_doc:
        update_ops["$unset"] = unset_doc

    if not update_ops:
        updated = get_user_by_id(actual_id)
        return serialize_user(updated, include_notifications=bool(requester and str(requester.get("id")) == str(actual_id)))

    result = users_collection.update_one({"id": actual_id}, update_ops)
    if result.matched_count == 0:
        return {"error": "User not found"}

    updated = get_user_by_id(actual_id)
    serialized_updated = serialize_user(
        updated,
        include_notifications=bool(requester and str(requester.get("id")) == str(actual_id)),
    )

    try:
        if "invitePermissions" in update_doc:
            domain = None
            organization_id = updated.get("organizationId")
            if organization_id:
                try:
                    organization = organizations_collection.find_one({"_id": organization_id})
                    if organization:
                        domain = organization.get("domain")
                except Exception:
                    domain = None
            if not domain:
                domain = extract_email_domain(updated.get("email"))
            if domain:
                import asyncio

                asyncio.create_task(
                    manager.send_to_admins_for_domain(
                        domain,
                        {
                            "type": "invite_permissions_updated",
                            "userId": str(actual_id),
                            "email": updated.get("email"),
                            "invitePermissions": updated.get("invitePermissions"),
                        },
                    )
                )
    except Exception:
        pass

    try:
        if any(key in update_doc for key in ("avatar_url", "avatar_preset", "profileImage", "avatar")):
            raw_url = updated.get("avatar_url")
            avatar_url = raw_url
            if isinstance(raw_url, str) and raw_url and not (raw_url.startswith("data:") or raw_url.startswith("blob:")):
                timestamp = int(time.time() * 1000)
                separator = "&" if "?" in raw_url else "?"
                avatar_url = f"{raw_url}{separator}v={timestamp}"
                users_collection.update_one({"id": actual_id}, {"$set": {"avatar_url": avatar_url}})
                serialized_updated["avatar_url"] = avatar_url
                updated["avatar_url"] = avatar_url

            avatar_data = {
                "avatar_url": avatar_url,
                "avatar_preset": updated.get("avatar_preset"),
                "name": updated.get("name"),
            }

            recipients = set()
            for friend_id in updated.get("friends") or []:
                if friend_id and str(friend_id) != str(actual_id):
                    recipients.add(str(friend_id))

            user_spaces = updated.get("spaces") or []
            for space in spaces_collection.find({"id": {"$in": user_spaces}}):
                for member_id in space.get("members", []):
                    if member_id and str(member_id) != str(actual_id):
                        recipients.add(str(member_id))

            notification = {
                "type": "avatar_updated",
                "userId": str(actual_id),
                "avatarData": avatar_data,
                "timestamp": int(time.time()),
            }

            for recipient_id in recipients:
                try:
                    await manager.send_to_user(str(recipient_id), {"type": "notification", "notification": notification})
                except Exception:
                    pass

            try:
                await manager.broadcast(
                    "notifications",
                    {
                        "type": "profileUpdated",
                        "userId": str(actual_id),
                        "avatar_url": avatar_url,
                        "avatar_preset": updated.get("avatar_preset"),
                    },
                )
            except Exception:
                pass
    except Exception as exc:
        logger.warning("avatar broadcast failed for %s: %s", actual_id, exc)

    return serialized_updated
