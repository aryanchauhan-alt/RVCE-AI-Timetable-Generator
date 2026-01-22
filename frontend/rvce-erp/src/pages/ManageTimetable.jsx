
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Save, RefreshCw, AlertCircle, AlertTriangle,
  X, Check, GripVertical, User, BookOpen, Users,
  Info, CheckCircle2, Bell, Download, Filter
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://rvce-ai-timetable-generator.onrender.com') + '/api/timetable';

const TIME_SLOTS = [
  { id: 1, label: '9-10' },
  { id: 2, label: '10-11' },
  { id: 'BREAK', label: 'Break', isBreak: true },
  { id: 3, label: '11:30-12:30' },
  { id: 4, label: '12:30-1:30' },
  { id: 'LUNCH', label: 'Lunch', isBreak: true },
  { id: 5, label: '2:30-3:30' },
  { id: 6, label: '3:30-4:30' },
];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const SHORT_DAYS = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };

const LOCAL_STORAGE_KEY = 'rvce_timetable_changes';

export default function ManageTimetable() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showUnassignedModal, setShowUnassignedModal] = useState(false);
  const [unassignedSection, setUnassignedSection] = useState(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [sections, setSections] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [originalTimetable, setOriginalTimetable] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [allFaculty, setAllFaculty] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragType, setDragType] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [currentSectionInfo, setCurrentSectionInfo] = useState(null);
  const [unassignedSlots, setUnassignedSlots] = useState([]);
  const [allTimetables, setAllTimetables] = useState({});
  const [localChanges, setLocalChanges] = useState([]);

  useEffect(() => {
    loadDepartments();
    loadAllSections();
    loadAllFaculty();
    loadAllTimetables();
    loadLocalChanges();
  }, []);

  useEffect(() => {
    if (selectedDept) loadSectionsForDept();
  }, [selectedDept]);

  useEffect(() => {
    if (selectedSection && currentSectionInfo) {
      loadSubjectsForSection();
      loadTimetableForSection();
    }
  }, [selectedSection, currentSectionInfo]);

  useEffect(() => {
    setSelectedFaculty(null);
  }, [selectedSubject]);

  const loadLocalChanges = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const changes = JSON.parse(saved);
        setLocalChanges(changes);
        setUnassignedSlots(changes.filter(c => c.type === 'unassigned'));
      }
    } catch (err) { console.error(err); }
  };

  const getUnassignedSections = () => {
    const unassigned = localChanges.filter(c => c.type === 'unassigned');
    const sectionIds = Array.from(new Set(unassigned.map(u => u.section_id)));
    return sectionIds.map(id => {
      // Get section name from allTimetables
      const secData = allTimetables[id]?.info;
      const sectionName = secData
        ? `${secData.department} ${secData.section}`
        : `Section ${id}`;
      return {
        id,
        name: sectionName,
        count: unassigned.filter(u => u.section_id === id).length
      };
    });
  };

  const openUnassignedSection = (sectionId) => {
    // Find section info from allTimetables or sections array
    const secData = allTimetables[sectionId]?.info || allTimetables[String(sectionId)]?.info;
    const secFromList = sections.find(s => s.id === parseInt(sectionId) || s.id === sectionId);
    const info = secData || secFromList;

    if (info) {
      // Set department
      if (info.department) {
        setSelectedDept(info.department);
        // Load sections for this department synchronously
        const filtered = sections.filter(s => s.department === info.department);
        setAvailableSections(filtered);

        // Use longer delay to ensure React state updates complete
        setTimeout(() => {
          if (info.academic_year) {
            setSelectedYear(info.academic_year.toString());
          }
          
          // Another delay to ensure year selection populates sections list
          setTimeout(() => {
            // Set section letter and trigger timetable load
            if (info.section) {
              setSelectedSection(info.section.trim());
              // Find the full section info from filtered list for proper loading
              const fullSectionInfo = filtered.find(
                s => s.academic_year === info.academic_year && s.section === info.section.trim()
              ) || { ...info, id: parseInt(sectionId) || sectionId };
              setCurrentSectionInfo(fullSectionInfo);
              
              // Scroll to top of timetable and show notification about which slots need attention
              const unassignedInSection = localChanges.filter(
                c => c.type === 'unassigned' && String(c.section_id) === String(sectionId)
              );
              if (unassignedInSection.length > 0) {
                const slotsList = unassignedInSection.map(u => `${u.day} Slot ${u.slot}`).join(', ');
                setConflicts([{ 
                  type: 'warning', 
                  message: `Unassigned slots in this section: ${slotsList}. These need faculty assignment.` 
                }]);
                setShowConflicts(true);
              }
            }
          }, 200);
        }, 200);
      }
    }
    setShowUnassignedModal(false);
  };

  const saveLocalChanges = useCallback((changes) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(changes));
      setLocalChanges(changes);
      setUnassignedSlots(changes.filter(c => c.type === 'unassigned'));
    } catch (err) { console.error(err); }
  }, []);

  const loadDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE}/departments`);
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (err) { console.error(err); }
  };

  const loadAllSections = async () => {
    try {
      const res = await fetch(`${API_BASE}/sections`);
      const data = await res.json();
      setSections(data.sections || []);
    } catch (err) { console.error(err); }
  };

  const loadAllFaculty = async () => {
    try {
      const res = await fetch(`${API_BASE}/faculty`);
      const data = await res.json();
      setAllFaculty(data.faculty || []);
    } catch (err) { console.error(err); }
  };

  const loadAllTimetables = async () => {
    try {
      const res = await fetch(`${API_BASE}/all`);
      const data = await res.json();
      // API returns sections as object with section IDs as keys
      const sectionsData = data.sections || {};
      // If it's already an object (dict), use it directly; otherwise convert from array
      const ttMap = typeof sectionsData === 'object' && !Array.isArray(sectionsData)
        ? sectionsData
        : sectionsData.reduce((acc, sec) => { acc[sec.section_id || sec.info?.id] = sec; return acc; }, {});
      setAllTimetables(ttMap);
    } catch (err) { console.error(err); }
  };

  const loadSectionsForDept = () => {
    const filtered = sections.filter(s => s.department === selectedDept);
    setAvailableSections(filtered);
    setSelectedYear('');
    setSelectedSection('');
    setCurrentSectionInfo(null);
    setSubjects([]);
    setSelectedSubject(null);
    setSelectedFaculty(null);
  };

  const loadSubjectsForSection = async () => {
    if (!currentSectionInfo) return;
    try {
      const res = await fetch(`${API_BASE}/subjects?department=${selectedDept}&semester=${currentSectionInfo.semester}`);
      const data = await res.json();
      setSubjects(data.subjects || []);
      setSelectedSubject(null);
      setSelectedFaculty(null);
    } catch (err) { console.error(err); }
  };

  const loadTimetableForSection = async () => {
    if (!currentSectionInfo) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/section/${currentSectionInfo.id}`);
      const data = await res.json();
      const grid = {};
      DAYS.forEach(day => {
        grid[day] = {};
        for (let slot = 1; slot <= 6; slot++) grid[day][slot] = null;
      });
      (data.slots || []).forEach(slot => {
        const dayUpper = slot.day_name?.toUpperCase();
        if (grid[dayUpper]) {
          grid[dayUpper][slot.slot] = {
            subject: slot.subject,
            faculty: slot.faculty,
            room: slot.room,
            is_lab: slot.is_lab
          };
        }
      });

      // Apply local unassigned overrides
      localChanges.filter(c => c.type === 'unassigned' && String(c.section_id) === String(currentSectionInfo.id))
        .forEach(c => {
          if (grid[c.day]?.[c.slot]) {
            grid[c.day][c.slot] = { ...grid[c.day][c.slot], unassigned: true, unassignedReason: c.reason };
          }
        });

      setTimetable(grid);
      setOriginalTimetable(JSON.parse(JSON.stringify(grid)));
      setHasChanges(false);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getFacultySchedule = (facultyId) => {
    const schedule = [];
    Object.entries(allTimetables).forEach(([secId, secData]) => {
      (secData.slots || []).forEach(slot => {
        if (slot.faculty?.id === facultyId) {
          schedule.push({ ...slot, section_id: parseInt(secId) });
        }
      });
    });
    return schedule;
  };

  const getFilteredFaculty = () => {
    if (!selectedSubject) {
      // Show all faculty from the selected department when no subject is selected
      return allFaculty.filter(f => f.department === selectedDept);
    }
    // Filter faculty who can teach the selected subject
    const matchedFaculty = allFaculty.filter(f => {
      const codes = f.subject_codes || [];
      return codes.includes(selectedSubject.code) || 
             codes.some(code => selectedSubject.code?.startsWith(code?.trim()));
    });
    // If no matches, fall back to department faculty
    if (matchedFaculty.length === 0) {
      return allFaculty.filter(f => f.department === selectedDept);
    }
    return matchedFaculty;
  };

  const getAvailableYears = () => [...new Set(availableSections.map(s => s.academic_year))].sort();
  const getAvailableSectionsList = () => availableSections.filter(s => s.academic_year === parseInt(selectedYear));

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedSection('');
    setCurrentSectionInfo(null);
  };

  const handleSectionChange = (sectionLetter) => {
    setSelectedSection(sectionLetter);
    const sectionInfo = availableSections.find(s => s.academic_year === parseInt(selectedYear) && s.section === sectionLetter);
    setCurrentSectionInfo(sectionInfo);
  };

  const handleDragStart = (e, item, type) => {
    e.stopPropagation();
    setDraggedItem(item);
    setDragType(type);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id: item.id || item.code }));
    // Set drag image for better UX
    if (e.target) {
      e.dataTransfer.setDragImage(e.target, 50, 25);
    }
  };

  const handleDragOver = (e, day, slot) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!dropTarget || dropTarget.day !== day || dropTarget.slot !== slot) {
      setDropTarget({ day, slot });
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the cell entirely
    const relatedTarget = e.relatedTarget;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragType(null);
    setDropTarget(null);
  };

  const handleDrop = async (e, day, slotId) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    
    if (!draggedItem || !dragType) {
      console.log('No dragged item or type');
      return;
    }
    
    console.log('Drop:', dragType, draggedItem.name || draggedItem.code, 'at', day, slotId);

    const newTimetable = JSON.parse(JSON.stringify(timetable));

    if (dragType === 'subject') {
      // Use draggedItem (the actual dragged subject) instead of selectedSubject
      const subjectToAssign = draggedItem;
      const facultyToAssign = selectedFaculty;
      
      const validation = await validateSlotAssignment(day, slotId, subjectToAssign, facultyToAssign);
      if (validation.conflicts.filter(c => c.type === 'error').length > 0) {
        setConflicts(validation.conflicts);
        setShowConflicts(true);
        setDraggedItem(null);
        setDragType(null);
        return;
      }
      
      // Check if it's a lab subject - use the dragged item's properties
      const isLab = subjectToAssign.type === 'Lab' || subjectToAssign.type === 'Theory + Lab' || subjectToAssign.lab_hours > 0;
      
      if (isLab && slotId % 2 === 0) {
        setConflicts([{ type: 'warning', message: 'Labs must start on odd slots (1, 3, 5)' }]);
        setShowConflicts(true);
        setDraggedItem(null);
        setDragType(null);
        return;
      }
      
      if (isLab) {
        if (slotId % 2 === 1) {
          newTimetable[day][slotId] = { subject: subjectToAssign, faculty: facultyToAssign, room: { name: currentSectionInfo?.dedicated_room || 'Lab' }, is_lab: true };
          if (slotId + 1 <= (day === 'SATURDAY' ? 4 : 6)) {
            newTimetable[day][slotId + 1] = { subject: subjectToAssign, faculty: facultyToAssign, room: { name: currentSectionInfo?.dedicated_room || 'Lab' }, is_lab: true };
          }
        } else {
          setConflicts([{ type: 'warning', message: 'Labs must start on odd slots (1, 3, 5)' }]);
          setShowConflicts(true);
          setDraggedItem(null);
          setDragType(null);
          return;
        }
      } else {
        // Theory subject - just takes 1 slot
        newTimetable[day][slotId] = { subject: subjectToAssign, faculty: facultyToAssign, room: { name: currentSectionInfo?.dedicated_room || 'TBD' }, is_lab: false };
      }

      const newChanges = localChanges.filter(c => !(c.type === 'unassigned' && c.section_id === currentSectionInfo?.id && c.day === day && c.slot === slotId));
      saveLocalChanges(newChanges);
      setTimetable(newTimetable);
      setHasChanges(true);
      
      // Auto-select this subject for quick faculty assignment
      setSelectedSubject(subjectToAssign);
      
    } else if (dragType === 'faculty') {
      if (newTimetable[day][slotId]) {
        const validation = await validateSlotAssignment(day, slotId, newTimetable[day][slotId].subject, draggedItem);
        if (validation.conflicts.filter(c => c.type === 'error').length > 0) {
          setConflicts(validation.conflicts);
          setShowConflicts(true);
          setDraggedItem(null);
          setDragType(null);
          return;
        }
        newTimetable[day][slotId] = { ...newTimetable[day][slotId], faculty: draggedItem, unassigned: false };
        const newChanges = localChanges.filter(c => !(c.type === 'unassigned' && c.section_id === currentSectionInfo?.id && c.day === day && c.slot === slotId));
        saveLocalChanges(newChanges);
        setTimetable(newTimetable);
        setHasChanges(true);
      } else if (selectedSubject) {
        const validation = await validateSlotAssignment(day, slotId, selectedSubject, draggedItem);
        if (validation.conflicts.filter(c => c.type === 'error').length > 0) {
          setConflicts(validation.conflicts);
          setShowConflicts(true);
          setDraggedItem(null);
          setDragType(null);
          return;
        }
        const isLab = selectedSubject.type === 'Lab' || selectedSubject.lab_hours > 0;
        if (isLab && slotId % 2 === 0) {
          setConflicts([{ type: 'warning', message: 'Labs must start on odd slots' }]);
          setShowConflicts(true);
          setDraggedItem(null);
          setDragType(null);
          return;
        }
        if (isLab) {
          newTimetable[day][slotId] = { subject: selectedSubject, faculty: draggedItem, room: { name: currentSectionInfo?.dedicated_room || 'Lab' }, is_lab: true };
          if (slotId + 1 <= (day === 'SATURDAY' ? 4 : 6)) {
            newTimetable[day][slotId + 1] = { subject: selectedSubject, faculty: draggedItem, room: { name: currentSectionInfo?.dedicated_room || 'Lab' }, is_lab: true };
          }
        } else {
          newTimetable[day][slotId] = { subject: selectedSubject, faculty: draggedItem, room: { name: currentSectionInfo?.dedicated_room || 'TBD' }, is_lab: false };
        }
        setTimetable(newTimetable);
        setHasChanges(true);
      }
    }
    setDraggedItem(null);
    setDragType(null);
  };

  const validateSlotAssignment = async (day, slot, subject, fac) => {
    const conflicts = [];
    if (!subject) return { conflicts: [] };

    // Check if slot is already occupied
    if (timetable[day]?.[slot] && !timetable[day][slot].unassigned) {
      conflicts.push({ type: 'info', message: 'Replacing existing slot' });
    }

    // Check subject max hours (weekly_hours or theory_hours + lab_hours)
    const maxSubjectHours = subject.weekly_hours || (subject.theory_hours || 0) + (subject.lab_hours || 0);
    if (maxSubjectHours > 0) {
      let currentSubjectHours = 0;
      // Count how many slots this subject already has in the current timetable
      DAYS.forEach(d => {
        Object.values(timetable[d] || {}).forEach(slotData => {
          if (slotData?.subject?.code === subject.code || slotData?.subject?.id === subject.id) {
            currentSubjectHours++;
          }
        });
      });
      if (currentSubjectHours >= maxSubjectHours) {
        conflicts.push({ type: 'error', message: `${subject.code} has reached max weekly hours (${maxSubjectHours})` });
      }
    }

    if (fac) {
      // Check faculty availability across ALL sections
      const facSchedule = getFacultySchedule(fac.id);
      const hasConflict = facSchedule.some(s =>
        s.day_name?.toUpperCase() === day &&
        s.slot === slot &&
        s.section_id !== currentSectionInfo?.id
      );
      if (hasConflict) {
        conflicts.push({ type: 'error', message: `${fac.name} is teaching another class at this time!` });
      }

      // Check if faculty is near/at max hours
      if (facSchedule.length >= (fac.max_hours || 40)) {
        conflicts.push({ type: 'error', message: `${fac.name} has reached max hours (${fac.max_hours || 40})` });
      } else if (facSchedule.length >= (fac.max_hours || 40) - 2) {
        conflicts.push({ type: 'warning', message: `${fac.name} is near max hours (${facSchedule.length}/${fac.max_hours || 40})` });
      }
    }

    // Saturday slot restriction
    if (day === 'SATURDAY' && slot > 4) {
      conflicts.push({ type: 'error', message: 'Saturday has no classes after slot 4' });
    }

    // Try backend validation if available
    try {
      const res = await fetch(`${API_BASE}/validate-slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: currentSectionInfo?.id,
          day: day.charAt(0) + day.slice(1).toLowerCase(),
          slot,
          subject_code: subject.code,
          faculty_id: fac?.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.conflicts) {
          data.conflicts.forEach(c => {
            if (!conflicts.some(ex => ex.message === c.message)) {
              conflicts.push(c);
            }
          });
        }
      }
    } catch (err) {
      // Backend validation failed, continue with client-side only
      console.log('Backend validation unavailable, using client-side only');
    }

    return { conflicts };
  };

  const handleRemoveSlot = (day, slot) => {
    const newTimetable = JSON.parse(JSON.stringify(timetable));
    const slotData = newTimetable[day][slot];
    if (slotData?.is_lab) {
      if (slot % 2 === 1) {
        newTimetable[day][slot] = null;
        newTimetable[day][slot + 1] = null;
      } else {
        newTimetable[day][slot - 1] = null;
        newTimetable[day][slot] = null;
      }
    } else {
      newTimetable[day][slot] = null;
    }
    setTimetable(newTimetable);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentSectionInfo) return;
    setSaving(true);
    try {
      const slots = [];
      DAYS.forEach(day => {
        Object.entries(timetable[day] || {}).forEach(([slotNum, slotData]) => {
          if (slotData && !slotData.unassigned) {
            slots.push({
              day_name: day.charAt(0) + day.slice(1).toLowerCase(),
              slot: parseInt(slotNum),
              subject: slotData.subject,
              faculty: slotData.faculty,
              room: slotData.room,
              is_lab: slotData.is_lab
            });
          }
        });
      });
      
      console.log(`Saving ${slots.length} slots for section ${currentSectionInfo.id}...`);
      
      const res = await fetch(`${API_BASE}/manual-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: currentSectionInfo.id, changes: [], timetable: slots })
      });
      
      const responseData = await res.json();
      console.log('Save response:', responseData);
      
      if (res.ok && responseData.success) {
        setOriginalTimetable(JSON.parse(JSON.stringify(timetable)));
        setHasChanges(false);

        // Clear local changes for this section
        const newChanges = localChanges.filter(c => c.section_id !== currentSectionInfo.id);
        saveLocalChanges(newChanges);

        // Reload all timetables to reflect changes across faculty/room views
        await loadAllTimetables();
        
        setConflicts([{ type: 'success', message: `Saved ${slots.length} slots successfully! Changes will appear in all views.` }]);
        setShowConflicts(true);
      } else {
        throw new Error(responseData.detail || 'Save failed');
      }
    } catch (err) {
      console.error('Save error:', err);
      setConflicts([{ type: 'error', message: `Failed to save: ${err.message}` }]);
      setShowConflicts(true);
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    setTimetable(JSON.parse(JSON.stringify(originalTimetable)));
    setHasChanges(false);
  };

  const exportChanges = () => {
    const data = { timetable, changes: localChanges, section: currentSectionInfo, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_${selectedDept}_${selectedSection}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCellContent = (day, slotId) => {
    if (day === 'SATURDAY' && slotId > 4) return null;
    const slotData = timetable[day]?.[slotId];
    if (!slotData) return null;
    const isUnassigned = slotData.unassigned;

    // Get subject info - handle both code and course_code from API
    const subjectName = slotData.subject?.name || '';
    const subjectCode = slotData.subject?.course_code || slotData.subject?.code || subjectName?.substring(0, 8) || '?';

    // Get full faculty name - check both slot.faculty and subject.faculty
    const facultyName = slotData.faculty?.name || slotData.subject?.faculty?.name || 'TBA';

    // Get room name
    const roomName = slotData.room?.name || slotData.room || '';

    const isLab = slotData.is_lab || slotData.subject?.subject_type === 'Lab';

    return (
      <div className={`p-2 rounded text-xs leading-tight relative group h-full flex flex-col justify-center shadow-sm border ${isUnassigned ? 'bg-red-50 border-red-200' : isLab ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100 shadow-soft'}`}>
        <button onClick={(e) => { e.stopPropagation(); handleRemoveSlot(day, slotId); }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs z-10 transition-opacity shadow-md">×</button>

        {/* Subject name (full) */}
        <div className="font-bold text-accent-navy text-center text-[11px] leading-tight" title={subjectName}>
          {subjectName || subjectCode}
        </div>

        {/* Faculty name (full, not truncated) */}
        {facultyName && facultyName !== 'TBA' && (
          <div className="text-center text-[10px] text-text-secondary mt-1 truncate font-medium" title={facultyName}>
            {facultyName}
          </div>
        )}
        {facultyName === 'TBA' && (
          <div className="text-center text-[9px] text-gray-400 mt-0.5 italic">TBA</div>
        )}

        {/*. Room name */}
        {roomName && (
          <div className="text-center text-[9px] text-gray-400 mt-0.5">{roomName}</div>
        )}

        {/* Lab badge */}
        {isLab && <div className="text-center text-[8px] text-emerald-600 font-bold mt-1 tracking-wider uppercase">LAB</div>}

        {/* Unassigned overlay */}
        {isUnassigned && <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center rounded"><AlertCircle className="w-4 h-4 text-red-600" /></div>}
      </div>
    );
  };

  const filteredFaculty = getFilteredFaculty();
  const sectionUnassigned = unassignedSlots.filter(u => u.section_id === currentSectionInfo?.id);

  return (
    <AppShell>
      <div className="h-[calc(100vh-1rem)] flex flex-col p-3 overflow-hidden bg-gray-100">
        {/* Modal */}
        {showConflicts && conflicts.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm w-full mx-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  {conflicts[0].type === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {conflicts[0].type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  {conflicts[0].type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {conflicts[0].type === 'error' ? 'Error' : conflicts[0].type === 'success' ? 'Success' : 'Warning'}
                </h3>
                <button onClick={() => setShowConflicts(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className={`p-2 rounded text-xs mb-1 ${c.type === 'error' ? 'bg-red-50 text-red-700' : c.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{c.message}</div>
              ))}
              <Button onClick={() => setShowConflicts(false)} size="sm" className="w-full mt-2">OK</Button>
            </div>
          </div>
        )}

        {/* Unassigned notification always visible */}
        {getUnassignedSections().length > 0 && (
          <div className="fixed top-20 right-4 bg-yellow-100 border border-yellow-400 text-yellow-900 px-4 py-3 rounded-lg shadow-lg z-40" style={{ minWidth: 280 }}>
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5" />
              <span className="font-medium">Unassigned classes in {getUnassignedSections().length} section(s)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getUnassignedSections().map(s => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="outline"
                  className="bg-white hover:bg-yellow-50"
                  onClick={() => openUnassignedSection(s.id)}
                >
                  {s.name} ({s.count})
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Modal for section timetable with unassigned slots highlighted */}
        {showUnassignedModal && unassignedSection && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Section {unassignedSection} Timetable</h2>
                <Button variant="outline" onClick={() => setShowUnassignedModal(false)}>
                  <X className="w-5 h-5" /> Close
                </Button>
              </div>
              <div className="text-center p-4 text-gray-500">
                Detailed view for unassigned classes to be implemented.
              </div>
            </div>
          </div>
        )}

        {/* Top Bar - Filters matching Faculty/Rooms style */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={selectedYear} onValueChange={handleYearChange} disabled={!selectedDept}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableYears().map(y => (
                    <SelectItem key={y} value={y.toString()}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSection} onValueChange={handleSectionChange} disabled={!selectedYear}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSectionsList().map(s => (
                    <SelectItem key={s.section} value={s.section}>{s.section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentSectionInfo && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 px-3 py-1.5">
                  Room: {currentSectionInfo.dedicated_room} | Sem {currentSectionInfo.semester}
                </Badge>
              )}

              {sectionUnassigned.length > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Bell className="w-3 h-3" />{sectionUnassigned.length} unassigned
                </Badge>
              )}

              <div className="flex-1" />

              <Button variant="outline" size="sm" onClick={exportChanges}><Download className="w-4 h-4 mr-2" />Export</Button>

              {hasChanges && (
                <>
                  <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}><RefreshCw className="w-4 h-4 mr-2" />Reset</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content - Timetable on top, Panels below */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-2">
          {/* Timetable - Full Width */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-white rounded-lg shadow-card"><Loader2 className="w-8 h-8 animate-spin text-accent-navy" /></div>
            ) : currentSectionInfo ? (
              <div className="bg-white rounded-lg shadow-card flex flex-col h-full overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-accent-navy text-white px-4 py-3 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                      <span className="text-accent-gold font-serif font-bold text-xs">RV</span>
                    </div>
                    <div>
                      <div className="font-serif font-bold tracking-wide">Manage Timetable</div>
                      <div className="text-xs text-white/70">Drag subjects & faculty to slots</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent-gold">{selectedDept} - Section {selectedSection}</div>
                    <div className="text-xs text-white/70">Semester {currentSectionInfo.semester} | {currentSectionInfo.dedicated_room}</div>
                  </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-auto bg-gray-50/50">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-100">
                        <th className="border-b border-gray-200 p-3 w-20 text-left font-bold text-text-secondary uppercase text-xs tracking-wider">Day</th>
                        {TIME_SLOTS.map(slot => (
                          <th key={slot.label} className={`border-b border-gray-200 p-2 text-center font-bold text-navy ${slot.isBreak ? 'w-12 bg-gray-50 text-xs' : ''}`}>
                            {slot.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          <td className="border-b border-r border-gray-200 p-2 font-bold text-xs text-text-secondary bg-white uppercase tracking-wider">{SHORT_DAYS[day]}</td>
                          {TIME_SLOTS.map(slot => {
                            if (slot.isBreak) return <td key={slot.label} className="border-b border-gray-200 bg-gray-50" />;
                            if (day === 'SATURDAY' && slot.id > 4) return <td key={slot.label} className="border-b border-gray-200 bg-gray-50" />;
                            const isTarget = dropTarget?.day === day && dropTarget?.slot === slot.id;
                            const content = getCellContent(day, slot.id);
                            return (
                              <td key={slot.label}
                                className={`border-b border-r border-gray-100 p-1 h-20 align-top transition-all duration-200 ${isTarget ? 'bg-accent-navy/5 ring-2 ring-accent-navy' : 'bg-white hover:bg-gray-50'}`}
                                onDragOver={(e) => handleDragOver(e, day, slot.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, slot.id)}>
                                {content || <div className="h-full flex items-center justify-center text-gray-200 text-2xl font-light hover:text-gray-300 transition-colors">+</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-white rounded-lg shadow text-gray-400">
                <div className="text-center">
                  <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-lg font-medium">Select Department, Year & Section</p>
                  <p className="text-sm">to start editing the timetable</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panels - Subjects & Faculty side by side */}
          {currentSectionInfo && (
            <div className="h-40 shrink-0 flex gap-2">
              {/* Subjects */}
              <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="px-3 py-1.5 bg-indigo-600 text-white flex items-center gap-2 shrink-0">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-bold text-sm">Subjects</span>
                  <span className="ml-auto text-xs opacity-80">{subjects.length} total</span>
                </div>
                <div className="flex-1 overflow-x-auto p-2">
                  <div className="flex gap-2 h-full">
                    {subjects.map(subject => (
                      <div key={subject.id} 
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, subject, 'subject')}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedSubject(selectedSubject?.id === subject.id ? null : subject)}
                        className={`shrink-0 w-32 p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all hover:shadow select-none ${selectedSubject?.id === subject.id ? 'bg-indigo-100 border-indigo-500' : 'bg-white hover:bg-gray-50 border-gray-200'
                          } ${subject.lab_hours > 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'}`}>
                        <div className="flex items-start gap-1">
                          <GripVertical className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 text-xs">{subject.code}</div>
                            <div className="text-gray-600 text-[10px] truncate">{subject.name}</div>
                            <div className="flex gap-1 mt-1">
                              {subject.theory_hours > 0 && <span className="px-1 bg-blue-100 text-blue-700 rounded text-[9px]">T:{subject.theory_hours}</span>}
                              {subject.lab_hours > 0 && <span className="px-1 bg-green-100 text-green-700 rounded text-[9px]">L:{subject.lab_hours}</span>}
                            </div>
                          </div>
                          {selectedSubject?.id === subject.id && <Check className="w-3 h-3 text-indigo-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Faculty */}
              <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="px-3 py-1.5 bg-purple-600 text-white flex items-center gap-2 shrink-0">
                  <Users className="w-4 h-4" />
                  <span className="font-bold text-sm">Faculty</span>
                  {selectedSubject && <span className="ml-auto text-xs opacity-90">for {selectedSubject.code}</span>}
                </div>
                <div className="flex-1 overflow-x-auto p-2">
                  <div className="flex gap-2 h-full">
                    {filteredFaculty.length === 0 ? (
                      <p className="text-gray-400 text-sm p-2">{selectedSubject ? `No faculty for ${selectedSubject.code}` : 'Click a subject to filter faculty'}</p>
                    ) : filteredFaculty.map(f => {
                      const isMax = (f.assigned_hours || 0) >= (f.max_hours || 40);
                      return (
                        <div key={f.id} 
                          draggable={!isMax ? "true" : "false"}
                          onDragStart={(e) => !isMax && handleDragStart(e, f, 'faculty')}
                          onDragEnd={handleDragEnd}
                          onClick={() => !isMax && setSelectedFaculty(selectedFaculty?.id === f.id ? null : f)}
                          className={`shrink-0 w-36 p-2 rounded-lg border-2 transition-all select-none ${isMax ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed'
                            : selectedFaculty?.id === f.id ? 'bg-green-100 border-green-500 cursor-grab'
                              : 'bg-white hover:bg-gray-50 border-gray-200 cursor-grab active:cursor-grabbing hover:shadow'
                            }`}>
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
                            <User className="w-4 h-4 text-purple-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-gray-900 truncate text-xs">{f.name}</div>
                              <div className="text-[10px] text-gray-500">{f.department} • {f.assigned_hours || 0}/{f.max_hours || 40}h</div>
                            </div>
                            {selectedFaculty?.id === f.id && <Check className="w-3 h-3 text-green-600" />}
                            {isMax && <span className="text-[9px] text-red-600 font-bold">MAX</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
