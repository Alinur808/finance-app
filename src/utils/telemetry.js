import { monthlyProfile } from './advisor.js';

const MONTH_DAYS = 30.44;

/**
 * Главные цифры — то, что стоит знать о своих деньгах в первую очередь:
 *   burn          — расходы в месяц и в день (без переводов между своими счетами);
 *   savingsRate   — какую долю дохода вы откладываете;
 *   runwayDays    — на сколько дней хватит денег при нынешних тратах;
 *   concentration — доля крупнейшей статьи в расходах (и трёх главных).
 * Окно — последние 60 дней (или меньше, если данных меньше), как у советника.
 */
export function buildTelemetry(transactions, balance, now = new Date()) {
  const p = monthlyProfile(transactions, now);
  const burnDaily = p.expense / MONTH_DAYS;
  const top = p.categories[0] ?? null;
  const top3 = p.categories.slice(0, 3).reduce((s, c) => s + c.share, 0);
  return {
    windowDays: p.windowDays,
    hasData: p.income > 0 || p.expense > 0,
    inflow: p.income,
    burn: p.expense,
    burnDaily,
    net: p.savings,
    savingsRate: p.income > 0 ? p.savings / p.income : null,
    runwayDays: burnDaily > 0 ? Math.max(0, balance) / burnDaily : Infinity,
    concentration: top ? { id: top.id, name: top.category.name, share: top.share, monthly: top.monthly } : null,
    top3Share: top3,
    balance,
  };
}

/** Короткий вердикт по запасу денег: сколько месяцев «подушки». */
export function runwayTone(days) {
  if (!Number.isFinite(days)) return 'good';
  if (days >= 180) return 'good';
  if (days >= 60) return 'watch';
  return 'risk';
}
