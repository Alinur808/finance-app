const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const DAY_MS = 86400000;

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Local YYYY-MM-DD key, safe for grouping. */
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** "Вт, 10 ноября" */
export const formatShortDate = (d) => {
  const x = new Date(d);
  return `${WEEKDAYS[x.getDay()]}, ${x.getDate()} ${MONTHS_GEN[x.getMonth()]}`;
};
/** "10 нояб." */
export const formatDayMonth = (d) => {
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}`;
};
/** "март 2027" */
export const formatMonthYear = (d) => {
  const x = new Date(d);
  return `${MONTHS_NOM[x.getMonth()]} ${x.getFullYear()}`;
};
/** "1 марта 2027" */
export const formatFullDate = (d) => {
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS_GEN[x.getMonth()]} ${x.getFullYear()}`;
};
export const formatTime = (d) => {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};
export const weekdayShort = (d) => WEEKDAYS[new Date(d).getDay()];

/** "Вт, 10 ноября · Вчера" */
export function formatGroupLabel(d, now = new Date()) {
  const base = formatShortDate(d);
  if (isSameDay(d, now)) return { label: base, hint: 'Сегодня' };
  if (isSameDay(d, addDays(now, -1))) return { label: base, hint: 'Вчера' };
  return { label: base, hint: null };
}

export const PERIODS = [
  { id: 'month', label: 'Этот месяц' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Эта неделя' },
  { id: '30days', label: '30 дней' },
  { id: 'last-month', label: 'Прошлый месяц' },
  { id: 'all', label: 'Всё время' },
];

/** Returns { start, end } for a period plus the equal-length previous range for comparisons. */
export function getPeriodRange(periodId, now = new Date()) {
  const today = startOfDay(now);
  let start;
  let end = endOfDay(now);
  switch (periodId) {
    case 'today':
      start = today;
      break;
    case 'week': {
      const offset = (today.getDay() + 6) % 7; // Monday-based week
      start = addDays(today, -offset);
      break;
    }
    case 'last-month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0));
      break;
    case '30days':
      start = addDays(today, -29);
      break;
    case 'all':
      start = new Date(2000, 0, 1);
      break;
    case 'month':
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  const length = end.getTime() - start.getTime();
  let prevStart;
  let prevEnd;
  if (periodId === 'month') {
    // compare month-to-date against the same days of last month
    prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    prevEnd = endOfDay(new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate())));
  } else if (periodId === 'last-month') {
    prevStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    prevEnd = endOfDay(new Date(today.getFullYear(), today.getMonth() - 1, 0));
  } else {
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - length);
  }
  return { start, end, prevStart, prevEnd };
}
