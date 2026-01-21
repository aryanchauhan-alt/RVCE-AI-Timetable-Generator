from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # Admin, Teacher, Student
    external_id = Column(String(50), nullable=True)  # TeacherID or Section code
    password_hash = Column(String(128), nullable=False)


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, nullable=False)


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True)
    teacher_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    max_hours = Column(Integer, default=40)
    elective_eligible = Column(Boolean, default=False)


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True)
    room_id = Column(String(50), unique=True, nullable=False)
    building = Column(String(100))
    room_type = Column(String(20), nullable=False)  # Lecture, Lab
    capacity = Column(Integer, default=60)


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True)
    section_code = Column(String(20), unique=True, nullable=False)  # e.g., "1A", "2B"
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    year = Column(Integer, nullable=False)  # 1, 2, 3, 4
    student_count = Column(Integer, default=60)


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True)
    course_code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    weekly_hours = Column(Integer, nullable=False)
    is_lab = Column(Boolean, default=False)
    subject_type = Column(String(20))  # THEORY, LAB, PROJECT, NPTEL, DTL
    elective_group = Column(String(50), nullable=True)  # None, Basket1, Elective1, etc.


class TeacherSubjectMapping(Base):
    __tablename__ = "teacher_subject_mappings"

    id = Column(Integer, primary_key=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True)
    day = Column(String(10), nullable=False)  # Mon, Tue, etc.
    time_slot = Column(String(20), nullable=False)  # 09:00–10:00
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)