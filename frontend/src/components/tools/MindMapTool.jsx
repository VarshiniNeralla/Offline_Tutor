import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import {
    ArrowLeft, RefreshCw, ZoomIn, ZoomOut,
    Maximize, Minimize, Share2, Download,
    AlertCircle, Network, Layers
} from 'lucide-react';
import { translations } from '../../translations';
import "../../assets/styles/mind-map.css";
import ToolProcessingAnimation from './ToolProcessingAnimation';

const MindMapTool = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const t = translations[language];
    const { bookId, bookName, subject } = location.state || {};

    // --- State ---
    const [mindMapData, setMindMapData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [regenerating, setRegenerating] = useState(false);

    // Viewport State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Node State
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [focusedSubtopic, setFocusedSubtopic] = useState(null);

    const svgRef = useRef(null);

    // --- color palette ---
    const COLORS = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A",
        "#98D8C8", "#F7DC6F", "#BB8FCE", "#F1948A"
    ];

    const getSubtopicColor = (index) => COLORS[index % COLORS.length];

    // --- Persistence ---
    const abortControllerRef = useRef(null);

    // --- Persistence ---
    useEffect(() => {
        if (!bookId) return;

        const cacheKey = `mindmap_v1_${bookId}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            try {
                setMindMapData(JSON.parse(cached));
                setLoading(false);
            } catch (e) {
                console.error("Cache corrupted", e);
                fetchMindMap();
            }
        } else {
            fetchMindMap();
        }

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [bookId]);

    const fetchMindMap = async (forceRegenerate = false) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Generate mind map",
                    mode: "mindmap",
                    book_ids: [bookId],
                    subjects: [subject || "General"],
                    language: language
                }),
                signal: controller.signal
            });

            const data = await response.json();

            if (data.status === "error") {
                setError(data.response || t.mindmap.failed);
            } else {
                setMindMapData(data.response);
                localStorage.setItem(`mindmap_v1_${bookId}`, JSON.stringify(data.response));
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            setError(t.quiz.errorHeader || "Network error. Please check backend.");
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
                setRegenerating(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleRegenerate = () => {
        if (window.confirm(t.mindmap.confirmRegenerate)) {
            localStorage.removeItem(`mindmap_pos_${bookId}`); // Clear saved positions
            setRegenerating(true);
            fetchMindMap(true);
        }
    };

    // --- Interaction ---
    // Use effect to add wheel listener as non-passive to allow preventDefault for zooming
    useEffect(() => {
        const canvas = svgRef.current?.parentElement;
        if (!canvas) return;

        const onWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setZoom(z => Math.max(0.1, Math.min(3, z - e.deltaY * 0.001)));
            }
        };

        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, []);

    // Manual Zoom
    const handleZoomIn = () => setZoom(z => Math.min(3, z + 0.2));
    const handleZoomOut = () => setZoom(z => Math.max(0.1, z - 0.2));


    const toggleCollapse = (nodeId) => {
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    // --- Node State & Layout ---
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [draggingNodeId, setDraggingNodeId] = useState(null);

    // Initial Layout Calculation - Improved for better spacing
    useEffect(() => {
        if (!mindMapData) return;

        const newNodes = [];
        const newLinks = [];

        // Settings - Larger canvas for better spacing
        const CENTER_X = 500;
        const CENTER_Y = 400;

        // Dynamic Layout Calculation
        const subtopics = mindMapData.subtopics || [];
        const subtopicCount = subtopics.length;

        // IMPROVED RADIAL LAYOUT - Single ring with generous spacing
        // Adjust radius based on number of subtopics for optimal spacing
        const BASE_RADIUS = subtopicCount <= 4 ? 300 : subtopicCount <= 6 ? 340 : 380;

        // Calculate Auto-Fit Zoom - account for concept nodes
        const maxExtent = BASE_RADIUS + 280; // Extra space for concepts
        const fitZoom = Math.min(0.9, 800 / maxExtent);

        // Only apply auto-zoom on FIRST load (not drag updates)
        if (nodes.length === 0 && !localStorage.getItem(`mindmap_pos_${bookId}`)) {
            setZoom(fitZoom);
        }

        // 1. Center Node
        newNodes.push({
            id: "center",
            type: "center",
            label: mindMapData.title,
            x: CENTER_X,
            y: CENTER_Y
        });

        // Add offset to first subtopic for better visual balance
        const startAngle = -Math.PI / 2; // Start from top
        const angleStep = (2 * Math.PI) / (subtopicCount || 1);

        subtopics.forEach((st, stIdx) => {
            const angle = startAngle + (stIdx * angleStep);
            const color = getSubtopicColor(stIdx);

            const stX = CENTER_X + Math.cos(angle) * BASE_RADIUS;
            const stY = CENTER_Y + Math.sin(angle) * BASE_RADIUS;

            // Subtopic Node
            newNodes.push({
                id: st.id,
                type: "subtopic",
                label: st.name,
                x: stX,
                y: stY,
                color: color,
                subtopicId: st.id
            });

            // Link to Center
            newLinks.push({ source: "center", target: st.id, color: color });

            // Fan out concepts with improved spacing and collision avoidance
            if (!collapsedNodes.has(st.id)) {
                const concepts = st.concepts || [];
                const conceptCount = concepts.length;

                // Arrange concepts in a more organized pattern
                if (conceptCount === 1) {
                    // Single concept: place directly away from center
                    const dist = 220;
                    const cX = stX + Math.cos(angle) * dist;
                    const cY = stY + Math.sin(angle) * dist;

                    newNodes.push({
                        id: concepts[0].id,
                        type: "concept",
                        label: concepts[0].name,
                        details: concepts[0].details,
                        x: cX,
                        y: cY,
                        color: color,
                        parentColor: color,
                        subtopicId: st.id
                    });

                    newLinks.push({ source: st.id, target: concepts[0].id, color: color });
                } else if (conceptCount === 2) {
                    // Two concepts: place on either side
                    const dist = 220;
                    const spread = 0.5;

                    concepts.forEach((c, cIdx) => {
                        const side = cIdx === 0 ? -1 : 1;
                        const cAngle = angle + (spread * side);
                        const cX = stX + Math.cos(cAngle) * dist;
                        const cY = stY + Math.sin(cAngle) * dist;

                        newNodes.push({
                            id: c.id,
                            type: "concept",
                            label: c.name,
                            details: c.details,
                            x: cX,
                            y: cY,
                            color: color,
                            parentColor: color,
                            subtopicId: st.id
                        });

                        newLinks.push({ source: st.id, target: c.id, color: color });
                    });
                } else {
                    // Three or more: arrange in arc with extra spacing
                    const dist = 240;
                    const maxSpread = conceptCount === 3 ? 0.6 : 0.7;

                    concepts.forEach((c, cIdx) => {
                        const spreadAngle = (cIdx - (conceptCount - 1) / 2) * maxSpread;
                        const cAngle = angle + spreadAngle;

                        const cX = stX + Math.cos(cAngle) * dist;
                        const cY = stY + Math.sin(cAngle) * dist;

                        newNodes.push({
                            id: c.id,
                            type: "concept",
                            label: c.name,
                            details: c.details,
                            x: cX,
                            y: cY,
                            color: color,
                            parentColor: color,
                            subtopicId: st.id
                        });

                        newLinks.push({ source: st.id, target: c.id, color: color });
                    });
                }
            }
        });

        // Merge with existing positions if IDs match (preserve drag state) or load from Cache
        const savedLayout = localStorage.getItem(`mindmap_pos_${bookId}`);
        const savedPosMap = savedLayout ? new Map(JSON.parse(savedLayout).map(p => [p.id, p])) : new Map();

        setNodes(prevNodes => {
            // Priority: 1. Currently active state (prevNodes) > 2. Saved Cache > 3. Default Radial
            const currentPosMap = new Map(prevNodes.map(n => [n.id, { x: n.x, y: n.y }]));

            return newNodes.map(n => {
                // If we are just re-calculating due to data change (rare) or init
                if (currentPosMap.has(n.id)) {
                    return { ...n, x: currentPosMap.get(n.id).x, y: currentPosMap.get(n.id).y };
                }
                if (savedPosMap.has(n.id)) {
                    return { ...n, x: savedPosMap.get(n.id).x, y: savedPosMap.get(n.id).y };
                }
                return n;
            });
        });
        setLinks(newLinks);

    }, [mindMapData, collapsedNodes, bookId]);

    // --- Drag Handlers ---
    const handleNodeMouseDown = (e, nodeId) => {
        e.stopPropagation(); // Prevent canvas pan
        setDraggingNodeId(nodeId);
    };

    const handleCanvasMouseMove = (e) => {
        if (draggingNodeId) {
            // Drag Node
            const scale = zoom;
            setNodes(prev => prev.map(n => {
                if (n.id === draggingNodeId) {
                    return {
                        ...n,
                        x: n.x + e.movementX / scale,
                        y: n.y + e.movementY / scale
                    };
                }
                return n;
            }));
        } else if (isDragging) {
            // Pan Canvas
            setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
        }
    };

    const handleCanvasMouseUp = () => {
        if (draggingNodeId) {
            // Save positions on drop
            const posData = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
            localStorage.setItem(`mindmap_pos_${bookId}`, JSON.stringify(posData));
        }
        setDraggingNodeId(null);
        setIsDragging(false);
    };


    // --- Render Helpers ---
    const renderNode = (node) => {
        const isDimmed = focusedSubtopic && node.type !== 'center' && node.subtopicId !== focusedSubtopic;
        const opacity = isDimmed ? 0.2 : 1;
        const isSelected = draggingNodeId === node.id;

        const commonProps = {
            transform: `translate(${node.x},${node.y})`,
            style: { opacity, cursor: isDragging ? 'grabbing' : 'grab', transition: draggingNodeId === node.id ? 'none' : 'transform 0.3s, opacity 0.3s' },
            onMouseDown: (e) => handleNodeMouseDown(e, node.id)
        };

        if (node.type === 'center') {
            return (
                <g key={node.id} {...commonProps}>
                    <circle r="60" fill="#2D3436" stroke="#fff" strokeWidth="4" />
                    <foreignObject x="-55" y="-35" width="110" height="70" style={{ pointerEvents: 'none' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: 'white', textAlign: 'center',
                            fontSize: '13px', fontWeight: 'bold', lineHeight: '1.3',
                            padding: '5px'
                        }}>
                            {node.label}
                        </div>
                    </foreignObject>
                </g>
            )
        }

        if (node.type === 'subtopic') {
            const isCollapsed = collapsedNodes.has(node.id);
            return (
                <g key={node.id} {...commonProps}>
                    {/* Larger hit area for better readability */}
                    <rect x="-75" y="-35" width="150" height="70" rx="18" fill={node.color} stroke="white" strokeWidth="3" />
                    <foreignObject x="-70" y="-30" width="140" height="60" style={{ pointerEvents: 'none' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: 'white', textAlign: 'center',
                            fontWeight: '600', fontSize: '11.5px', lineHeight: '1.3',
                            padding: '4px', overflow: 'hidden'
                        }}>
                            {node.label}
                        </div>
                    </foreignObject>

                    {/* Interactive buttons */}
                    <g
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
                        style={{ cursor: 'pointer' }}
                    >
                        <circle cx="0" cy="38" r="12" fill="white" stroke={node.color} strokeWidth="2" />
                        <text x="0" y="43" textAnchor="middle" fontSize="16" fontWeight="bold" fill={node.color}>
                            {isCollapsed ? '+' : '-'}
                        </text>
                    </g>
                </g>
            );
        }

        if (node.type === 'concept') {
            return (
                <g key={node.id} {...commonProps}>
                    <rect x="-60" y="-28" width="120" height="56" rx="10" fill="white" stroke={node.color} strokeWidth="2.5" />
                    <foreignObject x="-56" y="-24" width="112" height="48" style={{ pointerEvents: 'none' }}>
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            height: '100%', textAlign: 'center', padding: '2px'
                        }}>
                            <span style={{
                                color: '#2d3436',
                                fontWeight: '500',
                                fontSize: '10.5px',
                                lineHeight: '1.25',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical'
                            }}>
                                {node.label}
                            </span>
                        </div>
                    </foreignObject>

                    {node.details && node.details.length > 0 && (
                        <circle cx="58" cy="-26" r="7" fill="#F1C40F" stroke="white" strokeWidth="2" />
                    )}
                </g>
            )
        }
    };

    const renderLink = (link) => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return null;

        // Create smoother curves with better control points
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;

        // Use bezier curves for smoother connections
        const controlOffset = 0.3;
        const cx1 = sourceNode.x + dx * controlOffset;
        const cy1 = sourceNode.y + dy * controlOffset;
        const cx2 = sourceNode.x + dx * (1 - controlOffset);
        const cy2 = sourceNode.y + dy * (1 - controlOffset);

        const path = `M ${sourceNode.x} ${sourceNode.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${targetNode.x} ${targetNode.y}`;

        const isDimmed = focusedSubtopic
            && sourceNode.subtopicId !== focusedSubtopic
            && targetNode.subtopicId !== focusedSubtopic
            && sourceNode.type !== 'center';

        // Thicker lines for center-to-subtopic, thinner for subtopic-to-concept
        const isMainLink = sourceNode.type === 'center';
        const strokeWidth = isMainLink ? 3 : 2;
        const opacity = isDimmed ? 0.1 : isMainLink ? 0.7 : 0.5;

        return (
            <path
                key={`${link.source}-${link.target}`}
                d={path}
                stroke={link.color || '#ccc'}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={opacity}
                strokeLinecap="round"
            />
        );
    };


    if (loading && !mindMapData) return (
        <div className="mm-center-msg" style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ToolProcessingAnimation title={t.mindmap.generating} status={t.mindmap.analyzing} />
        </div>
    );

    if (error) return (
        <div className="mm-center-msg">
            <AlertCircle className="mm-error-icon" />
            <h2 className="mm-error-title">{t.mindmap.failed}</h2>
            <p className="mm-error-text">{error}</p>
            <button onClick={() => navigate(-1)} className="mm-back-home">
                {t.dashboard.back}
            </button>
        </div>
    );

    return (
        <div className="mindmap-container bg-dots-pattern">
            {/* Header */}
            <div className="mindmap-header">
                <div className="mm-header-left">
                    <button onClick={() => navigate(-1)} className="mm-back-btn">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="mm-title">
                        <h1>{mindMapData?.title || bookName}</h1>
                        <div className="mm-meta">
                            <span className="mm-tag">{subject}</span>
                            <span>{mindMapData?.subtopics?.length || 0} {t.mindmap.topics}</span>
                        </div>
                    </div>
                </div>

                <div className="mm-header-right">
                    <button
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="mm-action-btn"
                    >
                        <RefreshCw size={18} className={regenerating ? "mm-spin" : ""} />
                        <span className="hidden sm:inline">{t.mindmap.regenerate}</span>
                    </button>
                    <div className="mm-divider"></div>
                    <button onClick={() => { setFocusedSubtopic(null); setZoom(1); setPan({ x: 0, y: 0 }); }} className="mm-icon-btn" title="Reset View">
                        <Maximize size={18} />
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div
                className="mindmap-canvas"
                onMouseDown={(e) => { if (e.target === e.currentTarget || e.target.tagName === 'svg') setIsDragging(true); }}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
            >
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox="0 0 1000 800"
                    style={{ background: 'transparent' }}
                >
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                        {/* Render Links First (Behind nodes) */}
                        {links.map(renderLink)}

                        {/* Render Nodes */}
                        {nodes.map(renderNode)}
                    </g>
                </svg>
            </div>

            {/* Footer Controls */}
            <div className="mm-footer">
                <button onClick={handleZoomIn} className="mm-zoom-btn">
                    <ZoomIn size={20} />
                </button>
                <div className="mm-separator"></div>
                <button onClick={handleZoomOut} className="mm-zoom-btn">
                    <ZoomOut size={20} />
                </button>
            </div>

            {/* Helper Hint */}
            <div className="mm-hint">
                {t.mindmap.hint}
            </div>
        </div>
    );
};

export default MindMapTool;
