import React, { useState } from 'react';
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
    TextField,
    CircularProgress,
    Alert,
    Chip,
} from '@mui/material';
import { Science } from '@mui/icons-material';
import { getTimetableView } from '../services/api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = [
    '09:00-10:00',
    '10:00-11:00',
    '11:30-12:30',
    '12:30-01:30',
    '02:30-03:30',
    '03:30-04:30',
];

const LabTimetable = () => {
    const [labId, setLabId] = useState('');
    const [timetableData, setTimetableData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadTimetable = async () => {
        if (!labId.trim()) return;

        setLoading(true);
        setError('');
        try {
            const response = await getTimetableView('lab', { room_id: labId });
            setTimetableData(response.data || {});
        } catch (err) {
            setError('Lab not found or not scheduled');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            loadTimetable();
        }
    };

    return (
        <Box>
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Science sx={{ color: '#8B0000' }} />
                    <TextField
                        label="Enter Lab ID"
                        value={labId}
                        onChange={(e) => setLabId(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onBlur={loadTimetable}
                        placeholder="e.g., CSE-LAB1"
                        size="small"
                        sx={{ flexGrow: 1, maxWidth: 400 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        Press Enter to search
                    </Typography>
                </Box>
            </Paper>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress sx={{ color: '#8B0000' }} />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!loading && Object.keys(timetableData).length > 0 && (
                <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box
                        sx={{
                            bgcolor: '#8B0000',
                            color: 'white',
                            p: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Lab: {labId}
                        </Typography>
                        <Chip label="Lab View" sx={{ bgcolor: 'white', color: '#8B0000' }} />
                    </Box>

                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontWeight: 600, width: '100px' }}>Time / Day</TableCell>
                                    {DAYS.map((day) => (
                                        <TableCell key={day} align="center" sx={{ fontWeight: 600 }}>
                                            {day}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {TIME_SLOTS.map((slot) => (
                                    <TableRow key={slot} hover>
                                        <TableCell sx={{ fontWeight: 500, bgcolor: '#fafafa' }}>
                                            {slot}
                                        </TableCell>
                                        {DAYS.map((day) => {
                                            const entries = timetableData[day]?.[slot] || [];
                                            return (
                                                <TableCell key={`${day}-${slot}`} align="center" sx={{ minWidth: '150px' }}>
                                                    {entries.length > 0 ? (
                                                        <Box>
                                                            {entries.map((entry, idx) => (
                                                                <Box
                                                                    key={idx}
                                                                    sx={{
                                                                        p: 1,
                                                                        mb: idx < entries.length - 1 ? 1 : 0,
                                                                        bgcolor: '#e3f2fd',
                                                                        borderRadius: 1,
                                                                        border: '1px solid #90caf9',
                                                                    }}
                                                                >
                                                                    <Chip
                                                                        label="LAB"
                                                                        size="small"
                                                                        sx={{ mb: 0.5, bgcolor: '#1976d2', color: 'white', fontSize: '0.65rem' }}
                                                                    />
                                                                    <Typography variant="caption" display="block" fontWeight={600}>
                                                                        {entry[0]}
                                                                    </Typography>
                                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                                        Faculty: {entry[2]}
                                                                    </Typography>
                                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                                        Section: {entry[1] || 'N/A'}
                                                                    </Typography>
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" color="text.disabled">
                                                            Available
                                                        </Typography>
                                                    )}
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
        </Box>
    );
};

export default LabTimetable;
