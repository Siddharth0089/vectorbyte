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
        <div className="min-h-screen flex flex-col font-sans text-white bg-surface-950 selection:bg-accent-500/30">
            {/* Dynamic ambient glowing background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-accent-600/10 blur-[120px] mix-blend-screen animate-float" />
                <div className="absolute top-[20%] -right-[20%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-glow-blue/10 blur-[120px] mix-blend-screen animate-float-delayed" />
                <div className="absolute -bottom-[20%] left-[20%] w-[80vw] h-[80vw] max-w-[900px] max-h-[900px] rounded-full bg-glow-cyan/5 blur-[150px] mix-blend-screen animate-pulse-slow" />

                {/* Subtle grid overlay for texture */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNCkiLz48L3N2Zz4=')] opacity-50" />
            </div>

            {/* Glass Header */}
            <header className="fixed top-0 inset-x-0 z-50 border-b border-surface-200/5 bg-surface-900/40 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-20">
                    <div className="flex items-center gap-4 cursor-pointer group" onClick={handleReset}>
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-glow-cyan via-accent-500 to-glow-blue blur opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative w-full h-full rounded-xl bg-surface-900 border border-white/10 flex items-center justify-center shadow-2xl">
                                <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-500 ease-out" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            <span className="text-gradient">VectorByte</span>
                        </h1>
                    </div>

                    <div className="hidden sm:flex items-center gap-6">
                        <a href="https://github.com/Siddharth0089/vectorbyte" target="_blank" rel="noreferrer" className="text-sm font-medium text-surface-200/60 hover:text-white transition-colors">Documentation</a>
                        <div className="h-4 w-px bg-surface-200/10" />
                        <span className="text-sm font-medium px-4 py-1.5 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20">
                            v2.0 Pro
                        </span>
                    </div>
                </div>
            </header>

            {/* Main content - padding top to account for fixed header */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 pt-32 pb-24 w-full">
                <div className={`w-full mx-auto transition-all duration-500 ease-out ${status === 'editing' ? 'max-w-[95vw]' : 'max-w-4xl'}`}>

                    {/* Marketing Title (idle only) */}
                    {status === 'idle' && (
                        <div className="text-center mb-16 animate-slideUp">
                            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                                <span className="text-white">Transform Pixels</span><br />
                                <span className="text-gradient">Into Perfect Vectors</span>
                            </h2>
                            <p className="text-surface-200/60 text-lg md:text-xl font-light max-w-2xl mx-auto leading-relaxed">
                                Upload any raster image and our AI pipeline will analyze, super-resolve,
                                quantize, and vectorize it into a clean, infinitely scalable SVG.
                            </p>
                        </div>
                    )}

                    {/* Main Card Container */}
                    <div className={`transition-all duration-500 ${status !== 'idle' ? 'animate-slideUp' : ''}`}>
                        {/* Upload zone */}
                        {(status === 'idle' || status === 'error') && (
                            <UploadZone onUpload={handleUpload} onBatchUpload={handleBatchUpload} error={errorMsg} />
                        )}

                        {/* Settings panel (after analyze) */}
                        {status === 'settings' && (
                            <div className="space-y-6">
                                {/* Image preview Header Card */}
                                {originalUrl && (
                                    <div className="glass-panel rounded-2xl p-4 flex items-center gap-5 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-accent-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-surface-200/10 shadow-2xl bg-surface-900 shrink-0">
                                            <img src={originalUrl} alt="Uploaded" className="w-full h-full object-cover" />
                                        </div>

                                        <div className="flex-1 relative z-10">
                                            <p className="text-base font-bold text-white tracking-wide truncate">{file?.name}</p>
                                            <p className="text-sm font-medium text-surface-200/40 mt-0.5">{(file?.size / 1024).toFixed(1)} KB • Raster Image</p>
                                        </div>

                                        <button onClick={handleReset}
                                            className="relative z-10 px-4 py-2 rounded-xl text-sm font-medium text-surface-200/60 hover:text-white bg-surface-800/50 hover:bg-surface-700/80 border border-surface-200/5 hover:border-surface-200/20 transition-all shadow-lg">
                                            Change Image
                                        </button>
                                    </div>
                                )}

                                {analyzing ? (
                                    <div className="glass-panel rounded-3xl p-16 flex flex-col items-center justify-center gap-6">
                                        <div className="relative w-16 h-16">
                                            <div className="absolute inset-0 rounded-full border-4 border-surface-800" />
                                            <div className="absolute inset-0 rounded-full border-4 border-accent-500 border-t-transparent animate-spin" />
                                            <div className="absolute inset-0 rounded-full border-4 border-glow-cyan border-b-transparent animate-spin mix-blend-screen" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-white mb-1">Analyzing Image Structure...</p>
                                            <p className="text-sm text-surface-200/40">Detecting edges, noise, and color palettes</p>
                                        </div>
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
                </div>
            </main>

            {/* Glass Footer */}
            <footer className="w-full py-6 bg-surface-900/40 backdrop-blur-md border-t border-surface-200/5 text-center relative z-10">
                <p className="text-sm font-medium text-surface-200/40">
                    Engineered with <span className="text-accent-400">Real-ESRGAN</span> · <span className="text-glow-cyan">V-Tracer</span> · <span className="text-glow-blue">Potrace</span>
                </p>
                <p className="text-xs text-surface-200/20 mt-2 tracking-widest uppercase">
                    VectorByte Pro Pipeline © {new Date().getFullYear()}
                </p>
            </footer>
        </div>
    );
}
