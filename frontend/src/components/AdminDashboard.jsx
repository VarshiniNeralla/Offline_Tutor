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
    Check
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

    useEffect(() => {
        fetchTextbooks();
    }, []);

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
                    <button className="btn-primary" onClick={openUploadModal}>
                        <FolderPlus size={18} /> Upload Materials
                    </button>
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
                                                <span className="book-meta">{book.pages} pages • {(book.chunks / 1000).toFixed(1)}k chunks</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="book-actions">
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
                )}

            </main>

            {/* UPLOAD MODAL */}
            {showUploadModal && (
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
            )}
        </div>
    );
};

export default AdminDashboard;
