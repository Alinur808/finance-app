/**
 * Цвета приложения — CSS-переменные (src/index.css), поэтому одни и те же
 * классы (`bg-surface`, `text-ink-muted`, `bg-red-50`…) работают и в тёмной
 * теме Obsidian, и в светлой Alabaster. Значения — тройки «R G B», чтобы
 * модификаторы прозрачности (`bg-brand-500/20`) продолжали работать.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name, shades) => Object.fromEntries(shades.map((s) => [s, v(`${name}-${s}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: v('canvas'),
        surface: { DEFAULT: v('surface'), raised: v('surface-raised') },
        ink: { DEFAULT: v('ink'), soft: v('ink-soft'), muted: v('ink-muted') },
        // текст на фоне bg-ink (белый в светлой теме, угольный в тёмной)
        'on-ink': v('on-ink'),
        hairline: 'var(--hairline)',
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        gray: scale('gray', [50, 100, 200, 300, 900]),
        // «burn» — коралловый, а не кричащий красный
        red: scale('red', [50, 100, 200, 300, 500, 600, 700, 800, 900]),
        amber: scale('amber', [50, 100, 400, 500, 600, 700, 800, 900]),
        orange: scale('orange', [50, 500]),
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        sheet: 'var(--shadow-sheet)',
      },
    },
  },
  plugins: [],
};
