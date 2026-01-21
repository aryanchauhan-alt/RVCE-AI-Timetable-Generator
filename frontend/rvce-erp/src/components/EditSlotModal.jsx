import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Alert,
} from '@mui/material';
import { Edit } from '@mui/icons-material';

const EditSlotModal = ({ open, onClose, slotData, onSave }) => {
    const [courseCode, setCourseCode] = useState(slotData?.course || '');
    const [facultyId, setFacultyId] = useState(slotData?.faculty || '');
    const [roomId, setRoomId] = useState(slotData?.room || '');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!reason.trim()) {
            setError('Please provide a reason for this change');
            return;
        }

        try {
            await onSave({
                section: slotData.section,
                day: slotData.day,
                slot: slotData.slot,
                new_course_code: courseCode !== slotData.course ? courseCode : null,
                new_faculty_id: facultyId !== slotData.faculty ? facultyId : null,
                new_room_id: roomId !== slotData.room ? roomId : null,
                reason,
                edited_by: 'current_user@rvce.edu.in', // TODO: Get from auth context
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save changes');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ bgcolor: '#8B0000', color: 'white', display: 'flex', alignItems: 'center' }}>
                <Edit sx={{ mr: 1 }} />
                Edit Timetable Slot
            </DialogTitle>

            <DialogContent sx={{ mt: 2 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Section:</strong> {slotData?.section}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Time:</strong> {slotData?.day} | {slotData?.slot}
                    </Typography>
                </Box>

                <TextField
                    fullWidth
                    label="Course Code"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    margin="normal"
                    helperText={`Original: ${slotData?.course}`}
                />

                <TextField
                    fullWidth
                    label="Faculty ID"
                    value={facultyId}
                    onChange={(e) => setFacultyId(e.target.value)}
                    margin="normal"
                    helperText={`Original: ${slotData?.faculty}`}
                />

                <TextField
                    fullWidth
                    label="Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    margin="normal"
                    helperText={`Original: ${slotData?.room}`}
                />

                <TextField
                    fullWidth
                    label="Reason for Change *"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    margin="normal"
                    multiline
                    rows={3}
                    placeholder="e.g., Teacher unavailable, room conflict, etc."
                />
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit">
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    sx={{ bgcolor: '#8B0000', '&:hover': { bgcolor: '#660000' } }}
                >
                    Save Changes
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditSlotModal;
