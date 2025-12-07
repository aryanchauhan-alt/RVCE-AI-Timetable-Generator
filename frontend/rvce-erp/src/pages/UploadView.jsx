import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

export default function UploadView() {
  const [fileType, setFileType] = useState("classes");
  const [preview, setPreview] = useState([]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.trim().split("\n");
      const rows = lines.map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "")));
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  const headers = preview[0] || [];
  const rows = preview.slice(1);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        📁 Upload CSV Data
      </Typography>

      <Typography variant="body2" sx={{ mb: 2 }}>
        Here admin can upload updated data for teachers / rooms / classes.
        Currently this is a front-end preview; we can later wire it to the backend
        to actually update the database.
      </Typography>

      <ToggleButtonGroup
        value={fileType}
        exclusive
        onChange={(_, v) => v && setFileType(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="teachers">Teachers</ToggleButton>
        <ToggleButton value="rooms">Rooms</ToggleButton>
        <ToggleButton value="classes">Classes</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ mt: 1, mb: 2 }}>
        <Button variant="contained" component="label">
          Choose {fileType}.csv
          <input type="file" accept=".csv" hidden onChange={handleFile} />
        </Button>
      </Box>

      {preview.length > 0 && (
        <Paper sx={{ p: 2, maxHeight: 400, overflow: "auto" }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Preview of {fileType}.csv
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                {headers.map((h, idx) => (
                  <TableCell key={idx}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}