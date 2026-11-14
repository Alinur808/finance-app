import { CalendarDays, Pencil, Plus } from 'lucide-react';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { formatFullDate } from '../../utils/dates.js';
import { formatPercent } from '../../utils/format.js';
import FitText from '../FitText.jsx';
import ProgressRing from './ProgressRing.jsx';

export default function GoalHero({ goal, onContribute, onEdit }) {
  const { money } = usePrivacy();
  const progress = goal.target ? goal.saved / goal.target : 0;
  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 shadow-card"
      style={{ background: 'var(--card-bg)', color: 'rgb(var(--card-ink))', boxShadow: 'inset 0 0 0 1px var(--card-edge)' }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm opacity-60">{goal.emoji} Копим на</p>
          <h2 className="truncate text-xl font-semibold tracking-tight">{goal.name}</h2>
        </div>
        <button
          onClick={onEdit}
          className="grid h-9 w-9 place-items-center rounded-full active:opacity-70"
          style={{ background: 'var(--card-sheen)', boxShadow: 'inset 0 0 0 1px var(--card-edge)' }}
          aria-label="Изменить цель"
        >
          <Pencil size={16} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <ProgressRing value={progress} size={112} stroke={10} color="rgb(var(--brand-500))" track="rgba(127,127,127,0.18)">
          <div className="text-center">
            <p className="tabular text-2xl font-semibold">{formatPercent(progress)}</p>
            <p className="text-[11px] opacity-60">накоплено</p>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-[12px] opacity-60">Накоплено</p>
            <FitText max={18} min={12} className="font-semibold">
              {money(goal.saved)}
            </FitText>
          </div>
          <div>
            <p className="text-[12px] opacity-60">Цель</p>
            <FitText max={18} min={12} className="font-semibold">
              {money(goal.target)}
            </FitText>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] opacity-70">
            <CalendarDays size={13} /> до {formatFullDate(goal.deadline)}
          </p>
        </div>
      </div>

      <button
        onClick={onContribute}
        disabled={goal.saved >= goal.target}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink font-semibold text-on-ink transition active:scale-[0.98] disabled:opacity-60"
      >
        <Plus size={18} strokeWidth={2.6} /> {goal.saved >= goal.target ? 'Цель достигнута 🎉' : 'Пополнить'}
      </button>
    </div>
  );
}
