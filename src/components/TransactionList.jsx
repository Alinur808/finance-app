import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { getCategory } from '../data/categories.js';
import { formatGroupLabel, formatTime } from '../utils/dates.js';
import { formatMoney, formatOriginal, formatTxAmount } from '../utils/format.js';
import { groupByDay } from '../utils/analytics.js';
import CategoryIcon from './CategoryIcon.jsx';

const PAGE = 40;

export const TransactionRow = memo(function TransactionRow({ tx, accountName, onClick }) {
  const cat = getCategory(tx.categoryId);
  const income = tx.type === 'income';
  const meta = [tx.original ? formatOriginal(tx.original) : tx.noTime ? '' : formatTime(tx.date), tx.pending ? 'в обработке' : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <button onClick={() => onClick?.(tx)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50">
      <CategoryIcon categoryId={tx.categoryId} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{tx.merchant || cat.name}</p>
        <p className="truncate text-[13px] text-ink-muted">{tx.merchant ? cat.name : accountName}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`whitespace-nowrap text-[15px] font-bold ${income ? 'text-brand-600' : 'text-ink'}`}>{formatTxAmount(tx)}</p>
        {meta && <p className="whitespace-nowrap text-[12px] text-ink-muted">{meta}</p>}
      </div>
    </button>
  );
});

/**
 * История по дням: «Вт, 10 ноября · Вчера» и итог дня.
 * Показываем первые 40 операций; следующие 40 подгружаются, когда пользователь
 * доскролливает до конца (IntersectionObserver), — длинные выписки не тормозят.
 */
export default function TransactionList({ transactions, onSelect, now, accountName }) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef(null);

  // новый набор операций (фильтр, импорт) — снова с первых 40
  useEffect(() => setLimit(PAGE), [transactions]);

  const groups = useMemo(() => groupByDay(transactions.slice(0, limit)), [transactions, limit]);
  // итоги дня считаем по всем операциям дня, а не только по показанным
  const dayTotals = useMemo(() => {
    const map = new Map();
    for (const g of groupByDay(transactions)) map.set(g.key, g.income - g.expense);
    return map;
  }, [transactions]);
  const hasMore = limit < transactions.length;

  useEffect(() => {
    if (!hasMore || !sentinel.current) return undefined;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setLimit((l) => l + PAGE), { rootMargin: '600px 0px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [hasMore, limit]);

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const { label, hint } = formatGroupLabel(g.date, now);
        return (
          <section key={g.key} className="cv-auto">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-[13px] font-semibold text-ink-soft">
                {label}
                {hint && <span className="text-ink-muted"> · {hint}</span>}
              </h3>
              <span className="text-[12px] font-medium text-ink-muted">{formatMoney(dayTotals.get(g.key) ?? 0, { sign: true })}</span>
            </div>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/[0.03]">
              {g.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} accountName={accountName} onClick={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-2">
          <button onClick={() => setLimit((l) => l + PAGE)} className="pressable h-11 rounded-full bg-white px-5 text-sm font-semibold text-brand-700 shadow-card">
            Показать ещё · {transactions.length - limit}
          </button>
        </div>
      )}
    </div>
  );
}
