import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

const THEME = '#050507'; // Obsidian

/**
 * Строгая Content-Security-Policy. Добавляется в index.html только при сборке:
 * dev-сервер Vite использует встроенные скрипты (HMR), которые она запрещает.
 *  - script-src 'self' — никаких встроенных скриптов и eval (тема — в public/boot.js);
 *  - worker-src 'self' blob: — воркер pdf.js;
 *  - connect-src — только своё происхождение и API Anthropic (бета «ИИ-разбор» по ключу пользователя);
 *  - style-src 'unsafe-inline' — встроенный <style> против вспышки темы; стили не исполняют код.
 * frame-ancestors в <meta> не работает — от фреймов защищает public/boot.js.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' blob: https://api.anthropic.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

const contentSecurityPolicy = () => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`),
  },
});

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
  build: {
    // pdf.js (~540 КБ) и его воркер грузятся лениво — только при выборе PDF,
    // на старт приложения не влияют. Порог поднят, чтобы предупреждение
    // не заглушало настоящие проблемы.
    chunkSizeWarningLimit: 1400,
  },
  // воркер pdf.js собирается как классический (iife) .js — без требований к module-воркерам
  worker: { format: 'iife' },
  resolve: {
    alias: mode === 'public' || !existsSync(STATEMENT) ? [{ find: /^\.\/statement\.json$/, replacement: EMPTY_STATEMENT }] : [],
  },
  plugins: [
    react(),
    // однофайловая сборка встраивает все скрипты в HTML — ей CSP 'self' не подходит
    mode !== 'single' && contentSecurityPolicy(),
    mode === 'single'
      ? viteSingleFile()
      : VitePWA({
          registerType: 'autoUpdate',
          // регистрацию и тихую перезагрузку делает src/pwa.js (сначала сохраняем данные)
          injectRegister: false,
          manifestFilename: 'manifest.json',
          includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-32x32.png'],
          manifest: {
            name: 'Финансы',
            short_name: 'Финансы',
            description: 'Личные финансы: баланс, денежный поток, цели и стратег.',
            lang: 'ru',
            id: './',
            start_url: './',
            scope: './',
            display: 'standalone',
            orientation: 'portrait',
            theme_color: THEME,
            background_color: '#050507',
            icons: [
              { src: './pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              { src: './maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // воркер pdf.js ~1,3 МБ
            navigateFallback: 'index.html',
            // Автообновление у бета-тестеров: новый service worker активируется сразу,
            // забирает открытые вкладки, старые версии кэша удаляются.
            skipWaiting: true,
            clientsClaim: true,
            cleanupOutdatedCaches: true,
          },
        }),
  ],
}));
