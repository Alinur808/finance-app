/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecf8f2',
          100: '#d2efe1',
          200: '#a6dfc4',
          300: '#6fc9a0',
          400: '#38b07c',
          500: '#16a06a',
          600: '#0f8a5a',
          700: '#0b6e48',
          800: '#0a5a3c',
          900: '#083f2b',
        },
        canvas: '#f3f4f6',
        ink: {
          DEFAULT: '#111827',
          soft: '#4b5563',
          muted: '#9ca3af',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 4px 16px rgba(16,24,40,0.06)',
        float: '0 8px 24px rgba(11,110,72,0.35)',
      },
    },
  },
  plugins: [],
};
