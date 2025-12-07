# backend/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User
import hashlib
import jwt
import os

router = APIRouter(prefix="/auth", tags=["auth"])

# Use env var in production
SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-key-change-me")
ALGORITHM = "HS256"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    role: str
    external_id: Optional[str]


def hash_password(password: str) -> str:
    """Simple SHA-256 hash. Good enough for this project demo."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    payload = {
        "sub": user.username,
        "role": user.role,
        "external_id": user.external_id,
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return LoginResponse(
        token=token,
        role=user.role,
        external_id=user.external_id,
    )