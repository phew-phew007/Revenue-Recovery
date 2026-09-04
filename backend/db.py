from sqlmodel import SQLModel, create_engine, Field
from typing import Optional
from datetime import datetime

sqlite_url = "sqlite:///./recovery.db"

engine = create_engine(sqlite_url, echo=False)


class Recovery(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    external_id: Optional[str]

    amount: Optional[float]

    currency: Optional[str]

    status: Optional[str]

    raw: Optional[str]


class RecoveryAction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    recovery_id: Optional[int]

    customer: Optional[str]

    action_type: Optional[str]

    amount: Optional[float]

    status: Optional[str]

    executed_at: Optional[datetime] = Field(default_factory=datetime.utcnow)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)