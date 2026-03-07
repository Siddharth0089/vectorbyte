/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                surface: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    700: '#1e293b',
                    750: '#161e2e', // New intermediate dark
                    800: '#0f172a',
                    850: '#0a0f1c', // Deep almost-black
                    900: '#050810', // Deepest obsidian
                    950: '#020308', // True background
                },
                accent: {
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    gradientStart: '#8b5cf6',
                    gradientEnd: '#3b82f6',
                },
                glow: {
                    cyan: '#06b6d4',
                    blue: '#3b82f6',
                    violet: '#8b5cf6',
                    rose: '#f43f5e',
                },
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                'glass-lg': '0 8px 32px 0 rgba(139, 92, 246, 0.15)',
                'neon': '0 0 20px rgba(139, 92, 246, 0.5)',
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'gradient-x': 'gradient-x 3s ease infinite',
                'gradient-slow': 'gradient-x 8s ease infinite',
                'float': 'float 6s ease-in-out infinite',
                'float-delayed': 'float 8s ease-in-out infinite 2s',
                'fadeIn': 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slideUp': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            },
            keyframes: {
                'gradient-x': {
                    '0%, 100%': { 'background-position': '0% 50%', 'background-size': '200% 200%' },
                    '50%': { 'background-position': '100% 50%', 'background-size': '200% 200%' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-15px)' },
                },
                'fadeIn': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'slideUp': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
};
