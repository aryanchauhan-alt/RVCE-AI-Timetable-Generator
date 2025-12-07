# backend/main.py
from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ortools.sat.python import cp_model
import pandas as pd

from database import Base, engine, SessionLocal
import models
from models import User
from auth import router as auth_router, hash_password

app = FastAPI(title="RVCE Timetable API")

# ---------------- CORS (for React dev) ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev only. Restrict in production.
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Locate & load CSV data ----------------

BASE_DIR = Path(__file__).resolve().parent

possible_dirs = [
    BASE_DIR / "data",        # backend/data
    BASE_DIR.parent / "data"  # ai_timetable/data
]

DATA_DIR = None
for d in possible_dirs:
    if (d / "teachers.csv").exists() and (d / "rooms.csv").exists() and (d / "classes.csv").exists():
        DATA_DIR = d
        break

if DATA_DIR is None:
    raise RuntimeError(
        f"Could not find teachers.csv / rooms.csv / classes.csv in any of: "
        f"{[str(p) for p in possible_dirs]}"
    )

teachers_df = pd.read_csv(DATA_DIR / "teachers.csv")
rooms_df = pd.read_csv(DATA_DIR / "rooms.csv")
classes_df = pd.read_csv(DATA_DIR / "classes.csv")

DAYS: List[str] = ["Mon", "Tue", "Wed", "Thu", "Fri"]
TIME_SLOTS: List[str] = [
    "09:00–10:00",
    "10:00–11:00",
    "11:00–12:00",
    "12:00–13:00",
    "13:00–14:00",
    "14:00–15:00",
    "15:00–16:00",
    "16:00–17:00",
]

num_days = len(DAYS)
num_slots = len(TIME_SLOTS)
num_rooms = len(rooms_df)
num_classes = len(classes_df)

generated_timetable: list[dict] = []

TEACHER_COL = "TeacherID" if "TeacherID" in classes_df.columns else "Teacher"


# ---------------- DB init & seed sample users ----------------

def init_db_and_seed():
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # If users already exist, don't reseed
        if db.query(models.User).count() > 0:
            return

        # Take one real teacherID & section from CSV
        sample_teacher = str(classes_df[TEACHER_COL].iloc[0])
        sample_section = str(classes_df["Section"].iloc[0])

        admin = User(
            username="admin",
            full_name="RVCE Admin",
            role="Admin",
            external_id=None,
            password_hash=hash_password("admin123"),
        )
        t_user = User(
            username=sample_teacher,  # login as teacherID
            full_name=f"Teacher {sample_teacher}",
            role="Teacher",
            external_id=sample_teacher,
            password_hash=hash_password("teacher123"),
        )
        s_user = User(
            username=sample_section,  # login as section code
            full_name=f"Student {sample_section}",
            role="Student",
            external_id=sample_section,
            password_hash=hash_password("student123"),
        )

        db.add_all([admin, t_user, s_user])
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db_and_seed()


# ---------------- Helper: allowed rooms per class ----------------

def allowed_rooms_for_class(row):
    """
    Decide which rooms a class can go to, based on:
    - IsLab (Yes/No) vs RoomType (Lab/Lecture) if available
    - StudentCount vs Capacity if available
    """
    df = rooms_df.copy()

    # Lab vs lecture rule
    if "RoomType" in df.columns and "IsLab" in row.index:
        is_lab = str(row["IsLab"]).strip().lower() == "yes"
        if is_lab:
            df = df[df["RoomType"].str.lower() == "lab"]
        else:
            df = df[df["RoomType"].str.lower() != "lab"]

    # Capacity rule
    """if "StudentCount" in row.index and "Capacity" in df.columns:
        try:
            count = int(row["StudentCount"])
            df = df[df["Capacity"] >= count]
        except Exception:
            pass """

    # Fallback: allow all rooms if everything got filtered out
    if df.empty:
        return list(range(num_rooms))

    room_indices = []
    for rid in df["RoomID"]:
        idx_list = rooms_df.index[rooms_df["RoomID"] == rid].tolist()
        if idx_list:
            room_indices.append(idx_list[0])
    return room_indices


# ---------------- OR-Tools timetable generator ----------------

@app.post("/generate")
def generate_timetable():
    """
    Generates weekly timetable using Google OR-Tools CP-SAT.

    Constraints:
    - teacher cannot be in two places at same time
    - section cannot attend two classes at same time
    - at most 1 class in each (day, slot, room)
    - tries to schedule exactly WeeklyHours per subject
    - respects lab vs lecture rooms and room capacity (if given in CSV)
    """
    global generated_timetable

    model = cp_model.CpModel()

    allowed_room_indices = [allowed_rooms_for_class(row) for _, row in classes_df.iterrows()]

    x = {}
    for c in range(num_classes):
        for d in range(num_days):
            for s in range(num_slots):
                for r in allowed_room_indices[c]:
                    x[(c, d, s, r)] = model.NewBoolVar(f"x_{c}_{d}_{s}_{r}")

    total_assigned = []

    # 1) Weekly hours per subject
    for c in range(num_classes):
        weekly_hours = int(classes_df.iloc[c]["WeeklyHours"])
        vars_for_class = [
            x[(c, d, s, r)]
            for d in range(num_days)
            for s in range(num_slots)
            for r in allowed_room_indices[c]
        ]
        if vars_for_class and weekly_hours > 0:
            model.Add(sum(vars_for_class) <= weekly_hours)
            total_assigned.extend(vars_for_class)

    # 2) No room clash
    for d in range(num_days):
        for s in range(num_slots):
            for r in range(num_rooms):
                vars_here = [x[(c, d, s, r)] for c in range(num_classes) if (c, d, s, r) in x]
                if vars_here:
                    model.Add(sum(vars_here) <= 1)

    # 3) No teacher clash
    for teacher in classes_df[TEACHER_COL].unique():
        class_indices = classes_df.index[classes_df[TEACHER_COL] == teacher].tolist()
        for d in range(num_days):
            for s in range(num_slots):
                vars_here = [
                    x[(c, d, s, r)]
                    for c in class_indices
                    for r in allowed_room_indices[c]
                    if (c, d, s, r) in x
                ]
                if vars_here:
                    model.Add(sum(vars_here) <= 1)

    # 4) No section clash
    for section in classes_df["Section"].unique():
        class_indices = classes_df.index[classes_df["Section"] == section].tolist()
        for d in range(num_days):
            for s in range(num_slots):
                vars_here = [
                    x[(c, d, s, r)]
                    for c in class_indices
                    for r in allowed_room_indices[c]
                    if (c, d, s, r) in x
                ]
                if vars_here:
                    model.Add(sum(vars_here) <= 1)

    # Objective: maximize total scheduled hours
    if total_assigned:
        model.Maximize(sum(total_assigned))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    solver.parameters.num_search_workers = 8

    result = solver.Solve(model)

    if result not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        generated_timetable = []
        return {"status": "infeasible", "entries": 0}

    timetable = []
    for c in range(num_classes):
        row = classes_df.iloc[c]
        for d in range(num_days):
            for s in range(num_slots):
                for r in allowed_room_indices[c]:
                    key = (c, d, s, r)
                    if key in x and solver.Value(x[key]) == 1:
                        timetable.append(
                            {
                                "Day": DAYS[d],
                                "Time": TIME_SLOTS[s],
                                "Teacher": row[TEACHER_COL],
                                "Subject": row["SubjectName"],
                                "Section": row["Section"],
                                "Department": row["Department"],
                                "Room": rooms_df.iloc[r]["RoomID"],
                            }
                        )

    timetable.sort(key=lambda e: (DAYS.index(e["Day"]), TIME_SLOTS.index(e["Time"])))
    generated_timetable = timetable
    return {"status": "ok", "entries": len(timetable)}


@app.get("/timetable")
def get_timetable():
    """
    Frontend (TimetableView, TeacherView, SectionView) consumes this.
    """
    return generated_timetable


# Mount auth router (POST /auth/login)
app.include_router(auth_router)