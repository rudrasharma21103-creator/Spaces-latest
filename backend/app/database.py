from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(
    os.getenv("MONGO_URI"),
    serverSelectionTimeoutMS=5000  # ⬅️ important
)
db = client["spacesdb"]

users_collection = db["users"]
spaces_collection = db["spaces"]
messages_collection = db["messages"]
notifications_collection = db["notifications"]
