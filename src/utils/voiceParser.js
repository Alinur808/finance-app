/**
 * Разбор голосовой фразы (Web Speech API, ru-RU) в черновик операции.
 *
 *   «Такси две пятьсот»        → расход 2 500 ₸, «Такси и транспорт»
 *   «Кофе 1800»                → расход 1 800 ₸, «Кафе и рестораны»
 *   «Зарплата 300 тысяч»       → доход 300 000 ₸, «Зарплата»
 *   «Продукты полторы тысячи»  → расход 1 500 ₸
 *   «Аренда двести пятьдесят тысяч», «Обед 3 200 тенге», «300к на ремонт»
 *
 * Разговорное «две пятьсот» (= 2 500) — число до 100 и сразу сотни без слова
 * «тысяч»: первое число считаем тысячами. Модуль без зависимостей от браузера.
 */

const UNITS = {
  ноль: 0, нуль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  полтора: 1.5, полторы: 1.5,
};
const TENS = { двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90 };
const HUNDREDS = { сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900 };
const MULTIPLIERS = {
  тысяча: 1e3, тысячи: 1e3, тысяч: 1e3, тысячу: 1e3, тыс: 1e3, тыщ: 1e3, тыщи: 1e3, тыща: 1e3, к: 1e3, k: 1e3,
  миллион: 1e6, миллиона: 1e6, миллионов: 1e6, млн: 1e6, лям: 1e6, ляма: 1e6, лямов: 1e6,
};
const STANDALONE = { косарь: 1000, косаря: 1000, полтинник: 50000, полтос: 50000, полтысячи: 500, полмиллиона: 500000, сотка: 100000, сотку: 100000 };

const FILLERS = new Set([
  'тенге', 'тг', 'теңге', 'рублей', 'руб', 'за', 'на', 'в', 'во', 'и', 'по', 'с', 'со', 'это', 'было', 'мне', 'я',
  'потратил', 'потратила', 'потрачено', 'купил', 'купила', 'заплатил', 'заплатила', 'оплатил', 'оплатила', 'оплата',
  'расход', 'трата', 'доход', 'получил', 'получила', 'пришла', 'пришло', 'пришли', 'плюс', 'минус', 'ровно', 'примерно', 'около',
]);

const INCOME_WORDS = /^(зарплат|зп$|аванс|преми|доход|получил|пришл|кешбэк|кэшбэк|кешбек|кэшбек|возврат|гонорар|стипенди|пенси|фриланс|подработк|бонус)/;

/** Ключевые слова → категория (первое совпадение по началу слова). */
const CATEGORY_WORDS = [
  [/^(зарплат|зп$|аванс|преми|гонорар|фриланс|подработк)/, 'salary'],
  [/^(кешбэк|кэшбэк|кешбек|кэшбек|возврат)/, 'refunds'],
  [/^(такси|убер|uber|яндекс|индрайв|indrive|метро|автобус|проезд|бензин|заправк|парковк|каршеринг|самокат)/, 'taxi'],
  [/^(доставк|wolt|глово|glovo|чокофуд|chocofood|еда$|пицц|суши|роллы|бургер)/, 'delivery'],
  [/^(кофе|кофейн|кафе|ресторан|обед|ужин|завтрак|бар$|ланч|старбакс|starbucks|шаурм|донер)/, 'cafe'],
  [/^(продукт|магазин|супермаркет|магнум|magnum|small|смолл|галмарт|рынок|базар|хлеб|молок)/, 'groceries'],
  [/^(аптек|лекарств|врач|клиник|стоматолог|анализ|больниц|здоров)/, 'health'],
  [/^(кино|театр|концерт|игр|боулинг|караоке|клуб|развлеч)/, 'entertainment'],
  [/^(подписк|нетфликс|netflix|спотифай|spotify|ютуб|youtube|apple|айклауд|icloud|яндекс плюс)/, 'subscriptions'],
  [/^(аренд|квартир|коммунал|свет$|газ$|интернет|связь|телефон|жкх|ремонт)/, 'housing'],
  [/^(билет|авиа|самолет|отель|гостиниц|поездк|путешеств|тур$)/, 'travel'],
  [/^(перевод|скинул|скинула|долг|одолжил)/, 'transfers'],
  [/^(одежд|обув|кроссовк|техник|телефон|ноутбук|подарок|подарки|покупк|косметик)/, 'shopping'],
];

const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    // «1 800», «300 000» — разряды через пробел → одно число
    .replace(/(\d)[\s  ]+(?=\d{3}(?!\d))/g, '$1')
    // «300к», «2,5млн» → «300 к»
    .replace(/(\d)(к|k|тыс|млн)(?![а-яa-z])/g, '$1 $2')
    .replace(/[₸$€]/g, ' ')
    .replace(/[^\p{L}\d.,\s-]/gu, ' ')
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Числа в последовательности слов. Возвращает { numbers: [...], words: [неязыковые слова] }. */
export function extractNumbers(tokens) {
  const numbers = [];
  const words = [];
  let total = 0;
  let current = 0;
  let active = false;
  let hundredsInCurrent = false;

  const finish = () => {
    if (active) numbers.push(total + current);
    total = 0;
    current = 0;
    active = false;
    hundredsInCurrent = false;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const w = tokens[i];
    if (/^\d+([.,]\d+)?$/.test(w)) {
      const n = Number(w.replace(',', '.'));
      if (active && current === 0) current = n;
      else {
        finish();
        current = n;
        active = true;
      }
      hundredsInCurrent = n >= 100;
      continue;
    }
    if (w in STANDALONE) {
      finish();
      numbers.push(STANDALONE[w]);
      continue;
    }
    if (w in UNITS || w in TENS) {
      const v = UNITS[w] ?? TENS[w];
      // «двадцать пять» — продолжение; «пять три» — новое число
      if (active && current > 0 && !(current % 10 === 0 && v < 10) && !(hundredsInCurrent && current % 100 === 0)) finish();
      current += v;
      active = true;
      continue;
    }
    if (w in HUNDREDS) {
      const v = HUNDREDS[w];
      if (active && current > 0 && current < 100 && !hundredsInCurrent && total === 0) {
        // «две пятьсот» = 2 500
        total += current * 1000;
        current = v;
      } else if (active && hundredsInCurrent) {
        finish();
        current = v;
      } else current += v;
      hundredsInCurrent = true;
      active = true;
      continue;
    }
    if (w in MULTIPLIERS && (active || w.startsWith('тыс') || w.startsWith('милл'))) {
      total += (current || 1) * MULTIPLIERS[w];
      current = 0;
      hundredsInCurrent = false;
      active = true;
      continue;
    }
    if (active && w === 'с' && tokens[i + 1]?.startsWith('половин')) {
      current += 0.5;
      i += 1;
      continue;
    }
    finish();
    words.push(w);
  }
  finish();
  return { numbers, words };
}

/** Категория по словам фразы. */
export function detectVoiceCategory(words) {
  for (const w of words) for (const [re, id] of CATEGORY_WORDS) if (re.test(w)) return id;
  return null;
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Фраза → { amount, type, categoryId, merchant, transcript } или null, если суммы нет.
 * type 'income' — по словам «зарплата», «аванс», «кэшбэк», «пришло»…
 */
export function parseVoiceTransaction(transcript) {
  const tokens = normalize(transcript);
  if (!tokens.length) return null;
  const { numbers, words } = extractNumbers(tokens);
  const valid = numbers.filter((n) => Number.isFinite(n) && n > 0 && n < 1e12);
  if (!valid.length) return null;
  const amount = Math.round(Math.max(...valid) * 100) / 100;
  const income = words.some((w) => INCOME_WORDS.test(w));
  let categoryId = detectVoiceCategory(words);
  const type = income || categoryId === 'salary' || categoryId === 'refunds' ? 'income' : 'expense';
  if (type === 'income' && categoryId && !['salary', 'refunds'].includes(categoryId)) categoryId = 'topup';
  if (type === 'income' && !categoryId) categoryId = 'topup';
  if (type === 'expense' && (categoryId === 'salary' || categoryId === 'refunds')) categoryId = null;
  const merchantWords = words.filter((w) => !FILLERS.has(w) && !/^\d/.test(w));
  const merchant = capitalize(merchantWords.slice(0, 4).join(' ')).slice(0, 60);
  return { amount, type, categoryId, merchant, transcript: String(transcript).trim().slice(0, 200) };
}
