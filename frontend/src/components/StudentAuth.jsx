import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, ChevronRight, GraduationCap } from 'lucide-react';

const StudentAuth = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [selectedClass, setSelectedClass] = useState('Class 10');

    useEffect(() => {
        const savedName = localStorage.getItem('studentName');
        const savedClass = localStorage.getItem('studentClass');
        if (savedName && savedClass) {
            navigate('/student/dashboard');
        }
    }, [navigate]);

    const handleLogin = () => {
        if (!name.trim()) return;
        localStorage.setItem('studentName', name);
        localStorage.setItem('studentClass', selectedClass);
        navigate('/student/dashboard');
    };

    const classes = [
        "Class 6", "Class 7", "Class 8", "Class 9",
        "Class 10", "Class 11", "Class 12"
    ];

    return (
        <div className="student-auth-root">
            {/* Background Layer */}
            <div className="student-auth-bg"></div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="student-auth-card"
            >
                <div className="student-auth-header">
                    <div className="student-auth-icon">
                        <GraduationCap size={32} />
                    </div>
                    <h1>Welcome Student</h1>
                    <p>Setup your profile to start learning</p>
                </div>

                <div className="student-auth-form">
                    <div className="student-field">
                        <label>Your Name</label>
                        <div className="student-input">
                            <User size={18} />
                            <input
                                type="text"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                            />
                        </div>
                    </div>

                    <div className="student-field">
                        <label>Select Your Class</label>
                        <div className="student-class-grid">
                            {classes.map(cls => (
                                <button
                                    key={cls}
                                    onClick={() => setSelectedClass(cls)}
                                    className={`class-pill ${selectedClass === cls ? 'active' : ''}`}
                                >
                                    {cls}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={!name.trim()}
                        className="student-auth-btn"
                    >
                        Start Studying <ChevronRight size={20} />
                    </button>
                </div>

                <div className="student-auth-footer">
                    Fully offline • Privacy focused
                </div>
            </motion.div>
        </div>
    );
};

export default StudentAuth;
