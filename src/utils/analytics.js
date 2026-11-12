import { getCategory } from '../data/categories.js';
import { addDays, dayKey, getPeriodRange, startOfDay } from './dates.js';

export const inRange = (tx, start, end) => {
  const t = new Date(tx.date).getTime();
  return t >= start.getTime() && t <= end.getTime();
};

/** Applies the global filters (period, account, category, type). */
export function filterTransactions(transactions, filters, now = new Date()) {
  const { start, end } = getPeriodRange(filters.period, now);
  return transactions.filter(
    (tx) =>
      inRange(tx, start, end) &&
      (filters.accountId === 'all' || tx.accountId === filters.accountId) &&
      (!filters.categoryId || tx.categoryId === filters.categoryId),
  );
}

export function totals(transactions) {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

/**
 * Current balance per account = opening balance + every transaction ever posted to it.
 * `openings` (from settings, travels with the JSON backup) overrides the built-in values.
 */
export function accountBalances(transactions, accounts, openings = {}) {
  const map = Object.fromEntries(accounts.map((a) => [a.id, openings[a.id] ?? a.opening]));
  for (const tx of transactions) {
    if (!(tx.accountId in map)) continue;
    map[tx.accountId] += tx.type === 'income' ? tx.amount : -tx.amount;
  }
  return map;
}

/**
 * Expense breakdown, largest first:
 * [{ id, category, amount, count, share }]
 */
export function spendingByCategory(transactions) {
  const byId = new Map();
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    total += tx.amount;
    const row = byId.get(tx.categoryId) ?? { id: tx.categoryId, category: getCategory(tx.categoryId), amount: 0, count: 0 };
    row.amount += tx.amount;
    row.count += 1;
    byId.set(tx.categoryId, row);
  }
  return [...byId.values()]
    .map((r) => ({ ...r, share: total ? r.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Groups (already sorted, newest-first) transactions into date sections. */
export function groupByDay(transactions) {
  const groups = [];
  const index = new Map();
  for (const tx of transactions) {
    const key = dayKey(tx.date);
    if (!index.has(key)) {
      const g = { key, date: startOfDay(tx.date), items: [], income: 0, expense: 0 };
      index.set(key, g);
      groups.push(g);
    }
    const g = index.get(key);
    g.items.push(tx);
    if (tx.type === 'income') g.income += tx.amount;
    else g.expense += tx.amount;
  }
  return groups;
}

/**
 * Spending series for the bar chart. Daily buckets for ranges up to ~5 weeks,
 * weekly buckets beyond that so bars stay readable on a phone.
 */
export function spendingSeries(transactions, start, end) {
  const s = startOfDay(start);
  const days = Math.round((startOfDay(end) - s) / 86400000) + 1;
  const weekly = days > 35;
  const step = weekly ? 7 : 1;
  const buckets = [];
  for (let d = s; d <= end; d = addDays(d, step)) {
    buckets.push({ start: d, end: addDays(d, step), amount: 0, weekly });
  }
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const t = new Date(tx.date);
    const i = Math.floor((startOfDay(t) - s) / (86400000 * step));
    if (buckets[i]) buckets[i].amount += tx.amount;
  }
  return buckets;
}
