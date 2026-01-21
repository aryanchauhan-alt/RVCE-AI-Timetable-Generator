import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    Chip,
    IconButton,
    Tooltip,
    List,
    ListItem,
    ListItemText,
    Divider,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    CircularProgress,
    Tabs,
    Tab,
} from '@mui/material';
import { School, Delete, Save, Warning, Check, Refresh, Person, Book } from '@mui/icons-material';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const TIME_SLOTS = [
    { id: 1, label: '9:00 - 10:00' },
    { id: 2, label: '10:00 - 11:00' },
    { id: 'BREAK', label: '11:00 - 11:30', isBreak: true },
    { id: 3, label: '11:30 - 12:30' },
    { id: 4, label: '12:30 - 1:30' },
    { id: 'LUNCH', label: '1:30 - 2:30', isBreak: true },
    { id: 5, label: '2:30 - 3:30' },
    { id: 6, label: '3:30 - 4:30' },
];

const API_BASE = 'http://localhost:8000/api/timetable';

/**
 * Manual Adjustment Component with Drag-and-Drop
 * Allows manually editing a section's timetable
 */
const ManualAdjustment = ({ sectionId, sectionName, department, semester, onClose }) => {
    const [timetableData, setTimetableData] = useState({});
    const [subjects, setSubjects] = useState([]);
    const [allFaculty, setAllFaculty] = useState([]);
    const [allTimetables, setAllTimetables] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [draggedSubject, setDraggedSubject] = useState(null);
    const [draggedFaculty, setDraggedFaculty] = useState(null);
    const [dragType, setDragType] = useState(null); // 'subject' or 'faculty'
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [clashWarning, setClashWarning] = useState(null);
    const [pendingChanges, setPendingChanges] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [sidebarTab, setSidebarTab] = useState(0); // 0 = subjects, 1 = faculty

    // Load timetable and subjects on mount
    useEffect(() => {
        loadData();
    }, [sectionId]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            // Load current timetable for this section
            const ttRes = await fetch(`${API_BASE}/section/${sectionId}`);
            const ttData = await ttRes.json();
            
            // Build grid from slots
            const grid = {};
            DAYS.forEach(day => {
                grid[day] = {};
                [1, 2, 3, 4, 5, 6].forEach(slot => {
                    grid[day][slot] = null;
                });
            });
            
            ttData.slots?.forEach(slot => {
                const dayName = slot.day_name?.toUpperCase();
                const slotNum = slot.slot;
                if (grid[dayName] !== undefined && slotNum) {
                    grid[dayName][slotNum] = slot;
                }
            });
            
            setTimetableData(grid);

            // Load subjects for this department/semester
            const subRes = await fetch(`${API_BASE}/subjects?department=${department}&semester=${semester}`);
            const subData = await subRes.json();
            setSubjects(subData.subjects || []);

            // Load all faculty
            const facRes = await fetch(`${API_BASE}/faculty`);
            const facData = await facRes.json();
            setAllFaculty(facData.faculty || []);

            // Load all timetables for faculty schedule checking
            const allTTRes = await fetch(`${API_BASE}/all`);
            const allTTData = await allTTRes.json();
            setAllTimetables(allTTData.sections || {});
        } catch (err) {
            setError('Failed to load data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Handle drag start from subject sidebar
    const handleDragStart = (e, item, type = 'subject') => {
        setDragType(type);
        if (type === 'subject') {
            setDraggedSubject(item);
            setDraggedFaculty(null);
        } else {
            setDraggedFaculty(item);
            setDraggedSubject(null);
        }
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify({ ...item, dragType: type }));
    };

    // Handle drag over cell
    const handleDragOver = (e, day, slot) => {
        e.preventDefault();
        if (slot === 'BREAK' || slot === 'LUNCH') return;
        if (day === 'SATURDAY' && slot > 4) return;
        
        // Check for potential clashes
        if (draggedSubject) {
            const clash = checkClash(day, slot, draggedSubject);
            setClashWarning(clash);
        } else if (draggedFaculty) {
            const clash = checkFacultyClash(day, slot, draggedFaculty);
            setClashWarning(clash);
        }
    };

    // Handle drop on cell
    const handleDrop = (e, day, slotNum) => {
        e.preventDefault();
        setClashWarning(null);
        
        if (!draggedSubject && !draggedFaculty) return;
        if (slotNum === 'BREAK' || slotNum === 'LUNCH') return;
        if (day === 'SATURDAY' && slotNum > 4) return;

        // Handle faculty drop - assign to existing slot
        if (dragType === 'faculty' && draggedFaculty) {
            const existingSlot = timetableData[day]?.[slotNum];
            if (!existingSlot) {
                setError('Cannot assign faculty to empty slot. Drop a subject first.');
                setTimeout(() => setError(''), 3000);
                setDraggedFaculty(null);
                setDragType(null);
                return;
            }

            const clash = checkFacultyClash(day, slotNum, draggedFaculty);
            if (clash) {
                setConfirmDialog({
                    title: 'Faculty Clash Detected',
                    message: clash.message,
                    onConfirm: () => {
                        assignFacultyToSlot(day, slotNum, draggedFaculty);
                        setConfirmDialog(null);
                    },
                    onCancel: () => setConfirmDialog(null)
                });
            } else {
                assignFacultyToSlot(day, slotNum, draggedFaculty);
            }
            
            setDraggedFaculty(null);
            setDragType(null);
            return;
        }

        // Handle subject drop
        if (dragType === 'subject' && draggedSubject) {
            // Check clash
            const clash = checkClash(day, slotNum, draggedSubject);
            if (clash) {
                setConfirmDialog({
                    title: 'Clash Detected',
                    message: clash.message,
                    onConfirm: () => {
                        assignSlot(day, slotNum, draggedSubject);
                        setConfirmDialog(null);
                    },
                    onCancel: () => setConfirmDialog(null)
                });
            } else {
                assignSlot(day, slotNum, draggedSubject);
            }
            
            setDraggedSubject(null);
            setDragType(null);
        }
    };

    // Check for clashes (room, faculty, same subject on same day)
    const checkClash = (day, slotNum, subject) => {
        // Check if same subject already on this day
        let sameSubjectCount = 0;
        for (let s = 1; s <= 6; s++) {
            const existingSlot = timetableData[day]?.[s];
            if (existingSlot?.subject?.name === subject.name) {
                sameSubjectCount++;
            }
        }
        if (sameSubjectCount >= 1) {
            return {
                type: 'same_subject',
                message: `${subject.name} is already scheduled on ${day}. Adding another slot would exceed the daily limit.`
            };
        }

        // Check consecutive slot clash
        const prevSlot = timetableData[day]?.[slotNum - 1];
        const nextSlot = timetableData[day]?.[slotNum + 1];
        if (prevSlot?.subject?.name === subject.name || nextSlot?.subject?.name === subject.name) {
            return {
                type: 'consecutive',
                message: `${subject.name} would be in consecutive slots, which is not recommended.`
            };
        }

        return null;
    };

    // Check faculty clashes across all sections
    const checkFacultyClash = (day, slotNum, faculty) => {
        // Check if faculty is already teaching at this time in another section
        const facultySchedule = getFacultySchedule(faculty.id);
        const hasConflict = facultySchedule.some(slot => 
            slot.day_name?.toUpperCase() === day && 
            slot.slot === slotNum &&
            slot.section_id !== sectionId
        );

        if (hasConflict) {
            return {
                type: 'faculty_clash',
                message: `${faculty.name} is already teaching another class at ${day} slot ${slotNum}!`
            };
        }

        // Check faculty max hours
        if (facultySchedule.length >= (faculty.max_hours || 40)) {
            return {
                type: 'max_hours',
                message: `${faculty.name} has reached maximum hours (${faculty.max_hours || 40})`
            };
        }

        return null;
    };

    // Get faculty schedule from all timetables
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

    // Get filtered faculty for selected subject
    const getFilteredFaculty = () => {
        if (!selectedSubject) {
            // Show all faculty for this department
            return allFaculty.filter(f => f.department === department);
        }
        // Filter by subject code
        return allFaculty.filter(f => 
            (f.subject_codes || []).includes(selectedSubject.code)
        );
    };

    // Assign subject to slot
    const assignSlot = (day, slotNum, subject) => {
        const newSlot = {
            day_name: day.charAt(0) + day.slice(1).toLowerCase(),
            slot: slotNum,
            subject: {
                name: subject.name,
                code: subject.code,
                id: subject.id
            },
            room: { name: 'TBD' },
            faculty: { name: 'TBA' },
            is_lab: subject.is_lab || false
        };

        setTimetableData(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [slotNum]: newSlot
            }
        }));

        setPendingChanges(prev => [...prev, {
            action: 'add',
            day,
            slot: slotNum,
            subject: subject.name
        }]);

        setSuccess(`Added ${subject.name} to ${day} slot ${slotNum}`);
        setTimeout(() => setSuccess(''), 3000);
    };

    // Assign faculty to existing slot
    const assignFacultyToSlot = (day, slotNum, faculty) => {
        const existingSlot = timetableData[day]?.[slotNum];
        if (!existingSlot) return;

        const updatedSlot = {
            ...existingSlot,
            faculty: {
                id: faculty.id,
                name: faculty.name,
                department: faculty.department
            }
        };

        setTimetableData(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [slotNum]: updatedSlot
            }
        }));

        setPendingChanges(prev => [...prev, {
            action: 'assign_faculty',
            day,
            slot: slotNum,
            faculty: faculty.name
        }]);

        setSuccess(`Assigned ${faculty.name} to ${existingSlot.subject?.name} at ${day} slot ${slotNum}`);
        setTimeout(() => setSuccess(''), 3000);
    };

    // Remove slot
    const handleRemoveSlot = (day, slotNum) => {
        const existing = timetableData[day]?.[slotNum];
        if (!existing) return;

        setConfirmDialog({
            title: 'Remove Slot',
            message: `Remove ${existing.subject?.name} from ${day} slot ${slotNum}?`,
            onConfirm: () => {
                setTimetableData(prev => ({
                    ...prev,
                    [day]: {
                        ...prev[day],
                        [slotNum]: null
                    }
                }));
                setPendingChanges(prev => [...prev, {
                    action: 'remove',
                    day,
                    slot: slotNum,
                    subject: existing.subject?.name
                }]);
                setConfirmDialog(null);
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    // Save changes to backend
    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/manual-edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section_id: sectionId,
                    changes: pendingChanges,
                    timetable: Object.entries(timetableData).flatMap(([day, slots]) =>
                        Object.entries(slots)
                            .filter(([_, slot]) => slot !== null)
                            .map(([slotNum, slot]) => ({
                                ...slot,
                                day_name: day.charAt(0) + day.slice(1).toLowerCase(),
                                slot: parseInt(slotNum)
                            }))
                    )
                })
            });
            
            if (response.ok) {
                setSuccess('Changes saved successfully!');
                setPendingChanges([]);
            } else {
                throw new Error('Failed to save');
            }
        } catch (err) {
            setError('Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Render cell content
    const getCellContent = (day, slotId) => {
        if (slotId === 'BREAK' || slotId === 'LUNCH') return null;
        if (day === 'SATURDAY' && slotId > 4) return null;

        const slot = timetableData[day]?.[slotId];
        
        if (!slot) {
            return (
                <Box
                    sx={{
                        height: '100%',
                        minHeight: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed #e0e0e0',
                        borderRadius: 1,
                        cursor: 'copy',
                        '&:hover': { borderColor: '#1976d2', bgcolor: 'rgba(25, 118, 210, 0.04)' }
                    }}
                >
                    <Typography variant="caption" color="text.disabled">
                        Drop here
                    </Typography>
                </Box>
            );
        }

        return (
            <Box
                sx={{
                    p: 0.5,
                    borderRadius: 1,
                    bgcolor: slot.is_lab ? '#e8f5e9' : '#e3f2fd',
                    border: `1px solid ${slot.is_lab ? '#4caf50' : '#2196f3'}`,
                    position: 'relative',
                    '&:hover .delete-btn': { opacity: 1 }
                }}
            >
                <IconButton
                    size="small"
                    className="delete-btn"
                    onClick={() => handleRemoveSlot(day, slotId)}
                    sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'white',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        '&:hover': { bgcolor: '#ffebee' }
                    }}
                >
                    <Delete fontSize="small" color="error" />
                </IconButton>
                <Typography variant="caption" fontWeight="bold" display="block">
                    {slot.subject?.name || 'Unknown'}
                </Typography>
                {slot.faculty?.name && slot.faculty.name !== 'TBA' && (
                    <Typography variant="caption" color="text.secondary" display="block">
                        {slot.faculty.name}
                    </Typography>
                )}
                {slot.is_lab && (
                    <Chip label="LAB" size="small" color="success" sx={{ height: 16, fontSize: 10 }} />
                )}
            </Box>
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper elevation={3} sx={{ p: 2, borderRadius: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={600}>
                        Manual Adjustment: {department} - {sectionName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Semester {semester} | Drag subjects from sidebar to timetable
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={loadData}
                        disabled={saving}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSave}
                        disabled={saving || pendingChanges.length === 0}
                        sx={{ bgcolor: '#8B0000', '&:hover': { bgcolor: '#660000' } }}
                    >
                        {saving ? 'Saving...' : `Save (${pendingChanges.length})`}
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            {clashWarning && (
                <Alert severity="warning" sx={{ mb: 2 }} icon={<Warning />}>
                    {clashWarning.message}
                </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Subject & Faculty Sidebar with Tabs */}
                <Paper 
                    variant="outlined" 
                    sx={{ 
                        width: 280, 
                        maxHeight: 500, 
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <Tabs 
                        value={sidebarTab} 
                        onChange={(e, newValue) => setSidebarTab(newValue)}
                        sx={{ 
                            borderBottom: '1px solid #e0e0e0',
                            minHeight: 40
                        }}
                    >
                        <Tab 
                            icon={<Book sx={{ fontSize: 18 }} />} 
                            label="Subjects" 
                            iconPosition="start"
                            sx={{ minHeight: 40, fontSize: '0.875rem' }}
                        />
                        <Tab 
                            icon={<Person sx={{ fontSize: 18 }} />} 
                            label="Faculty" 
                            iconPosition="start"
                            sx={{ minHeight: 40, fontSize: '0.875rem' }}
                        />
                    </Tabs>

                    {/* Subjects Tab */}
                    {sidebarTab === 0 && (
                        <>
                            <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Available Subjects
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Drag to timetable • {subjects.length} total
                                </Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                                <List dense>
                                    {subjects.map((subj, idx) => (
                                        <React.Fragment key={subj.id || idx}>
                                            <ListItem
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, subj, 'subject')}
                                                onClick={() => setSelectedSubject(selectedSubject?.id === subj.id ? null : subj)}
                                                sx={{
                                                    cursor: 'grab',
                                                    bgcolor: selectedSubject?.id === subj.id ? '#e3f2fd' : 'white',
                                                    '&:hover': { bgcolor: '#f0f7ff' },
                                                    '&:active': { cursor: 'grabbing' }
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Typography variant="body2" fontWeight={500}>
                                                                {subj.name}
                                                            </Typography>
                                                            {subj.is_lab && (
                                                                <Chip 
                                                                    label="L" 
                                                                    size="small" 
                                                                    color="success" 
                                                                    sx={{ height: 16, fontSize: 10 }} 
                                                                />
                                                            )}
                                                            {selectedSubject?.id === subj.id && (
                                                                <Check sx={{ fontSize: 16, color: '#1976d2' }} />
                                                            )}
                                                        </Box>
                                                    }
                                                    secondary={`${subj.code} • ${subj.weekly_hours || 3}h/wk`}
                                                />
                                            </ListItem>
                                            {idx < subjects.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                    {subjects.length === 0 && (
                                        <ListItem>
                                            <ListItemText 
                                                primary="No subjects found" 
                                                secondary="Check department/semester" 
                                            />
                                        </ListItem>
                                    )}
                                </List>
                            </Box>
                        </>
                    )}

                    {/* Faculty Tab */}
                    {sidebarTab === 1 && (
                        <>
                            <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Available Faculty
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {selectedSubject 
                                        ? `For ${selectedSubject.code}` 
                                        : 'Select subject to filter'
                                    }
                                </Typography>
                            </Box>
                            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                                <List dense>
                                    {getFilteredFaculty().length === 0 ? (
                                        <ListItem>
                                            <ListItemText 
                                                primary={selectedSubject ? "No faculty found" : "Select a subject first"}
                                                secondary={selectedSubject ? `for ${selectedSubject.code}` : "to see available faculty"} 
                                            />
                                        </ListItem>
                                    ) : (
                                        getFilteredFaculty().map((fac, idx) => {
                                            const schedule = getFacultySchedule(fac.id);
                                            const assignedHours = schedule.length;
                                            const maxHours = fac.max_hours || 40;
                                            const isNearMax = assignedHours >= maxHours - 2;
                                            const isAtMax = assignedHours >= maxHours;

                                            return (
                                                <React.Fragment key={fac.id || idx}>
                                                    <ListItem
                                                        draggable={!isAtMax}
                                                        onDragStart={(e) => !isAtMax && handleDragStart(e, fac, 'faculty')}
                                                        sx={{
                                                            cursor: isAtMax ? 'not-allowed' : 'grab',
                                                            opacity: isAtMax ? 0.5 : 1,
                                                            bgcolor: isAtMax ? '#ffebee' : 'white',
                                                            '&:hover': { bgcolor: isAtMax ? '#ffebee' : '#f0f7ff' },
                                                            '&:active': { cursor: isAtMax ? 'not-allowed' : 'grabbing' }
                                                        }}
                                                    >
                                                        <ListItemText
                                                            primary={
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <Person sx={{ fontSize: 16, color: '#9c27b0' }} />
                                                                    <Typography variant="body2" fontWeight={500}>
                                                                        {fac.name}
                                                                    </Typography>
                                                                    {isAtMax && (
                                                                        <Chip 
                                                                            label="MAX" 
                                                                            size="small" 
                                                                            color="error" 
                                                                            sx={{ height: 16, fontSize: 9 }} 
                                                                        />
                                                                    )}
                                                                </Box>
                                                            }
                                                            secondary={
                                                                <Box>
                                                                    <Typography variant="caption" display="block">
                                                                        {fac.department}
                                                                    </Typography>
                                                                    <Typography 
                                                                        variant="caption" 
                                                                        color={isNearMax ? 'error' : 'text.secondary'}
                                                                        fontWeight={isNearMax ? 600 : 400}
                                                                    >
                                                                        {assignedHours}/{maxHours}h assigned
                                                                    </Typography>
                                                                </Box>
                                                            }
                                                        />
                                                    </ListItem>
                                                    {idx < getFilteredFaculty().length - 1 && <Divider />}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </List>
                            </Box>
                        </>
                    )}
                </Paper>

                {/* Timetable Grid */}
                <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                    <TableContainer>
                        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell 
                                        sx={{ 
                                            fontWeight: 'bold', 
                                            border: '1px solid #d2d2d7',
                                            backgroundColor: '#8B0000',
                                            color: 'white',
                                            width: 100
                                        }}
                                    >
                                        DAY \ TIME
                                    </TableCell>
                                    {TIME_SLOTS.map((slot) => (
                                        <TableCell 
                                            key={slot.label}
                                            align="center"
                                            sx={{ 
                                                fontWeight: 'bold', 
                                                border: '1px solid #d2d2d7',
                                                backgroundColor: slot.isBreak ? '#f0f0f0' : '#8B0000',
                                                color: slot.isBreak ? 'text.secondary' : 'white',
                                                whiteSpace: 'nowrap',
                                                fontSize: '0.75rem'
                                            }}
                                        >
                                            {slot.label}
                                            {slot.isBreak && (
                                                <div style={{ fontSize: 10 }}>
                                                    {slot.id === 'BREAK' ? 'Break' : 'Lunch'}
                                                </div>
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {DAYS.map((day) => (
                                    <TableRow key={day}>
                                        <TableCell 
                                            component="th" 
                                            scope="row"
                                            sx={{ 
                                                fontWeight: 'bold', 
                                                border: '1px solid #d2d2d7',
                                                backgroundColor: '#fafafa'
                                            }}
                                        >
                                            {day}
                                        </TableCell>
                                        {TIME_SLOTS.map((slot) => {
                                            if (slot.isBreak) {
                                                return (
                                                    <TableCell 
                                                        key={slot.label} 
                                                        sx={{ 
                                                            backgroundColor: '#f0f0f0', 
                                                            border: '1px solid #d2d2d7',
                                                            padding: 0
                                                        }}
                                                    />
                                                );
                                            }
                                            
                                            const isDisabled = day === 'SATURDAY' && slot.id > 4;
                                            
                                            return (
                                                <TableCell 
                                                    key={slot.label}
                                                    align="center"
                                                    onDragOver={(e) => !isDisabled && handleDragOver(e, day, slot.id)}
                                                    onDrop={(e) => !isDisabled && handleDrop(e, day, slot.id)}
                                                    sx={{ 
                                                        border: '1px solid #d2d2d7',
                                                        height: 70,
                                                        verticalAlign: 'top',
                                                        padding: '4px',
                                                        minWidth: 110,
                                                        bgcolor: isDisabled ? '#e0e0e0' : 'white'
                                                    }}
                                                >
                                                    {!isDisabled && getCellContent(day, slot.id)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Box>

            {/* Confirmation Dialog */}
            <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)}>
                <DialogTitle>{confirmDialog?.title}</DialogTitle>
                <DialogContent>
                    <Typography>{confirmDialog?.message}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={confirmDialog?.onCancel}>Cancel</Button>
                    <Button onClick={confirmDialog?.onConfirm} variant="contained" color="primary">
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default ManualAdjustment;
