from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import routers
from app.database import client
from app.routes.users import router as users_router
from app.routes.spaces import router as spaces_router
from app.routes.messages import router as messages_router
from app.routes.actions import router as actions_router
from app.routes.ws import router as ws_router
from app.routes.events import router as events_router
from app.routes.debug import router as debug_router

app = FastAPI()

# --- CORS Configuration ---
# This allows your Vercel frontend to communicate with this Render backend
FRONTEND_URL = os.getenv("FRONTEND_URL")  # Set this in Render Environment Variables
origins = [
    FRONTEND_URL,
    "http://localhost:5173",  # Vite default local port
    "http://localhost:3000",  # React default local port
]

# Filter out None values if FRONTEND_URL isn't set yet
origins = [o for o in origins if o]

app.add_middleware(
    CORSMiddleware,
    # If origins list is empty, it falls back to "*" to allow all (useful for initial testing)
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include Routers ---
app.include_router(users_router)
app.include_router(spaces_router)
app.include_router(messages_router)
app.include_router(actions_router)
app.include_router(ws_router)
app.include_router(events_router)
app.include_router(debug_router)

# --- Health Check & Root Routes ---
@app.get("/")
def read_root():
    return {"message": "Spaces API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "spaces-backend"}

@app.get("/db-test")
def db_test():
    try:
        # Pings the MongoDB server to verify connection
        client.admin.command("ping")
        return {"status": "MongoDB connected"}
    except Exception as e:
        return {"error": str(e)}
