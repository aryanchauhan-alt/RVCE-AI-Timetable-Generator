"""
API Timetable V7 - Strict Constraints & New Time Structure
==========================================================
- Choose ODD (1,3,5,7) or EVEN (2,4,6,8) semesters
- Labs in lab rooms (consecutive)
- Strict time slots (Mon-Sat)
- Saturday half day
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
import sys
import pandas as pd
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from timetable_solver_v7 import TimetableSolverV7, DAYS, TIME_SLOTS
from database import Base, engine
from auth import router as auth_router
from services.supabase_service import (
    fetch_departments, 
    fetch_faculty, 
    fetch_rooms, 
    fetch_sections,
    fetch_subjects,
    save_timetable_slots,
    fetch_timetable_slots
)

app = FastAPI(title="RVCE Timetable API V7", version="7.0.0")

# Get paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'data')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"🔥 UNHANDLED EXCEPTION: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

# Global state
solver: Optional[TimetableSolverV7] = None
timetable_result: Optional[dict] = None

@app.on_event("startup")
async def on_startup():
    # Base.metadata.create_all(bind=engine)
    # Attempt to restore state
    await restore_timetable_from_db()

# Cache for Supabase data (to avoid repeated async calls in sync endpoints)
_data_cache = {
    'faculty': None,
    'rooms': None,
    'departments': None,
    'departments': None,
    'subjects': None
}

async def restore_timetable_from_db():
    """Restore timetable state from Supabase if available"""
    global timetable_result, solver
    
    # Try to fetch slots
    try:
        slots = await fetch_timetable_slots()
        if not slots:
            return False
            
        print(f"🔄 Restoring {len(slots)} slots from Supabase...")
        
        # Reconstruct schedule
        schedule = {}
        semester_type = slots[0]['semester_type'] if slots else 'odd'
        
        for s in slots:
            key = f"{s['section_id']}_{s['day']}_{s['slot']}"
            schedule[key] = {
                'subject': {
                    'name': s['subject_name'], 
                    'course_code': s['subject_code'],
                    'subject_type': s['subject_type'],
                    'department': s['department'],
                    'semester': s['semester']
                },
                'room': s['room_id'],
                'faculty': {'id': s['faculty_id'], 'name': s['faculty_name']},
                'is_lab': s['is_lab']
            }
            
        # Reconstruct basic solver state (mocking it)
        timetable_result = {
            'schedule': schedule,
            'semester_type': semester_type,
            'valid_semesters': [], # Populate if needed
            'fitness': 1.0
        }
        
        # We also need to init solver sections for get_sections to work
        # This is a bit hacky without full solver init, but works for viewing
        sections_data = await fetch_sections(semester_type)
        # Mock solver to hold sections
        class MockSolver:
            def __init__(self, sex):
                self.sections = []
        
        solver = MockSolver(sections_data)
        solver.sections = [{
            'id': s['id'],
            'department': s['department'],
            'semester': s['semester'],
            'section': s['section']
        } for s in sections_data]
        
        return True
    except Exception as e:
        print(f"⚠️ Failed to restore from DB: {e}")
        return False


async def load_faculty_from_supabase():
    """Load faculty data from Supabase"""
    if _data_cache['faculty'] is None:
        faculty_data = await fetch_faculty()
        _data_cache['faculty'] = [{
            'id': f['faculty_id'],
            'name': f['faculty_name'],
            'department': f['department'],
            'max_hours': int(f.get('max_hours_per_week', 40)),
            'subject_codes': str(f.get('subject_codes', '')).split(',')
        } for f in faculty_data]
    return _data_cache['faculty']

async def load_rooms_from_supabase():
    """Load rooms data from Supabase"""
    if _data_cache['rooms'] is None:
        rooms_data = await fetch_rooms()
        _data_cache['rooms'] = [{
            'id': r['room_id'],
            'department': r['department'],
            'room_type': r['room_type'],
            'capacity': r['capacity']
        } for r in rooms_data]
    return _data_cache['rooms']

async def load_departments_from_supabase():
    """Load departments from Supabase"""
    if _data_cache['departments'] is None:
        dept_data = await fetch_departments()
        _data_cache['departments'] = [{
            'id': int(d['id']),
            'code': d['department_code'],
            'name': d['department_name']
        } for d in dept_data]
    return _data_cache['departments']

def clear_data_cache():
    """Clear the data cache to force refresh from Supabase"""
    global _data_cache
    _data_cache = {
        'faculty': None,
        'rooms': None,
        'departments': None,
        'subjects': None
    }

# Legacy sync functions for backward compatibility (using cached data or event loop)
def load_faculty_from_csv():
    """Load faculty data - tries cache first, then runs async"""
    if _data_cache['faculty']:
        return _data_cache['faculty']
    # Fallback: try to load from CSV for backward compatibility
    faculty_list = []
    faculty_csv_path = os.path.join(DATA_DIR, 'faculty.csv')
    if os.path.exists(faculty_csv_path):
        df = pd.read_csv(faculty_csv_path)
        for _, row in df.iterrows():
            faculty_list.append({
                'id': row['faculty_id'],
                'name': row['faculty_name'],
                'department': row['department'],
                'max_hours': int(row.get('max_hours_per_week', 40)),
                'subject_codes': str(row.get('subject_codes', '')).split(',')
            })
    return faculty_list

def load_rooms_from_csv():
    """Load rooms data - tries cache first, then fallback to CSV"""
    if _data_cache['rooms']:
        return _data_cache['rooms']
    # Fallback: try to load from CSV for backward compatibility
    rooms_list = []
    rooms_csv_path = os.path.join(DATA_DIR, 'rooms_3dept.csv')
    if os.path.exists(rooms_csv_path):
        df = pd.read_csv(rooms_csv_path)
        for _, row in df.iterrows():
            rooms_list.append({
                'id': row['room_id'],
                'department': row['department'],
                'room_type': row['room_type'],
                'capacity': row['capacity']
            })
    return rooms_list

def load_departments_from_csv():
    """Load departments - tries cache first, then fallback to CSV"""
    if _data_cache['departments']:
        return _data_cache['departments']
    # Fallback: try to load from CSV for backward compatibility
    departments_list = []
    dept_csv_path = os.path.join(DATA_DIR, 'departments.csv')
    if os.path.exists(dept_csv_path):
        df = pd.read_csv(dept_csv_path)
        for _, row in df.iterrows():
            departments_list.append({
                'id': int(row['department_id']),
                'code': row['department_code'],
                'name': row['department_name']
            })
    return departments_list

class GenerateRequest(BaseModel):
    semester_type: str = 'odd'  # 'odd' or 'even' or 'all'
    department: Optional[str] = None
    semester: Optional[str] = None
    section: Optional[str] = None

@app.get("/health")
def health():
    global timetable_result
    return {
        "status": "healthy",
        "version": "7.0.0",
        "features": ["odd_even_semesters", "consecutive_labs", "strict_time_slots", "saturday_half_day"],
        "current_semester_type": timetable_result.get('semester_type') if timetable_result else None
    }

@app.get("/api/timetable/departments")
async def get_departments():
    """Get list of all departments from Supabase"""
    try:
        departments = await load_departments_from_supabase()
        return {"departments": departments}
    except Exception as e:
        # Fallback to CSV
        departments = load_departments_from_csv()
        return {"departments": departments}

@app.post("/api/generate")
@app.post("/api/timetable/generate")
async def generate_timetable(request: GenerateRequest = GenerateRequest()):
    """Generate timetable for ODD or EVEN semesters"""
    global solver, timetable_result
    
    print(f"🚀 RECEIVED GENERATE REQUEST: {request.semester_type}")
    
    if request.semester_type not in ['odd', 'even', 'all']:
        raise HTTPException(status_code=400, detail="semester_type must be 'odd', 'even' or 'all'")
    
    try:
        # Clear cache to get fresh data from Supabase
        clear_data_cache()
        
        # Pre-load data into cache for sync endpoints
        await load_faculty_from_supabase()
        await load_rooms_from_supabase()
        await load_departments_from_supabase()
        
        solver = TimetableSolverV7(request.semester_type)
        try:
            timetable_result = await solver.generate()
        except Exception as e:
            print(f"🔥 SOLVER CRASHED: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Solver Failure: {str(e)}")
        
        total_slots = len(timetable_result['schedule'])
        lab_count = sum(1 for v in timetable_result['schedule'].values() 
                       if v.get('is_lab'))
        
        # Save timetable to Supabase
        try:
            slots_to_save = []
            for key, val in timetable_result['schedule'].items():
                parts = key.split('_')
                section_id = int(parts[0])
                day_name = parts[1]
                slot_num = int(parts[2])
                
                subject = val.get('subject') or {}
                faculty = val.get('faculty') or {}
                
                slots_to_save.append({
                    'section_id': section_id,
                    'day': day_name,
                    'slot': slot_num,
                    'subject_name': subject.get('name', ''),
                    'subject_code': subject.get('course_code', ''),
                    'subject_type': subject.get('subject_type', 'Theory'),
                    'room_id': val.get('room', ''),
                    'faculty_id': faculty.get('id', ''),
                    'faculty_name': faculty.get('name', ''),
                    'is_lab': val.get('is_lab', False),
                    'department': subject.get('department', ''),
                    'semester': subject.get('semester', 1),
                    'semester_type': request.semester_type
                })
            
            await save_timetable_slots(slots_to_save, request.semester_type)
            print(f"✅ Saved {len(slots_to_save)} slots to Supabase")
        except Exception as save_error:
            print(f"⚠️ Warning: Could not save to Supabase: {save_error}")
        
        return {
            "success": True,
            "message": f"Timetable generated for {request.semester_type.upper()} semesters",
            "stats": {
                "semester_type": request.semester_type,
                "semesters": timetable_result['valid_semesters'],
                "total_slots": total_slots,
                "lab_slots": lab_count,
                "sections": len(solver.sections),
                "coverage": "N/A"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/timetable/clear")
async def clear_timetable(semester_type: Optional[str] = None):
    """Clear generated timetable slots"""
    try:
        from services.supabase_service import clear_timetable_slots
        await clear_timetable_slots(semester_type)
        global timetable_result
        timetable_result = None
        return {"success": True, "message": "Timetable cleared successfully"}
    except Exception as e:
        print(f"Failed to clear timetable: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/timetable/stats")
async def get_stats():
    global solver, timetable_result
    
    # Load counts from Supabase (or cache)
    try:
        faculty_list = await load_faculty_from_supabase()
        rooms_list = await load_rooms_from_supabase()
    except Exception:
        faculty_list = load_faculty_from_csv()
        rooms_list = load_rooms_from_csv()
    
    if not timetable_result:
        return {
            "generated": False, 
            "message": "No timetable generated yet",
            "faculty_count": len(faculty_list),
            "rooms_count": len(rooms_list)
        }
    
    total_slots = len(timetable_result['schedule'])
    lab_count = sum(1 for v in timetable_result['schedule'].values() if v.get('is_lab'))
    faculty_count = len(faculty_list)
    
    # Count unique subjects from the schedule
    unique_subjects = set()
    for v in timetable_result['schedule'].values():
        subj = v.get('subject', {})
        if subj.get('name'):
            unique_subjects.add(f"{subj.get('name')}_{subj.get('department', '')}")
    
    return {
        "generated": True,
        "semester_type": timetable_result['semester_type'],
        "total_slots": total_slots,
        "lab_slots": lab_count,
        "theory_slots": total_slots - lab_count,
        "faculty_count": faculty_count,
        "sections_count": len(solver.sections) if solver else 0,
        "rooms_count": len(rooms_list),
        "subjects_count": len(unique_subjects)
    }

@app.get("/api/timetable/sections")
async def get_sections(department: Optional[str] = None, semester_type: Optional[str] = None):
    """Get all sections, filtered by department and semester_type (odd/even)"""
    try:
        # Auto-detect semester type from generated result if not explicitly provided
        if not semester_type and timetable_result and 'semester_type' in timetable_result:
            semester_type = timetable_result['semester_type']

        # Use semester_type filter when fetching
        fetch_type = semester_type if semester_type in ['odd', 'even'] else 'all'
        sections = await fetch_sections(fetch_type)
        
        # Filter by department if provided
        if department:
            sections = [s for s in sections if s.get('department') == department]
        
        # Format for frontend with correct field names
        formatted_sections = []
        for s in sections:
            formatted_sections.append({
                'id': s.get('id'),
                'department': s.get('department'),
                'semester': s.get('semester'),
                'section': s.get('section'),
                'academic_year': s.get('academic_year') or ((s.get('semester', 1) + 1) // 2),
                'student_count': s.get('student_count', 60),
                'dedicated_room': s.get('dedicated_room')
            })
            
        return {"sections": formatted_sections}
    except Exception as e:
        print(f"Error fetching sections: {e}")
        # Fallback to solver if available
        global solver
        if solver:
             return {"sections": solver.sections}
        return {"sections": []}

@app.get("/api/timetable/section/{section_id}")
@app.get("/api/timetable/sections/{section_id}")
async def get_section_timetable(section_id: str):
    global timetable_result, solver
    if not timetable_result:
        raise HTTPException(status_code=404, detail="Timetable not generated yet")
    
    # Find section details
    section_info = None
    for sec in solver.sections:
        if str(sec['id']) == section_id:
            section_info = sec
            break
    
    # Filter for this section
    slots = []
    prefix = f"{section_id}_"
    
    for key, val in timetable_result['schedule'].items():
        if key.startswith(prefix):
            # Parse key: section_id_Day_slot
            parts = key.split('_')
            day_name = parts[1]
            slot_num = int(parts[2])
            
            day_index = DAYS.index(day_name) + 1 if day_name in DAYS else 0
            
            slots.append({
                'day': day_index,
                'day_name': day_name,
                'slot': slot_num,
                'time': TIME_SLOTS.get(slot_num, ''),
                'subject': val.get('subject', {}),
                'room': {'name': val.get('room', '')},
                'is_lab': val.get('is_lab', False),
                'faculty': val.get('faculty', {}),
                'section': section_info
            })
    
    # Sort by day and slot
    slots.sort(key=lambda x: (x['day'], x['slot']))
    
    return {"slots": slots, "section": section_info}


@app.get("/api/timetable/rooms")
async def get_rooms():
    global solver
    # Load rooms from Supabase (or cache)
    try:
        rooms = await load_rooms_from_supabase()
    except Exception:
        rooms = load_rooms_from_csv()
    if not rooms and solver:
        rooms = solver.rooms
    return {"rooms": rooms}


@app.get("/api/timetable/rooms/{room_id}")
async def get_room_timetable(room_id: str):
    """Get timetable for a specific room"""
    global timetable_result, solver
    if not timetable_result:
        raise HTTPException(status_code=404, detail="Timetable not generated yet")
    
    slots = []
    
    for key, val in timetable_result['schedule'].items():
        room = val.get('room', '')
        if room == room_id:
            # Parse key: section_id_Day_slot
            parts = key.split('_')
            section_id = parts[0]
            day_name = parts[1]
            slot_num = int(parts[2])
            
            day_index = DAYS.index(day_name) + 1 if day_name in DAYS else 0
            
            # Get section info
            section_info = None
            for sec in solver.sections:
                if str(sec['id']) == section_id:
                    section_info = sec
                    break
            
            slots.append({
                'day': day_index,
                'day_name': day_name,
                'slot': slot_num,
                'time': TIME_SLOTS.get(slot_num, ''),
                'subject': val.get('subject', {}),
                'room': {'name': room},
                'is_lab': val.get('is_lab', False),
                'faculty': val.get('faculty', {}),
                'section': section_info
            })
    
    # Sort by day and slot
    slots.sort(key=lambda x: (x['day'], x['slot']))
    
    return {"slots": slots, "room": room_id}


@app.get("/api/timetable/faculty")
async def get_faculty():
    """Get list of all faculty members with their assigned hours"""
    global solver, timetable_result
    
    # Load faculty from Supabase (or cache)
    try:
        faculty_list = await load_faculty_from_supabase()
    except Exception:
        faculty_list = load_faculty_from_csv()
    
    # Count hours per faculty from schedule if timetable exists
    faculty_hours = {}
    if timetable_result:
        for val in timetable_result['schedule'].values():
            faculty = val.get('faculty', {})
            fid = faculty.get('id')
            if fid:
                faculty_hours[fid] = faculty_hours.get(fid, 0) + 1
    
    # Add assigned hours to each faculty
    for f in faculty_list:
        f['assigned_hours'] = faculty_hours.get(f['id'], 0)
    
    return {"faculty": faculty_list}


@app.get("/api/timetable/faculty/{faculty_id}")
async def get_faculty_timetable(faculty_id: str):
    """Get timetable for a specific faculty member"""
    global timetable_result, solver
    
    # Find faculty info (try Supabase first)
    try:
        faculty_list = await load_faculty_from_supabase()
    except:
        faculty_list = load_faculty_from_csv()
    faculty_info = None
    for f in faculty_list:
        if f['id'] == faculty_id:
            faculty_info = f
            break
    
    if not timetable_result:
        return {"slots": [], "faculty": faculty_info or {"id": faculty_id, "name": faculty_id}}
    
    slots = []
    
    for key, val in timetable_result['schedule'].items():
        faculty = val.get('faculty', {})
        # Match by faculty ID or name
        if faculty.get('id') == faculty_id or faculty.get('name') == faculty_id:
            # Parse key: section_id_Day_slot
            parts = key.split('_')
            section_id = parts[0]
            day_name = parts[1]
            slot_num = int(parts[2])
            
            day_index = DAYS.index(day_name) + 1 if day_name in DAYS else 0
            
            # Get section info
            section_info = None
            if solver:
                for sec in solver.sections:
                    if str(sec['id']) == section_id:
                        section_info = sec
                        break
            
            slots.append({
                'day': day_index,
                'day_name': day_name,
                'slot': slot_num,
                'time': TIME_SLOTS.get(slot_num, ''),
                'subject': val.get('subject', {}),
                'room': {'name': val.get('room', '')},
                'is_lab': val.get('is_lab', False),
                'faculty': faculty,
                'section': section_info
            })
    
    # Sort by day and slot
    slots.sort(key=lambda x: (x['day'], x['slot']))
    
    return {"slots": slots, "faculty": faculty_info or {"id": faculty_id, "name": faculty_id}}


@app.get("/api/timetable/faculty-schedule/{faculty_id}")
async def get_faculty_schedule(faculty_id: str):
    """Get detailed schedule for a specific faculty member with total hours"""
    global timetable_result, solver
    if not timetable_result:
        raise HTTPException(status_code=404, detail="Timetable not generated yet")
    
    slots = []
    
    # Find faculty info
    try:
        faculty_list = await load_faculty_from_supabase()
    except:
        faculty_list = load_faculty_from_csv()
    faculty_info = None
    for f in faculty_list:
        if f['id'] == faculty_id:
            faculty_info = f
            break
    
    if not timetable_result:
        return {
            "slots": [], 
            "faculty": faculty_info or {"id": faculty_id, "name": faculty_id},
            "total_hours": 0
        }
    
    for key, val in timetable_result['schedule'].items():
        faculty = val.get('faculty', {})
        # Match by faculty ID
        if faculty.get('id') == faculty_id:
            # Parse key: section_id_Day_slot
            parts = key.split('_')
            section_id = parts[0]
            day_name = parts[1]
            slot_num = int(parts[2])
            
            day_index = DAYS.index(day_name) + 1 if day_name in DAYS else 0
            
            # Get section info
            section_info = None
            if solver:
                for sec in solver.sections:
                    if str(sec['id']) == section_id:
                        section_info = sec
                        break
            
            slots.append({
                'day': day_index,
                'day_name': day_name,
                'slot': slot_num,
                'time': TIME_SLOTS.get(slot_num, ''),
                'subject': val.get('subject', {}),
                'room': {'name': val.get('room', '')},
                'is_lab': val.get('is_lab', False),
                'faculty': faculty,
                'section': section_info
            })
    
    # Sort by day and slot
    slots.sort(key=lambda x: (x['day'], x['slot']))
    
    return {
        "slots": slots, 
        "faculty": faculty_info or {"id": faculty_id, "name": faculty_id},
        "total_hours": len(slots)
    }


@app.get("/api/timetable/all")
async def get_all_timetables():
    """Get all timetables organized by section"""
    global timetable_result, solver
    if not timetable_result:
        raise HTTPException(status_code=404, detail="Timetable not generated yet")
    
    # Organize by section
    sections_data = {}
    
    for sec in solver.sections:
        sec_id = str(sec['id'])
        sections_data[sec_id] = {
            'info': sec,
            'slots': []
        }
    
    for key, val in timetable_result['schedule'].items():
        parts = key.split('_')
        section_id = parts[0]
        day_name = parts[1]
        slot_num = int(parts[2])
        
        day_index = DAYS.index(day_name) + 1 if day_name in DAYS else 0
        
        if section_id in sections_data:
            sections_data[section_id]['slots'].append({
                'day': day_index,
                'day_name': day_name,
                'slot': slot_num,
                'time': TIME_SLOTS.get(slot_num, ''),
                'subject': val.get('subject', {}),
                'room': {'name': val.get('room', '')},
                'is_lab': val.get('is_lab', False),
                'faculty': val.get('faculty', {})
            })
    
    # Sort slots
    for sec_id in sections_data:
        sections_data[sec_id]['slots'].sort(key=lambda x: (x['day'], x['slot']))
    
    return {
        "sections": sections_data,
        "semester_type": timetable_result.get('semester_type'),
        "total_sections": len(solver.sections)
    }


# ==================== SUBJECTS ENDPOINT ====================

@app.get("/api/timetable/subjects")
async def get_subjects(
    department: str = Query(None, description="Filter by department code"),
    semester: int = Query(None, description="Filter by semester")
):
    """Get all subjects, optionally filtered by department and semester"""
    
    # Try Supabase first
    try:
        raw_subjects = await fetch_subjects('all')
        
        # We need department map to resolve ID to code/name
        try:
            raw_depts = await load_departments_from_supabase()
        except:
             raw_depts = load_departments_from_csv()
             
        dept_map = {d['id']: d['code'] for d in raw_depts}
        
        subjects = []
        for s in raw_subjects:
            # Apply filters if params provided
            if semester and s['semester'] != semester:
                continue
                
            subj_dept_code = dept_map.get(s['department_id'], 'Unknown')
            if department and subj_dept_code != department:
                continue
                
            theory_hours = s.get('lecture_hours', 0)
            lab_hours = s.get('practical_hours', 0)
            subject_type = 'Lab' if lab_hours > 0 and theory_hours == 0 else ('Theory + Lab' if lab_hours > 0 else 'Theory')
            
            subjects.append({
                'id': s['subject_code'],
                'code': s['subject_code'],
                'name': s['subject_name'],
                'theory_hours': theory_hours,
                'lab_hours': lab_hours,
                'weekly_hours': theory_hours + (lab_hours * 2),
                'credits': s['credits'],
                'semester': s['semester'],
                'department_id': s['department_id'],
                'department': subj_dept_code,
                'type': subject_type,
                'is_pec': s.get('is_pec', False),
                'is_iec': s.get('is_iec', False),
                'is_basket': s.get('is_basket', False),
                'category': str(s.get('subject_type', ''))
            })
            
        if subjects:
            return {"subjects": subjects}
            
    except Exception as e:
        print(f"Supabase fetch failed: {e}")
        pass

    # Fallback to CSV (legacy code)
    subjects_csv_path = os.path.join(DATA_DIR, 'subjects_parsed.csv')
    
    if not os.path.exists(subjects_csv_path):
        return {"subjects": []}
    
    df = pd.read_csv(subjects_csv_path)
    
    # Load departments for mapping
    dept_map = {}
    dept_csv_path = os.path.join(DATA_DIR, 'departments.csv')
    if os.path.exists(dept_csv_path):
        dept_df = pd.read_csv(dept_csv_path)
        for _, d in dept_df.iterrows():
            dept_map[int(d['department_id'])] = d['department_code']
    
    # Apply filters
    if department:
        dept_row = [k for k, v in dept_map.items() if v == department]
        if dept_row:
            df = df[df['department_id'] == dept_row[0]]
    
    if semester:
        df = df[df['semester'] == semester]
    
    subjects = []
    for _, row in df.iterrows():
        theory_hours = int(row.get('theory_hours', 0) if pd.notna(row.get('theory_hours')) else 0)
        lab_hours = int(row.get('lab_hours', 0) if pd.notna(row.get('lab_hours')) else 0)
        subject_type = 'Lab' if lab_hours > 0 and theory_hours == 0 else ('Theory + Lab' if lab_hours > 0 else 'Theory')
        
        subjects.append({
            'id': str(row.get('subject_code', '')),
            'code': str(row.get('subject_code', '')),
            'name': str(row.get('subject_name', '')),
            'theory_hours': theory_hours,
            'lab_hours': lab_hours,
            'weekly_hours': theory_hours + (lab_hours * 2),  # Lab hours count as 2 slots each
            'credits': int(row.get('credits', 3) if pd.notna(row.get('credits')) else 3),
            'semester': int(row.get('semester', 1)),
            'department_id': int(row.get('department_id', 1)),
            'department': dept_map.get(int(row.get('department_id', 1)), 'Unknown'),
            'type': subject_type,
            'is_pec': bool(row.get('is_pec', False)),
            'is_iec': bool(row.get('is_iec', False)),
            'is_basket': bool(row.get('is_basket', False)),
            'category': str(row.get('category', ''))
        })
    
    return {"subjects": subjects}


# ==================== MANUAL EDIT ENDPOINT ====================

class ManualEditRequest(BaseModel):
    section_id: int
    changes: List[dict]
    timetable: List[dict]

@app.post("/api/timetable/manual-edit")
async def manual_edit_timetable(request: ManualEditRequest):
    """Apply manual edits to a section's timetable"""
    global timetable_result, solver
    
    if not solver or not timetable_result:
        raise HTTPException(status_code=400, detail="No timetable generated yet")
    
    section_id = request.section_id
    
    # Remove existing slots for this section
    keys_to_remove = [k for k in solver.schedule.keys() if k[0] == section_id]
    for key in keys_to_remove:
        del solver.schedule[key]
    
    # Add new slots from manual edit
    for slot in request.timetable:
        day_name = slot.get('day_name', '')
        slot_num = slot.get('slot', 0)
        
        # Normalize day name
        day_upper = day_name.upper() if day_name else ''
        day_map = {
            'MONDAY': 'Monday', 'TUESDAY': 'Tuesday', 'WEDNESDAY': 'Wednesday',
            'THURSDAY': 'Thursday', 'FRIDAY': 'Friday', 'SATURDAY': 'Saturday'
        }
        normalized_day = day_map.get(day_upper, day_name)
        
        key = (section_id, normalized_day, slot_num)
        
        solver.schedule[key] = {
            'subject': slot.get('subject', {}),
            'room': slot.get('room', {}).get('name', 'TBD'),
            'faculty': slot.get('faculty', {}),
            'is_lab': slot.get('is_lab', False)
        }
    
    # Regenerate result
    timetable_result = solver.get_result()
    
    return {
        "success": True,
        "message": f"Applied {len(request.changes)} changes to section {section_id}",
        "section_id": section_id
    }


# ==================== CONSTRAINT VALIDATION ENDPOINTS ====================

class ValidateSlotRequest(BaseModel):
    section_id: int
    day: str
    slot: int
    subject_code: str
    faculty_id: Optional[str] = None

@app.post("/api/timetable/validate-slot")
async def validate_slot_assignment(request: ValidateSlotRequest):
    """Validate if a slot assignment is valid according to constraints"""
    global timetable_result, solver
    
    conflicts = []
    warnings = []
    
    if not solver or not timetable_result:
        return {"valid": True, "conflicts": [], "warnings": [{"message": "No timetable generated - validation skipped"}]}
    
    section_id = request.section_id
    day = request.day
    slot = request.slot
    subject_code = request.subject_code
    faculty_id = request.faculty_id
    
    # 1. Check if slot is already occupied
    slot_key = f"{section_id}_{day}_{slot}"
    if slot_key in timetable_result.get('schedule', {}):
        warnings.append({"message": f"Slot {day} {TIME_SLOTS.get(slot, '')} is already occupied and will be replaced"})
    
    # 2. Check faculty availability and hours
    if faculty_id:
        faculty_slots = []
        for key, val in timetable_result.get('schedule', {}).items():
            fac = val.get('faculty', {})
            if fac.get('id') == faculty_id:
                parts = key.split('_')
                if len(parts) >= 3:
                    faculty_slots.append({'day': parts[1], 'slot': int(parts[2])})
        
        # Check if faculty is busy at this time
        for fs in faculty_slots:
            if fs['day'] == day and fs['slot'] == slot:
                conflicts.append({"message": f"Faculty is already teaching at {day} slot {slot}"})
                break
        
        # Check faculty max hours
        try:
            faculty_list = await load_faculty_from_supabase()
        except:
            faculty_list = load_faculty_from_csv()
        
        faculty_info = next((f for f in faculty_list if f['id'] == faculty_id), None)
        if faculty_info:
            max_hours = faculty_info.get('max_hours', 40)
            current_hours = len(faculty_slots)
            if current_hours >= max_hours:
                conflicts.append({"message": f"Faculty has reached maximum hours ({max_hours})"})
    
    # 3. Check consecutive same subject
    for check_slot in [slot - 1, slot + 1]:
        check_key = f"{section_id}_{day}_{check_slot}"
        if check_key in timetable_result.get('schedule', {}):
            existing = timetable_result['schedule'][check_key]
            existing_code = existing.get('subject', {}).get('course_code', '')
            if existing_code == subject_code:
                warnings.append({"message": f"Same subject in consecutive slots (slot {check_slot})"})
    
    # 4. Check max 1 theory per day for same subject
    same_subject_count = 0
    for s in range(1, 7):
        check_key = f"{section_id}_{day}_{s}"
        if check_key in timetable_result.get('schedule', {}):
            existing = timetable_result['schedule'][check_key]
            existing_code = existing.get('subject', {}).get('course_code', '')
            if existing_code == subject_code and s != slot:
                same_subject_count += 1
    
    if same_subject_count >= 1:
        warnings.append({"message": f"Subject {subject_code} already scheduled on {day}"})
    
    return {
        "valid": len(conflicts) == 0,
        "conflicts": conflicts,
        "warnings": warnings
    }


@app.get("/api/timetable/faculty-for-subject/{subject_code}")
async def get_faculty_for_subject(subject_code: str):
    """Get list of faculty members who can teach a specific subject"""
    try:
        faculty_list = await load_faculty_from_supabase()
    except:
        faculty_list = load_faculty_from_csv()
    
    matching_faculty = []
    for f in faculty_list:
        subject_codes = f.get('subject_codes', [])
        if isinstance(subject_codes, str):
            subject_codes = [s.strip() for s in subject_codes.split(',')]
        
        # Check if this faculty can teach the subject
        if subject_code in subject_codes or any(subject_code.startswith(sc.strip()) for sc in subject_codes if sc):
            matching_faculty.append(f)
    
    # If no specific matches, return faculty from same department (first 3 chars of code usually indicate dept)
    if not matching_faculty:
        # Get all faculty and let frontend filter
        matching_faculty = faculty_list
    
    # Add current assigned hours
    if timetable_result:
        for f in matching_faculty:
            hours = sum(1 for val in timetable_result.get('schedule', {}).values() 
                       if val.get('faculty', {}).get('id') == f['id'])
            f['assigned_hours'] = hours
    
    return {"faculty": matching_faculty[:50]}  # Limit to 50


@app.get("/api/timetable/section-summary/{section_id}")
async def get_section_summary(section_id: int):
    """Get summary of a section's scheduled hours per subject"""
    global timetable_result, solver
    
    if not timetable_result or not solver:
        return {"scheduled_hours": {}, "total_hours": 0}
    
    # Count hours per subject for this section
    subject_hours = {}
    total_hours = 0
    
    prefix = f"{section_id}_"
    for key, val in timetable_result.get('schedule', {}).items():
        if key.startswith(prefix):
            subject = val.get('subject', {})
            code = subject.get('course_code', subject.get('id', 'Unknown'))
            if code:
                subject_hours[code] = subject_hours.get(code, 0) + 1
                total_hours += 1
    
    return {
        "section_id": section_id,
        "scheduled_hours": subject_hours,
        "total_hours": total_hours
    }


# Mount auth router
app.include_router(auth_router)

if __name__ == "__main__":
    uvicorn.run("api_timetable_v7:app", host="0.0.0.0", port=8000, reload=False)
