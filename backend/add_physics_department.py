"""
Script to add Physics department to Supabase
- Create Physics (PY) department
- Add faculty members for Physics department
- Move Physics Lab 1 and Physics Lab 2 rooms to Physics department
- Assign all PY* subjects to Physics department faculty
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

# Physics faculty names
PHYSICS_FACULTY = [
    "Dr. Ashok Kumar",
    "Dr. Bharat Sharma",
    "Dr. Chandra Mohan",
    "Dr. Divya Prakash",
    "Dr. Eswaran Iyer",
    "Dr. Fatima Khan",
    "Dr. Girish Nair",
    "Dr. Harini Reddy",
    "Dr. Indira Menon",
    "Dr. Jayakumar Das",
    "Dr. Kamala Devi",
    "Dr. Lakshmanan Rao",
    "Dr. Meenakshi Patel",
    "Dr. Narayanan Swamy",
    "Dr. Padmavathi Sharma",
    "Dr. Raghunath Iyer",
    "Dr. Sarojini Nair",
    "Dr. Thangam Krishnan",
    "Dr. Uma Shankar",
    "Dr. Venkatesan Reddy",
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
        for code in sorted(existing_depts.keys()):
            print(f"  {code}: {existing_depts[code]['department_name']}")
        
        # 2. Check PY subjects
        print("\n" + "=" * 60)
        print("Checking PY (Physics) subjects...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/subjects?select=subject_code,subject_name,department_id&subject_code=ilike.PY*", headers=headers)
        py_subjects = resp.json()
        if isinstance(py_subjects, list):
            print(f"Found {len(py_subjects)} PY subjects")
            for s in py_subjects[:10]:
                print(f"  {s['subject_code']}: {s['subject_name'][:50]}")
        else:
            print(f"PY subjects query error: {py_subjects}")
            py_subjects = []
        
        # 3. Add Physics department if not exists
        print("\n" + "=" * 60)
        if 'PY' not in existing_depts:
            print("Adding Physics department...")
            next_id = max([d['department_id'] for d in depts_list]) + 1
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/departments",
                headers=headers,
                json={"department_id": next_id, "department_code": "PY", "department_name": "Physics"}
            )
            if resp.status_code in [200, 201]:
                result = resp.json()
                py_dept_id = result[0]['department_id'] if result else next_id
                print(f"✅ Created Physics department with ID: {py_dept_id}")
            else:
                print(f"❌ Failed to create Physics department: {resp.text}")
                return
        else:
            py_dept_id = existing_depts['PY']['department_id']
            print(f"Physics department already exists with ID: {py_dept_id}")
        
        # 4. Add Physics faculty
        print("\n" + "=" * 60)
        print("Adding Physics faculty...")
        
        # Check existing faculty
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*&department=eq.PY", headers=headers)
        existing_faculty = resp.json() if resp.status_code == 200 else []
        
        if len(existing_faculty) >= 15:
            print(f"✅ Physics already has {len(existing_faculty)} faculty members")
        else:
            # Get next faculty ID
            resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=id&order=id.desc&limit=1", headers=headers)
            all_faculty = resp.json()
            # Extract numeric part from ID like "CSE-F001" -> 1
            max_num = 0
            for f in all_faculty:
                try:
                    num = int(f['id'].split('-F')[1]) if '-F' in f['id'] else 0
                    max_num = max(max_num, num)
                except:
                    pass
            
            faculty_to_add = []
            for i, name in enumerate(PHYSICS_FACULTY):
                faculty_id = f"PY-F{str(i+1).zfill(3)}"
                faculty_to_add.append({
                    "faculty_id": faculty_id,
                    "faculty_name": name,
                    "department": "PY",
                    "subject_codes": "",
                    "max_hours_per_week": 18
                })
            
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/faculty",
                headers=headers,
                json=faculty_to_add
            )
            if resp.status_code in [200, 201]:
                print(f"✅ Added {len(faculty_to_add)} Physics faculty members")
            else:
                print(f"❌ Failed to add faculty: {resp.text}")
        
        # 5. Update Physics Labs to PY department
        print("\n" + "=" * 60)
        print("Updating Physics Labs to PY department...")
        
        # Get all rooms and filter for Physics labs
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/rooms?select=*", headers=headers)
        all_rooms = resp.json() if resp.status_code == 200 else []
        physics_labs = [r for r in all_rooms if 'physics' in r.get('room_id', '').lower() or 'Physics' in r.get('room_id', '')]
        
        print(f"Found {len(physics_labs)} Physics labs")
        
        for lab in physics_labs:
            print(f"  Updating {lab['room_id']} from {lab.get('department', 'N/A')} to PY...")
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/rooms?id=eq.{lab['id']}",
                headers=headers,
                json={"department": "PY"}
            )
            if resp.status_code in [200, 204]:
                print(f"    ✅ Updated {lab['room_id']}")
            else:
                print(f"    ❌ Failed: {resp.text}")
        
        # 6. Assign PY subjects to Physics department and faculty
        print("\n" + "=" * 60)
        print("Assigning PY subjects to Physics department...")
        
        if py_subjects:
            # Update subjects department_id to PY department
            unique_py_codes = list(set([s['subject_code'] for s in py_subjects]))
            updated_subj_count = 0
            for code in unique_py_codes:
                resp = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/subjects?subject_code=eq.{code}",
                    headers=headers,
                    json={"department_id": py_dept_id}
                )
                if resp.status_code in [200, 204]:
                    updated_subj_count += 1
            print(f"✅ Updated {updated_subj_count}/{len(unique_py_codes)} unique PY subjects to Physics department")
            
            # Get Physics faculty and distribute subjects to them
            resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*&department=eq.PY", headers=headers)
            py_faculty = resp.json() if resp.status_code == 200 else []
            
            if py_faculty:
                # Distribute PY subjects among faculty
                faculty_subjects = {f['faculty_id']: [] for f in py_faculty}
                for i, code in enumerate(unique_py_codes):
                    faculty_id = py_faculty[i % len(py_faculty)]['faculty_id']
                    faculty_subjects[faculty_id].append(code)
                
                # Update each faculty's subject_codes
                updated_faculty_count = 0
                for faculty in py_faculty:
                    assigned = faculty_subjects.get(faculty['faculty_id'], [])
                    if assigned:
                        subject_codes_str = ",".join(assigned)
                        resp = await client.patch(
                            f"{SUPABASE_URL}/rest/v1/faculty?faculty_id=eq.{faculty['faculty_id']}",
                            headers=headers,
                            json={"subject_codes": subject_codes_str}
                        )
                        if resp.status_code in [200, 204]:
                            updated_faculty_count += 1
                            print(f"  ✅ {faculty['faculty_name']}: {subject_codes_str}")
                
                print(f"✅ Assigned subjects to {updated_faculty_count} Physics faculty members")
            else:
                print("❌ No Physics faculty found to assign subjects")
        
        # 7. Final Summary
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        
        # Re-check departments
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/departments?select=*", headers=headers)
        final_depts = resp.json()
        print(f"Total departments: {len(final_depts)}")
        
        # Check Physics faculty count
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=faculty_id&department=eq.PY", headers=headers)
        py_faculty_count = len(resp.json()) if resp.status_code == 200 else 0
        print(f"Physics faculty: {py_faculty_count}")
        
        # Check PY subjects
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/subjects?select=subject_code&subject_code=ilike.PY*", headers=headers)
        py_subj_count = len(resp.json()) if resp.status_code == 200 else 0
        print(f"PY subjects: {py_subj_count}")
        
        # Check Physics Labs
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/rooms?select=room_id,department&department=eq.PY", headers=headers)
        physics_labs_final = resp.json() if resp.status_code == 200 else []
        print(f"Physics Labs:")
        for lab in physics_labs_final:
            print(f"  {lab['room_id']}: {lab.get('department', 'N/A')}")
        
        print("\n✅ Physics department setup complete!")

if __name__ == "__main__":
    asyncio.run(main())
