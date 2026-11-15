import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Lock, Radar } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { useSubscription } from '../../context/SubscriptionContext.jsx';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { describeChanges, detectAnomalies, monthOverMonth } from '../../utils/advisor.js';
import { formatPercent, plural } from '../../utils/format.js';
import { Card } from '../ui.jsx';

/**
 * ИИ-аналитик без ключа API: «этот месяц против тех же дней прошлого» по категориям
 * и необычно крупные траты. Private; в Standard — тизер с числом находок.
 */
export default function ChangesCard({ now }) {
  const { transactions } = useFinance();
  const { isPrivate, openPaywall } = useSubscription();
  const { text, money } = usePrivacy();
  const mom = useMemo(() => monthOverMonth(transactions, now), [transactions, now]);
  const anomalies = useMemo(() => detectAnomalies(transactions, now), [transactions, now]);
  const lines = useMemo(() => describeChanges(mom, anomalies), [mom, anomalies]);
  if (!lines.length) return null;
  const movers = mom.comparable ? mom.categories.filter((c) => c.previous > 0 && c.change != null && Math.abs(c.delta) >= 3000).slice(0, 4) : [];

  if (!isPrivate) {
    return (
      <button onClick={() => openPaywall('aiAnalyst')} className="pressable flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-card" data-testid="changes-teaser">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
          <Radar size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Что изменилось: {plural(lines.length, ['находка', 'находки', 'находок'])}</span>
          <span className="block text-[13px] text-ink-muted">Месяц к месяцу и необычные траты — в Private</span>
        </span>
        <Lock size={16} className="shrink-0 text-ink-muted" />
      </button>
    );
  }

  return (
    <Card className="p-4" data-testid="changes-card">
      <div className="mb-2 flex items-center gap-2">
        <Radar size={17} className="text-brand-600" />
        <h3 className="flex-1 text-[15px] font-semibold">Что изменилось</h3>
        <span className="text-[11px] text-ink-muted">к прошлому месяцу</span>
      </div>
      <ul className="space-y-1.5 text-[13px] leading-snug text-ink-soft">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
            {text(l)}
          </li>
        ))}
      </ul>
      {movers.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {movers.map((c) => (
            <div key={c.id} className="min-w-0 rounded-2xl bg-gray-50 px-3 py-2">
              <p className="truncate text-[12px] text-ink-muted">{c.name}</p>
              <p className={`tabular flex items-center gap-0.5 text-[14px] font-semibold ${c.delta > 0 ? 'text-red-600' : 'text-brand-600'}`}>
                {c.delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {formatPercent(Math.abs(c.change))}
              </p>
              <p className="tabular truncate text-[11px] text-ink-muted">{money(c.current, { decimals: false })}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
