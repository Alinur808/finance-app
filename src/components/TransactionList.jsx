import { getCategory } from '../data/categories.js';
import { getAccount } from '../data/accounts.js';
import { formatGroupLabel, formatTime } from '../utils/dates.js';
import { formatMoney, formatOriginal, formatTxAmount } from '../utils/format.js';
import { groupByDay } from '../utils/analytics.js';
import CategoryIcon from './CategoryIcon.jsx';

export function TransactionRow({ tx, onClick }) {
  const cat = getCategory(tx.categoryId);
  const income = tx.type === 'income';
  const meta = tx.original ? formatOriginal(tx.original) : tx.noTime ? '' : formatTime(tx.date);
  return (
    <button onClick={() => onClick?.(tx)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-gray-50">
      <CategoryIcon categoryId={tx.categoryId} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{cat.name}</p>
        <p className="truncate text-[13px] text-ink-muted">{tx.merchant || getAccount(tx.accountId).name}</p>
      </div>
      <div className="text-right">
        <p className={`tabular whitespace-nowrap text-[15px] font-bold ${income ? 'text-brand-600' : 'text-ink'}`}>{formatTxAmount(tx)}</p>
        {meta && <p className="tabular whitespace-nowrap text-[12px] text-ink-muted">{meta}</p>}
      </div>
    </button>
  );
}

/** История, сгруппированная по дням: «Вт, 10 ноября · Вчера» и итог дня. */
export default function TransactionList({ transactions, onSelect, now, limitDays }) {
  let groups = groupByDay(transactions);
  if (limitDays) groups = groups.slice(0, limitDays);
  return (
    <div className="space-y-5">
      {groups.map((g, i) => {
        const { label, hint } = formatGroupLabel(g.date, now);
        const net = g.income - g.expense;
        return (
          <section key={g.key} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-[13px] font-semibold text-ink-soft">
                {label}
                {hint && <span className="text-ink-muted"> · {hint}</span>}
              </h3>
              <span className="tabular text-[12px] font-medium text-ink-muted">{formatMoney(net, { sign: true })}</span>
            </div>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-card">
              {g.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} onClick={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
