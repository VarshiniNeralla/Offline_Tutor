import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../../context/LanguageContext";
import { translations } from "../../translations";
import {
    Mic,
    Square,
    Play,
    Pause,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    CheckCircle2,
    Clock,
    Volume2,
    Send,
    AlertCircle,
    Brain,
    HelpCircle
} from "lucide-react";
import "../../assets/styles/student-dashboard.css";
import ToolProcessingAnimation from './ToolProcessingAnimation';

const OralTestTool = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useLanguage();
    const t = translations[language];
    const { bookId, bookName, subject, studentName, studentClass } = location.state || {};

    const [view, setView] = useState('SETUP'); // SETUP, LOADING, TEST, SUMMARY, SUBMITTING
    const [mode, setMode] = useState('practice'); // practice, test
    const [qCount, setQCount] = useState(5);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [attemptId, setAttemptId] = useState(null);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showSample, setShowSample] = useState(false);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const audioRef = useRef(null);

    const MAX_DURATION = 90; // 90 seconds limit

    useEffect(() => {
        if (!bookId) navigate('/student/dashboard');
    }, [bookId, navigate]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    // Start Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                uploadRecording(blob);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordTime(0);
            timerRef.current = setInterval(() => {
                setRecordTime(prev => {
                    if (prev >= MAX_DURATION) {
                        stopRecording();
                        return MAX_DURATION;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const uploadRecording = async (blob) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('audio', blob, `q_${currentIndex}.webm`);
        formData.append('attempt_id', attemptId);
        formData.append('question_index', currentIndex);

        try {
            const res = await fetch('/api/oral_answers/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error("Upload failed");
            console.log("Audio uploaded successfully");
        } catch (err) {
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    const initializeTest = async () => {
        setView('LOADING');
        try {
            const res = await fetch('/api/oral_test/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    book_id: bookId,
                    book_name: bookName,
                    q_count: qCount,
                    mode,
                    student_name: studentName || localStorage.getItem('studentName') || 'Student',
                    student_class: studentClass || localStorage.getItem('studentClass') || 'Class',
                    subject,
                    language: language
                })
            });

            if (!res.ok) throw new Error("Failed to start oral test");
            const data = await res.json();
            if (!data.questions || data.questions.length === 0) {
                throw new Error("No questions were generated for this test. Try another chapter.");
            }
            setQuestions(data.questions);
            setAttemptId(data.attempt_id);
            setView('TEST');
        } catch (err) {
            alert(err.message);
            setView('SETUP');
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setAudioBlob(null);
            setAudioUrl(null);
            setShowSample(false);
        } else {
            finishTest();
        }
    };

    const finishTest = async () => {
        setView('SUBMITTING');
        try {
            await fetch(`/api/oral_test/finish/${attemptId}`, { method: 'POST' });
            setView('SUMMARY');
        } catch (err) {
            alert("Failed to submit test");
            setView('TEST');
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate('/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.1rem' }}>{t.oral.title}: {bookName}</h1>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subject} • {mode === 'test' ? t.oral.testMode : t.oral.practiceMode}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="dashboard-container" style={{ maxWidth: '800px' }}>
                <AnimatePresence mode="wait">
                    {view === 'SETUP' && (
                        <motion.div
                            key="setup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="quiz-card"
                        >
                            <h2 style={{ marginBottom: '24px' }}>{t.oral.setup}</h2>

                            <div style={{ marginBottom: '32px' }}>
                                <p style={{ fontWeight: 600, marginBottom: '12px' }}>{t.oral.chooseMode}:</p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => setMode('practice')}
                                        className={`quiz-option-btn ${mode === 'practice' ? 'active' : ''}`}
                                        style={{ flex: 1 }}
                                    >
                                        <div className="label">{t.oral.practice}</div>
                                        <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>{t.oral.practiceDesc}</p>
                                    </button>
                                    <button
                                        onClick={() => setMode('test')}
                                        className={`quiz-option-btn ${mode === 'test' ? 'active' : ''}`}
                                        style={{ flex: 1 }}
                                    >
                                        <div className="label">{t.oral.officialTest}</div>
                                        <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>{t.oral.officialTestDesc}</p>
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '40px' }}>
                                <p style={{ fontWeight: 600, marginBottom: '12px' }}>{t.oral.qCount}:</p>
                                <div className="quiz-options-grid">
                                    {[3, 5, 10].map(count => (
                                        <button
                                            key={count}
                                            onClick={() => setQCount(count)}
                                            className={`quiz-option-btn ${qCount === count ? 'active' : ''}`}
                                        >
                                            <span className="count">{count}</span>
                                            <span className="label">Qns</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button className="primary-btn" onClick={initializeTest} style={{ width: '100%', height: '56px' }}>
                                {t.oral.start}
                            </button>
                        </motion.div>
                    )}

                    {view === 'LOADING' && (
                        <ToolProcessingAnimation key="loading" title={t.oral.preparing} status={t.oral.preparingDesc} />
                    )}

                    {view === 'SUBMITTING' && (
                        <ToolProcessingAnimation key="submitting" title={t.oral.finishing} status={t.oral.finishingDesc} />
                    )}

                    {view === 'TEST' && (
                        <motion.div
                            key="test"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="oral-test-screen"
                        >
                            <div className="quiz-game-header">
                                <div className="progress-pill">{t.oral.question} {currentIndex + 1} {t.oral.of} {questions.length}</div>
                                <div className="timer-pill">
                                    <Clock size={16} /> {formatTime(recordTime)} / {formatTime(MAX_DURATION)}
                                </div>
                            </div>

                            <div className="quiz-card" style={{ marginBottom: '24px', padding: '48px' }}>
                                <h2 style={{ fontSize: '1.6rem', lineHeight: '1.4', marginBottom: '32px' }}>
                                    {questions[currentIndex]?.question}
                                </h2>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                                    <AnimatePresence mode="wait">
                                        {!audioBlob ? (
                                            <motion.button
                                                key="rec-btn"
                                                initial={{ scale: 0.9 }}
                                                animate={{ scale: isRecording ? [1, 1.1, 1] : 1 }}
                                                transition={{ repeat: isRecording ? Infinity : 0, duration: 1 }}
                                                onClick={isRecording ? stopRecording : startRecording}
                                                style={{
                                                    width: '80px', height: '80px', borderRadius: '50%',
                                                    background: isRecording ? '#ef4444' : 'var(--primary)',
                                                    color: 'white', border: 'none', display: 'flex',
                                                    alignItems: 'center', justify_center: 'center', cursor: 'pointer',
                                                    boxShadow: '0 8px 16px rgba(79, 70, 229, 0.2)'
                                                }}
                                            >
                                                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                                    {isRecording ? <Square size={32} /> : <Mic size={32} />}
                                                </div>
                                            </motion.button>
                                        ) : (
                                            <motion.div
                                                key="audio-player"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                style={{ width: '100%', textAlign: 'center' }}
                                            >
                                                <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '16px', marginBottom: '16px' }}>
                                                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                                                        Recorded Answer ({formatTime(recordTime)})
                                                    </p>
                                                    <audio src={audioUrl} controls style={{ width: '100%', height: '40px' }} />
                                                </div>

                                                {mode === 'practice' && (
                                                    <button
                                                        onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto' }}
                                                    >
                                                        <RotateCcw size={16} /> Re-record
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {isRecording && (
                                        <div style={{ display: 'flex', gap: '4px', height: '20px', alignItems: 'center' }}>
                                            {[...Array(12)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ height: [10, Math.random() * 20 + 5, 10] }}
                                                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                                                    style={{ width: '3px', background: '#ef4444', borderRadius: '2px' }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {mode === 'practice' && audioBlob && (
                                <div style={{ marginBottom: '24px' }}>
                                    {!showSample ? (
                                        <button
                                            className="secondary-btn"
                                            style={{ width: '100%', gap: '8px' }}
                                            onClick={() => setShowSample(true)}
                                        >
                                            <Brain size={18} /> Reveal Textbook Answer
                                        </button>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            style={{ background: '#ecfdba', border: '1px solid #d9f99d', padding: '20px', borderRadius: '18px' }}
                                        >
                                            <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#3f6212', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Textbook Explanation
                                            </p>
                                            <p style={{ fontSize: '1rem', color: '#1a2e05', lineHeight: '1.5' }}>
                                                {questions[currentIndex]?.sample_answer}
                                            </p>
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={handleNext}
                                    disabled={!audioBlob || isUploading || isRecording}
                                    className="primary-btn"
                                    style={{ gap: '8px', padding: '12px 32px' }}
                                >
                                    {currentIndex === questions.length - 1 ? t.oral.finishTest : t.oral.nextQuestion}
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'SUMMARY' && (
                        <motion.div
                            key="summary"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="quiz-card"
                            style={{ textAlign: 'center' }}
                        >
                            <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <CheckCircle2 size={40} color="#166534" />
                            </div>
                            <h2>{t.oral.testSubmitted}</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                                {t.oral.submittedDesc}<br />
                                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>{t.oral.aiProcessing}</span>
                            </p>

                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '32px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span>{t.oral.qAttempted}:</span>
                                    <span style={{ fontWeight: 700 }}>{questions.length} / {questions.length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{t.oral.status}:</span>
                                    <span style={{ color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={16} /> {t.oral.awaitingReview}
                                    </span>
                                </div>
                            </div>

                            <button className="primary-btn" onClick={() => navigate('/student/dashboard')} style={{ width: '100%' }}>
                                {t.dashboard.backToDashboard}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default OralTestTool;
