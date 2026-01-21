
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Users, Clock, Building2, Calendar, Trash2, X, AlertCircle, Eye, ChevronRight, Save, Loader2, CheckCircle2, BookOpen } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://rvce-ai-timetable-generator.onrender.com') + '/api/timetable';
const LOCAL_STORAGE_KEY = 'rvce_timetable_changes';

const TIME_SLOTS = [
  { id: 1, label: '9-10' },
  { id: 2, label: '10-11' },
  { id: 3, label: '11:30-12:30' },
  { id: 4, label: '12:30-1:30' },
  { id: 5, label: '2:30-3:30' },
  { id: 6, label: '3:30-4:30' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FacultyManage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allTimetables, setAllTimetables] = useState({});
  const [sections, setSections] = useState([]);

  // Modal state
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultySchedule, setFacultySchedule] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Local changes and save state
  const [localChanges, setLocalChanges] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Force re-render trigger
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchData();
    loadLocalChanges();
  }, []);

  const loadLocalChanges = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const changes = JSON.parse(saved);
        setLocalChanges(changes);
        setHasUnsavedChanges(changes.length > 0);
      }
    } catch (err) { console.error(err); }
  };

  const saveLocalChanges = useCallback((changes) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(changes));
      setLocalChanges(changes);
      setHasUnsavedChanges(changes.length > 0);
      // Trigger re-render to update hours display
      setRefreshKey(prev => prev + 1);
    } catch (err) { console.error(err); }
  }, []);

  const fetchData = async () => {
    try {
      const [facultyRes, deptRes, allRes, sectionsRes] = await Promise.all([
        fetch(`${API_BASE}/faculty`),
        fetch(`${API_BASE}/departments`),
        fetch(`${API_BASE}/all`),
        fetch(`${API_BASE}/sections`)
      ]);

      const facultyData = await facultyRes.json();
      const deptData = await deptRes.json();
      const allData = await allRes.json();
      const sectionsData = await sectionsRes.json();

      setFaculty(facultyData.faculty || []);
      setDepartments(deptData.departments || []);
      setSections(sectionsData.sections || []);

      // allData.sections is a dict with section IDs as keys
      setAllTimetables(allData.sections || {});
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFacultySchedule = useCallback((facultyId) => {
    const schedule = [];

    // Check local storage for removed classes
    const removedSlots = localChanges.filter(c => c.type === 'unassigned');

    Object.entries(allTimetables).forEach(([secId, secData]) => {
      const slots = secData.slots || [];
      const info = secData.info || {};

      slots.forEach(slot => {
        if (slot.faculty?.id === facultyId) {
          // Check if this slot was removed
          const isRemoved = removedSlots.some(r =>
            String(r.section_id) === String(secId) &&
            r.day?.toUpperCase() === slot.day_name?.toUpperCase() &&
            r.slot === slot.slot
          );

          if (!isRemoved) {
            schedule.push({
              ...slot,
              section_id: parseInt(secId),
              section_name: info.department ? `${info.department} ${info.section} (Sem ${info.semester})` : `Section ${secId}`
            });
          }
        }
      });
    });
    return schedule;
  }, [allTimetables, localChanges, refreshKey]);

  const openFacultySchedule = (fac) => {
    const schedule = getFacultySchedule(fac.id);
    setSelectedFaculty(fac);
    setFacultySchedule(schedule);
    setShowModal(true);
  };

  const removeClassFromSchedule = (sectionId, day, slot) => {
    // Mark as unassigned in localStorage
    const newChange = {
      id: `${sectionId}-${day.toUpperCase()}-${slot}`,
      type: 'unassigned',
      section_id: sectionId,
      day: day.toUpperCase(),
      slot,
      reason: `Removed from ${selectedFaculty?.name}'s schedule`,
      originalData: {
        faculty_id: selectedFaculty?.id,
        faculty_name: selectedFaculty?.name,
        section_id: sectionId
      },
      timestamp: new Date().toISOString()
    };

    const existing = localChanges.filter(c => c.id !== newChange.id);
    saveLocalChanges([...existing, newChange]);

    // Update the schedule display immediately
    setFacultySchedule(prev => prev.filter(s =>
      !(s.section_id === sectionId && s.day_name?.toUpperCase() === day.toUpperCase() && s.slot === slot)
    ));

    setSaveMessage({ type: 'info', text: 'Class removed - click Save Changes to apply permanently' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Save changes to backend
  const handleSaveChanges = async () => {
    if (localChanges.length === 0) return;

    setSaving(true);
    try {
      // Group changes by section
      const changesBySection = {};
      localChanges.forEach(change => {
        if (!changesBySection[change.section_id]) {
          changesBySection[change.section_id] = [];
        }
        changesBySection[change.section_id].push(change);
      });

      // Apply changes to each section
      for (const [sectionId, changes] of Object.entries(changesBySection)) {
        // Get current timetable for this section
        const sectionData = allTimetables[sectionId];
        if (!sectionData) continue;

        // Update slots - keep the slot but remove faculty assignment for unassigned slots
        const updatedSlots = (sectionData.slots || []).map(slot => {
          const isUnassigned = changes.some(c =>
            c.type === 'unassigned' &&
            c.day?.toUpperCase() === slot.day_name?.toUpperCase() &&
            c.slot === slot.slot
          );

          if (isUnassigned) {
            // Keep the slot but mark faculty as TBA (unassigned)
            return {
              day_name: slot.day_name,
              slot: slot.slot,
              subject: slot.subject,
              faculty: { id: null, name: 'TBA' }, // Mark as unassigned
              room: slot.room,
              is_lab: slot.is_lab,
              needs_faculty: true
            };
          }
          return {
            day_name: slot.day_name,
            slot: slot.slot,
            subject: slot.subject,
            faculty: slot.faculty,
            room: slot.room,
            is_lab: slot.is_lab
          };
        });

        // Send to backend
        await fetch(`${API_BASE}/manual-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: parseInt(sectionId),
            changes: [],
            timetable: updatedSlots
          })
        });
      }

      // DON'T clear localStorage - keep unassigned notifications visible in ManageTimetable
      // The ManageTimetable page will clear them when a new faculty is assigned

      // But clear the unsaved changes indicator since we saved
      setHasUnsavedChanges(false);

      // Refresh data from backend
      await fetchData();

      // Refresh modal if open
      if (selectedFaculty) {
        const newSchedule = getFacultySchedule(selectedFaculty.id);
        setFacultySchedule(newSchedule);
      }

      setSaveMessage({ type: 'success', text: 'Changes saved! Unassigned slots will appear in Manage Timetable.' });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (error) {
      console.error('Error saving changes:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save changes' });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const filteredFaculty = faculty.filter((f) => {
    const matchesSearch = f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.id?.toString().toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || f.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const uniqueDepts = [...new Set(faculty.map(f => f.department))].filter(Boolean).sort();
  const totalFaculty = faculty.length;
  const deptCount = uniqueDepts.length;
  const avgMaxHours = faculty.length > 0
    ? Math.round(faculty.reduce((sum, f) => sum + (f.max_hours || 0), 0) / faculty.length)
    : 0;

  // Calculate stats for display
  const totalSubjects = [...new Set(faculty.flatMap(f => f.subject_codes || []))].length;
  
  // Calculate overloaded faculty count
  const overloadedFaculty = React.useMemo(() => {
    if (!faculty.length || !Object.keys(allTimetables).length) return 0;
    return faculty.filter(f => {
      const schedule = getFacultySchedule(f.id);
      return schedule.length > (f.max_hours || 18);
    }).length;
  }, [faculty, allTimetables, getFacultySchedule]);

  const exportToCSV = () => {
    const headers = ['Faculty ID', 'Name', 'Department', 'Max Hours/Week', 'Assigned Hours', 'Subject Codes'];
    const rows = filteredFaculty.map(f => [f.id, f.name, f.department, f.max_hours, getFacultySchedule(f.id).length, (f.subject_codes || []).join('; ')]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faculty_data.csv';
    a.click();
  };

  // Build timetable grid for modal
  const buildScheduleGrid = () => {
    const grid = {};
    DAYS.forEach(day => {
      grid[day] = {};
      for (let i = 1; i <= 6; i++) grid[day][i] = null;
    });
    facultySchedule.forEach(slot => {
      const day = slot.day_name;
      if (grid[day]) grid[day][slot.slot] = slot;
    });
    return grid;
  };

  return (
    <AppShell title="Faculty Management">
      <div className="space-y-6 p-6">
        {/* Save Message Toast */}
        {saveMessage && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
            saveMessage.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
              'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
            {saveMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {saveMessage.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {saveMessage.type === 'info' && <AlertCircle className="w-5 h-5" />}
            {saveMessage.text}
          </div>
        )}

        {/* Faculty Schedule Modal */}
        {showModal && selectedFaculty && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] overflow-hidden">
              <div className="bg-purple-600 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">{selectedFaculty.name}'s Schedule</h2>
                  <p className="text-sm opacity-80">{selectedFaculty.department} • {facultySchedule.length} classes • {facultySchedule.length}/{selectedFaculty.max_hours || 40}h/week</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-purple-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-[65vh] overflow-auto">
                {facultySchedule.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No classes assigned to this faculty</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-2 text-left font-bold w-20">Day</th>
                          {TIME_SLOTS.map(slot => (
                            <th key={slot.id} className="border p-2 text-center font-bold">{slot.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => {
                          const grid = buildScheduleGrid();
                          return (
                            <tr key={day}>
                              <td className="border p-2 font-bold bg-gray-50">{day.slice(0, 3)}</td>
                              {TIME_SLOTS.map(slot => {
                                const cell = grid[day]?.[slot.id];
                                if (day === 'Saturday' && slot.id > 4) {
                                  return <td key={slot.id} className="border bg-gray-200" />;
                                }
                                return (
                                  <td key={slot.id} className="border p-1 h-20 align-top">
                                    {cell ? (
                                      <div className={`p-1.5 rounded h-full relative group ${cell.is_lab ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                                        <button
                                          onClick={() => removeClassFromSchedule(cell.section_id, day, slot.id)}
                                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs z-10"
                                          title="Remove this class"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                        <div className="font-bold text-[10px] leading-tight" title={cell.subject?.name}>
                                          {cell.subject?.name || cell.subject?.course_code || cell.subject?.code || '?'}
                                        </div>
                                        <div className="text-[9px] text-gray-600 truncate mt-0.5">{cell.section_name}</div>
                                        <div className="text-[9px] text-gray-500">{cell.room?.name || ''}</div>
                                        {cell.is_lab && <div className="text-[8px] text-green-700 font-bold">LAB</div>}
                                      </div>
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t px-6 py-3 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>Click the trash icon on any class to remove it.</span>
                </div>
                <Button variant="outline" onClick={() => setShowModal(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}


        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-serif font-bold text-accent-navy">Faculty Management</h1>
            <p className="text-text-secondary mt-1">Manage faculty members, view schedules and workload</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-card border-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent-navy/10 rounded-full">
                    <Users className="w-6 h-6 text-accent-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Total Faculty</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{totalFaculty}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent-gold/10 rounded-full">
                    <BookOpen className="w-6 h-6 text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Total Subjects</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{totalSubjects}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-navy/5 rounded-full">
                    <Clock className="w-6 h-6 text-navy" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Avg. Workload</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{avgMaxHours}h/week</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-none">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-50 rounded-full">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-secondary">Overloaded</p>
                    <p className="text-2xl font-serif font-bold text-accent-navy">{overloadedFaculty}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepts.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {hasUnsavedChanges && (
              <Button onClick={handleSaveChanges} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes ({localChanges.length})
              </Button>
            )}
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          </div>


          {/* Unsaved Changes Banner */}
          {
            hasUnsavedChanges && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">You have {localChanges.length} unsaved change(s)</p>
                    <p className="text-sm text-amber-600">Click "Save Changes" to apply them permanently to the timetable.</p>
                  </div>
                </div>
                <Button onClick={handleSaveChanges} disabled={saving} size="sm" className="bg-amber-600 hover:bg-amber-700">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Now
                </Button>
              </div>
            )
          }

          {/* Faculty Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Faculty List ({filteredFaculty.length})</span>
                <span className="text-sm font-normal text-gray-500">Click on a faculty to view/edit their schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
                </div>
              ) : (
                <div className="space-y-6">

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search by name, email, or department..."
                        className="pl-10 border-gray-200 focus:border-accent-navy focus:ring-accent-navy"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                      <SelectTrigger className="w-full md:w-[200px] border-gray-200">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {uniqueDepts.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Faculty List */}
                  <div className="bg-white rounded-lg shadow-card border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-accent-navy text-white">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Faculty Details</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Department</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Designation</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Workload</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredFaculty.map((f) => {
                            const schedule = getFacultySchedule(f.id);
                            return (
                              <tr key={f.id} className="hover:bg-bg-secondary/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-accent-navy/10 flex items-center justify-center text-accent-navy font-serif font-bold text-lg">
                                      {f.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-accent-navy">{f.name}</p>
                                      <p className="text-sm text-text-secondary">{f.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 font-medium">{f.name}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{f.department}</Badge>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={schedule.length >= (f.max_hours || 40) ? 'text-red-600 font-bold' : 'text-gray-700'}>
                                    {schedule.length}/{f.max_hours || 40}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {(f.subject_codes || []).slice(0, 3).map((code, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">{code.trim()}</Badge>
                                    ))}
                                    {(f.subject_codes || []).length > 3 && (
                                      <Badge variant="secondary" className="text-xs">+{f.subject_codes.length - 3}</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <Button variant="ghost" size="sm" className="text-accent-navy hover:text-navy hover:bg-navy/10" onClick={() => openFacultySchedule(f)}>
                                    <Eye className="w-4 h-4 mr-1" />View Schedule
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredFaculty.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No faculty found matching your criteria</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
