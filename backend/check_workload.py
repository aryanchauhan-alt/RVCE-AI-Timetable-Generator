#!/usr/bin/env python3
"""Check workload distribution"""

import os
from dotenv import load_dotenv
from supabase import create_client
from collections import Counter

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Fetch all timetable slots
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

# Count hours per faculty
faculty_hours = Counter()
for slot in all_slots:
    fid = slot.get("faculty_id", "")
    if fid and not fid.startswith("TBA"):
        faculty_hours[fid] += 1

print(f"Active faculty: {len(faculty_hours)}")
hours = list(faculty_hours.values())
print(f"Hours range: {min(hours)}-{max(hours)}")

# Distribution
hour_dist = Counter(hours)
print("Distribution:")
for h in sorted(hour_dist.keys()):
    print(f"  {h}h: {hour_dist[h]} faculty")
