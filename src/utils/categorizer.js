/**
 * Единый классификатор операций для всех выписок (русский + английский).
 *
 * На выходе — только существующие id категорий из data/categories.js, чтобы
 * старые данные, резервные копии и аналитика работали без миграции.
 * Смысловые имена из ТЗ — синонимы этих id:
 *   food → groceries · transport → taxi · internal → own («Между своими счетами»)
 *   other → shopping · income → topup
 */
export const CATEGORY_ALIASES = {
  food: 'groceries',
  groceries: 'groceries',
  delivery: 'delivery',
  cafe: 'cafe',
  transport: 'taxi',
  taxi: 'taxi',
  shopping: 'shopping',
  subscriptions: 'subscriptions',
  health: 'health',
  travel: 'travel',
  housing: 'housing',
  entertainment: 'entertainment',
  transfers: 'transfers',
  internal: 'own',
  own: 'own',
  fees: 'fees',
  cash: 'cash',
  fx: 'fx',
  income: 'topup',
  topup: 'topup',
  salary: 'salary',
  refunds: 'refunds',
  other: 'shopping',
};

/** Переводы между своими счетами: меняют баланс, но не доход и не расход. */
const INTERNAL_RE =
  /Kaspi\s*Депозит|Kaspi\s*Сейф|между своими|на свой сч[её]т|со своего сч[её]та|с (моего|своего) депозит|на (мой|свой) депозит|пополнение депозита|(приём|прием|перевод) вклада|own account|between (your |my )?accounts|to (my |your )?savings|from (my |your )?savings|saving ?space|\bvault\b|\bpocket\b|exchanged (to|from)|конвертаци/i;
const FX_RE = /курсов(ая|ой) разниц|exchange (rate )?difference/i;
const FEE_RE = /комисси|commission|\bfees?\b|charges?\b|обслуживани[ея] (карты|сч[её]та)|annual fee|vat on/i;
const CASH_RE = /снятие|банкомат|\bATM\b|cash withdrawal|наличн/i;
const SALARY_RE = /зарплат|заработн|salary|payroll|wages/i;
const REFUND_RE = /возврат|refund|reversal|chargeback|кэшб[эе]к|cashback|бонус/i;
const TRANSFER_RE = /перевод|transfer|\bp2p\b|sent to|received from|отправ|to card|на карту|с карты/i;
const LOAN_RE = /погашени|кредит|рассрочк|\bloan\b|installment|instalment|kaspi red/i;

/** Магазины и сервисы: Казахстан, ОАЭ и международные. Первое совпадение выигрывает. */
const MERCHANT_RULES = [
  [
    /talabat|keeta|careem deliveries|deliveroo|noon food|glovo|глово|wolt|вольт|yandex[ .]?eda|яндекс\s*(еда|лавка)|chocofood|uber ?eats|doordash|instashop|арбуз\s*доставка/i,
    'delivery',
  ],
  [
    /careem quik|noon minutes|spinneys|grocery|supermarket|super market|fresh market|carrefour|lulu|waitrose|union coop|choithrams|mini ?mart|magnum|магнум|small\b|смолл|galmart|галмарт|anvar|анвар|arbuz|арбуз|toimart|супермаркет|продукт|tesco|sainsbury|lidl|aldi|rewe|ашан|пятёрочк|перекр[её]ст/i,
    'groceries',
  ],
  [
    /mcdonald|kfc|hardee|burger|starbucks|costa|tim hortons|restaura|ресторан|cafe|café|кафе|coffee|кофе|shawarma|шаурм|pizza|пицц|bahandi|бахандi|salam bro|del papa|cinnabon|dodo|додо|pret a manger|nando/i,
    'cafe',
  ],
  [
    /taxi|такси|uber|careem|yandex[ .]?go|яндекс\s*(go|такси)|indrive|indriver|\bbolt\b|\bRTA\b|parking|парковк|salik|\bnol\b|onay|онай|\bmetro\b|метро|автобус|\bfuel\b|petrol|\bADNOC\b|\bENOC\b|helios|sinooil|qazaq\s*oil|азс|\btfl\b|lyft/i,
    'taxi',
  ],
  [
    /booking|trip\.com|hotel|отель|airbnb|aviata|chocotravel|air ?astana|fly ?arystan|scat|flydubai|emirates|etihad|airline|airways|hostel|авиа|temir\s*zholy|ж\/д|expedia|agoda/i,
    'travel',
  ],
  [/pharmacy|аптек|clinic|клиник|hospital|больниц|dental|стомат|eyezone|optic|оптик|медцентр|medical|invivo|invitro|инвитро|aster|life ?pharmacy/i, 'health'],
  [
    /\brent\b|аренд|коммунал|alseco|алсеко|utilities|dewa|sewa|addc|real estate|properties|казахтелеком|kazakhtelecom|энерго|водоканал|\bosi\b|(?<![а-яё])оси(?![а-яё])|\bdu\b telecom|etisalat/i,
    'housing',
  ],
  [
    /apple\.com|itunes|google|anthropic|claude|openai|chatgpt|netflix|spotify|youtube|amazon prime|icloud|microsoft|adobe|\bnotion\b|kcell|beeline|билайн|tele2|теле2|\bactiv\b|\baltel\b|yandex\s*plus|кинопоиск|\bivi\b|disney|\bosn\b/i,
    'subscriptions',
  ],
  [/game|steam|playstation|xbox|nintendo|cinema|кинотеатр|kinopark|кинопарк|chaplin|vox |reel cinemas|ticketon|тикетон|концерт|museum|музей/i, 'entertainment'],
  [/amazon|noon\.com|ozon|wildberries|kaspi\s*магазин|kaspi\s*shop|sulpak|technodom|mechta|ikea|zara|h&m|decathlon|aliexpress|shein|temu|ebay/i, 'shopping'],
];

/** Тип операции из текста (если банк его не печатает отдельной колонкой). */
export function detectKind(text = '') {
  if (/^(покупка|purchase|pos\b|card payment|оплата)/i.test(text)) return 'purchase';
  if (/^(пополнение|top-?up|deposit|зачислени)/i.test(text)) return 'topup';
  if (/^(перевод|transfer|p2p)/i.test(text)) return 'transfer';
  if (/^(снятие|atm|cash withdrawal|withdrawal)/i.test(text)) return 'withdrawal';
  if (/^(комиссия|fee|commission|charge)/i.test(text)) return 'fee';
  return null;
}

/** Только по названию магазина/сервиса: id категории или null. */
export function categorizeMerchant(text = '') {
  for (const [re, cat] of MERCHANT_RULES) if (re.test(text)) return cat;
  return null;
}

export const isInternalTransfer = (text = '') => INTERNAL_RE.test(text);

/**
 * Категория операции.
 * @param {object} p
 * @param {string} p.text  описание/детали (можно вместе с типом операции)
 * @param {'+'|'-'} p.sign  '+' доход, '-' расход
 * @param {string|null} [p.kind] 'purchase' | 'topup' | 'transfer' | 'withdrawal' | 'fee' | 'other'
 * @returns {string} существующий id категории
 */
export function categorizeTransaction({ text = '', sign, kind = null }) {
  const k = kind ?? detectKind(text);
  if (FX_RE.test(text)) return 'fx';
  if (INTERNAL_RE.test(text)) return 'own';

  if (sign === '+') {
    if (k === 'purchase' || REFUND_RE.test(text)) return 'refunds';
    if (SALARY_RE.test(text)) return 'salary';
    return 'topup';
  }

  if (k === 'fee') return 'fees';
  if (k === 'withdrawal' || CASH_RE.test(text)) return 'cash';
  if (FEE_RE.test(text)) return 'fees';
  if (k === 'topup' || k === 'transfer') return 'transfers';
  const merchant = categorizeMerchant(text);
  if (merchant) return merchant;
  if (TRANSFER_RE.test(text) || LOAN_RE.test(text)) return 'transfers';
  return 'shopping';
}
