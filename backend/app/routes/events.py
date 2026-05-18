import re

from fastapi import APIRouter, HTTPException, Request, status
from app.database import events_collection
from app.deps import get_request_user

router = APIRouter(prefix="/events")

@router.get("/")
def get_events(request: Request):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    domain = None
    match = re.search(r"@([A-Za-z0-9.-]+)$", str(user.get("email") or ""))
    if match:
        domain = match.group(1).lower()
    query = {"$or": [{"userId": str(user.get("id"))}, {"userId": user.get("id")}]}
    if user.get("role") in ("admin", "org_admin") and domain:
        query["$or"].append({"domain": domain})
    docs = events_collection.find(query, {"_id": 0})
    return list(docs)

@router.post("/")
def save_event(request: Request, event: dict):
    user = get_request_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    # Basic validation: ensure an id and timestamp exist
    if not event.get("id"):
        event["id"] = f"evt-{int(__import__('time').time()*1000)}"
    if not event.get("timestamp"):
        event["timestamp"] = __import__("time").time()
    event["userId"] = str(user.get("id"))
    match = re.search(r"@([A-Za-z0-9.-]+)$", str(user.get("email") or ""))
    if match:
        event["domain"] = match.group(1).lower()

    events_collection.insert_one(event)
    return {"status": "saved", "event": event}
