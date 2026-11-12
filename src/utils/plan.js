import { isSameDay, startOfDay } from './dates.js';
import { daysBetween, occurrences, parseLocalDate } from './schedule.js';

/**
 * Пустой план «Финансового дневника» для нового пользователя: дедлайн —
 * последний день текущего месяца, без целей и поступлений (их задают в
 * редакторе плана). Хранится в состоянии приложения (ключ `plan`), поэтому
 * сохраняется в localStorage и попадает в экспорт JSON.
 * Даты — строки "ГГГГ-ММ-ДД", чтобы не зависеть от часового пояса.
 */
export function createEmptyPlan(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const deadline = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return { deadline, items: [], incomes: [] };
}

/**
 * Прогноз к дедлайну.
 *
 *   Ожидаемый доход    = Σ (сумма поступления × число его дат после сегодня и до дедлайна включительно)
 *   Капитал к дедлайну = Текущий баланс + Ожидаемый доход
 *   Свободно           = Капитал к дедлайну − Неоплаченные цели
 *
 * Дневной лимит считается от баланса на начало дня (текущий баланс + потраченное
 * сегодня), чтобы он не «уплывал» в течение дня, и делится на дни до дедлайна:
 * сегодня входит, день дедлайна — нет (в этот день деньги уже нужны на цели).
 *
 * @param {object}   args
 * @param {object}   args.plan          состояние plan (см. createEmptyPlan)
 * @param {number}   args.balance       текущий баланс всех счетов, ₸
 * @param {object[]} args.transactions  операции (для «потрачено сегодня»)
 * @param {Date}     [args.now]
 */
export function buildPlanForecast({ plan, balance, transactions = [], now = new Date() }) {
  const today = startOfDay(now);
  const deadline = parseLocalDate(plan.deadline);
  const daysLeft = Math.max(0, daysBetween(today, deadline));
  const isOver = daysBetween(today, deadline) < 0;

  // 1. Поступления: даты и суммы по каждому правилу
  const incomes = plan.incomes.map((inc) => {
    const dates = occurrences(inc.rule, today, deadline);
    return { ...inc, dates, count: dates.length, total: dates.length * inc.amount };
  });
  const totalIncome = incomes.reduce((s, i) => s + i.total, 0);
  const nextIncome = incomes
    .flatMap((i) => i.dates.map((date) => ({ date, amount: i.amount, name: i.name })))
    .sort((a, b) => a.date - b.date)[0] ?? null;

  // 2. Цели: оплаченные уже списаны с баланса, поэтому в «нужно» не входят
  const openItems = plan.items.filter((i) => !i.paidOn);
  const goalsTotal = openItems.reduce((s, i) => s + i.amount, 0);
  const goalsPaid = plan.items.filter((i) => i.paidOn).reduce((s, i) => s + i.amount, 0);

  // 3. Главные формулы
  const projected = balance + totalIncome;
  const safe = projected - goalsTotal;

  // 4. Дневник на сегодня. Покупки целей, отмеченные сегодня, не считаем «тратами дня».
  const spentRaw = transactions
    .filter((t) => t.type === 'expense' && t.categoryId !== 'fx' && t.categoryId !== 'own' && isSameDay(t.date, today))
    .reduce((s, t) => s + t.amount, 0);
  const paidGoalsToday = plan.items.filter((i) => i.paidOn && isSameDay(parseLocalDate(i.paidOn), today)).reduce((s, i) => s + i.amount, 0);
  const spentToday = Math.max(0, spentRaw - paidGoalsToday);
  const safeAtDayStart = safe + spentToday;
  const spendDays = Math.max(1, daysLeft);
  const dailyLimit = Math.max(0, safeAtDayStart) / spendDays;
  const leftToday = dailyLimit - spentToday;

  return {
    deadline,
    daysLeft,
    isOver,
    incomes,
    totalIncome,
    nextIncome,
    goalsTotal,
    goalsPaid,
    openItemsCount: openItems.length,
    balance,
    projected,
    safe,
    dailyLimit,
    spentToday,
    leftToday,
    status: safe < 0 ? 'short' : leftToday < 0 ? 'over-today' : 'ok',
    coverage: goalsTotal > 0 ? projected / goalsTotal : 1,
  };
}
