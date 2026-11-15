import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { makeTransactions } from '../fixtures/state.js';
import { boot, MONEY_RE, readVaultState, seeded, tab } from './helpers.js';

/**
 * Обновление безопасности и функций бета-тестеров (390×844, production-сборка).
 */
const PRIVATE = { tier: 'private', source: 'preview', plan: 'annual', since: new Date().toISOString() };
const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Собирает нарушения CSP (securitypolicyviolation) с первой строки страницы. */
const trackCsp = (page) =>
  page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });

const type = async (root, code) => {
  for (const d of code) await root.getByRole('button', { name: d, exact: true }).click();
};

/** Ближайшее воскресенье в 18:00 (для «Итогов недели»). */
function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(18, 0, 0, 0);
  return d;
}

test('encryption at rest: plaintext data migrates with zero loss, AI key moves to sessionStorage', async ({ page }) => {
  const legacy = seeded({ settings: { aiApiKey: 'sk-ant-legacy-key' } });
  const errors = await boot(page, { state: legacy });
  await expect(page.getByTestId('balance-amount')).toContainText('1 250 000');

  const storage = await page.evaluate(() => ({ ...localStorage }));
  expect(storage['tenge-finance.v2']).toBeUndefined(); // открытая копия удалена
  const vault = JSON.parse(storage['tenge-finance.vault']);
  expect(vault).toMatchObject({ v: 1, ks: 'idb', alg: 'AES-GCM-256', kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 120000 } });
  const everything = JSON.stringify(storage);
  for (const plain of ['Magnum', 'Talabat', 'Алекс', 'Freedom Super Card', 'sk-ant-legacy-key']) expect(everything).not.toContain(plain);

  const state = await readVaultState(page);
  expect(state.transactions).toHaveLength(legacy.transactions.length);
  expect(state.transactions.map((t) => t.id)).toEqual(legacy.transactions.map((t) => t.id));
  expect(state.settings.aiApiKey).toBeUndefined();
  expect(await page.evaluate(() => sessionStorage.getItem('tenge-finance.ai-key'))).toBe('sk-ant-legacy-key');

  await page.reload();
  await expect(page.getByTestId('balance-amount')).toContainText('1 250 000');
  expect(errors).toEqual([]);
});

test('strict CSP is present and nothing violates it — navigation, sheets, PDF import', async ({ page }) => {
  await trackCsp(page);
  await boot(page, { state: seeded(), membership: PRIVATE });
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("worker-src 'self' blob:");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain('unsafe-eval');
  expect(await page.locator('script:not([src])').count()).toBe(0); // ни одного встроенного скрипта

  for (const name of ['Аналитика', 'Планы', 'Профиль', 'Обзор']) await tab(page, name);
  await tab(page, 'Планы');
  await page.getByRole('tab', { name: 'Анализ и профиль' }).click();
  await page.getByRole('button', { name: 'Добавить операцию' }).click();
  await page.getByRole('button', { name: 'Закрыть' }).click();

  const pdf = resolve('tests/fixtures/kaspi-synthetic.pdf');
  if (existsSync(pdf)) {
    await tab(page, 'Профиль');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Импорт: PDF-выписка или JSON/ }).click();
    await (await chooser).setFiles(pdf);
    await expect(page.getByRole('button', { name: 'Загрузить выписку' })).toBeVisible({ timeout: 45_000 });
  }
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
});

test('WebAuthn Face ID: register from Profile, unlock without PIN, PIN fallback when biometrics fail', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  await boot(page, { state: seeded() });
  await tab(page, 'Профиль');
  await page.getByRole('switch', { name: 'Защита код-паролем' }).click();
  const setup = page.getByTestId('passcode-setup');
  await type(setup, '1234');
  await expect(setup.getByText('Повторите код-пароль')).toBeVisible();
  await type(setup, '1234');
  await expect(setup).toBeHidden();

  const faceId = page.getByRole('switch', { name: 'Face ID' });
  await expect(faceId).toHaveAttribute('aria-checked', 'false');
  await faceId.click(); // navigator.credentials.create → виртуальный «Face ID»
  await expect(faceId).toHaveAttribute('aria-checked', 'true');
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('tenge-finance.security')));
  expect(record.passkey.id).toBeTruthy();
  expect(record.passkey.alg).toBe(-7);
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials).toHaveLength(1);

  // холодный запуск: Face ID срабатывает сам, код вводить не нужно
  await page.reload();
  await expect(page.getByTestId('balance-amount')).toBeVisible();
  await expect(page.getByTestId('lock-screen')).toBeHidden({ timeout: 10_000 });

  // Face ID не узнал — остаётся код-пароль
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
  await page.reload();
  const lock = page.getByTestId('lock-screen');
  await expect(lock).toBeVisible();
  await page.waitForTimeout(800);
  await expect(lock).toBeVisible();
  await type(lock, '1234');
  await expect(lock).toBeHidden();
});

test('Plans 2-in-1: «Цель и темп трат» hero, pills, compact layout without overflow', async ({ page }) => {
  await boot(page, { state: seeded() });
  await tab(page, 'Планы');
  await expect(page.getByRole('tab', { name: 'Цель и дневник', selected: true })).toBeVisible();
  const hero = page.getByTestId('pace-hero');
  await expect(hero).toContainText('Цель и темп трат');
  await expect(hero).toContainText('Подушка безопасности');
  await expect(hero.getByTestId('safe-to-spend')).toContainText(/Сегодня можно потратить|Сегодня перерасход|Бюджет месяца/);
  await expect(hero.getByTestId('safe-to-spend')).toContainText(MONEY_RE);
  await expect(hero.getByTestId('goal-status')).toBeVisible();
  await expect(hero).toContainText(/Прогноз:|не наступит/);
  await expect(page.getByTestId('weekly-card')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  const cockpitHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  await page.getByRole('tab', { name: 'Анализ и профиль' }).click();
  await expect(page.getByTestId('behavior-portrait')).toBeVisible();
  await expect(page.getByTestId('archetype')).not.toBeEmpty();
  await expect(page.getByTestId('portrait-locked')).toBeVisible(); // Standard — тизер
  await expect(page.getByTestId('wealth-telemetry')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  // нет «бесконечной ленты»: раздел «Цель и дневник» — меньше трёх экранов
  expect(cockpitHeight).toBeLessThan(844 * 3);
});

test('Private: full behavioral DNA, changes radar, what-if; Stealth Mode masks every new card', async ({ page }) => {
  await boot(page, { state: seeded(), membership: PRIVATE });
  await tab(page, 'Планы');
  await page.getByRole('tab', { name: 'Анализ и профиль' }).click();
  await expect(page.getByTestId('portrait-locked')).toBeHidden();
  await expect(page.getByTestId('behavior-portrait')).toContainText('Три действия');
  await expect(page.getByTestId('capital-currencies')).toContainText('USD');

  await tab(page, 'Обзор');
  await page.getByTestId('stealth-toggle').click();
  await expect(page.getByTestId('balance-amount')).toContainText('••••••');
  await tab(page, 'Планы');
  for (const section of ['Цель и дневник', 'Анализ и профиль']) {
    await page.getByRole('tab', { name: section }).click();
    await page.waitForTimeout(250);
    const text = await page.locator('main').innerText();
    expect(text).toContain('••••••');
    expect(text).not.toMatch(MONEY_RE);
  }
});

test('voice input: «Такси две пятьсот» fills the sheet; Standard has a daily limit', async ({ page }) => {
  await page.addInitScript(() => {
    window.__phrases = ['Такси две пятьсот', 'Кофе 1800', 'Зарплата 300 тысяч', 'Обед 3200'];
    class FakeRecognition {
      start() {
        const text = window.__phrases.shift() ?? 'тишина';
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
          this.onend?.();
        }, 60);
      }
      stop() {}
      abort() {}
    }
    window.SpeechRecognition = FakeRecognition;
  });
  await boot(page, { state: seeded() });
  await page.getByRole('button', { name: 'Добавить операцию' }).click();
  const sheet = page.getByTestId('add-sheet');
  await sheet.getByTestId('voice-button').click();
  await expect(sheet.locator('#tx-amount')).toHaveValue(/^2\s500$/);
  await expect(sheet.locator('#tx-merchant')).toHaveValue('Такси');
  await expect(sheet.getByRole('button', { name: /Транспорт/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByTestId('voice-status')).toContainText('Распознано');

  await sheet.getByTestId('voice-button').click();
  await expect(sheet.locator('#tx-amount')).toHaveValue(/^1\s800$/);
  await sheet.getByTestId('voice-button').click();
  await expect(sheet.locator('#tx-amount')).toHaveValue(/^300\s000$/);
  await expect(sheet.getByRole('button', { name: 'Добавить доход' })).toBeVisible();
  // четвёртая фраза за день в Standard → пейвол
  await sheet.getByTestId('voice-button').click();
  await expect(page.getByTestId('paywall')).toBeVisible();
});

test('«Стоит ли оно того?»: life-hours inline with 1-tap rate, goal delay in Private', async ({ page }) => {
  await boot(page, { state: seeded() });
  await page.getByRole('button', { name: 'Добавить операцию' }).click();
  const sheet = page.getByTestId('add-sheet');
  await sheet.locator('#tx-amount').fill('9000');
  const line = sheet.getByTestId('worth-it-line');
  await expect(line).toContainText(/≈ .*(час|минут|рабоч)/);
  await expect(line.getByRole('button', { name: 'Прогноз цели — Private' })).toBeVisible();
  await line.getByTestId('hourly-rate-button').click();
  await sheet.locator('#hourly-rate').fill('2000');
  await sheet.getByRole('button', { name: 'OK' }).click();
  await expect(line).toContainText('≈ 4,5 часа работы');
  await page.getByRole('button', { name: 'Закрыть' }).click();

  // Private: симулятор из «Планов» с днями до цели
  await page.evaluate(() =>
    localStorage.setItem('tenge-finance.membership', JSON.stringify({ tier: 'private', source: 'preview', plan: 'annual', since: new Date().toISOString() })),
  );
  await page.reload();
  await tab(page, 'Планы');
  await page.getByTestId('open-worth-it').click();
  const ws = page.getByTestId('worth-it-sheet');
  await ws.locator('#worth-amount').fill('45000');
  await expect(ws.getByTestId('worth-it-result')).toContainText('≈ 2,8 рабочего дня');
  await expect(ws.getByTestId('worth-it-goal')).toContainText(/Отложит «Подушка безопасности» на|не наступит/);
  await ws.getByRole('tab', { name: 'Каждую неделю' }).click();
  await expect(ws.getByTestId('worth-it-result')).toContainText('в год');
});

test('weekly recap on Sunday + weekly limit guardrail stops new expenses', async ({ page }) => {
  const sunday = nextSunday();
  await page.clock.setFixedTime(sunday);
  const state = seeded({ transactions: makeTransactions(sunday, 30), settings: { weeklyLimit: 1000 } });
  const errors = await boot(page, { state });
  await expect(page.getByTestId('weekly-limit-banner')).toContainText('Лимит недели исчерпан — траты остановлены');
  const card = page.getByTestId('weekly-recap-card');
  await expect(card).toContainText('Итоги недели');
  await expect(card).toContainText('Доходы');
  await expect(card).toContainText('Расходы');

  await page.getByRole('button', { name: 'Добавить операцию' }).click();
  const sheet = page.getByTestId('add-sheet');
  await sheet.locator('#tx-amount').fill('500');
  await sheet.getByRole('button', { name: /Продукты/ }).click();
  await sheet.getByRole('button', { name: 'Добавить расход' }).click();
  await expect(page.getByTestId('weekly-limit-confirm')).toContainText('Лимит недели исчерпан — траты остановлены');
  await page.getByRole('button', { name: 'Всё равно добавить' }).click();
  await expect(page.getByRole('status')).toContainText('Расход 500');

  await card.getByRole('button', { name: 'Скрыть итоги недели' }).click();
  await expect(card).toBeHidden();
  await tab(page, 'Планы');
  await page.getByTestId('open-weekly-recap').click();
  const recap = page.getByTestId('weekly-recap');
  await expect(recap.getByRole('tab', { name: 'Эта неделя', selected: true })).toBeVisible();
  await expect(recap).toContainText('Больше всего ушло на');
  expect(errors).toEqual([]);
});

test('?quickAdd= deep link (Apple Pay / Shortcuts) is sanitized and never auto-commits', async ({ page }) => {
  const evil = encodeURIComponent('<img src=x onerror=alert(1)>Starbucks‮');
  const errors = await boot(page, { state: seeded(), path: `./?quickAdd=1&amount=1%20800%2C00&merchant=${evil}&type=expense` });
  let dialogs = 0;
  page.on('dialog', (d) => {
    dialogs += 1;
    d.dismiss();
  });
  const sheet = page.getByTestId('add-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('shortcut-banner')).toBeVisible();
  await expect(sheet.locator('#tx-amount')).toHaveValue(/^1\s800$/);
  await expect(sheet.locator('#tx-merchant')).toHaveValue('img src=x onerror=alert(1)Starbucks');
  await expect(sheet.getByRole('button', { name: /Кафе/ })).toHaveAttribute('aria-pressed', 'true'); // Starbucks → кафе
  expect(page.url()).not.toContain('quickAdd');

  const before = (await readVaultState(page, { wait: 400 })).transactions.length;
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(sheet).toBeHidden();
  expect((await readVaultState(page, { wait: 400 })).transactions.length).toBe(before); // без нажатия — ничего не сохранено

  await page.goto('./?quickAdd=1&amount=1800&merchant=Starbucks&type=expense');
  await page.getByTestId('add-sheet').getByRole('button', { name: 'Добавить расход' }).click();
  await expect(page.getByRole('status')).toContainText('Расход 1 800');
  const saved = await readVaultState(page);
  expect(saved.transactions.length).toBe(before + 1);
  expect(saved.transactions.find((t) => t.source === 'shortcut')).toMatchObject({ merchant: 'Starbucks', amount: 1800 });
  expect(dialogs).toBe(0);
  expect(errors).toEqual([]);
});

test('Shortcuts card copies the live URL', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page, { state: seeded() });
  await tab(page, 'Профиль');
  const card = page.getByTestId('shortcuts-card');
  await expect(card).toContainText('Автоматизация Apple Pay (Команды iOS)');
  const url = await card.getByTestId('shortcut-url').innerText();
  expect(url).toBe('http://localhost:4173/?quickAdd=1&type=expense&amount=&merchant=');
  await card.getByTestId('copy-shortcut').click();
  await expect(card.getByTestId('copy-shortcut')).toContainText('Скопировано');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});

test('privacy curtain covers balances instantly on blur / app switcher', async ({ page }) => {
  await boot(page, { state: seeded() });
  const curtain = page.locator('#privacy-curtain');
  await expect(curtain).toBeHidden();
  const shownSync = await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    // проверяем в том же синхронном такте — без ожидания отрисовки
    return getComputedStyle(document.getElementById('privacy-curtain')).display;
  });
  expect(shownSync).toBe('grid');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(curtain).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(curtain).toBeVisible();
  expect(await curtain.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(5, 5, 7)');
});

test('AI key stays in sessionStorage only — never in localStorage, vault or export', async ({ page }) => {
  await boot(page, { state: seeded(), membership: PRIVATE });
  await tab(page, 'Профиль');
  await page.getByRole('button', { name: /ИИ-разбор капитала/ }).click();
  await page.locator('#ai-key').fill('sk-ant-test');
  await expect(page.getByText('Ключ живёт только до закрытия приложения')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('tenge-finance.ai-key'))).toBe('sk-ant-test');
  const vault = await readVaultState(page);
  expect(JSON.stringify(vault)).not.toContain('sk-ant-test');
  expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain('sk-ant-test');
});

test('every category shows its percentage share in Top Spending and Analytics', async ({ page }) => {
  await boot(page, { state: seeded() });
  const top = page.getByTestId('top-spending');
  await top.getByRole('button', { name: /Все категории/ }).click();
  const shares = await top.getByTestId('category-share').allInnerTexts();
  expect(shares.length).toBeGreaterThanOrEqual(6);
  for (const s of shares) expect(s).toMatch(/^(<)?\d+(,\d)?%$/);
  await tab(page, 'Аналитика');
  const rows = await page.locator('main').getByTestId('category-share').allInnerTexts();
  expect(rows.length).toBe(shares.length);
});

test('service worker: skipWaiting + clientsClaim, silent reload on update waits for open sheet', async ({ page }) => {
  await boot(page, { state: seeded() });
  const sw = await page.evaluate(() => fetch('./sw.js').then((r) => r.text()));
  expect(sw).toContain('skipWaiting()');
  expect(sw).toContain('clientsClaim()');
  expect(sw).toContain('cleanupOutdatedCaches()');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  // новая версия забрала страницу (controllerchange): пока открыт лист — не перезагружаемся
  await page.evaluate(() => {
    window.__oldBuild = true;
  });
  await page.getByRole('button', { name: 'Добавить операцию' }).click();
  await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__oldBuild === true)).toBe(true);
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect.poll(() => page.evaluate(() => window.__oldBuild === true).catch(() => null), { timeout: 10_000 }).not.toBe(true);
  await expect(page.getByTestId('balance-amount')).toContainText('1 250 000');
});
