from google.oauth2 import service_account
from googleapiclient.discovery import build
import logging
from pathlib import Path

_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]

# Module-level singleton for Drive service
_drive_service = None
_drive_creds = None


def _default_service_account_path() -> Path:
    # backend root is two levels up from this file: backend/app/core -> backend
    this_file = Path(__file__).resolve()
    backend_root = this_file.parents[2]
    return backend_root.joinpath("service-account.json")


def build_drive_service():
    """Return a singleton Google Drive service client.

    Credentials are loaded only from `service-account.json` located at the
    backend root (backend/service-account.json). This intentionally does not
    read credentials from environment variables.
    """
    global _drive_service, _drive_creds
    if _drive_service:
        return _drive_service

    svc_path = _default_service_account_path()

    if not svc_path.exists():
        raise RuntimeError(f"Google service account file not found at {svc_path}")

    try:
        creds = service_account.Credentials.from_service_account_file(str(svc_path), scopes=_DRIVE_SCOPES)
        service = build("drive", "v3", credentials=creds, cache_discovery=False)
        _drive_service = service
        _drive_creds = creds
        logging.getLogger("app.core.drive").info(f"Loaded Google service account from {svc_path}")
        return _drive_service
    except Exception as e:
        logging.getLogger("app.core.drive").exception("Failed to initialize Google Drive client: %s", e)
        raise
