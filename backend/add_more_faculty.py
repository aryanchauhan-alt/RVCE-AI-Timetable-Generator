"""
Script to add more faculty to departments and distribute subjects evenly
Goal: Each department has at least 15 faculty, subjects distributed to reduce workload
"""

import httpx
import asyncio
import random

SUPABASE_URL = "https://mmkkmjsqrqwfkbazznaw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ta2ttanNxcnF3ZmtiYXp6bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjIwMTMsImV4cCI6MjA4MTY5ODAxM30.i197JgWC9Sz0VLmxFHj7YBP2WHkYHEpU-d22xP_Wkq0"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Faculty name templates for new hires
FIRST_NAMES = ["Ajay", "Vijay", "Sanjay", "Rajesh", "Suresh", "Ramesh", "Dinesh", "Ganesh", 
               "Priya", "Kavitha", "Sunita", "Anita", "Rekha", "Meena", "Seema", "Neha",
               "Ashok", "Vinod", "Manoj", "Arun", "Varun", "Tarun", "Nitin", "Sachin",
               "Deepa", "Shilpa", "Rupa", "Swati", "Jyoti", "Smita", "Archana", "Vandana"]

LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Reddy", "Nair", "Menon",
              "Iyer", "Rao", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Hegde", "Bhat",
              "Shetty", "Kamath", "Pai", "Prabhu", "Shenoy", "Gowda", "Murthy", "Prasad"]

TARGET_FACULTY_PER_DEPT = 20  # Aim for 20 faculty per department to distribute load

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. Get all current faculty
        print("=" * 60)
        print("Fetching current faculty...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*", headers=headers)
        all_faculty = resp.json()
        print(f"Total faculty in database: {len(all_faculty)}")
        
        # Group by department
        from collections import defaultdict
        dept_faculty = defaultdict(list)
        for f in all_faculty:
            dept_faculty[f['department']].append(f)
        
        print("\nCurrent faculty per department:")
        for dept in sorted(dept_faculty.keys()):
            print(f"  {dept}: {len(dept_faculty[dept])} faculty")
        
        # 2. Get all subjects grouped by department prefix
        print("\n" + "=" * 60)
        print("Fetching all subjects...")
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/subjects?select=subject_code,subject_name", headers=headers)
        all_subjects = resp.json()
        print(f"Total subjects: {len(all_subjects)}")
        
        # Group subjects by department code prefix (first 2-3 chars before number)
        dept_subjects = defaultdict(list)
        for s in all_subjects:
            code = s['subject_code']
            # Extract department prefix (e.g., "CSE" from "CSE301", "MA" from "MA101")
            prefix = ""
            for c in code:
                if c.isalpha():
                    prefix += c
                else:
                    break
            if prefix:
                dept_subjects[prefix].append(code)
        
        print("\nSubjects per department prefix:")
        for prefix in sorted(dept_subjects.keys()):
            print(f"  {prefix}: {len(dept_subjects[prefix])} subjects")
        
        # 3. Determine which departments need more faculty
        print("\n" + "=" * 60)
        print("Calculating faculty needs...")
        
        # Map subject prefixes to department codes
        prefix_to_dept = {
            'AE': 'AE', 'AIML': 'AIML', 'AI': 'AIML', 'ML': 'AIML',
            'BT': 'BT', 'CH': 'CH', 'CSE': 'CSE', 'CS': 'CSE',
            'CV': 'CV', 'CE': 'CV', 'CYS': 'CYS', 'ECE': 'ECE', 'EC': 'ECE',
            'EEE': 'EEE', 'EE': 'EEE', 'ETE': 'ETE', 'ET': 'ETE',
            'HS': 'HS', 'HSS': 'HSS', 'HU': 'HS',
            'IEM': 'IEM', 'IM': 'IEM', 'ISE': 'ISE', 'IS': 'ISE',
            'ME': 'ME', 'MA': 'MA', 'CDS': 'CDS', 'DS': 'CDS'
        }
        
        departments_to_add = {}
        for dept in sorted(set(dept_faculty.keys()) | set(prefix_to_dept.values())):
            current_count = len(dept_faculty.get(dept, []))
            needed = max(0, TARGET_FACULTY_PER_DEPT - current_count)
            if needed > 0:
                departments_to_add[dept] = needed
                print(f"  {dept}: has {current_count}, needs {needed} more")
        
        # 4. Add new faculty to departments that need them
        print("\n" + "=" * 60)
        print("Adding new faculty...")
        
        used_names = set(f['faculty_name'] for f in all_faculty)
        new_faculty_records = []
        
        for dept, count_needed in departments_to_add.items():
            existing_ids = [f['faculty_id'] for f in dept_faculty.get(dept, [])]
            # Find max ID number for this department
            max_num = 0
            for fid in existing_ids:
                try:
                    num = int(fid.split('-F')[-1])
                    max_num = max(max_num, num)
                except:
                    pass
            
            print(f"\n  Adding {count_needed} faculty to {dept}...")
            for i in range(count_needed):
                # Generate unique name
                attempts = 0
                while attempts < 100:
                    first = random.choice(FIRST_NAMES)
                    last = random.choice(LAST_NAMES)
                    name = f"Dr. {first} {last}"
                    if name not in used_names:
                        used_names.add(name)
                        break
                    attempts += 1
                
                max_num += 1
                faculty_id = f"{dept}-F{max_num:03d}"
                
                new_faculty_records.append({
                    "faculty_id": faculty_id,
                    "faculty_name": name,
                    "department": dept,
                    "subject_codes": "",  # Will be assigned later
                    "max_hours_per_week": 40
                })
        
        if new_faculty_records:
            print(f"\nInserting {len(new_faculty_records)} new faculty records...")
            # Insert in batches
            batch_size = 50
            for i in range(0, len(new_faculty_records), batch_size):
                batch = new_faculty_records[i:i+batch_size]
                resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/faculty",
                    headers=headers,
                    json=batch
                )
                if resp.status_code in [200, 201]:
                    print(f"  ✅ Inserted batch {i//batch_size + 1}")
                else:
                    print(f"  ❌ Error: {resp.status_code} - {resp.text[:200]}")
        
        # 5. Reload all faculty and distribute subjects evenly
        print("\n" + "=" * 60)
        print("Redistributing subjects among faculty...")
        
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*", headers=headers)
        all_faculty = resp.json()
        print(f"Total faculty now: {len(all_faculty)}")
        
        # Group by department again
        dept_faculty = defaultdict(list)
        for f in all_faculty:
            dept_faculty[f['department']].append(f)
        
        # For each department, distribute subjects evenly
        updates = []
        for dept, faculty_list in dept_faculty.items():
            # Get subjects for this department
            subjects = []
            for prefix, subj_list in dept_subjects.items():
                if prefix_to_dept.get(prefix) == dept or prefix == dept:
                    subjects.extend(subj_list)
            
            if not subjects or not faculty_list:
                continue
            
            # Distribute subjects round-robin
            random.shuffle(subjects)  # Randomize for even distribution
            faculty_count = len(faculty_list)
            
            # Calculate subjects per faculty
            subjects_per_faculty = max(3, len(subjects) // faculty_count)  # At least 3 subjects each
            
            print(f"\n  {dept}: {len(faculty_list)} faculty, {len(subjects)} subjects")
            print(f"    -> ~{subjects_per_faculty} subjects per faculty")
            
            for idx, fac in enumerate(faculty_list):
                # Assign subjects in round-robin fashion
                start_idx = idx * subjects_per_faculty
                end_idx = start_idx + subjects_per_faculty
                assigned = subjects[start_idx:end_idx] if start_idx < len(subjects) else []
                
                # Also wrap around if we have more faculty than subject groups
                if not assigned and subjects:
                    assigned = subjects[idx % len(subjects):idx % len(subjects) + 3]
                
                if assigned:
                    subject_codes = ",".join(assigned)
                    updates.append({
                        "id": fac['id'],
                        "subject_codes": subject_codes
                    })
        
        # Apply updates in batches
        if updates:
            print(f"\nUpdating {len(updates)} faculty with new subject assignments...")
            for i, upd in enumerate(updates):
                resp = await client.patch(
                    f"{SUPABASE_URL}/rest/v1/faculty?id=eq.{upd['id']}",
                    headers=headers,
                    json={"subject_codes": upd['subject_codes']}
                )
                if resp.status_code not in [200, 204]:
                    print(f"  ❌ Error updating faculty {upd['id']}: {resp.text[:100]}")
            print(f"  ✅ Updated {len(updates)} faculty")
        
        # 6. Final summary
        print("\n" + "=" * 60)
        print("FINAL SUMMARY")
        print("=" * 60)
        
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*", headers=headers)
        all_faculty = resp.json()
        
        dept_faculty = defaultdict(list)
        for f in all_faculty:
            dept_faculty[f['department']].append(f)
        
        print("\nFaculty count per department:")
        for dept in sorted(dept_faculty.keys()):
            count = len(dept_faculty[dept])
            status = '✅' if count >= 15 else '❌'
            print(f"  {dept}: {count} faculty {status}")
        
        print(f"\nTotal faculty: {len(all_faculty)}")
        print("\n✅ DONE! Faculty added and subjects distributed.")
        print("   Now restart the backend to reload faculty data.")

if __name__ == "__main__":
    asyncio.run(main())
