from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import client
from app.routes.users import router as users_router
from app.routes.spaces import router as spaces_router
from app.routes.messages import router as messages_router
from app.routes.actions import router as actions_router
from app.routes.ws import router as ws_router
from app.routes.events import router as events_router
from app.routes.debug import router as debug_router
from app.routes.upload import router as upload_router
from app.routes.orgs import router as orgs_router
import logging
from app.core import drive as drive_core
import os
from googleapiclient.errors import HttpError
# Load environment variables from backend/.env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    # dotenv optional; if not installed or .env missing, continue
    pass

app = FastAPI()

# Allow both Vercel deployments and localhost for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://spaces-lake.vercel.app/",
    ],
    allow_origin_regex=r"https://spaces-lake.vercel.app/",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(spaces_router)
app.include_router(messages_router)
app.include_router(actions_router)
app.include_router(ws_router)
app.include_router(events_router)
app.include_router(debug_router)
app.include_router(upload_router)
app.include_router(orgs_router)


@app.on_event("startup")
def startup_checks():
    # Confirm Drive credentials file loads at startup to fail fast and log status
    logger = logging.getLogger("app.main")
    try:
        svc = drive_core.build_drive_service()
        logger.info("Google Drive client initialized successfully")

        # Validate configured upload folder is accessible by the service account
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        if not folder_id:
            logger.warning("Environment variable GOOGLE_DRIVE_FOLDER_ID is not set; uploads will fail until configured")
        else:
            try:
                # Attempt to get the folder metadata to ensure the service account can access it
                svc.files().get(fileId=folder_id, fields="id,name").execute()
                logger.info("Google Drive upload folder is accessible: %s", folder_id)
            except HttpError as he:
                logger.error("Drive folder validation failed for %s: %s", folder_id, he)
    except Exception as e:
        # Log error but allow app to start — uploads will fail with clear errors
        logger.error("Google Drive client failed to initialize at startup: %s", e)

@app.get("/")
def read_root():
    return {"message": "Spaces API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "spaces-backend"}

@app.get("/db-test")
def db_test():
    try:
        client.admin.command("ping")
        return {"status": "MongoDB connected"}
    except Exception as e:
        return {"error": str(e)}
