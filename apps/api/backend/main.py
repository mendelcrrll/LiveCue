from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.presentations import router as presentations_router

app = FastAPI(title="RT Presentation Feedback API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(presentations_router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok"}
