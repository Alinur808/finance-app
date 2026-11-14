import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { boot, seeded, tab } from './helpers.js';

/**
 * Импорт PDF-выписок в условиях iOS Safari: до запуска страницы и воркера pdf.js
 * удаляем Promise.withResolvers и асинхронный итератор ReadableStream (их нет в
 * WebKit / iOS < 17.4). Импорт должен пройти благодаря pdfCompat.js и ручному
 * чтению потока (streamTextContent().getReader()).
 *
 * Фикстуры: npm run fixtures. Свои выписки:
 *   FREEDOM_PDF=… FREEDOM_ROWS=208 FREEDOM_BALANCE="14 234,77"
 *   KASPI_PDF=…   KASPI_ROWS=…     KASPI_BALANCE="…"
 */
const fixture = (env, name) => resolve(process.env[env] || `tests/fixtures/${name}`);
const BANKS = [
  {
    id: 'Freedom Bank',
    file: fixture('FREEDOM_PDF', 'freedom-synthetic.pdf'),
    rows: Number(process.env.FREEDOM_ROWS || 208),
    balance: process.env.FREEDOM_BALANCE || '14 234,77',
    card: 'Freedom Super Card *4242',
  },
  {
    id: 'Kaspi Gold',
    file: fixture('KASPI_PDF', 'kaspi-synthetic.pdf'),
    rows: Number(process.env.KASPI_ROWS || 120),
    balance: process.env.KASPI_BALANCE || '87 412,35',
    card: process.env.KASPI_PDF ? null : 'Kaspi Gold *4242',
  },
  { id: 'Halyk Bank', file: fixture('HALYK_PDF', 'halyk-synthetic.pdf'), rows: 80, balance: '152 300,40', card: 'Halyk Bank *7788' },
  { id: 'Emirates NBD (universal)', file: fixture('ENBD_PDF', 'enbd-synthetic.pdf'), rows: 58, balance: '1 543 208,75', card: 'Emirates NBD *9876' },
];

const STRIP = `
  try { delete Promise.withResolvers; } catch (e) {}
  try { delete ReadableStream.prototype[Symbol.asyncIterator]; delete ReadableStream.prototype.values; } catch (e) {}
`;

const words = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'операция' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'операции' : 'операций');

/** Симуляция iOS Safari на странице и в воркере pdf.js. Возвращает счётчик пропатченных воркеров. */
async function simulateIOS(page) {
  await page.addInitScript(`${STRIP}; window.__iosSim = { withResolvers: typeof Promise.withResolvers, asyncIterator: typeof ReadableStream.prototype[Symbol.asyncIterator] };`);
  const state = { patched: 0 };
  await page.route(/\/assets\/pdf\.worker-[^/]+\.js$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    // патчим только сам воркер; маленький модуль-загрузчик (new Worker(…)) выполняется на странице
    if (body.includes('new Worker(')) return route.fulfill({ response, body });
    state.patched += 1;
    await route.fulfill({ response, body: `${STRIP}\n${body}`, headers: { ...response.headers(), 'content-type': 'text/javascript' } });
  });
  return state;
}

async function pickPdf(page, button, file) {
  const chooser = page.waitForEvent('filechooser');
  await button.click();
  await (await chooser).setFiles(file);
}

for (const bank of BANKS) {
  test(`iOS Safari simulation: ${bank.id} PDF — ${bank.rows} операций, остаток ${bank.balance} ₸`, async ({ page }) => {
    test.skip(!existsSync(bank.file), `нет файла ${bank.file} — запустите npm run fixtures`);
    const sim = await simulateIOS(page);
    const errors = await boot(page);
    expect(await page.evaluate(() => window.__iosSim)).toEqual({ withResolvers: 'undefined', asyncIterator: 'undefined' });

    await pickPdf(page, page.getByRole('button', { name: /Загрузить PDF-выписку банка/ }), bank.file);
    await expect(page.getByRole('status')).toContainText(`Выписка загружена: ${bank.rows} ${words(bank.rows)}`, { timeout: 45_000 });
    expect(sim.patched).toBeGreaterThan(0);

    const card = page.getByTestId('balance-card');
    expect((await page.getByTestId('balance-amount').innerText()).replace(/\s+/g, ' ')).toContain(bank.balance);
    if (bank.card) await expect(card).toContainText(bank.card); // название карты подставилось само
    await tab(page, 'Профиль');
    await expect(page.locator('main').getByText(new RegExp(`${bank.rows}\\s${words(bank.rows)}`))).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('universal statement: confirmation shows the reference FX rate', async ({ page }) => {
  const file = fixture('ENBD_PDF', 'enbd-synthetic.pdf');
  test.skip(!existsSync(file), 'нет фикстуры — npm run fixtures');
  await simulateIOS(page);
  await boot(page, { state: seeded({ settings: { cardName: '' } }) });
  await tab(page, 'Профиль');
  await pickPdf(page, page.getByRole('button', { name: /Импорт: PDF-выписка или JSON/ }), file);
  await expect(page.getByTestId('import-card')).toContainText('Emirates NBD *9876', { timeout: 45_000 });
  await expect(page.getByTestId('import-rates')).toContainText('1 AED = 125 ₸');
  await page.getByRole('button', { name: 'Загрузить выписку' }).click();
  await expect(page.getByRole('status')).toContainText('Выписка загружена: 58');
});

test('Kaspi import merges: keeps cash, other months, goals and a custom card name', async ({ page }) => {
  const file = fixture('KASPI_PDF', 'kaspi-synthetic.pdf');
  test.skip(!existsSync(file) || Boolean(process.env.KASPI_PDF), 'проверка на синтетической выписке');
  const state = seeded();
  state.transactions.push(
    { id: 'cash-oct', type: 'expense', amount: 7000, categoryId: 'cafe', merchant: 'Наличными в кафе', accountId: 'cash', date: new Date(2026, 9, 15, 12).toISOString(), note: '' },
    {
      id: 'card-sep',
      type: 'expense',
      amount: 3000,
      categoryId: 'cafe',
      merchant: 'Сентябрьский кофе',
      accountId: 'kaspi',
      date: new Date(2026, 8, 10, 12).toISOString(),
      note: '',
    },
  );
  const before = state.transactions;
  const inPeriod = (t) => t.accountId === 'kaspi' && t.date >= new Date(2026, 9, 1).toISOString() && t.date < new Date(2026, 10, 1).toISOString();
  const kept = before.filter((t) => !inPeriod(t)).length;

  await simulateIOS(page);
  await boot(page, { state });
  await tab(page, 'Профиль');
  await pickPdf(page, page.getByRole('button', { name: /Импорт: PDF-выписка или JSON/ }), file);
  await page.getByRole('button', { name: 'Загрузить выписку' }).click({ timeout: 45_000 });
  await expect(page.getByRole('status')).toContainText('Выписка загружена: 120');

  const saved = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 600)); // сохранение в localStorage с задержкой
    return JSON.parse(localStorage.getItem('tenge-finance.v2'));
  });
  expect(saved.transactions.length).toBe(kept + 120);
  expect(saved.transactions.some((t) => t.id === 'cash-oct')).toBe(true); // наличные за период — на месте
  expect(saved.transactions.some((t) => t.id === 'card-sep')).toBe(true); // другие месяцы — на месте
  expect(saved.goals).toHaveLength(1);
  expect(saved.settings.cardName).toBe('Freedom Super Card'); // своё название карты не перезаписано
  expect(saved.transactions.filter((t) => t.source === 'kaspi-pdf' && t.categoryId === 'own')).toHaveLength(17);
});

test('scanned PDF without text shows a clear Russian message', async ({ page }) => {
  const file = resolve('tests/fixtures/scanned-synthetic.pdf');
  test.skip(!existsSync(file), 'нет фикстуры — npm run fixtures');
  await simulateIOS(page);
  await boot(page);
  await pickPdf(page, page.getByRole('button', { name: /Загрузить PDF-выписку банка/ }), file);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Похоже, это скан или фото выписки', { timeout: 45_000 });
  await expect(alert).toContainText('приложении банка');
});
