"""
Script to add Mathematics and Humanities departments to Supabase
and create faculty members for these departments
"""

import httpx
import asyncio

SUPABASE_URL = "https://mmkkmjsqrqwfkbazznaw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ta2ttanNxcnF3ZmtiYXp6bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjIwMTMsImV4cCI6MjA4MTY5ODAxM30.i197JgWC9Sz0VLmxFHj7YBP2WHkYHEpU-d22xP_Wkq0"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Mathematics faculty names
MATH_FACULTY = [
    "Dr. Ramesh Kumar",
    "Dr. Suresh Sharma",
    "Dr. Meena Rao",
    "Dr. Anita Deshmukh",
    "Dr. Vijay Iyer",
    "Dr. Priya Nair",
    "Dr. Sanjay Gupta",
    "Dr. Lakshmi Menon",
    "Dr. Ravi Shankar",
    "Dr. Kavitha Reddy",
    "Dr. Mohan Das",
    "Dr. Sunita Patel",
    "Dr. Arun Kumar",
    "Dr. Geeta Sharma",
    "Dr. Prakash Rao",
]

# Humanities faculty names
HS_FACULTY = [
    "Dr. Anand Murthy",
    "Dr. Shalini Verma",
    "Dr. Raghav Menon",
    "Dr. Deepa Krishnan",
    "Dr. Venkat Rao",
    "Dr. Rekha Iyer",
    "Dr. Sunil Nair",
    "Dr. Padma Sharma",
    "Dr. Kiran Kumar",
    "Dr. Manjula Reddy",
    "Dr. Anil Desai",
    "Dr. Uma Devi",
]

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Check existing departments
        print("=" * 60)
        print("Checking existing departments...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/departments?select=*", headers=headers)
        depts_list = resp.json()
        existing_depts = {d['department_code']: d for d in depts_list}
        print(f"Found {len(existing_depts)} departments")
        for code, dept in existing_depts.items():
            print(f"  {code}: {dept['department_name']}")
        
        # 2. Check MA and HS subjects
        print("\n" + "=" * 60)
        print("Checking MA subjects...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/subjects?select=subject_code,subject_name,department_id&subject_code=ilike.MA*", headers=headers)
        ma_subjects = resp.json()
        if isinstance(ma_subjects, list):
            print(f"Found {len(ma_subjects)} MA subjects")
            for s in ma_subjects[:5]:
                print(f"  {s['subject_code']}: {s['subject_name'][:50]}")
        else:
            print(f"MA subjects query error: {ma_subjects}")
            ma_subjects = []
        
        print("\nChecking HS subjects...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/subjects?select=subject_code,subject_name,department_id&subject_code=ilike.HS*", headers=headers)
        hs_subjects = resp.json()
        if isinstance(hs_subjects, list):
            print(f"Found {len(hs_subjects)} HS subjects")
            for s in hs_subjects[:5]:
                print(f"  {s['subject_code']}: {s['subject_name'][:50]}")
        else:
            print(f"HS subjects query error: {hs_subjects}")
            hs_subjects = []
        
        # 3. Add Mathematics department if not exists
        print("\n" + "=" * 60)
        if 'MA' not in existing_depts:
            print("Adding Mathematics department...")
            next_id = max([d['department_id'] for d in depts_list]) + 1
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/departments",
                headers=headers,
                json={"department_id": next_id, "department_code": "MA", "department_name": "Mathematics"}
            )
            if resp.status_code in [200, 201]:
                print("✅ Mathematics department added")
            else:
                print(f"❌ Failed to add MA dept: {resp.text}")
        else:
            print("Mathematics department already exists")
        
        # 4. Add Humanities department if not exists
        if 'HS' not in existing_depts:
            print("Adding Humanities department...")
            next_id = max([d['department_id'] for d in depts_list]) + 2
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/departments",
                headers=headers,
                json={"department_id": next_id, "department_code": "HS", "department_name": "Humanities and Social Sciences"}
            )
            if resp.status_code in [200, 201]:
                print("✅ Humanities department added")
            else:
                print(f"❌ Failed to add HS dept: {resp.text}")
        else:
            print("Humanities department already exists")
        
        # 5. Check existing faculty
        print("\n" + "=" * 60)
        print("Checking existing faculty...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=id,faculty_id,faculty_name,department", headers=headers)
        all_faculty = resp.json()
        existing_faculty_names = {f['faculty_name'] for f in all_faculty}
        ma_faculty = [f for f in all_faculty if f.get('department') == 'MA']
        hs_faculty_existing = [f for f in all_faculty if f.get('department') == 'HS']
        print(f"Total faculty: {len(all_faculty)}")
        print(f"MA faculty: {len(ma_faculty)}")
        print(f"HS faculty: {len(hs_faculty_existing)}")
        
        # 6. Add Mathematics faculty
        print("\n" + "=" * 60)
        print("Adding Mathematics faculty...")
        added_ma = 0
        for i, name in enumerate(MATH_FACULTY):
            if name not in existing_faculty_names:
                faculty_id = f"MA-F{str(i+1).zfill(3)}"
                resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/faculty",
                    headers=headers,
                    json={
                        "faculty_id": faculty_id,
                        "faculty_name": name,
                        "department": "MA",
                        "subject_codes": "",
                        "max_hours_per_week": 18
                    }
                )
                if resp.status_code in [200, 201]:
                    added_ma += 1
                    print(f"  ✅ Added {name}")
                else:
                    print(f"  ❌ Failed to add {name}: {resp.text[:100]}")
            else:
                print(f"  ⏭️ {name} already exists")
        print(f"Added {added_ma} MA faculty")
        
        # 7. Add Humanities faculty
        print("\n" + "=" * 60)
        print("Adding Humanities faculty...")
        added_hs = 0
        for i, name in enumerate(HS_FACULTY):
            if name not in existing_faculty_names:
                faculty_id = f"HS-F{str(i+1).zfill(3)}"
                resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/faculty",
                    headers=headers,
                    json={
                        "faculty_id": faculty_id,
                        "faculty_name": name,
                        "department": "HS",
                        "subject_codes": "",
                        "max_hours_per_week": 18
                    }
                )
                if resp.status_code in [200, 201]:
                    added_hs += 1
                    print(f"  ✅ Added {name}")
                else:
                    print(f"  ❌ Failed to add {name}: {resp.text[:100]}")
            else:
                print(f"  ⏭️ {name} already exists")
        print(f"Added {added_hs} HS faculty")
        
        # 8. Get updated MA faculty and assign subjects
        print("\n" + "=" * 60)
        print("Assigning MA subjects to MA faculty...")
        
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=id,faculty_id,faculty_name,subject_codes&department=eq.MA", headers=headers)
        ma_faculty_list = resp.json()
        
        if ma_faculty_list and ma_subjects:
            ma_subject_codes = [s['subject_code'] for s in ma_subjects]
            subjects_per_faculty = max(3, len(ma_subject_codes) // len(ma_faculty_list) + 1)
            
            for i, faculty in enumerate(ma_faculty_list):
                start_idx = (i * subjects_per_faculty) % len(ma_subject_codes)
                assigned = []
                for j in range(subjects_per_faculty):
                    idx = (start_idx + j) % len(ma_subject_codes)
                    assigned.append(ma_subject_codes[idx])
                
                assigned = list(set(assigned))
                subject_codes_str = ",".join(assigned)
                
                resp = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/faculty?id=eq.{faculty['id']}",
                    headers=headers,
                    json={"subject_codes": subject_codes_str}
                )
                if resp.status_code in [200, 204]:
                    print(f"  ✅ {faculty['faculty_name']}: {len(assigned)} subjects")
        
        # 9. Get updated HS faculty and assign subjects
        print("\nAssigning HS subjects to HS faculty...")
        
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=id,faculty_id,faculty_name,subject_codes&department=eq.HS", headers=headers)
        hs_faculty_list = resp.json()
        
        if hs_faculty_list and hs_subjects:
            hs_subject_codes = [s['subject_code'] for s in hs_subjects]
            subjects_per_faculty = max(3, len(hs_subject_codes) // len(hs_faculty_list) + 1)
            
            for i, faculty in enumerate(hs_faculty_list):
                start_idx = (i * subjects_per_faculty) % len(hs_subject_codes)
                assigned = []
                for j in range(subjects_per_faculty):
                    idx = (start_idx + j) % len(hs_subject_codes)
                    assigned.append(hs_subject_codes[idx])
                
                assigned = list(set(assigned))
                subject_codes_str = ",".join(assigned)
                
                resp = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/faculty?id=eq.{faculty['id']}",
                    headers=headers,
                    json={"subject_codes": subject_codes_str}
                )
                if resp.status_code in [200, 204]:
                    print(f"  ✅ {faculty['faculty_name']}: {len(assigned)} subjects")
        
        # 10. Remove MA/HS subjects from other department faculty
        print("\n" + "=" * 60)
        print("Removing MA/HS subjects from other department faculty...")
        
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=id,faculty_name,department,subject_codes&department=neq.MA&department=neq.HS", headers=headers)
        other_faculty = resp.json()
        
        ma_codes = set(s['subject_code'] for s in ma_subjects) if ma_subjects else set()
        hs_codes = set(s['subject_code'] for s in hs_subjects) if hs_subjects else set()
        all_special_codes = ma_codes | hs_codes
        
        updated_count = 0
        for faculty in other_faculty:
            if not faculty.get('subject_codes'):
                continue
            
            current_codes = [c.strip() for c in faculty['subject_codes'].split(',') if c.strip()]
            filtered_codes = [c for c in current_codes if c not in all_special_codes]
            
            if len(filtered_codes) != len(current_codes):
                new_codes_str = ",".join(filtered_codes)
                resp = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/faculty?id=eq.{faculty['id']}",
                    headers=headers,
                    json={"subject_codes": new_codes_str}
                )
                if resp.status_code in [200, 204]:
                    updated_count += 1
        
        print(f"  Updated {updated_count} faculty members (removed MA/HS subjects)")
        
        print("\n" + "=" * 60)
        print("✅ DONE! Mathematics and Humanities departments set up.")
        print("   - No classrooms added for these departments (as requested)")
        print("   - Faculty added and assigned to respective subjects")
        print("   - MA/HS subjects removed from other department faculty")

if __name__ == "__main__":
    asyncio.run(main())
