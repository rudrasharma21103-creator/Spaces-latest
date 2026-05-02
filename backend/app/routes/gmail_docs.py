import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parseaddr, parsedate_to_datetime

import requests
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import BulkWriteError, DuplicateKeyError
from starlette import status

from app.database import gmail_docs_collection
from app.deps import get_current_user

router = APIRouter(prefix="/gmail-docs", tags=["gmail-docs"])
logger = logging.getLogger("app.routes.gmail_docs")

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
SYNC_CACHE_SECONDS = 60
GMAIL_DOCS_PER_USER_LIMIT = 600
GMAIL_REQUEST_TIMEOUT = (5, 45)
GMAIL_REQUEST_RETRIES = 2
GMAIL_MESSAGE_WORKERS = 6
GMAIL_MESSAGE_FIELDS = (
    "id,threadId,internalDate,labelIds,snippet,"
    "payload(headers(name,value),filename,mimeType,partId,body/attachmentId,body/size,"
    "parts(filename,mimeType,partId,body/attachmentId,body/size,"
    "parts(filename,mimeType,partId,body/attachmentId,body/size,"
    "parts(filename,mimeType,partId,body/attachmentId,body/size,"
    "parts(filename,mimeType,partId,body/attachmentId,body/size)))))"
)


def _normalize_filename(filename: str | None):
    normalized = re.sub(r"\s+", " ", (filename or "Attachment").strip()).lower()
    return normalized or "attachment"


class GmailSyncPayload(BaseModel):
    accessToken: str = Field(min_length=10)
    pageSize: int = Field(default=20, ge=1, le=50)
    backgroundPages: int = Field(default=20, ge=0, le=50)


def _gmail_headers(access_token: str):
    return {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}


def _request_gmail(access_token: str, path: str, params: dict | None = None):
    last_timeout = None
    for attempt in range(GMAIL_REQUEST_RETRIES + 1):
        try:
            response = requests.get(f"{GMAIL_API}{path}", params=params or {}, headers=_gmail_headers(access_token), timeout=GMAIL_REQUEST_TIMEOUT)
            break
        except requests.Timeout as exc:
            last_timeout = exc
            if attempt >= GMAIL_REQUEST_RETRIES:
                logger.warning("Gmail API request timed out for %s after %s attempts", path, attempt + 1)
                raise
            time.sleep(0.35 * (attempt + 1))
    else:
        raise last_timeout or HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gmail API request failed")

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
    # This returns attachment ids and sizes, not attachment bytes, so sync stays
    # metadata-only. A single full request is more reliable than metadata+full.
    detail = _request_gmail(
        access_token,
        f"/messages/{message_id}",
        {
            "format": "full",
            "fields": GMAIL_MESSAGE_FIELDS,
        },
    )
    detail_headers = _headers_map(detail.get("payload"))
    headers = detail_headers

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
    stored = 0
    for item in attachments:
        if not item.get("messageId") or not item.get("attachmentId"):
            continue
        normalized_filename = _normalize_filename(item.get("filename"))
        occurrence_key = f"{item['messageId']}:{item['attachmentId']}"
        latest_doc = {
            **item,
            "userId": str(user_id),
            "source": "gmail",
            "originalFilename": item.get("filename") or "Attachment",
            "normalizedFileName": normalized_filename,
            "latestSenderName": item.get("senderName"),
            "latestSenderEmail": item.get("senderEmail"),
            "latestEmailSubject": item.get("subject") or item.get("emailSubject"),
            "latestEmailDate": item.get("emailDate"),
            "latestEmailDateMs": int(item.get("emailDateMs") or 0),
        }
        related_email = {
            "messageId": item.get("messageId"),
            "threadId": item.get("threadId"),
            "senderName": item.get("senderName"),
            "senderEmail": item.get("senderEmail"),
            "subject": item.get("subject") or item.get("emailSubject"),
            "emailDate": item.get("emailDate"),
            "emailDateMs": int(item.get("emailDateMs") or 0),
        }
        update_pipeline = _gmail_doc_upsert_pipeline(latest_doc, occurrence_key, related_email, now)

        try:
            result = gmail_docs_collection.update_one(
                {
                    "userId": str(user_id),
                    "source": "gmail",
                    "normalizedFileName": normalized_filename,
                },
                update_pipeline,
                upsert=True,
            )
        except DuplicateKeyError:
            logger.info("Gmail doc duplicate key during upsert for user %s and file %s", user_id, normalized_filename)
            result = gmail_docs_collection.update_one(
                {
                    "userId": str(user_id),
                    "source": "gmail",
                    "normalizedFileName": normalized_filename,
                },
                update_pipeline,
                upsert=False,
            )
        except BulkWriteError as exc:
            if not any(error.get("code") == 11000 for error in exc.details.get("writeErrors", [])):
                raise
            logger.info("Gmail doc bulk duplicate key during upsert for user %s and file %s", user_id, normalized_filename)
            result = gmail_docs_collection.update_one(
                {
                    "userId": str(user_id),
                    "source": "gmail",
                    "normalizedFileName": normalized_filename,
                },
                update_pipeline,
                upsert=False,
            )

        stored += int(result.upserted_id is not None or result.modified_count > 0)

    _enforce_user_doc_limit(user_id)
    return stored


def _gmail_doc_upsert_pipeline(doc: dict, occurrence_key: str, related_email: dict, now: str):
    def literal(value):
        return {"$literal": value}

    email_date_ms = int(doc.get("emailDateMs") or 0)
    existing_occurrences = {"$ifNull": ["$relatedAttachmentKeys", []]}
    occurrence_keys = {"$setUnion": [existing_occurrences, literal([occurrence_key])]}
    existing_message_ids = {"$ifNull": ["$relatedMessageIds", []]}
    message_ids = {"$setUnion": [existing_message_ids, literal([doc.get("messageId")])]}
    existing_related_emails = {"$ifNull": ["$relatedEmails", []]}
    is_new_occurrence = {"$not": [{"$in": [literal(occurrence_key), existing_occurrences]}]}
    is_latest_email = {"$gte": [email_date_ms, {"$ifNull": ["$latestEmailDateMs", {"$ifNull": ["$emailDateMs", -1]}]}]}

    latest_fields = {
        key: {"$cond": [is_latest_email, literal(value), f"${key}"]}
        for key, value in doc.items()
        if key
        not in {
            "createdAt",
            "occurrenceCount",
            "relatedAttachmentKeys",
            "relatedMessageIds",
            "relatedEmails",
            "updatedAt",
        }
    }

    return [
        {
            "$set": {
                **latest_fields,
                "userId": literal(doc["userId"]),
                "source": "gmail",
                "originalFilename": {"$ifNull": ["$originalFilename", literal(doc.get("originalFilename") or doc.get("filename"))]},
                "normalizedFileName": literal(doc["normalizedFileName"]),
                "latestSenderName": {"$cond": [is_latest_email, literal(doc.get("latestSenderName")), "$latestSenderName"]},
                "latestSenderEmail": {"$cond": [is_latest_email, literal(doc.get("latestSenderEmail")), "$latestSenderEmail"]},
                "latestEmailSubject": {"$cond": [is_latest_email, literal(doc.get("latestEmailSubject")), "$latestEmailSubject"]},
                "latestEmailDate": {"$cond": [is_latest_email, literal(doc.get("latestEmailDate")), "$latestEmailDate"]},
                "latestEmailDateMs": {"$cond": [is_latest_email, literal(doc.get("latestEmailDateMs")), "$latestEmailDateMs"]},
                "relatedAttachmentKeys": occurrence_keys,
                "relatedMessageIds": message_ids,
                "messageIds": message_ids,
                "relatedEmails": {
                    "$cond": [
                        is_new_occurrence,
                        {"$concatArrays": [existing_related_emails, literal([related_email])]},
                        existing_related_emails,
                    ]
                },
                "occurrenceCount": {"$size": occurrence_keys},
                "updatedAt": literal(now),
                "createdAt": {"$ifNull": ["$createdAt", literal(now)]},
            }
        }
    ]


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
    message_ids = [message.get("id") for message in message_list.get("messages") or [] if message.get("id")]
    if message_ids:
        with ThreadPoolExecutor(max_workers=min(GMAIL_MESSAGE_WORKERS, len(message_ids))) as executor:
            futures = {executor.submit(_metadata_for_message, access_token, message_id): message_id for message_id in message_ids}
            for future in as_completed(futures):
                message_id = futures[future]
                try:
                    attachments.extend(future.result())
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


def _doc_email_date_ms(doc: dict):
    try:
        return int(doc.get("latestEmailDateMs") or doc.get("emailDateMs") or doc.get("internalDate") or doc.get("date") or 0)
    except Exception:
        return 0


def _related_email_for_doc(doc: dict):
    return {
        "messageId": doc.get("messageId"),
        "threadId": doc.get("threadId"),
        "senderName": doc.get("senderName") or doc.get("latestSenderName"),
        "senderEmail": doc.get("senderEmail") or doc.get("latestSenderEmail"),
        "subject": doc.get("subject") or doc.get("emailSubject") or doc.get("latestEmailSubject"),
        "emailDate": doc.get("emailDate") or doc.get("latestEmailDate"),
        "emailDateMs": _doc_email_date_ms(doc),
    }


def _merge_gmail_docs(docs: list[dict], now: str | None = None):
    if not docs:
        return {}

    latest = max(docs, key=lambda doc: (_doc_email_date_ms(doc), str(doc.get("updatedAt") or "")))
    merged = dict(latest)
    merged.pop("_id", None)
    merged.pop("_needsNormalizedUpdate", None)
    related_attachment_keys = []
    related_message_ids = []
    related_emails = []
    seen_email_keys = set()

    def add_unique(values: list, value):
        if value and value not in values:
            values.append(value)

    for doc in docs:
        for key in doc.get("relatedAttachmentKeys") or []:
            add_unique(related_attachment_keys, key)
        if doc.get("messageId") and (doc.get("attachmentId") or doc.get("id")):
            add_unique(related_attachment_keys, f"{doc.get('messageId')}:{doc.get('attachmentId') or doc.get('id')}")

        for message_id in doc.get("relatedMessageIds") or doc.get("messageIds") or []:
            add_unique(related_message_ids, message_id)
        add_unique(related_message_ids, doc.get("messageId"))

        related = doc.get("relatedEmails") or [_related_email_for_doc(doc)]
        for email in related:
            email_key = str(email.get("messageId") or email)
            if email_key and email_key not in seen_email_keys:
                related_emails.append(email)
                seen_email_keys.add(email_key)

    normalized_filename = _normalize_filename(latest.get("normalizedFileName") or latest.get("filename") or latest.get("originalFilename"))
    merged.update(
        {
            "source": "gmail",
            "normalizedFileName": normalized_filename,
            "originalFilename": docs[0].get("originalFilename") or docs[0].get("filename") or latest.get("filename") or "Attachment",
            "latestSenderName": latest.get("senderName") or latest.get("latestSenderName"),
            "latestSenderEmail": latest.get("senderEmail") or latest.get("latestSenderEmail"),
            "latestEmailSubject": latest.get("subject") or latest.get("emailSubject") or latest.get("latestEmailSubject"),
            "latestEmailDate": latest.get("emailDate") or latest.get("latestEmailDate"),
            "latestEmailDateMs": _doc_email_date_ms(latest),
            "relatedAttachmentKeys": related_attachment_keys,
            "relatedMessageIds": related_message_ids,
            "messageIds": related_message_ids,
            "relatedEmails": related_emails,
            "occurrenceCount": len(related_attachment_keys) or len(docs),
        }
    )
    if now:
        merged["updatedAt"] = now
    return merged


def _cleanup_user_gmail_duplicates(user_id: str):
    docs = list(gmail_docs_collection.find({"userId": str(user_id), "source": "gmail"}).sort([("emailDateMs", -1), ("updatedAt", -1)]))
    if not docs:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    groups: dict[str, list[dict]] = {}
    for doc in docs:
        normalized = _normalize_filename(doc.get("normalizedFileName") or doc.get("filename") or doc.get("originalFilename"))
        doc["_needsNormalizedUpdate"] = doc.get("normalizedFileName") != normalized
        doc["normalizedFileName"] = normalized
        groups.setdefault(normalized, []).append(doc)

    merged_count = 0
    for normalized, group_docs in groups.items():
        if len(group_docs) == 1:
            doc = group_docs[0]
            if doc.get("_needsNormalizedUpdate"):
                gmail_docs_collection.update_one({"_id": doc["_id"]}, {"$set": {"normalizedFileName": normalized, "updatedAt": now}})
            continue
        group_docs.sort(key=lambda doc: (_doc_email_date_ms(doc), str(doc.get("updatedAt") or "")), reverse=True)
        keeper = group_docs[0]
        duplicate_ids = [doc["_id"] for doc in group_docs[1:]]
        merged_doc = _merge_gmail_docs(group_docs, now)
        if duplicate_ids:
            gmail_docs_collection.delete_many({"_id": {"$in": duplicate_ids}})
        gmail_docs_collection.update_one({"_id": keeper["_id"]}, {"$set": merged_doc})
        merged_count += 1

    return merged_count


def _dedupe_docs_for_response(docs: list[dict]):
    groups: dict[str, list[dict]] = {}
    for doc in docs:
        normalized = _normalize_filename(doc.get("normalizedFileName") or doc.get("filename") or doc.get("originalFilename"))
        doc["normalizedFileName"] = normalized
        groups.setdefault(normalized, []).append(doc)
    return sorted((_merge_gmail_docs(group) for group in groups.values()), key=lambda doc: _doc_email_date_ms(doc), reverse=True)


def _build_grouped_response(user_id: str, search: str | None = None, file_type: str | None = None, recent_days: int | None = None):
    _cleanup_user_gmail_duplicates(user_id)
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
    docs = _dedupe_docs_for_response(docs)
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
