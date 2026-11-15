/**
 * Очистка всего, что приходит снаружи: параметры ссылки (?quickAdd=… из Команд iOS),
 * названия продавцов из PDF-выписок, JSON-копии и голосовой ввод.
 *
 * Правила:
 *  - только белые списки полей и типов — неизвестные ключи отбрасываются
 *    (в том числе «__proto__», «constructor» — без загрязнения прототипов);
 *  - строки без управляющих, невидимых и bidi-символов (подмена текста
 *    «справа налево», скрытые символы нулевой ширины), без угловых скобок,
 *    с ограничением длины;
 *  - суммы — конечные положительные числа в разумных пределах.
 * React и так экранирует текст, это второй рубеж: данные чистые ещё до
 * сохранения и экспорта.
 *
 * Модуль без зависимостей от React и браузера — его проверяют юнит-тесты.
 */

export const MAX_AMOUNT = 999_999_999_999.99;
export const LIMITS = { merchant: 120, note: 500, id: 80, source: 32, name: 40, goalName: 60, planName: 60 };

// управляющие C0/C1, нулевая ширина, bidi-переключатели, BOM, теги Unicode
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤⁦-⁩﻿]|\uDB40[\uDC00-\uDC7F]/g;
const ANGLE = /[<>]/g;

/** Чистая однострочная строка: «  <b>Magnum</b>‮ » → «bMagnum/b». */
export function sanitizeText(value, max = LIMITS.merchant) {
  if (value == null) return '';
  let s = String(value);
  try {
    s = s.normalize('NFKC');
  } catch {
    /* очень старые движки без normalize — оставляем как есть */
  }
  return s.replace(UNSAFE_CHARS, '').replace(ANGLE, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

/** Многострочный текст (заметка): переносы строк сохраняются. */
export function sanitizeMultiline(value, max = LIMITS.note) {
  if (value == null) return '';
  return String(value)
    .split(/\r?\n/)
    .map((line) => sanitizeText(line, max))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/**
 * Сумма из чего угодно: 4500, "4 500", "4500.50", "4 500,50 ₸", "₸1 800,00", "1,234.56".
 * Возвращает число > 0 (две цифры после запятой) или null.
 */
export function parseSafeAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT ? Math.round(value * 100) / 100 : null;
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[\s  ]/g, '');
  // цифры — одним блоком: валюта до/после допустима, «12abc34» и «1e400» — нет
  if (!/^[^\d]*\d[\d.,]*[^\d]*$/.test(compact)) return null;
  let s = compact.replace(/[^\d.,-]/g, '');
  if (!s || s.startsWith('-')) return null;
  s = s.replace(/-/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // «1,234.56» или «1.234,56»: последний разделитель — дробная часть
    const dec = Math.max(lastComma, lastDot);
    s = `${s.slice(0, dec).replace(/[.,]/g, '')}.${s.slice(dec + 1)}`;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    // «1,800» / «1.800.000» — разделитель тысяч; «18,5» / «4500.50» — дробь
    const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && sep === ',' && parts[0].length <= 3);
    s = thousands ? parts.join('') : `${parts.slice(0, -1).join('')}.${parts.at(-1)}`;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

const SAFE_ID = /^[A-Za-z0-9._:-]{1,80}$/;
const CURRENCY = /^[A-Z]{3}$/;
const ACCOUNT_IDS = new Set(['kaspi', 'cash']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validDate = (v) => typeof v === 'string' && v.length <= 40 && !Number.isNaN(new Date(v).getTime());
const safeId = (v, fallback) => (typeof v === 'string' && SAFE_ID.test(v) ? v : fallback);

let seq = 0;
const freshId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Операция из внешнего источника (JSON-копия, PDF-выписка) → только известные поля.
 * Возвращает null, если операция повреждена.
 * `knownCategory(id)` — проверка категории (по умолчанию любая строка-идентификатор).
 */
export function sanitizeTransaction(tx, { knownCategory = () => true } = {}) {
  if (!isPlainObject(tx)) return null;
  if (tx.type !== 'income' && tx.type !== 'expense') return null;
  const amount = parseSafeAmount(tx.amount);
  if (amount == null || !validDate(tx.date)) return null;
  const categoryId = typeof tx.categoryId === 'string' && SAFE_ID.test(tx.categoryId) && knownCategory(tx.categoryId) ? tx.categoryId : tx.type === 'income' ? 'topup' : 'shopping';
  const out = {
    id: safeId(tx.id, freshId('tx')),
    type: tx.type,
    amount,
    categoryId,
    merchant: sanitizeText(tx.merchant, LIMITS.merchant),
    accountId: ACCOUNT_IDS.has(tx.accountId) ? tx.accountId : 'kaspi',
    date: new Date(tx.date).toISOString(),
    note: sanitizeMultiline(tx.note, LIMITS.note),
  };
  if (tx.noTime === true) out.noTime = true;
  if (typeof tx.source === 'string' && SAFE_ID.test(tx.source)) out.source = tx.source.slice(0, LIMITS.source);
  if (isPlainObject(tx.original) && CURRENCY.test(tx.original.currency) && parseSafeAmount(tx.original.amount) != null) {
    out.original = { amount: parseSafeAmount(tx.original.amount), currency: tx.original.currency };
  }
  return out;
}

const num = (v, { min = 0, max = MAX_AMOUNT, fallback = 0 } = {}) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback);

/** Настройки из JSON-копии: только известные ключи нужных типов. Ключ ИИ не принимается никогда. */
export function sanitizeSettings(settings) {
  if (!isPlainObject(settings)) return {};
  const out = {};
  if (typeof settings.hideBalance === 'boolean') out.hideBalance = settings.hideBalance;
  if (settings.monthlyBudget !== undefined) out.monthlyBudget = Math.floor(num(settings.monthlyBudget));
  if (settings.weeklyLimit !== undefined) out.weeklyLimit = Math.floor(num(settings.weeklyLimit));
  if (settings.hourlyRate !== undefined) out.hourlyRate = num(settings.hourlyRate, { max: 100_000_000 });
  if (settings.name !== undefined) out.name = sanitizeText(settings.name, 30);
  if (settings.cardName !== undefined) out.cardName = sanitizeText(settings.cardName, LIMITS.name);
  if (settings.aiProvider === 'anthropic' || settings.aiProvider === 'openai') out.aiProvider = settings.aiProvider;
  if (isPlainObject(settings.openings)) {
    const openings = {};
    for (const id of ACCOUNT_IDS) {
      const v = settings.openings[id];
      if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_AMOUNT) openings[id] = v;
    }
    out.openings = openings;
  }
  return out;
}

/** Цели (накопления). Повреждённые отбрасываются. */
export function sanitizeGoals(goals) {
  if (!Array.isArray(goals)) return undefined;
  return goals
    .filter(isPlainObject)
    .map((g) => {
      const target = parseSafeAmount(g.target);
      if (target == null || !validDate(g.deadline)) return null;
      return {
        id: safeId(g.id, freshId('goal')),
        name: sanitizeText(g.name, LIMITS.goalName) || 'Цель',
        emoji: sanitizeText(g.emoji, 8) || '🎯',
        target,
        saved: Math.min(target, num(g.saved)),
        deadline: new Date(g.deadline).toISOString(),
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** План «Финансового дневника». Неверный план → undefined (останется текущий). */
export function sanitizePlan(plan) {
  if (!isPlainObject(plan) || !DAY.test(plan.deadline) || !Array.isArray(plan.items) || !Array.isArray(plan.incomes)) return undefined;
  const items = plan.items
    .filter(isPlainObject)
    .map((i) => {
      const amount = parseSafeAmount(i.amount);
      if (amount == null) return null;
      return { id: safeId(i.id, freshId('item')), name: sanitizeText(i.name, LIMITS.planName) || 'Цель', amount, paidOn: typeof i.paidOn === 'string' && DAY.test(i.paidOn) ? i.paidOn : null };
    })
    .filter(Boolean)
    .slice(0, 100);
  const incomes = plan.incomes
    .filter((i) => isPlainObject(i) && isPlainObject(i.rule))
    .map((i) => {
      const amount = i.amount === 0 ? 0 : parseSafeAmount(i.amount);
      if (amount == null) return null;
      // правило расписания — ровно две формы (см. utils/schedule.js)
      const { type, weekday, day } = i.rule;
      let rule = null;
      if (type === 'weekly' && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) rule = { type, weekday };
      if (type === 'monthly' && Number.isInteger(day) && day >= 1 && day <= 31) rule = { type, day };
      if (!rule) return null;
      return { id: safeId(i.id, freshId('inc')), name: sanitizeText(i.name, LIMITS.planName), amount, rule };
    })
    .filter(Boolean)
    .slice(0, 50);
  return { deadline: plan.deadline, items, incomes };
}

/* ------------------------------------------------------------------ */
/* Ссылка быстрого ввода (Команды iOS → Apple Pay)                     */
/* ------------------------------------------------------------------ */

export const QUICK_ADD_PARAMS = ['quickAdd', 'amount', 'merchant', 'type', 'category'];

/**
 * ?quickAdd=1&amount=1800&merchant=Starbucks&type=expense → черновик операции
 * для листа «Новая операция». Никогда не сохраняет сам: пользователь
 * подтверждает касанием. Возвращает null, если ссылка не про быстрый ввод.
 *
 * `knownCategory(id, type)` — разрешённые категории (из data/categories.js).
 */
export function parseQuickAdd(search, { knownCategory = () => false } = {}) {
  let params;
  try {
    params = new URLSearchParams(typeof search === 'string' ? search : '');
  } catch {
    return null;
  }
  const flag = params.get('quickAdd');
  if (flag !== '1' && flag !== 'true') return null;
  const type = params.get('type') === 'income' ? 'income' : 'expense';
  const rawAmount = (params.get('amount') ?? '').slice(0, 40);
  const amount = parseSafeAmount(rawAmount);
  const merchant = sanitizeText((params.get('merchant') ?? '').slice(0, 400), LIMITS.merchant);
  const category = (params.get('category') ?? '').slice(0, 40);
  const categoryId = SAFE_ID.test(category) && knownCategory(category, type) ? category : null;
  return { type, amount, merchant, categoryId, source: 'shortcut' };
}

/** Убирает параметры быстрого ввода из адресной строки (чтобы обновление страницы не открывало лист снова). */
export function stripQuickAddParams(href) {
  try {
    const url = new URL(href);
    for (const p of QUICK_ADD_PARAMS) url.searchParams.delete(p);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
