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

app = FastAPI()

# CORS configuration: prefer explicit origins in production
import os
FRONTEND_URL = os.getenv("FRONTEND_URL")  # set this on Render to your Vercel URL (e.g., https://myapp.vercel.app)
origins = [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
]
# Filter out unset values
origins = [o for o in origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
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

@app.get("/")
def read_root():
    return {"message": "Spaces API is running"}

@app.get("/db-test")
def db_test():
    try:
        client.admin.command("ping")
        return {"status": "MongoDB connected"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "spaces-backend"}