#!/usr/bin/env python3
"""Quick verification of faculty-section locks"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Fetch all slots
all_slots = []
offset = 0
while True:
    result = supabase.table("timetable_slots").select("*").range(offset, offset + 999).execute()
    if not result.data:
        break
    all_slots.extend(result.data)
    if len(result.data) < 1000:
        break
    offset += 1000

print(f"Total slots: {len(all_slots)}")

# Track faculty -> (subject) -> set of sections
faculty_subject_sections = {}
section_subject_faculty = {}

for slot in all_slots:
    faculty_id = slot.get("faculty_id")
    subject = slot.get("subject_name", slot.get("subject", ""))
    section_id = slot.get("section_id")
    
    if not faculty_id or faculty_id.startswith("TBA"):
        continue
    
    # Faculty -> subject -> sections
    key1 = (faculty_id, subject)
    if key1 not in faculty_subject_sections:
        faculty_subject_sections[key1] = set()
    faculty_subject_sections[key1].add(section_id)
    
    # Section -> subject -> faculty
    key2 = (section_id, subject)
    if key2 not in section_subject_faculty:
        section_subject_faculty[key2] = set()
    section_subject_faculty[key2].add(faculty_id)

# Check violations
print("\n--- CONSTRAINT 1: Faculty teaches subject to ONE section ---")
v1 = [(k, list(v)) for k, v in faculty_subject_sections.items() if len(v) > 1]
print(f"Violations: {len(v1)}")
for (fid, subj), secs in v1[:15]:
    print(f"  {fid}: '{subj[:40]}' -> {len(secs)} sections: {secs}")

print("\n--- CONSTRAINT 2: Section has ONE faculty per subject ---")
v2 = [(k, list(v)) for k, v in section_subject_faculty.items() if len(v) > 1]
print(f"Violations: {len(v2)}")
for (sid, subj), facs in v2[:15]:
    print(f"  Section {sid}: '{subj[:40]}' -> {len(facs)} faculty: {facs}")

print(f"\nTOTAL VIOLATIONS: {len(v1) + len(v2)}")
