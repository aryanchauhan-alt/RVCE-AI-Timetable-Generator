"""
Supabase Service - Backend API for Supabase Database Operations
Uses Supabase REST API for reliable data access
"""

import os
import httpx
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv(override=True)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "https://mmkkmjsqrqwfkbazznaw.supabase.co")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ta2ttanNxcnF3ZmtiYXp6bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjIwMTMsImV4cCI6MjA4MTY5ODAxM30.i197JgWC9Sz0VLmxFHj7YBP2WHkYHEpU-d22xP_Wkq0")

print(f"DEBUG: Using Supabase URL: {SUPABASE_URL}")

def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

# ============================================
# DEPARTMENTS
# ============================================

async def fetch_departments() -> List[Dict]:
    """Fetch all departments from Supabase"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/departments?select=*&order=id",
            headers=get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return []

async def add_department(department_code: str, department_name: str) -> Dict:
    """Add a new department"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/departments",
            headers=get_headers(),
            json={"department_code": department_code, "department_name": department_name}
        )
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data[0] if isinstance(data, list) else data
        return None

async def update_department(id: int, department_code: str, department_name: str) -> Dict:
    """Update a department"""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/departments?id=eq.{id}",
            headers=get_headers(),
            json={"department_code": department_code, "department_name": department_name}
        )
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if isinstance(data, list) and data else None
        return None

async def delete_department(id: int) -> bool:
    """Delete a department"""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/departments?id=eq.{id}",
            headers=get_headers()
        )
        return resp.status_code in [200, 204]

# ============================================
# FACULTY
# ============================================

async def fetch_faculty() -> List[Dict]:
    """Fetch all faculty from Supabase"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/faculty?select=*&order=faculty_name",
            headers=get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return []

async def add_faculty(faculty_data: Dict) -> Dict:
    """Add a new faculty member"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/faculty",
            headers=get_headers(),
            json=faculty_data
        )
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data[0] if isinstance(data, list) else data
        return None

async def update_faculty(id: int, faculty_data: Dict) -> Dict:
    """Update a faculty member"""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/faculty?id=eq.{id}",
            headers=get_headers(),
            json=faculty_data
        )
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if isinstance(data, list) and data else None
        return None

async def delete_faculty(id: int) -> bool:
    """Delete a faculty member"""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/faculty?id=eq.{id}",
            headers=get_headers()
        )
        return resp.status_code in [200, 204]

# ============================================
# ROOMS
# ============================================

async def fetch_rooms() -> List[Dict]:
    """Fetch all rooms from Supabase"""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/rooms?select=*&order=room_id",
            headers=get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return []

async def add_room(room_data: Dict) -> Dict:
    """Add a new room"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/rooms",
            headers=get_headers(),
            json=room_data
        )
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data[0] if isinstance(data, list) else data
        return None

async def update_room(id: int, room_data: Dict) -> Dict:
    """Update a room"""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/rooms?id=eq.{id}",
            headers=get_headers(),
            json=room_data
        )
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if isinstance(data, list) and data else None
        return None

async def delete_room(id: int) -> bool:
    """Delete a room"""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/rooms?id=eq.{id}",
            headers=get_headers()
        )
        return resp.status_code in [200, 204]

# ============================================
# SECTIONS
# ============================================

async def fetch_sections(semester_type: str = 'all') -> List[Dict]:
    """Fetch sections from Supabase, optionally filtered by semester type"""
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/sections?select=*&order=department,semester,section"
        if semester_type == 'odd':
            url += "&semester=in.(1,3,5,7)"
        elif semester_type == 'even':
            url += "&semester=in.(2,4,6,8)"
        
        resp = await client.get(url, headers=get_headers())
        if resp.status_code == 200:
            return resp.json()
        return []

async def add_section(section_data: Dict) -> Dict:
    """Add a new section"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/sections",
            headers=get_headers(),
            json=section_data
        )
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data[0] if isinstance(data, list) else data
        return None

async def update_section(id: int, section_data: Dict) -> Dict:
    """Update a section"""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/sections?id=eq.{id}",
            headers=get_headers(),
            json=section_data
        )
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if isinstance(data, list) and data else None
        return None

async def delete_section(id: int) -> bool:
    """Delete a section"""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/sections?id=eq.{id}",
            headers=get_headers()
        )
        return resp.status_code in [200, 204]

# ============================================
# SUBJECTS
# ============================================

async def fetch_subjects(semester_type: str = 'all') -> List[Dict]:
    """Fetch subjects from Supabase, optionally filtered by semester type"""
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/subjects?select=*&order=department_id,semester"
        if semester_type == 'odd':
            url += "&semester=in.(1,3,5,7)"
        elif semester_type == 'even':
            url += "&semester=in.(2,4,6,8)"
        
        resp = await client.get(url, headers=get_headers())
        if resp.status_code == 200:
            return resp.json()
        return []

async def add_subject(subject_data: Dict) -> Dict:
    """Add a new subject"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/subjects",
            headers=get_headers(),
            json=subject_data
        )
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data[0] if isinstance(data, list) else data
        return None

async def update_subject(id: int, subject_data: Dict) -> Dict:
    """Update a subject"""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/subjects?id=eq.{id}",
            headers=get_headers(),
            json=subject_data
        )
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if isinstance(data, list) and data else None
        return None

async def delete_subject(id: int) -> bool:
    """Delete a subject"""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/subjects?id=eq.{id}",
            headers=get_headers()
        )
        return resp.status_code in [200, 204]

# ============================================
# TIMETABLE SLOTS
# ============================================

async def save_timetable_slots(slots: List[Dict], semester_type: str) -> int:
    """Save generated timetable slots to Supabase."""
    print(f"💾 Saving {len(slots)} timetable slots to Supabase...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Clear existing slots for this semester type
        await client.delete(
            f"{SUPABASE_URL}/rest/v1/timetable_slots?semester_type=eq.{semester_type}",
            headers=get_headers()
        )
        
        # Add semester_type to each slot
        for slot in slots:
            slot['semester_type'] = semester_type
        
        # Insert in batches of 100
        inserted = 0
        batch_size = 100
        for i in range(0, len(slots), batch_size):
            batch = slots[i:i+batch_size]
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/timetable_slots",
                headers=get_headers(),
                json=batch
            )
            if resp.status_code in [200, 201]:
                inserted += len(batch)
        
        print(f"✅ Saved {inserted} timetable slots")
        return inserted

async def fetch_timetable_slots(semester_type: str = None, section_id: int = None, 
                                 department: str = None) -> List[Dict]:
    """Fetch timetable slots from Supabase"""
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/timetable_slots?select=*&order=section_id,day,slot"
        
        if semester_type:
            url += f"&semester_type=eq.{semester_type}"
        if section_id:
            url += f"&section_id=eq.{section_id}"
        if department:
            url += f"&department=eq.{department}"
        
        resp = await client.get(url, headers=get_headers())
        if resp.status_code == 200:
            return resp.json()
        return []

async def clear_timetable_slots(semester_type: str = None) -> bool:
    """Clear timetable slots"""
    async with httpx.AsyncClient() as client:
        url = f"{SUPABASE_URL}/rest/v1/timetable_slots"
        if semester_type:
            url += f"?semester_type=eq.{semester_type}"
        else:
            url += "?id=gt.0"  # Delete all
        
        resp = await client.delete(url, headers=get_headers())
        return resp.status_code in [200, 204]

async def update_timetable_slot(id: int, slot_data: Dict) -> Dict:
    """Update a single timetable slot"""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/timetable_slots?id=eq.{id}",
            headers=get_headers(),
            json=slot_data
        )
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if isinstance(data, list) and data else None
        return None

# ============================================
# UTILITY FUNCTIONS
# ============================================

async def fetch_all_data(semester_type: str = 'all') -> Dict:
    """Fetch all data needed for timetable generation"""
    departments = await fetch_departments()
    faculty = await fetch_faculty()
    rooms = await fetch_rooms()
    sections = await fetch_sections(semester_type)
    subjects = await fetch_subjects(semester_type)
    
    return {
        'departments': departments,
        'faculty': faculty,
        'rooms': rooms,
        'sections': sections,
        'subjects': subjects
    }

async def get_stats() -> Dict:
    """Get database statistics"""
    async with httpx.AsyncClient() as client:
        stats = {}
        tables = ['departments', 'faculty', 'rooms', 'sections', 'subjects', 'timetable_slots']
        
        for table in tables:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/{table}?select=count",
                headers={**get_headers(), "Prefer": "count=exact"}
            )
            if resp.status_code == 200:
                count = resp.headers.get("content-range", "*/0").split("/")[-1]
                stats[table] = int(count) if count != "*" else 0
            else:
                stats[table] = 0
        
        return stats
