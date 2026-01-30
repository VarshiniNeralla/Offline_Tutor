import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../context/LanguageContext";
import { translations } from "../translations";
import {
    GraduationCap,
    LogOut,
    Search,
    BookOpen,
    ChevronRight,
    ChevronLeft,
    Zap,
    Brain,
    FileText,
    Mic,
    Clock,
    AlertCircle,
    Users,
    Grid,
    CheckSquare,
    Layout,
    Scale,
    HelpCircle,
    ListChecks,
    History,
    Share2,
    Languages
} from "lucide-react";

import "../assets/styles/student-dashboard.css";

const StudentDashboard = () => {
    const navigate = useNavigate();
    const { language, toggleLanguage } = useLanguage();
    const t = translations[language];

    const getClassDisplay = (cls) => {
        if (!cls) return "";
        if (language === 'english') {
            const num = cls.match(/\d+/);
            return num ? `Class ${num[0]}` : cls;
        }
        const num = cls.match(/\d+/);
        return num ? `తరగతి ${num[0]}` : cls;
    };
    const [name, setName] = useState("");
    const [studentClass, setStudentClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [activeSubject, setActiveSubject] = useState(() => {
        const saved = sessionStorage.getItem("student_activeSubject");
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (activeSubject) {
            sessionStorage.setItem("student_activeSubject", JSON.stringify(activeSubject));
        } else {
            sessionStorage.removeItem("student_activeSubject");
        }
    }, [activeSubject]);

    useEffect(() => {
        let savedName = localStorage.getItem("studentName");
        let savedClass = localStorage.getItem("studentClass");

        if (savedClass && savedClass.includes("తరగతి")) {
            const num = savedClass.match(/\d+/);
            if (num) {
                savedClass = `Class ${num[0]}`;
                localStorage.setItem("studentClass", savedClass);
            }
        }

        if (!savedName || !savedClass) {
            navigate("/student/login");
            return;
        }

        setName(savedName);
        setStudentClass(savedClass);
        fetchSubjects(savedClass);
    }, [navigate]);

    const fetchSubjects = async (targetClass) => {
        const cls = targetClass || studentClass;
        if (!cls) return;

        try {
            const res = await fetch("/api/textbooks");
            if (!res.ok) throw new Error("Server error");

            const text = await res.text();
            if (!text) throw new Error("Empty response");

            const data = JSON.parse(text);
            const allBooks = Object.values(data);
            const classBooks = allBooks.filter(b => b.class_name === cls);
            const grouped = classBooks.reduce((acc, book) => {
                const subj = book.subject_name || "Unassigned";
                if (!acc[subj]) {
                    acc[subj] = {
                        name: subj,
                        pages: 0,
                        chunks: 0,
                        books: []
                    };
                }
                acc[subj].pages += book.pages || 0;
                acc[subj].chunks += book.chunks || 0;
                acc[subj].books.push(book);
                return acc;
            }, {});

            setSubjects(Object.values(grouped));
        } catch (err) {
            console.error("Failed to fetch subjects", err);
        }
    };

    const logout = () => {
        localStorage.clear();
        navigate("/");
    };

    return (
        <div className="dashboard-root">
            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div className="user-info">
                        <div className="user-avatar"><GraduationCap size={20} /></div>
                        <div>
                            <h1>{name}</h1>
                            <p>{getClassDisplay(studentClass)} {t.dashboard.studentLabel}</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="lang-toggle-btn" onClick={toggleLanguage} style={{ background: 'white', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer' }}>
                            <Languages size={18} />
                            <span>{language === 'english' ? 'తెలుగు' : 'English'}</span>
                        </button>
                        <button onClick={() => navigate("/student/progress")} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary-light)' }}>
                            <History size={18} /> {t.dashboard.progress}
                        </button>
                        <button onClick={() => navigate("/student/login")}>{t.dashboard.changeClass}</button>
                        <button className="logout" onClick={logout}><LogOut size={18} /></button>
                    </div>
                </div>
            </header>

            <main className="dashboard-container">
                <AnimatePresence mode="wait">
                    {!activeSubject ? (
                        <motion.section
                            key="subjects"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="dashboard-title">
                                <div>
                                    <h2>{t.dashboard.mySubjects}</h2>
                                    <p>{t.dashboard.selectSubject}</p>
                                </div>
                                <div className="search-box">
                                    <Search size={16} />
                                    <input placeholder={t.dashboard.searchSubjects} />
                                </div>
                            </div>

                            {subjects.length === 0 ? (
                                <div className="empty-state-large" style={{
                                    padding: "60px 20px",
                                    textAlign: "center",
                                    background: "white",
                                    borderRadius: "16px",
                                    border: "1px solid var(--border)",
                                    color: "var(--text-muted)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "16px"
                                }}>
                                    <div style={{
                                        width: "60px",
                                        height: "60px",
                                        background: "var(--primary-soft)",
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "var(--primary)"
                                    }}>
                                        <Clock size={32} />
                                    </div>
                                    <h3 style={{ margin: 0, color: "var(--text-main)", fontSize: "1.1rem" }}>{t.dashboard.noSubjects}</h3>
                                    <p style={{ margin: 0, maxWidth: "300px" }}>{t.dashboard.subjectsSoon}</p>
                                </div>
                            ) : (
                                <div className="subject-grid">
                                    {subjects.map((sub, idx) => (
                                        <motion.div
                                            key={sub.name}
                                            className="subject-card"
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                            onClick={() => setActiveSubject(sub)}
                                        >
                                            <div className="subject-icon"><BookOpen size={26} /></div>
                                            <h3>{sub.name}</h3>
                                            <div className="subject-meta">
                                                <span>{sub.pages} {t.dashboard.pages}</span><span>•</span><span>{sub.chunks} {t.dashboard.blocks}</span>
                                            </div>
                                            <div className="subject-cta">
                                                {t.dashboard.openSubject} <ChevronRight size={16} />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.section>
                    ) : (
                        <SubjectHome
                            subject={activeSubject}
                            onBack={() => setActiveSubject(null)}
                            t={t}
                            language={language}

                            onStartBook={(book, toolType = 'chat') => {
                                const cleanName = book.file_name.replace(/\.pdf$/i, '');
                                const toolState = {
                                    subject: activeSubject.name,
                                    class: studentClass,
                                    bookId: book.book_id,
                                    bookName: cleanName,
                                    toolType
                                };

                                if (toolType === 'quiz') {
                                    navigate("/quiz", { state: toolState });
                                } else if (toolType === 'summary') {
                                    navigate("/summary", { state: toolState });
                                } else if (toolType === 'keywords') {
                                    navigate("/keywords", { state: toolState });
                                } else if (toolType === 'truefalse') {
                                    navigate("/truefalse", { state: toolState });
                                } else if (toolType === 'flashcards') {
                                    navigate("/flashcards", { state: toolState });
                                } else if (toolType === 'oral') {
                                    navigate("/oraltest", { state: toolState });
                                } else if (toolType === 'mindmap') {
                                    navigate("/mindmap", { state: toolState });
                                } else if (toolType === 'revision') {
                                    navigate("/revision", { state: toolState });
                                } else {
                                    navigate("/chat", {
                                        state: {
                                            ...toolState,
                                            initTool: toolType
                                        }
                                    });
                                }
                            }}
                        />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

const SubjectHome = ({ subject, onBack, onStartBook, t, language }) => {
    const [selectedTool, setSelectedTool] = useState(null);

    const tools = [
        { id: 'quiz', icon: Zap, title: t.tools.items.quiz, desc: t.tools.descs.quiz },
        { id: 'summary', icon: BookOpen, title: t.tools.items.summary, desc: t.tools.descs.summary },
        { id: 'keywords', icon: Search, title: t.tools.items.keywords, desc: t.tools.descs.keywords },
        { id: 'truefalse', icon: CheckSquare, title: t.tools.items.truefalse, desc: t.tools.descs.truefalse },
        { id: 'flashcards', icon: FileText, title: t.tools.items.flashcards, desc: t.tools.descs.flashcards },
        { id: 'oral', icon: Mic, title: t.tools.items.oral_test, desc: t.tools.descs.oral_test },
        { id: 'mindmap', icon: Share2, title: t.tools.items.mindmap, desc: t.tools.descs.mindmap },
        { id: 'revision', icon: Layout, title: t.tools.items.revision, desc: t.tools.descs.revision },
    ];

    if (selectedTool) {
        return (
            <motion.section
                key="tool-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <button className="back-btn" onClick={() => setSelectedTool(null)} style={{ margin: 0 }}>
                        <ChevronLeft size={18} /> {t.dashboard.back}
                    </button>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                        <selectedTool.icon size={18} />
                        {t.dashboard.generatingTool} {selectedTool.title}
                    </div>
                </div>

                <div className="subject-hero">
                    <h1>{t.dashboard.selectChapter}</h1>
                    <p>{t.dashboard.chooseChapterFor} {t.tools.items[selectedTool.id]?.toLowerCase() || selectedTool.title.toLowerCase()}.</p>
                </div>

                <div className="book-selection-list">
                    {subject.books.map((book) => (
                        <motion.div
                            key={book.book_id}
                            className="book-select-card"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => onStartBook(book, selectedTool.id)}
                            style={{ borderLeft: '4px solid var(--primary)' }}
                        >
                            <div className="book-select-info">
                                <div className="book-select-icon"><FileText size={20} /></div>
                                <div>
                                    <h4>{book.file_name.replace(/\.pdf$/i, '')}</h4>
                                    <p>{language === 'english' ? `Ready for ${selectedTool.title}` : `${selectedTool.title} సిద్ధంగా ఉంది`}</p>
                                </div>
                            </div>
                            <div className="book-select-action">
                                <span>{t.dashboard.generate}</span>
                                <ChevronRight size={16} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.section>
        );
    }

    return (
        <motion.section
            key="subject-home"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
        >
            <button className="back-btn" onClick={onBack}>
                <ChevronLeft size={18} /> {t.dashboard.back}
            </button>

            <div className="subject-hero">
                <h1>{subject.name}</h1>
                <p>{t.dashboard.selectTextbook}</p>
            </div>

            <h3 className="section-title">{t.dashboard.chapters}</h3>
            <div className="book-selection-list">
                {subject.books.length === 0 ? (
                    <div className="empty-state-mini">
                        <AlertCircle size={20} />
                        <p>{language === 'english' ? "No textbooks added for this subject yet." : "ఈ సబ్జెక్టుకు ఇంకా పాఠ్యపుస్తకాలు జోడించబడలేదు."}</p>
                    </div>
                ) : (
                    subject.books.map((book) => (
                        <motion.div
                            key={book.book_id}
                            className="book-select-card"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => onStartBook(book, 'chat')}
                        >
                            <div className="book-select-info">
                                <div className="book-select-icon">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4>{book.file_name.replace(/\.pdf$/i, '')}</h4>
                                    <p>{book.pages} {t.dashboard.pages} • {book.chunks} {t.dashboard.blocks}</p>
                                </div>
                            </div>
                            <div className="book-select-action">
                                <span>{t.dashboard.study}</span>
                                <ChevronRight size={16} />
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <h3 className="section-title">{t.dashboard.studyTools}</h3>

            <div className="tool-grid">
                {tools.map(tool => (
                    <Tool
                        key={tool.id}
                        icon={tool.icon}
                        title={tool.title}
                        desc={tool.desc}
                        onClick={() => setSelectedTool(tool)}
                    />
                ))}
            </div>
        </motion.section>
    );
};

const Tool = ({ icon: Icon, title, desc, onClick }) => (
    <motion.div
        className="tool-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onClick}
        style={{ cursor: 'pointer' }}
        whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.08)" }}
    >
        <div className="tool-icon">
            <Icon size={22} />
        </div>
        <div>
            <h4>{title}</h4>
            <p>{desc}</p>
        </div>
    </motion.div>
);

export default StudentDashboard;
