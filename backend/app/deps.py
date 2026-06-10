import os
import re

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import decode_token
from app.database import organizations_collection, users_collection

AUTH_COOKIE_NAME = "spaces_session"
security = HTTPBearer(auto_error=False)


def _user_id_candidates(user_id):
    candidates = []
    if user_id is None:
        return candidates
    candidates.append(user_id)
    string_id = str(user_id)
    if string_id != user_id:
        candidates.append(string_id)
    try:
        int_id = int(user_id)
        if int_id != user_id:
            candidates.append(int_id)
    except (TypeError, ValueError):
        pass
    return candidates


def _token_from_request(request: Request, creds: HTTPAuthorizationCredentials | None = None):
    if creds and creds.scheme.lower() == "bearer" and creds.credentials:
        return creds.credentials

    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and isinstance(auth, str) and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    return request.cookies.get(AUTH_COOKIE_NAME)


def get_request_user(request: Request, creds: HTTPAuthorizationCredentials | None = None):
    cached = getattr(request.state, "current_user", None)
    if cached:
        return cached

    token = _token_from_request(request, creds)
    if not token:
        return None

    payload = decode_token(token)
    user_id = payload.get("user_id") if payload else None
    if user_id is None:
        return None

    user = users_collection.find_one({"id": {"$in": _user_id_candidates(user_id)}})
    if not user:
        return None

    request.state.current_user = user
    return user


def require_current_user_doc(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = get_request_user(request, creds)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
):
    return require_current_user_doc(request, creds).get("id")


def require_admin_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
):
    user = require_current_user_doc(request, creds)
    if user.get("role") in ("admin", "org_admin", "owner"):
        return user

    email = str(user.get("email") or "").strip()
    domain = email.rsplit("@", 1)[1].lower() if "@" in email else ""
    is_registered_org_admin = False
    if email and domain:
        is_registered_org_admin = bool(
            organizations_collection.find_one(
                {
                    "domain": domain,
                    "verified": True,
                    "adminEmail": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
                },
                {"_id": 1},
            )
        )

    if not is_registered_org_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def set_auth_cookie(response: Response, token: str):
    secure = os.getenv("ENVIRONMENT", "").lower() in {"production", "prod"} or os.getenv("AUTH_COOKIE_SECURE", "").lower() == "true"
    default_samesite = "none" if secure else "lax"
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        httponly=True,
        secure=secure,
        samesite=os.getenv("AUTH_COOKIE_SAMESITE", default_samesite),
        max_age=int(os.getenv("AUTH_COOKIE_MAX_AGE_SECONDS", str(60 * 60 * 24))),
        path="/",
    )


def clear_auth_cookie(response: Response):
    secure = os.getenv("ENVIRONMENT", "").lower() in {"production", "prod"} or os.getenv("AUTH_COOKIE_SECURE", "").lower() == "true"
    default_samesite = "none" if secure else "lax"
    response.delete_cookie(
        AUTH_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=os.getenv("AUTH_COOKIE_SAMESITE", default_samesite),
    )
