import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { ArrowLeft, Printer, RefreshCw, BookOpen, AlertCircle } from 'lucide-react';
import { translations } from '../../translations';
import "../../index.css";
import ToolProcessingAnimation from './ToolProcessingAnimation';

const OnePageRevisionTool = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const t = translations[language];
    const { bookId, bookName, subject } = location.state || {};

    const [revisionData, setRevisionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [regenerating, setRegenerating] = useState(false);

    // Hardcoded CSS for strict template adherence without Tailwind
    const styles = `
        .rev-container {
            max-width: 210mm;
            margin: 40px auto;
            background: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            min-height: 297mm;
            padding: 10mm;
            font-family: "Times New Roman", serif;
            color: #000;
            box-sizing: border-box;
        }
        @media print {
            .rev-container {
                margin: 0;
                box-shadow: none;
                width: 100%;
                max-width: none;
                padding: 0;
            }
            .no-print { display: none !important; }
            body { background: white; }
        }
        .rev-header {
            font-size: 24px;
            font-weight: bold;
            border: 2px solid #000;
            padding: 10px;
            margin-bottom: 0;
            background: #f0f0f0;
        }
        .rev-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-left: 2px solid #000;
            border-right: 2px solid #000;
            border-bottom: 2px solid #000;
        }
        .rev-full-row {
            grid-column: 1 / -1;
            border-bottom: 2px solid #000;
            padding: 8px;
        }
        .rev-col {
            padding: 8px;
            border-right: 2px solid #000;
        }
        .rev-col:last-child {
            border-right: none;
        }
        .rev-border-bottom {
            border-bottom: 2px solid #000;
        }
        .rev-label {
            font-weight: bold;
            margin-bottom: 5px;
            display: block;
        }
        .rev-list {
            padding-left: 20px;
            margin: 5px 0;
            line-height: 1.6;
        }
        .rev-list li {
            margin-bottom: 6px;
        }
        /* Keyword Table */
        .rev-kw-row {
            display: flex;
            border-bottom: 1px solid #000;
        }
        .rev-kw-row:last-child {
            border-bottom: none;
        }
        .rev-kw-cell {
            padding: 4px 8px;
            width: 50%;
            border-right: 1px solid #000;
            font-size: 14px;
        }
        .rev-kw-cell:last-child {
            border-right: none;
        }
        .rev-quote {
            text-align: center;
            font-style: italic;
            font-size: 12px;
            margin-top: 20px;
            color: #444;
        }
        
        /* THEME MATCHING TOOLBAR */
        .rev-toolbar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid #e2e8f0;
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        
        .rev-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            font-family: "Outfit", sans-serif;
        }
        
        /* Primary Theme Button (Indigo Gradient) */
        .rev-btn-primary { 
            background: linear-gradient(135deg, #4f46e5, #7c3aed); 
            color: white; 
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }
        .rev-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
        }
        
        /* Secondary Button (White/Outline) */
        .rev-btn-secondary { 
            background: white; 
            border: 1px solid #e2e8f0; 
            color: #64748b; 
        }
        .rev-btn-secondary:hover {
            border-color: #4f46e5;
            color: #4f46e5;
            background: #f8fafc;
        }

        /* Back Button (Icon only style like MindMap) */
        .rev-back-btn {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            background: white;
            color: #64748b;
            cursor: pointer;
            transition: all 0.2s;
        }
        .rev-back-btn:hover {
            background: #f1f5f9;
            color: #0f172a;
        }

        .rev-btn:disabled { opacity: 0.6; cursor: wait; }

        /* MOBILE RESPONSIVENESS */
        @media (max-width: 768px) {
            .rev-container {
                width: 100%;
                max-width: 100%;
                min-height: auto;
                padding: 16px;
                margin: 0;
                box-shadow: none;
            }
            .rev-grid {
                grid-template-columns: 1fr !important;
                border: none !important;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .rev-full-row, .rev-col, .rev-header {
                border: 1px solid #e5e7eb !important;
                border-radius: 12px;
                padding: 16px !important;
                margin-bottom: 0;
                background: white;
            }
            .rev-header {
                background: #f0f0f0;
                margin-bottom: 16px;
            }
            .rev-border-bottom {
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 12px;
                margin-bottom: 12px;
            }
            .rev-toolbar {
                padding: 12px;
                flex-direction: row; /* Keep row but maybe smaller */
                gap: 8px;
            }
            .rev-btn span {
                display: none; /* Hide text on small screens, show icon */
            }
            .rev-btn {
                padding: 10px;
            }
            body {
                background: white;
            }
        }
    `;

    const [statusMessage, setStatusMessage] = useState("Initializing...");

    const abortControllerRef = useRef(null);

    const isFetchingRef = useRef(false);

    useEffect(() => {
        if (!bookId) return;

        const cacheKey = `revision_v3_template_${bookId}_${language}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            try {
                console.log("Found cached revision data");
                setRevisionData(JSON.parse(cached));
                setLoading(false);
            } catch (e) {
                console.error("Cache parse error", e);
                // Only fetch if not already fetching
                if (!isFetchingRef.current) {
                    fetchRevision();
                }
            }
        } else {
            if (!isFetchingRef.current) {
                fetchRevision();
            }
        }

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            // We don't reset isFetchingRef here because we might want to keep the lock until component unmounts fully or specific logic
            isFetchingRef.current = false;
        };
    }, [bookId, language]);

    const fetchRevision = async (forceRegenerate = false) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        isFetchingRef.current = true;

        // Create new controller for this request
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);
        setStatusMessage("Connecting to AI Tutor...");

        const timeoutId = setTimeout(() => {
            console.error("Frontend timeout reached (300s)");
            controller.abort();
        }, 300000); // 5 minutes timeout

        try {
            setStatusMessage("Generating content (this takes 1-3 mins)...");
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Generate case study revision",
                    mode: "revision",
                    book_ids: [bookId],
                    subjects: [subject || "General"],
                    language: language
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            setStatusMessage("Processing response data...");
            const data = await response.json();

            if (data.status === "error" || (data.response && data.response.status === "error")) {
                throw new Error(data.response?.response || "Failed to generate.");
            } else {
                setStatusMessage("Rendering revision sheet...");

                // Parse response if needed
                let parsedData = data.response;
                if (typeof parsedData === 'string') {
                    try { parsedData = JSON.parse(parsedData); } catch (e) { }
                }

                setRevisionData(parsedData);
                try {
                    localStorage.setItem(`revision_v3_template_${bookId}_${language}`, JSON.stringify(parsedData));
                } catch (storeErr) {
                    console.warn("Could not cache response:", storeErr);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log("Request aborted");
                return;
            }
            console.error("Fetch error:", err);
            setError(`Network error: ${err.message}`);
        }
        finally {
            // Only update state if this is still the active request
            if (abortControllerRef.current === controller) {
                setLoading(false);
                setRegenerating(false);
                abortControllerRef.current = null;
            }
            // Always release the fetch lock
            isFetchingRef.current = false;
        }
    };

    const handlePrint = () => window.print();

    if (loading) return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(249, 250, 251, 0.95)', backdropFilter: 'blur(4px)'
        }}>
            <style>{styles}</style>
            <ToolProcessingAnimation title={t.revision.synthesizing || "Synthesizing Revision Sheet..."} status={statusMessage} />
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <style>{styles}</style>
            <p className="text-red-600 font-bold mb-4">{error}</p>
            <button onClick={() => navigate(-1)} className="rev-btn rev-btn-black">{t.dashboard.back}</button>
        </div>
    );

    if (!revisionData) return null;

    return (
        <div className="min-h-screen bg-gray-100 pb-12 text-black">
            <style>{styles}</style>

            {/* Header (No Print) */}
            <div className="rev-toolbar no-print">
                <button onClick={() => navigate(-1)} className="rev-back-btn">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex gap-4">
                    <button onClick={() => { setRegenerating(true); fetchRevision(true); }} disabled={regenerating} className="rev-btn rev-btn-secondary">
                        <RefreshCw size={16} className={regenerating ? "animate-spin" : ""} /> {t.revision.regenerate}
                    </button>
                    <button onClick={handlePrint} className="rev-btn rev-btn-primary">
                        <Printer size={16} /> {t.revision.print}
                    </button>
                </div>
            </div>

            {/* A4 Sheet - Strict Template */}
            <div className="rev-container">

                <h1 className="rev-header">{t.revision.caseStudy}: {revisionData.title || bookName}</h1>

                {/* Main Grid: Background vs Key Info */}
                <div className="rev-grid">
                    {/* Left Col - Background */}
                    <div className="rev-col">
                        <span className="rev-label">{t.revision.background}</span>
                        <ul className="rev-list" style={{ listStyleType: 'disc', marginTop: '8px' }}>
                            {revisionData.why?.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>

                    {/* Right Col - Key Info */}
                    <div className="rev-col">
                        <span className="rev-label">{t.revision.keyInfo}</span>
                        <ul className="rev-list" style={{ listStyleType: 'disc', marginTop: '8px' }}>
                            {revisionData.facts?.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                </div>

                {/* Impacts Section */}
                <div className="rev-grid" style={{ borderTop: 'none' }}>
                    <div className="rev-col">
                        <span className="rev-label">{t.revision.effects}</span>
                        <ul className="rev-list" style={{ listStyleType: 'disc', marginTop: '8px' }}>
                            {revisionData.impacts?.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>

                    {/* Keywords Table */}
                    <div className="rev-col" style={{ padding: 0 }}>
                        <div className="rev-kw-row" style={{ background: '#f0f0f0', fontWeight: 'bold', fontSize: '14px' }}>
                            <div className="rev-kw-cell" style={{ borderRight: '1px solid #000' }}>{t.revision.terms}:</div>
                            <div className="rev-kw-cell">{t.revision.meanings}:</div>
                        </div>
                        {/* Display keyword rows */}
                        {[...Array(5)].map((_, i) => {
                            const keyword = revisionData.keywords?.[i] || "";
                            const def = revisionData.definitions?.[i] || "";
                            return (
                                <div key={i} className="rev-kw-row">
                                    <div className="rev-kw-cell" style={{ fontWeight: '500' }}>{keyword}</div>
                                    <div className="rev-kw-cell" style={{ fontSize: '12px', lineHeight: '1.4' }}>{def}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Practice Questions */}
                <div className="rev-full-row" style={{ borderLeft: '2px solid #000', borderRight: '2px solid #000', borderBottom: '2px solid #000' }}>
                    <span className="rev-label">{t.revision.practiceQuestions}:</span>
                    {Array.isArray(revisionData.exam_question) ? (
                        <ul className="rev-list" style={{ listStyleType: 'decimal', marginTop: '8px', lineHeight: '1.6' }}>
                            {revisionData.exam_question.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                    ) : (
                        <p style={{ marginTop: '8px', lineHeight: '1.6' }}>{revisionData.exam_question}</p>
                    )}
                </div>

                {/* Quote Footer from Template */}
                <div className="rev-quote">
                    "The more you read, the more you know, the more you learn, the more places you will go" (Dr Seuss)
                </div>

            </div>
        </div>
    );
};

export default OnePageRevisionTool;
