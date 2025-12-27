import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Component Imports
import LandingPage from './components/LandingPage';
import StudentAuth from './components/StudentAuth';
import StudentDashboard from './components/StudentDashboard';
import ChatInterface from './components/ChatInterface';
import AdminDashboard from './components/AdminDashboard';

// Wrapper for AnimatePresence to work with Routes
const AnimatedRoutes = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/student/login" element={<StudentAuth />} />
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/chat" element={<ChatInterface />} />
                <Route path="/teacher" element={<AdminDashboard />} />
            </Routes>
        </AnimatePresence>
    );
};

function App() {
    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="bg-[#0a0f1c] min-h-screen text-white font-sans selection:bg-blue-500/30">
                <AnimatedRoutes />
            </div>
        </Router>
    );
}

export default App;
