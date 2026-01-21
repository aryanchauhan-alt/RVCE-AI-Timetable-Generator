"""
Service to load and transform CSV data for timetable generation.
Combines Supabase data (departments, subjects) with uploaded CSV files.
"""

import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple
import sys

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

DATA_DIR = Path(__file__).parent.parent.parent / "data"


class DataLoader:
    """Loads and transforms data from CSV files for timetable generation"""
    
    def __init__(self):
        self.departments_df = None
        self.subjects_df = None
        self.faculty_df = None
        self.rooms_df = None
        self.sections_df = None
        self.mapping_df = None
        self.load_all_data()
    
    def load_all_data(self):
        """Load all CSV files"""
        print("📥 Loading data from CSV files...")
        
        # Load Supabase data (actual data - don't modify)
        self.departments_df = pd.read_csv(DATA_DIR / "departments_rows.csv")
        self.subjects_df = pd.read_csv(DATA_DIR / "subjects_rows.csv")
        
        # Load mock data CSV files
        self.faculty_df = pd.read_csv(DATA_DIR / "faculty_master - Sheet1.csv")
        self.rooms_df = pd.read_csv(DATA_DIR / "department_rooms - Sheet1.csv")
        self.sections_df = pd.read_csv(DATA_DIR / "section_master - Sheet1.csv")
        self.mapping_df = pd.read_csv(DATA_DIR / "faculty_course_mapping - Sheet1.csv")
        
        print(f"✅ Loaded {len(self.departments_df)} departments")
        print(f"✅ Loaded {len(self.subjects_df)} subjects")
        print(f"✅ Loaded {len(self.faculty_df)} faculty")
        print(f"✅ Loaded {len(self.rooms_df)} rooms")
        print(f"✅ Loaded {len(self.sections_df)} sections")
        print(f"✅ Loaded {len(self.mapping_df)} faculty-course mappings")
    
    def get_classes_for_scheduling(self) -> pd.DataFrame:
        """
        Transform data into a format suitable for OR-Tools scheduler.
        Returns a DataFrame similar to the old 'classes.csv' format.
        """
        # Merge mapping with subject details
        classes_list = []
        
        # Create department code mapping
        dept_id_to_code = dict(zip(self.departments_df['id'], self.departments_df['code']))
        
        # Merge mapping with subject info
        for _, mapping in self.mapping_df.iterrows():
            teaching_dept_code = mapping['teaching_department']
            teaching_dept_id = None
            
            # Find department ID from code
            for dept_id, dept_code in dept_id_to_code.items():
                if dept_code == teaching_dept_code:
                    teaching_dept_id = dept_id
                    break
            
            if teaching_dept_id is None:
                print(f"⚠️  WARNING: Unknown department {teaching_dept_code}")
                continue
            
            # Find subject by DEPARTMENT + SEMESTER + COURSE_CODE (strict validation)
            subject = self.subjects_df[
                (self.subjects_df['course_code'] == mapping['course_code']) &
                (self.subjects_df['semester_id'] == mapping['semester']) &
                (self.subjects_df['department_id'] == teaching_dept_id)
            ]
            
            if subject.empty:
                print(f"⚠️  WARNING: No subject found for {mapping['course_code']} "
                      f"in department {teaching_dept_code}, semester {mapping['semester']}")
                continue
            
            subject = subject.iloc[0]
            
            # Get faculty details
            faculty = self.faculty_df[
                self.faculty_df['faculty_id'] == mapping['faculty_id']
            ].iloc[0]
            
            # Determine if lab based on course_type
            is_lab = "Lab" in mapping['course_type'] or mapping['course_type'] == "Lab"
            
            # Get section details
            section_info = self.sections_df[
                (self.sections_df['department'] == mapping['teaching_department']) &
                (self.sections_df['section'] == mapping['section']) &
                (self.sections_df['semester'] == mapping['semester'])
            ]
            
            if section_info.empty:
                continue
            
            section_info = section_info.iloc[0]
            
            classes_list.append({
                "SubjectCode": mapping['course_code'],
                "SubjectName": mapping['course_name'],
                "TeacherID": mapping['faculty_id'],
                "TeacherName": faculty['faculty_name'],
                "Department": mapping['teaching_department'],
                "Section": mapping['section'],
                "Year": mapping['academic_year'],
                "IsLab": "Yes" if is_lab else "No",
                "WeeklyHours": int(mapping['weekly_hours']),
                "StudentCount": section_info['student_count'],
                "CourseType": mapping['course_type']
            })
        
        classes_df = pd.DataFrame(classes_list)
        return classes_df
    
    def get_teachers_for_scheduling(self) -> pd.DataFrame:
        """Transform faculty data to old 'teachers.csv' format"""
        teachers_list = []
        
        for _, faculty in self.faculty_df.iterrows():
            teachers_list.append({
                "TeacherID": faculty['faculty_id'],
                "TeacherName": faculty['faculty_name'],
                "Department": faculty['home_department'],
                "MaxHours": faculty['max_hours_per_week'],
                "ElectiveEligible": "Yes" if faculty.get('can_teach_lab', 'No') == "Yes" else "No"
            })
        
        return pd.DataFrame(teachers_list)
    
    def get_rooms_for_scheduling(self) -> pd.DataFrame:
        """Transform rooms data to old 'rooms.csv' format"""
        rooms_list = []
        
        for _, room in self.rooms_df.iterrows():
            rooms_list.append({
                "RoomID": room['room_id'],
                "Building": room.get('department', 'Unknown'),
                "RoomType": room['room_type'],
                "Capacity": room['capacity']
            })
        
        return pd.DataFrame(rooms_list)
    
    def get_all_data(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Returns (teachers_df, rooms_df, classes_df) in format compatible with OR-Tools
        """
        teachers_df = self.get_teachers_for_scheduling()
        rooms_df = self.get_rooms_for_scheduling()
        classes_df = self.get_classes_for_scheduling()
        
        return teachers_df, rooms_df, classes_df

