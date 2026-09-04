from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from uploads import router as upload_router
from db import create_db_and_tables
from recovery import router as recovery_router


app = FastAPI(title="Revenue Recovery API")

create_db_and_tables()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(upload_router)
app.include_router(recovery_router, prefix="/api")


@app.get("/")
def home():
    return {"message": "Revenue Recovery API is running!"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}
