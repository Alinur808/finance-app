import { defineConfig } from '@playwright/test';

/**
 * E2E на мобильном вьюпорте 390×844 (iPhone 12–15).
 *   npm run test:e2e
 * Сервер: production-сборка (build:public) через `vite preview`.
 * Выписка Freedom: FREEDOM_PDF=/путь/к/выписке.pdf (по умолчанию — синтетическая
 * tests/fixtures/freedom-synthetic.pdf, см. make_freedom_fixture.py).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    locale: 'ru-RU',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    trace: 'off',
  },
  webServer: {
    command: 'npm run build:public && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
