import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from "@mui/material";
import TimetableGrid from "../components/TimetableGrid";

const API_BASE = "http://127.0.0.1:8000";

export default function TeacherView({ user }) {
  const [timetable, setTimetable] = useState([]);
  const [teacher, setTeacher] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/timetable`)
      .then(res => res.json())
      .then(setTimetable);
  }, []);

  const teachers = [...new Set(timetable.map((r) => r.Teacher))].sort();

  useEffect(() => {
    if (user?.role === "Teacher") setTeacher(user.external_id);
  }, [user]);

  const filtered = timetable.filter((r) => r.Teacher === teacher);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>👩‍🏫 Teacher Timetable</Typography>

      {user?.role !== "Teacher" ? (
        <FormControl sx={{ minWidth: 250, mb: 2 }}>
          <InputLabel>Select Teacher</InputLabel>
          <Select value={teacher} label="Select Teacher" onChange={(e) => setTeacher(e.target.value)}>
            {teachers.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
      ) : (
        <Typography sx={{ mb: 2 }}>Logged in as: <b>{teacher}</b></Typography>
      )}

      {teacher && (
        <Paper sx={{ p: 2 }}>
          <TimetableGrid data={filtered} />
        </Paper>
      )}
    </Box>
  );
}