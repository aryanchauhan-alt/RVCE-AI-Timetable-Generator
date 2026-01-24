"""
Verify Faculty-Subject-Section Lock Constraint
==============================================
Checks that:
1. Each faculty teaches a subject to only ONE section
2. Each section has the same faculty for all instances of a subject
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def verify_faculty_locks():
    print("=" * 60)
    print("FACULTY-SECTION LOCK VERIFICATION")
    print("=" * 60)
    
    # Fetch all timetable slots (with pagination)
    all_slots = []
    page_size = 1000
    offset = 0
    
    while True:
        result = supabase.table("timetable_slots").select("*").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_slots.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size
    
    slots = all_slots
    print(f"Total slots: {len(slots)}")
    
    # Track faculty-subject-section assignments
    # Key: (faculty_id, subject_name) -> set of section_ids
    faculty_subject_sections = {}
    
    # Track section-subject-faculty assignments
    # Key: (section_id, subject_name) -> set of faculty_ids
    section_subject_faculty = {}
    
    for slot in slots:
        faculty_id = slot.get('faculty_id')
        faculty_name = slot.get('faculty_name', 'Unknown')
        section_id = slot.get('section_id')
        subject = slot.get('subject_name', slot.get('subject', ''))
        
        if not faculty_id or faculty_id.startswith('TBA'):
            continue
        
        # Track faculty -> subject -> sections
        key1 = (faculty_id, subject)
        if key1 not in faculty_subject_sections:
            faculty_subject_sections[key1] = set()
        faculty_subject_sections[key1].add(section_id)
        
        # Track section -> subject -> faculty
        key2 = (section_id, subject)
        if key2 not in section_subject_faculty:
            section_subject_faculty[key2] = set()
        section_subject_faculty[key2].add(faculty_id)
    
    # Check for violations
    print("\n" + "=" * 60)
    print("CONSTRAINT 1: Faculty teaches subject to ONE section only")
    print("=" * 60)
    
    violations_1 = []
    for (faculty_id, subject), sections in faculty_subject_sections.items():
        if len(sections) > 1:
            violations_1.append({
                'faculty_id': faculty_id,
                'subject': subject,
                'sections': list(sections)
            })
    
    if violations_1:
        print(f"\n⚠️  VIOLATIONS FOUND: {len(violations_1)}")
        for v in violations_1[:20]:  # Show first 20
            print(f"  Faculty {v['faculty_id']} teaches '{v['subject']}' to {len(v['sections'])} sections: {v['sections']}")
    else:
        print("\n✅ NO VIOLATIONS - Each faculty teaches each subject to only one section!")
    
    print("\n" + "=" * 60)
    print("CONSTRAINT 2: Section has ONE faculty per subject")
    print("=" * 60)
    
    violations_2 = []
    for (section_id, subject), faculty_set in section_subject_faculty.items():
        if len(faculty_set) > 1:
            violations_2.append({
                'section_id': section_id,
                'subject': subject,
                'faculty': list(faculty_set)
            })
    
    if violations_2:
        print(f"\n⚠️  VIOLATIONS FOUND: {len(violations_2)}")
        for v in violations_2[:20]:  # Show first 20
            print(f"  Section {v['section_id']} has {len(v['faculty'])} faculty for '{v['subject']}': {v['faculty']}")
    else:
        print("\n✅ NO VIOLATIONS - Each section has same faculty for each subject!")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total unique (faculty, subject) pairs: {len(faculty_subject_sections)}")
    print(f"Total unique (section, subject) pairs: {len(section_subject_faculty)}")
    print(f"Constraint 1 violations: {len(violations_1)}")
    print(f"Constraint 2 violations: {len(violations_2)}")
    
    if violations_1 == 0 and violations_2 == 0:
        print("\n✅ ALL FACULTY-SECTION LOCK CONSTRAINTS SATISFIED!")
    else:
        print(f"\n⚠️  TOTAL VIOLATIONS: {len(violations_1) + len(violations_2)}")

if __name__ == "__main__":
    verify_faculty_locks()
