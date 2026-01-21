import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { School as SchoolIcon } from "@mui/icons-material";

export default function Navbar({ setView, user, onLogout }) {
  const isAdmin = user?.role === "Admin";

  return (
    <AppBar
      position="static"
      sx={{
        background: "linear-gradient(135deg, #a80000 0%, #8b0000 100%)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <Toolbar>
        <SchoolIcon sx={{ mr: 2, fontSize: 28 }} />
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            fontSize: "1.25rem",
          }}
        >
          RVCE Timetable Management System
        </Typography>

        <Box
          sx={{
            mr: 3,
            textAlign: "right",
            fontSize: 13,
            opacity: 0.9,
          }}
        >
          <div style={{ fontWeight: 600 }}>{user?.full_name || user?.username}</div>
          <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>{user?.role}</div>
        </Box>

        {isAdmin && (
          <>
            <Button
              color="inherit"
              onClick={() => setView("dashboard")}
              sx={{ fontWeight: 500 }}
            >
              Dashboard
            </Button>
            <Button
              color="inherit"
              onClick={() => setView("upload")}
              sx={{ fontWeight: 500 }}
            >
              Upload CSV
            </Button>
          </>
        )}

        <Button
          color="inherit"
          onClick={onLogout}
          sx={{
            ml: 2,
            fontWeight: 600,
            "&:hover": { background: "rgba(255,255,255,0.1)" },
          }}
        >
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}
