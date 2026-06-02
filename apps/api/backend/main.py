from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.routes.auth import router as auth_router
from backend.routes.google import router as google_router
from backend.routes.presentations import router as presentations_router
from backend.routes.transcription import router as transcription_router

app = FastAPI(title="RT Presentation Feedback API")
settings = get_settings()
cors_origins = [
    origin.strip().rstrip("/")
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(google_router, prefix="/api")
app.include_router(presentations_router, prefix="/api")
app.include_router(transcription_router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok"}
