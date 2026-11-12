import { addDays, DAY_MS, formatFullDate, startOfDay } from './dates.js';
import { formatMoney, formatPercent, groupDigits, plural } from './format.js';
import { spendingByCategory, totals } from './analytics.js';
import { getCategory } from '../data/categories.js';

/** Расчётные суммы показываем без тиынов. */
const money = (v, opts = {}) => formatMoney(v, { decimals: false, ...opts });

const MAX_WINDOW_DAYS = 60; // два цикла доходов сглаживают средние
const MIN_WINDOW_DAYS = 14;
const MONTH_DAYS = 30.44;
const WEEKS_PER_MONTH = MONTH_DAYS / 7;
const FIXED = new Set(['transfers', 'fees', 'fx', 'cash']);
const PUBLIC_TRANSPORT_FARE = 800; // ₸ за поездку на метро/автобусе (~6,5 AED)

/**
 * Средний денежный поток в месяц. Окно — последние 60 дней или меньше,
 * если данных меньше (например, выписка за месяц).
 */
export function monthlyProfile(transactions, now = new Date()) {
  const oldest = transactions.reduce((min, t) => Math.min(min, new Date(t.date).getTime()), now.getTime());
  const span = Math.floor((startOfDay(now) - startOfDay(oldest)) / DAY_MS) + 1;
  const windowDays = Math.max(MIN_WINDOW_DAYS, Math.min(MAX_WINDOW_DAYS, span));
  const start = addDays(startOfDay(now), -(windowDays - 1));
  const recent = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= start && d <= now;
  });
  const scale = MONTH_DAYS / windowDays;
  const t = totals(recent);
  const categories = spendingByCategory(recent).map((c) => ({ ...c, monthly: c.amount * scale, monthlyCount: c.count * scale }));
  return { recent, scale, windowDays, income: t.income * scale, expense: t.expense * scale, savings: (t.income - t.expense) * scale, categories };
}

/** Сколько недель копить `remaining` при заданном темпе в месяц (Infinity, если темп ≤ 0). */
export const weeksToSave = (remaining, monthlySavings) =>
  remaining <= 0 ? 0 : monthlySavings > 0 ? remaining / (monthlySavings / WEEKS_PER_MONTH) : Infinity;

/** 2 → "2 недели", 0.5 → "4 дня", 14 → "3,2 месяца" */
export const describeWeeks = (weeks) => {
  if (!Number.isFinite(weeks)) return 'никогда при таком темпе';
  if (weeks < 1) return plural(Math.max(1, Math.round(weeks * 7)), ['день', 'дня', 'дней']);
  if (weeks < 9) return plural(Math.round(weeks), ['неделю', 'недели', 'недель']);
  const months = weeks / WEEKS_PER_MONTH;
  if (months >= 3) return plural(Math.round(months), ['месяц', 'месяца', 'месяцев']);
  return `${months.toFixed(1).replace('.', ',')} месяца`;
};

const fasterBy = (before, after) => {
  if (!Number.isFinite(before)) return Number.isFinite(after) ? `цель станет достижима за ${describeWeeks(after)}` : null;
  const diff = before - after;
  if (diff <= 0) return null;
  return `на ${describeWeeks(diff)} быстрее`;
};

/**
 * Советник на правилах: анализирует денежный поток и выдаёт статус цели
 * и список советов с расчётом эффекта. Используется, когда нет ключа ИИ
 * (или как запасной вариант, если запрос к ИИ не удался).
 */
export function buildAdvice(transactions, goal, now = new Date()) {
  const p = monthlyProfile(transactions, now);
  const remaining = Math.max(0, goal.target - goal.saved);
  const deadline = new Date(goal.deadline);
  const weeksLeft = Math.max(0, (deadline - now) / (7 * DAY_MS));
  const monthsLeft = weeksLeft / WEEKS_PER_MONTH;
  const requiredMonthly = remaining / Math.max(monthsLeft, 0.25);
  const baseWeeks = weeksToSave(remaining, p.savings);
  const eta = Number.isFinite(baseWeeks) ? addDays(now, Math.ceil(baseWeeks * 7)) : null;
  const savingsRate = p.income > 0 ? p.savings / p.income : 0;
  const shortfall = Math.max(0, requiredMonthly - p.savings);

  // Нет ни доходов, ни расходов (новый пользователь или пустой период) — считать нечего.
  const hasData = p.income > 0 || p.expense > 0;

  let status;
  if (remaining === 0) status = 'done';
  else if (!hasData) status = 'no-data';
  else if (p.savings <= 0) status = 'negative';
  else if (baseWeeks <= weeksLeft) status = 'on-track';
  else status = 'behind';

  if (status === 'no-data') {
    return { profile: p, remaining, savingsRate, requiredMonthly, shortfall, baseWeeks, weeksLeft, eta, status, tips: [], discretionary: [] };
  }

  const goalLabel = money(goal.target, { compact: true });
  const tips = [];
  const withImpact = (saving) => fasterBy(baseWeeks, weeksToSave(remaining, p.savings + saving));

  // 1) Самая большая «гибкая» категория — главный совет.
  const discretionary = p.categories.filter((c) => c.category.discretionary);
  const top = discretionary[0];
  if (top && p.expense > 0) {
    const cut = top.monthly * 0.5;
    const faster = withImpact(cut);
    tips.push({
      id: 'top-category',
      kind: 'category',
      categoryId: top.id,
      title: `«${top.category.name}» — ваша главная гибкая статья`,
      text: `Вы тратите ${formatPercent(top.monthly / p.expense)} бюджета на ${top.category.nameAcc} (~${money(top.monthly)} в месяц). Сократите эти расходы вдвое, и вы накопите ${goalLabel} ${faster ?? 'быстрее'}.`,
      monthlyImpact: cut,
      impactLabel: faster,
    });
  }

  // 2) Доставка: частота и средний чек.
  const delivery = p.recent.filter((t) => t.type === 'expense' && t.categoryId === 'delivery');
  if (delivery.length >= 4 && top?.id !== 'delivery') {
    const perMonth = delivery.length * p.scale;
    const avg = delivery.reduce((s, t) => s + t.amount, 0) / delivery.length;
    const saving = (perMonth / 3) * avg * 0.6;
    tips.push({
      id: 'delivery',
      kind: 'habit',
      categoryId: 'delivery',
      title: 'Готовьте дома чаще',
      text: `Около ${plural(Math.round(perMonth), ['заказа', 'заказов', 'заказов'])} доставки в месяц со средним чеком ${money(avg)}. Если треть из них заменить домашней едой, вы сэкономите ~${money(saving)} в месяц.`,
      monthlyImpact: saving,
      impactLabel: withImpact(saving),
    });
  }

  // 3) Такси против общественного транспорта.
  const taxi = p.recent.filter((t) => t.type === 'expense' && t.categoryId === 'taxi');
  if (taxi.length >= 4 && top?.id !== 'taxi') {
    const perMonth = taxi.length * p.scale;
    const avg = taxi.reduce((s, t) => s + t.amount, 0) / taxi.length;
    const saving = (perMonth / 2) * Math.max(0, avg - PUBLIC_TRANSPORT_FARE);
    tips.push({
      id: 'taxi',
      kind: 'habit',
      categoryId: 'taxi',
      title: 'Пересядьте на метро',
      text: `Примерно ${plural(Math.round(perMonth), ['поездка', 'поездки', 'поездок'])} на такси в месяц, в среднем по ${money(avg)}. Половину можно заменить метро или автобусом (~${groupDigits(PUBLIC_TRANSPORT_FARE)} ₸) и сэкономить ~${money(saving)} в месяц.`,
      monthlyImpact: saving,
      impactLabel: withImpact(saving),
    });
  }

  // 4) Мелкие покупки незаметно складываются.
  const small = p.recent.filter((t) => t.type === 'expense' && t.amount < 3000 && t.categoryId !== 'fx' && t.categoryId !== 'fees');
  if (small.length >= 10) {
    const monthly = small.reduce((s, t) => s + t.amount, 0) * p.scale;
    const saving = monthly * 0.3;
    tips.push({
      id: 'small',
      kind: 'habit',
      title: 'Мелкие покупки складываются',
      text: `${plural(Math.round(small.length * p.scale), ['покупка', 'покупки', 'покупок'])} дешевле 3 000 ₸ обходятся в ${money(monthly)} в месяц. Лимит ${money(Math.round((monthly * 0.7) / WEEKS_PER_MONTH / 500) * 500)} в неделю сэкономит ~${money(saving)}.`,
      monthlyImpact: saving,
      impactLabel: withImpact(saving),
    });
  }

  // 5) Комиссии за переводы в другие банки.
  const fees = p.recent.filter((t) => t.categoryId === 'fees');
  if (fees.length >= 3) {
    const monthly = fees.reduce((s, t) => s + t.amount, 0) * p.scale;
    tips.push({
      id: 'fees',
      kind: 'rule',
      categoryId: 'fees',
      title: 'Комиссии за переводы',
      text: `${plural(fees.length, ['перевод', 'перевода', 'переводов'])} в другие банки стоили ${money(fees.reduce((s, t) => s + t.amount, 0))}. Переводите внутри своего банка по номеру телефона — обычно это бесплатно.`,
      monthlyImpact: monthly,
      impactLabel: null,
    });
  }

  // 6) Норма сбережений против правила 50/30/20.
  if (p.income > 0 && savingsRate < 0.2) {
    const gap = p.income * 0.2 - p.savings;
    tips.push({
      id: 'rate',
      kind: 'rule',
      title: `Вы откладываете ${formatPercent(Math.max(0, savingsRate))} дохода`,
      text: `По правилу 50/30/20 стоит откладывать 20% — для вас это ${money(p.income * 0.2)} в месяц, на ${money(gap)} больше, чем сейчас.`,
      monthlyImpact: gap,
      impactLabel: fasterBy(baseWeeks, weeksToSave(remaining, p.income * 0.2)),
    });
  }

  tips.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
  const headline = tips.findIndex((t) => t.id === 'top-category');
  if (headline > 0) tips.unshift(tips.splice(headline, 1)[0]);

  // 7) «Сначала заплати себе» — всегда последним, как итоговое действие.
  if (remaining > 0) {
    tips.push({
      id: 'autosave',
      kind: 'action',
      title: 'Сначала заплатите себе',
      text: `Настройте автоперевод ${groupDigits(Math.ceil(requiredMonthly / 1000) * 1000)} ₸ в месяц на депозит или накопительный счёт сразу после поступления денег — так вы соберёте «${goal.name}» к ${formatFullDate(deadline)}.`,
      monthlyImpact: 0,
      impactLabel: null,
    });
  }

  return { profile: p, remaining, savingsRate, requiredMonthly, shortfall, baseWeeks, weeksLeft, eta, status, tips, discretionary };
}

/* ------------------------------------------------------------------ */
/* ИИ-советник                                                         */
/* ------------------------------------------------------------------ */

export const AI_PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-opus-5-5' },
  openai: { label: 'OpenAI', model: null }, // пока не подключён
};

/** Ключ тестового режима: запрос в сеть не уходит, ответ берётся из MOCK_ADVICE. */
export const MOCK_API_KEY = 'sk-ant-test';
const MOCK_DELAY_MS = 1500;

/** Угадываем провайдера по префиксу ключа. */
export const detectProvider = (key = '') => (key.startsWith('sk-ant-') ? 'anthropic' : key.startsWith('sk-') ? 'openai' : 'anthropic');

/**
 * Готовит данные для LLM: цель, сводку правил и компактный массив операций.
 * Отправляются суммы, даты, категории и описания (в т.ч. имена получателей
 * переводов) — пользователь видит это предупреждение в Профиле.
 */
export function buildLLMPayload(transactions, goal, now = new Date()) {
  const rules = buildAdvice(transactions, goal, now);
  const p = rules.profile;
  return {
    today: now.toISOString().slice(0, 10),
    currency: 'KZT',
    goal: { name: goal.name, target: goal.target, saved: goal.saved, deadline: goal.deadline.slice(0, 10) },
    monthly: {
      windowDays: p.windowDays,
      income: Math.round(p.income),
      expense: Math.round(p.expense),
      savings: Math.round(p.savings),
      byCategory: p.categories.map((c) => ({
        id: c.id,
        category: c.category.name,
        categoryAcc: c.category.nameAcc,
        monthly: Math.round(c.monthly),
        share: Math.round(c.share * 100),
        count: c.count,
      })),
    },
    transactions: p.recent
      .filter((t) => t.categoryId !== 'fx')
      .map((t) => ({
        date: t.date.slice(0, 10),
        type: t.type,
        amount: t.amount,
        category: getCategory(t.categoryId).name,
        merchant: t.merchant,
      })),
  };
}

const SYSTEM_PROMPT = `Ты — внимательный финансовый советник в мобильном банковском приложении в Казахстане.
Пользователь копит на цель. Тебе дают короткую сводку и JSON: цель, средний месячный доход и расходы, расходы по категориям и список операций в тенге (₸).
Дай 3–5 конкретных советов на русском языке, как быстрее достичь цели. Для каждого совета укажи, сколько тенге в месяц он освобождает и на сколько недель приближает цель (считай от текущего темпа накоплений).
Опирайся только на данные; не придумывай операции. Пиши коротко и дружелюбно, без воды. Суммы пиши в формате «12 500 ₸».`;

/**
 * Текст сообщения пользователя: несколько готовых фраз + JSON.
 * Названия категорий внутри фраз — в винительном падеже (nameAcc),
 * поэтому фраза грамматически верна для любой категории.
 */
export function buildLLMUserMessage(payload) {
  const { goal, monthly } = payload;
  const top = monthly.byCategory.slice(0, 3);
  const lines = [
    `Я коплю на «${goal.name}»: нужно ${groupDigits(goal.target)} ₸, уже есть ${groupDigits(goal.saved)} ₸, срок — ${goal.deadline}.`,
    `В месяц я получаю около ${groupDigits(monthly.income)} ₸ и трачу около ${groupDigits(monthly.expense)} ₸.`,
    ...top.map((c, i) =>
      i === 0
        ? `Больше всего я трачу на ${c.categoryAcc}: ${groupDigits(c.monthly)} ₸ в месяц (${c.share}% расходов).`
        : `На ${c.categoryAcc} уходит ${groupDigits(c.monthly)} ₸ в месяц — это ${c.share}% расходов.`,
    ),
  ];
  return `${lines.join('\n')}\n\nПолные данные:\n${JSON.stringify(payload)}`;
}

/** Ответ тестового режима (ключ sk-ant-test). */
const MOCK_ADVICE = `🧪 Тестовый режим: это заготовленный ответ, запрос к ИИ не отправлялся.

1. Сократите доставку еды вдвое — освободится около 48 000 ₸ в месяц, цель приблизится примерно на 10 недель.
2. Замените половину поездок на такси метро — это ещё около 33 000 ₸ в месяц.
3. Переводите друзьям внутри своего банка, чтобы не платить комиссию за перевод в другой банк.
4. Настройте автоперевод на депозит в день поступления денег — так откладывать проще всего.`;

/** Ждёт `ms` миллисекунд; прерывается, если пользователь ушёл с экрана. */
function mockDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Переводит ошибку SDK в понятный текст. SDK бросает классы ошибок
 * по HTTP-статусу (у всех есть поле `status`), поэтому проверяем статус.
 */
export function describeAIError(error, { offline = false } = {}) {
  const status = error?.status;
  const message = String(error?.error?.error?.message ?? error?.message ?? '');
  if (status === 401) return 'Неверный или неактивный ключ API';
  if (status === 429) return 'Превышен лимит запросов или закончился баланс ключа';
  // Anthropic сообщает о нулевом балансе статусом 400 с текстом про credit balance.
  if (status === 400 && /credit balance/i.test(message)) return 'Превышен лимит запросов или закончился баланс ключа';
  if (status === 403) return 'У ключа нет доступа к этой модели';
  if (status === 529 || status >= 500) return 'Сервис ИИ временно недоступен. Попробуйте через минуту';
  if (offline) return 'Нет соединения с сервисом ИИ. Проверьте интернет';
  return message || 'Не удалось получить ответ';
}

/**
 * Запрос к Claude. Ключ хранится только в браузере пользователя, поэтому
 * клиент создаётся с dangerouslyAllowBrowser — для личного прототипа это
 * допустимо, но для публичного приложения запрос нужно перенести на сервер.
 */
async function requestAnthropicAdvice(apiKey, payload, signal) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let response;
  try {
    response = await client.beta.messages.create(
      {
        model: AI_PROVIDERS.anthropic.model,
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        // Если модель откажет по правилам безопасности, API само повторит запрос на запасной модели.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildLLMUserMessage(payload) }],
      },
      { signal },
    );
  } catch (error) {
    if (signal?.aborted) throw error; // пользователь ушёл с экрана — сообщение не нужно
    const offline = error instanceof Anthropic.APIConnectionError; // сеть недоступна или таймаут
    throw new Error(describeAIError(error, { offline }), { cause: error });
  }

  if (response.stop_reason === 'refusal') throw new Error('Модель отказалась отвечать на этот запрос');
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Пустой ответ от модели');
  return text;
}

/**
 * Точка входа для ИИ-советов. Возвращает текст совета или null, если ключа нет
 * (тогда интерфейс показывает советы на правилах из buildAdvice).
 */
export async function getAIAdvice({ apiKey, provider, transactions, goal, now = new Date(), signal }) {
  if (!apiKey) return null;

  // Тестовый режим: никакого сетевого запроса, только задержка и готовый ответ.
  if (apiKey === MOCK_API_KEY) {
    await mockDelay(MOCK_DELAY_MS, signal);
    return MOCK_ADVICE;
  }

  const payload = buildLLMPayload(transactions, goal, now);
  const which = provider || detectProvider(apiKey);
  if (which === 'anthropic') return requestAnthropicAdvice(apiKey, payload, signal);
  // TODO: подключить OpenAI — тот же payload и SYSTEM_PROMPT, свой SDK/эндпоинт.
  throw new Error('OpenAI пока не подключён. Используйте ключ Anthropic');
}
