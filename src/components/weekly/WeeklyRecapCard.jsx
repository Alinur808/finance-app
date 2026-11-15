import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarCheck2, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { getCategory } from '../../data/categories.js';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { readJSON, writeJSON } from '../../utils/storage.js';
import { formatPercent } from '../../utils/format.js';
import { buildWeeklyRecap, isRecapDay, weekKey } from '../../utils/weekly.js';
import WeeklyRecapSheet, { weekLabel } from './WeeklyRecapSheet.jsx';

const SEEN_KEY = 'tenge-finance.weekly-recap-dismissed';

/**
 * Карточка «Итоги недели» на главном экране — сама появляется в воскресенье и
 * понедельник, закрывается крестиком до следующей недели. В любой день итоги
 * доступны из «Планы → Эта неделя».
 */
export default function WeeklyRecapCard({ now }) {
  const { transactions } = useFinance();
  const { money } = usePrivacy();
  const [dismissed, setDismissed] = useState(() => readJSON(SEEN_KEY, null));
  const [open, setOpen] = useState(false);
  const recap = useMemo(() => buildWeeklyRecap(transactions, now), [transactions, now]);
  const key = weekKey(recap.start);
  if (!isRecapDay(now) || !recap.hasData || dismissed === key) return null;
  const m = (v) => money(v, { decimals: false });

  return (
    <>
      <div className="relative rounded-3xl bg-surface p-4 shadow-card" data-testid="weekly-recap-card">
        <button
          onClick={() => {
            writeJSON(SEEN_KEY, key);
            setDismissed(key);
          }}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-ink-muted"
          aria-label="Скрыть итоги недели"
        >
          <X size={15} />
        </button>
        <button onClick={() => setOpen(true)} className="block w-full pr-8 text-left">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <CalendarCheck2 size={17} className="text-brand-600" /> Итоги недели
            <span className="text-[12px] font-normal text-ink-muted">{weekLabel(recap)}</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
            <p>
              <span className="block text-ink-muted">Доходы</span>
              <span className="tabular font-semibold text-brand-600">{m(recap.income)}</span>
            </p>
            <p>
              <span className="block text-ink-muted">Расходы</span>
              <span className="tabular font-semibold">{m(recap.expense)}</span>
            </p>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-muted">
            {recap.change != null && (
              <span className={`flex items-center font-semibold ${recap.change > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                {recap.change > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {formatPercent(Math.abs(recap.change))} к прошлой неделе
              </span>
            )}
            {recap.top && <span>· больше всего — {getCategory(recap.top.categoryId).name.toLowerCase()}</span>}
          </p>
        </button>
      </div>
      <WeeklyRecapSheet open={open} onClose={() => setOpen(false)} now={now} />
    </>
  );
}
