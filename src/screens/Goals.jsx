import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { buildAdvice } from '../utils/advisor.js';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import AdvisorPanel from '../components/goals/AdvisorPanel.jsx';
import ContributeSheet from '../components/goals/ContributeSheet.jsx';
import GoalFormSheet from '../components/goals/GoalFormSheet.jsx';
import GoalHero from '../components/goals/GoalHero.jsx';
import WealthTelemetry from '../components/goals/WealthTelemetry.jsx';
import FinancialDiary from '../components/diary/FinancialDiary.jsx';
import { ScreenHeader, Segmented } from '../components/ui.jsx';

const TEMPLATES = [
  { emoji: '🛟', name: 'Подушка безопасности', target: 300000, hint: '3 месяца спокойствия' },
  { emoji: '✈️', name: 'Отпуск', target: 500000, hint: 'Билеты и отель' },
  { emoji: '💻', name: 'Крупная покупка', target: 400000, hint: 'Техника, мебель' },
];

/** Цели (накопления + советник) и Финансовый дневник (план трат до даты). */
export default function Goals({ now, toast, section = 'goals', onSection }) {
  const { goals, activeGoalId, setActiveGoal, saveGoal, deleteGoal, contribute, transactions } = useFinance();
  const [form, setForm] = useState(null); // null | { goal } | { template }
  const [contributing, setContributing] = useState(false);
  const goal = goals.find((g) => g.id === activeGoalId) ?? goals[0];
  const advice = useMemo(() => (goal ? buildAdvice(transactions, goal, now) : null), [transactions, goal, now]);
  const { money } = usePrivacy();

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Планы"
        right={
          section === 'goals' && goals.length > 0 ? (
            <button onClick={() => setForm({})} className="pressable flex h-10 shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-on-ink">
              <Plus size={16} strokeWidth={2.6} /> Цель
            </button>
          ) : null
        }
      />
      <Segmented
        className="mx-5"
        value={section}
        onChange={onSection}
        items={[
          ['goals', 'Цели'],
          ['diary', 'Дневник'],
        ]}
      />

      <div className="mt-5 space-y-5 px-5">
        {section === 'goals' && <WealthTelemetry now={now} />}
        {section === 'diary' ? (
          <FinancialDiary now={now} toast={toast} />
        ) : !goal ? (
          <div className="space-y-3">
            <div className="rounded-3xl bg-surface p-5 shadow-card">
              <p className="text-[17px] font-semibold">На что копим?</p>
              <p className="mt-1 text-sm leading-snug text-ink-muted">Поставьте цель — стратег сравнит её с вашими тратами и покажет самый быстрый путь.</p>
            </div>
            {TEMPLATES.map((t) => (
              <button key={t.name} onClick={() => setForm({ template: t })} className="pressable flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-card">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gray-50 text-2xl">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-[13px] text-ink-muted">{t.hint}</span>
                </span>
                <span className="tabular text-sm font-semibold text-ink-soft">{formatMoney(t.target, { compact: true })}</span>
              </button>
            ))}
            <button onClick={() => setForm({})} className="pressable h-12 w-full rounded-2xl text-[15px] font-semibold text-brand-700">
              Своя цель
            </button>
          </div>
        ) : (
          <>
            {goals.length > 1 && (
              <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 py-1">
                {goals.map((g) => {
                  const on = g.id === goal.id;
                  const pct = g.saved / g.target;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveGoal(g.id)}
                      className={`pressable w-40 shrink-0 rounded-2xl p-3 text-left ${on ? 'bg-surface shadow-card ring-2 ring-brand-500' : 'bg-surface/60 shadow-card'}`}
                    >
                      <p className="truncate text-sm font-semibold">
                        {g.emoji} {g.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {money(g.saved, { compact: true })} из {money(g.target, { compact: true })}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: formatPercent(Math.min(1, pct)) }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <GoalHero goal={goal} onContribute={() => setContributing(true)} onEdit={() => setForm({ goal })} />
            {advice && <AdvisorPanel advice={advice} goal={goal} />}
          </>
        )}
      </div>

      <GoalFormSheet
        open={!!form}
        goal={form?.goal ?? null}
        template={form?.template ?? null}
        onClose={() => setForm(null)}
        onSave={(g) => {
          saveGoal(g);
          toast(form?.goal ? 'Цель обновлена' : 'Цель создана');
          setForm(null);
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
          toast(`${formatMoney(amount)} отложено на «${goal.name}»`); // App маскирует суммы в Stealth Mode
        }}
      />
    </div>
  );
}
