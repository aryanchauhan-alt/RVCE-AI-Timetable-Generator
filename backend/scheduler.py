from ortools.sat.python import cp_model
import pandas as pd

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
TIME_LABELS = [
    "09:00–10:00", "10:00–11:00", "11:00–12:00", "12:00–13:00",
    "13:00–14:00", "14:00–15:00", "15:00–16:00", "16:00–17:00"
]

def generate_timetable():
    """
    Core AI logic:
    - reads CSVs from ../data
    - builds OR-Tools model
    - returns timetable as a list of dicts (JSON-serializable)
    """

    teachers_df = pd.read_csv("../data/teachers.csv")
    rooms_df = pd.read_csv("../data/rooms.csv")
    classes_df = pd.read_csv("../data/classes.csv")

    num_days = len(DAYS)
    num_slots = len(TIME_LABELS)

    teacher_ids = teachers_df["TeacherID"].tolist()
    sections = sorted(classes_df["Section"].unique().tolist())
    room_ids = rooms_df["RoomID"].tolist()

    num_classes = len(classes_df)
    num_rooms = len(rooms_df)

    # ---------- NORMALIZATION ----------
    classes_df.loc[classes_df["IsLab"] == "Yes", "WeeklyHours"] *= 2
    classes_df["WeeklyHours"] = classes_df["WeeklyHours"].clip(upper=40)

    # ---------- BUILD MODEL ----------
    model = cp_model.CpModel()
    x = {}

    for c in range(num_classes):
        for d in range(num_days):
            for s in range(num_slots):
                for r in range(num_rooms):
                    x[(c, d, s, r)] = model.NewBoolVar(f"x_{c}_{d}_{s}_{r}")

    scheduled_count = 0

    # Subject hours (soft, ≤ WeeklyHours)
    for c in range(num_classes):
        req_hours = int(classes_df.iloc[c]["WeeklyHours"])
        assigned = sum(
            x[(c, d, s, r)]
            for d in range(num_days)
            for s in range(num_slots)
            for r in range(num_rooms)
        )
        model.Add(assigned <= req_hours)
        scheduled_count += assigned

    # No teacher conflict
    for teacher in teacher_ids:
        indices = classes_df.index[classes_df.TeacherID == teacher].tolist()
        for d in range(num_days):
            for s in range(num_slots):
                model.Add(
                    sum(x[(c, d, s, r)] for c in indices for r in range(num_rooms))
                    <= 1
                )

    # No room conflict
    for d in range(num_days):
        for s in range(num_slots):
            for r in range(num_rooms):
                model.Add(
                    sum(x[(c, d, s, r)] for c in range(num_classes)) <= 1
                )

    # No section conflict
    for sec in sections:
        indices = classes_df.index[classes_df.Section == sec].tolist()
        for d in range(num_days):
            for s in range(num_slots):
                model.Add(
                    sum(x[(c, d, s, r)] for c in indices for r in range(num_rooms))
                    <= 1
                )

    # Maximize total scheduled slots
    model.Maximize(scheduled_count)

    # ---------- SOLVE ----------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 12
    solver.parameters.num_search_workers = 8

    result = solver.Solve(model)

    if result not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        # Return empty + message; frontend can show error
        return {
            "status": "infeasible",
            "message": "No feasible timetable with current data.",
            "timetable": []
        }

    # ---------- BUILD RESULT ----------
    rows = []
    for c in range(num_classes):
        for d in range(num_days):
            for s in range(num_slots):
                for r in range(num_rooms):
                    if solver.Value(x[(c, d, s, r)]) == 1:
                        row = classes_df.iloc[c]
                        rows.append(
                            {
                                "day": DAYS[d],
                                "time_slot": TIME_LABELS[s],
                                "room": room_ids[r],
                                "teacher_id": row["TeacherID"],
                                "subject": row["SubjectName"],
                                "department": row["Department"],
                                "section": row["Section"],
                                "year": int(row["Year"]),
                                "is_lab": row["IsLab"],
                            }
                        )

    return {
        "status": "ok",
        "message": "Timetable generated successfully",
        "timetable": rows,
    }

# small test: run from terminal -> python3 scheduler.py
if __name__ == "__main__":
    result = generate_timetable()
    print(result["status"], " | slots scheduled:", len(result["timetable"]))