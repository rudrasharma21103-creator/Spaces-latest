from pymongo import MongoClient
import os
from dotenv import load_dotenv, find_dotenv

# Load nearest .env (search up from current file). This ensures the backend
# picks up the project-level .env when the current working directory is
# the backend folder (common during development with uvicorn).
load_dotenv(find_dotenv())

client = MongoClient(
    os.getenv("MONGO_URI"),
    serverSelectionTimeoutMS=5000  # ⬅️ important
)
db = client["spacesdb"]

users_collection = db["users"]
spaces_collection = db["spaces"]
messages_collection = db["messages"]
notifications_collection = db["notifications"]
# Events collection used by the frontend to fetch/save calendar events
events_collection = db["events"]
# Files metadata collection - store only metadata (no binaries)
files_collection = db["files"]
# Organizations collection for enterprise registrations
organizations_collection = db["organizations"]

# Create indexes for faster queries
try:
    # Index for user search by name (case-insensitive text search)
    users_collection.create_index("name")
    users_collection.create_index("email")
    users_collection.create_index("id", unique=True)
    # Index for spaces
    spaces_collection.create_index("id", unique=True)
    spaces_collection.create_index("members")
    # Index for messages
    messages_collection.create_index("channelId")
    messages_collection.create_index("timestamp")
    # Index for notifications
    notifications_collection.create_index("userId")
    # Index for organizations
    organizations_collection.create_index("domain", unique=True)
    organizations_collection.create_index("adminEmail")
except Exception:
    pass  # Indexes may already exist
