import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export default function Navbar({ setView, user, onLogout }) {
  const isAdmin = user?.role === "Admin";
  const isTeacher = user?.role === "Teacher";
  const isStudent = user?.role === "Student";

  return (
    <AppBar position="static" sx={{ background: "#8B0000" }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          RVCE Timetable ERP
        </Typography>

        <Box sx={{ mr: 3, textAlign: "right", fontSize: 13 }}>
         <div>{user.external_id || user.role}</div>
          <div style={{ opacity: 0.8 }}>{user.role}</div>
        </Box>

        {/* Admin Only */}
        {isAdmin && (
          <>
            <Button color="inherit" onClick={() => setView("dashboard")}>Dashboard</Button>
            <Button color="inherit" onClick={() => setView("master")}>Master</Button>
            <Button color="inherit" onClick={() => setView("teacher")}>Teachers</Button>
            <Button color="inherit" onClick={() => setView("section")}>Sections</Button>
            <Button color="inherit" onClick={() => setView("room")}>Rooms</Button>
            <Button color="inherit" onClick={() => setView("upload")}>Upload Data</Button>
          </>
        )}

        {/* Teacher Only */}
        {isTeacher && (
          <Button color="inherit" onClick={() => setView("teacher")}>
            My Timetable
          </Button>
        )}

        {/* Student Only */}
        {isStudent && (
          <Button color="inherit" onClick={() => setView("section")}>
            My Timetable
          </Button>
        )}

        <Button color="inherit" sx={{ ml: 2 }} onClick={onLogout}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}