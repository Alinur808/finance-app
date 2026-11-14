import { useMemo, useState } from 'react';
import { CalendarDays, Check, NotebookPen, Pencil, TrendingUp } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { ACCOUNTS } from '../../data/accounts.js';
import { accountBalances } from '../../utils/analytics.js';
import { dayKey, formatFullDate, formatShortDate } from '../../utils/dates.js';
import { formatMoney, plural } from '../../utils/format.js';
import { buildPlanForecast } from '../../utils/plan.js';
import { describeRule } from '../../utils/schedule.js';
import { Card } from '../ui.jsx';
import PlanEditorSheet from './PlanEditorSheet.jsx';

const DAYS = ['день', 'дня', 'дней'];
// Округляем в безопасную сторону: доступные деньги — вниз, нехватку — вверх.
const money = (v, opts = {}) => formatMoney(v >= 0 ? Math.floor(v) : Math.ceil(v), { decimals: false, ...opts });
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const pct = (part, whole) => `${whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0}%`;

/**
 * «Финансовый дневник»: успеваю ли я собрать деньги на цели к дедлайну
 * и сколько можно тратить сегодня. Баланс берётся из текущего состояния
 * (все счета), план — из state.plan (сохраняется в localStorage и в экспорт).
 */
export default function FinancialDiary({ now, toast }) {
  const { transactions, settings, plan, togglePlanItemPaid, savePlan } = useFinance();
  const [editing, setEditing] = useState(false);

  const balance = useMemo(() => {
    const byAccount = accountBalances(transactions, ACCOUNTS, settings.openings);
    return Object.values(byAccount).reduce((a, b) => a + b, 0);
  }, [transactions, settings.openings]);

  const f = useMemo(() => buildPlanForecast({ plan, balance, transactions, now }), [plan, balance, transactions, now]);
  const hidden = settings.hideBalance;
  const show = (v, opts) => (hidden ? '••••' : money(v, opts));

  const editor = (
    <PlanEditorSheet
      open={editing}
      plan={plan}
      onClose={() => setEditing(false)}
      onSave={(next) => {
        savePlan(next);
        setEditing(false);
        toast?.('План сохранён');
      }}
    />
  );

  // План ещё не задан — объясняем, что делает дневник, вместо таблицы нулей.
  if (!plan.items.length && !plan.incomes.length) {
    return (
      <Card className="p-5">
        <Header subtitle="План трат до выбранной даты" onEdit={() => setEditing(true)} />
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Впереди крупные траты — например, подарки, поездка или техника? Укажите их, дату и ожидаемые поступления, и дневник каждый день будет показывать, сколько можно
          спокойно потратить, чтобы на всё хватило.
        </p>
        <button onClick={() => setEditing(true)} className="pressable mt-4 h-12 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
          Составить план
        </button>
        {editor}
      </Card>
    );
  }

  if (f.isOver) {
    return (
      <Card className="p-4">
        <Header subtitle={`Срок ${formatFullDate(f.deadline)} прошёл`} onEdit={() => setEditing(true)} />
        <p className="mt-3 text-sm text-ink-soft">Поставьте новую дату и цели, чтобы дневник снова считал дневной лимит.</p>
        {editor}
      </Card>
    );
  }

  // Шкала: баланс сейчас + ожидаемые поступления против суммы целей
  const scale = Math.max(f.projected, f.goalsTotal, 1);
  const balancePart = Math.max(0, f.balance);
  const goalsMarker = (f.goalsTotal / scale) * 100;
  const todayUsed = f.dailyLimit > 0 ? f.spentToday / f.dailyLimit : f.spentToday > 0 ? 1 : 0;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-3">
        <Header subtitle={`До ${formatFullDate(f.deadline)} · ${f.daysLeft === 0 ? 'сегодня' : `осталось ${plural(f.daysLeft, DAYS)}`}`} onEdit={() => setEditing(true)} />

        {/* Главная цифра: свободные деньги */}
        <div className={`mt-4 rounded-2xl p-3.5 ${f.safe >= 0 ? 'bg-brand-50' : 'bg-red-50'}`}>
          <p className={`text-[13px] font-medium ${f.safe >= 0 ? 'text-brand-800' : 'text-red-800'}`}>
            {f.safe >= 0 ? 'Можно тратить до дедлайна' : 'Не хватает до целей'}
          </p>
          <p className={`tabular text-[28px] font-extrabold leading-tight tracking-tight ${f.safe >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            {f.safe >= 0 ? show(f.safe) : show(Math.ceil(-f.safe))}
          </p>
          <p className={`text-[13px] ${f.safe >= 0 ? 'text-brand-800/80' : 'text-red-800/80'}`}>
            {f.safe >= 0
              ? `≈ ${show(f.dailyLimit)} в день на еду, транспорт и прочее`
              : `Нужно сократить траты или отложить одну из целей — иначе к ${formatShortDate(f.deadline).toLowerCase()} денег не хватит`}
          </p>
        </div>

        {/* Сегодня */}
        {f.safe >= 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-ink-soft">Сегодня потрачено</span>
              <span className="tabular text-ink-muted">
                <span className="font-bold text-ink">{show(f.spentToday)}</span> из {show(f.dailyLimit)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Потрачено сегодня от дневного лимита" aria-valuenow={Math.round(todayUsed * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full ${todayUsed > 1 ? 'bg-red-500' : todayUsed > 0.8 ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: pct(Math.min(todayUsed, 1), 1) }} />
            </div>
            <p className={`mt-1 text-[12px] ${f.leftToday < 0 ? 'text-red-600' : 'text-ink-muted'}`}>
              {f.leftToday >= 0
                ? `Осталось на сегодня ${show(f.leftToday)}`
                : `Перерасход ${show(-f.leftToday)} — лимит на следующие дни станет меньше`}
            </p>
          </div>
        )}

        {/* Капитал к дедлайну против целей */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-semibold text-ink-soft">Капитал к дедлайну</span>
            <span className="tabular font-bold">{show(f.projected)}</span>
          </div>
          <div className="relative mt-2 pb-5">
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-gray-100" role="img" aria-label={`Баланс ${money(f.balance)}, ожидается ${money(f.totalIncome)}, нужно на цели ${money(f.goalsTotal)}`}>
              <div className="h-full bg-brand-600" style={{ width: pct(balancePart, scale) }} />
              <div
                className="h-full bg-brand-300"
                style={{ width: pct(f.totalIncome, scale), backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 3px, transparent 3px 7px)' }}
              />
              {f.projected < f.goalsTotal && <div className="h-full bg-red-200" style={{ width: pct(f.goalsTotal - Math.max(0, f.projected), scale) }} />}
            </div>
            {f.goalsTotal > 0 && (
              <div className="absolute top-[-3px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${Math.min(goalsMarker, 99)}%` }}>
                <div className="h-[18px] w-[2px] rounded-full bg-ink" />
                <span className="mt-0.5 whitespace-nowrap text-[11px] font-semibold text-ink">цели</span>
              </div>
            )}
          </div>
          <dl className="space-y-1.5 text-[13px]">
            <Legend swatch="bg-brand-600" label="Баланс сейчас" value={show(f.balance)} />
            <Legend swatch="bg-brand-300" label={`Ожидается до ${formatFullDate(f.deadline).replace(/ \d{4}$/, '')}`} value={hidden ? '••••' : money(f.totalIncome, { sign: true })} />
            <Legend swatch="bg-ink" thin label="Нужно на цели" value={show(f.goalsTotal)} />
          </dl>
        </div>
      </div>

      {/* Цели-покупки с отметкой «оплачено» */}
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Цели</p>
        <ul className="space-y-0.5">
          {plan.items.map((item) => {
            const paid = Boolean(item.paidOn);
            return (
              <li key={item.id}>
                <button
                  onClick={() => togglePlanItemPaid(item.id, dayKey(now))}
                  className="flex w-full items-center gap-3 rounded-xl py-1.5 text-left active:bg-gray-50"
                  aria-pressed={paid}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${paid ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'}`}>
                    {paid && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[14px] ${paid ? 'text-ink-muted line-through' : 'font-medium'}`}>{item.name}</span>
                  <span className={`tabular text-[14px] ${paid ? 'text-ink-muted line-through' : 'font-semibold'}`}>{money(item.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {f.goalsPaid > 0 && <p className="mt-1 text-[12px] text-ink-muted">Отмеченные оплаченными уже списаны с баланса и не входят в «нужно».</p>}
      </div>

      {/* Ожидаемые поступления */}
      <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3">
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Поступления до дедлайна</p>
        <ul className="space-y-1 text-[13px]">
          {f.incomes.map((inc) => (
            <li key={inc.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-ink-soft" title={inc.name}>
                {capitalize(describeRule(inc.rule))}
              </span>
              <span className="tabular shrink-0 text-ink-muted">
                {inc.count} × {money(inc.amount)} = <b className="text-ink">{money(inc.total)}</b>
              </span>
            </li>
          ))}
        </ul>
        {f.nextIncome && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-brand-700">
            <TrendingUp size={14} /> Следующее: {formatShortDate(f.nextIncome.date)}, {money(f.nextIncome.amount, { sign: true })}
          </p>
        )}
      </div>
      {editor}
    </Card>
  );
}

function Header({ subtitle, onEdit }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f6ecdc] text-[#a8732b]">
        <NotebookPen size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold leading-tight">Финансовый дневник</h2>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
          <CalendarDays size={12} /> {subtitle}
        </p>
      </div>
      <button onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-ink-soft active:bg-gray-200" aria-label="Изменить план">
        <Pencil size={16} />
      </button>
    </div>
  );
}

function Legend({ swatch, thin, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`shrink-0 rounded-full ${swatch} ${thin ? 'h-3 w-[3px]' : 'h-2.5 w-2.5'}`} aria-hidden="true" />
      <dt className="flex-1 text-ink-soft">{label}</dt>
      <dd className="tabular font-semibold">{value}</dd>
    </div>
  );
}
