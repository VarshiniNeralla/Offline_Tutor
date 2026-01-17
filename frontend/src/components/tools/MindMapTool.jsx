import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, RefreshCw, ZoomIn, ZoomOut,
    Maximize, Minimize, Share2, Download,
    AlertCircle, Network, Layers
} from 'lucide-react';
import "../../assets/styles/mind-map.css";

const MindMapTool = () => {
    const location = useLocation();
    const navigate = useNavigate();
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
            const response = await fetch("http://localhost:8001/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Generate mind map",
                    mode: "mindmap",
                    book_ids: [bookId],
                    subjects: [subject || "General"],
                    language: "en"
                })
            });

            const data = await response.json();

            if (data.status === "error") {
                setError(data.response || "Failed to generate mind map.");
            } else {
                setMindMapData(data.response);
                console.log("🧠 Mind Map Data Received:", data.response); // DEBUG
                localStorage.setItem(`mindmap_v1_${bookId}`, JSON.stringify(data.response));
            }
        } catch (err) {
            setError("Network error. Please check backend.");
        } finally {
            setLoading(false);
            setRegenerating(false);
        }
    };

    const handleRegenerate = () => {
        if (window.confirm("Regenerating will replace the existing mind map. This cannot be undone.")) {
            setRegenerating(true);
            fetchMindMap(true);
        }
    };

    // --- Interaction ---
    const handleWheel = (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            setZoom(z => Math.max(0.1, Math.min(3, z - e.deltaY * 0.001)));
        } else {
            // For standard scrolling environments, e.ctrlKey handles zoom.
            // If not prevented, wheel might scroll page.
            // Since we use overflow:hidden, page won't scroll, but good to handle.
        }
    };

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

    // --- Layout Calculation (Radial) ---
    const layout = useMemo(() => {
        if (!mindMapData) return { nodes: [], links: [] };

        const nodes = [];
        const links = [];

        // Settings
        const CENTER_X = 400;
        const CENTER_Y = 300;
        const SUBTOPIC_RADIUS = 250;

        // 1. Center Node
        nodes.push({
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
            const stX = CENTER_X + Math.cos(angle) * SUBTOPIC_RADIUS;
            const stY = CENTER_Y + Math.sin(angle) * SUBTOPIC_RADIUS;
            const color = getSubtopicColor(stIdx);

            // Subtopic Node
            nodes.push({
                id: st.id,
                type: "subtopic",
                label: st.name,
                x: stX,
                y: stY,
                color: color,
                subtopicId: st.id
            });

            // Link to Center
            links.push({ source: "center", target: st.id, color: color });

            // Fan out concepts
            if (!collapsedNodes.has(st.id)) {
                const concepts = st.concepts || [];
                concepts.forEach((c, cIdx) => {
                    const dist = 180; // Distance from subtopic
                    // Slight spread based on index
                    const spreadAngle = (cIdx - (concepts.length - 1) / 2) * 0.3; // 0.3 radians spread
                    const cAngle = angle + spreadAngle;

                    const cX = stX + Math.cos(cAngle) * dist;
                    const cY = stY + Math.sin(cAngle) * dist;

                    nodes.push({
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

                    links.push({ source: st.id, target: c.id, color: color });
                });
            }
        });

        return { nodes, links };
    }, [mindMapData, collapsedNodes]);


    // --- Render Helpers ---
    const renderNode = (node) => {
        // Focus Mode: Dim if not in focused subtopic (and not center)
        const isDimmed = focusedSubtopic && node.type !== 'center' && node.subtopicId !== focusedSubtopic;
        const opacity = isDimmed ? 0.2 : 1;

        if (node.type === 'center') {
            return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ opacity, cursor: 'pointer', transition: 'all 0.3s' }}>
                    <circle r="50" fill="#2D3436" stroke="#fff" strokeWidth="3" />
                    <foreignObject x="-45" y="-30" width="90" height="60">
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
                <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onClick={(e) => {
                        e.stopPropagation();
                        // Toggle Focus
                        setFocusedSubtopic(curr => curr === node.id ? null : node.id);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(node.id);
                    }}
                    style={{ opacity, cursor: 'pointer', transition: 'all 0.3s' }}
                >
                    <rect x="-60" y="-30" width="120" height="60" rx="15" fill={node.color} stroke="white" strokeWidth="2" />
                    <foreignObject x="-55" y="-25" width="110" height="50">
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '100%', color: 'white', textAlign: 'center',
                            fontWeight: '600', fontSize: '12px'
                        }}>
                            {node.label}
                        </div>
                    </foreignObject>
                    {/* Expand/Collapse Indicator */}
                    <circle cx="0" cy="30" r="8" fill="white" stroke={node.color} />
                    <text x="0" y="33" textAnchor="middle" fontSize="10" fill={node.color}>
                        {isCollapsed ? '+' : '-'}
                    </text>
                </g>
            );
        }

        if (node.type === 'concept') {
            return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`} style={{ opacity, transition: 'all 0.3s' }}>
                    <rect x="-50" y="-25" width="100" height="50" rx="8" fill="white" stroke={node.color} strokeWidth="2" />
                    <foreignObject x="-48" y="-22" width="96" height="46">
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            height: '100%', textAlign: 'center'
                        }}>
                            <span style={{ color: '#2d3436', fontWeight: '500', fontSize: '11px', lineHeight: '1.2' }}>
                                {node.label}
                            </span>
                        </div>
                    </foreignObject>

                    {/* Details Dot */}
                    {node.details && node.details.length > 0 && (
                        <circle cx="50" cy="-25" r="6" fill="#F1C40F" />
                    )}
                </g>
            )
        }
    };

    const renderLink = (link) => {
        const sourceNode = layout.nodes.find(n => n.id === link.source);
        const targetNode = layout.nodes.find(n => n.id === link.target);
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
            <p className="text-gray-600 font-medium">Synthesizing Neural Mind Map...</p>
            <p className="text-gray-400 text-sm mt-2">Analyzing chapter structure</p>
        </div>
    );

    if (error) return (
        <div className="mm-center-msg">
            <AlertCircle className="mm-error-icon" />
            <h2 className="mm-error-title">Generation Failed</h2>
            <p className="mm-error-text">{error}</p>
            <button onClick={() => navigate(-1)} className="mm-back-home">
                Go Back
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
                            <span>{mindMapData?.subtopics?.length || 0} Topics</span>
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
                        <span className="hidden sm:inline">Regenerate</span>
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
                onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }}
                onMouseMove={(e) => { if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onWheel={handleWheel}
            >
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 800 600"
                >
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                        {/* Render Links First (Behind nodes) */}
                        {layout.links.map(renderLink)}

                        {/* Render Nodes */}
                        {layout.nodes.map(renderNode)}
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
                Double-click subtopic to Expand/Collapse • Click to Focus • Drag to Pan
            </div>
        </div>
    );
};

export default MindMapTool;
