import { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { ACCOUNTS } from '../data/accounts.js';
import { useAccounts } from '../hooks/useAccounts.js';
import { accountBalances, filterTransactions, spendingByCategory, totals } from '../utils/analytics.js';
import { buildPlanForecast } from '../utils/plan.js';
import { formatMoney, plural } from '../utils/format.js';
import BalanceCard from '../components/BalanceCard.jsx';
import Onboarding from '../components/Onboarding.jsx';
import DiarySummary from '../components/diary/DiarySummary.jsx';
import FilterChips from '../components/FilterChips.jsx';
import TopSpending from '../components/TopSpending.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { EmptyState, SectionHeader } from '../components/ui.jsx';

const TX_WORDS = ['операция', 'операции', 'операций'];

export default function Overview({ now, onSelectTx, onNavigate, toast }) {
  const { transactions, filters, setFilters, settings, plan } = useFinance();
  const { getAccount } = useAccounts();
  const [showFx, setShowFx] = useState(false);

  const filtered = useMemo(() => filterTransactions(transactions, filters, now), [transactions, filters, now]);
  const { income, expense } = useMemo(() => totals(filtered), [filtered]);
  const breakdown = useMemo(() => spendingByCategory(filtered).filter((c) => c.id !== 'fx'), [filtered]);
  const balances = useMemo(() => accountBalances(transactions, ACCOUNTS, settings.openings), [transactions, settings.openings]);
  const total = useMemo(() => Object.values(balances).reduce((a, b) => a + b, 0), [balances]);

  // Курсовые разницы (копейки) скрыты по умолчанию, чтобы не засорять ленту.
  const fxCount = useMemo(() => filtered.filter((t) => t.categoryId === 'fx').length, [filtered]);
  const visible = useMemo(
    () => (!showFx && filters.categoryId !== 'fx' ? filtered.filter((t) => t.categoryId !== 'fx') : filtered),
    [filtered, showFx, filters.categoryId],
  );

  // Строка дневника — только если план заполнен
  const hasPlan = plan.items.length > 0 || plan.incomes.length > 0;
  const forecast = useMemo(() => (hasPlan ? buildPlanForecast({ plan, balance: total, transactions, now }) : null), [hasPlan, plan, total, transactions, now]);

  // Первый запуск: ни операций, ни ручного старта — показываем выбор, а не пустые графики.
  if (!settings.onboarded && transactions.length === 0) return <Onboarding toast={toast} />;

  // Карта показывает выбранный счёт; при «Все счета» — основную карту.
  const card = getAccount(filters.accountId === 'all' ? 'kaspi' : filters.accountId);

  return (
    <div>
      <BalanceCard
        balance={balances[card.id]}
        income={income}
        expense={expense}
        accountName={card.name}
        accountKind={card.kind}
        onOpenProfile={() => onNavigate('profile')}
      />

      <div className="space-y-5 px-5 pt-5">
        {filters.accountId === 'all' && Math.abs(total - balances[card.id]) >= 0.01 && (
          <p className="-mt-2 px-1 text-[13px] text-ink-muted">
            Всего на счетах: <span className="font-semibold text-ink-soft">{settings.hideBalance ? '••••' : formatMoney(total)}</span>
          </p>
        )}

        {forecast && !forecast.isOver && <DiarySummary forecast={forecast} hidden={settings.hideBalance} onOpen={() => onNavigate('goals', 'diary')} />}

        <FilterChips />

        {!filters.categoryId && breakdown.length > 0 && (
          <TopSpending breakdown={breakdown} total={breakdown.reduce((s, c) => s + c.amount, 0)} onOpen={() => onNavigate('analytics')} onPick={(id) => setFilters({ categoryId: id })} />
        )}

        <section>
          <SectionHeader title="История" action={visible.length ? plural(visible.length, TX_WORDS) : null} />
          {visible.length ? (
            <TransactionList transactions={visible} onSelect={onSelectTx} now={now} accountName={card.name} />
          ) : (
            <EmptyState
              icon={Receipt}
              title={transactions.length ? 'Ничего не найдено' : 'Пока нет операций'}
              text={transactions.length ? 'По этим фильтрам операций нет. Выберите другой период.' : 'Нажмите «+» внизу, чтобы добавить первый доход или расход.'}
            />
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
