# backend/main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import io
import csv
from pathlib import Path
from datetime import datetime

backend_dir = Path(__file__).parent
import sys
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from database import Base, engine
from auth import router as auth_router
from services.engine import TimetableEngine
from config import CORS_ORIGINS

app = FastAPI(title="RVCE ERP API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Globals
DATA_DIR = backend_dir.parent / "data"
GENERATED_FILE = DATA_DIR / "master_timetable.json"

# Ensure data dir exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Request Models
class EditSlotRequest(BaseModel):
    section: str
    day: str
    slot: str
    new_course_code: Optional[str] = None
    new_faculty_id: Optional[str] = None
    new_room_id: Optional[str] = None
    reason: str
    edited_by: str

class MarkAbsenceRequest(BaseModel):
    faculty_id: str
    date: str
    slots: List[str]
    substitute_faculty_id: Optional[str] = None

# DB Init
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# ==================== ENDPOINTS ====================

@app.post("/api/generate")
def generate_timetable():
    """
    Generate timetable from existing CSV files in data/ folder.
    No upload required - uses local data.
    """
    try:
        # Step 1: Validate data consistency
        from services.validate_data import DataValidator
        
        print("\n" + "="*60)
        print("STEP 1: DATA VALIDATION")
        print("="*60)
        
        validator = DataValidator(data_dir=str(DATA_DIR))
        validation_result = validator.validate_all()
        
        if not validation_result["valid"]:
            print("\n❌ Data validation failed. Cannot proceed with generation.")
            return {
                "status": "error",
                "message": "Data validation failed. Please fix the errors in your CSV files.",
                "errors": validation_result["errors"][:20],  # Return first 20 errors
                "total_errors": len(validation_result["errors"])
            }
        
        if validation_result["warnings"]:
            print(f"\n⚠️  Proceeding with {len(validation_result['warnings'])} warnings...")
        
        # Step 2: Generate timetable
        print("\n" + "="*60)
        print("STEP 2: TIMETABLE GENERATION")
        print("="*60)
        
        engine = TimetableEngine(data_dir=str(DATA_DIR))
        result = engine.generate()
        
        if result["status"] == "success":
            # Save to disk
            with open(GENERATED_FILE, "w") as f:
                json.dump(result["timetable"], f)
                
            return {
                "status": "success", 
                "message": "Timetable generated successfully.", 
                "stats": result["stats"],
                "warnings": validation_result["warnings"][:10] if validation_result["warnings"] else []
            }
        else:
            return {
                "status": "error", 
                "message": result.get("message", "Generation failed"),
                "errors": result.get("errors", [])
            }
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/timetable")
def get_full_timetable():
    """Returns the complete generated timetable."""
    if not GENERATED_FILE.exists():
        raise HTTPException(status_code=404, detail="No timetable generated yet.")
        
    try:
        with open(GENERATED_FILE, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/timetable/view")
def get_timetable_view(
    view_type: str,  # 'faculty', 'section', 'classroom', 'lab'
    dept: Optional[str] = None,
    program: Optional[str] = None,
    year: Optional[int] = None,
    semester: Optional[int] = None,
    faculty_id: Optional[str] = None,
    room_id: Optional[str] = None,
    section: Optional[str] = None
):
    """
    Get timetable for a specific view with hierarchical filtering.
    """
    if not GENERATED_FILE.exists():
        raise HTTPException(status_code=404, detail="No timetable generated yet.")
    
    try:
        with open(GENERATED_FILE, "r") as f:
            data = json.load(f)
        
        if view_type == "faculty" and faculty_id:
            return {"view": "faculty", "data": data.get("faculty_timetable", {}).get(faculty_id, {})}
        
        elif view_type == "section":
            # Filter by dept/program/year/semester
            section_data = data.get("section_timetable", {})
            if dept:
                # Filter sections by department prefix
                section_data = {k: v for k, v in section_data.items() if k.startswith(dept)}
            return {"view": "section", "data": section_data}
        
        elif view_type in ["classroom", "lab"] and room_id:
            return {"view": view_type, "data": data.get("room_timetable", {}).get(room_id, {})}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid view parameters")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/timetable/edit")
def edit_timetable_slot(request: EditSlotRequest):
    """
    Manually edit a timetable slot.
    Admin or assigned teacher can edit.
    """
    if not GENERATED_FILE.exists():
        raise HTTPException(status_code=404, detail="No timetable generated yet.")
    
    try:
        # Load current timetable
        with open(GENERATED_FILE, "r") as f:
            data = json.load(f)
        
        # Find and update the entry
        section_key = request.section
        if section_key in data.get("section_timetable", {}):
            day_data = data["section_timetable"][section_key].get(request.day, {})
            if request.slot in day_data:
                entries = day_data[request.slot]
                # Update first entry (simplified - in production, specify which entry)
                if entries and len(entries) > 0:
                    old_entry = entries[0].copy()
                    if request.new_course_code:
                        entries[0][0] = request.new_course_code
                    if request.new_room_id:
                        entries[0][1] = request.new_room_id
                    if request.new_faculty_id:
                        entries[0][2] = request.new_faculty_id
                    
                    # Save updated timetable
                    with open(GENERATED_FILE, "w") as f:
                        json.dump(data, f)
                    
                    # Log edit (in production, save to Supabase)
                    return {
                        "status": "success",
                        "message": "Timetable updated",
                        "old": old_entry,
                        "new": entries[0]
                    }
        
        raise HTTPException(status_code=404, detail="Slot not found")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/timetable/mark-absent")
def mark_teacher_absent(request: MarkAbsenceRequest):
    """Mark a teacher as absent and optionally assign substitute."""
    # In production, save to Supabase teacher_absences table
    return {
        "status": "success",
        "message": f"Absence recorded for {request.faculty_id} on {request.date}",
        "substitute": request.substitute_faculty_id
    }

@app.get("/api/filters/departments")
def get_departments():
    """Get all unique departments from data."""
    try:
        import pandas as pd
        # Try to read from departments CSV or faculty mapping
        mapping_df = pd.read_csv(DATA_DIR / "faculty_course_mapping - Sheet1.csv")
        depts = mapping_df['teaching_department'].unique().tolist()
        
        # Define custom ordering (AI-ML first, AE second, then alphabetical)
        priority_order = {'AI-ML': 1, 'AE': 2}
        
        def sort_key(dept):
            return (priority_order.get(dept, 999), dept)
        
        sorted_depts = sorted(depts, key=sort_key)
        return [{"code": d, "name": d} for d in sorted_depts]
    except Exception as e:
        print(f"Error loading departments: {e}")
        return []

@app.get("/api/filters/programs")
def get_programs(dept: str):
    """Get programs (UG/PG) for a department."""
    # Simplified - in production, read from database
    return [
        {"code": "UG", "name": "Under Graduate (B.Tech)"},
        {"code": "PG", "name": "Post Graduate (M.Tech)"}
    ]

@app.get("/api/filters/years")
def get_years(dept: str, program: str):
    """Get academic years for a program."""
    if program == "UG":
        return [{"year": i, "name": f"Year {i}"} for i in range(1, 5)]
    else:
        return [{"year": i, "name": f"Year {i}"} for i in range(1, 3)]

@app.get("/api/filters/semesters")
def get_semesters(dept: str, program: str, year: int):
    """Get semesters for a year."""
    sem_start = (year - 1) * 2 + 1
    return [
        {"semester": sem_start, "name": f"Semester {sem_start}"},
        {"semester": sem_start + 1, "name": f"Semester {sem_start + 1}"}
    ]

@app.get("/api/timetable/download")
def download_timetable(section: str):
    """Download timetable for a section as CSV."""
    if not GENERATED_FILE.exists():
        raise HTTPException(status_code=404, detail="No timetable generated yet.")
    
    try:
        with open(GENERATED_FILE, "r") as f:
            data = json.load(f)
        
        section_data = data.get("section_timetable", {}).get(section, {})
        
        # Convert to CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Day", "Time Slot", "Course", "Room", "Faculty"])
        
        for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]:
            for slot in ["09:00-10:00", "10:00-11:00", "11:30-12:30", "12:30-01:30", "02:30-03:30", "03:30-04:30"]:
                entries = section_data.get(day, {}).get(slot, [])
                for entry in entries:
                    writer.writerow([day, slot, entry[0], entry[1], entry[2]])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={section}_timetable.csv"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount auth router
app.include_router(auth_router)