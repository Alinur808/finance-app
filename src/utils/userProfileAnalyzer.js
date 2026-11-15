import { getCategory } from '../data/categories.js';
import { addDays, startOfDay } from './dates.js';
import { formatMoney, formatPercent, plural } from './format.js';

/**
 * «Что приложение знает обо мне?» — поведенческий портрет по операциям.
 *
 * Смотрит на ритм трат за последние 90 дней (или меньше, если данных меньше):
 *   - пиковый день недели и доля выходных;
 *   - поздние траты (22:00–05:00) — только у операций с настоящим временем
 *     (у строк PDF-выписок времени нет: флаг noTime, они не учитываются);
 *   - мелкие импульсивные покупки до 3 000 ₸;
 *   - регулярные платежи: одинаковый получатель, похожая сумма, раз в ~месяц
 *     или ~неделю, плюс категория «Подписки и сервисы»;
 *   - главная статья, доля «гибких» трат, норма сбережений.
 * Итог — архетип, черты и три конкретных действия с эффектом в ₸/мес.
 * Всё считается на устройстве.
 */

const MONTH_DAYS = 30.44;
const WINDOW_DAYS = 90;
const SMALL = 3000;
const NOT_SPENDING = new Set(['own', 'fx']);
const NOT_IMPULSE = new Set(['transfers', 'fees', 'housing', 'health', 'cash', 'own', 'fx']);
const LATE_FOOD = new Set(['delivery', 'cafe']);
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const money = (v) => formatMoney(Math.round(v), { decimals: false });

const isLate = (d) => d.getHours() >= 22 || d.getHours() < 5;

/** «YANDEX.GO *TRIP 123» → «yandex go trip» — ключ для поиска регулярных платежей. */
export function merchantKey(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[0-9*#№]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 3)
    .join(' ');
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Регулярные платежи: [{ key, merchant, amount, cadence: 'monthly'|'weekly', monthly, count, categoryId }] */
export function detectRecurring(expenses) {
  const groups = new Map();
  for (const t of expenses) {
    if (t.categoryId === 'transfers' || t.categoryId === 'cash') continue;
    const key = merchantKey(t.merchant);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const found = [];
  for (const [key, txs] of groups) {
    const sorted = [...txs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const amounts = sorted.map((t) => t.amount);
    const med = median(amounts);
    const similar = sorted.filter((t) => Math.abs(t.amount - med) <= med * 0.15);
    const isSubCategory = sorted.some((t) => t.categoryId === 'subscriptions');
    let cadence = null;
    if (similar.length >= 2) {
      const gaps = [];
      for (let i = 1; i < similar.length; i += 1) gaps.push((new Date(similar[i].date) - new Date(similar[i - 1].date)) / 86400000);
      const g = median(gaps);
      if (g >= 25 && g <= 35) cadence = 'monthly';
      else if (g >= 6 && g <= 8) cadence = 'weekly';
    }
    if (!cadence && isSubCategory) cadence = 'monthly'; // «Подписки и сервисы» — даже по одному списанию
    if (!cadence) continue;
    found.push({
      key,
      merchant: sorted.at(-1).merchant || key,
      amount: med,
      cadence,
      monthly: cadence === 'weekly' ? med * (52 / 12) : med,
      count: similar.length || sorted.length,
      categoryId: sorted.at(-1).categoryId,
    });
  }
  return found.sort((a, b) => b.monthly - a.monthly);
}

const ARCHETYPES = {
  'night-owl': { emoji: '🌙', title: 'Ночной гурман', text: 'Главные «лишние» траты случаются поздно вечером — когда силы кончились, а приложение доставки под рукой.' },
  impulse: { emoji: '⚡', title: 'Мастер мелких покупок', text: 'Крупных ошибок нет, но десятки мелких покупок незаметно складываются в серьёзную сумму.' },
  subscriber: { emoji: '🔁', title: 'Коллекционер подписок', text: 'Деньги уходят сами: регулярные списания, о которых легко забыть.' },
  weekend: { emoji: '🎉', title: 'Транжира выходного дня', text: 'Будни под контролем, а выходные съедают непропорционально большую часть бюджета.' },
  foodie: { emoji: '🍜', title: 'Гурман-оптимист', text: 'Еда вне дома — ваша главная статья. Вкусно, но дорого.' },
  saver: { emoji: '🧊', title: 'Хладнокровный накопитель', text: 'Вы откладываете заметную долю дохода. Осталось заставить эти деньги работать.' },
  balanced: { emoji: '🧭', title: 'Рациональный стратег', text: 'Траты ровные и предсказуемые — без явных перекосов. Хорошая база для крупной цели.' },
};

/**
 * Поведенческий портрет.
 * @returns {{ hasData, windowDays, archetype, traits, recommendations, stats }}
 */
export function analyzeBehavior(transactions, now = new Date(), { windowDays = WINDOW_DAYS } = {}) {
  const start = addDays(startOfDay(now), -(windowDays - 1));
  const inWindow = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= start && d <= now;
  });
  const expenses = inWindow.filter((t) => t.type === 'expense' && !NOT_SPENDING.has(t.categoryId));
  const incomes = inWindow.filter((t) => t.type === 'income' && t.categoryId !== 'own' && t.categoryId !== 'refunds');
  if (expenses.length < 8) return { hasData: false, windowDays, archetype: null, traits: [], recommendations: [], stats: null };

  const oldest = expenses.reduce((m, t) => Math.min(m, new Date(t.date).getTime()), now.getTime());
  const span = Math.max(7, Math.min(windowDays, Math.floor((startOfDay(now) - startOfDay(oldest)) / 86400000) + 1));
  const scale = MONTH_DAYS / span;
  const weeks = span / 7;
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const income = incomes.reduce((s, t) => s + t.amount, 0);

  // 1. Ритм недели
  const byWeekday = Array(7).fill(0);
  for (const t of expenses) byWeekday[new Date(t.date).getDay()] += t.amount;
  const peakDay = byWeekday.indexOf(Math.max(...byWeekday));
  const peakShare = byWeekday[peakDay] / total;
  const weekendShare = (byWeekday[0] + byWeekday[6]) / total;

  // 2. Поздние траты — только с настоящим временем
  const timed = expenses.filter((t) => !t.noTime);
  const late = timed.filter((t) => isLate(new Date(t.date)));
  const lateFood = late.filter((t) => LATE_FOOD.has(t.categoryId));
  const lateShare = timed.length >= 8 ? late.length / timed.length : 0;
  const lateMonthly = late.reduce((s, t) => s + t.amount, 0) * scale;
  const lateFoodMonthly = lateFood.reduce((s, t) => s + t.amount, 0) * scale;

  // 3. Мелкие импульсивные покупки
  const small = expenses.filter((t) => t.amount < SMALL && !NOT_IMPULSE.has(t.categoryId));
  const smallMonthly = small.reduce((s, t) => s + t.amount, 0) * scale;
  const smallPerWeek = small.length / weeks;

  // 4. Регулярные платежи
  const recurring = detectRecurring(expenses);
  const recurringMonthly = recurring.reduce((s, r) => s + r.monthly, 0);

  // 5. Структура трат
  const byCat = new Map();
  for (const t of expenses) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  const cats = [...byCat.entries()].map(([id, amount]) => ({ id, amount, share: amount / total, monthly: amount * scale, category: getCategory(id) })).sort((a, b) => b.amount - a.amount);
  const topFlexible = cats.find((c) => c.category.discretionary) ?? null;
  const foodShare = ((byCat.get('delivery') ?? 0) + (byCat.get('cafe') ?? 0)) / total;
  const flexibleShare = cats.filter((c) => c.category.discretionary).reduce((s, c) => s + c.share, 0);
  const savingsRate = income > 0 ? (income - total) / income : null;
  const monthlyExpense = total * scale;

  // Архетип: побеждает самая выраженная черта
  const scores = {
    'night-owl': late.length >= 3 && lateShare >= 0.15 ? lateShare * 5 : 0, // конкретнее, чем «гурман», — важнее
    impulse: small.length >= 10 && (smallPerWeek >= 5 || smallMonthly / monthlyExpense >= 0.12) ? Math.min(2, smallPerWeek / 5) + smallMonthly / monthlyExpense : 0,
    subscriber: recurring.length >= 3 || recurringMonthly / monthlyExpense >= 0.08 ? recurring.length / 3 + recurringMonthly / monthlyExpense : 0,
    weekend: weekendShare >= 0.42 ? (weekendShare - 2 / 7) * 5 : 0,
    foodie: foodShare >= 0.25 ? foodShare * 2 : 0,
    saver: savingsRate != null && savingsRate >= 0.25 ? savingsRate * 3 : 0,
    balanced: 0.6,
  };
  const archetypeId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const archetype = { id: archetypeId, ...ARCHETYPES[archetypeId] };

  // Черты — от самых ярких
  const traits = [];
  traits.push({
    id: 'peak-day',
    title: `Пик трат — ${WEEKDAYS[peakDay]}`,
    text: `${formatPercent(peakShare)} всех расходов приходится на этот день недели${peakShare > 0.25 ? ' — заметный перекос' : ''}.`,
    weight: peakShare,
  });
  if (weekendShare >= 0.35)
    traits.push({ id: 'weekend', title: 'Выходные дороже будней', text: `На субботу и воскресенье — ${formatPercent(weekendShare)} расходов (в среднем было бы около 29%).`, weight: weekendShare });
  if (late.length >= 3)
    traits.push({
      id: 'late',
      title: 'Поздние траты',
      text: `${plural(late.length, ['покупка', 'покупки', 'покупок'])} после 22:00${lateFood.length ? `, из них ${plural(lateFood.length, ['заказ', 'заказа', 'заказов'])} еды` : ''} — около ${money(lateMonthly)} в месяц.`,
      weight: lateShare * 2,
    });
  if (small.length >= 10)
    traits.push({
      id: 'impulse',
      title: `Мелкие покупки до ${money(SMALL)}`,
      text: `${plural(Math.round(smallPerWeek), ['покупка', 'покупки', 'покупок'])} в неделю — набегает ${money(smallMonthly)} в месяц.`,
      weight: smallMonthly / monthlyExpense + 0.2,
    });
  if (recurring.length)
    traits.push({
      id: 'subscriptions',
      title: `Регулярные списания: ${plural(recurring.length, ['сервис', 'сервиса', 'сервисов'])}`,
      text: `${recurring
        .slice(0, 3)
        .map((r) => r.merchant)
        .join(', ')}${recurring.length > 3 ? ' и др.' : ''} — ${money(recurringMonthly)} в месяц, ${money(recurringMonthly * 12)} в год.`,
      weight: recurringMonthly / monthlyExpense + 0.15,
    });
  if (topFlexible)
    traits.push({
      id: 'top-flexible',
      title: `Главная гибкая статья — ${topFlexible.category.name.toLowerCase()}`,
      text: `${formatPercent(topFlexible.share)} расходов, около ${money(topFlexible.monthly)} в месяц.`,
      weight: topFlexible.share,
    });
  if (savingsRate != null)
    traits.push({
      id: 'savings',
      title: savingsRate >= 0.2 ? 'Откладываете больше 20%' : savingsRate >= 0 ? 'Откладываете мало' : 'Тратите больше, чем получаете',
      text: savingsRate >= 0 ? `Остаётся ${formatPercent(savingsRate)} дохода.` : `Расходы выше доходов на ${formatPercent(-savingsRate)}.`,
      weight: Math.abs(savingsRate - 0.2),
    });
  traits.sort((a, b) => b.weight - a.weight);

  // Три действия — с наибольшим эффектом
  const recs = [];
  if (small.length >= 10)
    recs.push({ id: 'rule-24h', title: 'Правило 24 часов', text: `Покупки до ${money(SMALL)} — только на следующий день, если всё ещё хочется. Обычно треть отпадает сама.`, monthlyImpact: smallMonthly * 0.3 });
  if (lateFoodMonthly > 0)
    recs.push({ id: 'kitchen-closed', title: 'Кухня закрывается в 22:00', text: 'Удалите приложение доставки с главного экрана и держите дома «план Б» на поздний вечер.', monthlyImpact: lateFoodMonthly * 0.5 });
  if (recurring.length) {
    const cut = recurring.slice(-Math.min(2, recurring.length)).reduce((s, r) => s + r.monthly, 0);
    recs.push({ id: 'subs-audit', title: 'Ревизия подписок', text: `Отключите 1–2 сервиса, которыми не пользовались в этом месяце: ${recurring.slice(-2).map((r) => r.merchant).join(', ')}.`, monthlyImpact: cut });
  }
  if (weekendShare >= 0.4)
    recs.push({ id: 'weekend-cap', title: 'Лимит на выходные', text: `Заранее решите, сколько тратите в субботу и воскресенье — и включите «Недельный лимит трат».`, monthlyImpact: total * weekendShare * scale * 0.2 });
  if (topFlexible)
    recs.push({ id: 'flex-cut', title: `Минус 20% на «${topFlexible.category.name}»`, text: `Это ${money(topFlexible.monthly * 0.2)} в месяц без заметной потери удовольствия.`, monthlyImpact: topFlexible.monthly * 0.2 });
  recs.push({
    id: 'pay-yourself',
    title: 'Сначала — себе',
    text: income > 0 ? `Автоперевод ${money(Math.ceil((income * scale * 0.1) / 1000) * 1000)} (10% дохода) на депозит в день поступления денег.` : 'Откладывайте фиксированную сумму в день поступления денег — до того, как начнёте тратить.',
    monthlyImpact: income > 0 ? income * scale * 0.1 : 0,
  });
  const seen = new Set();
  const recommendations = recs
    .sort((a, b) => b.monthlyImpact - a.monthlyImpact)
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .slice(0, 3);

  return {
    hasData: true,
    windowDays: span,
    archetype,
    traits: traits.slice(0, 5),
    recommendations,
    stats: {
      monthlyExpense,
      peakDay,
      peakShare,
      weekendShare,
      lateCount: late.length,
      lateShare,
      smallCount: small.length,
      smallMonthly,
      recurring,
      recurringMonthly,
      flexibleShare,
      savingsRate,
      topFlexible: topFlexible ? { id: topFlexible.id, share: topFlexible.share, monthly: topFlexible.monthly } : null,
    },
  };
}

/** Короткое описание портрета для ИИ-аналитика (без сумм операций и имён). */
export function personaSummary(profile) {
  if (!profile?.hasData) return null;
  return {
    archetype: profile.archetype.title,
    traits: profile.traits.map((t) => t.title),
    weekendShare: Math.round(profile.stats.weekendShare * 100),
    lateNightPurchases: profile.stats.lateCount,
    smallPurchasesMonthly: Math.round(profile.stats.smallMonthly),
    recurringMonthly: Math.round(profile.stats.recurringMonthly),
  };
}
