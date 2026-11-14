/**
 * Универсальный разборщик банковских выписок (любой банк, любой язык из ru/en).
 *
 * На входе — страницы pdf.js: [{ items: [{ str, x, y, w }] }] (y растёт вверх).
 *   1. Текст собирается в строки по Y, а строки — в «ячейки» по разрывам X.
 *   2. Шапка таблицы (Дата / Описание / Сумма / Расход / Приход / Остаток…)
 *      задаёт колонки; без шапки колонки сумм находятся кластеризацией X.
 *   3. Строка-операция начинается с даты; строки ниже, сдвинутые вправо,
 *      — перенос описания. Колонтитулы, номера страниц, QR-подписи и итоги
 *      («Итого», «Total», «Opening/Closing balance») отбрасываются.
 *   4. Знак суммы: колонка Расход/Приход → явный +/−, скобки, CR/DR →
 *      изменение остатка между строками → слова «пополнение», «salary»…
 *   5. Суммы в валюте счёта ≠ ₸ переводятся в тенге по ориентировочному курсу.
 *
 * Профиль (profile) позволяет «подсказать» разбор для конкретного банка
 * (см. halykParser.js), не дублируя движок. Модуль не зависит от браузера.
 */
import { StatementFormatError } from './freedomParser.js';
import { categorizeTransaction, detectKind } from './categorizer.js';
import { REFERENCE_RATES, toKZT } from './fxRates.js';

/* ------------------------------------------------------------------ */
/* Числа, валюты, даты                                                 */
/* ------------------------------------------------------------------ */

const CURRENCY_TOKENS = [
  [/₸|\bKZT\b|(?<![А-Яа-яЁёA-Za-z])тг\.?(?![А-Яа-яЁё])|тенге/i, 'KZT'],
  [/\bAED\b|د\.إ/, 'AED'],
  [/€|\bEUR\b/, 'EUR'],
  [/£|\bGBP\b/, 'GBP'],
  [/₽|\bRUB\b|(?<![А-Яа-яЁёA-Za-z])руб\.?(?![А-Яа-яЁё])/i, 'RUB'],
  [/\$|\bUSD\b/, 'USD'],
];
const CURRENCY_STRIP = /₸|\bKZT\b|(?<![А-Яа-яЁёA-Za-z])тг\.?(?![А-Яа-яЁё])|тенге|\bAED\b|د\.إ|€|\bEUR\b|£|\bGBP\b|₽|\bRUB\b|(?<![А-Яа-яЁёA-Za-z])руб\.?(?![А-Яа-яЁё])|\$|\bUSD\b/gi;
const CODE_ONLY = /^(KZT|USD|AED|EUR|RUB|GBP)$/;

export function detectCurrency(s) {
  for (const [re, code] of CURRENCY_TOKENS) if (re.test(s)) return code;
  return null;
}

/** «1 234,56» / «1,234.56» / «1.234,56» / «1234» → число. */
export function parseNumber(raw) {
  const s = raw.replace(/[\s  '’]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized;
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    normalized = s
      .split(dec === ',' ? '.' : ',')
      .join('')
      .replace(dec, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    // один разделитель и 1–2 цифры после — десятичная часть; иначе — разряды
    normalized = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Сумма в одной ячейке: { value (> 0), sign: 1 | -1 | 0 (не указан), currency, explicit }.
 * Поддерживает «+»/«−» в начале и в конце, (250.00), CR/DR, символы и коды валют.
 */
export function parseAmount(text) {
  let s = String(text).trim();
  if (!s || s.length > 32) return null;
  let sign = 0;
  const crdr = s.match(/\s*\b(CR|DR|Cr|Dr|cr|dr)\.?$/);
  if (crdr) {
    sign = /cr/i.test(crdr[1]) ? 1 : -1;
    s = s.slice(0, crdr.index).trim();
  }
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }
  const currency = detectCurrency(s);
  s = s.replace(CURRENCY_STRIP, '').trim();
  const lead = s.match(/^([+\-−–])\s*/);
  if (lead) {
    sign = lead[1] === '+' ? 1 : -1;
    s = s.slice(lead[0].length);
  }
  const trail = s.match(/\s*([+\-−–])$/);
  if (trail) {
    sign = trail[1] === '+' ? 1 : -1;
    s = s.slice(0, trail.index);
  }
  s = s.trim();
  // суммы без копеек принимаем только с валютой или знаком — иначе это номера документов
  if (!/^\d{1,3}([\s  ,.'’]\d{3})*([.,]\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(s)) return null;
  const hasDecimals = /[.,]\d{1,2}$/.test(s);
  if (!hasDecimals && !currency && !sign) return null;
  const value = parseNumber(s);
  if (value == null) return null;
  return { value, sign, currency, explicit: Boolean(sign) };
}

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  мая: 5,
  май: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12,
};
const monthOf = (word) => MONTHS[word.toLowerCase().replace(/\.$/, '').slice(0, 4)] ?? MONTHS[word.toLowerCase().slice(0, 3)] ?? null;
const fullYear = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y));
const iso = (y, m, d) => {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return null;
  if (new Date(y, m - 1, d).getDate() !== d) return null; // 31.02 и т.п.
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/**
 * Дата в начале строки → { day: 'YYYY-MM-DD', length } или null.
 * slashOrder: 'DMY' | 'MDY' — для 01/02/2026 (определяется по всему документу).
 */
export function parseDate(text, slashOrder = 'DMY') {
  const s = String(text).trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/);
  if (m) return wrap(iso(fullYear(m[3]), +m[2], +m[1]), m[0]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?!\d)/);
  if (m) return wrap(iso(+m[1], +m[2], +m[3]), m[0]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/);
  if (m) return wrap(slashOrder === 'MDY' ? iso(fullYear(m[3]), +m[1], +m[2]) : iso(fullYear(m[3]), +m[2], +m[1]), m[0]);
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-zА-Яа-яЁё]{3,9})\.?,?[\s-]+(\d{4}|\d{2})(?!\d)/);
  if (m && monthOf(m[2])) return wrap(iso(fullYear(m[3]), monthOf(m[2]), +m[1]), m[0]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?!\d)/);
  if (m && monthOf(m[1])) return wrap(iso(+m[3], monthOf(m[1]), +m[2]), m[0]);
  return null;
}
const wrap = (day, raw) => (day ? { day, length: raw.length } : null);

/** Все даты в тексте (в любом из поддерживаемых форматов), по порядку. */
export function datesIn(text, slashOrder = 'DMY') {
  const out = [];
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    if (i > 0 && !/[\s(:,]/.test(s[i - 1])) continue;
    const d = parseDate(s.slice(i), slashOrder);
    if (d) {
      out.push(d.day);
      i += d.length - 1;
    }
  }
  return out;
}

/** По всем датам вида 01/02/2026: если где-то первое число > 12 — DMY, если второе — MDY. */
function slashOrderOf(texts) {
  let dmy = false;
  let mdy = false;
  for (const t of texts) {
    for (const m of t.matchAll(/(?:^|\s)(\d{1,2})\/(\d{1,2})\/\d{2,4}/g)) {
      if (+m[1] > 12) dmy = true;
      if (+m[2] > 12) mdy = true;
    }
  }
  return mdy && !dmy ? 'MDY' : 'DMY';
}

/* ------------------------------------------------------------------ */
/* Строки и ячейки                                                     */
/* ------------------------------------------------------------------ */

const CELL_GAP = 4; // pt: ближе — одна ячейка («-», «12 450,00», «₸»)

/** Страница → строки сверху вниз: { y, x, text, cells: [{ text, x, x2 }] }. */
export function buildLines(page) {
  const items = page.items.filter((i) => i.str && i.str.trim());
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) last.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows.map((r) => {
    const its = r.items.sort((a, b) => a.x - b.x);
    const cells = [];
    for (const it of its) {
      const prev = cells[cells.length - 1];
      const w = it.w || it.str.length * 4.5;
      if (prev && it.x - prev.x2 < CELL_GAP) {
        prev.text = `${prev.text}${it.x - prev.x2 > 0.5 ? ' ' : ''}${it.str.trim()}`;
        prev.x2 = Math.max(prev.x2, it.x + w);
      } else cells.push({ text: it.str.trim(), x: it.x, x2: it.x + w });
    }
    return { y: r.y, x: cells[0].x, cells, text: cells.map((c) => c.text).join(' ') };
  });
}

/**
 * Шапка документа: строки первой страницы до первой строки-операции (с датой в начале).
 * Банк и карту ищем только здесь — названия банков в описаниях операций не мешают.
 */
export function headerLines(page, limit = 25) {
  const lines = buildLines(page);
  const out = [];
  for (const l of lines) {
    if (out.length >= limit || parseDate(l.cells[0].text) || parseDate(l.text)) break;
    out.push(l);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Шапка таблицы                                                       */
/* ------------------------------------------------------------------ */

const ROLE_PATTERNS = [
  ['debit', /расход|списан|дебет|debit|withdrawal|money out|paid out|^out$|outflow/i],
  ['credit', /приход|поступлен|зачислен|кредит|credit|deposit|money in|paid in|^in$|inflow/i],
  ['balance', /остаток|баланс|balance/i],
  ['fee', /комисси|^fees?$|commission/i],
  ['currency', /^валюта|^currency|^ccy/i],
  ['date', /дата|date|күні/i],
  ['amount', /сумма|amount|^sum$/i],
  ['description', /описание|детали|назначение|операци|description|details|narration|merchant|reference|particulars|transaction|payee|контрагент/i],
];

function roleOf(text, profile) {
  for (const [role, re] of profile.roles ?? []) if (re.test(text)) return role;
  for (const [role, re] of ROLE_PATTERNS) if (re.test(text)) return role;
  return null;
}

/** Строка-шапка: ≥ 3 колонок, среди них дата и сумма (или расход/приход). */
function findHeader(lines, profile) {
  for (const line of lines) {
    const cols = [];
    let dates = 0;
    for (const c of line.cells) {
      if (c.text.length > 40) continue;
      let role = roleOf(c.text, profile);
      if (!role) continue;
      if (role === 'date' && dates++ > 0) role = 'date2';
      if (cols.some((x) => x.role === role)) continue;
      cols.push({ role, center: (c.x + c.x2) / 2, x: c.x });
    }
    const roles = new Set(cols.map((c) => c.role));
    if (cols.length >= 3 && roles.has('date') && (roles.has('amount') || roles.has('debit') || roles.has('credit'))) {
      return { y: line.y, columns: cols.sort((a, b) => a.center - b.center) };
    }
  }
  return null;
}

/** Колонка ячейки — ближайшая по центру колонка шапки (границы — середины между соседями). */
function columnOf(cell, header) {
  const center = (cell.x + cell.x2) / 2;
  let best = null;
  for (const col of header.columns) if (!best || Math.abs(col.center - center) < Math.abs(best.center - center)) best = col;
  return best?.role ?? null;
}

/* ------------------------------------------------------------------ */
/* Шум и итоги                                                          */
/* ------------------------------------------------------------------ */

const NOISE_RE =
  /^(стр\.?|страница|page)\s*\d+|^\d+\s*(из|of|\/)\s*\d+$|подлинност|qr[- ]?код|qr code|scan the|verify|электронн\S* цифров|signature|computer[- ]generated|this is a system|конфиденциальн|^www\.|https?:\/\//i;
const TOTALS_RE =
  /^(итого|всего|total|subtotal|sub-total)(?=[\s:.,]|$)|opening balance|closing balance|balance (brought|carried) forward|brought forward|carried forward|входящий остаток|исходящий остаток|остаток на (начало|конец)|начальный остаток|конечный остаток|оборот(ы)? за период|ending balance|beginning balance|starting balance|доступно на/i;
const OPENING_RE = /opening balance|beginning balance|starting balance|brought forward|входящий остаток|остаток на начало|начальный остаток/i;
const CLOSING_RE = /closing balance|ending balance|carried forward|исходящий остаток|остаток на конец|конечный остаток|доступно на|available balance/i;

/* ------------------------------------------------------------------ */
/* Банк, карта, период                                                 */
/* ------------------------------------------------------------------ */

const BANKS = [
  [/Kaspi/i, 'Kaspi'],
  [/Halyk|Народн\S* банк/i, 'Halyk Bank'],
  [/Forte/i, 'ForteBank'],
  [/Jusan|Жусан/i, 'Jusan Bank'],
  [/ЦентрКредит|CenterCredit|\bBCC\b/i, 'BCC'],
  [/Bank RBK|Банк RBK/i, 'Bank RBK'],
  [/Евразийск|Eurasian/i, 'Eurasian Bank'],
  [/Home Credit|Хоум Кредит/i, 'Home Credit'],
  [/Отбасы|Otbasy/i, 'Otbasy Bank'],
  [/Bereke|Береке/i, 'Bereke Bank'],
  [/Altyn|Алтын/i, 'Altyn Bank'],
  [/Nurbank|Нурбанк/i, 'Nurbank'],
  [/Revolut/i, 'Revolut'],
  [/\bWise\b|TransferWise/i, 'Wise'],
  [/Emirates\s*NBD/i, 'Emirates NBD'],
  [/\bWio\b/i, 'Wio'],
  [/Mashreq/i, 'Mashreq'],
  [/ADCB|Abu Dhabi Commercial/i, 'ADCB'],
  [/First Abu Dhabi|\bFAB\b/i, 'FAB'],
  [/Dubai Islamic/i, 'DIB'],
  [/RAKBANK/i, 'RAKBANK'],
  [/T-Bank|Т-Банк|Тинькофф|Tinkoff/i, 'Т-Банк'],
  [/Сбер|Sber/i, 'Сбер'],
  [/HSBC/i, 'HSBC'],
  [/Barclays/i, 'Barclays'],
  [/Monzo/i, 'Monzo'],
  [/\bN26\b/i, 'N26'],
  [/Chase/i, 'Chase'],
  [/Freedom|Фридом/i, 'Freedom Bank'],
];

export function detectBankName(headText) {
  for (const [re, name] of BANKS) if (re.test(headText)) return name;
  return null;
}

function detectCard(text) {
  const m = text.match(/(?:ending|оканчивающ\S*)(?:\s+(?:in|на))?\s+(\d{4})\b/i) ?? text.match(/(?:\*|X|x|•|·){2,}[\s*Xx•·]*(\d{4})\b/) ?? text.match(/\*\s?(\d{4})\b/);
  return m?.[1] ?? null;
}

/* ------------------------------------------------------------------ */
/* Таблица → операции                                                  */
/* ------------------------------------------------------------------ */

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Разбор таблицы операций (общий для универсального и профильных разборщиков).
 * @returns {{ rows, header, lines, slashOrder }}
 *   rows: [{ day, amount, sign, currency, balance, fee, original, desc: string[] }]
 */
export function parseTable(pages, profile = {}) {
  const pageLinesList = pages.map(buildLines);
  const allLines = pageLinesList.flat();
  const slashOrder = slashOrderOf(allLines.map((l) => l.text));
  let header = null;
  const rows = [];

  for (const lines of pageLinesList) {
    const pageHeader = findHeader(lines, profile);
    if (pageHeader) header = pageHeader;
    const gaps = [];
    for (let i = 1; i < lines.length; i += 1) gaps.push(lines[i - 1].y - lines[i].y);
    const maxGap = Math.max(14, median(gaps.filter((g) => g > 0)) * 1.8);
    let current = null;
    let lastY = null;

    for (const line of lines) {
      if (pageHeader && line.y >= pageHeader.y - 1) continue; // шапка страницы и всё выше
      if (NOISE_RE.test(line.text)) {
        current = null;
        continue;
      }
      const date = parseDate(line.cells[0].text, slashOrder) ?? parseDate(line.text, slashOrder);
      if (date) {
        const row = rowFromLine(line, date, header, slashOrder, profile);
        if (!row) {
          current = null;
          continue;
        }
        rows.push(row);
        current = row;
        lastY = line.y;
        continue;
      }
      if (!current || TOTALS_RE.test(line.text)) {
        current = null;
        continue;
      }
      // перенос описания: правее колонки даты и не дальше обычного межстрочного интервала
      const descX = header?.columns.find((c) => c.role === 'description')?.x;
      const indentOk = descX != null ? line.x >= descX - 12 : line.x > current.x + 15;
      if (!indentOk || lastY - line.y > maxGap) {
        current = null;
        continue;
      }
      const extra = line.cells.filter((c) => !parseAmount(c.text));
      const fx = line.cells.map((c) => c.text.match(/^\(?\s*([-+−])?\s*(\d[\d\s ,.]*)\s*(USD|AED|EUR|RUB|GBP|KZT)\s*\)?$/)).find(Boolean);
      if (fx && !current.original) current.original = { amount: parseNumber(fx[2]), currency: fx[3] };
      current.desc.push(...extra.map((c) => c.text).filter((t) => !/^\(?\s*[-+−]?\s*\d[\d\s,.]*\s*(USD|AED|EUR|RUB|GBP|KZT)\s*\)?$/.test(t)));
      lastY = line.y;
    }
  }
  return { rows, header, lines: allLines, slashOrder };
}

/** Одна строка-операция: дата, суммы по колонкам, описание. null — строка итогов. */
function rowFromLine(line, date, header, slashOrder, profile) {
  // ячейки без самой даты (дата могла склеиться с текстом в одну ячейку)
  const cells = line.cells.map((c, i) => (i === 0 ? { ...c, text: c.text.slice(date.length).trim() } : c)).filter((c) => c.text);
  const row = { day: date.day, x: line.x, amount: null, sign: 0, currency: null, balance: null, fee: 0, original: null, desc: [], explicit: false };
  const amounts = [];

  for (const c of cells) {
    const role = header ? columnOf(c, header) : null;
    if (role === 'date2' && parseDate(c.text, slashOrder)) continue;
    if (role === 'currency' && CODE_ONLY.test(c.text)) {
      row.currency = c.text;
      continue;
    }
    if (parseDate(c.text, slashOrder) && !header) continue; // вторая дата (дата обработки)
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(c.text)) continue; // время
    const a =
      parseAmount(c.text) ??
      (header && ['amount', 'debit', 'credit', 'balance', 'fee'].includes(role) && /^\d[\d\s,.]*$/.test(c.text)
        ? { value: parseNumber(c.text), sign: 0, currency: null, explicit: false }
        : null);
    if (a && a.value != null) {
      amounts.push({ ...a, role, x2: c.x2 });
      continue;
    }
    row.desc.push(c.text);
  }

  const text = row.desc.join(' ');
  if (TOTALS_RE.test(text)) return null;

  if (header) {
    const by = (r) => amounts.find((a) => a.role === r);
    const debit = by('debit');
    const credit = by('credit');
    const amount = by('amount');
    const balance = by('balance');
    const fee = by('fee');
    if (balance) row.balance = balance.value * (balance.sign || 1);
    if (fee) row.fee = fee.value;
    if (debit && debit.value > 0) Object.assign(row, { amount: debit.value, sign: -1, explicit: true, currency: row.currency ?? debit.currency });
    else if (credit && credit.value > 0) Object.assign(row, { amount: credit.value, sign: 1, explicit: true, currency: row.currency ?? credit.currency });
    if (amount && (debit || credit) && profile.originalFromAmount) {
      const cur = row.currency ?? amount.currency;
      if (cur && cur !== (profile.accountCurrency ?? 'KZT')) row.original = { amount: amount.value, currency: cur };
    } else if (amount && row.amount == null) {
      Object.assign(row, { amount: amount.value, sign: amount.sign, explicit: amount.explicit, currency: row.currency ?? amount.currency });
    }
    if (row.amount == null) {
      const rest = amounts.filter((a) => a.role !== 'balance' && a.role !== 'fee');
      if (rest[0]) Object.assign(row, { amount: rest[0].value, sign: rest[0].sign, explicit: rest[0].explicit, currency: row.currency ?? rest[0].currency });
    }
  } else if (amounts.length) {
    // без шапки: первая сумма — операция, последняя (если их несколько) — остаток
    const [first] = amounts;
    Object.assign(row, { amount: first.value, sign: first.sign, explicit: first.explicit, currency: row.currency ?? first.currency });
    if (amounts.length > 1) row.balance = amounts[amounts.length - 1].value * (amounts[amounts.length - 1].sign || 1);
  }
  if (row.amount == null || row.amount === 0) return row.desc.length ? { ...row, amount: 0 } : null;
  return row;
}

/** Знак суммы без явного «+/−»: по изменению остатка, затем по словам. */
function resolveSigns(rows) {
  const dated = rows.filter((r) => r.amount > 0);
  const ascending = dated.length < 2 || dated[0].day <= dated[dated.length - 1].day;
  dated.forEach((r, i) => {
    if (r.sign) return;
    const prev = ascending ? dated[i - 1] : dated[i + 1]; // хронологически предыдущая строка
    if (prev?.balance != null && r.balance != null) {
      if (Math.abs(prev.balance + r.amount - r.balance) < 0.011) r.sign = 1;
      else if (Math.abs(prev.balance - r.amount - r.balance) < 0.011) r.sign = -1;
    }
    if (!r.sign) r.sign = /пополнени|зачислени|поступлени|приход|возврат|зарплат|salary|payroll|refund|top-?up|received|incoming|credit\b|deposit/i.test(r.desc.join(' ')) ? 1 : -1;
  });
  return { ascending };
}

/** Сводка: остатки на начало/конец, валюта счёта, период, банк и карта. */
function parseMeta(lines, slashOrder, firstPage) {
  const head = headerLines(firstPage)
    .map((l) => l.text)
    .join('\n');
  const all = lines.map((l) => l.text).join('\n');
  // последняя сумма в строке с подписью (и отдельной ячейкой, и внутри одной ячейки «Исходящий остаток: 152 300,40»)
  const amountAfter = (re, pick = 'first') => {
    const hits = [];
    for (const l of lines) {
      const label = l.text.search(re);
      if (label < 0) continue;
      const tail = l.text.slice(label).replace(re, '');
      const tokens = [...tail.matchAll(/[(]?[+\-−]?\s*(?:[₸$€£₽]\s*)?\d[\d\s\u00a0\u202f,.']*[.,]\d{2}\s*(?:₸|KZT|USD|AED|EUR|RUB|GBP|[$€£₽])?\s*[)]?(?:\s*(?:CR|DR))?/gi)];
      const v = tokens
        .map((t) => parseAmount(t[0].trim()) ?? { value: parseNumber(t[0].replace(/[^\d,.\s]/g, '').trim()), sign: 0, currency: null })
        .filter((a) => a.value != null)
        .pop();
      if (v) hits.push({ value: v.value * (v.sign || 1), currency: v.currency, day: datesIn(tail, slashOrder)[0] ?? null });
    }
    if (!hits.length) return null;
    // «Доступно на 01.10» и «Доступно на 31.10»: остаток на конец — с самой поздней датой
    if (hits.some((h) => h.day)) return [...hits].sort((a, b) => ((a.day ?? '') < (b.day ?? '') ? -1 : 1))[pick === 'last' ? hits.length - 1 : 0];
    return pick === 'last' ? hits[hits.length - 1] : hits[0];
  };
  const accountCurrency =
    all
      .match(/(?:валюта сч[её]та|account currency|currency)\s*:?\s*(KZT|USD|AED|EUR|RUB|GBP|тенге)/i)?.[1]
      ?.replace(/тенге/i, 'KZT')
      .toUpperCase() ?? null;
  // период: две даты в строке со словом «период / period»
  const periodLine = lines.slice(0, 40).find((l) => /период|period/i.test(l.text) && datesIn(l.text, slashOrder).length >= 2);
  const [from, to] = periodLine ? datesIn(periodLine.text, slashOrder).sort() : [];
  return {
    bankName: detectBankName(head),
    cardLast4: detectCard(head),
    accountCurrency,
    opening: amountAfter(OPENING_RE, 'first'),
    closing: amountAfter(CLOSING_RE, 'last'),
    period: from && to ? { from, to } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Результат в формате приложения                                       */
/* ------------------------------------------------------------------ */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Строки таблицы → результат импорта (та же схема, что у Freedom/Kaspi).
 * Используется и профильными разборщиками (Halyk).
 */
export function buildStatement(pages, { profile = {}, bank = 'universal', source = 'bank-pdf', idPrefix = 'updf', defaultName = 'Банковская выписка' } = {}) {
  const { rows: rawRows, lines, slashOrder } = parseTable(pages, profile);
  const meta = parseMeta(lines, slashOrder, pages[0]);
  const rows = rawRows.filter((r) => r.amount > 0);
  if (!rows.length) throw new StatementFormatError(NO_TABLE_MESSAGE);
  resolveSigns(rows);

  // валюта счёта: из шапки, иначе самая частая валюта сумм, иначе тенге
  const counts = {};
  for (const r of rows) if (r.currency) counts[r.currency] = (counts[r.currency] ?? 0) + 1;
  const frequent = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const accountCurrency = profile.accountCurrency ?? meta.accountCurrency ?? meta.closing?.currency ?? frequent ?? 'KZT';

  const conversions = new Map();
  const warnings = [];
  const convert = (value, currency, { count = true } = {}) => {
    if (currency === 'KZT') return value;
    const res = toKZT(value, currency);
    if (!res) return null;
    const c = conversions.get(currency) ?? { currency, rate: res.rate, source: 'reference', count: 0 };
    if (count) c.count += 1;
    conversions.set(currency, c);
    return res.kzt;
  };

  const perDay = new Map();
  const transactions = [];
  const push = ({ day, sign, amount, currency, desc, original, kind = null }) => {
    const description = desc.replace(/\s+/g, ' ').trim();
    const kzt = convert(amount, currency);
    if (kzt == null) {
      warnings.push(`Неизвестная валюта ${currency} в операции от ${day} — она пропущена.`);
      return;
    }
    const foreign = currency !== 'KZT' ? { amount: round2(amount), currency } : original;
    const categoryId = categorizeTransaction({ text: description, sign: sign > 0 ? '+' : '-', kind: kind ?? detectKind(description) });
    const n = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, n);
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    date.setSeconds(-n);
    const noteParts = [description];
    if (currency !== 'KZT') noteParts.push(`${String(round2(amount)).replace('.', ',')} ${currency} × ${REFERENCE_RATES[currency]} ₸ (ориентировочный курс).`);
    transactions.push({
      id: `${idPrefix}-${day.replace(/-/g, '')}-${String(n).padStart(2, '0')}`,
      type: sign > 0 ? 'income' : 'expense',
      amount: kzt,
      categoryId,
      merchant: cleanDescription(description) || (sign > 0 ? 'Поступление' : 'Операция по карте'),
      accountId: 'kaspi', // основная карта приложения (внутренний id)
      date: date.toISOString(),
      noTime: true,
      note: noteParts.join(' '),
      ...(foreign ? { original: foreign } : {}),
      source,
    });
  };

  for (const r of rows) {
    const currency = r.currency && !profile.originalFromAmount ? r.currency : accountCurrency;
    push({ day: r.day, sign: r.sign, amount: r.amount, currency, desc: r.desc.join(' '), original: r.original });
    if (r.fee > 0) push({ day: r.day, sign: -1, amount: r.fee, currency: accountCurrency, desc: `Комиссия банка · ${r.desc.join(' ')}`, original: null, kind: 'fee' });
  }
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // остаток: строка «Closing balance / Исходящий остаток», иначе остаток последней по времени строки
  const dated = rows.filter((r) => r.balance != null);
  const ascending = rows[0].day <= rows[rows.length - 1].day;
  const lastBalance = dated.length ? (ascending ? dated[dated.length - 1] : dated[0]).balance : null;
  const closingRaw = meta.closing?.value ?? lastBalance;
  const closingBalance = closingRaw == null ? null : convert(closingRaw, accountCurrency, { count: false });
  if (closingBalance == null) warnings.push('В выписке не найден итоговый остаток — баланс карты изменится на сумму операций; проверьте его после импорта.');

  if (meta.opening && meta.closing) {
    const net = rows.reduce((s, r) => s + r.sign * r.amount - r.fee, 0);
    const diff = round2(meta.opening.value + net - meta.closing.value);
    if (Math.abs(diff) >= 1) warnings.push('Сумма операций не сходится с остатками выписки — проверьте баланс после импорта.');
  }

  const days = rows.map((r) => r.day).sort();
  const name = profile.bankName ?? meta.bankName ?? defaultName;
  return {
    bank,
    bankName: name,
    cardName: meta.cardLast4 ? `${name} *${meta.cardLast4}` : name,
    period: meta.period ?? { from: days[0], to: days[days.length - 1] },
    closingBalance,
    accountCurrency,
    transactions,
    rates: [],
    conversions: [...conversions.values()],
    warnings,
  };
}

/** Описание для списка: без масок карт, времени и хвостов-реквизитов. */
function cleanDescription(s) {
  const t = s
    .replace(/(?:\*|X|x){2,}[\s*Xx]*\d{4}/g, '')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t.length > 64 ? `${t.slice(0, 61)}…` : t;
}

export const NO_TABLE_MESSAGE =
  'Не удалось найти в PDF таблицу операций. Скачайте официальную PDF-выписку в приложении банка (не скриншот и не фото) и попробуйте снова. Поддерживаются Kaspi, Freedom, Halyk и выписки большинства других банков, а также JSON-копии.';

/** Любая выписка, для которой нет отдельного разборщика. */
export function parseUniversalStatement(pages) {
  return buildStatement(pages, { bank: 'universal', source: 'bank-pdf', idPrefix: 'updf' });
}
