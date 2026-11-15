import { makeState } from '../fixtures/state.js';

/** Чистый запуск с данными (или без) и без подсказки «На экран Домой». */
export async function boot(page, { state, theme, membership, security, path = './' } = {}) {
  await page.addInitScript(
    ([s, t, m, sec]) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      localStorage.clear();
      localStorage.setItem('tenge-finance.ios-install-hint-dismissed-at', String(Date.now()));
      if (s) localStorage.setItem('tenge-finance.v2', s);
      if (t) localStorage.setItem('tenge-finance.theme', JSON.stringify(t));
      if (m) localStorage.setItem('tenge-finance.membership', JSON.stringify(m));
      if (sec) localStorage.setItem('tenge-finance.security', JSON.stringify(sec));
      sessionStorage.setItem('e2e-seeded', '1');
    },
    [state ? JSON.stringify(state) : null, theme ?? null, membership ?? null, security ?? null],
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  return errors;
}

export const seeded = (opts) => makeState(opts);

/** Деньги в тексте: «1 234 ₸», «−4 500,50 ₸», «1,25 млн ₸». */
export const MONEY_RE = /\d[\d\s  ]*(?:,\d+)?(?:\s(?:млрд|млн|тыс\.))?\s?₸/;

export const tab = (page, name) => page.getByRole('button', { name, exact: true }).click();

/**
 * Расшифровывает сейф прямо на странице тем же путём, что и приложение:
 * секрет из IndexedDB → PBKDF2-SHA-256 → AES-GCM. Ждёт отложенное сохранение.
 */
export async function readVaultState(page, { wait = 600 } = {}) {
  return page.evaluate(async (ms) => {
    await new Promise((r) => setTimeout(r, ms));
    const rec = JSON.parse(localStorage.getItem('tenge-finance.vault') || 'null');
    if (!rec) return null;
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open('tenge-finance-keys', 1);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const secret = await new Promise((res, rej) => {
      const g = db.transaction('keys').objectStore('keys').get('device-secret');
      g.onsuccess = () => res(g.result);
      g.onerror = () => rej(g.error);
    });
    const b = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const material = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b(rec.kdf.salt), iterations: rec.kdf.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(rec.iv), additionalData: new TextEncoder().encode('tenge-finance.vault.v1') }, key, b(rec.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }, wait);
}
