const STAGES = [
    { label: 'Uploading image', icon: '📤' },
    { label: 'AI Super-Resolution (Real-ESRGAN)', icon: '🧠' },
    { label: 'Noise Reduction (Bilateral Filter)', icon: '🔇' },
    { label: 'Color Quantization (K-Means)', icon: '🎨' },
    { label: 'Vectorization (vtracer)', icon: '✏️' },
    { label: 'SVG Optimization (SVGO)', icon: '⚡' },
];

export default function ProcessingStatus({ status }) {
    const isUploading = status === 'uploading';

    return (
        <div className="w-full flex flex-col items-center py-12">
            {/* Spinner */}
            <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-surface-700/50" />
                <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-accent-400 border-r-glow-cyan animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-500/20 to-glow-cyan/20 animate-pulse-slow" />
                </div>
            </div>

            {/* Status text */}
            <h3 className="text-xl font-semibold text-white/90 mb-2">
                {isUploading ? 'Uploading...' : 'Processing your image'}
            </h3>
            <p className="text-sm text-surface-200/50 mb-8">
                {isUploading
                    ? 'Sending your image to the server'
                    : 'Running 5-stage AI pipeline — this may take a minute'
                }
            </p>

            {/* Pipeline stages */}
            {!isUploading && (
                <div className="w-full max-w-md space-y-3">
                    {STAGES.slice(1).map((stage, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-900/50 border border-surface-200/10"
                            style={{
                                animation: `fadeIn 0.4s ease-out ${i * 0.15}s both`,
                            }}
                        >
                            <span className="text-lg">{stage.icon}</span>
                            <span className="text-sm text-surface-200/60">{stage.label}</span>
                            <div className="ml-auto">
                                <div className="w-4 h-4 rounded-full border-2 border-accent-400/40 border-t-accent-400 animate-spin" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
