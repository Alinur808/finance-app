import { makeState } from '../fixtures/state.js';

/** Чистый запуск с данными (или без) и без подсказки «На экран Домой». */
export async function boot(page, { state, theme, membership, security } = {}) {
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
  await page.goto('./');
  return errors;
}

export const seeded = (opts) => makeState(opts);

/** Деньги в тексте: «1 234 ₸», «−4 500,50 ₸», «1,25 млн ₸». */
export const MONEY_RE = /\d[\d\s  ]*(?:,\d+)?(?:\s(?:млрд|млн|тыс\.))?\s?₸/;

export const tab = (page, name) => page.getByRole('button', { name, exact: true }).click();
