# backend/models.py
from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # "Admin" | "Teacher" | "Student"
    external_id = Column(String(50), nullable=True)  # TeacherID or Section
    password_hash = Column(String(128), nullable=False)