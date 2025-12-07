import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import TimetableView from "./pages/TimetableView";
import TeacherView from "./components/TeacherView";
import SectionView from "./components/SectionView";
import RoomView from "./components/RoomView";
import Login from "./pages/Login";
import DashboardView from "./pages/DashboardView";
import UploadView from "./pages/UploadView";

function App() {
  const [view, setView] = useState("master");
  const [user, setUser] = useState(null);

  // Decide default screen after login
  useEffect(() => {
    if (!user) return;

    if (user.role === "Admin") setView("dashboard");
    else if (user.role === "Teacher") setView("teacher");
    else if (user.role === "Student") setView("section");
  }, [user]);

  // Protect unauthorized view access
  const getAllowedComponent = () => {
    if (!user) return <Login onLogin={setUser} />;

    if (user.role === "Admin") {
      switch (view) {
        case "dashboard": return <DashboardView />;
        case "master": return <TimetableView />;
        case "teacher": return <TeacherView />;
        case "section": return <SectionView />;
        case "room": return <RoomView />;
        case "upload": return <UploadView />;
        default: return <DashboardView />;
      }
    }

    if (user.role === "Teacher") {
      return <TeacherView user={user} />;
    }

    if (user.role === "Student") {
      return <SectionView user={user} />;
    }
  };

  return (
    <>
      {user && <Navbar setView={setView} user={user} onLogout={() => {
  localStorage.removeItem("token");
  setUser(null);
}} />}
      {getAllowedComponent()}
    </>
  );
}

export default App;