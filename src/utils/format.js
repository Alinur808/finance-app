const int = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NBSP = ' ';

const clean = (s) => s.replace(/\s/g, NBSP);
const hasKopecks = (n) => Math.abs(Math.round(n * 100) % 100) > 0;

/** 1234567 → "1 234 567"; 2955.95 → "2 955,95". `decimals: true` всегда показывает тиыны. */
export const groupDigits = (n, { decimals } = {}) =>
  clean((decimals === true || (decimals !== false && hasKopecks(n)) ? dec : int).format(decimals === false ? Math.round(n) : n));

/**
 * formatMoney(-4500) → "−4 500 ₸"; formatMoney(550000, { sign: true }) → "+550 000 ₸".
 * compact: 1 250 000 → "1,25 млн ₸", 540 000 → "540 тыс. ₸".
 */
export function formatMoney(value, { sign = false, compact = false, decimals } = {}) {
  const abs = Math.abs(value);
  let body;
  if (compact && abs >= 1_000_000) body = `${trim(abs / 1_000_000, 2)}${NBSP}млн`;
  else if (compact && abs >= 10_000) body = `${trim(abs / 1000, 0)}${NBSP}тыс.`;
  else body = groupDigits(abs, { decimals: compact ? false : decimals });
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : '';
  return `${prefix}${body}${NBSP}₸`;
}

const trim = (n, digits) => clean(Number(n.toFixed(digits)).toLocaleString('ru-RU'));

export const formatPercent = (ratio, digits = 0) => `${(ratio * 100).toFixed(digits).replace('.', ',')}%`;

/** Сумма операции со знаком, как в списке. */
export const formatTxAmount = (tx) => formatMoney(tx.type === 'expense' ? -tx.amount : tx.amount, { sign: true });

export const formatOriginal = (o) => (o ? `${groupDigits(o.amount, { decimals: true })}${NBSP}${o.currency}` : '');

/** Русское склонение: plural(5, ['операция', 'операции', 'операций']) → "5 операций". */
export function plural(n, [one, few, many], withNumber = true) {
  const abs = Math.abs(Math.round(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return withNumber ? `${abs}${NBSP}${word}` : word;
}
