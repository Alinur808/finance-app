import { useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { buildAdvice } from '../utils/advisor.js';
import { formatMoney, formatPercent, plural } from '../utils/format.js';
import AdvisorPanel from '../components/goals/AdvisorPanel.jsx';
import ContributeSheet from '../components/goals/ContributeSheet.jsx';
import GoalFormSheet from '../components/goals/GoalFormSheet.jsx';
import GoalHero from '../components/goals/GoalHero.jsx';
import { EmptyState, PrimaryButton, ScreenHeader } from '../components/ui.jsx';

export default function Goals({ now, toast }) {
  const { goals, activeGoalId, setActiveGoal, saveGoal, deleteGoal, contribute, transactions } = useFinance();
  const [form, setForm] = useState(null); // null | 'new' | goal
  const [contributing, setContributing] = useState(false);
  const goal = goals.find((g) => g.id === activeGoalId) ?? goals[0];
  const advice = useMemo(() => (goal ? buildAdvice(transactions, goal, now) : null), [transactions, goal, now]);

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Цели"
        subtitle={plural(goals.length, ['цель', 'цели', 'целей'])}
        right={
          <button onClick={() => setForm('new')} className="flex h-10 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-white active:scale-95">
            <Plus size={16} strokeWidth={2.6} /> Новая
          </button>
        }
      />

      {!goal ? (
        <div className="px-5">
          <EmptyState icon={Target} title="Целей пока нет" text="Поставьте цель, например «Накопить 500 000 ₸», и Советник подскажет, как к ней прийти." />
          <PrimaryButton onClick={() => setForm('new')}>Создать первую цель</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-5 px-5">
          {goals.length > 1 && (
            <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 py-1">
              {goals.map((g) => {
                const on = g.id === goal.id;
                const pct = g.saved / g.target;
                return (
                  <button
                    key={g.id}
                    onClick={() => setActiveGoal(g.id)}
                    className={`w-40 shrink-0 rounded-2xl p-3 text-left transition active:scale-[0.97] ${on ? 'bg-white shadow-card ring-2 ring-brand-500' : 'bg-white/70 shadow-card'}`}
                  >
                    <p className="truncate text-sm font-semibold">
                      {g.emoji} {g.name}
                    </p>
                    <p className="tabular mt-0.5 text-[12px] text-ink-muted">
                      {formatMoney(g.saved, { compact: true })} из {formatMoney(g.target, { compact: true })}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: formatPercent(Math.min(1, pct)) }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <GoalHero goal={goal} onContribute={() => setContributing(true)} onEdit={() => setForm(goal)} />
          {advice && <AdvisorPanel advice={advice} goal={goal} />}
        </div>
      )}

      <GoalFormSheet
        open={!!form}
        goal={form === 'new' ? null : form}
        onClose={() => setForm(null)}
        onSave={(g) => {
          saveGoal(g);
          setForm(null);
          toast(form === 'new' ? 'Цель создана' : 'Цель обновлена');
        }}
        onDelete={(id) => {
          deleteGoal(id);
          setForm(null);
          toast('Цель удалена');
        }}
      />
      <ContributeSheet
        open={contributing}
        goal={goal}
        onClose={() => setContributing(false)}
        onConfirm={(amount) => {
          contribute(goal.id, amount);
          setContributing(false);
          toast(`${formatMoney(amount)} отложено на «${goal.name}»`);
        }}
      />
    </div>
  );
}
