import { useState } from 'react';
import UploadZone from './components/UploadZone';
import SettingsPanel from './components/SettingsPanel';
import ProcessingStatus from './components/ProcessingStatus';
import ResultView from './components/ResultView';
import BatchView from './components/BatchView';
import SvgEditor from './components/SvgEditor';

const API_BASE = '/api';

const DEFAULT_SETTINGS = {
    detail_level: 'medium',
    color_count: 12,
    auto_colors: true,
    input_quality: 'medium',
    edge_smoothness: 50,
    noise_tolerance: 50,
    enable_superres: true,
    filter_speckle: null,
    corner_threshold: null,
    length_threshold: null,
    splice_threshold: null,
    path_precision: null,
    color_precision: null,
    layer_difference: null,
    max_iterations: null,
};

/**
 * App States:
 *   idle → settings → processing → done → editing
 *              ↑                       ↓
 *              └───────────────────────┘
 *   idle → batch
 */
export default function App() {
    const [status, setStatus] = useState('idle');
    // idle | settings | processing | done | editing | batch | error

    const [file, setFile] = useState(null);
    const [batchFiles, setBatchFiles] = useState([]);
    const [originalUrl, setOriginalUrl] = useState(null);
    const [svgData, setSvgData] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
    const [analysis, setAnalysis] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    // --- Single image upload → analyze → show settings ---
    const handleUpload = async (uploadedFile) => {
        setFile(uploadedFile);
        setSvgData(null);
        setOriginalUrl(null);
        setErrorMsg('');
        setAnalysis(null);
        setAnalyzing(true);
        setStatus('settings');

        const localPreview = URL.createObjectURL(uploadedFile);
        setOriginalUrl(localPreview);

        // Auto-analyze the image
        try {
            const formData = new FormData();
            formData.append('file', uploadedFile);
            const res = await fetch(`${API_BASE}/analyze`, {
                method: 'POST', body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setAnalysis(data.analysis);
                // Pre-populate settings with recommended values
                const rec = data.analysis.recommended_settings;
                setSettings(prev => ({
                    ...prev,
                    detail_level: rec.detail_level || prev.detail_level,
                    color_count: rec.color_count || prev.color_count,
                    input_quality: rec.input_quality || prev.input_quality,
                    edge_smoothness: rec.edge_smoothness ?? prev.edge_smoothness,
                    noise_tolerance: rec.noise_tolerance ?? prev.noise_tolerance,
                    enable_superres: rec.enable_superres ?? prev.enable_superres,
                }));
                if (data.original_url) {
                    setOriginalUrl(`${API_BASE}${data.original_url.startsWith('/api') ? data.original_url.slice(4) : data.original_url}`);
                }
            }
        } catch (err) {
            console.warn('Analysis failed, using defaults:', err);
        } finally {
            setAnalyzing(false);
        }
    };

    // --- Process with current settings ---
    const handleProcess = async () => {
        if (!file) return;
        setStatus('processing');
        setErrorMsg('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('settings', JSON.stringify(settings));

        try {
            const res = await fetch(`${API_BASE}/vectorize`, {
                method: 'POST', body: formData,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setSvgData(data.svg);
            setJobId(data.job_id || null);
            if (data.original_url) {
                setOriginalUrl(`${API_BASE}${data.original_url.startsWith('/api') ? data.original_url.slice(4) : data.original_url}`);
            }
            setStatus('done');
        } catch (err) {
            console.error('Processing failed:', err);
            setErrorMsg(err.message || 'Something went wrong');
            setStatus('error');
        }
    };

    // --- Batch upload ---
    const handleBatchUpload = (files) => {
        setBatchFiles(files);
        setStatus('batch');
    };

    // --- Enter SVG editor ---
    const handleEdit = () => {
        if (svgData) setStatus('editing');
    };

    // --- Save edited SVG ---
    const handleSaveEdit = (editedSvg) => {
        setSvgData(editedSvg);
        setStatus('done');
    };

    // --- Reset everything ---
    const handleReset = () => {
        setStatus('idle');
        setFile(null);
        setBatchFiles([]);
        setSvgData(null);
        setOriginalUrl(null);
        setJobId(null);
        setErrorMsg('');
        setSettings({ ...DEFAULT_SETTINGS });
        setAnalysis(null);
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Background ambient glow */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-glow-violet/[0.07] blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-glow-cyan/[0.05] blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-glow-rose/[0.03] blur-[150px]" />
            </div>

            {/* Header */}
            <header className="w-full py-6 px-6 md:px-12">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-glow-cyan via-accent-500 to-glow-rose flex items-center justify-center shadow-lg shadow-accent-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">
                            <span className="text-gradient">VectorForge</span>
                        </h1>
                    </div>
                    <p className="hidden sm:block text-sm text-surface-200/60 font-light">
                        AI-Powered Raster → Vector
                    </p>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
                <div className={`w-full mx-auto ${status === 'editing' ? 'max-w-[95vw]' : 'max-w-4xl'}`}>

                    {/* Title (idle only) */}
                    {status === 'idle' && (
                        <div className="text-center mb-10 animate-float">
                            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                                <span className="text-gradient">Transform Pixels</span><br />
                                <span className="text-white/90">Into Perfect Vectors</span>
                            </h2>
                            <p className="text-surface-200/60 text-lg max-w-xl mx-auto leading-relaxed">
                                Upload any raster image and our AI pipeline will analyze, super-resolve,
                                quantize, and vectorize it into a clean, scalable SVG.
                            </p>
                        </div>
                    )}

                    {/* Upload zone */}
                    {(status === 'idle' || status === 'error') && (
                        <UploadZone onUpload={handleUpload} onBatchUpload={handleBatchUpload} error={errorMsg} />
                    )}

                    {/* Settings panel (after analyze) */}
                    {status === 'settings' && (
                        <div className="space-y-6">
                            {/* Image preview */}
                            {originalUrl && (
                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-900/40 border border-surface-200/10">
                                    <img src={originalUrl} alt="Uploaded" className="w-20 h-20 object-cover rounded-xl border border-surface-200/10" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-white/80">{file?.name}</p>
                                        <p className="text-xs text-surface-200/40">{file ? (file.size / 1024).toFixed(0) + ' KB' : ''}</p>
                                    </div>
                                    <button onClick={handleReset}
                                        className="px-3 py-1.5 rounded-lg text-xs text-surface-200/50 bg-surface-800/50 hover:text-white/70 transition-colors">
                                        Change
                                    </button>
                                </div>
                            )}

                            {analyzing ? (
                                <div className="flex items-center justify-center py-12 gap-3">
                                    <div className="w-6 h-6 rounded-full border-2 border-accent-400/30 border-t-accent-400 animate-spin" />
                                    <p className="text-sm text-surface-200/50">Analyzing image...</p>
                                </div>
                            ) : (
                                <SettingsPanel
                                    analysis={analysis}
                                    settings={settings}
                                    onChange={setSettings}
                                    onProcess={handleProcess}
                                    loading={false}
                                />
                            )}
                        </div>
                    )}

                    {/* Processing */}
                    {status === 'processing' && (
                        <ProcessingStatus status="processing" />
                    )}

                    {/* Result */}
                    {status === 'done' && svgData && (
                        <ResultView
                            originalUrl={originalUrl}
                            svgData={svgData}
                            jobId={jobId}
                            onReset={handleReset}
                            onEdit={handleEdit}
                        />
                    )}

                    {/* SVG Editor */}
                    {status === 'editing' && svgData && (
                        <SvgEditor
                            svgData={svgData}
                            onSave={handleSaveEdit}
                            onClose={() => setStatus('done')}
                        />
                    )}

                    {/* Batch mode */}
                    {status === 'batch' && (
                        <BatchView
                            files={batchFiles}
                            settings={settings}
                            onReset={handleReset}
                        />
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full py-4 px-6 text-center">
                <p className="text-xs text-surface-200/30">
                    Powered by Real-ESRGAN · OpenCV · vtracer · SVGO · CairoSVG
                </p>
            </footer>
        </div>
    );
}
