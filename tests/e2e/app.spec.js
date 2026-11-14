import { expect, test } from '@playwright/test';
import { boot, MONEY_RE, seeded, tab } from './helpers.js';

const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('billion-scale balance (15 450 000 000 ₸) fits the card without overflow', async ({ page }) => {
  const errors = await boot(page, { state: seeded({ balance: 15_450_000_000 }) });
  const amount = page.getByTestId('balance-amount');
  await expect(amount).toBeVisible();
  expect((await amount.innerText()).replace(/\s+/g, ' ')).toContain('15 450 000 000');
  const fit = await amount.evaluate((el) => ({
    fits: el.scrollWidth <= el.clientWidth + 1,
    size: parseFloat(getComputedStyle(el).fontSize),
    right: el.getBoundingClientRect().right,
  }));
  expect(fit.fits).toBe(true);
  expect(fit.size).toBeLessThan(40); // шрифт ужался
  expect(fit.right).toBeLessThanOrEqual(390);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('maximum input amount (999 999 999 999,99 ₸) still fits', async ({ page }) => {
  await boot(page, { state: seeded({ balance: 999_999_999_999.99 }) });
  const amount = page.getByTestId('balance-amount');
  expect((await amount.innerText()).replace(/\s+/g, ' ')).toContain('999 999 999 999');
  expect(await amount.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('Stealth Mode masks every amount on Dashboard, Analytics and Plans and persists', async ({ page }) => {
  await boot(page, { state: seeded() });
  await expect(page.getByTestId('balance-amount')).toContainText('1 250 000');
  await page.getByTestId('stealth-toggle').click();
  await expect(page.getByTestId('balance-amount')).toContainText('••••••');
  await expect(page.getByTestId('stealth-toggle')).toHaveAttribute('aria-pressed', 'true');

  const assertMasked = async () => {
    await page.waitForTimeout(250);
    const text = await page.locator('main').innerText();
    expect(text).toContain('••••••');
    expect(text).not.toMatch(MONEY_RE);
  };
  await assertMasked();
  await tab(page, 'Аналитика');
  await assertMasked();
  await expect(page.locator('main svg[role="img"]').first()).toBeVisible(); // графики остаются
  await tab(page, 'Планы');
  await assertMasked();

  await page.reload();
  await tab(page, 'Обзор');
  await expect(page.getByTestId('balance-amount')).toContainText('••••••');
  await page.getByTestId('stealth-toggle').click();
  await expect(page.getByTestId('balance-amount')).toContainText('1 250 000');
});

test('Theme switching: Obsidian by default, Alabaster persists after reload', async ({ page }) => {
  await boot(page, { state: seeded() });
  const theme = () => page.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor }));
  expect(await theme()).toEqual({ attr: 'obsidian', bg: 'rgb(5, 5, 7)' });
  await tab(page, 'Профиль');
  await page.getByTestId('theme-alabaster').click();
  await expect.poll(theme).toEqual({ attr: 'alabaster', bg: 'rgb(245, 244, 240)' });
  expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#f5f4f0');
  await page.reload();
  expect((await theme()).attr).toBe('alabaster');
  await tab(page, 'Профиль');
  await page.getByTestId('theme-obsidian').click();
  await expect.poll(theme).toEqual({ attr: 'obsidian', bg: 'rgb(5, 5, 7)' });
});

test('Private Membership paywall: plans, comparison, restore, preview purchase', async ({ page }) => {
  await boot(page, { state: seeded() });
  await tab(page, 'Профиль');
  await page.getByTestId('open-membership').click();
  const sheet = page.getByTestId('paywall');
  await expect(sheet).toBeVisible();
  for (const label of ['Месяц', 'Год', 'Навсегда']) await expect(sheet.getByRole('radio', { name: new RegExp(label) })).toBeVisible();
  await expect(sheet.getByText('Код-пароль', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Восстановить покупки' }).click();
  await expect(sheet.getByText(/Восстановление работает в приложении/)).toBeVisible();
  await sheet.getByRole('radio', { name: /Месяц/ }).click();
  await sheet.getByRole('button', { name: /Продолжить · 2 990 ₸ \/ мес/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Private', selected: true })).toBeVisible();
  // Free-режим снова закрывает функции
  await page.getByRole('tab', { name: /Free/ }).click();
  await tab(page, 'Планы');
  await expect(page.getByTestId('locked-insights')).toBeVisible();
  await page.getByTestId('locked-insights').click();
  await expect(page.getByTestId('paywall')).toBeVisible();
});

test('Passcode Lock: gated for Free, keypad setup, cold-open and background lock', async ({ page }) => {
  await boot(page, { state: seeded() });
  await tab(page, 'Профиль');
  const toggle = page.getByRole('switch', { name: 'Защита код-паролем' });
  await toggle.click();
  await expect(page.getByTestId('paywall')).toBeVisible(); // Standard → пейвол
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByTestId('paywall')).toBeHidden();

  await page.getByRole('tab', { name: 'Private' }).click();
  await toggle.click();
  const setup = page.getByTestId('passcode-setup');
  await expect(setup).toBeVisible();
  const type = async (root, code) => {
    for (const d of code) await root.getByRole('button', { name: d, exact: true }).click();
  };
  await type(setup, '1234');
  await expect(setup.getByText('Повторите код-пароль')).toBeVisible();
  await type(setup, '1234');
  await expect(setup).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const stored = await page.evaluate(() => localStorage.getItem('tenge-finance.security'));
  expect(stored).not.toContain('1234'); // хранится только хеш

  // холодный запуск
  await page.reload();
  const lock = page.getByTestId('lock-screen');
  await expect(lock).toBeVisible();
  await type(lock, '0000');
  await expect(lock.getByText('Неверный код-пароль')).toBeVisible();
  await type(lock, '1234');
  await expect(lock).toBeHidden();

  // возврат из фона
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(lock).toBeVisible();
  await type(lock, '1234');
  await expect(lock).toBeHidden();
});

test('Cashflow chart supports touch scrubbing with exact figures', async ({ page }) => {
  await boot(page, { state: seeded() });
  await tab(page, 'Аналитика');
  const chart = page.getByTestId('cashflow-chart');
  await chart.scrollIntoViewIfNeeded();
  const before = await chart.getByTestId('cashflow-label').innerText();
  const box = await chart.locator('svg').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  const during = await chart.getByTestId('cashflow-label').innerText();
  expect(during).not.toBe(before);
  expect(during).toMatch(/[А-Я][а-я], \d+/); // «Пн, 3 нояб.»
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  expect(await chart.getByTestId('cashflow-label').innerText()).not.toBe(during);
  await expect(chart.getByTestId('cashflow-net')).toHaveText(MONEY_RE);
});

test('Inputs are ≥16px (no iOS zoom) and add-transaction saves', async ({ page }) => {
  await boot(page, { state: seeded() });
  await page.getByRole('button', { name: 'Добавить операцию' }).click();
  const sizes = await page.locator('input, select, textarea').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  await page.locator('#tx-amount').fill('4500');
  await page.getByRole('button', { name: /Продукты/ }).click();
  await page.getByRole('button', { name: 'Добавить расход' }).click();
  await expect(page.getByRole('status')).toContainText('Расход 4 500');
});

test('Backward compatibility: legacy localStorage and JSON backup import', async ({ page }) => {
  // данные из старой версии: нет onboarded, plan и новых ключей
  const legacy = seeded();
  delete legacy.settings.onboarded;
  delete legacy.plan;
  const errors = await boot(page, { state: legacy });
  await expect(page.getByTestId('balance-amount')).toContainText('1 250 000');

  await tab(page, 'Профиль');
  const backup = { app: 'tenge-finance', version: 1, transactions: seeded({ balance: 0 }).transactions.slice(0, 12), goals: [], settings: { name: 'Kaspi' } };
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Импорт: PDF-выписка или JSON/ }).click();
  await (await chooser).setFiles({ name: 'finance-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Заменить данные' }).click();
  await expect(page.getByRole('status')).toContainText('Импортировано: 12');
  expect(errors).toEqual([]);
});
