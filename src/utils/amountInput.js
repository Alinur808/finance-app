import { groupDigits } from './format.js';

/**
 * Ввод сумм: цифровая клавиатура с запятой (inputMode="decimal"),
 * разряды через пробел прямо во время набора, до двух знаков после запятой.
 * Храним «сырую» строку вида "12345.5", показываем "12 345,5".
 */
export function sanitizeAmount(input) {
  const s = String(input)
    .replace(/[\s ]/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const [int, ...rest] = s.split('.');
  const intPart = int.replace(/^0+(?=\d)/, '').slice(0, 12);
  if (!rest.length) return intPart;
  return `${intPart || '0'}.${rest.join('').slice(0, 2)}`;
}

export const amountToNumber = (raw) => (raw ? Number(raw) || 0 : 0);

export function displayAmount(raw) {
  if (!raw) return '';
  const [int, dec] = raw.split('.');
  const grouped = groupDigits(Number(int || 0), { decimals: false });
  return dec !== undefined ? `${grouped},${dec}` : grouped;
}

/** Число → «сырая» строка для поля (например, при редактировании). */
export const numberToRaw = (n) => (n ? String(Math.round(n * 100) / 100) : '');
