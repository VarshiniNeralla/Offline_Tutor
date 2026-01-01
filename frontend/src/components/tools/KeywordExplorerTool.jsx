import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search,
    BookOpen,
    Filter,
    ChevronLeft,
    Brain,
    Edit3,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Save,
    Trash2,
    Star,
    ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../assets/styles/student-dashboard.css';

const KeywordExplorerTool = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // context passed from Dashboard
    const { subject, bookId, bookName, class: className, role = 'student' } = location.state || {};

    // State
    const [viewMode, setViewMode] = useState('AZ'); // 'AZ' or 'SECTIONS'
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [keywordsData, setKeywordsData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState(null);

    // Teacher Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    const fetchedRef = React.useRef(false);

    // Initial Fetch
    useEffect(() => {
        if (!bookId) {
            navigate('/student/dashboard');
            return;
        }
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        fetchKeywords();
    }, [bookId]);

    const fetchKeywords = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(0);

        const navInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + Math.floor(Math.random() * 5) + 1, 90));
        }, 300);

        try {
            const cacheKey = `keyword_history_${bookId}_v1`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.data && parsed.data.length > 0) {
                    setKeywordsData(parsed.data);
                    clearInterval(navInterval);
                    setProgress(100);
                    setIsLoading(false);
                    return;
                }
            }

            // Fetch from Backend
            const res = await fetch('http://localhost:8000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: "Generative Keyword Extraction",
                    subjects: [subject],
                    book_ids: [bookId],
                    language: 'english',
                    mode: 'keywords'
                })
            });

            if (!res.ok) throw new Error("Failed to contact AI.");
            const data = await res.json();

            let extracted = [];
            try {
                // Check if response is JSON-like
                if (data.response && data.response.trim().startsWith('{')) {
                    const parsedJson = JSON.parse(data.response);
                    if (parsedJson.keywords) {
                        extracted = parsedJson.keywords;
                    }
                } else {
                    console.warn("AI returned non-JSON response:", data.response);
                    throw new Error("AI extraction failed. Please try again.");
                }
            } catch (e) {
                console.error("JSON Parse fail", e);
                // If it's the ❌ error message, we already catch it above
                throw new Error("AI is currently busy. Please try again in a moment.");
            }

            if (extracted.length === 0) {
                throw new Error("No keywords found in this section. Try another textbook.");
            }

            setKeywordsData(extracted);
            // Cache it immediately as "AI" version
            localStorage.setItem(cacheKey, JSON.stringify({
                version: 1,
                type: 'ai',
                timestamp: Date.now(),
                is_active: true,
                data: extracted
            }));

        } catch (err) {
            console.error(err);
            setError("Could not load keywords. Please try again.");
        } finally {
            clearInterval(navInterval);
            setProgress(100);
            setIsLoading(false);
        }
    };

    // Teacher Actions
    const handleDefinitionChange = (index, newDef) => {
        const newData = [...keywordsData];
        newData[index].definition = newDef;
        newData[index].editedByTeacher = true; // Mark as edited
        setKeywordsData(newData);
        setUnsavedChanges(true);
    };

    const handleToggleExam = (index) => {
        const newData = [...keywordsData];
        newData[index].isExamImportant = !newData[index].isExamImportant;
        // If made important, upgrade level visually
        if (newData[index].isExamImportant) {
            newData[index].level = 'Important';
        }
        setKeywordsData(newData);
        setUnsavedChanges(true);
    };

    const handleDelete = (index) => {
        if (window.confirm("Remove this keyword?")) {
            const newData = keywordsData.filter((_, i) => i !== index);
            setKeywordsData(newData);
            setUnsavedChanges(true);
        }
    };

    const handleSave = () => {
        const cacheKey = `keyword_history_${bookId}_v1`;
        localStorage.setItem(cacheKey, JSON.stringify({
            version: Date.now(), // simple versioning
            type: 'teacher',
            timestamp: Date.now(),
            is_active: true,
            data: keywordsData
        }));
        setUnsavedChanges(false);
        setIsEditing(false);
        alert("Changes saved successfully!");
    };

    return (
        <div className="dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Header */}
            <header className="dashboard-header">
                <div className="dashboard-header-inner" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate(role === 'teacher' ? '/teacher' : '/student/dashboard')} className="back-icon-btn">
                            <ChevronLeft size={22} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>Keyword Explorer: {bookName}</h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {role === 'teacher' ? 'Edit and manage vocabulary' : 'Unlock academic vocabulary'}
                            </p>
                        </div>
                    </div>

                    {/* Teacher Controls */}
                    {role === 'teacher' && !isLoading && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {isEditing ? (
                                <>
                                    <button
                                        className="secondary-btn"
                                        onClick={() => { setIsEditing(false); fetchKeywords(); }} // Cancel reverts
                                        style={{ padding: '8px 16px', borderRadius: '8px' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="primary-btn"
                                        onClick={handleSave}
                                        disabled={!unsavedChanges}
                                        style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}
                                    >
                                        <Save size={18} /> Save Changes
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="secondary-btn"
                                    onClick={() => setIsEditing(true)}
                                    style={{ padding: '8px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}
                                >
                                    <Edit3 size={18} /> Edit Keywords
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="dashboard-container" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>

                {isLoading ? (
                    <LoadingView progress={progress} />
                ) : error ? (
                    <ErrorView message={error} onRetry={fetchKeywords} />
                ) : (
                    <KeywordContent
                        data={keywordsData}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        isEditing={isEditing}
                        onDefChange={handleDefinitionChange}
                        onToggleExam={handleToggleExam}
                        onDelete={handleDelete}
                    />
                )}
            </main>
        </div>
    );
};

// Sub-components
const LoadingView = ({ progress }) => (
    <div style={{ textAlign: 'center', padding: '60px' }}>
        <div className="spinner-large" style={{ margin: '0 auto 24px' }}>
            <Brain size={40} className="zap-spin" style={{ color: 'var(--primary)' }} />
        </div>
        <h3>Mining Textbooks...</h3>
        <p style={{ marginBottom: '20px' }}>extracting key concepts and definitions</p>
        <div className="progress-container-v2" style={{ margin: '0 auto', maxWidth: '300px', background: '#e2e8f0', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
            <div
                className="progress-fill-v2"
                style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }}
            />
        </div>
        <p style={{ marginTop: '10px', fontWeight: 600, color: 'var(--primary)' }}>{progress}%</p>
    </div>
);

const ErrorView = ({ message, onRetry }) => (
    <div style={{ textAlign: 'center', padding: '60px', color: '#ef4444' }}>
        <AlertCircle size={48} style={{ marginBottom: '16px' }} />
        <h3>Extraction Failed</h3>
        <p>{message}</p>
        <button className="primary-btn" onClick={onRetry} style={{ marginTop: '20px' }}>Try Again</button>
    </div>
);

const KeywordContent = ({ data, viewMode, setViewMode, searchQuery, setSearchQuery, isEditing, onDefChange, onToggleExam, onDelete }) => {
    // Filter Logic
    const filtered = data.filter(k =>
        k.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.definition.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Grouping Logic for Sections View
    const grouped = {};
    if (viewMode === 'SECTIONS') {
        filtered.forEach((k, idx) => {
            const sections = k.sections || ['General'];
            sections.forEach(sec => {
                if (!grouped[sec]) grouped[sec] = [];
                grouped[sec].push({ ...k, originalIndex: data.indexOf(k) }); // Keep track of original index for updates
            });
        });
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search keywords..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 12px 12px 42px', borderRadius: '12px',
                            border: '1px solid var(--border)', fontSize: '1rem'
                        }}
                    />
                </div>

                <div className="view-toggle" style={{ display: 'flex', background: 'white', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setViewMode('AZ')}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
                            background: viewMode === 'AZ' ? 'var(--primary)' : 'transparent',
                            color: viewMode === 'AZ' ? 'white' : 'var(--text-muted)'
                        }}
                    >
                        A-Z
                    </button>
                    <button
                        onClick={() => setViewMode('SECTIONS')}
                        style={{
                            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
                            background: viewMode === 'SECTIONS' ? 'var(--primary)' : 'transparent',
                            color: viewMode === 'SECTIONS' ? 'white' : 'var(--text-muted)'
                        }}
                    >
                        By Section
                    </button>
                </div>
            </div>

            {/* Keyword Grid */}
            {viewMode === 'AZ' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {filtered.map((item, idx) => (
                        <KeywordCard
                            key={idx}
                            item={item}
                            isEditing={isEditing}
                            index={data.indexOf(item)} // Pass original index
                            onDefChange={onDefChange}
                            onToggleExam={onToggleExam}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {Object.keys(grouped).map(section => (
                        <div key={section}>
                            <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BookOpen size={20} color="var(--primary)" /> {section}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                {grouped[section].map((item, idx) => (
                                    <KeywordCard
                                        key={idx}
                                        item={item}
                                        isEditing={isEditing}
                                        index={item.originalIndex}
                                        onDefChange={onDefChange}
                                        onToggleExam={onToggleExam}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

const KeywordCard = ({ item, isEditing, index, onDefChange, onToggleExam, onDelete }) => {
    // Badges
    const levelColors = {
        'Basic': { bg: '#dcfce7', text: '#166534' },
        'Important': { bg: '#ffedd5', text: '#9a3412' },
        'Advanced': { bg: '#f3e8ff', text: '#6b21a8' }
    };
    const style = levelColors[item.level] || levelColors['Basic'];

    return (
        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: item.isExamImportant ? '2px solid #fbbf24' : '1px solid var(--border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative' }}>

            {/* Exam Star (Teacher Only Toggle available) */}
            {item.isExamImportant && (
                <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#fbbf24', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <Star size={12} fill="black" /> Exam Focus
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)' }}>{item.term}</h3>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {item.editedByTeacher && !isEditing && (
                        <span title="Verified by Teacher" style={{ color: '#059669' }}>
                            <ShieldCheck size={18} />
                        </span>
                    )}
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', background: style.bg, color: style.text }}>
                        {item.level}
                    </span>
                </div>
            </div>

            {isEditing ? (
                <div style={{ marginBottom: '16px' }}>
                    <textarea
                        value={item.definition}
                        onChange={(e) => onDefChange(index, e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', minHeight: '80px', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <button
                            onClick={() => onToggleExam(index)}
                            style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fbbf24', background: item.isExamImportant ? '#fbbf24' : 'white', cursor: 'pointer' }}
                        >
                            {item.isExamImportant ? 'Unmark Exam Focus' : 'Mark Exam Focus'}
                        </button>
                        <button
                            onClick={() => onDelete(index)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ) : (
                <p style={{ color: '#475569', lineHeight: '1.5', fontSize: '0.95rem', marginBottom: '16px' }}>
                    {item.definition}
                </p>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {item.sections && item.sections.map(s => (
                    <span key={s} style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                        {s}
                    </span>
                ))}
                {item.definition_source === 'textbook' && (
                    <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>
                        Textbook Def
                    </span>
                )}
            </div>
        </div>
    );
};

export default KeywordExplorerTool;
