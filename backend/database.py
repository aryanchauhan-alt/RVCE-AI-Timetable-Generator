# backend/database.py

import os
from dotenv import load_dotenv
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# load .env
load_dotenv(override=True)

# For now, use SQLite for mock data. Later switch to Supabase PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rvce_timetable.db")
if DATABASE_URL.startswith("postgres") and "sslmode" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"

# DEBUG PRINT
print(f"DEBUG: SQLAlchemy connecting to: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")

engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL debugging
    pool_pre_ping=False,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency for FastAPI routes
def get_db() -> Generator[Session, None, None]:
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()