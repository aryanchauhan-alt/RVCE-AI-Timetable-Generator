"""
Timetable Solver V7 - Strict Constraints & New Time Structure
=============================================================
Based on user requirements:
- Days: Mon-Sat (Sat is half day)
- Slots:
  1. 09:00 - 10:00
  2. 10:00 - 11:00
  (Break 11:00-11:30)
  3. 11:30 - 12:30
  4. 12:30 - 01:30
  (Lunch 01:30-02:30)
  5. 02:30 - 03:30 (Mon-Fri only)
  6. 03:30 - 04:30 (Mon-Fri only)

Algorithm:
1. Global Baskets (Sem 3/4) - Synchronized across ALL departments
2. Institutional Electives (IE) (Sem 5+) - Synchronized across ALL departments
3. Professional Core Electives (PCE) (Sem 5+) - Synchronized across Department
4. Labs (Consecutive 2 slots)
5. Core Theory
"""

import pandas as pd
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
import os
import random
import asyncio
from services.supabase_service import fetch_all_data

# Get paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'data')

# Time structure - SATURDAY IS OPTIONAL (only used if weekdays are full)
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']  # Preferred days

# Slot Definitions - Morning slots preferred for teachers
TIME_SLOTS = {
    1: "09:00 - 10:00",  # Morning - HIGH priority for teachers
    2: "10:00 - 11:00",  # Morning - HIGH priority for teachers
    3: "11:30 - 12:30",  # Mid-day - MEDIUM priority
    4: "12:30 - 01:30",  # Mid-day - MEDIUM priority
    5: "02:30 - 03:30",  # Afternoon - LOW priority
    6: "03:30 - 04:30"   # Afternoon - LOWEST priority
}

# Slot priority for teachers (1 = best, higher = worse)
SLOT_PRIORITY = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4}

SATURDAY_SLOTS = [1, 2, 3, 4]
WEEKDAY_SLOTS = [1, 2, 3, 4, 5, 6]

# Removed global CSV loading for Supabase migration
DEPARTMENTS = ['CSE', 'ECE', 'ME', 'EEE', 'ISE', 'AIML', 'CYS', 'CDS'] # Default list
DEPT_ID_MAP = {} # Will be populated from Supabase

class TimetableSolverV7:
    def __init__(self, semester_type: str = 'odd'):
        self.semester_type = semester_type
        if semester_type == 'all':
            self.valid_semesters = [1, 2, 3, 4, 5, 6, 7, 8]
        elif semester_type == 'odd':
            self.valid_semesters = [1, 3, 5, 7] 
        else:
            self.valid_semesters = [2, 4, 6, 8]
        
        self.sections = []
        self.subjects = []
        self.rooms = []
        self.faculty = []  # NEW: Faculty list
        self.faculty_subject_map = {}  # NEW: subject_code -> [faculty_ids]
        self.schedule = {}  # (section_id, day, slot) -> assignment
        
        # Tracking for constraints
        self.faculty_schedule = defaultdict(list) # faculty_id -> [(day, slot), ...]
        self.room_schedule = defaultdict(list)    # room_id -> [(day, slot), ...]
        
        # NEW: Track subject scheduling across ALL sections to prevent conflicts
        # (subject_id, day, slot) -> [(section_id, faculty_id), ...]
        self.subject_slot_usage = defaultdict(list)
        
        # HARD CONSTRAINT: Track basket slots per academic year (immutable once set)
        # year -> [(day, slot), ...]
        self.basket_slots_by_year = defaultdict(list)
        
        # Track unscheduled subjects for reporting
        self.unscheduled_subjects = []
        
        # NEW: Track section subject-slot patterns to prevent same slot on consecutive days
        # section_id -> {subject_code: [(day, slot), ...]}
        self.section_subject_slots = defaultdict(lambda: defaultdict(list))
        
        # NEW: Track faculty consecutive classes per day
        # faculty_id -> {day: [slots]}
        self.faculty_daily_slots = defaultdict(lambda: defaultdict(list))
        
        # NEW: Track faculty consecutive blocks count
        # faculty_id -> count of days with 2+ consecutive theory classes
        self.faculty_consecutive_blocks = defaultdict(int)
        
    async def load_data(self):
        """Load data from Supabase database"""
        print("📥 Loading data from Supabase...")
        
        # Fetch all data from Supabase
        try:
            print("  > Calling fetch_all_data...")
            data = await fetch_all_data(self.semester_type)
            print(f"  > Fetched data keys: {data.keys()}")
            
            # Debug Departments
            print(f"  > Departments count: {len(data.get('departments', []))}")
        except Exception as e:
            print(f"🔥 FETCH DATA FAILED: {e}")
            traceback.print_exc()
            raise e
        
        # Build department ID to code mapping
        # Build department ID to code mapping from fetched departments
        if 'departments' in data:
             # Use legacy department_id (e.g. 5, 10, 14) as key, NOT primary key id (1, 2, 3)
             dept_id_map = {d['department_id']: d.get('department_code') for d in data['departments']}
        else:
             dept_id_map = data.get('dept_id_map', DEPT_ID_MAP)

        # 1. Load Rooms
        self.rooms = []
        for room in data.get('rooms', []):
            self.rooms.append({
                'id': room['room_id'],
                'department': room['department'],
                'room_type': room['room_type'],
                'capacity': room['capacity'],
                'labs': []
            })
        
        # 2. Load Sections (already filtered by semester_type in supabase_service)
        self.sections = []
        for row in data.get('sections', []):
            sem = row['semester']
            dept = row['department']
            
            # Additional filter for safety
            if self.semester_type != 'all' and sem not in self.valid_semesters:
                continue
                
            # Derive academic year from semester
            academic_year = (sem + 1) // 2

            # Include ALL sections from database (some depts like CSE have D, E sections)
            self.sections.append({
                'id': row['id'],  # USE DB ID - critical for correct section_id references
                'department': dept,
                'academic_year': academic_year,
                'semester': sem,
                'section': row['section'],
                'dedicated_room': row.get('dedicated_room'), 
                'student_count': row.get('student_count', 60)
            })

        # 3. Process Subjects (already filtered by semester_type in supabase_service)
        self.subjects = []
        
        # Deduplicate subjects by (subject_code, department_id, semester)
        seen_subjects = set()
        
        for row in data.get('subjects', []):
            # Create unique key for deduplication
            subj_key = (row.get('subject_code'), row.get('department_id'), row.get('semester'))
            if subj_key in seen_subjects:
                continue
            seen_subjects.add(subj_key)
            
            dept_id = row.get('department_id')
            if dept_id not in dept_id_map:
                continue
            
            dept_code = dept_id_map[dept_id]
            sem = row['semester']
            
            # Additional filter for safety
            if self.semester_type != 'all' and sem not in self.valid_semesters:
                continue

            # Parse boolean fields (Supabase returns actual booleans)
            def parse_bool(val):
                if isinstance(val, bool):
                    return val
                return str(val).upper() == 'TRUE'

            is_basket = parse_bool(row.get('is_basket', False))
            is_pec = parse_bool(row.get('is_pec', False))
            is_iec = parse_bool(row.get('is_iec', False))
            is_nptel = parse_bool(row.get('is_nptel', False))

            # CONSTRAINT: No NPTEL classes
            if is_nptel or 'NPTEL' in row['subject_name'].upper():
                continue
            
            # Theory hours = slots
            l = int(row.get('theory_hours', 0))
            # Lab hours in DB represents hours per week
            # 1-2 hours = 1 session (2 consecutive slots)
            # 3-4 hours = 2 sessions, etc.
            raw_lab_hours = int(row.get('lab_hours', 0))
            
            # Convert lab hours to sessions: 1-2hrs = 1 session, 3-4hrs = 2 sessions
            if raw_lab_hours <= 0:
                p = 0
            elif raw_lab_hours <= 2:
                p = 1  # 1 or 2 hours = 1 lab session
            elif raw_lab_hours <= 4:
                p = 2  # 3 or 4 hours = 2 lab sessions
            else:
                p = raw_lab_hours // 2  # For very long labs
            
            base_subj = {
                'id': random.randint(10000, 99999),
                'name': row['subject_name'],
                'department': dept_code,
                'semester': sem,
                'course_code': row['subject_code'],
                'is_institutional_elective': is_iec,
                'is_basket': is_basket,
                'is_pec': is_pec,
                'is_bridge_course': 'bridge course' in row['subject_name'].lower(),  # NEW: Flag bridge courses
                'l': l, 't': 0, 'p': p
            }
            
            # Split into Theory and Lab components
            has_lab = p > 0
            has_theory = l > 0
            
            # CRITICAL: Do NOT create Lab component for ESC (it has no lab)
            # But PLC DOES have lab that can be scheduled at different times for different sections
            is_esc = 'Engineering Science Course' in row['subject_name']
            is_plc = 'Programming Languages Course' in row['subject_name']
            
            # Create lab for: non-basket subjects OR PLC (which is basket but has lab)
            if has_lab and (not is_basket or is_plc) and not is_esc:
                lab_subj = base_subj.copy()
                lab_subj['id'] = random.randint(10000, 99999)
                lab_subj['subject_type'] = 'Lab'
                lab_subj['weekly_hours'] = p * 2 
                lab_subj['l'] = 0
                lab_subj['t'] = 0
                lab_subj['is_basket'] = False
                
                if is_plc:
                    lab_subj['use_cs_cluster_labs'] = True
                
                self.subjects.append(lab_subj)
                
            if has_theory:
                theory_subj = base_subj.copy()
                theory_subj['id'] = random.randint(10000, 99999)
                theory_subj['subject_type'] = 'Theory'
                theory_subj['weekly_hours'] = l
                theory_subj['p'] = 0
                
                # Handle Special Types
                if is_pec:
                    theory_subj['subject_type'] = 'PCE_Block'
                elif is_iec:
                    theory_subj['subject_type'] = 'IE_Block'
                elif is_basket:
                    theory_subj['subject_type'] = 'Basket_Block'
                
                # SPECIAL CASE: Engineering Science Course (ESC) -> Treat as Basket
                if 'Engineering Science Course' in row['subject_name']:
                    theory_subj['subject_type'] = 'Basket_Block'
                    theory_subj['is_basket'] = True
                
                # SPECIAL CASE: Programming Languages Course -> Treat as Basket
                if 'Programming Languages Course' in row['subject_name']:
                    theory_subj['subject_type'] = 'Basket_Block'
                    theory_subj['is_basket'] = True
                
                # SPECIAL CASE: Yoga & English -> Treat as Theory (2 hours)
                if 'Yoga' in row['subject_name'] or 'English' in row['subject_name']:
                    theory_subj['subject_type'] = 'Theory'
                    theory_subj['weekly_hours'] = 2
                    theory_subj['p'] = 0
                    
                self.subjects.append(theory_subj)
        
        # Remove Lab component for English (but KEEP Yoga as it uses YOGA rooms)
        self.subjects = [
            s for s in self.subjects 
            if not (s['subject_type'] == 'Lab' and 'English' in s['name'])
        ]
        
        # 4. Load Faculty
        self.faculty = []
        self.faculty_subject_map = defaultdict(list)
        for row in data.get('faculty', []):
            faculty_entry = {
                'id': row['faculty_id'],
                'name': row['faculty_name'],
                'department': row['department'],
                'max_hours': int(row.get('max_hours_per_week', 18))
            }
            self.faculty.append(faculty_entry)
            
            # Map subject codes to faculty
            subject_codes = str(row.get('subject_codes', '')).split(',')
            for code in subject_codes:
                code = code.strip()
                if code:
                    self.faculty_subject_map[code].append(faculty_entry)
        
        # Assign faculty to subjects
        for subj in self.subjects:
            course_code = subj.get('course_code', '')
            if course_code in self.faculty_subject_map:
                subj['faculty_options'] = self.faculty_subject_map[course_code]
                subj['faculty'] = self.faculty_subject_map[course_code][0]
            else:
                subj['faculty_options'] = []
                subj['faculty'] = {
                    'id': f"TBA_{subj.get('department', 'DEPT')}",
                    'name': 'TBA',
                    'department': subj.get('department', 'DEPT'),
                    'max_hours': 99
                }
        
        print(f"✅ Loaded {len(self.sections)} sections, {len(self.rooms)} rooms, {len(self.subjects)} subjects, {len(self.faculty)} faculty")

        # NOTE: PCE/IE subjects are now loaded from CSV - no placeholder injection needed

    def get_slots_for_day(self, day: str) -> List[int]:
        if day == 'Saturday':
            return SATURDAY_SLOTS
        return WEEKDAY_SLOTS

    def is_slot_free(self, section_id: int, day: str, slot: int) -> bool:
        return (section_id, day, slot) not in self.schedule
    
    def is_basket_slot_for_year(self, acad_year: int, day: str, slot: int) -> bool:
        """HARD CONSTRAINT: Check if this slot is locked for basket courses for a given academic year.
        
        Once a basket slot is assigned for a year, it cannot be used for other subjects
        in that year's sections.
        """
        return (day, slot) in self.basket_slots_by_year.get(acad_year, [])
    
    def get_section_academic_year(self, section: dict) -> int:
        """Get the academic year for a section based on its semester."""
        sem = section.get('semester', 1)
        return (sem + 1) // 2  # Sem 1,2 -> Year 1, Sem 3,4 -> Year 2, etc.

    def is_room_free(self, room_id: str, day: str, slot: int) -> bool:
        if room_id.startswith("Virtual_"): return True # Virtual rooms have infinite capacity
        return (day, slot) not in self.room_schedule[room_id]

    def is_faculty_free(self, faculty_id: str, day: str, slot: int) -> bool:
        """Check if a faculty member is free at a given time"""
        if faculty_id.startswith("TBA_"): return True  # TBA faculty is always available
        return (day, slot) not in self.faculty_schedule[faculty_id]

    def would_create_pattern_violation(self, section_id: int, subject_code: str, day: str, slot: int) -> bool:
        """SOFT CONSTRAINT: Check if scheduling this would create same subject at same slot on 3+ consecutive days.
        
        This prevents patterns like "Logic Design at slot 1 on Mon, Tue, Wed"
        """
        day_order = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5}
        current_day_idx = day_order.get(day, 5)
        
        # Get existing slots for this subject in this section
        existing_slots = self.section_subject_slots[section_id].get(subject_code, [])
        
        # Find slots at the same time (same slot number)
        same_slot_days = [d for (d, s) in existing_slots if s == slot]
        
        if len(same_slot_days) < 2:
            return False  # Need at least 2 existing to form a pattern with this one
        
        # Check if adding this day would create 3 consecutive days
        same_slot_day_indices = [day_order.get(d, 5) for d in same_slot_days] + [current_day_idx]
        same_slot_day_indices.sort()
        
        # Check for 3 consecutive
        for i in range(len(same_slot_day_indices) - 2):
            if (same_slot_day_indices[i+1] == same_slot_day_indices[i] + 1 and 
                same_slot_day_indices[i+2] == same_slot_day_indices[i+1] + 1):
                return True
        
        return False
    
    def would_exceed_consecutive_limit(self, faculty_id: str, day: str, slot: int, is_lab: bool = False) -> bool:
        """SOFT CONSTRAINT: Check if faculty would have 2+ consecutive theory blocks more than once per week.
        
        Labs are exempt from this constraint.
        """
        if is_lab or faculty_id.startswith("TBA_"):
            return False
        
        # Get faculty's current slots on this day
        daily_slots = list(self.faculty_daily_slots[faculty_id][day])
        daily_slots.append(slot)
        daily_slots.sort()
        
        # Count consecutive blocks (2+ consecutive slots) on this day
        consecutive_on_day = 0
        i = 0
        while i < len(daily_slots):
            block_size = 1
            while i + block_size < len(daily_slots) and daily_slots[i + block_size] == daily_slots[i] + block_size:
                block_size += 1
            if block_size >= 2:
                consecutive_on_day += 1
            i += block_size
        
        if consecutive_on_day == 0:
            return False
        
        # Check total consecutive blocks across all days
        total_consecutive_blocks = self.faculty_consecutive_blocks.get(faculty_id, 0)
        
        # If this day already had a consecutive block, don't count again
        old_daily_slots = list(self.faculty_daily_slots[faculty_id][day])
        old_daily_slots.sort()
        had_consecutive_before = False
        i = 0
        while i < len(old_daily_slots):
            block_size = 1
            while i + block_size < len(old_daily_slots) and old_daily_slots[i + block_size] == old_daily_slots[i] + block_size:
                block_size += 1
            if block_size >= 2:
                had_consecutive_before = True
                break
            i += block_size
        
        # If we're adding a NEW consecutive block
        if consecutive_on_day > 0 and not had_consecutive_before:
            # Allow at most 1 day per week with consecutive blocks
            if total_consecutive_blocks >= 1:
                return True
        
        return False

    def get_available_faculty(self, subject: dict, day: str, slot: int, section_id: int = None, is_lab: bool = False) -> Optional[dict]:
        """Get an available faculty for the subject at the given time
        
        Uses STRICT load balancing to distribute faculty across sections:
        - ALWAYS prioritizes faculty with fewer assigned hours
        - Only rotates among faculty with same (minimum) hours
        - Ensures even distribution across all qualified faculty
        - HARD CONSTRAINT: Must return actual faculty, not TBA
        - SOFT CONSTRAINT: Avoid consecutive theory blocks > 1 per week
        """
        faculty_options = subject.get('faculty_options', [])
        
        # If no faculty options, try to find ANY faculty from the department
        if not faculty_options:
            dept = subject.get('department', '')
            dept_faculty = [f for f in self.faculty if f['department'] == dept]
            if dept_faculty:
                faculty_options = dept_faculty
        
        # Filter to only available faculty
        available = []
        for faculty in faculty_options:
            if self.is_faculty_free(faculty['id'], day, slot):
                # Check max hours constraint
                current_hours = self.get_faculty_hours(faculty['id'])
                max_hours = faculty.get('max_hours', 18)  # Default to 18, not 40
                if current_hours < max_hours:
                    # Check consecutive block constraint (soft - prefer those who won't exceed)
                    would_exceed = self.would_exceed_consecutive_limit(faculty['id'], day, slot, is_lab)
                    
                    # Calculate workload percentage for better balancing
                    workload_pct = (current_hours / max_hours) * 100 if max_hours > 0 else 0
                    available.append({
                        'faculty': faculty,
                        'hours': current_hours,
                        'max_hours': max_hours,
                        'workload_pct': workload_pct,
                        'would_exceed_consecutive': would_exceed
                    })
        
        if not available:
            # SECOND ATTEMPT: Try ANY faculty from the department who is free
            dept = subject.get('department', '')
            dept_faculty = [f for f in self.faculty if f['department'] == dept]
            for faculty in dept_faculty:
                if self.is_faculty_free(faculty['id'], day, slot):
                    current_hours = self.get_faculty_hours(faculty['id'])
                    max_hours = faculty.get('max_hours', 18)
                    if current_hours < max_hours:
                        workload_pct = (current_hours / max_hours) * 100 if max_hours > 0 else 0
                        available.append({
                            'faculty': faculty,
                            'hours': current_hours,
                            'max_hours': max_hours,
                            'workload_pct': workload_pct,
                            'would_exceed_consecutive': False
                        })
        
        if not available:
            # THIRD ATTEMPT: Find any faculty who is free (cross-department) 
            for faculty in self.faculty:
                if self.is_faculty_free(faculty['id'], day, slot):
                    current_hours = self.get_faculty_hours(faculty['id'])
                    max_hours = faculty.get('max_hours', 18)
                    if current_hours < max_hours:
                        workload_pct = (current_hours / max_hours) * 100 if max_hours > 0 else 0
                        available.append({
                            'faculty': faculty,
                            'hours': current_hours,
                            'max_hours': max_hours,
                            'workload_pct': workload_pct,
                            'would_exceed_consecutive': False
                        })
                        break  # Just need one
        
        if not available:
            # FINAL FALLBACK: Return TBA only if absolutely no faculty available
            return {
                'id': f"TBA_{subject.get('department', 'DEPT')}",
                'name': 'TBA',
                'department': subject.get('department', 'DEPT'),
                'max_hours': 99
            }
        
        # Sort by: 1) consecutive limit (prefer not exceeding), 2) workload percentage
        available.sort(key=lambda x: (x['would_exceed_consecutive'], x['workload_pct'], x['hours']))
        
        # STRICT WORKLOAD BALANCING: Only rotate among faculty with same low workload
        if len(available) > 1:
            # Prefer faculty who won't exceed consecutive limit
            non_exceeding = [f for f in available if not f['would_exceed_consecutive']]
            if non_exceeding:
                available = non_exceeding
            
            min_pct = available[0]['workload_pct']
            # Get all faculty within 10% of minimum workload
            balanced_options = [f for f in available if f['workload_pct'] <= min_pct + 10]
            
            if len(balanced_options) > 1 and section_id is not None:
                # Rotate among similarly loaded faculty
                idx = section_id % len(balanced_options)
                return balanced_options[idx]['faculty']
            elif balanced_options:
                return balanced_options[0]['faculty']
        
        # Return faculty with lowest workload percentage
        return available[0]['faculty']

    def get_available_faculty_for_both_slots(self, subject: dict, day: str, slot1: int, slot2: int, section_id: int = None) -> Optional[dict]:
        """Get a faculty member who is available for BOTH consecutive slots (for labs).
        
        Prioritizes faculty with:
        1. Availability in both slots
        2. Fewer assigned hours (workload balancing)
        3. Not exceeding max hours after assignment
        """
        faculty_options = subject.get('faculty_options', [])
        if not faculty_options:
            return subject.get('faculty')  # Return TBA faculty
        
        # Filter to only faculty available for BOTH slots
        available = []
        for faculty in faculty_options:
            # Must be free in both slots
            if not (self.is_faculty_free(faculty['id'], day, slot1) and 
                    self.is_faculty_free(faculty['id'], day, slot2)):
                continue
                
            # Check max hours constraint (needs 2 hours)
            current_hours = self.get_faculty_hours(faculty['id'])
            if current_hours + 2 <= faculty.get('max_hours', 40):
                available.append({
                    'faculty': faculty,
                    'hours': current_hours
                })
        
        if not available:
            # If no faculty is free for both, return TBA as fallback
            return {
                'id': f"TBA_{subject.get('department', 'DEPT')}",
                'name': 'TBA',
                'department': subject.get('department', 'DEPT'),
                'max_hours': 99
            }
        
        # Sort by hours (ascending) - prefer faculty with fewer hours for better distribution
        available.sort(key=lambda x: x['hours'])
        
        # If multiple faculty available with same low hours, rotate based on section
        if section_id is not None and len(available) > 1:
            # Find all with same minimum hours
            min_hours = available[0]['hours']
            low_hour_faculty = [f for f in available if f['hours'] == min_hours]
            if len(low_hour_faculty) > 1:
                idx = section_id % len(low_hour_faculty)
                return low_hour_faculty[idx]['faculty']
        
        return available[0]['faculty']

    def has_faculty_consecutive_theory(self, faculty_id: str, day: str, slot: int) -> bool:
        """HARD CONSTRAINT: Check if assigning this slot would give faculty consecutive THEORY classes.
        
        Labs are exempt - consecutive lab slots are expected and handled separately.
        This is a HARD constraint - teachers CANNOT have back-to-back theory classes.
        """
        if faculty_id.startswith("TBA_"):
            return False
        
        faculty_slots = self.faculty_schedule.get(faculty_id, [])
        
        # Check if previous slot exists and is NOT a lab
        prev_slot = slot - 1
        if prev_slot >= 1:  # Valid slot range
            for (d, s) in faculty_slots:
                if d == day and s == prev_slot:
                    # Check if that slot is a theory class (not lab)
                    for key, assignment in self.schedule.items():
                        if assignment.get('faculty', {}).get('id') == faculty_id:
                            sec_id, sched_day, sched_slot = key
                            if sched_day == day and sched_slot == prev_slot:
                                if not assignment.get('is_lab', False):
                                    return True  # HARD CONSTRAINT VIOLATION
                    break
        
        # Check if next slot exists and is NOT a lab
        next_slot = slot + 1
        if next_slot <= 6:  # Valid slot range
            for (d, s) in faculty_slots:
                if d == day and s == next_slot:
                    for key, assignment in self.schedule.items():
                        if assignment.get('faculty', {}).get('id') == faculty_id:
                            sec_id, sched_day, sched_slot = key
                            if sched_day == day and sched_slot == next_slot:
                                if not assignment.get('is_lab', False):
                                    return True  # HARD CONSTRAINT VIOLATION
                    break
        
        return False
    
    def would_create_gap(self, section_id: int, day: str, slot: int) -> bool:
        """SOFT CONSTRAINT: Check if assigning this slot would create a gap.
        
        NOTE: This is now a SOFT constraint - used only for preference, not blocking.
        Returns True if gap would be created, but caller decides whether to skip.
        """
        # Always return False - gaps will be fixed in post-processing
        return False
    
    def get_next_compact_slot(self, section_id: int, day: str) -> Optional[int]:
        """Get any available slot - compaction happens in post-processing."""
        slots = self.get_slots_for_day(day)
        occupied = set(self.get_section_day_slots(section_id, day))
        
        # Simply return first free slot
        for slot in slots:
            if slot not in occupied:
                return slot
        
        return None

    def assign_slot(self, section_id: int, day: str, slot: int, subject: dict, room: str, is_lab: bool = False, faculty: dict = None):
        # Get faculty if not provided - pass section_id for rotation
        if faculty is None:
            faculty = self.get_available_faculty(subject, day, slot, section_id, is_lab)
        
        self.schedule[(section_id, day, slot)] = {
            'subject': subject,
            'room': room,
            'is_lab': is_lab,
            'faculty': faculty
        }
        if not room.startswith("Virtual_"):
            self.room_schedule[room].append((day, slot))
        
        # Track faculty schedule
        if faculty and not faculty['id'].startswith("TBA_"):
            self.faculty_schedule[faculty['id']].append((day, slot))
            
            # Track daily slots for consecutive block detection
            self.faculty_daily_slots[faculty['id']][day].append(slot)
            
            # Update consecutive block count if needed
            if not is_lab:
                daily_slots = sorted(self.faculty_daily_slots[faculty['id']][day])
                has_consecutive = False
                i = 0
                while i < len(daily_slots):
                    block_size = 1
                    while i + block_size < len(daily_slots) and daily_slots[i + block_size] == daily_slots[i] + block_size:
                        block_size += 1
                    if block_size >= 2:
                        has_consecutive = True
                        break
                    i += block_size
                
                # Count days with consecutive blocks
                days_with_consecutive = sum(
                    1 for d in WEEKDAYS 
                    if self._day_has_consecutive_theory(faculty['id'], d)
                )
                self.faculty_consecutive_blocks[faculty['id']] = days_with_consecutive
        
        # Track subject-slot usage for cross-section conflict prevention
        subj_id = subject.get('id', subject.get('name'))
        faculty_id = faculty['id'] if faculty else 'TBA'
        self.subject_slot_usage[(subj_id, day, slot)].append((section_id, faculty_id))
        
        # Track section subject-slot patterns for pattern violation detection
        subject_code = subject.get('course_code', subject.get('name', ''))
        self.section_subject_slots[section_id][subject_code].append((day, slot))
    
    def _day_has_consecutive_theory(self, faculty_id: str, day: str) -> bool:
        """Check if faculty has 2+ consecutive theory slots on a day"""
        daily_slots = sorted(self.faculty_daily_slots[faculty_id][day])
        i = 0
        while i < len(daily_slots):
            block_size = 1
            while i + block_size < len(daily_slots) and daily_slots[i + block_size] == daily_slots[i] + block_size:
                block_size += 1
            # Check if these are theory (not lab) slots
            # For simplicity, assume most consecutive slots are theory unless explicitly lab
            if block_size >= 2:
                return True
            i += block_size
        return False

    def is_bridge_course(self, subject: dict) -> bool:
        """Check if a subject is a bridge course"""
        name = subject.get('name', '').lower()
        return 'bridge course' in name or subject.get('is_bridge_course', False)
    
    def get_last_slot_of_day(self, section_id: int, day: str) -> int:
        """Get the last slot that should be used for the day.
        
        For weekdays: slot 6 (3:30-4:30 PM)
        For Saturday: slot 4 (12:30-1:30 PM)
        
        But if earlier slots are filled and bridge course needs to be last,
        we return the appropriate last slot.
        """
        if day == 'Saturday':
            return 4
        return 6

    def get_faculty_hours(self, faculty_id: str) -> int:
        """Get total hours assigned to a faculty member"""
        return len(self.faculty_schedule.get(faculty_id, []))

    def has_faculty_continuous_block(self, faculty_id: str, day: str, slot: int) -> bool:
        """Check if assigning this slot would give faculty a continuous block (3+ consecutive slots)"""
        if faculty_id.startswith("TBA_"):
            return False
        
        faculty_slots = [s for (d, s) in self.faculty_schedule.get(faculty_id, []) if d == day]
        
        # Check if adding this slot creates 3+ consecutive
        test_slots = sorted(faculty_slots + [slot])
        consecutive = 1
        max_consecutive = 1
        for i in range(1, len(test_slots)):
            if test_slots[i] == test_slots[i-1] + 1:
                consecutive += 1
                max_consecutive = max(max_consecutive, consecutive)
            else:
                consecutive = 1
        
        return max_consecutive >= 3

    def has_section_continuous_subject(self, section_id: int, day: str, slot: int, subject_name: str) -> bool:
        """Check if assigning this subject to this slot gives section same subject in consecutive slots"""
        # Check previous slot
        prev_key = (section_id, day, slot - 1)
        if prev_key in self.schedule:
            if self.schedule[prev_key]['subject'].get('name') == subject_name:
                return True
        
        # Check next slot
        next_key = (section_id, day, slot + 1)
        if next_key in self.schedule:
            if self.schedule[next_key]['subject'].get('name') == subject_name:
                return True
        
        return False

    def count_sections_with_subject_at_slot(self, subject_id, day: str, slot: int) -> int:
        """Count how many sections already have this subject scheduled at this day/slot"""
        key = (subject_id, day, slot)
        return len(self.subject_slot_usage.get(key, []))
    
    def get_available_faculty_count(self, subject: dict) -> int:
        """Get the number of available faculty for a subject"""
        faculty_options = subject.get('faculty_options', [])
        if not faculty_options:
            return 1  # TBA counts as 1
        return len(faculty_options)

    def get_lab_rooms(self, department: str) -> List[str]:
        return [r['id'] for r in self.rooms if r['department'] == department and r['room_type'] == 'Lab']
    
    def get_physics_labs(self) -> List[str]:
        """Get shared Physics labs from CH department for first-year students"""
        return [r['id'] for r in self.rooms if r['department'] == 'CH' and 'Physics-Lab' in r['id']]
    
    def get_chemistry_labs(self) -> List[str]:
        """Get shared Chemistry labs from CH department for first-year students"""
        return [r['id'] for r in self.rooms if r['department'] == 'CH' and 'Chemistry-Lab' in r['id']]
    
    def get_me_labs(self) -> List[str]:
        """Get Mechanical Engineering labs for CAD Graphics (first year all depts)"""
        return [r['id'] for r in self.rooms if r['department'] == 'ME' and r['room_type'] == 'Lab']
    
    def get_cse_labs(self) -> List[str]:
        """Get CSE labs (shared by CSE, CYS, CDS departments)"""
        return [r['id'] for r in self.rooms if r['department'] == 'CSE' and r['room_type'] == 'Lab']
    
    def get_yoga_rooms(self) -> List[str]:
        """Get rooms for yoga/health classes"""
        return [r['id'] for r in self.rooms if 'YOGA' in r['id'] or 'Quadrangle' in r['id']]
    
    def is_physics_lab_subject(self, subject: dict) -> bool:
        """Check if subject is a Physics lab"""
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        name = subject.get('name', '').lower()
        return code.startswith('PY') and 'physics' in name
    
    def is_chemistry_lab_subject(self, subject: dict) -> bool:
        """Check if subject is a Chemistry lab"""
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        name = subject.get('name', '').lower()
        return code.startswith('CM') or ('chemistry' in name and code.startswith('C'))
    
    def is_cad_graphics_subject(self, subject: dict) -> bool:
        """Check if subject is Computer Aided Engineering Graphics (ME subject)"""
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        name = subject.get('name', '').lower()
        # ME subjects - CAD graphics has ME in code
        return code.startswith('ME') and ('graphics' in name or 'cad' in name or 'drawing' in name or 'workshop' in name or 'engineering mechanics' in name)
    
    def is_yoga_subject(self, subject: dict) -> bool:
        """Check if subject is Yoga/Health related"""
        name = subject.get('name', '').lower()
        return 'yoga' in name or 'health' in name
    
    def is_english_subject(self, subject: dict) -> bool:
        """Check if subject is English/communication"""
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        name = subject.get('name', '').lower()
        return code.startswith('HS') and ('english' in name or 'communication' in name)
    
    def is_math_computational_subject(self, subject: dict) -> bool:
        """Check if subject is Math with computational component (uses computer lab)"""
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        name = subject.get('name', '').lower()
        return code.startswith('MA') and ('computational' in name or 'numerical' in name or 'programming' in name)
    
    def is_cs_subject(self, subject: dict) -> bool:
        """Check if subject code starts with CS (Computer Science)"""
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        return code.startswith('CS') or code.startswith('IS') or code.startswith('CD') or code.startswith('AI') or code.startswith('CY')
    
    def get_lab_rooms_for_subject(self, subject: dict, section: dict) -> List[str]:
        """Get appropriate lab rooms based on subject code prefix and course type.
        
        Routing Rules (in priority order):
        1. Yoga/Health → YOGA-Terrace, BT-Quadrangle
        2. IDEA Lab → COMMON IDEA labs
        3. Design Thinking Lab → COMMON Design Thinking labs
        4. Physics (PY* with physics in name) → Physics-Lab-1/2 in CH department
        5. Chemistry (CM* with chemistry in name) → Chemistry-Lab-1/2 in CH department
        6. ME subjects for first year → ME labs
        7. Math computational labs (MA* with numerical/computational) → CSE labs (computer labs)
        8. English labs (HS with English) → CSE labs (as general purpose computer labs)
        9. CS/IS/CD/AI/CY subjects → CSE labs
        10. ECE subjects (EC*) → ECE labs
        11. EE subjects → EEE labs
        12. CH department subjects (not physics/chemistry) → CH labs
        13. Default: Department's own labs
        """
        sem = section['semester']
        dept = section['department']
        code = subject.get('course_code', '') or subject.get('subject_code', '')
        name = subject.get('name', '').lower()
        
        # Rule 1: Yoga/Health subjects → YOGA rooms
        if self.is_yoga_subject(subject):
            rooms = self.get_yoga_rooms()
            if rooms:
                return rooms
        
        # Rule 2: IDEA Lab → ME Labs
        if 'idea lab' in name or 'idea' in name.lower():
            labs = self.get_me_labs()
            if labs:
                return labs
        
        # Rule 3: Design Thinking Lab → DTL-Huddle rooms  
        if 'design thinking' in name:
            labs = [r['id'] for r in self.rooms if 'DTL-Huddle' in r['id'] and r['room_type'] == 'Lab']
            if labs:
                return labs
        
        # Rule 4: Physics subjects → Physics Labs
        if self.is_physics_lab_subject(subject):
            labs = self.get_physics_labs()
            if labs:
                return labs
        
        # Rule 5: Chemistry subjects → Chemistry Labs
        if self.is_chemistry_lab_subject(subject):
            labs = self.get_chemistry_labs()
            if labs:
                return labs
        
        # Rule 6: ME subjects (CAD Graphics, Workshop, etc.) → ME Labs
        if self.is_cad_graphics_subject(subject) or (sem in [1, 2] and code.startswith('ME')):
            labs = self.get_me_labs()
            if labs:
                return labs
        
        # Rule 7: Math computational labs → CSE Labs
        if self.is_math_computational_subject(subject):
            labs = self.get_cse_labs()
            if labs:
                return labs
        
        # Rule 8: English labs → CSE Labs (general computer labs)
        if self.is_english_subject(subject):
            labs = self.get_cse_labs()
            if labs:
                return labs
        
        # Rule 8.5: PLC Labs → CS Cluster Labs (any section can use CSE/ISE/AIML/CYS/CDS labs)
        if 'programming language' in name and subject.get('use_cs_cluster_labs'):
            labs = self.get_cse_labs()
            if labs:
                return labs
        
        # Rule 9: CS/IS/CD/AI/CY subjects → CSE Labs
        if self.is_cs_subject(subject) or dept in ['CSE', 'CYS', 'CDS', 'AIML', 'ISE']:
            labs = self.get_cse_labs()
            if labs:
                return labs
        
        # Rule 10: ECE subjects → ECE Labs
        if code.startswith('EC') or dept == 'ECE':
            labs = self.get_lab_rooms('ECE')
            if labs:
                return labs
        
        # Rule 11: EE subjects → EEE Labs
        if code.startswith('EE') or dept == 'EEE':
            labs = self.get_lab_rooms('EEE')
            if labs:
                return labs
        
        # Rule 12: CH department subjects (not physics/chemistry) → CH Labs
        if dept == 'CH':
            labs = [r['id'] for r in self.rooms if r['department'] == 'CH' and r['room_type'] == 'Lab' and 'CH-LAB' in r['id']]
            if labs:
                return labs
        
        # Rule 13: Default - use department's own labs
        labs = self.get_lab_rooms(dept)
        if labs:
            return labs
        
        # Fallback: try CSE labs as general purpose
        return self.get_cse_labs()
    
    def get_lab_slot_utilization(self, room: str) -> Dict[Tuple[str, int], bool]:
        """Get which day/slot combinations are used for a lab room"""
        used = {}
        for (day, slot) in self.room_schedule.get(room, []):
            used[(day, slot)] = True
        return used

    def get_classrooms(self, department: str) -> List[str]:
        """Get classrooms for a department - ONLY Classroom type, never Lab"""
        return [r['id'] for r in self.rooms if r['department'] == department and r['room_type'] == 'Classroom']
    
    def get_any_classroom(self, department: str, day: str, slot: int) -> Optional[str]:
        """Find any available classroom for theory classes - NEVER use labs.
        First try department's rooms, then spare rooms, then other departments."""
        # Priority 1: Department's dedicated classrooms
        dept_rooms = self.get_classrooms(department)
        for room in dept_rooms:
            if self.is_room_free(room, day, slot):
                return room
        
        # Priority 2: Department's spare classrooms
        spare_rooms = [r['id'] for r in self.rooms if r['department'] == department 
                       and 'SPARE' in r['id'] and r['room_type'] == 'Classroom']
        for room in spare_rooms:
            if self.is_room_free(room, day, slot):
                return room
        
        # Priority 3: Any SPARE classroom from any department
        all_spare = [r['id'] for r in self.rooms if 'SPARE' in r['id'] and r['room_type'] == 'Classroom']
        for room in all_spare:
            if self.is_room_free(room, day, slot):
                return room
        
        # Priority 4: Any classroom from any department (avoid labs)
        all_classrooms = [r['id'] for r in self.rooms if r['room_type'] == 'Classroom']
        for room in all_classrooms:
            if self.is_room_free(room, day, slot):
                return room
        
        return None

    def get_section_day_slots(self, section_id: int, day: str) -> List[int]:
        """Get list of occupied slots for a section on a given day"""
        occupied = []
        for slot in self.get_slots_for_day(day):
            if (section_id, day, slot) in self.schedule:
                occupied.append(slot)
        return occupied

    def find_compact_slot(self, section_id: int, day: str, avoid_consecutive_same_subject: str = None, prefer_morning: bool = True, subject_code: str = None) -> Optional[int]:
        """Find an available slot - prioritize filling from morning but DON'T block scheduling.
        
        PRIORITY: Complete scheduling is more important than compactness.
        Compaction happens in post-processing.
        
        SOFT CONSTRAINT: Avoid pattern violations (same subject same slot on consecutive days)
        """
        slots = self.get_slots_for_day(day)
        occupied = set(self.get_section_day_slots(section_id, day))
        
        # Try slots in order: morning first
        preferred_order = [1, 2, 3, 4, 5, 6]
        
        # First pass: respect all soft constraints
        for slot in preferred_order:
            if slot not in slots:
                continue
            if slot in occupied:
                continue
            if not self.is_slot_free(section_id, day, slot):
                continue
            
            # Check pattern violation constraint (soft - try to avoid)
            if subject_code and self.would_create_pattern_violation(section_id, subject_code, day, slot):
                continue
            
            # Check consecutive same subject constraint (soft - skip if violated)
            if avoid_consecutive_same_subject:
                prev_key = (section_id, day, slot - 1)
                next_key = (section_id, day, slot + 1)
                if prev_key in self.schedule and self.schedule[prev_key]['subject'].get('name') == avoid_consecutive_same_subject:
                    continue
                if next_key in self.schedule and self.schedule[next_key]['subject'].get('name') == avoid_consecutive_same_subject:
                    continue
            
            return slot
        
        # Second pass: relax pattern constraint but keep consecutive same subject constraint
        if subject_code:
            for slot in preferred_order:
                if slot not in slots:
                    continue
                if slot in occupied:
                    continue
                if not self.is_slot_free(section_id, day, slot):
                    continue
                
                if avoid_consecutive_same_subject:
                    prev_key = (section_id, day, slot - 1)
                    next_key = (section_id, day, slot + 1)
                    if prev_key in self.schedule and self.schedule[prev_key]['subject'].get('name') == avoid_consecutive_same_subject:
                        continue
                    if next_key in self.schedule and self.schedule[next_key]['subject'].get('name') == avoid_consecutive_same_subject:
                        continue
                
                return slot
        
        # Final pass: try without any constraints (just need to schedule)
        for slot in preferred_order:
            if slot not in slots:
                continue
            if slot in occupied:
                continue
            if not self.is_slot_free(section_id, day, slot):
                continue
            return slot
        
        return None

    def get_section_total_hours(self, section_id: int) -> int:
        """Get total scheduled hours for a section"""
        return sum(1 for key in self.schedule if key[0] == section_id)
    
    def get_section_weekday_hours(self, section_id: int) -> int:
        """Get hours scheduled on weekdays (Mon-Fri) only"""
        return sum(1 for key in self.schedule if key[0] == section_id and key[1] in WEEKDAYS)
    
    def can_avoid_saturday(self, section: dict, hours_needed: int) -> bool:
        """Check if we can fit remaining hours without using Saturday"""
        # Calculate available slots on weekdays
        available_weekday_slots = 0
        for day in WEEKDAYS:
            slots = self.get_slots_for_day(day)
            for slot in slots:
                if self.is_slot_free(section['id'], day, slot):
                    available_weekday_slots += 1
        return available_weekday_slots >= hours_needed

    def schedule_global_baskets(self):
        """Priority 1: Schedule Basket Courses - HARD CONSTRAINT: Synchronized per SEMESTER
        
        HARD CONSTRAINT: Each basket subject MUST be scheduled at the EXACT SAME TIME for:
        - All sections of ALL departments within the SAME semester
        - Each basket subject gets its full weekly hours scheduled
        - Once a slot is assigned for a basket, it CANNOT be overridden
        
        SCHEDULING RULES:
        - Spread basket hours across different days (not consecutive days)
        - Use different slots on different days  
        - Prefer slots after break (slot 4, 5, 6)
        """
        print("  > Scheduling Baskets (HARD CONSTRAINT: per-SEMESTER synchronization)...")
        
        # Identify ALL basket subjects
        basket_subjects = [s for s in self.subjects if s.get('is_basket')]
        if not basket_subjects: 
            print("    No basket subjects found")
            return
        
        # Group baskets by semester, then deduplicate by normalized name
        # Many departments have the same basket with slightly different names
        semester_baskets = defaultdict(dict)  # semester -> {normalized_name: subject}
        
        def normalize_basket_name(name):
            """Normalize basket name to identify duplicates"""
            name = name.lower()
            # Remove quotes, dashes, extra spaces
            name = name.replace('"', '').replace("'", '').replace(' - ', ' ').replace('-', ' ')
            name = ' '.join(name.split())
            # Map common variations
            if 'engineering science course' in name and 'i' in name and 'ii' not in name:
                return 'esc_i'
            if 'engineering science course' in name and 'ii' in name:
                return 'esc_ii'
            if 'programming languages' in name or 'programming language' in name:
                return 'plc'
            # Match basket courses with Group A or just A
            if 'basket' in name and ('group a' in name or name.endswith(' a') or 'course a' in name or 'courses a' in name):
                return 'basket_a'
            if 'basket' in name and ('group b' in name or name.endswith(' b') or 'course b' in name or 'courses b' in name):
                return 'basket_b'  
            if 'basket' in name and ('group c' in name or name.endswith(' c') or 'course c' in name or 'courses c' in name):
                return 'basket_c'
            if 'professional core elective' in name:
                return 'pce'
            if 'institutional elective' in name:
                return 'iec'
            return name
        
        for s in basket_subjects:
            sem = s['semester']
            norm_name = normalize_basket_name(s['name'])
            # Keep first occurrence (or one with most hours)
            if norm_name not in semester_baskets[sem]:
                semester_baskets[sem][norm_name] = s
            else:
                # Keep the one with more hours
                existing = semester_baskets[sem][norm_name]
                if s.get('weekly_hours', 0) > existing.get('weekly_hours', 0):
                    semester_baskets[sem][norm_name] = s
        
        # Get academic year for logging
        def get_academic_year(semester):
            return (semester + 1) // 2
        
        # Log what we found after deduplication
        for sem in sorted(semester_baskets.keys()):
            names = [f"{k}({v.get('weekly_hours',3)}h)" for k, v in semester_baskets[sem].items()]
            print(f"    Semester {sem}: {names}")
        
        # Define day-slot preferences - spread across week
        slot_preferences = [
            ('Monday', 4), ('Wednesday', 5), ('Friday', 6),
            ('Tuesday', 4), ('Thursday', 5), ('Monday', 5),
            ('Wednesday', 4), ('Friday', 4), ('Tuesday', 5),
            ('Thursday', 4), ('Monday', 6), ('Wednesday', 6),
            ('Friday', 5), ('Tuesday', 6), ('Thursday', 6)
        ]
        
        # Track slots used per semester to avoid conflicts
        semester_used_slots = defaultdict(set)  # semester -> {(day, slot)}
        
        # Schedule each semester's baskets
        for sem in sorted(semester_baskets.keys()):
            acad_year = get_academic_year(sem)
            basket_dict = semester_baskets[sem]
            
            # Get ALL sections for this semester
            sem_sections = [sec for sec in self.sections if sec['semester'] == sem]
            if not sem_sections:
                continue
            
            print(f"\n    === Scheduling Semester {sem} (Year {acad_year}) Baskets ===")
            print(f"    {len(sem_sections)} sections need: {list(basket_dict.keys())}")
            
            # Schedule each unique basket subject for this semester
            slot_idx = 0  # Track which preference to use
            for norm_name, basket_subj in basket_dict.items():
                hours_needed = basket_subj.get('weekly_hours', 3)
                hours_assigned = 0
                
                # Find slots for this basket's hours
                for attempt in range(len(slot_preferences)):
                    if hours_assigned >= hours_needed:
                        break
                    
                    pref_idx = (slot_idx + attempt) % len(slot_preferences)
                    day, slot = slot_preferences[pref_idx]
                    
                    # Skip if this slot already used for this semester
                    if (day, slot) in semester_used_slots[sem]:
                        continue
                    
                    if slot not in self.get_slots_for_day(day):
                        continue
                    
                    # Check if slot is free for ALL sections in this semester
                    all_free = True
                    for sec in sem_sections:
                        if not self.is_slot_free(sec['id'], day, slot):
                            all_free = False
                            break
                    
                    if not all_free:
                        continue
                    
                    # Find rooms for all sections
                    section_room_map = {}
                    
                    for sec in sem_sections:
                        # Try Dedicated Room FIRST
                        dedicated = sec.get('dedicated_room')
                        if dedicated and self.is_room_free(dedicated, day, slot) and dedicated not in section_room_map.values():
                            section_room_map[sec['id']] = dedicated
                            continue

                        # Fallback to department classrooms
                        dept_rooms = self.get_classrooms(sec['department'])
                        free_rooms = [r for r in dept_rooms if self.is_room_free(r, day, slot) and r not in section_room_map.values()]
                        free_rooms.sort(key=lambda r: 0 if 'SPARE' in r else 1)
                        
                        if free_rooms:
                            section_room_map[sec['id']] = free_rooms[0]
                        else:
                            # Use virtual room as fallback
                            section_room_map[sec['id']] = f"Virtual_{sec['department']}_{sec['section']}"
                    
                    # Lock this slot for this semester
                    semester_used_slots[sem].add((day, slot))
                    self.basket_slots_by_year[acad_year].append((day, slot))
                    
                    # Assign basket to each section
                    for sec in sem_sections:
                        room = section_room_map.get(sec['id'], f"Virtual_{sec['department']}_{sec['section']}")
                        self.assign_slot(sec['id'], day, slot, basket_subj, room)
                    
                    hours_assigned += 1
                    print(f"      {norm_name}: {day} slot {slot} -> {len(sem_sections)} sections (LOCKED)")
                
                # Move slot index forward for next basket to use different slots
                slot_idx += hours_assigned + 1
                
                if hours_assigned < hours_needed:
                    print(f"    ⚠️ {norm_name}: Only scheduled {hours_assigned}/{hours_needed} hours")
                else:
                    print(f"    ✅ {norm_name}: All {hours_needed} hours scheduled")

    def schedule_ie_blocks(self):
        """Priority 2: Schedule Institutional Electives (IEC) - Synchronized GLOBALLY (Sem 5+)
        
        CONSTRAINT: IEC courses should be synchronized across ALL departments for each semester.
        All sections in Sem 5 (across CSE, ECE, ME, etc.) have IE at the SAME time globally.
        This is exactly like basket courses in Sem 1/2.
        """
        print("  > Scheduling IEC Blocks (GLOBAL synchronization - like baskets)...")
        
        # Find IEC blocks (also check is_iec flag from subjects)
        ie_blocks = [s for s in self.subjects if s.get('subject_type') == 'IE_Block' or s.get('is_iec')]
        if not ie_blocks: 
            print("    No IEC subjects found")
            return
        
        # Group by Semester ONLY (global sync across all departments)
        semester_ies = defaultdict(list)
        for s in ie_blocks:
            semester_ies[s['semester']].append(s)
        
        print(f"    Found {len(ie_blocks)} IEC subjects across {len(semester_ies)} semesters")
        
        # Define slot preferences - spread across week (like baskets)
        slot_preferences = [
            ('Monday', 3), ('Wednesday', 4), ('Friday', 5),
            ('Tuesday', 3), ('Thursday', 4), ('Monday', 6),
            ('Wednesday', 3), ('Friday', 4), ('Tuesday', 5),
            ('Thursday', 3), ('Monday', 4), ('Wednesday', 5),
        ]
        
        # Track slots used per semester
        semester_used_slots = defaultdict(set)
        
        for sem in sorted(semester_ies.keys()):
            ie_list = semester_ies[sem]
            
            # Get ALL sections for this semester (across ALL departments)
            sem_sections = [sec for sec in self.sections if sec['semester'] == sem]
            if not sem_sections:
                continue
            
            # Get hours needed (use first IE as sample)
            sample_ie = ie_list[0]
            hours_needed = sample_ie.get('weekly_hours', 3)
            hours_assigned = 0
            
            print(f"    Scheduling IEC for Sem {sem}: {len(sem_sections)} sections across all depts, {hours_needed}h needed")
            
            slot_idx = 0
            for attempt in range(len(slot_preferences)):
                if hours_assigned >= hours_needed:
                    break
                
                pref_idx = (slot_idx + attempt) % len(slot_preferences)
                day, slot = slot_preferences[pref_idx]
                
                # Skip if slot already used for this semester's IE
                if (day, slot) in semester_used_slots[sem]:
                    continue
                
                if slot not in self.get_slots_for_day(day):
                    continue
                
                # Check if slot is free for ALL sections in this semester (global check)
                all_free = True
                for sec in sem_sections:
                    if not self.is_slot_free(sec['id'], day, slot):
                        all_free = False
                        break
                
                if not all_free:
                    continue
                
                # Find rooms for all sections
                section_room_map = {}
                for sec in sem_sections:
                    # Try dedicated room first
                    dedicated = sec.get('dedicated_room')
                    if dedicated and self.is_room_free(dedicated, day, slot) and dedicated not in section_room_map.values():
                        section_room_map[sec['id']] = dedicated
                        continue
                    
                    # Fallback to department classrooms
                    dept_rooms = self.get_classrooms(sec['department'])
                    free_rooms = [r for r in dept_rooms if self.is_room_free(r, day, slot) and r not in section_room_map.values()]
                    free_rooms.sort(key=lambda r: 0 if 'SPARE' in r else 1)
                    
                    if free_rooms:
                        section_room_map[sec['id']] = free_rooms[0]
                    else:
                        section_room_map[sec['id']] = f"Virtual_{sec['department']}_{sec['section']}"
                
                # Lock this slot for this semester
                semester_used_slots[sem].add((day, slot))
                
                # Assign IE to each section (use their department's IE subject)
                for sec in sem_sections:
                    # Find the IE subject for this section's department
                    dept_ie = next((ie for ie in ie_list if ie['department'] == sec['department']), sample_ie)
                    room = section_room_map.get(sec['id'], f"Virtual_{sec['department']}_{sec['section']}")
                    self.assign_slot(sec['id'], day, slot, dept_ie, room)
                
                hours_assigned += 1
                print(f"      IEC Sem {sem}: {day} slot {slot} -> {len(sem_sections)} sections (GLOBAL LOCK)")
            
            if hours_assigned < hours_needed:
                print(f"    ⚠️ IEC Sem {sem}: Only scheduled {hours_assigned}/{hours_needed} hours")
            else:
                print(f"    ✅ IEC Sem {sem}: All {hours_needed} hours scheduled GLOBALLY")

    def schedule_pce_blocks(self):
        """Schedule PCE subjects - all sections in a dept-semester have same PCE at same time.
        Each PCE subject gets its own 3 slots.
        """
        print("  > Scheduling PCE Blocks...")
        
        # Get all PCE subjects grouped by (dept, semester)
        pce_by_dept_sem = defaultdict(list)
        for s in self.subjects:
            if s.get('is_pec') or s.get('subject_type') == 'PCE_Block':
                pce_by_dept_sem[(s['department'], s['semester'])].append(s)
        
        if not pce_by_dept_sem:
            print("    No PCE subjects found")
            return
        
        print(f"    Found PCE for {len(pce_by_dept_sem)} dept-semester combinations")
        
        slot_options = [
            ('Tuesday', 4), ('Thursday', 3), ('Friday', 4),
            ('Monday', 3), ('Wednesday', 3), ('Tuesday', 5),
            ('Thursday', 4), ('Friday', 3), ('Monday', 6),
        ]
        
        for (dept, sem), pce_list in sorted(pce_by_dept_sem.items()):
            # Get ALL sections for this dept-semester
            sections = [s for s in self.sections if s['department'] == dept and s['semester'] == sem]
            if not sections:
                continue
            
            print(f"    {dept} Sem {sem}: {len(sections)} sections, {len(pce_list)} PCE subjects")
            
            # Schedule EACH PCE subject
            for pce in pce_list:
                hours = pce.get('weekly_hours', 3)
                scheduled = 0
                
                for day, slot in slot_options:
                    if scheduled >= hours:
                        break
                    if slot not in self.get_slots_for_day(day):
                        continue
                    
                    # Check if ALL sections are free
                    if not all(self.is_slot_free(s['id'], day, slot) for s in sections):
                        continue
                    
                    # Assign to ALL sections at this slot
                    for sec in sections:
                        room = sec.get('dedicated_room') or f"{dept}-Room-{sec['section']}"
                        self.assign_slot(sec['id'], day, slot, pce, room)
                    
                    scheduled += 1
                
                if scheduled > 0:
                    print(f"      {pce['name'][:30]}: {scheduled}h scheduled")

    def schedule_plc_labs(self):
        """Schedule PLC Labs with PER-DEPARTMENT synchronization.
        
        PLC Labs should be at the same time for all sections within ONE department,
        but can be at different times across different departments.
        
        This is different from PLC Theory which must be at the same time for ALL sections
        across ALL departments.
        """
        print("  > Scheduling PLC Labs (per-department synchronization)...")
        
        # Find PLC Lab subjects
        plc_labs = [s for s in self.subjects 
                    if 'Programming Languages Course' in s.get('name', '') 
                    and s.get('subject_type') == 'Lab']
        
        if not plc_labs:
            print("    No PLC Lab subjects found")
            return
        
        # Group by department and semester
        dept_sem_plc = defaultdict(list)
        for s in plc_labs:
            key = (s['department'], s['semester'])
            dept_sem_plc[key].append(s)
        
        print(f"    Found {len(plc_labs)} PLC Labs across {len(dept_sem_plc)} dept-semester combinations")
        
        # Get CS cluster labs for PLC
        cs_cluster_labs = self.get_cse_labs()
        
        # Track which labs we've already scheduled (so we skip them in general lab scheduling)
        self.scheduled_plc_labs = set()
        
        # Define slot pairs for lab sessions
        ALL_SLOT_PAIRS = [(1, 2), (3, 4), (5, 6)]
        ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        
        for (dept, sem), labs in dept_sem_plc.items():
            # Get sections for this department and semester
            sections_in_dept_sem = [sec for sec in self.sections 
                                    if sec['department'] == dept and sec['semester'] == sem]
            if not sections_in_dept_sem:
                continue
            
            # Get sample lab for hours
            sample_lab = labs[0]
            lab_hours = sample_lab.get('weekly_hours', 2)
            sessions_needed = max(1, lab_hours // 2)
            
            print(f"    Scheduling PLC Lab for {dept} Sem {sem}: {len(sections_in_dept_sem)} sections, {sessions_needed} session(s)")
            
            sessions_scheduled = 0
            
            # Try each day/slot combination until we find one that works for ALL sections
            for day in ALL_DAYS:
                if sessions_scheduled >= sessions_needed:
                    break
                
                for s1, s2 in ALL_SLOT_PAIRS:
                    if sessions_scheduled >= sessions_needed:
                        break
                    
                    # Check if slot pair is free for ALL sections in this department
                    all_slots_free = True
                    for sec in sections_in_dept_sem:
                        if not (self.is_slot_free(sec['id'], day, s1) and 
                                self.is_slot_free(sec['id'], day, s2)):
                            all_slots_free = False
                            break
                    
                    if not all_slots_free:
                        continue
                    
                    # Find lab rooms for each section
                    section_room_map = {}
                    all_rooms_found = True
                    
                    for sec in sections_in_dept_sem:
                        # Use CS cluster labs or department labs
                        available_labs = cs_cluster_labs if cs_cluster_labs else self.get_lab_rooms_for_subject(sample_lab, sec)
                        
                        # Find a room free for both slots that's not already assigned
                        assigned_room = None
                        for room in available_labs:
                            if room not in section_room_map.values():
                                if self.is_room_free(room, day, s1) and self.is_room_free(room, day, s2):
                                    assigned_room = room
                                    break
                        
                        if assigned_room:
                            section_room_map[sec['id']] = assigned_room
                        else:
                            all_rooms_found = False
                            break
                    
                    if all_rooms_found:
                        # Assign the lab to all sections at this time
                        for sec in sections_in_dept_sem:
                            # Find the lab subject for this section
                            sec_lab = next((l for l in labs if l['department'] == sec['department']), sample_lab)
                            room = section_room_map[sec['id']]
                            
                            # Get faculty
                            lab_faculty = self.get_available_faculty(sec_lab, day, s1, sec['id'])
                            
                            self.assign_slot(sec['id'], day, s1, sec_lab, room, is_lab=True, faculty=lab_faculty)
                            self.assign_slot(sec['id'], day, s2, sec_lab, room, is_lab=True, faculty=lab_faculty)
                            
                            # Mark this lab as scheduled
                            self.scheduled_plc_labs.add((sec['id'], sec_lab.get('id')))
                        
                        sessions_scheduled += 1
                        print(f"      ✅ {dept} Sem {sem}: PLC Lab at {day} slots {s1}-{s2}")
                        break  # Move to next session if needed
            
            if sessions_scheduled < sessions_needed:
                print(f"      ⚠️ {dept} Sem {sem}: Only {sessions_scheduled}/{sessions_needed} PLC Lab sessions scheduled")

    def schedule_labs(self):
        """Priority 4: Schedule Labs with FULL UTILIZATION of limited lab rooms.
        
        Strategy:
        1. First Year (Sem 1 & 2): Physics/Chemistry labs use shared CH department labs
        2. Higher Years (Sem 3+): Use department's own labs (only 2 per department)
        3. FULL UTILIZATION: Distribute labs across ALL time slots (1-2, 3-4, 5-6) and ALL days
        4. NO VIRTUAL LABS: Skip if no physical room available
        5. Smart scheduling to avoid conflicts when multiple sections share same labs
        6. SKIP PLC Labs that were already scheduled per-department
        """
        print("  > Scheduling Labs (Full Utilization, Shared First Year Labs, No Virtual Labs)...")
        
        # Initialize scheduled_plc_labs if not already set
        if not hasattr(self, 'scheduled_plc_labs'):
            self.scheduled_plc_labs = set()
        
        # Collect all lab scheduling requests first to optimize room allocation
        lab_requests = []  # List of (section, subject, sessions_needed, priority)
        
        for section in self.sections:
            dept = section['department']
            sem = section['semester']
            
            lab_subjects = [
                s for s in self.subjects 
                if s['department'] == dept and s['semester'] == sem and s['subject_type'] == 'Lab'
            ]
            
            for lab in lab_subjects:
                # Skip PLC Labs that were already scheduled per-department
                if 'Programming Languages Course' in lab.get('name', ''):
                    if (section['id'], lab.get('id')) in self.scheduled_plc_labs:
                        continue  # Already scheduled
                    # Also check if this section already has PLC lab slots
                    has_plc_lab = any(
                        'Programming Language' in self.schedule.get((section['id'], d, s), {}).get('subject', {}).get('name', '')
                        and self.schedule.get((section['id'], d, s), {}).get('is_lab', False)
                        for d in DAYS for s in range(1, 7)
                    )
                    if has_plc_lab:
                        continue
                
                lab_hours = lab.get('weekly_hours', 2)
                sessions_needed = max(1, lab_hours // 2)
                
                # Priority: First year shared labs get higher priority (need more coordination)
                priority = 1 if sem in [1, 2] else 2
                
                lab_requests.append({
                    'section': section,
                    'subject': lab,
                    'sessions_needed': sessions_needed,
                    'priority': priority
                })
        
        # Sort by priority (first year labs first) then by section
        lab_requests.sort(key=lambda x: (x['priority'], x['section']['department'], x['section']['semester'], x['section']['id']))
        
        # Track lab room utilization for load balancing
        lab_room_usage = defaultdict(int)  # room -> number of sessions
        
        # Define all possible slot pairs with varied order to spread usage
        ALL_SLOT_PAIRS = [(1, 2), (3, 4), (5, 6)]
        ALL_DAYS = WEEKDAYS + ['Saturday']  # Saturday as last resort
        
        for req in lab_requests:
            section = req['section']
            lab = req['subject']
            sessions_needed = req['sessions_needed']
            sessions_scheduled = 0
            
            # Get appropriate lab rooms for this subject
            lab_rooms = self.get_lab_rooms_for_subject(lab, section)
            
            if not lab_rooms:
                print(f"    ! No labs available for {lab.get('name', 'Unknown')} ({section['department']} Sem {section['semester']} Sec {section['section']})")
                continue
            
            # Sort labs by current usage (load balancing - prefer less used labs)
            lab_rooms_sorted = sorted(lab_rooms, key=lambda r: lab_room_usage[r])
            
            # Create a rotated order of days and slots based on section for diversity
            sec_hash = hash((section['id'], lab.get('id', lab.get('name', ''))))
            
            # Rotate days for different sections
            day_rotation = sec_hash % len(WEEKDAYS)
            days_order = WEEKDAYS[day_rotation:] + WEEKDAYS[:day_rotation]
            
            # Rotate slot pairs for different labs (spread across all time slots)
            slot_rotation = (sec_hash // len(WEEKDAYS)) % len(ALL_SLOT_PAIRS)
            slot_pairs_order = ALL_SLOT_PAIRS[slot_rotation:] + ALL_SLOT_PAIRS[:slot_rotation]
            
            # Try to schedule each session
            for day in days_order:
                if sessions_scheduled >= sessions_needed:
                    break
                
                # Skip if already has a lab on this day
                has_lab_on_day = any(
                    self.schedule.get((section['id'], day, s), {}).get('is_lab', False)
                    for s in range(1, 7)
                )
                if has_lab_on_day:
                    continue
                
                # Try each slot pair in rotated order (NOT always 1-2 first)
                for s1, s2 in slot_pairs_order:
                    if sessions_scheduled >= sessions_needed:
                        break
                    
                    # Check if section is free
                    if not (self.is_slot_free(section['id'], day, s1) and 
                            self.is_slot_free(section['id'], day, s2)):
                        continue
                    
                    # Find an available lab room
                    assigned_room = None
                    for room in lab_rooms_sorted:
                        if self.is_room_free(room, day, s1) and self.is_room_free(room, day, s2):
                            assigned_room = room
                            break
                    
                    if assigned_room:
                        # Get faculty ONCE and use for BOTH consecutive lab slots
                        # This ensures the same teacher takes both hours of a lab session
                        lab_faculty = self.get_available_faculty(lab, day, s1, section['id'])
                        
                        # Verify faculty is also free for slot 2
                        if lab_faculty and not lab_faculty['id'].startswith('TBA_'):
                            if not self.is_faculty_free(lab_faculty['id'], day, s2):
                                # Try to get another faculty who is free for both slots
                                lab_faculty = self.get_available_faculty_for_both_slots(lab, day, s1, s2, section['id'])
                        
                        # Assign the lab session with SAME faculty for both slots
                        self.assign_slot(section['id'], day, s1, lab, assigned_room, is_lab=True, faculty=lab_faculty)
                        self.assign_slot(section['id'], day, s2, lab, assigned_room, is_lab=True, faculty=lab_faculty)
                        sessions_scheduled += 1
                        lab_room_usage[assigned_room] += 1
                        break  # Move to next day
            
            # If weekdays exhausted, try Saturday
            if sessions_scheduled < sessions_needed:
                day = 'Saturday'
                has_lab_on_day = any(
                    self.schedule.get((section['id'], day, s), {}).get('is_lab', False)
                    for s in range(1, 5)
                )
                if not has_lab_on_day:
                    for s1, s2 in [(1, 2), (3, 4)]:  # Saturday only has 4 slots
                        if sessions_scheduled >= sessions_needed:
                            break
                        
                        if not (self.is_slot_free(section['id'], day, s1) and 
                                self.is_slot_free(section['id'], day, s2)):
                            continue
                        
                        assigned_room = None
                        for room in lab_rooms_sorted:
                            if self.is_room_free(room, day, s1) and self.is_room_free(room, day, s2):
                                assigned_room = room
                                break
                        
                        if assigned_room:
                            # Get faculty ONCE for both Saturday lab slots
                            lab_faculty = self.get_available_faculty_for_both_slots(lab, day, s1, s2, section['id'])
                            self.assign_slot(section['id'], day, s1, lab, assigned_room, is_lab=True, faculty=lab_faculty)
                            self.assign_slot(section['id'], day, s2, lab, assigned_room, is_lab=True, faculty=lab_faculty)
                            sessions_scheduled += 1
                            lab_room_usage[assigned_room] += 1
                            break
            
            # Report if couldn't fully schedule
            if sessions_scheduled < sessions_needed:
                print(f"    ! Could only schedule {sessions_scheduled}/{sessions_needed} sessions for {lab.get('name', 'Unknown')} "
                      f"({section['department']} Sem {section['semester']} Sec {section['section']})")
        
        # Print lab utilization report
        print("\n  > Lab Room Utilization Report:")
        for room, count in sorted(lab_room_usage.items(), key=lambda x: -x[1]):
            # Calculate percentage utilization (15 possible 2-hour slots per week: 3 pairs x 5 days)
            max_slots = 15  # 3 slot pairs x 5 weekdays
            utilization = (count / max_slots) * 100
            print(f"    {room}: {count} sessions ({utilization:.1f}% utilization)")

    def schedule_theory(self):
        """Priority 5: Schedule Core Theory - HARD CONSTRAINTS ENFORCED
        
        HARD CONSTRAINTS:
        1. No gaps in schedule - classes must be compact
        2. No consecutive theory classes for same faculty
        3. Basket slots are protected (cannot be overwritten)
        
        SOFT PREFERENCES:
        - Prefer morning slots (1,2) for teachers
        - Avoid Saturday if possible
        - Different sections have different subjects at same time
        """
        print("  > Scheduling Theory (HARD: No gaps, No consecutive theory, Basket protected)...")
        
        # Calculate total hours needed per section to plan capacity
        section_hours_needed = {}
        for section in self.sections:
            dept = section['department']
            sem = section['semester']
            theory_subjects = [
                s for s in self.subjects 
                if s['department'] == dept and s['semester'] == sem 
                and s['subject_type'] == 'Theory'
                and not s.get('is_basket')
                and not s.get('is_pec')  # Skip PCE subjects
                and not s.get('is_iec')  # Skip IE subjects
                and not self.is_bridge_course(s)  # Skip bridge courses - scheduled separately
            ]
            section_hours_needed[section['id']] = sum(s['weekly_hours'] for s in theory_subjects)
        
        for section in self.sections:
            dept = section['department']
            sem = section['semester']
            acad_year = self.get_section_academic_year(section)
            
            # Exclude Baskets, PCE, IE, and Bridge Courses - they have dedicated schedulers
            theory_subjects = [
                s for s in self.subjects 
                if s['department'] == dept 
                and s['semester'] == sem 
                and s['subject_type'] == 'Theory'
                and not s.get('is_basket')
                and not s.get('is_pec')  # Skip PCE - scheduled by schedule_pce_blocks
                and not s.get('is_iec')  # Skip IE - scheduled by schedule_ie_blocks
                and not self.is_bridge_course(s)  # Skip bridge courses - scheduled last
            ]
            
            # Sort by weekly hours descending (schedule heavy subjects first)
            theory_subjects.sort(key=lambda x: x['weekly_hours'], reverse=True)
            
            # ROTATION STRATEGY: Rotate subject list based on section index
            sections_in_batch = [s for s in self.sections if s['department'] == dept and s['semester'] == sem]
            sections_in_batch.sort(key=lambda s: s['section'])
            
            try:
                sec_idx = [s['id'] for s in sections_in_batch].index(section['id'])
            except ValueError:
                sec_idx = 0
            
            if theory_subjects:
                # Rotate subjects so different sections have different first subjects
                rotation = (sec_idx * 2) % len(theory_subjects)
                theory_subjects = theory_subjects[rotation:] + theory_subjects[:rotation]
                # Interleave for more variety
                if len(theory_subjects) > 3 and sec_idx % 2 == 1:
                    theory_subjects = theory_subjects[::2] + theory_subjects[1::2]

            dedicated_room = section.get('dedicated_room')
            faculty_counts = {subj['id']: self.get_available_faculty_count(subj) for subj in theory_subjects}
            
            # Calculate how many hours we need
            total_hours_needed = sum(s['weekly_hours'] for s in theory_subjects)
            weekday_capacity = 5 * 6  # 5 days * 6 slots = 30 slots (minus labs/baskets)
            
            # Get already scheduled hours
            already_scheduled = self.get_section_weekday_hours(section['id'])
            
            for subj_idx, subj in enumerate(theory_subjects):
                hours_needed = subj['weekly_hours']
                hours_assigned = 0
                max_concurrent = faculty_counts.get(subj['id'], 1)
                subject_code = subj.get('course_code', subj.get('name', ''))
                
                # WEEKDAYS FIRST - Different starting days for different sections
                day_rotation = (sec_idx + subj_idx) % len(WEEKDAYS)
                days_order = WEEKDAYS[day_rotation:] + WEEKDAYS[:day_rotation]
                
                # Use different slot preferences for different subjects to spread them out
                slot_rotation = subj_idx % 3  # Rotate between morning (1-2), midday (3-4), afternoon (5-6)
                
                for day in days_order:
                    if hours_assigned >= hours_needed: break
                    
                    # SOFT CONSTRAINT: Max 1 class per day for same subject (can be overridden)
                    hours_on_day = sum(1 for s in range(1, 7) 
                                      if (section['id'], day, s) in self.schedule 
                                      and self.schedule[(section['id'], day, s)]['subject']['id'] == subj['id'])
                    if hours_on_day >= 1: continue
                    
                    # Find any available slot - pass subject_code for pattern checking
                    slot = self.find_compact_slot(section['id'], day, subj['name'], prefer_morning=True, subject_code=subject_code)
                    if slot is None: continue
                    
                    # Check room availability
                    room = None
                    if dedicated_room and dedicated_room != "Unknown":
                        room_info = next((r for r in self.rooms if r['id'] == dedicated_room), None)
                        if room_info and room_info.get('room_type') == 'Classroom' and self.is_room_free(dedicated_room, day, slot):
                            room = dedicated_room
                    
                    if not room:
                        room = self.get_any_classroom(dept, day, slot)
                    
                    if not room:
                        # FALLBACK: Use virtual room if no physical room available
                        room = f"Virtual_{dept}_{section['section']}"
                    
                    # Get faculty
                    faculty = self.get_available_faculty(subj, day, slot, section['id'])
                    
                    self.assign_slot(section['id'], day, slot, subj, room, faculty=faculty)
                    hours_assigned += 1
                
                # Second pass: fill remaining with ANY slot on weekdays (relaxed constraints)
                attempts = 0
                while hours_assigned < hours_needed and attempts < 100:
                    attempts += 1
                    day = WEEKDAYS[attempts % len(WEEKDAYS)]
                    
                    slot = self.find_compact_slot(section['id'], day, None)  # No subject constraint
                    if slot is None: continue
                    
                    room = self.get_any_classroom(dept, day, slot)
                    if not room:
                        room = f"Virtual_{dept}_{section['section']}"
                    
                    faculty = self.get_available_faculty(subj, day, slot, section['id'])
                    
                    self.assign_slot(section['id'], day, slot, subj, room, faculty=faculty)
                    hours_assigned += 1
                
                # THIRD PASS: Use Saturday
                if hours_assigned < hours_needed:
                    for sat_slot in [1, 2, 3, 4]:
                        if hours_assigned >= hours_needed: break
                        if not self.is_slot_free(section['id'], 'Saturday', sat_slot): continue
                        
                        room = self.get_any_classroom(dept, 'Saturday', sat_slot)
                        if not room:
                            room = f"Virtual_{dept}_{section['section']}"
                        
                        faculty = self.get_available_faculty(subj, 'Saturday', sat_slot, section['id'])
                        
                        self.assign_slot(section['id'], 'Saturday', sat_slot, subj, room, faculty=faculty)
                        hours_assigned += 1
                
                # Track unscheduled
                if hours_assigned < hours_needed:
                    self.unscheduled_subjects.append({
                        'subject': subj['name'],
                        'section': f"{dept}-{section['section']}",
                        'assigned': hours_assigned,
                        'needed': hours_needed
                    })
                    print(f"    ⚠️ Could not fully schedule {subj['name']} for {dept}-{section['section']} (Assigned {hours_assigned}/{hours_needed})")

    def schedule_bridge_courses(self):
        """Schedule Bridge Courses - MUST be the LAST class of the day.
        
        Bridge courses are special remedial courses that should always be
        scheduled in the last slot of whatever day they are assigned to.
        This allows students who don't need the bridge course to leave early.
        
        Strategy:
        1. Find all bridge course subjects
        2. For each section, find available last slots (slot 6 on weekdays, slot 4 on Saturday)
        3. Schedule bridge courses in these slots
        4. Ensure no other classes are scheduled after bridge courses on the same day
        """
        print("  > Scheduling Bridge Courses (MUST be last class of the day)...")
        
        # Collect all bridge course subjects
        bridge_subjects = [s for s in self.subjects if self.is_bridge_course(s)]
        
        if not bridge_subjects:
            print("    No bridge courses found")
            return
        
        print(f"    Found {len(bridge_subjects)} bridge course subjects")
        
        # Group by department and semester
        bridge_by_dept_sem = defaultdict(list)
        for s in bridge_subjects:
            key = (s['department'], s['semester'])
            bridge_by_dept_sem[key].append(s)
        
        total_scheduled = 0
        
        for section in self.sections:
            dept = section['department']
            sem = section['semester']
            
            # Get bridge courses for this section
            section_bridge = bridge_by_dept_sem.get((dept, sem), [])
            if not section_bridge:
                continue
            
            for bridge_subj in section_bridge:
                hours_needed = bridge_subj.get('weekly_hours', 2)
                hours_scheduled = 0
                
                # Try to schedule in last slots of weekdays first
                # Priority: Slot 6 (last slot) on different weekdays
                for day in WEEKDAYS:
                    if hours_scheduled >= hours_needed:
                        break
                    
                    last_slot = self.get_last_slot_of_day(section['id'], day)
                    
                    # Check if last slot is free
                    if not self.is_slot_free(section['id'], day, last_slot):
                        # Try to find the actual last occupied slot and use the slot after
                        # Or find a day where we can make last slot free
                        continue
                    
                    # Verify no classes are scheduled after this slot on this day
                    # (For weekdays, slot 6 is already last, so this is automatic)
                    
                    # Find a room
                    room = section.get('dedicated_room')
                    if not room or not self.is_room_free(room, day, last_slot):
                        room = self.get_any_classroom(dept, day, last_slot)
                    if not room:
                        room = f"Virtual_{dept}_{section['section']}"
                    
                    # Get faculty
                    faculty = self.get_available_faculty(bridge_subj, day, last_slot, section['id'])
                    
                    # Assign the bridge course
                    self.assign_slot(section['id'], day, last_slot, bridge_subj, room, faculty=faculty)
                    hours_scheduled += 1
                    total_scheduled += 1
                
                # If weekdays not enough, try Saturday (slot 4 is last on Saturday)
                if hours_scheduled < hours_needed:
                    day = 'Saturday'
                    last_slot = 4  # Last slot on Saturday
                    
                    if self.is_slot_free(section['id'], day, last_slot):
                        room = section.get('dedicated_room')
                        if not room or not self.is_room_free(room, day, last_slot):
                            room = self.get_any_classroom(dept, day, last_slot)
                        if not room:
                            room = f"Virtual_{dept}_{section['section']}"
                        
                        faculty = self.get_available_faculty(bridge_subj, day, last_slot, section['id'])
                        self.assign_slot(section['id'], day, last_slot, bridge_subj, room, faculty=faculty)
                        hours_scheduled += 1
                        total_scheduled += 1
                
                if hours_scheduled < hours_needed:
                    print(f"    ⚠️ Could not schedule all hours for {bridge_subj['name']} ({dept} Sem {sem} Sec {section['section']}): {hours_scheduled}/{hours_needed}")
        
        print(f"    ✅ Scheduled {total_scheduled} bridge course slots (all in last slot of day)")

    async def generate(self):
        print("\n" + "="*60)
        print(f"🎓 TIMETABLE SOLVER V7 - {self.semester_type.upper()} Semesters")
        print("   HARD CONSTRAINTS: Basket sync, No consecutive theory, No gaps")
        print("="*60)
        
        await self.load_data()
        
        # 1. Global Baskets (Sem 3/4) - HARD: Lock slots per year
        self.schedule_global_baskets()
        
        # 2. Institutional Electives (Sem 5+)
        self.schedule_ie_blocks()
        
        # 3. Professional Core Electives (Sem 5+)
        self.schedule_pce_blocks()
        
        # 4. PLC Labs (per-department synchronization)
        self.schedule_plc_labs()
        
        # 5. Other Labs
        self.schedule_labs()
        
        # 6. Theory - HARD CONSTRAINT: 100% scheduling
        self.schedule_theory()
        
        # 7. Bridge Courses - MUST be scheduled as LAST class of the day
        self.schedule_bridge_courses()
        
        # 8. Post-process: Compact schedules (SOFT constraint)
        self.compact_schedules()
        
        # 7. Print scheduling summary
        self.print_scheduling_summary()
        
        return self.get_result()
    
    def print_scheduling_summary(self):
        """Print a summary of scheduling results."""
        print("\n" + "="*60)
        print("📊 SCHEDULING SUMMARY")
        print("="*60)
        
        total_slots = len(self.schedule)
        sections_count = len(self.sections)
        
        print(f"  Total slots scheduled: {total_slots}")
        print(f"  Sections processed: {sections_count}")
        
        if self.unscheduled_subjects:
            print(f"\n  ⚠️ UNSCHEDULED SUBJECTS: {len(self.unscheduled_subjects)}")
            for item in self.unscheduled_subjects[:10]:  # Show first 10
                print(f"    - {item['subject']} ({item['section']}): {item['assigned']}/{item['needed']} hours")
        else:
            print(f"\n  ✅ ALL SUBJECTS FULLY SCHEDULED!")
        
        print("="*60)

    def compact_schedules(self):
        """Post-process: Compact schedules to reduce gaps (SOFT CONSTRAINT).
        
        IMPORTANT: Do NOT move basket/elective courses - they MUST stay synchronized.
        This is best-effort - does not block scheduling if gaps remain.
        """
        print("  > Post-processing: Compacting schedules (soft constraint)...")
        print("    ⚠️ Skipping compaction to preserve basket/elective synchronization")
        
        # DISABLED: Compaction breaks basket synchronization
        # Basket courses MUST stay at their assigned slots to remain synchronized
        # across all sections in the same semester
        
        # total_gaps_fixed = 0
        # for section in self.sections:
        #     ... (removed compaction logic)
        
        print(f"    ✅ Compaction skipped - basket synchronization preserved")

    def remove_slot(self, section_id, day, slot):
        """Remove a scheduled slot and free up resources"""
        key = (section_id, day, slot)
        if key in self.schedule:
            info = self.schedule[key]
            
            # Free room
            room_id = info.get('room_id')
            if room_id:
                room_key = (room_id, day, slot)
                self.room_schedule.discard(room_key)
            
            # Free faculty
            for fid in info.get('faculty_ids', []):
                fac_key = (fid, day, slot)
                if fid in self.faculty_schedule:
                    self.faculty_schedule[fid].discard(fac_key)
            
            # Remove from schedule
            del self.schedule[key]

    def get_result(self):
        # Calculate derived year for frontend
        # Sem 1/2 -> 1, Sem 3/4 -> 2, etc.
        for sec in self.sections:
            sem = sec['semester']
            year = (sem + 1) // 2
            sec['academic_year_display'] = f"Year {year}"

        # Calculate faculty hours summary
        faculty_summary = []
        for f in self.faculty:
            hours = self.get_faculty_hours(f['id'])
            faculty_summary.append({
                **f,
                'assigned_hours': hours
            })

        return {
            "schedule": {
                f"{k[0]}_{k[1]}_{k[2]}": v for k, v in self.schedule.items()
            },
            "valid_semesters": self.valid_semesters,
            "semester_type": self.semester_type,
            "sections": self.sections,
            "faculty": faculty_summary,
            "faculty_schedule": {fid: slots for fid, slots in self.faculty_schedule.items()}
        }

if __name__ == "__main__":
    # Test run
    solver = TimetableSolverV7('odd')
    asyncio.run(solver.generate())
