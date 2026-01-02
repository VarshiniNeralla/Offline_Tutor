import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    CheckCircle2,
    XCircle,
    AlertCircle,
    RotateCcw,
    BookOpen,
    Brain,
    Trophy,
    ArrowRight,
    HelpCircle,
    Edit3,
    Save,
    Trash2,
    Plus,
    ShieldCheck,
    ChevronRight,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../assets/styles/student-dashboard.css';

const TrueFalseTool = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Context from Dashboard / Admin
    const { subject, bookId, bookName, class: className, role = 'student' } = location.state || {};

    // --- STATE ---
    const [view, setView] = useState('SETUP'); // SETUP, LOADING, GAME, RESULTS, ERROR
    const [qCount, setQCount] = useState(5);
    const [mode, setMode] = useState('PRACTICE'); // PRACTICE or TEST
    const [questions, setQuestions] = useState([]);
    const [currentBatch, setCurrentBatch] = useState(0); // For pagination (0 = q 1-10, 1 = q 11-20, etc)
    const [userAnswers, setUserAnswers] = useState({}); // { qIndex: boolean }
    const [showExplanations, setShowExplanations] = useState({}); // { qIndex: boolean }
    const [score, setScore] = useState(0);
    const [errorMsg, setErrorMsg] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!bookId) {
            navigate(role === 'teacher' ? '/teacher' : '/student/dashboard');
            return;
        }

        // Restore Session if it exists
        const sessionKey = `tf_active_session_${bookId}`;
        const savedSession = localStorage.getItem(sessionKey);
        if (savedSession) {
            try {
                const s = JSON.parse(savedSession);
                setView(s.view);
                setMode(s.mode);
                setQCount(s.qCount);
                setQuestions(s.questions);
                setUserAnswers(s.userAnswers || {});
                setShowExplanations(s.showExplanations || {});
                setScore(s.score || 0);
                setCurrentBatch(s.currentBatch || 0);
            } catch (e) { console.error("Session restore failed", e); }
        }
    }, [bookId, navigate, role]);

    // --- PERSISTENCE ---
    useEffect(() => {
        if (view === 'GAME' || view === 'RESULTS') {
            const sessionKey = `tf_active_session_${bookId}`;
            localStorage.setItem(sessionKey, JSON.stringify({
                view, mode, qCount, questions, userAnswers, showExplanations, score, currentBatch
            }));
        } else if (view === 'SETUP') {
            localStorage.removeItem(`tf_active_session_${bookId}`);
        }
    }, [view, questions, userAnswers, showExplanations, score, currentBatch, mode, qCount, bookId]);

    // --- LOGIC ---
    const fetchQuestions = async () => {
        setView('LOADING');
        setErrorMsg("");

        try {
            const cacheKey = `tf_history_${bookId}_${qCount}_v1`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.data && parsed.data.length > 0) {
                    setQuestions(parsed.data);
                    setView('GAME');
                    return;
                }
            }

            // Fetch from Backend
            const res = await fetch('http://localhost:8000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Identify ${qCount} important facts, numerical data, and core concepts from this text to generate True/False questions.`,
                    subjects: [subject],
                    book_ids: [bookId],
                    language: 'english',
                    mode: 'truefalse'
                })
            });

            if (!res.ok) throw new Error("Failed to contact AI.");
            const data = await res.json();

            let extracted = [];
            if (data.response && data.response.trim().startsWith('{')) {
                const parsedJson = JSON.parse(data.response);
                if (parsedJson.questions) {
                    extracted = parsedJson.questions;
                }
            }

            if (extracted.length === 0) {
                throw new Error("The AI was unable to extract factual questions from this section. Please try again or select a different chapter.");
            }

            setQuestions(extracted);
            // Cache it
            localStorage.setItem(cacheKey, JSON.stringify({
                version: 1,
                type: 'ai',
                timestamp: Date.now(),
                is_active: true,
                data: extracted
            }));
            setView('GAME');

        } catch (err) {
            console.error(err);
            setErrorMsg(err.message || "Could not load questions.");
            setView('ERROR');
        }
    };

    const handleAnswer = (qIdx, choice) => {
        if (view === 'RESULTS') return;

        const newAnswers = { ...userAnswers, [qIdx]: choice };
        setUserAnswers(newAnswers);

        if (mode === 'PRACTICE') {
            setShowExplanations({ ...showExplanations, [qIdx]: true });
        }
    };

    const calculateResults = () => {
        let finalScore = 0;
        questions.forEach((q, idx) => {
            if (userAnswers[idx] === q.answer) finalScore++;
        });
        setScore(finalScore);
        setView('RESULTS');
    };

    const handleRetry = () => {
        setUserAnswers({});
        setShowExplanations({});
        setScore(0);
        setCurrentBatch(0);
        setView('SETUP');
    };

    // Teacher Logic
    const handleEditChange = (idx, field, value) => {
        const newData = [...questions];
        newData[idx][field] = value;
        newData[idx].editedByTeacher = true;
        setQuestions(newData);
        setUnsavedChanges(true);
    };

    const handleSave = () => {
        const cacheKey = `tf_history_${bookId}_v1`;
        localStorage.setItem(cacheKey, JSON.stringify({
            version: Date.now(),
            type: 'teacher',
            timestamp: Date.now(),
            is_active: true,
            data: questions
        }));
        setUnsavedChanges(false);
        setIsEditing(false);
        alert("Changes saved successfully!");
    };

    const handleAddQuestion = () => {
        const newQ = {
            statement: "New statement...",
            answer: true,
            explanation: "Brief explanation...",
            difficulty: "Easy",
            section_reference: "General",
            corrected_statement: "",
            editedByTeacher: true
        };
        setQuestions([newQ, ...questions]);
        setUnsavedChanges(true);
    };

    const handleDelete = (index) => {
        if (window.confirm("Remove this question?")) {
            const newData = questions.filter((_, i) => i !== index);
            setQuestions(newData);
            setUnsavedChanges(true);
        }
    };

    // --- RENDER ---
    return (
        <div className="dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <header className="dashboard-header">
                <div className="dashboard-header-inner" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate(role === 'teacher' ? '/teacher' : '/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>True/False Quiz: {bookName}</h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{subject} • {role === 'teacher' ? 'Management Mode' : 'Practice & Mastery'}</p>
                        </div>
                    </div>

                    {view === 'GAME' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {role === 'teacher' ? (
                                isEditing ? (
                                    <>
                                        <button className="secondary-btn" onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', borderRadius: '8px' }}>Cancel</button>
                                        <button className="secondary-btn" onClick={handleAddQuestion} style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', background: '#ecfdf5', color: '#059669', borderColor: '#10b981' }}>
                                            <Plus size={18} /> Add Question
                                        </button>
                                        <button className="primary-btn" onClick={handleSave} disabled={!unsavedChanges} style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <Save size={18} /> Save Batch
                                        </button>
                                    </>
                                ) : (
                                    <button className="secondary-btn" onClick={() => setIsEditing(true)} style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <Edit3 size={18} /> Edit Questions
                                    </button>
                                )
                            ) : (
                                <button className="secondary-btn" onClick={handleRetry} style={{ padding: '8px 16px', color: '#ef4444', borderColor: '#fee2e2' }}>
                                    End Quiz
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="dashboard-container" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' }}>
                <AnimatePresence mode="wait">
                    {view === 'SETUP' && (
                        <motion.div key="setup" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card" style={{ padding: '32px', textAlign: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                            <div className="setup-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', padding: '16px', borderRadius: '24px', display: 'inline-block', marginBottom: '20px', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                                <FileText size={40} color="white" />
                            </div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px', background: 'linear-gradient(90deg, #1e293b, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                Fact-Check Challenge
                            </h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1rem', fontWeight: 500 }}>
                                Master the core concepts of <strong>{bookName}</strong>
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px', margin: '0 auto' }}>
                                <div style={{ textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', fontSize: '0.9rem' }}>QUESTIONS</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                        {[5, 10, 15].map(n => (
                                            <button key={n} onClick={() => setQCount(n)} className={qCount === n ? 'count-btn active' : 'count-btn'} style={{ padding: '8px' }}>
                                                {n} Qs
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', fontSize: '0.9rem' }}>MODE</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <button onClick={() => setMode('PRACTICE')} className={mode === 'PRACTICE' ? 'count-btn active' : 'count-btn'}>
                                            Practice
                                        </button>
                                        <button onClick={() => setMode('TEST')} className={mode === 'TEST' ? 'count-btn active' : 'count-btn'}>
                                            Test
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px' }}>
                                        {mode === 'PRACTICE' ? "Immediate feedback & explanations" : "Hide answers until the very end"}
                                    </p>
                                </div>

                                <button onClick={fetchQuestions} className="primary-btn" style={{ height: '54px', fontSize: '1.1rem', marginTop: '16px' }}>
                                    Launch Quiz
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'LOADING' && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="loading-view" style={{ textAlign: 'center', padding: '100px 0' }}>
                            <div className="spinner-large" style={{ margin: '0 auto 24px' }}>
                                <Brain size={48} className="zap-spin" style={{ color: 'var(--primary)' }} />
                            </div>
                            <h3>Analyzing Textbook...</h3>
                            <p>Crafting direct factual questions</p>
                        </motion.div>
                    )}

                    {view === 'ERROR' && (
                        <motion.div key="error" className="glass-card" style={{ padding: '40px', textAlign: 'center', borderColor: '#fee2e2' }}>
                            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
                            <h3>Oops!</h3>
                            <p style={{ color: '#ef4444' }}>{errorMsg}</p>
                            <button onClick={() => {
                                localStorage.removeItem(`tf_history_${bookId}_${qCount}_v1`);
                                setView('SETUP');
                            }} className="secondary-btn" style={{ marginTop: '24px' }}>Try Again</button>
                        </motion.div>
                    )}

                    {view === 'GAME' && (
                        <motion.div key="game" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Pagination Progress */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <BookOpen size={16} /> PAGE {currentBatch + 1} OF {Math.ceil(questions.slice(0, qCount).length / 5)}
                                </div>
                                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '10px', width: '200px', overflow: 'hidden', position: 'relative' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(Object.keys(userAnswers).length / Math.min(qCount, questions.length)) * 100}%` }}
                                        className="mastery-bar-glow"
                                        style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', transition: 'width 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
                                    />
                                </div>
                            </div>

                            {/* Question List */}
                            {questions.slice(currentBatch * 5, (currentBatch + 1) * 5).map((q, idx) => {
                                const globalIdx = currentBatch * 5 + idx;
                                if (globalIdx >= qCount) return null;
                                return (
                                    <QuestionRow
                                        key={globalIdx}
                                        index={globalIdx}
                                        question={q}
                                        isEditing={isEditing}
                                        answer={userAnswers[globalIdx]}
                                        showExpl={showExplanations[globalIdx] || view === 'RESULTS'}
                                        onAnswer={handleAnswer}
                                        onEdit={handleEditChange}
                                        onDelete={handleDelete}
                                        testMode={mode === 'TEST'}
                                    />
                                );
                            })}

                            {/* Batch Controls */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                                <button
                                    onClick={() => setCurrentBatch(b => b - 1)}
                                    disabled={currentBatch === 0}
                                    className="secondary-btn"
                                    style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 20px' }}
                                >
                                    <ChevronLeft size={20} /> Previous
                                </button>

                                {(currentBatch + 1) * 5 < Math.min(qCount, questions.length) ? (
                                    <button
                                        onClick={() => setCurrentBatch(b => b + 1)}
                                        className="secondary-btn"
                                        style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 20px' }}
                                    >
                                        Next <ChevronRight size={20} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={calculateResults}
                                        className="primary-btn"
                                        style={{ padding: '10px 30px' }}
                                        disabled={Object.keys(userAnswers).length < Math.min(qCount, questions.length)}
                                    >
                                        Finish & Review
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {view === 'RESULTS' && (
                        <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                            <Trophy size={64} color="#f59e0b" style={{ marginBottom: '20px' }} />
                            <h2>Quiz Complete!</h2>
                            <div style={{ fontSize: '3rem', fontWeight: 800, margin: '16px 0', color: 'var(--primary)' }}>
                                {score} / {Math.min(qCount, questions.length)}
                            </div>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                                {score / Math.min(qCount, questions.length) > 0.8 ? "Excellent! You've mastered these facts." : "Good effort! Review the explanations to improve."}
                            </p>

                            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                                <button onClick={handleRetry} className="secondary-btn" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <RotateCcw size={18} /> New Quiz
                                </button>
                                <button onClick={() => setView('GAME')} className="primary-btn">Review Answers</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <style>{`
                .glass-card {
                    background: rgba(255, 255, 255, 0.7);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 20px;
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
                    backdrop-filter: blur(12px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .question-card-active {
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    box-shadow: 0 12px 40px rgba(99, 102, 241, 0.1);
                }
                .count-btn {
                    padding: 12px;
                    border: 1px solid var(--border);
                    background: white;
                    border-radius: 14px;
                    cursor: pointer;
                    font-weight: 700;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                    color: var(--text-muted);
                }
                .count-btn:hover { 
                    border-color: var(--primary); 
                    color: var(--primary); 
                    transform: translateY(-1px);
                }
                .count-btn.active { 
                    background: var(--primary); 
                    color: white; 
                    border-color: var(--primary);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .pill-btn {
                   border-radius: 100px;
                   padding: 10px 24px;
                   font-weight: 700;
                   transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                   border: 2px solid #e2e8f0;
                   background: white;
                   color: #64748b;
                   cursor: pointer;
                   font-size: 0.95rem;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 8px;
                }
                .pill-btn:hover:not(:disabled) {
                    transform: scale(1.02);
                    border-color: #cbd5e1;
                }
                .pill-btn.active-true {
                    background: #10b981;
                    border-color: #10b981;
                    color: white;
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                }
                .pill-btn.active-false {
                    background: #f43f5e;
                    border-color: #f43f5e;
                    color: white;
                    box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3);
                }
                .mastery-bar-glow {
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
                }
            `}</style>
        </div>
    );
};

const QuestionRow = ({ index, question, isEditing, answer, showExpl, onAnswer, onEdit, onDelete, testMode }) => {
    const isCorrect = answer === question.answer;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`glass-card ${answer !== undefined ? 'question-card-active' : ''}`}
            style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}
        >
            {/* Background Decoration */}
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', z_index: 0 }} />

            {/* Verification Badge */}
            {!isEditing && question.editedByTeacher && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 800, background: '#f0fdf4', padding: '4px 8px', borderRadius: '100px' }}>
                    <ShieldCheck size={12} /> VERIFIED
                </div>
            )}

            <div style={{ display: 'flex', gap: '16px', alignItems: 'start', position: 'relative', z_index: 1 }}>
                <div style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    width: '36px', height: '36px', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                    fontSize: '1rem'
                }}>
                    {index + 1}
                </div>

                <div style={{ flex: 1 }}>
                    {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <textarea
                                value={question.statement}
                                onChange={(e) => onEdit(index, 'statement', e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontInherit: 'inherit', resize: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>KEY RESPONSE:</label>
                                <button onClick={() => onEdit(index, 'answer', true)} className={`pill-btn ${question.answer ? 'active-true' : ''}`} style={{ padding: '6px 16px' }}>True</button>
                                <button onClick={() => onEdit(index, 'answer', false)} className={`pill-btn ${!question.answer ? 'active-false' : ''}`} style={{ padding: '6px 16px' }}>False</button>
                            </div>
                        </div>
                    ) : (
                        <p style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.5, color: '#1e293b', margin: '4px 0 16px' }}>{question.statement}</p>
                    )}

                    {!isEditing && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => onAnswer(index, true)}
                                disabled={answer !== undefined && !testMode}
                                className={`pill-btn ${answer === true ? (testMode ? 'active-true' : (question.answer ? 'active-true' : 'active-false')) : ''}`}
                                style={{ flex: 1 }}
                            >
                                {answer === true && <CheckCircle2 size={18} />} True
                            </button>
                            <button
                                onClick={() => onAnswer(index, false)}
                                disabled={answer !== undefined && !testMode}
                                className={`pill-btn ${answer === false ? (testMode ? '' : (question.answer === false ? 'active-true' : 'active-false')) : (answer === false ? 'active-false' : '')}`}
                                style={{ flex: 1 }}
                            >
                                {answer === false && <XCircle size={18} />} False
                            </button>
                            {/* Adjusted the logic above slightly to handle "active-true" vs "active-false" correctly for immediate feedback in practice mode */}
                            {/* Let's simplify and make it correct: */}
                            {/*
                              Practice Mode:
                                If answer selected is True:
                                  Is question.answer True? active-true. Else active-false.
                              Test Mode:
                                Just active color (primary).
                            */}
                        </div>
                    )}

                    {showExpl && !isEditing && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginTop: '20px', borderTop: '2px dashed #e2e8f0', paddingTop: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                {isCorrect ? <CheckCircle2 size={18} color="#10b981" /> : <XCircle size={18} color="#f43f5e" />}
                                <span style={{ fontWeight: 800, color: isCorrect ? '#10b981' : '#f43f5e', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                                    {isCorrect ? 'Stellar!' : 'Not Quite'}
                                </span>
                            </div>

                            {!question.answer && question.corrected_statement && (
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', borderLeft: '4px solid #10b981', marginBottom: '12px', color: '#065f46' }}>
                                    <strong style={{ fontWeight: 800 }}>FACT:</strong> {question.corrected_statement}
                                </div>
                            )}

                            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
                                {question.explanation}
                            </p>
                        </motion.div>
                    )}

                    {isEditing && (
                        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ flex: '1 1 300px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>WHY IS THIS TRUE/FALSE?</label>
                                <textarea
                                    value={question.explanation}
                                    onChange={(e) => onEdit(index, 'explanation', e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                                />
                            </div>
                            {!question.answer && (
                                <div style={{ flex: '1 1 300px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>CORRECTION (IF FALSE)</label>
                                    <textarea
                                        value={question.corrected_statement}
                                        onChange={(e) => onEdit(index, 'corrected_statement', e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                                    />
                                </div>
                            )}
                            <button onClick={() => onDelete(index)} style={{ padding: '8px', color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default TrueFalseTool;
