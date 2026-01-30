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
    }, [bookId]);

    const fetchMindMap = async (forceRegenerate = false) => {
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
                })
            });

            const data = await response.json();

            if (data.status === "error") {
                setError(data.response || t.mindmap.failed);
            } else {
                setMindMapData(data.response);
                localStorage.setItem(`mindmap_v1_${bookId}`, JSON.stringify(data.response));
            }
        } catch (err) {
            setError(t.quiz.errorHeader || "Network error. Please check backend.");
        } finally {
            setLoading(false);
            setRegenerating(false);
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

    // Initial Layout Calculation
    useEffect(() => {
        if (!mindMapData) return;

        const newNodes = [];
        const newLinks = [];

        // Settings
        const CENTER_X = 400;
        const CENTER_Y = 300;

        // Dynamic Layout Calculation
        const subtopicCount = mindMapData.subtopics?.length || 0;

        // DUAL RING LAYOUT (Zig-Zag)
        // Helps prevent clutter by alternating distances
        const INNER_RADIUS = 320;
        const OUTER_RADIUS = 550; // Big jump to clear text

        // Calculate Auto-Fit Zoom based on the outer ring
        const maxExtent = OUTER_RADIUS + 250;
        const fitZoom = Math.min(1, 550 / maxExtent);

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

        const subtopics = mindMapData.subtopics || [];
        const angleStep = (2 * Math.PI) / (subtopics.length || 1);

        subtopics.forEach((st, stIdx) => {
            const angle = stIdx * angleStep;

            // ALTERNATING RADIUS: Even = Inner, Odd = Outer
            const isOuter = stIdx % 2 !== 0;
            const radius = isOuter ? OUTER_RADIUS : INNER_RADIUS;

            const stX = CENTER_X + Math.cos(angle) * radius;
            const stY = CENTER_Y + Math.sin(angle) * radius;
            const color = getSubtopicColor(stIdx);

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

            // Fan out concepts
            if (!collapsedNodes.has(st.id)) {
                const concepts = st.concepts || [];
                concepts.forEach((c, cIdx) => {
                    // Concepts also need more space if on inner ring
                    const dist = 160;

                    // Fan spread calculation
                    const spreadAngle = (cIdx - (concepts.length - 1) / 2) * 0.35;
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
                    <circle r="50" fill="#2D3436" stroke="#fff" strokeWidth="3" />
                    <foreignObject x="-45" y="-30" width="90" height="60" style={{ pointerEvents: 'none' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: 'white', textAlign: 'center',
                            fontSize: '14px', fontWeight: 'bold'
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
                    {/* Hit area for drag */}
                    <rect x="-60" y="-30" width="120" height="60" rx="15" fill={node.color} stroke="white" strokeWidth="2" />
                    <foreignObject x="-55" y="-25" width="110" height="50" style={{ pointerEvents: 'none' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: 'white', textAlign: 'center',
                            fontWeight: '600', fontSize: '12px'
                        }}>
                            {node.label}
                        </div>
                    </foreignObject>

                    {/* Interactive buttons must stop propagation to prevent drag start */}
                    <g
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
                        style={{ cursor: 'pointer' }}
                    >
                        <circle cx="0" cy="30" r="10" fill="white" stroke={node.color} />
                        <text x="0" y="34" textAnchor="middle" fontSize="14" fontWeight="bold" fill={node.color}>
                            {isCollapsed ? '+' : '-'}
                        </text>
                    </g>
                </g>
            );
        }

        if (node.type === 'concept') {
            return (
                <g key={node.id} {...commonProps}>
                    <rect x="-50" y="-25" width="100" height="50" rx="8" fill="white" stroke={node.color} strokeWidth="2" />
                    <foreignObject x="-48" y="-22" width="96" height="46" style={{ pointerEvents: 'none' }}>
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            height: '100%', textAlign: 'center'
                        }}>
                            <span style={{ color: '#2d3436', fontWeight: '500', fontSize: '11px', lineHeight: '1.2' }}>
                                {node.label}
                            </span>
                        </div>
                    </foreignObject>

                    {node.details && node.details.length > 0 && (
                        <circle cx="50" cy="-25" r="6" fill="#F1C40F" />
                    )}
                </g>
            )
        }
    };

    const renderLink = (link) => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return null;

        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        const path = `M ${sourceNode.x} ${sourceNode.y} Q ${midX} ${midY} ${targetNode.x} ${targetNode.y}`;

        const isDimmed = focusedSubtopic
            && sourceNode.subtopicId !== focusedSubtopic
            && targetNode.subtopicId !== focusedSubtopic
            && sourceNode.type !== 'center';

        return (
            <path
                key={`${link.source}-${link.target}`}
                d={path}
                stroke={link.color || '#ccc'}
                strokeWidth="2"
                fill="none"
                opacity={isDimmed ? 0.1 : 0.6}
            />
        );
    };


    if (loading && !mindMapData) return (
        <div className="mm-center-msg">
            <div className="mm-spinner"></div>
            <p className="text-gray-600 font-medium">{t.mindmap.generating}</p>
            <p className="text-gray-400 text-sm mt-2">{t.mindmap.analyzing}</p>
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
                    width="100%"
                    height="100%"
                    viewBox="0 0 800 600"
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
