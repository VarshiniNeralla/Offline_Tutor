import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Clock,
    ChevronLeft,
    CheckCircle2,
    XCircle,
    AlertCircle,
    RotateCcw,
    BookOpen,
    Brain,
    Trophy,
    ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../assets/styles/student-dashboard.css'; // Reusing dashboard styles for consistency

const QuizTool = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // quizContext passed from Dashboard
    const { subject, bookId, bookName: rawBookName, class: className } = location.state || {};
    const bookName = rawBookName ? rawBookName.replace(/\.pdf$/i, '') : '';

    // Redirect if no context
    useEffect(() => {
        if (!bookId) navigate('/student/dashboard');
    }, [bookId, navigate]);

    // --- STATE MACHINE ---
    const [view, setView] = useState('SETUP'); // SETUP, LOADING, GAME, RESULTS, ERROR
    const [qCount, setQCount] = useState(null); // 10, 20, 30
    const [questions, setQuestions] = useState([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({}); // { qIndex: selectedOptionIndex }
    const [score, setScore] = useState(0);
    const [timeElapsed, setTimeElapsed] = useState(0); // in seconds
    const [errorMsg, setErrorMsg] = useState("");

    // --- GENERATION LOGIC ---
    const startQuiz = async () => {
        if (!qCount) return;
        setView('LOADING');
        setErrorMsg("");

        try {
            const prompt = `Generate ${qCount} multiple choice questions for a quiz from the textbook "${bookName}".`;

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: prompt,
                    subjects: [subject],
                    book_ids: [bookId],
                    language: 'english', // Default to English for now, can be dynamic
                    mode: 'quiz' // SPECIAL FLAG FOR BACKEND
                })
            });

            // Check if response is OK before parsing
            if (!res.ok) {
                const errorText = await res.text();
                console.error(`Server error (${res.status}):`, errorText);
                setErrorMsg(`Server error: ${errorText || 'Failed to generate quiz'}`);
                setView('ERROR');
                return;
            }

            const data = await res.json();

            if (data.mode === 'quiz') {
                let parsedQuestions = [];
                try {
                    //Backend returns stringified JSON in 'response'
                    //It might need a second parse if it's double encoded, or just one
                    const rawJson = data.response;
                    parsedQuestions = JSON.parse(rawJson);

                    if (!Array.isArray(parsedQuestions)) throw new Error("Format invalid");

                    setQuestions(parsedQuestions);
                    setView('GAME');
                } catch (e) {
                    console.error("JSON Parse Error", e);
                    setErrorMsg("Failed to parse quiz data. The AI might be busy.");
                    setView('ERROR');
                }
            } else {
                throw new Error("Backend did not return quiz mode");
            }

        } catch (err) {
            console.error("Quiz Gen Error", err);
            setErrorMsg("Could not connect to the AI Tutor.");
            setView('ERROR');
        }
    };

    const handleRetry = () => {
        setQuestions([]);
        setUserAnswers({});
        setScore(0);
        setTimeElapsed(0);
        setCurrentQIndex(0);
        setView('SETUP');
    };

    const saveProgress = async (finalQuestions, finalAnswers) => {
        try {
            const studentName = localStorage.getItem("studentName");
            const studentClass = localStorage.getItem("studentClass");

            const correctCount = finalQuestions.reduce((acc, q, idx) => {
                return acc + (finalAnswers[idx] === q.correct_index ? 1 : 0);
            }, 0);

            const payload = {
                type: 'quiz',
                student_name: studentName,
                student_class: studentClass,
                subject,
                book_id: bookId,
                book_name: bookName,
                score: correctCount,
                total_questions: finalQuestions.length,
                questions: finalQuestions.map((q, idx) => ({
                    ...q,
                    user_answer: finalAnswers[idx]
                }))
            };

            await fetch('/api/progress/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error("Save progress failed", err);
        }
    };

    return (
        <div className="dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <style>{styles}</style>
            {/* HEADER */}
            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate('/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>AI Quiz: {bookName}</h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{subject} • {className}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="dashboard-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <AnimatePresence mode="wait">
                    {view === 'SETUP' && (
                        <QuizSetup
                            key="setup"
                            qCount={qCount}
                            setQCount={setQCount}
                            onStart={startQuiz}
                        />
                    )}
                    {view === 'LOADING' && (
                        <QuizLoading key="loading" />
                    )}
                    {view === 'GAME' && (
                        <QuizGame
                            key="game"
                            questions={questions}
                            currentQIndex={currentQIndex}
                            setCurrentQIndex={setCurrentQIndex}
                            userAnswers={userAnswers}
                            setUserAnswers={setUserAnswers}
                            onFinish={() => {
                                setView('RESULTS');
                                saveProgress(questions, userAnswers);
                            }}
                            timeElapsed={timeElapsed}
                            setTimeElapsed={setTimeElapsed}
                        />
                    )}
                    {view === 'RESULTS' && (
                        <QuizResults
                            key="results"
                            questions={questions}
                            userAnswers={userAnswers}
                            timeElapsed={timeElapsed}
                            onRetry={handleRetry}
                            onExit={() => navigate('/student/dashboard')}
                        />
                    )}
                    {view === 'ERROR' && (
                        <QuizError
                            key="error"
                            message={errorMsg}
                            onRetry={handleRetry}
                        />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

// --- SUB COMPONENTS ---

const QuizSetup = ({ qCount, setQCount, onStart }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        className="quiz-card"
    >
        <div className="quiz-hero">
            <div className="quiz-icon-large"><Brain size={48} /></div>
            <h2>Configure Your Quiz</h2>
            <p>Select the number of questions to generate from this chapter.</p>
        </div>

        <div className="quiz-options-grid">
            {[5, 10, 15].map(num => (
                <button
                    key={num}
                    className={`quiz-option-btn ${qCount === num ? 'active' : ''}`}
                    onClick={() => setQCount(num)}
                >
                    <span className="count">{num}</span>
                    <span className="label">Questions</span>
                </button>
            ))}
        </div>

        <div className="quiz-actions">
            <button
                className="start-quiz-btn"
                disabled={!qCount}
                onClick={onStart}
            >
                Start Quiz <ArrowRight size={20} />
            </button>
        </div>
    </motion.div>
);

const QuizLoading = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return 90;
                const inc = Math.floor(Math.random() * 5) + 2;
                return Math.min(prev + inc, 90);
            });
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="quiz-loading"
        >
            <div className="scanner"></div>
            <h3>Analyzing Textbook...</h3>

            {/* Progress Bar UI */}
            <div className="progress-container-quiz" style={{ margin: '24px auto', background: '#e2e8f0', borderRadius: '10px', height: '8px', overflow: 'hidden', maxWidth: '300px' }}>
                <div
                    className="progress-fill-quiz"
                    style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'var(--primary)',
                        borderRadius: '10px',
                        transition: 'width 0.5s ease-out'
                    }}
                />
            </div>
            <p style={{ marginTop: '-12px', marginBottom: '16px', fontWeight: 600, color: 'var(--primary)' }}>{progress}%</p>

            <p>Generating unique questions for you.</p>
        </motion.div>
    );
};

const QuizGame = ({ questions, currentQIndex, setCurrentQIndex, userAnswers, setUserAnswers, onFinish, timeElapsed, setTimeElapsed }) => {
    const question = questions[currentQIndex];
    const isAnswered = userAnswers[currentQIndex] !== undefined;
    const isCorrect = isAnswered && userAnswers[currentQIndex] === question.correct_index;

    // Timer Logic
    useEffect(() => {
        const timer = setInterval(() => setTimeElapsed(p => p + 1), 1000);
        return () => clearInterval(timer);
    }, [setTimeElapsed]);

    const handleOptionClick = (idx) => {
        if (isAnswered) return;
        setUserAnswers(prev => ({ ...prev, [currentQIndex]: idx }));

        // Auto scroll/next logic could go here if requested, but let's stick to manual next for clarity
    };

    const handleNext = () => {
        if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
        } else {
            onFinish();
        }
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="quiz-game-container"
        >
            <div className="quiz-game-header">
                <div className="progress-pill">
                    Question {currentQIndex + 1} / {questions.length}
                </div>
                <div className="timer-pill">
                    <Clock size={16} /> {formatTime(timeElapsed)}
                </div>
            </div>

            <div className="quiz-progress-bar">
                <div
                    className="quiz-progress-fill"
                    style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                ></div>
            </div>

            <div className="question-card">
                <h3 className="question-text">{question.question}</h3>

                <div className="options-list">
                    {question.options.map((opt, idx) => {
                        let statusClass = "";
                        if (isAnswered) {
                            if (idx === question.correct_index) statusClass = "correct";
                            else if (idx === userAnswers[currentQIndex]) statusClass = "wrong";
                            else statusClass = "dimmed";
                        }
                        return (
                            <button
                                key={idx}
                                className={`option-btn ${statusClass} ${userAnswers[currentQIndex] === idx ? 'selected' : ''}`}
                                onClick={() => handleOptionClick(idx)}
                                disabled={isAnswered}
                            >
                                <div className="opt-letter">{String.fromCharCode(65 + idx)}</div>
                                <div className="opt-text">{opt}</div>
                                {isAnswered && idx === question.correct_index && <CheckCircle2 size={20} className="status-icon" />}
                                {isAnswered && idx === userAnswers[currentQIndex] && idx !== question.correct_index && <XCircle size={20} className="status-icon" />}
                            </button>
                        );
                    })}
                </div>

                {isAnswered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="explanation-box"
                    >
                        <strong>Explanation:</strong> {question.explanation}
                    </motion.div>
                )}
            </div>

            <div className="quiz-footer">
                <button
                    className="next-btn"
                    disabled={!isAnswered}
                    onClick={handleNext}
                >
                    {currentQIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
                </button>
            </div>
        </motion.div>
    );
};

const QuizResults = ({ questions, userAnswers, timeElapsed, onRetry, onExit }) => {
    const correctCount = questions.reduce((acc, q, idx) => {
        return acc + (userAnswers[idx] === q.correct_index ? 1 : 0);
    }, 0);

    const percentage = Math.round((correctCount / questions.length) * 100);

    let badge = { text: "Keep Trying", color: "orange" };
    if (percentage >= 90) badge = { text: "Excellent!", color: "green" };
    else if (percentage >= 70) badge = { text: "Good Job", color: "blue" };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s}s`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="results-container"
        >
            <div className="results-header">
                <div className="trophy-icon"><Trophy size={40} /></div>
                <h2>Quiz Complete!</h2>
                <div className={`badge ${badge.color}`}>{badge.text}</div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <span className="label">Score</span>
                    <span className="value">{correctCount}/{questions.length}</span>
                </div>
                <div className="stat-card">
                    <span className="label">Accuracy</span>
                    <span className="value">{percentage}%</span>
                </div>
                <div className="stat-card">
                    <span className="label">Time</span>
                    <span className="value">{formatTime(timeElapsed)}</span>
                </div>
            </div>

            <div className="review-section">
                <h3>Review Answers</h3>
                <div className="review-list">
                    {questions.map((q, idx) => (
                        <div key={idx} className="review-item">
                            <div className="review-header">
                                <span className="q-num">Q{idx + 1}</span>
                                {userAnswers[idx] === q.correct_index ?
                                    <span className="status correct">Correct</span> :
                                    <span className="status wrong">Incorrect</span>
                                }
                            </div>
                            <p className="review-q">{q.question}</p>
                            <p className="review-ans">
                                Correct: <strong>{q.options[q.correct_index]}</strong>
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="results-actions">
                <button className="secondary-btn" onClick={onExit}>Dashboard</button>
                <button className="primary-btn" onClick={onRetry}><RotateCcw size={18} /> Retry Quiz</button>
            </div>
        </motion.div>
    );
};

const QuizError = ({ message, onRetry }) => (
    <div className="quiz-error">
        <AlertCircle size={48} className="error-icon" />
        <h3>Oops! Something went wrong</h3>
        <p>{message}</p>
        <button onClick={onRetry} className="retry-btn">Try Again</button>
    </div>
);

// --- CSS STYLES (Inline for now, can move to CSS file later) ---
const styles = `
.quiz-card {
    background: white;
    padding: 40px;
    border-radius: 24px;
    text-align: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.quiz-hero h2 { margin-bottom: 8px; font-size: 1.8rem; }
.quiz-hero p { color: var(--text-muted); margin-bottom: 32px; }
.quiz-options-grid { display: flex; gap: 16px; justify-content: center; margin-bottom: 40px; }
.quiz-option-btn {
    border: 2px solid var(--border);
    background: white;
    padding: 20px;
    border-radius: 16px;
    cursor: pointer;
    min-width: 100px;
    transition: all 0.2s;
}
.quiz-option-btn.active { border-color: var(--primary); background: var(--primary-soft); }
.quiz-option-btn .count { display: block; font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
.quiz-option-btn .label { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
.start-quiz-btn {
    background: var(--primary); color: white; border: none; padding: 16px 32px;
    border-radius: 14px; font-size: 1.1rem; font-weight: 600;
    display: inline-flex; items-align: center; gap: 8px; cursor: pointer;
    transition: all 0.2s;
}
.start-quiz-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.quiz-loading { text-align: center; padding: 60px; }
/* Add scanner animation here */

.quiz-game-header { display: flex; justify-content: space-between; margin-bottom: 16px; }
.progress-pill, .timer-pill { background: white; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; border: 1px solid var(--border); display: flex; align-items: center; gap: 6px;}

.quiz-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin-bottom: 24px; overflow: hidden; }
.quiz-progress-fill { height: 100%; background: var(--primary); transition: width 0.3s ease; }

.question-text { font-size: 1.3rem; margin-bottom: 24px; line-height: 1.5; }
.options-list { display: flex; flex-direction: column; gap: 12px; }
.option-btn {
    display: flex; align-items: center; gap: 16px; padding: 16px;
    background: white; border: 1px solid var(--border); border-radius: 12px;
    text-align: left; cursor: pointer; transition: all 0.2s;
    font-size: 1rem; color: var(--text-main);
}
.option-btn:hover:not(:disabled) { border-color: var(--primary); background: #f8fafc; }
.option-btn.selected { border-color: var(--primary); background: var(--primary-soft); }
.option-btn.correct { border-color: #10b981; background: #ecfdf5; color: #065f46; }
.option-btn.wrong { border-color: #ef4444; background: #fef2f2; color: #991b1b; }
.option-btn.dimmed { opacity: 0.6; }
.opt-letter { font-weight: 700; color: var(--text-muted); background: #f1f5f9; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }

.explanation-box { margin-top: 20px; background: #f0f9ff; padding: 16px; border-radius: 12px; color: #0369a1; border: 1px solid #bae6fd; line-height: 1.5; }

.quiz-footer { margin-top: 32px; display: flex; justify-content: flex-end; }
.next-btn { background: var(--navy); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; }
.next-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.results-container { background: white; padding: 40px; border-radius: 24px; text-align: center; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 32px 0; }
.stat-card { background: #f8fafc; padding: 16px; border-radius: 12px; display: flex; flex-direction: column; gap: 4px; }
.stat-card .label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; }
.stat-card .value { font-size: 1.4rem; font-weight: 700; color: var(--text-main); }
.badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-top: 8px;}
.badge.green { background: #dcfce7; color: #166534; }
.badge.blue { background: #dbeafe; color: #1e40af; }
.badge.orange { background: #ffedd5; color: #9a3412; }

.review-section { text-align: left; margin-top: 40px; border-top: 1px solid var(--border); padding-top: 24px; }
.review-item { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
.review-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; }
.status.correct { color: #10b981; font-weight: 600; }
.status.wrong { color: #ef4444; font-weight: 600; }
.review-q { font-weight: 500; margin-bottom: 4px; }
.review-ans { font-size: 0.9rem; color: var(--text-muted); }

.results-actions { display: flex; gap: 16px; justify-content: center; margin-top: 32px; }
.primary-btn { background: var(--primary); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.secondary-btn { background: white; color: var(--text-muted); border: 1px solid var(--border); padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; }

/* ERROR STATE */
.quiz-error { text-align: center; padding: 60px 20px; }
.error-icon { color: #ef4444; margin-bottom: 16px; }
.retry-btn { margin-top: 16px; background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
`;

export default QuizTool;
