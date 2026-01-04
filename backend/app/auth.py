from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext

SECRET_KEY = "d9a3f0b6c82e4f1b9d7a1c4e6f3b8a7d9e2c5f8a4b6d7c9e1f2a3b4c5d6e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# fallback context if bcrypt backend fails for any reason (e.g., missing/incorrect bcrypt lib)
fallback_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def verify_ws_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("user_id")
    except JWTError:
        # Fallback: support simple local token format `token_<userId>_<ts>` used in dev
        try:
            if token and isinstance(token, str) and token.startswith("token_"):
                parts = token.split("_")
                # token_<userId>_<ts>
                if len(parts) >= 3:
                    return int(parts[1])
        except Exception:
            pass
        return None
def hash_password(password: str):
    # Ensure password is a string and safely truncate at the byte level to avoid
    # bcrypt's 72-byte limit which would raise ValueError.
    if password is None:
        password = ""
    # coerce non-str inputs to str to avoid unexpected types
    if not isinstance(password, str):
        password = str(password)

    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) > 72:
        pw_bytes = pw_bytes[:72]
        # decode using ignore to avoid cutting a multibyte sequence
        password = pw_bytes.decode("utf-8", errors="ignore")

    # Try primary context; on failure, fall back to a safer algorithm
    try:
        return pwd_context.hash(password)
    except Exception as e:
        # provide a clear log and fallback to pbkdf2_sha256 to avoid blocking user signup
        print(f"[auth.hash_password] bcrypt hashing failed: {e}; falling back to pbkdf2_sha256")
        return fallback_context.hash(password)

def verify_password(plain_password, hashed_password):
    # Normalize input
    if plain_password is None:
        plain_password = ""
    if not isinstance(plain_password, str):
        plain_password = str(plain_password)

    # If the stored hash is a bcrypt variant, truncate the input at 72 bytes
    # to match how we truncate on signup (avoids verification mismatch).
    try:
        scheme = identify_hash_scheme(hashed_password)
    except Exception:
        scheme = None

    try:
        if scheme and scheme.startswith("bcrypt"):
            pw_bytes = plain_password.encode("utf-8")
            if len(pw_bytes) > 72:
                pw_bytes = pw_bytes[:72]
                plain_password = pw_bytes.decode("utf-8", errors="ignore")
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        try:
            return fallback_context.verify(plain_password, hashed_password)
        except Exception:
            return False


def identify_hash_scheme(hashed_password: str):
    """Return the name of the hash scheme identified for a stored hash.
    Tries the primary context first, then the fallback.
    """
    try:
        scheme = pwd_context.identify(hashed_password)
        if scheme:
            return scheme
    except Exception:
        pass
    try:
        scheme = fallback_context.identify(hashed_password)
        if scheme:
            return scheme
    except Exception:
        pass
    return None


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
