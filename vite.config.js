import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

const THEME = '#0a5a3c';

// Выписка с личными данными не хранится в git (см. .gitignore). Если файла нет —
// например, при сборке на GitHub Actions — подставляем пустую выписку.
const STATEMENT = fileURLToPath(new URL('./src/data/statement.json', import.meta.url));
const EMPTY_STATEMENT = fileURLToPath(new URL('./src/data/statement.empty.json', import.meta.url));

/**
 * `npm run build`         → обычная PWA-сборка в dist/ (manifest.json + service worker)
 * `npm run build:single`  → один самодостаточный index.html без PWA (для просмотра/отправки)
 * `npm run build:public`  → PWA без данных выписки — для публичного хостинга;
 *                           свои данные загружаются через «Импорт данных»
 *
 * base: './' — все пути относительные, поэтому сайт работает и в корне домена,
 * и в подпапке GitHub Pages (https://alinur808.github.io/finance-app/).
 */
export default defineConfig(({ mode }) => ({
  base: './',
  resolve: {
    alias: mode === 'public' || !existsSync(STATEMENT) ? [{ find: /^\.\/statement\.json$/, replacement: EMPTY_STATEMENT }] : [],
  },
  plugins: [
    react(),
    mode === 'single'
      ? viteSingleFile()
      : VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          manifestFilename: 'manifest.json',
          includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-32x32.png'],
          manifest: {
            name: 'Финансы',
            short_name: 'Финансы',
            description: 'Личные финансы: баланс, аналитика расходов, цели и советник.',
            lang: 'ru',
            id: './',
            start_url: './',
            scope: './',
            display: 'standalone',
            orientation: 'portrait',
            theme_color: THEME,
            background_color: '#f3f4f6',
            icons: [
              { src: './pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: './maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            navigateFallback: 'index.html',
            runtimeCaching: [
              {
                // шрифт Inter: работает и без сети после первого запуска
                urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts',
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        }),
  ],
}));
