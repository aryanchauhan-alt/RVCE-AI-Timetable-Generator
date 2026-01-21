import React, { useState, useEffect } from 'react';
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
    CircularProgress,
    Alert,
    Autocomplete,
    TextField,
} from '@mui/material';
import { MeetingRoom, School } from '@mui/icons-material';
import { getTimetableView, getRooms } from '../services/api';

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

const RoomView = () => {
    const [roomId, setRoomId] = useState('');
    const [roomName, setRoomName] = useState('');
    const [roomList, setRoomList] = useState([]);
    const [timetableData, setTimetableData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadRooms = async () => {
            try {
                const response = await getRooms();
                setRoomList(response.data || []);
            } catch (err) {
                console.error('Failed to load room list:', err);
            }
        };
        loadRooms();
    }, []);

    const loadTimetable = async (rid) => {
        if (!rid) return;
        setLoading(true);
        setError('');
        try {
            const response = await getTimetableView('room', { room_id: rid });
            setTimetableData(response.data || {});
        } catch (err) {
            setError('Room not found or no classes assigned');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRoomSelect = (event, value) => {
        if (value) {
            setRoomId(value.id || value.name);
            setRoomName(value.name || value.id);
            loadTimetable(value.id || value.name);
        }
    };

    const getCellContent = (day, slotId) => {
        if (slotId === "BREAK" || slotId === "LUNCH") return null;
        if (day === "SATURDAY" && slotId > 4) return null;
        if (!timetableData) return <span className="text-gray-300 text-xs">FREE</span>;

        const dayMap = {
            'MONDAY': 'Mon', 'TUESDAY': 'Tue', 'WEDNESDAY': 'Wed',
            'THURSDAY': 'Thu', 'FRIDAY': 'Fri', 'SATURDAY': 'Sat'
        };
        const slotMap = {
            1: '09:00-10:00', 2: '10:00-11:00', 3: '11:30-12:30',
            4: '12:30-01:30', 5: '02:30-03:30', 6: '03:30-04:30'
        };

        const dayKey = dayMap[day];
        const slotKey = slotMap[slotId];

        if (dayKey && slotKey && timetableData[dayKey]?.[slotKey]) {
            const entries = timetableData[dayKey][slotKey];
            if (entries.length > 0) {
                return (
                    <Box>
                        {entries.map((entry, idx) => {
                            const isLab = entry[0]?.toLowerCase().includes('lab') || entry[0]?.includes('(L)');
                            return (
                                <div 
                                    key={idx}
                                    className={`p-1 rounded mb-1 ${isLab ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}
                                >
                                    <div className="font-bold text-xs text-gray-900">{entry[0]}</div>
                                    <div className="text-[10px] text-purple-700 font-medium">{entry[1]}</div>
                                    <div className="text-[10px] text-gray-600">{entry[2]}</div>
                                    {isLab && <div className="text-[9px] text-green-700 font-bold">LAB</div>}
                                </div>
                            );
                        })}
                    </Box>
                );
            }
        }
        return <span className="text-gray-300 text-xs">FREE</span>;
    };

    return (
        <Box>
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <MeetingRoom sx={{ color: '#8B0000', fontSize: 32 }} />
                    <Autocomplete
                        options={roomList}
                        getOptionLabel={(option) => `${option.name || option.id} (${option.type || 'Room'})`}
                        onChange={handleRoomSelect}
                        sx={{ flexGrow: 1, maxWidth: 500 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Search Room"
                                placeholder="Start typing room name..."
                                size="small"
                            />
                        )}
                    />
                </Box>
            </Paper>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress sx={{ color: '#8B0000' }} />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!loading && roomId && Object.keys(timetableData).length > 0 && (
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 3,
                        overflow: 'hidden',
                        border: '2px solid #1d1d1f',
                        background: 'white',
                    }}
                >
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
                                    Room TimeTable
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 0,
                            borderBottom: '2px solid #1d1d1f',
                        }}
                    >
                        <Box sx={{ p: 1.5, borderRight: '1px solid #d2d2d7' }}>
                            <Typography variant="caption" color="text.secondary">Room ID</Typography>
                            <Typography variant="body2" fontWeight={600}>{roomId}</Typography>
                        </Box>
                        <Box sx={{ p: 1.5, borderRight: '1px solid #d2d2d7' }}>
                            <Typography variant="caption" color="text.secondary">Room Name</Typography>
                            <Typography variant="body2" fontWeight={600}>{roomName}</Typography>
                        </Box>
                        <Box sx={{ p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">View Type</Typography>
                            <Typography variant="body2" fontWeight={600}>Room Schedule</Typography>
                        </Box>
                    </Box>

                    <TableContainer>
                        <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid #d2d2d7', backgroundColor: '#f5f5f7', width: '100px' }}>
                                        DAY \ TIME
                                    </TableCell>
                                    {TIME_SLOTS.map((slot) => (
                                        <TableCell 
                                            key={slot.label}
                                            align="center"
                                            sx={{ fontWeight: 'bold', border: '1px solid #d2d2d7', backgroundColor: '#f5f5f7', whiteSpace: 'nowrap', fontSize: '0.75rem' }}
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
                                        <TableCell component="th" scope="row" sx={{ fontWeight: 'bold', border: '1px solid #d2d2d7', backgroundColor: '#fafafa' }}>
                                            {day}
                                        </TableCell>
                                        {TIME_SLOTS.map((slot) => {
                                            if (slot.isBreak) {
                                                return <TableCell key={slot.label} sx={{ backgroundColor: '#f0f0f0', border: '1px solid #d2d2d7', padding: 0 }} />;
                                            }
                                            if (day === 'SATURDAY' && typeof slot.id === 'number' && slot.id > 4) {
                                                return <TableCell key={slot.label} sx={{ backgroundColor: '#e0e0e0', border: '1px solid #d2d2d7' }} />;
                                            }
                                            return (
                                                <TableCell key={slot.label} align="center" sx={{ border: '1px solid #d2d2d7', height: '70px', verticalAlign: 'top', padding: '4px', minWidth: '120px' }}>
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
            )}

            {!loading && !roomId && (
                <Alert severity="info">Please search and select a room to view its timetable</Alert>
            )}
        </Box>
    );
};

export default RoomView;
