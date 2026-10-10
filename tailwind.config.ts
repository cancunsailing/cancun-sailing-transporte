import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tinta: '#14232b',
        suave: '#5b6b73',
        linea: '#d9e0e3',
        fondo: '#f3f5f6',
        perlas: { DEFAULT: '#0f6f8f', soft: '#e2f0f5' },
        norte: { DEFAULT: '#6a4fb3', soft: '#ece8f7' },
        alerta: { DEFAULT: '#b4540f', soft: '#fbe9dc' },
        ok: { DEFAULT: '#2f7a4f', soft: '#e3f1e8' },
        pend: { DEFAULT: '#8a6a12', soft: '#f6efd9' },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
