import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const ACCEPTED = {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
    'image/bmp': ['.bmp'],
    'image/tiff': ['.tiff'],
};

export default function UploadZone({ onUpload, onBatchUpload, error }) {
    const onDrop = useCallback(
        (accepted) => {
            if (accepted.length > 1 && onBatchUpload) {
                onBatchUpload(accepted);
            } else if (accepted.length > 0) {
                onUpload(accepted[0]);
            }
        },
        [onUpload, onBatchUpload],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: ACCEPTED,
        maxFiles: 20,
        maxSize: 20 * 1024 * 1024,
    });

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                {...getRootProps()}
                id="upload-dropzone"
                className={`
                    relative group cursor-pointer rounded-3xl overflow-hidden
                    transition-all duration-500 ease-out
                    ${isDragActive ? 'scale-[1.02] dropzone-active' : 'hover:scale-[1.01] hover:shadow-glass-lg'}
                `}
            >
                {/* Glassmorphic Background Layer */}
                <div className={`
                    absolute inset-0 transition-all duration-500
                    ${isDragActive ? 'bg-accent-500/10 backdrop-blur-xl' : 'glass-panel-heavy'}
                `} />

                {/* Animated Inner Glow on Hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-glow-cyan/10 via-transparent to-glow-violet/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {/* Border Glow */}
                <div className={`absolute inset-0 rounded-3xl border transition-colors duration-500 pointer-events-none ${isDragActive ? 'border-accent-400/80 shadow-[inset_0_0_30px_rgba(139,92,246,0.2)]' : 'border-surface-200/10 group-hover:border-surface-200/30'}`} />

                <div className="relative flex flex-col items-center justify-center py-20 px-8 z-10">
                    {/* Icon Container */}
                    <div className={`
                        w-24 h-24 rounded-3xl mb-8 flex items-center justify-center transition-all duration-500
                        ${isDragActive
                            ? 'bg-accent-500/20 shadow-neon scale-110 -translate-y-2'
                            : 'bg-surface-800/80 border border-surface-200/10 group-hover:bg-surface-800 group-hover:shadow-glass group-hover:-translate-y-1'
                        }
                    `}>
                        <svg className={`
                            w-12 h-12 transition-all duration-500 
                            ${isDragActive ? 'text-accent-400 scale-110 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]' : 'text-surface-200/40 group-hover:text-accent-400'}
                        `}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                        </svg>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                        {isDragActive ? 'Drop assets to transform' : 'Drag & drop image here'}
                    </h3>
                    <p className="text-base text-surface-200/60 mb-8 font-light">
                        or <span className="text-accent-400 font-medium group-hover:text-glow-cyan transition-colors underline decoration-accent-400/30 underline-offset-4">browse your computer</span>
                    </p>

                    {/* Formats Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {['PNG', 'JPG', 'WEBP', 'BMP'].map(fmt => (
                            <span key={fmt} className="px-3 py-1 text-[10px] font-bold tracking-wider text-surface-200/50 uppercase rounded-lg border border-surface-200/10 bg-surface-900/50">
                                {fmt}
                            </span>
                        ))}
                        <span className="text-surface-200/20 mx-1">|</span>
                        <span className="text-xs font-medium text-surface-200/40">Max 20MB</span>
                        <span className="text-surface-200/20 mx-1">|</span>
                        <span className="text-xs font-medium text-surface-200/40 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                            Batch Ready
                        </span>
                    </div>

                    <input {...getInputProps()} />
                </div>
            </div>

            {error && (
                <div className="mt-6 p-4 rounded-2xl bg-glow-rose/10 border border-glow-rose/20 flex items-start gap-3 animate-slideUp">
                    <svg className="w-5 h-5 shrink-0 text-glow-rose mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <p className="text-sm font-medium text-glow-rose leading-relaxed">{error}</p>
                </div>
            )}
        </div>
    );
}
