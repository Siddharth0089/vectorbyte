import { useState } from 'react';

const API_BASE = '/api';

/**
 * BatchView — Process multiple images at once with shared settings.
 * Shows a grid of images with individual progress indicators.
 */
export default function BatchView({ files, settings, onComplete, onReset }) {
    const [results, setResults] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleProcessAll = async () => {
        setProcessing(true);
        setResults([]);
        setProgress(0);

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        if (settings) {
            formData.append('settings', JSON.stringify(settings));
        }

        try {
            const res = await fetch(`${API_BASE}/vectorize/batch`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setResults(data.results || []);
            setProgress(100);
            if (onComplete) onComplete(data.results);
        } catch (err) {
            console.error('Batch processing failed:', err);
            setResults([{ status: 'error', error: err.message }]);
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadSvg = (result) => {
        if (!result.svg) return;
        const blob = new Blob([result.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.filename?.replace(/\.[^.]+$/, '') || 'vectorized'}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadAll = () => {
        results.filter(r => r.status === 'success').forEach(r => handleDownloadSvg(r));
    };

    const handleExport = async (result, format) => {
        try {
            const formData = new FormData();
            formData.append('job_id', result.job_id);
            formData.append('format', format);

            const res = await fetch(`${API_BASE}/export`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.filename?.replace(/\.[^.]+$/, '') || 'vectorized'}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return (
        <div className="w-full space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-white/90">
                        📦 Batch Processing
                    </h3>
                    <p className="text-sm text-surface-200/50 mt-1">
                        {files.length} image{files.length > 1 ? 's' : ''} queued
                        {results.length > 0 && ` • ${successCount} done${errorCount > 0 ? ` • ${errorCount} failed` : ''}`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onReset}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-800/60 text-surface-200/70 border border-surface-200/10 hover:bg-surface-700/60 hover:text-white/90 transition-all">
                        ↩ Reset
                    </button>
                    {results.length === 0 ? (
                        <button onClick={handleProcessAll} disabled={processing}
                            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${processing
                                    ? 'bg-surface-700/40 text-surface-200/40 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-accent-500 to-glow-cyan text-white shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40'
                                }`}>
                            {processing ? '⏳ Processing...' : '✨ Process All'}
                        </button>
                    ) : (
                        <button onClick={handleDownloadAll}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-glow-cyan text-white shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 transition-all">
                            ⬇ Download All SVG
                        </button>
                    )}
                </div>
            </div>

            {/* Processing bar */}
            {processing && (
                <div className="w-full h-2 rounded-full bg-surface-800/60 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-accent-500 to-glow-cyan rounded-full transition-all duration-500 animate-pulse" style={{ width: '60%' }} />
                </div>
            )}

            {/* File grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((file, i) => {
                    const result = results[i];
                    const previewUrl = URL.createObjectURL(file);
                    return (
                        <div key={i} className="rounded-xl border border-surface-200/10 bg-surface-900/40 overflow-hidden group">
                            {/* Thumbnail */}
                            <div className="aspect-square relative overflow-hidden bg-surface-800/40">
                                <img src={previewUrl} alt={file.name}
                                    className="w-full h-full object-cover" loading="lazy" />
                                {/* Overlay for status */}
                                {processing && !result && (
                                    <div className="absolute inset-0 bg-surface-950/60 flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full border-2 border-surface-200/30 border-t-accent-400 animate-spin" />
                                    </div>
                                )}
                                {result?.status === 'success' && (
                                    <div className="absolute inset-0 bg-accent-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-3xl">✓</span>
                                    </div>
                                )}
                                {result?.status === 'error' && (
                                    <div className="absolute inset-0 bg-glow-rose/10 flex items-center justify-center">
                                        <span className="text-2xl">❌</span>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3 space-y-2">
                                <p className="text-xs text-white/70 truncate">{file.name}</p>
                                <p className="text-[10px] text-surface-200/30">{(file.size / 1024).toFixed(0)} KB</p>

                                {result?.status === 'success' && (
                                    <div className="flex gap-1 flex-wrap">
                                        {['svg', 'pdf', 'eps', 'dxf'].map(fmt => (
                                            <button key={fmt} onClick={() => fmt === 'svg' ? handleDownloadSvg(result) : handleExport(result, fmt)}
                                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-800/60 text-surface-200/50 hover:text-accent-400 hover:bg-accent-500/10 transition-colors uppercase">
                                                {fmt}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {result?.status === 'error' && (
                                    <p className="text-[10px] text-glow-rose truncate">{result.error}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
