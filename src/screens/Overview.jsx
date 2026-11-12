import { useMemo, useState } from 'react';
import { ChevronRight, Receipt, Sparkles } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { ACCOUNTS, getAccount } from '../data/accounts.js';
import { accountBalances, filterTransactions, spendingByCategory, totals } from '../utils/analytics.js';
import { buildAdvice } from '../utils/advisor.js';
import { formatMoney, plural } from '../utils/format.js';
import BalanceCard from '../components/BalanceCard.jsx';
import EmptyDashboard from '../components/EmptyDashboard.jsx';
import FinancialDiary from '../components/diary/FinancialDiary.jsx';
import FilterChips from '../components/FilterChips.jsx';
import TopSpending from '../components/TopSpending.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { EmptyState, SectionHeader } from '../components/ui.jsx';

const PAGE_DAYS = 10;
const TX_WORDS = ['операция', 'операции', 'операций'];

export default function Overview({ now, onSelectTx, onNavigate, onAdd, toast }) {
  const { transactions, filters, setFilters, goals, activeGoalId, settings } = useFinance();
  const [days, setDays] = useState(PAGE_DAYS);
  const [showFx, setShowFx] = useState(false);

  const filtered = useMemo(() => filterTransactions(transactions, filters, now), [transactions, filters, now]);
  const { income, expense } = useMemo(() => totals(filtered), [filtered]);
  const breakdown = useMemo(() => spendingByCategory(filtered).filter((c) => c.id !== 'fx'), [filtered]);
  const balances = useMemo(() => accountBalances(transactions, ACCOUNTS, settings.openings), [transactions, settings.openings]);

  // Карта показывает выбранный счёт; при «Все счета» — Kaspi Gold.
  const card = getAccount(filters.accountId === 'all' ? 'kaspi' : filters.accountId);
  const total = Object.values(balances).reduce((a, b) => a + b, 0);

  // Курсовые разницы (копейки) скрыты по умолчанию, чтобы не засорять ленту.
  const fxHidden = !showFx && filters.categoryId !== 'fx';
  const fxCount = filtered.filter((t) => t.categoryId === 'fx').length;
  const visible = fxHidden ? filtered.filter((t) => t.categoryId !== 'fx') : filtered;

  const goal = goals.find((g) => g.id === activeGoalId);
  const tip = useMemo(() => (goal ? buildAdvice(transactions, goal, now).tips[0] : null), [transactions, goal, now]);
  const dayCount = useMemo(() => new Set(visible.map((t) => t.date.slice(0, 10))).size, [visible]);

  // Нет ни одной операции — показываем экран импорта вместо пустых виджетов.
  // (Проверяем именно операции: баланс 0,00 бывает и при реальных данных.)
  if (transactions.length === 0) {
    return <EmptyDashboard name={settings.name} onAdd={onAdd} toast={toast} />;
  }

  return (
    <div>
      <BalanceCard balance={balances[card.id]} income={income} expense={expense} accountName={card.name} accountKind={card.kind} />

      <div className="space-y-6 px-5 pt-5">
        {filters.accountId === 'all' && Math.abs(total - balances[card.id]) >= 0.01 && (
          <p className="-mt-2 px-1 text-[13px] text-ink-muted">
            Всего на счетах: <span className="tabular font-semibold text-ink-soft">{formatMoney(total)}</span>
          </p>
        )}
        <FinancialDiary now={now} toast={toast} />

        <FilterChips />

        {!filters.categoryId && breakdown.length > 0 && (
          <TopSpending breakdown={breakdown} total={expense} onOpen={() => onNavigate('analytics')} onPick={(id) => setFilters({ categoryId: id })} />
        )}

        {tip && (
          <button
            onClick={() => onNavigate('goals')}
            className="flex w-full items-start gap-3 rounded-3xl bg-gradient-to-br from-brand-50 to-white p-4 text-left shadow-card ring-1 ring-brand-100 active:scale-[0.99]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
              <Sparkles size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold uppercase tracking-wider text-brand-700">Советник · {goal.name}</span>
              <span className="mt-0.5 line-clamp-3 block text-sm leading-snug text-ink-soft">{tip.text}</span>
            </span>
            <ChevronRight size={18} className="mt-2 shrink-0 text-ink-muted" />
          </button>
        )}

        <section>
          <SectionHeader title="История операций" action={visible.length ? plural(visible.length, TX_WORDS) : null} />
          {visible.length ? (
            <>
              <TransactionList transactions={visible} onSelect={onSelectTx} now={now} limitDays={days} />
              {dayCount > days && (
                <button onClick={() => setDays((d) => d + PAGE_DAYS)} className="mt-4 h-12 w-full rounded-2xl bg-white font-semibold text-brand-700 shadow-card active:bg-gray-50">
                  Показать ещё
                </button>
              )}
            </>
          ) : (
            <EmptyState icon={Receipt} title="Операций нет" text="По этим фильтрам ничего не найдено. Выберите другой период или нажмите «+», чтобы добавить операцию." />
          )}
          {fxCount > 0 && filters.categoryId !== 'fx' && (
            <button onClick={() => setShowFx((v) => !v)} className="mt-3 w-full py-2 text-center text-[13px] font-medium text-ink-muted active:text-ink-soft">
              {showFx ? 'Скрыть курсовые разницы' : `Показать курсовые разницы (${fxCount})`}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
