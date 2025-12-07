import { useEffect, useState } from "react";
import { Box, Typography, Paper, Grid } from "@mui/material";

const API_BASE = "http://127.0.0.1:8000";

export default function DashboardView() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/timetable`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData([]));
  }, []);

  const teachers = new Set(data.map((r) => r.Teacher)).size;
  const sections = new Set(data.map((r) => r.Section)).size;
  const rooms = new Set(data.map((r) => r.Room)).size;
  const classesCount = data.length;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        📊 Scheduling Overview
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Total Scheduled Classes</Typography>
            <Typography variant="h4">{classesCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Teachers Involved</Typography>
            <Typography variant="h4">{teachers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Sections Covered</Typography>
            <Typography variant="h4">{sections}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2">Rooms Used</Typography>
            <Typography variant="h4">{rooms}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="body2" sx={{ mt: 3, opacity: 0.7 }}>
        This dashboard summarizes the current AI-generated timetable. In a real
        deployment we can also show conflicts, free room heatmaps, teacher load,
        etc.
      </Typography>
    </Box>
  );
}