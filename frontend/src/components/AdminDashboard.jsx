import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen,
    Trash2,
    ChevronLeft,
    GraduationCap,
    FolderPlus,
    Library,
    Folder,
    FileText,
    Edit2,
    Download,
    X,
    Check,
    CheckSquare,
    Search,
    Mic,
    Play,
    Pause,
    History,
    ChevronRight,
    Star,
    CheckCircle2,
    Zap
} from "lucide-react";

import "../assets/styles/admin-dashboard.css";

const CLASSES = [
    "Class 6", "Class 7", "Class 8", "Class 9",
    "Class 10", "Class 11", "Class 12", "Unassigned"
];

const AdminDashboard = () => {
    const navigate = useNavigate();

    // Data State
    const [books, setBooks] = useState({}); // Raw dictionary: { id: bookObj }
    const [grouped, setGrouped] = useState({}); // { Class: { Subject: [books] } }

    // Navigation State (Persist across refresh)
    const [viewMode, setViewMode] = useState(() => sessionStorage.getItem("admin_viewMode") || "CLASSES");
    const [activeClass, setActiveClass] = useState(() => sessionStorage.getItem("admin_activeClass") || "");
    const [activeSubject, setActiveSubject] = useState(() => sessionStorage.getItem("admin_activeSubject") || "");

    useEffect(() => {
        sessionStorage.setItem("admin_viewMode", viewMode);
        sessionStorage.setItem("admin_activeClass", activeClass);
        sessionStorage.setItem("admin_activeSubject", activeSubject);
    }, [viewMode, activeClass, activeSubject]);

    // Upload State
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadClass, setUploadClass] = useState("Class 10");
    const [uploadSubject, setUploadSubject] = useState("");

    const [loading, setLoading] = useState(true);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");

    // Oral Test Review State
    const [pendingOralTests, setPendingOralTests] = useState([]);
    const [selectedOralTest, setSelectedOralTest] = useState(null);
    const [oralReviewData, setOralReviewData] = useState({}); // { 0: { score: 5, feedback: '...' } }
    const [submittingReview, setSubmittingReview] = useState(false);

    // Helper to check summary status from localStorage
    const getSummaryStatus = (bookId) => {
        const key = `summary_history_${bookId}_v2`;
        const data = localStorage.getItem(key);
        if (!data) return { label: "Generate AI Summary", color: "var(--primary)", dot: false };

        try {
            const history = JSON.parse(data);
            if (!history || history.length === 0) return { label: "Generate AI Summary", color: "var(--primary)", dot: false };

            // Check for teacher version
            const hasTeacher = history.some(h => h.type === 'teacher' && !h.deleted_at);
            if (hasTeacher) return { label: "View Summary", color: "#059669", dot: false }; // Green

            // Check for student version
            const hasStudent = history.some(h => h.type === 'student' && !h.deleted_at);
            if (hasStudent) return { label: "Review Student Draft", color: "#d97706", dot: true }; // Orange + Dot

            return { label: "Manage Summary", color: "var(--primary)", dot: false };
        } catch {
            return { label: "Generate AI Summary", color: "var(--primary)", dot: false };
        }
    };

    useEffect(() => {
        fetchTextbooks();
        fetchPendingOralTests();
    }, []);

    // --- Data Fetching & Processing ---
    const fetchPendingOralTests = async () => {
        try {
            const res = await fetch("/api/oral_answers/list_pending");
            if (res.ok) {
                const data = await res.json();
                setPendingOralTests(data);
            }
        } catch (err) {
            console.error("Failed to fetch pending oral tests", err);
        }
    };

    // --- Data Fetching & Processing ---
    const fetchTextbooks = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/textbooks");
            const data = await res.json();
            setBooks(data);
            groupBooks(data);
        } catch (err) {
            console.error("Failed to fetch books", err);
        } finally {
            setLoading(false);
        }
    };

    const groupBooks = (data) => {
        const hierarchy = {};
        CLASSES.forEach(cls => hierarchy[cls] = {});

        Object.values(data).forEach(book => {
            const cls = book.class_name || "Unassigned";
            const subj = book.subject_name || "Unknown";

            if (!hierarchy[cls]) hierarchy[cls] = {}; // Safety for custom class names
            if (!hierarchy[cls][subj]) hierarchy[cls][subj] = [];

            hierarchy[cls][subj].push(book);
        });
        setGrouped(hierarchy);
    };

    // --- Navigation Handlers ---
    const handleClassClick = (cls) => {
        setActiveClass(cls);
        setViewMode("SUBJECTS");
    };

    const handleSubjectClick = (subj) => {
        setActiveSubject(subj);
        setViewMode("BOOKS");
    };

    const handleBack = () => {
        if (viewMode === "BOOKS") {
            setViewMode("SUBJECTS");
            setActiveSubject("");
        } else if (viewMode === "SUBJECTS") {
            setViewMode("CLASSES");
            setActiveClass("");
        } else if (viewMode === "ORAL_REVIEW") {
            setViewMode("CLASSES");
            setSelectedOralTest(null);
        } else {
            navigate("/");
        }
    };

    // --- Action Handlers ---
    const handleUpload = async () => {
        if (!files.length || !uploadSubject.trim()) return;
        setUploading(true);

        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("language", "english");
            formData.append("class_name", uploadClass);
            formData.append("subject_name", uploadSubject.trim());

            await fetch("/api/upload", { method: "POST", body: formData });
        }

        setFiles([]);
        setShowUploadModal(false);
        setUploading(false);
        fetchTextbooks();
    };

    const handleDelete = async (bookId, bookName) => {
        if (!window.confirm(`Delete "${bookName}"? This cannot be undone.`)) return;
        await fetch(`/api/textbook/${bookId}`, { method: "DELETE" });
        fetchTextbooks();
    };

    const startRename = (book) => {
        setRenamingId(book.book_id);
        setRenameValue(book.file_name.replace(".pdf", ""));
    };

    const saveRename = async (bookId) => {
        if (!renameValue.trim()) return;
        try {
            const res = await fetch("/api/textbook/rename", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ book_id: bookId, new_name: renameValue })
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.detail || "Rename failed");
            } else {
                setRenamingId(null);
                fetchTextbooks();
            }
        } catch (err) {
            alert("Connection error occurred while renaming.");
        }
    };

    const submitOralReview = async () => {
        if (!selectedOralTest) return;
        setSubmittingReview(true);
        try {
            const res = await fetch("/api/oral_test/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    attempt_id: selectedOralTest.attempt_id,
                    feedback_data: oralReviewData
                })
            });
            if (res.ok) {
                alert("Review submitted successfully!");
                setSelectedOralTest(null);
                setViewMode("ORAL_REVIEW");
                fetchPendingOralTests();
            } else {
                throw new Error("Failed to submit review");
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmittingReview(false);
        }
    };

    const openBook = (bookId) => {
        window.open(`/api/book/${bookId}`, "_blank");
    };

    const openUploadModal = () => {
        setUploadClass(activeClass || "Class 10");
        setUploadSubject(activeSubject || "");
        setShowUploadModal(true);
    };

    // --- Render Helpers ---
    const renderBreadcrumbs = () => (
        <div className="breadcrumbs">
            <span className={viewMode === "CLASSES" ? "active" : ""} onClick={() => { setActiveClass(""); setActiveSubject(""); setViewMode("CLASSES") }}>Library</span>
            {activeClass && (
                <>
                    <span className="sep">/</span>
                    <span className={viewMode === "SUBJECTS" ? "active" : ""} onClick={() => { setActiveSubject(""); setViewMode("SUBJECTS") }}>{activeClass}</span>
                </>
            )}
            {activeSubject && (
                <>
                    <span className="sep">/</span>
                    <span className="active">{activeSubject}</span>
                </>
            )}
        </div>
    );

    return (
        <div className="admin-root">
            {/* HEADER */}
            <header className="admin-header">
                <div className="admin-header-inner">
                    <div className="admin-title">
                        <div className="admin-icon">
                            <GraduationCap size={22} />
                        </div>
                        <div>
                            <h1>Teacher Library</h1>
                            <p>Manage textbooks and study materials</p>
                        </div>
                    </div>
                    <button className="back-btn" onClick={handleBack}>
                        <ChevronLeft size={16} /> Back
                    </button>
                </div>
            </header>

            <main className="admin-container">

                <div className="toolbar">
                    {renderBreadcrumbs()}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            className={`btn-secondary ${viewMode === "ORAL_REVIEW" ? "active-tab" : ""}`}
                            onClick={() => setViewMode("ORAL_REVIEW")}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}
                        >
                            <Mic size={18} /> Review Oral Tests
                            {pendingOralTests.length > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-5px', right: '-5px',
                                    background: '#ef4444', color: 'white', fontSize: '0.7rem',
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                }}>
                                    {pendingOralTests.length}
                                </span>
                            )}
                        </button>
                        <button className="btn-primary" onClick={openUploadModal}>
                            <FolderPlus size={18} /> Upload Materials
                        </button>
                    </div>
                </div>

                {/* VIEW: CLASSES */}
                {viewMode === "CLASSES" && (
                    <div className="admin-grid-cards">
                        {CLASSES.map(cls => {
                            // Calculate total books in class
                            const subjectCount = Object.keys(grouped[cls] || {}).length;
                            let bookCount = 0;
                            Object.values(grouped[cls] || {}).forEach(list => bookCount += list.length);

                            return (
                                <div key={cls} className="folder-card" onClick={() => handleClassClick(cls)}>
                                    <div className="folder-icon class-icon">
                                        <GraduationCap size={32} />
                                    </div>
                                    <h3>{cls}</h3>
                                    <p>{subjectCount} Subjects • {bookCount} Books</p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* VIEW: SUBJECTS */}
                {viewMode === "SUBJECTS" && (
                    <div className="admin-grid-cards">
                        {loading ? (
                            <div className="empty-state-full"><p>Loading subjects...</p></div>
                        ) : Object.keys(grouped[activeClass] || {}).length === 0 ? (
                            <div className="empty-state-full">
                                <Folder size={48} className="text-slate-300 mb-4" />
                                <p>No subjects added to {activeClass} yet.</p>
                                <button className="btn-text" onClick={openUploadModal}>Upload a book to create a subject</button>
                            </div>
                        ) : (
                            Object.entries(grouped[activeClass] || {}).map(([subj, booksList]) => (
                                <div key={subj} className="folder-card" onClick={() => handleSubjectClick(subj)}>
                                    <div className="folder-icon subject-icon">
                                        <Library size={32} />
                                    </div>
                                    <h3>{subj}</h3>
                                    <p>{booksList.length} Books</p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* VIEW: ORAL REVIEW LIST */}
                {viewMode === "ORAL_REVIEW" && !selectedOralTest && (
                    <div className="admin-grid-cards">
                        {pendingOralTests.length === 0 ? (
                            <div className="empty-state-full" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ width: '80px', height: '80px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <CheckCircle2 size={40} color="#166534" />
                                </div>
                                <p>No oral tests pending review. Nice work!</p>
                            </div>
                        ) : (
                            pendingOralTests.map(test => (
                                <div key={test.attempt_id} className="folder-card" onClick={() => {
                                    setSelectedOralTest(test);
                                    const initialReview = {};
                                    test.metadata.questions.forEach((q, i) => {
                                        if (q.ai_analysis) {
                                            initialReview[i] = { score: q.ai_analysis.score, feedback: q.ai_analysis.feedback };
                                        } else {
                                            initialReview[i] = { score: 0, feedback: "" };
                                        }
                                    });
                                    setOralReviewData(initialReview);
                                }}>
                                    <div className="folder-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                                        <Mic size={32} />
                                    </div>
                                    <h3 style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{test.student_name}</h3>
                                    <p style={{ fontSize: '0.8rem' }}>{test.book_name}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{test.metadata.questions.length} Qs • {test.metadata.mode}</p>
                                        <span style={{
                                            fontSize: '0.6rem',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 700,
                                            background: test.status === 'AI_REVIEWED' ? '#dcfce7' : (test.status === 'AI_REVIEW_FAILED' ? '#fee2e2' : '#f1f5f9'),
                                            color: test.status === 'AI_REVIEWED' ? '#166534' : (test.status === 'AI_REVIEW_FAILED' ? '#991b1b' : '#64748b')
                                        }}>
                                            {test.status === 'AI_REVIEWED' ? 'AI REVIEWED' : (test.status === 'AI_REVIEW_FAILED' ? 'AI FAILED' : 'PENDING')}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* VIEW: ORAL TEST DETAIL REVIEW */}
                {selectedOralTest && (
                    <div className="review-interface" style={{ background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Review: {selectedOralTest.student_name}</h2>
                                <p style={{ color: '#64748b' }}>{selectedOralTest.book_name} ({selectedOralTest.metadata.mode})</p>
                            </div>
                            <button className="btn-secondary" onClick={() => setSelectedOralTest(null)}>Cancel</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                            {selectedOralTest.metadata.questions.map((q, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', paddingBottom: '40px', borderBottom: i < selectedOralTest.metadata.questions.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                                    {/* Left: Question & Audio */}
                                    <div>
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                            <span style={{ fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-soft)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', fontSize: '0.8rem' }}>{i + 1}</span>
                                            <h4 style={{ fontSize: '1.1rem', lineHeight: '1.5' }}>{q.question}</h4>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Student's Recorded Answer</p>
                                            {q.audio_url ? (
                                                <>
                                                    <audio controls src={q.audio_url} style={{ width: '100%', height: '36px', marginBottom: q.transcript ? '12px' : '0' }} />
                                                    {q.transcript && (
                                                        <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem', color: '#475569', fontStyle: 'italic', position: 'relative' }}>
                                                            "{q.transcript}"
                                                            <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>TRANSCRIPT</div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>Audio missing for this question.</p>
                                            )}
                                        </div>

                                        <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Expected Answer (Textbook)</p>
                                            <p style={{ fontSize: '0.95rem', color: '#14532d', lineHeight: '1.4' }}>{q.sample_answer}</p>
                                        </div>
                                    </div>

                                    {/* Right: Scoring Controls */}
                                    <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '20px' }}>
                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: '#64748b' }}>ASSIGN SCORE</label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setOralReviewData(prev => ({
                                                            ...prev,
                                                            [i]: { ...prev[i], score: s }
                                                        }))}
                                                        style={{
                                                            flex: 1, height: '44px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                                            background: oralReviewData[i]?.score === s ? 'var(--primary)' : 'white',
                                                            color: oralReviewData[i]?.score === s ? 'white' : '#64748b',
                                                            fontWeight: 700, transition: 'all 0.2s',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                        }}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px', color: '#64748b' }}>TEACHER FEEDBACK</label>
                                            <textarea
                                                placeholder="Enter comments for the student..."
                                                value={oralReviewData[i]?.feedback || ""}
                                                onChange={(e) => setOralReviewData(prev => ({
                                                    ...prev,
                                                    [i]: { ...prev[i], feedback: e.target.value }
                                                }))}
                                                style={{
                                                    width: '100%', height: '100px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                                    padding: '12px', fontSize: '0.9rem', outline: 'none', resize: 'none'
                                                }}
                                            />
                                        </div>

                                        {q.ai_analysis && (
                                            <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '16px', border: '1px solid #bae6fd', marginTop: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Zap size={14} color="#0369a1" />
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>AI Suggestion</span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 700,
                                                        color: q.ai_analysis.confidence === 'high' ? '#16a34a' : (q.ai_analysis.confidence === 'low' ? '#dc2626' : '#d97706')
                                                    }}>
                                                        CONFIDENCE: {q.ai_analysis.confidence.toUpperCase()}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '0.85rem', color: '#0c4a6e', margin: '0 0 10px 0', lineHeight: 1.4 }}>{q.ai_analysis.feedback}</p>
                                                {q.ai_analysis.keywords_detected && q.ai_analysis.keywords_detected.length > 0 && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>Keyword Coverage</p>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {q.ai_analysis.keywords_detected.map((kw, kwIdx) => (
                                                                <span key={kwIdx} style={{ fontSize: '0.6rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bae6fd' }}>{kw}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => setOralReviewData(prev => ({
                                                        ...prev,
                                                        [i]: { score: q.ai_analysis.score, feedback: q.ai_analysis.feedback }
                                                    }))}
                                                    style={{ background: 'none', border: 'none', color: '#0369a1', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: '12px', textDecoration: 'underline' }}
                                                >
                                                    Reset to AI Suggestions
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button className="btn-secondary" onClick={() => setSelectedOralTest(null)}>Save for later</button>
                            <button
                                className="btn-primary"
                                onClick={submitOralReview}
                                disabled={submittingReview}
                                style={{ padding: '12px 48px' }}
                            >
                                {submittingReview ? "Submitting..." : "Complete & Send Review"}
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW: BOOKS */}
                {viewMode === "BOOKS" && (
                    <div className="book-list-container">
                        {loading ? (
                            <div className="empty-state-full"><p>Loading books...</p></div>
                        ) : (grouped[activeClass]?.[activeSubject] || []).length === 0 ? (
                            <div className="empty-state-full">
                                <FileText size={48} className="text-slate-300 mb-4" />
                                <p>No books found in this subject.</p>
                            </div>
                        ) : (
                            (grouped[activeClass]?.[activeSubject] || []).map(book => (
                                <div key={book.book_id} className="book-row">
                                    <div className="book-info">
                                        <div className="file-icon">
                                            <FileText size={20} />
                                            <span className="ext">PDF</span>
                                        </div>

                                        {renamingId === book.book_id ? (
                                            <div className="rename-box">
                                                <input
                                                    type="text"
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    autoFocus
                                                />
                                                <button className="icon-btn save" onClick={() => saveRename(book.book_id)}><Check size={16} /></button>
                                                <button className="icon-btn cancel" onClick={() => setRenamingId(null)}><X size={16} /></button>
                                            </div>
                                        ) : (
                                            <div className="name-box">
                                                <span className="book-name">{book.file_name}</span>
                                                <div className="book-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{book.pages} pages • {(book.chunks / 1000).toFixed(1)}k chunks</span>
                                                    <span className="sep">•</span>
                                                    {(() => {
                                                        const status = getSummaryStatus(book.book_id);
                                                        return (
                                                            <button
                                                                className="btn-link-action"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate("/summary", {
                                                                        state: {
                                                                            subject: activeSubject,
                                                                            bookId: book.book_id,
                                                                            bookName: book.file_name,
                                                                            role: 'teacher'
                                                                        }
                                                                    });
                                                                }}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: status.color,
                                                                    cursor: 'pointer',
                                                                    padding: 0,
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px'
                                                                }}
                                                            >
                                                                {status.dot && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color, display: 'inline-block' }}></span>}
                                                                {status.label}
                                                            </button>
                                                        );
                                                    })()}
                                                    <span className="sep">•</span>
                                                    <button
                                                        className="btn-link-action"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate("/keywords", {
                                                                state: {
                                                                    subject: activeSubject,
                                                                    bookId: book.book_id,
                                                                    bookName: book.file_name,
                                                                    role: 'teacher'
                                                                }
                                                            });
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#64748b',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        <Search size={14} /> Keywords
                                                    </button>
                                                    <span className="sep" style={{ color: '#cbd5e1', margin: '0 4px' }}>•</span>
                                                    <button
                                                        className="btn-link-action"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate("/truefalse", {
                                                                state: {
                                                                    subject: activeSubject,
                                                                    bookId: book.book_id,
                                                                    bookName: book.file_name,
                                                                    role: 'teacher'
                                                                }
                                                            });
                                                        }}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#64748b',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                    >
                                                        <CheckSquare size={14} /> Manage T/F
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="book-actions">
                                        <button className="action-btn" title="Manage Summary" onClick={() => navigate("/summary", {
                                            state: {
                                                subject: activeSubject,
                                                bookId: book.book_id,
                                                bookName: book.file_name,
                                                role: 'teacher'
                                            }
                                        })}>
                                            <BookOpen size={18} />
                                        </button>
                                        <button className="action-btn" title="Open" onClick={() => openBook(book.book_id)}>
                                            <Download size={18} />
                                        </button>
                                        <button className="action-btn" title="Rename" onClick={() => startRename(book)}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button className="action-btn delete" title="Delete" onClick={() => handleDelete(book.book_id, book.file_name)}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )
                }

            </main >

            {/* UPLOAD MODAL */}
            {
                showUploadModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>Upload Textbooks</h2>
                                <button className="close-btn" onClick={() => setShowUploadModal(false)}><X size={20} /></button>
                            </div>

                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Class</label>
                                    <select value={uploadClass} onChange={(e) => setUploadClass(e.target.value)}>
                                        {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Subject Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Physics, History"
                                        value={uploadSubject}
                                        onChange={(e) => setUploadSubject(e.target.value)}
                                    />
                                </div>

                                <div className="file-drop-area" onClick={() => document.getElementById('modal-file-input').click()}>
                                    <input
                                        id="modal-file-input"
                                        type="file"
                                        hidden
                                        multiple
                                        accept=".pdf"
                                        onChange={(e) => setFiles(Array.from(e.target.files))}
                                    />
                                    <FolderPlus size={32} className="text-indigo-400 mb-2" />
                                    <p>Click to select PDF files</p>
                                    {files.length > 0 && <span className="file-tag">{files.length} files selected</span>}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="btn-text" onClick={() => setShowUploadModal(false)}>Cancel</button>
                                <button className="btn-primary" disabled={uploading || !files.length || !uploadSubject} onClick={handleUpload}>
                                    {uploading ? "Uploading..." : "Upload Files"}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AdminDashboard;
