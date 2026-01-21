import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TimetableViewV2 from './pages/TimetableViewV2';
import ManageTimetable from './pages/ManageTimetable';
import FacultyManage from './pages/FacultyManage';
import RoomsManage from './pages/RoomsManage';
import SubjectsManage from './pages/SubjectsManage';
import UploadData from './pages/UploadData';
import Settings from './pages/Settings'; // Keep existing import
import AppShell from './components/layout/AppShell'; // New import

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly, teacherOnly, studentOnly }) => {
    const { user, isAdmin, isTeacher, isStudent, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }
    if (!user) return <Navigate to="/" state={{ from: location }} replace />; // Redirect to Landing Page instead of Login

    // Check role-based access
    if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
    if (teacherOnly && !isTeacher && !isAdmin) return <Navigate to="/dashboard" replace />;
    if (studentOnly && !isStudent && !isTeacher && !isAdmin) return <Navigate to="/dashboard" replace />;

    return children;
};

// Route wrapper for Landing/Login to redirect if already logged in
const PublicOnlyRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null; // Or a loading spinner
    if (user) return <Navigate to="/dashboard" replace />;
    return children;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />
            <Route path="/timetable/view" element={
                <ProtectedRoute adminOnly={true}>
                    <TimetableViewV2 />
                </ProtectedRoute>
            } />
            <Route path="/timetable/manage" element={
                <ProtectedRoute adminOnly={true}>
                    <ManageTimetable />
                </ProtectedRoute>
            } />
            <Route path="/upload" element={
                <ProtectedRoute adminOnly={true}>
                    <UploadData />
                </ProtectedRoute>
            } />
            <Route path="/faculty" element={
                <ProtectedRoute teacherOnly={true}>
                    <FacultyManage />
                </ProtectedRoute>
            } />
            <Route path="/faculty/manage" element={
                <ProtectedRoute adminOnly={true}>
                    <FacultyManage />
                </ProtectedRoute>
            } />
            <Route path="/rooms/manage" element={
                <ProtectedRoute adminOnly={true}>
                    <RoomsManage />
                </ProtectedRoute>
            } />
            <Route path="/subjects/manage" element={
                <ProtectedRoute adminOnly={true}>
                    <SubjectsManage />
                </ProtectedRoute>
            } />
            <Route path="/settings" element={
                <ProtectedRoute adminOnly={true}>
                    <Settings />
                </ProtectedRoute>
            } />
            <Route path="/section" element={
                <ProtectedRoute studentOnly={true}>
                    <TimetableViewV2 />
                </ProtectedRoute>
            } />
            {/* Fallback for any unmatched routes, redirect to dashboard if logged in, otherwise landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
