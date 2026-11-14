import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { boot } from './helpers.js';

/**
 * Импорт PDF-выписки Freedom Bank в условиях iOS Safari:
 * до запуска страницы и воркера pdf.js удаляем Promise.withResolvers и
 * асинхронный итератор ReadableStream (их нет в WebKit / iOS < 17.4).
 * Импорт должен пройти благодаря pdfCompat.js и ручному чтению потока.
 *
 *   FREEDOM_PDF=~/Downloads/statement.pdf npm run test:e2e   — ваша выписка
 *   FREEDOM_ROWS / FREEDOM_BALANCE — ожидаемые значения (по умолчанию 208 и «14 234,77»)
 */
const PDF = resolve(process.env.FREEDOM_PDF || 'tests/fixtures/freedom-synthetic.pdf');
const ROWS = Number(process.env.FREEDOM_ROWS || 208);
const BALANCE = process.env.FREEDOM_BALANCE || '14 234,77';

const STRIP = `
  try { delete Promise.withResolvers; } catch (e) {}
  try { delete ReadableStream.prototype[Symbol.asyncIterator]; delete ReadableStream.prototype.values; } catch (e) {}
`;

test('iOS Safari simulation: Freedom PDF imports every row and the closing balance', async ({ page }) => {
  test.skip(!existsSync(PDF), `нет файла ${PDF} — запустите python3 tests/fixtures/make_freedom_fixture.py или задайте FREEDOM_PDF`);

  await page.addInitScript(`${STRIP}; window.__iosSim = { withResolvers: typeof Promise.withResolvers, asyncIterator: typeof ReadableStream.prototype[Symbol.asyncIterator] };`);
  let workerPatched = 0;
  await page.route(/\/assets\/pdf\.worker-[^/]+\.js$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    // патчим только сам воркер; маленький модуль-загрузчик (new Worker(…)) выполняется на странице
    if (body.includes('new Worker(')) return route.fulfill({ response, body });
    workerPatched += 1;
    await route.fulfill({ response, body: `${STRIP}\n${body}`, headers: { ...response.headers(), 'content-type': 'text/javascript' } });
  });

  const errors = await boot(page);
  expect(await page.evaluate(() => window.__iosSim)).toEqual({ withResolvers: 'undefined', asyncIterator: 'undefined' });

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Загрузить выписку Freedom Bank/ }).click();
  await (await chooser).setFiles(PDF);

  const words = ROWS % 10 === 1 && ROWS % 100 !== 11 ? 'операция' : [2, 3, 4].includes(ROWS % 10) && ![12, 13, 14].includes(ROWS % 100) ? 'операции' : 'операций';
  await expect(page.getByRole('status')).toContainText(`Выписка загружена: ${ROWS} ${words}`, { timeout: 45_000 });
  expect(workerPatched).toBeGreaterThan(0);

  const amount = page.getByTestId('balance-amount');
  await expect(amount).toBeVisible();
  expect((await amount.innerText()).replace(/\s+/g, ' ')).toContain(BALANCE.replace(/\s+/g, ' '));

  // все операции на месте
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await expect(page.locator('main').getByText(new RegExp(`${ROWS}\\s${words}`))).toBeVisible();
  expect(errors).toEqual([]);
});
