import { useEffect, useState, useMemo } from 'react';
import {
    ReactCompareSlider,
    ReactCompareSliderImage,
} from 'react-compare-slider';

const API_BASE = '/api';
const EXPORT_FORMATS = [
    { value: 'svg', label: 'SVG', desc: 'Scalable Vector Graphics' },
    { value: 'pdf', label: 'PDF', desc: 'Portable Document Format' },
    { value: 'eps', label: 'EPS', desc: 'Encapsulated PostScript' },
    { value: 'dxf', label: 'DXF', desc: 'AutoCAD Drawing Exchange' },
];

export default function ResultView({ originalUrl, svgData, jobId, onReset, onEdit }) {
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const [exporting, setExporting] = useState(false);

    const svgBlobUrl = useMemo(() => {
        if (!svgData) return null;
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
    }, [svgData]);

    useEffect(() => {
        return () => {
            if (svgBlobUrl) URL.revokeObjectURL(svgBlobUrl);
        };
    }, [svgBlobUrl]);

    const handleDownload = async (format = 'svg') => {
        if (!svgData) return;
        setExporting(true);
        try {
            if (format === 'svg') {
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                downloadBlob(blob, `vectorized.svg`);
            } else {
                const formData = new FormData();
                if (jobId) formData.append('job_id', jobId);
                else formData.append('svg', svgData);
                formData.append('format', format);

                const res = await fetch(`${API_BASE}/export`, { method: 'POST', body: formData });
                if (!res.ok) throw new Error(`Export failed`);
                const blob = await res.blob();
                downloadBlob(blob, `vectorized.${format}`);
            }
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
            setShowFormatMenu(false);
        }
    };

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const svgSizeKB = svgData ? (new Blob([svgData]).size / 1024).toFixed(1) : '—';
    const pathCount = svgData ? (svgData.match(/<path/g) || []).length : 0;

    return (
        <div className="w-full space-y-6 animate-fadeIn">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl glass-panel relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-glow-cyan/5 via-transparent to-accent-500/5 pointer-events-none" />
                <div className="relative">
                    <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-200">
                        ✨ Vectorization Complete
                    </h3>
                    <p className="text-sm font-medium text-surface-200/50 mt-1">
                        Drag the slider to compare original vs. vector
                    </p>
                </div>
                <div className="relative flex items-center gap-3">
                    <button id="reset-button" onClick={onReset}
                        className="group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-surface-900/60 text-white/70 border border-surface-200/10 shadow-inner hover:bg-surface-800/80 hover:text-white hover:border-surface-200/20 hover:shadow-lg transition-all duration-300">
                        <svg className="w-4 h-4 text-surface-200/50 group-hover:-translate-x-1 group-hover:text-white transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                        New Image
                    </button>
                    {onEdit && (
                        <button onClick={onEdit}
                            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-accent-500/10 text-accent-400 border border-accent-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)] hover:bg-accent-500/20 hover:text-accent-300 hover:border-accent-500/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all duration-300">
                            <span className="group-hover:rotate-12 transition-transform duration-300">✏️</span> Edit SVG
                        </button>
                    )}

                    {/* Export dropdown container */}
                    <div className="relative">
                        <button id="download-button" onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="group relative px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-accent-600 to-glow-cyan text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center gap-2 overflow-hidden">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKSIvPjwvc3ZnPg==')] opacity-30 mix-blend-overlay pointer-events-none" />
                            {exporting ? (
                                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> <span className="relative">Exporting...</span></>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 relative group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    <span className="relative tracking-wide">Download</span>
                                    <svg className={`w-3 h-3 relative transition-transform duration-300 ${showFormatMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {showFormatMenu && (
                            <>
                                {/* Invisible backdrop for click-away */}
                                <div className="fixed inset-0 z-40" onClick={() => setShowFormatMenu(false)} />
                                <div className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl glass-panel-heavy border border-surface-200/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden transform origin-top-right animate-slideUp">
                                    <div className="p-2 space-y-1">
                                        {EXPORT_FORMATS.map(fmt => (
                                            <button key={fmt.value} onClick={() => handleDownload(fmt.value)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-surface-800/60 transition-colors group">
                                                <div className="w-12 h-10 rounded-lg bg-surface-900 border border-surface-200/10 flex items-center justify-center text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-surface-200/50 uppercase tracking-widest shadow-inner group-hover:border-accent-500/30 group-hover:from-accent-400 group-hover:to-glow-cyan transition-all">
                                                    {fmt.value}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">{fmt.label}</p>
                                                    <p className="text-[10px] font-medium text-surface-200/40">{fmt.desc}</p>
                                                </div>
                                                <svg className="w-4 h-4 text-surface-200/20 group-hover:text-accent-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Compare slider main view */}
            <div className="rounded-[2rem] overflow-hidden border border-surface-200/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative group bg-surface-950">
                {/* Subtle inner glow */}
                <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-[2rem] pointer-events-none z-10" />
                <ReactCompareSlider
                    itemOne={<ReactCompareSliderImage src={originalUrl} alt="Original raster"
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }} />}
                    itemTwo={<ReactCompareSliderImage src={svgBlobUrl} alt="Vectorized SVG"
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }} />}
                    style={{ width: '100%', height: 'clamp(400px, 65vh, 800px)' }}
                    position={50}
                    className="transition-opacity duration-500"
                />

                {/* Embedded Labels on hover */}
                <div className="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="px-3 py-1.5 rounded-lg bg-surface-900/80 backdrop-blur border border-surface-200/10 text-[10px] font-bold text-white/80 tracking-wider uppercase shadow-lg flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-glow-rose animate-pulse" /> Original Image
                    </span>
                </div>
                <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="px-3 py-1.5 rounded-lg bg-surface-900/80 backdrop-blur border border-surface-200/10 text-[10px] font-bold text-white/80 tracking-wider uppercase shadow-lg flex items-center gap-2">
                        Vector SVG <span className="w-1.5 h-1.5 rounded-full bg-glow-cyan animate-pulse" />
                    </span>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl glass-panel relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-glow-rose/10 blur-2xl rounded-full -translate-y-12 translate-x-12 group-hover:bg-glow-rose/20 transition-colors duration-500" />
                    <p className="text-[10px] font-black tracking-widest text-surface-200/40 uppercase mb-1">SVG File Size</p>
                    <p className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-surface-200/50">
                        {svgSizeKB} <span className="text-sm font-semibold text-surface-200/40">KB</span>
                    </p>
                </div>

                <div className="p-5 rounded-2xl glass-panel relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-accent-500/10 blur-2xl rounded-full -translate-y-12 translate-x-12 group-hover:bg-accent-500/20 transition-colors duration-500" />
                    <p className="text-[10px] font-black tracking-widest text-surface-200/40 uppercase mb-1">Vector Paths</p>
                    <p className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-surface-200/50">
                        {pathCount} <span className="text-sm font-semibold text-surface-200/40">nodes</span>
                    </p>
                </div>

                <div className="p-5 rounded-2xl glass-panel relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-glow-cyan/10 blur-2xl rounded-full -translate-y-12 translate-x-12 group-hover:bg-glow-cyan/20 transition-colors duration-500" />
                    <p className="text-[10px] font-black tracking-widest text-surface-200/40 uppercase mb-1">Available Formats</p>
                    <div className="flex items-center gap-2 mt-2">
                        {['SVG', 'PDF', 'EPS', 'DXF'].map(fmt => (
                            <span key={fmt} className="px-2 py-0.5 rounded border border-surface-200/10 bg-surface-900/50 text-[9px] font-bold text-surface-200/60 shadow-inner">
                                {fmt}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideUp { 
                    from { opacity:0; transform:translateY(10px) scale(0.98); } 
                    to { opacity:1; transform:translateY(0) scale(1); } 
                }
                .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
}
