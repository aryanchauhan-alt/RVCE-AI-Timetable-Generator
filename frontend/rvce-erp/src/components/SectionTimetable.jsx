import React, { useState, useEffect } from 'react';
import {
    Box,
    Alert,
    CircularProgress,
    Typography,
} from '@mui/material';
import { getTimetableView } from '../services/api';
import RVCETimetableGrid from './RVCETimetableGrid';

const SectionTimetable = ({ filters }) => {
    const [timetableData, setTimetableData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (filters.dept) {
            loadTimetable();
        }
    }, [filters]);

    const loadTimetable = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await getTimetableView('section', filters);
            console.log('API Response:', response);
            setTimetableData(response.data || {});
        } catch (err) {
            setError('Failed to load timetable.');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress sx={{ color: '#8B0000' }} />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (!filters.dept) {
        return (
            <Alert severity="info">
                Please select Department to view timetables
            </Alert>
        );
    }

    const sections = Object.keys(timetableData);

    if (sections.length === 0) {
        return (
            <Alert severity="warning">
                No timetable found. Click "Generate Timetable" button first.
            </Alert>
        );
    }

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 2, color: '#8B0000', fontWeight: 600 }}>
                Showing {sections.length} section(s)
            </Typography>

            {sections.map((sectionKey) => {
                const sectionData = timetableData[sectionKey];
                const parts = sectionKey.split('_');
                const section = parts.slice(1).join('_');
                
                // Extract room from the first entry in sectionData if available
                // sectionData is an object with keys like "SectionID_Day_Slot" -> { subject, room, ... }
                let dedicatedRoom = "TBD";
                const firstEntry = Object.values(sectionData)[0];
                if (firstEntry && firstEntry.room) {
                    // If it's a virtual room, maybe show "Virtual" or just the first part
                    dedicatedRoom = firstEntry.room.startsWith("Virtual") ? "Virtual" : firstEntry.room;
                    
                    // Try to find a non-lab room if possible (as labs have different rooms)
                    const theoryEntry = Object.values(sectionData).find(e => !e.is_lab);
                    if (theoryEntry && theoryEntry.room) {
                        dedicatedRoom = theoryEntry.room;
                    }
                }

                // Data is already in correct format from backend
                return (
                    <Box key={sectionKey} sx={{ mb: 4 }}>
                        <RVCETimetableGrid
                            section={section}
                            program={filters.program || 'UG'}
                            semester={filters.semester || ''}
                            classroom={dedicatedRoom}
                            timetableData={sectionData}
                        />
                    </Box>
                );
            })}
        </Box>
    );
};

export default SectionTimetable;
