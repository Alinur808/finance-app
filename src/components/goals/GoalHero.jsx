import { CalendarDays, Pencil, Plus } from 'lucide-react';
import { formatFullDate } from '../../utils/dates.js';
import { formatMoney, formatPercent } from '../../utils/format.js';
import ProgressRing from './ProgressRing.jsx';

export default function GoalHero({ goal, onContribute, onEdit }) {
  const progress = goal.target ? goal.saved / goal.target : 0;
  return (
    <div className="rounded-[28px] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-5 text-white shadow-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-white/70">
            {goal.emoji} Копим на
          </p>
          <h2 className="truncate text-xl font-bold">{goal.name}</h2>
        </div>
        <button onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 active:bg-white/20" aria-label="Изменить цель">
          <Pencil size={16} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <ProgressRing value={progress} size={112} stroke={11} color="#a6dfc4">
          <div className="text-center">
            <p className="tabular text-2xl font-extrabold">{formatPercent(progress)}</p>
            <p className="text-[11px] text-white/70">накоплено</p>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-[12px] text-white/65">Накоплено</p>
            <p className="tabular text-lg font-bold">{formatMoney(goal.saved)}</p>
          </div>
          <div>
            <p className="text-[12px] text-white/65">Цель</p>
            <p className="tabular text-lg font-bold">{formatMoney(goal.target)}</p>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] text-white/75">
            <CalendarDays size={13} /> до {formatFullDate(goal.deadline)}
          </p>
        </div>
      </div>

      <button
        onClick={onContribute}
        disabled={goal.saved >= goal.target}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-brand-800 transition active:scale-[0.98] disabled:opacity-60"
      >
        <Plus size={18} strokeWidth={2.6} /> {goal.saved >= goal.target ? 'Цель достигнута 🎉' : 'Пополнить'}
      </button>
    </div>
  );
}
