import { useState } from 'react';
import { ChevronDown, ChevronRight, Flame } from 'lucide-react';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { formatShare } from '../utils/format.js';
import CategoryIcon from './CategoryIcon.jsx';
import { Card } from './ui.jsx';

const TOP = 3;

/**
 * «Больше всего трат» на главном экране: доля в процентах у КАЖДОЙ категории.
 * Три главные — крупно, остальные — по кнопке «Все категории» компактным списком.
 * Суммы скрываются в Stealth Mode, проценты и полоса долей остаются.
 */
export default function TopSpending({ breakdown, total, onOpen, onPick }) {
  const [all, setAll] = useState(false);
  const { money } = usePrivacy();
  if (!breakdown.length) return null;
  const top = breakdown.slice(0, TOP);
  const rest = breakdown.slice(TOP);
  const leader = top[0];
  return (
    <Card className="p-4" data-testid="top-spending">
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

      {/* полоса долей всех категорий — 2px зазоры разделяют сегменты */}
      <div className="mb-1 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-gray-100" role="img" aria-label="Доли расходов по категориям">
        {breakdown.map((c) => (
          <div key={c.id} style={{ width: `${c.share * 100}%`, backgroundColor: c.category.color }} />
        ))}
      </div>
      <p className="mb-3 text-[12px] text-ink-muted">
        «{leader.category.name}» — {formatShare(leader.share)} от {money(total)}
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
                <span className="tabular w-11 text-right text-[12px] font-medium text-ink-muted" data-testid="category-share">
                  {formatShare(c.share)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {rest.length > 0 && (
        <>
          {all && (
            <ul className="mt-1 animate-rise-in divide-y divide-hairline border-t border-hairline">
              {rest.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onPick?.(c.id)} className="flex w-full items-center gap-2.5 py-2 text-left active:bg-gray-50">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.category.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{c.category.name}</span>
                    <span className="tabular w-12 text-right text-[12px] font-semibold text-ink-muted" data-testid="category-share">
                      {formatShare(c.share)}
                    </span>
                    <span className="tabular w-24 truncate text-right text-[13px] font-semibold">{money(c.amount, { decimals: false })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setAll((v) => !v)} className="mt-2 flex w-full items-center justify-center gap-1 py-1.5 text-[13px] font-semibold text-brand-700" aria-expanded={all}>
            {all ? 'Свернуть' : `Все категории · ещё ${rest.length}`}
            <ChevronDown size={15} className={`transition-transform ${all ? 'rotate-180' : ''}`} />
          </button>
        </>
      )}
    </Card>
  );
}
