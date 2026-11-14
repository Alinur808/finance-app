import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { ACCOUNTS } from '../../data/accounts.js';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { accountBalances } from '../../utils/analytics.js';
import { formatPercent } from '../../utils/format.js';
import { buildTelemetry, runwayTone } from '../../utils/telemetry.js';
import { Card } from '../ui.jsx';

const TONE = { good: 'text-brand-600', watch: 'text-amber-600', risk: 'text-red-600' };
const TONE_LABEL = { good: 'хватит надолго', watch: 'стоит подкопить', risk: 'мало — урежьте траты' };

/**
 * Главные цифры: сколько уходит в месяц, какую долю дохода вы откладываете,
 * на сколько хватит денег и куда уходит больше всего.
 */
export default function WealthTelemetry({ now }) {
  const { transactions, settings } = useFinance();
  const { money } = usePrivacy();
  const balance = useMemo(() => Object.values(accountBalances(transactions, ACCOUNTS, settings.openings)).reduce((a, b) => a + b, 0), [transactions, settings.openings]);
  const t = useMemo(() => buildTelemetry(transactions, balance, now), [transactions, balance, now]);
  if (!t.hasData) return null;

  const tone = runwayTone(t.runwayDays);
  const runway = Number.isFinite(t.runwayDays) ? (t.runwayDays >= 90 ? `${(t.runwayDays / 30.44).toFixed(1).replace('.', ',')} мес.` : `${Math.floor(t.runwayDays)} дн.`) : '∞';
  const rate = t.savingsRate;

  const tiles = [
    { k: 'Расход в месяц', v: money(t.burn, { compact: t.burn >= 1e6, decimals: false }), sub: `≈ ${money(t.burnDaily, { decimals: false })} в день`, cls: 'text-ink' },
    {
      k: 'Откладываете',
      v: rate == null ? '—' : formatPercent(Math.max(0, rate)),
      sub: rate == null ? 'доходов пока нет' : rate < 0 ? 'тратите больше дохода' : `${money(t.net, { sign: true, compact: t.net >= 1e6, decimals: false })} в месяц`,
      cls: rate == null ? 'text-ink-muted' : rate >= 0.2 ? 'text-brand-600' : rate >= 0 ? 'text-amber-600' : 'text-red-600',
    },
    { k: 'Запас денег', v: runway, sub: TONE_LABEL[tone], cls: TONE[tone] },
    {
      k: 'Главная статья',
      v: t.concentration ? formatPercent(t.concentration.share) : '—',
      sub: t.concentration ? t.concentration.name : 'расходов нет',
      cls: t.concentration && t.concentration.share >= 0.4 ? 'text-amber-600' : 'text-ink',
    },
  ];

  return (
    <Card className="p-4" data-testid="wealth-telemetry">
      <div className="mb-3 flex items-center gap-2">
        <Activity size={16} className="text-brand-600" />
        <h2 className="flex-1 text-[15px] font-semibold">Главные цифры</h2>
        <span className="text-[11px] text-ink-muted">за {t.windowDays} дн.</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((x) => (
          <div key={x.k} className="min-w-0 rounded-2xl bg-gray-50 px-3 py-2.5">
            <p className="eyebrow truncate">{x.k}</p>
            <p className={`tabular mt-1 truncate text-[19px] font-semibold tracking-[-0.01em] ${x.cls}`}>{x.v}</p>
            <p className="truncate text-[11px] text-ink-muted">{x.sub}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
