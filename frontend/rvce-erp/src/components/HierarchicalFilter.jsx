import React, { useState, useEffect } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Typography,
    Chip,
} from '@mui/material';
import { FilterList } from '@mui/icons-material';
import { getDepartments, getPrograms, getYears, getSemesters } from '../services/api';

const HierarchicalFilter = ({ onFilterChange }) => {
    const [departments, setDepartments] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [years, setYears] = useState([]);
    const [semesters, setSemesters] = useState([]);

    const [selectedDept, setSelectedDept] = useState('');
    const [selectedProgram, setSelectedProgram] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');

    // Load departments on mount
    useEffect(() => {
        loadDepartments();
    }, []);

    const loadDepartments = async () => {
        try {
            const data = await getDepartments();
            setDepartments(data);
        } catch (error) {
            console.error('Failed to load departments:', error);
        }
    };

    const handleDeptChange = async (dept) => {
        setSelectedDept(dept);
        setSelectedProgram('');
        setSelectedYear('');
        setSelectedSemester('');
        setPrograms([]);
        setYears([]);
        setSemesters([]);

        if (dept) {
            const data = await getPrograms(dept);
            setPrograms(data);
        }

        onFilterChange({ dept, program: '', year: '', semester: '' });
    };

    const handleProgramChange = async (program) => {
        setSelectedProgram(program);
        setSelectedYear('');
        setSelectedSemester('');
        setYears([]);
        setSemesters([]);

        if (program && selectedDept) {
            const data = await getYears(selectedDept, program);
            setYears(data);
        }

        onFilterChange({ dept: selectedDept, program, year: '', semester: '' });
    };

    const handleYearChange = async (year) => {
        setSelectedYear(year);
        setSelectedSemester('');
        setSemesters([]);

        if (year && selectedDept && selectedProgram) {
            const data = await getSemesters(selectedDept, selectedProgram, year);
            setSemesters(data);
        }

        onFilterChange({ dept: selectedDept, program: selectedProgram, year, semester: '' });
    };

    const handleSemesterChange = (semester) => {
        setSelectedSemester(semester);
        onFilterChange({
            dept: selectedDept,
            program: selectedProgram,
            year: selectedYear,
            semester,
        });
    };

    const clearFilters = () => {
        setSelectedDept('');
        setSelectedProgram('');
        setSelectedYear('');
        setSelectedSemester('');
        setPrograms([]);
        setYears([]);
        setSemesters([]);
        onFilterChange({ dept: '', program: '', year: '', semester: '' });
    };

    return (
        <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FilterList sx={{ mr: 1, color: '#8B0000' }} />
                <Typography variant="h6" sx={{ flexGrow: 1, color: '#8B0000', fontWeight: 600 }}>
                    Filter Timetable
                </Typography>
                {selectedDept && (
                    <Chip
                        label="Clear Filters"
                        onClick={clearFilters}
                        size="small"
                        color="error"
                        variant="outlined"
                    />
                )}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <FormControl fullWidth>
                    <InputLabel>Department</InputLabel>
                    <Select
                        value={selectedDept}
                        label="Department"
                        onChange={(e) => handleDeptChange(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>All Departments</em>
                        </MenuItem>
                        {departments.map((dept) => (
                            <MenuItem key={dept.code} value={dept.code}>
                                {dept.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth disabled={!selectedDept}>
                    <InputLabel>Program</InputLabel>
                    <Select
                        value={selectedProgram}
                        label="Program"
                        onChange={(e) => handleProgramChange(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>Select Program</em>
                        </MenuItem>
                        {programs.map((prog) => (
                            <MenuItem key={prog.code} value={prog.code}>
                                {prog.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth disabled={!selectedProgram}>
                    <InputLabel>Academic Year</InputLabel>
                    <Select
                        value={selectedYear}
                        label="Academic Year"
                        onChange={(e) => handleYearChange(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>Select Year</em>
                        </MenuItem>
                        {years.map((yr) => (
                            <MenuItem key={yr.year} value={yr.year}>
                                {yr.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth disabled={!selectedYear}>
                    <InputLabel>Semester</InputLabel>
                    <Select
                        value={selectedSemester}
                        label="Semester"
                        onChange={(e) => handleSemesterChange(e.target.value)}
                    >
                        <MenuItem value="">
                            <em>Select Semester</em>
                        </MenuItem>
                        {semesters.map((sem) => (
                            <MenuItem key={sem.semester} value={sem.semester}>
                                {sem.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {selectedSemester && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        <strong>Active Filter:</strong> {selectedDept} → {selectedProgram} → Year {selectedYear} → Semester {selectedSemester}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};

export default HierarchicalFilter;
