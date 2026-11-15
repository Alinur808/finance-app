import { addDays, startOfDay, isSameDay } from './dates.js';
import { monthlyProfile } from './advisor.js';
import { buildPlanForecast } from './plan.js';

/**
 * «Сегодня можно потратить X ₸» — одна цифра для героя «Цель и темп трат».
 *
 * 1. Есть план «Финансового дневника» (цели-покупки или поступления) — берём
 *    его дневной лимит: он учитывает баланс, будущие поступления и дедлайн.
 * 2. Плана нет — считаем от месяца:
 *       бюджет месяца = средний доход в месяц − сколько нужно отложить на цель в месяц
 *       осталось      = бюджет месяца − потрачено с 1-го числа до вчера
 *       на сегодня    = осталось / дней до конца месяца (включая сегодня) − потрачено сегодня
 * Переводы между своими счетами и курсовые разницы — не траты.
 *
 * Возвращает { source: 'diary' | 'month', allowance, daily, spentToday, status } или null (нет доходов — не из чего считать).
 */
const NOT_SPENDING = new Set(['own', 'fx']);
const spend = (t) => t.type === 'expense' && !NOT_SPENDING.has(t.categoryId);

export function buildSafeToSpend({ transactions, balance, plan, advice, now = new Date() }) {
  const hasPlan = plan && (plan.items.length > 0 || plan.incomes.length > 0);
  if (hasPlan) {
    const f = buildPlanForecast({ plan, balance, transactions, now });
    if (!f.isOver) {
      return {
        source: 'diary',
        allowance: f.leftToday,
        daily: f.dailyLimit,
        spentToday: f.spentToday,
        status: f.safe < 0 ? 'short' : f.leftToday < 0 ? 'over' : 'ok',
        forecast: f,
      };
    }
  }

  const p = advice?.profile ?? monthlyProfile(transactions, now);
  if (!(p.income > 0)) return null;
  const today = startOfDay(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = Math.round((monthEnd - today) / 86400000) + 1;
  let spentBefore = 0;
  let spentToday = 0;
  for (const t of transactions) {
    if (!spend(t)) continue;
    const d = new Date(t.date);
    if (d < monthStart || d > now) continue;
    if (isSameDay(d, today)) spentToday += t.amount;
    else spentBefore += t.amount;
  }
  const goalMonthly = advice && advice.status !== 'done' ? Math.max(0, advice.requiredMonthly) : 0;
  const budget = p.income - goalMonthly;
  const daily = Math.max(0, budget - spentBefore) / Math.max(1, daysLeft);
  const allowance = daily - spentToday;
  return {
    source: 'month',
    allowance,
    daily,
    spentToday,
    goalMonthly,
    status: budget - spentBefore <= 0 ? 'short' : allowance < 0 ? 'over' : 'ok',
    resetsOn: addDays(monthEnd, 1),
  };
}
