import { ChevronRight, Flame } from 'lucide-react';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { formatPercent } from '../utils/format.js';
import CategoryIcon from './CategoryIcon.jsx';
import { Card } from './ui.jsx';

/** Compact "where did my money go" widget for the Overview. */
export default function TopSpending({ breakdown, total, onOpen, onPick }) {
  const top = breakdown.slice(0, 3);
  const { money } = usePrivacy();
  if (!top.length) return null;
  const leader = top[0];
  return (
    <Card className="p-4">
      <button onClick={onOpen} className="mb-3 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-50 text-orange-500">
            <Flame size={15} />
          </span>
          <h2 className="text-[15px] font-semibold">Больше всего трат</h2>
        </div>
        <span className="flex items-center text-sm font-semibold text-brand-600">
          Аналитика <ChevronRight size={16} />
        </span>
      </button>

      {/* stacked share bar — 2px white gaps separate segments */}
      <div className="mb-1 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-gray-100" role="img" aria-label="Доли расходов по категориям">
        {top.map((c) => (
          <div key={c.id} style={{ width: `${c.share * 100}%`, backgroundColor: c.category.color }} />
        ))}
      </div>
      <p className="mb-3 text-[12px] text-ink-muted">
        «{leader.category.name}» — {formatPercent(leader.share)} от {money(total)}
      </p>

      <div className="space-y-1">
        {top.map((c, i) => (
          <button key={c.id} onClick={() => onPick?.(c.id)} className="flex w-full items-center gap-3 rounded-2xl py-1.5 text-left active:bg-gray-50">
            <CategoryIcon categoryId={c.id} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  <span className="mr-1 text-ink-muted">{i + 1}.</span>
                  {c.category.name}
                </p>
                <p className="tabular shrink-0 text-sm font-semibold">{money(c.amount)}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${(c.amount / leader.amount) * 100}%`, backgroundColor: c.category.color }} />
                </div>
                <span className="tabular w-9 text-right text-[12px] font-medium text-ink-muted">{formatPercent(c.share)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
