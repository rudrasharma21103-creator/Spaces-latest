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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://spacexyz-9tvsdbhuo-rudra-sharmas-projects-c9bf28fa.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
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
