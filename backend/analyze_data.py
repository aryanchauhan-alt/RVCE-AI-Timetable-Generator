#!/usr/bin/env python3
"""Analyze faculty and subject data for timetable optimization"""

import requests
import json
from collections import defaultdict

SUPABASE_URL = "https://mmkkmjsqrqwfkbazznaw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ta2ttanNxcnF3ZmtiYXp6bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjIwMTMsImV4cCI6MjA4MTY5ODAxM30.i197JgWC9Sz0VLmxFHj7YBP2WHkYHEpU-d22xP_Wkq0"
headers = {"apikey": SUPABASE_KEY, "Content-Type": "application/json"}

def fetch_data():
    """Fetch all data from Supabase"""
    subjects = requests.get(f"{SUPABASE_URL}/rest/v1/subjects?select=*&limit=1000", headers=headers).json()
    faculty = requests.get(f"{SUPABASE_URL}/rest/v1/faculty?select=*&limit=300", headers=headers).json()
    # Get all slots (pagination)
    all_slots = []
    offset = 0
    while True:
        slots = requests.get(f"{SUPABASE_URL}/rest/v1/timetable_slots?select=*&limit=1000&offset={offset}", headers=headers).json()
        if not slots:
            break
        all_slots.extend(slots)
        offset += 1000
        if len(slots) < 1000:
            break
    return subjects, faculty, all_slots

def analyze_faculty_workload(faculty, subjects, slots):
    """Analyze faculty workload and subject mappings"""
    print("\n" + "="*60)
    print("FACULTY WORKLOAD ANALYSIS")
    print("="*60)
    
    subject_map = {s['subject_code']: s for s in subjects}
    
    # Count slots per faculty
    faculty_slots = defaultdict(list)
    for slot in slots:
        fid = slot.get('faculty_id')
        if fid:
            faculty_slots[fid].append(slot)
    
    # Analyze each faculty
    workload_data = []
    for f in faculty:
        fid = f['faculty_id']
        codes = f.get('subject_codes', '')
        code_list = [c.strip() for c in codes.split(',') if c.strip()] if codes else []
        
        # Count unique subjects in their teaching
        slot_count = len(faculty_slots.get(fid, []))
        
        # Calculate potential workload from subject mappings
        potential_hours = 0
        for code in code_list:
            if code in subject_map:
                s = subject_map[code]
                potential_hours += (s.get('theory_hours', 0) or 0) + (s.get('lab_hours', 0) or 0)
        
        workload_data.append({
            'faculty_id': fid,
            'name': f['faculty_name'],
            'dept': f['department'],
            'subject_count': len(code_list),
            'current_slots': slot_count,
            'potential_hours': potential_hours
        })
    
    # Sort by current slots
    workload_data.sort(key=lambda x: x['current_slots'], reverse=True)
    
    print("\nTop 20 Most Loaded Faculty:")
    for w in workload_data[:20]:
        print(f"  {w['faculty_id']:10s} {w['name'][:25]:25s} - {w['dept']:5s} - {w['current_slots']:2d} slots, {w['subject_count']} subjects")
    
    print("\nBottom 20 Least Loaded Faculty:")
    for w in workload_data[-20:]:
        print(f"  {w['faculty_id']:10s} {w['name'][:25]:25s} - {w['dept']:5s} - {w['current_slots']:2d} slots, {w['subject_count']} subjects")
    
    return workload_data

def analyze_unassigned_slots(slots):
    """Find slots without faculty assigned"""
    print("\n" + "="*60)
    print("UNASSIGNED SLOTS ANALYSIS")
    print("="*60)
    
    no_faculty = [s for s in slots if not s.get('faculty_id') or s.get('faculty_id') == '']
    print(f"\nTotal slots: {len(slots)}")
    print(f"Slots WITHOUT faculty: {len(no_faculty)} ({100*len(no_faculty)/len(slots):.1f}%)")
    
    if no_faculty:
        # Group by subject
        by_subject = defaultdict(list)
        for s in no_faculty:
            by_subject[s.get('subject_code', 'Unknown')].append(s)
        
        print(f"\nUnassigned by subject (top 20):")
        sorted_subjects = sorted(by_subject.items(), key=lambda x: len(x[1]), reverse=True)[:20]
        for code, slot_list in sorted_subjects:
            sample = slot_list[0]
            print(f"  {code}: {len(slot_list)} slots - {sample.get('subject_name', '')[:40]}")
    
    return no_faculty

def analyze_pattern_issues(slots):
    """Find schedule pattern issues (same subject same time multiple days)"""
    print("\n" + "="*60)
    print("PATTERN ISSUES (Same subject same slot on consecutive days)")
    print("="*60)
    
    # Group by section
    by_section = defaultdict(list)
    for s in slots:
        by_section[s.get('section_id')].append(s)
    
    pattern_issues = []
    for section_id, section_slots in by_section.items():
        # Group by subject and slot
        subject_slots = defaultdict(list)
        for s in section_slots:
            key = (s.get('subject_code'), s.get('slot'))
            subject_slots[key].append(s.get('day'))
        
        # Check for patterns
        for (subject, slot), days in subject_slots.items():
            if len(days) >= 3:
                # Check if consecutive days
                day_order = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4}
                sorted_days = sorted(days, key=lambda d: day_order.get(d, 5))
                for i in range(len(sorted_days) - 2):
                    d1, d2, d3 = sorted_days[i:i+3]
                    if day_order.get(d2, 5) == day_order.get(d1, 5) + 1 and day_order.get(d3, 5) == day_order.get(d2, 5) + 1:
                        pattern_issues.append({
                            'section_id': section_id,
                            'subject': subject,
                            'slot': slot,
                            'days': [d1, d2, d3]
                        })
    
    print(f"\nFound {len(pattern_issues)} pattern issues:")
    for issue in pattern_issues[:15]:
        print(f"  Section {issue['section_id']}: {issue['subject']} at slot {issue['slot']} on {', '.join(issue['days'])}")
    
    return pattern_issues

def main():
    print("Fetching data from Supabase...")
    subjects, faculty, slots = fetch_data()
    print(f"Loaded: {len(subjects)} subjects, {len(faculty)} faculty, {len(slots)} slots")
    
    workload = analyze_faculty_workload(faculty, subjects, slots)
    unassigned = analyze_unassigned_slots(slots)
    patterns = analyze_pattern_issues(slots)
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"- Unassigned slots: {len(unassigned)}")
    print(f"- Pattern issues: {len(patterns)}")

if __name__ == "__main__":
    main()
