import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, PieChart } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { OTHER_COLOR } from '../data/categories.js';
import { filterTransactions, inRange, spendingByCategory, spendingSeries, totals } from '../utils/analytics.js';
import { formatShortDate, getPeriodRange, PERIODS, startOfDay } from '../utils/dates.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import CategoryIcon from '../components/CategoryIcon.jsx';
import DonutChart from '../components/DonutChart.jsx';
import FilterChips from '../components/FilterChips.jsx';
import SpendingBars from '../components/SpendingBars.jsx';
import { Card, EmptyState, ScreenHeader } from '../components/ui.jsx';

const MAX_SLICES = 6;
const FIXED_COSTS = new Set(['transfers', 'fees', 'fx']);

export default function Analytics({ now, onPickCategory }) {
  const { transactions, filters, settings } = useFinance();
  const [activeId, setActiveId] = useState(null);
  const [variableOnly, setVariableOnly] = useState(true);
  const scoped = { ...filters, categoryId: null }; // analytics always shows every category

  const filtered = useMemo(() => filterTransactions(transactions, scoped, now), [transactions, filters.period, filters.accountId, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = getPeriodRange(filters.period, now);
  const previous = useMemo(
    () => transactions.filter((t) => inRange(t, range.prevStart, range.prevEnd) && (filters.accountId === 'all' || t.accountId === filters.accountId)),
    [transactions, filters.period, filters.accountId, now], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const t = useMemo(() => totals(filtered), [filtered]);
  const prev = useMemo(() => totals(previous), [previous]);
  // курсовые разницы — копейки, на диаграмме они только мешают
  const breakdown = useMemo(() => spendingByCategory(filtered.filter((x) => x.categoryId !== 'fx')), [filtered]);
  const breakdownTotal = breakdown.reduce((s, c) => s + c.amount, 0);
  // сравниваем, только если прошлый период целиком покрыт данными (выписка начинается 12 октября)
  // список отсортирован от новых к старым — самая ранняя операция последняя
  const earliest = transactions.length ? new Date(transactions[transactions.length - 1].date).getTime() : Infinity;
  const prevCovered = startOfDay(earliest).getTime() <= range.prevStart.getTime();
  const change = prevCovered && prev.expense > 0 ? (t.expense - prev.expense) / prev.expense : null;

  // first real transaction bounds "All time"/"3 months" so the chart starts at data
  const firstTx = filtered.length ? new Date(filtered[filtered.length - 1].date) : range.start;
  const seriesStart = filters.period === 'all' || filters.period === '30days' ? (firstTx > range.start ? firstTx : range.start) : range.start;
  const buckets = useMemo(
    () => spendingSeries(variableOnly ? filtered.filter((x) => !FIXED_COSTS.has(x.categoryId)) : filtered, seriesStart, range.end),
    [filtered, variableOnly, seriesStart.getTime(), range.end.getTime()], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const peak = buckets.reduce((m, b) => (b.amount > (m?.amount ?? 0) ? b : m), null);
  const seriesTotal = buckets.reduce((sum, b) => sum + b.amount, 0);
  const elapsedDays = Math.floor((startOfDay(Math.min(range.end, now)) - startOfDay(seriesStart)) / 86400000) + 1;
  const avgPerDay = seriesTotal / Math.max(1, elapsedDays);

  // donut: top categories, rest folded into "Other" so colors never repeat
  const head = breakdown.slice(0, MAX_SLICES);
  const tail = breakdown.slice(MAX_SLICES);
  const slices = head.map((c) => ({ id: c.id, label: c.category.name, value: c.amount, color: c.category.color }));
  if (tail.length) slices.push({ id: 'other', label: 'Другое', value: tail.reduce((s, c) => s + c.amount, 0), color: OTHER_COLOR });

  const periodLabel = PERIODS.find((p) => p.id === filters.period)?.label;
  const isMonth = filters.period === 'month';
  const budgetUsed = settings.monthlyBudget ? t.expense / settings.monthlyBudget : 0;

  return (
    <div className="pb-4">
      <ScreenHeader title="Аналитика" subtitle={periodLabel} />
      <div className="space-y-5 px-5">
        <FilterChips showCategory={false} />

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-[13px] font-medium text-ink-muted">Потрачено</p>
            <p className="tabular mt-1 text-[22px] font-extrabold tracking-tight">{formatMoney(t.expense, { compact: t.expense >= 1e6 })}</p>
            {change != null ? (
              <p className={`mt-1 flex items-center gap-0.5 text-[12px] font-semibold ${change > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                {change > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                на {formatPercent(Math.abs(change))} {change > 0 ? 'больше' : 'меньше'}, чем раньше
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-ink-muted">Нет данных для сравнения</p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-[13px] font-medium text-ink-muted">Осталось</p>
            <p className={`tabular mt-1 text-[22px] font-extrabold tracking-tight ${t.net >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
              {formatMoney(t.net, { sign: true, compact: Math.abs(t.net) >= 1e6 })}
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {t.income > 0 ? `${formatPercent(Math.max(0, t.net / t.income))} от доходов` : 'Доходов пока нет'}
            </p>
          </Card>
        </div>

        {isMonth && settings.monthlyBudget > 0 && (
          <Card className="p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">Бюджет на месяц</p>
              <p className="tabular text-sm text-ink-muted">
                <span className="font-bold text-ink">{formatMoney(t.expense)}</span> / {formatMoney(settings.monthlyBudget)}
              </p>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${budgetUsed > 1 ? 'bg-red-500' : budgetUsed > 0.85 ? 'bg-amber-400' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(100, budgetUsed * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">
              {budgetUsed > 1
                ? `Бюджет превышен на ${formatMoney(t.expense - settings.monthlyBudget)}`
                : `Осталось ${formatMoney(settings.monthlyBudget - t.expense)} · использовано ${formatPercent(budgetUsed)}`}
            </p>
          </Card>
        )}

        {breakdown.length === 0 ? (
          <Card>
            <EmptyState icon={PieChart} title="Расходов за период нет" text="Выберите другой период, чтобы увидеть, куда уходят деньги." />
          </Card>
        ) : (
          <>
            <Card className="p-5">
              <h2 className="text-[15px] font-bold">Куда уходят деньги</h2>
              <p className="mb-4 text-[12px] text-ink-muted">Нажмите на сектор или строку, чтобы выделить</p>
              <DonutChart data={slices} total={breakdownTotal} activeId={activeId} onActive={setActiveId} />

              <ol className="mt-5 space-y-1">
                {breakdown.map((c, i) => {
                  const folded = i >= MAX_SLICES;
                  const focus = activeId === c.id || (folded && activeId === 'other');
                  return (
                    <li key={c.id}>
                      <div
                        onPointerEnter={(e) => e.pointerType === 'mouse' && setActiveId(folded ? 'other' : c.id)}
                        onPointerLeave={(e) => e.pointerType === 'mouse' && setActiveId(null)}
                        className={`flex items-center gap-3 rounded-2xl p-2 transition ${focus ? 'bg-gray-50' : ''}`}
                      >
                        <CategoryIcon categoryId={c.id} size={40} />
                        <button className="min-w-0 flex-1 text-left" onClick={() => onPickCategory(c.id)}>
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight">{c.category.name}</p>
                            <p className="tabular shrink-0 text-sm font-bold">{formatMoney(c.amount)}</p>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full" style={{ width: `${(c.amount / breakdown[0].amount) * 100}%`, backgroundColor: folded ? OTHER_COLOR : c.category.color }} />
                            </div>
                            <span className="tabular w-24 text-right text-[12px] text-ink-muted">
                              {formatPercent(c.share)} · {c.count} опер.
                            </span>
                          </div>
                        </button>
                        <ChevronRight size={16} className="shrink-0 text-gray-300" />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {filters.period !== 'today' && (
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-bold">Расходы по {buckets[0]?.weekly ? 'неделям' : 'дням'}</h2>
                  <button
                    onClick={() => setVariableOnly((v) => !v)}
                    aria-pressed={variableOnly}
                    className={`h-7 shrink-0 rounded-full px-3 text-[12px] font-semibold transition ${variableOnly ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}
                  >
                    {variableOnly ? 'Без переводов' : 'Все расходы'}
                  </button>
                </div>
                <p className="mb-6 text-[12px] text-ink-muted">
                  ~{formatMoney(avgPerDay, { decimals: false })} в день
                  {peak && ` · пик: ${buckets[0].weekly ? 'неделя с ' : ''}${formatShortDate(peak.start)}`}
                </p>
                <SpendingBars buckets={buckets} now={now} />
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
