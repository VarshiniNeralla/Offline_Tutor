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
    Clock
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
        fetchSubjects(savedClass); // Pass class directly to avoid state lag
    }, [navigate]);

    const fetchSubjects = async (targetClass) => {
        // Use targetClass if provided, otherwise fallback to state
        const cls = targetClass || studentClass;
        if (!cls) return;

        try {
            const res = await fetch("/api/textbooks");
            const data = await res.json();

            // 1. Filter by student's class
            const allBooks = Object.values(data);
            const classBooks = allBooks.filter(b => b.class_name === cls);

            console.log(`Student dashboard sync: Class=[${cls}], Total=[${allBooks.length}], Filtered=[${classBooks.length}]`);

            // 2. Group by subject name
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
                acc[subj].books.push(book); // Store full book object
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
            {/* HEADER */}
            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div className="user-info">
                        <div className="user-avatar">
                            <GraduationCap size={20} />
                        </div>
                        <div>
                            <h1>{name}</h1>
                            <p>{studentClass} Student</p>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button onClick={() => navigate("/student/login")}>Change Class</button>
                        <button className="logout" onClick={logout}>
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* CONTENT */}
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
                                        <div className="subject-icon">
                                            <BookOpen size={26} />
                                        </div>

                                        <h3>{sub.name}</h3>

                                        <div className="subject-meta">
                                            <span>{sub.pages} pages</span>
                                            <span>•</span>
                                            <span>{sub.chunks} blocks</span>
                                        </div>

                                        <div className="subject-cta">
                                            Open subject <ChevronRight size={16} />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.section>
                    ) : (
                        <SubjectHome
                            subject={activeSubject}
                            onBack={() => setActiveSubject(null)}
                            onStartBook={(book) =>
                                navigate("/chat", {
                                    state: {
                                        subject: activeSubject.name,
                                        class: studentClass,
                                        bookId: book.book_id,
                                        bookName: book.file_name
                                    }
                                })
                            }
                        />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

const SubjectHome = ({ subject, onBack, onStartBook }) => {
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
                            onClick={() => onStartBook(book)}
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
                <Tool icon={Brain} title="AI Quiz" desc="Test understanding" />
                <Tool icon={FileText} title="Flashcards" desc="Key concepts" />
                <Tool icon={Mic} title="Oral Test" desc="Speak answers" />
                <Tool icon={BookOpen} title="Summaries" desc="Chapter notes" />
            </div>
        </motion.section>
    );
};

const Tool = ({ icon: Icon, title, desc }) => (
    <motion.div
        className="tool-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
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
