import pandas as pd
import random
import os

random.seed(42)

# Make data folder
os.makedirs("data", exist_ok=True)

departments = ["CSE", "ECE", "ME", "CIVIL", "ISE", "AIML", "EEE", "BT"]
years = [1, 2, 3, 4]
section_letters = ["A", "B"]  # 2 sections per year per dept -> 8*4*2 = 64 sections

# ---------------- TEACHERS ----------------
teachers = []
tid = 1
for dept in departments:
    for i in range(1, 13):  # 12 teachers per dept -> 96
        teachers.append({
            "TeacherID": f"T{tid:03d}",
            "TeacherName": f"Dr. {dept} Faculty {i}",
            "Department": dept,
            "MaxHours": random.choice([38, 40, 42, 45]),
            "ElectiveEligible": random.choice(["Yes", "No"])
        })
        tid += 1

# A few common Maths/Physics teachers
for i in range(1, 5):
    teachers.append({
        "TeacherID": f"T{tid:03d}",
        "TeacherName": f"Dr. Science Faculty {i}",
        "Department": "BASIC-SCI",
        "MaxHours": random.choice([38, 40, 42]),
        "ElectiveEligible": "No",
    })
    tid += 1

teachers_df = pd.DataFrame(teachers)
teachers_df.to_csv("data/teachers.csv", index=False)

# ---------------- ROOMS ----------------
rooms = []
# 3 lecture + 2 labs per department -> 5 * 8 = 40 rooms
for dept in departments:
    building = f"{dept}-Block"
    # lectures
    for i in range(1, 4):
        rooms.append({
            "RoomID": f"{dept}-L{i:02d}",
            "Building": building,
            "RoomType": "Lecture",
            "Capacity": random.choice([60, 70, 80])
        })
    # labs
    for i in range(1, 3):
        rooms.append({
            "RoomID": f"{dept}-LAB{i}",
            "Building": building,
            "RoomType": "Lab",
            "Capacity": random.choice([40, 50, 60])
        })

# One big common auditorium
rooms.append({
    "RoomID": "AUD-1",
    "Building": "Common-Block",
    "RoomType": "Auditorium",
    "Capacity": 250
})

rooms_df = pd.DataFrame(rooms)
rooms_df.to_csv("data/rooms.csv", index=False)

# ---------------- CLASSES (SUBJECTS) ----------------

sections = []
for dept in departments:
    for y in years:
        for sec in section_letters:
            sections.append({
                "Department": dept,
                "Year": y,
                "Section": f"{y}{sec}"
            })

teacher_remaining = {t["TeacherID"]: t["MaxHours"] for t in teachers}

classes = []
scode_counter = 1

for sec in sections:
    dept = sec["Department"]
    year = sec["Year"]
    section_name = sec["Section"]

    num_subjects = 3  # per section
    for j in range(num_subjects):
        hours = random.choice([3, 4])  # weekly hours for this subject
        # pick teacher from same dept (or basic-sci for 1st year)
        possible_teachers = [t for t in teachers if
                             (t["Department"] == dept or (year == 1 and t["Department"] == "BASIC-SCI"))
                             and teacher_remaining[t["TeacherID"]] >= hours]

        if not possible_teachers:
            continue  # skip if no teacher has hours left

        t = random.choice(possible_teachers)
        teacher_remaining[t["TeacherID"]] -= hours

        is_lab = "Yes" if random.random() < 0.25 else "No"
        elective_group = "AIE" if (year >= 3 and random.random() < 0.3) else "None"

        subject_code = f"{dept[:2]}{year}{scode_counter:03d}"
        subject_name = f"{dept} Subject Y{year}-{j+1}"

        classes.append({
            "SubjectCode": subject_code,
            "SubjectName": subject_name,
            "TeacherID": t["TeacherID"],
            "Department": dept,
            "Section": section_name,
            "Year": year,
            "IsLab": is_lab,
            "WeeklyHours": hours,
            "ElectiveGroup": elective_group,
            "StudentCount": random.randint(45, 80)
        })

        scode_counter += 1

classes_df = pd.DataFrame(classes)
classes_df.to_csv("data/classes.csv", index=False)

print("Generated:")
print(" - data/teachers.csv  (", len(teachers_df), "teachers )")
print(" - data/rooms.csv     (", len(rooms_df), "rooms )")
print(" - data/classes.csv   (", len(classes_df), "subjects )")
