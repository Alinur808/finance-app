import { CalendarClock, Pencil, Plus, Scale } from 'lucide-react';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { describeWeeks } from '../../utils/advisor.js';
import { formatFullDate } from '../../utils/dates.js';
import { formatPercent } from '../../utils/format.js';
import FitText from '../FitText.jsx';
import { GOAL_STATUS } from './goalStatus.js';

/**
 * Герой вкладки «Планы» — «Цель и темп трат» в одной карточке:
 *   прогресс активной цели · «Сегодня можно потратить X ₸» · прогноз даты · статус.
 * Сумма на сегодня — из «Финансового дневника», если план составлен, иначе — от месяца
 * (utils/pace.js). Все суммы проходят через Stealth Mode.
 */
export default function PaceHero({ goal, advice, pace, onContribute, onEdit, onCreateGoal, onWorthIt }) {
  const privacy = usePrivacy();
  const money = (v, opts) => privacy.money(v >= 0 ? Math.floor(v) : Math.ceil(v), { decimals: false, ...opts });
  const progress = goal?.target ? Math.min(1, goal.saved / goal.target) : 0;
  const status = goal && advice ? GOAL_STATUS[advice.status] : null;

  const tone = !pace ? 'muted' : pace.status === 'ok' ? 'ok' : 'warn';
  const box = { ok: 'bg-brand-500/10 ring-brand-500/25', warn: 'bg-red-500/10 ring-red-500/25', muted: 'bg-white/5 ring-white/10' }[tone];

  let headline = 'Сегодня можно потратить';
  let amount = pace ? Math.max(0, pace.allowance) : null;
  let caption = '';
  if (!pace) caption = 'Добавьте доходы — и приложение посчитает дневной лимит';
  else if (pace.status === 'short') {
    headline = pace.source === 'diary' ? 'Не хватает до целей дневника' : 'Бюджет месяца уже потрачен';
    amount = pace.source === 'diary' ? Math.ceil(-pace.forecast.safe) : 0;
    caption = pace.source === 'diary' ? 'Сократите траты или перенесите одну из целей' : 'Новые траты отодвигают цель';
  } else if (pace.status === 'over') {
    headline = 'Сегодня перерасход';
    amount = -pace.allowance;
    caption = 'Лимит следующих дней станет меньше';
  } else caption = `из ${money(pace.daily)} на день${pace.spentToday > 0 ? ` · потрачено ${money(pace.spentToday)}` : ''}${pace.source === 'diary' ? ' · по дневнику' : ''}`;

  let forecast = null;
  if (goal && advice) {
    if (advice.status === 'done') forecast = 'Цель достигнута — поставьте следующую';
    else if (advice.status === 'no-data') forecast = 'Добавьте доходы и расходы — появится прогноз даты';
    else if (advice.eta) {
      const diff = advice.weeksLeft - advice.baseWeeks;
      forecast = `Прогноз: ${formatFullDate(advice.eta)}${Math.abs(diff) >= 0.15 ? ` — на ${describeWeeks(Math.abs(diff))} ${diff > 0 ? 'раньше' : 'позже'} срока` : ''}`;
    } else forecast = 'При нынешнем темпе цель не наступит — урежьте траты';
  }

  return (
    <section
      className="relative overflow-hidden rounded-[28px] p-5 shadow-card"
      style={{ background: 'var(--card-bg)', color: 'rgb(var(--card-ink))', boxShadow: 'inset 0 0 0 1px var(--card-edge)' }}
      data-testid="pace-hero"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">Цель и темп трат</p>
          <h2 className="mt-1 truncate text-[19px] font-semibold tracking-tight">{goal ? `${goal.emoji} ${goal.name}` : 'Цель пока не задана'}</h2>
        </div>
        {goal ? (
          <button
            onClick={onEdit}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full active:opacity-70"
            style={{ background: 'var(--card-sheen)', boxShadow: 'inset 0 0 0 1px var(--card-edge)' }}
            aria-label="Изменить цель"
          >
            <Pencil size={15} />
          </button>
        ) : null}
      </div>

      {goal && (
        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'rgba(127,127,127,0.2)' }} role="progressbar" aria-label="Накоплено на цель" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: formatPercent(progress) }} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="tabular font-semibold">{formatPercent(progress)}</span>
            <span className="tabular truncate opacity-70">
              {money(goal.saved)} из {money(goal.target)}
            </span>
          </div>
        </div>
      )}

      <div className={`mt-4 rounded-2xl px-4 py-3 ring-1 ${box}`} data-testid="safe-to-spend">
        <p className="text-[13px] font-medium opacity-75">{headline}</p>
        {amount != null && (
          <FitText max={30} min={18} className={`font-bold tracking-tight ${tone === 'warn' ? 'text-red-600' : ''}`}>
            {money(amount)}
          </FitText>
        )}
        <p className="text-[12px] opacity-70">{caption}</p>
      </div>

      {(status || forecast) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ${status.cls}`} data-testid="goal-status">
              <status.icon size={13} /> {status.label}
            </span>
          )}
          {forecast && (
            <span className="flex min-w-0 items-center gap-1 text-[12px] opacity-75">
              <CalendarClock size={13} className="shrink-0" /> <span className="min-w-0">{forecast}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
        {goal ? (
          <button
            onClick={onContribute}
            disabled={goal.saved >= goal.target}
            className="pressable flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[14px] font-semibold text-on-ink disabled:opacity-60"
          >
            <Plus size={16} strokeWidth={2.6} /> Пополнить
          </button>
        ) : (
          <button onClick={onCreateGoal} className="pressable flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[14px] font-semibold text-on-ink">
            <Plus size={16} strokeWidth={2.6} /> Поставить цель
          </button>
        )}
        <button
          onClick={onWorthIt}
          className="pressable flex h-11 items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold"
          style={{ background: 'var(--card-sheen)', boxShadow: 'inset 0 0 0 1px var(--card-edge)' }}
          data-testid="open-worth-it"
        >
          <Scale size={16} /> Стоит ли оно того?
        </button>
      </div>
    </section>
  );
}
