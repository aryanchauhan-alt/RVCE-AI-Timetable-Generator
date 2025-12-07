import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import TimetableGrid from "../components/TimetableGrid";

const API_BASE = "http://127.0.0.1:8000";

export default function TimetableView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/timetable`);
      setData(await res.json());
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const generateTimetable = async () => {
    setLoading(true);
    await fetch(`${API_BASE}/generate`, { method: "POST" });
    await loadTimetable();
  };

  const downloadCSV = () => {
    if (!data.length) return;
    const csv = data.map(obj => Object.values(obj).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rvce_timetable.csv";
    link.click();
  };

  useEffect(() => {
    loadTimetable();
  }, []);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        📋 Master Timetable
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="contained" onClick={generateTimetable} disabled={loading}>
          Generate (AI)
        </Button>
        <Button variant="outlined" onClick={loadTimetable} disabled={loading}>
          Refresh
        </Button>
        <Button variant="outlined" onClick={downloadCSV} disabled={!data.length}>
          Download CSV
        </Button>
      </Stack>

      {loading && (
        <Box sx={{ textAlign: "center", mt: 3 }}>
          <CircularProgress />
          <Typography>Generating timetable using AI (Google OR-Tools)…</Typography>
        </Box>
      )}

      {!loading && data.length > 0 && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <TimetableGrid data={data} />
        </Paper>
      )}
    </Box>
  );
}