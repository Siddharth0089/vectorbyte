import { useState, useMemo } from 'react';
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
    const [exportFormat, setExportFormat] = useState('svg');
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const [exporting, setExporting] = useState(false);

    const svgBlobUrl = useMemo(() => {
        if (!svgData) return null;
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
    }, [svgData]);

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
        <div className="w-full space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-2xl font-bold text-white/90">✨ Vectorization Complete</h3>
                    <p className="text-sm text-surface-200/50 mt-1">
                        Drag the slider to compare original vs. vector
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button id="reset-button" onClick={onReset}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-800/60 text-surface-200/70 border border-surface-200/10 hover:bg-surface-700/60 hover:text-white/90 transition-all">
                        ↩ New Image
                    </button>
                    {onEdit && (
                        <button onClick={onEdit}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-glow-violet/15 text-glow-violet border border-glow-violet/20 hover:bg-glow-violet/25 hover:text-white transition-all">
                            ✏️ Edit SVG
                        </button>
                    )}
                    {/* Export dropdown */}
                    <div className="relative">
                        <button id="download-button" onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-glow-cyan text-white shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
                            {exporting ? (
                                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Exporting...</>
                            ) : (
                                <>⬇ Download<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg></>
                            )}
                        </button>
                        {showFormatMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-900 border border-surface-200/15 shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fadeIn">
                                {EXPORT_FORMATS.map(fmt => (
                                    <button key={fmt.value} onClick={() => handleDownload(fmt.value)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-800/60 transition-colors border-b border-surface-200/5 last:border-0">
                                        <span className="w-10 h-7 rounded bg-surface-800/80 flex items-center justify-center text-[10px] font-bold text-accent-400 uppercase">
                                            {fmt.value}
                                        </span>
                                        <div>
                                            <p className="text-sm text-white/80 font-medium">{fmt.label}</p>
                                            <p className="text-[10px] text-surface-200/40">{fmt.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Click outside to close menu */}
            {showFormatMenu && <div className="fixed inset-0 z-40" onClick={() => setShowFormatMenu(false)} />}

            {/* Compare slider */}
            <div className="rounded-2xl overflow-hidden border border-surface-200/10 glow-border">
                <ReactCompareSlider
                    itemOne={<ReactCompareSliderImage src={originalUrl} alt="Original raster"
                        style={{ objectFit: 'contain', width: '100%', height: '100%', background: '#0f172a' }} />}
                    itemTwo={<ReactCompareSliderImage src={svgBlobUrl} alt="Vectorized SVG"
                        style={{ objectFit: 'contain', width: '100%', height: '100%', background: '#0f172a' }} />}
                    style={{ width: '100%', height: 'clamp(300px, 60vh, 700px)' }}
                    position={50}
                />
            </div>

            {/* Labels */}
            <div className="flex items-center justify-between px-2 text-xs text-surface-200/40">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-glow-rose/60" /> Original (Raster)
                </span>
                <span className="flex items-center gap-1.5">
                    Vectorized (SVG) <span className="w-2 h-2 rounded-full bg-glow-cyan/60" />
                </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-surface-900/50 border border-surface-200/10">
                    <p className="text-xs text-surface-200/40 mb-1">SVG Size</p>
                    <p className="text-lg font-semibold text-white/80">{svgSizeKB} KB</p>
                </div>
                <div className="p-4 rounded-xl bg-surface-900/50 border border-surface-200/10">
                    <p className="text-xs text-surface-200/40 mb-1">Paths</p>
                    <p className="text-lg font-semibold text-white/80">{pathCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-surface-900/50 border border-surface-200/10">
                    <p className="text-xs text-surface-200/40 mb-1">Formats</p>
                    <p className="text-lg font-semibold text-white/80">SVG · PDF · EPS · DXF</p>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
            `}</style>
        </div>
    );
}
