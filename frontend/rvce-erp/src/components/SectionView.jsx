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

export default function SectionView({ user }) {
  const [timetable, setTimetable] = useState([]);
  const [section, setSection] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/timetable`)
      .then(res => res.json())
      .then(setTimetable);
  }, []);

  const sections = [...new Set(timetable.map((r) => r.Section))].sort();

  useEffect(() => {
    if (user?.role === "Student") setSection(user.id);
  }, [user]);

  const filtered = timetable.filter((r) => r.Section === section);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>🎓 Section Timetable</Typography>

      {user?.role !== "Student" ? (
        <FormControl sx={{ minWidth: 250, mb: 2 }}>
          <InputLabel>Select Section</InputLabel>
          <Select value={section} onChange={(e) => setSection(e.target.value)}>
            {sections.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      ) : (
        <Typography sx={{ mb: 2 }}>Logged in as Section: <b>{section}</b></Typography>
      )}

      {section && (
        <Paper sx={{ p: 2 }}>
          <TimetableGrid data={filtered} />
        </Paper>
      )}
    </Box>
  );
}