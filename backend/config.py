# backend/config.py

import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rvce_timetable.db")

# JWT Auth (for now, will migrate to Supabase later)
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

# Supabase (for future migration)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# Timetable Settings
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
TIME_SLOTS = [
    "09:00–10:00",
    "10:00–11:00",
    "11:00–12:00",
    "12:00–13:00",
    "13:00–14:00",
    "14:00–15:00",
    "15:00–16:00",
    "16:00–17:00",
]

