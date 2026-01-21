import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Loader2, Building2, Info, RefreshCw,
  CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Clock, Users, BookOpen, GraduationCap, Wand2,
  DoorOpen, User, Database, FileSpreadsheet, Sparkles, Filter
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import RVCETimetableGrid from '../components/RVCETimetableGrid';
import RVCEUniversalGrid from '../components/RVCEUniversalGrid';
import ManualAdjustment from '../components/ManualAdjustment';

const API_BASE = 'http://localhost:8000/api/timetable';

// Time slots configuration (V7)
const TIME_SLOTS = {
  1: "09:00-10:00",
  2: "10:00-11:00",
  3: "11:30-12:30",
  4: "12:30-01:30",
  5: "02:30-03:30",
  6: "03:30-04:30"
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Department colors for dynamic departments
const DEPT_COLORS = [
  { color: 'bg-blue-600', lightColor: 'bg-blue-50', textColor: 'text-blue-600' },
  { color: 'bg-emerald-600', lightColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
  { color: 'bg-amber-600', lightColor: 'bg-amber-50', textColor: 'text-amber-600' },
  { color: 'bg-purple-600', lightColor: 'bg-purple-50', textColor: 'text-purple-600' },
  { color: 'bg-rose-600', lightColor: 'bg-rose-50', textColor: 'text-rose-600' },
  { color: 'bg-cyan-600', lightColor: 'bg-cyan-50', textColor: 'text-cyan-600' },
  { color: 'bg-orange-600', lightColor: 'bg-orange-50', textColor: 'text-orange-600' },
  { color: 'bg-indigo-600', lightColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
  { color: 'bg-teal-600', lightColor: 'bg-teal-50', textColor: 'text-teal-600' },
  { color: 'bg-pink-600', lightColor: 'bg-pink-50', textColor: 'text-pink-600' },
  { color: 'bg-lime-600', lightColor: 'bg-lime-50', textColor: 'text-lime-600' },
  { color: 'bg-sky-600', lightColor: 'bg-sky-50', textColor: 'text-sky-600' },
  { color: 'bg-fuchsia-600', lightColor: 'bg-fuchsia-50', textColor: 'text-fuchsia-600' },
  { color: 'bg-violet-600', lightColor: 'bg-violet-50', textColor: 'text-violet-600' },
  { color: 'bg-red-600', lightColor: 'bg-red-50', textColor: 'text-red-600' },
];

// Data source information
const DATA_SOURCES = {
  rooms: { file: 'data/rooms_3dept.csv', count: 64, description: 'Classrooms and Labs' },
  sections: { file: 'data/sections_3dept.csv', count: 37, description: 'Student Sections' },
  subjects: { file: 'data/subjects_parsed.csv', count: 154, description: 'Courses across semesters' },
  faculty: { file: 'data/faculty.csv', count: 60, description: 'Faculty members (Max 40hrs/week)' }
};

export default function TimetableViewV2() {
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [timetable, setTimetable] = useState(null);
  const [ieSlots, setIeSlots] = useState([]);
  const [basketSlots, setBasketSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);
  const [semesterType, setSemesterType] = useState('odd'); // 'odd' or 'even'
  const [showDataInfo, setShowDataInfo] = useState(false);

  // View Mode: 'section' | 'room' | 'teacher' | 'faculty'
  const [viewMode, setViewMode] = useState('section');

  // Room view state
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomTimetable, setRoomTimetable] = useState(null);

  // Teacher/Subject view state
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectTimetable, setSubjectTimetable] = useState(null);

  // Faculty view state
  const [faculty, setFaculty] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultyTimetable, setFacultyTimetable] = useState(null);

  // Manual adjustment state
  const [manualAdjustMode, setManualAdjustMode] = useState(false);

  // Departments state (loaded from API)
  const [departments, setDepartments] = useState([]);

  // Load initial data
  useEffect(() => {
    loadDepartments();
    loadStats();
    loadSections();
    loadRooms();
    loadFaculty();
  }, []);

  // Load departments from API
  const loadDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/departments`);
      const data = await res.json();
      // Add colors to departments
      const depts = (data.departments || []).map((dept, idx) => ({
        ...dept,
        ...DEPT_COLORS[idx % DEPT_COLORS.length]
      }));
      setDepartments(depts);
      // Set first department as default if available
      if (depts.length > 0 && !selectedDept) {
        setSelectedDept(depts[0].code);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  // Load sections when department or semesterType changes
  useEffect(() => {
    loadSections();
    setSelectedSection(null);
    setTimetable(null);
  }, [selectedDept, semesterType]);

  // Load rooms
  const loadRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms`);
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    }
  };

  // Load faculty
  const loadFaculty = async () => {
    try {
      const res = await fetch(`${API_BASE}/faculty`);
      const data = await res.json();
      setFaculty(data.faculty || []);
    } catch (err) {
      console.error('Failed to load faculty:', err);
    }
  };

  // Load all unique subjects from generated timetable
  const loadSubjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/all`);
      const data = await res.json();

      // Extract unique subjects from all sections
      const subjectMap = new Map();
      Object.values(data.sections || {}).forEach(section => {
        section.slots?.forEach(slot => {
          const subj = slot.subject;
          if (subj && subj.name) {
            const key = `${subj.name}_${subj.department || ''}`;
            if (!subjectMap.has(key)) {
              subjectMap.set(key, {
                name: subj.name,
                code: subj.course_code,
                department: subj.department,
                semester: subj.semester,
                type: slot.is_lab ? 'Lab' : 'Theory'
              });
            }
          }
        });
      });

      setSubjects(Array.from(subjectMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ));
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  };

  // Load when view mode changes to teacher
  useEffect(() => {
    if (viewMode === 'teacher' && subjects.length === 0) {
      loadSubjects();
    }
  }, [viewMode]);

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      setStats(data);
      if (data.semester_type) {
        setSemesterType(data.semester_type);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadSections = async () => {
    try {
      const res = await fetch(`${API_BASE}/sections?department=${selectedDept}&semester_type=${semesterType}`);
      const data = await res.json();
      setSections(data.sections || []);
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  };

  const loadIESlots = async () => {
    try {
      const res = await fetch(`${API_BASE}/institutional-electives`);
      const data = await res.json();
      setIeSlots(data.institutional_electives || []);
    } catch (err) {
      console.error('Failed to load IE slots:', err);
    }
  };

  const loadBasketSlots = async () => {
    try {
      const res = await fetch(`${API_BASE}/basket-courses`);
      const data = await res.json();
      setBasketSlots(data.basket_courses || []);
    } catch (err) {
      console.error('Failed to load basket slots:', err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester_type: semesterType })
      });

      const data = await res.json();

      if (data.success) {
        await loadStats();
        await loadSections();
        setSelectedSection(null);
        setTimetable(null);
      } else {
        setError(data.detail || 'Generation failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const loadSectionTimetable = async (sectionId) => {
    setLoading(true);
    setSelectedSection(sectionId);

    try {
      const res = await fetch(`${API_BASE}/section/${sectionId}`);
      const data = await res.json();
      setTimetable(data);
    } catch (err) {
      setError('Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomTimetable = async (roomId) => {
    setLoading(true);
    setSelectedRoom(roomId);

    try {
      const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}`);
      const data = await res.json();
      setRoomTimetable(data);
    } catch (err) {
      setError('Failed to load room timetable');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectTimetable = async (subjectName) => {
    setLoading(true);
    setSelectedSubject(subjectName);

    try {
      const res = await fetch(`${API_BASE}/faculty/${encodeURIComponent(subjectName)}`);
      const data = await res.json();
      setSubjectTimetable(data);
    } catch (err) {
      setError('Failed to load subject timetable');
    } finally {
      setLoading(false);
    }
  };

  const loadFacultyTimetable = async (facultyId) => {
    setLoading(true);
    setSelectedFaculty(facultyId);

    try {
      const res = await fetch(`${API_BASE}/faculty-schedule/${encodeURIComponent(facultyId)}`);
      const data = await res.json();
      setFacultyTimetable(data);
    } catch (err) {
      setError('Failed to load faculty timetable');
    } finally {
      setLoading(false);
    }
  };

  // Build grid for Room/Teacher view - handles multiple entries per slot
  const buildTimetableGrid = (slots) => {
    const grid = {};
    DAYS.forEach(day => {
      grid[day] = {};
      [1, 2, 3, 4, 5, 6].forEach(slot => {
        grid[day][slot] = [];
      });
    });

    slots?.forEach(slot => {
      const dayName = slot.day_name;
      const slotNum = slot.slot;
      if (grid[dayName] && grid[dayName][slotNum]) {
        grid[dayName][slotNum].push(slot);
      }
    });

    return grid;
  };

  // Group sections by year
  const sectionsByYear = sections.reduce((acc, section) => {
    // Use display string from backend or derive from semester
    const year = section.academic_year_display
      ? section.academic_year_display.replace('Year ', '')
      : Math.ceil(section.semester / 2);

    if (!acc[year]) acc[year] = [];
    acc[year].push(section);
    return acc;
  }, {});

  const getSlotColor = (slot) => {
    if (!slot || !slot.subject) return 'bg-gray-50';
    if (slot.is_institutional_elective) return 'bg-purple-100 border-purple-300';
    if (slot.is_basket) return 'bg-amber-100 border-amber-300';
    if (slot.is_lab) return 'bg-green-100 border-green-300';
    return 'bg-blue-50 border-blue-200';
  };

  const getSlotBadge = (slot) => {
    if (slot.is_institutional_elective) {
      return <Badge className="bg-purple-500 text-white text-xs">IE</Badge>;
    }
    if (slot.is_basket) {
      return <Badge className="bg-amber-500 text-white text-xs">BC</Badge>;
    }
    if (slot.is_lab) {
      return <Badge className="bg-green-500 text-white text-xs">Lab</Badge>;
    }
    return null;
  };

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        {/* Header with Generate Button */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-accent-navy">Timetable Management</h1>
            <p className="text-text-secondary mt-1">Generate and view timetables for all departments</p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-accent-navy hover:bg-navy/90 text-accent-gold px-6 py-2 rounded-lg shadow-card hover:shadow-soft transition-all duration-300 font-medium tracking-wide uppercase text-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Timetable
              </>
            )}
          </Button>
        </div>

        {/* Filters Row - Matching Faculty/Rooms Page Style */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* View Mode */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={viewMode} onValueChange={setViewMode}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="View" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section">Section</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="teacher">Subject</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
              <Select value={selectedDept || ''} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.code} value={dept.code}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Section Filter (if section view) */}
              {viewMode === 'section' && sections.length > 0 && (
                <Select value={selectedSection || ''} onValueChange={loadSectionTimetable}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(sec => (
                      <SelectItem key={sec.id} value={sec.id.toString()}>
                        {sec.department} Year {sec.academic_year} - {sec.section} (Sem {sec.semester})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Room Filter (if room view) */}
              {viewMode === 'room' && (
                <Select value={selectedRoom || ''} onValueChange={loadRoomTimetable}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>{room.id} - {room.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Subject Filter (if teacher/subject view) */}
              {viewMode === 'teacher' && (
                <Select value={selectedSubject || ''} onValueChange={loadSubjectTimetable}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subj, idx) => (
                      <SelectItem key={`${subj.name}-${idx}`} value={subj.name}>{subj.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Faculty Filter (if faculty view) */}
              {viewMode === 'faculty' && (
                <Select value={selectedFaculty || ''} onValueChange={loadFacultyTimetable}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select Faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {faculty.map(fac => (
                      <SelectItem key={fac.id} value={fac.id.toString()}>{fac.name} ({fac.department})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Semester Type Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1 ml-auto">
                <button
                  onClick={() => setSemesterType('odd')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${semesterType === 'odd'
                    ? 'bg-accent-navy text-white shadow-sm'
                    : 'text-text-secondary hover:bg-gray-200'
                    }`}
                >
                  ODD (1,3,5,7)
                </button>
                <button
                  onClick={() => setSemesterType('even')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${semesterType === 'even'
                    ? 'bg-accent-navy text-white shadow-sm'
                    : 'text-text-secondary hover:bg-gray-200'
                    }`}
                >
                  EVEN (2,4,6,8)
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {stats && stats.generated && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="shadow-card border-none">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-navy/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-accent-navy" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Total Slots</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{stats.total_slots || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-none">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-gold/10 rounded-lg">
                    <Users className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Sections</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{stats.sections_count || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-none">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-navy/5 rounded-lg">
                    <Clock className="w-5 h-5 text-navy" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Lab Slots</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{stats.lab_slots || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-none">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-navy/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-accent-navy" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Theory Slots</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{stats.theory_slots || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-none">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-gold/10 rounded-lg">
                    <DoorOpen className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Rooms</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{stats.rooms_count || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card border-none">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-navy/5 rounded-lg">
                    <BookOpen className="w-5 h-5 text-navy" />
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Subjects</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{stats.subjects_count || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Faculty Card was duplicating generic icons, consolidated or kept relevant ones */}
          </div>
        )}


        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Selection based on view mode */}
          <div className="col-span-3">
            {viewMode === 'section' && (
              <>
                {/* Department Tabs */}
                <Card className="mb-4 shadow-card border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-serif text-accent-navy">Select Department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {departments.map(dept => (
                        <button
                          key={dept.code}
                          onClick={() => setSelectedDept(dept.code)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all border ${selectedDept === dept.code
                            ? 'bg-accent-navy text-white border-accent-navy shadow-md'
                            : 'bg-white hover:bg-bg-primary text-text-secondary border-transparent hover:border-gray-200'
                            }`}
                        >
                          <div className="font-semibold">{dept.code}</div>
                          <div className="text-sm opacity-80">{dept.name}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Sections by Year */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Sections - {selectedDept}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(sectionsByYear).sort(([a], [b]) => a - b).map(([year, yearSections]) => (
                      <div key={year} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                          className="w-full px-4 py-2 bg-gray-50 flex items-center justify-between hover:bg-gray-100"
                        >
                          <span className="font-medium">Year {year}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{yearSections.length} sections</Badge>
                            {expandedYear === year ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </button>
                        {expandedYear === year && (
                          <div className="p-2 space-y-1">
                            {yearSections.map(section => (
                              <button
                                key={section.id}
                                onClick={() => loadSectionTimetable(section.id)}
                                className={`w-full text-left px-3 py-2 rounded transition-all ${selectedSection === section.id
                                  ? 'bg-blue-500 text-white'
                                  : 'hover:bg-gray-100'
                                  }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{section.section}</span>
                                  <span className="text-sm opacity-70">Sem {section.semester}</span>
                                </div>
                                <div className="text-xs opacity-60">Room: {section.dedicated_room}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}

            {viewMode === 'room' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-green-600" />
                    Select Room
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {departments.map(dept => {
                    const deptRooms = rooms.filter(r => r.department === dept.code);
                    if (deptRooms.length === 0) return null;
                    return (
                      <div key={dept.code} className="mb-4">
                        <div className="font-semibold text-gray-700 mb-2 px-2">{dept.code}</div>
                        <div className="space-y-1">
                          {deptRooms.map(room => (
                            <button
                              key={room.id}
                              onClick={() => loadRoomTimetable(room.id)}
                              className={`w-full text-left px-3 py-2 rounded transition-all ${selectedRoom === room.id
                                ? 'bg-green-500 text-white'
                                : 'hover:bg-gray-100'
                                }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{room.id}</span>
                                <Badge variant="outline" className="text-xs">
                                  {room.room_type}
                                </Badge>
                              </div>
                              <div className="text-xs opacity-60">Capacity: {room.capacity}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {viewMode === 'teacher' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    Select Subject
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {subjects.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <p>Generate a timetable first to see subjects</p>
                    </div>
                  ) : (
                    departments.map(dept => {
                      const deptSubjects = subjects.filter(s => s.department === dept.code);
                      if (deptSubjects.length === 0) return null;
                      return (
                        <div key={dept.code} className="mb-4">
                          <div className="font-semibold text-gray-700 mb-2 px-2">{dept.code}</div>
                          <div className="space-y-1">
                            {deptSubjects.map((subject, idx) => (
                              <button
                                key={`${subject.name}-${idx}`}
                                onClick={() => loadSubjectTimetable(subject.name)}
                                className={`w-full text-left px-3 py-2 rounded transition-all ${selectedSubject === subject.name
                                  ? 'bg-purple-500 text-white'
                                  : 'hover:bg-gray-100'
                                  }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-sm">{subject.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {subject.type}
                                  </Badge>
                                </div>
                                <div className="text-xs opacity-60">
                                  {subject.code} | Sem {subject.semester}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {viewMode === 'faculty' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-orange-600" />
                    Select Faculty
                  </CardTitle>
                  <CardDescription className="text-xs">Max 40 hours/week per faculty</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                  {faculty.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <p>No faculty data available</p>
                    </div>
                  ) : (
                    departments.map(dept => {
                      const deptFaculty = faculty.filter(f => f.department === dept.code);
                      if (deptFaculty.length === 0) return null;
                      return (
                        <div key={dept.code} className="mb-4">
                          <div className="font-semibold text-gray-700 mb-2 px-2">{dept.code}</div>
                          <div className="space-y-1">
                            {deptFaculty.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => loadFacultyTimetable(f.id)}
                                className={`w-full text-left px-3 py-2 rounded transition-all ${selectedFaculty === f.id
                                  ? 'bg-orange-500 text-white'
                                  : 'hover:bg-gray-100'
                                  }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-sm">{f.name}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${(f.assigned_hours || 0) > 35
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-green-50 text-green-700 border-green-200'
                                      }`}
                                  >
                                    {f.assigned_hours || 0}h
                                  </Badge>
                                </div>
                                <div className="text-xs opacity-60">
                                  {f.id} | Max: {f.max_hours}h
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Timetable Area */}
          <div className="col-span-9">
            {loading ? (
              <Card className="h-96 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </Card>
            ) : viewMode === 'section' && timetable ? (
              <div className="space-y-4">
                {/* Manual Adjustment Toggle */}
                <div className="flex justify-end">
                  <Button
                    variant={manualAdjustMode ? "default" : "outline"}
                    onClick={() => setManualAdjustMode(!manualAdjustMode)}
                    className={manualAdjustMode ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    {manualAdjustMode ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Exit Manual Mode
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Manual Adjust
                      </>
                    )}
                  </Button>
                </div>

                {manualAdjustMode ? (
                  <ManualAdjustment
                    sectionId={selectedSection}
                    sectionName={sections.find(s => s.id === selectedSection)?.section}
                    department={selectedDept}
                    semester={sections.find(s => s.id === selectedSection)?.semester}
                    onClose={() => setManualAdjustMode(false)}
                  />
                ) : (
                  <RVCETimetableGrid
                    section={sections.find(s => s.id === selectedSection)?.section}
                    program={departments.find(d => d.code === selectedDept)?.name}
                    semester={sections.find(s => s.id === selectedSection)?.semester}
                    classroom={sections.find(s => s.id === selectedSection)?.dedicated_room}
                    timetableData={timetable}
                  />
                )}
              </div>
            ) : viewMode === 'room' && roomTimetable ? (
              <RVCEUniversalGrid
                title="Room TimeTable"
                info={{
                  'Room ID': selectedRoom,
                  'Room Type': rooms.find(r => r.id === selectedRoom)?.room_type || 'Classroom',
                  'Capacity': rooms.find(r => r.id === selectedRoom)?.capacity || 'N/A',
                  'Scheduled Slots': `${roomTimetable.slots?.length || 0} classes`
                }}
                slots={roomTimetable.slots}
                viewType="room"
              />
            ) : viewMode === 'teacher' && subjectTimetable ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" />
                    Subject: {selectedSubject}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    {subjectTimetable.slots?.length || 0} scheduled slots across all sections
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border p-2 bg-gray-100 font-semibold">Time</th>
                          {DAYS.map(day => (
                            <th key={day} className="border p-2 bg-gray-100 font-semibold">
                              {day.slice(0, 3)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5, 6].map(slotNum => {
                          const grid = buildTimetableGrid(subjectTimetable.slots);
                          return (
                            <tr key={slotNum}>
                              <td className="border p-2 bg-gray-50 font-medium">
                                {TIME_SLOTS[slotNum]}
                              </td>
                              {DAYS.map(day => {
                                const slots = grid[day]?.[slotNum] || [];
                                const hasSlots = slots.length > 0;
                                return (
                                  <td
                                    key={`${day}-${slotNum}`}
                                    className={`border p-2 ${hasSlots ? 'bg-purple-50' : 'bg-white'
                                      }`}
                                  >
                                    {hasSlots ? (
                                      <div className="space-y-1">
                                        {slots.map((slot, idx) => (
                                          <div key={idx} className={idx > 0 ? 'border-t pt-1 mt-1' : ''}>
                                            <div className="font-semibold text-xs">
                                              {slot.section?.department} - {slot.section?.section}
                                            </div>
                                            {slot.faculty?.name && slot.faculty.name !== 'TBA' && (
                                              <div className="text-xs text-purple-600">
                                                👨‍🏫 {slot.faculty.name}
                                              </div>
                                            )}
                                            <div className="text-xs text-gray-600">
                                              🚪 {slot.room?.name || 'N/A'}
                                            </div>
                                            {slot.is_lab && (
                                              <Badge className="bg-green-500 text-white text-xs">Lab</Badge>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-gray-300 text-center">-</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* List view of all slots */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">All Scheduled Sessions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {subjectTimetable.slots?.map((slot, idx) => (
                        <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">
                                {slot.section?.department} - {slot.section?.section}
                              </div>
                              <div className="text-sm text-gray-600">
                                Sem {slot.section?.semester}
                              </div>
                            </div>
                            {slot.is_lab && (
                              <Badge className="bg-green-500">Lab</Badge>
                            )}
                          </div>
                          <div className="mt-2 text-sm">
                            <div>📅 {slot.day_name} - {slot.time}</div>
                            {slot.faculty?.name && slot.faculty.name !== 'TBA' && (
                              <div>👨‍🏫 Faculty: {slot.faculty.name}</div>
                            )}
                            <div>🚪 Room: {slot.room?.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : viewMode === 'faculty' && facultyTimetable ? (
              <RVCEUniversalGrid
                title="Faculty TimeTable"
                info={{
                  'Faculty ID': selectedFaculty,
                  'Faculty Name': faculty.find(f => f.id === selectedFaculty)?.name || 'N/A',
                  'Department': faculty.find(f => f.id === selectedFaculty)?.department || 'N/A',
                  'Hours Used': `${facultyTimetable.total_hours || 0} / 40`
                }}
                slots={facultyTimetable.slots}
                viewType="faculty"
              />
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  {viewMode === 'section' && (
                    <>
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Select a section to view timetable</p>
                    </>
                  )}
                  {viewMode === 'room' && (
                    <>
                      <DoorOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Select a room to view its schedule</p>
                    </>
                  )}
                  {viewMode === 'teacher' && (
                    <>
                      <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Select a subject to view where it's taught</p>
                    </>
                  )}
                  {viewMode === 'faculty' && (
                    <>
                      <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Select a faculty to view their schedule</p>
                    </>
                  )}
                  <p className="text-sm mt-2">Generate a timetable first if you haven't already</p>
                </div>
              </Card>
            )}

            {/* Institutional Electives Info */}
            {ieSlots.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-500" />
                    Institutional Elective Room Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ieSlots.map((ie, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-purple-50">
                        <div className="font-semibold text-purple-800 mb-2">
                          Semester {ie.semester}: {ie.day_name} - {ie.time}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {ie.electives.map((elective, i) => (
                            <div key={i} className="bg-white rounded p-3 border border-purple-200">
                              <div className="font-medium text-sm">{elective.name}</div>
                              <div className="text-xs text-gray-500">{elective.code}</div>
                              <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                Room: {elective.room}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Basket Courses Info */}
            {basketSlots.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-amber-500" />
                    Basket Course Room Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {basketSlots.map((bc, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-amber-50">
                        <div className="font-semibold text-amber-800 mb-2">
                          Semester {bc.semester}: {bc.day_name} - {bc.time}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {bc.courses.map((course, i) => (
                            <div key={i} className="bg-white rounded p-3 border border-amber-200">
                              <div className="font-medium text-sm">{course.name}</div>
                              <div className="text-xs text-gray-500">{course.code}</div>
                              <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                Room: {course.room}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
