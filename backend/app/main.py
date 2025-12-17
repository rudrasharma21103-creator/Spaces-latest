from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import client
from app.routes.users import router as users_router
from app.routes.spaces import router as spaces_router
from app.routes.messages import router as messages_router
from app.routes.actions import router as actions_router
from app.routes.ws import router as ws_router

app = FastAPI()

# Fix CORS - Allow both ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Your Vite port
        "http://127.0.0.1:5173",  # Local IP
        "http://localhost:5174",  # Alternative port
        "http://127.0.0.1:5174",  # Alternative IP
        "http://localhost:3000",  # React default
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(users_router)
app.include_router(spaces_router)
app.include_router(messages_router)
app.include_router(actions_router)
app.include_router(ws_router)

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