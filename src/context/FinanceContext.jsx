import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { defaultGoals, statementTransactions } from '../data/seed.js';
import { ACCOUNTS } from '../data/accounts.js';
import { DEFAULT_PLAN } from '../utils/plan.js';

const STORAGE_KEY = 'tenge-finance.v2';
const FinanceContext = createContext(null);

const DEFAULT_FILTERS = { period: 'month', accountId: 'all', categoryId: null };
const DEFAULT_SETTINGS = {
  hideBalance: false,
  monthlyBudget: 400000,
  // в публичной сборке имени нет — оно придёт из резервной копии
  name: import.meta.env.MODE === 'public' ? '' : 'Алинур',
  aiApiKey: '',
  aiProvider: 'anthropic',
  // своё название карты, например «Kaspi Gold» или «Freedom Super Card»; пусто — «Основная карта»
  cardName: '',
  // начальные балансы счетов; попадают в резервную копию вместе с операциями
  openings: Object.fromEntries(ACCOUNTS.map((a) => [a.id, a.opening])),
};

function freshState() {
  const now = new Date();
  const goals = defaultGoals(now);
  return {
    transactions: statementTransactions(),
    goals,
    activeGoalId: goals[0].id,
    filters: DEFAULT_FILTERS,
    settings: DEFAULT_SETTINGS,
    plan: DEFAULT_PLAN, // «Финансовый дневник»: дедлайн, цели-покупки, регулярные поступления
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.transactions)) {
        return { ...freshState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings }, plan: parsed.plan ?? DEFAULT_PLAN, filters: DEFAULT_FILTERS };
      }
    }
  } catch {
    /* storage unavailable: fall back to demo data */
  }
  return freshState();
}

function reducer(state, action) {
  switch (action.type) {
    case 'addTransaction':
      return {
        ...state,
        transactions: [action.tx, ...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)),
      };
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
    case 'importData':
      return {
        ...state,
        transactions: [...action.data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)),
        goals: action.data.goals ?? state.goals,
        activeGoalId: action.data.goals?.[0]?.id ?? state.activeGoalId,
        // ключ ИИ никогда не попадает в файл экспорта — сохраняем текущий
        settings: { ...state.settings, ...(action.data.settings ?? {}), aiApiKey: state.settings.aiApiKey },
        plan: action.data.plan ?? state.plan,
        filters: DEFAULT_FILTERS,
      };
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
    case 'reset':
      return { ...freshState(), settings: state.settings, plan: state.plan };
    default:
      return state;
  }
}

export function FinanceProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      const { filters, ...persisted } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  const actions = useMemo(
    () => ({
      addTransaction: (tx) => dispatch({ type: 'addTransaction', tx: { id: `tx-${Date.now()}`, note: '', ...tx } }),
      deleteTransaction: (id) => dispatch({ type: 'deleteTransaction', id }),
      setFilters: (patch) => dispatch({ type: 'setFilters', patch }),
      saveGoal: (goal) => dispatch({ type: 'saveGoal', goal }),
      deleteGoal: (id) => dispatch({ type: 'deleteGoal', id }),
      contribute: (id, amount) => dispatch({ type: 'contribute', id, amount }),
      setActiveGoal: (id) => dispatch({ type: 'setActiveGoal', id }),
      updateSettings: (patch) => dispatch({ type: 'updateSettings', patch }),
      importData: (data) => dispatch({ type: 'importData', data }),
      savePlan: (plan) => dispatch({ type: 'savePlan', plan }),
      togglePlanItemPaid: (id, day) => dispatch({ type: 'togglePlanItemPaid', id, day }),
      reset: () => dispatch({ type: 'reset' }),
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

/** Current time, refreshed every minute so "Today"/"Yesterday" labels stay correct. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}
