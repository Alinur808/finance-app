import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { statementTransactions } from '../data/seed.js';
import { ACCOUNTS } from '../data/accounts.js';
import { createEmptyPlan } from '../utils/plan.js';
import { dayKey } from '../utils/dates.js';

const STORAGE_KEY = 'tenge-finance.v2';
const SAVE_DELAY_MS = 400;
const FinanceContext = createContext(null);

const DEFAULT_FILTERS = { period: 'month', accountId: 'all', categoryId: null };
const DEFAULT_SETTINGS = {
  // false — показываем экран первого запуска (импорт или ручной старт)
  onboarded: false,
  hideBalance: false,
  monthlyBudget: 0, // 0 — бюджет не задан, карточка бюджета скрыта
  name: '',
  aiApiKey: '',
  aiProvider: 'anthropic',
  // своё название карты, например «Kaspi Gold» или «Freedom Super Card»; пусто — «Основная карта»
  cardName: '',
  // начальные балансы счетов; попадают в резервную копию вместе с операциями
  openings: Object.fromEntries(ACCOUNTS.map((a) => [a.id, a.opening])),
};

const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);
const round2 = (n) => Math.round(n * 100) / 100;
const netOf = (transactions, accountId) =>
  transactions.filter((t) => t.accountId === accountId).reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.transactions)) {
        const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        // данные из версий до экрана первого запуска: пользователь уже «в приложении»
        if (parsed.settings?.onboarded === undefined) settings.onboarded = parsed.transactions.length > 0 || (parsed.goals?.length ?? 0) > 0;
        return { ...freshState(), ...parsed, settings, plan: parsed.plan ?? createEmptyPlan(), filters: DEFAULT_FILTERS };
      }
    }
  } catch {
    /* хранилище недоступно (приватный режим) — начинаем с чистого листа */
  }
  return freshState();
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
        // ключ ИИ никогда не попадает в файл экспорта — сохраняем текущий
        settings: { ...state.settings, ...(action.data.settings ?? {}), aiApiKey: state.settings.aiApiKey, onboarded: true },
        plan: action.data.plan ?? state.plan,
        filters: DEFAULT_FILTERS,
      };
    case 'importStatement': {
      // Операции основной карты за период выписки заменяем данными выписки,
      // всё остальное (наличные, другие месяцы, цели, план) оставляем.
      const { transactions: incoming, period, closingBalance, cardName } = action.data;
      const inPeriod = (t) => t.accountId === 'kaspi' && dayKey(t.date) >= period.from && dayKey(t.date) <= period.to;
      const transactions = [...state.transactions.filter((t) => !inPeriod(t)), ...incoming].sort(byDateDesc);
      // начальный остаток подбираем так, чтобы баланс карты совпал с выпиской
      const opening = round2(closingBalance - netOf(transactions, 'kaspi'));
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

export function FinanceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const latest = useRef(state);
  latest.current = state;

  // Сохраняем с задержкой (не на каждое нажатие клавиши) и сразу — когда приложение уходит в фон.
  useEffect(() => {
    const save = () => {
      try {
        const { filters, ...persisted } = latest.current;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch {
        /* переполнено хранилище или приватный режим */
      }
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
  }, [state]);

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

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
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
