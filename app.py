from ortools.sat.python import cp_model
import pandas as pd
import streamlit as st

# =============================
#  UI / BRANDING
# =============================

st.set_page_config(page_title="RVCE AI Timetable Generator", layout="wide")

st.markdown("""
<h1 style='text-align:center; color:#a80000;'>RV College of Engineering</h1>
<p style='text-align:center; font-size:18px;'>AI-Powered Automated Timetable Management System</p>
<hr style='border:1px solid #444;'>
""", unsafe_allow_html=True)


# =============================
#  LOAD DATA
# =============================

teachers_df = pd.read_csv("data/teachers.csv")
rooms_df = pd.read_csv("data/rooms.csv")
classes_df = pd.read_csv("data/classes.csv")

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
TIME_LABELS = [
    "09:00–10:00", "10:00–11:00", "11:00–12:00", "12:00–13:00",
    "13:00–14:00", "14:00–15:00", "15:00–16:00", "16:00–17:00"
]

num_days = len(DAYS)
num_slots = len(TIME_LABELS)

teacher_ids = teachers_df["TeacherID"].tolist()
sections = sorted(classes_df["Section"].unique().tolist())
room_ids = rooms_df["RoomID"].tolist()

num_classes = len(classes_df)
num_rooms = len(rooms_df)

teacher_max = dict(zip(teachers_df.TeacherID, teachers_df.MaxHours))

st.info(
    f"📘 Loaded **{len(teachers_df)} teachers**, **{len(rooms_df)} rooms**, "
    f"**{len(classes_df)} class entries**."
)

# =============================
#  NORMALIZATION STEP
#  (EXPLAIN IN DEMO: We pre-process data)
# =============================

# Labs use double time (2 hours)
classes_df.loc[classes_df["IsLab"] == "Yes", "WeeklyHours"] *= 2

# Clip weekly hours so no single subject demands more than the whole week
classes_df["WeeklyHours"] = classes_df["WeeklyHours"].clip(upper=40)

total_requested_hours = int(classes_df["WeeklyHours"].sum())

st.write(f"🧮 **Total teaching hours requested by all subjects:** `{total_requested_hours}` slots")

# =============================
#  BUILD MODEL (Decision Variables + Constraints)
# =============================

with st.expander("🔧 Step 1: Building the optimization model (variables + constraints)", expanded=False):
    st.write(
        """
We model the timetable as a **constraint satisfaction problem**:

- Decision variable `x[c, d, s, r]` is 1 if *class c* is scheduled on *(day d, slot s, room r)*.
- Constraints:
    - Subject hours ≤ required weekly hours
    - No teacher teaches two classes at the same time
    - No room hosts two classes at the same time
    - No section attends two classes at the same time
- Objective: **maximize** the total number of scheduled class slots.
        """
    )

model = cp_model.CpModel()
x = {}

# Decision variables
for c in range(num_classes):
    for d in range(num_days):
        for s in range(num_slots):
            for r in range(num_rooms):
                x[(c, d, s, r)] = model.NewBoolVar(f"x_{c}_{d}_{s}_{r}")

scheduled_count = 0

# Subject scheduling soft constraint: try to schedule up to WeeklyHours
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
                sum(x[(c, d, s, r)] for c in indices for r in range(num_rooms)) <= 1
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
                sum(x[(c, d, s, r)] for c in indices for r in range(num_rooms)) <= 1
            )

# Objective: maximize total scheduled sessions
model.Maximize(scheduled_count)


# =============================
#  SOLVE
# =============================

with st.spinner("🧠 Step 2: Solving timetable using Google OR-Tools (CP-SAT solver)..."):
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 12
    solver.parameters.num_search_workers = 8
    result = solver.Solve(model)

if result not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
    st.error("❌ Timetable could not be generated — current data is mathematically impossible to schedule.")
    st.stop()

st.success("✅ Timetable Generated Successfully using AI optimization!")

# =============================
#  CREATE TIMETABLE OUTPUT
# =============================

rows = []
for c in range(num_classes):
    for d in range(num_days):
        for s in range(num_slots):
            for r in range(num_rooms):
                if solver.Value(x[(c, d, s, r)]) == 1:
                    row = classes_df.iloc[c]
                    # optional: get teacher name if present
                    if "TeacherName" in teachers_df.columns:
                        t_name = teachers_df.loc[
                            teachers_df["TeacherID"] == row["TeacherID"], "TeacherName"
                        ].iloc[0]
                    else:
                        t_name = row["TeacherID"]
                    rows.append(
                        {
                            "Day": DAYS[d],
                            "Time Slot": TIME_LABELS[s],
                            "Room": room_ids[r],
                            "Teacher ID": row["TeacherID"],
                            "Teacher Name": t_name,
                            "Subject": row["SubjectName"],
                            "Department": row["Department"],
                            "Section": row["Section"],
                            "Year": row["Year"],
                            "Lab": row["IsLab"],
                        }
                    )

timetable_df = (
    pd.DataFrame(rows)
    .sort_values(["Day", "Time Slot", "Room"])
    .reset_index(drop=True)
)

total_scheduled = len(timetable_df)
st.write(
    f"📊 **Total scheduled slots:** `{total_scheduled}` "
    f"(out of requested `{total_requested_hours}` hours approx.)"
)

# =============================
#  DISPLAY TABS
# =============================

tab_all, tab_teacher, tab_section, tab_room = st.tabs(
    ["📋 Master Timetable", "👩‍🏫 Teacher View", "🎓 Section View", "🏫 Room View"]
)

with tab_all:
    st.subheader("📋 Full Timetable")
    st.dataframe(timetable_df, use_container_width=True)

with tab_teacher:
    st.subheader("👩‍🏫 View by Teacher")
    teacher_sel = st.selectbox("Select Teacher ID", teacher_ids)
    teacher_table = timetable_df[timetable_df["Teacher ID"] == teacher_sel].sort_values(
        ["Day", "Time Slot"]
    )
    if teacher_table.empty:
        st.warning("This teacher has no scheduled classes in the current solution.")
    else:
        st.write(
            f"Timetable for **{teacher_sel}** "
            f"({teacher_table['Teacher Name'].iloc[0]})"
        )
        st.dataframe(teacher_table, use_container_width=True)

with tab_section:
    st.subheader("🎓 View by Section")
    sec_sel = st.selectbox("Select Section", sections)
    sec_table = timetable_df[timetable_df["Section"] == sec_sel].sort_values(
        ["Day", "Time Slot"]
    )
    if sec_table.empty:
        st.warning("This section has no scheduled classes in the current solution.")
    else:
        st.write(f"Timetable for **Section {sec_sel}**")
        st.dataframe(sec_table, use_container_width=True)

with tab_room:
    st.subheader("🏫 View by Room")
    room_sel = st.selectbox("Select Room", room_ids)
    room_table = timetable_df[timetable_df["Room"] == room_sel].sort_values(
        ["Day", "Time Slot"]
    )
    if room_table.empty:
        st.warning("This room is not used in the current solution.")
    else:
        st.write(f"Timetable for **Room {room_sel}**")
        st.dataframe(room_table, use_container_width=True)

# =============================
#  DOWNLOAD BUTTON
# =============================

st.download_button(
    "⬇ Download Timetable CSV",
    timetable_df.to_csv(index=False),
    "RVCE_Timetable.csv",
)