#!/usr/bin/env python3
"""
Fix Faculty Subject Mappings and Add More Faculty
==================================================
This script:
1. Analyzes current faculty workload distribution
2. Redistributes subject mappings to balance workload
3. Adds additional faculty where needed
4. Ensures every subject has at least 2-3 faculty who can teach it
"""

import requests
import json
from collections import defaultdict
import random

SUPABASE_URL = "https://mmkkmjsqrqwfkbazznaw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ta2ttanNxcnF3ZmtiYXp6bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjIwMTMsImV4cCI6MjA4MTY5ODAxM30.i197JgWC9Sz0VLmxFHj7YBP2WHkYHEpU-d22xP_Wkq0"
headers = {"apikey": SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal"}

def fetch_data():
    """Fetch all data from Supabase"""
    subjects = requests.get(f"{SUPABASE_URL}/rest/v1/subjects?select=*&limit=1000", headers=headers).json()
    faculty = requests.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*&limit=300", headers=headers).json()
    return subjects, faculty

def analyze_current_state(subjects, faculty):
    """Analyze current subject mappings and faculty workload"""
    print("\n" + "="*60)
    print("CURRENT STATE ANALYSIS")
    print("="*60)
    
    # Build subject map
    subject_map = {s['subject_code']: s for s in subjects}
    
    # Analyze faculty mappings
    faculty_subject_count = defaultdict(int)
    subject_faculty_count = defaultdict(list)
    faculty_hours = defaultdict(int)
    
    for f in faculty:
        codes = f.get('subject_codes', '')
        code_list = [c.strip() for c in codes.split(',') if c.strip()] if codes else []
        faculty_subject_count[f['faculty_id']] = len(code_list)
        
        for code in code_list:
            subject_faculty_count[code].append(f['faculty_id'])
            if code in subject_map:
                s = subject_map[code]
                hours = (s.get('theory_hours', 0) or 0) + (s.get('lab_hours', 0) or 0)
                faculty_hours[f['faculty_id']] += hours
    
    # Find subjects without faculty
    subjects_without_faculty = []
    for s in subjects:
        if s['subject_code'] not in subject_faculty_count:
            subjects_without_faculty.append(s)
    
    print(f"\nSubjects without any faculty: {len(subjects_without_faculty)}")
    for s in subjects_without_faculty[:10]:
        dept = s.get('department', 'Unknown')
        if not dept:
            # Get department from department_id mapping
            dept_id = s.get('department_id', 0)
            dept_map = {5: 'CSE', 10: 'ECE', 14: 'ME', 11: 'EEE', 6: 'ISE', 1: 'AIML', 
                        4: 'CYS', 3: 'CDS', 2: 'BT', 8: 'CH', 9: 'CV', 7: 'IEM', 12: 'ETE', 13: 'AE', 15: 'HS', 16: 'HSS'}
            dept = dept_map.get(dept_id, 'Unknown')
        print(f"  - {s['subject_code']}: {s['subject_name'][:40]} (Dept {dept} Sem {s.get('semester', '?')})")
    
    # Find subjects with only 1 faculty
    subjects_single_faculty = [code for code, facs in subject_faculty_count.items() if len(facs) == 1]
    print(f"\nSubjects with only 1 faculty: {len(subjects_single_faculty)}")
    
    # Faculty by department
    print("\nFaculty count by department:")
    dept_faculty = defaultdict(list)
    for f in faculty:
        dept_faculty[f['department']].append(f)
    for dept in sorted(dept_faculty.keys()):
        print(f"  {dept}: {len(dept_faculty[dept])} faculty")
    
    return {
        'subject_map': subject_map,
        'subject_faculty_count': subject_faculty_count,
        'faculty_hours': faculty_hours,
        'subjects_without_faculty': subjects_without_faculty,
        'dept_faculty': dept_faculty
    }

def generate_new_faculty(department, start_id, count=5):
    """Generate new faculty members for a department"""
    first_names = ['Arun', 'Priya', 'Suresh', 'Kavitha', 'Mohan', 'Lakshmi', 'Ganesh', 'Suma',
                   'Raghu', 'Nandini', 'Prasad', 'Vani', 'Kiran', 'Meena', 'Ravi', 'Geetha',
                   'Anil', 'Padma', 'Venkat', 'Asha', 'Srinivas', 'Bhavani', 'Nagaraj', 'Rekha',
                   'Harish', 'Deepa', 'Mahesh', 'Sunita', 'Kumar', 'Anitha']
    last_names = ['Sharma', 'Kumar', 'Reddy', 'Nair', 'Iyer', 'Menon', 'Gowda', 'Shetty',
                  'Rao', 'Pillai', 'Hegde', 'Murthy', 'Joshi', 'Kamath', 'Desai', 'Bhat',
                  'Patil', 'Kulkarni', 'Verma', 'Das']
    
    new_faculty = []
    for i in range(count):
        fid = f"{department}-F{start_id + i:03d}"
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        new_faculty.append({
            'faculty_id': fid,
            'faculty_name': f"Dr. {fname} {lname}",
            'department': department,
            'max_hours_per_week': 18,
            'subject_codes': ''  # Will be filled later
        })
    return new_faculty

def get_dept_from_subject(s):
    """Get department code from subject"""
    dept = s.get('department', '')
    if not dept:
        dept_id = s.get('department_id', 0)
        dept_map = {5: 'CSE', 10: 'ECE', 14: 'ME', 11: 'EEE', 6: 'ISE', 1: 'AIML', 
                    4: 'CYS', 3: 'CDS', 2: 'BT', 8: 'CH', 9: 'CV', 7: 'IEM', 12: 'ETE', 13: 'AE', 15: 'HS', 16: 'HSS'}
        dept = dept_map.get(dept_id, 'Unknown')
    return dept

def assign_subjects_to_faculty(subjects, faculty, analysis):
    """Redistribute subject assignments to balance workload"""
    print("\n" + "="*60)
    print("REDISTRIBUTING SUBJECT MAPPINGS")
    print("="*60)
    
    subject_map = analysis['subject_map']
    dept_faculty = analysis['dept_faculty']
    
    # Group subjects by department
    dept_subjects = defaultdict(list)
    for s in subjects:
        dept = get_dept_from_subject(s)
        if dept != 'Unknown':
            dept_subjects[dept].append(s)
    
    # For each department, distribute subjects evenly
    updates = []
    
    for dept, dept_subjs in dept_subjects.items():
        if dept not in dept_faculty or not dept_faculty[dept]:
            print(f"  ⚠️ No faculty for department: {dept}")
            continue
        
        facs = dept_faculty[dept]
        num_faculty = len(facs)
        
        # Sort subjects by total hours (heavy subjects first)
        dept_subjs.sort(key=lambda s: (s.get('theory_hours', 0) or 0) + (s.get('lab_hours', 0) or 0), reverse=True)
        
        # Initialize faculty assignments
        faculty_assignments = {f['faculty_id']: [] for f in facs}
        faculty_hours_assigned = {f['faculty_id']: 0 for f in facs}
        
        # Distribute subjects round-robin, prioritizing less loaded faculty
        for subj in dept_subjs:
            subj_hours = (subj.get('theory_hours', 0) or 0) + (subj.get('lab_hours', 0) or 0)
            
            # Assign to 2-3 faculty (for redundancy and load balancing)
            num_assign = min(3, num_faculty)
            
            # Sort faculty by current assigned hours
            sorted_facs = sorted(faculty_assignments.keys(), 
                               key=lambda f: faculty_hours_assigned[f])
            
            for i in range(num_assign):
                fid = sorted_facs[i]
                if subj['subject_code'] not in faculty_assignments[fid]:
                    faculty_assignments[fid].append(subj['subject_code'])
                    faculty_hours_assigned[fid] += subj_hours / num_assign
        
        # Create updates
        for fac in facs:
            fid = fac['faculty_id']
            new_codes = ','.join(faculty_assignments.get(fid, []))
            updates.append({
                'faculty_id': fid,
                'subject_codes': new_codes,
                'hours': faculty_hours_assigned.get(fid, 0)
            })
        
        avg_hours = sum(faculty_hours_assigned.values()) / num_faculty if num_faculty > 0 else 0
        print(f"  {dept}: {len(dept_subjs)} subjects distributed to {num_faculty} faculty (avg ~{avg_hours:.1f}h each)")
    
    return updates

def apply_updates(updates):
    """Apply the faculty updates to Supabase"""
    print("\n" + "="*60)
    print("APPLYING UPDATES TO SUPABASE")
    print("="*60)
    
    success_count = 0
    fail_count = 0
    
    for update in updates:
        fid = update['faculty_id']
        new_codes = update['subject_codes']
        
        # Update via PATCH
        patch_url = f"{SUPABASE_URL}/rest/v1/faculty?faculty_id=eq.{fid}"
        response = requests.patch(
            patch_url,
            headers=headers,
            json={'subject_codes': new_codes}
        )
        
        if response.status_code in [200, 204]:
            success_count += 1
        else:
            fail_count += 1
            print(f"  ❌ Failed to update {fid}: {response.status_code}")
    
    print(f"\n✅ Successfully updated: {success_count} faculty")
    if fail_count > 0:
        print(f"❌ Failed: {fail_count} faculty")

def add_new_faculty(new_faculty_list):
    """Add new faculty to Supabase"""
    print("\n" + "="*60)
    print("ADDING NEW FACULTY")
    print("="*60)
    
    for fac in new_faculty_list:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/faculty",
            headers=headers,
            json=fac
        )
        
        if response.status_code in [200, 201, 204]:
            print(f"  ✅ Added: {fac['faculty_id']} - {fac['faculty_name']}")
        else:
            print(f"  ❌ Failed to add {fac['faculty_id']}: {response.status_code} - {response.text}")

def main():
    print("Fetching data from Supabase...")
    subjects, faculty = fetch_data()
    print(f"Loaded: {len(subjects)} subjects, {len(faculty)} faculty")
    
    # Analyze current state
    analysis = analyze_current_state(subjects, faculty)
    
    # Check if we need more faculty
    subjects_without_faculty = analysis['subjects_without_faculty']
    dept_faculty = analysis['dept_faculty']
    
    # Determine departments that need more faculty
    depts_needing_faculty = set()
    for s in subjects_without_faculty:
        dept = get_dept_from_subject(s)
        if dept not in dept_faculty or len(dept_faculty[dept]) < 10:
            depts_needing_faculty.add(dept)
    
    if depts_needing_faculty:
        print(f"\nDepartments needing more faculty: {depts_needing_faculty}")
        
        # Add faculty for ME department (which shows 0 slots in bottom list)
        new_faculty = []
        for dept in depts_needing_faculty:
            existing_count = len(dept_faculty.get(dept, []))
            if existing_count < 14:
                to_add = 14 - existing_count
                new_facs = generate_new_faculty(dept, existing_count + 1, to_add)
                new_faculty.extend(new_facs)
                print(f"  Will add {to_add} faculty to {dept}")
        
        if new_faculty:
            add_new_faculty(new_faculty)
            # Refresh faculty list
            _, faculty = fetch_data()
            analysis = analyze_current_state(subjects, faculty)
    
    # Redistribute subject assignments
    updates = assign_subjects_to_faculty(subjects, faculty, analysis)
    
    # Apply updates
    if updates:
        apply_updates(updates)
    
    print("\n" + "="*60)
    print("DONE!")
    print("="*60)

if __name__ == "__main__":
    main()
