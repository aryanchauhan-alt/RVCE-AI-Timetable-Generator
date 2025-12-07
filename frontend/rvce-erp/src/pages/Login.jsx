import { useState } from "react";
import { Box, Paper, TextField, Typography, Button } from "@mui/material";

console.log("🔥 THIS IS THE REAL LOGIN.jsx");
const API_BASE = "http://127.0.0.1:8000/auth/login";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    console.log("🔥 Login clicked");

    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      console.log("📦 API Response:", data);

      if (!res.ok) {
        setError(data.detail || "Invalid login");
        return;
      }

      onLogin(data);

    } catch (err) {
      console.error(err);
      setError("Server error");
    }
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Paper sx={{ p: 4, width: 350 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>RVCE Timetable ERP</Typography>

        <TextField label="Username" fullWidth sx={{ mb: 2 }}
          value={username} onChange={(e) => setUsername(e.target.value)} />

        <TextField type="password" label="Password" fullWidth sx={{ mb: 2 }}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        
        {error && <Typography sx={{ color: "red", mb: 2 }}>{error}</Typography>}

        <Button variant="contained" fullWidth sx={{ py: 1.2 }} onClick={handleLogin}>
          Login
        </Button>
      </Paper>
    </Box>
  );
}