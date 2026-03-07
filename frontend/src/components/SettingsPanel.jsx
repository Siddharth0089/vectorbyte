import { useState, useEffect, useMemo, useCallback } from 'react';

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
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-accent-500/10 via-glow-cyan/5 to-glow-violet/10 border border-accent-500/20">
                    <div className="w-12 h-12 rounded-xl bg-accent-500/20 flex items-center justify-center text-2xl shrink-0">
                        {diagnostics.is_logo_or_icon ? '🎯' : diagnostics.is_photograph ? '📸' : '🎨'}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white/90">
                            Detected: <span className="text-accent-400 capitalize">{diagnostics.image_type}</span>
                        </p>
                        <p className="text-xs text-surface-200/50 mt-0.5">
                            {diagnostics.image_width}×{diagnostics.image_height}px • {diagnostics.detected_colors} colors detected
                            • Detail score: {diagnostics.detail_score}
                        </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-surface-800/60 text-xs text-surface-200/60">
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
                <div className="grid grid-cols-3 gap-2">
                    {detailOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => set('detail_level', opt.value)}
                            className={`relative p-3 rounded-xl border text-left transition-all duration-200 ${settings.detail_level === opt.value
                                ? 'border-accent-400 bg-accent-500/10 shadow-lg shadow-accent-500/10'
                                : 'border-surface-200/10 bg-surface-900/40 hover:border-surface-200/20 hover:bg-surface-800/40'
                                }`}
                        >
                            {settings.detail_level === opt.value && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-400" />
                            )}
                            <p className={`text-sm font-semibold ${settings.detail_level === opt.value ? 'text-accent-400' : 'text-white/80'
                                }`}>{opt.label}</p>
                            <p className="text-xs text-surface-200/40 mt-0.5">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </SettingGroup>

            {/* Color Count */}
            <SettingGroup
                label="Color Count"
                autoValue={recommended.color_count}
                description="Number of colors in the quantized image"
            >
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min="2"
                        max="64"
                        value={settings.color_count}
                        onChange={(e) => set('color_count', parseInt(e.target.value))}
                        className="flex-1 accent-accent-500 h-2 rounded-full appearance-none bg-surface-700/50
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-400
                            [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-accent-500/30
                            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                            [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                    <div className="w-14 h-10 rounded-lg bg-surface-800/60 border border-surface-200/10 flex items-center justify-center text-sm font-bold text-accent-400">
                        {settings.color_count}
                    </div>
                </div>
                <div className="flex justify-between text-xs text-surface-200/30 mt-1 px-0.5">
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
                <div className="grid grid-cols-3 gap-2">
                    {qualityOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => set('input_quality', opt.value)}
                            className={`p-3 rounded-xl border text-left transition-all duration-200 ${settings.input_quality === opt.value
                                ? 'border-glow-cyan bg-glow-cyan/10 shadow-lg shadow-glow-cyan/10'
                                : 'border-surface-200/10 bg-surface-900/40 hover:border-surface-200/20 hover:bg-surface-800/40'
                                }`}
                        >
                            <p className={`text-sm font-semibold ${settings.input_quality === opt.value ? 'text-glow-cyan' : 'text-white/80'
                                }`}>{opt.label}</p>
                            <p className="text-xs text-surface-200/40 mt-0.5">{opt.desc}</p>
                        </button>
                    ))}
                </div>
            </SettingGroup>

            {/* Edge Smoothness & Noise Tolerance — side by side */}
            <div className="grid grid-cols-2 gap-4">
                <SettingGroup
                    label="Edge Smoothness"
                    autoValue={recommended.edge_smoothness}
                    description="Higher = smoother curves"
                >
                    <SliderControl
                        value={settings.edge_smoothness}
                        onChange={(v) => set('edge_smoothness', v)}
                        min={0}
                        max={100}
                        color="cyan"
                    />
                </SettingGroup>

                <SettingGroup
                    label="Noise Tolerance"
                    autoValue={recommended.noise_tolerance}
                    description="Higher = more noise rejection"
                >
                    <SliderControl
                        value={settings.noise_tolerance}
                        onChange={(v) => set('noise_tolerance', v)}
                        min={0}
                        max={100}
                        color="violet"
                    />
                </SettingGroup>
            </div>

            {/* Super-Resolution Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-900/40 border border-surface-200/10">
                <div>
                    <p className="text-sm font-semibold text-white/80">AI Super-Resolution (4×)</p>
                    <p className="text-xs text-surface-200/40 mt-0.5">Real-ESRGAN upscaling before vectorization</p>
                </div>
                <button
                    onClick={() => set('enable_superres', !settings.enable_superres)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settings.enable_superres ? 'bg-accent-500' : 'bg-surface-700/60'
                        }`}
                >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${settings.enable_superres ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                </button>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="rounded-xl border border-surface-200/10 overflow-hidden">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-4 bg-surface-900/30 hover:bg-surface-800/30 transition-colors"
                >
                    <span className="text-sm font-semibold text-surface-200/60">Advanced vtracer Parameters</span>
                    <svg
                        className={`w-4 h-4 text-surface-200/40 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>

                {showAdvanced && (
                    <div className="p-4 space-y-4 bg-surface-900/20 border-t border-surface-200/5">

                        {/* New Expert Overrides */}
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-surface-200/5">
                            <SelectInput label="Image Profile" value={settings.image_profile}
                                onChange={(v) => set('image_profile', v)}
                                options={[{ val: 'auto', lbl: 'Auto (Recommended)' }, { val: 'photo', lbl: 'Photograph' }, { val: 'logo', lbl: 'Logo & 2D Art' }, { val: 'pixel_art', lbl: 'Pixel Art (8-bit)' }]} />

                            <SelectInput label="AI Upscale Model" value={settings.ai_model}
                                onChange={(v) => set('ai_model', v)}
                                options={[{ val: 'general', lbl: 'General Photo (Default)' }, { val: 'anime', lbl: 'Anime & 2D Art (Sharper lines)' }]} />

                            <SelectInput label="Tracing Engine" value={settings.tracing_engine}
                                onChange={(v) => set('tracing_engine', v)}
                                options={[{ val: 'vtracer', lbl: 'V-Tracer (Full Color)' }, { val: 'potrace', lbl: 'Potrace (B&W Perfection)' }]} />

                            <SelectInput label="Color Clustering" value={settings.clustering_method}
                                onChange={(v) => set('clustering_method', v)}
                                options={[{ val: 'kmeans', lbl: 'K-Means (Fast)' }, { val: 'mean_shift', lbl: 'Mean-Shift (Accurate)' }]} />
                        </div>

                        {/* Existing Vtracer Overrides */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <NumberInput label="Filter Speckle" value={settings.filter_speckle} placeholder="Auto"
                                onChange={(v) => set('filter_speckle', v)} min={1} max={50} />
                            <NumberInput label="Corner Threshold" value={settings.corner_threshold} placeholder="Auto"
                                onChange={(v) => set('corner_threshold', v)} min={10} max={180} />
                            <NumberInput label="Length Threshold" value={settings.length_threshold} placeholder="Auto"
                                onChange={(v) => set('length_threshold', v)} min={0.5} max={20} step={0.5} />
                            <NumberInput label="Splice Threshold" value={settings.splice_threshold} placeholder="Auto"
                                onChange={(v) => set('splice_threshold', v)} min={10} max={180} />
                            <NumberInput label="Path Precision" value={settings.path_precision} placeholder="Auto"
                                onChange={(v) => set('path_precision', v)} min={1} max={8} />
                            <NumberInput label="Color Precision" value={settings.color_precision} placeholder="Auto"
                                onChange={(v) => set('color_precision', v)} min={1} max={10} />
                            <NumberInput label="Layer Difference" value={settings.layer_difference} placeholder="Auto"
                                onChange={(v) => set('layer_difference', v)} min={1} max={64} />
                            <NumberInput label="Max Iterations" value={settings.max_iterations} placeholder="Auto"
                                onChange={(v) => set('max_iterations', v)} min={1} max={30} />
                        </div>
                    </div>
                )}
            </div>

            {/* Process Button */}
            <button
                id="process-button"
                onClick={onProcess}
                disabled={loading}
                className={`w-full py-4 rounded-2xl text-base font-bold transition-all duration-300 ${loading
                    ? 'bg-surface-700/40 text-surface-200/40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-accent-500 via-glow-violet to-glow-cyan text-white shadow-xl shadow-accent-500/25 hover:shadow-accent-500/40 hover:scale-[1.01] active:scale-[0.99]'
                    }`}
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-surface-200/30 border-t-accent-400 animate-spin" />
                        Processing...
                    </span>
                ) : (
                    '✨ Vectorize Image'
                )}
            </button>
        </div>
    );
}


// --- Sub-components ---

function SettingGroup({ label, autoValue, description, children }) {
    return (
        <div className="space-y-2.5">
            <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-white/80">{label}</label>
                {autoValue !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-accent-500/15 text-[10px] font-medium text-accent-400 tracking-wide uppercase">
                        Auto: {autoValue}
                    </span>
                )}
            </div>
            {description && (
                <p className="text-xs text-surface-200/35 -mt-1">{description}</p>
            )}
            {children}
        </div>
    );
}


function SliderControl({ value, onChange, min, max, color = 'cyan' }) {
    const colorClasses = color === 'cyan'
        ? 'accent-glow-cyan [&::-webkit-slider-thumb]:bg-glow-cyan [&::-webkit-slider-thumb]:shadow-glow-cyan/30'
        : 'accent-glow-violet [&::-webkit-slider-thumb]:bg-glow-violet [&::-webkit-slider-thumb]:shadow-glow-violet/30';

    return (
        <div className="flex items-center gap-3">
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`flex-1 h-2 rounded-full appearance-none bg-surface-700/50
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:cursor-pointer ${colorClasses}`}
            />
            <span className="w-10 text-right text-sm font-bold text-surface-200/70">{value}</span>
        </div>
    );
}


function NumberInput({ label, value, onChange, placeholder, min, max, step = 1 }) {
    return (
        <div>
            <label className="text-xs text-surface-200/50 mb-1 block">{label}</label>
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
                className="w-full px-3 py-2 rounded-lg bg-surface-800/60 border border-surface-200/10
                    text-sm text-white/80 placeholder:text-surface-200/30
                    focus:outline-none focus:border-accent-400/50 focus:ring-1 focus:ring-accent-400/20
                    transition-all"
            />
        </div>
    );
}

function SelectInput({ label, value, onChange, options }) {
    return (
        <div>
            <label className="text-xs text-surface-200/50 mb-1 block">{label}</label>
            <select
                value={value ?? 'auto'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-800/60 border border-surface-200/10
                    text-sm text-white/80 focus:outline-none focus:border-accent-400/50 focus:ring-1 focus:ring-accent-400/20
                    transition-all appearance-none cursor-pointer"
            >
                {options.map(opt => (
                    <option key={opt.val} value={opt.val} className="bg-surface-800 text-white/90">
                        {opt.lbl}
                    </option>
                ))}
            </select>
        </div>
    );
}
