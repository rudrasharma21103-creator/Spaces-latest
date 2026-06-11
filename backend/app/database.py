from datetime import datetime, timezone
import logging
import os
import re

from dotenv import load_dotenv, find_dotenv
from pymongo import MongoClient

# Load nearest .env (search up from current file). This ensures the backend
# picks up the project-level .env when the current working directory is
# the backend folder (common during development with uvicorn).
load_dotenv(find_dotenv())

client = MongoClient(
    os.getenv("MONGO_URI"),
    serverSelectionTimeoutMS=int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "10000")),
    connectTimeoutMS=int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "10000")),
    socketTimeoutMS=int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "45000")),
    maxPoolSize=int(os.getenv("MONGO_MAX_POOL_SIZE", "100")),
    minPoolSize=int(os.getenv("MONGO_MIN_POOL_SIZE", "5")),
    retryWrites=True,
    retryReads=True,
    compressors="zstd,zlib,snappy",
    appname="spaces-backend",
    tz_aware=True,
)
db = client["spacesdb"]

users_collection = db["users"]
spaces_collection = db["spaces"]
messages_collection = db["messages"]
notifications_collection = db["notifications"]
tasks_collection = db["tasks"]
contexts_collection = db["contexts"]
events_collection = db["events"]
files_collection = db["files"]
drafts_collection = db["drafts"]
organizations_collection = db["organizations"]
gmail_docs_collection = db["gmail_docs"]
starred_messages_collection = db["starred_messages"]
pinned_channels_collection = db["pinned_channels"]
logger = logging.getLogger("app.database")


def _normalize_gmail_filename(filename: str | None):
    normalized = re.sub(r"\s+", " ", (filename or "Attachment").strip()).lower()
    return normalized or "attachment"


def _gmail_occurrence_key(doc: dict):
    message_id = doc.get("messageId")
    attachment_id = doc.get("attachmentId") or doc.get("id")
    if message_id and attachment_id:
        return f"{message_id}:{attachment_id}"
    return None


def _gmail_doc_date_ms(doc: dict):
    try:
        return int(doc.get("latestEmailDateMs") or doc.get("emailDateMs") or doc.get("internalDate") or 0)
    except Exception:
        return 0


def _merge_gmail_doc_metadata(docs: list[dict], normalized_filename: str, now: str):
    latest = max(docs, key=lambda doc: (_gmail_doc_date_ms(doc), str(doc.get("updatedAt") or "")))
    related_attachment_keys: list[str] = []
    related_message_ids: list[str] = []
    related_emails: list[dict] = []
    seen_emails: set[str] = set()

    def add_unique(values: list[str], value):
        if value and value not in values:
            values.append(value)

    for doc in docs:
        for key in doc.get("relatedAttachmentKeys") or []:
            add_unique(related_attachment_keys, key)
        add_unique(related_attachment_keys, _gmail_occurrence_key(doc))

        for message_id in doc.get("relatedMessageIds") or doc.get("messageIds") or []:
            add_unique(related_message_ids, message_id)
        add_unique(related_message_ids, doc.get("messageId"))

        existing_related_emails = doc.get("relatedEmails") or []
        if existing_related_emails:
            for email in existing_related_emails:
                email_key = str(email.get("messageId") or email)
                if email_key not in seen_emails:
                    related_emails.append(email)
                    seen_emails.add(email_key)
        else:
            message_id = doc.get("messageId")
            if message_id and message_id not in seen_emails:
                related_emails.append(
                    {
                        "messageId": message_id,
                        "threadId": doc.get("threadId"),
                        "senderName": doc.get("senderName"),
                        "senderEmail": doc.get("senderEmail"),
                        "subject": doc.get("subject") or doc.get("emailSubject"),
                        "emailDate": doc.get("emailDate"),
                        "emailDateMs": _gmail_doc_date_ms(doc),
                    }
                )
                seen_emails.add(message_id)

    occurrence_count = len(related_attachment_keys) or len(docs)
    return {
        "source": "gmail",
        "filename": latest.get("filename") or latest.get("originalFilename") or "Attachment",
        "originalFilename": docs[0].get("originalFilename") or docs[0].get("filename") or latest.get("filename") or "Attachment",
        "normalizedFileName": normalized_filename,
        "messageId": latest.get("messageId"),
        "threadId": latest.get("threadId"),
        "attachmentId": latest.get("attachmentId") or latest.get("id"),
        "id": latest.get("attachmentId") or latest.get("id"),
        "partId": latest.get("partId"),
        "mimeType": latest.get("mimeType") or "application/octet-stream",
        "size": int(latest.get("size") or 0),
        "senderName": latest.get("senderName") or latest.get("latestSenderName"),
        "senderEmail": latest.get("senderEmail") or latest.get("latestSenderEmail"),
        "from": latest.get("from") or latest.get("senderEmail") or latest.get("latestSenderEmail"),
        "subject": latest.get("subject") or latest.get("emailSubject") or latest.get("latestEmailSubject") or "No subject",
        "emailSubject": latest.get("emailSubject") or latest.get("subject") or latest.get("latestEmailSubject") or "No subject",
        "emailDate": latest.get("emailDate") or latest.get("latestEmailDate"),
        "emailDateMs": _gmail_doc_date_ms(latest),
        "latestSenderName": latest.get("senderName") or latest.get("latestSenderName"),
        "latestSenderEmail": latest.get("senderEmail") or latest.get("latestSenderEmail"),
        "latestEmailSubject": latest.get("subject") or latest.get("emailSubject") or latest.get("latestEmailSubject"),
        "latestEmailDate": latest.get("emailDate") or latest.get("latestEmailDate"),
        "latestEmailDateMs": _gmail_doc_date_ms(latest),
        "date": str(latest.get("date") or latest.get("internalDate") or _gmail_doc_date_ms(latest)),
        "internalDate": str(latest.get("internalDate") or latest.get("date") or _gmail_doc_date_ms(latest)),
        "snippet": latest.get("snippet") or "",
        "labelIds": latest.get("labelIds") or [],
        "relatedAttachmentKeys": related_attachment_keys,
        "relatedMessageIds": related_message_ids,
        "messageIds": related_message_ids,
        "relatedEmails": related_emails,
        "occurrenceCount": occurrence_count,
        "updatedAt": now,
    }


def cleanup_gmail_doc_duplicates():
    """Merge legacy duplicate Gmail docs before the unique filename index is created."""
    now = datetime.now(timezone.utc).isoformat()
    docs = list(gmail_docs_collection.find({"source": "gmail"}).sort([("emailDateMs", -1), ("updatedAt", -1)]))
    groups: dict[tuple[str, str], list[dict]] = {}
    for doc in docs:
        normalized = _normalize_gmail_filename(doc.get("normalizedFileName") or doc.get("filename") or doc.get("originalFilename"))
        doc["_needsNormalizedUpdate"] = doc.get("normalizedFileName") != normalized
        doc["normalizedFileName"] = normalized
        groups.setdefault((str(doc.get("userId")), normalized), []).append(doc)

    merged_groups = 0
    for (_user_id, normalized), group_docs in groups.items():
        if len(group_docs) == 1:
            doc = group_docs[0]
            if doc.get("_needsNormalizedUpdate"):
                gmail_docs_collection.update_one({"_id": doc["_id"]}, {"$set": {"normalizedFileName": normalized, "updatedAt": now}})
            continue

        group_docs.sort(key=lambda doc: (_gmail_doc_date_ms(doc), str(doc.get("updatedAt") or "")), reverse=True)
        keeper = group_docs[0]
        duplicate_ids = [doc["_id"] for doc in group_docs[1:]]
        merged_doc = _merge_gmail_doc_metadata(group_docs, normalized, now)
        merged_doc.pop("_needsNormalizedUpdate", None)
        if duplicate_ids:
            gmail_docs_collection.delete_many({"_id": {"$in": duplicate_ids}})
        gmail_docs_collection.update_one(
            {"_id": keeper["_id"]},
            {"$set": merged_doc},
            upsert=False,
        )
        merged_groups += 1

    if merged_groups:
        logger.info("Merged %s duplicate Gmail docs groups before creating unique index", merged_groups)

# Create indexes for faster queries
try:
    users_collection.create_index("name")
    users_collection.create_index("name_search")
    users_collection.create_index([("name", 1), ("id", 1)])
    users_collection.create_index("email")
    users_collection.create_index("email_normalized")
    users_collection.create_index("email_domain")
    users_collection.create_index("id", unique=True)
    users_collection.create_index("friends")
    users_collection.create_index([("notifications.type", 1), ("notifications.status", 1), ("notifications.fromId", 1)])
    users_collection.create_index("professionalProfile.companyName")
    users_collection.create_index("professionalProfile.position")

    spaces_collection.create_index("id", unique=True)
    spaces_collection.create_index("members")
    spaces_collection.create_index("ownerId")
    spaces_collection.create_index("channels.id")

    messages_collection.create_index("chatId")
    messages_collection.create_index("message.id")
    messages_collection.create_index([("chatId", 1), ("message.id", 1)])
    messages_collection.create_index([("chatId", 1), ("message.timestamp", 1)])

    starred_messages_collection.create_index([("userId", 1), ("createdAt", -1)])
    starred_messages_collection.create_index([("userId", 1), ("messageId", 1), ("chatId", 1)], unique=True)

    pinned_channels_collection.create_index([("userId", 1), ("createdAt", -1)])
    pinned_channels_collection.create_index([("userId", 1), ("channelId", 1)], unique=True)

    contexts_collection.create_index("chatId", unique=True)

    tasks_collection.create_index("assigned_to")
    tasks_collection.create_index("space_id")
    tasks_collection.create_index("created_by")
    tasks_collection.create_index([("created_by", 1), ("timestamp", -1)])
    tasks_collection.create_index([("assigned_to", 1), ("timestamp", -1)])

    drafts_collection.create_index([("userId", 1), ("updatedAt", -1)])
    drafts_collection.create_index([("userId", 1), ("id", 1)], unique=True)

    notifications_collection.create_index("userId")
    notifications_collection.create_index("email")
    notifications_collection.create_index([("email", 1), ("timestamp", -1)])

    events_collection.create_index("domain")
    events_collection.create_index([("domain", 1), ("timestamp", -1)])

    organizations_collection.create_index("domain", unique=True)
    organizations_collection.create_index("adminEmail")

    cleanup_gmail_doc_duplicates()
    gmail_docs_collection.create_index([("userId", 1), ("senderEmail", 1), ("emailDateMs", -1)])
    gmail_docs_collection.create_index([("userId", 1), ("messageId", 1), ("attachmentId", 1)], unique=True)
    gmail_docs_collection.create_index(
        [("userId", 1), ("normalizedFileName", 1)],
        unique=True,
        partialFilterExpression={"source": "gmail", "normalizedFileName": {"$type": "string"}},
        name="unique_gmail_doc_filename_per_user",
    )
    gmail_docs_collection.create_index([("userId", 1), ("emailDateMs", -1)])
    gmail_docs_collection.create_index([("userId", 1), ("mimeType", 1)])
except Exception as exc:
    logger.warning("Database index setup failed: %s", exc)
