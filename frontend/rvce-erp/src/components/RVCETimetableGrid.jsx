import React from 'react';
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
} from '@mui/material';
import { School } from '@mui/icons-material';

// RVCE Timetable Format - Matches uploaded image
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

const RVCETimetableGrid = ({ section, program, semester, classroom, timetableData }) => {
    const currentDate = new Date().toLocaleDateString('en-GB');
    const semesterType = semester % 2 === 0 ? 'EVEN SEM' : 'ODD SEM';

    // Helper to find class for a specific day and slot
    const getCellContent = (day, slotId) => {
        if (slotId === "BREAK" || slotId === "LUNCH") return null;
        if (day === "SATURDAY" && slotId > 4) return null;

        // Data can be in different formats:
        // 1. {slots: [...], section: {...}} - New API format
        // 2. Array of slot objects
        // 3. Dictionary with keys like "1_Monday_1"
        if (!timetableData) return <span className="text-gray-300 text-xs">FREE</span>;

        // Handle new API format with slots array
        let slots = null;
        if (timetableData.slots && Array.isArray(timetableData.slots)) {
            slots = timetableData.slots;
        } else if (Array.isArray(timetableData)) {
            slots = timetableData;
        }

        if (slots) {
            const entry = slots.find(d => 
                d.day_name?.toUpperCase() === day && d.slot === slotId
            );
            if (entry) {
                const subjectName = typeof entry.subject === 'object' 
                    ? (entry.subject?.name || entry.subject?.code || "Unknown")
                    : entry.subject;
                const roomName = typeof entry.room === 'object'
                    ? (entry.room?.name || "")
                    : entry.room;
                const facultyName = typeof entry.faculty === 'object'
                    ? (entry.faculty?.name || "")
                    : (entry.faculty || "");
                    
                return (
                    <div className={`p-1 rounded ${entry.is_lab ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className="font-bold text-xs text-gray-900">{subjectName}</div>
                        {facultyName && facultyName !== 'TBA' && (
                            <div className="text-[10px] text-purple-700 font-medium">{facultyName}</div>
                        )}
                        <div className="text-[10px] text-gray-600">{roomName}</div>
                        {entry.is_lab && <div className="text-[9px] text-green-700 font-bold mt-0.5">LAB</div>}
                    </div>
                );
            }
        }
        
        // Handle dictionary format (from V7 API raw format)
        if (typeof timetableData === 'object' && !timetableData.slots) {
            for (const [key, val] of Object.entries(timetableData)) {
                const parts = key.split('_');
                if (parts.length >= 3) {
                    const d = parts[1];
                    const s = parseInt(parts[2]);
                    if (d.toUpperCase() === day && s === slotId) {
                        const subjectName = typeof val.subject === 'object' 
                            ? (val.subject.name || val.subject.code || "Unknown")
                            : val.subject;
                        const facultyName = typeof val.faculty === 'object'
                            ? (val.faculty?.name || "")
                            : (val.faculty || "");
                            
                        return (
                            <div className={`p-1 rounded ${val.is_lab ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                                <div className="font-bold text-xs text-gray-900">{subjectName}</div>
                                {facultyName && facultyName !== 'TBA' && (
                                    <div className="text-[10px] text-purple-700 font-medium">{facultyName}</div>
                                )}
                                <div className="text-[10px] text-gray-600">{val.room}</div>
                                {val.is_lab && <div className="text-[9px] text-green-700 font-bold mt-0.5">LAB</div>}
                            </div>
                        );
                    }
                }
            }
        }
        
        return <span className="text-gray-300 text-xs">FREE</span>;
    };

    return (
        <Paper
            elevation={0}
            sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '2px solid #1d1d1f',
                background: 'white',
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    background: 'linear-gradient(135deg, #8B0000 0%, #660000 100%)',
                    color: 'white',
                    p: 2,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <School sx={{ fontSize: 48 }} />
                        <Box>
                            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block' }}>
                                RV Educational Institutions
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                RV College of Engineering
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            Class TimeTable
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Info Bar */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 0,
                    borderBottom: '2px solid #1d1d1f',
                }}
            >
                <Box sx={{ p: 1.5, borderRight: '1px solid #d2d2d7' }}>
                    <Typography variant="caption" color="text.secondary">
                        Program
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                        {program || "Information Science"}
                    </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRight: '1px solid #d2d2d7' }}>
                    <Typography variant="caption" color="text.secondary">
                        Semester
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                        {semester || "III"}
                    </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRight: '1px solid #d2d2d7' }}>
                    <Typography variant="caption" color="text.secondary">
                        Section
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                        {section || "A"}
                    </Typography>
                </Box>
                <Box sx={{ p: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Classroom No
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                        {classroom || "IS-110"}
                    </Typography>
                </Box>
            </Box>

            {/* Timetable Grid */}
            <TableContainer>
                <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    border: '1px solid #d2d2d7',
                                    backgroundColor: '#f5f5f7',
                                    width: '100px'
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
                                        backgroundColor: '#f5f5f7',
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.75rem'
                                    }}
                                >
                                    {slot.label}
                                    {slot.isBreak && <div className="text-[10px] font-normal text-gray-500 uppercase">{slot.id === 'BREAK' ? 'Short Break' : 'Lunch'}</div>}
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
                                    
                                    // Saturday check
                                    if (day === 'SATURDAY' && typeof slot.id === 'number' && slot.id > 4) {
                                        return <TableCell key={slot.label} sx={{ backgroundColor: '#e0e0e0', border: '1px solid #d2d2d7' }} />;
                                    }

                                    return (
                                        <TableCell 
                                            key={slot.label}
                                            align="center"
                                            sx={{ 
                                                border: '1px solid #d2d2d7',
                                                height: '60px',
                                                verticalAlign: 'top',
                                                padding: '4px'
                                            }}
                                        >
                                            {getCellContent(day, slot.id)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default RVCETimetableGrid;
