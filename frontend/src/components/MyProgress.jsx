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
    XCircle,
    Layers,
    Mic,
    MessageSquare,
    Star
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { translations } from "../translations";
import "../assets/styles/student-dashboard.css";

const MyProgress = () => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const t = translations[language];
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAttempt, setSelectedAttempt] = useState(null);
    const [filterType, setFilterType] = useState("all"); // all, quiz, truefalse, flashcards, oral_test

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
                                {selectedAttempt ? t.progress.reviewTitle : t.progress.title}
                            </h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {selectedAttempt ? `${selectedAttempt.book_name} • ${t.tools.items[selectedAttempt.type] || selectedAttempt.type}` : t.progress.subtitle}
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
                                    {['all', 'quiz', 'truefalse', 'flashcards', 'oral_test', 'summary'].map(typeKey => {
                                        const label = typeKey === 'all' ? t.progress.all : (t.tools.items[typeKey] || typeKey);

                                        return (
                                            <button
                                                key={typeKey}
                                                onClick={() => setFilterType(typeKey)}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '100px',
                                                    border: '1px solid var(--border)',
                                                    background: filterType === typeKey ? 'var(--primary)' : 'white',
                                                    color: filterType === typeKey ? 'white' : 'var(--text-muted)',
                                                    fontWeight: 600,
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                                    {t.progress.totalAttempts}: {filteredHistory.length}
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                                    <div className="loader" style={{ margin: '0 auto 20px' }}></div>
                                    <p style={{ color: 'var(--text-muted)' }}>{t.progress.loading}</p>
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '100px 20px', background: 'white', borderRadius: '24px', border: '1px dashed var(--border)' }}>
                                    <History size={48} color="var(--border)" style={{ marginBottom: '16px' }} />
                                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>{t.progress.noHistory}</h3>
                                    <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>{t.progress.startQuiz}</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {filteredHistory.map((attempt) => (
                                        <motion.div
                                            key={attempt.attempt_id}
                                            className="glass-card"
                                            whileHover={{ scale: 1.01, borderColor: '#94a3b8' }}
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
                                                background: attempt.type === 'quiz' ? '#eff6ff' : (attempt.type === 'flashcards' ? '#f5f3ff' : (attempt.type === 'oral_test' ? '#fffbeb' : '#f0fdf4')),
                                                color: attempt.type === 'quiz' ? '#2563eb' : (attempt.type === 'flashcards' ? '#7c3aed' : (attempt.type === 'oral_test' ? '#d97706' : '#10b981')),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {attempt.type === 'quiz' ? <Zap size={24} /> : (attempt.type === 'flashcards' ? <Layers size={24} /> : (attempt.type === 'oral_test' ? <Mic size={24} /> : <CheckSquare size={24} />))}
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
                                                {attempt.status === "PENDING_REVIEW" ? (
                                                    <div style={{ padding: '4px 12px', borderRadius: '8px', background: '#fffbeb', color: '#b45309', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        {t.progress.pendingReview}
                                                    </div>
                                                ) : attempt.status === "AI_REVIEWED" ? (
                                                    <div style={{ padding: '4px 12px', borderRadius: '8px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        {t.progress.aiReviewed}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{
                                                            fontSize: '1.2rem',
                                                            fontWeight: 800,
                                                            color: (attempt.type === 'oral_test' ? (attempt.score / (attempt.total_questions * 5)) : (attempt.type === 'flashcards' ? (attempt.metadata?.known_count / attempt.total_questions) : (attempt.score / attempt.total_questions))) >= 0.8 ? '#10b981' : '#f59e0b'
                                                        }}>
                                                            {attempt.type === 'flashcards' ? (attempt.metadata?.known_count || 0) : attempt.score}/{attempt.type === 'oral_test' ? attempt.total_questions * 5 : attempt.total_questions}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                            {attempt.type === 'oral_test' ? t.progress.score : t.progress.result}
                                                        </div>
                                                    </>
                                                )}
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
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                        {selectedAttempt.type === 'flashcards'
                                            ? `${selectedAttempt.metadata?.known_count || 0}/${selectedAttempt.total_questions}`
                                            : (selectedAttempt.status === 'PENDING_REVIEW' ? '---' : `${selectedAttempt.score}/${selectedAttempt.total_questions * (selectedAttempt.type === 'oral_test' ? 5 : 1)}`)}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {selectedAttempt.type === 'flashcards' ? t.progress.mastered : (selectedAttempt.status === 'AI_REVIEWED' ? `${t.progress.score} (AI)` : t.progress.score)}
                                    </div>
                                </div>
                                <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <Award size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                        {selectedAttempt.type === 'flashcards'
                                            ? Math.round(((selectedAttempt.metadata?.known_count || 0) / selectedAttempt.total_questions) * 100)
                                            : (selectedAttempt.status === 'PENDING_REVIEW' ? '0' : Math.round((selectedAttempt.score / (selectedAttempt.total_questions * (selectedAttempt.type === 'oral_test' ? 5 : 1))) * 100))}%
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {selectedAttempt.status === 'AI_REVIEWED' ? `${t.progress.accuracy} (AI)` : t.progress.accuracy}
                                    </div>
                                </div>
                                <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <Clock size={24} color="#6366f1" style={{ margin: '0 auto 8px' }} />
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                        {selectedAttempt.metadata?.duration_seconds
                                            ? `${Math.floor(selectedAttempt.metadata.duration_seconds / 60)}m ${Math.floor(selectedAttempt.metadata.duration_seconds % 60)}s`
                                            : (selectedAttempt.status === "PENDING_REVIEW" ? t.progress.pendingReview : (selectedAttempt.status === "AI_REVIEWED" ? t.progress.aiReviewed : "Reviewed"))}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {selectedAttempt.metadata?.duration_seconds ? t.progress.duration : t.progress.reviewStatus}
                                    </div>
                                </div>
                            </div>

                            {/* Detailed List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <h3 style={{ margin: '0 -8px', fontSize: '1.2rem', fontWeight: 700 }}>
                                    {selectedAttempt.type === 'flashcards' ? t.tools.items.flashcards : (selectedAttempt.type === 'oral_test' ? t.tools.items.oralTests : t.progress.questionReview)}
                                </h3>

                                {selectedAttempt.type === 'flashcards' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {selectedAttempt.metadata?.flashcards ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                {selectedAttempt.metadata.flashcards.map((card, cIdx) => {
                                                    const isKnown = selectedAttempt.metadata.knownIndices?.includes(cIdx);
                                                    return (
                                                        <div key={cIdx} style={{
                                                            background: 'white', padding: '20px', borderRadius: '20px',
                                                            border: '1px solid var(--border)',
                                                            borderLeft: `6px solid ${isKnown ? '#10b981' : '#f59e0b'}`,
                                                            display: 'flex', flexDirection: 'column', gap: '12px'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CARD {cIdx + 1}</span>
                                                                <span style={{
                                                                    fontSize: '0.7rem', fontWeight: 800,
                                                                    color: isKnown ? '#10b981' : '#b45309',
                                                                    background: isKnown ? '#f0fdf4' : '#fffbeb',
                                                                    padding: '4px 8px', borderRadius: '100px'
                                                                }}>
                                                                    {isKnown ? t.flash.known : t.flash.reviewAgain}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{card.front}</p>
                                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{card.back}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{
                                                gridColumn: '1 / -1', padding: '32px', textAlign: 'center',
                                                background: 'white', borderRadius: '24px', border: '1px solid var(--border)'
                                            }}>
                                                <History size={32} color="var(--border)" style={{ marginBottom: '12px' }} />
                                                <p style={{ color: 'var(--text-muted)' }}>
                                                    Study session completed with <strong>{selectedAttempt.metadata?.known_count || 0}</strong> known cards
                                                    and <strong>{selectedAttempt.metadata?.review_count || 0}</strong> cards marked for review.
                                                </p>
                                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>Detailed card history is only available for sessions completed after the last update.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : selectedAttempt.type === 'oral_test' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {selectedAttempt.metadata?.questions.map((q, qIdx) => {
                                            return (
                                                <div key={qIdx} style={{
                                                    background: 'white', borderRadius: '24px', padding: '24px',
                                                    border: '1px solid var(--border)', borderLeft: `8px solid ${selectedAttempt.status === 'REVIEWED' ? '#10b981' : '#f59e0b'}`
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>QUESTION {qIdx + 1}</span>
                                                        {selectedAttempt.status === 'REVIEWED' && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', color: '#166534', padding: '4px 12px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                                <Star size={14} fill="#166534" /> Score: {q.score}/5
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '20px', lineHeight: 1.4 }}>{q.question}</p>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                                            <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>Your Recorded Answer</p>
                                                            {q.audio_url ? (
                                                                <>
                                                                    <audio controls src={q.audio_url} style={{ width: '100%', height: '36px', marginBottom: q.transcript ? '12px' : '0' }} />
                                                                    {q.transcript && (
                                                                        <div style={{ padding: '8px 12px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                                                                            "{q.transcript}"
                                                                            <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', fontStyle: 'normal', margin: '4px 0 0' }}>
                                                                                ⚠️ Transcription may contain minor errors. Teacher review is final.
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>Audio not found</p>
                                                            )}
                                                        </div>
                                                        <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                                                            <p style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>Canonical Answer</p>
                                                            <p style={{ fontSize: '0.85rem', color: '#14532d', lineHeight: 1.4 }}>{q.sample_answer}</p>
                                                        </div>
                                                    </div>

                                                    {selectedAttempt.status === 'REVIEWED' ? (
                                                        <div style={{ background: 'var(--primary-soft)', padding: '20px', borderRadius: '16px', border: '1px solid var(--primary-light)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                <MessageSquare size={16} color="var(--primary)" />
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Teacher Feedback</span>
                                                            </div>
                                                            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
                                                                {q.feedback || "Review complete."}
                                                            </p>
                                                        </div>
                                                    ) : (selectedAttempt.status === 'AI_REVIEWED' || q.ai_analysis) ? (
                                                        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <Zap size={16} color="#0369a1" />
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>AI Preliminary Review</span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        Confidence: {q.ai_analysis.confidence}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px' }}>
                                                                        AI Score: {q.ai_analysis.score}/5
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p style={{ fontSize: '0.95rem', color: '#0369a1', lineHeight: 1.5, margin: '0 0 12px' }}>
                                                                {q.ai_analysis.feedback}
                                                            </p>
                                                            <div style={{ fontSize: '0.75rem', padding: '10px', background: '#e0f2fe', borderRadius: '8px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                                                                ℹ️ <strong>Note:</strong> This is an AI-generated score for your reference. Your teacher will also evaluate your response, which you can check here later.
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '16px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <Clock size={20} color="#b45309" />
                                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#92400e', fontWeight: 500 }}>{t.progress.pendingReview}.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    selectedAttempt.questions.map((q, idx) => {
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
                                                        {isCorrect ? t.progress.correct : t.progress.incorrect}
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
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>{t.progress.yourAnswer}</div>
                                                            <div style={{ fontWeight: 700, color: q.user_answer === q.correct_answer ? '#10b981' : '#f43f5e' }}>
                                                                {q.user_answer ? 'True' : 'False'}
                                                            </div>
                                                        </div>
                                                        <div style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>{t.progress.correctKey}</div>
                                                            <div style={{ fontWeight: 700, color: '#10b981' }}>
                                                                {q.correct_answer ? 'True' : 'False'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '12px', fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 }}>
                                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: '#64748b' }}>{t.progress.explanation.toUpperCase()}</strong>
                                                    {q.explanation}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default MyProgress;
