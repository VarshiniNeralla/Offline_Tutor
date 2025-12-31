import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
    ListChecks
} from "lucide-react";

import "../assets/styles/student-dashboard.css";

const StudentDashboard = () => {
    const navigate = useNavigate();
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
        const savedName = localStorage.getItem("studentName");
        const savedClass = localStorage.getItem("studentClass");

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
            const data = await res.json();
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
                            <p>{studentClass} Student</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button onClick={() => navigate("/student/login")}>Change Class</button>
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
                                    <h2>My Subjects</h2>
                                    <p>Select a subject to continue learning</p>
                                </div>
                                <div className="search-box">
                                    <Search size={16} />
                                    <input placeholder="Search subjects" />
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
                                    <h3 style={{ margin: 0, color: "var(--text-main)", fontSize: "1.1rem" }}>No subjects added yet</h3>
                                    <p style={{ margin: 0, maxWidth: "300px" }}>They will be uploaded soon.</p>
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
                                                <span>{sub.pages} pages</span><span>•</span><span>{sub.chunks} blocks</span>
                                            </div>
                                            <div className="subject-cta">
                                                Open subject <ChevronRight size={16} />
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

                            onStartBook={(book, toolType = 'chat') => {
                                const toolState = {
                                    subject: activeSubject.name,
                                    class: studentClass,
                                    bookId: book.book_id,
                                    bookName: book.file_name,
                                    toolType
                                };

                                if (toolType === 'quiz') {
                                    navigate("/quiz", { state: toolState });
                                } else if (toolType === 'summary') {
                                    navigate("/summary", { state: toolState });
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

const SubjectHome = ({ subject, onBack, onStartBook }) => {
    const [selectedTool, setSelectedTool] = useState(null);

    const tools = [
        { id: 'quiz', icon: Zap, title: "AI Quiz", desc: "Test understanding" },
        { id: 'summary', icon: BookOpen, title: "Summaries", desc: "Chapter notes" },
        { id: 'flashcards', icon: FileText, title: "Flashcards", desc: "Key concepts" },
        { id: 'oral', icon: Mic, title: "Oral Test", desc: "Speak answers" },
        { id: 'mindmap', icon: Users, title: "Mind Maps", desc: "Visualize connections" },
        // { id: 'match', icon: Grid, title: "Match It", desc: "Concept definitions" },
        { id: 'truefalse', icon: CheckSquare, title: "True/False", desc: "Fact checking" },
        { id: 'revision', icon: Layout, title: "One Page", desc: "Revision Sheet" },
        { id: 'keywords', icon: Search, title: "Keywords", desc: "Term explorer" },
        // { id: 'compare', icon: Scale, title: "Compare", desc: "Side by side" },
        // { id: 'doubt', icon: HelpCircle, title: "Doubt", desc: "Detector" },
        // { id: 'missed', icon: ListChecks, title: "Missed?", desc: "Gap analysis" }
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
                        <ChevronLeft size={18} /> Back
                    </button>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                        <selectedTool.icon size={18} />
                        Generating {selectedTool.title}
                    </div>
                </div>

                <div className="subject-hero">
                    <h1>Select a Chapter</h1>
                    <p>Choose a chapter to generate {selectedTool.title.toLowerCase()} for.</p>
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
                                    <h4>{book.file_name}</h4>
                                    <p>Ready for {selectedTool.title}</p>
                                </div>
                            </div>
                            <div className="book-select-action">
                                <span>Generate</span>
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
                <ChevronLeft size={18} /> Back
            </button>

            <div className="subject-hero">
                <h1>{subject.name}</h1>
                <p>Select a specific textbook or chapter to start studying.</p>
            </div>

            <h3 className="section-title">Chapters & Textbooks</h3>
            <div className="book-selection-list">
                {subject.books.length === 0 ? (
                    <div className="empty-state-mini">
                        <AlertCircle size={20} />
                        <p>No textbooks added for this subject yet.</p>
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
                                    <h4>{book.file_name}</h4>
                                    <p>{book.pages} pages • {book.chunks} blocks</p>
                                </div>
                            </div>
                            <div className="book-select-action">
                                <span>Study</span>
                                <ChevronRight size={16} />
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <h3 className="section-title">Study Tools</h3>

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
