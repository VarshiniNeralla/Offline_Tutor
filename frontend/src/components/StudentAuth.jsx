import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../translations';
import { User, ChevronRight, GraduationCap } from 'lucide-react';

const StudentAuth = () => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const t = translations[language];
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

    const classes = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];

    const getClassDisplay = (cls) => {
        if (language === 'english') return cls;
        const num = cls.match(/\d+/);
        return num ? `తరగతి ${num[0]}` : cls;
    };

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
                    <h1>{t.auth.welcome}</h1>
                    <p>{t.auth.setupProfile}</p>
                </div>

                <div className="student-auth-form">
                    <div className="student-field">
                        <label>{t.auth.yourName}</label>
                        <div className="student-input">
                            <User size={18} />
                            <input
                                type="text"
                                placeholder={t.auth.placeholderName}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                            />
                        </div>
                    </div>

                    <div className="student-field">
                        <label>{t.auth.selectClass}</label>
                        <div className="student-class-grid">
                            {classes.map(cls => (
                                <button
                                    key={cls}
                                    onClick={() => setSelectedClass(cls)}
                                    className={`class-pill ${selectedClass === cls ? 'active' : ''}`}
                                >
                                    {getClassDisplay(cls)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={!name.trim()}
                        className="student-auth-btn"
                    >
                        {t.auth.startStudying} <ChevronRight size={20} />
                    </button>
                </div>

                <div className="student-auth-footer">
                    {t.auth.footer}
                </div>
            </motion.div>
        </div>
    );
};

export default StudentAuth;
