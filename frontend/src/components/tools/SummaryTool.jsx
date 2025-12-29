import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    BookOpen,
    RefreshCw,
    AlertCircle,
    FileText,
    Download,
    CheckCircle2,
    Trash2,
    Edit2,
    Sparkles,
    Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import '../../assets/styles/student-dashboard.css';

const SummaryTool = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { subject, bookId, bookName, class: className, role = 'student' } = location.state || {}; // role can be 'teacher' or 'student'

    const CACHE_VERSION = 'v2'; // Bumped for schema change
    const CACHE_KEY = `summary_${CACHE_VERSION}_${bookId}_history`;

    const [history, setHistory] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [error, setError] = useState(null);
    const [isFromCache, setIsFromCache] = useState(false);

    useEffect(() => {
        if (!bookId) {
            navigate(role === 'teacher' ? '/teacher' : '/student/dashboard');
            return;
        }

        // Try to load history from cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Migration / Normal load
                    const validatedHistory = parsed.map(item => {
                        if (typeof item === 'string') {
                            return {
                                id: Date.now() + Math.random(),
                                text: item,
                                version: 1,
                                type: 'auto',
                                status: 'Auto generated draft',
                                author: 'System',
                                author_id: 'system',
                                timestamp: new Date().toISOString(),
                                is_active: true
                            };
                        }
                        return item;
                    });
                    setHistory(validatedHistory);
                    setCurrentIndex(0);
                    setIsFromCache(true);
                }
            } catch (e) {
                console.error("Cache load error:", e);
            }
        }
        // NOTE: Auto-generation removed. User must trigger it manually.
    }, [bookId, CACHE_KEY, navigate, role]);

    const generateSummary = async (isRegeneration = false) => {
        if (isRegeneration && !window.confirm("Generate a new AI draft? This will become the active version for students until you review it.")) {
            return;
        }

        setIsLoading(true);
        setError(null);
        // isFromCache is handled in the catch block for offline fallback, or implicitly false on new generation

        try {
            const prompt = `Generate a complete, structured summary for the textbook "${bookName}".`;
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    subjects: [subject],
                    book_ids: [bookId],
                    language: 'english', // Added missing required field
                    mode: 'summary'
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || 'Failed to connect to AI');
            }

            const data = await res.json();
            const generatedSummary = data.response;

            // Deactivate all old versions
            const updatedHistory = history.map(h => ({ ...h, is_active: false }));

            const newVersion = {
                id: Date.now(),
                text: generatedSummary,
                version: history.length + 1,
                type: role === 'teacher' ? 'teacher' : 'student',
                status: 'Auto generated draft',
                author: role === 'teacher' ? 'Teacher' : 'Student',
                author_id: role === 'teacher' ? 't-001' : 's-001',
                timestamp: new Date().toISOString(),
                is_active: true
            };

            const finalHistory = [newVersion, ...updatedHistory];
            setHistory(finalHistory);
            setCurrentIndex(0);
            localStorage.setItem(CACHE_KEY, JSON.stringify(finalHistory));
            setIsLoading(false);
            setIsFromCache(false); // New generation is not from cache
        } catch (err) {
            console.error("Summary Gen Error:", err);

            if (history.length > 0 && !isRegeneration) {
                setIsFromCache(true);
                setIsLoading(true); // Small flick to show it attempted
                setTimeout(() => setIsLoading(false), 500);
            } else {
                setError("Unable to generate summary right now. Please check your connection and try again.");
                setIsLoading(false);
            }
        }
    };

    const handleEdit = () => {
        setEditValue(currentSummary.text);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!editValue.trim()) return;

        // Deactivate all old versions
        const updatedHistory = history.map(h => ({ ...h, is_active: false }));

        const newVersion = {
            id: Date.now(),
            text: editValue,
            version: history.length + 1,
            type: 'teacher',
            status: 'Updated by teacher',
            author: 'Teacher',
            author_id: 't-001', // Example internal ID
            timestamp: new Date().toISOString(),
            is_active: true
        };

        const finalHistory = [newVersion, ...updatedHistory];
        setHistory(finalHistory);
        setCurrentIndex(0);
        setIsEditing(false);
        localStorage.setItem(CACHE_KEY, JSON.stringify(finalHistory));
    };

    const handleDelete = (indexToDelete) => {
        if (!window.confirm("Are you sure you want to delete this version? This is permanent for students.")) return;

        const itemToDelete = history[indexToDelete];

        let newHistory = history.map((item, idx) => {
            if (idx === indexToDelete) {
                return {
                    ...item,
                    is_active: false,
                    deleted_by: 't-001',
                    deleted_at: new Date().toISOString()
                };
            }
            return item;
        });

        // DELETION SAFETY: If we deleted the active version, auto-activate the latest remaining non-deleted one
        if (itemToDelete.is_active) {
            const latestValidIndex = newHistory.findIndex(h => !h.deleted_at);
            if (latestValidIndex !== -1) {
                newHistory = newHistory.map((h, idx) => ({
                    ...h,
                    is_active: idx === latestValidIndex
                }));
            }
        }

        setHistory(newHistory);
        localStorage.setItem(CACHE_KEY, JSON.stringify(newHistory));

        // Reset current index if it was pointing to the deleted one
        if (currentIndex === indexToDelete) {
            setCurrentIndex(0);
        }
    };

    // FILTER logic for roles
    // 1. Teachers see everything non-deleted
    // 2. Students see TEACHER approved if active, ELSE their own STUDENT version if active
    let displayHistory = [];
    if (role === 'teacher') {
        displayHistory = history.filter(h => !h.deleted_at);
    } else {
        const activeTeacherVer = history.find(h => h.type === 'teacher' && h.is_active && !h.deleted_at);
        if (activeTeacherVer) {
            displayHistory = [activeTeacherVer];
        } else {
            const activeStudentVer = history.find(h => h.type === 'student' && h.is_active && !h.deleted_at);
            if (activeStudentVer) {
                displayHistory = [activeStudentVer];
            }
        }
    }

    const currentSummary = displayHistory[currentIndex];

    // Safety for when no history exists
    if (displayHistory.length === 0 && !isLoading && !error) {
        return (
            <div className="dashboard-root flow-ui" style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
                <style>{styles}</style>

                {/* Decorative Elements */}
                <div className="decor-orb orb-1"></div>
                <div className="decor-orb orb-2"></div>

                <header className="dashboard-header" style={{ position: 'relative', zIndex: 10, background: 'transparent', borderBottom: 'none' }}>
                    <div className="dashboard-header-inner">
                        <button onClick={() => navigate(role === 'teacher' ? '/teacher' : '/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="icon-badge">
                                <Sparkles size={18} />
                            </div>
                            <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>AI Summary Tool</h1>
                        </div>
                    </div>
                </header>

                <main className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 100px)', padding: '20px' }}>
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="summary-hero-card"
                    >
                        <div className="hero-icon-wrapper">
                            <Zap size={40} className="zap-icon" />
                        </div>
                        <h2 className="hero-title">Unlock New Insights!</h2>
                        <p className="hero-text">
                            {role === 'teacher'
                                ? "Transform this textbook into a powerful study guide. Review student drafts or generate your own magic."
                                : "No summary yet! Be the first to generate a fresh AI draft and supercharge your learning today."}
                        </p>
                        <button className="primary-btn-glow" onClick={() => generateSummary()}>
                            <Sparkles size={20} style={{ marginRight: '10px' }} />
                            Magic Generate
                        </button>
                    </motion.div>
                </main>
            </div>
        );
    }

    return (
        <div className="dashboard-root flow-ui" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <style>{styles}</style>

            {/* Decorative Elements */}
            <div className="decor-orb orb-1"></div>
            <div className="decor-orb orb-2"></div>

            {/* HEADER */}
            <header className="dashboard-header" style={{ position: 'relative', zIndex: 10, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
                <div className="dashboard-header-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate(role === 'teacher' ? '/teacher' : '/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.2rem', marginBottom: 'px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {role === 'teacher' ? "Manage Summary" : "AI Summary Tool"}
                                <Sparkles size={16} color="var(--primary)" />
                            </h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{bookName}</p>
                        </div>
                    </div>
                    {role === 'teacher' && displayHistory.length > 0 && !isLoading && !isEditing && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="delete-btn-top" onClick={() => handleDelete(currentIndex)} title="Delete Version">
                                <Trash2 size={18} />
                            </button>
                            <button className="regenerate-btn-top" onClick={() => generateSummary(true)} title="New AI Draft">
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="dashboard-container" style={{ flex: 1, overflow: 'hidden', padding: '20px 0', display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="summary-loading-state"
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                        >
                            <div className="spinner-large">
                                <Zap size={30} className="zap-spin" />
                            </div>
                            <h3 className="loading-text">{role === 'teacher' ? "Weaving Knowledge..." : "Personalizing Summary..."}</h3>
                            <p className="loading-sub">Distilling the essence of your textbook into tiny bits of awesome.</p>
                        </motion.div>
                    ) : error ? (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="summary-error-state"
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}
                        >
                            <div className="error-icon-box" style={{ marginBottom: '24px' }}>
                                <AlertCircle size={60} color="#ef4444" />
                            </div>
                            <h3 style={{ fontSize: '1.8rem', color: '#dc2626' }}>Aw, Snap!</h3>
                            <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '32px' }}>{error}</p>
                            <button className="primary-btn-glow" onClick={() => generateSummary()}>Give it another shot</button>
                        </motion.div>
                    ) : displayHistory.length > 0 ? (
                        <motion.div
                            key="content"
                            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                            className="summary-layout-wrapper"
                            style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        >
                            {/* VERSION SELECTOR (Teacher Only) */}
                            {role === 'teacher' && displayHistory.length > 1 && (
                                <div className="version-bar-v2">
                                    <div className="version-label">Audit Logs:</div>
                                    <div className="version-tabs-scroll">
                                        {displayHistory.map((v, idx) => (
                                            <button
                                                key={v.id}
                                                className={`v2-tab ${currentIndex === idx ? 'active' : ''} ${v.type === 'teacher' ? 'teacher' : ''}`}
                                                onClick={() => { setCurrentIndex(idx); setIsEditing(false); }}
                                            >
                                                V{v.version}
                                                {v.is_active && <span className="active-glow" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="summary-app-body" style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                <div className="summary-content-glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    {/* Metadata Labels */}
                                    <div className="summary-status-header">
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            {currentSummary.type === 'teacher' ? (
                                                <div className="status-label-v2 approved">
                                                    <CheckCircle2 size={14} /> Teacher Verified
                                                </div>
                                            ) : (
                                                <div className="status-label-v2 draft">
                                                    <Zap size={14} /> {role === 'teacher' ? "Student Draft" : "AI Personal Draft"}
                                                </div>
                                            )}
                                        </div>
                                        <div className="summary-version-tag">Version {currentSummary.version}</div>
                                    </div>

                                    {isEditing ? (
                                        <div className="edit-view-v2" style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="edit-textarea-v2"
                                                placeholder="Write or edit the summary here..."
                                                autoFocus
                                                style={{ flex: 1 }}
                                            />
                                            <div className="edit-actions-footer">
                                                <button className="cancel-pill" onClick={() => setIsEditing(false)}>Discard</button>
                                                <button className="save-pill" onClick={handleSave}>Finalize & Approve</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="scroll-content-v2" style={{ flex: 1, overflowY: 'auto' }}>
                                            <div className="markdown-container">
                                                <ReactMarkdown>{currentSummary.text}</ReactMarkdown>
                                            </div>

                                            <div className="summary-footer-v2">
                                                <div className="author-info">
                                                    <div className="avatar-mini">{currentSummary.author[0]}</div>
                                                    <div>
                                                        <p className="by-text">By {currentSummary.author}</p>
                                                        <p className="time-text">{new Date(currentSummary.timestamp).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p>
                                                    </div>
                                                </div>

                                                {role === 'teacher' && (
                                                    <button className="edit-fab" onClick={handleEdit}>
                                                        <Edit2 size={18} /> Edit Now
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </main>
        </div>
    );
};

const styles = `
.flow-ui {
    font-family: 'Outfit', sans-serif;
    background: radial-gradient(circle at top right, #f8faff 0%, #f1f5ff 100%);
}

.decor-orb {
    position: absolute; border-radius: 50%; filter: blur(60px); z-index: 0; opacity: 0.4;
}
.orb-1 { width: 400px; height: 400px; background: var(--primary-soft); top: -100px; right: -100px; border: 1px solid rgba(255,255,255,0.4); animation: float 10s ease-in-out infinite alternate; }
.orb-2 { width: 300px; height: 300px; background: #e0e7ff; bottom: -50px; left: -50px; animation: float 12s ease-in-out infinite alternate-reverse; }

@keyframes float { 
    from { transform: translate(0,0) rotate(0deg); } 
    to { transform: translate(30px, 30px) rotate(10deg); } 
}

.icon-badge {
    width: 36px; height: 36px; background: var(--primary); color: white; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.summary-hero-card {
    background: white; padding: 60px 40px; border-radius: 40px; width: 480px; text-align: center;
    box-shadow: 0 20px 50px rgba(0,0,0,0.06); border: 1px solid rgba(255,255,255,0.8);
    position: relative; z-index: 5;
}

.hero-icon-wrapper {
    width: 80px; height: 80px; background: #f5f3ff; border-radius: 24px; color: var(--primary);
    display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;
}

.zap-icon { animation: pulse-zap 2s infinite; }
@keyframes pulse-zap { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1) rotate(5deg); } }

.hero-title { font-size: 2rem; color: #1e1b4b; margin-bottom: 16px; font-weight: 800; }
.hero-text { font-size: 1.1rem; color: #64748b; line-height: 1.6; margin-bottom: 32px; }

.primary-btn-glow {
    background: var(--primary); color: white; border: none; padding: 16px 40px; border-radius: 16px;
    font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: all 0.3s ease;
    display: flex; align-items: center; justify-content: center; width: 100%;
    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2);
}
.primary-btn-glow:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(79, 70, 229, 0.4); }

.summary-loading-state { text-align: center; }
.spinner-large {
    width: 80px; height: 80px; border: 4px solid var(--primary-soft); border-top-color: var(--primary);
    border-radius: 50%; margin: 0 auto 32px; display: flex; align-items: center; justify-content: center;
    animation: spin 1s linear infinite; position: relative;
}
.zap-spin { color: var(--primary); animation: spin-rev 1s linear infinite; }
@keyframes spin-rev { from { transform: rotate(0); } to { transform: rotate(-360deg); } }

.loading-text { font-size: 1.5rem; color: #1e1b4b; margin-bottom: 12px; font-weight: 800; }
.loading-sub { color: #64748b; font-size: 1rem; }

.summary-layout-wrapper { max-height: 100%; }

.version-bar-v2 {
    display: flex; align-items: center; gap: 12px; padding: 12px 24px;
    background: rgba(255,255,255,0.7); backdrop-filter: blur(10px);
    border-radius: 20px; border: 1px solid rgba(255,255,255,0.5);
    margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}

.version-tabs-scroll { display: flex; gap: 10px; overflow-x: auto; padding: 4px; }
.v2-tab {
    padding: 8px 16px; border-radius: 12px; border: 1px solid var(--border);
    background: white; font-weight: 700; color: #94a3b8; cursor: pointer;
    transition: all 0.2s; position: relative;
}
.v2-tab.active { background: var(--primary); color: white; border-color: var(--primary); }
.v2-tab.teacher { color: #10b981; border-color: #10b981; }
.v2-tab.teacher.active { background: #10b981; color: white; }
.active-glow {
    position: absolute; top: -4px; right: -4px; width: 10px; height: 10px;
    background: #10b981; border-radius: 50%; border: 2px solid white;
    box-shadow: 0 0 10px #10b981;
}

.summary-content-glass {
    height: 100%; display: flex; flexDirection: column;
    background: rgba(255,255,255,0.8); backdrop-filter: blur(20px);
    border-radius: 32px; border: 1px solid rgba(255,255,255,0.9);
    box-shadow: 0 20px 40px rgba(0,0,0,0.03); overflow: hidden;
}

.summary-status-header {
    padding: 24px 32px; border-bottom: 1px solid rgba(0,0,0,0.05);
    display: flex; justify-content: space-between; align-items: center;
}
.status-label-v2 {
    padding: 6px 14px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
    display: flex; align-items: center; gap: 6px; text-transform: uppercase;
}
.status-label-v2.approved { background: #ecfdf5; color: #059669; }
.status-label-v2.draft { background: #fef2f2; color: #dc2626; }
.summary-version-tag { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }

.scroll-content-v2 { flex: 1; overflow-y: auto; padding: 40px 60px; line-height: 1.8; }
.scroll-content-v2::-webkit-scrollbar { width: 8px; }
.scroll-content-v2::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

.markdown-container h1 { font-size: 2.2rem; color: #1e1b4b; background: linear-gradient(90deg, var(--primary), #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 32px; font-weight: 900; }

.summary-footer-v2 {
    margin-top: 40px; padding-top: 32px; border-top: 1px dotted #e2e8f0;
    display: flex; justify-content: space-between; align-items: center;
}

.author-info { display: flex; align-items: center; gap: 12px; }
.avatar-mini { width: 32px; height: 32px; background: #e0e7ff; color: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; }
.by-text { font-size: 0.9rem; font-weight: 700; color: #1e1b4b; margin: 0; }
.time-text { font-size: 0.75rem; color: #94a3b8; margin: 0; }

.edit-fab {
    background: white; border: 1px solid var(--border); padding: 10px 20px;
    border-radius: 14px; color: var(--primary); font-weight: 700; cursor: pointer;
    display: flex; align-items: center; gap: 8px; transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.edit-fab:hover { background: var(--primary); color: white; transform: scale(1.05); }

.edit-view-v2 { padding: 32px; }
.edit-textarea-v2 {
    flex: 1; border: 2px solid #f1f5f9; border-radius: 20px; padding: 24px;
    font-family: inherit; font-size: 1.1rem; line-height: 1.6; resize: none;
    outline: none; transition: border-color 0.2s; background: #f8fafc;
}
.edit-textarea-v2:focus { border-color: var(--primary); background: white; }

.edit-actions-footer { margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px; }
.cancel-pill { background: #f1f5f9; color: #64748b; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; }
.save-pill { background: var(--primary); color: white; border: none; padding: 12px 32px; border-radius: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2); }

/* REUSE OLD BUTTON STYLES FOR TOP HEADER */
.back-icon-btn {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    background: white; border: 1px solid var(--border);
    border-radius: 12px; color: var(--text-muted);
    cursor: pointer; transition: all 0.2s ease;
}
.delete-btn-top {
    background: white; border: 1px solid var(--border);
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    color: #ef4444; cursor: pointer; transition: all 0.2s;
}
.regenerate-btn-top {
    background: white; border: 1px solid var(--border);
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted); cursor: pointer; transition: all 0.2s;
}
`;

export default SummaryTool;
