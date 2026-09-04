from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import create_db_and_tables
from .uploads import router as uploads_router

app = FastAPI(title="Revenue Recovery Backend")

# Allow Vite dev server origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/api/health")
def health():
    return {"status": "healthy"}


app.include_router(uploads_router, prefix="/api")
