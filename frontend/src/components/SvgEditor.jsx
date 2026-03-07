import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

const HISTORY_LIMIT = 50;

function parseSvgDom(svgString) {
    const parser = new DOMParser();
    return parser.parseFromString(svgString, 'image/svg+xml');
}

function serializeSvgDom(doc) {
    return new XMLSerializer().serializeToString(doc.documentElement);
}

function extractPaths(svgString) {
    const doc = parseSvgDom(svgString);
    const els = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
    return Array.from(els).map((el, i) => ({
        id: el.getAttribute('id') || `shape-${i}`,
        index: i, type: el.tagName.toLowerCase(),
        fill: el.getAttribute('fill') || 'none',
        stroke: el.getAttribute('stroke') || 'none',
        d: el.getAttribute('d') || '',
    }));
}

const COLOR_PALETTE = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FF6B35', '#7B2D8E', '#2EC4B6', '#E71D36',
    '#FF9F1C', '#3A86FF', '#8338EC', '#FB5607', '#06D6A0', '#118AB2',
    '#073B4C', '#EF476F', '#FFD166', '#264653', '#2A9D8F', '#E76F51',
];

export default function SvgEditor({ svgData, onSave, onClose }) {
    const [currentSvg, setCurrentSvg] = useState(svgData);
    const [paths, setPaths] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [hoveredId, setHoveredId] = useState(null);
    const [history, setHistory] = useState([svgData]);
    const [historyIdx, setHistoryIdx] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [activeColor, setActiveColor] = useState('#ff0000');
    const [showLayers, setShowLayers] = useState(true);
    const [tool, setTool] = useState('select');
    const svgContainerRef = useRef(null);

    useEffect(() => { setPaths(extractPaths(currentSvg)); }, [currentSvg]);

    const pushHistory = useCallback((newSvg) => {
        setHistory(prev => [...prev.slice(0, historyIdx + 1), newSvg].slice(-HISTORY_LIMIT));
        setHistoryIdx(prev => Math.min(prev + 1, HISTORY_LIMIT - 1));
        setCurrentSvg(newSvg);
    }, [historyIdx]);

    const undo = useCallback(() => {
        if (historyIdx > 0) { setHistoryIdx(historyIdx - 1); setCurrentSvg(history[historyIdx - 1]); setSelectedIds(new Set()); }
    }, [history, historyIdx]);

    const redo = useCallback(() => {
        if (historyIdx < history.length - 1) { setHistoryIdx(historyIdx + 1); setCurrentSvg(history[historyIdx + 1]); setSelectedIds(new Set()); }
    }, [history, historyIdx]);

    const handleDelete = useCallback(() => {
        if (selectedIds.size === 0) return;
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        Array.from(selectedIds).map(id => paths.find(p => p.id === id)).filter(Boolean)
            .sort((a, b) => b.index - a.index)
            .forEach(p => { if (allEls[p.index]) allEls[p.index].remove(); });
        pushHistory(serializeSvgDom(doc));
        setSelectedIds(new Set());
    }, [currentSvg, paths, selectedIds, pushHistory]);

    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); handleDelete(); }
            if (e.key === 'Escape') { setSelectedIds(new Set()); }
            if (e.key === 'a' && e.ctrlKey) { e.preventDefault(); setSelectedIds(new Set(paths.map(p => p.id))); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [paths, selectedIds, undo, redo, handleDelete]);

    const handleColorChange = useCallback((color) => {
        if (selectedIds.size === 0) return;
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        selectedIds.forEach(id => {
            const p = paths.find(x => x.id === id);
            if (p && allEls[p.index]) allEls[p.index].setAttribute('fill', color);
        });
        pushHistory(serializeSvgDom(doc));
        setActiveColor(color);
    }, [currentSvg, paths, selectedIds, pushHistory]);

    const handlePathClick = useCallback((e, pathId) => {
        e.stopPropagation();
        if (tool === 'color') {
            const doc = parseSvgDom(currentSvg);
            const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
            const p = paths.find(x => x.id === pathId);
            if (p && allEls[p.index]) { allEls[p.index].setAttribute('fill', activeColor); pushHistory(serializeSvgDom(doc)); }
            return;
        }
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (e.shiftKey || e.ctrlKey) { next.has(pathId) ? next.delete(pathId) : next.add(pathId); }
            else { next.clear(); next.add(pathId); }
            return next;
        });
    }, [tool, activeColor, currentSvg, paths, pushHistory]);

    const handleMerge = useCallback(() => {
        if (selectedIds.size < 2) return;
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        const sel = Array.from(selectedIds).map(id => paths.find(p => p.id === id))
            .filter(p => p && p.type === 'path').sort((a, b) => a.index - b.index);
        if (sel.length < 2) return;
        const mergedD = sel.map(p => allEls[p.index]?.getAttribute('d')).filter(Boolean).join(' ');
        allEls[sel[0].index].setAttribute('d', mergedD);
        for (let i = sel.length - 1; i >= 1; i--) { allEls[sel[i].index]?.remove(); }
        pushHistory(serializeSvgDom(doc));
        setSelectedIds(new Set());
    }, [currentSvg, paths, selectedIds, pushHistory]);

    const handleDuplicate = useCallback(() => {
        if (selectedIds.size === 0) return;
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        selectedIds.forEach(id => {
            const p = paths.find(x => x.id === id);
            if (p && allEls[p.index]) {
                const clone = allEls[p.index].cloneNode(true);
                clone.removeAttribute('id');
                allEls[p.index].parentNode.insertBefore(clone, allEls[p.index].nextSibling);
            }
        });
        pushHistory(serializeSvgDom(doc));
    }, [currentSvg, paths, selectedIds, pushHistory]);

    const handleBringForward = useCallback(() => {
        if (selectedIds.size !== 1) return;
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        const p = paths.find(x => selectedIds.has(x.id));
        if (!p || !allEls[p.index]) return;
        const el = allEls[p.index]; const next = el.nextElementSibling;
        if (next) el.parentNode.insertBefore(next, el);
        pushHistory(serializeSvgDom(doc));
    }, [currentSvg, paths, selectedIds, pushHistory]);

    const handleSendBackward = useCallback(() => {
        if (selectedIds.size !== 1) return;
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        const p = paths.find(x => selectedIds.has(x.id));
        if (!p || !allEls[p.index]) return;
        const el = allEls[p.index]; const prev = el.previousElementSibling;
        if (prev) el.parentNode.insertBefore(el, prev);
        pushHistory(serializeSvgDom(doc));
    }, [currentSvg, paths, selectedIds, pushHistory]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        setZoom(prev => Math.min(Math.max(prev * (e.deltaY > 0 ? 0.9 : 1.1), 0.1), 10));
    }, []);

    const handleMouseDown = useCallback((e) => {
        if (tool === 'pan' || e.button === 1 || e.altKey) {
            setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [tool, pan]);

    const handleMouseMove = useCallback((e) => {
        if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }, [isPanning, panStart]);

    const renderedSvg = useMemo(() => {
        const doc = parseSvgDom(currentSvg);
        const allEls = doc.querySelectorAll('path, rect, circle, ellipse, polygon, polyline');
        allEls.forEach((el, i) => {
            const id = el.getAttribute('id') || `shape-${i}`;
            el.setAttribute('data-shape-id', id);
            el.style.cursor = 'pointer';
            if (selectedIds.has(id)) {
                el.setAttribute('stroke', '#8b5cf6');
                el.setAttribute('stroke-width', `${Math.max(2 / zoom, 1)}`);
            } else if (hoveredId === id) {
                el.setAttribute('stroke', '#06b6d4');
                el.setAttribute('stroke-width', `${Math.max(1.5 / zoom, 0.5)}`);
            }
        });
        return serializeSvgDom(doc);
    }, [currentSvg, selectedIds, hoveredId, zoom]);

    const selectedCount = selectedIds.size;
    const selectedPath = selectedCount === 1 ? paths.find(p => selectedIds.has(p.id)) : null;

    return (
        <div className="w-full h-[85vh] flex rounded-2xl overflow-hidden border border-surface-200/10 bg-surface-950">
            {/* Toolbar */}
            <div className="w-14 bg-surface-900/80 border-r border-surface-200/10 flex flex-col items-center py-3 gap-1.5 shrink-0">
                <ToolBtn icon="🖱️" label="Select" active={tool === 'select'} onClick={() => setTool('select')} />
                <ToolBtn icon="✋" label="Pan" active={tool === 'pan'} onClick={() => setTool('pan')} />
                <ToolBtn icon="🎨" label="Color" active={tool === 'color'} onClick={() => setTool('color')} />
                <div className="w-8 border-t border-surface-200/10 my-2" />
                <ToolBtn icon="🗑️" label="Delete" onClick={handleDelete} disabled={selectedCount === 0} />
                <ToolBtn icon="🔗" label="Merge" onClick={handleMerge} disabled={selectedCount < 2} />
                <ToolBtn icon="📋" label="Copy" onClick={handleDuplicate} disabled={selectedCount === 0} />
                <div className="w-8 border-t border-surface-200/10 my-2" />
                <ToolBtn icon="⬆️" label="Forward" onClick={handleBringForward} disabled={selectedCount !== 1} />
                <ToolBtn icon="⬇️" label="Back" onClick={handleSendBackward} disabled={selectedCount !== 1} />
                <div className="w-8 border-t border-surface-200/10 my-2" />
                <ToolBtn icon="↩️" label="Undo" onClick={undo} disabled={historyIdx <= 0} />
                <ToolBtn icon="↪️" label="Redo" onClick={redo} disabled={historyIdx >= history.length - 1} />
                <div className="flex-1" />
                <ToolBtn icon="🎯" label="Reset" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} />
            </div>

            {/* Canvas */}
            <div ref={svgContainerRef}
                className="flex-1 relative overflow-hidden bg-[#1a1a2e]"
                style={{ cursor: tool === 'pan' || isPanning ? 'grab' : tool === 'color' ? 'crosshair' : 'default' }}
                onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                onMouseUp={() => setIsPanning(false)} onMouseLeave={() => setIsPanning(false)}
                onClick={(e) => { if (e.target === svgContainerRef.current) setSelectedIds(new Set()); }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                    backgroundImage: 'linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%),linear-gradient(45deg,#fff 25%,transparent 25%,transparent 75%,#fff 75%)',
                    backgroundPosition: `0 0,${10 * zoom}px ${10 * zoom}px`
                }} />
                <div className="absolute inset-0 flex items-center justify-center"
                    style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: 'center' }}>
                    <div className="svg-editor-canvas"
                        dangerouslySetInnerHTML={{ __html: renderedSvg }}
                        onClick={(e) => { const s = e.target.closest('[data-shape-id]'); if (s) handlePathClick(e, s.getAttribute('data-shape-id')); }}
                        onMouseOver={(e) => { const s = e.target.closest('[data-shape-id]'); if (s) setHoveredId(s.getAttribute('data-shape-id')); }}
                        onMouseOut={() => setHoveredId(null)} />
                </div>
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-surface-900/80 border border-surface-200/10 text-xs text-surface-200/60 backdrop-blur">
                    {Math.round(zoom * 100)}%
                </div>
                {selectedCount > 0 && <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-accent-500/20 border border-accent-500/30 text-xs text-accent-400 backdrop-blur">
                    {selectedCount} shape{selectedCount > 1 ? 's' : ''} selected
                </div>}
            </div>

            {/* Right Panel */}
            <div className="w-72 bg-surface-900/80 border-l border-surface-200/10 flex flex-col shrink-0">
                <div className="flex border-b border-surface-200/10">
                    <button onClick={() => setShowLayers(true)} className={`flex-1 py-3 text-xs font-semibold ${showLayers ? 'text-accent-400 border-b-2 border-accent-400' : 'text-surface-200/50'}`}>
                        Layers ({paths.length})
                    </button>
                    <button onClick={() => setShowLayers(false)} className={`flex-1 py-3 text-xs font-semibold ${!showLayers ? 'text-accent-400 border-b-2 border-accent-400' : 'text-surface-200/50'}`}>
                        Properties
                    </button>
                </div>

                {showLayers ? (
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {paths.map((path) => (
                            <div key={path.id} onClick={(e) => handlePathClick(e, path.id)}
                                onMouseEnter={() => setHoveredId(path.id)} onMouseLeave={() => setHoveredId(null)}
                                className={`flex items-center gap-2 px-3 py-2 border-b border-surface-200/5 cursor-pointer transition-colors ${selectedIds.has(path.id) ? 'bg-accent-500/15 border-l-2 border-l-accent-400' : hoveredId === path.id ? 'bg-surface-800/40' : 'hover:bg-surface-800/20'
                                    }`}>
                                <div className="w-5 h-5 rounded border border-surface-200/20 shrink-0" style={{ backgroundColor: path.fill !== 'none' ? path.fill : 'transparent' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white/70 truncate">{path.type} #{path.index}</p>
                                    <p className="text-[10px] text-surface-200/30 truncate">{path.fill}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {selectedCount > 0 ? (<>
                            <div>
                                <label className="text-xs text-surface-200/50 mb-2 block">Fill Color</label>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {COLOR_PALETTE.map(c => (
                                        <button key={c} onClick={() => handleColorChange(c)}
                                            className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${activeColor === c ? 'border-accent-400 ring-2 ring-accent-400/30' : 'border-surface-200/10'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-surface-200/50 mb-1 block">Custom Color</label>
                                <div className="flex gap-2">
                                    <input type="color" value={activeColor} onChange={(e) => { setActiveColor(e.target.value); handleColorChange(e.target.value); }}
                                        className="w-10 h-10 rounded-lg border border-surface-200/10 cursor-pointer bg-transparent" />
                                    <input type="text" value={activeColor}
                                        onChange={(e) => { setActiveColor(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) handleColorChange(e.target.value); }}
                                        className="flex-1 px-3 py-2 rounded-lg bg-surface-800/60 border border-surface-200/10 text-sm text-white/80 font-mono focus:outline-none focus:border-accent-400/50" />
                                </div>
                            </div>
                            {selectedPath && <div className="p-3 rounded-lg bg-surface-800/40 space-y-1">
                                <p className="text-xs text-white/70">Type: <span className="text-accent-400">{selectedPath.type}</span></p>
                                <p className="text-xs text-white/70">Fill: <span className="text-accent-400">{selectedPath.fill}</span></p>
                                <p className="text-xs text-white/70">Index: <span className="text-accent-400">#{selectedPath.index}</span></p>
                            </div>}
                        </>) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="text-sm text-surface-200/40">No selection</p>
                                <p className="text-xs text-surface-200/25">Click a shape to edit</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="p-3 border-t border-surface-200/10 space-y-2">
                    <button onClick={() => onSave(currentSvg)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-glow-cyan text-white shadow-lg shadow-accent-500/20 hover:shadow-accent-500/30 transition-all">
                        💾 Save Changes
                    </button>
                    <button onClick={onClose}
                        className="w-full py-2 rounded-xl text-sm font-medium bg-surface-800/60 text-surface-200/60 border border-surface-200/10 hover:text-white/80 transition-all">
                        Close Editor
                    </button>
                </div>
            </div>

            <style>{`
                .svg-editor-canvas svg { max-width:100%; max-height:70vh; display:block; }
                .svg-editor-canvas path:hover,.svg-editor-canvas rect:hover,.svg-editor-canvas circle:hover,
                .svg-editor-canvas ellipse:hover,.svg-editor-canvas polygon:hover { filter:brightness(1.15); }
            `}</style>
        </div>
    );
}

function ToolBtn({ icon, label, active, onClick, disabled }) {
    return (<button onClick={onClick} disabled={disabled} title={label}
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : active ? 'bg-accent-500/20 shadow-lg shadow-accent-500/10 ring-1 ring-accent-400/30' : 'hover:bg-surface-800/60'
            }`}>{icon}</button>);
}
