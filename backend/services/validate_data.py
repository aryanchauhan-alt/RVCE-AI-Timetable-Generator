# Data Validator for CSV files
import os
import csv
from pathlib import Path

class DataValidator:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.errors = []
        self.warnings = []
    
    def validate_all(self):
        """Validate all data files"""
        print("\n📋 Validating data files...")
        
        # Check required files exist
        required_files = [
            "departments.csv",
            "sections_3dept.csv", 
            "subjects_parsed.csv",
            "faculty.csv",
            "rooms_3dept.csv"
        ]
        
        for f in required_files:
            filepath = self.data_dir / f
            if not filepath.exists():
                self.errors.append(f"Missing required file: {f}")
            else:
                print(f"  ✓ Found {f}")
        
        if self.errors:
            return {"valid": False, "errors": self.errors, "warnings": self.warnings}
        
        # Validate data integrity
        self._validate_departments()
        self._validate_sections()
        self._validate_subjects()
        self._validate_faculty()
        self._validate_rooms()
        
        if self.errors:
            print(f"\n❌ Validation failed with {len(self.errors)} errors")
        else:
            print(f"\n✅ All data files are valid!")
        
        return {
            "valid": len(self.errors) == 0,
            "errors": self.errors,
            "warnings": self.warnings
        }
    
    def _read_csv(self, filename):
        """Helper to read CSV file"""
        filepath = self.data_dir / filename
        if not filepath.exists():
            return []
        with open(filepath, 'r') as f:
            return list(csv.DictReader(f))
    
    def _validate_departments(self):
        """Validate departments.csv"""
        depts = self._read_csv("departments.csv")
        if not depts:
            self.errors.append("departments.csv is empty")
            return
        
        ids = set()
        for dept in depts:
            dept_id = dept.get('department_id')
            if not dept_id:
                self.errors.append("Department missing department_id")
            elif dept_id in ids:
                self.errors.append(f"Duplicate department_id: {dept_id}")
            else:
                ids.add(dept_id)
        
        print(f"  ✓ Validated {len(depts)} departments")
    
    def _validate_sections(self):
        """Validate sections_3dept.csv"""
        sections = self._read_csv("sections_3dept.csv")
        if not sections:
            self.errors.append("sections_3dept.csv is empty")
            return
        
        depts = {d.get('department_id') for d in self._read_csv("departments.csv")}
        
        for section in sections:
            dept_id = section.get('department_id')
            if dept_id and dept_id not in depts:
                self.warnings.append(f"Section {section.get('section_id')} references unknown department: {dept_id}")
        
        print(f"  ✓ Validated {len(sections)} sections")
    
    def _validate_subjects(self):
        """Validate subjects_parsed.csv"""
        subjects = self._read_csv("subjects_parsed.csv")
        if not subjects:
            self.errors.append("subjects_parsed.csv is empty")
            return
        print(f"  ✓ Validated {len(subjects)} subjects")
    
    def _validate_faculty(self):
        """Validate faculty.csv"""
        faculty = self._read_csv("faculty.csv")
        if not faculty:
            self.errors.append("faculty.csv is empty")
            return
        print(f"  ✓ Validated {len(faculty)} faculty members")
    
    def _validate_rooms(self):
        """Validate rooms_3dept.csv"""
        rooms = self._read_csv("rooms_3dept.csv")
        if not rooms:
            self.errors.append("rooms_3dept.csv is empty")
            return
        print(f"  ✓ Validated {len(rooms)} rooms")
