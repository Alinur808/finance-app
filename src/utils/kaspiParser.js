/**
 * Разбор PDF-выписки Kaspi Gold (Kaspi.kz → Kaspi Gold → Выписка) прямо в браузере.
 *
 * Строка таблицы: Дата | Сумма | Операция | Детали
 *   14.11.26   - 12 450,00 ₸   Покупка   Magnum Cash&Carry
 *              (- 9,99 USD)                                   ← сумма в валюте (если была)
 *                                         продолжение деталей ← длинный текст переносится
 *
 * Работаем со строками, собранными по координатам текста из PDF (pdf.js может
 * разбить «- 12 450,00 ₸» на несколько кусков — склеиваем их по строке).
 * Строка-«якорь» начинается с даты ДД.ММ.ГГ; строки ниже, сдвинутые вправо
 * от колонки даты, — продолжение той же операции.
 *
 * Поддерживается и английская версия выписки (Purchases / Transfers / …).
 * Модуль не зависит от React и браузера — проверяется тестами в Node.
 */
import { StatementFormatError } from './freedomParser.js';
import { categorizeTransaction } from './categorizer.js';
import { headerLines } from './universalStatementParser.js';

const SHORT_DATE = '(\\d{2})\\.(\\d{2})\\.(\\d{2})';
const MONEY = '([-+−])\\s*(\\d[\\d\\s\\u00a0\\u202f]*,\\d{2})\\s*₸';
const OPS = {
  Покупка: 'purchase',
  Покупки: 'purchase',
  Purchases: 'purchase',
  Пополнение: 'topup',
  Replenishment: 'topup',
  Перевод: 'transfer',
  Transfers: 'transfer',
  Разное: 'other',
  Others: 'other',
  Снятие: 'withdrawal',
  Withdrawals: 'withdrawal',
};
const ROW_RE = new RegExp(`^${SHORT_DATE}\\s+${MONEY}\\s+(${Object.keys(OPS).join('|')})(?=\\s|$)\\s*(.*)$`);
const FOREIGN_RE = /^\(\s*([-+−])?\s*(\d[\d\s ]*[.,]\d{2})\s*([A-Z]{3})\s*\)\s*(.*)$/;
const DATE_ONLY = new RegExp(`^${SHORT_DATE}$`);
// колонтитулы, повтор шапки таблицы, номера страниц — не продолжение операции
const NOISE_RE = /^(Дата\s+Сумма|Date\s+Amount|стр\.|страница|page\b|\d+\s*(из|of|\/)\s*\d+$|АО\s*«?Kaspi|Kaspi Bank|kaspi\.kz|www\.|Доступно на|Card balance)/i;

/**
 * Похоже ли на выписку Kaspi. Смотрим только шапку первой страницы (до первой операции):
 * слово «Kaspi» в деталях переводов чужой выписки не должно её «захватить».
 */
export function isKaspiStatement(pages) {
  if (!pages[0]) return false;
  const head = headerLines(pages[0])
    .map((l) => l.text)
    .join(' ');
  return /Kaspi\s*Gold|Kaspi\s*Bank|Каспи\s*Банк|kaspi\.kz/i.test(head);
}

const toNumber = (s) =>
  Number(
    String(s)
      .replace(/[\s  ]/g, '')
      .replace(',', '.'),
  );
const round2 = (n) => Math.round(n * 100) / 100;
/** «14.11.26» → «2026-11-14». */
export const kaspiDay = (dd, mm, yy) => `20${yy}-${mm}-${dd}`;
const parseShort = (s) => {
  const m = s.match(new RegExp(SHORT_DATE));
  return m ? kaspiDay(m[1], m[2], m[3]) : null;
};

/**
 * Текст страницы → строки (сверху вниз) с левой границей: [{ text, x }].
 * Куски на одной высоте (±3 pt) — одна строка.
 */
export function pageLines(page) {
  const sorted = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => {
    const items = l.items.sort((a, b) => a.x - b.x);
    return {
      x: items[0].x,
      text: items
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Категории                                                           */
/* ------------------------------------------------------------------ */

// операции между своими счетами Kaspi (депозит, сейф) — классификатор отнесёт их к «Между своими счетами»
const OWN_RE = /Kaspi\s*Депозит|Kaspi\s*Сейф|Kaspi Deposit/i;

function categorize({ op, sign, details }) {
  if (OWN_RE.test(details)) return 'own';
  // «Разное» в Kaspi — комиссии, погашения, бонусы; отдельного типа у классификатора нет
  return categorizeTransaction({ text: details, sign, kind: op === 'other' ? null : op });
}

/** Короткое описание для списка; полный текст — в note. */
function cleanMerchant({ op, sign, details, categoryId }) {
  const s = details.replace(/\s+/g, ' ').trim();
  if (categoryId === 'own') return sign === '+' ? 'С Kaspi Депозита' : 'На Kaspi Депозит';
  if (categoryId === 'fx') return 'Курсовая разница';
  if (op === 'withdrawal') return s ? `Снятие · ${s}` : 'Снятие наличных';
  if (!s) return { topup: 'Пополнение', transfer: 'Перевод', other: 'Kaspi', purchase: 'Покупка' }[op] ?? 'Операция по карте';
  if (op === 'transfer') return `Перевод: ${s}`;
  return s.length > 64 ? `${s.slice(0, 61)}…` : s;
}

/* ------------------------------------------------------------------ */
/* Шапка                                                               */
/* ------------------------------------------------------------------ */

function parseHeader(lines) {
  const text = lines.map((l) => l.text).join('\n');
  const period = text.match(new RegExp(`(?:период|period)\\s+(?:с|from)\\s+(\\d{2}\\.\\d{2}\\.\\d{2})\\s+(?:по|to)\\s+(\\d{2}\\.\\d{2}\\.\\d{2})`, 'i'));
  const card = text.match(/(?:карт[аы]|card)[^\n*]{0,30}\*\s?(\d{4})/i) ?? text.match(/\*(\d{4})\b/);
  const balances = [...text.matchAll(new RegExp(`(?:Доступно на|Card balance)\\s+(\\d{2}\\.\\d{2}\\.\\d{2})\\s*${MONEY}`, 'gi'))]
    .map((m) => ({ day: parseShort(m[1]), amount: toNumber(m[3]) * (m[2] === '+' ? 1 : -1) }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return {
    period: period ? { from: parseShort(period[1]), to: parseShort(period[2]) } : null,
    cardLast4: card?.[1] ?? null,
    opening: balances.length > 1 ? balances[0].amount : null,
    closing: balances.length ? balances[balances.length - 1].amount : null,
  };
}

/* ------------------------------------------------------------------ */
/* Главная функция                                                     */
/* ------------------------------------------------------------------ */

/**
 * Страницы PDF → операции приложения (та же схема, что у Freedom и резервной копии).
 * @returns {{ bank, cardName, period, closingBalance, transactions, rates, warnings }}
 */
export function parseKaspiStatement(pages) {
  if (!isKaspiStatement(pages)) throw new StatementFormatError('Это не похоже на выписку Kaspi Gold.');

  const all = pages.flatMap(pageLines);
  const header = parseHeader(all);

  const rows = [];
  let dateX = null;
  for (const line of all) {
    const m = line.text.match(ROW_RE);
    if (m) {
      const [, dd, mm, yy, sign, value, opWord, details] = m;
      dateX ??= line.x;
      rows.push({ day: kaspiDay(dd, mm, yy), sign: sign === '+' ? '+' : '-', amount: toNumber(value), op: OPS[opWord], details: [details], original: null });
      continue;
    }
    const last = rows[rows.length - 1];
    if (!last || NOISE_RE.test(line.text) || DATE_ONLY.test(line.text)) continue;
    // продолжение строки: сдвинуто вправо от колонки даты (колонтитулы начинаются у поля)
    if (dateX != null && line.x <= dateX + 20) continue;
    const fx = line.text.match(FOREIGN_RE);
    if (fx && !last.original) {
      last.original = { amount: toNumber(fx[2]), currency: fx[3] };
      if (fx[4]) last.details.push(fx[4]); // на той же высоте может идти перенос деталей
    } else last.details.push(line.text);
  }

  if (!rows.length) throw new StatementFormatError('В выписке Kaspi не найдено ни одной операции.');

  const perDay = new Map();
  const transactions = rows
    .map((r) => {
      const details = r.details.join(' ').replace(/\s+/g, ' ').trim();
      const categoryId = categorize({ op: r.op, sign: r.sign, details });
      const n = (perDay.get(r.day) ?? 0) + 1;
      perDay.set(r.day, n);
      const [y, m, d] = r.day.split('-').map(Number);
      const date = new Date(y, m - 1, d, 12, 0, 0);
      date.setSeconds(-n); // порядок внутри дня как в выписке: сверху — новее
      return {
        id: `kpdf-${r.day.replace(/-/g, '')}-${String(n).padStart(2, '0')}`,
        type: r.sign === '+' ? 'income' : 'expense',
        amount: round2(r.amount),
        categoryId,
        merchant: cleanMerchant({ op: r.op, sign: r.sign, details, categoryId }),
        accountId: 'kaspi', // основная карта приложения (внутренний id)
        date: date.toISOString(),
        noTime: true,
        note: details,
        ...(r.original ? { original: r.original } : {}),
        source: 'kaspi-pdf',
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const days = rows.map((r) => r.day).sort();
  const period = header.period ?? { from: days[0], to: days[days.length - 1] };

  const warnings = [];
  if (header.closing == null) warnings.push('В выписке не найден остаток «Доступно на …» — баланс карты изменится на сумму операций; проверьте его после импорта.');
  if (header.opening != null && header.closing != null) {
    const net = transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    const diff = round2(header.opening + net - header.closing);
    if (Math.abs(diff) >= 1) warnings.push(`Операции не сходятся с остатками выписки на ${String(Math.abs(diff)).replace('.', ',')} ₸ — проверьте баланс после импорта.`);
  }

  return {
    bank: 'kaspi',
    cardName: header.cardLast4 ? `Kaspi Gold *${header.cardLast4}` : 'Kaspi Gold',
    period,
    closingBalance: header.closing,
    transactions,
    rates: [],
    warnings,
  };
}
