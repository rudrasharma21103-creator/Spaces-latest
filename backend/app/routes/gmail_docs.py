import logging
import time
from datetime import datetime, timezone
from email.utils import parseaddr, parsedate_to_datetime

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import UpdateOne
from starlette import status

from app.database import gmail_docs_collection
from app.deps import get_current_user

router = APIRouter(prefix="/gmail-docs", tags=["gmail-docs"])
logger = logging.getLogger("app.routes.gmail_docs")

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
SYNC_CACHE_SECONDS = 60
GMAIL_DOCS_PER_USER_LIMIT = 600


class GmailSyncPayload(BaseModel):
    accessToken: str = Field(min_length=10)
    pageSize: int = Field(default=50, ge=1, le=50)
    backgroundPages: int = Field(default=20, ge=0, le=50)


def _gmail_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}


def _request_gmail(access_token: str, path: str, params: dict | None = None):
    response = requests.get(f"{GMAIL_API}{path}", params=params or {}, headers=_gmail_headers(access_token), timeout=20)
    if response.status_code in (401, 403):
        raise HTTPException(status_code=response.status_code, detail="Gmail access denied or expired")
    try:
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Gmail API request failed for %s: %s", path, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gmail API request failed")
    return response.json()


def _parse_sender(value: str | None):
    raw = value or ""
    name, email = parseaddr(raw)
    email = (email or raw or "unknown").strip()
    name = (name or "").strip().strip('"')
    return name or email, email


def _parse_email_date(value: str | None, internal_date: str | int | None = None):
    if value:
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            ms = int(parsed.timestamp() * 1000)
            return parsed.astimezone(timezone.utc).isoformat(), ms
        except Exception:
            pass

    try:
        ms = int(internal_date or 0)
        if ms > 0:
            return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(), ms
    except Exception:
        pass

    now_ms = int(time.time() * 1000)
    return datetime.now(timezone.utc).isoformat(), now_ms


def _headers_map(payload: dict | None):
    headers = (payload or {}).get("headers") or []
    return {str(item.get("name", "")).lower(): item.get("value", "") for item in headers}


def _iter_attachment_parts(part: dict | None):
    if not part:
        return
    if part.get("filename") and part.get("body", {}).get("attachmentId"):
        yield part
    for child in part.get("parts") or []:
        yield from _iter_attachment_parts(child)


def _metadata_for_message(access_token: str, message_id: str):
    # Fetch lightweight headers first so the sync can cheaply establish context.
    metadata = _request_gmail(
        access_token,
        f"/messages/{message_id}",
        {
            "format": "metadata",
            "metadataHeaders": ["From", "Subject", "Date"],
        },
    )
    meta_headers = _headers_map(metadata.get("payload"))

    # Then fetch the message structure. This returns attachment ids and sizes, not
    # attachment bytes, so sync stays metadata-only.
    detail = _request_gmail(access_token, f"/messages/{message_id}", {"format": "full"})
    detail_headers = _headers_map(detail.get("payload"))
    headers = {**detail_headers, **meta_headers}

    sender_name, sender_email = _parse_sender(headers.get("from"))
    email_date, email_date_ms = _parse_email_date(headers.get("date"), detail.get("internalDate"))
    subject = headers.get("subject") or "No subject"

    attachments = []
    for part in _iter_attachment_parts(detail.get("payload")):
        body = part.get("body") or {}
        attachments.append(
            {
                "source": "gmail",
                "messageId": detail.get("id") or message_id,
                "threadId": detail.get("threadId"),
                "attachmentId": body.get("attachmentId"),
                "id": body.get("attachmentId"),
                "partId": part.get("partId"),
                "filename": part.get("filename") or "Attachment",
                "mimeType": part.get("mimeType") or "application/octet-stream",
                "size": int(body.get("size") or 0),
                "senderName": sender_name,
                "senderEmail": sender_email,
                "from": headers.get("from") or sender_email,
                "subject": subject,
                "emailSubject": subject,
                "emailDate": email_date,
                "emailDateMs": email_date_ms,
                "date": str(detail.get("internalDate") or email_date_ms),
                "internalDate": str(detail.get("internalDate") or email_date_ms),
                "snippet": detail.get("snippet") or "",
                "labelIds": detail.get("labelIds") or [],
            }
        )

    return attachments


def _store_attachments(user_id: str, attachments: list[dict]):
    if not attachments:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    operations = []
    for item in attachments:
        if not item.get("messageId") or not item.get("attachmentId"):
            continue
        doc = {**item, "userId": str(user_id), "updatedAt": now}
        operations.append(
            UpdateOne(
                {
                    "userId": str(user_id),
                    "messageId": item["messageId"],
                    "attachmentId": item["attachmentId"],
                },
                {
                    "$set": doc,
                    "$setOnInsert": {"createdAt": now},
                },
                upsert=True,
            )
        )

    if not operations:
        return 0
    result = gmail_docs_collection.bulk_write(operations, ordered=False)
    _enforce_user_doc_limit(user_id)
    return int(result.upserted_count + result.modified_count)


def _enforce_user_doc_limit(user_id: str):
    docs_to_remove = list(
        gmail_docs_collection.find(
            {"userId": str(user_id), "source": "gmail"},
            {"_id": 1},
        )
        .sort([("emailDateMs", -1), ("updatedAt", -1)])
        .skip(GMAIL_DOCS_PER_USER_LIMIT)
    )
    if not docs_to_remove:
        return 0

    result = gmail_docs_collection.delete_many({"_id": {"$in": [doc["_id"] for doc in docs_to_remove]}})
    return int(result.deleted_count)


def _sync_page(access_token: str, user_id: str, page_size: int, page_token: str | None = None):
    params = {
        "q": "has:attachment",
        "maxResults": page_size,
    }
    if page_token:
        params["pageToken"] = page_token

    message_list = _request_gmail(access_token, "/messages", params)
    attachments = []
    for message in message_list.get("messages") or []:
        message_id = message.get("id")
        if not message_id:
            continue
        try:
            attachments.extend(_metadata_for_message(access_token, message_id))
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Skipping Gmail message %s during sync: %s", message_id, exc)

    stored = _store_attachments(user_id, attachments)
    return {
        "stored": stored,
        "attachments": attachments,
        "nextPageToken": message_list.get("nextPageToken"),
        "resultSizeEstimate": message_list.get("resultSizeEstimate", 0),
    }


def _sync_older_pages(access_token: str, user_id: str, page_size: int, page_token: str | None, max_pages: int):
    current_token = page_token
    pages = 0
    while current_token and pages < max_pages:
        try:
            result = _sync_page(access_token, user_id, page_size, current_token)
        except Exception as exc:
            logger.warning("Background Gmail sync stopped for user %s: %s", user_id, exc)
            return
        current_token = result.get("nextPageToken")
        pages += 1


def _serialize_attachment(doc: dict):
    clean = {key: value for key, value in doc.items() if key not in {"_id", "userId"}}
    clean["id"] = clean.get("attachmentId") or clean.get("id")
    clean["gmailAttachmentId"] = clean.get("attachmentId") or clean.get("id")
    clean["gmailMessageId"] = clean.get("messageId")
    clean["source"] = "gmail"
    return clean


def _build_grouped_response(user_id: str, search: str | None = None, file_type: str | None = None, recent_days: int | None = None):
    query: dict = {"userId": str(user_id), "source": "gmail"}

    if recent_days:
        cutoff = int((time.time() - recent_days * 86400) * 1000)
        query["emailDateMs"] = {"$gte": cutoff}

    if file_type and file_type != "all":
        type_map = {
            "pdf": "pdf",
            "image": "image/",
            "docs": "document",
            "sheets": "spreadsheet",
            "slides": "presentation",
            "text": "text/",
        }
        needle = type_map.get(file_type, file_type)
        query["mimeType"] = {"$regex": needle, "$options": "i"}

    if search:
        query["$or"] = [
            {"senderName": {"$regex": search, "$options": "i"}},
            {"senderEmail": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
            {"filename": {"$regex": search, "$options": "i"}},
        ]

    docs = list(gmail_docs_collection.find(query, {"_id": 0, "userId": 0}).sort("emailDateMs", -1).limit(GMAIL_DOCS_PER_USER_LIMIT))
    senders: dict[str, dict] = {}

    for doc in docs:
        sender_email = doc.get("senderEmail") or "unknown"
        sender_name = doc.get("senderName") or sender_email
        sender = senders.setdefault(
            sender_email,
            {
                "senderName": sender_name,
                "senderEmail": sender_email,
                "totalAttachments": 0,
                "latestEmailDate": None,
                "latestEmailDateMs": 0,
                "emailsById": {},
            },
        )
        sender["totalAttachments"] += 1
        date_ms = int(doc.get("emailDateMs") or 0)
        if date_ms > sender["latestEmailDateMs"]:
            sender["latestEmailDateMs"] = date_ms
            sender["latestEmailDate"] = doc.get("emailDate")

        message_id = doc.get("messageId")
        email = sender["emailsById"].setdefault(
            message_id,
            {
                "messageId": message_id,
                "threadId": doc.get("threadId"),
                "subject": doc.get("subject") or "No subject",
                "emailDate": doc.get("emailDate"),
                "emailDateMs": date_ms,
                "attachments": [],
            },
        )
        email["attachments"].append(_serialize_attachment(doc))

    grouped = []
    for sender in senders.values():
        emails = sorted(sender.pop("emailsById").values(), key=lambda item: item.get("emailDateMs") or 0, reverse=True)
        grouped.append({**sender, "emails": emails})

    grouped.sort(key=lambda item: item.get("latestEmailDateMs") or 0, reverse=True)
    return {
        "attachments": [_serialize_attachment(doc) for doc in docs],
        "senders": grouped,
        "totalAttachments": len(docs),
        "cachedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/sync")
def sync_gmail_docs(payload: GmailSyncPayload, background_tasks: BackgroundTasks, user_id=Depends(get_current_user)):
    cached_doc = gmail_docs_collection.find_one({"userId": str(user_id)}, sort=[("updatedAt", -1)])
    cached_at = cached_doc.get("updatedAt") if cached_doc else None
    if cached_at:
        try:
            age = datetime.now(timezone.utc) - datetime.fromisoformat(cached_at)
            if age.total_seconds() < SYNC_CACHE_SECONDS:
                return {"status": "cached", **_build_grouped_response(user_id)}
        except Exception:
            pass

    first_page = _sync_page(payload.accessToken, str(user_id), payload.pageSize)
    next_token = first_page.get("nextPageToken")
    if next_token and payload.backgroundPages > 0:
        background_tasks.add_task(_sync_older_pages, payload.accessToken, str(user_id), payload.pageSize, next_token, payload.backgroundPages)

    return {
        "status": "syncing" if next_token else "complete",
        "stored": first_page.get("stored", 0),
        "nextPageToken": next_token,
        **_build_grouped_response(user_id),
    }


@router.get("/grouped")
def get_grouped_gmail_docs(
    user_id=Depends(get_current_user),
    search: str | None = Query(default=None, max_length=120),
    fileType: str | None = Query(default=None, max_length=40),
    recentDays: int | None = Query(default=None, ge=1, le=3650),
):
    return _build_grouped_response(user_id, search=search, file_type=fileType, recent_days=recentDays)
