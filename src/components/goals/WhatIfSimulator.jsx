import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { addDays, formatFullDate } from '../../utils/dates.js';
import { describeWeeks, weeksToSave } from '../../utils/advisor.js';
import { formatMoney } from '../../utils/format.js';
import CategoryIcon from '../CategoryIcon.jsx';
import { Card } from '../ui.jsx';

/** Расчётные суммы показываем без тиынов. */
const money = (v, opts = {}) => formatMoney(v, { decimals: false, ...opts });

/** Drag sliders to cut flexible categories and watch the goal date move. */
export default function WhatIfSimulator({ advice, goal }) {
  const cats = advice.discretionary.slice(0, 3);
  const [cuts, setCuts] = useState(() => Object.fromEntries(cats.map((c, i) => [c.id, i === 0 ? 50 : 0])));

  const extra = cats.reduce((s, c) => s + c.monthly * ((cuts[c.id] ?? 0) / 100), 0);
  const newSavings = advice.profile.savings + extra;
  const weeks = weeksToSave(advice.remaining, newSavings);
  const eta = Number.isFinite(weeks) ? addDays(new Date(), Math.ceil(weeks * 7)) : null;
  const gained = Number.isFinite(advice.baseWeeks) && Number.isFinite(weeks) ? advice.baseWeeks - weeks : null;
  const beatsDeadline = eta && eta <= new Date(goal.deadline);

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <SlidersHorizontal size={17} className="text-brand-600" />
        <h3 className="text-[15px] font-bold">Что, если тратить меньше?</h3>
      </div>
      <p className="mb-4 text-[12px] text-ink-muted">Двигайте ползунки — срок цели пересчитается</p>

      <div className="space-y-4">
        {cats.map((c) => (
          <div key={c.id}>
            <div className="mb-1.5 flex items-center gap-2.5">
              <CategoryIcon categoryId={c.id} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.category.name}</p>
                <p className="tabular text-[12px] text-ink-muted">
                  {money(c.monthly)}/мес → <span className="font-semibold text-ink-soft">{money(c.monthly * (1 - cuts[c.id] / 100))}</span>
                </p>
              </div>
              <span className="tabular w-12 text-right text-sm font-bold text-brand-700">−{cuts[c.id]}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={cuts[c.id]}
              onChange={(e) => setCuts((x) => ({ ...x, [c.id]: Number(e.target.value) }))}
              className="w-full"
              aria-label={`Сократить «${c.category.name}» на процент`}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50 p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-soft">Дополнительно</span>
          <span className="tabular font-bold text-brand-600">+{money(extra)}/мес</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-ink-soft">Цель будет достигнута</span>
          <span className="font-bold">{eta ? formatFullDate(eta) : 'Не при таком темпе'}</span>
        </div>
        {gained != null && gained >= 0.15 && (
          <p className="mt-2 text-[13px] font-semibold text-brand-700">
            На {describeWeeks(gained)} раньше{beatsDeadline ? ' — успеваете к сроку ✓' : ''}
          </p>
        )}
        {gained == null && eta && <p className="mt-2 text-[13px] font-semibold text-brand-700">Так цель становится достижимой{beatsDeadline ? ' и вы успеваете к сроку ✓' : ''}</p>}
      </div>
    </Card>
  );
}
