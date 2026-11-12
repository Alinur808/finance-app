import { addDays, DAY_MS, startOfDay } from './dates.js';

/**
 * Повторяющиеся события по календарю (поступления денег).
 * Правило:
 *   { type: 'weekly',  weekday: 0 }  — каждую неделю; 0 = воскресенье … 6 = суббота
 *   { type: 'monthly', day: 5 }      — каждый месяц; если дня нет (31 февраля) — последний день месяца
 */

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'понедельник', every: 'каждый понедельник' },
  { value: 2, label: 'вторник', every: 'каждый вторник' },
  { value: 3, label: 'среда', every: 'каждую среду' },
  { value: 4, label: 'четверг', every: 'каждый четверг' },
  { value: 5, label: 'пятница', every: 'каждую пятницу' },
  { value: 6, label: 'суббота', every: 'каждую субботу' },
  { value: 0, label: 'воскресенье', every: 'каждое воскресенье' },
];

/** "2026-12-14" → локальная полночь 14 декабря (без сдвига часового пояса, в отличие от new Date("2026-12-14")). */
export function parseLocalDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Целых календарных дней от a до b (b − a). Math.round гасит возможный час перехода на летнее время. */
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

/**
 * Все даты срабатывания правила в промежутке (after; until] —
 * строго ПОСЛЕ дня `after` и включая день `until`.
 * Сегодняшний день не считаем: если деньги сегодня уже пришли, они уже в балансе.
 */
export function occurrences(rule, after, until) {
  const start = addDays(startOfDay(after), 1);
  const end = startOfDay(until);
  const dates = [];
  if (end < start) return dates;

  if (rule.type === 'weekly') {
    const offset = (rule.weekday - start.getDay() + 7) % 7;
    for (let d = addDays(start, offset); d <= end; d = addDays(d, 7)) dates.push(d);
  } else if (rule.type === 'monthly') {
    // идём по месяцам; new Date(y, 12, 1) сам перейдёт на январь следующего года
    for (let y = start.getFullYear(), m = start.getMonth(); new Date(y, m, 1) <= end; m += 1) {
      const lastDay = new Date(y, m + 1, 0).getDate();
      const d = new Date(y, m, Math.min(rule.day, lastDay));
      if (d >= start && d <= end) dates.push(d);
    }
  }
  return dates;
}

/** Человекочитаемое правило: «каждое воскресенье», «5-го числа каждого месяца». */
export function describeRule(rule) {
  if (rule.type === 'weekly') return WEEKDAY_OPTIONS.find((w) => w.value === rule.weekday)?.every ?? '';
  if (rule.type === 'monthly') return `${rule.day}-го числа каждого месяца`;
  return '';
}
