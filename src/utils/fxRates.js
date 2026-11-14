/**
 * Ориентировочные курсы (₸ за единицу) — только для выписок, где банк не
 * напечатал свой курс. Совпадают с запасными курсами разборщика Freedom
 * (AED 125, USD = AED × 3,6725 — дирхам привязан к доллару).
 * В подтверждении импорта пользователь видит, какой курс применён.
 */
export const REFERENCE_RATES = { KZT: 1, AED: 125, USD: 459.06, EUR: 540, GBP: 615, RUB: 5.5 };

const round2 = (n) => Math.round(n * 100) / 100;

/** { kzt, rate } или null, если валюта неизвестна. */
export function toKZT(amount, currency) {
  const rate = REFERENCE_RATES[currency];
  if (rate == null) return null;
  return { kzt: round2(amount * rate), rate };
}
