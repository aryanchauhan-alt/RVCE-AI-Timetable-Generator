"""
Syllabus PDF Parser
===================
This script will:
1. Read PDF files from data/syllabus/
2. Extract course information (Code, Name, Credits L:T:P) using Table Extraction
3. Convert Credits to Weekly Hours (L + T + P*2 usually, or just P)
4. Update the Supabase 'subjects' table (or generate a new CSV)

Usage:
    python3 backend/parse_syllabus.py
"""

import os
import re
import json
import csv
import pdfplumber
import asyncio
from services.supabase_service import supabase_request

def clean_text(text):
    if not text: return ""
    # Replace newlines with space
    text = str(text).replace('\n', ' ')
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)
    # Remove (Common to ...)
    text = re.sub(r'\(Common to.*?\)', '', text, flags=re.IGNORECASE)
    return text.strip()

def parse_roman_semester(text):
    """Parses Roman numerals like III, IV and words like THIRD, FOURTH to integers."""
    roman_map = {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 
        'VI': 6, 'VII': 7, 'VIII': 8,
        'FIRST': 1, 'SECOND': 2, 'THIRD': 3, 'FOURTH': 4,
        'FIFTH': 5, 'SIXTH': 6, 'SEVENTH': 7, 'EIGHTH': 8
    }
    # Look for "III Semester" or "Semester: III" or "THIRD SEMESTER"
    match = re.search(r'\b(I|II|III|IV|V|VI|VII|VIII|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH)\b', text, re.IGNORECASE)
    if match:
        return roman_map.get(match.group(1).upper(), 0)
    return 0

def extract_courses_from_pdf(pdf_path, department):
    courses = []
    print(f"Parsing {os.path.basename(pdf_path)} for {department}...")
    
    with pdfplumber.open(pdf_path) as pdf:
        current_semester = 0
        
        for page_idx, page in enumerate(pdf.pages):
            # 1. Detect Semester from Page Text
            text = page.extract_text() or ""
            
            # Look for "Semester: III" or "III Semester" in the first few lines
            lines = text.split('\n')[:10]
            for line in lines:
                if 'SEMESTER' in line.upper():
                    sem = parse_roman_semester(line)
                    if sem > 0:
                        current_semester = sem
                        print(f"  [Page {page_idx+1}] Context set to Semester {current_semester}")
                        break
            
            # 2. Extract Tables
            tables = page.extract_tables()
            if not tables:
                continue
                
            for table in tables:
                # Check if this is a Scheme table
                # Header usually has "Course Code", "Course Title", "L", "T", "P", "Credits"
                header_row_idx = -1
                col_map = {}
                
                for r_idx, row in enumerate(table):
                    # Flatten row to string for checking
                    # Replace newlines in cells to ensure matching
                    row_str = " ".join([str(c).replace('\n', ' ') for c in row if c]).lower()
                    
                    # Check for key columns
                    if 'course code' in row_str and ('title' in row_str or 'subject' in row_str):
                        header_row_idx = r_idx
                        # Map columns from main header
                        for c_idx, cell in enumerate(row):
                            if not cell: continue
                            cell_lower = str(cell).lower().replace('\n', ' ')
                            if 'course code' in cell_lower: col_map['code'] = c_idx
                            elif 'title' in cell_lower or 'subject' in cell_lower: col_map['title'] = c_idx
                            elif 'credits' in cell_lower: col_map['credits'] = c_idx
                            
                            # Check for L/T/P in this row too
                            if cell_lower.strip() == 'l': col_map['l'] = c_idx
                            if cell_lower.strip() == 't': col_map['t'] = c_idx
                            if cell_lower.strip() == 'p': col_map['p'] = c_idx

                        # If L/T/P missing, check next row (Multi-row header)
                        if 'l' not in col_map and r_idx + 1 < len(table):
                            next_row = table[r_idx+1]
                            for c_idx, cell in enumerate(next_row):
                                if not cell: continue
                                cell_lower = str(cell).lower().strip()
                                if cell_lower == 'l': col_map['l'] = c_idx
                                elif cell_lower == 't': col_map['t'] = c_idx
                                elif cell_lower == 'p': col_map['p'] = c_idx
                            
                            # If we found them in next row, skip that row for data
                            if 'l' in col_map:
                                header_row_idx += 1 
                        
                        break
                
                if header_row_idx == -1:
                    continue # Not a scheme table
                
                # Require L, T, P columns to avoid Index pages
                if 'l' not in col_map or 't' not in col_map or 'p' not in col_map:
                    continue

                # Process data rows
                for r_idx in range(header_row_idx + 1, len(table)):
                    row = table[r_idx]
                    
                    # Check if we have enough columns
                    if not col_map or max(col_map.values()) >= len(row):
                        continue
                        
                    code = row[col_map.get('code', -1)]
                    title = row[col_map.get('title', -1)]
                    
                    if not code or not title:
                        continue
                        
                    # Clean Code
                    code = clean_text(code)
                    # Validate Code (Must look like a course code, e.g., IS233AI)
                    if not re.match(r'^[A-Z]{2,4}[0-9]{3}[A-Z0-9]{2}$', code):
                        continue
                        
                    # Clean Title
                    title = clean_text(title)
                    if title.lower() in ['course title', 'subject']: continue
                    
                    # Extract L, T, P, C
                    try:
                        l = int(row[col_map.get('l', -1)] or 0)
                        t = int(row[col_map.get('t', -1)] or 0)
                        p = int(row[col_map.get('p', -1)] or 0)
                        c = int(row[col_map.get('credits', -1)] or 0)
                    except ValueError:
                        continue # Skip if numbers are not valid
                        
                    # Calculate weekly hours
                    weekly_hours = l + t + p
                    
                    subject_type = "Theory"
                    if p > 0:
                        subject_type = "Theory+Lab" if (l+t) > 0 else "Lab"
                    
                    # If semester is not set from page context, try to guess from code
                    # e.g. IS233AI -> 3
                    sem = current_semester
                    if sem == 0:
                        try:
                            # Try to find the digit after the first 2 letters?
                            # CS233 -> 3?
                            code_nums = re.search(r'(\d)(\d)(\d)', code)
                            if code_nums:
                                sem = int(code_nums.group(2))
                        except:
                            pass
                    
                    # Add to list
                    courses.append({
                        "course_code": code,
                        "name": title,
                        "department": department,
                        "semester": sem,
                        "weekly_hours": weekly_hours,
                        "subject_type": subject_type,
                        "l": l,
                        "t": t,
                        "p": p,
                        "credits": c
                    })
                    print(f"  Found: {code} - {title} (Sem {sem}) [{l}-{t}-{p}]")

    return courses

async def update_supabase(courses):
    print(f"\nUpdating Supabase with {len(courses)} courses...")
    
    # Save to CSV for the solver to use immediately
    csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'subjects_parsed.csv')
    
    with open(csv_path, 'w') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'name', 'department', 'semester', 'weekly_hours', 'subject_type', 'course_code', 'l', 't', 'p'])
        
        id_counter = 2000
        for c in courses:
            writer.writerow([
                id_counter,
                c['name'],
                c['department'],
                c['semester'],
                c['weekly_hours'],
                c['subject_type'],
                c['course_code'],
                c['l'],
                c['t'],
                c['p']
            ])
            id_counter += 1
            
    print(f"Saved parsed subjects to {csv_path}")

def main():
    syllabus_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'syllabus')
    files = [f for f in os.listdir(syllabus_dir) if f.endswith('.pdf')]
    
    all_courses = []
    
    for f in files:
        dept = 'CSE' # Default
        if 'EC' in f: dept = 'ECE'
        elif 'ME' in f: dept = 'ME'
        elif 'CS' in f: dept = 'CSE'
        
        courses = extract_courses_from_pdf(os.path.join(syllabus_dir, f), dept)
        all_courses.extend(courses)
        
    asyncio.run(update_supabase(all_courses))

if __name__ == "__main__":
    main()
