from fastapi import APIRouter
from app.database import events_collection

router = APIRouter(prefix="/events")

@router.get("/")
def get_events():
    docs = events_collection.find({}, {"_id": 0})
    return list(docs)

@router.post("/")
def save_event(event: dict):
    # Basic validation: ensure an id and timestamp exist
    if not event.get("id"):
        event["id"] = f"evt-{int(__import__('time').time()*1000)}"
    if not event.get("timestamp"):
        event["timestamp"] = __import__("time").time()

    events_collection.insert_one(event)
    return {"status": "saved", "event": event}
