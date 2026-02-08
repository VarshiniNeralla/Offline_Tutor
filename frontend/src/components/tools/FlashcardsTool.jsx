import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../../context/LanguageContext";
import {
    ChevronLeft,
    Sparkles,
    RefreshCw,
    HelpCircle,
    CheckCircle2,
    Clock,
    Layers,
    ArrowRight,
    Trophy,
    RotateCcw,
    AlertCircle
} from "lucide-react";
import { translations } from "../../translations";
import "../../assets/styles/student-dashboard.css";

const FlashcardsTool = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { language } = useLanguage();
    const t = translations[language];
    const { bookId, bookName, subject, className } = location.state || {};

    const [view, setView] = useState('SETUP'); // SETUP, LOADING, STUDY, SUMMARY
    const [cardCount, setCardCount] = useState(10);
    const [flashcards, setFlashcards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showHint, setShowHint] = useState(false);

    const [knownCards, setKnownCards] = useState(new Set());
    const [reviewCards, setReviewCards] = useState(new Set());
    const [score, setScore] = useState(0);

    const [elapsedTime, setElapsedTime] = useState(0);
    const [showReward, setShowReward] = useState(false);
    const [rewardText, setRewardText] = useState("");
    const [error, setError] = useState(null);

    // Caching Strategy
    const getCacheKey = (count) => `flashcards_v1_${bookId}_${count}`;

    useEffect(() => {
        if (!bookId) navigate('/student/dashboard');
    }, [bookId, navigate]);

    const startGeneration = async (forced = false) => {
        const cacheKey = getCacheKey(cardCount);
        const cached = localStorage.getItem(cacheKey);

        // ONLY load cache if it's NOT a forced generation
        if (cached && !forced) {
            console.log("Loading cached flashcards...");
            const data = JSON.parse(cached);
            setFlashcards(data);
            startStudySession(data);
            return;
        }

        // If forced, we skip the cache and call the AI
        console.log("Generating NEW flashcards (forced:", forced, ")");
        setView('LOADING');
        setError(null);

        try {
            // Get language name for the prompt
            const languageNames = {
                'en': 'English',
                'te': 'Telugu',
                'hi': 'Hindi',
                'ta': 'Tamil',
                'kn': 'Kannada'
            };
            const languageName = languageNames[language] || 'English';

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Generate exactly ${cardCount} flashcards in ${languageName} language for the book "${bookName}". All questions and answers must be in ${languageName}. Return exactly ${cardCount} flashcards, no more, no less.`,
                    subjects: [subject],
                    book_ids: [bookId],
                    mode: 'flashcards',
                    language: language
                })
            });

            if (!response.ok) throw new Error("Generation failed");

            const data = await response.json();
            // Data is expected to be an array of flashcards directly in 'response' or similar
            // Based on my backend implementation, it's [flashcards, [], "flashcards"]
            // But standard API returns {response: ...}
            // Actually, the backend get_response returns (response, sources, mode)
            // My backend implementation for flashcards directly returns the list as 'response'

            let cards = [];
            if (data.mode === 'error' || !data.response) {
                throw new Error("The AI was unable to extract facts from this chapter. Try a different chapter or card count.");
            }

            try {
                // Attempt direct parse first
                cards = typeof data.response === 'string' ? JSON.parse(data.response) : data.response;
            } catch (e) {
                console.warn("Direct JSON parse failed, attempting extraction...", e);
                const responseStr = data.response;
                // If it fails, try to extract the JSON array [ ... ]
                const match = String(responseStr).match(/\[[\s\S]*\]/);
                if (match) {
                    try {
                        cards = JSON.parse(match[0]);
                    } catch (e2) {
                        console.error("Extraction parse failed", e2);
                        throw new Error("AI generated invalid JSON. Please try again.");
                    }
                } else {
                    throw new Error("No valid data found in AI response.");
                }
            }

            if (!Array.isArray(cards) || cards.length === 0) {
                console.warn("No cards returned from AI for input:", bookName);
                throw new Error("No flashcards could be generated for this content.");
            }

            console.log(`✅ Successfully generated ${cards.length} flashcards.`);
            if (cards.length < cardCount) {
                console.warn(`Generated ${cards.length} cards, which is fewer than requested ${cardCount}.`);
            }

            localStorage.setItem(cacheKey, JSON.stringify(cards));
            setFlashcards(cards);
            startStudySession(cards);

        } catch (err) {
            console.error("Flashcard Gen Error:", err);
            setError(err.message || "Failed to generate flashcards. Please try again.");
            setView('SETUP');
        }
    };

    const startStudySession = (cards) => {
        setFlashcards(cards); // Ensure we use these specific cards
        setKnownCards(new Set());
        setReviewCards(new Set());
        setScore(0);
        setElapsedTime(0);
        setCurrentIndex(0);
        setIsFlipped(false);
        setShowHint(false);
        setView('STUDY');
    };

    // Timer Logic
    useEffect(() => {
        let interval;
        if (view === 'STUDY') {
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [view]);

    const handleFlip = () => setIsFlipped(!isFlipped);

    const triggerReward = (text) => {
        if (showReward) return;
        setRewardText(text);
        setShowReward(true);
        setTimeout(() => setShowReward(false), 1000);
    };

    const markKnown = () => {
        console.log("Button Clicked: Known", currentIndex);
        const newKnown = new Set(knownCards).add(currentIndex);
        const newScore = score + 10;
        setKnownCards(newKnown);
        setScore(newScore);
        triggerReward("+10 Confidence Boost! ✨");
        nextCard(newKnown, reviewCards, newScore);
    };

    const markReview = () => {
        console.log("Button Clicked: Review", currentIndex);
        const newReview = new Set(reviewCards).add(currentIndex);
        setReviewCards(newReview);
        nextCard(knownCards, newReview, score);
    };

    const nextCard = (k = knownCards, r = reviewCards, s = score) => {
        if (currentIndex < flashcards.length - 1) {
            setIsFlipped(false);
            setShowHint(false);
            setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
            }, 150);
        } else {
            console.log("Session Complete. Final Stats:", { known: k.size, review: r.size, score: s });
            handleComplete(k, r, s);
        }
    };

    const handleComplete = async (k, r, s) => {
        setView('SUMMARY');
        // Analytics Hook
        try {
            const studentName = localStorage.getItem("studentName") || "Unknown Student";
            const studentClass = localStorage.getItem("studentClass") || "Unknown Class";

            await fetch('/api/progress/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: "flashcards",
                    student_name: studentName,
                    student_class: studentClass,
                    subject: subject || "General",
                    book_id: bookId,
                    book_name: bookName,
                    score: s,
                    total_questions: flashcards.length,
                    metadata: {
                        review_count: r.size,
                        known_count: k.size,
                        duration_seconds: elapsedTime,
                        flashcards: flashcards, // Save full content
                        knownIndices: Array.from(k) // Save which ones were mastered
                    }
                })
            });
        } catch (e) {
            console.error("Failed to save progress:", e);
        }
    };

    const retryReviewDeck = () => {
        const filteredCards = flashcards.filter((_, idx) => reviewCards.has(idx));
        if (filteredCards.length > 0) {
            startStudySession(filteredCards);
        }
    };

    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (view !== 'STUDY') return;
            if (e.code === 'Space') {
                e.preventDefault();
                handleFlip();
            } else if (e.code === 'ArrowRight' && isFlipped) {
                markKnown();
            } else if (e.code === 'ArrowLeft' && isFlipped) {
                markReview();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, isFlipped, currentIndex]);

    const styles = `
        .flashcard-container {
            perspective: 1000px;
            width: 100%;
            height: 320px;
            cursor: pointer;
            margin-bottom: 32px;
        }

        .flashcard-inner {
            position: relative;
            width: 100%;
            height: 100%;
            text-align: center;
            transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            transform-style: preserve-3d;
        }

        .flashcard-inner.flipped {
            transform: rotateY(180deg);
        }

        .flashcard-front, .flashcard-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 40px;
            border-radius: 32px;
            background: white;
            box-shadow: 0 20px 40px rgba(0,0,0,0.05);
            border: 2px solid #e2e8f0;
        }

        .flashcard-back {
            transform: rotateY(180deg);
            background: #f8fafc;
            border-color: var(--primary-light);
        }

        .importance-tag {
            position: absolute;
            top: 24px;
            right: 24px;
            padding: 4px 12px;
            border-radius: 100px;
            font-size: 0.7rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .importance-high { background: #fef2f2; color: #ef4444; }
        .importance-medium { background: #fffbeb; color: #f59e0b; }
        .importance-low { background: #f0fdf4; color: #10b981; }

        .hint-box {
            margin-top: 24px;
            padding: 12px 20px;
            background: #eff6ff;
            color: #1d4ed8;
            border-radius: 16px;
            font-size: 0.9rem;
            font-weight: 600;
        }
    `;

    return (
        <div className="dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            <style>{styles}</style>

            <header className="dashboard-header">
                <div className="dashboard-header-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate('/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>{t.tools.items.flashcards}</h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{bookName} • {subject}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="dashboard-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
                <AnimatePresence mode="wait">
                    {view === 'SETUP' && (
                        <motion.div
                            key="setup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card"
                            style={{ padding: '40px', textAlign: 'center' }}
                        >
                            <div style={{
                                width: '64px', height: '64px', background: 'var(--primary-light)',
                                borderRadius: '20px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary)'
                            }}>
                                <Layers size={32} />
                            </div>
                            <h2 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>{t.flash.prepareHeader}</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                                {t.flash.prepareSubheader}
                            </p>

                            <div style={{ marginBottom: '40px' }}>
                                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '16px' }}>
                                    {t.flash.howMany}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                    {[5, 10, 15].map(count => (
                                        <button
                                            key={count}
                                            onClick={() => setCardCount(count)}
                                            style={{
                                                padding: '12px 24px',
                                                borderRadius: '16px',
                                                border: '2px solid',
                                                borderColor: cardCount === count ? 'var(--primary)' : '#e2e8f0',
                                                background: cardCount === count ? 'var(--primary-light)' : 'white',
                                                color: cardCount === count ? 'var(--primary)' : 'var(--text-muted)',
                                                fontWeight: 800,
                                                transition: 'all 0.2s',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {count} {t.flash.cards}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div style={{
                                    padding: '12px', background: '#fef2f2', color: '#b91c1c',
                                    borderRadius: '12px', marginBottom: '24px', display: 'flex',
                                    alignItems: 'center', gap: '8px', justifyContent: 'center'
                                }}>
                                    <AlertCircle size={18} /> {error}
                                </div>
                            )}

                            <button
                                onClick={() => startGeneration(true)}
                                className="primary-btn"
                                style={{ width: '100%', padding: '18px', fontSize: '1rem' }}
                            >
                                {t.flash.generateNew} <Sparkles size={18} style={{ marginLeft: '8px' }} />
                            </button>

                            {localStorage.getItem(getCacheKey(cardCount)) && (
                                <button
                                    onClick={() => startStudySession(JSON.parse(localStorage.getItem(getCacheKey(cardCount))))}
                                    style={{
                                        width: '100%', padding: '12px', marginTop: '12px', background: 'transparent',
                                        border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <RotateCcw size={16} /> {t.flash.continue}
                                </button>
                            )}
                        </motion.div>
                    )}

                    {view === 'LOADING' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ textAlign: 'center', padding: '60px 0' }}
                        >
                            <div className="loader" style={{ margin: '0 auto 24px' }}></div>
                            <h3 style={{ fontSize: '1.4rem' }}>{t.flash.creatingDeck}</h3>
                            <p style={{ color: 'var(--text-muted)' }}>{t.flash.reading}</p>
                        </motion.div>
                    )}

                    {view === 'STUDY' && (
                        <motion.div
                            key="study"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="study-mode"
                        >
                            {/* PROGRESS TOPBAR */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ background: 'white', padding: '6px 12px', borderRadius: '100px', border: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {t.flash.card} {currentIndex + 1} {t.oral.of} {flashcards.length}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} /> {formatTime(elapsedTime * 1000)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                                        XP: {score}
                                    </div>
                                </div>
                            </div>

                            {/* REWARD OVERLAY */}
                            <AnimatePresence>
                                {showReward && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: -40 }}
                                        exit={{ opacity: 0, scale: 0.8, y: -80 }}
                                        style={{
                                            position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
                                            zIndex: 100, pointerEvents: 'none', background: '#f0fdf4',
                                            padding: '10px 20px', borderRadius: '100px', boxShadow: '0 10px 25px rgba(21,128,61,0.15)',
                                            color: '#15803d', fontWeight: 800, fontSize: '0.95rem', border: '1.5px solid #bcf0da',
                                            display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                    >
                                        <Sparkles size={18} color="#10b981" /> {rewardText}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* CARD */}
                            <div className="flashcard-container" onClick={handleFlip}>
                                <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                                    <div className="flashcard-front">
                                        {flashcards[currentIndex] && (
                                            <div className={`importance-tag importance-${flashcards[currentIndex].importance || 'medium'}`}>
                                                {flashcards[currentIndex].importance || 'Medium'}
                                            </div>
                                        )}
                                        <h2 style={{ fontSize: '1.7rem', color: '#1e293b', lineHeight: 1.4 }}>
                                            {flashcards[currentIndex]?.front || "Loading card..."}
                                        </h2>
                                        <p style={{ marginTop: '32px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                                            Click card or press Space to reveal answer
                                        </p>
                                    </div>

                                    <div className="flashcard-back">
                                        <h3 style={{ color: 'var(--primary)', marginBottom: '24px', fontSize: '1rem', fontWeight: 800 }}>THE ANSWER</h3>
                                        <p style={{ fontSize: '1.4rem', color: '#1e293b', lineHeight: 1.5, fontWeight: 600 }}>
                                            {flashcards[currentIndex]?.back || "No answer provided"}
                                        </p>

                                        {flashcards[currentIndex]?.hint && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }}
                                                className="hint-box"
                                                style={{ opacity: showHint ? 1 : 0.6 }}
                                            >
                                                {showHint ? flashcards[currentIndex].hint : t.flash.showHint}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* CONTROLS */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <button
                                    className="secondary-btn"
                                    disabled={!isFlipped}
                                    onClick={markReview}
                                    style={{
                                        background: isFlipped ? '#fffbeb' : '#f8fafc',
                                        color: isFlipped ? '#b45309' : '#94a3b8',
                                        border: '1px solid',
                                        borderColor: isFlipped ? '#fde68a' : '#e2e8f0',
                                        gap: '10px', height: '56px',
                                        opacity: isFlipped ? 1 : 0.6
                                    }}
                                >
                                    <RefreshCw size={20} /> {t.flash.reviewAgain}
                                </button>
                                <button
                                    className="primary-btn"
                                    disabled={!isFlipped}
                                    onClick={markKnown}
                                    style={{
                                        background: isFlipped ? '#f0fdf4' : '#f8fafc',
                                        color: isFlipped ? '#15803d' : '#94a3b8',
                                        border: '1px solid',
                                        borderColor: isFlipped ? '#bcf0da' : '#e2e8f0',
                                        gap: '10px', height: '56px',
                                        opacity: isFlipped ? 1 : 0.6
                                    }}
                                >
                                    <CheckCircle2 size={20} /> {t.flash.iKnowThis}
                                </button>
                            </div>

                            <button
                                className="secondary-btn"
                                onClick={nextCard}
                                style={{ width: '100%', marginTop: '16px', background: 'white', border: '1px solid #e2e8f0', color: 'var(--text-muted)', gap: '8px' }}
                            >
                                {t.flash.skip} <ArrowRight size={18} />
                            </button>

                            {/* <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                                Tips: Use Arrow Keys ⬅️ ➡️ to mark cards once flipped.
                            </p> */}
                        </motion.div>
                    )}

                    {view === 'SUMMARY' && (
                        <motion.div
                            key="summary"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card"
                            style={{ padding: '48px', textAlign: 'center' }}
                        >
                            <Trophy size={64} color="#f59e0b" style={{ margin: '0 auto 24px' }} />
                            <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{t.flash.complete}</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>{t.flash.summaryHeader}</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '48px' }}>
                                <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '24px', border: '1px solid #bcf0da' }}>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#166534' }}>{knownCards.size}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>{t.flash.known}</div>
                                </div>
                                <div style={{ padding: '20px', background: '#fffbeb', borderRadius: '24px', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#92400e' }}>{reviewCards.size}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>{t.flash.review}</div>
                                </div>
                                <div style={{ padding: '20px', background: '#eff6ff', borderRadius: '24px', border: '1px solid #dbeafe' }}>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e40af' }}>{formatTime(elapsedTime * 1000)}</div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>{t.flash.time}</div>
                                </div>
                            </div>

                            {/* REVIEW CHECKLISTS */}
                            <div style={{ display: 'grid', gridTemplateColumns: reviewCards.size > 0 && knownCards.size > 0 ? '1fr 1fr' : '1fr', gap: '24px', marginBottom: '40px' }}>
                                {reviewCards.size > 0 && (
                                    <div style={{ textAlign: 'left' }}>
                                        <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                                            <RefreshCw size={18} /> Focus List (Review)
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {Array.from(reviewCards).map(idx => (
                                                <div key={idx} style={{ padding: '14px', background: '#fffbeb', borderRadius: '16px', border: '1px solid #fde68a' }}>
                                                    <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: '#92400e' }}>
                                                        {flashcards[idx]?.front}
                                                    </p>
                                                    <p style={{ fontSize: '0.8rem', color: '#b45309' }}>
                                                        {flashcards[idx]?.back}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {knownCards.size > 0 && (
                                    <div style={{ textAlign: 'left' }}>
                                        <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                                            <CheckCircle2 size={18} /> Mastered List
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {Array.from(knownCards).map(idx => (
                                                <div key={idx} style={{ padding: '14px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bcf0da' }}>
                                                    <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px', color: '#166534' }}>
                                                        {flashcards[idx]?.front}
                                                    </p>
                                                    <p style={{ fontSize: '0.8rem', color: '#15803d' }}>
                                                        {flashcards[idx]?.back}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {reviewCards.size > 0 && (
                                    <button className="primary-btn" style={{ width: '100%', background: 'var(--primary)', color: 'white' }} onClick={retryReviewDeck}>
                                        Retry Review Cards Only <RotateCcw size={18} style={{ marginLeft: '8px' }} />
                                    </button>
                                )}
                                <button className="secondary-btn" style={{ width: '100%', border: '2px solid var(--primary)', color: 'var(--primary)' }} onClick={() => startStudySession(flashcards)}>
                                    Restart Full Deck
                                </button>
                                <button className="secondary-btn" style={{ width: '100%', gap: '8px', border: 'none', background: 'transparent' }} onClick={() => navigate('/student/dashboard')}>
                                    Back to Dashboard
                                </button>

                                <button
                                    onClick={() => startGeneration(true)}
                                    style={{
                                        padding: '12px', background: 'transparent', border: 'none',
                                        color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                                    }}
                                >
                                    Regenerate AI Cards
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default FlashcardsTool;
