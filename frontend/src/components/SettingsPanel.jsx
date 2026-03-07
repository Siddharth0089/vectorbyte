import { useState, useCallback } from 'react';

/**
 * SettingsPanel — Advanced pipeline configuration UI
 *
 * Shows auto-detected settings from /api/analyze with manual override controls.
 * Includes detail level, color count, input quality, edge smoothness,
 * noise tolerance, and advanced vtracer parameter toggles.
 */
export default function SettingsPanel({ analysis, settings, onChange, onProcess, loading }) {
    const diagnostics = analysis?.diagnostics || {};
    const recommended = analysis?.recommended_settings || {};

    const [showAdvanced, setShowAdvanced] = useState(false);

    // Update setting helper
    const set = useCallback((key, value) => {
        onChange({ ...settings, [key]: value });
    }, [settings, onChange]);

    const detailOptions = [
        { value: 'low', label: 'Low', desc: 'Simplify shapes, fewer details' },
        { value: 'medium', label: 'Medium', desc: 'Balanced detail and smoothness' },
        { value: 'high', label: 'High', desc: 'Preserve all fine details' },
    ];

    const qualityOptions = [
        { value: 'low', label: 'Pixelated', desc: 'Low-res / pixel art input' },
        { value: 'medium', label: 'Medium', desc: 'Standard resolution' },
        { value: 'high', label: 'High Quality', desc: 'High-res, sharp input' },
    ];

    return (
        <div className="w-full space-y-6 animate-fadeIn">
            {/* Diagnostics Banner */}
            {diagnostics.image_type && (
                <div className="flex items-center gap-4 p-5 rounded-2xl glass-panel relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-accent-500/10 via-glow-cyan/5 to-glow-violet/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative w-14 h-14 rounded-xl bg-surface-800/80 border border-surface-200/10 flex items-center justify-center text-3xl shrink-0 shadow-lg shadow-black/20 group-hover:scale-105 transition-transform duration-300">
                        {diagnostics.is_logo_or_icon ? '🎯' : diagnostics.is_photograph ? '📸' : '🎨'}
                    </div>
                    <div className="relative flex-1">
                        <p className="text-sm font-bold text-white/90 tracking-wide">
                            Detected: <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-glow-cyan uppercase tracking-wider">{diagnostics.image_type}</span>
                        </p>
                        <p className="text-xs text-surface-200/50 mt-1 font-medium">
                            {diagnostics.image_width}×{diagnostics.image_height}px • {diagnostics.detected_colors} colors
                            • Detail score: {diagnostics.detail_score}
                        </p>
                    </div>
                    <div className="relative ml-auto hidden sm:flex gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-surface-900/60 border border-surface-200/5 text-xs font-semibold text-surface-200/50 shadow-inner">
                            Noise: {diagnostics.noise_level}
                        </span>
                    </div>
                </div>
            )}

            {/* Detail Level */}
            <SettingGroup
                label="Detail Level"
                autoValue={recommended.detail_level}
                description="Controls how much detail is preserved in the vector output"
            >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {detailOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => set('detail_level', opt.value)}
                            className={`relative p-4 rounded-xl border text-left transition-all duration-300 overflow-hidden ${settings.detail_level === opt.value
                                ? 'border-accent-400 bg-accent-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)] -translate-y-0.5'
                                : 'border-surface-200/10 bg-surface-900/40 hover:border-surface-200/30 hover:bg-surface-800/40 hover:-translate-y-0.5'
                                }`}
                        >
                            {settings.detail_level === opt.value && (
                                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-glow-cyan to-accent-500" />
                            )}
                            <p className={`text-sm font-bold mb-1 ${settings.detail_level === opt.value ? 'text-white' : 'text-white/70'
                                }`}>{opt.label}</p>
                            <p className="text-xs text-surface-200/40 leading-relaxed">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </SettingGroup>

            {/* Color Count */}
            <SettingGroup
                label="Color Count"
                autoValue={recommended.color_count}
                description="Number of colors in the quantized SVG"
            >
                <div className="flex items-center gap-5 p-4 rounded-xl bg-surface-900/40 border border-surface-200/10">
                    <input
                        type="range"
                        min="2"
                        max="64"
                        value={settings.color_count}
                        onChange={(e) => set('color_count', parseInt(e.target.value))}
                        className="flex-1 accent-accent-500 h-1.5 rounded-full appearance-none bg-surface-800 border border-surface-200/5
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-400
                            [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(139,92,246,0.5)]
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                            [&::-webkit-slider-thumb]:hover:scale-125"
                    />
                    <div className="w-16 h-10 rounded-lg bg-surface-800/80 border border-surface-200/20 flex items-center justify-center shadow-inner">
                        <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-surface-200/50">
                            {settings.color_count}
                        </span>
                    </div>
                </div>
                <div className="flex justify-between text-[10px] font-bold tracking-wider uppercase text-surface-200/30 mt-2 px-1">
                    <span>2 (Minimal)</span>
                    <span>64 (Maximum)</span>
                </div>
            </SettingGroup>

            {/* Input Quality */}
            <SettingGroup
                label="Input Quality"
                autoValue={recommended.input_quality}
                description="How the pipeline handles the source image quality"
            >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {qualityOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => set('input_quality', opt.value)}
                            className={`relative p-4 rounded-xl border text-left transition-all duration-300 overflow-hidden ${settings.input_quality === opt.value
                                ? 'border-glow-cyan bg-glow-cyan/10 shadow-[0_0_20px_rgba(6,182,212,0.15)] -translate-y-0.5'
                                : 'border-surface-200/10 bg-surface-900/40 hover:border-surface-200/30 hover:bg-surface-800/40 hover:-translate-y-0.5'
                                }`}
                        >
                            {settings.input_quality === opt.value && (
                                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent-500 to-glow-cyan" />
                            )}
                            <p className={`text-sm font-bold mb-1 ${settings.input_quality === opt.value ? 'text-white' : 'text-white/70'
                                }`}>{opt.label}</p>
                            <p className="text-xs text-surface-200/40 leading-relaxed">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </SettingGroup>

            {/* Edge Smoothness & Noise Tolerance — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SettingGroup
                    label="Edge Smoothness"
                    autoValue={recommended.edge_smoothness}
                    description="Higher = smoother curves"
                >
                    <div className="p-4 rounded-xl bg-surface-900/40 border border-surface-200/10">
                        <SliderControl
                            value={settings.edge_smoothness}
                            onChange={(v) => set('edge_smoothness', v)}
                            min={0}
                            max={100}
                            color="cyan"
                        />
                    </div>
                </SettingGroup>

                <SettingGroup
                    label="Noise Tolerance"
                    autoValue={recommended.noise_tolerance}
                    description="Higher = more noise rejection"
                >
                    <div className="p-4 rounded-xl bg-surface-900/40 border border-surface-200/10">
                        <SliderControl
                            value={settings.noise_tolerance}
                            onChange={(v) => set('noise_tolerance', v)}
                            min={0}
                            max={100}
                            color="violet"
                        />
                    </div>
                </SettingGroup>
            </div>

            {/* Super-Resolution Toggle */}
            <div className="flex items-center justify-between p-5 rounded-2xl glass-panel group cursor-pointer border hover:border-surface-200/20 transition-all"
                onClick={() => set('enable_superres', !settings.enable_superres)}
            >
                <div>
                    <p className="text-sm font-bold text-white/90 flex items-center gap-2">
                        AI Super-Resolution (4×)
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-accent-500/20 text-accent-400 border border-accent-500/30">Pro</span>
                    </p>
                    <p className="text-xs text-surface-200/50 mt-1 font-medium">Real-ESRGAN upscaling before vectorization</p>
                </div>
                <div
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 pointer-events-none shadow-inner ${settings.enable_superres ? 'bg-accent-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'bg-surface-800 border border-surface-200/10'
                        }`}
                >
                    <div className={`absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white transition-transform duration-300 ${settings.enable_superres ? 'translate-x-[28px] shadow-sm' : 'translate-x-0 opacity-60'
                        }`} />
                </div>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="rounded-2xl glass-panel overflow-hidden transition-all duration-500 border border-surface-200/10 hover:border-surface-200/20">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-5 hover:bg-surface-800/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center border border-surface-200/10 shadow-inner">
                            <svg className="w-4 h-4 text-surface-200/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-surface-200/80">Expert Overrides</span>
                    </div>
                    <svg
                        className={`w-5 h-5 text-surface-200/40 transition-transform duration-300 ${showAdvanced ? 'rotate-180 text-accent-400' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>

                <div className={`transition-all duration-500 ease-in-out ${showAdvanced ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-5 pt-0 space-y-6 bg-surface-900/10">

                        {/* New Expert Overrides */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-surface-200/5">
                            <SelectInput label="Image Profile" value={settings.image_profile}
                                onChange={(v) => set('image_profile', v)}
                                options={[{ val: 'auto', lbl: 'Auto (Recommended)' }, { val: 'photo', lbl: 'Photograph' }, { val: 'logo', lbl: 'Logo & 2D Art' }, { val: 'pixel_art', lbl: 'Pixel Art (8-bit)' }]} />

                            <SelectInput label="AI Upscale Model" value={settings.ai_model}
                                onChange={(v) => set('ai_model', v)}
                                options={[{ val: 'general', lbl: 'General Photo (Default)' }, { val: 'anime', lbl: 'Anime & 2D Art' }]} />

                            <SelectInput label="Tracing Engine" value={settings.tracing_engine}
                                onChange={(v) => set('tracing_engine', v)}
                                options={[{ val: 'vtracer', lbl: 'V-Tracer (Full Color)' }, { val: 'potrace', lbl: 'Potrace (B&W)' }]} />

                            <SelectInput label="Color Clustering" value={settings.clustering_method}
                                onChange={(v) => set('clustering_method', v)}
                                options={[{ val: 'kmeans', lbl: 'K-Means (Fast)' }, { val: 'mean_shift', lbl: 'Mean-Shift (Accurate)' }]} />
                        </div>

                        {/* Existing Vtracer Overrides */}
                        <div>
                            <p className="text-[10px] font-black tracking-widest text-surface-200/30 uppercase mb-4">V-Tracer Parameters</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <NumberInput label="Filter Speckle" value={settings.filter_speckle} placeholder="Auto"
                                    onChange={(v) => set('filter_speckle', v)} min={1} max={50} />
                                <NumberInput label="Corner Thresh" value={settings.corner_threshold} placeholder="Auto"
                                    onChange={(v) => set('corner_threshold', v)} min={10} max={180} />
                                <NumberInput label="Length Thresh" value={settings.length_threshold} placeholder="Auto"
                                    onChange={(v) => set('length_threshold', v)} min={0.5} max={20} step={0.5} />
                                <NumberInput label="Splice Thresh" value={settings.splice_threshold} placeholder="Auto"
                                    onChange={(v) => set('splice_threshold', v)} min={10} max={180} />
                                <NumberInput label="Path Precision" value={settings.path_precision} placeholder="Auto"
                                    onChange={(v) => set('path_precision', v)} min={1} max={8} />
                                <NumberInput label="Color Precision" value={settings.color_precision} placeholder="Auto"
                                    onChange={(v) => set('color_precision', v)} min={1} max={10} />
                                <NumberInput label="Layer Diff" value={settings.layer_difference} placeholder="Auto"
                                    onChange={(v) => set('layer_difference', v)} min={1} max={64} />
                                <NumberInput label="Max Iters" value={settings.max_iterations} placeholder="Auto"
                                    onChange={(v) => set('max_iterations', v)} min={1} max={30} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Process Button */}
            <div className="pt-4">
                <button
                    id="process-button"
                    onClick={onProcess}
                    disabled={loading}
                    className={`group relative w-full h-16 rounded-2xl text-lg font-bold transition-all duration-300 overflow-hidden ${loading
                        ? 'bg-surface-800 text-surface-200/40 border border-surface-200/10 cursor-not-allowed'
                        : 'bg-gradient-to-r from-accent-600 via-glow-violet bg-glow-blue text-white shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] hover:-translate-y-1'
                        }`}
                    style={!loading ? { backgroundSize: '200% auto', animation: 'gradient-x 3s linear infinite' } : {}}
                >
                    {!loading && (
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4xKSIvPjwvc3ZnPg==')] opacity-30 mix-blend-overlay pointer-events-none" />
                    )}

                    <div className="relative flex items-center justify-center gap-3">
                        {loading ? (
                            <>
                                <div className="w-6 h-6 rounded-full border-2 border-surface-200/20 border-t-surface-200/60 animate-spin" />
                                <span>Generating Vector...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-6 h-6 text-white/90 group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                                </svg>
                                <span>Vectorize Image</span>
                            </>
                        )}
                    </div>
                </button>
            </div>
        </div>
    );
}

// --- Sub-components ---

function SettingGroup({ label, autoValue, description, children }) {
    return (
        <div className="space-y-3">
            <div className="flex items-end justify-between">
                <div>
                    <label className="text-sm font-bold text-white/90">{label}</label>
                    {description && (
                        <p className="text-xs font-medium text-surface-200/40 mt-1">{description}</p>
                    )}
                </div>
                {autoValue !== undefined && (
                    <span className="px-2.5 py-1 rounded-[6px] bg-accent-500/15 text-[10px] font-black text-accent-400 tracking-wider uppercase border border-accent-500/20 shadow-sm shrink-0">
                        Auto: {autoValue}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}

function SliderControl({ value, onChange, min, max, color = 'cyan' }) {
    const colorClasses = color === 'cyan'
        ? 'accent-glow-cyan [&::-webkit-slider-thumb]:bg-glow-cyan [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.8)]'
        : 'accent-glow-violet [&::-webkit-slider-thumb]:bg-glow-violet [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.8)]';

    return (
        <div className="flex items-center gap-4">
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`flex-1 h-1.5 rounded-full appearance-none bg-surface-800 border border-surface-200/5
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                    ${colorClasses}`}
            />
            <span className="w-8 text-right text-sm font-black text-surface-200/70">{value}</span>
        </div>
    );
}

function NumberInput({ label, value, onChange, placeholder, min, max, step = 1 }) {
    return (
        <div className="group">
            <label className="text-[10px] font-bold tracking-wider text-surface-200/40 uppercase mb-1.5 block group-focus-within:text-accent-400 transition-colors">{label}</label>
            <input
                type="number"
                value={value ?? ''}
                placeholder={placeholder}
                min={min}
                max={max}
                step={step}
                onChange={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    onChange(v);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-800 border border-surface-200/10 shadow-inner
                    text-sm font-semibold text-white/90 placeholder:text-surface-200/20 placeholder:font-medium
                    focus:outline-none focus:border-accent-500/50 focus:bg-surface-800/80 focus:shadow-[0_0_10px_rgba(139,92,246,0.1)]
                    transition-all appearance-none"
            />
        </div>
    );
}

function SelectInput({ label, value, onChange, options }) {
    return (
        <div className="group relative">
            <label className="text-[10px] font-bold tracking-wider text-surface-200/40 uppercase mb-1.5 block group-focus-within:text-accent-400 transition-colors">{label}</label>
            <select
                value={value ?? 'auto'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-surface-800 border border-surface-200/10 shadow-inner
                    text-sm font-semibold text-white/90 focus:outline-none focus:border-accent-500/50 focus:bg-surface-800/80 focus:shadow-[0_0_10px_rgba(139,92,246,0.1)]
                    transition-all appearance-none cursor-pointer"
            >
                {options.map(opt => (
                    <option key={opt.val} value={opt.val} className="bg-surface-800 text-white/90 font-medium">
                        {opt.lbl}
                    </option>
                ))}
            </select>
            <div className="absolute right-3 top-[26px] pointer-events-none text-surface-200/30 group-focus-within:text-accent-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
            </div>
        </div>
    );
}
