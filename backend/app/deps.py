from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth import decode_token

security = HTTPBearer()

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security)
):
    token = creds.credentials
    payload = decode_token(token)

    if not payload or "user_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    return payload["user_id"]
