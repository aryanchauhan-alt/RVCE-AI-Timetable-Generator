"""
Timetable Generation Engine
Generates clash-free timetables matching RVCE reference format
"""

import pandas as pd
import os
from collections import defaultdict

# Days of the week
DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

# Schedulable time slots (excluding breaks)
SCHEDULABLE_SLOTS = [
    "09:00-10:00",
    "10:00-11:00",
    "11:30-12:30",
    "12:30-13:30",
    "14:30-15:30",
    "15:30-16:30"
]


class TimetableEngine:
    """Main timetable generation engine"""
    
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.errors = []
        self.global_basket_slot = None
        
    def load_data(self):
        """Load CSV files and validate data consistency."""
        try:
            faculty_df = pd.read_csv(os.path.join(self.data_dir, "faculty_master - Sheet1.csv"))
            mapping_df = pd.read_csv(os.path.join(self.data_dir, "faculty_course_mapping - Sheet1.csv"))
            rooms_df = pd.read_csv(os.path.join(self.data_dir, "department_rooms - Sheet1.csv"))
            subjects_df = pd.read_csv(os.path.join(self.data_dir, "subjects_rows.csv"))
            departments_df = pd.read_csv(os.path.join(self.data_dir, "departments_rows.csv"))
            
            # Create department code to ID mapping
            dept_code_to_id = dict(zip(departments_df['code'], departments_df['id']))
            
            # Validate mappings against subjects (semester consistency check)
            print("🔍 Validating subject-semester mappings...")
            validation_errors = []
            
            for idx, row in mapping_df.iterrows():
                course_code = row['course_code']
                mapping_semester = row['semester']
                teaching_dept_code = row['teaching_department']
                teaching_dept_id = dept_code_to_id.get(teaching_dept_code)
                
                if teaching_dept_id is None:
                    continue
                
                # Find matching subject by DEPARTMENT + SEMESTER + COURSE_CODE
                subject_match = subjects_df[
                    (subjects_df['course_code'] == course_code) &
                    (subjects_df['semester_id'] == mapping_semester) &
                    (subjects_df['department_id'] == teaching_dept_id)
                ]
                
                if subject_match.empty:
                    # Check if course exists for this department but in different semester
                    dept_course = subjects_df[
                        (subjects_df['course_code'] == course_code) &
                        (subjects_df['department_id'] == teaching_dept_id)
                    ]
                    
                    if not dept_course.empty:
                        actual_semester = dept_course.iloc[0]['semester_id']
                        error_msg = (
                            f"❌ {course_code} in {teaching_dept_code}: "
                            f"Mapped to semester {mapping_semester} but subject data shows semester {actual_semester} "
                            f"(Section: {row['section']})"
                        )
                        validation_errors.append(error_msg)
            
            if validation_errors:
                print(f"\n⚠️  Found {len(validation_errors)} semester mapping errors:")
                for error in validation_errors[:5]:
                    print(f"  {error}")
                if len(validation_errors) > 5:
                    print(f"  ... and {len(validation_errors) - 5} more errors")
                
                self.errors.extend(validation_errors)
            else:
                print("✅ All semester mappings are consistent")
            
            # Add extra rooms
            extra_rooms = []
            for i in range(50):
                extra_rooms.append({
                    'department': 'COMMON',
                    'room_id': f'COMMON-LEC-{i+1}',
                    'room_type': 'Lecture',
                    'capacity': 60
                })
                extra_rooms.append({
                    'department': 'COMMON',
                    'room_id': f'COMMON-LAB-{i+1}',
                    'room_type': 'Lab',
                    'capacity': 30
                })
            rooms_df = pd.concat([rooms_df, pd.DataFrame(extra_rooms)], ignore_index=True)
            
            return faculty_df, mapping_df, rooms_df, subjects_df, departments_df
        except Exception as e:
            self.errors.append(f"Error loading files: {e}")
            return None, None, None, None, None

    def is_basket_course(self, course_name, course_code):
        """Check if course is basket/elective."""
        course_lower = str(course_name).lower()
        code_lower = str(course_code).lower()
        return ('basket' in course_lower or 'elective' in course_lower or 
                'open' in course_lower or 'choice' in code_lower or 'xx' in code_lower)

    def assign_home_room(self, dept, section, rooms):
        """Assign a dedicated home room for a section's core classes."""
        dept_rooms = [r for r in rooms if r.get('department') == dept and r.get('room_type') == 'Lecture']
        if dept_rooms:
            return dept_rooms[0]['room_id']
        
        common_rooms = [r for r in rooms if r.get('department') == 'COMMON' and r.get('room_type') == 'Lecture']
        if common_rooms:
            return common_rooms[0]['room_id']
        
        return f'{dept}-{section}'

    def get_faculty_name(self, faculty_id, faculty_df):
        """Get faculty name from faculty_df"""
        faculty = faculty_df[faculty_df['faculty_id'] == faculty_id]
        if not faculty.empty:
            return faculty.iloc[0]['faculty_name']
        return faculty_id

    def generate_section_timetable(self, dept, semester, section, courses, rooms, faculty_df, subjects_df, dept_id):
        """
        Generate timetable matching reference format:
        - Split Theory+Lab into separate theory and lab sessions
        - Create batch-based lab scheduling (A1, A2, A3)
        - 2-hour lab blocks
        - Proper faculty assignment
        """
        # Initialize timetable
        timetable = {}
        for day in DAYS:
            timetable[day] = {}
            for slot in SCHEDULABLE_SLOTS:
                timetable[day][slot] = []
        
        # Assign home room
        home_room = self.assign_home_room(dept, section, rooms)
        
        # Track constraints
        section_busy = set()  # (day, slot)
        teacher_busy = set()  # (teacher, day, slot)
        course_count_per_day = defaultdict(lambda: defaultdict(int))
        last_slot_per_day = defaultdict(dict)
        
        # Categorize courses by looking up subject_type from subjects_df
        basket_courses = []
        theory_lab_courses = []
        pure_lab_courses = []
        pure_theory_courses = []
        
        for course in courses:
            course_code = course.get('course_code', '')
            course_name = course.get('course_name', '')
            
            # Get actual subject type from subjects_df
            subject_match = subjects_df[
                (subjects_df['course_code'] == course_code) &
                (subjects_df['semester_id'] == semester) &
                (subjects_df['department_id'] == dept_id)
            ]
            
            if not subject_match.empty:
                subject_type = subject_match.iloc[0]['subject_type']
            else:
                # Fallback to mapping course_type
                subject_type = str(course.get('course_type', 'Theory')).strip()
            
            # Add subject_type to course for later use
            course['subject_type'] = subject_type
            
            if self.is_basket_course(course_name, course_code):
                basket_courses.append(course)
            elif 'Theory+Lab' in subject_type:
                theory_lab_courses.append(course)
            elif 'Lab' in subject_type:
                pure_lab_courses.append(course)
            else:
                pure_theory_courses.append(course)
        
        course_legend = {}
        
        # 1. Schedule pure theory courses
        for course in pure_theory_courses:
            self._schedule_theory_class(
                course, timetable, section_busy, teacher_busy,
                course_count_per_day, last_slot_per_day,
                home_room, faculty_df, course_legend
            )
        
        # 2. Schedule Theory+Lab courses (split into theory + lab)
        for course in theory_lab_courses:
            weekly_hours = int(course.get('weekly_hours', 0))
            theory_hours = weekly_hours // 2
            lab_hours = weekly_hours - theory_hours
            
            # Schedule theory portion
            theory_course = course.copy()
            theory_course['weekly_hours'] = theory_hours
            self._schedule_theory_class(
                theory_course, timetable, section_busy, teacher_busy,
                course_count_per_day, last_slot_per_day,
                home_room, faculty_df, course_legend, is_theory_lab=True
            )
            
            # Schedule lab portion with batches
            self._schedule_lab_with_batches(
                course, lab_hours, timetable, section_busy, teacher_busy,
                rooms, faculty_df, dept, section
            )
        
        # 3. Schedule pure lab courses with batches
        for course in pure_lab_courses:
            weekly_hours = int(course.get('weekly_hours', 0))
            faculty_name = self.get_faculty_name(course['faculty_id'], faculty_df)
            course_legend[course['course_code']] = {
                'name': course.get('course_name', ''),
                'faculty': faculty_name,
                'type': 'Lab'
            }
            
            self._schedule_lab_with_batches(
                course, weekly_hours, timetable, section_busy, teacher_busy,
                rooms, faculty_df, dept, section
            )
        
        # 4. Handle basket courses
        if basket_courses:
            if self.global_basket_slot is None:
                self.global_basket_slot = ("FRIDAY", "15:30-16:30")
            
            basket_day, basket_slot = self.global_basket_slot
            
            for basket in basket_courses[:5]:
                course_code = basket['course_code']
                course_name = basket.get('course_name', '')
                faculty_id = basket['faculty_id']
                faculty_name = self.get_faculty_name(faculty_id, faculty_df)
                
                course_legend[course_code] = {
                    'name': course_name,
                    'faculty': faculty_name,
                    'type': 'Basket/Elective'
                }
                
                basket_room = None
                for room in rooms:
                    if room.get('room_type') == 'Lecture':
                        basket_room = room['room_id']
                        break
                
                if basket_room and (basket_day, basket_slot) not in section_busy:
                    entry = {
                        'courseCode': course_code,
                        'courseName': course_name,
                        'facultyId': faculty_id,
                        'facultyName': faculty_name,
                        'room': basket_room,
                        'isLab': False,
                        'duration': 1,
                        'isBasket': True
                    }
                    timetable[basket_day][basket_slot].append(entry)
                    section_busy.add((basket_day, basket_slot))
        
        timetable['_legend'] = course_legend
        timetable['_home_room'] = home_room
        
        return timetable
    
    def _schedule_theory_class(self, course, timetable, section_busy, teacher_busy,
                               course_count_per_day, last_slot_per_day,
                               home_room, faculty_df, course_legend, is_theory_lab=False):
        """Schedule theory classes for a course"""
        weekly_hours = int(course.get('weekly_hours', 0))
        faculty_id = course['faculty_id']
        course_code = course['course_code']
        course_name = course.get('course_name', '')
        
        # Add to legend
        faculty_name = self.get_faculty_name(faculty_id, faculty_df)
        if course_code not in course_legend:
            course_legend[course_code] = {
                'name': course_name,
                'faculty': faculty_name,
                'type': 'Theory+Lab' if is_theory_lab else 'Theory'
            }
        
        # Schedule theory hours
        scheduled = 0
        for day in DAYS:
            if scheduled >= weekly_hours:
                break
            for slot_idx, slot in enumerate(SCHEDULABLE_SLOTS):
                if scheduled >= weekly_hours:
                    break
                
                # Constraints
                if course_count_per_day[course_code][day] >= 2:
                    continue
                if day in last_slot_per_day and course_code in last_slot_per_day[day]:
                    if abs(last_slot_per_day[day][course_code] - slot_idx) == 1:
                        continue
                if (day, slot) in section_busy or (faculty_id, day, slot) in teacher_busy:
                    continue
                
                # Schedule
                entry = {
                    'courseCode': course_code,
                    'courseName': course_name,
                    'facultyId': faculty_id,
                    'facultyName': faculty_name,
                    'room': home_room,
                    'isLab': False,
                    'duration': 1
                }
                timetable[day][slot].append(entry)
                section_busy.add((day, slot))
                teacher_busy.add((faculty_id, day, slot))
                course_count_per_day[course_code][day] += 1
                last_slot_per_day[day][course_code] = slot_idx
                scheduled += 1
    
    def _schedule_lab_with_batches(self, course, lab_hours, timetable, section_busy, 
                                   teacher_busy, rooms, faculty_df, dept, section):
        """
        Schedule lab sessions with batch rotation (A1, A2, A3)
        Each batch gets 2-hour consecutive slots in parallel
        """
        course_code = course['course_code']
        course_name = course.get('course_name', '')
        faculty_id = course['faculty_id']
        faculty_name = self.get_faculty_name(faculty_id, faculty_df)
        
        # Create 3 batches
        batches = ['A1', 'A2', 'A3']
        lab_numbers = ['Lab 1', 'Lab 2', 'Lab 4']
        
        # Find available lab rooms
        lab_rooms = [r for r in rooms if r.get('room_type') == 'Lab']
        if not lab_rooms:
            lab_rooms = [{'room_id': f'{dept}-LAB-{i+1}', 'room_type': 'Lab'} for i in range(3)]
        
        # Calculate number of 2-hour sessions needed
        num_sessions = max(1, lab_hours // 2)
        
        sessions_scheduled = 0
        for day in DAYS:
            if sessions_scheduled >= num_sessions:
                break
            
            for slot_idx in range(len(SCHEDULABLE_SLOTS) - 1):
                if sessions_scheduled >= num_sessions:
                    break
                
                slot1 = SCHEDULABLE_SLOTS[slot_idx]
                slot2 = SCHEDULABLE_SLOTS[slot_idx + 1]
                
                # Check if both slots are free for the section
                if (day, slot1) in section_busy or (day, slot2) in section_busy:
                    continue
                
                # Schedule all 3 batches in parallel (different labs)
                for batch_idx, batch in enumerate(batches):
                    lab_room = lab_rooms[batch_idx % len(lab_rooms)]['room_id']
                    
                    entry = {
                        'courseCode': course_code,
                        'courseName': f"{course_name} Lab",
                        'batch': batch,
                        'labNumber': lab_numbers[batch_idx],
                        'facultyId': faculty_id,
                        'facultyName': faculty_name,
                        'room': lab_room,
                        'isLab': True,
                        'duration': 2
                    }
                    
                    # Add to first slot (duration=2 means it spans both slots)
                    timetable[day][slot1].append(entry)
                
                # Mark slots as busy
                section_busy.add((day, slot1))
                section_busy.add((day, slot2))
                sessions_scheduled += 1

    def generate(self):
        """Generate timetables for all sections."""
        faculty_df, mapping_df, rooms_df, subjects_df, departments_df = self.load_data()
        if faculty_df is None:
            return {"status": "error", "message": "; ".join(self.errors)}
        
        # Check for validation errors before proceeding
        if self.errors:
            return {
                "status": "error",
                "message": "Data validation failed. Please fix semester mapping errors.",
                "errors": self.errors[:10]
            }
        
        # Create department code to ID mapping
        dept_code_to_id = dict(zip(departments_df['code'], departments_df['id']))
        
        all_rooms = rooms_df.to_dict('records')
        result = {"section_timetable": {}}
        stats = {"success": 0, "failed": 0}
        
        # Reset global basket slot
        self.global_basket_slot = None
        
        # Group by dept/semester/section
        groups = mapping_df.groupby(['teaching_department', 'semester', 'section'])
        
        for (dept, sem, sec), group_df in groups:
            courses = group_df.to_dict('records')
            
            # Validate faculty
            valid = True
            for course in courses:
                if pd.isna(course.get('faculty_id')) or str(course.get('faculty_id', '')).strip() == '':
                    valid = False
                    break
            
            if not valid:
                stats["failed"] += 1
                continue
            
            dept_rooms = [r for r in all_rooms 
                         if r.get('department') == dept or r.get('department') == 'COMMON']
            
            # Get dept_id for subject lookup
            dept_id = dept_code_to_id.get(dept)
            
            timetable = self.generate_section_timetable(dept, sem, sec, courses, dept_rooms, faculty_df, subjects_df, dept_id)
            
            # Include semester in key
            section_key = f"{dept}_Sem{sem}_{sec}"
            result["section_timetable"][section_key] = timetable
            stats["success"] += 1
        
        return {
            "status": "success",
            "message": f"Generated {stats['success']} timetables successfully.",
            "stats": stats,
            "timetable": result
        }
