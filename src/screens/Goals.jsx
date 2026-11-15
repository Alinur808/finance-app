import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { ACCOUNTS } from '../data/accounts.js';
import { buildAdvice } from '../utils/advisor.js';
import { accountBalances } from '../utils/analytics.js';
import { buildSafeToSpend } from '../utils/pace.js';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import AdvisorPanel from '../components/goals/AdvisorPanel.jsx';
import CapitalCurrencies from '../components/goals/CapitalCurrencies.jsx';
import ContributeSheet from '../components/goals/ContributeSheet.jsx';
import GoalFormSheet from '../components/goals/GoalFormSheet.jsx';
import PaceHero from '../components/goals/PaceHero.jsx';
import WealthTelemetry from '../components/goals/WealthTelemetry.jsx';
import WorthItSheet from '../components/goals/WorthItSheet.jsx';
import FinancialDiary from '../components/diary/FinancialDiary.jsx';
import BehaviorPortrait from '../components/profile/BehaviorPortrait.jsx';
import WeeklyCard from '../components/weekly/WeeklyCard.jsx';
import { Card, ScreenHeader, Segmented } from '../components/ui.jsx';

const TEMPLATES = [
  { emoji: '🛟', name: 'Подушка безопасности', target: 300000, hint: '3 месяца спокойствия' },
  { emoji: '✈️', name: 'Отпуск', target: 500000, hint: 'Билеты и отель' },
  { emoji: '💻', name: 'Крупная покупка', target: 400000, hint: 'Техника, мебель' },
];

/**
 * «Планы» — два раздела вместо двух длинных списков:
 *   «Цель и дневник»   — герой «Цель и темп трат» (прогресс цели, «Сегодня можно потратить»,
 *                         прогноз даты, статус), неделя и лимит, «Финансовый дневник»;
 *   «Анализ и профиль» — поведенческий портрет, главные цифры, стратег, капитал в валютах.
 * Старые адреса раздела ('goals', 'diary') ведут в «Цель и дневник».
 */
export default function Goals({ now, toast, section = 'cockpit', onSection }) {
  const view = section === 'insights' ? 'insights' : 'cockpit';
  const { goals, activeGoalId, setActiveGoal, saveGoal, deleteGoal, contribute, transactions, settings, plan } = useFinance();
  const [form, setForm] = useState(null); // null | { goal } | { template }
  const [contributing, setContributing] = useState(false);
  const [worthOpen, setWorthOpen] = useState(false);
  const goal = goals.find((g) => g.id === activeGoalId) ?? goals[0];
  const advice = useMemo(() => (goal ? buildAdvice(transactions, goal, now) : null), [transactions, goal, now]);
  const balance = useMemo(() => Object.values(accountBalances(transactions, ACCOUNTS, settings.openings)).reduce((a, b) => a + b, 0), [transactions, settings.openings]);
  const pace = useMemo(() => buildSafeToSpend({ transactions, balance, plan, advice, now }), [transactions, balance, plan, advice, now]);
  const { money } = usePrivacy();

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Планы"
        right={
          view === 'cockpit' && goals.length > 0 ? (
            <button onClick={() => setForm({})} className="pressable flex h-10 shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-sm font-semibold text-on-ink">
              <Plus size={16} strokeWidth={2.6} /> Цель
            </button>
          ) : null
        }
      />
      <Segmented
        className="mx-5"
        value={view}
        onChange={onSection}
        items={[
          ['cockpit', 'Цель и дневник'],
          ['insights', 'Анализ и профиль'],
        ]}
      />

      <div className="mt-5 space-y-4 px-5">
        {view === 'cockpit' ? (
          <>
            {goals.length > 1 && (
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
                {goals.map((g) => {
                  const on = g.id === goal.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveGoal(g.id)}
                      className={`pressable flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold ${on ? 'bg-ink text-on-ink' : 'bg-surface text-ink-soft shadow-card'}`}
                      aria-pressed={on}
                    >
                      {g.emoji} <span className="max-w-[120px] truncate">{g.name}</span>
                      <span className="tabular opacity-70">{formatPercent(Math.min(1, g.saved / g.target))}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <PaceHero
              goal={goal}
              advice={advice}
              pace={pace}
              onContribute={() => setContributing(true)}
              onEdit={() => setForm({ goal })}
              onCreateGoal={() => setForm({})}
              onWorthIt={() => setWorthOpen(true)}
            />

            {!goal && (
              <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 py-1" aria-label="Готовые цели">
                {TEMPLATES.map((t) => (
                  <button key={t.name} onClick={() => setForm({ template: t })} className="pressable w-44 shrink-0 rounded-2xl bg-surface p-3 text-left shadow-card">
                    <span className="text-xl">{t.emoji}</span>
                    <span className="mt-1 block truncate text-[14px] font-semibold">{t.name}</span>
                    <span className="block truncate text-[12px] text-ink-muted">
                      {t.hint} · {money(t.target, { compact: true })}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <WeeklyCard now={now} />
            <FinancialDiary now={now} toast={toast} compact />
          </>
        ) : (
          <>
            <BehaviorPortrait now={now} />
            <WealthTelemetry now={now} />
            {goal && advice ? (
              <AdvisorPanel advice={advice} goal={goal} now={now} />
            ) : (
              <Card className="p-4">
                <p className="text-[15px] font-semibold">Стратег ждёт цель</p>
                <p className="mt-1 text-[13px] leading-snug text-ink-muted">Поставьте цель во вкладке «Цель и дневник» — стратег сравнит её с вашими тратами и покажет самый быстрый путь.</p>
              </Card>
            )}
            <CapitalCurrencies />
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
      {goal && (
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
      )}
      <WorthItSheet open={worthOpen} onClose={() => setWorthOpen(false)} goal={goal ?? null} advice={advice} />
    </div>
  );
}
