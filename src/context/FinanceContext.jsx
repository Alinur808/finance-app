import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { statementTransactions } from '../data/seed.js';
import { ACCOUNTS } from '../data/accounts.js';
import { createEmptyPlan } from '../utils/plan.js';
import { dayKey } from '../utils/dates.js';
import { setAiKey } from '../utils/secrets.js';
import { LEGACY_KEY } from '../utils/vault.js';

/**
 * Состояние приложения. Хранится зашифрованным (utils/vault.js): main.jsx
 * открывает сейф до первой отрисовки и передаёт сюда `vault`
 * ({ state, status, save, flush }). Формат состояния прежний — старые
 * резервные копии и данные из tenge-finance.v2 подходят без изменений.
 */
const SAVE_DELAY_MS = 250;
const FinanceContext = createContext(null);

// последняя функция «сохранить сейчас» — для автообновления PWA (сохраняем перед перезагрузкой)
let saveNowRef = null;
export async function flushFinanceState() {
  await saveNowRef?.();
}

const DEFAULT_FILTERS = { period: 'month', accountId: 'all', categoryId: null };
const DEFAULT_SETTINGS = {
  // false — показываем экран первого запуска (импорт или ручной старт)
  onboarded: false,
  hideBalance: false,
  monthlyBudget: 0, // 0 — бюджет не задан, карточка бюджета скрыта
  name: '',
  // ключ ИИ больше не хранится в данных — только в sessionStorage (utils/secrets.js)
  aiProvider: 'anthropic',
  weeklyLimit: 0, // 0 — недельный лимит трат выключен
  hourlyRate: 0, // 0 — ставка «час работы» считается по доходам автоматически
  // своё название карты, например «Kaspi Gold» или «Freedom Super Card»; пусто — «Основная карта»
  cardName: '',
  // начальные балансы счетов; попадают в резервную копию вместе с операциями
  openings: Object.fromEntries(ACCOUNTS.map((a) => [a.id, a.opening])),
};

const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);
const round2 = (n) => Math.round(n * 100) / 100;
const netOf = (transactions, accountId) => transactions.filter((t) => t.accountId === accountId).reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

function freshState() {
  const transactions = statementTransactions(); // пусто в публичной сборке
  return {
    transactions,
    goals: [],
    activeGoalId: null,
    filters: DEFAULT_FILTERS,
    settings: { ...DEFAULT_SETTINGS, onboarded: transactions.length > 0 },
    plan: createEmptyPlan(), // «Финансовый дневник»: дедлайн, цели-покупки, регулярные поступления
  };
}

/** Состояние из сейфа (или старого tenge-finance.v2) → состояние приложения. */
export function hydrateState(parsed) {
  if (!parsed || !Array.isArray(parsed.transactions)) return freshState();
  const { aiApiKey, ...savedSettings } = parsed.settings ?? {};
  // ключ ИИ из старых версий: переносим в sessionStorage, из данных — удаляем
  if (aiApiKey) setAiKey(aiApiKey);
  const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  // данные из версий до экрана первого запуска: пользователь уже «в приложении»
  if (parsed.settings?.onboarded === undefined) settings.onboarded = parsed.transactions.length > 0 || (parsed.goals?.length ?? 0) > 0;
  return { ...freshState(), ...parsed, settings, plan: parsed.plan ?? createEmptyPlan(), filters: DEFAULT_FILTERS };
}

/** Без сейфа (тесты, старые вызовы): синхронно из открытого tenge-finance.v2. */
function loadState(vault) {
  if (vault) return hydrateState(vault.state);
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) return hydrateState(JSON.parse(raw));
  } catch {
    /* хранилище недоступно (приватный режим) — начинаем с чистого листа */
  }
  return freshState();
}

/** То, что попадает в хранилище: без фильтров экрана и без секретов. */
export function persistable(state) {
  const { filters, ...rest } = state;
  const { aiApiKey, ...settings } = rest.settings;
  return { ...rest, settings };
}

function reducer(state, action) {
  switch (action.type) {
    case 'addTransaction':
      return { ...state, transactions: [action.tx, ...state.transactions].sort(byDateDesc), settings: { ...state.settings, onboarded: true } };
    case 'updateTransaction':
      return { ...state, transactions: state.transactions.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case 'deleteTransaction':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) };
    case 'setFilters':
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case 'saveGoal': {
      const exists = state.goals.some((g) => g.id === action.goal.id);
      return {
        ...state,
        goals: exists ? state.goals.map((g) => (g.id === action.goal.id ? action.goal : g)) : [...state.goals, action.goal],
        activeGoalId: action.goal.id,
      };
    }
    case 'deleteGoal': {
      const goals = state.goals.filter((g) => g.id !== action.id);
      return { ...state, goals, activeGoalId: goals[0]?.id ?? null };
    }
    case 'contribute':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.id ? { ...g, saved: Math.min(g.target, g.saved + action.amount) } : g)),
      };
    case 'setActiveGoal':
      return { ...state, activeGoalId: action.id };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'setAccountBalance': {
      // Корректировка: подбираем начальный остаток так, чтобы текущий баланс стал нужным.
      const opening = round2(action.balance - netOf(state.transactions, action.accountId));
      return { ...state, settings: { ...state.settings, openings: { ...state.settings.openings, [action.accountId]: opening } } };
    }
    case 'completeOnboarding': {
      const { name = '', cardName = '', balance = 0 } = action.data;
      const opening = round2(balance - netOf(state.transactions, 'kaspi'));
      return {
        ...state,
        settings: { ...state.settings, onboarded: true, name: name.trim(), cardName: cardName.trim(), openings: { ...state.settings.openings, kaspi: opening } },
      };
    }
    case 'importData':
      return {
        ...state,
        transactions: [...action.data.transactions].sort(byDateDesc),
        goals: action.data.goals ?? state.goals,
        activeGoalId: action.data.goals?.[0]?.id ?? state.activeGoalId,
        // настройки из файла уже очищены (utils/sanitize.js); ключ ИИ в файл не попадает
        settings: { ...state.settings, ...(action.data.settings ?? {}), onboarded: true },
        plan: action.data.plan ?? state.plan,
        filters: DEFAULT_FILTERS,
      };
    case 'importStatement': {
      // Операции основной карты за период выписки заменяем данными выписки,
      // всё остальное (наличные, другие месяцы, цели, план) оставляем.
      const { transactions: incoming, period, closingBalance, cardName } = action.data;
      const inPeriod = (t) => t.accountId === 'kaspi' && dayKey(t.date) >= period.from && dayKey(t.date) <= period.to;
      const transactions = [...state.transactions.filter((t) => !inPeriod(t)), ...incoming].sort(byDateDesc);
      // начальный остаток подбираем так, чтобы баланс карты совпал с выпиской;
      // если остатка в выписке нет — прежний начальный остаток (баланс сдвинется на сумму операций)
      const opening = closingBalance == null ? state.settings.openings.kaspi : round2(closingBalance - netOf(transactions, 'kaspi'));
      return {
        ...state,
        transactions,
        settings: {
          ...state.settings,
          onboarded: true,
          openings: { ...state.settings.openings, kaspi: opening },
          cardName: state.settings.cardName?.trim() ? state.settings.cardName : cardName,
        },
        filters: DEFAULT_FILTERS,
      };
    }
    case 'savePlan':
      return { ...state, plan: action.plan };
    case 'togglePlanItemPaid':
      return {
        ...state,
        plan: {
          ...state.plan,
          items: state.plan.items.map((i) => (i.id === action.id ? { ...i, paidOn: i.paidOn ? null : action.day } : i)),
        },
      };
    case 'resetAll':
      // Полный сброс устройства: снова экран первого запуска.
      return { ...freshState(), settings: { ...DEFAULT_SETTINGS, onboarded: false } };
    default:
      return state;
  }
}

export function FinanceProvider({ children, vault = null }) {
  const [state, dispatch] = useReducer(reducer, vault, loadState);
  const latest = useRef(state);
  latest.current = state;
  const [vaultStatus, setVaultStatus] = useState(vault?.status ?? 'plain');
  const vaultRef = useRef(vault);

  const saveNow = useMemo(
    () => async () => {
      const v = vaultRef.current;
      const data = persistable(latest.current);
      if (v) {
        v.save(data);
        await v.flush();
        return;
      }
      try {
        localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
      } catch {
        /* переполнено хранилище или приватный режим */
      }
    },
    [],
  );

  useEffect(() => {
    saveNowRef = saveNow;
    return () => {
      if (saveNowRef === saveNow) saveNowRef = null;
    };
  }, [saveNow]);

  // Сохраняем с задержкой (не на каждое нажатие клавиши) и сразу — когда приложение уходит в фон.
  useEffect(() => {
    const save = () => {
      saveNow();
    };
    const timer = setTimeout(save, SAVE_DELAY_MS);
    window.addEventListener('pagehide', save);
    const onHidden = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [state, saveNow]);

  /** Сейф не открылся (ключ потерян): пользователь сам решает начать заново. */
  const discardUnreadableVault = useMemo(
    () => () => {
      vaultRef.current?.discard?.();
      setVaultStatus('plain');
      dispatch({ type: 'resetAll' });
    },
    [],
  );

  const actions = useMemo(
    () => ({
      addTransaction: (tx) => dispatch({ type: 'addTransaction', tx: { id: `tx-${Date.now()}`, note: '', ...tx } }),
      updateTransaction: (id, patch) => dispatch({ type: 'updateTransaction', id, patch }),
      deleteTransaction: (id) => dispatch({ type: 'deleteTransaction', id }),
      setFilters: (patch) => dispatch({ type: 'setFilters', patch }),
      saveGoal: (goal) => dispatch({ type: 'saveGoal', goal }),
      deleteGoal: (id) => dispatch({ type: 'deleteGoal', id }),
      contribute: (id, amount) => dispatch({ type: 'contribute', id, amount }),
      setActiveGoal: (id) => dispatch({ type: 'setActiveGoal', id }),
      updateSettings: (patch) => dispatch({ type: 'updateSettings', patch }),
      setAccountBalance: (accountId, balance) => dispatch({ type: 'setAccountBalance', accountId, balance }),
      completeOnboarding: (data) => dispatch({ type: 'completeOnboarding', data }),
      importData: (data) => dispatch({ type: 'importData', data }),
      importStatement: (data) => dispatch({ type: 'importStatement', data }),
      savePlan: (plan) => dispatch({ type: 'savePlan', plan }),
      togglePlanItemPaid: (id, day) => dispatch({ type: 'togglePlanItemPaid', id, day }),
      resetAll: () => dispatch({ type: 'resetAll' }),
    }),
    [],
  );

  const value = useMemo(
    () => ({ ...state, ...actions, vaultStatus, encrypted: Boolean(vault?.encrypted) && vaultStatus !== 'unreadable', discardUnreadableVault, saveNow }),
    [state, actions, vaultStatus, vault, discardUnreadableVault, saveNow],
  );
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside <FinanceProvider>');
  return ctx;
}

/** Текущее время; обновляется раз в минуту, чтобы «Сегодня/Вчера» оставались верными. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}
