from pymongo import MongoClient
import os
from dotenv import load_dotenv, find_dotenv

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

# Create indexes for faster queries
try:
    users_collection.create_index("name")
    users_collection.create_index("email")
    users_collection.create_index("id", unique=True)

    spaces_collection.create_index("id", unique=True)
    spaces_collection.create_index("members")
    spaces_collection.create_index("channels.id")

    messages_collection.create_index("chatId")
    messages_collection.create_index([("chatId", 1), ("message.id", 1)])
    messages_collection.create_index([("chatId", 1), ("message.timestamp", 1)])

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
except Exception:
    pass
