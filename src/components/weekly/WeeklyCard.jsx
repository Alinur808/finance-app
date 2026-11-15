import { useMemo, useState } from 'react';
import { CalendarRange, ChevronRight, ShieldAlert } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { amountToNumber, displayAmount, numberToRaw, sanitizeAmount } from '../../utils/amountInput.js';
import { plural } from '../../utils/format.js';
import { spentThisWeek, weeklyLimitState } from '../../utils/weekly.js';
import { Card } from '../ui.jsx';
import WeeklyRecapSheet from './WeeklyRecapSheet.jsx';

/**
 * Неделя в одной карточке: сколько потрачено с понедельника, «Недельный лимит трат»
 * (задаётся тут же) и вход в «Итоги недели».
 */
export default function WeeklyCard({ now }) {
  const { transactions, settings, updateSettings } = useFinance();
  const { money, text } = usePrivacy();
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const [recap, setRecap] = useState(false);
  const limit = useMemo(() => weeklyLimitState(transactions, settings.weeklyLimit, now), [transactions, settings.weeklyLimit, now]);
  const spent = useMemo(() => spentThisWeek(transactions, now), [transactions, now]);
  const m = (v) => money(v, { decimals: false });

  const save = (e) => {
    e.preventDefault();
    updateSettings({ weeklyLimit: Math.floor(amountToNumber(raw)) });
    setEditing(false);
  };

  return (
    <Card className="overflow-hidden" data-testid="weekly-card">
      {limit?.exhausted && (
        <p className="flex items-center gap-2 bg-red-600 px-4 py-2.5 text-[14px] font-bold text-white" role="alert" data-testid="weekly-limit-banner">
          <ShieldAlert size={17} /> Лимит недели исчерпан — траты остановлены
        </p>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <CalendarRange size={17} className="text-brand-600" />
          <h3 className="flex-1 text-[15px] font-semibold">Эта неделя</h3>
          <button onClick={() => setRecap(true)} className="flex items-center text-[13px] font-semibold text-brand-700" data-testid="open-weekly-recap">
            Итоги недели <ChevronRight size={15} />
          </button>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p className="text-[13px] text-ink-muted">Потрачено с понедельника</p>
          <p className="tabular text-[15px]">
            <span className="font-bold">{m(spent)}</span>
            {limit && <span className="text-ink-muted"> / {m(limit.limit)}</span>}
          </p>
        </div>
        {limit && (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${limit.used >= 1 ? 'bg-red-500' : limit.used > 0.8 ? 'bg-amber-400' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(100, limit.used * 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-[12px] ${limit.exhausted ? 'font-semibold text-red-600' : 'text-ink-muted'}`}>
              {limit.exhausted
                ? text(`Сверх лимита ${m(spent - limit.limit)}. Новые расходы — только с подтверждением.`)
                : text(`Осталось ${m(limit.left)} на ${plural(limit.daysLeft, ['день', 'дня', 'дней'])} · ≈ ${m(limit.left / limit.daysLeft)} в день`)}
            </p>
          </>
        )}

        {editing ? (
          <form onSubmit={save} className="mt-3 flex animate-rise-in items-center gap-2">
            <label htmlFor="weekly-limit" className="flex-1 text-[13px] font-medium text-ink-soft">
              Недельный лимит трат
            </label>
            <input
              id="weekly-limit"
              inputMode="numeric"
              autoFocus
              placeholder="0"
              value={displayAmount(raw)}
              onChange={(e) => setRaw(sanitizeAmount(e.target.value.split(',')[0]))}
              className="h-10 w-32 rounded-xl bg-gray-100 px-3 text-right text-base font-semibold outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="submit" className="pressable h-10 rounded-xl bg-ink px-3 text-sm font-semibold text-on-ink">
              OK
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setRaw(numberToRaw(settings.weeklyLimit));
              setEditing(true);
            }}
            className="mt-2 text-[13px] font-semibold text-brand-700"
            data-testid="edit-weekly-limit"
          >
            {limit ? 'Изменить недельный лимит' : 'Задать недельный лимит трат'}
          </button>
        )}
        {editing && settings.weeklyLimit > 0 && (
          <button
            onClick={() => {
              updateSettings({ weeklyLimit: 0 });
              setEditing(false);
            }}
            className="mt-2 block text-[12px] font-medium text-ink-muted"
          >
            Выключить лимит
          </button>
        )}
      </div>
      <WeeklyRecapSheet open={recap} onClose={() => setRecap(false)} now={now} />
    </Card>
  );
}
