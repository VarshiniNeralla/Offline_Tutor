import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    History,
    Calendar,
    Award,
    BookOpen,
    Zap,
    CheckSquare,
    Search,
    ChevronRight,
    Target,
    Clock,
    CheckCircle2,
    XCircle
} from "lucide-react";
import "../assets/styles/student-dashboard.css";

const MyProgress = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAttempt, setSelectedAttempt] = useState(null);
    const [filterType, setFilterType] = useState("all"); // all, quiz, truefalse

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const name = localStorage.getItem("studentName");
            const studentClass = localStorage.getItem("studentClass");
            const url = `/api/progress/history?name=${encodeURIComponent(name)}&student_class=${encodeURIComponent(studentClass)}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                // Sort by timestamp descending
                setHistory(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
            }
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredHistory = history.filter(h => filterType === "all" || h.type === filterType);

    return (
        <div className="dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => selectedAttempt ? setSelectedAttempt(null) : navigate('/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>
                                {selectedAttempt ? 'Attempt Review' : 'My Progress History'}
                            </h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {selectedAttempt ? `${selectedAttempt.book_name} • ${selectedAttempt.type.toUpperCase()}` : 'View your learning journey'}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="dashboard-container" style={{ maxWidth: selectedAttempt ? '800px' : '1000px', margin: '0 auto', paddingBottom: '60px' }}>
                <AnimatePresence mode="wait">
                    {!selectedAttempt ? (
                        <motion.section
                            key="history-list"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {['all', 'quiz', 'truefalse'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setFilterType(t)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '100px',
                                                border: '1px solid var(--border)',
                                                background: filterType === t ? 'var(--primary)' : 'white',
                                                color: filterType === t ? 'white' : 'var(--text-muted)',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textTransform: 'capitalize'
                                            }}
                                        >
                                            {t === 'truefalse' ? 'True/False' : t}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                                    Total Attempts: {filteredHistory.length}
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                                    <div className="loader" style={{ margin: '0 auto 20px' }}></div>
                                    <p style={{ color: 'var(--text-muted)' }}>Loading your records...</p>
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '100px 20px', background: 'white', borderRadius: '24px', border: '1px dashed var(--border)' }}>
                                    <History size={48} color="var(--border)" style={{ marginBottom: '16px' }} />
                                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>No history yet</h3>
                                    <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Start a quiz to see your progress here!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {filteredHistory.map((attempt) => (
                                        <motion.div
                                            key={attempt.id}
                                            className="glass-card"
                                            whileHover={{ scale: 1.01, borderColor: 'var(--primary-light)' }}
                                            onClick={() => setSelectedAttempt(attempt)}
                                            style={{
                                                padding: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '20px',
                                                cursor: 'pointer',
                                                border: '1px solid var(--border)',
                                                background: 'white'
                                            }}
                                        >
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '14px',
                                                background: attempt.type === 'quiz' ? '#eff6ff' : '#f0fdf4',
                                                color: attempt.type === 'quiz' ? '#2563eb' : '#10b981',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {attempt.type === 'quiz' ? <Zap size={24} /> : <CheckSquare size={24} />}
                                            </div>

                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: 'var(--text-main)' }}>{attempt.book_name}</h4>
                                                <div style={{ display: 'flex', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Calendar size={14} /> {formatDate(attempt.timestamp)}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{attempt.subject}</span>
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    fontSize: '1.2rem',
                                                    fontWeight: 800,
                                                    color: (attempt.score / attempt.total_questions) >= 0.8 ? '#10b981' : '#f59e0b'
                                                }}>
                                                    {attempt.score}/{attempt.total_questions}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    Score
                                                </div>
                                            </div>

                                            <ChevronRight size={20} color="var(--border)" />
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.section>
                    ) : (
                        <motion.section
                            key="attempt-details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            {/* Summary Stats Strip */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                                <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <Target size={24} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedAttempt.score}/{selectedAttempt.total_questions}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</div>
                                </div>
                                <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <Award size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round((selectedAttempt.score / selectedAttempt.total_questions) * 100)}%</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</div>
                                </div>
                                <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <Clock size={24} color="#6366f1" style={{ margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatDate(selectedAttempt.timestamp).split(',')[1]}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</div>
                                </div>
                            </div>

                            {/* Detailed List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <h3 style={{ margin: '0 0 -8px', fontSize: '1.2rem', fontWeight: 700 }}>Question Review</h3>

                                {selectedAttempt.questions.map((q, idx) => {
                                    const isCorrect = selectedAttempt.type === 'quiz'
                                        ? q.user_answer === q.correct_index
                                        : q.user_answer === q.correct_answer;

                                    return (
                                        <div key={idx} style={{
                                            background: 'white',
                                            borderRadius: '20px',
                                            padding: '24px',
                                            border: '1px solid var(--border)',
                                            borderLeft: `6px solid ${isCorrect ? '#10b981' : '#f43f5e'}`
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>QUESTION {idx + 1}</span>
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    fontSize: '0.8rem', fontWeight: 700,
                                                    color: isCorrect ? '#10b981' : '#f43f5e',
                                                    background: isCorrect ? '#f0fdf4' : '#fef2f2',
                                                    padding: '4px 10px', borderRadius: '100px'
                                                }}>
                                                    {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                    {isCorrect ? 'Correct' : 'Incorrect'}
                                                </div>
                                            </div>

                                            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '20px', lineHeight: 1.5 }}>
                                                {selectedAttempt.type === 'quiz' ? q.question : q.statement}
                                            </p>

                                            {selectedAttempt.type === 'quiz' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                                    {q.options.map((opt, oIdx) => (
                                                        <div key={oIdx} style={{
                                                            padding: '12px 16px',
                                                            borderRadius: '12px',
                                                            fontSize: '0.95rem',
                                                            border: '1px solid',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            borderColor: oIdx === q.correct_index
                                                                ? '#10b981'
                                                                : (oIdx === q.user_answer ? '#f43f5e' : '#e2e8f0'),
                                                            background: oIdx === q.correct_index
                                                                ? '#f0fdf4'
                                                                : (oIdx === q.user_answer ? '#fef2f2' : 'white'),
                                                            color: oIdx === q.correct_index
                                                                ? '#065f46'
                                                                : (oIdx === q.user_answer ? '#991b1b' : '#64748b'),
                                                            fontWeight: (oIdx === q.correct_index || oIdx === q.user_answer) ? 700 : 400
                                                        }}>
                                                            {opt}
                                                            {oIdx === q.correct_index && <CheckCircle2 size={18} />}
                                                            {oIdx === q.user_answer && oIdx !== q.correct_index && <XCircle size={18} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                                                    <div style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>YOUR ANSWER</div>
                                                        <div style={{ fontWeight: 700, color: q.user_answer === q.correct_answer ? '#10b981' : '#f43f5e' }}>
                                                            {q.user_answer ? 'True' : 'False'}
                                                        </div>
                                                    </div>
                                                    <div style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>CORRECT KEY</div>
                                                        <div style={{ fontWeight: 700, color: '#10b981' }}>
                                                            {q.correct_answer ? 'True' : 'False'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '12px', fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 }}>
                                                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: '#64748b' }}>EXPLANATION & CONTEXT</strong>
                                                {q.explanation}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default MyProgress;
