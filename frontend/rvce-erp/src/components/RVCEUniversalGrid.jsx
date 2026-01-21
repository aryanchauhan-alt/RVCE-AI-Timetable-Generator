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

const DAY_MAP = {
    'MONDAY': 'Monday', 'TUESDAY': 'Tuesday', 'WEDNESDAY': 'Wednesday',
    'THURSDAY': 'Thursday', 'FRIDAY': 'Friday', 'SATURDAY': 'Saturday'
};

/**
 * Universal Timetable Grid with RV Branding
 * Can be used for Section, Room, Faculty, or Subject views
 * 
 * @param {Object} props
 * @param {string} props.title - Main title (e.g., "Class TimeTable", "Room TimeTable", "Faculty TimeTable")
 * @param {Object} props.info - Info bar data { label1: value1, label2: value2, ... }
 * @param {Array} props.slots - Array of slot objects with { day_name, slot, subject, room, faculty, is_lab, section }
 * @param {string} props.viewType - 'section' | 'room' | 'faculty' | 'subject'
 */
const RVCEUniversalGrid = ({ title = "TimeTable", info = {}, slots = [], viewType = 'section' }) => {
    
    // Build grid from slots array
    const grid = {};
    DAYS.forEach(day => {
        grid[day] = {};
        [1, 2, 3, 4, 5, 6].forEach(slot => {
            grid[day][slot] = [];
        });
    });
    
    slots?.forEach(slot => {
        const dayName = slot.day_name?.toUpperCase() || DAY_MAP[slot.day_name] || slot.day_name;
        const normalizedDay = Object.keys(DAY_MAP).find(d => 
            d === dayName || DAY_MAP[d].toUpperCase() === dayName
        ) || dayName?.toUpperCase();
        
        const slotNum = slot.slot;
        if (grid[normalizedDay] && grid[normalizedDay][slotNum]) {
            grid[normalizedDay][slotNum].push(slot);
        }
    });

    const getCellContent = (day, slotId) => {
        if (slotId === "BREAK" || slotId === "LUNCH") return null;
        if (day === "SATURDAY" && slotId > 4) return null;

        const entries = grid[day]?.[slotId] || [];
        
        if (entries.length === 0) {
            return <span className="text-gray-300 text-xs">FREE</span>;
        }

        return (
            <div className="space-y-1">
                {entries.map((entry, idx) => {
                    const subjectName = typeof entry.subject === 'object' 
                        ? (entry.subject?.name || entry.subject?.code || "Unknown")
                        : entry.subject;
                    const roomName = typeof entry.room === 'object'
                        ? (entry.room?.name || entry.room?.id || "")
                        : (entry.room || "");
                    const facultyName = typeof entry.faculty === 'object'
                        ? (entry.faculty?.name || "")
                        : (entry.faculty || "");
                    const sectionInfo = typeof entry.section === 'object'
                        ? `${entry.section?.department || ''} ${entry.section?.section || ''}`
                        : (entry.section || "");
                    const isLab = entry.is_lab;
                    
                    return (
                        <div 
                            key={idx}
                            className={`p-1 rounded ${isLab ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}
                        >
                            <div className="font-bold text-xs text-gray-900">{subjectName}</div>
                            
                            {/* Show different info based on view type */}
                            {viewType === 'section' && (
                                <>
                                    {facultyName && facultyName !== 'TBA' && (
                                        <div className="text-[10px] text-purple-700 font-medium">{facultyName}</div>
                                    )}
                                    <div className="text-[10px] text-gray-600">{roomName}</div>
                                </>
                            )}
                            
                            {viewType === 'room' && (
                                <>
                                    {facultyName && facultyName !== 'TBA' && (
                                        <div className="text-[10px] text-purple-700 font-medium">{facultyName}</div>
                                    )}
                                    {sectionInfo && (
                                        <div className="text-[10px] text-blue-600">{sectionInfo}</div>
                                    )}
                                </>
                            )}
                            
                            {viewType === 'faculty' && (
                                <>
                                    {sectionInfo && (
                                        <div className="text-[10px] text-blue-600">{sectionInfo}</div>
                                    )}
                                    <div className="text-[10px] text-gray-600">{roomName}</div>
                                </>
                            )}
                            
                            {viewType === 'subject' && (
                                <>
                                    {sectionInfo && (
                                        <div className="text-[10px] text-blue-600">{sectionInfo}</div>
                                    )}
                                    {facultyName && facultyName !== 'TBA' && (
                                        <div className="text-[10px] text-purple-700 font-medium">{facultyName}</div>
                                    )}
                                    <div className="text-[10px] text-gray-600">{roomName}</div>
                                </>
                            )}
                            
                            {isLab && <div className="text-[9px] text-green-700 font-bold mt-0.5">LAB</div>}
                        </div>
                    );
                })}
            </div>
        );
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
            {/* Header - RV Branding */}
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
                            {title}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Info Bar */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(Object.keys(info).length, 4)}, 1fr)`,
                    gap: 0,
                    borderBottom: '2px solid #1d1d1f',
                }}
            >
                {Object.entries(info).map(([label, value], idx, arr) => (
                    <Box 
                        key={label} 
                        sx={{ 
                            p: 1.5, 
                            borderRight: idx < arr.length - 1 ? '1px solid #d2d2d7' : 'none' 
                        }}
                    >
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>{value}</Typography>
                    </Box>
                ))}
            </Box>

            {/* Timetable Grid - Horizontal Layout (Days as rows, Time as columns) */}
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
                                    {slot.isBreak && (
                                        <div className="text-[10px] font-normal text-gray-500 uppercase">
                                            {slot.id === 'BREAK' ? 'Short Break' : 'Lunch'}
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
                                    
                                    if (day === 'SATURDAY' && typeof slot.id === 'number' && slot.id > 4) {
                                        return (
                                            <TableCell 
                                                key={slot.label} 
                                                sx={{ backgroundColor: '#e0e0e0', border: '1px solid #d2d2d7' }} 
                                            />
                                        );
                                    }

                                    return (
                                        <TableCell 
                                            key={slot.label}
                                            align="center"
                                            sx={{ 
                                                border: '1px solid #d2d2d7',
                                                height: '70px',
                                                verticalAlign: 'top',
                                                padding: '4px',
                                                minWidth: '120px'
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

export default RVCEUniversalGrid;
