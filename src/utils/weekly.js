import { addDays, dayKey, endOfDay, startOfDay } from './dates.js';

/**
 * «Итоги недели» и «Недельный лимит трат». Недели — с понедельника.
 * Переводы между своими счетами и курсовые разницы не считаются тратами.
 */
const NOT_SPENDING = new Set(['own', 'fx']);
const isSpend = (t) => t.type === 'expense' && !NOT_SPENDING.has(t.categoryId);
const isIncome = (t) => t.type === 'income' && t.categoryId !== 'own';

/** Понедельник недели, в которую попадает `now`, со сдвигом `offset` недель. */
export function weekStart(now = new Date(), offset = 0) {
  const today = startOfDay(now);
  return addDays(today, -((today.getDay() + 6) % 7) + offset * 7);
}

export const weekKey = (now = new Date()) => dayKey(weekStart(now));

function sumWeek(transactions, start, end) {
  let income = 0;
  let expense = 0;
  let count = 0;
  const byCategory = new Map();
  const s = start.getTime();
  const e = end.getTime();
  for (const t of transactions) {
    const at = new Date(t.date).getTime();
    if (at < s || at > e) continue;
    if (isIncome(t)) income += t.amount;
    else if (isSpend(t)) {
      expense += t.amount;
      count += 1;
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
    }
  }
  return { income, expense, count, byCategory };
}

/**
 * Какую неделю подводить: в воскресенье — текущую (она заканчивается),
 * в остальные дни — прошлую, уже завершённую.
 */
export function recapWeekOffset(now = new Date()) {
  return now.getDay() === 0 ? 0 : -1;
}

/** Итоги недели в конце недели (вс/пн) показываются на главном экране сами. */
export const isRecapDay = (now = new Date()) => now.getDay() === 0 || now.getDay() === 1;

/**
 * { start, end, income, expense, net, count, prevExpense, change, top: { categoryId, amount, share } | null, hasData }
 * change — доля изменения расходов к предыдущей неделе (null, если сравнивать не с чем).
 */
export function buildWeeklyRecap(transactions, now = new Date(), offset = recapWeekOffset(now)) {
  const start = weekStart(now, offset);
  const end = endOfDay(addDays(start, 6));
  const cur = sumWeek(transactions, start, end);
  const prev = sumWeek(transactions, weekStart(now, offset - 1), new Date(start.getTime() - 1));
  let top = null;
  for (const [categoryId, amount] of cur.byCategory) if (!top || amount > top.amount) top = { categoryId, amount };
  if (top) top.share = cur.expense > 0 ? top.amount / cur.expense : 0;
  const prevHasData = prev.expense > 0 || prev.income > 0;
  return {
    start,
    end,
    offset,
    income: cur.income,
    expense: cur.expense,
    net: cur.income - cur.expense,
    count: cur.count,
    prevExpense: prev.expense,
    change: prevHasData && prev.expense > 0 ? (cur.expense - prev.expense) / prev.expense : null,
    top,
    hasData: cur.expense > 0 || cur.income > 0,
  };
}

/** Сколько потрачено за текущую неделю (пн — сегодня). */
export function spentThisWeek(transactions, now = new Date()) {
  return sumWeek(transactions, weekStart(now), endOfDay(now)).expense;
}

/**
 * Состояние недельного лимита. limit = 0 — выключен (null).
 * { limit, spent, left, used, exhausted, wouldExceed(amount) }
 */
export function weeklyLimitState(transactions, limit, now = new Date()) {
  if (!limit || limit <= 0) return null;
  const spent = spentThisWeek(transactions, now);
  return {
    limit,
    spent,
    left: limit - spent,
    used: spent / limit,
    exhausted: spent >= limit,
    daysLeft: 7 - ((startOfDay(now).getDay() + 6) % 7), // включая сегодня
    wouldExceed: (amount) => spent + amount > limit,
  };
}
