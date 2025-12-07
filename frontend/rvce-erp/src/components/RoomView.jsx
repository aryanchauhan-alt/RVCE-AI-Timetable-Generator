import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";

const API_BASE = "http://127.0.0.1:8000";

export default function RoomView() {
  const [timetable, setTimetable] = useState([]);
  const [room, setRoom] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/timetable`)
      .then((res) => res.json())
      .then((data) => setTimetable(data))
      .catch(() => setTimetable([]));
  }, []);

  const rooms = Array.from(new Set(timetable.map((row) => row.Room))).sort();

  const filtered =
    room === ""
      ? []
      : timetable.filter((row) => row.Room === room);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        🏫 Room Usage Timetable
      </Typography>

      <FormControl sx={{ minWidth: 240, mb: 3 }}>
        <InputLabel>Select Room</InputLabel>
        <Select
          value={room}
          label="Select Room"
          onChange={(e) => setRoom(e.target.value)}
        >
          {rooms.map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {room && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Day</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Teacher</TableCell>
                <TableCell>Section</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.Day}</TableCell>
                  <TableCell>{row.Time}</TableCell>
                  <TableCell>{row.Subject}</TableCell>
                  <TableCell>{row.Teacher}</TableCell>
                  <TableCell>{row.Section}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}