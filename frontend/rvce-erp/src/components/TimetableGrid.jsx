import React from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIME_LABELS = [
  "09:00–10:00", "10:00–11:00", "11:00–12:00", "12:00–13:00",
  "13:00–14:00", "14:00–15:00", "15:00–16:00", "16:00–17:00"
];

// Normalize helper to prevent mismatch (dash, casing, whitespace)
const normalize = (str) => str?.toString().trim().toLowerCase();

export default function TimetableGrid({ data }) {

  // Initialize timetable structure
  const timetable = {};

  DAYS.forEach((day) => {
    timetable[normalize(day)] = {};
    TIME_LABELS.forEach((slot) => {
      timetable[normalize(slot)] = {};
      timetable[normalize(day)][normalize(slot)] = "FREE";
    });
  });

  // Fill assigned values
  data.forEach((entry) => {
    const d = normalize(entry.Day);
    const t = normalize(entry.Time);

    if (timetable[d] && timetable[d][t] !== undefined) {
      timetable[d][t] = `${entry.Subject}\n${entry.Teacher}\n${entry.Room}`;
    }
  });

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} size="small">
        
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: "bold" }}>Time</TableCell>
            {DAYS.map((day) => (
              <TableCell key={day} sx={{ fontWeight: "bold", textAlign: "center" }}>
                {day}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {TIME_LABELS.map((slot) => (
            <TableRow key={slot}>
              <TableCell sx={{ fontWeight: "bold" }}>{slot}</TableCell>

              {DAYS.map((day) => (
                <TableCell
                  key={day + slot}
                  sx={{
                    whiteSpace: "pre-line",
                    textAlign: "center",
                    background:
                      timetable[normalize(day)][normalize(slot)] !== "FREE"
                        ? "#e3f2fd"
                        : "transparent"
                  }}
                >
                  {timetable[normalize(day)][normalize(slot)]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>

      </Table>
    </TableContainer>
  );
}