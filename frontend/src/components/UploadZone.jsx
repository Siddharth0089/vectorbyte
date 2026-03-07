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
        <div className="w-full">
            <div
                {...getRootProps()}
                id="upload-dropzone"
                className={`
          relative group cursor-pointer rounded-2xl border-2 border-dashed
          transition-all duration-300 ease-out
          ${isDragActive
                        ? 'border-accent-400 bg-accent-500/10 dropzone-active scale-[1.01]'
                        : 'border-surface-200/20 hover:border-accent-400/50 bg-surface-900/40 hover:bg-surface-800/40'
                    }
        `}
            >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-glow-cyan/5 via-transparent to-glow-violet/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative flex flex-col items-center justify-center py-16 md:py-24 px-6">
                    <div className={`
            w-20 h-20 rounded-2xl mb-6 flex items-center justify-center transition-all duration-300
            ${isDragActive
                            ? 'bg-accent-500/20 shadow-lg shadow-accent-500/20 scale-110'
                            : 'bg-surface-800/60 group-hover:bg-surface-700/60 group-hover:shadow-lg group-hover:shadow-accent-500/10'
                        }
          `}>
                        <svg className={`w-10 h-10 transition-colors duration-300 ${isDragActive ? 'text-accent-400' : 'text-surface-200/40 group-hover:text-accent-400/70'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                        </svg>
                    </div>

                    <p className="text-lg font-semibold text-white/90 mb-2">
                        {isDragActive ? 'Drop your image(s) here' : 'Drag & drop your image'}
                    </p>
                    <p className="text-sm text-surface-200/50 mb-2">
                        or <span className="text-accent-400 hover:text-accent-500 transition-colors">browse files</span>
                    </p>
                    <p className="text-xs text-surface-200/30 mb-4">
                        Drop multiple files for batch processing
                    </p>
                    <div className="flex items-center gap-2 text-xs text-surface-200/30">
                        <span className="px-2 py-0.5 rounded-full bg-surface-800/60">PNG</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-800/60">JPG</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-800/60">WEBP</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-800/60">BMP</span>
                        <span className="text-surface-200/20">·</span>
                        <span>Max 20 MB each</span>
                    </div>

                    <input {...getInputProps()} />
                </div>
            </div>

            {error && (
                <div className="mt-4 p-4 rounded-xl bg-glow-rose/10 border border-glow-rose/20">
                    <p className="text-sm text-glow-rose flex items-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        {error}
                    </p>
                </div>
            )}
        </div>
    );
}
