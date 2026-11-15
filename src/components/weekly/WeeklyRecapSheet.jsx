import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { getCategory } from '../../data/categories.js';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { formatDayMonth } from '../../utils/dates.js';
import { formatPercent, plural } from '../../utils/format.js';
import { buildWeeklyRecap, recapWeekOffset } from '../../utils/weekly.js';
import BottomSheet from '../BottomSheet.jsx';
import CategoryIcon from '../CategoryIcon.jsx';
import { Segmented } from '../ui.jsx';

export const weekLabel = (r) => `${formatDayMonth(r.start)} – ${formatDayMonth(r.end)}`;

/** «Итоги недели»: доходы, расходы, сравнение с прошлой неделей, главная категория. */
export default function WeeklyRecapSheet({ open, onClose, now }) {
  const { transactions } = useFinance();
  const { money } = usePrivacy();
  const auto = recapWeekOffset(now);
  const [offset, setOffset] = useState(auto);
  const r = useMemo(() => buildWeeklyRecap(transactions, now, offset), [transactions, now, offset]);
  const m = (v, opts) => money(v, { decimals: false, ...opts });

  return (
    <BottomSheet open={open} onClose={onClose} title="Итоги недели" testId="weekly-recap">
      <Segmented
        size="sm"
        value={String(offset)}
        onChange={(v) => setOffset(Number(v))}
        items={[
          ['-1', 'Прошлая неделя'],
          ['0', 'Эта неделя'],
        ]}
      />
      <p className="mt-3 text-center text-[13px] text-ink-muted">{weekLabel(r)}</p>

      {!r.hasData ? (
        <p className="py-10 text-center text-[14px] text-ink-muted">За эту неделю операций нет.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-50 px-4 py-3">
              <p className="text-[13px] font-medium text-brand-800">Доходы</p>
              <p className="tabular truncate text-[20px] font-bold text-brand-700">{m(r.income, { sign: r.income > 0 })}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-[13px] font-medium text-ink-soft">Расходы</p>
              <p className="tabular truncate text-[20px] font-bold">{m(r.expense)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[14px]">
            {r.change == null ? (
              <p className="text-ink-muted">С прошлой неделей сравнить пока не с чем.</p>
            ) : (
              <p className={`flex items-center gap-1.5 font-semibold ${r.change > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                {r.change > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                Расходы {r.change > 0 ? 'выше' : 'ниже'} на {formatPercent(Math.abs(r.change))}, чем неделей раньше
              </p>
            )}
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {plural(r.count, ['трата', 'траты', 'трат'])} · {r.net >= 0 ? 'осталось' : 'ушло больше, чем пришло'} {m(Math.abs(r.net))}
            </p>
          </div>

          {r.top && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <CategoryIcon categoryId={r.top.categoryId} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-ink-muted">Больше всего ушло на</p>
                <p className="truncate text-[15px] font-semibold">{getCategory(r.top.categoryId).name}</p>
              </div>
              <div className="text-right">
                <p className="tabular text-[15px] font-semibold">{m(r.top.amount)}</p>
                <p className="tabular text-[12px] text-ink-muted">{formatPercent(r.top.share)}</p>
              </div>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  );
}
