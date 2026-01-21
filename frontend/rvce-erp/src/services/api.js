import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://rvce-ai-timetable-generator.onrender.com';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ==================== TIMETABLE ====================

export const generateTimetable = async (semesterType = 'all') => {
    const response = await api.post('/api/timetable/generate', { semester_type: semesterType });
    return response.data;
};

export const getTimetable = async () => {
    const response = await api.get('/api/timetable/all');
    return response.data;
};

export const getTimetableView = async (viewType, params = {}) => {
    const response = await api.get('/api/timetable/view', {
        params: { view_type: viewType, ...params }
    });
    return response.data;
};

export const editTimetableSlot = async (editData) => {
    const response = await api.post('/api/timetable/manual-edit', editData);
    return response.data;
};

export const markTeacherAbsent = async (absenceData) => {
    const response = await api.post('/api/timetable/mark-absent', absenceData);
    return response.data;
};

export const downloadTimetable = async (section) => {
    const response = await axios.get(`${API_BASE_URL}/api/timetable/download`, {
        params: { section },
        responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${section}_timetable.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

// ==================== DEPARTMENTS ====================

export const getDepartments = async () => {
    const response = await api.get('/api/timetable/departments');
    return response.data.departments || [];
};

// ==================== SECTIONS ====================

export const getSections = async () => {
    const response = await api.get('/api/timetable/sections');
    return response.data;
};

export const getSectionTimetable = async (sectionId) => {
    const response = await api.get(`/api/timetable/sections/${sectionId}`);
    return response.data;
};

// ==================== STATS ====================

export const getStats = async () => {
    const response = await api.get('/api/timetable/stats');
    return response.data;
};

// ==================== AUTH ====================

export const login = async (username, password) => {
    const response = await api.post('/auth/login', {
        username,
        password
    });
    return response.data;
};

// ==================== FACULTY & ROOMS ====================

export const getFaculty = async () => {
    const response = await api.get('/api/timetable/faculty');
    return response.data;
};

export const getFacultySchedule = async (facultyId) => {
    const response = await api.get(`/api/timetable/faculty-schedule/${facultyId}`);
    return response.data;
};

export const getRooms = async () => {
    const response = await api.get('/api/timetable/rooms');
    return response.data;
};

export const getRoomSchedule = async (roomId) => {
    const response = await api.get(`/api/timetable/rooms/${roomId}`);
    return response.data;
};

// ==================== SUBJECTS ====================

export const getSubjects = async () => {
    const response = await api.get('/api/timetable/subjects');
    return response.data;
};

export default api;
