import { useState } from "react";
import { Box, Paper, TextField, Typography, Button } from "@mui/material";

const API_BASE = "http://127.0.0.1:8000";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

const handleLogin = async () => {
  if (!name || !password) return;

  try {
    const res = await fetch("http://127.0.0.1:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: name,
        password: password,
      }),
    });

    if (!res.ok) {
      setError(true);
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    onLogin(data); // <- send token, role, external_id

  } catch (err) {
    console.error(err);
    setError(true);
  }
};

  return (
    <Box sx={{ display: "flex", height: "100vh", justifyContent: "center", alignItems: "center" }}>
      <Paper sx={{ p: 3, width: 360 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>RVCE Timetable ERP</Typography>

        <TextField label="Username" fullWidth sx={{ mb: 2 }} value={username}
          onChange={(e) => setUsername(e.target.value)} />

        <TextField type="password" label="Password" fullWidth sx={{ mb: 2 }} value={password}
          onChange={(e) => setPassword(e.target.value)} />

        {error && <Typography sx={{ color: "red", mb: 2 }}>{error}</Typography>}

        <Button variant="contained" fullWidth sx={{ py: 1.2 }} onClick={handleLogin}>
          Login
        </Button>
      </Paper>
    </Box>
  );
}