import { monthlyProfile } from './advisor.js';
import { plural } from './format.js';

/**
 * «Стоит ли оно того?» — цена покупки в часах работы и в днях до цели.
 *
 * Ставка часа:
 *   - своя, если задана (settings.hourlyRate > 0 — меняется прямо в листе «Новая операция»);
 *   - иначе — по доходам в приложении: средний доход в месяц / 168 рабочих часов
 *     (21 день × 8 часов). Если есть «Зарплата» — считаем по ней (без возвратов и
 *     переводов от друзей).
 */
export const WORK_HOURS_PER_MONTH = 168;
const MONTH_DAYS = 30.44;

/** { rate, source: 'manual' | 'salary' | 'income' | 'none', monthlyIncome } */
export function estimateHourlyRate(transactions, { manualRate = 0, now = new Date(), profile } = {}) {
  if (manualRate > 0) return { rate: manualRate, source: 'manual', monthlyIncome: manualRate * WORK_HOURS_PER_MONTH };
  const p = profile ?? monthlyProfile(transactions, now);
  const salary = p.recent.filter((t) => t.type === 'income' && t.categoryId === 'salary').reduce((s, t) => s + t.amount, 0) * p.scale;
  if (salary > 0) return { rate: salary / WORK_HOURS_PER_MONTH, source: 'salary', monthlyIncome: salary };
  if (p.income > 0) return { rate: p.income / WORK_HOURS_PER_MONTH, source: 'income', monthlyIncome: p.income };
  return { rate: 0, source: 'none', monthlyIncome: 0 };
}

const decimal = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** 4.5 → «4,5 часа работы»; 0.25 → «15 минут работы»; 30 → «3,8 рабочего дня»; 400 → «2,4 мес. работы». */
export function describeWorkTime(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return '';
  if (hours < 1) return `${plural(Math.max(1, Math.round(hours * 60)), ['минута', 'минуты', 'минут'])} работы`;
  if (hours < 16) {
    const r = Math.round(hours * 10) / 10;
    return Number.isInteger(r) ? `${plural(r, ['час', 'часа', 'часов'])} работы` : `${decimal(r)} часа работы`;
  }
  const days = Math.round((hours / 8) * 10) / 10;
  if (days < 22) return Number.isInteger(days) ? plural(days, ['рабочий день', 'рабочих дня', 'рабочих дней']) : `${decimal(days)} рабочего дня`;
  return `${decimal(hours / WORK_HOURS_PER_MONTH)} мес. работы`;
}

/** +2 → «+2 дня»; 0.3 → «меньше дня». */
export function describeDelay(days) {
  if (!Number.isFinite(days)) return null;
  if (days < 0.5) return 'меньше чем на день';
  const d = Math.round(days);
  if (d < 60) return `+${plural(d, ['день', 'дня', 'дней'])}`;
  return `+${plural(Math.round(d / 30.44), ['месяц', 'месяца', 'месяцев'])}`;
}

const FREQUENCY = { once: 1, weekly: 52 / 12, monthly: 1 };

/**
 * Полный расчёт для покупки.
 * @param {object} p
 * @param {number} p.amount         сумма покупки, ₸
 * @param {number} p.rate           ставка часа, ₸
 * @param {number} [p.monthlySavings] сколько в среднем остаётся в месяц (advice.profile.savings)
 * @param {object} [p.goal]         активная цель { name, target, saved }
 * @param {'once'|'weekly'|'monthly'} [p.frequency]
 * @returns {{ hours, workLabel, goalDelayDays, delayLabel, goalBlocked, yearly, perMonth }}
 */
export function worthIt({ amount, rate, monthlySavings = 0, goal = null, frequency = 'once' }) {
  const hours = rate > 0 ? amount / rate : null;
  const perMonth = frequency === 'once' ? 0 : amount * FREQUENCY[frequency];
  const yearly = frequency === 'once' ? 0 : perMonth * 12;
  let goalDelayDays = null;
  let goalBlocked = false;
  if (goal && goal.target > goal.saved) {
    if (monthlySavings > 0) {
      const perDay = monthlySavings / MONTH_DAYS;
      // разовая трата отодвигает цель на сумму / накопления в день;
      // регулярная — уменьшает темп накоплений
      if (frequency === 'once') goalDelayDays = amount / perDay;
      else {
        const remaining = goal.target - goal.saved;
        const before = remaining / perDay;
        const newPerDay = (monthlySavings - perMonth) / MONTH_DAYS;
        if (newPerDay <= 0) goalBlocked = true;
        else goalDelayDays = remaining / newPerDay - before;
      }
    } else goalBlocked = true;
  }
  const totalHours = hours == null ? null : frequency === 'once' ? hours : (yearly / amount) * hours;
  return {
    hours,
    workLabel: hours ? describeWorkTime(hours) : '',
    yearlyHours: frequency === 'once' ? null : totalHours,
    yearlyWorkLabel: frequency === 'once' || !totalHours ? '' : describeWorkTime(totalHours),
    goalDelayDays,
    delayLabel: goalDelayDays == null ? null : describeDelay(goalDelayDays),
    goalBlocked,
    perMonth,
    yearly,
  };
}
