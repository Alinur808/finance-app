/**
 * Разбор PDF-выписки Freedom Bank Kazakhstan (карта Super Card) прямо в браузере.
 *
 * Таблица выписки: Дата | Сумма | Валюта | Операция | Детали.
 * Длинный текст в ячейке переносится на несколько строк и центрируется по
 * вертикали, поэтому строки «Деталей» бывают и выше, и ниже строки с датой.
 * Мы не склеиваем текст построчно, а работаем с координатами текста из PDF:
 *   1. находим шапку таблицы и границы колонок;
 *   2. «якорь» строки — дата в первой колонке;
 *   3. текст в колонках «Операция»/«Детали» группируем в блоки по вертикальным
 *      промежуткам и отдаём ближайшему якорю.
 *
 * Валюта: AED/USD пересчитываются в тенге по курсам самой выписки
 * («Между своими счетами по курсу 125.34»). USD = AED × 3.6725 (дирхам привязан
 * к доллару). Если курсов в выписке нет — запасной оценочный курс с пометкой.
 *
 * Модуль не зависит от React и браузера: pdf.js передаётся параметром,
 * поэтому тот же код проверяется тестами в Node.
 */

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const AMOUNT_RE = /^([+-])\s?([\d,]+\.\d{2})\s*(₸|AED|\$|USD|EUR|€|RUB|₽)$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const OP_WORDS = ['Покупка', 'Пополнение', 'Перевод', 'Другое', 'Платеж', 'Платёж', 'Снятие', 'Погашение', 'Овердрафт', 'Платеж по кредиту', 'Сумма в', 'обработке', 'Сумма в обработке'];
const SYMBOL_TO_CODE = { '₸': 'KZT', $: 'USD', '€': 'EUR', '₽': 'RUB' };

const AED_PER_USD = 3.6725; // официальная привязка дирхама к доллару
/** Запасные курсы (₸ за единицу), только если в выписке нет ни одной строки «по курсу». */
export const FALLBACK_RATES = { AED: 125, USD: 125 * AED_PER_USD, EUR: 540, RUB: 5.5 };

/* ------------------------------------------------------------------ */
/* 1. PDF → текст с координатами                                        */
/* ------------------------------------------------------------------ */

/**
 * Извлекает текст всех страниц: [{ items: [{ str, x, y, w }] }].
 * y растёт снизу вверх (как в PDF).
 */
export async function extractPdfPages(data, pdfjsLib) {
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false, disableFontFace: true });
  const doc = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items
        .filter((it) => typeof it.str === 'string' && it.str.trim())
        .map((it) => ({ str: it.str.replace(/\s+/g, ' ').trim(), x: it.transform[4], y: it.transform[5], w: it.width }));
      pages.push({ items });
      page.cleanup();
    }
  } finally {
    await task.destroy(); // освобождаем воркер и память
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* 2. Распознавание выписки                                            */
/* ------------------------------------------------------------------ */

const num = (s) => Number(String(s).replace(/,/g, ''));
const round2 = (n) => Math.round(n * 100) / 100;
const pageText = (page) =>
  [...page.items]
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((i) => i.str)
    .join(' ');

/** Похоже ли на выписку Freedom Bank. */
export function isFreedomStatement(pages) {
  const text = pages.slice(0, 2).map(pageText).join(' ');
  return /Фридом Банк|bankffin\.kz|Freedom Bank/i.test(text) && /Выписка по карте/i.test(text);
}

/** Шапка выписки: период, номер карты, остатки по счетам, итоги по типам операций. */
function parseHeader(pages) {
  const text = pageText(pages[0]);
  const period = text.match(/за период с (\d{2}\.\d{2}\.\d{4}) по (\d{2}\.\d{2}\.\d{4})/);
  const card = text.match(/Номер карты:\s*\**\s*(\d{4})/);
  const cardName = text.match(/Выписка по карте ([^\n]+?) за период/);

  // Остатки: «KZ86… KZT 14,234.77 ₸»
  const balances = {};
  for (const m of text.matchAll(/KZ[0-9A-Z]{16,}\s+([A-Z]{3})\s+([\d,]+\.\d{2})/g)) balances[m[1]] = num(m[2]);

  // Итоги: «Покупка -1,362,927.13₸»
  const summary = {};
  for (const m of text.matchAll(/(Платеж по кредиту|Платеж|Перевод|Покупка|Снятие|Пополнение|Сумма в обработке|Погашение|Овердрафт|Другое)\s+([+-]?[\d,]+\.\d{2})\s*₸/g)) {
    if (!(m[1] in summary)) summary[m[1]] = num(m[2]);
  }
  return {
    period: period ? { from: toIsoDay(period[1]), to: toIsoDay(period[2]) } : null,
    cardLast4: card?.[1] ?? null,
    cardName: cardName ? `Freedom ${cardName[1].trim()}` : 'Freedom Bank',
    balances,
    summary,
  };
}

const toIsoDay = (ddmmyyyy) => {
  const [, d, m, y] = ddmmyyyy.match(DATE_RE);
  return `${y}-${m}-${d}`;
};

/**
 * Строки таблицы на одной странице: { rows: [{ date, amountText, currency, op, details }], layout }.
 * Последняя страница может продолжать таблицу без шапки — тогда берём
 * раскладку колонок с предыдущей страницы (prevLayout).
 */
function parsePageRows(page, prevLayout, carry = { op: [], details: [] }) {
  const { items } = page;
  const header = items.find((i) => i.str === 'Дата' && items.some((j) => j.str === 'Детали' && Math.abs(j.y - i.y) < 3));
  if (!header && !prevLayout) return { rows: [], layout: null, carry };
  const headerY = header ? header.y : Infinity;
  const footer = items.find((i) => /^Подлинность справки/.test(i.str));
  const bottomY = footer && footer.y < headerY ? footer.y + 2 : -Infinity;
  const body = items.filter((i) => i.y < headerY - 3 && i.y > bottomY);

  const opHeader = header && items.find((i) => i.str === 'Операция' && Math.abs(i.y - headerY) < 3);
  const detailsHeader = header && items.find((i) => i.str === 'Детали' && Math.abs(i.y - headerY) < 3);
  const anchorMaxX = opHeader ? opHeader.x - 100 : prevLayout?.anchorMaxX ?? 200;
  const anchors = body.filter((i) => DATE_RE.test(i.str) && i.x < anchorMaxX).sort((a, b) => b.y - a.y);
  if (!anchors.length) return { rows: [], layout: prevLayout ?? null, carry };

  // Колонка «Операция» начинается со слов-операций; «Детали» — правее самого длинного из них.
  const opItems = body.filter((i) => OP_WORDS.includes(i.str));
  const opLeft = opItems.length ? Math.min(...opItems.map((i) => i.x)) - 2 : prevLayout?.opLeft ?? (opHeader?.x ?? 320) - 15;
  const detailsLeft = opItems.length
    ? Math.max(...opItems.map((i) => i.x + i.w)) + 1
    : prevLayout?.detailsLeft ?? ((opHeader?.x ?? 320) + (detailsHeader?.x ?? 450)) / 2 - 20;
  const layout = { anchorMaxX, opLeft, detailsLeft };

  const sameLine = (a, it) => Math.abs(a.y - it.y) < 6; // в конце выписки дата и сумма смещены на ~4 pt

  const rows = anchors.map((a) => ({ anchor: a, amountText: null, currency: null, op: [], details: [] }));

  for (const it of body) {
    if (it.x >= opLeft) continue;
    for (const row of rows) {
      if (!sameLine(row.anchor, it)) continue;
      if (AMOUNT_RE.test(it.str)) row.amountText = it.str;
      else if (CURRENCY_RE.test(it.str)) row.currency = it.str;
    }
  }

  /*
   * Текст ячейки центрирован по строке таблицы, а дата — ровно в её центре.
   * Значит, у каждой строки над датой столько же строк текста, сколько под ней.
   * Идём сверху вниз: всё, что выше первой даты, — верхняя половина первой
   * строки; столько же строк под датой — её нижняя половина; остаток до
   * следующей даты — верхняя половина следующей строки, и так далее.
   *
   * Строка может разорваться между страницами: верх ячейки внизу страницы,
   * остальное — на следующей. Такие «лишние» строки внизу страницы
   * возвращаем как перенос (carry) — это верх первой строки следующей страницы.
   */
  const leftovers = {};
  const assignColumn = (columnItems, key) => {
    // элементы на одной высоте — одна строка текста
    const lines = [];
    for (const it of [...columnItems].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) < 2) last.items.push(it);
      else lines.push({ y: it.y, items: [it] });
    }
    let cursor = 0; // первая ещё не распределённая строка
    rows.forEach((row, i) => {
      const c = row.anchor.y;
      const next = rows[i + 1]?.anchor.y ?? -Infinity;
      const above = i === 0 ? [...carry[key]] : [];
      while (cursor < lines.length && lines[cursor].y > c + 3) above.push(lines[cursor++]);
      const center = [];
      while (cursor < lines.length && Math.abs(lines[cursor].y - c) <= 3) center.push(lines[cursor++]);
      // нижняя половина: столько же строк, сколько сверху, но не дальше следующей даты
      const below = [];
      while (cursor < lines.length && below.length < above.length && lines[cursor].y > next + 3) below.push(lines[cursor++]);
      row[key] = [...above, ...center, ...below];
    });
    leftovers[key] = lines.slice(cursor);
  };
  assignColumn(body.filter((i) => i.x >= opLeft && i.x < detailsLeft && !DATE_RE.test(i.str)), 'op');
  assignColumn(body.filter((i) => i.x >= detailsLeft), 'details');

  return {
    layout,
    carry: { op: leftovers.op ?? [], details: leftovers.details ?? [] },
    rows: rows.map((r) => ({ date: r.anchor.str, amountText: r.amountText, currency: r.currency, op: r.op, details: r.details })),
  };
}

/** Строки текста (сверху вниз) → одна строка. */
const joinLines = (lines) =>
  lines
    .flatMap((l) => l.items.map((i) => i.str))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Все строки таблицы по всем страницам с переносом раскладки колонок. */
function parseAllRows(pages) {
  const all = [];
  let layout = null;
  let carry = { op: [], details: [] };
  for (const page of pages) {
    const result = parsePageRows(page, layout, carry);
    layout = result.layout ?? layout;
    carry = result.carry;
    all.push(...result.rows);
  }
  // хвост после последней строки всей выписки — её нижняя часть
  const last = all[all.length - 1];
  if (last) {
    last.op.push(...carry.op);
    last.details.push(...carry.details);
  }
  return all.map((r) => ({ ...r, op: joinLines(r.op), details: joinLines(r.details) }));
}

/* ------------------------------------------------------------------ */
/* 3. Категории и описания                                             */
/* ------------------------------------------------------------------ */

const MERCHANT_RULES = [
  [/talabat|keeta|careem deliveries|deliveroo|noon food|glovo|wolt|yandex ?eda|chocofood/i, 'delivery'],
  [/careem quik|noon minutes|habeeb|qiso|spinneys|grocery|supermarket|super market|fresh market|gmg consumer|blue box vending|enoc|carrefour|lulu|mini ?mart|magnum|small|galmart|anvar/i, 'groceries'],
  [/mcdonald|kfc|hardee|burger|tannoureen|serrano|kausar|slaw|starbucks|raising cane|find salt|restaura|cafe|coffee|qlub|shawarma|pizza|bahandi|salam bro|del papa|cinnabon/i, 'cafe'],
  [/taxi|uber|careem|yandex ?go|indrive|bolt|\bRTA\b|parking|zed mobility|salik|\bnol\b/i, 'taxi'],
  [/apple\.com|itunes|google|anthropic|claude|openai|netflix|spotify|youtube|chatgpt|amazon prime|thebestpdf|preply/i, 'subscriptions'],
  [/game|steam|playstation|cinema|kinopark|vox /i, 'entertainment'],
];

// переводы между своими счетами, депозитом и брокерским счётом Freedom
const OWN_ACCOUNTS_RE = /Между своими счетами|вклад|Перевод валюты Freedom/i;

function categorize({ op, sign, details, pending }) {
  if (OWN_ACCOUNTS_RE.test(details)) return 'own';
  if (op === 'Пополнение') return 'topup';
  if (op === 'Перевод') return sign === '+' ? 'topup' : 'transfers';
  if (op === 'Снятие') return 'cash';
  if ((op === 'Покупка' || pending) && sign === '+') return 'refunds';
  for (const [re, cat] of MERCHANT_RULES) if (re.test(details)) return cat;
  if (op === 'Другое') return sign === '+' ? 'topup' : 'transfers';
  return 'shopping';
}

/** Короткое описание для списка; полный текст остаётся в note. */
function cleanMerchant({ details, categoryId }) {
  let s = details;
  if (categoryId === 'own') {
    if (/Прием вклада/i.test(s)) return 'На свой депозит';
    if (/Перевод вклада/i.test(s)) return 'С депозита';
    if (/Перевод валюты Freedom/i.test(s)) return 'Со своего счёта Freedom';
    const rate = s.match(/по курсу\s*([\d.,]+)/i);
    return rate ? `Между своими счетами · курс ${rate[1]}` : 'Между своими счетами';
  }
  const fio = s.match(/ФИО:\s*(.+?\.)\.?\s/);
  if (fio) return `Перевод: ${fio[1].trim()}`;
  const gift = s.match(/^[.\s]*(.*?)\s*\.?\s*Безвозмездный перевод\.?$/i);
  if (gift) return gift[1] && !/безвозмездные/i.test(gift[1]) ? `Перевод: ${gift[1].trim()}` : 'Безвозмездный перевод';
  const company = s.match(/(?:ТОО|АО|ИП)\s+[«"]([^»"]+)[»"]/);
  if (company) return /оплат/i.test(s) ? `${company[1]} · оплата` : company[1];
  const recipient = s.match(/Получатель:\s*([^.]+?)\s+(Назначение|БИК|ИИН)/);
  if (recipient && categoryId === 'transfers') return `Перевод: ${recipient[1].trim()}`;
  s = s
    .replace(/Комиссия:\s*\d+\s*тг\.?/gi, '')
    .replace(/\s+(DUBAI|DXB|ABU DHABI|SHARJAH|ALMATY|ASTANA)?\s*(AE|IE|US|GB|KZ|NL|DE)$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim()
    .replace(/\.$/, '');
  return s.length > 64 ? `${s.slice(0, 61)}…` : s || 'Операция по карте';
}

/* ------------------------------------------------------------------ */
/* 4. Курсы валют                                                      */
/* ------------------------------------------------------------------ */

/** Курсы AED из строк «по курсу N» по датам; для каждой даты берём ближайший известный. */
function buildRateLookup(rows) {
  const known = rows
    .map((r) => ({ day: toIsoDay(r.date), m: r.details.match(/по курсу\s*([\d]+[.,]\d+)/i), currency: r.currency }))
    .filter((r) => r.m && r.currency === 'AED')
    .map((r) => ({ day: r.day, rate: Number(r.m[1].replace(',', '.')) }))
    .filter((r) => r.rate > 20 && r.rate < 1000)
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  const aedOn = (day) => {
    if (!known.length) return null;
    let best = known[0];
    for (const k of known) if (Math.abs(Date.parse(k.day) - Date.parse(day)) < Math.abs(Date.parse(best.day) - Date.parse(day))) best = k;
    return best.rate;
  };

  return {
    known,
    rateFor(currency, day) {
      if (currency === 'KZT') return { rate: 1, source: 'kzt' };
      const aed = aedOn(day);
      if (currency === 'AED' && aed) return { rate: aed, source: 'statement' };
      if (currency === 'USD' && aed) return { rate: round2(aed * AED_PER_USD), source: 'statement-peg' };
      return { rate: FALLBACK_RATES[currency] ?? null, source: 'fallback' };
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5. Главная функция                                                  */
/* ------------------------------------------------------------------ */

/**
 * Превращает страницы PDF в операции приложения (схема как в резервной копии).
 * @returns {{ bank, cardName, period, closingBalance, transactions, rates, warnings, check }}
 */
export function parseFreedomStatement(pages) {
  if (!isFreedomStatement(pages)) {
    throw new Error('Это не похоже на выписку Freedom Bank. Пока поддерживаются выписки по карте Freedom (Super Card) и JSON-копии.');
  }
  const header = parseHeader(pages);
  const allRows = parseAllRows(pages);
  const rows = allRows.filter((r) => r.amountText);
  const unreadable = allRows.length - rows.length;
  if (!rows.length) throw new Error('В выписке не найдено ни одной операции.');

  const rates = buildRateLookup(rows);
  const warnings = [];
  const perDay = new Map();
  let fallbackCount = 0;

  const mapped = rows.map((r) => {
    const [, sign, value, symbol] = r.amountText.match(AMOUNT_RE);
    const currency = r.currency ?? SYMBOL_TO_CODE[symbol] ?? symbol;
    const day = toIsoDay(r.date);
    const pending = /обработке/i.test(r.op);
    const op = pending ? '' : r.op;
    const original = num(value);
    const { rate, source } = rates.rateFor(currency, day);
    if (rate == null) throw new Error(`Неизвестная валюта ${currency} в операции от ${r.date}.`);
    if (source === 'fallback') fallbackCount += 1;
    const amount = round2(original * rate);
    const categoryId = categorize({ op, sign, details: r.details, pending });

    // порядок внутри дня как в выписке (сверху — новее)
    const n = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, n);
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    date.setSeconds(-n); // новее — позже

    const noteParts = [r.details];
    if (pending) noteParts.push('Сумма в обработке — банк ждёт подтверждения платёжной системы.');
    if (currency !== 'KZT') noteParts.push(`${value} ${currency} × ${rate} ₸ (${source === 'fallback' ? 'оценочный курс' : 'курс из выписки'}).`);

    return {
      id: `ffb-${day.replace(/-/g, '')}-${String(n).padStart(2, '0')}`,
      type: sign === '+' ? 'income' : 'expense',
      amount,
      categoryId,
      merchant: cleanMerchant({ details: r.details, categoryId }),
      accountId: 'kaspi', // основная карта приложения (внутренний id)
      date: date.toISOString(),
      noTime: true,
      note: noteParts.filter(Boolean).join(' '),
      ...(currency !== 'KZT' ? { original: { amount: original, currency } } : {}),
      ...(pending ? { pending: true } : {}),
      source: 'freedom-pdf',
    };
  });

  const transactions = [...mapped].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (unreadable) warnings.push(`${unreadable} строк выписки не удалось прочитать — проверьте баланс после импорта.`);
  if (fallbackCount) {
    warnings.push(`${fallbackCount} операций в иностранной валюте пересчитаны по оценочному курсу — суммы в тенге могут немного отличаться от банковских.`);
  }

  // Проверка: наши итоги по типам против раздела «Краткое содержание»
  const check = {};
  for (const [label, expected] of Object.entries(header.summary)) {
    if (!expected || label === 'Сумма в обработке') continue;
    const actual = round2(
      rows.reduce((sum, r, i) => {
        if (/обработке/i.test(r.op) || r.op !== label) return sum;
        const t = mapped[i];
        return sum + (t.type === 'income' ? t.amount : -t.amount);
      }, 0),
    );
    check[label] = { expected, actual };
  }

  const closingBalance = round2(Object.entries(header.balances).reduce((sum, [cur, v]) => sum + v * (rates.rateFor(cur, header.period?.to ?? '').rate ?? 0), 0));

  return {
    bank: 'freedom',
    cardName: header.cardLast4 ? `${header.cardName} *${header.cardLast4}` : header.cardName,
    period: header.period,
    closingBalance,
    transactions,
    rates: rates.known,
    warnings,
    check,
  };
}
